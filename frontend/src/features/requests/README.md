# features/requests

The Requests page (`/requests`): the board of open requests across assets, the wallet's own requests, and the
entry points of the two tickets that act on them. A request is a buyer's premium already escrowed in the
contract, waiting for a maker (contract v1.5 `create_bid`, `fill_bid`, `cancel_bid`; the code keeps the
contract's word "bid", everything a user reads says "request").

## Route contract

The router lazy-loads the named export `RequestsPage` from `index.tsx`. Search params (`RequestsSearch` in
`src/app/search.ts`), all optional and all written by the page:

| Param | Meaning | Written with |
|---|---|---|
| `asset` | Filter by underlying: the asset's URL segment (`bond`, or `CODE-ISSUER`). An unknown value shows every asset and says so. | replace |
| `kind` | `put` or `call`. | replace |
| `sort` | `premium` (highest premium per unit first). Absent means `deadline` (soonest first). From 1200 px the Deadline and Premium headers set it; below, a select (a menu on phones). | replace |
| `mine` | `1` shows "My requests". | replace |
| `bid` | A bid id: opens the fill ticket (`TicketHost` overlay, `{ mode: 'fill', bidId }`), on its review step when a wallet is connected. | push, replace on close |
| `new` | `1` opens the request ticket on the filtered asset. Without one (no filter, more than one listed) the asset chooser comes first; its choice is written to `asset`, so a reload or a shared link reopens the same ticket, and closing the ticket puts the filter back. | push, replace on close |

## Files

| File | What it is |
|---|---|
| `RequestsPage.tsx` | The page: header, tabs, toolbar, board (25 rows at a time), "My requests" with "Show closed", summary, the overlays. URL state, except the page size and "Show closed". |
| `board.ts` | Pure selectors and the row view model (`asOf`, `openRequests`, `filterRequests`, `sortRequests`, `myRequests`, `isClosed`, `boardTotals`, `toRow` with the labelled reference price, `lockShortfall`, `parseBidId`). Exact `bigint` maths; tested in `board.test.ts`. |
| `copy.ts` | Every string. Tested against the banned words, the banned taglines and the vocabulary rule (request, deadline, maker). |
| `BoardTable.tsx` | 1200 px and up: a ruled table of fixed columns, figures on the first line and their captions beneath, sortable Deadline and Premium headers, the action pinned. Scrolls inside its frame from 13 rows so the header stays in view. |
| `RequestList.tsx` | Below 1200 px: list rows (what is wanted, strike with the reference price, deadline, then the cost and the one action), two columns from 768 px. |
| `view.ts` | The props both renderers take and the rules both apply: the "You hold" hint, tokens the wallet holds none of, the warning tone of a countdown, the 15-minute line. |
| `RowActions.tsx` | Fill request, Cancel request, Take back (an expired request of the wallet), with in-flight state, or the link to the position of a filled request. |
| `Toolbar.tsx` | Asset select, kind switch, and the order where the table headers do not set it. |
| `AssetChooser.tsx` | First step of "Post a request" when no asset is selected. Opens at once, with its own loading and error states. Dialog, sheet on phones. |
| `CancelRequest.tsx` | Cancelling (or taking back the premium of an expired request) as a staged transaction (`useCancelBid`): what comes back, the stages, the outcome with its hash. |
| `routing.ts` | URL patching and the routes the page links to. |

## Decisions

- **The board lists open requests only** (state open, deadline ahead). "My requests" shows, for its buyer, the
  requests that still hold the premium and the filled ones; an expired request whose premium is still in the
  contract comes first, as the one row that asks for an action ("Take back 0.92 USDx"). Cancelled and returned
  requests are behind "Show closed".
- **Default order is the soonest deadline.** Premium per unit is not comparable across assets of different
  price, so it is the second order, most useful once the board is filtered to one asset. Both orders compare
  exactly (cross-multiplied, never divided) and break ties by id.
- **No "age" column.** The contract's `Bid` has no creation time or ledger; the serial number (`No. 000003`)
  identifies the request instead.
- **The row states the collateral** a maker would lock ("You lock"), and, when the wallet's balance is known and
  too low, what it holds. A token the wallet holds none of is said once above the board, with the way to test
  funds. It is a hint: the fill ticket runs the full pre-trade checks.
- **The reference price sits under the strike** with its two-word label ("Demo price 10.20") and nothing more.
- **The premium column leads with the figure per unit**, beside the strike per unit, with the total beneath.
- **The warning tone is for the wallet's own open request** under 48 hours. Other wallets' requests keep a neutral
  countdown; under 15 minutes they say in words that a transaction may land after the deadline.
- **A guest sees every term.** "Fill request" and "Post a request" open the ticket, which carries the
  "Connect wallet" action; "My requests" asks for a wallet.
- **Cancelling is not optimistic.** The row stays until the bid list is read again after the confirmation; the
  button shows "Cancelling" while the transaction is in flight, and every other transaction button is held.
