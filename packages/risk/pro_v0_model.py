"""
Strata Pro v0.3.2 — modèle de référence en entiers.

Spécification exécutable de `contracts/pro/`. Chaque fonction publique correspond à une fonction
du contrat, avec les mêmes contrôles dans le même ordre et les mêmes erreurs. Aucun flottant :
tous les montants sont en unités USDx (7 décimales), les quantités en lots entiers.

Une transaction qui échoue ne modifie rien (comme une invocation Soroban qui panique) :
`_tx` restaure l'état complet en cas d'erreur.

Produit : calls nus AMÉRICAINS réglés en cash. Le porteur peut exercer avant `expiry` au spot d'un
snapshot de moins de `exercise_max_age` secondes, sauf sur un book repris par le vault (réglé à
l'échéance) ou contre un vendeur liquidable ou en règlement ; sinon il est réglé au prix final.

v0.1 (revue de la PR #30) : les positions appartiennent à un *book* (owner, série). La reprise
déplace des books (O(séries)), pas des positions ; le règlement est en deux temps puis chaque porteur
`claim` sa part (O(1) par transaction, aucun transfert poussé vers un tiers). Le vault paie au prorata
des insuffisances d'une série. Rôles séparés et exclus du marché.

v0.2 (2e revue) : pas d'exercice anticipé sur un book du vault ; snapshot d'exercice <= exercise_max_age ;
dette échue non cotée bornée par le snapshot le plus récent du sous-jacent ; cash d'un vendeur réparti
au prorata entre ses séries échues ; retraits LP coupés en v0 (dépôt seulement) ; reprise par le vault
toujours possible quand NLV < MM, pour que la perte soit visible.

v0.3 (4e revue) : le paiement d'une reprise par le vault reste réservé aux books repris (`reserve`), payé à leurs
porteurs au règlement avant toute mutualisation ; le déficit de reprise devient une dette du vendeur envers le vault
(`owed`), soldée avant tout retrait ; le premier dépôt LP est refusé si le vault vaut <= 0 avec des positions.

v0.3.1 (5e revue) : la dette de reprise est prélevée sur le cash du vendeur dès le règlement de son dernier book
échu (sans attendre un retrait) ; elle passe aussi avant le paiement d'une nouvelle reprise.
v0.3.2 (6e revue) : le vault prélève aussi sa créance au moment même de la reprise, sur le cash non réservé à la
dette échue ; une reprise de positions vivantes seules ne laisse donc plus de cash bloqué.

Conventions de risque (publiées par le publieur, bornées par le contrat) :
- `ra[w]`  : perte par lot COURT dans le scénario w (16 scénarios, ordre de strata_risk.ScanConfig),
             arrondie vers le haut ; négative = gain du court.
- `mark`   : valeur d'un lot de call, arrondie vers le haut.
- `smin`   : plancher par lot court. `liq` : coût de sortie par lot (dimensionné pour max_writer_oi).
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field

SCALE = 10_000_000
BPS = 10_000
N_SCEN = 16
EXT_UP = 14          # index du scénario extrême haussier (+ext_mult * U, vol x1, poids 1)
VAULT = "VAULT"
MAX_SERIES_PER_ACCOUNT = 8
MAX_BOOKS_PER_ACCOUNT = 16     # books ouverts d'un compte privé ; le vault n'a pas de liste (jamais repris)
MAX_LIVE_SERIES = 16           # séries non clôturées ; borne aussi les séries du vault
MIN_FIRST_LP = 100 * SCALE     # premier dépôt LP minimal (attaque par inflation des parts)
I128_MAX = 2**127 - 1

ERRORS = {
    "InvalidArgs": 201, "NotFound": 202, "Unauthorized": 203, "WrongState": 204,
    "SeriesExpired": 205, "NotExpired": 206, "StaleSnapshot": 207, "BadSnapshot": 208,
    "InsufficientMargin": 209, "OiCapExceeded": 210, "NotLiquidable": 211, "VaultCapacity": 212,
    "NoSettlementPrice": 213, "SettlementWindowClosed": 214, "WithdrawLocked": 215,
    "TooManySeries": 216, "SelfTrade": 217, "InsolventTakeover": 218, "Overflow": 219,
    "TooManyPositions": 220,   # plus de MAX_BOOKS_PER_ACCOUNT books ouverts sur un compte privé
    # v0.1
    "RoleNotAllowed": 221,     # admin ou publieur comme contrepartie
    "PremiumBelowMark": 222,   # prime < qté x mark au moment de l'achat
    "OutOfTheMoney": 223,      # exercice anticipé sans valeur intrinsèque
    "LiquidateFirst": 224,     # le vendeur de la position est liquidable : reprise avant exercice
    "SettlementPending": 225,  # une série échue n'est pas clôturée : flux LP gelés
    # v0.2
    "NoEarlyExercise": 226,    # book repris par le vault : réglé à l'échéance, au prorata
}
# WithdrawLocked (215) reste réservé : les retraits LP sont coupés en v0.


class ProError(Exception):
    def __init__(self, name: str):
        super().__init__(name)
        self.name = name
        self.code = ERRORS[name]


def ceil_div(a: int, b: int) -> int:
    return -((-a) // b)


def chk(x: int) -> int:
    """Équivalent des checked_* du contrat : tout résultat hors i128 lève Overflow."""
    if not -I128_MAX - 1 <= x <= I128_MAX:
        raise ProError("Overflow")
    return x


@dataclass
class MarketConfig:
    psr_bps: int = 1_500           # U = 15 %
    ext_mult: int = 2              # scénarios extrêmes à ± 2U
    short_min_bps: int = 500       # plancher 5 % du spot par lot court
    im_bps: int = 12_500           # IM = 1,25 x MM
    max_age: int = 3_600           # fraîcheur des snapshots (s)
    max_series_oi: int = 50_000    # lots
    max_writer_oi: int = 20_000    # lots, toutes séries d'un vendeur
    bonus_bps: int = 500           # bonus du repreneur au-dessus du mark
    reserve_fee_bps: int = 1_000   # part de la prime versée au vault
    settle_window: int = 86_400    # délai pour publier le prix final après l'échéance
    exercise_max_age: int = 120    # âge max du snapshot pour un exercice anticipé (s)

    def validate(self):
        ok = (0 < self.psr_bps <= BPS and 1 <= self.ext_mult <= 4 and 0 < self.short_min_bps <= BPS
              and BPS <= self.im_bps <= 3 * BPS and self.max_age > 0 and self.max_series_oi > 0
              and 0 < self.max_writer_oi <= self.max_series_oi and self.bonus_bps <= 1_000
              and self.reserve_fee_bps <= BPS and self.settle_window > 0
              and 0 < self.exercise_max_age <= self.max_age)
        if not ok:
            raise ProError("InvalidArgs")


@dataclass
class Series:
    id: int
    strike: int                    # par lot, unités USDx
    expiry: int                    # timestamp
    settlement_price: int | None = None
    oi: int = 0
    open_books: int = 0            # books de la série pas encore réglés (qty > 0)
    shortfall: int = 0             # somme des insuffisances des books réglés (à couvrir par le vault)
    vault_paid: int = 0            # versé par le vault à settle_vault
    pool: int = 0                  # fonds réservés aux claims (owners + vault)
    claimed: int = 0
    closed: bool = False           # settle_vault exécuté


@dataclass
class Snapshot:
    series_id: int
    seq: int
    ts: int
    spot: int
    mark: int
    ra: list
    smin: int
    liq: int


@dataclass
class Account:
    cash: int = 0
    shorts: dict = field(default_factory=dict)     # series_id -> lots
    books: list = field(default_factory=list)      # ids des books ouverts (comptes privés seulement)
    owed: int = 0                  # dette envers le vault (déficit de reprise), soldée avant tout retrait
    reserved: int = 0              # vault seulement : somme des `reserve` de ses books ouverts


@dataclass
class Book:
    """Toutes les positions vendues par un même compte sur une série. La reprise change `owner`."""
    id: int
    series_id: int
    owner: str
    qty: int = 0                   # lots encore ouverts
    settled: bool = False
    due: int = 0                   # qty x max(S_T - K, 0) au règlement
    from_owner: int = 0            # payé par le compte propriétaire
    shortfall: int = 0             # due - from_owner, couvert ensuite au prorata par le vault
    reserve: int = 0               # book repris par le vault : paiement de reprise réservé à ses porteurs


@dataclass
class Offer:
    id: int
    writer: str
    series_id: int
    qty: int
    premium: int                   # total
    quote_expiry: int
    open: bool = True


@dataclass
class Position:
    id: int
    series_id: int
    holder: str
    book: int
    qty: int
    settled: bool = False          # exercée ou réclamée
    exercised: bool = False
    paid: int = 0
    deficit: int = 0


class ProModel:
    def __init__(self, admin: str, publisher: str, cfg: MarketConfig | None = None):
        if admin == publisher or VAULT in (admin, publisher):
            raise ProError("InvalidArgs")            # rôles distincts
        self.admin, self.publisher = admin, publisher
        self.cfg = cfg or MarketConfig()
        self.cfg.validate()
        self.now = 0
        self.series: dict[int, Series] = {}
        self.snaps: dict[int, Snapshot] = {}
        self.accounts: dict[str, Account] = {VAULT: Account()}
        self.books: dict[int, Book] = {}
        self.offers: dict[int, Offer] = {}
        self.positions: dict[int, Position] = {}
        self.lp_shares: dict[str, int] = {}
        self.total_shares = 0
        self.wallets: dict[str, int] = {}            # soldes USDx hors contrat (pour la conservation)
        self.contract_balance = 0
        self.events: list = []

    # ------------------------------------------------------------------ infrastructure

    def _tx(self, fn, *args):
        saved = copy.deepcopy(self.__dict__)
        try:
            return fn(*args)
        except ProError:
            self.__dict__.update(saved)
            raise

    def _pull(self, who: str, amount: int):          # transfert wallet -> contrat
        if self.wallets.get(who, 0) < amount:
            raise ProError("InvalidArgs")            # le SAC échouerait ; v0 : solde insuffisant
        self.wallets[who] -= amount
        self.contract_balance += amount

    def _push(self, who: str, amount: int):          # transfert contrat -> wallet (toujours vers l'appelant)
        self.contract_balance -= amount
        self.wallets[who] = self.wallets.get(who, 0) + amount

    def _not_role(self, who: str):
        if who in (self.admin, self.publisher):
            raise ProError("RoleNotAllowed")

    def acct(self, who: str) -> Account:
        return self.accounts.setdefault(who, Account())

    def _series(self, sid: int) -> Series:
        if sid not in self.series:
            raise ProError("NotFound")
        return self.series[sid]

    def _live(self, sid: int) -> bool:
        return self.now < self.series[sid].expiry

    def _settlement_pending(self) -> bool:
        """Une série échue a encore des engagements non clôturés (règlement en cours)."""
        return any(not s.closed and self.now >= s.expiry and (s.oi or s.open_books or s.shortfall)
                   for s in self.series.values())

    # ------------------------------------------------------------------ risque

    def _fresh(self, sid: int) -> Snapshot:
        s = self.snaps.get(sid)
        if s is None or self.now - s.ts > self.cfg.max_age:
            raise ProError("StaleSnapshot")
        return s

    def _latest_snap(self) -> Snapshot | None:
        """Snapshot le plus récent du déploiement (un seul sous-jacent) ; à égalité, le spot le plus haut."""
        return max(self.snaps.values(), key=lambda x: (x.ts, x.spot), default=None)

    def _expired_unpriced(self, a: Account) -> bool:
        return any(q and not self._live(sid) and self.series[sid].settlement_price is None
                   for sid, q in a.shorts.items())

    def _expired_liability(self, sid: int, q: int) -> int:
        """Série échue : dette exacte si le prix final est publié, sinon borne prudente sans fraîcheur :
        intrinsèque au scénario extrême haussier du snapshot le plus récent du sous-jacent (toutes séries)."""
        ser = self.series[sid]
        if ser.settlement_price is not None:
            return chk(q * max(ser.settlement_price - ser.strike, 0))
        s = self._latest_snap()
        if s is None:
            return 0
        s_up = s.spot * (BPS + self.cfg.ext_mult * self.cfg.psr_bps) // BPS
        return chk(q * max(s_up - ser.strike, 0))

    def requirement(self, who: str) -> dict:
        """NLV, scan, plancher, liquidité, MM, IM d'un compte. Séries vivantes : StaleSnapshot si le snapshot
        n'est pas frais. Séries échues : dette fixe (`expired`), sans marge de risque."""
        a = self.acct(who)
        liability = expired = 0
        pnl = [0] * N_SCEN
        smin = liq = 0
        for sid, q in sorted(a.shorts.items()):
            if q == 0:
                continue
            if not self._live(sid):
                expired += self._expired_liability(sid, q)
                continue
            s = self._fresh(sid)
            liability += chk(q * s.mark)
            for w in range(N_SCEN):
                pnl[w] += chk(q * s.ra[w])
            smin += chk(q * s.smin)
            liq += chk(q * s.liq)
        scan = max(0, max(pnl))
        mm = max(scan, smin) + liq
        im = ceil_div(chk(mm * self.cfg.im_bps), BPS)
        return {"nlv": a.cash + a.reserved - a.owed - liability - expired, "liability": liability, "expired": expired, "scan": scan,
                "smin": smin, "liq": liq, "mm": mm, "im": im, "worst": pnl.index(max(pnl)) if any(pnl) else 0}

    # ------------------------------------------------------------------ admin / publieur

    def list_series(self, caller: str, strike: int, expiry: int) -> int:
        return self._tx(self._list_series, caller, strike, expiry)

    def _list_series(self, caller, strike, expiry):
        if caller != self.admin:
            raise ProError("Unauthorized")
        if strike <= 0 or expiry <= self.now:
            raise ProError("InvalidArgs")
        if sum(1 for s in self.series.values() if not s.closed) >= MAX_LIVE_SERIES:
            raise ProError("TooManySeries")
        sid = len(self.series)
        self.series[sid] = Series(sid, strike, expiry)
        self.events.append(("SeriesListed", sid))
        return sid

    def publish_risk(self, caller: str, snap: Snapshot):
        return self._tx(self._publish_risk, caller, snap)

    def _publish_risk(self, caller, snap: Snapshot):
        if caller != self.publisher:
            raise ProError("Unauthorized")
        ser = self._series(snap.series_id)
        if self.now >= ser.expiry:
            raise ProError("SeriesExpired")
        prev = self.snaps.get(snap.series_id)
        if snap.ts > self.now or self.now - snap.ts > self.cfg.max_age:
            raise ProError("StaleSnapshot")
        if prev is not None and (snap.seq <= prev.seq or snap.ts < prev.ts):
            raise ProError("BadSnapshot")
        if len(snap.ra) != N_SCEN or snap.spot <= 0 or snap.liq < 0:
            raise ProError("BadSnapshot")
        intrinsic = max(snap.spot - ser.strike, 0)
        if not (intrinsic <= snap.mark <= snap.spot):          # bornes d'arbitrage d'un call
            raise ProError("BadSnapshot")
        if snap.smin < ceil_div(snap.spot * self.cfg.short_min_bps, BPS):
            raise ProError("BadSnapshot")
        # Plancher indépendant du publieur : dans le scénario extrême haussier, la perte d'un court est au
        # moins la valeur intrinsèque au spot choqué moins le mark (un call vaut toujours >= intrinsèque).
        # Ce contrôle borne la COHÉRENCE du snapshot, pas le spot lui-même : le spot reste celui du publieur.
        s_up = snap.spot * (BPS + self.cfg.ext_mult * self.cfg.psr_bps) // BPS
        if snap.ra[EXT_UP] < max(s_up - ser.strike, 0) - snap.mark:
            raise ProError("BadSnapshot")
        self.snaps[snap.series_id] = snap
        self.events.append(("RiskPublished", snap.series_id, snap.seq))

    # ------------------------------------------------------------------ marge

    def deposit(self, who: str, amount: int):
        return self._tx(self._deposit, who, amount)

    def _deposit(self, who, amount):
        if amount <= 0 or who == VAULT:
            raise ProError("InvalidArgs")
        self._not_role(who)
        self._pull(who, amount)
        self.acct(who).cash += amount
        self.events.append(("Deposited", who, amount))

    def withdraw(self, who: str, amount: int):
        return self._tx(self._withdraw, who, amount)

    def _withdraw(self, who, amount):
        a = self.acct(who)
        if amount <= 0 or who == VAULT or amount > a.cash:
            raise ProError("InvalidArgs")
        if any(q and not self._live(sid) for sid, q in a.shorts.items()):
            raise ProError("SeriesExpired")          # dette échue non réglée : aucun retrait avant settle
        if a.owed:                                   # la dette de reprise passe avant tout retrait
            self._repay(who)
            if amount > a.cash:
                raise ProError("InvalidArgs")
        if any(a.shorts.values()):
            r = self.requirement(who)
            if r["nlv"] - amount < r["im"]:
                raise ProError("InsufficientMargin")
        a.cash -= amount
        self._push(who, amount)
        self.events.append(("Withdrawn", who, amount))

    # ------------------------------------------------------------------ cotations et achat

    def create_offer(self, writer: str, sid: int, qty: int, premium: int, quote_expiry: int) -> int:
        return self._tx(self._create_offer, writer, sid, qty, premium, quote_expiry)

    def _create_offer(self, writer, sid, qty, premium, quote_expiry):
        ser = self._series(sid)
        if writer == VAULT or qty <= 0 or premium <= 0 or quote_expiry <= self.now or quote_expiry > ser.expiry:
            raise ProError("InvalidArgs")
        self._not_role(writer)
        oid = len(self.offers)
        self.offers[oid] = Offer(oid, writer, sid, qty, premium, quote_expiry)
        self.events.append(("OfferCreated", oid))
        return oid

    def cancel_offer(self, writer: str, oid: int):
        return self._tx(self._cancel_offer, writer, oid)

    def _cancel_offer(self, writer, oid):
        o = self.offers.get(oid)
        if o is None:
            raise ProError("NotFound")
        if o.writer != writer:
            raise ProError("Unauthorized")
        if not o.open:
            raise ProError("WrongState")
        o.open = False
        self.events.append(("OfferCancelled", oid))

    def _book_for(self, owner: str, sid: int) -> Book:
        """Book ouvert de `owner` sur la série (le plus ancien), créé si absent."""
        a = self.acct(owner)
        for bid in a.books:
            b = self.books[bid]
            if b.series_id == sid and not b.settled:
                return b
        if len(a.books) >= MAX_BOOKS_PER_ACCOUNT:
            raise ProError("TooManyPositions")
        bid = len(self.books)
        self.books[bid] = Book(bid, sid, owner)
        a.books.append(bid)
        self.series[sid].open_books += 1
        return self.books[bid]

    def buy(self, buyer: str, oid: int) -> int:
        return self._tx(self._buy, buyer, oid)

    def _buy(self, buyer, oid):
        o = self.offers.get(oid)
        if o is None:
            raise ProError("NotFound")
        if not o.open:
            raise ProError("WrongState")
        ser = self._series(o.series_id)
        if self.now >= o.quote_expiry or self.now >= ser.expiry:
            raise ProError("SeriesExpired")
        if buyer == o.writer or buyer == VAULT:
            raise ProError("SelfTrade")
        self._not_role(buyer)
        w = self.acct(o.writer)
        if ser.oi + o.qty > self.cfg.max_series_oi or sum(w.shorts.values()) + o.qty > self.cfg.max_writer_oi:
            raise ProError("OiCapExceeded")
        if o.series_id not in w.shorts and len(w.shorts) >= MAX_SERIES_PER_ACCOUNT:
            raise ProError("TooManySeries")
        if o.premium < chk(o.qty * self._fresh(o.series_id).mark):
            raise ProError("PremiumBelowMark")       # la part du vault ne peut pas être contournée
        # transferts : prime -> contrat ; part de réserve -> vault ; reste -> marge du vendeur (bloquée)
        self._pull(buyer, o.premium)
        fee = o.premium * self.cfg.reserve_fee_bps // BPS
        w.cash += o.premium - fee
        self.accounts[VAULT].cash += fee
        book = self._book_for(o.writer, o.series_id)
        book.qty += o.qty
        w.shorts[o.series_id] = w.shorts.get(o.series_id, 0) + o.qty
        ser.oi += o.qty
        o.open = False
        pid = len(self.positions)
        self.positions[pid] = Position(pid, o.series_id, buyer, book.id, o.qty)
        # marge APRÈS opération
        r = self.requirement(o.writer)
        if r["nlv"] < r["im"]:
            raise ProError("InsufficientMargin")
        self.events.append(("Bought", pid, buyer, o.writer, o.qty, o.premium, fee))
        return pid

    # ------------------------------------------------------------------ exercice américain

    def exercise(self, holder: str, pid: int):
        """Exercice anticipé, toute la position, au spot d'un snapshot de moins de `exercise_max_age`. Payé par
        le vendeur propriétaire du book, qui doit être sain (NLV >= MM) et sans dette échue non cotée.
        Un book repris par le vault n'est pas exerçable avant l'échéance : le vault paie au prorata à settle_vault."""
        return self._tx(self._exercise, holder, pid)

    def _exercise(self, holder, pid):
        p = self.positions.get(pid)
        if p is None:
            raise ProError("NotFound")
        if p.holder != holder:
            raise ProError("Unauthorized")
        book = self.books[p.book]
        if p.settled or book.settled:
            raise ProError("WrongState")
        ser = self.series[p.series_id]
        if self.now >= ser.expiry:
            raise ProError("SeriesExpired")           # après l'échéance : règlement puis claim
        owner = book.owner
        if owner == VAULT:
            raise ProError("NoEarlyExercise")         # pas de course au cash du vault
        snap = self.snaps.get(p.series_id)
        if snap is None or self.now - snap.ts > self.cfg.exercise_max_age:
            raise ProError("StaleSnapshot")           # pas d'option de regard en arrière sur un prix ancien
        per_lot = max(snap.spot - ser.strike, 0)
        if per_lot == 0:
            raise ProError("OutOfTheMoney")
        if self._expired_unpriced(self.acct(owner)):
            raise ProError("SettlementPending")       # la dette échue non cotée passe avant
        r = self.requirement(owner)
        if r["nlv"] < r["mm"]:
            raise ProError("LiquidateFirst")
        due = chk(p.qty * per_lot)
        a = self.acct(owner)
        # NLV >= MM >= 0 et due <= qty x mark <= liability : le cash couvre toujours `due`
        a.cash -= due
        a.shorts[p.series_id] -= p.qty
        if a.shorts[p.series_id] == 0:
            del a.shorts[p.series_id]
        book.qty -= p.qty
        ser.oi -= p.qty
        if book.qty == 0:
            book.settled = True
            ser.open_books -= 1
            a.books.remove(book.id)
        p.settled, p.exercised, p.paid = True, True, due
        self._push(holder, due)
        self.events.append(("Exercised", pid, holder, owner, p.qty, snap.spot, due))
        return {"due": due, "spot": snap.spot}

    # ------------------------------------------------------------------ liquidation

    def liquidate(self, caller: str, writer: str, taker: str):
        """taker = adresse d'un repreneur (qui signe) ou VAULT (déclenchable par n'importe qui).
        Seules les séries vivantes sont reprises ; une dette échue reste au vendeur jusqu'au règlement."""
        return self._tx(self._liquidate, caller, writer, taker)

    def _liquidate(self, caller, writer, taker):
        if taker != VAULT and caller != taker:
            raise ProError("Unauthorized")
        if writer == VAULT or taker == writer:
            raise ProError("InvalidArgs")
        if taker != VAULT:
            self._not_role(taker)
        w = self.acct(writer)
        live = {sid: q for sid, q in w.shorts.items() if q and self._live(sid)}
        if not live:
            raise ProError("NotLiquidable")
        r = self.requirement(writer)
        if r["nlv"] >= r["mm"]:
            raise ProError("NotLiquidable")
        # prix de reprise : mark + bonus, arrondi vers le bas (ne jamais extraire plus que la règle)
        x = sum(chk(q * self.snaps[sid].mark * (BPS + self.cfg.bonus_bps)) // BPS for sid, q in live.items())
        # la dette échue, puis la dette de reprise envers le vault, gardent la priorité sur le cash
        pay = min(x, max(w.cash - r["expired"] - w.owed, 0))
        deficit = x - pay
        if taker != VAULT and deficit > 0:
            raise ProError("InsolventTakeover")      # seuls les comptes solvables vont aux repreneurs privés
        t = self.acct(taker)
        moved_books = [bid for bid in w.books if self._live(self.books[bid].series_id)]
        if taker != VAULT:
            new_series = set(live) - set(t.shorts)
            if len(t.shorts) + len(new_series) > MAX_SERIES_PER_ACCOUNT:
                raise ProError("TooManySeries")
            if sum(t.shorts.values()) + sum(live.values()) > self.cfg.max_writer_oi:
                raise ProError("OiCapExceeded")
            if len(t.books) + len(moved_books) > MAX_BOOKS_PER_ACCOUNT:
                raise ProError("TooManyPositions")
        w.cash -= pay
        if taker == VAULT:
            # le paiement reste attaché aux books repris, au prorata de leur valeur de reprise ; la poussière
            # d'arrondi va au cash du vault. Le déficit reste dû par le vendeur.
            vals = {bid: chk(self.books[bid].qty * self.snaps[self.books[bid].series_id].mark
                             * (BPS + self.cfg.bonus_bps)) // BPS for bid in moved_books}
            total_v = sum(vals.values())
            for bid, v in vals.items():
                share = chk(pay * v) // total_v if total_v else 0
                self.books[bid].reserve += share
                t.reserved += share
            t.cash += pay - sum(chk(pay * v) // total_v if total_v else 0 for v in vals.values())
            w.owed += deficit
            # le vault est le repreneur : il prélève sa créance tout de suite sur le cash non réservé à la dette
            # échue (sinon une reprise de positions vivantes seules laisse la dette sans déclencheur de collecte)
            self._repay(writer, cap=max(w.cash - r["expired"], 0))
        else:
            t.cash += pay
        for sid, q in live.items():
            t.shorts[sid] = t.shorts.get(sid, 0) + q
            del w.shorts[sid]
        for bid in moved_books:                      # O(books) écritures : les positions ne bougent pas
            self.books[bid].owner = taker
            w.books.remove(bid)
            if taker != VAULT:
                t.books.append(bid)
        if taker != VAULT:
            rt = self.requirement(taker)
            if rt["nlv"] < rt["im"]:
                raise ProError("InsufficientMargin")
        # le vault reprend toujours un compte sous MM, même s'il passe lui-même sous MM : la perte devient
        # visible dans vault_value (qui bloque alors les dépôts LP) au lieu de rester cachée chez le vendeur
        self.events.append(("TakenOver", writer, taker, live, x, pay, deficit))
        return {"x": x, "paid": pay, "deficit": deficit}

    # ------------------------------------------------------------------ règlement

    def publish_settlement(self, caller: str, sid: int, price: int):
        return self._tx(self._publish_settlement, caller, sid, price)

    def _publish_settlement(self, caller, sid, price):
        if caller != self.publisher:
            raise ProError("Unauthorized")
        ser = self._series(sid)
        if self.now < ser.expiry:
            raise ProError("NotExpired")
        if self.now > ser.expiry + self.cfg.settle_window:
            raise ProError("SettlementWindowClosed")
        if ser.settlement_price is not None:
            raise ProError("WrongState")               # prix final immuable
        if price < 0:
            raise ProError("InvalidArgs")
        # Non borné par le contrat : le prix final est fixé par l'équipe (publieur démo), ce qui est déclaré.
        ser.settlement_price = price
        self.events.append(("SettlementPublished", sid, price))

    def settle(self, bid: int):
        """Permissionless, étape 1 : fige la dette d'un book et la part payée par son propriétaire.
        Un book du vault ne paie rien ici : sa dette passe entièrement par settle_vault (prorata)."""
        return self._tx(self._settle, bid)

    def _settle(self, bid):
        b = self.books.get(bid)
        if b is None:
            raise ProError("NotFound")
        ser = self.series[b.series_id]
        if ser.settlement_price is None:
            raise ProError("NoSettlementPrice")
        if b.settled:
            raise ProError("WrongState")
        a = self.acct(b.owner)
        due = chk(b.qty * max(ser.settlement_price - ser.strike, 0))
        if b.owner == VAULT:
            # le book repris paie d'abord sa réserve (le paiement de son ancien vendeur) ; l'excédent revient
            # au vault, le reste dû passe en insuffisance mutualisée à settle_vault
            from_owner = min(due, b.reserve)
            a.reserved -= b.reserve
            a.cash += b.reserve - from_owner
            b.reserve = 0
        else:
            # le cash du vendeur est partagé au prorata entre toutes ses séries échues : on attend que chacune
            # ait son prix (ou que sa fenêtre soit close), puis chaque book reçoit due x cash / dette totale
            if any(q and not self._live(sid) and self.series[sid].settlement_price is None
                   and self.now <= self.series[sid].expiry + self.cfg.settle_window for sid, q in a.shorts.items()):
                raise ProError("NoSettlementPrice")
            total = sum(self._book_due(x) for x in a.books if not self._live(self.books[x].series_id)
                        and self.series[self.books[x].series_id].settlement_price is not None)
            from_owner = due if a.cash >= total else (chk(due * a.cash) // total if total else 0)
        if b.owner != VAULT:
            a.cash -= from_owner
        a.shorts[b.series_id] -= b.qty
        if a.shorts[b.series_id] == 0:
            del a.shorts[b.series_id]
        ser.oi -= b.qty
        ser.open_books -= 1
        ser.shortfall += due - from_owner
        ser.pool += from_owner
        b.settled, b.due, b.from_owner, b.shortfall = True, due, from_owner, due - from_owner
        if b.owner != VAULT:
            a.books.remove(bid)
        self.events.append(("BookSettled", bid, b.owner, due, from_owner, due - from_owner))
        if b.owner != VAULT and a.owed and not any(q and not self._live(sid) for sid, q in a.shorts.items()):
            self._repay(b.owner)                      # dernier book échu réglé : la dette de reprise est prélevée
        return {"due": due, "from_owner": from_owner, "shortfall": due - from_owner}

    def _repay(self, who: str, cap: int | None = None):
        a = self.acct(who)
        paid = min(a.cash if cap is None else min(a.cash, cap), a.owed)
        if paid:
            a.cash -= paid
            a.owed -= paid
            self.accounts[VAULT].cash += paid
            self.events.append(("DebtRepaid", who, paid))

    def _book_due(self, bid: int) -> int:
        b = self.books[bid]
        ser = self.series[b.series_id]
        return chk(b.qty * max(ser.settlement_price - ser.strike, 0))

    def settle_vault(self, sid: int):
        """Permissionless, étape 2 : une fois tous les books de la série réglés, le vault couvre la somme des
        insuffisances au prorata : min(cash du vault, insuffisances). Rien n'est premier arrivé dans une série."""
        return self._tx(self._settle_vault, sid)

    def _settle_vault(self, sid):
        ser = self._series(sid)
        if ser.settlement_price is None:
            raise ProError("NoSettlementPrice")
        if ser.closed or ser.open_books:
            raise ProError("WrongState")
        v = self.accounts[VAULT]
        paid = min(ser.shortfall, v.cash)
        v.cash -= paid
        ser.vault_paid, ser.pool, ser.closed = paid, ser.pool + paid, True
        self.events.append(("VaultSettled", sid, ser.shortfall, paid, ser.shortfall - paid))
        return {"shortfall": ser.shortfall, "vault_paid": paid, "deficit": ser.shortfall - paid}

    def claim(self, holder: str, pid: int) -> dict:
        """Le porteur retire sa part (tirage, jamais poussé) : un porteur ne peut bloquer personne."""
        return self._tx(self._claim, holder, pid)

    def _claim(self, holder, pid):
        p = self.positions.get(pid)
        if p is None:
            raise ProError("NotFound")
        if p.holder != holder:
            raise ProError("Unauthorized")
        if p.settled:
            raise ProError("WrongState")
        ser = self.series[p.series_id]
        if not ser.closed:
            raise ProError("NoSettlementPrice" if ser.settlement_price is None else "WrongState")
        b = self.books[p.book]
        per_lot = max(ser.settlement_price - ser.strike, 0)
        due = chk(p.qty * per_lot)
        # part du book = owner + part prorata du vault ; part de la position = prorata de sa dette dans le book
        vault_share = chk(b.shortfall * ser.vault_paid) // ser.shortfall if ser.shortfall else 0
        book_paid = b.from_owner + vault_share
        paid = chk(due * book_paid) // b.due if b.due else 0
        p.settled, p.paid, p.deficit = True, paid, due - paid
        ser.claimed += paid
        if paid:
            self._push(holder, paid)
        self.events.append(("Claimed", pid, holder, due, paid, due - paid))
        return {"due": due, "paid": paid, "deficit": due - paid}

    # ------------------------------------------------------------------ vault LP

    def vault_value(self) -> int:
        v = self.accounts[VAULT]
        return v.cash if not any(v.shorts.values()) else self.requirement(VAULT)["nlv"]

    def lp_deposit(self, lp: str, amount: int) -> int:
        return self._tx(self._lp_deposit, lp, amount)

    def _lp_deposit(self, lp, amount):
        if amount <= 0:
            raise ProError("InvalidArgs")
        self._not_role(lp)
        if self._settlement_pending():
            raise ProError("SettlementPending")
        value = self.vault_value()
        if value < 0 or (value <= 0 and (self.total_shares or any(self.accounts[VAULT].shorts.values()))):
            raise ProError("VaultCapacity")           # vault en perte : aucune part émise, premier dépôt compris
        if self.total_shares == 0:
            if amount < MIN_FIRST_LP:
                raise ProError("InvalidArgs")
            shares = amount
        else:
            shares = amount * self.total_shares // value
        if shares <= 0:
            raise ProError("InvalidArgs")
        self._pull(lp, amount)
        self.accounts[VAULT].cash += amount
        self.lp_shares[lp] = self.lp_shares.get(lp, 0) + shares
        self.total_shares += shares
        self.events.append(("LpDeposited", lp, amount, shares))
        return shares

    # Retraits LP : coupés en v0 (2e revue PR #30). Le capital LP reste dans le vault : un retrait sûr exige de
    # connaître toutes les pertes latentes (vendeurs insolvables pas encore repris), ce que v0 ne sait pas faire.

    # ------------------------------------------------------------------ invariants

    def check_invariants(self):
        cash = sum(a.cash + a.reserved for a in self.accounts.values())
        pools = sum(s.pool - s.claimed for s in self.series.values())
        assert self.contract_balance == cash + pools, ("balance != comptes + pools", self.contract_balance, cash, pools)
        assert all(a.cash >= 0 for a in self.accounts.values()), "cash négatif"
        assert all(s.pool >= s.claimed for s in self.series.values()), "claims > pool"
        for sid, ser in self.series.items():
            shorts = sum(a.shorts.get(sid, 0) for a in self.accounts.values())
            books = sum(b.qty for b in self.books.values() if b.series_id == sid and not b.settled)
            longs = sum(p.qty for p in self.positions.values()
                        if p.series_id == sid and not p.settled and not self.books[p.book].settled)
            assert shorts == books == longs == ser.oi, ("courts/books/longs/OI", sid, shorts, books, longs, ser.oi)
            assert ser.open_books == sum(1 for b in self.books.values() if b.series_id == sid and not b.settled)
        v = self.accounts[VAULT]
        assert v.reserved == sum(b.reserve for b in self.books.values() if b.owner == VAULT and not b.settled)
        assert all(b.reserve == 0 for b in self.books.values() if b.settled or b.owner != VAULT)
        assert all(a.owed >= 0 for a in self.accounts.values())
        for who, a in self.accounts.items():
            assert all(self.books[b].owner == who and not self.books[b].settled for b in a.books)
            assert len(a.books) <= MAX_BOOKS_PER_ACCOUNT
