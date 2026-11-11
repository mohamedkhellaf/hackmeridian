# features/markets/chain

Chain mode of the asset page (brief 4.3, ruling E9). `index.tsx` exports `ChainMode({ assetId })`; the markets
feature mounts it in the main column of `/markets/$asset` when the mode is `chain`. Everything it shows comes from
`useMarket`, `useBook` and `usePositions` of the data layer (the standard grid of `core/series` laid over the
contract's orders). Nothing here prices, ranks or filters an order.

## What is on screen

| Part | File | Notes |
|---|---|---|
| Deadlines | `ExpiryBar.tsx` | One radio group (`Segmented`) of the listed dates with the time left and, on a wide column, the number of orders as a plain muted numeral. On a narrow column the numeral leaves the tab (after a time left it read as hours) and the line under the bar says it in words: `Deadline 13 Nov 2026, 08:00 UTC, 12 orders.` (ruling F3). A date with no order has its date in muted ink and no numeral. "Other dates, N orders" links to "Other offers", shown only when an order sits on a date that is not listed. |
| The chain | `ChainTable.tsx` | Native table: calls, strike (row header, toned, serif, right-aligned in a centred box, a rule on each side so the in-the-money tone does not merge with it), puts. Each side of a strike is two buttons (ruling F3): the best offer per unit with its size (`0.21 ×1.00`) next to the strike, and the best request with its size (`0.13 ×5.00`) further out. An empty half shows nothing at rest; pointed at or focused it shows what a press does, "Post a request" (ruling F2). The chain takes the whole main column. On a narrow column (`compact`, under 680 px) the four halves keep their places and each prints its size under its figure; "yours" is then left to the highlighter and the name. The dashed reference rule is a row of its own with a plain label; when the reference equals a strike, that strike's row carries the label instead. |
| Selected series | `SeriesPanel.tsx` | Heading (`BOND 100.00 put, 13 Nov`), "Write an offer", "Post a request", the right in one sentence with moneyness at the reference, the deadline (date first, then the time left), what the wallet holds or wrote of the series with a link to the position, and the book as one table. |
| Orders | `OrdersTable.tsx`, `OrdersList.tsx`, `OrderAction.tsx`, `orders.ts` | One table with fixed columns: No. (the contract's id, unpadded, through `serialOf`; ruling F1), From (Maker, Seller or Buyer), Quantity, Premium per unit, Total premium, one action, a small secondary button on every row (ruling F14). Groups: offers, the gap line, requests. A list with every column kept on phones. Warnings (terms that cannot pay back, a reserve shortfall) carry the warning mark; the reason an order is off the grid is plain words. |
| Your orders | `YourOrders.tsx` | The connected wallet's open offers, listings and requests on the asset across every deadline, each with Cancel (or Manage for a listing) and its series as a control that selects it. "From" carries the role alone (the title says the rows are the wallet's). The orders of the selected series are left out: its book above lists them, with their one Cancel. |
| Off-grid orders | `OtherOffers.tsx` | Every non-standard order of the asset with the reason from `classifyOffer`, and what each reason means. Still tradable. |
| Cancel | `CancelDialog.tsx` | The wallet's own offer or request: what comes back, then the transaction stages (`useCancelOffer`, `useCancelBid`). |
| Logic | `model.ts`, `useRoving.ts`, `url.ts`, `copy.ts` | Pure selection, the text and the action of each half, the gap line, keyboard moves; the roving tab stop; search params; every string. |

## URL contract

The selection is the URL: `expiry` (UTC day of a listed date), `kind`, `strike` (decimal, per unit). A link with an
unknown date falls back to the first date that has offers. Tickets are opened by writing the ticket's own params
through `searchFromTicketIntent` of `features/ticket`; the asset page turns them into the ticket in its rail.

| Action | Search written |
|---|---|
| Press an offer, from 1200 px | the selection and the ticket on that best offer: `side=buy&offer=<id>`, or `side=buy&ask=<id>` for a resale listing. When it is the wallet's own, the selection alone. |
| Press a request, from 1200 px | the selection and the fill ticket on that best request: `bid=<id>`. When it is the wallet's own, the selection alone. |
| Press an offer or a request, below 1200 px | `kind`, `strike`, `expiry`; the series heading is scrolled into view (also for a link that names a series) |
| Any press with a write or request form open | the form follows the selection (`side` kept); a ticket on one exact order does not survive a new selection |
| Press the selected series again | removes `kind` and `strike`, unless the press opens another order of it (its other half) or a form is following the selection |
| Press an empty half ("Post a request") | selection plus the request form (`side=bid`) on that series; with the write form open, the form follows instead; on a contract without requests, the write form |
| Buy on a maker row | `side=buy&offer=<id>` |
| Buy on a resale row | `side=buy&ask=<id>` |
| Fill request | `bid=<id>` |
| Write an offer, Post a request | `side=write` or `side=bid` with the series and no quantity or premium: nothing the user did not type is put in a premium field |

## Keyboard and names

- The chain is one tab stop (`useRoving`). Arrow keys move between the four halves of a row (call request, call
  offer, put offer, put request) and stop at the edges; Home and End go to the first and last half of the row; Page
  Up and Page Down to the first and last strike; Ctrl+Home and Ctrl+End to the corners. Enter or Space presses the
  half. Before any movement the tab stop is the selected series' offer, else the call offer on the row at the
  reference price. Both halves of the selected series are `aria-pressed`.
- A half's accessible name is a sentence that starts with its figure and ends with what a press does:
  `Offer 0.36 at 10.00, put, 27 Nov, for 5.00 FUND, 2 offers, 2 makers. Buy.`,
  `Request 0.13 at 10.00, put, 27 Nov, for 5.00 FUND, 1 request. Fill request.`,
  `Your request 0.46 at 98.00, put, 27 Nov, for 2.00 BOND, 1 request.`, and for an empty half
  `No offer at 102.00, call, 13 Nov. Post a request.` (ruling F2). Moneyness at the reference and what the wallet
  has in the series follow the counts. The maker count lives only there.
- The button's visible text is its figure (or, on an empty half, the hint), a run of words of its name (axe
  `label-content-name-mismatch`). The size is drawn by the stylesheet from `data-size`; "yours" lies over the cell
  in a layer the pointer passes through and that is hidden from assistive technology.
- In-the-money cells take a tone mixed from ink (darker than Paper, lighter than Carbon); the same fact is in each
  cell's name and in the legend under the table.

## Decisions

- **The highlighter marks the wallet's own order and nothing else** (DESIGN.md, ruling E9). A held or written
  option is said in the half's name and in the series panel ("You hold 1.00 BOND of this put. View position"); at
  a tie the figure shown is the other maker's and is not marked.
- **Each half is its own target** (ruling F3): a figure printed under "Request" never opens the other side of the
  book. Below 1200 px a price still selects its series and brings the book into view (ruling E9); an empty half
  opens the request form at every width.
- **An empty half is blank at rest** (ruling F2, replacing E7's "Ask for a price"): a sparse deadline is not a wall
  of identical words. When a deadline has no order at all, the line under the chain says so instead of the select
  instruction.
- **Hover is a quiet wash, not the ink inversion of the Figma specimen.** The chain is dense and crossed by the
  pointer constantly.
- **"Other dates" is a link, not a sixth segment.** The orders on other dates are already in "Other offers".
- **Ascending strikes**, as in the Figma chain: in-the-money calls are top left, in-the-money puts bottom right.
- **No explorer links in mock mode**: the mock counterparties have no page.
- **Cancelling is confirmed in a dialog** with the amount that comes back, because the test wallet signs without
  asking and a real wallet's prompt does not say what returns.

## Tests

`model.test.ts` (selection from the URL, half names, hints and own-order marking, each half's action, the gap
line, keyboard moves, on the demo market at a fixed clock) and `e2e/chain.spec.ts` (grid, keyboard, each half's
ticket, empty halves, the no-orders line, book, cancel, own orders listed once, other offers, phone layout, axe in
both themes).
