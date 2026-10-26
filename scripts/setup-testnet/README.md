# Testnet setup (Stellar TESTNET only)

Creates the fictional demo world the `options` contract runs against (`docs/contract-abi.md` §6, §9).
Everything is Testnet-only: the assets are labels, not ownership claims, and the accounts hold no real value.

Requirements: `stellar` CLI 28.x, `curl`, `jq`, network access to friendbot, Horizon and Soroban RPC testnet.

## What gets created

| Identity (CLI keystore) | Role | Gets |
|---|---|---|
| `strata-rwa-issuer` | Regulated issuer of `RWA`, `BOND` and `EQTY`. Account flags `AUTH_REQUIRED`, `AUTH_REVOCABLE`, `AUTH_CLAWBACK_ENABLED`. Admin of all three SACs, so it can authorize, freeze and claw back. | — |
| `strata-usdx-issuer` | Issuer of the quote token `USDx`. **No flags**: issuer flags are account-wide, so the cash token needs its own issuer. | — |
| `strata-maker1`, `strata-maker2` | Option writers (competing makers) | trustlines + authorization on RWA/BOND/EQTY; 1000 RWA, 1000 BOND, 1000 EQTY, 100000 USDx each |
| `strata-investor` | Option buyer | same as a maker |
| `strata-outsider` | **Ineligible buyer demo**: has RWA/BOND/EQTY trustlines but is deliberately **not authorized** by the issuer | 100000 USDx, 0 RWA, 0 BOND, 0 EQTY |
| `strata-deployer` | Deploys the `options` contract | XLM only |

Assets: `RWA:<rwa-issuer>`, `BOND:<rwa-issuer>`, `EQTY:<rwa-issuer>`, `USDx:<usdx-issuer>`, all 7 decimals
(1 token = 10_000_000 units). A Stellar Asset Contract (SAC) is deployed for each one. The SAC id is derived from the
asset and the network passphrase, so it stays the same as long as the issuer keys stay the same.

`EQTY` (label: tokenized equity, fictional; no ownership claim) is the contract v1.3 listing demo asset
(`docs/contract-abi.md` §12). It is regulated like RWA and BOND but is deliberately **not** in the options
constructor and is **not** authorized on the contract by `deploy.sh`. On contract v1.3.1 the smoke run lists it with
`list_asset`, shows that `create_offer` on it fails with `ContractNotAuthorized` (#105), then has the issuer authorize
the escrow (`03-authorize-contract.sh <id> EQTY`) and settles a PUT on it. Its SAC must be deployed beforehand
(`list_asset` returns `AssetNotDeployed` #118 otherwise); `02-assets.sh` does that.

Outputs (git-ignored, public data only, never secrets):

- `scripts/out/testnet.env`: shell-sourceable `KEY=VALUE`. Public keys (`RWA_ISSUER`, `USDX_ISSUER`, `MAKER1`,
  `MAKER2`, `INVESTOR`, `OUTSIDER`, `DEPLOYER`), asset strings (`RWA_ASSET`, `BOND_ASSET`, `EQTY_ASSET`,
  `USDX_ASSET`), SAC ids (`RWA_SAC`, `BOND_SAC`, `EQTY_SAC`, `USDX_SAC`), network settings and one
  `TX_<STEP>=<hash>` line per transaction.
  `scripts/deploy/deploy.sh` adds `OPTIONS_ID` and `DEPLOY_TX`; `deploy.sh --throwaway` adds
  `THROWAWAY_OPTIONS_ID` and `THROWAWAY_DEPLOY_TX` instead.
- `scripts/out/tx-log.tsv`: every transaction hash the scripts saw, with timestamp, step and status.

Secret keys stay in the CLI keystore (`~/.config/stellar/identity/strata-*.toml`) on the machine that ran
`01-identities.sh`. They are never printed or written by these scripts.

## Run

```sh
scripts/setup-testnet/01-identities.sh   # create + friendbot-fund the 7 identities
scripts/setup-testnet/02-assets.sh       # flags, trustlines, authorizations, issuance, SACs (RWA, BOND, EQTY, USDx)
scripts/setup-testnet/verify.sh          # read-only check against Horizon; exits 1 on any mismatch
# once the options wasm exists:
scripts/deploy/deploy.sh                 # see scripts/deploy/README.md; runs 03-authorize-contract.sh itself
```

`03-authorize-contract.sh <options-contract-id> [label] [asset ...]` runs `set_authorized(<contract>, true)` from
`strata-rwa-issuer` on the SAC of each asset (default `RWA BOND`, the constructor underlyings; allowed `RWA`, `BOND`,
`EQTY`). It is needed after **every** contract deploy: without it `create_offer` fails with `ContractNotAuthorized`
(the contract cannot hold an `AUTH_REQUIRED` asset). `deploy.sh` calls it for RWA and BOND only. The optional label
names the env keys it records (`TX_<label>_<ASSET>`; default `AUTHORIZE_OPTIONS`); `deploy.sh --throwaway` passes
`AUTHORIZE_THROWAWAY` so the main contract's authorization txs are not overwritten. An asset name in second position
means "default label", so the v1.3 smoke run calls `03-authorize-contract.sh <id> EQTY` (env key
`TX_AUTHORIZE_OPTIONS_EQTY`). The script reads `authorized(<contract>)` first and skips assets already authorized.

## Issuer actions (freeze, de-authorize, clawback)

`strata-rwa-issuer` is the admin of the RWA, BOND and EQTY SACs, so it can call `set_authorized(<address>, false|true)`
(freeze/unfreeze an account or a contract) and `clawback(<address>, <amount>)`.
`scripts/deploy/issuer-demo-testnet.sh` records what each action does to the options contract (see
`scripts/deploy/README.md`). It re-authorizes every account it froze before it exits, even if a step fails.
If a manual freeze is left behind, `02-assets.sh` re-authorizes maker1, maker2 and investor (`verify.sh` reports
them as mismatches), and `03-authorize-contract.sh <id>` re-authorizes a contract.

> **Never claw back from the main demo contract (`OPTIONS_ID`).** The clawed tokens leave the contract's pooled
> balance, and the deficit stays until the issuer sends them back. Until then every `create_offer`/`buy` on that
> token fails with `CollateralShortfall` (#115). Clawback demos run only against a throwaway instance
> (`scripts/deploy/deploy.sh --throwaway`).

All scripts are idempotent and safe to re-run:

- existing identities and funded accounts are reused;
- flags, trustlines and authorizations that already exist are skipped;
- a balance **below the target is topped up to it**; a balance at or above it is left alone. A rehearsal moves
  tokens between the demo accounts, so re-running `02-assets.sh` tops up the ones that fell below target and
  leaves the rest above it (`verify.sh` requires `>=` target, an authorized trustline, and nothing more);
- if `strata-outsider` was authorized on RWA/BOND/EQTY during a demo (issuer-authorization scene), `02-assets.sh`
  revokes it again so the ineligible-buyer scene keeps working;
- existing SACs are detected and their ids resolved with `stellar contract id asset`.

Ordering matters on-chain and the script enforces it: the issuer flags are set **before** any RWA/BOND/EQTY
trustline exists. A trustline created before `AUTH_REQUIRED` is authorized automatically, and one created before
`AUTH_CLAWBACK_ENABLED` cannot be clawed back. EQTY was added later than RWA/BOND, on an issuer that already had
the flags, so its trustlines started unauthorized and clawback-enabled like the others (checked on Horizon).

`verify.sh` checks EQTY like RWA and BOND (holdings, outsider unauthorized, SAC deployed). It does **not** require
the options contract to be authorized on EQTY; it prints an `info` line instead, which reads `true` only after a v1.3
smoke run authorized the escrow on EQTY.

## One machine owns the keys

Run the setup once, on one machine. The resulting `scripts/out/testnet.env` contains only public data, so it can
be shared with the team (copy it to `scripts/out/testnet.env` in your checkout) and its ids go into the
**Deployed contracts** table in `AGENTS.md`. Running `01-identities.sh` on a second machine creates *different*
keys, hence different assets and SAC ids. Do not do that unless you mean to build a separate demo world.

To sign as a demo role in Freighter, the key owner can print a Testnet secret locally with
`stellar keys secret strata-investor` and import it into a Freighter Testnet account. Never commit, paste in chat,
or embed such a secret in the frontend.

## Reset after a Testnet wipe

SDF resets Testnet periodically; every account, trustline and contract disappears, but the local keystore stays.

```sh
rm -f scripts/out/testnet.env scripts/out/tx-log.tsv
scripts/setup-testnet/01-identities.sh   # same public keys, re-funded by friendbot
scripts/setup-testnet/02-assets.sh       # same asset strings and SAC ids (same issuers), new tx hashes
scripts/setup-testnet/verify.sh
scripts/deploy/deploy.sh                 # NEW options contract id: update AGENTS.md and regenerate bindings
```

To start a completely fresh world (new keys), first remove the identities:
`for i in rwa-issuer usdx-issuer maker1 maker2 investor outsider deployer; do stellar keys rm strata-$i; done`.

## Troubleshooting

- Horizon can lag the ledger by a few seconds. The scripts only use Horizon to decide what to skip; every write
  goes through the CLI, so a re-run after a lagging read is harmless (trustline and flag operations are idempotent;
  payments only top up). A failed Horizon read (429, 5xx, timeout) stops `02-assets.sh` with an error instead of
  being read as a missing trustline or a zero balance.
- Friendbot is rate-limited. If funding fails, wait a minute and re-run `01-identities.sh`.
- SAC error `#11` ("balance is deauthorized") on a contract call means the issuer has not authorized that address:
  run `03-authorize-contract.sh` for the contract, or `02-assets.sh` for the demo accounts.
