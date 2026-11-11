# `src/features/ticket`: the one order ticket

Six modes (buy an offer, write an offer, post a request, fill a request, buy a resale listing, list a position
for sale or re-price it), up to four steps (Terms for the forms, Review, Sign, Receipt), three containers. Other features import
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

The heading names the step; there is no step trail. Buy, fill and resale buy have nothing to set, so they open on
their review; write, request and list have a Terms step first (`startAt="review"` skips it when the terms are
complete). The wallet signature is the consent: there is no tick box.

- **Terms (the forms).** A ticket opened on a series shows it as three rows (kind, strike, deadline) with the pickers
  behind "Change terms": the standard grid (deadline chips from `core/series`, nine strikes around the reference
  price) and "Custom terms" for anything else. The premium is typed per unit; the total is computed exactly and
  shown, and the URL keeps the total. One validator (`core/maker/buildOffer`) plus the exactness of the total.
  Blocking findings of the pre-trade check are shown here already; the reason a button is disabled is printed above
  it. Enter in a field goes to the review. A guest sees everything and a Connect wallet action.
- **Review.** Ordered by what informs the decision: what moves (the first figure large, the premium sentence beside
  it), the issuer sentence (every mode but a listing), the checks that passed as one sentence with the read time
  ("Read from the contract at 13:45:12 UTC: the offer is open, ..."; a line that did not pass stays a row with its
  mark), the terms (strike, quantity, deadline, breakeven, most you can lose or, for a written call, what it gives
  up, the other party by role), the outcome on either side of the strike with the commitment sentence, and the
  payoff figure last, closed. A listing draws no figure. A transaction of this wallet whose outcome is unknown
  blocks every review until it is checked.
- **Sign.** `recheck()` reads everything again, fresh; a blocking change returns to the review and says so. Closing
  the ticket before the wallet is asked cancels the attempt. Then the mutation runs and `TxStepper` shows the state
  machine; the heading follows the state. What is printed is a snapshot of what was sent.
- **Receipt.** The contract note prints with its serial line, the transaction, the right in words for a holder,
  the deadline as an .ics download and a Google Calendar link (buy and resale buy), the way on ("View position",
  left out on that very page), "Write another" or "Post another" for the forms, and "Done". New terms from the page
  after a settled transaction start the form again at Terms.

## Checks ported from the old UI

Re-read of the offer, ask or bid on open and before signing; the price-moved guard on resale (the ask the buyer
reviewed is the `max_total`; a new price blocks until the buyer looks at it); issuer eligibility; premium, price,
escrow and collateral affordability with exact figures; exercise feasibility (warning); clawback shortfall
(the required sentence, blocking); self-trade (own offer, own request, own listing, own written option); the caps
of 50 open offers per writer and 50 open requests per buyer; the two-year tenor; exact strike times quantity;
implausible terms ("Check terms"); the lowest open offer in the series; what is locked and the balance after;
the last 15 minutes before a deadline; a link to Margin under the write form in a build with Margin, instead of
mixing the two regimes; an offer that a buyer could take and exercise at once (warning); a request on the same
series that pays at least the premium asked (fill it instead) and an offer that costs no more than a request (buy it
instead).

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
| `Flow.tsx` | The steps, the re-check, the review's order, the snapshot of what was sent. Every mode supplies a `Deal`. |
| `BuyFlow`, `ResaleFlow`, `FillFlow`, `ListFlow`, `OrderFlow` | One per mode (write and request share `OrderFlow`). |
| `SignStep`, `ReceiptStep`, `PayoffFigure`, `TermsList`, `parts`, `rows`, `words`, `states` | The pieces. |
| `harness/` | A test-only page (`/src/features/ticket/harness/index.html` on the dev server): lists what can be opened, switches the test wallet, stages how the next transaction ends. Not in the build. |

## Decisions

- **Phones get the drawer as a page.** Below 768 px the kit's `Drawer` fills the viewport; its footer is the
  action bar, outside the scrolling body, so no control can sit under it (the e2e spec measures the issuer
  sentence against the bar at 375 x 667 and 360 x 640). In the rail the action bar is pinned to the bottom of the
  scrolling column.
- **One offer is one lot.** The buy ticket shows the quantity as a term, not as an input: the contract sells an
  offer whole.
- **Figures on the term sheet are exact.** Breakeven and worst case are integer arithmetic on the contract's
  totals (`terms.ts`), truncated; the floats of packages/payoff only position the drawing.
- **A written call locks the underlying itself.** It gets no loss figure and never "No cap" or "unlimited": the row
  "You give up: Every rise above 25.00 USDx per EQTY" with "You cannot owe more than the 4.00 EQTY you lock; it can
  still fall in price.", and the chart says "Gives up the rise above 25.00". (The wording is open for Dev 1.)
- **Required sentences.** Issuer: review of buy, write, request, fill and resale buy, as a plain paragraph.
  Premium: next to "You pay" in the buy review; the resale sentence next to the price in the resale review.
  Escrow: the request ticket (terms and review). Clawback shortfall: through the pre-trade issue, on any ticket for
  that token. Payoff caption: every payoff figure.
