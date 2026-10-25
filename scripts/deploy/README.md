# Deploy the `options` contract (Stellar TESTNET only)

Prerequisite: `scripts/setup-testnet/01-identities.sh` and `02-assets.sh` have run on this machine, so
`scripts/out/testnet.env` exists and the `strata-deployer` and `strata-rwa-issuer` identities are in the CLI
keystore. `deploy.sh` stops with an error if the env file is missing.

## Order of operations

1. **Build** the wasm: `stellar contract build --package options`
   (output `target/wasm32v1-none/release/options.wasm`). `deploy.sh` does this unless you pass `--wasm`.
2. **Deploy** with the constructor from `docs/contract-abi.md` §3/§9:
   ```sh
   stellar contract deploy --wasm <wasm> --source-account strata-deployer --network testnet --alias options \
     -- --quote $USDX_SAC --underlyings '["<RWA_SAC>","<BOND_SAC>"]'
   ```
   The allowlist is immutable: changing the quote token or the underlyings means a new deploy.
3. **Authorize** the new contract on every underlying SAC (`scripts/setup-testnet/03-authorize-contract.sh <id>`):
   `set_authorized(<contract>, true)` from `strata-rwa-issuer` on the RWA and BOND SACs. Without it
   `create_offer` fails with `ContractNotAuthorized`.
4. **Record** `OPTIONS_ID`, `DEPLOY_TX`, `OPTIONS_WASM_SHA256` in `scripts/out/testnet.env` (done by `deploy.sh`)
   and paste the printed rows into the **Deployed contracts** table in `AGENTS.md`.
5. **Bindings**: `scripts/deploy/bindings.sh [out-dir]` generates the TypeScript client
   (default `scripts/out/bindings/options`). It never writes into `frontend/`; Dev 3 copies the package in.

```sh
scripts/deploy/deploy.sh                        # build + deploy + authorize + print AGENTS.md rows
scripts/deploy/deploy.sh --wasm /path/to/options.wasm   # deploy a wasm built in another checkout
DRY_RUN=1 scripts/deploy/deploy.sh              # print every command; send and write nothing
scripts/deploy/bindings.sh                      # TypeScript client for OPTIONS_ID (or alias "options")
scripts/deploy/smoke-testnet.sh                 # end-to-end smoke run on TESTNET (real txs; --p0-only to skip P0+)
```

Transaction hashes are printed as `TX <STEP> <hash>` and appended to `scripts/out/tx-log.tsv`.

## Redeploy checklist

Every deploy creates a **new contract id with an empty option book**. Offers and positions on the previous
contract stay there (the old contract keeps working until its TTL lapses); the frontend must be pointed at the new
id.

- [ ] Contract change reviewed by Dev 2 (AGENTS.md: contract changes require Dev 2 review).
- [ ] `scripts/deploy/deploy.sh` (or `--wasm <path>`) finished without error and printed `OPTIONS_ID`.
- [ ] Authorization step reported "authorized" for **both** RWA and BOND (deploy.sh runs it; re-run
      `scripts/setup-testnet/03-authorize-contract.sh <id>` if it was interrupted).
- [ ] `AGENTS.md` **Deployed contracts** table updated with the printed rows **in the same PR** as the contract
      change.
- [ ] `scripts/deploy/bindings.sh` regenerated the client; Dev 3 notified of the new id and bindings.
- [ ] `scripts/setup-testnet/verify.sh` passes (it also checks the contract authorization once `OPTIONS_ID` is set).
- [ ] `scripts/deploy/smoke-testnet.sh` ends with `P0: PASS` and `P0+: PASS` (PUT/CALL lifecycles on RWA and BOND,
      expected contract errors in simulation, expiry/reclaim, maker competition). Full log in `scripts/out/smoke-*.log`.
