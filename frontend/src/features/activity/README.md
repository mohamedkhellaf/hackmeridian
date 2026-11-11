# features/activity

The Activity page (`/activity`, brief 4.10). The router lazy-loads the named export `ActivityPage` from
`index.tsx`. No params, no search. It is also reachable from the wallet menu.

The page lists what `useActivity()` holds for the connected wallet: every transaction started from this browser,
newest first. The list lives in this browser only (localStorage, per address; in memory on mock data), and the
page says so in a line of its own before the list.

## A row

| Part | Source |
|---|---|
| What | `entry.label` ("Buy put on 5.00 BOND"), then `entry.detail` (the terms line) when the caller gave one |
| State | `TX_PHASE_LABEL[phase]` with a glyph: Checking, Waiting for signature, Submitting, Pending, Confirmed, Failed, Outcome unknown, Expired, Declined. Never colour alone. |
| What it means | `noteOf(entry)`: "Bought, in ledger 58,331,204." for a confirmation; the error plus what happened to the fee for a failure (`describeTx`); the interruption text for an entry cut short by a reload |
| When | `DateTime` in UTC, the viewer's time under it |
| Hash | `TxLink` with copy; a link to the explorer except on mock data, where a hash has no page |
| Link | `targetOf(entry)`: `option:N` to `/portfolio/N`, `bid:N` to `/requests?mine=1`, a new offer to `/portfolio?tab=orders`, a filled request to `/portfolio?tab=written`, a Margin call to `/margin` (only in a build that has it) |
| Action | "Check again" for an unknown outcome with a hash (`useActivity().check`). An unknown transaction is never offered for resending. |

Above the list: a count line ("6 transactions. 1 in progress. 1 with an unknown outcome.") and "Clear finished",
which removes the entries whose outcome is final and keeps the open ones. A warning callout appears while any
outcome is unknown.

From 768 px the list is a table (`ActivityTable`); on a phone it is a list of blocks with the same fields
(`ActivityList`). The contract line ("Covered contract", "Margin contract") shows only when the list holds a
Margin entry.

## States

- **Guest:** an `EmptyNote` with "Connect wallet" (secondary: the shell's button is the primary one).
- **Connected, nothing yet:** an `EmptyNote` with a link to Markets.
- **Mock data:** one more line saying the list empties on reload and hashes have no explorer page.

## Files

- `model.ts` (pure, tested): `activityRow`, `targetOf`, `noteOf`, `settledCount`.
- `copy.ts`: every sentence of the page. The state words are the data layer's.
- `StateWord`, `HashCell`, `TargetLink`: the three cells shared by the table and the list.
- Tests: `model.test.ts` and `e2e/activity.spec.ts`.
