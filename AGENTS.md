# Agent instructions

<!-- TODO: fill in during the hackathon. Keep this file short and current. -->

## Project

- **Name:** TBD (repo is `hackmeridian` for now)
- **Event:** HackMeridian, Lisbon, Oct 25–26 2026 (Stellar)
- **Category:** Genesis (new idea → working MVP)
- **Track:** TBD (Stellar Unlocked / Stellar Composed)
- **Deadline:** Mon Oct 26, 12:00 (no late submissions). Judged async on demo video, pitch deck, repo, and submission answers.
- **Pitch:** TBD, one or two sentences on what we're building and for whom

## Team

TBD: who owns what.

## Architecture

TBD: how contracts, frontend and any backend talk to each other.

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
- `frontend/`: Vite + React + TypeScript app (`@stellar/stellar-sdk`, `@stellar/freighter-api`)

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
