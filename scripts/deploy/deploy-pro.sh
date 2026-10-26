#!/usr/bin/env bash
# Build and deploy the EXPERIMENTAL StellSec Pro contract (contracts/pro) to Stellar TESTNET.
#
#   scripts/deploy/deploy-pro.sh                 # identities, stellar contract build --package pro, deploy (alias "pro")
#   scripts/deploy/deploy-pro.sh --wasm <path>   # deploy a wasm built elsewhere
#   DRY_RUN=1 scripts/deploy/deploy-pro.sh       # print every command; send and write nothing
#
# Constructor (contracts/pro/src/lib.rs): __constructor(admin, publisher, quote, cfg: MarketConfig)
#   admin     = strata-pro-admin        (lists series)
#   publisher = strata-pro-publisher    (publishes risk snapshots and settlement prices; team-operated, not an oracle)
#   quote     = USDx SAC from AGENTS.md (override: PRO_QUOTE_SAC=C...)
#   cfg       = the MarketConfig defaults of packages/risk/pro_v0_model.py (the same values scripts/deploy/pro-snapshot.py uses)
# Deployer identity: strata-deployer (override: PRO_DEPLOYER=<identity>). Every deploy creates a NEW contract id.
# Identities strata-pro-{admin,publisher,keeper,maker,holder,lp} are created and friendbot-funded if missing
# (secrets stay in the CLI keystore; only public keys are written to scripts/out/testnet.env).
# Writes PRO_ID, PRO_DEPLOY_TX, PRO_WASM_SHA256, PRO_* public keys to scripts/out/testnet.env and appends the deploy
# row to docs/pro-testnet-evidence.md.
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar jq curl

DEFAULT_USDX_SAC=CAKXMQVKSW2AEKF5DSMDPHJAYGNVOQANHXLI64QJS2H3GOCXRW2GCICU # USDx SAC, AGENTS.md "Deployed contracts"
# Must equal MarketConfig() defaults in packages/risk/pro_v0_model.py and DEFAULT_CFG in pro-snapshot.py.
# i128 fields (max_series_oi, max_writer_oi) are passed as JSON strings; the stellar CLI accepts strings for i128.
PRO_CFG_JSON='{"psr_bps":1500,"ext_mult":2,"short_min_bps":500,"im_bps":12500,"max_age":3600,"max_series_oi":"50000","max_writer_oi":"20000","bonus_bps":500,"reserve_fee_bps":1000,"settle_window":86400,"exercise_max_age":120}'
SOURCE_REPO_META="source_repo=github:mohamedkhellaf/hackmeridian" # SEP-55 contract metadata

ID_PRO_ADMIN=strata-pro-admin
ID_PRO_PUBLISHER=strata-pro-publisher
ID_PRO_KEEPER=strata-pro-keeper
ID_PRO_MAKER=strata-pro-maker
ID_PRO_HOLDER=strata-pro-holder
ID_PRO_LP=strata-pro-lp
PRO_IDENTITIES=("$ID_PRO_ADMIN" "$ID_PRO_PUBLISHER" "$ID_PRO_KEEPER" "$ID_PRO_MAKER" "$ID_PRO_HOLDER" "$ID_PRO_LP")
DEPLOYER_ID="${PRO_DEPLOYER:-$ID_DEPLOYER}"
QUOTE_SAC="${PRO_QUOTE_SAC:-$DEFAULT_USDX_SAC}"
EVIDENCE_MD="$REPO_ROOT/docs/pro-testnet-evidence.md"

WASM=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --wasm)
      [[ $# -ge 2 ]] || die "--wasm needs a path"
      WASM="$2"
      shift 2
      ;;
    -h | --help)
      sed -n '2,17p' "$0"
      exit 0
      ;;
    *) die "unknown argument: $1 (usage: $0 [--wasm <path>])" ;;
  esac
done
DRY="${DRY_RUN:-0}"
is_contract_id "$QUOTE_SAC" || die "PRO_QUOTE_SAC='$QUOTE_SAC' is not a contract id"
stellar keys address "$DEPLOYER_ID" >/dev/null 2>&1 || die "deployer identity $DEPLOYER_ID missing (run scripts/setup-testnet/01-identities.sh or set PRO_DEPLOYER)"
echo "$PRO_CFG_JSON" | jq -e . >/dev/null || die "PRO_CFG_JSON is not valid JSON"

# ---------- identities (idempotent: existing identities reused, existing accounts not re-funded) ----------
for id in "${PRO_IDENTITIES[@]}"; do
  key="$(env_key_for "$id")"
  if stellar keys address "$id" >/dev/null 2>&1; then
    g="$(pubkey "$id")"
    if account_exists "$g"; then
      log "$id ($g): identity and testnet account exist, skipping"
    elif [[ "$DRY" == 1 ]]; then
      log "DRY_RUN: would fund $id ($g) via friendbot"
    else
      log "$id ($g): identity exists but the account is not on testnet, funding"
      stellar keys fund "$id" --network "$NETWORK"
      wait_account "$g"
    fi
  elif [[ "$DRY" == 1 ]]; then
    log "DRY_RUN: would run: stellar keys generate $id --network $NETWORK --fund"
    g="<$key>"
  else
    log "$id: generating identity and funding via friendbot"
    stellar keys generate "$id" --network "$NETWORK" --fund
    g="$(pubkey "$id")"
    wait_account "$g"
  fi
  env_set "$key" "$g"
  env_set "${key}_IDENTITY" "$id"
  printf '%-22s %s\n' "$key" "$g"
done
ADMIN_G="$(pubkey "$ID_PRO_ADMIN" 2>/dev/null || echo '<PRO_ADMIN>')"
PUBLISHER_G="$(pubkey "$ID_PRO_PUBLISHER" 2>/dev/null || echo '<PRO_PUBLISHER>')"
DEPLOYER_G="$(pubkey "$DEPLOYER_ID")"
[[ "$ADMIN_G" != "$PUBLISHER_G" ]] || die "admin and publisher must be different accounts (constructor rejects admin == publisher)"

# ---------- build ----------
if [[ -z "$WASM" ]]; then
  WASM="$REPO_ROOT/target/wasm32v1-none/release/pro.wasm"
  if [[ "$DRY" == 1 ]]; then
    log "DRY_RUN build (in $REPO_ROOT):"
    print_cmd stellar contract build --package pro --meta "$SOURCE_REPO_META"
  else
    log "building pro contract in $REPO_ROOT"
    (cd "$REPO_ROOT" && stellar contract build --package pro --meta "$SOURCE_REPO_META")
  fi
fi
if [[ -f "$WASM" ]]; then
  WASM="$(cd "$(dirname "$WASM")" && pwd)/$(basename "$WASM")"
  WASM_SHA256="$(sha256sum "$WASM" | cut -d' ' -f1)"
  log "wasm: $WASM ($(wc -c <"$WASM") bytes, sha256 $WASM_SHA256)"
elif [[ "$DRY" == 1 ]]; then
  log "DRY_RUN: wasm $WASM does not exist (fine for a dry run)"
  WASM_SHA256="<sha256>"
else
  die "wasm not found: $WASM"
fi

# ---------- deploy ----------
# Flags confirmed with `stellar contract deploy --help` (stellar 28.1.0): --wasm, --source-account, --network, --alias.
# Constructor args follow `--`, one `--<arg>` per parameter; struct/JSON args are passed as a JSON string.
run_tx DEPLOY_PRO stellar contract deploy --wasm "$WASM" --source-account "$DEPLOYER_ID" --network "$NETWORK" \
  --alias pro -- --admin "$ADMIN_G" --publisher "$PUBLISHER_G" --quote "$QUOTE_SAC" --cfg "$PRO_CFG_JSON"

if [[ "$DRY" == 1 ]]; then
  PRO_ID="<PRO_ID>"
  DEPLOY_TX="<PRO_DEPLOY_TX>"
else
  PRO_ID="$(grep -oE '^C[A-Z2-7]{55}$' <<<"$RUN_TX_OUTPUT" | tail -1 || true)"
  is_contract_id "$PRO_ID" || die "could not read the new contract id from the deploy output"
  DEPLOY_TX="$LAST_TX_HASH"
  [[ -n "$DEPLOY_TX" ]] || log "WARN: deploy tx hash not found in CLI output; look it up on stellar.expert"
  env_set PRO_ID "$PRO_ID"
  env_set PRO_DEPLOY_TX "$DEPLOY_TX"
  env_set PRO_WASM_SHA256 "$WASM_SHA256"
  env_set PRO_QUOTE_SAC "$QUOTE_SAC"
  env_set PRO_DEPLOYED_AT "$(date -u +%FT%TZ)"
  log "pro contract deployed: $PRO_ID (tx $DEPLOY_TX)"

  # Read back the immutable roles (views; no tx). `--send=no` confirmed in `stellar contract invoke --help`.
  for fn in admin publisher quote; do
    v="$(stellar contract invoke --id pro --network "$NETWORK" --source-account "$DEPLOYER_ID" --send=no -- "$fn" 2>/dev/null | tr -d '"' || true)"
    log "pro.$fn() = ${v:-<read failed>}"
  done

  if [[ ! -f "$EVIDENCE_MD" ]]; then
    cat >"$EVIDENCE_MD" <<'EOF'
# StellSec Pro (experimental): testnet evidence

Stellar **TESTNET ONLY**. Fictional assets (`USDx` quote token, fictional `EQTY` underlying label; cash-settled, no
underlying token exists). The risk publisher and the settlement price are **team-operated** (`strata-pro-publisher`),
not a market oracle; the vault is seeded with **team USDx**, not third-party liquidity. Nothing here is a production
or Mainnet claim. Rows are appended by `scripts/deploy/deploy-pro.sh` and `scripts/deploy/pro-demo.sh`; check any hash at
`https://stellar.expert/explorer/testnet/tx/<hash>`.

EOF
  fi
  {
    echo
    echo "## Deployment $(date -u +%FT%TZ)"
    echo
    echo "| item | value |"
    echo "|---|---|"
    echo "| pro contract id | \`$PRO_ID\` |"
    echo "| deploy tx | \`${DEPLOY_TX:-unknown}\` |"
    echo "| wasm sha256 | \`$WASM_SHA256\` |"
    echo "| admin (strata-pro-admin) | \`$ADMIN_G\` |"
    echo "| publisher (strata-pro-publisher) | \`$PUBLISHER_G\` |"
    echo "| quote (USDx SAC) | \`$QUOTE_SAC\` |"
    echo "| deployer ($DEPLOYER_ID) | \`$DEPLOYER_G\` |"
    echo "| MarketConfig | \`$PRO_CFG_JSON\` |"
  } >>"$EVIDENCE_MD"
  log "evidence appended to $EVIDENCE_MD"
fi

cat <<EOF

Paste into AGENTS.md "Deployed contracts (TESTNET ONLY)":

| pro v0 EXPERIMENTAL, cash-settled margin calls (deploy tx \`$DEPLOY_TX\`, wasm sha256 \`${WASM_SHA256:0:16}…\`; admin \`${ADMIN_G:0:4}…${ADMIN_G: -4}\`, publisher \`${PUBLISHER_G:0:4}…${PUBLISHER_G: -4}\`, quote USDx SAC) | pro | \`$PRO_ID\` | $DEPLOYER_ID \`$DEPLOYER_G\` |

Next: scripts/deploy/pro-demo.sh   (evidence run; real testnet txs, ~20 min including the wait for expiry)
EOF
