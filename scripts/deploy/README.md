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
   The constructor list is immutable. From v1.3 on, more classic assets can be added after deploy with the
   permissionless `list_asset` (`docs/contract-abi.md` §12), but the quote token and the constructor list never change.
   **`EQTY` is deliberately not in the constructor**: it is the v1.3 listing demo asset, listed by the smoke run.
3. **Authorize** the new contract on the constructor underlyings (`scripts/setup-testnet/03-authorize-contract.sh <id>
   <label> RWA BOND`): `set_authorized(<contract>, true)` from `strata-rwa-issuer` on the RWA and BOND SACs. Without
   it `create_offer` fails with `ContractNotAuthorized`. `deploy.sh` never authorizes the contract on EQTY: the v1.3
   smoke run first checks that `create_offer` on EQTY fails with #105, then authorizes it.
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
scripts/deploy/smoke-testnet.sh --no-v13        # same, without V1.3 / V1.3.1 (contract v1.3 or older)
scripts/deploy/smoke-testnet.sh --no-v14        # same, without V1.4 resale (contract v1.3.1 or older)
scripts/deploy/smoke-testnet.sh --full          # V1.3 also fills maker2 to the 50-offer per-writer cap (see below)
scripts/deploy/deploy.sh --throwaway            # second instance for destructive demos; OPTIONS_ID untouched
scripts/deploy/issuer-demo-testnet.sh           # issuer freeze / de-authorize / clawback failure modes (real txs)
scripts/deploy/extend-ttl.sh                    # TTL keeper: extend_ttl over every non-terminal option
```

Transaction hashes are printed as `TX <STEP> <hash>` and appended to `scripts/out/tx-log.tsv`.

## Smoke run sections

`smoke-testnet.sh` runs PRE (config, eligibility), P0 (RWA PUT lifecycle, expected contract errors, expiry/reclaim,
maker competition), P0+ (covered CALL, BOND PUT), V1.2 (holder transfer, `get_options` paging), V1.3 and V1.3.1.
Expected failures are simulated only (`--send=no`, no fee) and pass only with the exact error code. `DRY_RUN` is
refused: every step is a real testnet transaction. `--p0-only` stops after P0; `--no-v13` skips V1.3 and V1.3.1. The
V1.3 section uses the v1.3.1 `prune_expired(pruner, ids)` signature, so it needs a v1.3.1 contract: against a v1.2
contract (no `asset_count`) or a v1.3 contract (no `list_open_for`, no `pruner` argument) the V1.3-0 probe fails and
the rest of both sections is reported as not reached.

### V1.4 (on-chain resale, needs contract v1.4; `docs/contract-abi.md` §14)

One RWA PUT (maker1 writes, investor buys), resold on chain. Runs after V1.3.1; skip it with `--no-v14`.

| Check | What happens | Pass condition |
|---|---|---|
| `RESALE_CREATE`, `RESALE_BUY_PRIMARY` | maker1 PUT (5 RWA, strike 50 USDx), investor buys | `Active`, holder investor |
| `FAIL_RESALE_LIST_OFFERED` / `FAIL_RESALE_NO_ASK` / `FAIL_RESALE_LIST_NOT_HOLDER` / `FAIL_RESALE_LIST_ZERO` | list an `Offered` option / buy before any ask / maker2 lists investor's option / ask 0 | #106 / #120 / #108 / #102 |
| `RESALE_LIST`, `RESALE_LIST_EVENT`, `RESALE_GET_ASK`, `RESALE_LIST_ASKS`, `RESALE_LIST_BAL` | investor `list_for_sale(ask 2 USDx)` | `ask_listed` event, `get_ask` = ask, `list_asks(id, 1)` = `[{id, investor, ask}]`, no balance moves |
| `FAIL_RESALE_SELF` / `FAIL_RESALE_WRITER` / `FAIL_RESALE_NOT_ELIGIBLE` / `FAIL_RESALE_PRICE_MOVED` | buy_resale by the holder / the writer / the outsider / maker2 with `max_total = ask - 1` | #111 / #111 / #104 / #121 |
| `RESALE_BUY`, `RESALE_BUY_EVENT`, `RESALE_BUY_STATE`, `RESALE_BUY_BAL`, `RESALE_ASK_GONE` | maker2 `buy_resale(max_total = ask)` | `resale_bought` event, holder maker2, maker2 −ask USDx, investor +ask USDx, nothing else moves, ask gone |
| `FAIL_RESALE_AGAIN` / `FAIL_RESALE_OLD_HOLDER` | second buy of the same ask / old holder exercises | #120 / #108 |
| `RESALE_RELIST`, `FAIL_RESALE_CANCEL_NOT_HOLDER`, `RESALE_CANCEL*`, `FAIL_RESALE_CANCEL_AGAIN`, `FAIL_RESALE_AFTER_CANCEL` | maker2 lists, investor tries to cancel, maker2 cancels, cancels again, investor buys | tx / #108 / `ask_cancelled` and ask gone / #120 / #120 |
| `RESALE_EXERCISE*`, `RESALE_CLAIM*` | maker2 (new holder) exercises, maker1 claims | ABI §2 deltas |

### V1.3 (needs contract v1.3.1 and the EQTY asset from `02-assets.sh`)

| Check | What happens | Pass condition |
|---|---|---|
| `V13_INTERFACE` + `V131_INTERFACE` | `asset_count()`, then `list_open_for(RWA, 0, 1)` | readable u32 / id array (else the rest of V1.3 and V1.3.1 is skipped and fails) |
| `V13_LIST` | maker1 `list_asset(lister=maker1, code=EQTY, issuer=rwa-issuer)` | tx succeeds, `asset_listed` event, returned address `== EQTY_SAC` |
| `V13_IS_LISTED`, `V13_LIST_ASSETS`, `V13_ASSET_COUNT` | views | `is_listed(EQTY)`, `list_assets(0,50)` contains EQTY and starts with `[RWA, BOND]`, `asset_count() >= 3` and equals the length of `list_assets` paged to the end (anyone may list, so the total is not fixed) |
| `V13_FAIL_ALREADY_LISTED` / `V13_FAIL_LIST_QUOTE` | list EQTY again / list `USDx` | #117 `AlreadyListed` |
| `V13_FAIL_NOT_DEPLOYED` | list `Z???????:<usdx-issuer>`, a random code per run (its SAC is checked to be undeployed first) | #118 `AssetNotDeployed` |
| `V13_FAIL_BAD_CODE` / `V13_FAIL_ISSUER_NOT_ACCOUNT` | code `bad code!` / issuer = a contract address | #102 `InvalidArgs` |
| `V13_FAIL_CONTRACT_NOT_AUTHORIZED` | `create_offer` on EQTY before the issuer acts | #105 `ContractNotAuthorized` |
| `V13_AUTHORIZE_EQTY` | `scripts/setup-testnet/03-authorize-contract.sh <OPTIONS_ID> EQTY` | exits 0; `is_eligible(EQTY, contract)` true, outsider false |
| `V13_EQTY_PUT_*` | maker1 PUT on EQTY: create → investor buy → exercise → claim_delivery | state and exact balance / `open_collateral` deltas after every step |
| `V13_FAIL_TENOR` / `V13_TENOR_INSIDE_SIM` | `create_offer` with expiry now + 3 years / now + 2 years − 1 h | #119 `TenorOutOfRange` / simulation succeeds |
| `PRUNE_LIVE_*` | maker2 `prune_expired(pruner=maker2, [live id])`, signed by maker2, on a 1 h offer, then maker1 cancels it | returns 0, offer stays `Offered` and in RWA's open book (`list_open_for`), no balance moves |
| `PRUNE_*` | maker1 45 s offer nobody buys; after expiry maker2 `prune_expired(pruner=maker2, [id])`, signed by maker2 | returns 1, `offer_pruned` event, state `Expired`, maker1 gets the USDx back (maker2 gets nothing), `writer_open_count(maker1)` −1, gone from RWA's open book; pruning it again returns 0; an unknown id fails with #101 |
| `CAP_*` (`--full` only) | maker2 creates dust PUTs (1 unit each) up to `writer_open_count == 50`, then one more | #116 `WriterOpenLimit` on the 51st; maker1 can still create (simulated); every dust offer is cancelled and the count returns to its start value |

Listing and authorizing EQTY are one-time steps per contract. On a re-run against the same contract,
`V13_LIST` and `V13_FAIL_CONTRACT_NOT_AUTHORIZED` are reported as `SKIP` (the summary line counts skips separately)
and `V13_AUTHORIZE_EQTY` passes without a transaction. The first run on a freshly deployed contract is the one
that records the listing evidence.

### V1.3.1 (per-asset open books and the pruner argument, `docs/contract-abi.md` §13)

Each underlying has its own open book (`list_open_for(asset, from, limit)`, at most 50 ids per page); `list_open()`
returns the books concatenated in registry order, truncated to 200 ids. The checks read whole books page by page and
compare them with `get_options` over every id, so they do not depend on how many offers earlier runs left open.

| Check | What happens | Pass condition |
|---|---|---|
| `V131_OPEN_FOR_CANCELLED` | after maker1 cancels the `PRUNE_LIVE` offer | the id is no longer in RWA's open book |
| `V131_OPEN_FOR_PAGE`, `V131_OPEN_FOR_ORDER` | `list_open_for(RWA, 0, 50)` | an id array of at most 50, strictly ascending (oldest first) |
| `V131_LIST_OPEN_PREFIX` | `list_open()` | starts with exactly `list_open_for(RWA, 0, 50)` (RWA is registry entry 0) |
| `V131_OPEN_FOR_HAS_OFFER` / `V131_OPEN_FOR_OTHER_ASSET` | the unsold prune-path PUT (normally already past expiry) | in RWA's book / not in BOND's book |
| `V131_OPEN_FOR_PAST_END` / `V131_OPEN_FOR_CAP` | `list_open_for(RWA, <book length>, 50)` / `list_open_for(RWA, 0, 1000)` | `[]` / `min(book length, 50)` ids |
| `V131_OPEN_FOR_UNLISTED` | `list_open_for(USDx, 0, 50)` | `[]` (the quote token is never an underlying) |
| `V131_BOOKS_<when>` | every registry asset's whole book vs `get_options` over every id, before (`OPEN`) and after (`PRUNED`) the prune, and at the writer cap (`CAP`, `--full`) | each book is exactly the ids of that asset's options in state `Offered`, oldest first |
| `V131_LIST_OPEN_CONCAT_<when>` | `list_open()` at the same moments | equals the books concatenated in `list_assets` order, first 200 ids |
| `V131_PRUNE_EVENT_PRUNER` | the `offer_pruned` event of `PRUNE_EXPIRED` | `pruner` is maker2's `G…` address (v1.3 emitted the contract's own id) |
| `V131_CAP_BOOK` (`--full` only) | RWA's book while maker2 is at the writer cap | every dust id is in it; the first page holds `min(book length, 50)` ids (a multi-page read) |

**Per-writer vs per-asset cap.** `--full` demonstrates the per-**writer** cap: #116 `WriterOpenLimit` on maker2's 51st
open offer. The per-**asset** cap (#114 `OpenListFull`, `MAX_OPEN_PER_ASSET = 500` ids in one underlying's book) cannot
be reached by one writer: it takes 10 issuer-authorized writers at the 50-offer writer cap (500 `create_offer` plus
500 `cancel_offer` transactions), so it is covered by the contract unit tests (`contracts/options/src/test.rs`), not
on testnet. By design (§6, §13.3) the cap is per asset since v1.3.1, so dust offers on one asset (for example a
self-listed unflagged asset) can only fill that asset's book, not RWA's.

**`--full` cost.** Up to 50 `create_offer` and 50 `cancel_offer` transactions from `strata-maker2` (fewer if maker2
already has open offers), about 2 test XLM in fees (measured on v1.2: `create_offer` about 0.038 XLM including the
30-day rent of the new option entry, `cancel_offer` about 0.0012 XLM) and 10–20 minutes. Each dust offer locks 1 unit
(0.0000001) of USDx. An EXIT trap cancels the dust offers if the run dies halfway; if that also fails, the run
prints the `cancel_offer` command for each leftover id. It is off by default because it adds nothing to the demo
beyond the #116 evidence and the multi-page book read.

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
| B | **throwaway** (fresh `deploy.sh --throwaway`) | `clawback(contract, 1 RWA)` under an Offered 3 RWA covered CALL and an Active 1 RWA covered CALL held by the investor | `open_collateral(RWA) > balance(contract)`; `buy`, a new RWA `create_offer` and (v1.3.1) the investor's `transfer` of the Active CALL to maker2 fail with `#115 CollateralShortfall`; a BOND PUT `create_offer` still succeeds; issuer repays 1 RWA (SAC `transfer` from the issuer, i.e. a mint; `mint` as fallback); then the `transfer` succeeds (holder = maker2, still `Active`) and `buy` succeeds |

```sh
scripts/deploy/issuer-demo-testnet.sh                 # A then B (B deploys a new throwaway instance)
scripts/deploy/issuer-demo-testnet.sh --part-a-only   # main contract only, reversible steps
scripts/deploy/issuer-demo-testnet.sh --part-b-only [--wasm <path>]
```

Part B deploys the wasm built from this checkout (or `--wasm <path>`). `B_FAIL_TRANSFER_SHORTFALL` needs the v1.3.1
transfer guards (`docs/contract-abi.md` §3 `transfer`, §13.2): a v1.3 or older wasm accepts the transfer during the
deficit and that check fails. Part A does not depend on the contract version.

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

## TTL keeper (`extend-ttl.sh`)

```sh
scripts/deploy/extend-ttl.sh                 # OPTIONS_ID
scripts/deploy/extend-ttl.sh <contract-id>   # e.g. THROWAWAY_OPTIONS_ID or the old v1 id
DRY_RUN=1 scripts/deploy/extend-ttl.sh       # read the book, print the extend_ttl calls, send nothing
```

The keeper reads `option_count`, calls `get_option` for every id and collects those in state `Offered`, `Active` or
`Exercised` (the ones that still hold funds). It then calls `extend_ttl(ids)` from `strata-deployer` in batches of
20. With no live option it still sends one `extend_ttl([])`, which extends the contract instance and code. On
v1.3.1 each call also extends, for every id, its underlying's `Listed` and `OpenFor` (open book) entries and its
writer's `WriterOpen` entry, plus the first 50 registry entries (`AssetAt` and their `Listed`; §13.5); a 20-id batch
stays far below the testnet footprint limit of 400 entries per transaction. The
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
      expected contract errors in simulation, expiry/reclaim, maker competition), `V1.2: PASS` and, on v1.3.1,
      `V1.3: PASS` with 0 skipped on the first run (EQTY listing, #105 before the issuer authorizes the escrow, EQTY
      PUT, tenor cap, prune with `pruner = maker2`) and `V1.3.1: PASS` (per-asset open books, `list_open`
      consistency, pruner in the event). Run `--full` once to record the #116 writer-cap evidence. Full log in
      `scripts/out/smoke-*.log`.
- [ ] `scripts/deploy/issuer-demo-testnet.sh` passes on the new wasm (part B records the v1.3.1 transfer guard).

## Pro (experimental)

`contracts/pro` is the EXPERIMENTAL cash-settled margin layer (brief `docs/pro-v0-brief-dev2.md`). It is deployed
separately from `options`, with its own identities (`strata-pro-{admin,publisher,keeper,maker,holder,lp}`) and the
existing USDx SAC as quote token. The publisher and the vault's seed capital are team-operated. TESTNET only.

```sh
scripts/deploy/deploy-pro.sh                     # identities (friendbot), stellar contract build --package pro, deploy alias "pro"
DRY_RUN=1 scripts/deploy/deploy-pro.sh           # print every command; send and write nothing
python3 scripts/deploy/pro-snapshot.py --series-id 0 --strike 110 --expiry <unix> --spot 100 --seq 1   # publish_risk snap JSON
scripts/deploy/pro-demo.sh [--expiry-minutes 15] [--settlement-price 175]   # evidence run, ~20 min, real txs
```

`deploy-pro.sh` writes `PRO_ID`, `PRO_DEPLOY_TX`, `PRO_WASM_SHA256` and the `PRO_*` public keys to
`scripts/out/testnet.env`, prints the AGENTS.md row and creates `docs/pro-testnet-evidence.md`. `pro-demo.sh`
records list_series, publish_risk, deposit, buy, exercise, publish_risk at the higher price, liquidation to the vault,
publish_settlement, settle, settle_vault and claim as `| op | tx hash |` rows in that file. Step-by-step instructions,
the exact sequence and amounts, and troubleshooting (friendbot, trustlines, `StaleSnapshot`, `SettlementWindowClosed`)
are in `docs/pro-testnet-runbook.md`.
