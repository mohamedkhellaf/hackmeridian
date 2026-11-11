# features/markets/chain

Chain mode of the asset page (brief 4.3, ruling E9). `index.tsx` exports `ChainMode({ assetId })`; the markets
feature mounts it in the main column of `/markets/$asset` when the mode is `chain`. Everything it shows comes from
`useMarket`, `useBook` and `usePositions` of the data layer (the standard grid of `core/series` laid over the
contract's orders). Nothing here prices, ranks or filters an order.

## What is on screen

| Part | File | Notes |
|---|---|---|
| Deadlines | `ExpiryBar.tsx` | One radio group (`Segmented`) of the listed dates with the time left and the number of orders as a plain muted numeral (on a narrow column it follows the time left: `1 d, 12`). A date with no order has its date in muted ink and no numeral. "Other dates, N orders" links to "Other offers", shown only when an order sits on a date that is not listed. |
| The chain | `ChainTable.tsx` | Native table: calls, strike (row header, toned, serif, right-aligned in a centred box), puts. Each side of a strike shows both sides of its book: the best offer per unit with its size (`0.21 × 1.00`) next to the strike, and the best request further out. An empty side asks for a price. On a narrow column (`compact`, under 560 px) the same table keeps both halves and puts the request (or "yours") on a second line. The dashed reference rule is a row of its own with a plain label; when the reference equals a strike, that strike's row carries the label instead. |
| Selected series | `SeriesPanel.tsx` | Heading (`BOND 100.00 put, 13 Nov`), "Write an offer", "Post a request", the right in one sentence with moneyness at the reference, the deadline (date first, then the time left), what the wallet holds or wrote of the series with a link to the position, and the book as one table. |
| Orders | `OrdersTable.tsx`, `OrdersList.tsx`, `OrderAction.tsx`, `orders.ts` | One table with fixed columns: No., From (Maker, Seller or Buyer), Quantity, Premium per unit, Total premium, one action. Groups: offers, the gap line, requests. A list with every column kept on phones. Warnings (terms that cannot pay back, a reserve shortfall) carry the warning mark; the reason an order is off the grid is plain words. |
| Your orders | `YourOrders.tsx` | The connected wallet's open offers, listings and requests on the asset across every deadline, each with Cancel (or Manage for a listing) and its series as a control that selects it. |
| Off-grid orders | `OtherOffers.tsx` | Every non-standard order of the asset with the reason from `classifyOffer`, and what each reason means. Still tradable. |
| Cancel | `CancelDialog.tsx` | The wallet's own offer or request: what comes back, then the transaction stages (`useCancelOffer`, `useCancelBid`). |
| Logic | `model.ts`, `useRoving.ts`, `url.ts`, `copy.ts` | Pure selection, cell text, the takeable order of a cell, the gap line, keyboard moves; the roving tab stop; search params; every string. |

## URL contract

The selection is the URL: `expiry` (UTC day of a listed date), `kind`, `strike` (decimal, per unit). A link with an
unknown date falls back to the first date that has offers. Tickets are opened by writing the ticket's own params
through `searchFromTicketIntent` of `features/ticket`; the asset page turns them into the ticket in its rail.

| Action | Search written |
|---|---|
| Press a priced or request-only cell, from 1200 px | the selection and the ticket on the best order the wallet can take there: `side=buy&offer=<id>`, `side=buy&ask=<id>` or `bid=<id>`. When the wallet's own order is the best, the selection alone. |
| Press a priced or request-only cell, below 1200 px | `kind`, `strike`, `expiry`; the series heading is scrolled into view (also for a link that names a series) |
| Any press with a write or request form open | the form follows the selection (`side` kept); a ticket on one exact order does not survive a new selection |
| Press the selected cell again | removes `kind` and `strike` (unless a form is following the selection) |
| Press an empty cell ("Ask for a price") | selection plus the request form (`side=bid`) on that series; with the write form open, the form follows instead |
| Buy on a maker row | `side=buy&offer=<id>` |
| Buy on a resale row | `side=buy&ask=<id>` |
| Fill request | `bid=<id>` |
| Write an offer, Post a request | `side=write` or `side=bid` with the series and no quantity or premium: nothing the user did not type is put in a premium field |

## Keyboard and names

- The chain is one tab stop (`useRoving`). Arrow keys move between cells and stop at the edges; Home and End go
  to the call and the put of the row; Page Up and Page Down to the first and last strike; Ctrl+Home and Ctrl+End
  to the corners. Enter or Space presses the cell. Before any movement the tab stop is the selected cell, else
  the row at the reference price.
- A cell's accessible name is a full sentence: `Put at 10.00, best offer 0.36 for 5.00 FUND, 2 offers, 2 makers,
  best request 0.13, 1 request`, then `yours: the best request` when a figure is the wallet's own, moneyness at the
  reference and what the wallet has in the series. The maker count lives only there.
- The button's visible text is its one main figure (the best offer, else the best request, else "Ask for a
  price"), a word of its name (axe `label-content-name-mismatch`). The size, the request beside an offer and "yours"
  lie over the cell in a layer the pointer passes through and that is hidden from assistive technology.
- In-the-money cells take a tone mixed from ink (darker than Paper, lighter than Carbon); the same fact is in each
  cell's name and in the legend under the table.

## Decisions

- **The highlighter marks the wallet's own order and nothing else** (DESIGN.md, ruling E9). A held or written
  option is said in the cell's name and in the series panel ("You hold 1.00 BOND of this put. View position"); at
  a tie the figure shown is the other maker's and is not marked.
- **Hover is a quiet wash, not the ink inversion of the Figma specimen.** The chain is dense and crossed by the
  pointer constantly.
- **"Other dates" is a link, not a sixth segment.** The orders on other dates are already in "Other offers".
- **Ascending strikes**, as in the Figma chain: in-the-money calls are top left, in-the-money puts bottom right.
- **No explorer links in mock mode**: the mock counterparties have no page.
- **Cancelling is confirmed in a dialog** with the amount that comes back, because the test wallet signs without
  asking and a real wallet's prompt does not say what returns.

## Tests

`model.test.ts` (selection from the URL, cell names and own-order marking, the takeable order, the gap line,
keyboard moves, on the demo market at a fixed clock) and `e2e/chain.spec.ts` (grid, keyboard, book, tickets,
cancel, own orders, other offers, phone layout, axe in both themes).
