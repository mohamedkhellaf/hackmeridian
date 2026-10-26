#!/usr/bin/env bash
# Seed open funded bids (contract v1.5, docs/contract-abi.md §15) on an options contract on Stellar TESTNET.
#
#   scripts/deploy/seed-demo-bids.sh --contract <C-id> [--hours 72]
#
# strata-investor posts two bids with real create_bid transactions (the premium is escrowed in the contract):
#   a) PUT  RWA  qty 5 (50000000)  strike_total 50 USDx (500000000)  premium_total 0.9 USDx (9000000)
#   b) CALL RWA  qty 3 (30000000)  strike_total 30 USDx (300000000)  premium_total 0.4 USDx (4000000)
# Both expire at now + hours*3600. Then extend_bid_ttl over both ids. NOT idempotent: every run adds two bids.
# To withdraw one (buyer only, while Open):
#   stellar contract invoke --id <C-id> --network testnet --source-account strata-investor \
#     -- cancel_bid --buyer <INVESTOR G...> --id <bid id>
# Every tx prints "TX <label> <hash>" and is appended to scripts/out/tx-log.tsv. Exit 0 only if both bids read back
# Open with the expected terms and in list_open_bids_for(RWA).
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar jq

CONTRACT=""
HOURS=72
while (($# > 0)); do
  case "$1" in
    -h | --help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    --contract)
      CONTRACT="${2:-}"
      shift 2 || shift
      ;;
    --hours)
      HOURS="${2:-}"
      shift 2 || shift
      ;;
    *) die "unknown argument: $1 (usage: $0 --contract <C-id> [--hours 72])" ;;
  esac
done
[[ -n "$CONTRACT" ]] || die "--contract <C-id> is required"
is_contract_id "$CONTRACT" || die "--contract '$CONTRACT' is not a contract id"
[[ "$HOURS" =~ ^[1-9][0-9]*$ ]] || die "--hours must be a positive whole number"

load_env
require_vars RWA_SAC USDX_SAC
INVESTOR="$(pubkey "$ID_INVESTOR")"

inv() { # inv <identity> <send:yes|no> <fn> [args...]; sets OUT, ERR, HASH
  local who="$1" send="$2" o e rc=0
  shift 2
  o="$(mktemp)"
  e="$(mktemp)"
  stellar contract invoke --id "$CONTRACT" --network "$NETWORK" --source-account "$who" --send="$send" -- "$@" \
    >"$o" 2>"$e" || rc=$?
  OUT="$(sed '/^$/d' "$o" | tail -1)"
  ERR="$(cat "$e")"
  rm -f "$o" "$e"
  HASH="$(grep -oE 'Signing transaction: [0-9a-f]{64}' <<<"$ERR" | grep -oE '[0-9a-f]{64}' | tail -1 || true)"
  return "$rc"
}

inv "$ID_DEPLOYER" no bid_count || die "bid_count failed on $CONTRACT; is it a v1.5 options contract?"
EXPIRY=$(($(date +%s) + HOURS * 3600))
log "contract $CONTRACT: bid_count=$OUT; expiry for both bids $EXPIRY ($(date -u -d "@$EXPIRY" +%FT%TZ))"

# label | kind | qty | strike_total | premium_total
BIDS=("A_INVESTOR_PUT_RWA|Put|50000000|500000000|9000000" "B_INVESTOR_CALL_RWA|Call|30000000|300000000|4000000")
IDS=()
for spec in "${BIDS[@]}"; do
  IFS='|' read -r label kind qty strike prem <<<"$spec"
  label="SEED_BID_$label"
  echo "-> [$label] create_bid $kind RWA qty $qty strike_total $strike premium_total $prem expiry $EXPIRY"
  if ! inv "$ID_INVESTOR" yes create_bid --buyer "$INVESTOR" --kind "$kind" --underlying "$RWA_SAC" \
    --quote "$USDX_SAC" --qty "$qty" --strike_total "$strike" --premium_total "$prem" --expiry "$EXPIRY"; then
    printf '%s\n' "$ERR" | head -20 | sed 's/^/   | /'
    die "$label failed (tx ${HASH:-not signed}); bids created so far: ${IDS[*]:-none}"
  fi
  [[ "$OUT" =~ ^[0-9]+$ && -n "$HASH" ]] || die "$label: unexpected return '$OUT' / hash '$HASH'"
  printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$label" "$HASH" ok >>"$TX_LOG"
  echo "TX $label $HASH"
  echo "   bid id $OUT"
  IDS+=("$OUT")
done

fails=0
inv "$ID_DEPLOYER" no list_open_bids_for --asset "$RWA_SAC" --from 0 --limit 50 || die "list_open_bids_for failed"
book="$OUT"
for i in "${!IDS[@]}"; do
  IFS='|' read -r label kind qty strike prem <<<"${BIDS[$i]}"
  inv "$ID_DEPLOYER" no get_bid --id "${IDS[$i]}" || die "get_bid(${IDS[$i]}) failed"
  echo "get_bid(${IDS[$i]}) = $OUT"
  got="$(jq -c '{buyer, kind, qty: (.qty|tostring), strike_total: (.strike_total|tostring),
    premium_total: (.premium_total|tostring), expiry, state}' <<<"$OUT")"
  want="$(jq -cn --arg b "$INVESTOR" --arg k "$kind" --arg q "$qty" --arg s "$strike" --arg p "$prem" \
    --argjson e "$EXPIRY" '{buyer: $b, kind: $k, qty: $q, strike_total: $s, premium_total: $p, expiry: $e, state: "Open"}')"
  # the RWA book may hold more than 50 open bids on a busy contract; only check membership on the first page
  if [[ "$got" == "$want" ]] && { jq -e --argjson x "${IDS[$i]}" 'index($x) != null' <<<"$book" >/dev/null ||
    [[ "$(jq length <<<"$book")" == 50 ]]; }; then
    echo "   OK bid #${IDS[$i]}: terms match, Open, in RWA's bid book"
  else
    echo "   !! MISMATCH bid #${IDS[$i]}: want $want"
    fails=$((fails + 1))
  fi
done

ids_json="[$(
  IFS=,
  echo "${IDS[*]}"
)]"
if inv "$ID_DEPLOYER" yes extend_bid_ttl --ids "$ids_json" && [[ -n "$HASH" ]]; then
  printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "SEED_BID_EXTEND_TTL" "$HASH" ok >>"$TX_LOG"
  echo "TX SEED_BID_EXTEND_TTL $HASH"
else
  echo "   !! extend_bid_ttl $ids_json failed: $(grep -m1 -E 'error|Error' <<<"$ERR" || true)"
  fails=$((fails + 1))
fi

echo
echo "Seeded ${#IDS[@]} bids on $CONTRACT (expiry $EXPIRY): ids ${IDS[*]}"
for id in "${IDS[@]}"; do
  printf '  cancel: stellar contract invoke --id %s --network %s --source-account %s -- cancel_bid --buyer %s --id %s\n' \
    "$CONTRACT" "$NETWORK" "$ID_INVESTOR" "$INVESTOR" "$id"
done
((fails == 0)) || die "$fails check(s) failed"
