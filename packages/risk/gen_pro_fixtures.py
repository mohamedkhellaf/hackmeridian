"""
Génère `fixtures/pro_v0.json` : scénarios rejouables pas à pas par les tests Rust de `contracts/pro/`.

Chaque scénario = paramètres + soldes initiaux + liste d'étapes {op, args, expect, result, state}.
Le contrat est conforme si, en rejouant les étapes, il renvoie le même résultat ou le même code
d'erreur et atteint le même `state` après chaque étape. Le générateur vérifie lui-même les attentes
et les invariants : il échoue si le modèle de référence ne se comporte pas comme décrit.

Lancer : python gen_pro_fixtures.py   (déterministe ; aucune graine aléatoire)
"""
from __future__ import annotations

import json
import math
from dataclasses import asdict
from pathlib import Path

from pro_v0_model import (BPS, ERRORS, SCALE, VAULT, MarketConfig, ProError, ProModel, Snapshot,
                          ceil_div)
from strata_risk import ScanConfig, Series as FSeries, bs_call, bs_delta, liquidity_cost, risk_array

T0 = 1_800_000_000
DAY = 86_400
YEAR = 365 * DAY
SIGMA = 0.35
ADV = 50_000.0
K = 110 * SCALE
EXPIRY = T0 + 21 * DAY


def units(x: float) -> int:
    return round(x * SCALE)


def make_snapshot(m: ProModel, sid: int, seq: int, spot: float, sigma: float = SIGMA) -> Snapshot:
    """Ce que fait le publieur : moteur flottant, puis arrondis conservateurs (pertes et mark vers le haut)."""
    cfg = m.cfg
    ser = m.series[sid]
    tau = max(ser.expiry - m.now, 0) / YEAR
    strike = ser.strike / SCALE
    scan = ScanConfig(psr=cfg.psr_bps / BPS, ext_mult=cfg.ext_mult, ext_weight=1.0,
                      short_min=cfg.short_min_bps / BPS, adv=ADV)
    fs = FSeries("C", strike, tau)
    ra = [math.ceil(round(float(x) * SCALE, 6)) for x in risk_array(fs, spot, sigma, scan)]
    spot_u = units(spot)
    mark = min(math.ceil(round(float(bs_call(spot, strike, tau, sigma)) * SCALE, 6)), spot_u)
    mark = max(mark, max(spot_u - ser.strike, 0))
    smin = ceil_div(spot_u * cfg.short_min_bps, BPS)
    # coût de sortie dimensionné pour la taille maximale d'un vendeur (racine carrée : conservateur en dessous)
    q = cfg.max_writer_oi
    liq_total = float(liquidity_cost(q * float(bs_delta("C", spot, strike, tau, sigma)), spot, sigma, ADV))
    liq = math.ceil(round(liq_total / q * SCALE, 6))
    return Snapshot(sid, seq, m.now, spot_u, mark, ra, smin, liq)


class Recorder:
    def __init__(self, name: str, description: str, cfg: MarketConfig | None = None):
        self.m = ProModel("ADMIN", "PUBLISHER", cfg)
        self.m.now = T0
        self.name, self.description = name, description
        self.steps: list = []
        self.initial_wallets: dict = {}
        self.seq = 0

    def fund(self, **wallets):
        for who, amount in wallets.items():
            self.m.wallets[who] = self.m.wallets.get(who, 0) + amount * SCALE
            self.initial_wallets[who] = self.m.wallets[who]

    def state(self) -> dict:
        m = self.m
        return {
            "now": m.now,
            "contract_balance": m.contract_balance,
            "accounts": {k: {"cash": a.cash, "shorts": {str(s): q for s, q in sorted(a.shorts.items()) if q},
                             "books": list(a.books), "owed": a.owed, "reserved": a.reserved}
                         for k, a in sorted(m.accounts.items()) if a.cash or any(a.shorts.values()) or a.books},
            "wallets": dict(sorted(m.wallets.items())),
            "series": {str(s.id): {"oi": s.oi, "settlement_price": s.settlement_price, "open_books": s.open_books,
                                   "shortfall": s.shortfall, "vault_paid": s.vault_paid, "pool": s.pool,
                                   "claimed": s.claimed, "closed": s.closed} for s in m.series.values()},
            "books": {str(b.id): {"series_id": b.series_id, "owner": b.owner, "qty": b.qty, "settled": b.settled,
                                  "due": b.due, "from_owner": b.from_owner, "shortfall": b.shortfall,
                                  "reserve": b.reserve}
                      for b in m.books.values()},
            "positions": {str(p.id): {"holder": p.holder, "book": p.book, "qty": p.qty, "settled": p.settled,
                                      "exercised": p.exercised, "paid": p.paid, "deficit": p.deficit}
                          for p in m.positions.values()},
            "lp_shares": dict(sorted((k, v) for k, v in m.lp_shares.items() if v)),
            "total_shares": m.total_shares,
        }

    def step(self, op: str, *args, expect: str = "ok", note: str = ""):
        fn = getattr(self.m, op)
        rec_args = [asdict(a) if isinstance(a, Snapshot) else a for a in args]
        try:
            result = fn(*args)
            outcome = "ok"
        except ProError as e:
            result, outcome = None, e.name
        if outcome != expect:                        # pas d'assert : `python -O` ne doit pas écrire de fixtures fausses
            raise SystemExit(f"[{self.name}] {op}{tuple(rec_args)} : attendu {expect}, obtenu {outcome}")
        self.m.check_invariants()
        entry = {"op": op, "args": rec_args, "expect": outcome if outcome == "ok" else
                 {"error": outcome, "code": ERRORS[outcome]}}
        if result is not None:
            entry["result"] = result
        if note:
            entry["note"] = note
        entry["state"] = self.state()
        self.steps.append(entry)
        return result

    def view(self, who: str, note: str = ""):
        """Étape de lecture : le contrat doit exposer `get_requirement(who)` avec ces valeurs exactes."""
        r = self.m.requirement(who)
        self.steps.append({"op": "get_requirement", "args": [who], "expect": "ok", "result": r, "note": note})
        return r

    def advance(self, seconds: int):
        self.m.now += seconds
        self.steps.append({"op": "set_time", "args": [self.m.now], "expect": "ok"})

    def publish(self, sid: int, spot: float, expect: str = "ok", **kw):
        self.seq += 1
        snap = make_snapshot(self.m, sid, self.seq, spot)
        for k, v in kw.items():
            setattr(snap, k, v)
        self.step("publish_risk", "PUBLISHER", snap, expect=expect)
        return snap

    def dump(self) -> dict:
        return {"name": self.name, "description": self.description, "t0": T0,
                "config": asdict(self.m.cfg), "initial_wallets": self.initial_wallets, "steps": self.steps}


def open_short_at_im(r: Recorder, writer: str, buyer: str, sid: int, qty: int, extra: int = 0,
                     expect: str = "ok") -> int:
    """Le vendeur dépose exactement ce qu'il faut pour être à l'IM après la vente (+ extra), puis vend."""
    m = r.m
    snap = m.snaps[sid]
    premium = qty * snap.mark * 11 // 10                       # 10 % au-dessus du mark
    fee = premium * m.cfg.reserve_fee_bps // BPS
    probe = ProModel(m.admin, m.publisher, m.cfg)
    probe.now, probe.series, probe.snaps = m.now, m.series, m.snaps
    probe.accounts[writer] = type(m.acct(writer))(0, dict(m.acct(writer).shorts))
    probe.accounts[writer].shorts[sid] = probe.accounts[writer].shorts.get(sid, 0) + qty
    need = probe.requirement(writer)
    deposit = need["im"] + need["liability"] - (premium - fee) - m.acct(writer).cash + extra
    if deposit > 0:
        r.step("deposit", writer, deposit, note="dépôt calculé pour être exactement à l'IM après la vente")
    oid = r.step("create_offer", writer, sid, qty, premium, m.series[sid].expiry)
    return r.step("buy", buyer, oid, expect=expect)


def settle_all(r: Recorder, sid: int, note: str = "") -> dict:
    """Règlement complet d'une série : settle de chaque book ouvert, settle_vault, puis claim de chaque porteur."""
    m = r.m
    for bid in sorted(b.id for b in m.books.values() if b.series_id == sid and not b.settled):
        r.step("settle", bid, note=f"book {bid} ({m.books[bid].owner})")
    out = r.step("settle_vault", sid, note=note or "prorata des insuffisances de la série")
    for pid in sorted(p.id for p in m.positions.values() if p.series_id == sid and not p.settled):
        r.step("claim", m.positions[pid].holder, pid)
    return out


# ------------------------------------------------------------------------------------------------ scénarios

def s_happy_path():
    r = Recorder("happy_path_otm", "Vente nue, retrait de l'excédent, expiration hors de la monnaie.")
    r.fund(MAKER_A=100_000, ALICE=10_000, LP1=500_000)
    r.step("lp_deposit", "LP1", 200_000 * SCALE)
    sid = r.step("list_series", "ADMIN", K, EXPIRY)
    r.publish(sid, 100.0)
    open_short_at_im(r, "MAKER_A", "ALICE", sid, 1_000, extra=2_000 * SCALE)
    req = r.view("MAKER_A", "MM = max(scan, plancher) + liquidité ; IM = ceil(1,25 x MM)")
    room = req["nlv"] - req["im"]
    r.step("withdraw", "MAKER_A", room + 1, expect="InsufficientMargin", note="1 unité de trop")
    r.step("withdraw", "MAKER_A", room, note="retrait exact de l'excédent au-dessus de l'IM")
    r.advance(21 * DAY)
    r.publish(sid, 95.0, expect="SeriesExpired")
    r.step("liquidate", "KEEPER", "MAKER_A", VAULT, expect="NotLiquidable", note="seules les séries vivantes se reprennent")
    r.step("withdraw", "MAKER_A", 1 * SCALE, expect="SeriesExpired", note="dette échue non réglée : retrait gelé")
    r.step("publish_settlement", "PUBLISHER", sid, 95 * SCALE)
    settle_all(r, sid, note="hors de la monnaie : dû 0")
    cash = r.m.acct("MAKER_A").cash
    r.step("withdraw", "MAKER_A", cash, note="plus de position : tout le cash est retirable")
    return r


def s_insufficient_margin():
    r = Recorder("insufficient_margin_reverts", "Un fill sous-financé ne crée rien et ne déplace aucun fonds.")
    r.fund(MAKER_A=5_000, ALICE=10_000)
    sid = r.step("list_series", "ADMIN", K, EXPIRY)
    r.publish(sid, 100.0)
    r.step("deposit", "MAKER_A", 3_000 * SCALE)
    premium = 1_000 * r.m.snaps[sid].mark * 11 // 10
    oid = r.step("create_offer", "MAKER_A", sid, 1_000, premium, EXPIRY)
    r.step("buy", "ALICE", oid, expect="InsufficientMargin", note="rollback complet : prime non prélevée")
    r.step("deposit", "MAKER_A", 2_000 * SCALE)
    r.step("buy", "ALICE", oid, expect="InsufficientMargin", note="toujours insuffisant à 5 000")
    r.step("cancel_offer", "MAKER_A", oid)
    r.step("buy", "ALICE", oid, expect="WrongState")
    return r


def s_snapshot_bounds():
    r = Recorder("snapshot_bounds", "Le contrat borne le publieur : prix hors arbitrage, plancher extrême, fraîcheur.")
    sid = r.step("list_series", "ADMIN", K, EXPIRY)
    good = make_snapshot(r.m, sid, 1, 120.0)
    intrinsic = good.spot - K
    r.publish(sid, 120.0, expect="BadSnapshot", mark=intrinsic - 1)                       # sous l'intrinsèque
    r.publish(sid, 120.0, expect="BadSnapshot", mark=good.spot + 1)                       # au-dessus du spot
    ra = list(good.ra)
    s_up = good.spot * (BPS + r.m.cfg.ext_mult * r.m.cfg.psr_bps) // BPS
    ra[14] = s_up - K - good.mark - 1
    r.publish(sid, 120.0, expect="BadSnapshot", ra=ra)                                    # extrême sous-estimé
    r.publish(sid, 120.0, expect="BadSnapshot", smin=good.smin - 1)                       # plancher trop bas
    r.publish(sid, 120.0, expect="BadSnapshot", ra=good.ra[:15])                          # 15 scénarios
    r.publish(sid, 120.0, expect="BadSnapshot", liq=-1)
    r.publish(sid, 120.0, expect="StaleSnapshot", ts=T0 - r.m.cfg.max_age - 1)
    r.publish(sid, 120.0, expect="StaleSnapshot", ts=T0 + 1)                              # dans le futur
    r.step("publish_risk", "MAKER_A", good, expect="Unauthorized")
    r.publish(sid, 120.0)
    r.advance(60)
    r.publish(sid, 121.0, expect="BadSnapshot", seq=r.seq - 1)                            # séquence non croissante
    r.publish(sid, 121.0)
    return r


def s_liquidation_private():
    r = Recorder("liquidation_to_private_taker", "Hausse progressive : NLV < MM, reprise solvable par un autre maker.")
    r.fund(MAKER_A=100_000, MAKER_B=200_000, ALICE=10_000, LP1=100_000)
    r.step("lp_deposit", "LP1", 50_000 * SCALE)
    sid = r.step("list_series", "ADMIN", K, EXPIRY)
    r.publish(sid, 100.0)
    open_short_at_im(r, "MAKER_A", "ALICE", sid, 1_000)
    r.step("deposit", "MAKER_B", 150_000 * SCALE)
    r.step("liquidate", "MAKER_B", "MAKER_A", "MAKER_B", expect="NotLiquidable")
    # premier prix (pas de 0,5) où A devient liquidable tout en restant solvable
    spot = 100.0
    while True:
        spot += 0.5
        r.advance(3_600)
        r.publish(sid, spot)
        req = r.m.requirement("MAKER_A")
        if req["nlv"] < req["mm"]:
            break
    r.view("MAKER_A", f"à S={spot} : NLV < MM, compte liquidable mais encore solvable")
    r.step("liquidate", "MAKER_C", "MAKER_A", "MAKER_B", expect="Unauthorized", note="le repreneur doit signer")
    res = r.step("liquidate", "MAKER_B", "MAKER_A", "MAKER_B",
                 note="X = qté x mark x 1,05 versé par A à B ; positions d'Alice inchangées sauf le vendeur")
    assert res["deficit"] == 0
    r.view("MAKER_B", "le repreneur reste au-dessus de son IM")
    left = r.m.acct("MAKER_A").cash
    r.step("withdraw", "MAKER_A", left, note="le reliquat de A est libre : il n'a plus de position")
    return r


def s_gap_to_vault():
    r = Recorder("gap_to_vault", "Saut de prix : reprise privée refusée, le vault reprend et porte le déficit.")
    r.fund(MAKER_A=100_000, MAKER_B=500_000, ALICE=10_000, LP1=300_000, LP2=100_000)
    r.step("lp_deposit", "LP1", 250_000 * SCALE)
    sid = r.step("list_series", "ADMIN", K, EXPIRY)
    r.publish(sid, 100.0)
    open_short_at_im(r, "MAKER_A", "ALICE", sid, 1_000)
    r.step("deposit", "MAKER_B", 400_000 * SCALE)
    r.advance(2 * DAY)
    r.publish(sid, 150.0)                                    # gap de +50 % sur une nuit
    r.view("MAKER_A", "après le gap : NLV < 0, X > cash")
    r.step("liquidate", "MAKER_B", "MAKER_A", "MAKER_B", expect="InsolventTakeover")
    res = r.step("liquidate", "KEEPER", "MAKER_A", VAULT, note="déclenchable par n'importe qui ; déficit absorbé par le vault")
    assert res["deficit"] > 0
    r.view(VAULT, "le vault porte maintenant le short")
    r.step("exercise", "ALICE", 0, expect="NoEarlyExercise", note="book du vault : réglé à l'échéance, au prorata")
    r.advance(7 * DAY)
    r.publish(sid, 150.0)
    r.step("lp_deposit", "LP2", 50_000 * SCALE, note="parts émises à la valeur nette du vault, pertes comprises")
    r.advance(12 * DAY)
    r.step("publish_settlement", "PUBLISHER", sid, 150 * SCALE)
    r.step("lp_deposit", "LP2", 10_000 * SCALE, expect="SettlementPending", note="aucun flux LP entre l'échéance et la clôture")
    out = settle_all(r, sid, note="book repris par le vault : sa dette passe par settle_vault")
    assert out["deficit"] == 0
    return r


def s_settlement_deficit():
    r = Recorder("settlement_pro_rata_deficit",
                 "Aucun keeper : saut à l'échéance, marge et vault insuffisants, paiement au prorata et déficit affiché.")
    r.fund(MAKER_A=50_000, ALICE=10_000, DAVE=10_000, LP1=10_000)
    r.step("lp_deposit", "LP1", 1_000 * SCALE)
    sid = r.step("list_series", "ADMIN", K, EXPIRY)
    r.publish(sid, 100.0)
    open_short_at_im(r, "MAKER_A", "ALICE", sid, 600)
    open_short_at_im(r, "MAKER_A", "DAVE", sid, 400)
    r.advance(21 * DAY)
    bid = r.m.positions[0].book
    r.step("settle", bid, expect="NoSettlementPrice")
    r.step("publish_settlement", "PUBLISHER", sid, 160 * SCALE)
    r.step("settle", bid, note="dû 50/lot ; marge du vendeur d'abord")
    r.step("settle", bid, expect="WrongState", note="un seul règlement par book")
    r.step("lp_deposit", "LP1", 1_000 * SCALE, expect="SettlementPending",
           note="books réglés mais insuffisance pas encore couverte : la série n'est pas close")
    out = r.step("settle_vault", sid, note="vault ensuite ; reste = déficit")
    assert out["deficit"] > 0
    a = r.step("claim", "ALICE", 0)
    d = r.step("claim", "DAVE", 1)
    assert a["deficit"] > 0 and abs(a["paid"] * 400 - d["paid"] * 600) <= 600, (a, d)
    r.step("claim", "ALICE", 0, expect="WrongState", note="un seul claim")
    r.step("publish_settlement", "PUBLISHER", sid, 100 * SCALE, expect="WrongState", note="prix final immuable")
    return r


def s_limits_and_staleness():
    cfg = MarketConfig(max_writer_oi=1_500)
    r = Recorder("limits_and_staleness", "Plafonds d'OI, snapshot périmé, fenêtre de règlement.", cfg)
    r.fund(MAKER_A=200_000, ALICE=10_000, DAVE=10_000)
    sid = r.step("list_series", "ADMIN", K, EXPIRY)
    r.publish(sid, 100.0)
    r.step("deposit", "MAKER_A", 150_000 * SCALE)
    prem = r.m.snaps[sid].mark * 11 // 10
    o1 = r.step("create_offer", "MAKER_A", sid, 1_000, 1_000 * prem, EXPIRY)
    o2 = r.step("create_offer", "MAKER_A", sid, 600, 600 * prem, EXPIRY)
    r.step("buy", "ALICE", o1)
    r.step("buy", "DAVE", o2, expect="OiCapExceeded", note="1 600 > plafond vendeur de 1 500")
    r.step("buy", "MAKER_A", o2, expect="SelfTrade")
    r.advance(cfg.max_age + 1)
    r.step("withdraw", "MAKER_A", 1 * SCALE, expect="StaleSnapshot")
    r.step("liquidate", "KEEPER", "MAKER_A", VAULT, expect="StaleSnapshot")
    r.step("deposit", "MAKER_A", 1 * SCALE, note="le top-up reste toujours possible")
    r.step("publish_settlement", "PUBLISHER", sid, 100 * SCALE, expect="NotExpired")
    r.advance(EXPIRY + cfg.settle_window + 1 - r.m.now)
    r.step("publish_settlement", "PUBLISHER", sid, 100 * SCALE, expect="SettlementWindowClosed",
           note="v0 : fonds bloqués jusqu'à une décision hors protocole ; v1 : oracle de repli")
    return r


def s_american_exercise():
    r = Recorder("american_exercise",
                 "Exercice américain : avant l'échéance, au spot d'un snapshot de moins de exercise_max_age, payé par "
                 "le vendeur ; un vendeur liquidable est d'abord repris ; un book du vault attend l'échéance.")
    r.fund(MAKER_A=200_000, ALICE=10_000, BOB=20_000, LP1=300_000)
    r.step("lp_deposit", "LP1", 250_000 * SCALE)
    sid = r.step("list_series", "ADMIN", K, EXPIRY)
    r.publish(sid, 100.0)
    p_alice = open_short_at_im(r, "MAKER_A", "ALICE", sid, 200, extra=30_000 * SCALE)
    r.step("exercise", "ALICE", p_alice, expect="OutOfTheMoney", note="S=100 < K=110")
    r.step("exercise", "BOB", p_alice, expect="Unauthorized", note="seul le porteur exerce")
    r.advance(DAY)
    r.publish(sid, 118.0)
    r.advance(r.m.cfg.exercise_max_age + 1)
    r.step("exercise", "ALICE", p_alice, expect="StaleSnapshot", note="snapshot de plus de 120 s : pas de regard en arrière")
    r.publish(sid, 118.0)
    req = r.view("MAKER_A", "vendeur sain : NLV >= MM")
    assert req["nlv"] >= req["mm"]
    out = r.step("exercise", "ALICE", p_alice, note="exercice anticipé : 200 x (118 - 110) payé depuis la marge de A")
    assert out["due"] == 200 * 8 * SCALE
    r.step("exercise", "ALICE", p_alice, expect="WrongState", note="une seule fois, toute la position")
    p_bob = open_short_at_im(r, "MAKER_A", "BOB", sid, 1_000)
    r.advance(DAY)
    r.publish(sid, 140.0)                                    # gap : A devient liquidable
    req = r.view("MAKER_A", "après le gap : NLV < MM")
    assert req["nlv"] < req["mm"]
    r.step("exercise", "BOB", p_bob, expect="LiquidateFirst", note="pas de course à la marge d'un vendeur en défaut")
    r.step("liquidate", "KEEPER", "MAKER_A", VAULT)
    r.step("exercise", "BOB", p_bob, expect="NoEarlyExercise",
           note="book repris par le vault : pas de course à son cash, règlement au prorata à l'échéance")
    r.advance(EXPIRY - r.m.now)
    r.step("exercise", "BOB", p_bob, expect="SeriesExpired", note="l'exercice s'arrête à l'échéance")
    r.step("publish_settlement", "PUBLISHER", sid, 140 * SCALE)
    settle_all(r, sid)
    return r


def s_review_regressions():
    r = Recorder("review_regressions",
                 "Régressions de la revue PR #30 : rôles hors marché, prime >= mark, retrait gelé après l'échéance, "
                 "reprise d'une série vivante malgré une série échue, flux LP gelés, vault au prorata entre vendeurs.")
    E1 = EXPIRY
    r.fund(MAKER_A=200_000, MAKER_B=200_000, MAKER_C=500_000, ALICE=50_000, BOB=50_000, LP1=10_000,
           PUBLISHER=100_000, ADMIN=100_000)
    r.step("lp_deposit", "PUBLISHER", 1_000 * SCALE, expect="RoleNotAllowed")
    r.step("lp_deposit", "LP1", 50 * SCALE, expect="InvalidArgs", note="premier dépôt LP minimal : 100 USDx")
    r.step("lp_deposit", "LP1", 2_000 * SCALE, note="vault volontairement petit")
    s1 = r.step("list_series", "ADMIN", K, E1)
    s2 = r.step("list_series", "ADMIN", K, E1 + 30 * DAY)
    r.publish(s1, 100.0)
    r.publish(s2, 100.0)
    r.step("deposit", "PUBLISHER", 1_000 * SCALE, expect="RoleNotAllowed")
    r.step("create_offer", "ADMIN", s1, 10, 10 * SCALE, E1, expect="RoleNotAllowed")
    r.step("deposit", "MAKER_A", 20_000 * SCALE)
    cheap = r.step("create_offer", "MAKER_A", s1, 100, 1, E1)
    r.step("buy", "BOB", cheap, expect="PremiumBelowMark", note="la part du vault ne peut pas être contournée")
    r.step("buy", "PUBLISHER", cheap, expect="RoleNotAllowed")
    r.step("cancel_offer", "MAKER_A", cheap)
    open_short_at_im(r, "MAKER_A", "ALICE", s1, 500)
    open_short_at_im(r, "MAKER_B", "BOB", s1, 500)
    open_short_at_im(r, "MAKER_A", "ALICE", s2, 300)
    r.advance(E1 - r.m.now)
    r.step("withdraw", "MAKER_A", 1 * SCALE, expect="SeriesExpired", note="série s1 échue non réglée")
    r.publish(s2, 135.0)
    req = r.view("MAKER_A", "s1 échue bornée au snapshot le plus récent du sous-jacent (135), s2 vivante")
    assert req["nlv"] < req["mm"] and req["expired"] > 0
    r.step("exercise", "ALICE", 2, expect="SettlementPending", note="A a une dette échue non cotée : elle passe avant")
    r.step("deposit", "MAKER_C", 400_000 * SCALE)
    r.step("liquidate", "PUBLISHER", "MAKER_A", "PUBLISHER", expect="RoleNotAllowed")
    r.step("liquidate", "MAKER_C", "MAKER_A", "MAKER_C", expect="InsolventTakeover",
           note="dette échue s1 bornée à 135 : A n'est plus solvable pour un repreneur privé")
    r.step("liquidate", "KEEPER", "MAKER_A", VAULT,
           note="reprise de la série vivante s2 par le vault, même s'il passe sous MM ; la dette échue s1 reste à A")
    r.step("publish_settlement", "PUBLISHER", s1, 200 * SCALE)
    r.step("lp_deposit", "LP1", 1_000 * SCALE, expect="SettlementPending")
    books = sorted(b.id for b in r.m.books.values() if b.series_id == s1 and not b.settled)
    r.step("settle", books[0])
    r.step("settle_vault", s1, expect="WrongState", note="tous les books d'abord : pas de premier arrivé")
    r.step("settle", books[1])
    r.step("claim", "BOB", 0, expect="Unauthorized", note="seul le porteur réclame")
    out = r.step("settle_vault", s1, note="le vault couvre les insuffisances de A et B au prorata")
    assert out["deficit"] > 0
    ba, bb = (r.m.books[b] for b in books)
    pa = r.step("claim", "ALICE", 0)
    pb = r.step("claim", "BOB", 1)
    vault_a, vault_b = pa["paid"] - ba.from_owner, pb["paid"] - bb.from_owner
    assert abs(vault_a * bb.shortfall - vault_b * ba.shortfall) <= ba.shortfall + bb.shortfall, (vault_a, vault_b)
    r.step("lp_deposit", "LP1", 1_000 * SCALE, expect="VaultCapacity",
           note="la reprise a rendu la perte visible : NLV du vault <= 0, aucune part émise sur une perte cachée")
    return r


def s_writer_cash_pro_rata():
    r = Recorder("writer_cash_pro_rata",
                 "Un vendeur insolvable sur deux séries de même échéance : son cash est réparti au prorata des dettes, "
                 "quel que soit l'ordre des settle.")
    r.fund(MAKER_A=100_000, ALICE=50_000, BOB=50_000, LP1=1_000)
    r.step("lp_deposit", "LP1", 100 * SCALE)
    s1 = r.step("list_series", "ADMIN", K, EXPIRY)
    s2 = r.step("list_series", "ADMIN", 120 * SCALE, EXPIRY)
    r.publish(s1, 100.0)
    r.publish(s2, 100.0)
    open_short_at_im(r, "MAKER_A", "ALICE", s1, 400)
    open_short_at_im(r, "MAKER_A", "BOB", s2, 400)
    r.advance(EXPIRY - r.m.now)
    r.step("publish_settlement", "PUBLISHER", s2, 200 * SCALE)
    b1, b2 = r.m.positions[0].book, r.m.positions[1].book
    r.step("settle", b2, expect="NoSettlementPrice", note="s1 de A n'a pas encore de prix : on attend toutes ses séries")
    r.step("publish_settlement", "PUBLISHER", s1, 200 * SCALE)
    cash = r.m.acct("MAKER_A").cash
    o2 = r.step("settle", b2, note="série K=120 réglée en premier")
    o1 = r.step("settle", b1)
    d1, d2 = 400 * 90 * SCALE, 400 * 80 * SCALE
    assert cash < d1 + d2
    assert abs(o1["from_owner"] * d2 - o2["from_owner"] * d1) <= d1 + d2, (o1, o2)
    settle_all(r, s1)
    settle_all(r, s2)
    return r


def s_negative_paths():
    r = Recorder("negative_paths",
                 "Chemins négatifs que le simple rejeu des autres scénarios ne distingue pas (revue 4, point D) : "
                 "IM et non MM à l'achat, double fill, annulation par un tiers, cotation expirée, horodatage qui recule, "
                 "contrôle d'IM du repreneur privé, dette échue cotée non réglée, double settle_vault, claim avant clôture, "
                 "réserve de reprise payée aux porteurs du book repris.")
    r.fund(MAKER_A=200_000, MAKER_B=100_000, MAKER_C=5_000, ALICE=50_000, BOB=50_000, LP1=100_000)
    r.step("lp_deposit", "LP1", 50_000 * SCALE)
    sid = r.step("list_series", "ADMIN", K, EXPIRY)
    r.publish(sid, 100.0)
    open_short_at_im(r, "MAKER_B", "BOB", sid, 1_000, extra=-1, expect="InsufficientMargin")
    p_alice = open_short_at_im(r, "MAKER_A", "ALICE", sid, 500)
    filled = max(r.m.offers)
    r.step("buy", "BOB", filled, expect="WrongState", note="offre déjà exécutée : pas de double fill")
    prem = 10 * r.m.snaps[sid].mark * 11 // 10
    o2 = r.step("create_offer", "MAKER_A", sid, 10, prem, EXPIRY)
    r.step("cancel_offer", "BOB", o2, expect="Unauthorized", note="seul le vendeur annule")
    r.step("cancel_offer", "MAKER_A", o2)
    o3 = r.step("create_offer", "MAKER_A", sid, 10, prem, r.m.now + 60)
    r.advance(61)
    r.step("buy", "BOB", o3, expect="SeriesExpired", note="cotation expirée")
    r.publish(sid, 100.0)
    r.advance(30)
    r.publish(sid, 101.0, expect="BadSnapshot", ts=r.m.now - 60)
    spot = 100.0
    while True:
        spot += 0.5
        r.advance(3_600)
        r.publish(sid, spot)
        req = r.m.requirement("MAKER_A")
        if req["nlv"] < req["mm"]:
            break
    r.view("MAKER_A", f"à S={spot} : liquidable, encore solvable")
    r.step("deposit", "MAKER_C", 5_000 * SCALE)
    r.step("liquidate", "MAKER_C", "MAKER_A", "MAKER_C", expect="InsufficientMargin",
           note="repreneur privé sous son IM après reprise")
    out = r.step("liquidate", "KEEPER", "MAKER_A", VAULT, note="paiement de reprise réservé au book repris")
    assert out["deficit"] == 0 and r.m.books[r.m.positions[p_alice].book].reserve == out["paid"]
    r.advance(EXPIRY - r.m.now)
    r.step("publish_settlement", "PUBLISHER", sid, 130 * SCALE)
    req = r.view(VAULT, "dette échue cotée, pas encore réglée : comptée à qté x (130 - 110)")
    assert req["expired"] == 500 * 20 * SCALE
    bid = r.m.positions[p_alice].book
    r.step("settle", bid, note="le book repris paie d'abord sa réserve ; l'excédent revient au vault")
    r.step("claim", "ALICE", p_alice, expect="WrongState", note="pas de claim avant settle_vault")
    r.step("settle_vault", sid)
    r.step("settle_vault", sid, expect="WrongState", note="une seule clôture")
    out = r.step("claim", "ALICE", p_alice, note="porteur du book repris payé en entier par la réserve")
    assert out["deficit"] == 0
    r.step("claim", "ALICE", p_alice, expect="WrongState")
    return r


def s_takeover_debt(s1_price: int = 112, name: str = "takeover_debt"):
    r = Recorder(name,
                 "Reprise par le vault avec déficit (borne prudente d'une dette échue non cotée) : le déficit devient une "
                 f"dette du vendeur, prélevée sur son cash au règlement de son dernier book échu (prix final {s1_price}).")
    r.fund(MAKER_A=200_000, MAKER_B=400_000, ALICE=50_000, BOB=50_000, CAROL=50_000, LP1=60_000)
    r.step("lp_deposit", "LP1", 50_000 * SCALE)
    s1 = r.step("list_series", "ADMIN", K, EXPIRY)
    s2 = r.step("list_series", "ADMIN", K, EXPIRY + 30 * DAY)
    r.publish(s1, 100.0)
    r.publish(s2, 100.0)
    open_short_at_im(r, "MAKER_A", "ALICE", s1, 500)
    open_short_at_im(r, "MAKER_A", "BOB", s2, 300)
    r.advance(EXPIRY - r.m.now)
    r.publish(s2, 135.0)
    out = r.step("liquidate", "MAKER_A", "MAKER_A", VAULT, note="le vendeur déclenche sa propre reprise : sans gain")
    assert out["deficit"] > 0 and r.m.acct("MAKER_A").owed == out["deficit"]
    r.step("publish_settlement", "PUBLISHER", s1, s1_price * SCALE)
    owed = r.m.acct("MAKER_A").owed
    vault_before = r.m.accounts[VAULT].cash
    settle_all(r, s1, note="dernier book échu de A réglé : la dette de reprise est prélevée sur son cash")
    a = r.m.acct("MAKER_A")
    collected = owed - a.owed
    if a.owed == 0:
        assert collected == owed
        r.step("withdraw", "MAKER_A", 1 * SCALE, note="dette déjà soldée : le reste est retirable")
        r.step("withdraw", "MAKER_A", a.cash)
        r.step("lp_deposit", "LP1", 1_000 * SCALE, note="vault reconstitué par le remboursement")
    else:
        assert a.cash == 0 and collected > 0
        r.view("MAKER_A", "cash < dette : tout le cash est prélevé, le reste reste dû (créance irrécouvrable affichée)")
        r.step("withdraw", "MAKER_A", 1, expect="InvalidArgs", note="plus de cash : rien à retirer")
        # la dette restante passe avant le paiement d'une reprise privée ultérieure
        a = r.m.acct("MAKER_A")                      # un échec restaure l'état : relire le compte
        owed = a.owed
        open_short_at_im(r, "MAKER_A", "CAROL", s2, 200, extra=owed)
        spot = 135.0
        while True:                                  # prix où le prix de reprise dépasse le cash hors dette
            spot += 0.5
            r.advance(3_600)
            r.publish(s2, spot)
            req = r.m.requirement("MAKER_A")
            x = 200 * r.m.snaps[s2].mark * (BPS + r.m.cfg.bonus_bps) // BPS
            if req["nlv"] < req["mm"] and x > r.m.acct("MAKER_A").cash - owed:
                break
        assert x <= r.m.acct("MAKER_A").cash, "le pas de prix a dépassé la fenêtre"
        r.step("deposit", "MAKER_B", 300_000 * SCALE)
        r.step("liquidate", "MAKER_B", "MAKER_A", "MAKER_B", expect="InsolventTakeover",
               note="le cash couvrirait la reprise, mais pas après la dette envers le vault : elle passe avant")
        cash = r.m.acct("MAKER_A").cash
        out = r.step("liquidate", "KEEPER", "MAKER_A", VAULT,
                     note="le vault reprend ; sa créance (ancienne dette + déficit) est prélevée sur le cash restant")
        a = r.m.acct("MAKER_A")
        collected = cash - out["paid"] - a.cash
        assert out["deficit"] > 0 and collected > 0 and a.owed == owed + out["deficit"] - collected
        assert a.cash == 0 or a.owed == 0, "aucun cash libre ne reste bloqué à côté d'une dette"
    return r


def s_takeover_debt_short():
    return s_takeover_debt(140, "takeover_debt_cash_short")


def s_margin_boundaries():
    r = Recorder("margin_boundaries",
                 "Bornes exactes (revue 4, point D) : arrondi de l'IM vers le haut, frais vers le bas, compte entre MM et IM "
                 "ni liquidable ni bloqué à l'exercice, premier dépôt LP refusé sur un vault déjà en perte.")
    r.fund(MAKER_A=100_000, MAKER_B=100_000, ALICE=20_000, BOB=20_000, CAROL=20_000, LP1=10_000)
    s0 = r.step("list_series", "ADMIN", 95 * SCALE, EXPIRY)
    r.publish(s0, 100.0)
    # IM arrondi vers le haut : un mm non multiple de 4 rend im = ceil(1,25 x mm) fractionnaire
    for qty in (1, 3, 7, 11, 13):
        probe = ProModel("ADMIN", "PUBLISHER", r.m.cfg)
        probe.now, probe.series, probe.snaps = r.m.now, r.m.series, r.m.snaps
        probe.acct("X").shorts = {s0: qty}
        if probe.requirement("X")["mm"] * r.m.cfg.im_bps % BPS:
            break
    r.step("deposit", "MAKER_B", 5_000 * SCALE)
    prem = qty * r.m.snaps[s0].mark * 11 // 10
    prem += 3 if prem * r.m.cfg.reserve_fee_bps % BPS == 0 else 0      # frais fractionnaire : arrondi vers le bas
    o = r.step("create_offer", "MAKER_B", s0, qty, prem, EXPIRY)
    r.step("buy", "CAROL", o, note="frais = floor(prime x 10 %)")
    req = r.view("MAKER_B", "im = ceil(mm x 1,25), mm non multiple de 4")
    assert req["mm"] * r.m.cfg.im_bps % BPS
    # compte entre MM et IM : pas liquidable, exercice permis
    p_alice = open_short_at_im(r, "MAKER_A", "ALICE", s0, 200)
    spot = 100.0
    while True:
        spot = round(spot + 0.1, 1)
        r.advance(60)
        r.publish(s0, spot)
        req = r.m.requirement("MAKER_A")
        if req["nlv"] < req["im"]:
            break
    assert req["nlv"] >= req["mm"], "le pas de prix a sauté la zone MM..IM"
    r.view("MAKER_A", f"à S={spot} : MM <= NLV < IM")
    r.step("liquidate", "KEEPER", "MAKER_A", VAULT, expect="NotLiquidable", note="sous l'IM mais au-dessus du MM")
    r.step("exercise", "ALICE", p_alice, note="vendeur au-dessus du MM : l'exercice anticipé est payé")
    # premier dépôt LP refusé quand le vault porte déjà une perte (aucune part émise à perte)
    p_bob = open_short_at_im(r, "MAKER_A", "BOB", s0, 2_000)
    r.advance(DAY)
    r.publish(s0, 160.0)
    r.step("liquidate", "KEEPER", "MAKER_A", VAULT)
    assert r.m.vault_value() < 0 and r.m.total_shares == 0
    r.step("lp_deposit", "LP1", 1_000 * SCALE, expect="VaultCapacity", note="premier dépôt : le vault vaut déjà < 0")
    return r


def s_taker_oi_cap():
    cfg = MarketConfig(max_writer_oi=600)
    r = Recorder("taker_oi_cap", "Le repreneur privé reste soumis au plafond d'OI par vendeur.", cfg)
    r.fund(MAKER_A=100_000, MAKER_B=300_000, ALICE=20_000, BOB=20_000)
    sid = r.step("list_series", "ADMIN", K, EXPIRY)
    r.publish(sid, 100.0)
    open_short_at_im(r, "MAKER_A", "ALICE", sid, 500)
    open_short_at_im(r, "MAKER_B", "BOB", sid, 200, extra=200_000 * SCALE)
    spot = 100.0
    while True:
        spot += 0.5
        r.advance(3_600)
        r.publish(sid, spot)
        req = r.m.requirement("MAKER_A")
        if req["nlv"] < req["mm"]:
            break
    r.step("liquidate", "MAKER_B", "MAKER_A", "MAKER_B", expect="OiCapExceeded", note="200 + 500 > plafond de 600")
    return r


SCENARIOS = [s_happy_path, s_insufficient_margin, s_snapshot_bounds, s_liquidation_private, s_gap_to_vault,
             s_settlement_deficit, s_limits_and_staleness, s_american_exercise, s_review_regressions,
             s_writer_cash_pro_rata, s_negative_paths, s_takeover_debt, s_takeover_debt_short, s_margin_boundaries, s_taker_oi_cap]


if __name__ == "__main__":
    out = {"version": "pro-v0.3.2", "units": {"amount": "USDx, 7 décimales (1 USDx = 10_000_000)", "qty": "lots entiers",
                                          "time": "secondes Unix"},
           "scenario_order": "index 0..13 : prix {0,+1/3,-1/3,+2/3,-2/3,+1,-1} x U, vol {x1.25, x0.75} ; 14 : +ext ; 15 : -ext",
           "errors": ERRORS, "scenarios": [f().dump() for f in SCENARIOS]}
    path = Path(__file__).with_name("fixtures") / "pro_v0.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    n = sum(len(s["steps"]) for s in out["scenarios"])
    print(f"{len(out['scenarios'])} scénarios, {n} étapes -> {path}")
