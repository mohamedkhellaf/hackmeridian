#!/usr/bin/env bash
# Issue the fictional Strata demo assets on Stellar TESTNET and deploy their Stellar Asset Contracts.
#
#   RWA:<strata-rwa-issuer>   underlying, regulated issuer (AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED)
#   BOND:<strata-rwa-issuer>  underlying, same regulated issuer
#   USDx:<strata-usdx-issuer> quote token, separate issuer with no flags
#
# Holders: maker1, maker2, investor are authorized on RWA and BOND; strata-outsider has trustlines but is
# deliberately NOT authorized on RWA/BOND (ineligible-buyer demo). Everyone gets USDx.
#
# Idempotent: flags, trustlines and authorizations that already exist are skipped. A balance below the target is
# topped up to it; a balance at or above it is left alone (a rehearsal leaves some above target; nothing burns
# them back). A failed Horizon read stops the script instead of being read as "no trustline" or a zero balance.
# Requires 01-identities.sh. Writes public data only to scripts/out/testnet.env.
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar curl jq

USDX_AMOUNT=100000 # whole tokens, to maker1, maker2, investor, outsider
UNDERLYING_AMOUNT=1000 # whole tokens of RWA and of BOND, to maker1, maker2, investor

for id in "${ALL_IDENTITIES[@]}"; do
  stellar keys address "$id" >/dev/null 2>&1 || die "identity $id missing; run 01-identities.sh first"
done

RWA_ISSUER="$(pubkey "$ID_RWA_ISSUER")"
USDX_ISSUER="$(pubkey "$ID_USDX_ISSUER")"
declare -A G=(
  [MAKER1]="$(pubkey "$ID_MAKER1")"
  [MAKER2]="$(pubkey "$ID_MAKER2")"
  [INVESTOR]="$(pubkey "$ID_INVESTOR")"
  [OUTSIDER]="$(pubkey "$ID_OUTSIDER")"
)
declare -A IDENT=([MAKER1]="$ID_MAKER1" [MAKER2]="$ID_MAKER2" [INVESTOR]="$ID_INVESTOR" [OUTSIDER]="$ID_OUTSIDER")
for who in RWA_ISSUER USDX_ISSUER; do account_exists "${!who}" || die "$who ${!who} not on testnet; run 01-identities.sh"; done
for who in "${!G[@]}"; do account_exists "${G[$who]}" || die "$who ${G[$who]} not on testnet; run 01-identities.sh"; done

declare -A CODE=([RWA]=RWA [BOND]=BOND [USDX]=USDx)
declare -A ISSUER=([RWA]="$RWA_ISSUER" [BOND]="$RWA_ISSUER" [USDX]="$USDX_ISSUER")
declare -A ISSUER_ID=([RWA]="$ID_RWA_ISSUER" [BOND]="$ID_RWA_ISSUER" [USDX]="$ID_USDX_ISSUER")
asset() { printf '%s:%s\n' "${CODE[$1]}" "${ISSUER[$1]}"; }

env_set RWA_ISSUER "$RWA_ISSUER"
env_set USDX_ISSUER "$USDX_ISSUER"
for a in RWA BOND USDX; do env_set "${a}_ASSET" "$(asset "$a")"; done
env_set ASSET_DECIMALS 7

# ---------- 1. Regulated issuer flags (must precede every RWA/BOND trustline) ----------
flags="$(horizon_account "$RWA_ISSUER" | jq -r '.flags | "\(.auth_required) \(.auth_revocable) \(.auth_clawback_enabled)"')"
if [[ "$flags" == "true true true" ]]; then
  log "flags: $ID_RWA_ISSUER already has AUTH_REQUIRED, AUTH_REVOCABLE, AUTH_CLAWBACK_ENABLED"
  if ! grep -q '^TX_RWA_ISSUER_FLAGS=' "$ENV_FILE" 2>/dev/null; then
    h="$(curl -sf "$HORIZON_URL/accounts/$RWA_ISSUER/operations?order=desc&limit=200" |
      jq -r '[._embedded.records[] | select(.type == "set_options" and ((.set_flags // []) | index(8)))][0].transaction_hash // empty')"
    if [[ -n "$h" ]]; then env_set TX_RWA_ISSUER_FLAGS "$h"; fi
  fi
else
  run_tx RWA_ISSUER_FLAGS stellar tx new set-options --source-account "$ID_RWA_ISSUER" --network "$NETWORK" \
    --set-required --set-revocable --set-clawback-enabled
fi
usdx_flags="$(horizon_account "$USDX_ISSUER" | jq -r '[.flags | to_entries[] | select(.value) | .key] | join(",")')"
[[ -z "$usdx_flags" ]] || log "WARN: $ID_USDX_ISSUER has flags set ($usdx_flags); USDx is meant to be unflagged"

# ---------- 2. Trustlines ----------
for who in MAKER1 MAKER2 INVESTOR OUTSIDER; do
  for a in RWA BOND USDX; do
    bal="$(trustline_field "${G[$who]}" "${CODE[$a]}" "${ISSUER[$a]}" balance)" ||
      die "Horizon read failed for $who ${CODE[$a]}; re-run once Horizon responds"
    if [[ -n "$bal" ]]; then
      log "trustline: $who -> ${CODE[$a]} exists"
    else
      run_tx "TRUST_${who}_${a}" stellar tx new change-trust --source-account "${IDENT[$who]}" --network "$NETWORK" \
        --line "$(asset "$a")"
    fi
  done
done

# ---------- 3. Issuer authorization on RWA and BOND ----------
for a in RWA BOND; do
  for who in MAKER1 MAKER2 INVESTOR; do
    auth="$(trustline_field "${G[$who]}" "${CODE[$a]}" "${ISSUER[$a]}" is_authorized)" ||
      die "Horizon read failed for $who ${CODE[$a]}; re-run once Horizon responds"
    if [[ "$auth" == true ]]; then
      log "authorize: $who on ${CODE[$a]} already authorized"
    else
      run_tx "AUTH_${who}_${a}" stellar tx new set-trustline-flags --source-account "$ID_RWA_ISSUER" --network "$NETWORK" \
        --trustor "${G[$who]}" --asset "$(asset "$a")" --set-authorize
    fi
  done
  # The outsider must stay ineligible. Undo any authorization left by a manual step or an earlier demo.
  auth="$(trustline_field "${G[OUTSIDER]}" "${CODE[$a]}" "${ISSUER[$a]}" is_authorized)" ||
    die "Horizon read failed for OUTSIDER ${CODE[$a]}; cannot confirm it is unauthorized"
  if [[ "$auth" == true ]]; then
    log "authorize: OUTSIDER is authorized on ${CODE[$a]}; revoking to keep the ineligible-buyer demo valid"
    run_tx "DEAUTH_OUTSIDER_${a}" stellar tx new set-trustline-flags --source-account "$ID_RWA_ISSUER" --network "$NETWORK" \
      --trustor "${G[OUTSIDER]}" --asset "$(asset "$a")" --clear-authorize
  else
    log "authorize: OUTSIDER is not authorized on ${CODE[$a]} (intended)"
  fi
done

# ---------- 4. Issuance (top up to target) ----------
issue() { # issue <ASSET_KEY> <WHO> <whole tokens>
  local a="$1" who="$2" target=$(($3 * UNIT)) bal have diff
  # Read first and stop on failure: an empty read would look like a zero balance and re-issue the full target.
  bal="$(trustline_field "${G[$who]}" "${CODE[$a]}" "${ISSUER[$a]}" balance)" ||
    die "Horizon read failed for $who ${CODE[$a]}; not issuing, re-run once Horizon responds"
  have="$(to_units "$bal")"
  if ((have >= target)); then
    log "issue: $who already holds $((have / UNIT)) ${CODE[$a]} (target $3)"
    return 0
  fi
  diff=$((target - have))
  run_tx "ISSUE_${a}_${who}" stellar tx new payment --source-account "${ISSUER_ID[$a]}" --network "$NETWORK" \
    --destination "${G[$who]}" --asset "$(asset "$a")" --amount "$diff"
}
for who in MAKER1 MAKER2 INVESTOR OUTSIDER; do issue USDX "$who" "$USDX_AMOUNT"; done
for a in RWA BOND; do
  for who in MAKER1 MAKER2 INVESTOR; do issue "$a" "$who" "$UNDERLYING_AMOUNT"; done
done

# ---------- 5. Stellar Asset Contracts ----------
for a in RWA BOND USDX; do
  sac="$(stellar contract id asset --asset "$(asset "$a")" --network "$NETWORK")"
  is_contract_id "$sac" || die "could not derive SAC id for $(asset "$a")"
  if contract_exists "$sac"; then
    log "sac: ${CODE[$a]} SAC $sac already deployed"
  elif ! run_tx "SAC_${a}" stellar contract asset deploy --asset "$(asset "$a")" \
    --source-account "${ISSUER_ID[$a]}" --network "$NETWORK"; then
    if grep -qiE 'exist' <<<"$RUN_TX_OUTPUT"; then
      log "sac: ${CODE[$a]} SAC already exists (deploy raced); using derived id $sac"
    else
      die "SAC deploy failed for $(asset "$a")"
    fi
  else
    deployed="$(grep -oE '^C[A-Z2-7]{55}$' <<<"$RUN_TX_OUTPUT" | tail -1 || true)"
    [[ -z "$deployed" || "$deployed" == "$sac" ]] || die "deployed SAC id $deployed != derived $sac"
  fi
  env_set "${a}_SAC" "$sac"
done

log "assets ready; summary from $ENV_FILE:"
grep -E '^(RWA|BOND|USDX)_(ASSET|SAC)=' "$ENV_FILE" >&2
log "next: run scripts/setup-testnet/verify.sh, then scripts/deploy/deploy.sh once the options wasm exists"
