# packages/risk — StellSec Pro margin engine (Dev 1)

Python 3 + numpy. Owner: Dev 1.

**Status: on-chain attempt in progress.** Dev 2 is building `contracts/pro/` on its own branch and Dev 3 a flagged Pro UI; neither is on `main` until the Pro gate in `AGENTS.md` passes (go/no-go 09:30 Lisbon). Until then, what exists on `main` is the spec, this integer reference model, the float engine and the deterministic fixtures the contract must replay, and Pro is described as "specified and simulated".

| File | Role |
|---|---|
| `strata_risk.py` | Float reference engine: Black–Scholes, 16-scenario margin, liquidation helpers, jump-diffusion calibration simulator (`python strata_risk.py 30000`, ~5 min) |
| `test_strata_risk.py` | Engine tests (`python test_strata_risk.py`) |
| `pro_v0_model.py` | **Integer reference model of a future `contracts/pro`, v0.3.2** (American cash-settled calls, books, pull claims, no LP withdrawal) — the executable spec |
| `gen_pro_fixtures.py` | Builds `fixtures/pro_v0.json` (deterministic; fails if the model breaks its own expectations); `make_snapshot()` is what the publisher runs |
| `fuzz_pro_model.py` | Random operation sequences with invariants checked after every step (`python fuzz_pro_model.py`, deterministic) |
| `fixtures/pro_v0.json` | 16 scenarios / 691 steps a future contract must replay (necessary, not sufficient: see brief §7) |

Parameters are illustrative, not calibrated on real market data. See `docs/pro-architecture.md` and `docs/pro-v0-brief-dev2.md`.
