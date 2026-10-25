"""
Strata Pro v0 — modèle de référence en entiers.

Spécification exécutable de `contracts/pro/`. Chaque fonction publique correspond à une fonction
du contrat, avec les mêmes contrôles dans le même ordre et les mêmes erreurs. Aucun flottant :
tous les montants sont en unités USDx (7 décimales), les quantités en lots entiers.

Une transaction qui échoue ne modifie rien (comme une invocation Soroban qui panique) :
`_tx` restaure l'état complet en cas d'erreur.

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

ERRORS = {
    "InvalidArgs": 201, "NotFound": 202, "Unauthorized": 203, "WrongState": 204,
    "SeriesExpired": 205, "NotExpired": 206, "StaleSnapshot": 207, "BadSnapshot": 208,
    "InsufficientMargin": 209, "OiCapExceeded": 210, "NotLiquidable": 211, "VaultCapacity": 212,
    "NoSettlementPrice": 213, "SettlementWindowClosed": 214, "WithdrawLocked": 215,
    "TooManySeries": 216, "SelfTrade": 217, "InsolventTakeover": 218, "Overflow": 219,
    "TooManyPositions": 220,   # borne de stockage côté contrat (index par vendeur), absente des fixtures
}


class ProError(Exception):
    def __init__(self, name: str):
        super().__init__(name)
        self.name = name
        self.code = ERRORS[name]


def ceil_div(a: int, b: int) -> int:
    return -((-a) // b)


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
    lp_notice: int = 7 * 86_400    # préavis de retrait LP
    settle_window: int = 86_400    # délai pour publier le prix final après l'échéance


@dataclass
class Series:
    id: int
    strike: int                    # par lot, unités USDx
    expiry: int                    # timestamp
    settlement_price: int | None = None
    oi: int = 0


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
    writer: str
    qty: int
    settled: bool = False
    paid: int = 0
    deficit: int = 0


class ProModel:
    def __init__(self, admin: str, publisher: str, cfg: MarketConfig | None = None):
        self.admin, self.publisher = admin, publisher
        self.cfg = cfg or MarketConfig()
        self.now = 0
        self.series: dict[int, Series] = {}
        self.snaps: dict[int, Snapshot] = {}
        self.accounts: dict[str, Account] = {VAULT: Account()}
        self.offers: dict[int, Offer] = {}
        self.positions: dict[int, Position] = {}
        self.lp_shares: dict[str, int] = {}
        self.total_shares = 0
        self.lp_requests: dict[str, tuple] = {}      # lp -> (shares, unlock_at)
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

    def _push(self, who: str, amount: int):          # transfert contrat -> wallet
        self.contract_balance -= amount
        self.wallets[who] = self.wallets.get(who, 0) + amount

    def acct(self, who: str) -> Account:
        return self.accounts.setdefault(who, Account())

    def _series(self, sid: int) -> Series:
        if sid not in self.series:
            raise ProError("NotFound")
        return self.series[sid]

    # ------------------------------------------------------------------ risque

    def _fresh(self, sid: int) -> Snapshot:
        s = self.snaps.get(sid)
        if s is None or self.now - s.ts > self.cfg.max_age:
            raise ProError("StaleSnapshot")
        return s

    def requirement(self, who: str) -> dict:
        """NLV, scan, plancher, liquidité, MM, IM d'un compte. StaleSnapshot si une série courte n'a pas
        de snapshot frais : aucune décision de risque sur un prix périmé."""
        a = self.acct(who)
        liability = 0
        pnl = [0] * N_SCEN
        smin = liq = 0
        for sid, q in sorted(a.shorts.items()):
            if q == 0:
                continue
            s = self._fresh(sid)
            liability += q * s.mark
            for w in range(N_SCEN):
                pnl[w] += q * s.ra[w]
            smin += q * s.smin
            liq += q * s.liq
        scan = max(0, max(pnl))
        mm = max(scan, smin) + liq
        im = ceil_div(mm * self.cfg.im_bps, BPS)
        return {"nlv": a.cash - liability, "liability": liability, "scan": scan, "smin": smin,
                "liq": liq, "mm": mm, "im": im, "worst": pnl.index(max(pnl)) if any(pnl) else 0}

    # ------------------------------------------------------------------ admin / publieur

    def list_series(self, caller: str, strike: int, expiry: int) -> int:
        return self._tx(self._list_series, caller, strike, expiry)

    def _list_series(self, caller, strike, expiry):
        if caller != self.admin:
            raise ProError("Unauthorized")
        if strike <= 0 or expiry <= self.now:
            raise ProError("InvalidArgs")
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
        self._pull(who, amount)
        self.acct(who).cash += amount
        self.events.append(("Deposited", who, amount))

    def withdraw(self, who: str, amount: int):
        return self._tx(self._withdraw, who, amount)

    def _withdraw(self, who, amount):
        a = self.acct(who)
        if amount <= 0 or who == VAULT or amount > a.cash:
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
        w = self.acct(o.writer)
        if ser.oi + o.qty > self.cfg.max_series_oi or sum(w.shorts.values()) + o.qty > self.cfg.max_writer_oi:
            raise ProError("OiCapExceeded")
        if o.series_id not in w.shorts and len(w.shorts) >= MAX_SERIES_PER_ACCOUNT:
            raise ProError("TooManySeries")
        # transferts : prime -> contrat ; part de réserve -> vault ; reste -> marge du vendeur (bloquée)
        self._pull(buyer, o.premium)
        fee = o.premium * self.cfg.reserve_fee_bps // BPS
        w.cash += o.premium - fee
        self.accounts[VAULT].cash += fee
        w.shorts[o.series_id] = w.shorts.get(o.series_id, 0) + o.qty
        ser.oi += o.qty
        o.open = False
        pid = len(self.positions)
        self.positions[pid] = Position(pid, o.series_id, buyer, o.writer, o.qty)
        # marge APRÈS opération
        r = self.requirement(o.writer)
        if r["nlv"] < r["im"]:
            raise ProError("InsufficientMargin")
        self.events.append(("Bought", pid, buyer, o.writer, o.qty, o.premium, fee))
        return pid

    # ------------------------------------------------------------------ liquidation

    def liquidate(self, caller: str, writer: str, taker: str):
        """taker = adresse d'un repreneur (qui signe) ou VAULT (déclenchable par n'importe qui)."""
        return self._tx(self._liquidate, caller, writer, taker)

    def _liquidate(self, caller, writer, taker):
        if taker != VAULT and caller != taker:
            raise ProError("Unauthorized")
        if writer == VAULT or taker == writer:
            raise ProError("InvalidArgs")
        w = self.acct(writer)
        if not any(w.shorts.values()):
            raise ProError("NotLiquidable")
        for sid in w.shorts:
            if self.now >= self.series[sid].expiry:
                raise ProError("SeriesExpired")       # après l'échéance : règlement, pas de reprise
        r = self.requirement(writer)
        if r["nlv"] >= r["mm"]:
            raise ProError("NotLiquidable")
        # prix de reprise : mark + bonus, arrondi vers le bas (ne jamais extraire plus que la règle)
        x = sum(q * self.snaps[sid].mark * (BPS + self.cfg.bonus_bps) // BPS for sid, q in w.shorts.items())
        pay = min(x, w.cash)
        deficit = x - pay
        if taker != VAULT and deficit > 0:
            raise ProError("InsolventTakeover")      # seuls les comptes solvables vont aux repreneurs privés
        t = self.acct(taker)
        new_series = set(w.shorts) - set(t.shorts)
        if taker != VAULT and len(t.shorts) + len(new_series) > MAX_SERIES_PER_ACCOUNT:
            raise ProError("TooManySeries")
        if taker != VAULT and sum(t.shorts.values()) + sum(w.shorts.values()) > self.cfg.max_writer_oi:
            raise ProError("OiCapExceeded")
        w.cash -= pay
        t.cash += pay
        for sid, q in w.shorts.items():
            t.shorts[sid] = t.shorts.get(sid, 0) + q
        for p in self.positions.values():
            if p.writer == writer and not p.settled:
                p.writer = taker                     # les droits des acheteurs ne changent pas
        moved = dict(w.shorts)
        w.shorts = {}
        rt = self.requirement(taker)
        if taker == VAULT:
            if rt["nlv"] < rt["mm"]:
                raise ProError("VaultCapacity")
        elif rt["nlv"] < rt["im"]:
            raise ProError("InsufficientMargin")
        self.events.append(("TakenOver", writer, taker, moved, x, pay, deficit))
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
        ser.settlement_price = price
        self.events.append(("SettlementPublished", sid, price))

    def settle(self, writer: str, sid: int):
        """Permissionless. Règle toutes les positions de (writer, série) d'un coup, au prorata : pas de
        premier arrivé, premier servi entre acheteurs d'un même vendeur."""
        return self._tx(self._settle, writer, sid)

    def _settle(self, writer, sid):
        ser = self._series(sid)
        if ser.settlement_price is None:
            raise ProError("NoSettlementPrice")
        w = self.acct(writer)
        if w.shorts.get(sid, 0) == 0:
            raise ProError("WrongState")
        per_lot = max(ser.settlement_price - ser.strike, 0)
        pos = sorted((p for p in self.positions.values()
                      if p.writer == writer and p.series_id == sid and not p.settled), key=lambda p: p.id)
        due = [p.qty * per_lot for p in pos]
        total = sum(due)
        from_writer = min(total, w.cash)
        w.cash -= from_writer
        from_vault = 0
        if writer != VAULT:
            v = self.accounts[VAULT]
            from_vault = min(total - from_writer, v.cash)
            v.cash -= from_vault
        paid = from_writer + from_vault
        alloc = [d * paid // total if total else 0 for d in due]
        rest = paid - sum(alloc)
        for i in range(len(alloc)):                 # poussières d'arrondi, par id croissant
            if rest == 0:
                break
            if alloc[i] < due[i]:
                alloc[i] += 1
                rest -= 1
        for p, d, a in zip(pos, due, alloc):
            p.settled, p.paid, p.deficit = True, a, d - a
            if a:
                self._push(p.holder, a)
        ser.oi -= w.shorts.pop(sid)
        self.events.append(("Settled", writer, sid, total, from_writer, from_vault, total - paid))
        return {"due": total, "from_writer": from_writer, "from_vault": from_vault, "deficit": total - paid,
                "alloc": alloc}

    # ------------------------------------------------------------------ vault LP

    def vault_value(self) -> int:
        v = self.accounts[VAULT]
        return v.cash if not any(v.shorts.values()) else self.requirement(VAULT)["nlv"]

    def lp_deposit(self, lp: str, amount: int) -> int:
        return self._tx(self._lp_deposit, lp, amount)

    def _lp_deposit(self, lp, amount):
        if amount <= 0:
            raise ProError("InvalidArgs")
        value = self.vault_value()
        if self.total_shares == 0:
            shares = amount
        else:
            if value <= 0:
                raise ProError("VaultCapacity")       # vault insolvable : pas de nouvelles parts
            shares = amount * self.total_shares // value
        if shares <= 0:
            raise ProError("InvalidArgs")
        self._pull(lp, amount)
        self.accounts[VAULT].cash += amount
        self.lp_shares[lp] = self.lp_shares.get(lp, 0) + shares
        self.total_shares += shares
        self.events.append(("LpDeposited", lp, amount, shares))
        return shares

    def lp_request_withdraw(self, lp: str, shares: int):
        return self._tx(self._lp_request, lp, shares)

    def _lp_request(self, lp, shares):
        if shares <= 0 or shares > self.lp_shares.get(lp, 0) or lp in self.lp_requests:
            raise ProError("InvalidArgs")
        self.lp_requests[lp] = (shares, self.now + self.cfg.lp_notice)
        self.events.append(("LpWithdrawRequested", lp, shares))

    def lp_withdraw(self, lp: str) -> int:
        return self._tx(self._lp_withdraw, lp)

    def _lp_withdraw(self, lp):
        if lp not in self.lp_requests:
            raise ProError("NotFound")
        shares, unlock = self.lp_requests[lp]
        if self.now < unlock:
            raise ProError("WithdrawLocked")
        value = self.vault_value()
        amount = max(value, 0) * shares // self.total_shares
        v = self.accounts[VAULT]
        if amount > v.cash:
            raise ProError("VaultCapacity")
        if any(v.shorts.values()):
            r = self.requirement(VAULT)
            if r["nlv"] - amount < r["im"]:
                raise ProError("VaultCapacity")      # le capital engagé reste bloqué
        v.cash -= amount
        self.lp_shares[lp] -= shares
        self.total_shares -= shares
        del self.lp_requests[lp]
        self._push(lp, amount)
        self.events.append(("LpWithdrawn", lp, shares, amount))
        return amount

    # ------------------------------------------------------------------ invariants

    def check_invariants(self):
        cash = sum(a.cash for a in self.accounts.values())
        assert self.contract_balance == cash, ("balance contrat != somme des comptes", self.contract_balance, cash)
        assert all(a.cash >= 0 for a in self.accounts.values()), "cash négatif"
        for sid, ser in self.series.items():
            shorts = sum(a.shorts.get(sid, 0) for a in self.accounts.values())
            longs = sum(p.qty for p in self.positions.values() if p.series_id == sid and not p.settled)
            assert shorts == longs == ser.oi, ("courts != longs != OI", sid, shorts, longs, ser.oi)
        for p in self.positions.values():
            if not p.settled:
                assert self.acct(p.writer).shorts.get(p.series_id, 0) >= p.qty
