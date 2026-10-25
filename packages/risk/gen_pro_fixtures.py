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
            "accounts": {k: {"cash": a.cash, "shorts": {str(s): q for s, q in sorted(a.shorts.items()) if q}}
                         for k, a in sorted(m.accounts.items()) if a.cash or any(a.shorts.values())},
            "wallets": dict(sorted(m.wallets.items())),
            "series": {str(s.id): {"oi": s.oi, "settlement_price": s.settlement_price} for s in m.series.values()},
            "positions": {str(p.id): {"holder": p.holder, "writer": p.writer, "qty": p.qty,
                                      "settled": p.settled, "paid": p.paid, "deficit": p.deficit}
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
        assert outcome == expect, f"[{self.name}] {op}{tuple(rec_args)} : attendu {expect}, obtenu {outcome}"
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


def open_short_at_im(r: Recorder, writer: str, buyer: str, sid: int, qty: int, extra: int = 0) -> int:
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
    return r.step("buy", buyer, oid)


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
    r.step("liquidate", "KEEPER", "MAKER_A", VAULT, expect="SeriesExpired")
    r.step("publish_settlement", "PUBLISHER", sid, 95 * SCALE)
    r.step("settle", "MAKER_A", sid, note="hors de la monnaie : dû 0")
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
    r.step("lp_request_withdraw", "LP1", r.m.lp_shares["LP1"])
    r.step("lp_withdraw", "LP1", expect="WithdrawLocked")
    r.advance(7 * DAY)
    r.publish(sid, 150.0)
    r.step("lp_withdraw", "LP1", expect="VaultCapacity", note="le capital engagé sur la position reprise reste bloqué")
    r.step("lp_deposit", "LP2", 50_000 * SCALE, note="parts émises à la valeur nette du vault, pertes comprises")
    r.advance(12 * DAY)
    r.step("publish_settlement", "PUBLISHER", sid, 150 * SCALE)
    out = r.step("settle", VAULT, sid, note="le vault paie Alice intégralement")
    assert out["deficit"] == 0
    r.step("lp_withdraw", "LP1", note="après règlement, le capital est libéré à la valeur nette")
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
    r.step("settle", "MAKER_A", sid, expect="NoSettlementPrice")
    r.step("publish_settlement", "PUBLISHER", sid, 160 * SCALE)
    out = r.step("settle", "MAKER_A", sid, note="dû 50/lot ; marge puis vault ; reste = déficit")
    assert out["deficit"] > 0 and out["alloc"][0] * 400 // 600 in (out["alloc"][1] - 1, out["alloc"][1], out["alloc"][1] + 1)
    r.step("settle", "MAKER_A", sid, expect="WrongState", note="un seul règlement")
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


SCENARIOS = [s_happy_path, s_insufficient_margin, s_snapshot_bounds, s_liquidation_private, s_gap_to_vault,
             s_settlement_deficit, s_limits_and_staleness]


if __name__ == "__main__":
    out = {"version": "pro-v0", "units": {"amount": "USDx, 7 décimales (1 USDx = 10_000_000)", "qty": "lots entiers",
                                          "time": "secondes Unix"},
           "scenario_order": "index 0..13 : prix {0,+1/3,-1/3,+2/3,-2/3,+1,-1} x U, vol {x1.25, x0.75} ; 14 : +ext ; 15 : -ext",
           "errors": ERRORS, "scenarios": [f().dump() for f in SCENARIOS]}
    path = Path(__file__).with_name("fixtures") / "pro_v0.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    n = sum(len(s["steps"]) for s in out["scenarios"])
    print(f"{len(out['scenarios'])} scénarios, {n} étapes -> {path}")
