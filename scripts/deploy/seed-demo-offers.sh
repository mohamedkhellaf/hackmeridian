#!/usr/bin/env bash
# Seed a demo order book of funded offers on an options contract on Stellar TESTNET.
#
#   scripts/deploy/seed-demo-offers.sh --contract <C-id> [--hours 48]
#
# Creates four offers with real create_offer transactions (writers lock real Testnet collateral):
#   a) strata-maker1  PUT  RWA   qty 5 (50000000)  strike_total 50 USDx (500000000)  premium_total 1.0 USDx (10000000)
#   b) strata-maker2  PUT  RWA   same qty/strike/expiry as (a)                        premium_total 0.8 USDx (8000000)
#      -> two competing quotes on the same series
#   c) strata-maker1  CALL RWA   qty 3 (30000000)  strike_total 30 USDx (300000000)  premium_total 0.5 USDx (5000000)
#   d) strata-maker2  PUT  BOND  qty 5 (50000000)  strike_total 50 USDx (500000000)  premium_total 1.2 USDx (12000000)
# All four share expiry = now + hours*3600 (unix seconds). Amounts are 7-decimal integer units.
#
# NOT idempotent by design: every run adds four NEW offers (ids continue from option_count) and locks more
# collateral. To withdraw one, its writer cancels it (allowed while Offered, before or after expiry):
#   stellar contract invoke --id <C-id> --network testnet --source-account strata-maker1 \
#     -- cancel_offer --writer <MAKER1 G...> --id <option id>
# The script prints the exact cancel command for each offer it creates.
#
# The contract id is required on the command line and never read from scripts/out/testnet.env, so the book lands
# on the deployment the frontend actually uses. Reads RWA_SAC/BOND_SAC from the env file and the maker addresses
# from the CLI keystore. Every tx prints "TX <label> <hash>" and is appended to scripts/out/tx-log.tsv; the whole
# output is saved to scripts/out/seed-<UTC time>.log. Exit 0 only if all four offers were created and read back
# from the contract (list_open + get_option) with the expected terms.
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar jq

usage() {
  sed -n '2,25p' "$0" >&2
  exit "${1:-1}"
}

CONTRACT=""
HOURS=48
while (($# > 0)); do
  case "$1" in
    -h | --help) usage 0 ;;
    --contract)
      CONTRACT="${2:-}"
      shift 2 || shift
      ;;
    --hours)
      HOURS="${2:-}"
      shift 2 || shift
      ;;
    *) die "unknown argument: $1 (usage: $0 --contract <C-id> [--hours 48])" ;;
  esac
done
[[ -n "$CONTRACT" ]] || die "--contract <C-id> is required (the options contract to seed; never taken from the env file)"
is_contract_id "$CONTRACT" || die "--contract '$CONTRACT' is not a contract id (C... 56 chars)"
[[ "$HOURS" =~ ^[1-9][0-9]*$ ]] || die "--hours must be a positive whole number"

load_env
require_vars RWA_SAC BOND_SAC
MAKER1="$(pubkey "$ID_MAKER1")"
MAKER2="$(pubkey "$ID_MAKER2")"
declare -A WRITER_G=([$ID_MAKER1]="$MAKER1" [$ID_MAKER2]="$MAKER2")

mkdir -p "$OUT_DIR"
SEED_LOG="$OUT_DIR/seed-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$SEED_LOG") 2>&1

# inv <identity> <send:yes|no> <fn> [args...]: one invocation of the options contract. Sets OUT (stdout: return
# value), ERR (stderr: CLI log) and HASH (signed tx hash, if any). Retries transport errors only while nothing was
# signed, so a retry can never submit a transaction twice.
inv() {
  local who="$1" send="$2" o e rc attempt
  shift 2
  o="$(mktemp)"
  e="$(mktemp)"
  for attempt in 1 2 3 4 5; do
    rc=0
    stellar contract invoke --id "$CONTRACT" --network "$NETWORK" --source-account "$who" --send="$send" -- "$@" \
      >"$o" 2>"$e" || rc=$?
    OUT="$(sed '/^$/d' "$o" | tail -1)"
    ERR="$(cat "$e")"
    if [[ $rc != 0 ]] && ! grep -q 'Signing transaction' <<<"$ERR" && ! grep -q 'Error(' <<<"$ERR" &&
      grep -qiE 'client error|error sending request|connection|timed out|timeout|SendRequest|status: 5[0-9][0-9]|429' <<<"$ERR"; then
      log "transient RPC error on $1 (attempt $attempt/5), retrying"
      sleep 4
      continue
    fi
    break
  done
  rm -f "$o" "$e"
  HASH="$(grep -oE 'Signing transaction: [0-9a-f]{64}' <<<"$ERR" | grep -oE '[0-9a-f]{64}' | tail -1 || true)"
  return "$rc"
}

view() { # view <fn> [args...]: simulation only, prints the return value
  inv "$ID_DEPLOYER" no "$@" || {
    log "read $1 failed: $(grep -m1 -E 'error|Error' <<<"$ERR" || tail -1 <<<"$ERR")"
    return 1
  }
  printf '%s\n' "$OUT"
}

# ---------- preflight (reads only) ----------
contract_exists "$CONTRACT" || die "no contract instance at $CONTRACT on $NETWORK"
count_before="$(view option_count)" || die "option_count failed on $CONTRACT; is it a Strata options contract?"
log "contract $CONTRACT: option_count=$count_before, list_open=$(view list_open || echo '?')"
for a in RWA BOND; do
  sac_var="${a}_SAC"
  ok="$(stellar contract invoke --id "${!sac_var}" --network "$NETWORK" --source-account "$ID_DEPLOYER" --send=no \
    -- authorized --id "$CONTRACT" 2>/dev/null | tail -1 || true)"
  [[ "$ok" == true ]] ||
    die "$a SAC ${!sac_var} does not authorize $CONTRACT (authorized=${ok:-unknown}); run scripts/setup-testnet/03-authorize-contract.sh $CONTRACT"
done

EXPIRY=$(($(date +%s) + HOURS * 3600))
log "expiry for all offers: $EXPIRY ($(date -u -d "@$EXPIRY" +%FT%TZ), now + ${HOURS}h)"

# label | writer identity | underlying var | option_type | qty | strike_total | premium_total
OFFERS=(
  "A_MAKER1_PUT_RWA|$ID_MAKER1|RWA_SAC|Put|50000000|500000000|10000000"
  "B_MAKER2_PUT_RWA|$ID_MAKER2|RWA_SAC|Put|50000000|500000000|8000000"
  "C_MAKER1_CALL_RWA|$ID_MAKER1|RWA_SAC|Call|30000000|300000000|5000000"
  "D_MAKER2_PUT_BOND|$ID_MAKER2|BOND_SAC|Put|50000000|500000000|12000000"
)
IDS=()
SPECS=()
cancel_hint() { # cancel_hint <writer identity> <id>
  printf '  stellar contract invoke --id %s --network %s --source-account %s -- cancel_offer --writer %s --id %s\n' \
    "$CONTRACT" "$NETWORK" "$1" "${WRITER_G[$1]}" "$2"
}
abort() {
  log "ERROR: $*"
  if ((${#IDS[@]} > 0)); then
    echo "Offers created before the failure: ${IDS[*]}. To cancel them:"
    local i
    for i in "${!IDS[@]}"; do cancel_hint "$(cut -d'|' -f2 <<<"${SPECS[$i]}")" "${IDS[$i]}"; done
  fi
  exit 1
}

# ---------- create ----------
for spec in "${OFFERS[@]}"; do
  IFS='|' read -r label who uvar otype qty strike prem <<<"$spec"
  label="SEED_$label"
  underlying="${!uvar}"
  echo
  echo "-> [$label] $who create_offer $otype ${uvar%_SAC} qty $qty strike_total $strike premium_total $prem expiry $EXPIRY"
  if ! inv "$who" yes create_offer --writer "${WRITER_G[$who]}" --underlying "$underlying" --option_type "$otype" \
    --qty "$qty" --strike_total "$strike" --premium_total "$prem" --expiry "$EXPIRY"; then
    printf '%s\n' "$ERR" | head -25 | sed 's/^/   | /'
    if [[ -n "$HASH" ]]; then
      printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$label" "$HASH" failed >>"$TX_LOG"
      abort "$label failed after signing tx $HASH (check it on Horizon before re-running)"
    fi
    abort "$label failed (nothing signed)"
  fi
  [[ "$OUT" =~ ^[0-9]+$ ]] || abort "$label: create_offer returned '$OUT', not a u32 id (tx ${HASH:-?})"
  [[ -n "$HASH" ]] || abort "$label: CLI reported success but printed no tx hash"
  printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$label" "$HASH" ok >>"$TX_LOG"
  echo "TX $label $HASH"
  echo "   option id $OUT  https://stellar.expert/explorer/testnet/tx/$HASH"
  IDS+=("$OUT")
  SPECS+=("$spec")
done

# ---------- read back ----------
echo
fails=0
open="$(view list_open)" || abort "list_open failed"
echo "list_open = $open"
for i in "${!IDS[@]}"; do
  id="${IDS[$i]}"
  IFS='|' read -r label who uvar otype qty strike prem <<<"${SPECS[$i]}"
  opt="$(view get_option --id "$id")" || {
    echo "   !! get_option($id) failed"
    fails=$((fails + 1))
    continue
  }
  echo "get_option($id) = $opt"
  want="$(jq -cn --arg w "${WRITER_G[$who]}" --arg u "${!uvar}" --arg t "$otype" --arg q "$qty" --arg k "$strike" \
    --arg p "$prem" --argjson e "$EXPIRY" --argjson id "$id" \
    '{id: $id, writer: $w, underlying: $u, option_type: $t, qty: $q, strike_total: $k, premium_total: $p,
      expiry: $e, state: "Offered", holder: null}')"
  got="$(jq -c '{id, writer, underlying, option_type, qty: (.qty | tostring), strike_total: (.strike_total | tostring),
    premium_total: (.premium_total | tostring), expiry, state, holder}' <<<"$opt" 2>/dev/null || echo '{}')"
  if [[ "$got" == "$want" ]] && jq -e --argjson x "$id" 'any(.[]; . == $x)' <<<"$open" >/dev/null 2>&1; then
    echo "   OK #$id: terms match, state Offered, in list_open"
  else
    echo "   !! MISMATCH #$id: want $want"
    fails=$((fails + 1))
  fi
done

echo
echo "Seeded ${#IDS[@]} offers on $CONTRACT (expiry $EXPIRY): ids ${IDS[*]}"
echo "Not idempotent: re-running adds four more. To cancel any of these (writer only, while Offered):"
for i in "${!IDS[@]}"; do cancel_hint "$(cut -d'|' -f2 <<<"${SPECS[$i]}")" "${IDS[$i]}"; done
echo "Log: $SEED_LOG"
((fails == 0)) || die "$fails offer(s) did not read back as expected"
