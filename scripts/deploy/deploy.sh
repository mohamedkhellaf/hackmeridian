#!/usr/bin/env bash
# Build and deploy the options contract to Stellar TESTNET, authorize it on the underlying SACs and print the
# rows for the "Deployed contracts" table in AGENTS.md.
#
#   scripts/deploy/deploy.sh                    # stellar contract build --package options, then deploy
#   scripts/deploy/deploy.sh --wasm <path>      # deploy a wasm built elsewhere (e.g. another checkout)
#   DRY_RUN=1 scripts/deploy/deploy.sh [...]    # print the commands, send nothing, write nothing
#
# Constructor (contract-abi.md §3, §9): __constructor(quote: Address, underlyings: Vec<Address>)
#   quote = USDx SAC, underlyings = [RWA SAC, BOND SAC]  (read from scripts/out/testnet.env)
# Every deploy creates a NEW contract id (fresh state, empty option book).
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar jq

WASM=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --wasm)
      [[ $# -ge 2 ]] || die "--wasm needs a path"
      WASM="$2"
      shift 2
      ;;
    -h | --help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) die "unknown argument: $1 (usage: $0 [--wasm <path>])" ;;
  esac
done

DRY="${DRY_RUN:-0}"
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE is missing. Run scripts/setup-testnet/01-identities.sh and 02-assets.sh first (or copy the team's testnet.env there)."
load_env
require_vars USDX_SAC RWA_SAC BOND_SAC DEPLOYER RWA_ISSUER USDX_ISSUER
for v in USDX_SAC RWA_SAC BOND_SAC; do is_contract_id "${!v}" || die "$v='${!v}' is not a contract id"; done
stellar keys address "$ID_DEPLOYER" >/dev/null 2>&1 || die "identity $ID_DEPLOYER missing; run scripts/setup-testnet/01-identities.sh"
stellar keys address "$ID_RWA_ISSUER" >/dev/null 2>&1 || die "identity $ID_RWA_ISSUER missing (needed to authorize the contract)"

# ---------- build ----------
if [[ -z "$WASM" ]]; then
  WASM="$REPO_ROOT/target/wasm32v1-none/release/options.wasm"
  if [[ "$DRY" == 1 ]]; then
    log "DRY_RUN build (in $REPO_ROOT):"
    print_cmd stellar contract build --package options
  else
    log "building options contract in $REPO_ROOT"
    (cd "$REPO_ROOT" && stellar contract build --package options)
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
UNDERLYINGS="$(jq -cn --arg a "$RWA_SAC" --arg b "$BOND_SAC" '[$a, $b]')"
run_tx DEPLOY_OPTIONS stellar contract deploy --wasm "$WASM" --source-account "$ID_DEPLOYER" --network "$NETWORK" \
  --alias options -- --quote "$USDX_SAC" --underlyings "$UNDERLYINGS"

if [[ "$DRY" == 1 ]]; then
  OPTIONS_ID="<OPTIONS_ID>"
  DEPLOY_TX="<DEPLOY_TX>"
else
  OPTIONS_ID="$(grep -oE '^C[A-Z2-7]{55}$' <<<"$RUN_TX_OUTPUT" | tail -1 || true)"
  is_contract_id "$OPTIONS_ID" || die "could not read the new contract id from the deploy output"
  DEPLOY_TX="$LAST_TX_HASH"
  [[ -n "$DEPLOY_TX" ]] || log "WARN: deploy tx hash not found in CLI output; look it up on stellar.expert"
  env_set OPTIONS_ID "$OPTIONS_ID"
  env_set DEPLOY_TX "$DEPLOY_TX"
  env_set OPTIONS_WASM_SHA256 "$WASM_SHA256"
  env_set OPTIONS_DEPLOYED_AT "$(date -u +%FT%TZ)"
  log "options contract deployed: $OPTIONS_ID (tx $DEPLOY_TX)"
fi

# ---------- authorize the contract on every underlying SAC ----------
DRY_RUN="$DRY" "$SCRIPTS_DIR/setup-testnet/03-authorize-contract.sh" "$OPTIONS_ID"

# ---------- AGENTS.md rows ----------
short() { printf '%s…%s' "${1:0:4}" "${1: -4}"; }
cat <<EOF

Paste into AGENTS.md "Deployed contracts (TESTNET ONLY)" (replace the previous options row):

| Contract | Alias | Contract ID | Deployed by |
|---|---|---|---|
| options (deploy tx \`$DEPLOY_TX\`, wasm sha256 \`${WASM_SHA256:0:16}…\`) | options | \`$OPTIONS_ID\` | strata-deployer \`$DEPLOYER\` |
| RWA SAC (fictional; \`RWA:$(short "$RWA_ISSUER")\`, auth required/revocable/clawback) | — | \`$RWA_SAC\` | strata-rwa-issuer \`$RWA_ISSUER\` |
| BOND SAC (fictional; \`BOND:$(short "$RWA_ISSUER")\`, auth required/revocable/clawback) | — | \`$BOND_SAC\` | strata-rwa-issuer \`$RWA_ISSUER\` |
| USDx SAC (fictional quote token; \`USDx:$(short "$USDX_ISSUER")\`, no flags) | — | \`$USDX_SAC\` | strata-usdx-issuer \`$USDX_ISSUER\` |

Next: update AGENTS.md in the same PR, then scripts/deploy/bindings.sh to regenerate the TypeScript client.
EOF
