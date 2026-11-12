# features/markets

The Markets index and the asset page frame. Two folders inside belong to other owners and are only mounted
here: `guided/` (the guided flow) and `chain/` (the option chain and the series book).

## Routes (the router lazy-loads these named exports of `index.tsx`)

| Route | Export | Search (types in `src/app/search.ts`) |
|---|---|---|
| `/markets` | `MarketsIndexPage` | `intent` (an intent was chosen and the Assets section asks for its asset), `all=1` (every listed asset, not only the reference list), `funds=1` (the "Get test funds" strip for any connected wallet), `from` (the order that sent the wallet to the strip: an internal path with its search, at most 300 characters; the strip then ends with "Back to your order") |
| `/markets/$asset` | `AssetPage` | `tab` (`trade` default, `requests`, `about`), `mode` (`guided`, `chain`; without it the remembered setting applies), and everything the two modes and the ticket own |

`$asset` is a slug (`bond`), `CODE-ISSUER` or an asset contract id. `core/assets` resolves it; an accepted alias is
replaced by the canonical segment, and anything else gets the not-found view, which never prints the segment back.

## What the frame gives the two modes and the ticket

- `<GuidedMode assetId />` or `<ChainMode assetId />` in the main column of the Trade tab, by `mode`.
- `<TicketHost placement="rail" />` beside the Trade and Requests tabs, fed by `ticketIntentFromSearch(search, assetId)`.
  From 1200 px the rail is a column on the Trade tab (its idle content is `<GuidedClosing />` in guided mode and
  nothing in chain mode) and, on the Requests tab, only while a ticket is open.
- Closing clears `side, offer, bid, ask, step` (and `qty, premium` outside guided mode). It goes back to the entry
  that opened the ticket when nothing changed in between, and otherwise replaces the ticket's entry, so Back never
  reopens a closed ticket. Entering an entry whose order this browser has since bought, filled or cancelled opens
  the page without its ticket. A ticket link whose order is on another asset is moved to that asset.
- A tab link keeps `mode` and drops the selection and the ticket.
- The mode switch writes `mode` to the URL and to the setting (`useDefaultMode`), so a link names its view and a
  bare link opens the user's last choice.

## Files

| File | What it holds |
|---|---|
| `routing.ts` | Route ids, search readers (`useAssetSearch`, `useMarketsSearch`), `usePatchSearch`, `EXACT` for links to the route they are on |
| `model.ts` | Pure decisions, unit-tested: `indexList`, `obviousAsset`, `nearReference`, `needsTestFunds`, `fundsLead`, `fundingProgress`, `assetRequests`, `requestRow`, `accessCase` |
| `copy.ts` | Every sentence of the feature (required disclosures come from `core/disclosures`); `copy.test.ts` checks the wording rules |
| `parts.tsx`, `values.ts` | `Money`, `ChainId`, `BackToMarkets`, `ShortfallNotice`; `moneyText` |
| `index-page/` | `MarketsIndexPage`, `IntentList` (the four intents as ruled rows; one 56 px line each in a narrow column), `AssetsTable` (a table while it fits its column, cards below that, by container query; with an intent it answers "on which asset?"), `GetFunds`, `GuideSlip` (the welcome of the guide: a first visit only, in the page flow under the header; it gives way to `GetFunds`, and goes once answered or once a tour starts, leaving nothing behind; after "Not now" focus moves to the intents heading, which is also the page's `data-tour-return`). The two sections carry the guide's anchors `guideAnchor('intents')` and `guideAnchor('assets')` |
| `asset/` | `AssetPage`, `AssetHeader` (on the page's two columns; the holdings in the rail column), `AssetSwitch` (the other listed assets), `AssetTabs` (sub-tabs and mode switch; the switch's wrapper carries `guideAnchor('mode')`, and `useModeNoteOffer` asks for the guide's one note on it), `AssetStates` (skeleton, error, not found), `RequestsTab`, `AboutTab` |

## Decisions

- **Intent to asset.** An intent row links to `/markets?intent=…`: the Assets section then asks the question, each
  row's action carries the intent and links to `/markets/$asset?mode=guided&intent=…`, and a "You hold" column
  appears for an intent that starts from the asset. When one asset is the obvious choice (one asset listed, or the
  wallet holds exactly one for an intent that starts from the asset) the row names it and links straight to it.
- **Same on every row is not a cell.** The price source goes in the column header when every row shares it; the
  tier column and its legend only appear when tiers differ; the issuer only for assets outside the app's list
  (whose code is set in the mono face, slashed zero). The count line only appears when assets are hidden.
- **Premium columns.** "Put near demo price" and "Call near demo price" (named by the price's source): the best
  offer per unit at the ladder strike nearest the reference price, on the nearest listed deadline that has offers,
  with "at 99.00, 13 Nov" under it; "None" when that strike has no offer of the kind (`nearReference`, ruling F10;
  the metric is to be confirmed by the product owner). Each row reads its asset's market with `useMarket`.
- **Intents.** Each row says who pays the premium in two words ("You pay", "You are paid"); when it is paid is said
  at the ticket.
- **Reference price.** Always printed with its label; the asset header is the one home of the sentence that
  explains it, and adds the age when the price has one. Nothing here calls it a market price.
- **Thin markets and shortfalls.** An asset without open offers says so in its row and offers the two ways out;
  a token the contract is short of after a clawback says so in its row, linked to Reserves.
- **First run.** "Get test funds" shows for a connected wallet with no quote token, and at `?funds=1`. The steps
  happen in the wallet; progress is read from the balance statuses, never assumed. The asset header links to it
  when the wallet cannot pay, with `from` set to the order, so the strip ends with "Back to your order".
- **Requests tab.** Open, unexpired bids of the asset, highest premium per unit first, then the wallet's own
  lapsed bids ("Expired" under the deadline; cancelling refunds them, in the chain's cancel dialog).
- **About tab.** "Your access" first for a connected wallet (what the wallet lacks before what the issuer
  decided), then what the token is, the facts, the issuer's powers with the issuer sentence, and what they mean for
  an option. The contract's own facts are on Reserves.
- **Explorer links.** None in a build that runs on mock data, and none for mock placeholder ids.
