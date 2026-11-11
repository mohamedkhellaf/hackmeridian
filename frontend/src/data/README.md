# src/data

React bindings over `src/core`: the query cache, one hook per resource, derived views, the transaction layer with
the Activity list, the settings store and the Margin provider. Features and the shell import from `src/data`
(the `index.ts` barrel) or, for Margin only, from `src/data/pro`. This folder may import `core`, `wallet`, and
from `ui` only `theme` and `announce`.

Every hook is thin: the logic is in pure functions (`derived/*.ts`, `tx/*.ts`, `keys.ts`, `settings.ts`) that are
unit-tested in Node. Amounts are `bigint` everywhere; nothing here formats (use `core/format`) and nothing here
computes a payoff (use `core/payoff`).

## Setting it up (the app entry does this once)

```tsx
import { initSettings, DataProvider } from '../data'
import { WalletProvider } from '../wallet'

initSettings()                      // before React mounts: data-theme, data-density, data-pnl on <html>

<WalletProvider>
  <DataProvider>                    {/* query cache + the Covered client + cross-tab sync */}
    <RouterProvider router={router} />
  </DataProvider>
</WalletProvider>
```

## Three rules for callers

1. **A hook reads only while it is mounted.** Book data (options, listings, requests) is polled every 10 s, slow
   data (assets, reserves, balances) every 60 s, the ledger every 30 s. Nothing is polled in a background tab;
   coming back to the tab refetches what is stale. Two components that mount the same hook share one request.
   (Checked in a browser: 2 polls in 21 s visible, 0 hidden, 0 unmounted.)
2. **No optimistic updates.** A write goes through the staged transaction state; when a ledger confirms it, the
   reads it changed are invalidated and the screen shows the fresh answer.
3. **A derived view is one object, `Derived<T>`**, with one loading, error and stale state for everything behind it:

```ts
interface Derived<T> {
  data: T | null          // null until the first reads are in, or when the view has no subject (no wallet, unknown asset)
  isLoading: boolean      // first reads running: show the skeleton
  isError: boolean        // first reads failed and there is nothing to show: show the error state with retry
  refreshFailed: boolean  // data is shown but the last refresh failed: say "Could not refresh", keep the data
  error: string | null    // the message for either case
  updatedAt: number | null // when the oldest read behind the view landed (ms)
  retry: () => void       // reads everything behind the view again
}
```

The usual render order: `isError` (error state with `retry`), `isLoading` (skeleton), `data === null` (no subject:
guest or unknown), else the data, with a quiet "Could not refresh" line when `refreshFailed`.

## Providers and the client

| Export | Signature | Meaning |
|---|---|---|
| `DataProvider` | `(props: { children; client?: QueryClient; source?: ClientSource<OptionsClient> })` | Everything the hooks need. Inside `<WalletProvider>`. The two optional props are for tests and the gallery. |
| `queryClient` | `QueryClient` | The app's cache (for router loaders and tests). `createQueryClient(mock?)` builds another. |
| `useOptionsClient` | `(): { getClient(): Promise<OptionsClient>; client: OptionsClient \| null; isMock: boolean; error: string \| null; me: string \| null; wrongNetwork: string \| null }` | The session's Covered client. `getClient()` starts the lazy load (mock market, or the Soroban client and the SDK); `client` is set once loaded. `wrongNetwork` is the banner sentence when the wallet reports another network. |
| `useMe` | `(): string \| null` | The connected wallet address. |
| `useIsMock` | `(): boolean` | True when the build has no Covered contract id (mock data). Needs no provider. |
| `useNowSec` | `(stepSec = 10): number` | Unix seconds, rounded down to the step. One shared timer; pass 1 for a live countdown. |
| `keys`, `makeKeys`, `idKey` | key factory | Query keys: `['covered', <contract id or 'mock'>, resource, ...]`, ids as decimal text. For a manual `invalidateQueries`. |
| `POLL_MS`, `STALE_MS`, `Cadence` | constants, `'book' \| 'slow' \| 'off'` | The intervals behind rule 1. |

Mock mode: `useOptionsClient().client` is a `MockOptionsClient`; `(client as MockOptionsClient).failNextWith('declined' | 'refused' | 'failed' | 'expired' | 'unknown')`
stages the next write's outcome for a demo or a test.

## Reads (one hook per resource)

Each returns TanStack Query's `UseQueryResult<T>` (`data`, `isPending`, `isError`, `error`, `refetch`, `dataUpdatedAt`).
Each takes a last optional `ReadOptions = { cadence?: 'book' | 'slow' | 'off'; enabled?: boolean }`. A hook without
its subject (no address, no id) is disabled: `data` is `undefined`, `isPending` is true and `fetchStatus` is `'idle'`.

| Hook | Returns | Meaning, default cadence |
|---|---|---|
| `useAssets(opts?)` | `SupportedAssets` (`quote`, `underlyings`) | The quote token and the listed underlyings. Slow. |
| `useOptions(opts?)` | `OptionOffer[]` | Every option of the contract in every state. Book. |
| `useAsks(opts?)` | `Ask[] \| null` | Resale listings; null when the contract has no resale (before v1.4). Book. |
| `useBids(opts?)` | `Bid[] \| null` | Requests (funded bids); null when the contract has none (before v1.5). Book. |
| `useCollateral(opts?)` | `CollateralLine[]` | Per token: offered, active, pending reclaim, unclaimed, escrowed. Slow. |
| `useHealth(opts?)` | `CollateralHealth[]` | Per token: reserved against what the contract holds. Slow. |
| `useBalances(address, tokens?, opts?)` | `TokenBalance[]` | Balances of an address (default: quote and every underlying), each with a `status`. Slow, refreshed after every transaction. Mock mode has real figures. |
| `useBalancesById(address, tokens?, opts?)` | `Record<contractId, TokenBalance>` | The same read keyed by token id. |
| `useEligibility(tokenId, address, opts?)` | `boolean` | The contract's `is_eligible`: the issuer authorized this account. Off (refetch on focus). |
| `useWriterOpenCount(address, opts?)` | `number \| null` | Open offers of a writer against the cap of 50. Off. |
| `useBuyerOpenCount(address, opts?)` | `number \| null` | Open requests of a buyer against the cap of 50. Off. |
| `useOption(id, opts?)` | `OptionOffer` | One option re-read from the chain. Until it lands, `data` is the copy from the list and `isPlaceholderData` is true. Off. |
| `useBid(id, opts?)` | `Bid` | One request, re-read. Placeholder as above. Off. |
| `useAsk(id, opts?)` | `bigint \| null` | The live resale ask of an option in quote units; null when not listed. Off. |
| `useLedger(opts?)` | `LatestLedger` (`sequence`, `closeTime`) | The network's latest ledger over plain fetch, every 30 s. Disabled in mock mode. |
| `useNetworkStatus()` | `{ state: 'mock' \| 'connecting' \| 'ok' \| 'delayed' \| 'down'; label; ledger; closeTime; readAt }` | The network chip. `label` is the word beside the dot (`NETWORK_STATE_LABEL`). |
| `useAssetFacts(token, opts?)` | `AssetFacts` | Issuer flags, issuer account and asset record (RPC and Horizon). Disabled for mock tokens. Off. |
| `useHolderStatus(token, address, opts?)` | `HolderStatus` | The account's trustline for a classic asset (`authorized`, `no-trustline`, `unfunded`...). Disabled for mock tokens. Off. |
| `useReference(asset)` | `ReferencePrice` (not a query) | The reference price of an asset (brief D12): `Demo price` in mock mode, `Testnet faucet price` for the listed assets in live mode, `none` otherwise. Always show `label` and `note` with it. |
| `referenceMode()` | `'mock' \| 'testnet'` | The reference provider of this build. |

## Derived views

All return `Derived<T>` unless noted. `asset` is the underlying token contract id (or a token). `me` defaults to
the connected wallet. `ViewOptions = { cadence?: Cadence }` (default `'book'`).

| Hook | `data` | Meaning |
|---|---|---|
| `useAsset(param)` | `AssetRoute` (`status: 'found' \| 'unknown' \| 'invalid'`, `token`, `quote`, `canonical`, `isCanonical`, `tier`, `typeLabel`) | Resolves the `$asset` URL segment (slug, `CODE-ISSUER` or contract id) against the listed tokens. Replace the URL with `canonical` when `isCanonical` is false. |
| `useMarket(asset, opts?)` | `MarketView` | The chain of one asset on the standard grid: `expiries`, `ladder` (9 strikes, `LADDER_ROWS`), `columns[].rows[].call / .put` (`GridCell`: `best`, `bestPerUnit`, `bestBid`, `makers`, `offers`, `bids`, `mine`, `holding`, `wrote`, `moneyness`, `empty`, `ref`), `cells` by `cellKey`, `referenceRule`, `other` (off-grid orders with `reason` and `action`), `otherCounts`, `otherExpiries`, `bids` (the asset's open bids, best first), `summary`. |
| `useMarketsIndex(opts?)` | `MarketIndexRow[]` | One row per listed asset: `tier`, `isReference`, `typeLabel`, `path`, `similar`, `reference`, `summary` (offers, bids, makers, nearest expiry, lowest put and call per unit), `otherOrders`. Reference assets first. |
| `useBook(series, opts?)` | `BookView` | The two-sided book of one exact series (`SeriesRef`: a cell's `ref`, or `seriesRefOf(row)` for an off-grid order): `offers` and `bids` as `BookEntry` (`row`, `perUnit`, `action`, `mine`, `reason`), `bestOffer`, `bestBid`, `onGrid`, `prefill.buy / .sell`, `empty`. |
| `useGuidedMatch(asset, intent, qty, strike, expiry, opts?)` | `GuidedMatch` | The best funded order for guided terms: `exact` (cheapest offer or listing for a buyer, highest bid for a writer, same series and same quantity), `sameSeries` and `nearby` alternatives, `fundedStrikes`, `fundedExpiries` and `funded` for marking chips, `fallback` (`post-bid` or `write-offer`). `qty` in underlying units, `strike` per unit in quote units, `expiry` in unix seconds; each may be null. |
| `usePositions(me?, { cadence?, showClosed? })` | `PositionsView` | `holding`, `written`, `orders.offers / .requests / .listings`, `counts` (with `closed`). Each `PositionView`: `role`, `status`, `action`, `counterparty`, `premium`, `collateral`, `claim`, `listing`, `secondsLeft`, `urgency`, `moneyness`, `exerciseValue`, `reference`, `series`, `closed`. |
| `usePosition(id, me?, opts?)` | `PositionDetail` (`option`, `position`, `fresh`), plus `notFound: boolean` on the result | One option for the position page, re-read every 10 s. `fresh` is false while only the list copy is shown. |
| `useTodo(me?, opts?)` | `TodoView[]` | The to-do strip, most pressing first. `kind`: `exercise`, `claim`, `reclaim`, `expired-unexercised`. `tone`: `urgent` only for an exercise that is in the money at the reference price with 48 h or less left; `action` for claims (put and call writers alike), reclaims and in-the-money exercises further out; `neutral` for an exercise that is at or out of the money or has no reference; `info` for an option that expired unexercised in the last 7 days. With `amount`, `deadline`, `secondsLeft`, `urgency`, `moneyness`, `reference`, `exerciseValue`. |
| `useActionsWaiting(me?, opts?)` | `number` (not a `Derived`) | The count for the Portfolio badge: claims, reclaims and in-the-money exercises. Polls slowly (60 s): the shell mounts it on every route. |
| `usePortfolioKpis(me?, opts?)` | `PortfolioSummary` | `open`, `premiumPaid`, `premiumEarned`, `locked`, `unclaimed`: exact sums per token, no valuation. `premiumPaid` is the original premium of each held option, also for one bought on resale (the chain does not record resale prices). |
| `optionReference(option)` | `ReferencePrice` (a function) | The reference price of an option's underlying in this build. |
| `isNotFoundMessage(message)` | `boolean` | True for the error of an id the contract does not have. |

What each view returns in the three special cases:

| Hook | Guest (no wallet) | While loading | On error |
|---|---|---|---|
| `useAsset` | The same as connected. | `data: null`, `isLoading`. | `isError` when the asset list could not be read. |
| `useMarket` | The full market; `mine`, `holding`, `wrote` are false; `other[].action` is a buy, buy-resale or fill action. | `data: null`, `isLoading`. | `isError` when assets or options failed. A failed listings or requests read leaves the view ready with `refreshFailed`. |
| `useMarketsIndex` | The same as connected. | `data: null`, `isLoading`. | As `useMarket`. |
| `useBook` | Every row with its buy or fill action; `mine` false. A guest is asked to connect when using one. | `data: null`, `isLoading`. | As `useMarket`. |
| `useGuidedMatch` | The same match (no order is excluded as the wallet's own). | `data: null`, `isLoading`. | As `useMarket`. |
| `usePositions` | `data: null`, `isLoading: false`. Nothing is read. Show the guest state. | `data: null`, `isLoading`. | `isError` when options failed. |
| `usePosition` | The option with `position: null`. | `data` is the list copy with `fresh: false` when the list is cached, else null with `isLoading`. | `isError`; `notFound` is true for an id that does not exist (show "No such position", not a retry). |
| `useTodo` | `data: null`, `isLoading: false`. Nothing is read. | `data: null`, `isLoading`. | `isError`. |
| `useActionsWaiting` | `0`. | `0`. | `0` (or the last known count). |
| `usePortfolioKpis` | `data: null`, `isLoading: false`. | `data: null`, `isLoading`. | `isError`. |

An asset the contract does not list gives `useMarket`, `useBook` and `useGuidedMatch` `data: null` with
`isLoading: false` and `isError: false`: resolve the URL with `useAsset` first.

## Transactions and Activity

One machine for Covered and Margin (`core/tx/machine`). The phases: `idle`, `checking`, `signing`, `submitting`,
`pending` (the hash is known from here), then `confirmed`, `failed`, `unknown`, `expired` or `declined`.
`state.effect` says what happened to the money: `nothing-sent`, `outcome-unknown`, `fee-charged`.

```ts
const buy = useBuy()
const { state, result, entryId } = await buy.run(offer)   // never rejects
buy.state.phase            // drives the ticket's Sign step
buy.state.hash             // from `pending` on
describeTx(buy.state)      // { title: 'Pending', detail: 'The network accepted the transaction...' }
buy.canCheckAgain && (await buy.checkAgain())   // only for `unknown`; an unknown transaction is never sent again
buy.reset()                // back to idle (ignored while in flight or unknown)
```

| Export | Signature | Meaning |
|---|---|---|
| `useTx` | `(options?: { product?: 'covered' \| 'margin'; address?; mock?; announce?; needsWallet? }): TxController` | The generic controller: `state`, `run(what, write)`, `checkAgain()`, `reset()`, `working`, `canStart`, `canCheckAgain`, `subject`, `entryId`. `run('Label', (opts) => client.someWrite(..., opts))`, or `run({ label, detail?, action?, done?, subject? }, write)`. |
| `useBuy` | `(): CoveredTx<[offer: OptionOffer], TxResult>` | Buy a maker's funded offer. |
| `useExercise` | `(): CoveredTx<[option: OptionOffer], TxResult>` | Exercise a held option before its deadline. |
| `useClaimDelivery` | `(): CoveredTx<[option: OptionOffer], TxResult>` | Writer claims what an exercise left in the contract (put: the underlying; call: the strike). |
| `useReclaim` | `(): CoveredTx<[option: OptionOffer], TxResult>` | Writer takes back the collateral of an expired option or offer. |
| `useCancelOffer` | `(): CoveredTx<[offer: OptionOffer], TxResult>` | Writer cancels an open offer. |
| `useWriteOffer` | `(): CoveredTx<[offer: NewOffer], TxResult & { id: bigint }>` | Write an offer and lock its collateral. |
| `useListForSale` | `(): CoveredTx<[option: OptionOffer, askTotal: bigint], TxResult>` | Holder lists an option for sale, or changes the price. |
| `useCancelSale` | `(): CoveredTx<[option: OptionOffer], TxResult>` | Holder withdraws a listing. |
| `useBuyResale` | `(): CoveredTx<[option: OptionOffer, maxTotal: bigint], TxResult>` | Buy from a holder; a higher live ask than `maxTotal` is refused. |
| `useCreateBid` | `(): CoveredTx<[bid: NewBid], TxResult & { id: bigint }>` | Post a request and escrow its premium. |
| `useCancelBid` | `(): CoveredTx<[bid: Bid], TxResult>` | Withdraw a request; the premium is refunded. |
| `useFillBid` | `(): CoveredTx<[bid: Bid], TxResult & { optionId: bigint }>` | Maker fills a request. |
| `useTxBusy` | `(): boolean` | A transaction started on this page is in flight. Disable the other action buttons with it. |
| `useSubjectBusy` | `(subject: string \| null): boolean` | A transaction on `optionSubject(id)` or `bidSubject(id)` is in flight: that row shows progress. |
| `usePreTrade` | `(action: PreTradeAction \| null, options?: { reference?; enabled? }): PreTradeView \| null` | The pre-trade checks of `core/options/preTrade`, kept current from the cache: `issues`, `blocked`, `pending`, the three lines `state`, `account`, `funds`, the amounts `pays`, `locks`, `receives`, `lowestInSeries`, plus `facts` and `recheck()`. Call `await recheck()` when the user confirms and stop when it is `blocked`. A guest gets the terms and a "Connect a wallet" line, never a block. |
| `useActivity` | `(address?): { entries; inFlight; unknown; check(id); remove(id); clearSettled() }` | The Activity list of a wallet (default: the connected one), newest first. |
| `describeTx`, `TX_PHASE_LABEL`, `TX_PHASE_HELP`, `TX_EFFECT_TEXT` | copy | The words for each phase and effect, so the ticket, a row and Activity say the same thing. |
| `optionSubject`, `bidSubject` | `(id: bigint): string` | `option:12`, `bid:3`. |
| `canCheckEntry`, `isOpenEntry`, `entryState` | `(entry: ActivityEntry)` | Helpers for an Activity row: can it be checked again, is its outcome open, its machine state. |

What the layer does for every run, so callers do not:

- **Refuses before sending** when no wallet is connected, when the wallet reports another network (live mode),
  when another transaction is in flight on this page, or while the controller's last outcome is unknown. A
  refusal is a `failed` state with `effect: 'nothing-sent'`.
- **Announces** each phase through the shell's live regions (`announce: false` turns it off): progress and a
  decline politely, a failure and an unknown outcome assertively.
- **Invalidates on confirmation** exactly what the call changed (`tx/invalidation.ts`): a buy refreshes the option
  list, that option, reserves, balances and the writer's open count; a listing only the listings; a Margin call
  only balances. An `action` the table does not know (the default, `other`: an issuer action sent through
  `useTx`, for instance) refreshes every Covered read and every trustline read. A failure that was included in a
  ledger (`fee-charged`) invalidates too. Nothing is invalidated for a decline, a refusal or an expiry.
- **Records the run in Activity** with `label`, `detail` (the terms line), `phase`, `hash`, `ledger`, `error`,
  `subject`, `product`, `mock`, `startedAt`, `updatedAt`. An attempt that sent nothing is removed again.
- **Looks an unknown outcome up** every 10 s (30 times), and on `checkAgain()` or `useActivity().check(id)`.

Activity is one list per wallet address, capped at 50 entries (an entry whose outcome is still open is never dropped), persisted in
`localStorage` under `stellsec.activity.v1.<address>` and kept in step across tabs. Mock and fixture transactions
stay in memory only: their hashes mean nothing after a reload, because the mock market starts again from its
seed. An entry found in storage still in flight after a reload is shown as `unknown` and can be checked again.

## Settings

| Export | Signature | Meaning |
|---|---|---|
| `initSettings` | `(): Settings` | Reads storage and writes `data-theme`, `data-density`, `data-pnl` on `<html>`. Safe before React mounts and without a document. |
| `useSettings` | `(): { theme; density; pnl; mode; set(patch); reset() }` | `theme`: `system`, `light`, `dark`. `density`: `comfortable`, `compact`. `pnl`: `default` (teal and orange), `classic` (green and red), `mono`. `mode`: `guided`, `chain`. `set` persists and applies. |
| `useDefaultMode` | `(): [mode, setMode]` | The remembered mode of an asset page. The URL's `mode=` wins over it. |
| `settingsStore`, `applySettings`, `DEFAULT_SETTINGS`, `MODE_CHOICES`, `SETTINGS_STORAGE_KEY` | store and constants | The external store behind the hooks (`subscribe`, `get`, `set`, `reset`, `reload`); the key is `stellsec.settings.v1`. |

Storage that is missing or throws is tolerated: the choice then holds for the page.

## The welcome guide

| Export | Signature | Meaning |
|---|---|---|
| `useGuide` | `(): { seen; persistent; run; start(id, origin); shown(id); decline(); end(run?) }` | `seen`: per guide (`tour`, `mode`), `0` declined, `n` shown at content version `n`, absent never. `persistent`: false when storage cannot be read or written (then nothing is offered). `run`: the guide asked for now, in memory only. The shell and the Markets page call `start`; the tour (mounted by `src/app`) calls `shown` and `end`. |
| `useModeNoteOffer` | `(onTradeTab: boolean, asset: string): void` | For the asset page: asks once for the note on the mode switch, by the rule `canOpenModeNote` of `core/guide`. |
| `guideStore`, `GUIDE_STORAGE_KEY` | store and constant | The external store behind the hook (`subscribe`, `get`, `start`, `shown`, `decline`, `end`, `reload`); its own key, `stellsec.guide.v1`, so resetting the settings never brings the welcome back. Storage is first touched when the state is first read. |

## Margin (`src/data/pro`)

```tsx
import { ProLoader, usePro } from '../../data/pro'

<ProLoader loading={<Skeleton />} error={(message, retry) => <ErrorState ... />} status={(state) => <LiveStatus ... />}>
  <MarginScreens />                 {/* everything under it can call usePro() */}
</ProLoader>
```

| Export | Signature | Meaning |
|---|---|---|
| `ProLoader` (alias `MarginLoader`) | `(props: { children; loading?; error?: (message, retry) => ReactNode; status?: (state: ProClientState) => ReactNode })` | Loads the Margin client of this build lazily (the fixture file, or the live client and the SDK), then provides it. Mount it only under the Margin routes. The client survives leaving and re-entering them. |
| `usePro` (alias `useMargin`) | `(): { client; sim; live; simulated; model; me; setMe; outcome; clearOutcome; run; tx; busy }` | The Margin state. `run(label, (opts) => client.deposit(me, amount, opts), 'Deposited.')` sends a call through the shared transaction layer and resolves with the call's `CallResult`; `tx` is its staged state, `outcome` the result banner (`ok`, `text`, `code`, `name`, `note`). `simulated` is true on fixtures: say "simulated, not on-chain". |
| `useProClient` | `(): { handle; error; retry; me; connected; status }` | The loader's state, for a caller that needs it without the provider. On chain it re-reads every 15 s while the tab is visible. |
| `ProProvider` (alias `MarginProvider`) | `(props: { client; sim; live?; defaultMe; children })` | The provider itself, for tests with a client of their own. |

## Files

| File | What is in it |
|---|---|
| `queryClient.ts`, `keys.ts`, `clientSource.ts`, `useOptionsClient.ts`, `providers.tsx`, `clock.ts` | The cache defaults, the key factory, the lazy client, the providers, the shared clock. |
| `queries.ts`, `network.ts` | The per-resource hooks and the network chip. |
| `derived.ts`, `derived/market.ts`, `derived/guided.ts`, `derived/positions.ts` | The derived hooks and their pure selectors (`buildMarket`, `buildBook`, `buildMarketIndex`, `matchGuided`, `buildPositions`, `buildTodo`, `resolveAssetRoute`). |
| `tx/runner.ts`, `tx/useTx.ts`, `tx/activityStore.ts`, `tx/useActivity.ts`, `tx/invalidation.ts`, `tx/flights.ts`, `tx/copy.ts` | The transaction layer. |
| `mutations.ts`, `usePreTrade.ts` | The twelve Covered writes and the pre-trade hook. |
| `settings.ts` | The settings store. |
| `guide.ts` | What this browser has seen of the welcome guide, and the request to run it. |
| `pro/` | The Margin provider. |

Checks: `npx vitest run src/data`, `npx oxlint src/data`.

## Added during integration (11 Nov 2026)

- `MarketView.bidsOn` / `resaleOn`: whether the contract has requests and resale at all (an older contract answers
  `null`). A read that is still running counts as supported, so a view does not flicker.
- `LADDER_ROWS` now lives in `core/series` (re-exported here): the ticket builds its strike chips with it too.
- `ActivityEntry.created`: what a confirmed write created (`option:<id>`, `bid:<id>`), recorded for `write-offer`,
  `create-bid` and `fill-bid`. `ActivityEntry.stoppedAt`: the stage a transaction had reached when it stopped.
- `TxController.run(what, write, created?)` and `CoveredWrite.created`: how the two above are fed.
- `txEffectText(state)` and `TX_REFUSED_ON_SEND`: a transaction that was signed, sent and refused before any ledger
  is never described as "nothing was sent". `describeTx` and the announcements use it.
- `isIssuerAction`, `issuerActionName`, `issuerSubject`, `parseIssuerSubject`: the issuer console's transactions
  are Covered entries under `issuer-authorize`, `issuer-freeze`, `issuer-clawback`.
- `NETWORK_STATE_LABEL` reads "Up to date", "Reads are late", "No connection" (the shell has its own words).
- `usePro()` gains `canCheckAgain` and `checkAgain()` for an unknown Margin outcome.
- `useAssetFacts` answers for a mock token with fixture flags marked `mock: true` (no counts are invented).
- `activityStore` is exported (the E2E hook and tests use the app's own instance).

## Added in the review pass (11 Nov 2026, evening)

- **Ledger time.** `clock.ts` keeps the offset between the latest ledger's close time and this device when it is
  15 s or more (`noteLedgerTime`, called by the ledger query); `useNowSec`, `useLedgerNowMs` and every kit
  `Countdown` (through the `ClockProvider` that `DataProvider` mounts) follow it. Mock data: no offset.
- **One unknown outcome at a time.** `runTransaction` refuses a write of an account while an earlier one of the same
  product is unknown and can still land (`unsettledEntry`, looked up once first; `txUnsettledMessage`), and
  `resumeUnknown` (mounted by `DataProvider`) restarts the look-up timer for unknown entries found in Activity.
  `useUnsettledTx()` gives a screen the same fact before the press.
- **After the screen closed.** A run whose screen unmounted tells its end state in a toast (`RunnerDeps.notify`,
  `noticeFor`) instead of only in the live region.
- **Stop waiting.** `TxController.signingSince` / `stopWaiting()`, `useActivity().signingSince(id)` /
  `stopWaiting(id)`, `STOP_WAITING_AFTER_MS`: a wallet that never answers can be given up after 60 s; nothing is
  sent, even if it signs later.
- **Activity.** Labels carry the money (`Buy put on 5.00 BOND for 1.80 USDx`, `..., locking 95.00 USDx, asking 0.21
  USDx`, `..., escrowing 0.50 USDx`, `..., locking 104.00 USDx, receiving 2.80 USDx`); `restore(entries)` undoes a
  clear; an error and the fee sentence are joined with a full stop (`asSentence`).
- **Portfolio.** `useRequestTodo()` (expired requests to take back), counted by `useActionsWaiting`;
  `usePortfolioKpis` reads the wallet's requests for `escrowed`, `lockedNow` and `readyToTakeBack`.
- **Guided.** `GuidedMatch.lots`: every quantity of the chosen series, uncapped.
- **Market.** `useMarket` builds its tabs with `chainExpiries`: a deadline less than an hour away keeps its tab.
- **Settings.** A stored density is no longer read back (the control left the menu).

