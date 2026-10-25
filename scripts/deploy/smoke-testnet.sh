#!/usr/bin/env bash
# Smoke-test the deployed options contract on Stellar TESTNET with real transactions (test XLM fees only).
#
#   scripts/deploy/smoke-testnet.sh             # P0 (PUT lifecycle, expected failures, expiry, competition), then P0+,
#                                               # then V1.2 (holder transfer, paged reads; needs contract v1.2+),
#                                               # then V1.3 (EQTY listing, prune_expired, tenor cap; needs v1.3)
#   scripts/deploy/smoke-testnet.sh --p0-only   # stop after P0
#   scripts/deploy/smoke-testnet.sh --no-v13    # skip V1.3 (for a v1.2 contract)
#   scripts/deploy/smoke-testnet.sh --full      # V1.3 also fills maker2 to the 50-offer writer cap, expects #116 on
#                                               # the 51st, then cancels them (~100 extra txs, ~2 test XLM, 10-20 min)
#
# Reads OPTIONS_ID (written by deploy.sh), the SAC ids and the role public keys from scripts/out/testnet.env.
# Re-runnable: every run creates fresh offers and takes each option id from create_offer's return value.
# V1.3 lists EQTY (not in the constructor) with list_asset and has the issuer authorize the escrow on it; both are
# one-time steps per contract, so on a re-run V13_LIST and V13_FAIL_CONTRACT_NOT_AUTHORIZED are reported as SKIP.
# Expected failures are simulated with --send=no (no fee, no state change) and pass only with the exact contract
# error code from docs/contract-abi.md §2. Every submitted transaction prints "TX <label> <hash>" and is appended
# to scripts/out/tx-log.tsv. The whole output is also saved to scripts/out/smoke-<UTC time>.log.
# Exit status is 0 only if every check of the sections that ran passed.
set -uo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar jq curl

RUN_P0PLUS=1
RUN_V13=1
RUN_FULL=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --p0-only) RUN_P0PLUS=0 ;;
    --no-v13) RUN_V13=0 ;;
    --full) RUN_FULL=1 ;;
    -h | --help)
      sed -n '2,19p' "$0"
      exit 0
      ;;
    *) die "unknown argument: $1 (usage: $0 [--p0-only | --no-v13 | --full])" ;;
  esac
  shift
done
if [[ $RUN_FULL == 1 && ($RUN_P0PLUS == 0 || $RUN_V13 == 0) ]]; then
  die "--full runs inside the V1.3 section; do not combine it with --p0-only or --no-v13"
fi
[[ $RUN_P0PLUS == 1 ]] || RUN_V13=0
[[ "${DRY_RUN:-0}" != 1 ]] || die "DRY_RUN is not supported: the smoke run always sends real testnet transactions"

load_env
require_vars OPTIONS_ID USDX_SAC RWA_SAC BOND_SAC MAKER1 MAKER2 INVESTOR OUTSIDER
[[ $RUN_V13 == 0 ]] || require_vars EQTY_SAC RWA_ISSUER USDX_ISSUER
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
declare -A NPASS=([P0]=0 [P0+]=0 [V1.2]=0 [V1.3]=0 [PRE]=0) NFAIL=([P0]=0 [P0+]=0 [V1.2]=0 [V1.3]=0 [PRE]=0)
declare -A NSKIP=([P0]=0 [P0+]=0 [V1.2]=0 [V1.3]=0 [PRE]=0)
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
# skip: a check that cannot apply on this run (one-time step already done, or an opt-in flag not given).
skip() {
  NSKIP[$GROUP]=$((NSKIP[$GROUP] + 1))
  SUMMARY+=("$GROUP|$1|SKIP|$2")
  echo "   -- SKIP $1: $2"
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
# Keys: m1/m2/inv/ctr = maker1/maker2/investor/contract SAC balance, oc = open_collateral; Q = USDx quote,
# U = underlying.
SNAP_KEYS=(m1Q m2Q invQ ctrQ ocQ m1U m2U invU ctrU ocU)
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
  (view "$USDX_SAC" balance --id "$MAKER2" | num >"$d/m2Q") &
  pids+=($!)
  (view "$USDX_SAC" balance --id "$INVESTOR" | num >"$d/invQ") &
  pids+=($!)
  (view "$USDX_SAC" balance --id "$O" | num >"$d/ctrQ") &
  pids+=($!)
  (view "$O" open_collateral --token "$USDX_SAC" | num >"$d/ocQ") &
  pids+=($!)
  (view "$u" balance --id "$MAKER1" | num >"$d/m1U") &
  pids+=($!)
  (view "$u" balance --id "$MAKER2" | num >"$d/m2U") &
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
  for row in "maker1 balance:m1" "maker2 balance:m2" "investor balance:inv" "contract balance:ctr" "open_collateral:oc"; do
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
  [[ -z $checks ]] || expect_fail "${tag}_FAIL_SELF_TRADE" 111 SelfTrade "$ID_MAKER1" buy --buyer "$MAKER1" --id "$id"

  send "${tag}_BUY" "$ID_INVESTOR" buy --buyer "$INVESTOR" --id "$id" || return 1
  expect_option "${tag}_BUY_STATE" "$id" Active "$INVESTOR" || return 1
  snapshot "$tag after buy #$id" "$u" "$sym"
  check_deltas "${tag}_BUY_BAL" "invQ=-$p m1Q=$p" || return 1
  if [[ -n $checks ]]; then
    expect_fail FAIL_NOT_HOLDER 108 NotHolder "$ID_MAKER2" exercise --holder "$MAKER2" --id "$id"
    expect_fail FAIL_NOT_EXPIRED 110 NotExpired "$ID_MAKER1" reclaim --writer "$MAKER1" --id "$id"
  fi

  send "${tag}_EXERCISE" "$ID_INVESTOR" exercise --holder "$INVESTOR" --id "$id" || return 1
  expect_option "${tag}_EXERCISE_STATE" "$id" Exercised "$INVESTOR" || return 1
  snapshot "$tag after exercise #$id" "$u" "$sym"
  if [[ $type == Put ]]; then
    check_deltas "${tag}_EXERCISE_BAL" "invU=-$q invQ=$k ctrU=$q ctrQ=-$k ocQ=-$k ocU=$q" || return 1
  else
    check_deltas "${tag}_EXERCISE_BAL" "invQ=-$k invU=$q ctrQ=$k ctrU=-$q ocU=-$q ocQ=$k" || return 1
  fi
  [[ -z $checks ]] || expect_fail FAIL_DOUBLE_EXERCISE 106 WrongState "$ID_INVESTOR" exercise --holder "$INVESTOR" --id "$id"

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
  expect_fail FAIL_BUY_EXPIRED 109 Expired "$ID_INVESTOR" buy --buyer "$INVESTOR" --id "$E_ID"
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

  expect_fail FAIL_NOT_WRITER 107 NotWriter "$ID_MAKER2" cancel_offer --writer "$MAKER2" --id "$a"
  expect_fail FAIL_NOT_ELIGIBLE 104 NotEligible "$ID_OUTSIDER" buy --buyer "$OUTSIDER" --id "$a"

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

# transfer_path (v1.2): maker1 PUT on RWA -> investor buy -> investor transfer to maker2 -> maker2 exercise ->
# maker1 claim_delivery. transfer moves no tokens and leaves open_collateral alone (contract-abi.md §3); the old
# holder can no longer exercise. The transfer preconditions are simulated on the same option.
transfer_path() {
  local q="$PUT_QTY" k="$PUT_STRIKE" p="$PUT_PREM" id exp
  snap_reset
  snapshot "XFER before" "$RWA_SAC" RWA
  exp=$(($(date +%s) + 3600))
  send XFER_CREATE "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$RWA_SAC" --option_type Put \
    --qty "$q" --strike_total "$k" --premium_total "$p" --expiry "$exp" || return 1
  id="$RESULT"
  [[ "$id" =~ ^[0-9]+$ ]] || {
    fail XFER_CREATE_ID "create_offer returned '$id', not a u32 id"
    return 1
  }
  echo "   transfer-path option id $id (Put, RWA, qty $q, strike_total $k, premium_total $p, expiry $exp)"
  expect_option XFER_CREATE_STATE "$id" Offered || return 1
  snapshot "XFER after create_offer #$id" "$RWA_SAC" RWA
  check_deltas XFER_CREATE_BAL "m1Q=-$k ctrQ=$k ocQ=$k" || return 1
  expect_fail FAIL_XFER_OFFERED 108 NotHolder "$ID_INVESTOR" transfer --holder "$INVESTOR" --to "$MAKER2" --id "$id"

  send XFER_BUY "$ID_INVESTOR" buy --buyer "$INVESTOR" --id "$id" || return 1
  expect_option XFER_BUY_STATE "$id" Active "$INVESTOR" || return 1
  snapshot "XFER after buy #$id" "$RWA_SAC" RWA
  check_deltas XFER_BUY_BAL "invQ=-$p m1Q=$p" || return 1

  expect_fail FAIL_XFER_NOT_HOLDER 108 NotHolder "$ID_MAKER1" transfer --holder "$MAKER1" --to "$MAKER2" --id "$id"
  expect_fail FAIL_XFER_SELF 102 InvalidArgs "$ID_INVESTOR" transfer --holder "$INVESTOR" --to "$INVESTOR" --id "$id"
  expect_fail FAIL_XFER_TO_WRITER 111 SelfTrade "$ID_INVESTOR" transfer --holder "$INVESTOR" --to "$MAKER1" --id "$id"
  expect_fail FAIL_XFER_NOT_ELIGIBLE 104 NotEligible "$ID_INVESTOR" transfer --holder "$INVESTOR" --to "$OUTSIDER" \
    --id "$id"

  send XFER_TRANSFER "$ID_INVESTOR" transfer --holder "$INVESTOR" --to "$MAKER2" --id "$id" || return 1
  if grep -qi 'option_transferred' <<<"$ERR"; then
    pass XFER_EVENT "option_transferred event in tx $HASH"
  else
    fail XFER_EVENT "no option_transferred event in the CLI output of tx $HASH"
  fi
  expect_option XFER_TRANSFER_STATE "$id" Active "$MAKER2" || return 1
  snapshot "XFER after transfer #$id to maker2" "$RWA_SAC" RWA
  check_deltas XFER_TRANSFER_BAL "" || return 1
  expect_fail FAIL_XFER_OLD_HOLDER 108 NotHolder "$ID_INVESTOR" exercise --holder "$INVESTOR" --id "$id"

  send XFER_EXERCISE "$ID_MAKER2" exercise --holder "$MAKER2" --id "$id" || return 1
  expect_option XFER_EXERCISE_STATE "$id" Exercised "$MAKER2" || return 1
  snapshot "XFER after maker2 exercise #$id" "$RWA_SAC" RWA
  check_deltas XFER_EXERCISE_BAL "m2U=-$q m2Q=$k ctrU=$q ctrQ=-$k ocQ=-$k ocU=$q" || return 1
  expect_fail FAIL_XFER_AFTER_EXERCISE 106 WrongState "$ID_MAKER2" transfer --holder "$MAKER2" --to "$INVESTOR" \
    --id "$id"

  send XFER_CLAIM "$ID_MAKER1" claim_delivery --writer "$MAKER1" --id "$id" || return 1
  expect_option XFER_CLAIM_STATE "$id" Settled "$MAKER2" || return 1
  snapshot "XFER after claim_delivery #$id" "$RWA_SAC" RWA
  check_deltas XFER_CLAIM_BAL "ctrU=-$q m1U=$q ocU=-$q"
}

# paging (v1.2): get_options(from, limit) returns ids from, from+1, ... capped at option_count and MAX_PAGE = 50.
# Needs at least 3 options on the contract (the P0 sections create them).
paging() {
  local count page ids len want
  count="$(view "$O" option_count | num)"
  [[ "$count" =~ ^[0-9]+$ ]] || {
    fail PAGE_COUNT "option_count unreadable: '$count'"
    return 1
  }
  echo "   option_count = $count"
  page="$(view "$O" get_options --from 0 --limit 3)"
  ids="$(jq -c '[.[].id]' <<<"$page" 2>/dev/null)"
  echo "   get_options(0, 3) ids = ${ids:-unreadable}"
  if [[ "$ids" == "[0,1,2]" ]]; then
    pass PAGE_FIRST3 "get_options(0, 3) returned 3 entries, ids $ids"
  else
    fail PAGE_FIRST3 "get_options(0, 3) ids ${ids:-unreadable}; wanted [0,1,2] (page: $page)"
  fi
  page="$(view "$O" get_options --from "$count" --limit 5)"
  echo "   get_options($count, 5) = $page"
  if [[ "$(jq -c . <<<"$page" 2>/dev/null)" == "[]" ]]; then
    pass PAGE_PAST_END "get_options(option_count=$count, 5) returned []"
  else
    fail PAGE_PAST_END "get_options($count, 5) returned '$page'; wanted []"
  fi
  page="$(view "$O" get_options --from 0 --limit 1000)"
  len="$(jq length <<<"$page" 2>/dev/null)"
  want=$((count < 50 ? count : 50))
  echo "   get_options(0, 1000) length = ${len:-unreadable} (option_count $count, MAX_PAGE 50)"
  if [[ "$len" =~ ^[0-9]+$ ]] && ((len <= 50 && len == want)); then
    pass PAGE_CAP "get_options(0, 1000) returned $len entries (<= 50, = min(option_count, 50))"
  else
    fail PAGE_CAP "get_options(0, 1000) returned ${len:-unreadable} entries; wanted $want (<= 50)"
  fi
}

# ---------- V1.3 (contract-abi.md §3, §8, §12) ----------
MAX_TENOR=63072000      # 2 years in seconds
MAX_OPEN_PER_WRITER=50  # open (Offered) offers per writer
PRUNE_SECS=45           # tenor of the offer used for the prune path

# expect_eq <label> <got> <want> <what>
expect_eq() {
  if [[ "$2" == "$3" ]]; then
    pass "$1" "$4 = $2"
    return 0
  fi
  fail "$1" "$4 = ${2:-unreadable}; wanted $3"
  return 1
}

# sim_ok <label> <identity> <fn> [args...]: simulate only (nothing sent); passes iff the call succeeds. Sets SIM_RESULT.
SIM_RESULT=""
sim_ok() {
  local label="$1" who="$2"
  shift 2
  SIM_RESULT=""
  echo "-> [$label] expect success; simulate as $who: $*"
  if inv "$O" "$who" no "$@"; then
    SIM_RESULT="$(printf '%s\n' "$OUT" | sed '/^$/d' | tail -1)"
    pass "$label" "simulation succeeded (return: ${SIM_RESULT:-void}); nothing sent"
    return 0
  fi
  printf '%s\n' "$ERR" | head -12 | sed 's/^/   | /'
  fail "$label" "simulation failed: $(err_line "$ERR")"
  return 1
}

# submit_quiet <label> <identity> <fn> [args...]: like send, but adds no PASS/FAIL row (bulk txs of --full).
# Sets RESULT and HASH, appends the hash to tx-log.tsv. Returns non-zero unless a signed tx succeeded.
submit_quiet() {
  local label="$1" who="$2"
  shift 2
  RESULT=""
  if inv "$O" "$who" yes "$@" && [[ -n "$HASH" ]]; then
    RESULT="$(printf '%s\n' "$OUT" | sed '/^$/d' | tail -1)"
    echo "   TX $label $HASH  (return: ${RESULT:-void})"
    printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "SMOKE_$label" "$HASH" ok >>"$TX_LOG"
    return 0
  fi
  echo "   FAILED $label (tx ${HASH:-not signed}): $(err_line "$ERR")"
  [[ -z "$HASH" ]] || printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "SMOKE_$label" "$HASH" failed >>"$TX_LOG"
  return 1
}

woc() { view "$O" writer_open_count --writer "$1" | num; }

v13_probe() {
  local n
  n="$(view "$O" asset_count | num)"
  if [[ "$n" =~ ^[0-9]+$ ]]; then
    pass V13_INTERFACE "asset_count() = $n: $O exposes the v1.3 interface"
    return 0
  fi
  fail V13_INTERFACE "asset_count() unreadable: $O is not a v1.3 contract (use --no-v13 against older contracts)"
  return 1
}

# prune path, part 1: maker1 PUT on RWA expiring in PRUNE_SECS that nobody buys.
P_ID=""
P_EXP=""
prune_create() {
  local w0 w1
  w0="$(woc "$MAKER1")"
  P_EXP=$(($(date +%s) + PRUNE_SECS))
  send PRUNE_CREATE "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$RWA_SAC" --option_type Put \
    --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" --premium_total "$PUT_PREM" --expiry "$P_EXP" || return 1
  [[ "$RESULT" =~ ^[0-9]+$ ]] || {
    fail PRUNE_CREATE_ID "create_offer returned '$RESULT', not a u32 id"
    return 1
  }
  P_ID="$RESULT"
  echo "   prune-path option id $P_ID (Put, RWA), expiry $P_EXP (now+${PRUNE_SECS}s); nobody buys it"
  w1="$(woc "$MAKER1")"
  if [[ "$w0" =~ ^[0-9]+$ ]]; then
    expect_eq PRUNE_CREATE_WOC "$w1" "$((w0 + 1))" "writer_open_count(maker1) after create_offer (was $w0)"
  else
    fail PRUNE_CREATE_WOC "writer_open_count(maker1) unreadable before create_offer: '$w0'"
  fi
}

# Permissionless listing of EQTY (not in the constructor). Returns 0 iff EQTY is listed afterwards.
v13_listing() {
  local listed got assets n len zz
  listed="$(view "$O" is_listed --token "$EQTY_SAC")"
  echo "   is_listed(EQTY $EQTY_SAC) before listing = ${listed:-unreadable}"
  echo "   config().underlyings = $(view "$O" config | jq -c '.underlyings' 2>/dev/null)"
  case "$listed" in
    false)
      send V13_LIST "$ID_MAKER1" list_asset --lister "$MAKER1" --code EQTY --issuer "$RWA_ISSUER" || return 1
      if grep -qi 'asset_listed' <<<"$ERR"; then
        pass V13_LIST_EVENT "asset_listed event in tx $HASH"
      else
        fail V13_LIST_EVENT "no asset_listed event in the CLI output of tx $HASH"
      fi
      got="$(num <<<"$RESULT")"
      expect_eq V13_LIST_ADDR "$got" "$EQTY_SAC" "list_asset(EQTY, rwa-issuer) returned address (want EQTY_SAC)"
      ;;
    true)
      skip V13_LIST "EQTY was already listed on $O by an earlier run (its list_asset return value was checked then)"
      ;;
    *)
      fail V13_LIST "is_listed(EQTY) unreadable: '$listed'"
      return 1
      ;;
  esac

  listed="$(view "$O" is_listed --token "$EQTY_SAC")"
  expect_eq V13_IS_LISTED "$listed" true "is_listed(EQTY)"
  assets="$(view "$O" list_assets --from 0 --limit 50)"
  echo "   list_assets(0, 50) = ${assets:-unreadable}"
  if jq -e --arg a "$EQTY_SAC" 'any(.[]; . == $a)' <<<"$assets" >/dev/null 2>&1; then
    pass V13_LIST_ASSETS "list_assets(0, 50) contains EQTY $EQTY_SAC"
  else
    fail V13_LIST_ASSETS "list_assets(0, 50) = ${assets:-unreadable}; EQTY $EQTY_SAC missing"
  fi
  got="$(jq -c '.[0:2]' <<<"$assets" 2>/dev/null)"
  expect_eq V13_LIST_ASSETS_SEED "$got" "$(jq -cn --arg a "$RWA_SAC" --arg b "$BOND_SAC" '[$a, $b]')" \
    "list_assets(0, 50)[0..2] (constructor seed RWA, BOND)"
  n="$(view "$O" asset_count | num)"
  len="$(jq length <<<"$assets" 2>/dev/null)"
  expect_eq V13_ASSET_COUNT "$n" 3 "asset_count() (RWA + BOND from the constructor, EQTY listed; list_assets length ${len:-?})"

  expect_fail V13_FAIL_ALREADY_LISTED 117 AlreadyListed "$ID_MAKER2" list_asset --lister "$MAKER2" --code EQTY \
    --issuer "$RWA_ISSUER"
  expect_fail V13_FAIL_LIST_QUOTE 117 AlreadyListed "$ID_MAKER2" list_asset --lister "$MAKER2" --code USDx \
    --issuer "$USDX_ISSUER"
  zz="$(stellar contract id asset --asset "ZZZZ:$USDX_ISSUER" --network "$NETWORK" 2>/dev/null)"
  if ! is_contract_id "$zz"; then
    fail V13_FAIL_NOT_DEPLOYED "could not derive the SAC id of ZZZZ:$USDX_ISSUER"
  elif contract_exists "$zz"; then
    fail V13_FAIL_NOT_DEPLOYED "precondition broken: the SAC $zz of ZZZZ:$USDX_ISSUER is deployed; pick another code"
  else
    echo "   SAC of ZZZZ:<usdx-issuer> would be $zz and is not deployed (precondition for #118)"
    expect_fail V13_FAIL_NOT_DEPLOYED 118 AssetNotDeployed "$ID_MAKER1" list_asset --lister "$MAKER1" --code ZZZZ \
      --issuer "$USDX_ISSUER"
  fi
  expect_fail V13_FAIL_BAD_CODE 102 InvalidArgs "$ID_MAKER1" list_asset --lister "$MAKER1" --code 'bad code!' \
    --issuer "$RWA_ISSUER"
  expect_fail V13_FAIL_ISSUER_NOT_ACCOUNT 102 InvalidArgs "$ID_MAKER1" list_asset --lister "$MAKER1" --code EQTY \
    --issuer "$USDX_SAC"
  [[ "$listed" == true ]]
}

# EQTY: create_offer fails with ContractNotAuthorized until the issuer authorizes the escrow, then a PUT settles.
v13_eqty() {
  local auth out rc h now spec who addr want got
  now="$(date +%s)"
  auth="$(view "$O" is_eligible --token "$EQTY_SAC" --who "$O")"
  echo "   is_eligible(EQTY, contract) = ${auth:-unreadable}"
  case "$auth" in
    false)
      expect_fail V13_FAIL_CONTRACT_NOT_AUTHORIZED 105 ContractNotAuthorized "$ID_MAKER1" create_offer \
        --writer "$MAKER1" --underlying "$EQTY_SAC" --option_type Put --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" \
        --premium_total "$PUT_PREM" --expiry "$((now + 3600))"
      ;;
    true) skip V13_FAIL_CONTRACT_NOT_AUTHORIZED "the issuer already authorized $O on EQTY in an earlier run" ;;
    *) fail V13_FAIL_CONTRACT_NOT_AUTHORIZED "is_eligible(EQTY, contract) unreadable: '$auth'" ;;
  esac

  echo "-> [V13_AUTHORIZE_EQTY] strata-rwa-issuer authorizes the escrow on EQTY:" \
    "scripts/setup-testnet/03-authorize-contract.sh $O EQTY"
  out="$(mktemp)"
  rc=0
  "$SCRIPTS_DIR/setup-testnet/03-authorize-contract.sh" "$O" EQTY 2>&1 | tee "$out" | sed 's/^/   | /' || rc=$?
  h="$(grep -oE '^TX AUTHORIZE_OPTIONS_EQTY [0-9a-f]{64}' "$out" | awk '{print $3}' | tail -1 || true)"
  rm -f "$out"
  if [[ $rc != 0 ]]; then
    fail V13_AUTHORIZE_EQTY "03-authorize-contract.sh $O EQTY exited $rc"
    return 1
  fi
  if [[ -n "$h" ]]; then
    echo "   https://stellar.expert/explorer/testnet/tx/$h"
    pass V13_AUTHORIZE_EQTY "issuer set_authorized(contract, true) on the EQTY SAC, tx $h"
  else
    pass V13_AUTHORIZE_EQTY "contract was already authorized on EQTY (03-authorize-contract.sh sent no tx)"
  fi
  for spec in "contract:$O:true" "maker1:$MAKER1:true" "investor:$INVESTOR:true" "outsider:$OUTSIDER:false"; do
    IFS=: read -r who addr want <<<"$spec"
    got="$(view "$O" is_eligible --token "$EQTY_SAC" --who "$addr")"
    expect_eq "V13_ELIGIBLE_EQTY_$who" "$got" "$want" "is_eligible(EQTY, $who)"
  done

  lifecycle V13_EQTY_PUT Put "$EQTY_SAC" EQTY "$PUT_QTY" "$PUT_STRIKE" "$PUT_PREM"
}

v13_tenor() {
  local now
  now="$(date +%s)"
  expect_fail V13_FAIL_TENOR 119 TenorOutOfRange "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$RWA_SAC" \
    --option_type Put --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" --premium_total "$PUT_PREM" \
    --expiry "$((now + 3 * 365 * 86400))"
  sim_ok V13_TENOR_INSIDE_SIM "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$RWA_SAC" \
    --option_type Put --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" --premium_total "$PUT_PREM" \
    --expiry "$((now + MAX_TENOR - 3600))"
}

# prune_expired on a live offer: returns 0, moves nothing, the offer stays Offered; the writer then cancels it.
prune_live() {
  local exp id open
  exp=$(($(date +%s) + 3600))
  send PRUNE_LIVE_CREATE "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$RWA_SAC" --option_type Put \
    --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" --premium_total "$PUT_PREM" --expiry "$exp" || return 1
  id="$RESULT"
  [[ "$id" =~ ^[0-9]+$ ]] || {
    fail PRUNE_LIVE_CREATE_ID "create_offer returned '$id', not a u32 id"
    return 1
  }
  echo "   live option id $id, expiry $exp (now+3600s)"
  snap_reset
  snapshot "PRUNE_LIVE before prune_expired [#$id]" "$RWA_SAC" RWA
  send PRUNE_LIVE "$ID_MAKER2" prune_expired --ids "[$id]"
  expect_eq PRUNE_LIVE_RET "$RESULT" 0 "prune_expired([$id]) on a live offer, return value"
  expect_option PRUNE_LIVE_STATE "$id" Offered
  snapshot "PRUNE_LIVE after prune_expired [#$id]" "$RWA_SAC" RWA
  check_deltas PRUNE_LIVE_BAL ""
  open="$(view "$O" list_open)"
  if in_list "$open" "$id"; then
    pass PRUNE_LIVE_OPEN "#$id still in list_open"
  else
    fail PRUNE_LIVE_OPEN "#$id missing from list_open ${open:-unreadable}"
  fi
  echo "   cleanup: only the writer can withdraw a live offer"
  send PRUNE_LIVE_CANCEL "$ID_MAKER1" cancel_offer --writer "$MAKER1" --id "$id"
}

# prune path, part 2: after expiry maker2 (not the writer) prunes maker1's unsold offer; collateral returns to maker1.
prune_finish() {
  local w0 w1 open count
  [[ -n "$P_ID" ]] || {
    fail PRUNE_EXPIRED "skipped: the prune offer was not created"
    return 1
  }
  wait_past "$P_EXP" || {
    fail PRUNE_WAIT "ledger did not pass expiry $P_EXP"
    return 1
  }
  expect_option PRUNE_PRE_STATE "$P_ID" Offered || return 1
  w0="$(woc "$MAKER1")"
  snap_reset
  snapshot "PRUNE before prune_expired [#$P_ID]" "$RWA_SAC" RWA
  send PRUNE_EXPIRED "$ID_MAKER2" prune_expired --ids "[$P_ID]" || return 1
  if grep -qi 'offer_pruned' <<<"$ERR"; then
    pass PRUNE_EVENT "offer_pruned event in tx $HASH"
  else
    fail PRUNE_EVENT "no offer_pruned event in the CLI output of tx $HASH"
  fi
  expect_eq PRUNE_EXPIRED_RET "$RESULT" 1 "prune_expired([$P_ID]) sent by maker2 (not the writer), return value"
  expect_option PRUNE_EXPIRED_STATE "$P_ID" Expired
  snapshot "PRUNE after prune_expired [#$P_ID]" "$RWA_SAC" RWA
  check_deltas PRUNE_EXPIRED_BAL "m1Q=$PUT_STRIKE ctrQ=-$PUT_STRIKE ocQ=-$PUT_STRIKE"
  w1="$(woc "$MAKER1")"
  if [[ "$w0" =~ ^[0-9]+$ ]]; then
    expect_eq PRUNE_EXPIRED_WOC "$w1" "$((w0 - 1))" "writer_open_count(maker1) after prune_expired (was $w0)"
  else
    fail PRUNE_EXPIRED_WOC "writer_open_count(maker1) unreadable before prune_expired: '$w0'"
  fi
  open="$(view "$O" list_open)"
  if [[ -n "$open" ]] && ! in_list "$open" "$P_ID"; then
    pass PRUNE_EXPIRED_OPEN "#$P_ID gone from list_open"
  else
    fail PRUNE_EXPIRED_OPEN "#$P_ID still in list_open ${open:-unreadable}"
  fi
  sim_ok PRUNE_AGAIN_SIM "$ID_MAKER2" prune_expired --ids "[$P_ID]" &&
    expect_eq PRUNE_AGAIN_RET "$SIM_RESULT" 0 "prune_expired([$P_ID]) again (simulated), return value"
  count="$(view "$O" option_count | num)"
  if [[ "$count" =~ ^[0-9]+$ ]]; then
    expect_fail PRUNE_FAIL_NOT_FOUND 101 NotFound "$ID_MAKER2" prune_expired --ids "[$((count + 1000))]"
  else
    fail PRUNE_FAIL_NOT_FOUND "option_count unreadable: '$count'"
  fi
}

# --full: maker2 fills its MAX_OPEN_PER_WRITER open offers with dust, the next create_offer fails with #116, then
# maker2 cancels every dust offer. An EXIT trap cancels them too if the run dies halfway.
CAP_IDS=()
CAP_CANCELLED=0
CAP_CANCEL_FAILED=0
cap_cleanup() {
  local id
  ((${#CAP_IDS[@]} > 0)) || return 0
  echo "   cleanup: maker2 cancels ${#CAP_IDS[@]} dust offers"
  for id in "${CAP_IDS[@]}"; do
    if submit_quiet "CAP_CANCEL_$id" "$ID_MAKER2" cancel_offer --writer "$MAKER2" --id "$id"; then
      CAP_CANCELLED=$((CAP_CANCELLED + 1))
    else
      CAP_CANCEL_FAILED=$((CAP_CANCEL_FAILED + 1))
      echo "   !! dust offer #$id is still open; cancel it with: stellar contract invoke --id $O --network testnet" \
        "--source-account $ID_MAKER2 -- cancel_offer --writer $MAKER2 --id $id"
    fi
  done
  CAP_IDS=()
}
v13_writer_cap() {
  local w0 w1 w2 need i exp n range=""
  w0="$(woc "$MAKER2")"
  [[ "$w0" =~ ^[0-9]+$ ]] || {
    fail CAP_FILL "writer_open_count(maker2) unreadable: '$w0'"
    return 1
  }
  need=$((MAX_OPEN_PER_WRITER - w0))
  ((need >= 0)) || need=0
  exp=$(($(date +%s) + 3600))
  echo "   maker2 has $w0 open offers; creating $need dust offers (PUT on RWA, qty = strike_total = premium_total = 1 unit)"
  trap cap_cleanup EXIT
  for ((i = 1; i <= need; i++)); do
    submit_quiet "CAP_DUST_$i" "$ID_MAKER2" create_offer --writer "$MAKER2" --underlying "$RWA_SAC" --option_type Put \
      --qty 1 --strike_total 1 --premium_total 1 --expiry "$exp" || break
    [[ "$RESULT" =~ ^[0-9]+$ ]] || {
      echo "   create_offer returned '$RESULT', not a u32 id"
      break
    }
    CAP_IDS+=("$RESULT")
  done
  n="${#CAP_IDS[@]}"
  ((n == 0)) || range="ids ${CAP_IDS[0]}..${CAP_IDS[$((n - 1))]}"
  w1="$(woc "$MAKER2")"
  if ((n == need)) && [[ "$w1" == "$MAX_OPEN_PER_WRITER" ]]; then
    pass CAP_FILL "maker2 created $n dust offers (${range:-none needed}); writer_open_count(maker2) = $w1"
  else
    fail CAP_FILL "created $n/$need dust offers; writer_open_count(maker2) = ${w1:-unreadable}, wanted $MAX_OPEN_PER_WRITER"
  fi
  if [[ "$w1" == "$MAX_OPEN_PER_WRITER" ]]; then
    expect_fail CAP_FAIL_WRITER_LIMIT 116 WriterOpenLimit "$ID_MAKER2" create_offer --writer "$MAKER2" \
      --underlying "$RWA_SAC" --option_type Put --qty 1 --strike_total 1 --premium_total 1 --expiry "$exp"
    sim_ok CAP_OTHER_WRITER_SIM "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$RWA_SAC" \
      --option_type Put --qty 1 --strike_total 1 --premium_total 1 --expiry "$exp"
  else
    fail CAP_FAIL_WRITER_LIMIT "not checked: maker2 is not at the cap (writer_open_count = ${w1:-unreadable})"
  fi
  cap_cleanup
  trap - EXIT
  w2="$(woc "$MAKER2")"
  if ((CAP_CANCEL_FAILED == 0)) && [[ "$w2" == "$w0" ]]; then
    pass CAP_CLEANUP "cancelled $CAP_CANCELLED dust offers; writer_open_count(maker2) back to $w2"
  else
    fail CAP_CLEANUP "cancelled $CAP_CANCELLED, failed $CAP_CANCEL_FAILED; writer_open_count(maker2) = ${w2:-unreadable}, wanted $w0"
  fi
}

# ---------- run ----------
section "Strata options smoke run on Stellar TESTNET ($(date -u +%FT%TZ))"
echo "options contract  $O"
echo "                  https://stellar.expert/explorer/testnet/contract/$O"
echo "USDx SAC (quote)  $USDX_SAC"
echo "RWA SAC           $RWA_SAC"
echo "BOND SAC          $BOND_SAC"
[[ $RUN_V13 == 0 ]] || echo "EQTY SAC          $EQTY_SAC (not in the constructor; listed in V1.3)"
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
expect_fail FAIL_ASSET_NOT_ALLOWED 103 AssetNotAllowed "$ID_MAKER1" create_offer --writer "$MAKER1" \
  --underlying "$USDX_SAC" --option_type Put --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" \
  --premium_total "$PUT_PREM" --expiry "$((NOW + 3600))"
expect_fail FAIL_INVALID_ARGS 102 InvalidArgs "$ID_MAKER1" create_offer --writer "$MAKER1" \
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

  GROUP=V1.2
  section "V1.2-1 holder transfer on RWA PUT (buy -> transfer to maker2 -> maker2 exercises)"
  transfer_path || echo "   transfer path stopped"
  section "V1.2-2 paged reads (get_options)"
  paging || echo "   paging checks stopped"
fi

if [[ $RUN_V13 == 1 ]]; then
  GROUP=V1.3
  section "V1.3-0 interface probe"
  if v13_probe; then
    section "V1.3-1 prune path, part 1: maker1 offer expiring in ${PRUNE_SECS}s that nobody buys"
    prune_create || echo "   prune path stopped"
    section "V1.3-2 permissionless listing of EQTY (list_asset; not in the constructor)"
    if v13_listing; then
      section "V1.3-3 EQTY: ContractNotAuthorized until the issuer authorizes the escrow, then a PUT settles"
      v13_eqty || echo "   EQTY path stopped"
    else
      fail V13_EQTY "skipped: EQTY is not listed, so no EQTY offer can exist"
    fi
    section "V1.3-4 tenor cap (MAX_TENOR = 2 years)"
    v13_tenor
    section "V1.3-5 prune_expired leaves a live offer alone"
    prune_live || echo "   live prune path stopped"
    section "V1.3-1 prune path, part 2: maker2 prunes maker1's expired offer"
    prune_finish || echo "   prune path stopped"
    section "V1.3-6 per-writer open cap (MAX_OPEN_PER_WRITER = 50)"
    if [[ $RUN_FULL == 1 ]]; then
      v13_writer_cap || echo "   writer-cap path stopped"
    else
      skip CAP_FILL "writer cap not exercised: run with --full (50 dust offers + 50 cancels, ~2 test XLM)"
    fi
  fi
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
[[ $RUN_P0PLUS != 1 ]] || require_ran V1.2 XFER_CREATE FAIL_XFER_OFFERED XFER_BUY FAIL_XFER_NOT_HOLDER FAIL_XFER_SELF \
  FAIL_XFER_TO_WRITER FAIL_XFER_NOT_ELIGIBLE XFER_TRANSFER XFER_EVENT XFER_TRANSFER_STATE XFER_TRANSFER_BAL \
  FAIL_XFER_OLD_HOLDER XFER_EXERCISE XFER_EXERCISE_BAL FAIL_XFER_AFTER_EXERCISE XFER_CLAIM XFER_CLAIM_BAL PAGE_FIRST3 \
  PAGE_PAST_END PAGE_CAP
[[ $RUN_V13 != 1 ]] || require_ran V1.3 V13_INTERFACE PRUNE_CREATE PRUNE_CREATE_WOC V13_LIST V13_IS_LISTED \
  V13_LIST_ASSETS V13_LIST_ASSETS_SEED V13_ASSET_COUNT V13_FAIL_ALREADY_LISTED V13_FAIL_LIST_QUOTE V13_FAIL_NOT_DEPLOYED \
  V13_FAIL_BAD_CODE V13_FAIL_ISSUER_NOT_ACCOUNT V13_FAIL_CONTRACT_NOT_AUTHORIZED V13_AUTHORIZE_EQTY \
  V13_ELIGIBLE_EQTY_contract V13_ELIGIBLE_EQTY_outsider V13_EQTY_PUT_CREATE V13_EQTY_PUT_BUY V13_EQTY_PUT_EXERCISE \
  V13_EQTY_PUT_CLAIM V13_EQTY_PUT_CLAIM_BAL V13_FAIL_TENOR V13_TENOR_INSIDE_SIM PRUNE_LIVE PRUNE_LIVE_RET \
  PRUNE_LIVE_STATE PRUNE_LIVE_BAL PRUNE_LIVE_CANCEL PRUNE_EXPIRED PRUNE_EVENT PRUNE_EXPIRED_RET PRUNE_EXPIRED_STATE \
  PRUNE_EXPIRED_BAL PRUNE_EXPIRED_WOC PRUNE_EXPIRED_OPEN PRUNE_AGAIN_RET PRUNE_FAIL_NOT_FOUND CAP_FILL
[[ $RUN_FULL != 1 ]] || require_ran V1.3 CAP_FAIL_WRITER_LIMIT CAP_OTHER_WRITER_SIM CAP_CLEANUP

section "SUMMARY"
printf '%-5s %-32s %-5s %s\n' GROUP CHECK RESULT DETAIL
for row in "${SUMMARY[@]}"; do
  IFS='|' read -r g l r d <<<"$row"
  printf '%-5s %-32s %-5s %s\n' "$g" "$l" "$r" "$d"
done
echo
verdict() { if ((NFAIL[$1] == 0)); then echo PASS; else echo FAIL; fi; }
echo "PRE: $(verdict PRE) (${NPASS[PRE]} passed, ${NFAIL[PRE]} failed)"
echo "P0:  $(verdict P0) (${NPASS[P0]} passed, ${NFAIL[P0]} failed)"
if [[ $RUN_P0PLUS == 1 ]]; then echo "P0+: $(verdict P0+) (${NPASS[P0+]} passed, ${NFAIL[P0+]} failed)"; else echo "P0+: not run (--p0-only)"; fi
if [[ $RUN_P0PLUS == 1 ]]; then echo "V1.2: $(verdict V1.2) (${NPASS[V1.2]} passed, ${NFAIL[V1.2]} failed)"; else echo "V1.2: not run (--p0-only)"; fi
if [[ $RUN_V13 == 1 ]]; then
  echo "V1.3: $(verdict V1.3) (${NPASS[V1.3]} passed, ${NFAIL[V1.3]} failed, ${NSKIP[V1.3]} skipped)"
else
  echo "V1.3: not run (--p0-only or --no-v13)"
fi
echo "log: $SMOKE_LOG"
total_fail=$((NFAIL[PRE] + NFAIL[P0] + NFAIL[P0+] + NFAIL[V1.2] + NFAIL[V1.3]))
exit $((total_fail > 0 ? 1 : 0))
