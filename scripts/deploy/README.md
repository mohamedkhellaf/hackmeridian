# Deploy the `options` contract (Stellar TESTNET only)

Prerequisite: `scripts/setup-testnet/01-identities.sh` and `02-assets.sh` have run on this machine, so
`scripts/out/testnet.env` exists and the `strata-deployer` and `strata-rwa-issuer` identities are in the CLI
keystore. `deploy.sh` stops with an error if the env file is missing.

## Order of operations

1. **Build** the wasm:
   `stellar contract build --package options --meta source_repo=github:mohamedkhellaf/hackmeridian`
   (output `target/wasm32v1-none/release/options.wasm`). `deploy.sh` does this unless you pass `--wasm`. The
   `--meta` flag stamps SEP-55 source metadata into the wasm; check it with
   `stellar contract info meta --wasm target/wasm32v1-none/release/options.wasm` (look for `source_repo`).
   With `--wasm`, `deploy.sh` logs a warning if the file has no `source_repo` entry but deploys it anyway.
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
scripts/deploy/deploy.sh --throwaway            # second instance for destructive demos; OPTIONS_ID untouched
scripts/deploy/issuer-demo-testnet.sh           # issuer freeze / de-authorize / clawback failure modes (real txs)
scripts/deploy/extend-ttl.sh                    # TTL keeper: extend_ttl over every non-terminal option
scripts/deploy/seed-demo-offers.sh --contract <C-id> [--hours 48]   # 4 funded demo offers (NOT idempotent)
```

Transaction hashes are printed as `TX <STEP> <hash>` and appended to `scripts/out/tx-log.tsv`.

## Throwaway instance (`deploy.sh --throwaway`)

`--throwaway` (combinable with `--wasm` and `DRY_RUN=1`) deploys a second, independent instance of the same
contract with the same constructor. It does **not** touch the `options` CLI alias, `OPTIONS_ID`, `DEPLOY_TX` or
the `TX_AUTHORIZE_OPTIONS_*` keys. Instead it saves the alias `options-throwaway` and writes
`THROWAWAY_OPTIONS_ID`, `THROWAWAY_DEPLOY_TX`, `THROWAWAY_WASM_SHA256`, `THROWAWAY_DEPLOYED_AT`,
`TX_DEPLOY_THROWAWAY` and `TX_AUTHORIZE_THROWAWAY_{RWA,BOND}`. The new instance is still authorized on RWA and
BOND (through `03-authorize-contract.sh <id> AUTHORIZE_THROWAWAY`). Each run creates a new id. A throwaway id is
never pasted into AGENTS.md and the frontend never points at it.

## Issuer-action demo (`issuer-demo-testnet.sh`)

This script records the failure modes of `docs/contract-abi.md` §6 on chain, with PASS/FAIL accounting like the
smoke run. Expected failures are simulated only (`--send=no`, no fee) and pass only with the exact code. Every
submitted tx is printed (`TX <label> <hash>` plus a stellar.expert link) and listed again in the summary. Full
output goes to `scripts/out/issuer-demo-<UTC time>.log`.

| Part | Contract | Issuer action (strata-rwa-issuer on the RWA SAC) | Recorded outcome |
|---|---|---|---|
| A1 | main `OPTIONS_ID` | `set_authorized(investor, false)` on an Active PUT | `exercise` fails with SAC `Error(Contract, #11)` "balance is deauthorized"; after re-authorization exercise and `claim_delivery` succeed |
| A2 | main | `set_authorized(contract, false)` on an Offered PUT | `buy` fails with `#105 ContractNotAuthorized`; `cancel_offer` still returns the USDx collateral; re-authorized, `is_eligible(RWA, contract)` is true again |
| A3 | main | `set_authorized(maker2, false)` (writer) on an Active PUT | holder `exercise` succeeds and the holder is paid; `claim_delivery` fails with SAC `#11` until maker2 is re-authorized, then succeeds |
| B | **throwaway** (fresh `deploy.sh --throwaway`) | `clawback(contract, 1 RWA)` under a 3 RWA covered CALL | `open_collateral(RWA) > balance(contract)`; `buy` and a new RWA `create_offer` fail with `#115 CollateralShortfall`; a BOND PUT `create_offer` still succeeds; issuer repays 1 RWA (SAC `transfer` from the issuer, i.e. a mint; `mint` as fallback) and `buy` succeeds |

```sh
scripts/deploy/issuer-demo-testnet.sh                 # A then B (B deploys a new throwaway instance)
scripts/deploy/issuer-demo-testnet.sh --part-a-only   # main contract only, reversible steps
scripts/deploy/issuer-demo-testnet.sh --part-b-only [--wasm <path>]
```

Part A undoes every issuer action in the same run. After a failed step or Ctrl-C, an EXIT trap re-authorizes
investor, maker1, maker2, the main contract and the throwaway contract on RWA. It also cancels any offer the run
left in `Offered` state on the main contract. (The log `tee` ignores SIGINT so the trap can still run on Ctrl-C.)
A SIGKILL or a closed terminal can skip the trap; re-running the script re-authorizes everyone in its PRE step, but
offers left open by the killed run must then be cancelled by hand. In the recorded runs the main contract was
de-authorized for about 10 s (A2), the investor for 5–10 s (A1) and maker2 for about 20 s (A3), so do not run it
while someone is demoing on the same contract. `DRY_RUN` is not supported: the script exists to produce real transactions.

> **Never run a clawback against the main demo contract.** The contract pools one SAC balance per token for
> all options. A clawback creates a deficit (`open_collateral > balance`) that stays until the issuer pays the
> tokens back. Until then `create_offer`/`buy` on that token fail with `#115` for everyone, and existing positions
> settle first-come-first-served, so the last claimant takes the loss. `issuer-demo-testnet.sh` only claws back
> from a fresh throwaway instance and refuses if that id equals `OPTIONS_ID`.

## Demo order book (`seed-demo-offers.sh`)

```sh
scripts/deploy/seed-demo-offers.sh --contract <C-id> [--hours 48]
```

`--contract` is required and must be a `C…` id; the script never takes it from `testnet.env`, so the book lands on
the contract the frontend actually uses. It sends four real `create_offer` txs, all with expiry `now + hours*3600`:

| | Writer | Type | Underlying | qty | strike_total | premium_total |
|---|---|---|---|---|---|---|
| a | `strata-maker1` | Put | RWA | 50000000 (5) | 500000000 (50 USDx) | 10000000 (1.0 USDx) |
| b | `strata-maker2` | Put | RWA | 50000000 (5) | 500000000 (50 USDx) | 8000000 (0.8 USDx): competing quote on the same series as (a) |
| c | `strata-maker1` | Call | RWA | 30000000 (3) | 300000000 (30 USDx) | 5000000 (0.5 USDx) |
| d | `strata-maker2` | Put | BOND | 50000000 (5) | 500000000 (50 USDx) | 12000000 (1.2 USDx) |

It first checks that the RWA and BOND SACs authorize the contract (otherwise run `03-authorize-contract.sh <id>`).
It prints each new option id and tx hash, then `list_open` and `get_option` for every id, and exits 1 unless all
four read back `Offered` with the expected terms. Output goes to `scripts/out/seed-<UTC time>.log`.

**Not idempotent by design:** every run adds four new offers (ids continue from `option_count`) and locks more maker
collateral. To withdraw an offer, its writer cancels it while it is still `Offered`; the script prints this command
for each id it creates:

```sh
stellar contract invoke --id <C-id> --network testnet --source-account strata-maker1 \
  -- cancel_offer --writer <MAKER1 G-address> --id <option id>
```

## TTL keeper (`extend-ttl.sh`)

```sh
scripts/deploy/extend-ttl.sh                 # OPTIONS_ID
scripts/deploy/extend-ttl.sh <contract-id>   # e.g. THROWAWAY_OPTIONS_ID or the old v1 id
DRY_RUN=1 scripts/deploy/extend-ttl.sh       # read the book, print the extend_ttl calls, send nothing
```

The keeper reads `option_count`, calls `get_option` for every id and collects those in state `Offered`, `Active` or
`Exercised` (the ones that still hold funds). It then calls `extend_ttl(ids)` from `strata-deployer` in batches of
20. With no live option it still sends one `extend_ttl([])`, which extends the contract instance and code. The
contract bumps an entry to 30 days only when its TTL is below 7 days (§8), so the keeper is idempotent and safe to
run from cron (daily is plenty). It prints the instance `live_until_ledger` before and after, plus every tx hash.
Output goes to `scripts/out/extend-ttl-<UTC time>.log`. An option whose entry is already archived cannot be
extended; the keeper reports it and exits 1.

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
- [ ] `scripts/setup-testnet/verify.sh` passes (it also checks the contract authorization once `OPTIONS_ID` is set;
      if a rehearsal left a demo balance below target, re-run `scripts/setup-testnet/02-assets.sh` first).
- [ ] `scripts/deploy/smoke-testnet.sh` ends with `P0: PASS` and `P0+: PASS` (PUT/CALL lifecycles on RWA and BOND,
      expected contract errors in simulation, expiry/reclaim, maker competition). Full log in `scripts/out/smoke-*.log`.
