#!/usr/bin/env bash
# TTL keeper for the options contract on Stellar TESTNET (test XLM fees only).
#
#   scripts/deploy/extend-ttl.sh                 # OPTIONS_ID from scripts/out/testnet.env
#   scripts/deploy/extend-ttl.sh <contract-id>   # another instance (e.g. THROWAWAY_OPTIONS_ID or the old v1 id)
#   DRY_RUN=1 scripts/deploy/extend-ttl.sh       # read the book, print the extend_ttl commands, send nothing
#
# Reads option_count, calls get_option for every id and collects the ids whose state is Offered, Active or
# Exercised (terminal Settled/Expired/Cancelled options hold no funds and are left to expire). Then calls
# extend_ttl(ids) from strata-deployer in batches of 20; with no live option it still sends one extend_ttl([]),
# which extends the contract instance and code (contract-abi.md §8). On v1.3.1 each call also covers, per id, the
# underlying's Listed and OpenFor entries and the writer's WriterOpen entry, plus the first 50 registry entries
# (AssetAt and their Listed; §13.5); a 20-id batch stays far below the testnet footprint limit (400 entries).
# extend_ttl only bumps entries whose TTL is below 7 days (to 30 days), so re-running is harmless: same calls, no
# state change. Every call is submitted with --send=yes (the CLI skips calls it simulates as read-only, which
# extend_ttl is while every TTL is above 7 days). Prints every tx hash ("TX EXTEND_TTL_<n> <hash>", also appended
# to scripts/out/tx-log.tsv); full output in scripts/out/extend-ttl-*.log.
set -uo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar jq

BATCH=20
case "${1:-}" in
  -h | --help)
    sed -n '2,17p' "$0"
    exit 0
    ;;
esac
[[ $# -le 1 ]] || die "usage: $0 [contract-id]"
load_env
O="${1:-${OPTIONS_ID:-}}"
is_contract_id "$O" || die "contract id '$O' is not a C... id (set OPTIONS_ID via scripts/deploy/deploy.sh or pass one)"
stellar keys address "$ID_DEPLOYER" >/dev/null 2>&1 || die "identity $ID_DEPLOYER missing"

mkdir -p "$OUT_DIR"
LOG_FILE="$OUT_DIR/extend-ttl-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$LOG_FILE") 2>&1

# view <fn> [args...]: simulation only, retried on transport errors; prints the return value.
view() {
  local out attempt
  for attempt in 1 2 3 4 5; do
    if out="$(stellar contract invoke --id "$O" --network "$NETWORK" --source-account "$ID_DEPLOYER" --send=no \
      -- "$@" 2>/dev/null)"; then
      printf '%s\n' "$out" | sed '/^$/d' | tail -1
      return 0
    fi
    sleep 3
  done
  return 1
}

# instance_ttl -> "<live_until_ledger> <latest_ledger>" of the contract instance entry.
instance_ttl() {
  stellar ledger entry fetch contract-data --contract "$O" --key-xdr AAAAFA== --network "$NETWORK" --output json \
    2>/dev/null | jq -r '"\(.entries[0].live_until_ledger_seq // .entries[0].liveUntilLedgerSeq // "?") \(.latestLedger // "?")"'
}
show_ttl() {
  local live latest
  read -r live latest <<<"$(instance_ttl)"
  if [[ "$live" =~ ^[0-9]+$ && "$latest" =~ ^[0-9]+$ ]]; then
    echo "   instance live_until_ledger $live (latest $latest, ~$(((live - latest) * 5 / 86400)) days left at 5 s/ledger)"
  else
    echo "   instance TTL unreadable"
  fi
}

echo "== extend-ttl keeper on Stellar TESTNET ($(date -u +%FT%TZ)) =="
echo "contract $O"
echo "log      $LOG_FILE"
echo "before:"
show_ttl

COUNT="$(view option_count | tr -d '"')" || die "option_count failed"
[[ "$COUNT" =~ ^[0-9]+$ ]] || die "option_count returned '$COUNT'"
echo "option_count = $COUNT"

LIVE=()
UNREADABLE=0
for ((id = 0; id < COUNT; id++)); do
  if ! json="$(view get_option --id "$id")"; then
    echo "   #$id get_option failed (archived or RPC error); skipped"
    UNREADABLE=$((UNREADABLE + 1))
    continue
  fi
  st="$(jq -r '.state | if type == "string" then . elif type == "object" then (keys[0]) else tostring end' <<<"$json" 2>/dev/null)"
  case "$st" in
    Offered | Active | Exercised)
      LIVE+=("$id")
      echo "   #$id $st -> extend"
      ;;
    *) echo "   #$id $st" ;;
  esac
done
echo "non-terminal ids (${#LIVE[@]}): ${LIVE[*]:-none}"

RC=0
HASHES=()
n=0
i=0
while :; do
  n=$((n + 1))
  ids_json="$(printf '%s\n' "${LIVE[@]:i:BATCH}" | sed '/^$/d' | jq -cs .)"
  # --send=yes: when no entry is below the 7-day threshold the CLI simulates extend_ttl as read-only and would
  # otherwise skip submitting it; the keeper always submits so every run leaves a tx on chain.
  if run_tx "EXTEND_TTL_$n" stellar contract invoke --id "$O" --network "$NETWORK" --source-account "$ID_DEPLOYER" \
    --send=yes -- extend_ttl --ids "$ids_json"; then
    if [[ -n "$LAST_TX_HASH" ]]; then
      HASHES+=("$LAST_TX_HASH")
      echo "   batch $n extend_ttl($ids_json): tx $LAST_TX_HASH"
    elif [[ "${DRY_RUN:-0}" == 1 ]]; then
      echo "   batch $n extend_ttl($ids_json): dry run, not sent"
    else
      echo "   batch $n extend_ttl($ids_json): CLI exited 0 but no tx hash was found"
      RC=1
    fi
  else
    echo "   batch $n extend_ttl($ids_json) FAILED (tx ${LAST_TX_HASH:-not sent})"
    RC=1
  fi
  i=$((i + BATCH))
  ((i < ${#LIVE[@]})) || break
done

echo "after:"
show_ttl
echo "extend_ttl txs: ${HASHES[*]:-none}"
for h in "${HASHES[@]}"; do echo "   https://stellar.expert/explorer/testnet/tx/$h"; done
((UNREADABLE == 0)) || {
  echo "WARN: $UNREADABLE option(s) unreadable; an archived entry needs a restore before it can be extended"
  RC=1
}
echo "log: $LOG_FILE"
exit "$RC"
