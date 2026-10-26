#!/usr/bin/env bash
# Keep a StellSec Pro series demo-ready on TESTNET: publish one fresh risk snapshot (publish_risk) from the
# team-operated publisher (strata-pro-publisher). Snapshots older than max_age = 3600 s block buy/margin checks and
# early exercise needs one <= 120 s old, so run this every few minutes while recording a UI demo.
#
#   scripts/deploy/pro-refresh-risk.sh [--series-id 1] [--strike 110] [--expiry 1793188800] [--spot 110]
#
# Defaults: the long-lived demo series listed after the evidence run (series 1, strike 110 USDx, expiry
# 2026-10-28T12:00:00Z), spot 110 USDx (at the money). seq = current Unix time (strictly increasing per series as required);
# ts = now - 10 s (never ahead of the ledger). The spot is whatever the operator passes: not a market feed.
# Needs PRO_ID and PRO_PUBLISHER in scripts/out/testnet.env and the strata-pro-publisher identity.
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar python3

SID=1
STRIKE_USDX=110
EXPIRY=1793188800
SPOT=110
while (($# > 0)); do
  case "$1" in
    --series-id) SID="${2:?}"; shift 2 ;;
    --strike) STRIKE_USDX="${2:?}"; shift 2 ;;
    --expiry) EXPIRY="${2:?}"; shift 2 ;;
    --spot) SPOT="${2:?}"; shift 2 ;;
    -h | --help) sed -n '2,11p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

load_env
require_vars PRO_ID PRO_PUBLISHER
NOW="$(date +%s)"
SNAP="$(python3 "$SCRIPTS_DIR/deploy/pro-snapshot.py" --series-id "$SID" --strike "$STRIKE_USDX" --expiry "$EXPIRY" \
  --spot "$SPOT" --seq "$NOW" --now $((NOW - 10)))"
echo "snapshot: $SNAP"
run_tx "PRO_REFRESH_RISK_S${SID}" stellar contract invoke --id "$PRO_ID" --network "$NETWORK" \
  --source-account strata-pro-publisher -- publish_risk --publisher "$PRO_PUBLISHER" --snap "$SNAP"
