# features/reserves

The Reserves page (`/reserves`, brief 4.7). The router lazy-loads the named export `ReservesPage` from
`index.tsx`. The page reads no params and no search. Nothing here needs a wallet: every figure is a public read.

## What is on the page

1. **Title, one line, the read line.** "Read at ledger N, HH:MM:SS UTC" with Refresh. Mock data has no ledger,
   so a mock build shows the time only.
2. **Held against locked.** One sentence over the rows (`summaryLine`), then:
   - `ReserveFigure`: a `BulletRow` (src/viz) per token, bar = held, tick = locked, hatched gap = shortfall. It
     is `aria-hidden`: the table carries the same figures as text.
   - `ReadingNotes`: what Locked, Held and Difference mean and which contract function each is read from.
   - `ReserveTable`: the statement. Headers are exactly `Token, Locked, Held, Difference`. A row opens
     (button with `aria-expanded` in the row header) to the split of what is locked: Offered, Active, Pending
     reclaim, Unclaimed and, for the quote token, Escrowed (request premiums), then their sum and the ids to
     check the token against. From 768 px the split is rows of the same table with the amounts in the Locked
     column; on a phone it is one cell holding a list.
   - `Limits`: what the page does not show, in its own words.
3. **The clawback-shortfall notice** (`ShortfallCallout`) when held is below locked for any token: the sentence
   is `clawbackShortfallDisclosure` from `core/disclosures` (this page is its home) and the callout is the one
   `role="alert"` on the page. Without a shortfall the page has no alert role at all.
4. **Contracts and roles** (`ContractsAndRoles`): the Covered contract id in full, version, wasm hash, deploy
   transaction, "No admin. No upgrades. No oracle." with one line each; the token contracts with issuer and the
   three issuer flags in plain words; and, when the build has Margin (`PRO_ENABLED`), the Margin contract in a
   fenced block with its admin and publisher: address, what each can do, what each cannot.

## Where the facts come from

| Fact | Source |
|---|---|
| Locked, held | `useHealth()`: `open_collateral(token)` and the token balance of the contract |
| The split by state | `useCollateral()`: `collateralLines(options, bids)` |
| Row arithmetic | `core/reserves` `backingFor` (never recomputed here) |
| Ledger | `useLedger()` (off on mock data) |
| Contract ids, wasm hashes, deploy transactions, Margin admin and publisher | `deployments.ts`, copied from AGENTS.md "Deployed contracts" (26 Oct 2026). The clients expose none of these. |
| Issuer flags | Live build: `useAssetFacts(token)` per token, the record as fallback (and the page says so). Mock build: the record. |
| What a role can and cannot do | `copy.ts`, from AGENTS.md "StellSec Pro" and the header of `contracts/pro/src/lib.rs` |

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
| First read running | `LoadingReserves` skeleton (`aria-busy`), contracts and roles already readable |
| Nothing could be read | Danger callout with the reason and "Read again"; announced once, assertively |
| Balances unreadable | Warning callout; Locked is the sum of the items, Held reads "Unavailable", no bars |
| Option list unreadable | Warning callout; Locked and Held are the contract's figures, the split is missing |
| A refresh failed | Warning callout "The last read failed" with the time of the figures on screen |
| Nothing locked | `EmptyNote` in place of the bars; the table still lists the tokens at 0.00 |
| Shortfall | The alert callout, hatched bars, `−20.00 short` in the Difference column |
| Items do not add up to locked | Warning under the split; the contract's figure stays the one shown |

## Files

- `model.ts` (pure, tested): `reserveRows`, `visibleRows`, `summaryLine`, texts. Amounts stay `bigint`; `chartNumber` is the
  only `number` and only sets a bar length.
- `copy.ts` (tested against the banned-word lists): every sentence. `deployments.ts` (tested): the record.
- `useReserves.ts`: the reads as one view. `useIsPhone.ts`: the 768 px switch (a copy also lives in Activity
  and Requests; a shared hook is requested from the ui kit).
- Tests: `model.test.ts`, `copy.test.ts`, `deployments.test.ts`, and `e2e/reserves.spec.ts`.

Each cell of the statement carries `data-units` (the exact integer units) so a test compares integers, not
formatted text.
