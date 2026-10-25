# Agent instructions

<!-- Keep this file short and current. -->

## Project

- **Name:** Backstop (working name; repo is `hackmeridian`)
- **Event:** HackMeridian, Lisbon, Oct 25–26 2026 (Stellar)
- **Category:** Genesis (new idea → working MVP)
- **Track:** Stellar Unlocked: classic asset controls (approval required, revocable, clawback) combined with Soroban custody
- **Deadline:** Mon Oct 26, 12:00 Lisbon (no late submissions). Feature freeze 06:00, submit by 11:00. Judged async on demo video, pitch deck, repo, and submission answers.
- **Pitch:** Fully collateralized, physically settled put and call options on permissioned tokenized funds. Collateral is locked in a contract nobody holds a key to, exercise swaps the fund token and USDC in one all-or-nothing transaction, and the fund's own Stellar rules decide who may trade.
- **Status:** Plan agreed; **do not start coding until the team says go.** Core flow already proven on testnet in a throwaway spike (`research/decision/20_rwa_options_spike.md`). Decision history: `WINNING_IDEAS.md`, `research/decision/`.

## Scope

- **T1 (must, by 21:00 Sun):** test fund token `FUND` with restrictions plus test USDC `USDx`; cash-secured put: write → buy → exercise → reclaim; hosted frontend on testnet.
- **T2 (must, by 01:00 Mon):** covered call (issuer approves the contract), eligibility checks, issuer panel (approve / freeze / claw back), competing writers, collateral-proof page, Impaired state with premium refund, tests + CI.
- **T3 (stretch, only if T2 is green):** transfer positions, positions as tokens, capped options with a labelled demo price feed.
- **Out:** real fund integrations, mainnet, pricing engine, margin, leverage, ZK, cash settlement with a real oracle.

## Team

| Who | Owns |
|-----|------|
| Claude | Writes most code in small PRs (contract, tests, scripts, bindings, frontend); runs tests before every PR; keeps README claims matching tests |
| Dev 1: contracts lead | Reviews and merges contract PRs; testnet deploys; updates **Deployed contracts**; security checklist |
| Dev 2: frontend and UX | App structure, role switcher, pages, hosting, error copy, judge-style testing after each merge |
| Dev 3: assets, integration, story | Testnet asset setup, integration checks, README, deck, video, submission answers |

## Architecture

- **Contract** (`contracts/options`, Soroban): holds all collateral in its own token balance, per-option accounting. Token addresses (FUND SAC, USDx SAC) fixed in `__constructor`; **no admin, not upgradeable**.
  - Lifecycle: Offered → Active (`buy`: premium escrowed, buyer recorded as holder) → Exercised → writer `claim_delivery`; or Expired → writer `reclaim`; or Impaired (clawback detected) → holder `cancel_impaired` gets the premium back; or Cancelled (`cancel_offer` before anyone buys).
  - Put exercise: FUND holder → **contract** (not the writer), USDx contract → holder, so a frozen writer can't block the holder.
  - Read-only: `get_option`, `list_open`, `open_collateral` (for the collateral-proof page).
- **Classic assets:** `FUND` (issuer flags: auth required, revocable, clawback) and `USDx` (separate issuer); the issuer must `set_authorized` the contract address before it can hold FUND.
- **Scripts** (`scripts/`): `setup-testnet` (issue assets, set flags, deploy SACs, approve holders, fund demo roles) and `integration` (replays the testnet checks).
- **Frontend** (`frontend/`): Market, Write, Portfolio, Issuer panel, Collateral proof; in-app testnet keys per demo role (Issuer, Writer A, Writer B, Alice, Bob, Eve), Freighter optional; contract calls through generated TS bindings.
- **No backend.**

### Contract rules (every function)

- `require_auth` on each address whose money moves; never trust a caller-supplied token address.
- Check eligibility through the FUND SAC's `authorized(addr)` for writer, buyer and holder.
- Checked `i128` math; reject amounts ≤ 0; update state before transfers; exercise at most once.
- Extend storage lifetime (instance, code, option entries) past expiry and through judging (Wed Oct 28).
- Every README claim links to a test or a testnet transaction. Disclose: test assets only, issuer can freeze or claw back, derivatives are regulated (prototype, not an offering).

## How we work

- `main` must always be demoable. Changes to code (`contracts/`, `frontend/src`, build config like `Cargo.toml` / `package.json`, `.github/workflows`) go through a PR.
- Small non-code changes (docs, `AGENTS.md`, README, `.mcp.json`, other config that can't break the build) can be pushed straight to `main`.
- One short-lived branch per task: `feat/…`, `fix/…`, `chore/…`. Merge within a few hours, not days.
- CI must be green before merging. Reviews are optional: tag a teammate if you want eyes, but don't wait on it.
- Squash-merge, then delete the branch. Pull `main` often.
- Split work by area (contracts / frontend / pitch) to avoid conflicts.
- Commit messages: short, imperative. No AI/co-author attribution trailers.
- When a contract is redeployed, update **Deployed contracts** below in the same PR.

## Deployed contracts (testnet)

| Contract | Alias | Contract ID | Deployed by |
|----------|-------|-------------|-------------|
| _none yet_ | | | |

## Layout

- `Cargo.toml`: Rust workspace root; contract crates inherit `soroban-sdk` from here
- `contracts/<name>/src/lib.rs`: Soroban contract implementation (`#![no_std]`)
- `contracts/<name>/src/test.rs`: host-side unit tests
- `contracts/options/`: the options contract (planned)
- `scripts/`: testnet setup and integration scripts (planned)
- `frontend/`: Vite + React + TypeScript app (`@stellar/stellar-sdk`, `@stellar/freighter-api`)
- `research/decision/`, `WINNING_IDEAS.md`: how the idea was chosen, testnet spike evidence

## Contracts

### Build

From the repo root:

```sh
stellar contract build
```

Artifacts land in `target/wasm32v1-none/release/*.wasm`. Build one crate with `stellar contract build --package <name>`.

Do not substitute `cargo build --target wasm32v1-none`; `stellar contract build` applies the flags and metadata the network expects. Requires the `wasm32v1-none` target (`rustup target add wasm32v1-none`, Rust ≥ 1.84).

### Test

```sh
cargo test            # all crates
cargo test -p <name>  # one crate
```

### Deploy and invoke (testnet)

```sh
stellar contract deploy \
  --wasm target/wasm32v1-none/release/<name>.wasm \
  --source-account <identity> \
  --network testnet \
  --alias <alias>

stellar contract invoke --id <alias> --network testnet --source-account <identity> -- hello --to world
```

`stellar contract invoke --id <id> -- -h` prints the generated CLI for a deployed contract. Generate TS bindings for the frontend with `stellar contract bindings typescript --network testnet --id <alias> --output-dir frontend/packages/<name>`.

## Frontend

```sh
cd frontend
npm install
npm run dev     # http://localhost:5173
npm run build
npm run lint
```

## References

- https://developers.stellar.org/docs/build/smart-contracts/overview
- https://github.com/stellar/soroban-examples
- https://developers.stellar.org/docs/tools/developer-tools
