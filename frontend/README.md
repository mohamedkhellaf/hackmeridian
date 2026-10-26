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

Current Testnet deployment: v1.2, `CAJ2WJP4CUM2GGRB2A5P2M2H5GI45CTZSECV7SL3RTQMGYEKZ7ZDGBAX` (error codes 101+, paged `get_options`, `transfer`). Switching to a redeploy (for example v1.3) is just a new `VITE_OPTIONS_CONTRACT_ID`; the client reads the quote and underlying tokens from `config()`. Contract errors are decoded by numeric code (`src/stellar/errors.ts`), so a redeploy that renumbers or appends codes needs that table updated.

Restart `npm run dev` after changing the env file.
