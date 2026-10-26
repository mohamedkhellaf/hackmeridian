#!/usr/bin/env bash
# Evidence run for the EXPERIMENTAL Strata Pro contract on Stellar TESTNET (brief docs/pro-v0-brief-dev2.md §8).
# Real transactions (test XLM fees, fictional USDx). Every tx hash is printed as "TX <STEP> <hash>", appended to
# scripts/out/tx-log.tsv and to the "| op | tx hash |" table in docs/pro-testnet-evidence.md.
#
#   scripts/deploy/pro-demo.sh [--expiry-minutes 15] [--settlement-price 175] [--skip-funding]
#
# Sequence (one short-dated series so settlement happens inside the run; amounts verified against
# packages/risk/pro_v0_model.py, see docs/pro-testnet-runbook.md):
#   0. USDx trustlines + funding of maker/holder/lp from strata-usdx-issuer; LP seeds the vault (lp_deposit, TEAM capital)
#   1. list_series  strike 110 USDx, expiry now + 15 min      (admin)
#   2. publish_risk spot 100                                   (publisher)   mark ~0 at this tenor
#   3. deposit 850 USDx                                        (maker)
#   4. create_offer A and B, qty 10 each, premium max(mark*qty*1.1, 1 USDx/lot)  (maker)
#   5. buy A, buy B                                            (holder)
#   6. publish_risk spot 112 -> exercise A within 120 s        (publisher, holder)  maker healthy: pays 10 x 2 USDx
#   7. publish_risk spot 160 -> maker NLV < MM -> liquidate(maker, taker=vault)  (publisher, keeper)
#   8. wait for expiry; publish_settlement 175; settle(book B); settle_vault; claim(B)  (publisher, keeper, holder)
# Needs PRO_ID in scripts/out/testnet.env (written by deploy-pro.sh) and the strata-pro-* + strata-usdx-issuer identities.
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar jq curl python3

EXPIRY_MIN=15
SETTLE_PRICE_USDX=175
SKIP_FUNDING=0
while (($# > 0)); do
  case "$1" in
    --expiry-minutes)
      EXPIRY_MIN="${2:?--expiry-minutes needs a value}"
      shift 2
      ;;
    --settlement-price)
      SETTLE_PRICE_USDX="${2:?--settlement-price needs a value}"
      shift 2
      ;;
    --skip-funding)
      SKIP_FUNDING=1
      shift
      ;;
    -h | --help)
      sed -n '2,19p' "$0"
      exit 0
      ;;
    *) die "unknown argument: $1" ;;
  esac
done
[[ "$EXPIRY_MIN" =~ ^[0-9]+$ ]] && ((EXPIRY_MIN >= 8)) || die "--expiry-minutes must be an integer >= 8 (steps 1-7 take several minutes)"
[[ "$SETTLE_PRICE_USDX" =~ ^[0-9]+$ ]] || die "--settlement-price must be a whole number of USDx"

load_env
require_vars PRO_ID USDX_ISSUER
is_contract_id "$PRO_ID" || die "PRO_ID='$PRO_ID' is not a contract id; run scripts/deploy/deploy-pro.sh first"
PRO="$PRO_ID"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
SNAPSHOT_PY="$SCRIPTS_DIR/deploy/pro-snapshot.py"
EVIDENCE_MD="$REPO_ROOT/docs/pro-testnet-evidence.md"

ID_ADMIN=strata-pro-admin
ID_PUBLISHER=strata-pro-publisher
ID_KEEPER=strata-pro-keeper
ID_MAKER=strata-pro-maker
ID_HOLDER=strata-pro-holder
ID_LP=strata-pro-lp
for id in $ID_ADMIN $ID_PUBLISHER $ID_KEEPER $ID_MAKER $ID_HOLDER $ID_LP $ID_USDX_ISSUER; do
  stellar keys address "$id" >/dev/null 2>&1 || die "identity $id missing; run scripts/deploy/deploy-pro.sh (and setup-testnet/01-identities.sh for the issuer)"
done
ADMIN_G="$(pubkey $ID_ADMIN)"
PUBLISHER_G="$(pubkey $ID_PUBLISHER)"
KEEPER_G="$(pubkey $ID_KEEPER)"
MAKER_G="$(pubkey $ID_MAKER)"
HOLDER_G="$(pubkey $ID_HOLDER)"
LP_G="$(pubkey $ID_LP)"
[[ "$(pubkey "$ID_USDX_ISSUER")" == "$USDX_ISSUER" ]] || die "$ID_USDX_ISSUER is not USDX_ISSUER=$USDX_ISSUER"
USDX_ASSET="USDx:$USDX_ISSUER"

# ---------- amounts (7-decimal units; all fictional USDx) ----------
STRIKE_USDX=110
STRIKE=$((STRIKE_USDX * UNIT))
QTY=10                          # lots per offer
LP_SEED=$((2000 * UNIT))        # TEAM seed capital for the vault
MAKER_DEPOSIT=$((850 * UNIT))   # healthy at spot 112 (NLV >= MM), liquidatable at spot 160 (NLV < MM)
PREMIUM_FLOOR_PER_LOT=$UNIT     # 1 USDx per lot when the mark rounds to 0 at this tenor
FUND_MAKER=1000
FUND_HOLDER=500
FUND_LP=5000
SPOT_OPEN=100
SPOT_EXERCISE=112
SPOT_GAP=160

mkdir -p "$OUT_DIR"
DEMO_LOG="$OUT_DIR/pro-demo-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$DEMO_LOG") 2>&1
log "Strata Pro evidence run on TESTNET; contract $PRO; log $DEMO_LOG"

# ---------- helpers ----------
step() { printf '\n===== %s =====\n' "$*"; }

ledger_time() {
  curl -s -m 10 -X POST "$RPC_URL" -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' | jq -r '.result.latestLedgerCloseTime // 0' 2>/dev/null
}
# Snapshot ts: a few seconds behind the local clock so `ts > ledger now` (StaleSnapshot) cannot happen on a fast clock.
snap_ts() { echo $(($(date +%s) - 10)); }

EVIDENCE_ROWS=()
record() { # record <op> <hash>
  EVIDENCE_ROWS+=("| $1 | \`$2\` |")
}

# invoke <LABEL> <identity> <fn> [args...]: submits a tx via run_tx, records the hash, sets RESULT to the CLI's
# last output line (the return value: an integer id or a JSON struct).
RESULT=""
invoke() {
  local label="$1" who="$2"
  shift 2
  run_tx "$label" stellar contract invoke --id "$PRO" --network "$NETWORK" --source-account "$who" -- "$@" ||
    die "$label failed ($*). See $DEMO_LOG; error codes: contracts/pro/src/lib.rs"
  # The return value is the last stdout line shaped like a JSON value (CLI logs are prefixed with emoji/words).
  RESULT="$(grep -E '^([0-9]+|-[0-9]+|\{.*\}|\[.*\]|".*"|null|true|false)$' <<<"$RUN_TX_OUTPUT" | tail -1 || true)"
  record "$label" "${LAST_TX_HASH:-unknown}"
  log "$label -> $RESULT"
}
# view <fn> [args...]: simulation only (--send=no), never fails the run.
view() {
  local out
  if out="$(stellar contract invoke --id "$PRO" --network "$NETWORK" --source-account "$ID_KEEPER" --send=no -- "$@" 2>/dev/null)"; then
    printf '   %s -> %s\n' "$1" "$(sed '/^$/d' <<<"$out" | tail -1)"
  else
    printf '   %s -> (read failed; argument encoding may differ, see runbook)\n' "$1"
  fi
}
# Writer enum for get_requirement. UNCONFIRMED CLI encoding: tried {"Account":"G..."} first, then ["Account","G..."].
req_of() {
  local g="$1" out
  out="$(view get_requirement --who "{\"Account\":\"$g\"}")"
  if grep -q 'read failed' <<<"$out"; then out="$(view get_requirement --who "[\"Account\",\"$g\"]")"; fi
  printf '%s\n' "$out"
}
publish() { # publish <seq> <spot>
  local snap
  snap="$(python3 "$SNAPSHOT_PY" --series-id "$SID" --strike "$STRIKE_USDX" --expiry "$EXPIRY" --spot "$2" --seq "$1" --now "$(snap_ts)")"
  echo "   snapshot: $snap"
  invoke "PRO_PUBLISH_RISK_$1" "$ID_PUBLISHER" publish_risk --publisher "$PUBLISHER_G" --snap "$snap"
  MARK="$(jq -r '.mark' <<<"$snap")"
}

finish_evidence() {
  ((${#EVIDENCE_ROWS[@]} > 0)) || return 0
  if [[ ! -f "$EVIDENCE_MD" ]]; then
    cat >"$EVIDENCE_MD" <<'EOH'
# Strata Pro (experimental): testnet evidence

Stellar **TESTNET ONLY**. Fictional assets (`USDx` quote token, fictional `EQTY` underlying label; cash-settled, no
underlying token exists). The risk publisher and the settlement price are **team-operated** (`strata-pro-publisher`),
not a market oracle; the vault is seeded with **team USDx**, not third-party liquidity. Nothing here is a production
or Mainnet claim. Rows are appended by `scripts/deploy/deploy-pro.sh` and `scripts/deploy/pro-demo.sh`; check any hash at
`https://stellar.expert/explorer/testnet/tx/<hash>`.

EOH
  fi
  {
    echo
    echo "## Evidence run $(date -u +%FT%TZ) (contract \`$PRO\`, series $SID, expiry $EXPIRY)"
    echo
    echo "Roles: admin \`$ADMIN_G\`, publisher \`$PUBLISHER_G\`, keeper \`$KEEPER_G\`, maker \`$MAKER_G\`, holder \`$HOLDER_G\`, lp \`$LP_G\` (team-operated testnet identities)."
    echo
    echo "| op | tx hash |"
    echo "|---|---|"
    printf '%s\n' "${EVIDENCE_ROWS[@]}"
  } >>"$EVIDENCE_MD"
  log "evidence rows appended to $EVIDENCE_MD"
}
SID=""
EXPIRY=""
trap finish_evidence EXIT

# ---------- 0. USDx trustlines, funding, vault seed ----------
step "0. USDx funding (issuer $ID_USDX_ISSUER) and vault seed"
fund_usdx() { # fund_usdx <identity> <G> <whole tokens>
  local id="$1" g="$2" target=$(($3 * UNIT)) bal have tag
  tag="PRO_$(env_key_for "$id" | sed 's/^PRO_//')"
  bal="$(trustline_field "$g" USDx "$USDX_ISSUER" balance)" || die "Horizon read failed for $g"
  if [[ -z "$bal" ]]; then
    run_tx "${tag}_TRUST_USDX" stellar tx new change-trust --source-account "$id" --network "$NETWORK" --line "$USDX_ASSET"
    record "change_trust USDx ($id)" "$LAST_TX_HASH"
    bal="0"
  fi
  have="$(to_units "$bal")"
  if ((have >= target)); then
    log "$id: USDx balance $bal >= $3, no payment"
  else
    run_tx "${tag}_PAY_USDX" stellar tx new payment --source-account "$ID_USDX_ISSUER" --network "$NETWORK" \
      --destination "$g" --asset "$USDX_ASSET" --amount $((target - have))
    record "USDx payment to $id" "$LAST_TX_HASH"
  fi
}
if [[ $SKIP_FUNDING == 0 ]]; then
  fund_usdx $ID_MAKER "$MAKER_G" $FUND_MAKER
  fund_usdx $ID_HOLDER "$HOLDER_G" $FUND_HOLDER
  fund_usdx $ID_LP "$LP_G" $FUND_LP
  sleep 3
fi
echo "   vault before: $(view get_vault)"
invoke PRO_LP_DEPOSIT $ID_LP lp_deposit --lp "$LP_G" --amount "$LP_SEED"
echo "   lp_deposit: $((LP_SEED / UNIT)) USDx of TEAM seed capital (not third-party liquidity); shares = $RESULT"
view vault_value

# ---------- 1. list_series ----------
step "1. list_series strike $STRIKE_USDX USDx, expiry now + $EXPIRY_MIN min"
EXPIRY=$(($(date +%s) + EXPIRY_MIN * 60))
invoke PRO_LIST_SERIES $ID_ADMIN list_series --admin "$ADMIN_G" --strike "$STRIKE" --expiry "$EXPIRY"
[[ "$RESULT" =~ ^[0-9]+$ ]] || die "list_series did not return a series id (got '$RESULT')"
SID="$RESULT"
echo "   series id $SID, expiry $EXPIRY ($(date -u -d "@$EXPIRY" +%FT%TZ 2>/dev/null || echo "$EXPIRY"))"

# ---------- 2. publish_risk at the opening spot ----------
step "2. publish_risk spot $SPOT_OPEN (seq 1)"
publish 1 $SPOT_OPEN
view get_series --series_id "$SID"

# ---------- 3. maker deposit ----------
step "3. maker deposit $((MAKER_DEPOSIT / UNIT)) USDx"
invoke PRO_DEPOSIT $ID_MAKER deposit --who "$MAKER_G" --amount "$MAKER_DEPOSIT"
req_of "$MAKER_G"

# ---------- 4. two offers ----------
step "4. create_offer A and B: qty $QTY, premium = max(mark x qty x 1.1, 1 USDx x qty)"
PREMIUM=$((MARK * QTY * 11 / 10))
((PREMIUM >= PREMIUM_FLOOR_PER_LOT * QTY)) || PREMIUM=$((PREMIUM_FLOOR_PER_LOT * QTY))
echo "   mark $MARK per lot -> premium $PREMIUM units ($((PREMIUM / UNIT)) USDx) per offer"
invoke PRO_CREATE_OFFER_A $ID_MAKER create_offer --writer "$MAKER_G" --series_id "$SID" --qty "$QTY" --premium "$PREMIUM" --quote_expiry "$EXPIRY"
OFFER_A="$RESULT"
invoke PRO_CREATE_OFFER_B $ID_MAKER create_offer --writer "$MAKER_G" --series_id "$SID" --qty "$QTY" --premium "$PREMIUM" --quote_expiry "$EXPIRY"
OFFER_B="$RESULT"
[[ "$OFFER_A" =~ ^[0-9]+$ && "$OFFER_B" =~ ^[0-9]+$ ]] || die "create_offer did not return offer ids (A='$OFFER_A', B='$OFFER_B')"

# ---------- 5. holder buys both ----------
step "5. holder buys offers $OFFER_A and $OFFER_B"
invoke PRO_BUY_A $ID_HOLDER buy --buyer "$HOLDER_G" --offer_id "$OFFER_A"
POS_A="$RESULT"
invoke PRO_BUY_B $ID_HOLDER buy --buyer "$HOLDER_G" --offer_id "$OFFER_B"
POS_B="$RESULT"
[[ "$POS_A" =~ ^[0-9]+$ && "$POS_B" =~ ^[0-9]+$ ]] || die "buy did not return position ids (A='$POS_A', B='$POS_B')"
view get_position --pos_id "$POS_B"
req_of "$MAKER_G"

# ---------- 6. in the money: early exercise of A while the maker is healthy ----------
step "6. publish_risk spot $SPOT_EXERCISE (seq 2), then holder exercises position $POS_A (snapshot must be < 120 s old)"
publish 2 $SPOT_EXERCISE
req_of "$MAKER_G"
invoke PRO_EXERCISE_A $ID_HOLDER exercise --holder "$HOLDER_G" --pos_id "$POS_A"
echo "   exercise paid by the maker: $RESULT (expected due = $QTY x ($SPOT_EXERCISE - $STRIKE_USDX) USDx)"

# ---------- 7. gap: maker below MM -> keeper liquidates to the vault ----------
step "7. publish_risk spot $SPOT_GAP (seq 3): maker NLV < MM; keeper liquidate(maker, taker = vault)"
publish 3 $SPOT_GAP
req_of "$MAKER_G"
# `taker: Option<Address>` = None (vault). UNCONFIRMED CLI encoding: `--taker` omitted first, then `--taker null`.
if ! run_tx PRO_LIQUIDATE stellar contract invoke --id "$PRO" --network "$NETWORK" --source-account $ID_KEEPER -- \
  liquidate --caller "$KEEPER_G" --writer "$MAKER_G"; then
  log "liquidate without --taker failed; retrying with --taker null"
  run_tx PRO_LIQUIDATE stellar contract invoke --id "$PRO" --network "$NETWORK" --source-account $ID_KEEPER -- \
    liquidate --caller "$KEEPER_G" --writer "$MAKER_G" --taker null || die "liquidate failed both ways (see $DEMO_LOG)"
fi
record PRO_LIQUIDATE "$LAST_TX_HASH"
echo "   takeover: $(sed '/^$/d' <<<"$RUN_TX_OUTPUT" | tail -1)"
view get_vault
view get_book --book_id "$(view get_position --pos_id "$POS_B" | grep -oE '"book":[0-9]+' | grep -oE '[0-9]+' || echo 0)"
view vault_value

# ---------- 8. expiry, settlement, claim ----------
step "8. wait for expiry $EXPIRY, then publish_settlement $SETTLE_PRICE_USDX, settle, settle_vault, claim"
while :; do
  now=$(date +%s)
  lt="$(ledger_time)"
  [[ "$lt" =~ ^[0-9]+$ ]] || lt=0
  if ((now >= EXPIRY + 5 && lt >= EXPIRY + 1)); then break; fi
  echo "   waiting: local $now ($((EXPIRY - now))s to expiry), latest ledger close $lt"
  sleep 15
done
echo "   expiry reached (settle_window = 86400 s: publish_settlement must happen within 24 h of expiry)"
invoke PRO_PUBLISH_SETTLEMENT $ID_PUBLISHER publish_settlement --publisher "$PUBLISHER_G" --series_id "$SID" --price $((SETTLE_PRICE_USDX * UNIT))
BOOK_B="$(view get_position --pos_id "$POS_B" | grep -oE '"book":[0-9]+' | grep -oE '[0-9]+' || true)"
[[ "$BOOK_B" =~ ^[0-9]+$ ]] || BOOK_B=0
echo "   settling book $BOOK_B (owned by the vault since the takeover)"
invoke PRO_SETTLE $ID_KEEPER settle --book_id "$BOOK_B"
invoke PRO_SETTLE_VAULT $ID_KEEPER settle_vault --series_id "$SID"
invoke PRO_CLAIM_B $ID_HOLDER claim --holder "$HOLDER_G" --pos_id "$POS_B"
echo "   claim: $RESULT (expected due = $QTY x ($SETTLE_PRICE_USDX - $STRIKE_USDX) USDx, paid in full if the vault covered the shortfall)"
view get_series --series_id "$SID"
view get_vault
view get_account --who "$MAKER_G"

step "DONE: ${#EVIDENCE_ROWS[@]} evidence rows; full log $DEMO_LOG; tx list $TX_LOG"
