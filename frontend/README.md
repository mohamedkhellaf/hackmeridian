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

Restart `npm run dev` after changing the env file.
