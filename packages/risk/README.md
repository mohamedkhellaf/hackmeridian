# packages/risk — Strata Pro margin engine (Dev 1)

Python 3 + numpy. Owner: Dev 1. Consumed by Dev 2 (fixtures) and Dev 3 (publisher service).

| File | Role |
|---|---|
| `strata_risk.py` | Float reference engine: Black–Scholes, 16-scenario margin, liquidation helpers, jump-diffusion calibration simulator (`python strata_risk.py 30000`, ~5 min) |
| `test_strata_risk.py` | Engine tests (`python test_strata_risk.py`) |
| `pro_v0_model.py` | **Integer reference model of `contracts/pro` v0.1** (American cash-settled calls, books, pull claims) — the executable spec |
| `gen_pro_fixtures.py` | Builds `fixtures/pro_v0.json` (deterministic; fails if the model breaks its own expectations); `make_snapshot()` is what the publisher runs |
| `fixtures/pro_v0.json` | 9 scenarios / 192 steps replayed by the contract tests |

Parameters are illustrative, not calibrated on real market data. See `docs/pro-architecture.md` and `docs/pro-v0-brief-dev2.md`.
