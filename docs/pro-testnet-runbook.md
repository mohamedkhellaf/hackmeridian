# Strata Pro (experimental): Testnet runbook for Dev 2

Stellar **TESTNET ONLY**. Fictional `USDx` quote token, fictional `EQTY` underlying label (cash-settled: no underlying
token exists on chain). The publisher (risk snapshots and settlement price) and the vault's seed capital are
**team-operated**; nothing here is an oracle, third-party liquidity or a Mainnet/production claim.

## 1. Prerequisites (your machine)

- `stellar` CLI 28.1.0 (`stellar --version`), `jq`, `curl`, `python3` with `numpy` (`python3 -c "import numpy"`).
- `scripts/out/testnet.env` from the team (written by `scripts/setup-testnet/01-identities.sh` + `02-assets.sh`);
  it must contain `USDX_ISSUER=GAE6ONGU5S3JHDBR5Z3BUVXCL4WLEHQVLBDNTCKHKOYFBYBPBW4IARFS`.
- In your CLI keystore (`stellar keys ls`): `strata-deployer` (pays the deploy) and `strata-usdx-issuer` (funds the demo
  accounts with USDx). The six `strata-pro-*` identities are created by `deploy-pro.sh` if missing.
- The `pro` crate compiles: `cargo test -p pro` green (contract owner's gate, brief §7) before deploying.

## 2. The three commands

```sh
# 1) deploy (~1 min): identities, build, deploy with alias "pro", constructor args, evidence header
scripts/deploy/deploy-pro.sh                  # DRY_RUN=1 ... prints every command and sends nothing
#    -> prints PRO_ID + deploy tx, writes PRO_* to scripts/out/testnet.env, creates docs/pro-testnet-evidence.md

# 2) one publisher snapshot by hand (optional sanity check; prints one line of JSON)
python3 scripts/deploy/pro-snapshot.py --series-id 0 --strike 110 --expiry $(( $(date +%s) + 900 )) --spot 100 --seq 1

# 3) evidence run (~20 min: ~5 min of txs + the wait for the 15-minute series to expire)
scripts/deploy/pro-demo.sh                    # [--expiry-minutes 15] [--settlement-price 175] [--skip-funding]
```

`deploy-pro.sh` constructor: `--admin strata-pro-admin --publisher strata-pro-publisher --quote <USDx SAC>
--cfg '<MarketConfig JSON>'` with the `MarketConfig()` defaults of `packages/risk/pro_v0_model.py`
(`psr_bps 1500, ext_mult 2, short_min_bps 500, im_bps 12500, max_age 3600, max_series_oi 50000, max_writer_oi 20000,
bonus_bps 500, reserve_fee_bps 1000, settle_window 86400, exercise_max_age 120`). `pro-snapshot.py` uses the same
defaults, so an on-chain snapshot check and the Python publisher agree; override both consistently or not at all
(`PRO_QUOTE_SAC` / `PRO_DEPLOYER` env vars for the deploy; `--psr-bps ...` flags of pro-snapshot.py; contract args use underscores, e.g. `--series_id`, as the CLI exposes them).

### What `pro-demo.sh` does (and why this order)

One **15-minute** series (strike 110 USDx) so settlement is recorded in the same run. Two offers of 10 lots: A is
exercised early while the maker is healthy, B rides into the gap and is taken over by the vault. Amounts were
replayed against `packages/risk/pro_v0_model.py` (`check_invariants` green):

| # | step | signer | expected |
|---|---|---|---|
| 0 | USDx trustline + payment to maker (1000), holder (500), lp (5000); `lp_deposit` 2000 USDx | usdx-issuer, lp | vault cash 2000 (**team seed capital**) |
| 1 | `list_series(strike 1100000000, expiry now+15 min)` | admin | series id |
| 2 | `publish_risk` spot 100, seq 1 | publisher | mark rounds to 0 at this tenor |
| 3 | `deposit` 850 USDx | maker | |
| 4 | `create_offer` A, B: qty 10, premium `max(mark×10×1.1, 10 USDx)` = 10 USDx | maker | offer ids |
| 5 | `buy` A, `buy` B | holder | position ids; maker IM ≈ 500 ≤ NLV ≈ 868 |
| 6 | `publish_risk` spot 112, seq 2; `exercise(A)` within 120 s | publisher, holder | due 20 USDx paid by the maker (NLV ≈ 828 ≥ MM ≈ 703) |
| 7 | `publish_risk` spot 160, seq 3; `liquidate(maker, taker = vault)` | publisher, keeper | maker NLV ≈ 348 < MM ≈ 502; x = 10 × 50 × 1.05 = 525 USDx moved to the vault's reserve for book B |
| 8 | wait ≥ expiry; `publish_settlement` 175; `settle(book B)`; `settle_vault`; `claim(B)` | publisher, keeper, holder | due 650; 525 from the reserve + **125 paid by the vault** (`settle_vault`); holder claims 650 |

Every tx prints `TX <STEP> <hash>`; rows `| op | tx hash |` are appended to `docs/pro-testnet-evidence.md` (also on a
failed run, for the steps that went through). Full output: `scripts/out/pro-demo-<UTC>.log`. Re-running creates a new
series and new offers on the same contract (the old series stays until its TTL lapses).

## 3. What to paste

**AGENTS.md "Deployed contracts (TESTNET ONLY)"**: `deploy-pro.sh` prints the row; the shape is

```
| pro v0 EXPERIMENTAL, cash-settled margin calls (deploy tx `<PRO_DEPLOY_TX>`, wasm sha256 `<first 16 hex>…`; admin `<G...>`, publisher `<G...>`, quote USDx SAC) | pro | `<PRO_ID>` | strata-deployer `GBVPEL6MT4IZ4XL5J7TTMB3GND7TPRS54KOJTUFCUOVFVFPZKE5HDA73` |
```

**README.md** (section "Strata Pro (experimental)"), after the evidence run:

```
Strata Pro is an EXPERIMENTAL cash-settled margin layer on TESTNET (contract `<PRO_ID>`), separate from the fully
collateralized options contract. The risk publisher and settlement price are operated by the team (not an oracle) and
the backstop vault holds team seed capital, not third-party liquidity. Evidence: docs/pro-testnet-evidence.md
(list_series, publish_risk, deposit, buy, exercise, liquidation to the vault, publish_settlement, settle, settle_vault, claim).
```

Also update `docs/pro-testnet-evidence.md` by hand only to add commentary; the tables are script-generated.

## 4. Troubleshooting

| symptom | cause / fix |
|---|---|
| `stellar keys generate ... --fund` or `keys fund` fails, account never appears | friendbot rate limit or outage. Wait a minute and re-run `deploy-pro.sh` (idempotent: existing identities and funded accounts are skipped). Or fund by hand: `curl "https://friendbot.stellar.org/?addr=<G>"`. |
| `change-trust` / `payment` fails for maker/holder/lp | the account has no XLM yet (friendbot step skipped) or Horizon lagged. Check `https://horizon-testnet.stellar.org/accounts/<G>`; re-run with the same args (balances at target are not re-paid). |
| `payment` fails with `op_no_trust` | trustline not yet visible: Horizon lag. Re-run `pro-demo.sh`; the trustline step is skipped once it exists. |
| `Error(Contract, #207)` **StaleSnapshot** on `publish_risk` | `snap.ts` is in the future for the ledger (local clock ahead) or older than `max_age` (3600 s). The script passes `--now` = local time − 10 s; if your clock is off, fix it (`date -u`) and re-run. |
| `#207` **StaleSnapshot** on `exercise` | more than `exercise_max_age` = 120 s passed between `publish_risk` and `exercise` (slow RPC). Re-publish (next seq) and exercise immediately: `publish_risk` then `exercise` by hand with the printed commands. |
| `#208` **BadSnapshot** | `seq` not increasing or `ts` before the previous snapshot: use a higher `--seq`; or a config mismatch between the deployment and `pro-snapshot.py` (`smin`/`ra[14]` floors): deploy and snapshot must use the same `MarketConfig`. |
| `#205` **SeriesExpired** before step 7 | the run was slower than `--expiry-minutes`. Re-run with `--expiry-minutes 20`. |
| `#224` **LiquidateFirst** on `exercise` | maker already below MM at spot 112 (should not happen with the 850 USDx deposit; happens if the deposit step failed). Check `get_requirement`. |
| `#211` **NotLiquidable** on `liquidate` | maker still NLV ≥ MM at 160 (e.g. a previous run left extra cash in the maker account). Re-run on a fresh deploy, or publish a larger gap by hand (`pro-snapshot.py --spot 200`, next seq). |
| `#214` **SettlementWindowClosed** on `publish_settlement` | more than `settle_window` = 86400 s after expiry. The series can no longer be priced; list a new series (re-run the demo). For the demo this only happens if the run is resumed a day later. |
| `#206` **NotExpired** | `publish_settlement` sent before the ledger close time passed `expiry`; the script waits for RPC `latestLedgerCloseTime`, so just retry. |
| `#213` **NoSettlementPrice** on `settle`/`claim` | run `publish_settlement` first (publisher only). |
| `#209` **InsufficientMargin** on `buy` | the maker's deposit did not land, or amounts were changed. Keep the script's amounts or re-verify them with `packages/risk/pro_v0_model.py`. |
| `#221` **RoleNotAllowed** | admin or publisher used as maker/holder/lp. Roles are distinct identities on purpose. |
| `liquidate` fails on the `--taker` encoding | the script tries `--taker` omitted then `--taker null`. If both fail, run `stellar contract invoke --id pro --network testnet --source-account strata-pro-keeper -- liquidate --help` and use the shape it prints. |
| `get_requirement` view "read failed" | the `Writer` enum encoding: the script tries `{"Account":"G..."}` then `["Account","G..."]`; `"Vault"` for the vault. Views never abort the run. Check `-- get_requirement --help`. |
| deploy succeeds but `admin()`/`publisher()` reads fail | harmless (reads are informational); check `stellar contract invoke --id pro --network testnet --source-account strata-deployer --send=no -- admin`. |

## 5. After the run

- Confirm two or three hashes on `https://stellar.expert/explorer/testnet/tx/<hash>` (`successful: true`).
- Paste the AGENTS.md row and the README paragraph (section 3) in the same PR as the contract.
- TTL: the contract's `extend_ttl(series_ids, book_ids, pos_ids)` exists; the Pro demo state must stay readable through
  October 28 (the deploy's default TTL covers that; extend only if the frontend reads old series).
- Do not publish the `strata-pro-*` or issuer secrets anywhere; `scripts/out/` is git-ignored and `env_set` refuses
  to write anything shaped like a secret seed.

## 6. Keeping the demo live (UI recording)

Deployed contract `CBZNS63L23N3Y3GHU6H57AU6OVZ3FOAPM7Z54ATDRC472Q5DWV6UVKCN` (pro v0.3.2). The evidence run's series 0
is expired and settled; the UI demo uses **series 1**, listed after that run:

| item | value |
|---|---|
| series 1 | strike 110 USDx (`1100000000`), expiry `1793188800` = 2026-10-28T12:00:00Z, list tx `cbc4a798a11975ea2948b59762b2e3a624c96ef302bf2504f40c060b6025b963` |
| offer 2 | writer strata-pro-maker, qty 2, premium 3 USDx, quote expiry = series expiry, tx `c2ebb4b03e1309d35b41ece7894e517ca486f7d2659b4854e47c072b0db06fe3` |
| offer 3 | writer strata-pro-maker, qty 5, premium 7 USDx, quote expiry = series expiry, tx `67f282668cd5ef7027b8485a47b9b37d50b2bfd72aa9d2c1058c1e67e6de802a` |
| maker margin | 323 USDx free cash after the evidence run; a `buy` of offer 3 simulates successfully (`--send=no`) |

A risk snapshot is valid for `max_age` = 3600 s (buys and margin checks fail with `#207 StaleSnapshot` after that) and
early exercise needs one at most `exercise_max_age` = 120 s old. **Every few minutes while recording**, and right before
showing an exercise, run from the repo root (needs `strata-pro-publisher` in the CLI keystore and
`scripts/out/testnet.env` with `PRO_ID`/`PRO_PUBLISHER`):

```sh
scripts/deploy/pro-refresh-risk.sh                 # series 1, strike 110, expiry 1793188800, spot 110 (ATM)
scripts/deploy/pro-refresh-risk.sh --spot 125      # move the team-operated price (in the money)
```

Without the script, the same thing as one command (seq = Unix time, so it is always strictly increasing):

```sh
stellar contract invoke --id CBZNS63L23N3Y3GHU6H57AU6OVZ3FOAPM7Z54ATDRC472Q5DWV6UVKCN --network testnet \
  --source-account strata-pro-publisher -- publish_risk \
  --publisher GDY257DGQREP4NLM2DF2YUS5M2VHRW3JNDK2YYHZP55SMW3FMAUHZUVN \
  --snap "$(python3 scripts/deploy/pro-snapshot.py --series-id 1 --strike 110 --expiry 1793188800 --spot 110 \
            --seq $(date +%s) --now $(( $(date +%s) - 10 )))"
```

Spot is whatever the operator types (team-operated publisher, not a market feed): say so on screen. A large jump
(e.g. `--spot 200`) can make the maker liquidatable once positions exist; that is a feature to demo, not an accident
to hide. After 2026-10-28T12:00Z series 1 is expired: `publish_settlement` must then be sent by the publisher within
24 h, or list a new series (`list_series` from strata-pro-admin) and pass its id/strike/expiry to the script.

TTL: every write extends the entries it touches to 30 days and `extend_ttl(series_ids, book_ids, pos_ids)` is
permissionless; nothing needs extending before October 28.

## Known limits of this build (from the Dev 2 security pass, no action needed for judging)

- Persistent entries (accounts, offers, LP shares) are extended on every write but are not covered by `extend_ttl`; they live 30 days after their last write, which covers judging (28 Oct). Series, snapshots, books, positions, the vault and the instance are covered by `extend_ttl`.
- `get_requirement` for a writer with an expired, unpriced short reads the latest snapshot of every series ever listed on the deployment (the model's `_latest_snap`). Fine for the demo (a handful of series); a v1 item for long-lived deployments. See brief §10 "Contract build notes".
