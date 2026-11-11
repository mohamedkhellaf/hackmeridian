# StellSec frontend

The web app of StellSec: puts and calls on tokenized assets on Stellar Testnet. A maker writes an option and locks
the full collateral in the Covered contract; a buyer pays the premium and can exercise until the deadline, and
exercise swaps the asset for payment in one transaction. Buyers can post requests with the premium escrowed, holders
can resell, issuers can authorize, freeze and claw back. Margin, a separate contract for uncovered calls with
partial margin, is mounted behind a build flag.

Vite, React 19, TypeScript, TanStack Router and Query, Base UI, the Stellar SDK and the Stellar Wallets Kit.

## Run it

```sh
npm install
npm run dev          # http://localhost:5173, mock data
```

Two ways to run, chosen at build time by environment variables (copy `.env.example` to `.env`, then restart the
dev server):

| Variable | Empty (default) | Set |
|---|---|---|
| `VITE_OPTIONS_CONTRACT_ID` | **Mock data**: an in-memory market (`core/options/mockClient.ts`) with demo assets, offers and requests. Nothing is read from Stellar or sent to it; a reload starts again. The top bar says "Mock data". | The Covered contract on Testnet (`C...`, see "Deployed contracts" in `../AGENTS.md`), read through Stellar RPC and Horizon and signed in the user's wallet (Freighter set to Testnet, or another wallet of the kit). |
| `VITE_ENABLE_PRO` | No Margin routes and no Margin code in the build. | `1` mounts Margin at `/margin` (five screens). |
| `VITE_PRO_CONTRACT_ID` | With Margin on: the screens replay the recorded scenarios of `packages/risk/fixtures/pro_v0.json`, and say so. | The Margin contract on Testnet. |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect is left out of the wallet list. | WalletConnect for mobile wallets. |
| `VITE_SITE_URL` | `og:image` stays root-relative. | The public origin, for the social card. |
| `VITE_E2E` | | `1` only in test builds: a test wallet with fixed accounts replaces the wallet kit, and a crash route exists. Never set it for a deployment. |

The values are folded in at build time (`vite.config.ts`), so a mock build carries no Soroban client and a contract
build carries no mock market. The hosted app sets the two contract ids and `VITE_ENABLE_PRO=1`.

```sh
# Testnet, as hosted
VITE_OPTIONS_CONTRACT_ID=CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6 \
VITE_ENABLE_PRO=1 \
VITE_PRO_CONTRACT_ID=CBZNS63L23N3Y3GHU6H57AU6OVZ3FOAPM7Z54ATDRC472Q5DWV6UVKCN \
npm run dev
```

## Routes

`/` landing, `/markets`, `/markets/<asset>` (Guided and Chain modes, Requests and About tabs, the order ticket in
the rail), `/portfolio`, `/portfolio/<id>`, `/requests`, `/reserves`, `/activity`, `/issuer`, `/learn`, `/design`
(the design system), and with Margin `/margin`, `/margin/trade`, `/margin/positions`, `/margin/liquidations`,
`/margin/vault`. Old `#/…` links are redirected before the router starts. The route manifest is
`src/app/router.tsx`; every route and its search params are listed in `src/app/README.md`.

## Structure of `src`

Each folder has a README with its contract. From the bottom up:

| Folder | What it holds | May import |
|---|---|---|
| `core/` | Pure domain logic and words: units and amounts (exact `bigint`, never floats for money), options and requests, the Covered and Margin clients (Soroban, mock, fixture replay), pre-trade checks, payoffs, the series grid, the required disclosure sentences (`disclosures.ts`), the glossary, the deployed contracts. | nothing above it, no React |
| `ui/` | The design system: tokens, base styles and every component, on plain props. | Base UI, Phosphor; no core, data, wallet or feature |
| `viz/` | The chart kit (payoff, with and without, health bar, waterfall, sparkline), on plain props. | the same as `ui/` |
| `wallet/` | The wallet: the Stellar Wallets Kit in a contract build, the test wallet in an E2E build. | core |
| `data/` | React hooks over the clients: the query cache, derived views, the transaction runner and Activity, settings, the clock, the guide's state. | core, ui (theme and announce), wallet |
| `features/` | One folder per area (`landing`, `markets`, `ticket`, `portfolio`, `requests`, `reserves`, `activity`, `issuer`, `learn`, `margin`, `shell`, `tour`, `gallery`). A page is a named export of the feature's `index.tsx`. | everything below; another feature only through the ticket's public index |
| `app/` | The entry, the providers, the router and the search-param schemas. | everything; features import only the types of `app/search.ts` |

`src/app/boundaries.test.ts` checks these rules on the source text, and that the landing page reaches no shell code
and no chain client through a static import.

## Tests

```sh
npm run typecheck    # tsc -b
npm run lint         # oxlint
npm test             # Vitest: core, data and the features' pure modules
npm run build        # typecheck, then the production build in dist/
npx playwright test  # end to end, Chromium, two projects
```

The Playwright suite starts its own dev server on `PW_PORT` (5174 by default) as a mock build with the test wallet
and Margin on fixtures, or reuses one already running there. It runs every test at 1440 x 900 (`desktop`) and the
tests tagged `@phone` or `@both` at 390 x 844 (`phone`). Two pages exist only on the dev server for the specs:
the ticket harness (`src/features/ticket/harness/`) and the shell states (`src/features/shell/specimens/`). Every
spec starts as a returning visitor, with the welcome guide already seen (`e2e/guideState.ts`); `e2e/guide.spec.ts`
covers the first visit. Most specs end with an axe scan in both themes.

```sh
PW_PORT=5260 npx playwright test e2e/markets.spec.ts --project=desktop
```

## Design system

The rules (vocabulary, type, colour, layout, the contract note, required sentences, what not to draw) are in
[DESIGN.md](DESIGN.md). The components are in `src/ui` and `src/viz`, and `/design` shows every one of them in
every state, in both themes. The social card and the icons in `public/` are rendered from
`src/features/gallery/brand` (`node src/features/gallery/brand/render.mjs` with the dev server running).
