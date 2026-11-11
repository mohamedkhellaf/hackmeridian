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
| `board.ts` | Pure selectors (`asOf`, `openRequests`, `filterRequests`, `sortRequests`, `myRequests`, `isClosed`, `boardTotals`, `parseBidId`) and the page's names for the row model of `core/requests/rows` (`toRow`, `money`). Exact `bigint` maths; tested in `board.test.ts`. |
| `copy.ts` | Every string of the page; the words of a row (columns, actions, card lines) are re-exported from `core/requests/rows`, shared with the asset Requests tab. Tested against the banned words, the banned taglines and the vocabulary rule (request, deadline, maker). |
| `BoardTable.tsx` | 1200 px and up: a ruled table of fixed columns, figures on the first line and their captions beneath, sortable Deadline and Premium headers, the action pinned. Scrolls inside its frame from 13 rows so the header stays in view. |
| `RequestList.tsx` | Below 1200 px: one card per request (what is wanted and the premium per unit, the strike and the total, the deadline and the time left, the buyer and the action), two columns from 768 px. |
| `view.ts` | The props both renderers take, and the tokens the wallet holds none of (said once above the board). The warning tone and the 15-minute line come from `core/requests/rows`. |
| `RowActions.tsx` | Fill request, Cancel request (before or after the deadline), with in-flight state, or the link to the position of a filled request. Secondary buttons, `sm` in the table and touch-sized on a card. |
| `Toolbar.tsx` | Asset select, kind switch, and the order where the table headers do not set it. On phones under 400 px the asset select takes its own line. |
| `AssetChooser.tsx` | First step of "Post a request" when no asset is selected. Opens at once, with its own loading and error states. Dialog, sheet on phones. |
| `CancelRequest.tsx` | Cancelling as a staged transaction (`useCancelBid`): what comes back, the stages, the outcome with its hash. Sized to its content at rest and after the outcome; the stepper's height is held only while the transaction runs. |
| `routing.ts` | URL patching and the routes the page links to. |

## Decisions

- **One drawing of a request** (ruling F15). /requests and the asset page's Requests tab draw an open request the
  same way: Kind, Strike (serif, `Td strike`), Quantity, Deadline (`13 Nov 2026, 08:00 UTC` with the time left
  beneath), Premium per unit with the total beneath, Buyer, the action; the request's number under the row's first
  cell; on phones the same card. The words and rules live with the row model in `core/requests/rows`. The board
  spans assets, so its asset column leads; the asset tab is one asset, so it has none.
- **The board lists open requests only** (state open, deadline ahead). "My requests" shows, for its buyer, the
  requests that still hold the premium and the filled ones; an expired request whose premium is still in the
  contract comes first, as the one row that asks for an action: "Cancel request", the same name as before the
  deadline (ruling F9: `cancel_bid` works while the request is open, before or after its deadline, and returns the
  premium). Cancelled and returned requests are behind "Show closed".
- **Default order is the soonest deadline.** Premium per unit is not comparable across assets of different
  price, so it is the second order, most useful once the board is filtered to one asset. Both orders compare
  exactly (cross-multiplied, never divided) and break ties by id.
- **No "age" column.** The contract's `Bid` has no creation time or ledger; the number (`No. 3`, unpadded) identifies
  the request instead.
- **What a maker locks** is in the accessible name of "Fill request" and in the fill ticket, not a column (ruling
  F15 fixes the columns). A token the wallet holds none of is said once above the board, with the way to test
  funds; the fill ticket runs the full pre-trade checks.
- **The reference price sits under the strike** with its two-word label ("Demo price 10.20") and nothing more.
- **The premium column leads with the figure per unit**, beside the strike per unit, with the total beneath.
- **The warning tone is for the wallet's own open request** under 48 hours. Other wallets' requests keep a neutral
  countdown; under 15 minutes they say in words that a transaction may land after the deadline.
- **A guest sees every term.** "Fill request" and "Post a request" open the ticket, which carries the
  "Connect wallet" action; "My requests" asks for a wallet.
- **Cancelling is not optimistic.** The row stays until the bid list is read again after the confirmation; the
  button shows "Cancelling" while the transaction is in flight, and every other transaction button is held.
