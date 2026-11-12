# features/reserves

The Reserves page (`/reserves`, brief 4.7). The router lazy-loads the named export `ReservesPage` from
`index.tsx`. The page reads no params and no search. Nothing here needs a wallet: every figure is a public read.

## What is on the page

1. **Title, one line, the read line.** "Read at ledger N, HH:MM:SS UTC" with Refresh. A mock build says where its
   figures come from instead: "Mock data, HH:MM:SS UTC".
2. **The clawback-shortfall notice** (`ShortfallCallout`) when held is below locked for any token: the required
   sentence (`clawbackShortfallDisclosure` from `core/disclosures`, this page is its home) and nothing else; the
   rows right below carry the figures. It is the one `role="alert"` on the page. Without a shortfall the page has
   no alert role at all.
3. **Held against locked.** One sentence (`summaryLine`), left out when a notice above already says it, then:
   - `ReserveTable`: the statement. Headers are exactly `Token, Locked, Held, Difference`; fixed columns; the
     token code in serif, the three figures in the table's sans face, as every money column. Under 400 px (a
     container query on the statement block) the figure columns narrow to what a figure needs and the role sits
     flush under the code, so all four columns fit at 320 px. A token whose held
     differs from locked carries a bar in its row (`Bullet` from src/viz: bar = held, tick = locked, hatched =
     shortfall), hidden from assistive technology since the figures beside it say the same. The word of a
     difference (short, over) sits in a slot of its own so every figure ends on the same edge; a difference under
     a cent reads "under 0.01". A row opens (the button with `aria-expanded` in the row header, or a click
     anywhere on the row) to the split of what is locked: Offered, Active, Pending reclaim, Unclaimed and, for the
     quote token, Escrowed (request premiums), then their sum and, for a real token, the ids to check it against.
     From 768 px the split is rows of the same table with the amounts in the Locked column; on a phone it is one
     cell holding a list under "Locked, by state".
   - `ReadingNotes` ("Notes"): what Locked, Held and Difference mean and, on a live build, which contract
     function each is read from.
   - A figure that changed since the last read cross-fades and flashes the marker once (`Changed`, using the
     kit's `Marker flash`).
4. **Contracts and roles** (`ContractsAndRoles`): per contract one ruled list (`FactList variant="record"`) in one
   order: contract id in full, version, wasm hash, deploy transaction, deployer, then the facts (Admin,
   Upgrades, Oracle, Asset listing, Audit for Covered; Upgrades, Prices, Audit for Margin). Then the token
   contracts with issuer and the three issuer flags, named and answered in the one vocabulary of
   `core/assetfacts` that the asset About tab and the Issuer page use (`FLAG_LABELS`, `POWER_STATE`; the Stellar
   flag names only in the footnote), and, when the build has Margin
   (`PRO_ENABLED`), the Margin contract in a fenced block: its list, the admin and the publisher with their
   addresses and what each does, and once for both what neither can do. Copy buttons belong to ids printed in
   full and to wasm hashes; a shortened id carries its explorer link only.

The page has two measures: prose at `--measure`, and every table and list (the statement, the notes, the
contracts, the tokens, the Margin block) at the page's one width (60rem), so the blocks end on one edge.

## Where the facts come from

| Fact | Source |
|---|---|
| Locked, held | `useHealth()`: `open_collateral(token)` and the token balance of the contract |
| The split by state | `useCollateral()`: `collateralLines(options, bids)` |
| Row arithmetic | `core/reserves` `backingFor` (never recomputed here) |
| Ledger | `useLedger()` (off on mock data) |
| Contract ids, wasm hashes, deploy transactions, Margin admin and publisher | `core/deployments`, copied from AGENTS.md "Deployed contracts" (26 Oct 2026). The clients expose none of these. |
| Issuer flags | Live build: `useAssetFacts(token)` per token, the record as fallback (and the page says so). Mock build: the record. |
| What a role does and what neither can do | `copy.ts`, from AGENTS.md "StellSec Pro" and the header of `contracts/pro/src/lib.rs` |

A mock build calls no contract, so "Contracts and roles" lists the recorded Testnet deployment and says so. A
live build shows the contract id it points at; if that is not the recorded id it shows no hash and says the app
holds no record for it.

## Which tokens are shown

Anyone can list an asset in the contract. The statement always shows the quote token, the reference assets
(`core/assets`) and every token with something locked, held or short (`visibleRows`); a listed token outside the
reference list with nothing locked and nothing held is only counted, in a line under the table. The token table
of "Contracts and roles" keeps to the quote token and the reference assets (each row costs three reads) and
counts the rest.

## States

| State | What shows |
|---|---|
| First read running | `LoadingReserves`: the real heading, a summary line and four rows of skeleton, then the notes (`aria-busy`); contracts and roles already readable |
| Nothing could be read | Danger callout: what failed in plain words, the raw message behind "Technical detail", and Refresh; announced once, assertively. After a successful Refresh focus goes to the statement's heading. |
| Balances unreadable | Warning callout (no button: Refresh is in the header); Locked is the sum of the items, Held reads "Unavailable", no bars, no summary |
| Option list unreadable | Warning callout; Locked and Held are the contract's figures, the split is missing |
| A refresh failed | Warning callout "The last read failed" with the time of the figures on screen |
| Nothing locked | The summary line says "Nothing is locked in the contract."; the table lists the tokens at 0.00 |
| Shortfall | The alert callout, the hatched bar in the row, `−20.00 short` in the Difference column |
| Items do not add up to locked | Warning under the split; the contract's figure stays the one shown |

## Files

- `model.ts` (pure, tested): `reserveRows`, `visibleRows`, `summaryLine`, texts (`differenceShown`, `subCent`).
  Amounts stay `bigint`; `chartNumber` is the only `number` and only sets a bar length.
- `copy.ts` (tested against the banned-word lists): every sentence. The deployment record is `core/deployments`.
- `useReserves.ts`: the reads as one view.
- Tests: `model.test.ts`, `copy.test.ts`, and `e2e/reserves.spec.ts`.

Each cell of the statement carries `data-units` (the exact integer units) so a test compares integers, not
formatted text.
