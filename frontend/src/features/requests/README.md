# features/requests

The Requests page (`/requests`): the board of funded bids across assets, the wallet's own requests, and the
entry points of the two tickets that act on them. A request is a buyer's premium already escrowed in the
contract, waiting for a seller (contract v1.5 `create_bid`, `fill_bid`, `cancel_bid`).

## Route contract

The router lazy-loads the named export `RequestsPage` from `index.tsx`. Search params (`RequestsSearch` in
`src/app/search.ts`), all optional and all written by the page:

| Param | Meaning | Written with |
|---|---|---|
| `asset` | Filter by underlying: the asset's URL segment (`bond`, or `CODE-ISSUER`). An unknown value shows every asset and says so. | replace |
| `kind` | `put` or `call`. | replace |
| `sort` | `premium` (highest premium per unit first). Absent means `deadline` (soonest first). | replace |
| `mine` | `1` shows "My requests". | push |
| `bid` | A bid id: opens the fill ticket (`TicketHost` overlay, `{ mode: 'fill', bidId }`). | push, replace on close |
| `new` | `1` opens the bid ticket. Without an asset (no filter, more than one listed) the asset chooser comes first. | push, replace on close |

## Files

| File | What it is |
|---|---|
| `RequestsPage.tsx` | The page: header, tabs, toolbar, board, "My requests", summary, the overlays. All URL state. |
| `board.ts` | Pure selectors and the row view model (`openRequests`, `filterRequests`, `sortRequests`, `myRequests`, `boardTotals`, `toRow`, `lockShortfall`, `parseBidId`). Exact `bigint` maths; tested in `board.test.ts`. |
| `copy.ts` | Every string. Tested against the banned-word list. |
| `BoardTable.tsx` | 768 px and up: a ruled table, two lines per row, the action pinned. |
| `RequestList.tsx` | Phones: list rows (what is wanted, strike, deadline, then the cost and the one action). |
| `view.ts` | The props both renderers take, and the "You hold" shortfall hint. |
| `RowActions.tsx` | Sell to this bid, Cancel request (with in-flight state), or the link to the position of a filled request. |
| `Toolbar.tsx` | Asset select, kind switch, order select. |
| `AssetChooser.tsx` | First step of "Post a request" when no asset is selected. Dialog, sheet on phones. |
| `CancelRequest.tsx` | Cancelling as a staged transaction (`useCancelBid`): what comes back, the stages, the outcome with its hash. |
| `HowItWorks.tsx` | Who acts and by when, in three steps. |
| `routing.ts`, `useIsPhone.ts` | URL patching; the 768 px switch between table and list. |

## Decisions

- **The board lists open requests only** (state open, deadline ahead). Expired, filled and cancelled requests
  appear under "My requests" for their buyer, each with where its premium is.
- **Default order is the soonest deadline.** Premium per unit is not comparable across assets of different
  price, so it is the second order, most useful once the board is filtered to one asset. Both orders compare
  exactly (cross-multiplied, never divided) and break ties by id.
- **No "age" column.** The contract's `Bid` has no creation time or ledger; the serial number (`No. 000003`)
  identifies the request instead.
- **The row states the collateral** a seller would lock ("You lock"), and, when the wallet's balance is known and
  too low, what it holds. It is a hint: the fill ticket runs the full pre-trade checks.
- **A guest sees every term.** "Sell to this bid" and "Post a request" open the ticket, which carries the
  "Connect wallet" action; "My requests" asks for a wallet.
- **Cancelling is not optimistic.** The row stays until the bid list is read again after the confirmation; the
  button shows "Cancelling" while the transaction is in flight, and every other transaction button is held.
