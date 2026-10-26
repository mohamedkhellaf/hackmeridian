"""
Fuzz du modèle de référence Pro : séquences d'opérations aléatoires, invariants vérifiés après chaque étape.

Lancer : python fuzz_pro_model.py [runs] [steps] [seed]   (défaut 300 x 120, graine 7 ; déterministe)
Échoue (code 1) à la première violation d'invariant (`ProModel.check_invariants`).
"""
from __future__ import annotations

import random
import sys

from gen_pro_fixtures import DAY, EXPIRY, T0, make_snapshot
from pro_v0_model import SCALE, VAULT, ProError, ProModel


def run(runs: int = 300, steps: int = 120, seed: int = 7) -> int:
    rng = random.Random(seed)
    seq = 0
    done = 0
    for run_i in range(runs):
        m = ProModel("ADMIN", "PUBLISHER")
        m.now = T0
        for w in ("MAKER_A", "MAKER_B", "ALICE", "BOB", "LP1"):
            m.wallets[w] = 10**7 * SCALE
        m.lp_deposit("LP1", rng.choice([100, 1_000, 50_000]) * SCALE)
        sids = [m.list_series("ADMIN", rng.choice([100, 110, 120]) * SCALE, EXPIRY + rng.choice([0, 0, 10]) * DAY)
                for _ in range(2)]
        spot = 100.0

        def publish_all():
            nonlocal seq
            for sid in sids:
                if m.now < m.series[sid].expiry:
                    seq += 1
                    m.publish_risk("PUBLISHER", make_snapshot(m, sid, seq, spot))

        publish_all()
        for _ in range(steps):
            done += 1
            op = rng.random()
            try:
                if op < 0.12:
                    spot = max(20.0, spot * rng.choice([0.9, 0.97, 1.03, 1.1, 1.35]))
                    publish_all()
                elif op < 0.32:
                    w, sid = rng.choice(["MAKER_A", "MAKER_B"]), rng.choice(sids)
                    m.deposit(w, rng.choice([1_000, 5_000, 20_000]) * SCALE)
                    prem = max(rng.randint(10, 300) * m.snaps[sid].mark // 100 * 10, 1)
                    oid = m.create_offer(w, sid, rng.choice([10, 100, 500]), prem, m.series[sid].expiry)
                    m.buy(rng.choice(["ALICE", "BOB"]), oid)
                elif op < 0.45:
                    taker = rng.choice([VAULT, VAULT, "MAKER_A", "MAKER_B"])
                    m.liquidate(taker if taker != VAULT else "KEEPER", rng.choice(["MAKER_A", "MAKER_B"]), taker)
                elif op < 0.58 and m.positions:
                    pid = rng.choice(list(m.positions))
                    m.exercise(m.positions[pid].holder, pid)
                elif op < 0.66:
                    m.withdraw(rng.choice(["MAKER_A", "MAKER_B"]), rng.choice([1, 100, 5_000]) * SCALE)
                elif op < 0.72:
                    m.now += rng.choice([30, 600, 3_600, DAY, 3 * DAY])
                elif op < 0.78:
                    m.lp_deposit("LP1", rng.choice([100, 1_000]) * SCALE)
                elif op < 0.84:
                    m.publish_settlement("PUBLISHER", rng.choice(sids), int(spot * SCALE))
                elif op < 0.9 and m.books:
                    m.settle(rng.choice(list(m.books)))
                elif op < 0.95:
                    m.settle_vault(rng.choice(sids))
                elif m.positions:
                    pid = rng.choice(list(m.positions))
                    m.claim(m.positions[pid].holder, pid)
            except ProError:
                pass
            try:
                m.check_invariants()
            except AssertionError as e:
                print(f"violation (run {run_i}, step {done}): {e}")
                return 1
    print(f"{runs} runs, {done} steps, 0 invariant violations")
    return 0


if __name__ == "__main__":
    args = [int(x) for x in sys.argv[1:4]]
    sys.exit(run(*args))
