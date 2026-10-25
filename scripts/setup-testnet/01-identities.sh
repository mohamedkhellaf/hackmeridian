#!/usr/bin/env bash
# Create and friendbot-fund the Strata demo identities on Stellar TESTNET.
# Idempotent: existing identities are reused; accounts that already exist on testnet are not re-funded.
# Secrets stay in the stellar CLI keystore (~/.config/stellar/identity). Only public keys are written,
# to scripts/out/testnet.env.
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/common.sh"
require_tools stellar curl jq

env_set NETWORK "$NETWORK"
env_set NETWORK_PASSPHRASE "$NETWORK_PASSPHRASE"
env_set HORIZON_URL "$HORIZON_URL"
env_set RPC_URL "https://soroban-testnet.stellar.org"

for id in "${ALL_IDENTITIES[@]}"; do
  key="$(env_key_for "$id")"
  if stellar keys address "$id" >/dev/null 2>&1; then
    g="$(pubkey "$id")"
    if account_exists "$g"; then
      log "$id ($g): identity and testnet account exist, skipping"
    else
      log "$id ($g): identity exists but the account is not on testnet (new identity or testnet reset), funding"
      stellar keys fund "$id" --network "$NETWORK"
    fi
  else
    log "$id: generating identity and funding via friendbot"
    stellar keys generate "$id" --network "$NETWORK" --fund
    g="$(pubkey "$id")"
  fi
  wait_account "$g"
  env_set "$key" "$g"
  env_set "${key}_IDENTITY" "$id"
  # The CLI prints no hash for friendbot funding; record the account's create_account tx from Horizon.
  fund_tx="$(curl -sf "$HORIZON_URL/accounts/$g/operations?order=asc&limit=1" |
    jq -r '._embedded.records[0] | select(.type == "create_account") | .transaction_hash' || true)"
  if [[ -n "$fund_tx" ]]; then env_set "TX_FUND_$key" "$fund_tx"; fi
  printf '%-20s %s  fund_tx=%s\n' "$key" "$g" "${fund_tx:-?}"
done

log "identities ready; public keys written to $ENV_FILE"
