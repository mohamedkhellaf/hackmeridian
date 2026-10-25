#!/usr/bin/env bash
# Check the Strata testnet setup against Horizon (read-only). Exits non-zero on any mismatch.
#   scripts/setup-testnet/verify.sh
# With OPTIONS_ID in scripts/out/testnet.env it also checks that the contract is authorized on RWA and BOND, and reports
# (without failing) whether it is authorized on EQTY: EQTY is not a constructor underlying; on contract v1.3 the smoke
# run lists it and authorizes the escrow itself.
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar curl jq
load_env
require_vars RWA_ISSUER USDX_ISSUER MAKER1 MAKER2 INVESTOR OUTSIDER RWA_SAC BOND_SAC EQTY_SAC USDX_SAC

fail=0
check() { # check <label> <actual> <expected>
  if [[ "$2" == "$3" ]]; then
    printf 'ok    %-40s %s\n' "$1" "$2"
  else
    printf 'FAIL  %-40s got %s, want %s\n' "$1" "${2:-<none>}" "$3"
    fail=1
  fi
}

check "rwa-issuer flags (req,rev,clawback)" \
  "$(horizon_account "$RWA_ISSUER" | jq -r '.flags | "\(.auth_required),\(.auth_revocable),\(.auth_clawback_enabled)"')" "true,true,true"
check "usdx-issuer flags (req,rev,clawback)" \
  "$(horizon_account "$USDX_ISSUER" | jq -r '.flags | "\(.auth_required),\(.auth_revocable),\(.auth_clawback_enabled)"')" "false,false,false"

line() { # line <G> <CODE> <ISSUER> -> "balance authorized"
  horizon_account "$1" | jq -r --arg c "$2" --arg i "$3" \
    '[.balances[] | select(.asset_code == $c and .asset_issuer == $i)][0] | if . == null then "none" else "\(.balance) \(.is_authorized)" end'
}
# Demo holdings: trustline present, authorized, balance >= target. Trading moves tokens between the demo
# accounts, so after a rehearsal some balances sit above target (02-assets.sh never burns them back).
holding() { # holding <label> <G> <CODE> <ISSUER> <min whole tokens>
  local got="" bal="" auth=""
  got="$(line "$2" "$3" "$4")" || got="<horizon read failed>"
  read -r bal auth <<<"$got" || true
  if [[ "$auth" == true && "$bal" =~ ^[0-9]+(\.[0-9]+)?$ ]] && (($(to_units "$bal") >= $5 * UNIT)); then
    printf 'ok    %-40s %s\n' "$1" "$got"
  else
    printf 'FAIL  %-40s got %s, want >= %s true\n' "$1" "${got:-<none>}" "$5"
    fail=1
  fi
}
for who in MAKER1 MAKER2 INVESTOR; do
  holding "$who RWA" "${!who}" RWA "$RWA_ISSUER" 1000
  holding "$who BOND" "${!who}" BOND "$RWA_ISSUER" 1000
  holding "$who EQTY" "${!who}" EQTY "$RWA_ISSUER" 1000
done
for who in MAKER1 MAKER2 INVESTOR OUTSIDER; do
  holding "$who USDx" "${!who}" USDx "$USDX_ISSUER" 100000
done
check "OUTSIDER RWA (must be unauthorized)" "$(line "$OUTSIDER" RWA "$RWA_ISSUER")" "0.0000000 false"
check "OUTSIDER BOND (must be unauthorized)" "$(line "$OUTSIDER" BOND "$RWA_ISSUER")" "0.0000000 false"
check "OUTSIDER EQTY (must be unauthorized)" "$(line "$OUTSIDER" EQTY "$RWA_ISSUER")" "0.0000000 false"

for a in RWA BOND EQTY USDX; do
  sac_var="${a}_SAC"
  if contract_exists "${!sac_var}"; then check "$a SAC deployed" yes yes; else check "$a SAC deployed" no yes; fi
done

if [[ -n "${OPTIONS_ID:-}" ]]; then
  for a in RWA BOND; do
    sac_var="${a}_SAC"
    got="$(stellar contract invoke --id "${!sac_var}" --network "$NETWORK" --source-account "$ID_RWA_ISSUER" \
      -- authorized --id "$OPTIONS_ID" 2>/dev/null | tail -1 || true)"
    check "options contract authorized on $a" "$got" true
  done
  got="$(stellar contract invoke --id "$EQTY_SAC" --network "$NETWORK" --source-account "$ID_RWA_ISSUER" \
    -- authorized --id "$OPTIONS_ID" 2>/dev/null | tail -1 || true)"
  printf 'info  %-40s %s\n' "options contract authorized on EQTY" "${got:-<read failed>} (true only after the v1.3 smoke run)"
fi

echo "(balances drift once the demo starts trading; re-run 02-assets.sh to top up any balance below target)"
exit "$fail"
