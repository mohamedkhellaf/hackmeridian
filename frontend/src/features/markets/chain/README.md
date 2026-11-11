# features/markets/chain

Chain mode of the asset page (brief 4.3). `index.tsx` exports `ChainMode({ assetId })`; the markets feature mounts
it in the main column of `/markets/$asset` when the mode is `chain`. Everything it shows comes from `useMarket`
and `useBook` of the data layer (the standard grid of `core/series` laid over the contract's orders). Nothing here
prices, ranks or filters an order.

## What is on screen

| Part | File | Notes |
|---|---|---|
| Expiry dates | `ExpiryBar.tsx` | One radio group (`Segmented`) of the listed dates with the time left. "Other dates, N orders" is a link to the "Other offers" section, shown only when an order sits on a date that is not listed. |
| The chain, wide | `ChainTable.tsx` | Native table: calls, strike (row header, sunken, serif), puts. One button per cell. The dashed reference rule is a row of its own with the tag on the strike column. |
| The chain, narrow | `ChainList.tsx` | Under 560 px of column width (`useNarrow`): one half at a time, chosen with a `Segmented` (Calls, Puts). Still a table: premium, strike in the centre, makers. A tap anywhere on a row presses its button. |
| Selected series | `SeriesPanel.tsx` | Heading (`BOND 100 put, 13 Nov`), the right in one sentence with moneyness at the reference, the deadline, "Write an offer here", "Post a bid here", and the two sides of the book. The sides sit side by side only when each keeps 520 px. |
| Orders | `OrdersTable.tsx`, `OrdersList.tsx`, `OrderAction.tsx`, `orders.ts` | A table on wide columns, a list with every column kept on phones. Source (Maker, Resale, Bid), quantity, premium per unit, total, notes, one action. |
| Off-grid orders | `OtherOffers.tsx` | Every non-standard order of the asset with the reason from `classifyOffer`, a count per reason and what each reason means. Still tradable. |
| Cancel | `CancelDialog.tsx` | The wallet's own offer or request: what comes back, then the transaction stages (`useCancelOffer`, `useCancelBid`). |
| Logic | `model.ts`, `useRoving.ts`, `url.ts`, `copy.ts` | Pure selection, cell text, keyboard moves; the roving tab stop; search params; every string. |

## URL contract

The selection is the URL: `expiry` (UTC day of a listed date), `kind`, `strike` (decimal, per unit). A link with an
unknown date falls back to the first date that has offers. Tickets are opened by writing the ticket's own params
through `searchFromTicketIntent` of `features/ticket`; the asset page turns them into the ticket in its rail.

| Action | Search written |
|---|---|
| Press a priced or bid-only cell | `kind`, `strike`, `expiry`; any ticket on one exact order is closed; a write or bid form stays open and follows |
| Press the selected cell again | removes `kind` and `strike` (unless a form is following the selection) |
| Press an empty cell | selection plus the bid ticket (`side=bid`) on that series; with the write form open, the form follows instead |
| Buy on a maker row | `side=buy&offer=<id>` |
| Buy on a resale row | `side=buy&ask=<id>` |
| Sell to this bid | `bid=<id>` |
| Write an offer here, Post a bid here | `side=write` or `side=bid` with the series, and the quantity and premium of the best order of the other side |

## Keyboard and names

- The chain is one tab stop (`useRoving`). Arrow keys move between cells and stop at the edges; Home and End go
  to the call and the put of the row; Page Up and Page Down to the first and last strike; Ctrl+Home and Ctrl+End
  to the corners. Enter or Space presses the cell. Before any movement the tab stop is the selected cell, else
  the row at the reference price.
- A cell's accessible name is a full sentence: `Put at 10.00, best premium 0.36, 2 makers`, then `, yours`,
  `, in the money at the demo price` and what the wallet has there. The visible words appear in the name in the
  order they are written in the markup (axe `label-content-name-mismatch`), which is why the call side is
  mirrored in CSS and not in the markup.
- In-the-money cells take the sunken tone; the same fact is in each cell's name and in the legend under the table.

## Decisions

- **Hover is a quiet wash, not the ink inversion of the Figma specimen.** The specimen's hover cell hides its own
  figure, and the ui kit's tables already use a wash. The chain is dense and crossed by the pointer constantly.
- **"Other dates" is a link, not a sixth segment.** The `expiry` param only carries listed days of the grid, and
  the orders on other dates are already in "Other offers" with their reason; one list, no second view of it.
- **Three kinds of cell.** Priced (best premium, makers); bid-only (`Bid 0.28`, `1 bid`: selects the series, the
  bid is in its book); empty (`No offer`, `Request`: opens the bid ticket prefilled).
- **Ascending strikes**, as in the Figma chain: in-the-money calls are top left, in-the-money puts bottom right.
- **No explorer links in mock mode**: the mock counterparties have no page.
- **Cancelling is confirmed in a dialog** with the amount that comes back, because the test wallet signs without
  asking and a real wallet's prompt does not say what returns.

## Tests

`model.test.ts` (selection from the URL, cell names, keyboard moves, on the demo market at a fixed clock) and
`e2e/chain.spec.ts` (grid, keyboard, book, tickets, cancel, other offers, phone layout, axe in both themes).
