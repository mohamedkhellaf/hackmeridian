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
| `PortfolioPage.tsx` | The page: guest, loading, error and empty states; to-do strip, summary, three tabs. |
| `TodoStrip.tsx` | One card per to-do item of `useTodo()`: what, by when, why, one action. |
| `Summary.tsx` | Premium paid, premium earned, collateral locked, positions open (exact sums per token). |
| `PositionTables.tsx` | Holding, Written, Offers, Requests and Resale listings: a ruled table from 768 px, a two-line list below. |
| `PositionPage.tsx` | One option: header with the actions that apply, contract note, payoff figure, lifecycle. |
| `PositionNote.tsx`, `PositionPayoff.tsx`, `Lifecycle.tsx`, `CalendarMenu.tsx` | The four blocks of the position page. |
| `actions/ActionDialog.tsx` | The one dialog shape of every action: review, staged transaction, receipt. |
| `actions/ExerciseDialog.tsx` | Exercise: delivery sentence, feasibility from `usePreTrade`, consent when out of the money. |
| `actions/SimpleDialogs.tsx` | Claim delivery, reclaim, cancel offer, cancel listing. |
| `actions/CancelRequestDialog.tsx` | Withdraw a request (bid) and get the escrow back. |
| `actions/ActionFlow.tsx`, `actions/useActionFlow.ts` | Which action is open on which option, and where focus returns. |
| `model.ts`, `copy.ts`, `lifecycleSteps.ts`, `payoff.ts`, `calendar.ts`, `actions/checks.ts` | Pure modules, unit-tested: names and figures, every sentence, the lifecycle steps, the payoff figure, the calendar file, the re-checks before signing. |
| `links.tsx`, `route.ts` | Router links and the two route handles. |

## Decisions

- **One primary button per page.** The first actionable to-do card carries the ink button; every other action is
  outlined. On the position page the contract call (exercise, claim, reclaim, cancel) is the ink button; selling
  is a choice and stays outlined.
- **An exercise is urgent only when the reference says it is in the money** and the deadline is within 48 hours
  (`TodoView.tone` from the data layer). Out of the money it is a "Reminder" (or "Expires soon") with a link to
  the position, never a button. The reference price is always named with its source.
- **Every action is a dialog with the same three stages.** The review states what moves in a serif sentence and
  lists what was re-read from the chain; signing shows the transaction stepper with what each state means; the
  receipt is a contract note that prints, and focus moves to it. An unknown outcome offers "Check again", never
  a second send. A dialog can be closed while a transaction is in flight: Activity keeps the record.
- **The dialog works on a snapshot** of the option taken when it opened, so the receipt of an exercise is still
  shown after the row has changed state or left the list.
- **Focus on close** returns to the button that opened the dialog, or to the page heading when that button is
  gone (a confirmed action often removes its own card).
- **Selling goes through the order ticket** (`TicketHost`, mode `list`, placement `overlay`), loaded only when
  "Sell" is opened. Re-pricing is the same ticket; withdrawing a listing is a dialog here.
- **Writers see the option leg alone** in the payoff figure, premium included, with a sentence that says what the
  locked collateral means. A written call prints no "max loss": the writer delivers what is locked and gives up
  the rise beyond the strike, and the note says so.
- **Phones get lists, not squeezed tables.** Each row is a link of at least 44 px that opens the position page,
  where all terms and actions are. A request has no page of its own, so its row keeps the cancel button.
- **Calendar, not reminders.** The holder of a live option can download an `.ics` built in the page or open a
  Google Calendar link. The copy says the entry is static and the deadline stays with the holder.

## Tests

- `npx vitest run src/features/portfolio`: copy (including the banned-word scan over every sentence), model,
  lifecycle, payoff (checked against `packages/payoff`), pre-sign checks, calendar file.
- `PW_PORT=5199 npx playwright test e2e/portfolio.spec.ts`: the flows on the mock chain, at 1440 and 390 px,
  with axe in both themes.
