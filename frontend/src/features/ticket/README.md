# `src/features/ticket`: the one order ticket

Six modes (buy an offer, write an offer, post a request, fill a request, buy a resale listing, list a position
for sale or re-price it), four steps (Terms, Review, Sign, Receipt), three containers. Other features import
`index.tsx` and nothing else from this folder.

## Public API (`index.tsx`)

```ts
export type TicketIntent =
  | { mode: 'buy'; offerId: bigint }
  | { mode: 'write'; assetId: string; kind: 'put' | 'call'; strike?: string; expiry?: number; qty?: string; premium?: string }
  | { mode: 'bid'; assetId: string; kind: 'put' | 'call'; strike?: string; expiry?: number; qty?: string; premium?: string }
  | { mode: 'fill'; bidId: bigint }
  | { mode: 'buy-resale'; optionId: bigint }
  | { mode: 'list'; optionId: bigint }

export function TicketHost(props: {
  intent: TicketIntent | null
  onClose: () => void
  onIntentChange?: (next: TicketIntent) => void
  placement: 'rail' | 'overlay'
  startAt?: 'terms' | 'review'
  idle?: React.ReactNode
}): React.JSX.Element

export function ticketIntentFromSearch(search: AssetSearch, assetId: string): TicketIntent | null
export function searchFromTicketIntent(intent: TicketIntent | null): Partial<AssetSearch>
```

- `strike`, `qty` and `premium` are decimal strings as typed; `strike` is per whole unit, `premium` is the total.
  `expiry` is unix seconds; `assetId` is the underlying token contract id.
- **`placement="rail"`** (asset page): an inline panel from 1200 px (the page positions and scrolls the column),
  a right drawer from 768 to 1199 px, a full page with a 64 px action bar on phones. With a null intent it renders
  `idle` in the rail and nothing below 1200 px.
- **`placement="overlay"`** (any other page): the drawer from 768 px, the page on phones, nothing when null.
- **`onClose`** must make `intent` null (clear the URL params, or the state that holds the intent). The receipt's
  "Done", the close button and Escape all call it.
- **`onIntentChange`** is optional. With it the ticket shows the Buy, Write and Request tabs and mirrors the terms
  of a form (kind, strike, expiry; quantity and premium on blur) so the series stays linkable. Navigate with
  `replace: true`. The form is the source of truth while it is open; it takes over terms that change under it.
- **`startAt="review"`** opens on the review step when the terms are complete (the guided flow's primary action).
- The host needs the app providers (wallet, data, tooltips, live regions) and a router: the receipt links to
  `/portfolio/$id`, `/portfolio`, `/requests` and, for the Margin card, `/margin/trade`.

### URL mapping

| Search | Intent |
|---|---|
| `side=write` or `side=bid` (+ `kind`, `strike`, `expiry=YYYY-MM-DD`, `qty`, `premium`) | the two forms, prefilled |
| `offer=<id>` | buy that offer |
| `ask=<id>` | buy that resale listing |
| `bid=<id>` | fill that request |
| `side=buy` alone | none: the page picks the offer and sets `offer` |

`searchFromTicketIntent(null)` clears `side`, `offer`, `bid`, `ask` and leaves the series selection. The expiry
travels as its UTC day, so a custom time of day lives in the form only. A `list` intent has no place on the asset
route: the portfolio keeps it in its own state.

## What each step does

- **Terms.** Read-only terms for buy, fill and resale; a price for list; the form for write and request. The form
  defaults to the standard grid (expiry chips from `core/series`, nine strikes around the reference price) with a
  "Custom terms" disclosure for anything else. One validator (`core/maker/buildOffer`): positive amounts, exact
  strike times quantity, a future expiry within two years. Blocking findings of the pre-trade check are shown
  here already and disable Review with the reason. A guest sees everything and a Connect wallet action.
- **Review.** A serif impact summary (you pay or receive, you lock, breakeven, most you can lose, deadline in UTC
  with the countdown and the local time, counterparty), the three status lines of `usePreTrade` (the offer,
  request, listing or option re-read from the contract; issuer eligibility; the balance), the payoff figure with
  the assumed-price handle starting at the reference price, the required sentences at their home, and the
  consent checkbox that gates the action. Consent is tied to the exact action label: a re-priced listing asks again.
- **Sign.** `recheck()` reads everything again, fresh; a blocking change returns to the review and says so.
  Then the mutation runs and `TxStepper` shows the state machine, each state in words. An unknown outcome offers
  "Check again" only; the copy names the end of the validity window. Nothing sent, outcome unknown and fee charged
  always read differently.
- **Receipt.** The contract note prints with its serial line, the transaction, who acts next and by when, the
  deadline as an .ics download and a Google Calendar link (buy and resale buy), "View position" and "Done". Focus
  moves to the heading of every step and of the receipt.

## Checks ported from the old UI

Re-read of the offer, ask or bid on open and before signing; the price-moved guard on resale (the ask the buyer
reviewed is the `max_total`; a new price blocks until the buyer looks at it); issuer eligibility; premium, price,
escrow and collateral affordability with exact figures; exercise feasibility (warning); clawback shortfall
(the required sentence, blocking); self-trade (own offer, own request, own listing, own written option); the caps
of 50 open offers per writer and 50 open requests per buyer; the two-year tenor; exact strike times quantity;
implausible terms ("Check terms"); the lowest open offer in the series; what is locked and the balance after;
the last 15 minutes before a deadline; the collateral choice (Full collateral or Margin) when writing in a build
with Margin, which links to the Margin section instead of mixing the two regimes.

## Files

| File | What it is |
|---|---|
| `intent.ts` | `TicketIntent`, the URL mapping, `intentKey` (what restarts a flow). Pure. |
| `terms.ts` | Exact integer figures of one option from one side: breakeven, most you can lose or gain, exercise legs. Pure. |
| `payoff.ts` | The payoff figure's inputs: the curve from packages/payoff, labels from exact integers. Pure. |
| `form.ts` | The write and request form: grid, defaults, the draft, custom expiry, what to take over from the URL. Pure. |
| `copy.ts` | Every sentence of the ticket that is not a required disclosure. `copy.test.ts` checks the wording rules. |
| `TicketHost.tsx` | The three containers, the tabs, focus on open and close. |
| `frame.ts`, `Actions.tsx` | What a flow gets from its container; the portal into the action bar. |
| `Flow.tsx` | The four steps, the re-check, the consent gate. Every mode supplies a `Deal`. |
| `BuyFlow`, `ResaleFlow`, `FillFlow`, `ListFlow`, `OrderFlow` | One per mode (write and request share `OrderFlow`). |
| `SignStep`, `ReceiptStep`, `PayoffFigure`, `TermsList`, `StepTrail`, `ChoiceChips`, `parts`, `rows`, `states` | The pieces. |
| `harness/` | A test-only page (`/src/features/ticket/harness/index.html` on the dev server): lists what can be opened, switches the test wallet, stages how the next transaction ends. Not in the build. |

## Decisions

- **Phones get the drawer as a page.** Below 768 px the kit's `Drawer` fills the viewport; its footer is the
  action bar, outside the scrolling body, so no control can sit under it (the e2e spec measures the consent box
  against the bar). The rail's actions are inline at the end of the sheet.
- **One offer is one lot.** The buy ticket shows the quantity as a term, not as an input: the contract sells an
  offer whole.
- **Figures on the term sheet are exact.** Breakeven and worst case are integer arithmetic on the contract's
  totals (`terms.ts`), truncated; the floats of packages/payoff only position the drawing.
- **A covered call has no capped loss on the option itself.** The row says "No cap" and what is given up, rather
  than a figure that would depend on an entry price the ticket does not know.
- **Required sentences.** Issuer control: review of buy, fill and resale buy. Premium: next to "You pay" in the buy
  review; the resale sentence next to the price in the resale review. Escrow: the request ticket (terms and
  review). Clawback shortfall: through the pre-trade issue, on any ticket for that token. Payoff caption: every
  payoff figure. Collateral cards: the write form, Margin builds only.
