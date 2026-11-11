# features/markets

The Markets index and the asset page frame. Two folders inside belong to other owners and are only mounted
here: `guided/` (the guided flow) and `chain/` (the option chain and the series book).

## Routes (the router lazy-loads these named exports of `index.tsx`)

| Route | Export | Search (types in `src/app/search.ts`) |
|---|---|---|
| `/markets` | `MarketsIndexPage` | `intent` (an intent card was chosen and waits for its asset), `all=1` (every listed asset, not only the reference list) |
| `/markets/$asset` | `AssetPage` | `tab` (`trade` default, `requests`, `about`), `mode` (`guided`, `chain`; without it the remembered setting applies), and everything the two modes and the ticket own |

`$asset` is a slug (`bond`), `CODE-ISSUER` or an asset contract id. `core/assets` resolves it; an accepted alias is
replaced by the canonical segment, and anything else gets the not-found view, which never prints the segment back.

## What the frame gives the two modes and the ticket

- `<GuidedMode assetId />` or `<ChainMode assetId />` in the main column of the Trade tab, by `mode`.
- `<TicketHost placement="rail" />` beside the Trade and Requests tabs, fed by `ticketIntentFromSearch(search, assetId)`.
  Closing clears `side, offer, bid, ask, step, qty, premium`; the series selection (`kind`, `strike`, `expiry`) and
  `intent` stay.
- A tab link keeps `mode` and drops the selection and the ticket.
- The mode switch writes `mode` to the URL and to the setting (`useDefaultMode`), so a link names its view and a
  bare link opens the user's last choice.

## Files

| File | What it holds |
|---|---|
| `routing.ts` | Route ids, search readers (`useAssetSearch`, `useMarketsSearch`), `usePatchSearch`, `EXACT` for links to the route they are on |
| `model.ts` | Pure decisions, unit-tested: `indexList`, `obviousAsset`, `needsTestFunds`, `fundingProgress`, `assetRequests` |
| `copy.ts` | Every sentence of the feature (required disclosures come from `core/disclosures`); `copy.test.ts` checks the wording rules |
| `parts.tsx`, `values.ts` | `Money`, `ChainId`, `BackToMarkets`, `ShortfallNotice`; `moneyText`, `assetGlyph` |
| `index-page/` | `MarketsIndexPage`, `IntentCards`, `AssetChoice`, `AssetsTable` (table from 768 px, cards below), `GetFunds` |
| `asset/` | `AssetPage`, `AssetHeader`, `AssetTabs` (sub-tabs and mode switch), `AssetStates` (skeleton, error, not found), `RequestsTab`, `AboutTab`, `TicketIdle` |

## Decisions

- **Intent to asset.** A card links to `/markets?intent=…`, which opens the asset choice under the cards; a row
  there links to `/markets/$asset?mode=guided&intent=…`. When one asset is the obvious choice (one asset listed,
  or the wallet holds exactly one for an intent that starts from the asset) the card links straight to it.
- **Reference price.** Always printed with its label; the header adds the note and, when the price has one, its
  age. Nothing here calls it a market price.
- **Thin markets.** An asset without open offers says so in its row and offers the two ways out.
- **First run.** "Get test funds" shows for a connected wallet whose balances are all zero or missing. The steps
  happen in the wallet; progress is read from the balance statuses, never assumed.
- **Requests tab.** Open, unexpired bids of the asset, highest premium per unit first, then the wallet's own
  lapsed bids (cancelling refunds them). The wallet's own premium is under the highlighter.
- **About tab.** Home of the issuer sentence. A mock asset has no on-chain facts and says so; its flags are
  shown as "Not read" with the effect each flag has when it is on.
- **Explorer links.** None in a build that runs on mock data, and none for mock placeholder ids.
