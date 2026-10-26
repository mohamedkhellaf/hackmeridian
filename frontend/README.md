# StellSec frontend

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

Current Testnet deployment: options v1.5, `CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6` (covered puts/calls, resale, funded buyer bids); margin contract v0.3.2, `CBZNS63L23N3Y3GHU6H57AU6OVZ3FOAPM7Z54ATDRC472Q5DWV6UVKCN``CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE`. The same build also runs against v1.3 (`CAMY4ZKY…2KRJ`) and v1.2 (`CAJ2WJP4…GBAX`): v1.3 functions (`list_assets`, `asset_count`, `writer_open_count`, `list_asset`, `prune_expired`) are feature-detected from the contract spec, and without them the client falls back to `config().underlyings`. On v1.3+ the asset list comes from `list_assets` (assets such as EQTY can be listed at runtime), the write form shows the per-writer cap (N/50 open offers) and enforces the 2 year max tenor. Contract errors are decoded by numeric code (`src/stellar/errors.ts`, 101-119), so a redeploy that renumbers or appends codes needs that table updated.

Restart `npm run dev` after changing the env file.

## StellSec Pro (experimental)

Off by default. Build or run with `VITE_ENABLE_PRO=1` to mount the Pro section (`#/pro/...`, code in `src/pro/`, lazy chunk; a default build contains none of it). It renders inside the main shell: a `Pro` link at the end of the navigation, the five screens (Margin, Trade, Positions, Liquidations, Vault) behind a segmented control.
Until the Pro contract passes its gate it runs on `packages/risk/fixtures/pro_v0.json` through `FixtureProClient`, and the Pro shell shows one banner: "Simulated on fixtures. No contract is called."
Swap to the generated bindings by implementing the `ProClient` interface in `src/pro/types.ts`. Margin figures come only from `get_requirement`; the UI never computes them.

What the screens do not repeat, because it lives here:

- Pro calls are partially collateralized. A holder is paid from the writer's margin first, then from the LP-funded vault pro rata at settlement; anything still unpaid is a deficit that reduces the payout and is shown at claim.
- Roles: the admin lists series; the team's publisher posts the price snapshots and the settlement price. The contract checks each snapshot for consistency (mark bounds, extreme-scenario floor, freshness, sequence), not the price itself, and the publisher cannot change a live series' terms or rewrite a published settlement price.
- A takeover pays the takeover price from the writer's cash; any shortfall is a recorded deficit that the vault absorbs and the writer owes back.
- LP capital cannot be withdrawn in v0. An LP deposit made before a keeper takes over an insolvent writer can enter a loss that is not visible yet; LP deposits are refused while the vault value is zero or below.
- In the simulation, amounts typed in a form are not used: each action replays the next matching fixture step. Parameters are illustrative.
