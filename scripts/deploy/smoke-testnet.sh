#!/usr/bin/env bash
# Smoke-test the deployed options contract on Stellar TESTNET with real transactions (test XLM fees only).
#
#   scripts/deploy/smoke-testnet.sh             # P0 (PUT lifecycle, expected failures, expiry, competition), then P0+
#   scripts/deploy/smoke-testnet.sh --p0-only   # stop after P0
#
# Reads OPTIONS_ID (written by deploy.sh), the SAC ids and the role public keys from scripts/out/testnet.env.
# Re-runnable: every run creates fresh offers and takes each option id from create_offer's return value.
# Expected failures are simulated with --send=no (no fee, no state change) and pass only with the exact contract
# error code from docs/contract-abi.md §2. Every submitted transaction prints "TX <label> <hash>" and is appended
# to scripts/out/tx-log.tsv. The whole output is also saved to scripts/out/smoke-<UTC time>.log.
# Exit status is 0 only if every check of the sections that ran passed.
set -uo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar jq curl

RUN_P0PLUS=1
case "${1:-}" in
  "") ;;
  --p0-only) RUN_P0PLUS=0 ;;
  -h | --help)
    sed -n '2,12p' "$0"
    exit 0
    ;;
  *) die "unknown argument: $1 (usage: $0 [--p0-only])" ;;
esac

load_env
require_vars OPTIONS_ID USDX_SAC RWA_SAC BOND_SAC MAKER1 MAKER2 INVESTOR OUTSIDER
is_contract_id "$OPTIONS_ID" || die "OPTIONS_ID='$OPTIONS_ID' is not a contract id; run scripts/deploy/deploy.sh first"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
O="$OPTIONS_ID"

mkdir -p "$OUT_DIR"
SMOKE_LOG="$OUT_DIR/smoke-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$SMOKE_LOG") 2>&1

# Amounts are 7-decimal integer units (1 token = 10_000_000).
PUT_QTY=50000000      # 5 RWA
PUT_STRIKE=500000000  # 50 USDx total strike
PUT_PREM=10000000     # 1 USDx total premium
CALL_QTY=30000000     # 3 RWA
CALL_STRIKE=300000000 # 30 USDx
CALL_PREM=5000000     # 0.5 USDx
COMP_PREM=8000000     # maker2's competing premium, 0.8 USDx
EXP_SECS=45           # tenor of the offer used for the expiry path

# ---------- results ----------
declare -A NPASS=([P0]=0 [P0+]=0 [PRE]=0) NFAIL=([P0]=0 [P0+]=0 [PRE]=0)
GROUP=PRE
SUMMARY=()
pass() {
  NPASS[$GROUP]=$((NPASS[$GROUP] + 1))
  SUMMARY+=("$GROUP|$1|PASS|$2")
}
fail() {
  NFAIL[$GROUP]=$((NFAIL[$GROUP] + 1))
  SUMMARY+=("$GROUP|$1|FAIL|$2")
  echo "   !! FAIL $1: $2"
}
section() { printf '\n==================== %s ====================\n' "$*"; }

# ---------- CLI wrappers ----------
# inv <contract> <identity> <send:yes|no> <fn> [args...]: one CLI invocation. Sets OUT (stdout: return value),
# ERR (stderr: CLI log and diagnostics) and HASH (hash of the signed tx, if any). Returns the CLI status.
inv() {
  local id="$1" who="$2" send="$3" o e rc attempt
  shift 3
  o="$(mktemp)"
  e="$(mktemp)"
  for attempt in 1 2 3 4 5; do
    rc=0
    stellar contract invoke --id "$id" --network "$NETWORK" --source-account "$who" --send="$send" -- "$@" \
      >"$o" 2>"$e" || rc=$?
    OUT="$(cat "$o")"
    ERR="$(cat "$e")"
    # Retry transport errors only when nothing was signed, so a retry can never submit a transaction twice.
    if [[ $rc != 0 ]] && ! grep -q 'Signing transaction' <<<"$ERR" && ! grep -q 'Error(' <<<"$ERR" &&
      grep -qiE 'client error|error sending request|connection|timed out|timeout|SendRequest|status: 5[0-9][0-9]|429' <<<"$ERR"; then
      log "transient RPC error on $1 (attempt $attempt/5): $(grep -m1 -i 'error' <<<"$ERR")"
      sleep 4
      continue
    fi
    break
  done
  rm -f "$o" "$e"
  HASH="$(grep -oE 'Signing transaction: [0-9a-f]{64}' <<<"$ERR" | grep -oE '[0-9a-f]{64}' | tail -1 || true)"
  return "$rc"
}

err_line() { grep -m1 -E '❌|error:' <<<"$1" || printf '%s\n' "$1" | sed '/^$/d' | tail -1; }

# view <contract> <fn> [args...]: simulation only (never sent); prints the return value.
view() {
  local OUT ERR HASH
  if ! inv "$1" "$ID_DEPLOYER" no "${@:2}"; then
    log "read failed: ${*:2}: $(err_line "$ERR")"
    return 1
  fi
  printf '%s\n' "$OUT" | sed '/^$/d' | tail -1
}
num() { tr -d '"'; }

# send <label> <identity> <fn> [args...]: simulate, sign and submit to the options contract. Sets RESULT.
send() {
  local label="$1" who="$2" msg
  shift 2
  RESULT=""
  echo "-> [$label] as $who: $*"
  if inv "$O" "$who" yes "$@"; then
    RESULT="$(printf '%s\n' "$OUT" | sed '/^$/d' | tail -1)"
    echo "   TX $label $HASH  (return: ${RESULT:-void})"
    echo "   https://stellar.expert/explorer/testnet/tx/$HASH"
    grep -E 'Event:' <<<"$ERR" | sed 's/^/   /' | cut -c1-400
    if [[ -z "$HASH" ]]; then
      fail "$label" "CLI reported success but printed no tx hash"
      return 1
    fi
    printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "SMOKE_$label" "$HASH" ok >>"$TX_LOG"
    pass "$label" "tx $HASH"
    return 0
  fi
  msg="$(err_line "$ERR")"
  echo "   FAILED $label (tx ${HASH:-not signed}): $msg"
  printf '%s\n' "$ERR" | head -25 | sed 's/^/   | /'
  [[ -z "$HASH" ]] || printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "SMOKE_$label" "$HASH" failed >>"$TX_LOG"
  fail "$label" "tx ${HASH:-not sent}: $msg"
  return 1
}

# expect_fail <label> <code> <name> <identity> <fn> [args...]: simulate only; passes iff the contract rejects the
# call with Error(Contract, #<code>).
expect_fail() {
  local label="$1" code="$2" name="$3" who="$4" got msg
  shift 4
  echo "-> [$label] expect $name (#$code); simulate as $who: $*"
  if inv "$O" "$who" no "$@"; then
    echo "   UNEXPECTED SUCCESS; simulation returned: $(printf '%s\n' "$OUT" | tail -1)"
    fail "$label" "simulation succeeded; wanted $name #$code"
    return 1
  fi
  got="$(grep -oE 'Error\(Contract, #[0-9]+\)' <<<"$ERR" | head -1 || true)"
  msg="$(err_line "$ERR")"
  echo "   $msg"
  if [[ "$got" == "Error(Contract, #$code)" ]]; then
    pass "$label" "simulation rejected: $got = $name"
    return 0
  fi
  printf '%s\n' "$ERR" | head -12 | sed 's/^/   | /'
  fail "$label" "wanted Error(Contract, #$code) $name, got: ${got:-$msg}"
  return 1
}

# ---------- option state ----------
OPT_JSON=""
show_option() {
  OPT_JSON="$(view "$O" get_option --id "$1")" || {
    echo "   get_option($1) failed"
    return 1
  }
  echo "   get_option($1) = $(jq -c . <<<"$OPT_JSON" 2>/dev/null || echo "$OPT_JSON")"
}
# expect_option <label> <id> <State> [holder G...]: get_option, then check state and holder (none if omitted).
expect_option() {
  local label="$1" id="$2" want="$3" holder="${4:-}" st h
  show_option "$id" || {
    fail "$label" "get_option($id) failed"
    return 1
  }
  st="$(jq -r '.state | if type == "string" then . elif type == "object" then (keys[0]) else tostring end' <<<"$OPT_JSON" 2>/dev/null)"
  h="$(jq -r '.holder // "" | if type == "string" then . else tostring end' <<<"$OPT_JSON" 2>/dev/null)"
  if [[ "$st" == "$want" && "$h" == "$holder" ]]; then
    pass "$label" "#$id state=$st holder=${h:-none}"
    return 0
  fi
  fail "$label" "#$id state=$st holder=${h:-none}; wanted state=$want holder=${holder:-none}"
  return 1
}

# ---------- balances and open_collateral ----------
# Keys: m1/inv/ctr = maker1/investor/contract SAC balance, oc = open_collateral; Q = USDx quote, U = underlying.
SNAP_KEYS=(m1Q invQ ctrQ ocQ m1U invU ctrU ocU)
declare -A CUR=() PREV=()
snap_reset() {
  CUR=()
  PREV=()
}
# snapshot <title> <underlying SAC> <underlying symbol>
snapshot() {
  local title="$1" u="$2" sym="$3" d k pids=()
  d="$(mktemp -d)"
  PREV=()
  for k in "${!CUR[@]}"; do PREV[$k]="${CUR[$k]}"; done
  (view "$USDX_SAC" balance --id "$MAKER1" | num >"$d/m1Q") &
  pids+=($!)
  (view "$USDX_SAC" balance --id "$INVESTOR" | num >"$d/invQ") &
  pids+=($!)
  (view "$USDX_SAC" balance --id "$O" | num >"$d/ctrQ") &
  pids+=($!)
  (view "$O" open_collateral --token "$USDX_SAC" | num >"$d/ocQ") &
  pids+=($!)
  (view "$u" balance --id "$MAKER1" | num >"$d/m1U") &
  pids+=($!)
  (view "$u" balance --id "$INVESTOR" | num >"$d/invU") &
  pids+=($!)
  (view "$u" balance --id "$O" | num >"$d/ctrU") &
  pids+=($!)
  (view "$O" open_collateral --token "$u" | num >"$d/ocU") &
  pids+=($!)
  wait "${pids[@]}"
  for k in "${SNAP_KEYS[@]}"; do CUR[$k]="$(cat "$d/$k" 2>/dev/null)"; done
  rm -rf "$d"
  echo "   [$title]"
  printf '   %-30s %26s %26s\n' "" "USDx" "$sym"
  local row
  for row in "maker1 balance:m1" "investor balance:inv" "contract balance:ctr" "open_collateral:oc"; do
    printf '   %-30s %26s %26s\n' "${row%%:*}" "$(fmt_cell "${row#*:}Q")" "$(fmt_cell "${row#*:}U")"
  done
}
fmt_cell() {
  local k="$1" c="${CUR[$1]:-}" p="${PREV[$1]:-}"
  [[ "$c" =~ ^-?[0-9]+$ ]] || {
    echo "ERR"
    return
  }
  if [[ "$p" =~ ^-?[0-9]+$ ]]; then printf '%s (%+d)' "$c" "$((c - p))"; else printf '%s' "$c"; fi
}
# check_deltas <label> "<key>=<delta> ...": every listed key moved by exactly <delta> since the previous snapshot,
# every other key did not move, and the contract balance still covers open_collateral for both tokens.
check_deltas() {
  local label="$1" spec="$2" kv k want got c p bad=""
  local -A exp=()
  for kv in $spec; do exp[${kv%%=*}]="${kv#*=}"; done
  for k in "${SNAP_KEYS[@]}"; do
    want="${exp[$k]:-0}"
    c="${CUR[$k]:-}"
    p="${PREV[$k]:-}"
    if [[ ! "$c" =~ ^-?[0-9]+$ || ! "$p" =~ ^-?[0-9]+$ ]]; then
      bad+=" $k:unreadable"
      continue
    fi
    got=$((c - p))
    ((got == want)) || bad+=" $k:want=$want,got=$got"
  done
  for k in Q U; do
    c="${CUR[ctr$k]:-0}"
    p="${CUR[oc$k]:-0}"
    [[ "$c" =~ ^-?[0-9]+$ && "$p" =~ ^-?[0-9]+$ ]] && ((c >= p)) || bad+=" ctr$k<oc$k($c<$p)"
  done
  if [[ -z "$bad" ]]; then
    pass "$label" "deltas {${spec:-none}} and balance>=open_collateral"
    return 0
  fi
  fail "$label" "balance check:$bad"
  return 1
}

# ---------- time ----------
ledger_time() {
  curl -s -m 10 -X POST "$RPC_URL" -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' | jq -r '.result.latestLedgerCloseTime // 0' 2>/dev/null
}
# wait_past <unix ts>: short sleeps until the local clock and the latest closed ledger are both past it.
wait_past() {
  local t="$1" now lt start
  start="$(date +%s)"
  while :; do
    now="$(date +%s)"
    lt="$(ledger_time)"
    [[ "$lt" =~ ^[0-9]+$ ]] || lt=0
    if ((now >= t + 5 && lt >= t + 1)); then
      echo "   past expiry $t: local clock $now, latest ledger close $lt"
      return 0
    fi
    if ((now - start > 300)); then
      echo "   gave up waiting for $t (local $now, ledger $lt)"
      return 1
    fi
    echo "   waiting for expiry $t: local $now ($((t - now))s to go), latest ledger close $lt"
    sleep 5
  done
}

# ---------- paths ----------
# lifecycle <tag> <Put|Call> <underlying SAC> <symbol> <qty> <strike_total> <premium_total> [checks]
# maker1 create_offer -> investor buy -> investor exercise -> maker1 claim_delivery, with balances and
# open_collateral before/after every step checked against the table in contract-abi.md §2.
# With [checks], the NotHolder / NotExpired / WrongState / SelfTrade failures are simulated on the same option.
lifecycle() {
  local tag="$1" type="$2" u="$3" sym="$4" q="$5" k="$6" p="$7" checks="${8:-}" id exp
  snap_reset
  snapshot "$tag before" "$u" "$sym"
  exp=$(($(date +%s) + 3600))
  send "${tag}_CREATE" "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$u" --option_type "$type" \
    --qty "$q" --strike_total "$k" --premium_total "$p" --expiry "$exp" || return 1
  id="$RESULT"
  [[ "$id" =~ ^[0-9]+$ ]] || {
    fail "${tag}_CREATE_ID" "create_offer returned '$id', not a u32 id"
    return 1
  }
  echo "   new option id $id ($type, $sym, qty $q, strike_total $k, premium_total $p, expiry $exp)"
  expect_option "${tag}_CREATE_STATE" "$id" Offered || return 1
  snapshot "$tag after create_offer #$id" "$u" "$sym"
  if [[ $type == Put ]]; then
    check_deltas "${tag}_CREATE_BAL" "m1Q=-$k ctrQ=$k ocQ=$k" || return 1
  else
    check_deltas "${tag}_CREATE_BAL" "m1U=-$q ctrU=$q ocU=$q" || return 1
  fi
  [[ -z $checks ]] || expect_fail "${tag}_FAIL_SELF_TRADE" 11 SelfTrade "$ID_MAKER1" buy --buyer "$MAKER1" --id "$id"

  send "${tag}_BUY" "$ID_INVESTOR" buy --buyer "$INVESTOR" --id "$id" || return 1
  expect_option "${tag}_BUY_STATE" "$id" Active "$INVESTOR" || return 1
  snapshot "$tag after buy #$id" "$u" "$sym"
  check_deltas "${tag}_BUY_BAL" "invQ=-$p m1Q=$p" || return 1
  if [[ -n $checks ]]; then
    expect_fail FAIL_NOT_HOLDER 8 NotHolder "$ID_MAKER2" exercise --holder "$MAKER2" --id "$id"
    expect_fail FAIL_NOT_EXPIRED 10 NotExpired "$ID_MAKER1" reclaim --writer "$MAKER1" --id "$id"
  fi

  send "${tag}_EXERCISE" "$ID_INVESTOR" exercise --holder "$INVESTOR" --id "$id" || return 1
  expect_option "${tag}_EXERCISE_STATE" "$id" Exercised "$INVESTOR" || return 1
  snapshot "$tag after exercise #$id" "$u" "$sym"
  if [[ $type == Put ]]; then
    check_deltas "${tag}_EXERCISE_BAL" "invU=-$q invQ=$k ctrU=$q ctrQ=-$k ocQ=-$k ocU=$q" || return 1
  else
    check_deltas "${tag}_EXERCISE_BAL" "invQ=-$k invU=$q ctrQ=$k ctrU=-$q ocU=-$q ocQ=$k" || return 1
  fi
  [[ -z $checks ]] || expect_fail FAIL_DOUBLE_EXERCISE 6 WrongState "$ID_INVESTOR" exercise --holder "$INVESTOR" --id "$id"

  send "${tag}_CLAIM" "$ID_MAKER1" claim_delivery --writer "$MAKER1" --id "$id" || return 1
  expect_option "${tag}_CLAIM_STATE" "$id" Settled "$INVESTOR" || return 1
  snapshot "$tag after claim_delivery #$id" "$u" "$sym"
  if [[ $type == Put ]]; then
    check_deltas "${tag}_CLAIM_BAL" "ctrU=-$q m1U=$q ocU=-$q" || return 1
  else
    check_deltas "${tag}_CLAIM_BAL" "ctrQ=-$k m1Q=$k ocQ=-$k" || return 1
  fi
}

E_ID=""
E_EXP=""
expiry_create() {
  snap_reset
  snapshot "EXP before" "$RWA_SAC" RWA
  E_EXP=$(($(date +%s) + EXP_SECS))
  send EXP_CREATE "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$RWA_SAC" --option_type Put \
    --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" --premium_total "$PUT_PREM" --expiry "$E_EXP" || return 1
  [[ "$RESULT" =~ ^[0-9]+$ ]] || {
    fail EXP_CREATE_ID "create_offer returned '$RESULT'"
    return 1
  }
  E_ID="$RESULT"
  echo "   expiry-path option id $E_ID, expiry $E_EXP (now+${EXP_SECS}s)"
  expect_option EXP_CREATE_STATE "$E_ID" Offered || return 1
  snapshot "EXP after create_offer #$E_ID" "$RWA_SAC" RWA
  check_deltas EXP_CREATE_BAL "m1Q=-$PUT_STRIKE ctrQ=$PUT_STRIKE ocQ=$PUT_STRIKE"
}
expiry_finish() {
  [[ -n "$E_ID" ]] || {
    fail EXP_RECLAIM "skipped: the expiry offer was not created"
    return 1
  }
  wait_past "$E_EXP" || {
    fail EXP_WAIT "ledger did not pass expiry $E_EXP"
    return 1
  }
  expect_fail FAIL_BUY_EXPIRED 9 Expired "$ID_INVESTOR" buy --buyer "$INVESTOR" --id "$E_ID"
  snapshot "EXP before reclaim #$E_ID" "$RWA_SAC" RWA
  send EXP_RECLAIM "$ID_MAKER1" reclaim --writer "$MAKER1" --id "$E_ID" || return 1
  expect_option EXP_RECLAIM_STATE "$E_ID" Expired || return 1
  snapshot "EXP after reclaim #$E_ID" "$RWA_SAC" RWA
  check_deltas EXP_RECLAIM_BAL "m1Q=$PUT_STRIKE ctrQ=-$PUT_STRIKE ocQ=-$PUT_STRIKE"
}

in_list() { jq -e --argjson x "$2" 'any(.[]; . == $x)' <<<"$1" >/dev/null 2>&1; }

competition() {
  local exp a b before after open n1 n2 n3
  exp=$(($(date +%s) + 3600))
  before="$(view "$USDX_SAC" balance --id "$MAKER1" | num)"
  send COMP_MAKER1_CREATE "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$RWA_SAC" --option_type Put \
    --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" --premium_total "$PUT_PREM" --expiry "$exp" || return 1
  a="$RESULT"
  send COMP_MAKER2_CREATE "$ID_MAKER2" create_offer --writer "$MAKER2" --underlying "$RWA_SAC" --option_type Put \
    --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" --premium_total "$COMP_PREM" --expiry "$exp" || return 1
  b="$RESULT"
  show_option "$a"
  show_option "$b"
  open="$(view "$O" list_open)"
  echo "   list_open = $open"
  if in_list "$open" "$a" && in_list "$open" "$b"; then
    pass COMP_LIST_BOTH "list_open $open has #$a (maker1, premium $PUT_PREM) and #$b (maker2, premium $COMP_PREM)"
  else
    fail COMP_LIST_BOTH "list_open $open is missing #$a or #$b"
    return 1
  fi
  echo "   same terms (5 RWA put, strike_total $PUT_STRIKE); cheaper premium for the buyer: #$b (maker2)"
  n1="$(jq length <<<"$open")"

  expect_fail FAIL_NOT_WRITER 7 NotWriter "$ID_MAKER2" cancel_offer --writer "$MAKER2" --id "$a"
  expect_fail FAIL_NOT_ELIGIBLE 4 NotEligible "$ID_OUTSIDER" buy --buyer "$OUTSIDER" --id "$a"

  send COMP_MAKER1_CANCEL "$ID_MAKER1" cancel_offer --writer "$MAKER1" --id "$a" || return 1
  expect_option COMP_CANCEL_STATE "$a" Cancelled || return 1
  open="$(view "$O" list_open)"
  n2="$(jq length <<<"$open")"
  echo "   list_open = $open"
  if ! in_list "$open" "$a" && in_list "$open" "$b" && ((n2 == n1 - 1)); then
    pass COMP_LIST_SHRINKS "list_open $n1 -> $n2 ids, #$a gone, #$b still open"
  else
    fail COMP_LIST_SHRINKS "list_open $open after cancelling #$a (was $n1 ids)"
  fi
  after="$(view "$USDX_SAC" balance --id "$MAKER1" | num)"
  if [[ "$before" =~ ^[0-9]+$ && "$after" == "$before" ]]; then
    pass COMP_COLLATERAL_BACK "maker1 USDx $before before create_offer, $after after cancel_offer"
  else
    fail COMP_COLLATERAL_BACK "maker1 USDx $before before create_offer, $after after cancel_offer"
  fi

  echo "   cleanup: maker2 withdraws its offer so offers do not pile up across runs"
  send COMP_MAKER2_CANCEL "$ID_MAKER2" cancel_offer --writer "$MAKER2" --id "$b" || return 1
  open="$(view "$O" list_open)"
  n3="$(jq length <<<"$open")"
  echo "   list_open = $open"
  if ! in_list "$open" "$b" && ((n3 == n2 - 1)); then
    pass COMP_LIST_CLEANUP "list_open $n2 -> $n3 ids"
  else
    fail COMP_LIST_CLEANUP "list_open $open after cancelling #$b"
  fi
}

# ---------- run ----------
section "Strata options smoke run on Stellar TESTNET ($(date -u +%FT%TZ))"
echo "options contract  $O"
echo "                  https://stellar.expert/explorer/testnet/contract/$O"
echo "USDx SAC (quote)  $USDX_SAC"
echo "RWA SAC           $RWA_SAC"
echo "BOND SAC          $BOND_SAC"
echo "maker1 $MAKER1 | maker2 $MAKER2"
echo "investor $INVESTOR | outsider $OUTSIDER"
echo "log file          $SMOKE_LOG"

section "PRE: config and eligibility"
echo "   config = $(view "$O" config)"
echo "   option_count = $(view "$O" option_count)   list_open = $(view "$O" list_open)"
for spec in "contract:$O:RWA:true" "contract:$O:BOND:true" "investor:$INVESTOR:RWA:true" \
  "maker1:$MAKER1:RWA:true" "maker2:$MAKER2:RWA:true" "outsider:$OUTSIDER:RWA:false"; do
  IFS=: read -r who addr sym want <<<"$spec"
  sac_var="${sym}_SAC"
  got="$(view "$O" is_eligible --token "${!sac_var}" --who "$addr")"
  if [[ "$got" == "$want" ]]; then pass "PRE_ELIGIBLE_${who}_$sym" "is_eligible=$got"; else fail "PRE_ELIGIBLE_${who}_$sym" "is_eligible=$got, wanted $want"; fi
  echo "   is_eligible($sym, $who) = $got"
done

GROUP=P0
section "P0-1 PUT happy path on RWA (create_offer -> buy -> exercise -> claim_delivery)"
lifecycle P0_PUT Put "$RWA_SAC" RWA "$PUT_QTY" "$PUT_STRIKE" "$PUT_PREM" checks || echo "   P0 PUT path stopped"

section "P0-2 argument and allowlist checks (simulated)"
NOW="$(date +%s)"
expect_fail FAIL_ASSET_NOT_ALLOWED 3 AssetNotAllowed "$ID_MAKER1" create_offer --writer "$MAKER1" \
  --underlying "$USDX_SAC" --option_type Put --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" \
  --premium_total "$PUT_PREM" --expiry "$((NOW + 3600))"
expect_fail FAIL_INVALID_ARGS 2 InvalidArgs "$ID_MAKER1" create_offer --writer "$MAKER1" \
  --underlying "$RWA_SAC" --option_type Put --qty 0 --strike_total "$PUT_STRIKE" \
  --premium_total "$PUT_PREM" --expiry "$((NOW + 3600))"

section "P0-3 expiry path, part 1: maker1 offer expiring in ${EXP_SECS}s"
expiry_create || echo "   expiry path stopped"

section "P0-4 maker competition on RWA (two funded on-chain offers)"
competition || echo "   competition path stopped"

section "P0-3 expiry path, part 2: buy after expiry fails, writer reclaims"
expiry_finish || echo "   expiry path stopped"

if [[ $RUN_P0PLUS == 1 ]]; then
  GROUP=P0+
  section "P0+-1 covered CALL happy path on RWA"
  lifecycle P0P_CALL Call "$RWA_SAC" RWA "$CALL_QTY" "$CALL_STRIKE" "$CALL_PREM" || echo "   CALL path stopped"
  section "P0+-2 PUT happy path on BOND (second underlying, same contract)"
  lifecycle P0P_BOND_PUT Put "$BOND_SAC" BOND "$PUT_QTY" "$PUT_STRIKE" "$PUT_PREM" || echo "   BOND path stopped"
fi

# Every required check must have run (a stopped path leaves its later checks unreached).
require_ran() {
  local g="$1" l
  shift
  for l in "$@"; do
    printf '%s\n' "${SUMMARY[@]}" | grep -q "^$g|$l|" && continue
    GROUP="$g" fail "$l" "not reached (an earlier step of its path failed)"
  done
}
require_ran P0 P0_PUT_CREATE P0_PUT_BUY P0_PUT_EXERCISE P0_PUT_CLAIM P0_PUT_CLAIM_BAL FAIL_NOT_HOLDER \
  FAIL_DOUBLE_EXERCISE FAIL_NOT_EXPIRED FAIL_NOT_WRITER FAIL_NOT_ELIGIBLE FAIL_ASSET_NOT_ALLOWED FAIL_INVALID_ARGS \
  FAIL_BUY_EXPIRED EXP_RECLAIM EXP_RECLAIM_BAL COMP_LIST_BOTH COMP_LIST_SHRINKS
[[ $RUN_P0PLUS != 1 ]] || require_ran P0+ P0P_CALL_CREATE P0P_CALL_BUY P0P_CALL_EXERCISE P0P_CALL_CLAIM \
  P0P_CALL_CLAIM_BAL P0P_BOND_PUT_CREATE P0P_BOND_PUT_BUY P0P_BOND_PUT_EXERCISE P0P_BOND_PUT_CLAIM P0P_BOND_PUT_CLAIM_BAL

section "SUMMARY"
printf '%-5s %-30s %-5s %s\n' GROUP CHECK RESULT DETAIL
for row in "${SUMMARY[@]}"; do
  IFS='|' read -r g l r d <<<"$row"
  printf '%-5s %-30s %-5s %s\n' "$g" "$l" "$r" "$d"
done
echo
verdict() { if ((NFAIL[$1] == 0)); then echo PASS; else echo FAIL; fi; }
echo "PRE: $(verdict PRE) (${NPASS[PRE]} passed, ${NFAIL[PRE]} failed)"
echo "P0:  $(verdict P0) (${NPASS[P0]} passed, ${NFAIL[P0]} failed)"
if [[ $RUN_P0PLUS == 1 ]]; then echo "P0+: $(verdict P0+) (${NPASS[P0+]} passed, ${NFAIL[P0+]} failed)"; else echo "P0+: not run (--p0-only)"; fi
echo "log: $SMOKE_LOG"
total_fail=$((NFAIL[PRE] + NFAIL[P0] + NFAIL[P0+]))
exit $((total_fail > 0 ? 1 : 0))
