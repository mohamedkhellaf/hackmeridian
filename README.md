# hackmeridian

Our HackMeridian 2026 (Lisbon) project, built on Stellar. Name and pitch to come.

## Stack

- **Contracts:** Rust + Soroban (`contracts/`)
- **Frontend:** Vite + React + TypeScript (`frontend/`)

## Setup

Requirements: Rust with the `wasm32v1-none` target, the [Stellar CLI](https://developers.stellar.org/docs/tools/cli), and Node 20+.

```sh
rustup target add wasm32v1-none
stellar contract build && cargo test
cd frontend && npm install && npm run dev
```

See [AGENTS.md](AGENTS.md) for build, test and deploy details.
