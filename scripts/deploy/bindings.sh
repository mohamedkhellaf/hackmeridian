#!/usr/bin/env bash
# Generate the TypeScript client for the deployed options contract (Stellar TESTNET).
#
#   scripts/deploy/bindings.sh [out-dir]       # default: scripts/out/bindings/options
#   DRY_RUN=1 scripts/deploy/bindings.sh       # print the command only
#
# Uses OPTIONS_ID from scripts/out/testnet.env when present (works from any checkout), else the CLI alias
# "options" saved by deploy.sh. Refuses to write into frontend/: the frontend owner (Dev 3) copies the
# generated package in on their own branch.
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar

OUT="${1:-$OUT_DIR/bindings/options}"
ABS_OUT="$(realpath -m "$OUT")"
if [[ "/$ABS_OUT/" == */frontend/* ]]; then
  die "refusing to write bindings into a frontend/ directory ($ABS_OUT); generate elsewhere and let Dev 3 copy them"
fi

ID=options
if [[ -f "$ENV_FILE" ]]; then
  load_env
  if [[ -n "${OPTIONS_ID:-}" ]]; then ID="$OPTIONS_ID"; fi
fi
log "generating TypeScript bindings for $ID into $ABS_OUT"

cmd=(stellar contract bindings typescript --network "$NETWORK" --id "$ID" --output-dir "$ABS_OUT" --overwrite)
if [[ "${DRY_RUN:-0}" == 1 ]]; then
  log "DRY_RUN:"
  print_cmd "${cmd[@]}"
  exit 0
fi
mkdir -p "$(dirname "$ABS_OUT")"
"${cmd[@]}"
log "bindings written to $ABS_OUT (contract $ID)"
