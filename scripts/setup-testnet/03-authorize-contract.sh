#!/usr/bin/env bash
# Authorize the options contract to hold the regulated underlyings (RWA and BOND) on Stellar TESTNET.
#
#   scripts/setup-testnet/03-authorize-contract.sh <options-contract-id> [label]
#
# [label] (default AUTHORIZE_OPTIONS) names the TX_<label>_<ASSET> env keys, so deploy.sh --throwaway can record its
# own authorization txs (AUTHORIZE_THROWAWAY) without overwriting the main contract's.
#
# Required after EVERY options contract (re)deploy: an AUTH_REQUIRED asset cannot be held by an address the
# issuer has not authorized, so create_offer fails with ContractNotAuthorized (contract-abi.md §6).
# Runs set_authorized(<contract>, true) on each underlying SAC from strata-rwa-issuer (the SAC admin).
# Idempotent: reads the SAC's authorized(<contract>) first and skips when it is already true.
# DRY_RUN=1 prints the write commands instead of sending them (the read-only checks still run).
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar

[[ $# -eq 1 || $# -eq 2 ]] || die "usage: $0 <options-contract-id> [label]"
CONTRACT="$1"
LABEL="${2:-AUTHORIZE_OPTIONS}"
[[ "$LABEL" =~ ^[A-Z_][A-Z0-9_]*$ ]] || die "label '$LABEL' must be UPPER_SNAKE_CASE"
load_env
require_vars RWA_SAC BOND_SAC

if ! is_contract_id "$CONTRACT"; then
  [[ "${DRY_RUN:-0}" == 1 ]] || die "'$CONTRACT' is not a contract id (C... 56 chars)"
  log "DRY_RUN: '$CONTRACT' is a placeholder, skipping on-chain checks"
fi

sac_authorized() { # sac_authorized <sac> -> true|false
  stellar contract invoke --id "$1" --network "$NETWORK" --source-account "$ID_RWA_ISSUER" \
    -- authorized --id "$CONTRACT" 2>/dev/null | tail -1
}

for a in RWA BOND; do
  sac_var="${a}_SAC"
  sac="${!sac_var}"
  if is_contract_id "$CONTRACT"; then
    now="$(sac_authorized "$sac" || true)"
    if [[ "$now" == true ]]; then
      log "$a SAC $sac: contract $CONTRACT already authorized, skipping"
      continue
    fi
    log "$a SAC $sac: contract authorized=${now:-unknown}, authorizing"
  fi
  run_tx "${LABEL}_${a}" stellar contract invoke --id "$sac" --network "$NETWORK" \
    --source-account "$ID_RWA_ISSUER" -- set_authorized --id "$CONTRACT" --authorize true
  if [[ "${DRY_RUN:-0}" != 1 ]]; then
    after="$(sac_authorized "$sac" || true)"
    [[ "$after" == true ]] || die "$a SAC still reports authorized=${after:-unknown} for $CONTRACT"
    log "$a SAC $sac: contract $CONTRACT authorized"
  fi
done
