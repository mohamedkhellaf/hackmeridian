#!/usr/bin/env bash
# Authorize the options contract to hold regulated underlyings (default RWA and BOND) on Stellar TESTNET.
#
#   scripts/setup-testnet/03-authorize-contract.sh <options-contract-id> [label] [asset ...]
#   scripts/setup-testnet/03-authorize-contract.sh <options-contract-id> EQTY        # v1.3: one listed asset only
#
# [label] (default AUTHORIZE_OPTIONS) names the TX_<label>_<ASSET> env keys, so deploy.sh --throwaway can record its
# own authorization txs (AUTHORIZE_THROWAWAY) without overwriting the main contract's.
# [asset ...] (default: RWA BOND, the constructor underlyings) picks the SACs, from RWA, BOND, EQTY (all issued by
# strata-rwa-issuer). An asset name in the second position means "no label": `<id> EQTY` = `<id> AUTHORIZE_OPTIONS EQTY`.
# EQTY is deliberately not a default: it is not in the constructor; the v1.3 smoke run lists it with list_asset, checks
# that create_offer fails with ContractNotAuthorized (#105), and only then calls `03-authorize-contract.sh <id> EQTY`.
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

USAGE="usage: $0 <options-contract-id> [label] [asset ...]   (asset: RWA BOND EQTY; default RWA BOND)"
KNOWN_ASSETS=(RWA BOND EQTY) # regulated underlyings whose SAC admin is strata-rwa-issuer
is_known_asset() { [[ " ${KNOWN_ASSETS[*]} " == *" $1 "* ]]; }

[[ $# -ge 1 ]] || die "$USAGE"
CONTRACT="$1"
shift
LABEL=AUTHORIZE_OPTIONS
if [[ $# -gt 0 ]] && ! is_known_asset "$1"; then
  LABEL="$1"
  shift
fi
[[ "$LABEL" =~ ^[A-Z_][A-Z0-9_]*$ ]] || die "label '$LABEL' must be UPPER_SNAKE_CASE ($USAGE)"
ASSETS=("$@")
((${#ASSETS[@]} > 0)) || ASSETS=(RWA BOND)
for a in "${ASSETS[@]}"; do is_known_asset "$a" || die "unknown asset '$a' ($USAGE)"; done
load_env
for a in "${ASSETS[@]}"; do require_vars "${a}_SAC"; done
log "authorizing $CONTRACT on: ${ASSETS[*]} (env keys TX_${LABEL}_<ASSET>)"

if ! is_contract_id "$CONTRACT"; then
  [[ "${DRY_RUN:-0}" == 1 ]] || die "'$CONTRACT' is not a contract id (C... 56 chars)"
  log "DRY_RUN: '$CONTRACT' is a placeholder, skipping on-chain checks"
fi

sac_authorized() { # sac_authorized <sac> -> true|false
  stellar contract invoke --id "$1" --network "$NETWORK" --source-account "$ID_RWA_ISSUER" \
    -- authorized --id "$CONTRACT" 2>/dev/null | tail -1
}

for a in "${ASSETS[@]}"; do
  sac_var="${a}_SAC"
  sac="${!sac_var}"
  is_contract_id "$sac" || die "$sac_var='$sac' is not a contract id"
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
