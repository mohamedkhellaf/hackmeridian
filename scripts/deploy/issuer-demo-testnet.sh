#!/usr/bin/env bash
# Record the issuer-action failure modes of contract-abi.md §6 on Stellar TESTNET with real transactions
# (test XLM fees only). Fictional RWA/BOND/USDx assets; strata-rwa-issuer is the RWA/BOND SAC admin.
#
#   scripts/deploy/issuer-demo-testnet.sh                 # part A (main contract) then part B (throwaway instance)
#   scripts/deploy/issuer-demo-testnet.sh --part-a-only   # reversible steps on OPTIONS_ID only
#   scripts/deploy/issuer-demo-testnet.sh --part-b-only   # throwaway deploy + clawback only
#   scripts/deploy/issuer-demo-testnet.sh --wasm <path>   # part B deploys this wasm instead of building one
#
# Part A, on the main contract OPTIONS_ID (every issuer action is undone in the same run):
#   A1 holder frozen on RWA  -> exercise fails with SAC Error(Contract, #11); unfreeze -> exercise + claim succeed
#   A2 contract de-authorized on RWA -> buy fails with #105 ContractNotAuthorized; cancel_offer (USDx) still works
#   A3 writer frozen on RWA  -> holder still exercises and is paid; claim_delivery fails with SAC #11 until unfrozen
# Part B, on a THROWAWAY instance deployed with `deploy.sh --throwaway` (never the main id):
#   issuer claws back 1 RWA from the contract -> open_collateral(RWA) > balance(contract); buy and a new RWA
#   create_offer fail with #115 CollateralShortfall; a BOND offer still works; issuer repairs by sending 1 RWA back
#   to the contract (SAC transfer from the issuer, mint as fallback) -> buy succeeds.
# CLAWBACK IS NEVER RUN AGAINST THE MAIN DEMO CONTRACT: the pooled deficit is permanent until the issuer repairs it.
#
# Expected failures are simulated with --send=no (no fee, no state change) and pass only with the exact error code.
# Every submitted transaction prints "TX <label> <hash>" and is appended to scripts/out/tx-log.tsv; the full output
# is saved to scripts/out/issuer-demo-<UTC time>.log. Whatever happens, the script ends by re-authorizing investor,
# maker1, maker2 and the contracts on RWA (EXIT trap) and cancelling any offer it left open on the main contract.
# Exit status is 0 only if every check passed.
set -uo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar jq curl

RUN_A=1
RUN_B=1
WASM_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --part-a-only)
      RUN_B=0
      shift
      ;;
    --part-b-only)
      RUN_A=0
      shift
      ;;
    --wasm)
      [[ $# -ge 2 ]] || die "--wasm needs a path"
      WASM_ARGS=(--wasm "$2")
      shift 2
      ;;
    -h | --help)
      sed -n '2,26p' "$0"
      exit 0
      ;;
    *) die "unknown argument: $1 (usage: $0 [--part-a-only|--part-b-only] [--wasm <path>])" ;;
  esac
done
((RUN_A + RUN_B > 0)) || die "--part-a-only and --part-b-only together run nothing"
[[ "${DRY_RUN:-0}" != 1 ]] || die "DRY_RUN is not supported: this script only makes sense with real transactions"

load_env
require_vars OPTIONS_ID USDX_SAC RWA_SAC BOND_SAC MAKER1 MAKER2 INVESTOR RWA_ISSUER
is_contract_id "$OPTIONS_ID" || die "OPTIONS_ID='$OPTIONS_ID' is not a contract id; run scripts/deploy/deploy.sh first"
for i in "$ID_RWA_ISSUER" "$ID_MAKER1" "$ID_MAKER2" "$ID_INVESTOR" "$ID_DEPLOYER"; do
  stellar keys address "$i" >/dev/null 2>&1 || die "identity $i missing from the CLI keystore"
done
MAIN="$OPTIONS_ID" # main demo contract: reversible actions only, never clawback
T=""               # throwaway instance (part B)
O="$MAIN"          # contract targeted by send / expect_fail

mkdir -p "$OUT_DIR"
DEMO_LOG="$OUT_DIR/issuer-demo-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$DEMO_LOG") 2>&1

# Amounts are 7-decimal integer units (1 token = 10_000_000).
PUT_QTY=20000000      # 2 RWA
PUT_STRIKE=200000000  # 20 USDx total strike
PUT_PREM=5000000      # 0.5 USDx total premium
CALL_QTY=30000000     # 3 RWA locked in the throwaway contract
CALL_STRIKE=300000000 # 30 USDx
CALL_PREM=5000000     # 0.5 USDx
CLAW=10000000         # 1 RWA clawed back from the throwaway contract, then repaid

# ---------- results ----------
GROUPS_ORDER=(PRE A1 A2 A3 B CLEANUP)
declare -A NPASS=() NFAIL=()
for g in "${GROUPS_ORDER[@]}"; do
  NPASS[$g]=0
  NFAIL[$g]=0
done
GROUP=PRE
SUMMARY=()
TXS=()
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
# diag_errors <stderr>: the diagnostic "topics:[error, ...]" lines (the SAC's message, e.g. "balance is deauthorized").
diag_errors() { grep -E 'topics:\[error' <<<"$1" | head -3 | sed -E 's/^[[:space:]]*//' | cut -c1-300; }
# err_text <stderr> <code>: 'Error(Contract, #<code>) "<message>"', the message taken from the innermost (oldest)
# diagnostic event with that code, e.g. the SAC's "balance is deauthorized"; host "escalating ..." notes are skipped.
err_text() {
  local m
  m="$(grep -oE "topics:\[error, Error\(Contract, #$2\)\], data:\"[^\"]*\"" <<<"$1" | sed -E 's/.*data://' |
    grep -v '^"escalating' | tail -1 || true)"
  printf 'Error(Contract, #%s)%s' "$2" "${m:+ $m}"
}

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

# submit <contract> <label> <identity> <fn> [args...]: simulate, sign and submit; no PASS/FAIL accounting.
# Sets RESULT (return value) and SUBMIT_MSG (error line on failure). Returns the CLI status.
submit() {
  local c="$1" label="$2" who="$3"
  shift 3
  RESULT=""
  SUBMIT_MSG=""
  echo "-> [$label] as $who on $c: $*"
  if inv "$c" "$who" yes "$@"; then
    RESULT="$(printf '%s\n' "$OUT" | sed '/^$/d' | tail -1)"
    echo "   TX $label $HASH  (return: ${RESULT:-void})"
    echo "   https://stellar.expert/explorer/testnet/tx/$HASH"
    grep -E 'Event:' <<<"$ERR" | sed 's/^/   /' | cut -c1-300
    if [[ -z "$HASH" ]]; then
      SUBMIT_MSG="CLI reported success but printed no tx hash"
      return 1
    fi
    TXS+=("$GROUP $label $HASH")
    printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "ISSUER_DEMO_$label" "$HASH" ok >>"$TX_LOG"
    return 0
  fi
  SUBMIT_MSG="$(err_line "$ERR")"
  echo "   FAILED $label (tx ${HASH:-not signed}): $SUBMIT_MSG"
  printf '%s\n' "$ERR" | head -20 | sed 's/^/   | /'
  [[ -z "$HASH" ]] || printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "ISSUER_DEMO_$label" "$HASH" failed >>"$TX_LOG"
  return 1
}

# send_to <contract> <label> <identity> <fn> [args...]: submit with PASS/FAIL accounting.
send_to() {
  local label="$2"
  if submit "$@"; then
    pass "$label" "tx $HASH"
    return 0
  fi
  fail "$label" "tx ${HASH:-not sent}: $SUBMIT_MSG"
  return 1
}
send() { send_to "$O" "$@"; }
# issuer <label> <fn> [args...]: strata-rwa-issuer (SAC admin) calls the RWA SAC.
issuer() { send_to "$RWA_SAC" "$1" "$ID_RWA_ISSUER" "${@:2}"; }
set_auth() { issuer "$1" set_authorized --id "$2" --authorize "$3"; }

# expect_fail <label> <code> <name> <identity> <fn> [args...]: simulate only on $O; passes iff the call is rejected
# with Error(Contract, #<code>) (options contract codes 101+, SAC codes #10/#11/#13 surface unchanged).
expect_fail() {
  local label="$1" code="$2" name="$3" who="$4" got msg
  shift 4
  echo "-> [$label] expect $name (#$code); simulate as $who on $O: $*"
  if inv "$O" "$who" no "$@"; then
    echo "   UNEXPECTED SUCCESS; simulation returned: $(printf '%s\n' "$OUT" | tail -1)"
    fail "$label" "simulation succeeded; wanted $name #$code"
    return 1
  fi
  got="$(grep -oE 'Error\(Contract, #[0-9]+\)' <<<"$ERR" | head -1 || true)"
  msg="$(err_line "$ERR")"
  echo "   $msg"
  diag_errors "$ERR" | sed 's/^/   | /'
  if [[ "$got" == "Error(Contract, #$code)" ]]; then
    pass "$label" "simulation rejected: $(err_text "$ERR" "$code") = $name"
    return 0
  fi
  printf '%s\n' "$ERR" | head -12 | sed 's/^/   | /'
  fail "$label" "wanted Error(Contract, #$code) $name, got: ${got:-$msg}"
  return 1
}

# ---------- reads and checks ----------
OPT_JSON=""
show_option() {
  OPT_JSON="$(view "$O" get_option --id "$1")" || {
    echo "   get_option($1) failed"
    return 1
  }
  echo "   get_option($1) = $(jq -c . <<<"$OPT_JSON" 2>/dev/null || echo "$OPT_JSON")"
}
opt_state() { jq -r '.state | if type == "string" then . elif type == "object" then (keys[0]) else tostring end' <<<"$1" 2>/dev/null; }
# expect_state <label> <id> <State>
expect_state() {
  local st
  show_option "$2" || {
    fail "$1" "get_option($2) failed"
    return 1
  }
  st="$(opt_state "$OPT_JSON")"
  if [[ "$st" == "$3" ]]; then
    pass "$1" "#$2 state=$st"
    return 0
  fi
  fail "$1" "#$2 state=$st, wanted $3"
  return 1
}
# expect_eligible <label> <token SAC> <symbol> <who-name> <address> <true|false>: is_eligible on $O.
expect_eligible() {
  local got
  got="$(view "$O" is_eligible --token "$2" --who "$5")"
  echo "   is_eligible($3, $4) = ${got:-ERR}"
  if [[ "$got" == "$6" ]]; then
    pass "$1" "is_eligible($3, $4)=$got"
    return 0
  fi
  fail "$1" "is_eligible($3, $4)=${got:-ERR}, wanted $6"
  return 1
}
# collateral <contract> <token SAC>: sets OC (open_collateral) and BAL (SAC balance of the contract).
collateral() {
  OC="$(view "$1" open_collateral --token "$2" | num)"
  BAL="$(view "$2" balance --id "$1" | num)"
}
bal() { view "$1" balance --id "$2" | num; }
new_id() { # new_id <label>: RESULT must be a u32 option id
  if [[ "$RESULT" =~ ^[0-9]+$ ]]; then return 0; fi
  fail "$1" "create_offer returned '$RESULT', not a u32 id"
  return 1
}

# ---------- cleanup ----------
MAIN_OFFERS=() # "<id>:<identity>:<G>" for every offer this run created on the main contract
# restore_auth: every account / contract this script may de-authorize must end authorized on RWA.
restore_auth() {
  local spec name addr now
  local -a specs=("investor:$INVESTOR" "maker1:$MAKER1" "maker2:$MAKER2" "main_contract:$MAIN")
  [[ -z "$T" ]] || specs+=("throwaway_contract:$T")
  for spec in "${specs[@]}"; do
    name="${spec%%:*}"
    addr="${spec#*:}"
    now="$(view "$RWA_SAC" authorized --id "$addr")"
    if [[ "$now" == true ]]; then
      echo "   RWA authorized($name) = true"
      pass "${GROUP}_AUTH_${name^^}" "RWA authorized($name)=true"
      continue
    fi
    echo "   RWA authorized($name) = ${now:-ERR}: re-authorizing"
    set_auth "RESTORE_AUTH_${name^^}" "$addr" true
    now="$(view "$RWA_SAC" authorized --id "$addr")"
    if [[ "$now" == true ]]; then pass "RESTORE_CHECK_${name^^}" "RWA authorized($name)=true"; else fail "RESTORE_CHECK_${name^^}" "RWA authorized($name)=${now:-ERR}"; fi
  done
}
# cancel_leftovers: cancel any offer this run created on the main contract that is still Offered.
cancel_leftovers() {
  local spec id who g st json
  for spec in "${MAIN_OFFERS[@]}"; do
    IFS=: read -r id who g <<<"$spec"
    json="$(view "$MAIN" get_option --id "$id")" || continue
    st="$(opt_state "$json")"
    [[ "$st" == Offered ]] || continue
    echo "   main #$id still Offered: cancelling"
    send_to "$MAIN" "CLEANUP_CANCEL_$id" "$who" cancel_offer --writer "$g" --id "$id"
  done
}
CLEANED=0
cleanup() {
  ((CLEANED == 0)) || return 0
  CLEANED=1
  GROUP=CLEANUP
  section "CLEANUP: re-authorize everyone on RWA, cancel leftover offers on the main contract"
  restore_auth
  cancel_leftovers
}
trap 'cleanup' EXIT
trap 'echo "interrupted"; exit 130' INT TERM

# ---------- run ----------
section "Strata issuer-action demo on Stellar TESTNET ($(date -u +%FT%TZ))"
echo "main options contract  $MAIN   (part A: reversible actions only)"
echo "                       https://stellar.expert/explorer/testnet/contract/$MAIN"
echo "RWA SAC $RWA_SAC | BOND SAC $BOND_SAC | USDx SAC $USDX_SAC"
echo "RWA issuer (SAC admin) $RWA_ISSUER"
echo "maker1 $MAKER1 | maker2 $MAKER2 | investor $INVESTOR"
echo "log file               $DEMO_LOG"

section "PRE: baseline (everyone authorized on RWA, no deficit on the main contract)"
restore_auth
echo "   config = $(view "$MAIN" config)"
for tok in "RWA:$RWA_SAC" "USDx:$USDX_SAC"; do
  collateral "$MAIN" "${tok#*:}"
  echo "   main ${tok%%:*}: open_collateral=$OC balance=$BAL"
  if [[ "$OC" =~ ^[0-9]+$ && "$BAL" =~ ^[0-9]+$ ]] && ((BAL >= OC)); then
    pass "PRE_NO_DEFICIT_${tok%%:*}" "open_collateral=$OC <= balance=$BAL"
  else
    fail "PRE_NO_DEFICIT_${tok%%:*}" "open_collateral=$OC balance=$BAL"
  fi
done

# a1_holder_frozen: maker1 PUT on RWA, investor buys, issuer freezes investor, exercise fails (SAC #11),
# issuer unfreezes, exercise and claim succeed.
a1_holder_frozen() {
  local id exp
  exp=$(($(date +%s) + 3600))
  send A1_CREATE "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$RWA_SAC" --option_type Put \
    --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" --premium_total "$PUT_PREM" --expiry "$exp" || return 1
  new_id A1_CREATE_ID || return 1
  id="$RESULT"
  MAIN_OFFERS+=("$id:$ID_MAKER1:$MAKER1")
  echo "   option #$id: PUT 2 RWA, strike_total 20 USDx, premium 0.5 USDx, writer maker1"
  send A1_BUY "$ID_INVESTOR" buy --buyer "$INVESTOR" --id "$id" || return 1
  expect_state A1_BUY_STATE "$id" Active || return 1
  set_auth A1_ISSUER_FREEZE_INVESTOR "$INVESTOR" false || return 1
  expect_eligible A1_INVESTOR_INELIGIBLE "$RWA_SAC" RWA investor "$INVESTOR" false
  expect_fail A1_FAIL_EXERCISE_FROZEN_HOLDER 11 "SAC balance deauthorized" "$ID_INVESTOR" \
    exercise --holder "$INVESTOR" --id "$id"
  set_auth A1_ISSUER_UNFREEZE_INVESTOR "$INVESTOR" true || return 1
  expect_eligible A1_INVESTOR_ELIGIBLE_AGAIN "$RWA_SAC" RWA investor "$INVESTOR" true
  send A1_EXERCISE "$ID_INVESTOR" exercise --holder "$INVESTOR" --id "$id" || return 1
  expect_state A1_EXERCISE_STATE "$id" Exercised || return 1
  send A1_CLAIM "$ID_MAKER1" claim_delivery --writer "$MAKER1" --id "$id" || return 1
  expect_state A1_CLAIM_STATE "$id" Settled
}

# a2_contract_deauthorized: maker1 PUT on RWA, issuer de-authorizes the contract, buy fails (#105),
# cancel_offer still returns the USDx collateral, issuer re-authorizes the contract.
a2_contract_deauthorized() {
  local id exp before after
  exp=$(($(date +%s) + 3600))
  before="$(bal "$USDX_SAC" "$MAKER1")"
  send A2_CREATE "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$RWA_SAC" --option_type Put \
    --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" --premium_total "$PUT_PREM" --expiry "$exp" || return 1
  new_id A2_CREATE_ID || return 1
  id="$RESULT"
  MAIN_OFFERS+=("$id:$ID_MAKER1:$MAKER1")
  echo "   option #$id: PUT 2 RWA, strike_total 20 USDx (collateral in USDx), writer maker1"
  set_auth A2_ISSUER_DEAUTH_CONTRACT "$MAIN" false || return 1
  expect_eligible A2_CONTRACT_INELIGIBLE "$RWA_SAC" RWA main_contract "$MAIN" false
  expect_fail A2_FAIL_BUY_CONTRACT_DEAUTH 105 ContractNotAuthorized "$ID_INVESTOR" buy --buyer "$INVESTOR" --id "$id"
  send A2_CANCEL "$ID_MAKER1" cancel_offer --writer "$MAKER1" --id "$id"
  expect_state A2_CANCEL_STATE "$id" Cancelled
  after="$(bal "$USDX_SAC" "$MAKER1")"
  if [[ "$before" =~ ^[0-9]+$ && "$after" == "$before" ]]; then
    pass A2_COLLATERAL_BACK "maker1 USDx $before before create_offer, $after after cancel_offer"
  else
    fail A2_COLLATERAL_BACK "maker1 USDx $before before create_offer, $after after cancel_offer"
  fi
  set_auth A2_ISSUER_REAUTH_CONTRACT "$MAIN" true || return 1
  expect_eligible A2_CONTRACT_ELIGIBLE_AGAIN "$RWA_SAC" RWA main_contract "$MAIN" true
}

# a3_writer_frozen: maker2 PUT on RWA, investor buys, issuer freezes maker2, investor exercises and is paid,
# maker2 claim_delivery fails (SAC #11), issuer unfreezes maker2, claim succeeds.
a3_writer_frozen() {
  local id exp q0 u0 q1 u1
  exp=$(($(date +%s) + 3600))
  send A3_CREATE "$ID_MAKER2" create_offer --writer "$MAKER2" --underlying "$RWA_SAC" --option_type Put \
    --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" --premium_total "$PUT_PREM" --expiry "$exp" || return 1
  new_id A3_CREATE_ID || return 1
  id="$RESULT"
  MAIN_OFFERS+=("$id:$ID_MAKER2:$MAKER2")
  echo "   option #$id: PUT 2 RWA, strike_total 20 USDx, premium 0.5 USDx, writer maker2"
  send A3_BUY "$ID_INVESTOR" buy --buyer "$INVESTOR" --id "$id" || return 1
  expect_state A3_BUY_STATE "$id" Active || return 1
  set_auth A3_ISSUER_FREEZE_WRITER "$MAKER2" false || return 1
  expect_eligible A3_WRITER_INELIGIBLE "$RWA_SAC" RWA maker2 "$MAKER2" false
  q0="$(bal "$USDX_SAC" "$INVESTOR")"
  u0="$(bal "$RWA_SAC" "$INVESTOR")"
  send A3_EXERCISE_WRITER_FROZEN "$ID_INVESTOR" exercise --holder "$INVESTOR" --id "$id" || return 1
  expect_state A3_EXERCISE_STATE "$id" Exercised || return 1
  q1="$(bal "$USDX_SAC" "$INVESTOR")"
  u1="$(bal "$RWA_SAC" "$INVESTOR")"
  echo "   investor USDx $q0 -> $q1, RWA $u0 -> $u1"
  if [[ "$q0$q1$u0$u1" =~ ^[0-9]+$ ]] && ((q1 - q0 == PUT_STRIKE && u0 - u1 == PUT_QTY)); then
    pass A3_HOLDER_PAID "holder received +$PUT_STRIKE USDx units and delivered $PUT_QTY RWA units while the writer was frozen"
  else
    fail A3_HOLDER_PAID "investor USDx $q0 -> $q1, RWA $u0 -> $u1; wanted +$PUT_STRIKE USDx, -$PUT_QTY RWA"
  fi
  expect_fail A3_FAIL_CLAIM_FROZEN_WRITER 11 "SAC balance deauthorized" "$ID_MAKER2" \
    claim_delivery --writer "$MAKER2" --id "$id"
  set_auth A3_ISSUER_UNFREEZE_WRITER "$MAKER2" true || return 1
  send A3_CLAIM "$ID_MAKER2" claim_delivery --writer "$MAKER2" --id "$id" || return 1
  expect_state A3_CLAIM_STATE "$id" Settled
}

REPAIR_METHOD=""
# part_b_clawback: deploy a throwaway instance, CALL on RWA, clawback 1 RWA from the contract, #115 guards,
# BOND still works, issuer repairs, buy succeeds.
part_b_clawback() {
  local prev env_t idc idb exp dlog l h
  prev="${THROWAWAY_OPTIONS_ID:-}"
  dlog="$(mktemp)"
  echo "-> deploying a throwaway instance: scripts/deploy/deploy.sh --throwaway ${WASM_ARGS[*]}"
  if ! "$SCRIPTS_DIR/deploy/deploy.sh" --throwaway "${WASM_ARGS[@]}" 2>&1 | tee "$dlog"; then
    rm -f "$dlog"
    fail B_DEPLOY_THROWAWAY "deploy.sh --throwaway failed"
    return 1
  fi
  # deploy.sh prints "TX <label> <hash>" for the wasm upload, the deploy and the two set_authorized calls
  while read -r _ l h; do TXS+=("B $l $h"); done < <(grep -E '^TX [A-Z_]+ [0-9a-f]{64}$' "$dlog")
  rm -f "$dlog"
  env_t="$(grep -E '^THROWAWAY_OPTIONS_ID=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
  if ! is_contract_id "$env_t" || [[ "$env_t" == "$prev" || "$env_t" == "$MAIN" ]]; then
    fail B_DEPLOY_THROWAWAY "no new THROWAWAY_OPTIONS_ID in $ENV_FILE (got '$env_t', previous '$prev', main '$MAIN')"
    return 1
  fi
  T="$env_t"
  O="$T"
  pass B_DEPLOY_THROWAWAY "throwaway $T (deploy tx $(grep -E '^THROWAWAY_DEPLOY_TX=' "$ENV_FILE" | cut -d= -f2))"
  echo "   throwaway instance $T"
  echo "   https://stellar.expert/explorer/testnet/contract/$T"
  expect_eligible B_THROWAWAY_AUTHORIZED_RWA "$RWA_SAC" RWA throwaway "$T" true || return 1

  exp=$(($(date +%s) + 3600))
  send B_CALL_CREATE "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$RWA_SAC" --option_type Call \
    --qty "$CALL_QTY" --strike_total "$CALL_STRIKE" --premium_total "$CALL_PREM" --expiry "$exp" || return 1
  new_id B_CALL_CREATE_ID || return 1
  idc="$RESULT"
  echo "   throwaway option #$idc: covered CALL 3 RWA (collateral 3 RWA in the contract), strike_total 30 USDx"
  collateral "$T" "$RWA_SAC"
  echo "   RWA: open_collateral=$OC balance(throwaway)=$BAL"
  if [[ "$OC" == "$CALL_QTY" && "$BAL" == "$CALL_QTY" ]]; then pass B_COLLATERAL_FULL "open_collateral=$OC balance=$BAL"; else fail B_COLLATERAL_FULL "open_collateral=$OC balance=$BAL, wanted $CALL_QTY each"; fi

  # The one irreversible issuer action of this script, guarded to the throwaway instance.
  if [[ "$T" == "$MAIN" || "$T" == "$OPTIONS_ID" ]]; then
    fail B_ISSUER_CLAWBACK "refusing to claw back from the main contract"
    return 1
  fi
  issuer B_ISSUER_CLAWBACK clawback --from "$T" --amount "$CLAW" || return 1
  collateral "$T" "$RWA_SAC"
  echo "   RWA after clawback: open_collateral=$OC balance(throwaway)=$BAL"
  if [[ "$OC" =~ ^[0-9]+$ && "$BAL" =~ ^[0-9]+$ ]] && ((OC > BAL && OC - BAL == CLAW)); then
    pass B_DEFICIT_VISIBLE "open_collateral(RWA)=$OC > balance(throwaway)=$BAL (deficit $((OC - BAL)))"
  else
    fail B_DEFICIT_VISIBLE "open_collateral(RWA)=$OC balance(throwaway)=$BAL; wanted a deficit of $CLAW"
  fi
  expect_fail B_FAIL_BUY_SHORTFALL 115 CollateralShortfall "$ID_INVESTOR" buy --buyer "$INVESTOR" --id "$idc"
  expect_fail B_FAIL_CREATE_SHORTFALL 115 CollateralShortfall "$ID_MAKER2" create_offer --writer "$MAKER2" \
    --underlying "$RWA_SAC" --option_type Call --qty "$CLAW" --strike_total 100000000 --premium_total 1000000 \
    --expiry "$exp"
  send B_BOND_PUT_CREATE "$ID_MAKER1" create_offer --writer "$MAKER1" --underlying "$BOND_SAC" --option_type Put \
    --qty "$PUT_QTY" --strike_total "$PUT_STRIKE" --premium_total "$PUT_PREM" --expiry "$exp"
  idb="$RESULT"

  echo "   issuer repairs the pooled RWA balance: SAC transfer of 1 RWA from the issuer to the throwaway contract"
  if submit "$RWA_SAC" B_ISSUER_REPAIR_TRANSFER "$ID_RWA_ISSUER" transfer --from "$RWA_ISSUER" --to "$T" --amount "$CLAW"; then
    REPAIR_METHOD="transfer"
    pass B_ISSUER_REPAIR "SAC transfer from the issuer (mints) tx $HASH"
  else
    echo "   SAC transfer from the issuer refused ($SUBMIT_MSG); trying mint as SAC admin"
    if submit "$RWA_SAC" B_ISSUER_REPAIR_MINT "$ID_RWA_ISSUER" mint --to "$T" --amount "$CLAW"; then
      REPAIR_METHOD="mint (transfer refused: $SUBMIT_MSG)"
      pass B_ISSUER_REPAIR "SAC mint tx $HASH (transfer was refused)"
    else
      fail B_ISSUER_REPAIR "transfer and mint both failed: $SUBMIT_MSG"
      return 1
    fi
  fi
  collateral "$T" "$RWA_SAC"
  echo "   RWA after repair: open_collateral=$OC balance(throwaway)=$BAL"
  if [[ "$OC" =~ ^[0-9]+$ && "$BAL" =~ ^[0-9]+$ ]] && ((BAL >= OC)); then pass B_DEFICIT_REPAIRED "open_collateral=$OC balance=$BAL"; else fail B_DEFICIT_REPAIRED "open_collateral=$OC balance=$BAL"; fi
  send B_BUY_AFTER_REPAIR "$ID_INVESTOR" buy --buyer "$INVESTOR" --id "$idc" || return 1
  expect_state B_BUY_AFTER_REPAIR_STATE "$idc" Active
  if [[ "$idb" =~ ^[0-9]+$ ]]; then
    echo "   tidy up: maker1 withdraws the BOND PUT offer (returns its USDx collateral)"
    send B_BOND_PUT_CANCEL "$ID_MAKER1" cancel_offer --writer "$MAKER1" --id "$idb"
  fi
}

if [[ $RUN_A == 1 ]]; then
  GROUP=A1
  section "A1 issuer freezes the HOLDER on RWA: exercise blocked until unfrozen (main contract)"
  a1_holder_frozen || echo "   A1 stopped"
  GROUP=A2
  section "A2 issuer de-authorizes the CONTRACT on RWA: buy blocked, cancel still works (main contract)"
  a2_contract_deauthorized || echo "   A2 stopped"
  GROUP=A3
  section "A3 issuer freezes the WRITER on RWA: holder still paid, claim blocked until unfrozen (main contract)"
  a3_writer_frozen || echo "   A3 stopped"
fi
if [[ $RUN_B == 1 ]]; then
  GROUP=B
  section "B issuer clawback from a THROWAWAY instance: deficit, #115 guards, repair"
  part_b_clawback || echo "   B stopped"
  O="$MAIN"
fi

cleanup

# Every required check must have run (a stopped path leaves its later checks unreached).
require_ran() {
  local g="$1" l
  shift
  for l in "$@"; do
    printf '%s\n' "${SUMMARY[@]}" | grep -q "^$g|$l|" && continue
    GROUP="$g" fail "$l" "not reached (an earlier step of its path failed)"
  done
}
if [[ $RUN_A == 1 ]]; then
  require_ran A1 A1_FAIL_EXERCISE_FROZEN_HOLDER A1_EXERCISE A1_CLAIM A1_CLAIM_STATE
  require_ran A2 A2_FAIL_BUY_CONTRACT_DEAUTH A2_CANCEL A2_CONTRACT_ELIGIBLE_AGAIN
  require_ran A3 A3_HOLDER_PAID A3_FAIL_CLAIM_FROZEN_WRITER A3_CLAIM A3_CLAIM_STATE
fi
[[ $RUN_B != 1 ]] || require_ran B B_ISSUER_CLAWBACK B_DEFICIT_VISIBLE B_FAIL_BUY_SHORTFALL B_FAIL_CREATE_SHORTFALL \
  B_BOND_PUT_CREATE B_ISSUER_REPAIR B_DEFICIT_REPAIRED B_BUY_AFTER_REPAIR

section "SUMMARY"
printf '%-7s %-34s %-5s %s\n' GROUP CHECK RESULT DETAIL
for row in "${SUMMARY[@]}"; do
  IFS='|' read -r g l r d <<<"$row"
  printf '%-7s %-34s %-5s %s\n' "$g" "$l" "$r" "$d"
done
echo
echo "Submitted transactions:"
for t in "${TXS[@]}"; do printf '   %s\n' "$t"; done
[[ -z "$T" ]] || echo "throwaway contract: $T"

[[ -z "$REPAIR_METHOD" ]] || echo "repair method: $REPAIR_METHOD"
echo
total_fail=0
for g in "${GROUPS_ORDER[@]}"; do
  ((NPASS[$g] + NFAIL[$g] > 0)) || continue
  if ((NFAIL[$g] == 0)); then v=PASS; else v=FAIL; fi
  printf '%-8s %s (%d passed, %d failed)\n' "$g:" "$v" "${NPASS[$g]}" "${NFAIL[$g]}"
  total_fail=$((total_fail + NFAIL[$g]))
done
echo "log: $DEMO_LOG"
exit $((total_fail > 0 ? 1 : 0))
