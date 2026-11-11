# `src/features/portfolio`

Brief 4.5: what the connected wallet holds, wrote and has on order, and what it has to do, by when.

## Route contract

The router (`src/app/router.tsx`) lazy-loads two named exports of `index.tsx`:

| Path | Export | Search (`src/app/search.ts`) |
|---|---|---|
| `/portfolio` | `PortfolioPage` | `PortfolioSearch`: `tab=holding\|written\|orders`, `closed=1` |
| `/portfolio/$id` | `PositionPage` | `PositionSearch`: `do=exercise\|claim\|reclaim\|sell\|cancel` |

- `$id` is the option id. A segment that is not a u64, or an id the contract does not know, gets the page's own
  "No option has this number." and never echoes the segment.
- `tab` and `closed` are written with `replace`, so the back button leaves the page. Without `tab` the page
  opens on the first tab that has something in it.
- `do` opens the matching action when the connected wallet may take it. Opening an action from the page is a
  history step (Back closes it); closing removes the param. A link whose action no longer applies gets a note
  that says so. A guest who follows such a link sees the terms and "Connect wallet"; connecting opens the action.
- Withdrawing a resale listing has no link form: it is opened by its button only.

## Files

| File | What it is |
|---|---|
| `PortfolioPage.tsx` | The page: guest, loading, error and empty states; to-do strip, totals, three tabs. |
| `TodoStrip.tsx` | One card per thing the wallet can do now (and a quiet card for a held option in its last 48 hours): what, by when, why, one action. |
| `Summary.tsx`, `totals.ts` | Original premiums, premium earned, locked, ready to take back (exact sums per token). |
| `PositionTables.tsx` | Holding, Written, Offers, Requests and Resale listings: a ruled table when the list is at least 52rem wide (a container query), a three-line list below. |
| `PositionPage.tsx` | One option: header with the deadline and the actions that apply, contract note, lifecycle, and the payoff figure while it is live. |
| `PositionNote.tsx`, `PositionPayoff.tsx`, `Lifecycle.tsx`, `CalendarMenu.tsx` | The four blocks of the position page. |
| `actions/ActionDialog.tsx` | The one dialog shape of every action: review, staged transaction, receipt. |
| `actions/ExerciseDialog.tsx` | Exercise: delivery sentence, feasibility from `usePreTrade`, consent when out of the money. |
| `actions/SimpleDialogs.tsx` | Claim delivery, reclaim, cancel offer, cancel listing. |
| `actions/CancelRequestDialog.tsx` | Withdraw a request (bid) and get the escrow back. |
| `actions/ActionFlow.tsx`, `actions/useActionFlow.ts` | Which action is open on which option, and where focus returns. |
| `model.ts`, `copy.ts`, `lifecycleSteps.ts`, `payoff.ts`, `calendar.ts`, `actions/checks.ts` | Pure modules, unit-tested: names and figures, every sentence, the lifecycle steps, the payoff figure, the calendar file, the re-checks before signing. |
| `links.tsx`, `listReturn.ts`, `route.ts` | Router links (the back link returns to the list in history), and the two route handles. |
| `hooks.ts` | Resale bought in this browser, an option made by filling a request, the clawback shortfall, offers sold since the last visit. |

## Decisions

- **One primary button per page.** The first actionable to-do card carries the ink button; every other action is
  outlined. On the position page the contract call (exercise, claim, reclaim, cancel) is the ink button; selling
  is a choice and stays outlined.
- **A to-do card is something the wallet can do now.** An exercise asks for action only when the reference says it
  is in the money; the urgent one (48 hours or less) carries the ink rule. A held option that is not in the money
  gets a quiet card with a link (no button) only in its last 48 hours or when there is no reference price. An
  option that lapsed in the last week is one plain line above the tabs. An expired request is a card: its premium
  stays in the contract until it is cancelled. Cards carry no eyebrow labels and no icons.
- **The State column is gone.** "Where it stands" says it, with the demo price and the strike in one line.
- **Every action is a dialog with the same three stages.** The review states what moves in a serif sentence and
  lists what was re-read from the chain; signing shows the transaction stepper with what each state means; the
  receipt is a contract note that prints, and focus moves to it. An unknown outcome offers "Check again", never
  a second send. A dialog can be closed while a transaction is in flight: Activity keeps the record.
- **The dialog works on a snapshot** of the option taken when it opened, so the receipt of an exercise is still
  shown after the row has changed state or left the list.
- **Focus on close** returns to the button that opened the dialog, or to the page heading when that button is
  gone (a confirmed action often removes its own card).
- **Listing goes through the order ticket** (`TicketHost`, mode `list`, placement `overlay`), loaded only when
  "List for sale" is opened, from a Holding row or the position page. Re-pricing is the same ticket; withdrawing a
  listing is a dialog here. A row whose exercise is out of the money leads with "List for sale".
- **A premium the wallet did not pay is never called paid.** The total is "Original premiums"; for an option this
  browser bought from a holder the position shows no breakeven and draws the leg without the premium.
- **A clawback shortfall is said where money waits:** the sentence once on the page, a line on affected rows and
  cards, and a failing (not blocking) "Contract balance" line plus the sentence in the claim, reclaim and cancel
  reviews.
- **The payoff figure is for a live option only.** A holder sees the leg, the readout leading with what exercising
  pays and then the net after the original premium. A maker sees what it holds with the agreement and without it
  (`guidedOutcome`, earn-hold or earn-buy), as the guided page showed when it wrote the option. An ended option has
  no figure: the lifecycle takes its column.
- **Narrow lists get lists, not squeezed tables.** Each row is a link of at least 44 px with a chevron that opens the
  position page, and carries every figure of the table row (premium and date included). A request has no page of
  its own, so its row keeps the cancel button. On a phone a live position keeps its actions in a bar above the tab
  bar.
- **Calendar, not reminders.** The holder of a live option (and its maker, for the claim or the reclaim after the
  deadline) can download an `.ics` built in the page or open a Google Calendar link.

## Tests

- `npx vitest run src/features/portfolio`: copy (including the banned-word scan over every sentence), model,
  lifecycle, payoff (checked against `packages/payoff`), pre-sign checks, calendar file.
- `PW_PORT=5199 npx playwright test e2e/portfolio.spec.ts`: the flows on the mock chain, at 1440 and 390 px,
  with axe in both themes.
