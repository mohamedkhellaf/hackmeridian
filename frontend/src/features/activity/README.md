# features/activity

The Activity page (`/activity`, brief 4.10). The router lazy-loads the named export `ActivityPage` from
`index.tsx`. No params, no search. It is also reachable from the wallet menu.

The page lists what `useActivity()` holds for the connected wallet: every transaction started from this browser.
The list lives in this browser only (localStorage, per address; in memory on mock data), and the page
description says so once.

## Order

Transactions whose outcome is not final come first, under "Waiting for an outcome" (an unknown outcome before
one in flight: it is the one that asks for a look). The finished ones follow under a ruled heading per UTC day,
newest first, so a row gives only its time (`groupRows`).

## A row

| Part | Source |
|---|---|
| What | `entry.label` ("Buy put on 5.00 BOND"), then `entry.detail` (the terms) on the same line; a date inside the terms never breaks. A Margin row also says "Margin contract". |
| State | `TX_PHASE_LABEL[phase]` with a glyph. Never colour alone. A confirmation adds its ledger inline. |
| What it means | `noteOf(entry)`, only for rows that are open, failed, expired or declined (a confirmed row is one line). An unknown outcome is said in the ticket's words, with the time it can still go through until (while that is ahead), and, after a "Check again" that found nothing, "Checked at HH:MM:SS UTC: not included yet." |
| When | The UTC time of day in a `<time>`; on the desktop, the viewer's own time after it when their zone is not UTC (the zone is named once, in the column header). |
| Hash | `TxLink`: an explorer link and a copy button on a live build; plain text on mock data, where a hash has no page. |
| Link | `targetOf(entry)`, under "Where it shows": `option:N` to `/portfolio/N`, `bid:N` to `/requests?mine=1`, a new offer to `/portfolio?tab=orders`, a filled request to `/portfolio?tab=written`, a Margin call to `/margin` (only in a build that has it) |
| Action | "Check again" for an unknown outcome with a hash (`useActivity().check`). An unknown transaction is never offered for resending. |

Above the list: a count line ("6 transactions. 1 in progress. 1 with an unknown outcome.") and "Clear finished".
Clearing takes the finished rows off the list at once and leaves "3 finished transactions removed. Undo" in
the toolbar, with focus on that line; the entries leave the store when the page is left, the wallet changes or
the tab goes away, and Undo before that puts them back. A list emptied by a clear says "No transactions listed."

From 1200 px the list is a table (`ActivityTable`, one row group per heading; its six columns do not fit a
narrower page without hiding the hash and the link); below that it is a section per heading with one block per
transaction: label and state word, terms, the note when there is one, then the time
and hash on the left and the link on the right (`ActivityList`).

## States

- **Guest:** an `EmptyNote` with "Connect wallet" (secondary: the shell's button is the primary one). After
  connecting, focus goes to the page title.
- **Connected, nothing yet:** "No transactions yet." with a link to Markets.
- **Live build:** one line with the explorer link for the account's full record.

## Files

- `model.ts` (pure, tested): `activityRow`, `targetOf`, `noteOf`, `groupRows`, `settledCount`, the time helpers.
- `copy.ts` (tested): every sentence of the page. The state words are the data layer's; the unknown-outcome
  sentence is the ticket's.
- `StateWord`, `HashCell`, `TargetLink`, `RowParts` (`What`, `State`, `Time`): the cells shared by the table and
  the list.
- Tests: `model.test.ts`, `copy.test.ts` and `e2e/activity.spec.ts`.
