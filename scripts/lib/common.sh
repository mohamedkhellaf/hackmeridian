#!/usr/bin/env bash
# Shared helpers for the StellSec testnet scripts. Source this file; do not run it.
# STELLAR TESTNET ONLY. Identities (secret keys) live only in the stellar CLI keystore
# (~/.config/stellar/identity). Nothing here ever reads or writes a secret.

if [[ -n "${STRATA_COMMON_LOADED:-}" ]]; then return 0; fi
STRATA_COMMON_LOADED=1

NETWORK=testnet
HORIZON_URL="https://horizon-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
OUT_DIR="$SCRIPTS_DIR/out"
ENV_FILE="${STRATA_ENV_FILE:-$OUT_DIR/testnet.env}"
TX_LOG="$OUT_DIR/tx-log.tsv"

# CLI keystore identity names.
ID_RWA_ISSUER=strata-rwa-issuer
ID_USDX_ISSUER=strata-usdx-issuer
ID_MAKER1=strata-maker1
ID_MAKER2=strata-maker2
ID_INVESTOR=strata-investor
ID_OUTSIDER=strata-outsider
ID_DEPLOYER=strata-deployer
ALL_IDENTITIES=("$ID_RWA_ISSUER" "$ID_USDX_ISSUER" "$ID_MAKER1" "$ID_MAKER2" "$ID_INVESTOR" "$ID_OUTSIDER" "$ID_DEPLOYER")

# Every asset here is a classic asset behind a SAC: 7 decimals, 1 token = 10_000_000 units.
UNIT=10000000

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
die() {
  log "ERROR: $*"
  exit 1
}

require_tools() {
  local t
  for t in "$@"; do command -v "$t" >/dev/null 2>&1 || die "missing tool: $t"; done
}

# strata-usdx-issuer -> USDX_ISSUER
env_key_for() {
  local n="${1#strata-}"
  n="${n//-/_}"
  printf '%s\n' "${n^^}"
}

pubkey() { stellar keys address "$1"; }

# Shell-sourceable KEY=VALUE; replaces an existing KEY in place, appends otherwise.
env_set() {
  local key="$1" val="$2" line tmp
  [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || die "env_set: bad key '$key'"
  [[ "$val" != *$'\n'* && "$val" != *"'"* ]] || die "env_set: bad value for $key"
  # Defensive: refuse anything shaped like a Stellar secret seed.
  [[ ! "$val" =~ S[A-Z2-7]{55} ]] || die "env_set: refusing to write a secret key ($key)"
  if [[ "${DRY_RUN:-0}" == 1 ]]; then
    log "DRY_RUN: would set $key=$val"
    return 0
  fi
  mkdir -p "$OUT_DIR"
  touch "$ENV_FILE"
  if [[ "$val" =~ ^[A-Za-z0-9:._/,+-]*$ ]]; then line="$key=$val"; else line="$key='$val'"; fi
  tmp="$(mktemp "$OUT_DIR/.env.XXXXXX")"
  awk -v k="$key" -v l="$line" \
    'BEGIN{d=0} index($0, k"=")==1 {if(!d){print l; d=1}; next} {print} END{if(!d) print l}' \
    "$ENV_FILE" >"$tmp"
  mv "$tmp" "$ENV_FILE"
}

load_env() {
  [[ -f "$ENV_FILE" ]] || die "$ENV_FILE is missing. Run scripts/setup-testnet/01-identities.sh and 02-assets.sh first."
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

require_vars() {
  local v
  for v in "$@"; do
    [[ -n "${!v:-}" ]] || die "$v is not set in $ENV_FILE (re-run scripts/setup-testnet/02-assets.sh)"
  done
}

print_cmd() {
  printf '  $'
  printf ' %q' "$@"
  printf '\n'
}

# run_tx LABEL cmd...
# Runs a stellar CLI command that submits transactions, streams its stdout+stderr to stderr and
# extracts every transaction hash the CLI reports. Sets RUN_TX_OUTPUT, LAST_TX_HASH and TX_HASHES,
# records TX_<LABEL>=<last hash> in the env file and appends each hash to scripts/out/tx-log.tsv.
# Returns the command's exit status. DRY_RUN=1 prints the command instead of running it.
run_tx() {
  local label="$1"
  shift
  RUN_TX_OUTPUT=""
  LAST_TX_HASH=""
  TX_HASHES=()
  if [[ "${DRY_RUN:-0}" == 1 ]]; then
    log "DRY_RUN [$label]:"
    print_cmd "$@"
    return 0
  fi
  log "tx [$label]: $*"
  local out rc=0 h status
  out="$(mktemp)"
  "$@" 2>&1 | tee "$out" >&2 || rc=$?
  RUN_TX_OUTPUT="$(cat "$out")"
  rm -f "$out"
  # stellar-cli 28 logs "Signing transaction: <hash>" (and sometimes "Transaction hash is <hash>" or a
  # .../tx/<hash> link). Match only those phrases so a printed wasm hash is never mistaken for a tx.
  mapfile -t TX_HASHES < <(grep -oE '(Signing transaction:|[Tt]ransaction hash( is)?:?|/tx/)[[:space:]]*[0-9a-f]{64}' \
    <<<"$RUN_TX_OUTPUT" | grep -oE '[0-9a-f]{64}' | awk '!seen[$0]++' || true)
  if ((${#TX_HASHES[@]} > 0)); then
    mkdir -p "$OUT_DIR"
    if [[ $rc == 0 ]]; then status=ok; else status=failed; fi
    for h in "${TX_HASHES[@]}"; do
      printf 'TX %s %s\n' "$label" "$h"
      printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$label" "$h" "$status" >>"$TX_LOG"
    done
    LAST_TX_HASH="${TX_HASHES[-1]}"
    if [[ $rc == 0 ]]; then
      env_set "TX_$label" "$LAST_TX_HASH"
      if ((${#TX_HASHES[@]} > 1)); then env_set "TX_${label}_ALL" "$(IFS=,; echo "${TX_HASHES[*]}")"; fi
    fi
  elif [[ $rc == 0 ]]; then
    log "WARN: no transaction hash found in CLI output for $label"
  fi
  return "$rc"
}

# ---------- Horizon reads (idempotency checks; Horizon can lag the ledger by a few seconds) ----------

horizon_account() { curl -sf "$HORIZON_URL/accounts/$1"; }

account_exists() {
  [[ "$(curl -s -o /dev/null -w '%{http_code}' "$HORIZON_URL/accounts/$1")" == 200 ]]
}

wait_account() {
  local g="$1" i
  for i in $(seq 1 30); do
    if account_exists "$g"; then return 0; fi
    sleep 1
  done
  die "account $g not visible on Horizon after 30s"
}

# trustline_field <G> <CODE> <ISSUER> <field> -> the field's value, or empty if there is no trustline.
trustline_field() {
  horizon_account "$1" | jq -r --arg c "$2" --arg i "$3" --arg f "$4" \
    '[.balances[] | select(.asset_code == $c and .asset_issuer == $i)][0]
     | if . == null then "" else (.[$f] | tostring) end'
}

# Horizon decimal string ("1000.0000000") -> integer units (stroops).
to_units() {
  local s="$1" int frac
  if [[ -z "$s" ]]; then
    echo 0
    return
  fi
  int="${s%%.*}"
  if [[ "$s" == *.* ]]; then frac="${s#*.}"; else frac=""; fi
  frac="${frac}0000000"
  frac="${frac:0:7}"
  echo $((10#$int * UNIT + 10#$frac))
}

# ---------- Soroban reads ----------

is_contract_id() { [[ "$1" =~ ^C[A-Z2-7]{55}$ ]]; }

# True if a contract instance (wasm contract or SAC) exists at this address.
contract_exists() {
  local n
  n="$(stellar ledger entry fetch contract-data --contract "$1" --key-xdr AAAAFA== \
    --network "$NETWORK" --output json 2>/dev/null | jq -r '.entries | length')" || return 1
  [[ "$n" =~ ^[1-9] ]]
}
