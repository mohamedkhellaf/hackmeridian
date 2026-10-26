#!/usr/bin/env bash
# Build and deploy the options contract to Stellar TESTNET, authorize it on the underlying SACs and print the
# rows for the "Deployed contracts" table in AGENTS.md.
#
#   scripts/deploy/deploy.sh                    # stellar contract build --package options --meta source_repo=..., deploy
#   scripts/deploy/deploy.sh --wasm <path>      # deploy a wasm built elsewhere (e.g. another checkout)
#   scripts/deploy/deploy.sh --throwaway [...]  # deploy a SECOND instance for destructive demos (issuer clawback)
#   DRY_RUN=1 scripts/deploy/deploy.sh [...]    # print the commands, send nothing, write nothing
#
# Constructor (contract-abi.md §3, §9): __constructor(quote: Address, underlyings: Vec<Address>)
#   quote = USDx SAC, underlyings = [RWA SAC, BOND SAC]  (read from scripts/out/testnet.env)
#   EQTY is deliberately NOT in the constructor and NOT authorized here: on contract v1.3 the smoke run lists it with
#   list_asset and authorizes the escrow on it afterwards (contract-abi.md §12.4; smoke-testnet.sh section V1.3).
# Every deploy creates a NEW contract id (fresh state, empty option book). The build stamps SEP-55 metadata
# source_repo=github:mohamedkhellaf/hackmeridian into the wasm (check: stellar contract info meta --wasm <wasm>).
# --throwaway never touches the `options` alias, OPTIONS_ID or DEPLOY_TX: it saves alias `options-throwaway` and
# writes THROWAWAY_OPTIONS_ID / THROWAWAY_DEPLOY_TX instead (still authorized on RWA and BOND). Never paste it in AGENTS.md.
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar jq

SOURCE_REPO_META="source_repo=github:mohamedkhellaf/hackmeridian" # SEP-55 contract metadata
WASM=""
THROWAWAY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --wasm)
      [[ $# -ge 2 ]] || die "--wasm needs a path"
      WASM="$2"
      shift 2
      ;;
    --throwaway)
      THROWAWAY=1
      shift
      ;;
    -h | --help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *) die "unknown argument: $1 (usage: $0 [--wasm <path>] [--throwaway])" ;;
  esac
done
if [[ $THROWAWAY == 1 ]]; then
  ALIAS=options-throwaway
  DEPLOY_LABEL=DEPLOY_THROWAWAY
  AUTH_LABEL=AUTHORIZE_THROWAWAY
else
  ALIAS=options
  DEPLOY_LABEL=DEPLOY_OPTIONS
  AUTH_LABEL=AUTHORIZE_OPTIONS
fi

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
    print_cmd stellar contract build --package options --meta "$SOURCE_REPO_META"
  else
    log "building options contract in $REPO_ROOT"
    (cd "$REPO_ROOT" && stellar contract build --package options --meta "$SOURCE_REPO_META")
  fi
fi
if [[ -f "$WASM" ]]; then
  WASM="$(cd "$(dirname "$WASM")" && pwd)/$(basename "$WASM")"
  WASM_SHA256="$(sha256sum "$WASM" | cut -d' ' -f1)"
  log "wasm: $WASM ($(wc -c <"$WASM") bytes, sha256 $WASM_SHA256)"
  if stellar contract info meta --wasm "$WASM" 2>/dev/null | grep -q "source_repo: ${SOURCE_REPO_META#source_repo=}"; then
    log "wasm carries SEP-55 meta $SOURCE_REPO_META"
  else
    log "WARN: wasm has no SEP-55 meta $SOURCE_REPO_META (rebuild with: stellar contract build --package options --meta $SOURCE_REPO_META)"
  fi
elif [[ "$DRY" == 1 ]]; then
  log "DRY_RUN: wasm $WASM does not exist (fine for a dry run)"
  WASM_SHA256="<sha256>"
else
  die "wasm not found: $WASM"
fi

# ---------- deploy ----------
# Constructor underlyings stay [RWA, BOND]. Never add EQTY_SAC here (the v1.3 listing demo depends on it).
UNDERLYINGS="$(jq -cn --arg a "$RWA_SAC" --arg b "$BOND_SAC" '[$a, $b]')"
run_tx "$DEPLOY_LABEL" stellar contract deploy --wasm "$WASM" --source-account "$ID_DEPLOYER" --network "$NETWORK" \
  --alias "$ALIAS" -- --quote "$USDX_SAC" --underlyings "$UNDERLYINGS"

if [[ "$DRY" == 1 ]]; then
  if [[ $THROWAWAY == 1 ]]; then
    NEW_ID="<THROWAWAY_OPTIONS_ID>"
  else
    NEW_ID="<OPTIONS_ID>"
    OPTIONS_ID="$NEW_ID"
  fi
  DEPLOY_TX="<DEPLOY_TX>"
else
  NEW_ID="$(grep -oE '^C[A-Z2-7]{55}$' <<<"$RUN_TX_OUTPUT" | tail -1 || true)"
  is_contract_id "$NEW_ID" || die "could not read the new contract id from the deploy output"
  DEPLOY_TX="$LAST_TX_HASH"
  [[ -n "$DEPLOY_TX" ]] || log "WARN: deploy tx hash not found in CLI output; look it up on stellar.expert"
  if [[ $THROWAWAY == 1 ]]; then
    [[ "$NEW_ID" != "${OPTIONS_ID:-}" ]] || die "throwaway deploy returned the main OPTIONS_ID; refusing to record it"
    env_set THROWAWAY_OPTIONS_ID "$NEW_ID"
    env_set THROWAWAY_DEPLOY_TX "$DEPLOY_TX"
    env_set THROWAWAY_WASM_SHA256 "$WASM_SHA256"
    env_set THROWAWAY_DEPLOYED_AT "$(date -u +%FT%TZ)"
    log "THROWAWAY options instance deployed: $NEW_ID (tx $DEPLOY_TX); OPTIONS_ID and alias 'options' untouched"
  else
    OPTIONS_ID="$NEW_ID"
    env_set OPTIONS_ID "$OPTIONS_ID"
    env_set DEPLOY_TX "$DEPLOY_TX"
    env_set OPTIONS_WASM_SHA256 "$WASM_SHA256"
    env_set OPTIONS_DEPLOYED_AT "$(date -u +%FT%TZ)"
    log "options contract deployed: $OPTIONS_ID (tx $DEPLOY_TX)"
  fi
fi

# ---------- authorize the contract on the constructor underlyings (RWA, BOND; never EQTY, see above) ----------
DRY_RUN="$DRY" "$SCRIPTS_DIR/setup-testnet/03-authorize-contract.sh" "$NEW_ID" "$AUTH_LABEL" RWA BOND

if [[ $THROWAWAY == 1 ]]; then
  cat <<EOF

THROWAWAY options instance (Stellar TESTNET, destructive demos only; do NOT paste into AGENTS.md):
  THROWAWAY_OPTIONS_ID=$NEW_ID
  THROWAWAY_DEPLOY_TX=$DEPLOY_TX
  alias: $ALIAS   wasm sha256: $WASM_SHA256
  main OPTIONS_ID (unchanged): ${OPTIONS_ID:-<unset>}
EOF
  exit 0
fi

# ---------- AGENTS.md rows ----------
short() { printf '%s…%s' "${1:0:4}" "${1: -4}"; }
EQTY_ROW=""
if [[ -n "${EQTY_SAC:-}" ]]; then
  EQTY_ROW="| EQTY SAC (fictional tokenized-equity label; \`EQTY:$(short "$RWA_ISSUER")\`, auth required/revocable/clawback; not in the constructor, listed with \`list_asset\` on v1.3) | — | \`$EQTY_SAC\` | strata-rwa-issuer \`$RWA_ISSUER\` |"$'\n'
fi
cat <<EOF

Paste into AGENTS.md "Deployed contracts (TESTNET ONLY)" (replace the previous options row):

| Contract | Alias | Contract ID | Deployed by |
|---|---|---|---|
| options (deploy tx \`$DEPLOY_TX\`, wasm sha256 \`${WASM_SHA256:0:16}…\`) | options | \`$OPTIONS_ID\` | strata-deployer \`$DEPLOYER\` |
| RWA SAC (fictional; \`RWA:$(short "$RWA_ISSUER")\`, auth required/revocable/clawback) | — | \`$RWA_SAC\` | strata-rwa-issuer \`$RWA_ISSUER\` |
| BOND SAC (fictional; \`BOND:$(short "$RWA_ISSUER")\`, auth required/revocable/clawback) | — | \`$BOND_SAC\` | strata-rwa-issuer \`$RWA_ISSUER\` |
${EQTY_ROW}| USDx SAC (fictional quote token; \`USDx:$(short "$USDX_ISSUER")\`, no flags) | — | \`$USDX_SAC\` | strata-usdx-issuer \`$USDX_ISSUER\` |

Next: update AGENTS.md in the same PR, then scripts/deploy/bindings.sh to regenerate the TypeScript client.
EOF
