#!/usr/bin/env python3
"""Print the `snap` argument of `pro.publish_risk` for one series, as one line of JSON.

    python3 scripts/deploy/pro-snapshot.py --series-id 0 --strike 110 --expiry <unix> --spot 100 --seq 1 [--now <unix>]

Runs the publisher's own code (`make_snapshot` in packages/risk/gen_pro_fixtures.py, numpy required) with the
MarketConfig of the deployment, so the numbers are exactly those of packages/risk/fixtures/pro_v0.json for the same
inputs. Strike and spot are in whole USDx (floats allowed); expiry/now are Unix seconds. i128 fields are printed as
JSON strings (the stellar CLI accepts strings for i128). Use it as:

    stellar contract invoke --id pro --network testnet --source-account strata-pro-publisher -- publish_risk \
      --publisher <G...> --snap "$(python3 scripts/deploy/pro-snapshot.py ...)"

TESTNET demo tooling: the spot is whatever the operator passes (a team-operated publisher), not a market feed.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(REPO_ROOT, "packages", "risk"))

from gen_pro_fixtures import SIGMA, make_snapshot  # noqa: E402
from pro_v0_model import SCALE, MarketConfig, ProModel  # noqa: E402

# Must equal the --cfg passed to `stellar contract deploy` by scripts/deploy/deploy-pro.sh.
DEFAULT_CFG = MarketConfig()


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--series-id", type=int, required=True)
    p.add_argument("--strike", type=float, required=True, help="strike per lot, whole USDx (e.g. 110)")
    p.add_argument("--expiry", type=int, required=True, help="series expiry, Unix seconds (must equal the on-chain series)")
    p.add_argument("--spot", type=float, required=True, help="spot per lot, whole USDx")
    p.add_argument("--seq", type=int, required=True, help="strictly increasing per series")
    p.add_argument("--now", type=int, default=None, help="snapshot ts (default: current time)")
    p.add_argument("--sigma", type=float, default=SIGMA, help=f"annualized vol (default {SIGMA})")
    for name, _ in sorted(vars(DEFAULT_CFG).items()):
        p.add_argument(f"--{name.replace('_', '-')}", type=int, default=None, help=f"MarketConfig.{name} override")
    a = p.parse_args()

    now = a.now if a.now is not None else int(time.time())
    if a.expiry <= now:
        print(f"error: --expiry {a.expiry} is not after now {now}", file=sys.stderr)
        return 2
    if a.seq <= 0 or a.spot <= 0 or a.strike <= 0:
        print("error: --seq, --spot and --strike must be positive", file=sys.stderr)
        return 2

    cfg_kwargs = {k: getattr(a, k) for k in vars(DEFAULT_CFG) if getattr(a, k) is not None}
    cfg = MarketConfig(**{**vars(DEFAULT_CFG), **cfg_kwargs})
    cfg.validate()

    m = ProModel("ADMIN", "PUBLISHER", cfg)
    m.now = now
    strike_units = round(a.strike * SCALE)
    sid = -1
    while sid < a.series_id:  # list_series assigns ids 0, 1, ...; only the last one matters
        sid = m.list_series("ADMIN", strike_units, a.expiry)
    snap = make_snapshot(m, sid, a.seq, a.spot, sigma=a.sigma)

    out = {
        "series_id": snap.series_id,
        "seq": snap.seq,
        "ts": snap.ts,
        "spot": str(snap.spot),
        "mark": str(snap.mark),
        "ra": [str(x) for x in snap.ra],
        "smin": str(snap.smin),
        "liq": str(snap.liq),
    }
    print(json.dumps(out, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
