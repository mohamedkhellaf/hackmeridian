#!/usr/bin/env bash
# Onboard an externally owned wallet (e.g. a teammate's Freighter account) onto the StellSec demo assets on TESTNET.
#
#   scripts/setup-testnet/onboard-account.sh <G-address> [--assets RWA,BOND,EQTY] [--usdx 100000] \
#       [--underlying 1000] [--wait-minutes 10]
#
#   --assets        underlyings to onboard (any of RWA, BOND, EQTY; default all three). USDx is always included.
#   --usdx          target USDx balance in whole tokens (default 100000)
#   --underlying    target balance of each underlying in whole tokens (default 1000)
#   --wait-minutes  how long to poll Horizon for missing trustlines, every 15 s (default 10; 0 = check once)
#
# Steps: friendbot-fund the account if it does not exist; print the exact CODE:ISSUER trustlines the OWNER must add
# in their wallet (this script cannot sign for the account); then poll Horizon. As each trustline appears:
#   RWA/BOND/EQTY: strata-rwa-issuer authorizes it (set-trustline-flags --set-authorize), then pays the top-up;
#   USDx:          strata-usdx-issuer pays the top-up (unflagged asset, no authorization step).
# Idempotent: an authorized trustline is not re-authorized, and a balance at or above the target is left alone (a
# lower balance is topped up to the target, never beyond). Every submitted tx prints "TX <label> <hash>".
# Exit 0 when every requested trustline is authorized and funded; exit 2 if the wait expires with trustlines still
# missing (re-run after the owner adds them); exit 1 on any other error. Public data only; no secret is read.
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar curl jq

usage() {
  sed -n '2,19p' "$0" >&2
  exit "${1:-1}"
}

POLL_SECS=15
TARGET=""
ASSETS_ARG="RWA,BOND,EQTY"
USDX_AMOUNT=100000
UNDERLYING_AMOUNT=1000
WAIT_MINUTES=10
while (($# > 0)); do
  case "$1" in
    -h | --help) usage 0 ;;
    --assets)
      ASSETS_ARG="${2:?--assets needs a value}"
      shift 2
      ;;
    --usdx)
      USDX_AMOUNT="${2:?--usdx needs a value}"
      shift 2
      ;;
    --underlying)
      UNDERLYING_AMOUNT="${2:?--underlying needs a value}"
      shift 2
      ;;
    --wait-minutes)
      WAIT_MINUTES="${2:?--wait-minutes needs a value}"
      shift 2
      ;;
    -*) die "unknown option: $1" ;;
    *)
      [[ -z "$TARGET" ]] || die "unexpected argument: $1"
      TARGET="$1"
      shift
      ;;
  esac
done
[[ -n "$TARGET" ]] || usage 1
[[ "$TARGET" =~ ^G[A-Z2-7]{55}$ ]] || die "'$TARGET' is not a Stellar account id (G... 56 chars)"
[[ "$USDX_AMOUNT" =~ ^[0-9]+$ ]] || die "--usdx must be a whole number of tokens"
[[ "$UNDERLYING_AMOUNT" =~ ^[0-9]+$ ]] || die "--underlying must be a whole number of tokens"
[[ "$WAIT_MINUTES" =~ ^[0-9]+$ ]] || die "--wait-minutes must be a whole number"

load_env
require_vars RWA_ISSUER USDX_ISSUER
# The keystore identities must be the issuers recorded in the env file, or every tx below would be signed by the
# wrong account.
[[ "$(pubkey "$ID_RWA_ISSUER")" == "$RWA_ISSUER" ]] || die "$ID_RWA_ISSUER is not RWA_ISSUER=$RWA_ISSUER"
[[ "$(pubkey "$ID_USDX_ISSUER")" == "$USDX_ISSUER" ]] || die "$ID_USDX_ISSUER is not USDX_ISSUER=$USDX_ISSUER"
[[ "$TARGET" != "$RWA_ISSUER" && "$TARGET" != "$USDX_ISSUER" ]] || die "refusing to onboard an issuer account"

declare -A CODE=([RWA]=RWA [BOND]=BOND [EQTY]=EQTY [USDX]=USDx)
declare -A ISSUER=([RWA]="$RWA_ISSUER" [BOND]="$RWA_ISSUER" [EQTY]="$RWA_ISSUER" [USDX]="$USDX_ISSUER")
declare -A ISSUER_ID=([RWA]="$ID_RWA_ISSUER" [BOND]="$ID_RWA_ISSUER" [EQTY]="$ID_RWA_ISSUER" [USDX]="$ID_USDX_ISSUER")
declare -A REGULATED=([RWA]=1 [BOND]=1 [EQTY]=1 [USDX]=0)
asset() { printf '%s:%s\n' "${CODE[$1]}" "${ISSUER[$1]}"; }

KEYS=(USDX)
IFS=',' read -r -a req <<<"${ASSETS_ARG^^}"
for a in "${req[@]}"; do
  a="${a// /}"
  [[ -n "$a" ]] || continue
  [[ "$a" == RWA || "$a" == BOND || "$a" == EQTY ]] || die "--assets: '$a' is not one of RWA, BOND, EQTY"
  [[ " ${KEYS[*]} " == *" $a "* ]] || KEYS+=("$a")
done
declare -A TARGET_UNITS=()
for a in "${KEYS[@]}"; do
  if [[ "$a" == USDX ]]; then
    TARGET_UNITS[$a]=$((USDX_AMOUNT * UNIT))
  else
    TARGET_UNITS[$a]=$((UNDERLYING_AMOUNT * UNIT))
  fi
done
TAG="ONBOARD_${TARGET: -6}" # env keys TX_ONBOARD_<last 6 chars of the account>_*

# ---------- 1. Account ----------
if account_exists "$TARGET"; then
  log "account $TARGET exists on testnet"
else
  log "account $TARGET not on testnet; funding via friendbot"
  resp="$(curl -s "https://friendbot.stellar.org/?addr=$TARGET")" || die "friendbot request failed"
  wait_account "$TARGET"
  fund_tx="$(jq -r '.hash // .id // empty' <<<"$resp" 2>/dev/null || true)"
  if ! [[ "$fund_tx" =~ ^[0-9a-f]{64}$ ]]; then
    fund_tx="$(curl -sf "$HORIZON_URL/accounts/$TARGET/operations?order=asc&limit=1" |
      jq -r '._embedded.records[0].transaction_hash // empty' || true)"
  fi
  printf 'TX %s_FUND %s\n' "$TAG" "${fund_tx:-unknown}"
  [[ -z "$fund_tx" ]] || env_set "TX_${TAG}_FUND" "$fund_tx"
fi

# ---------- 2. What the owner must add ----------
{
  echo
  echo "The account OWNER must add these trustlines in their wallet (asset code + issuer):"
  for a in "${KEYS[@]}"; do printf '    %s\n' "$(asset "$a")"; done
  echo "Polling Horizon every ${POLL_SECS}s for up to ${WAIT_MINUTES} min; each trustline is authorized and funded as it appears."
  echo
} >&2

# tl <account-json> <KEY> <field> -> that field of the account's trustline for KEY, or empty if there is none.
tl() {
  jq -r --arg c "${CODE[$2]}" --arg i "${ISSUER[$2]}" --arg f "$3" \
    '[.balances[] | select(.asset_code == $c and .asset_issuer == $i)][0]
     | if . == null then "" else (.[$f] | tostring) end' <<<"$1"
}

# settle <account-json> <KEY>: authorize (regulated assets only) and top up one trustline that exists.
settle() {
  local json="$1" a="$2" auth bal have limit target diff
  target="${TARGET_UNITS[$a]}"
  auth="$(tl "$json" "$a" is_authorized)"
  if [[ "${REGULATED[$a]}" == 1 ]]; then
    if [[ "$auth" == true ]]; then
      log "${CODE[$a]}: trustline already authorized"
    else
      run_tx "${TAG}_AUTH_${a}" stellar tx new set-trustline-flags --source-account "$ID_RWA_ISSUER" \
        --network "$NETWORK" --trustor "$TARGET" --asset "$(asset "$a")" --set-authorize ||
        die "authorization of $(asset "$a") for $TARGET failed"
    fi
  elif [[ "$auth" != true ]]; then
    die "${CODE[$a]} trustline is not authorized but ${CODE[$a]} is meant to be unflagged; check the issuer"
  fi
  bal="$(tl "$json" "$a" balance)"
  have="$(to_units "$bal")"
  if ((have >= target)); then
    log "${CODE[$a]}: balance $bal already >= target $((target / UNIT)), no payment"
    return 0
  fi
  diff=$((target - have))
  limit="$(to_units "$(tl "$json" "$a" limit)")"
  ((target <= limit)) ||
    die "${CODE[$a]}: trustline limit $(tl "$json" "$a" limit) is below the target $((target / UNIT)); ask the owner to raise it"
  run_tx "${TAG}_PAY_${a}" stellar tx new payment --source-account "${ISSUER_ID[$a]}" --network "$NETWORK" \
    --destination "$TARGET" --asset "$(asset "$a")" --amount "$diff" ||
    die "payment of $diff units of $(asset "$a") to $TARGET failed"
  log "${CODE[$a]}: paid $diff units (balance was ${bal}, target $((target / UNIT)))"
}

# ---------- 3. Poll, authorize, fund ----------
declare -A DONE=()
deadline=$(($(date +%s) + WAIT_MINUTES * 60))
while :; do
  missing=()
  if json="$(horizon_account "$TARGET")"; then
    for a in "${KEYS[@]}"; do
      [[ -z "${DONE[$a]:-}" ]] || continue
      if [[ -z "$(tl "$json" "$a" balance)" ]]; then
        missing+=("$(asset "$a")")
        continue
      fi
      log "${CODE[$a]}: trustline present"
      settle "$json" "$a"
      DONE[$a]=1
    done
  else
    log "WARN: Horizon read for $TARGET failed; retrying"
    for a in "${KEYS[@]}"; do [[ -n "${DONE[$a]:-}" ]] || missing+=("$(asset "$a")"); done
  fi
  ((${#missing[@]} > 0)) || break
  if (($(date +%s) >= deadline)); then
    {
      echo
      echo "Wait expired (${WAIT_MINUTES} min). Trustlines still missing on $TARGET:"
      printf '    %s\n' "${missing[@]}"
      echo "Add them in the wallet, then re-run: $0 $TARGET --assets $(IFS=,; echo "${KEYS[*]:1}") --usdx $USDX_AMOUNT --underlying $UNDERLYING_AMOUNT"
    } >&2
    exit 2
  fi
  log "waiting for ${#missing[@]} trustline(s): ${missing[*]} ($(((deadline - $(date +%s) + 59) / 60)) min left)"
  sleep "$POLL_SECS"
done

# ---------- 4. Summary (Horizon may lag the last payment by a few seconds) ----------
sleep 5
json="$(horizon_account "$TARGET")" || die "final Horizon read failed; the txs above were submitted"
{
  echo
  echo "Onboarded $TARGET:"
  for a in "${KEYS[@]}"; do
    printf '    %-5s balance %-18s authorized=%s\n' "${CODE[$a]}" "$(tl "$json" "$a" balance)" "$(tl "$json" "$a" is_authorized)"
  done
} >&2
