# Strata frontend

Vite + React 19 + TypeScript app for collateralized options on tokenized Stellar assets (Testnet).

## Setup

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # Vitest unit tests
npm run build
npm run lint
```

## Running against a deployed contract

Copy `.env.example` to `.env` and set the contract ID (see "Deployed contracts" in `AGENTS.md`):

```sh
VITE_OPTIONS_CONTRACT_ID=C...
```

- **Unset (mock mode):** an in-memory `MockOptionsClient` with fictional assets and options. A banner says so; state resets on reload.
- **Set (real mode):** `SorobanOptionsClient` talks to the contract on Testnet through Stellar RPC, signing with Freighter (set Freighter to Testnet). The Issuer tab operates the asset issuer account.

Current Testnet deployment: v1.3.1, `CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE`. The same build also runs against v1.3 (`CAMY4ZKY…2KRJ`) and v1.2 (`CAJ2WJP4…GBAX`): v1.3 functions (`list_assets`, `asset_count`, `writer_open_count`, `list_asset`, `prune_expired`) are feature-detected from the contract spec, and without them the client falls back to `config().underlyings`. On v1.3+ the asset list comes from `list_assets` (assets such as EQTY can be listed at runtime), the write form shows the per-writer cap (N/50 open offers) and enforces the 2 year max tenor. Contract errors are decoded by numeric code (`src/stellar/errors.ts`, 101-119), so a redeploy that renumbers or appends codes needs that table updated.

Restart `npm run dev` after changing the env file.

## Strata Pro (experimental)

Off by default. Build or run with `VITE_ENABLE_PRO=1` to mount the Pro section (`#/pro/...`, code in `src/pro/`, lazy chunk; a default build contains none of it).
Until the Pro contract passes its gate it runs on `packages/risk/fixtures/pro_v0.json` through `FixtureProClient` and every screen says "Simulated, not on-chain".
Swap to the generated bindings by implementing the `ProClient` interface in `src/pro/types.ts`. Margin figures come only from `get_requirement`; the UI never computes them.
