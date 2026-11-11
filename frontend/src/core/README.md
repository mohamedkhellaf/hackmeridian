# src/core

Framework-free TypeScript: the domain of StellSec. No React, no imports from outside `src/core` except
`packages/payoff` (payoff maths) and the Margin fixture file under `packages/risk`. Everything is unit-tested with
Vitest (`environment: 'node'`). Token amounts are exact `bigint` units from chain to screen.

Folders marked **(core-new)** are written by another agent; they are listed so this file is a complete map.

## Rules for callers

1. **No static Stellar SDK import outside `core/stellar` and the two Soroban clients.** Reach a client through
   `createOptionsClient` / `createProClient` (both async, both dynamic imports). Everything in the table below that
   is not marked "SDK" is safe to import from the shell.
2. **Writes report stages and reject with a `TxError`.** Every write of `OptionsClient` takes an optional last
   argument `{ onStage }`. Feed the stages and the outcome into `core/tx/machine.ts` (`runMachine` does it).
3. **`unknown` is not `failed`.** A transaction that was sent and is not found can still be included until a ledger
   closes after its time bound. Never offer "try again" in the `unknown` phase: offer "check again"
   (`client.checkTx(hash, maxTime)`), which ends in `confirmed`, `failed` or `expired`.
4. **Asset identity is the contract id**, never the code. `TokenInfo.issuer` is present for classic assets.
5. **Expiry day keys are UTC** (`expiryDay` in `core/time`), in the chain, in "lowest offer in series" and in URLs.
6. **Both writers claim.** After an exercise the writer's side waits in the contract for a put and for a call
   (`deliveryAmount`, `claimAmount`): a put writer claims the underlying, a call writer claims the strike.
7. **Reserves include request escrow.** `collateralLines(options, bids)` has an `escrowed` column; with it the
   columns add up to the contract's `open_collateral(token)`. Both clients' `openCollateral()` already pass the bids.

## Quick start for the data layer

```ts
import { createOptionsClient, isMockMode } from '../core/options/createClient'
import { runMachine, TX_IDLE } from '../core/tx/machine'
import { preTrade, readPreTradeFacts } from '../core/options/preTrade'

const client = await createOptionsClient({ address, sign, signAuthEntry }) // mock when no contract id
const [options, assets, lines, health, asks, bids] = await Promise.all([
  client.listOptions(), client.supportedAssets(), client.openCollateral(),
  client.collateralHealth(), client.listAsks(), client.listBids(),
])
const balances = await client.balances(address)            // TokenBalance[]; real figures in mock mode too

// before the wallet is asked
const facts = await readPreTradeFacts(client, { type: 'buy', offer }, address)
const check = preTrade({ type: 'buy', offer }, { ...facts, health })
// check.blocked, check.issues[].message, check.state / check.account / check.funds, check.pays
// In PreTradeFacts, `undefined` means "still being read" (the lines say "Checking") and 'unknown' means the
// read failed (never blocks). When feeding it from queries, map isError to 'unknown'.

// the transaction
const { state, result } = await runMachine((opts) => client.buy(offer.id, address, opts), setTxState)
// state.phase: confirmed | failed | declined | unknown | expired ; state.hash from `pending` on
if (state.phase === 'unknown') dispatch({ type: 'resolve', check: await client.checkTx(state.hash!, state.maxTime) })
```

## Modules

### Top level

| Module | Exports |
|---|---|
| `config.ts` | `config` (`rpcUrl`, `horizonUrl`, `networkPassphrase`, `optionsContractId`, `proContractId`), `TESTNET_PASSPHRASE`, `IS_MOCK`, `PRO_ENABLED`. No SDK import (the passphrase is a literal, checked against the SDK in `stellar/passphrase.test.ts`). |
| `explorer.ts` | The one stellar.expert URL builder: `explorerUrl(kind, id)`, `explorerTx`, `explorerAccount`, `explorerContract`, `explorerAsset(code, issuer)`, `explorerLedger`, `explorerAddress` (G or C), `isMockId` (mock ids have no page: show text, not a link). |
| `time.ts` | `nowSec`, `nowMs`, `MONTHS`, `SECONDS_PER_DAY`, `expiryDay(unix)` (UTC `YYYY-MM-DD`), `dayLabel(day)`, `compactCountdown(expiry, atMs?)` (`3d 0h`), `formatDuration(seconds)`, `formatExpiryShort` (local), `formatUtcShort`, `toLocalInput`, `fromLocalInput`. Compact forms for the Margin tables; new screens format time with `format/` (`formatUtc`, `formatCountdown(secondsLeft)`, `deadlineUrgency`). |
| `units.ts` | `amt(units, token)` (`5.00 FUND`), `plainAmount` (input prefill), `perUnit(total, sized)` (bigint, floored), `strikeUnits`, `premiumUnits`, `perUnitText`, `compareRatio`, `byPremiumPerUnit`, `byStrikePerUnit`, `byId`, `shortBy`, types `UnitToken`, `Sized`. |
| `disclosures.ts` **(core-new)** | Every required sentence, the Margin banners and warning bullets, the footer's `legalNotice(isMock)`, banned-word lists. |
| `guide.ts` | The welcome guide below the features: `GUIDE_ANCHORS` and `guideAnchor(name, { ring? })` (the `data-tour` attribute a component spreads on the control a note explains), `GuideId`, `GuideSeen`, `GUIDE_VERSION`, `TOUR_NOTES_ON_MARKETS`, `GUIDE_COPY` (the words shared by the welcome and the replay entry), and the two rules `canOfferTour`, `canOpenModeNote`. |

### `tx/` transaction stages

| Module | Exports |
|---|---|
| `tx/types.ts` | `TxStage` (`checking`, `signing`, `submitting`, `pending` with `hash` and `maxTime`), `TxStageName`, `TxOptions` (`{ onStage? }`), `TxReceipt`, `TxCheck` (`confirmed`, `failed`, `expired`, `unknown`), `TxOutcome`, `Notice`. |
| `tx/errors.ts` | `TxError` (`kind`: `declined`, `refused`, `failed`, `unknown`, `expired`; `hash`; `maxTime`), `TxErrorKind`, `isTxError`, `errorMessage`, `isWalletRejection`. |
| `tx/machine.ts` | `TxState` (`phase`, `hash`, `maxTime`, `ledger`, `error`, `effect`), `TxPhase` (idle, checking, signing, submitting, pending, confirmed, failed, unknown, expired, declined), `TxEffect` (`nothing-sent`, `outcome-unknown`, `fee-charged`), `TxEvent`, `TX_IDLE`, `reduce(state, event)`, `runMachine(write, emit, from?)`, selectors `isWorking`, `isSettled`, `canStart`, `canCheckAgain`, `hasHash`, and `notFoundStatus(latestLedgerCloseTime, maxTime)`. |

`TxState.effect` is what the copy must say: `nothing-sent` (no fee), `outcome-unknown`, `fee-charged`.

### `stellar/` chain access

| Module | Exports |
|---|---|
| `stellar/rpc.ts` (SDK) | `server`: the shared `rpc.Server`. Import it dynamically from anywhere outside the Soroban clients. |
| `stellar/signer.ts` (SDK types only; loads `rpc.ts` on demand) | `WalletSigner`, `clientSigning(wallet)`, `baseClientOptions`, `signAndSend(tx, { onStage, server?, pollTimeoutMs? })` (send and poll are separate: the hash is reported at `pending`; resends on `TRY_AGAIN_LATER`; ends in a result or a `TxError`), `checkTransaction(server, hash, maxTime)`, `failureText`, `SendOptions`, `TxServer`. |
| `stellar/errors.ts` | `describeError(e)`, `OPTIONS_ERRORS` (101 to 125), `SAC_ERRORS` (10, 11, 13). A timeout is described as "not confirmed yet", never "try again". |
| `stellar/tokens.ts` | `readBalance`, `readBalances(tokens, address)`, `balancesById`, `isMockToken`, types `TokenRef`, `TokenBalance`, `BalanceStatus` (`ok`, `mock`, `unfunded`, `no-trustline`, `not-authorized`, `error`). No static SDK import. Prefer `client.balances(address)`. |
| `stellar/horizon.ts` | Horizon over `fetch`: `getJson`, `horizonUrl`, `fetchAccount`, `trustlineOf`, `HorizonBalance`. |
| `stellar/ledger.ts` | `readLatestLedger()` (JSON-RPC over `fetch`, no SDK: use it for the network chip), `parseLatestLedger`, `LatestLedger`. |

### `options/` the Covered contract

| Module | Exports |
|---|---|
| `options/types.ts` | `OptionKind`, `OptionState`, `TokenInfo` (`contractId`, `code`, `decimals`, `issuer?`), `OptionOffer`, `Ask`, `NewOffer`, `SupportedAssets`, `CollateralLine` (`offered`, `active`, `pendingReclaim`, `unclaimed`, `escrowed`), `CollateralHealth`, `Money`, `TxResult`, `requiredCollateral`, `MAX_TENOR_SECONDS`, `MAX_OPEN_PER_WRITER`. |
| `options/client.ts` | `OptionsClient`: reads (`supportedAssets`, `listOptions`, `getOption`, `openCollateral`, `collateralHealth`, `isEligible`, `writerOpenCount`, `listAsks`, `getAsk`, `listBids`, `getBid`, `buyerOpenCount`, `balances(who, tokens?)`, `checkTx(hash, maxTime)`) and writes, each with an optional last `{ onStage }` (`createOffer`, `buy`, `exercise`, `reclaim`, `cancelOffer`, `claimDelivery`, `listForSale`, `cancelSale`, `buyResale`, `createBid`, `cancelBid`, `fillBid`). |
| `options/createClient.ts` | `createOptionsClient(wallet): Promise<OptionsClient>` (mock when there is no contract id: one instance per session), `isMockMode()`, `resetMockClient()`. |
| `options/mockClient.ts` | `MockOptionsClient(seed?)`: the contract's rules in memory, a demo ledger of balances that moves with every trade, the four stages over 600 ms, `failNextWith(kind)` to stage a declined, refused, failed, expired or unknown outcome. `MOCK_CONTRACT`, `MOCK_READ_MS`, `MOCK_TX_MS`. |
| `options/mockSeed.ts` | `demoSeed(atSec?)` (the demo market, below), `bareSeed()` (empty contract, for tests), `MockSeed`, `MOCK_QUOTE`, `MOCK_UNDERLYINGS`, `demoStrikes(asset)`, `demoExpiries(atSec)`, `demoPremiumPerUnit(...)`. |
| `options/demoAccounts.ts` | `DEMO_WALLETS` (`a`, `b`: the two test wallet identities), `DEMO_MAKERS` (`a` to `d`), `DEMO_HEDGERS` (`a`, `b`). |
| `options/sorobanClient.ts` (SDK) | `SorobanOptionsClient` (feature-detects contract v1.2 to v1.5; also `transferHolder`, `listAsset`, `isListed`, `pruneExpired`, `pruneBids`, `extendTtl`, `openIds`, which are not on the interface and have no screen yet: no hook or page calls them (capability phase, brief section 8)), `unwrap`. Import only through `createOptionsClient`. |
| `options/preTrade.ts` | `preTrade(action, facts): PreTradeResult` (pure), `readPreTradeFacts(client, action, me)`, `tokensFor(action)`, types `PreTradeAction` (`buy`, `buy-resale`, `fill-bid`, `write-offer`, `post-bid`, `exercise`, `list-for-sale`), `PreTradeFacts`, `Fact<T>`, `PreTradeIssue` (`level`, `code`, typed figures, `message`), `PreTradeLine`, `PreTradeResult` (`issues`, `blocked`, `pending`, `state`, `account`, `funds`, `pays`, `locks`, `receives`, `lowestInSeries`), `LAST_MINUTES_SECONDS`. |
| `options/feasibility.ts` | `exerciseFeasibility`, `premiumUnaffordable`, `implausibleTerms`, `BalanceView`, `Feasibility`. |
| `options/abi.ts` | ABI mapping: `optionFromAbi`, `stateFromAbi`, `kindFromAbi`, `kindToAbi`, `askFromAbi`, `askTotalFromAbi`, `idToU32`, `expiryToU64`, `expiryFromU64`, `assertI128`; `deliveryAmount(o)` (what the writer claims: put, the underlying; call, the strike), `collateralLines(options, bids?)`, `reservedOf(line)`. |
| `options/format.ts` | `parseAmount` (the exact input parser), `formatAmount(units, decimals, maxFraction, minFraction)` (kept for a few ported callers; every amount on screen goes through `format/` `formatUnits`), `strikePerUnit(o)` (text, 2 decimals), `shortAddress`. |

### `market/`, `maker/`, `requests/`, `resale/`

| Module | Exports |
|---|---|
| `market/selection.ts` | Exact series: `SeriesRef`, `seriesRefOf(terms)`, `cellKey(ref)`, `sameSeriesRef`, `chainCells(input, underlyingId): Map<cellKey, CellSummary>` (best offer, best bid, makers, counts, `mine`, `holding`, `wrote`), `seriesBook(input, ref): SeriesBook`, `lowestPremiums(offers, underlyingId)`, `allRows(input)`. Order-driven view: `selectMarket(input, pick): MarketSelection`, `MarketPick`, `MarketInputs`, `seriesKeyOf`, `parseSeriesKey`, `isBidOnly`. Prefill: `Prefill`, `prefillFor`, `prefillsOf`, `prefillForRef`. Row rules: `bookRowAction(row, me)`. |
| `market/book.ts` | `BookRow`, `BookSource` (`bid`, `maker`, `resale`), `bookRows(offers, resale, bids, nowSec)`, `sortBook(rows)`, `asSample(row)`. |
| `market/chain.ts` | Order-driven chain: `buildChain(column)` (exact strike order), `ChainRow`, `ChainSide`, `assetCodes`, `defaultAsset`, `expiryDays`, `inColumn`, `seriesKey`, `seriesOffers`, `rankOffers`, `defaultSeries`, `settlementLine(o)`, `premiumUnit(o)`. |
| `market/marginAck.ts` | `MARGIN_ACK_KEY`, `hasMarginAck`, `setMarginAck`, `MARGIN_TRADE_HREF` (`/margin/trade`). |
| `maker/buildOffer.ts` | `buildOffer(assets, form): Draft`: the one validator of offer and bid forms (exact strike times quantity, tenor up to 2 years). |
| `maker/lowestOffer.ts` | `lowestOpenInSeries(offers, draft, quote)` (same UTC expiry day as the chain), `premiumPerUnitText`. |
| `requests/types.ts` | `Bid`, `BidState`, `NewBid`, `MAX_OPEN_BIDS_PER_BUYER`. |
| `requests/abi.ts` | `bidFromAbi`, `bidStateFromAbi`, `AbiBid`. |
| `requests/requests.ts` | `marketBids`, `myOpenBids`, `fillBlockReason`, `fillCollateral`, `perUnit(total, bid)` (text), `STATUS_LABEL`. |
| `requests/rows.ts` | The one view model of a request (`requestRow`, `requestRows`, `RequestRow`, `Figure`, `STATE_NAME`, `ESCROW_STATUS`, `holdsEscrow`, `lockShortfall`) for the Requests board, the asset page and the Portfolio. |
| `resale/resale.ts` | `resaleRows`, `resaleCheck` (`ok`, `fail`, `changed`), `selfTradeReason`, `canList`, `isLive`, `askOf`, `askPerUnit`, `formatAskPerUnit`, `ResaleRow`. |

### `portfolio/`, `reserves/`, `payoff/`

| Module | Exports |
|---|---|
| `portfolio/positions.ts` | `roleOf`, `statusOf`, `actionKindOf`, `ActionKind`, `ACTION_LABEL`, `RowAction` (`kind`, `label`, `onClick`, `disabled?`), `claimAmount`, `actionLabel`, `premiumOf`, `counterpartyLine`, `countdown`, `expirySub`, `filterPositions`, `computeKpis`, `waitingActions`; new: `todoItems(options, me, nowSec, referenceOf?)` with `TodoItem` (`kind`, `actionable`, `deadline`, `moneyness`, `amount`), `actionsWaiting(items)` (the navigation badge), `portfolioSummary(options, me)`. |
| `reserves/reserves.ts` | `backingFor(line, health)`, `Backing`, `lineTotal`, `shortfall`, `ratioTenths` (rounds down), `formatTenths`, `formatFixed`, `shortTokens(health)`, `shortfallFor(option, health)`. |
| `payoff/strategies.ts` **(core-new)** | The four guided intents on top of `packages/payoff`. |

### `assetfacts/`, `issuer/`

| Module | Exports |
|---|---|
| `assetfacts/assetFacts.ts` | Parsers `parseSacName`, `parseAssetsResponse`, `parseIssuerAccount`, `parseHolderStatus`, `describeFlags`; cached reads `fetchAssetFacts(contractId, code)` (rejects for mock tokens), `fetchHolderStatus(code, issuer, address)`; types `AssetFacts`, `AssetFlags`, `IssuerFacts`, `HolderStatus`, `FlagFact`. No static SDK import. Explorer links moved to `explorer.ts`. |
| `issuer/issuerView.ts` | `actionsFor`, `AuthState`. |
| `issuer/issuerTx.ts` (SDK) | Builders: `buildSetAuthorizedTx`, `buildClawbackTx`, `sacSetAuthorizedOp`, `sacClawbackOp`, `buildSacTx`, `buildSacAuthorizedQuery`, `sacContractId`, `trustStatus`, `missingFlags`, `isAccountId`, `isContractId`, `STROOPS_DECIMALS`. |
| `issuer/issuerNet.ts` (SDK) | `submitClassic`, `submitSoroban`, `readSacAuthorized`, `horizonError`, `Signer`. The issuer route is lazy: import these two only from it. |

### `pro/` Margin (experimental)

| Module | Exports |
|---|---|
| `pro/types.ts` | `ProClient` (every write takes an optional last `{ onStage }` and resolves with a `CallResult`), `ProModel`, `SeriesView`, `OfferView`, `BookView`, `PositionView`, `AccountView`, `VaultView`, `ConfigView`, `Requirement`, `CallResult` (a failure may carry `kind` and `hash` from a `TxError`), `OfferParams`, `Party`, `VAULT`, `USDX_DECIMALS`. |
| `pro/createClient.ts` | `createProClient(): Promise<ProClientHandle>` (`client`, `sim`, `live`, `simulated`), `isProSimulated()`, `FIXTURE_DEFAULT_PARTY`, `PRO_REFRESH_MS`. The fixture client and its 1 MB JSON load only when there is no Margin contract id. |
| `pro/tx.ts` | `proReceipt(call)`: adapts a Margin call to the shared machine (`runMachine((opts) => proReceipt(client.exercise(holder, id, opts)), emit)`): resolves with `ProReceipt` (`hash` is empty on fixtures), rejects with `ProTxError` (`kind`, `code`, `refusal`, `note`). `proFailureText(result)`. |
| `pro/phase.ts` | `phaseOf(position, series, book, now)`, `Phase`, `PHASE_STATE`, `PHASE_ACTION` (button label, run label, done word, `holderOnly`), `PHASE_WAITING`, `positionRow`, `positionRows(model)`, `PositionRow`. |
| `pro/errors.ts` | `PRO_ERRORS`, `PRO_ERROR_CODES`, `proErrorName`, `proErrorMessage`, `parseProErrorCode`. |
| `pro/format.ts` | `usdx`, `perLot`, `exact`, `lots`, `duration`, `when`, `whenShort`, `countdown`, `DASH`. |
| `pro/helpers.ts` | `seriesLabel`, `seriesStatus`, `snapshotAge`, `ageText`. |
| `pro/FixtureProClient.ts`, `pro/replay.ts` | The fixture replay (`FixtureProClient` with `scenarioNames`, `setScenario`, `moveTo`, `parties`, `position`, `stepCount`; `DEFAULT_SCENARIO`, `DEFAULT_CURSOR`, `NOT_SCRIPTED`). Import only through `createProClient`. |
| `pro/SorobanProClient.ts` (SDK), `pro/proAbi.ts`, `pro/proSpec.ts` | The live client (`setWallet`, `refresh`, `start`, `getStatus`), `ProCallError`, `failureOf`, `emptyModel`. Import only through `createProClient`. |

### Written by core-new

`series/` (the standard grid: `standardExpiries`, `strikeLadder`, `classifyOffer`, `partitionOffers`, `seriesName`),
`reference/` (`ReferencePrice`, `referenceFor`, `demoReference`, `optionMoneyness`, `exerciseValue`),
`assets/` (reference list, tiers, slugs), `format/` (display formats), `calendar/` (the .ics file).

## Bundle facts (measured on a probe entry, 2026-11-11)

A probe that statically imports `config`, both `createClient` modules, `preTrade`, `selection`, the tx machine,
`tokens`, `ledger`, `assetFacts`, `explorer`, `positions`, `pro/phase`, `errors`, and `reserves`
builds to a 32 kB entry chunk with no Stellar SDK in it. The SDK (669 kB + 82 kB minified) and the clients are
separate chunks loaded on demand. With `VITE_OPTIONS_CONTRACT_ID` and `VITE_PRO_CONTRACT_ID` set, the build emits
neither the mock market chunk nor the 1.18 MB fixture chunk. For the reverse (a mock build that drops the live
client chunks) the two variables would have to be pinned in `vite.config.ts` `define` like `VITE_ENABLE_PRO`;
without that the live chunks are emitted and simply never loaded.

## The mock demo market (`demoSeed`)

Used when the build has no `VITE_OPTIONS_CONTRACT_ID`. All of it is computed from the current time.

- **Assets:** FUND, BOND, EQTY against USDx (ids `C_MOCK_*`, from `assets/referenceList`).
- **Grid:** per asset, the five central strikes of `strikeLadder(demo price)` and the first three `standardExpiries`.
- **Offers:** about 100 open offers from four makers (`DEMO_MAKERS`), both kinds, 0 to 3 makers per series, some
  series empty on purpose. Premiums are illustrative (a normal-model formula on the demo price): out of the money
  is cheaper than in the money, longer dated is dearer. Two offers are off the grid (one strike, one expiry).
- **Requests:** four open bids (one by each test wallet, one on a series nobody quotes).
- **Resale:** one listing by `DEMO_HEDGERS.a`.
- **Default test wallet (`DEMO_WALLETS.a`):** ids 0 to 6: an in-the-money put with its deadline inside 48 hours,
  an out-of-the-money put, a written covered call, a written call that was exercised (claim 98.00 USDx), a written
  put that expired (reclaim), a held call that expired unexercised, an open offer.
- **Second test wallet (`DEMO_WALLETS.b`):** ids 7 and 8 (a held call, a written put) and one bid.
- **Balances:** `client.balances(who)` returns real mock figures; trades move them; an account that cannot pay is
  refused like on chain ("Insufficient token balance").
- **Timing:** `listOptions` 150 ms, `listAsks` and `listBids` 100 ms, a write 600 ms (checking 150, signing 150,
  submitting 100, pending 200).
- **Staging an outcome:** `(client as MockOptionsClient).failNextWith('unknown')` makes the next write end unknown;
  `checkTx` then confirms it.

## Added during integration (11 Nov 2026)

| Module | What |
|---|---|
| `links.ts` | `REPOSITORY_URL` and `DOC_LINKS`: the public addresses the landing page, the footer and Learn cite. |
| `deployments.ts` | The recorded Testnet deployments (contract ids, wasm hashes, deploy transactions, Margin admin and publisher), moved from the Reserves feature. |
| `payoff/leg.ts` | One option from one side: exact strike, premium and breakeven per unit, the caps of each side, what exercise moves, and the leg's profit and loss (`legPnl`, `legPnlOf`, `legNumbers`) for both the holder and the writer. The ticket and the position page share it. |
| `payoff/strategies.ts` | `GuidedOutcome.assetValue` (`qty x price`). |
| `pro/coverage.ts` | The hypothetical payout split of the Margin buy dialog (adapter to `packages/payoff`), and `toChartNumber`. |
| `pro/scenarios.ts` | English titles and summaries of the recorded Margin scenarios (`scenarioCopy`, `scenarioTitle`, `scenarioSummary`). |
| `pro/types.ts` | `PRO_UNDERLYING`: the one underlying of the Margin market. |
| `stellar/issuerTx.ts`, `stellar/issuerNet.ts`, `stellar/rawTx.ts` | The issuer transactions and reads (moved from `core/issuer`), and the SDK objects a hand-built transaction needs. Static SDK imports: reach them from a lazily loaded chunk only. |
| `tx/machine.ts` | `TxState.stoppedAt`, `stoppedStage(state)`, `refusedOnSend(state)`: where a transaction stopped. |
| `maker/lowestOffer.ts` | `lowestOpenInSeriesOf(offers, series, quote)`: the cheapest offer of a series named by its terms. |
| `series` | `LADDER_ROWS`: the strike rows of the app's grid, one number for every view. |
| `format` | `noBreak(text)`: keeps a deadline or a figure with its unit on one line. |
| `assetfacts` | `mockAssetFacts(code)`: fixture flags for mock assets (`mock: true`, no counts). |
| `options/mockClient.ts` | `failNextRead(method?, times)`, `clawBack(tokenId, units)`; `DEMO_WALLETS.c` is an empty wallet. `createOptionsClient` no longer keeps a failed load of the mock chunk. |
| `disclosures.ts` | `MARGIN_PAYOUT_RISK`, `MARGIN_PUBLISHER_LINE` (the on-chain banner is the two together). |

## Added in the review pass (11 Nov 2026, evening)

| Module | What |
|---|---|
| `glossary.ts` | `GLOSSARY` (id, term, one-sentence definition), `definitionOf(id)`, `glossaryEntry(id)`: Learn's glossary and the kit's `Term` popovers say the same sentence. |
| `format/option.ts` | `serialOf`, `KIND_WORD`, `strikePerUnitText`, `strikePerUnitExact`: one copy of the words that name an option. |
| `format/time.ts` | `formatUtcClock` (`13:45:12 UTC`), `zoneLabel` (`UTC−10`, never `GMT-10`). |
| `series/standard.ts` | `chainExpiries(now)`: the listed deadlines and a Friday less than an hour away, whose orders keep their tab. |
| `payoff/leg.ts` | `givesUp(leg, side)`: a written call's side of "Most you can lose" (ruling E14). |
| `portfolio/positions.ts` | `requestTodoItems(bids, me)` (expired requests whose premium is still escrowed) and the `escrowed`, `lockedNow`, `readyToTakeBack` sums of `portfolioSummary(options, me, resale?, bids?)`. |
| `options/preTrade.ts` | The `below-exercise-value` warning on write, fill and list. |
| `tx/types.ts` | `TxOptions.signal` and `STOPPED_WAITING`: a write that waits for a wallet can be stopped before it is signed. |
| `deployments.ts` | `CONTRACT_TESTS`, `CONTRACT_TEST_TOTAL`, `RECORDED_PUT_FEES`. |
| `units.ts` | `amtExact` for a shortfall; `amt` and `perUnitText` now follow `formatUnits` (two decimals). `formatDisplay` is gone. |

