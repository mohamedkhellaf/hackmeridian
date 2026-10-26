# packages/risk — Strata Pro margin engine (Dev 1)

Python 3 + numpy. Owner: Dev 1.

**Status: roadmap only.** `contracts/pro/`, its contract tests and a publisher service do not exist; margin trading is out of scope for this hackathon (no-go for on-chain Pro). What exists is the spec, this integer reference model, the float engine and deterministic fixtures for a future contract to replay.

| File | Role |
|---|---|
| `strata_risk.py` | Float reference engine: Black–Scholes, 16-scenario margin, liquidation helpers, jump-diffusion calibration simulator (`python strata_risk.py 30000`, ~5 min) |
| `test_strata_risk.py` | Engine tests (`python test_strata_risk.py`) |
| `pro_v0_model.py` | **Integer reference model of a future `contracts/pro`, v0.3.2** (American cash-settled calls, books, pull claims, no LP withdrawal) — the executable spec |
| `gen_pro_fixtures.py` | Builds `fixtures/pro_v0.json` (deterministic; fails if the model breaks its own expectations); `make_snapshot()` is what the publisher runs |
| `fuzz_pro_model.py` | Random operation sequences with invariants checked after every step (`python fuzz_pro_model.py`, deterministic) |
| `fixtures/pro_v0.json` | 16 scenarios / 691 steps a future contract must replay (necessary, not sufficient: see brief §7) |

Parameters are illustrative, not calibrated on real market data. See `docs/pro-architecture.md` and `docs/pro-v0-brief-dev2.md`.
