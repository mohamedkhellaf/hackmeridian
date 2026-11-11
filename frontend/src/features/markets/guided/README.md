# `features/markets/guided`: guided mode of the asset page

`index.tsx` exports `GuidedMode(props: { assetId: string })` and `GuidedClosing(props: { assetId: string })`.
The markets feature mounts `GuidedMode` on the Trade tab of `/markets/$asset` when the mode is `guided`, and
from 1200 px passes `GuidedClosing` to the order rail as its idle content (ruling E10). `assetId` is the
underlying token contract id. Brief 4.3, D9 to D12 and D17, rulings E10 to E14. The page reads top to bottom as
one decision (E11):

1. **What do you want to do?** (`IntentPicker`): the four intents as one radio group, a row of four names. The
   sentences that explain them are read on Markets and stay in each option's accessible name.
2. **Your terms** (`Terms`, inside a plain `ContractNote`): quantity (with the wallet balance, Max and the lots on
   offer), price per unit and deadline as three figures, then two rows of chips from the standard grid (the kit's
   `ChoiceChips`). A tick marks a chip with something funded behind it; a three-word key explains it when one is
   shown. A link that named a price or a date off the list is replaced, and said once above the chips.
3. **What is available** (`Available`): first what the wallet already has at these terms (its position, offer or
   request, with a link); then the best funded order for exactly these terms and this quantity, its number on the
   heading line; or, for a buyer, what smaller lots of the same terms would cover and the nearest funded terms as
   one-tap suggestions, and the way to post a request; for a seller, posting an offer first.
4. **What you would hold at the deadline** (`OutcomeCardsBlock`): a lower and a higher price as two cards.
5. **The closing block** (`ClosingBlock`, in `Closing.tsx`): the deal in one sentence, the action, the way to post
   at one's own price. In the rail from 1200 px; here below that, with a sticky action bar (`ActionBar`) while it
   is out of view. Never while a ticket is open.
6. **At any price at the deadline** (`OutcomeDetail`): the with-and-without figure with the price handle and,
   beside it, Breakeven and Most you can lose from `core/payoff/leg` (the ticket's definitions). A written
   covered call has no loss figure: it says what is given up (E14).
7. **What happens and when**: four steps; for terms of one's own, what happens if someone takes them and if
   nobody does.

No payoff figure is drawn without a premium: the order's, the user's own, or (no match) the lowest open offer's
price per unit, labelled as assumed (E13).

## One model, two places

`useGuidedModel(assetId)` reads the URL and the data hooks and returns everything both places need: the
series, the quantity and premium drafts, the match, the wallet's own items, the action and its sentence. The
form and the closing block in the rail call it separately and always agree. `railClosing.ts` lets the rail say
that it shows the closing block, so the page does not show it twice.

## State is the URL

| Param | Meaning | When it is missing |
|---|---|---|
| `intent` | `floor`, `earn-hold`, `earn-buy`, `lock-buy` | read from `kind` (and `side=write`), else `floor` |
| `kind` | the option kind; written with every change of terms, so Chain opens on the same cell | the intent's |
| `strike` | price per unit, decimal; counts only when it is on the standard ladder and of the intent's kind | default series |
| `expiry` | UTC day `YYYY-MM-DD`; counts only when it is a listed date | default series |
| `qty` | underlying units, decimal, as typed | the lot of the order the user can take at the series (a seller with no buyer: the lowest offer's lot), else `1.00` |
| `premium` | total premium of the user's own request or offer (no funded match) | empty |

- A chip, an intent or a suggestion adds a history entry (Back undoes it). Typing replaces the entry.
- Any change of terms closes an open ticket and clears a premium typed for the old terms. A quantity the user
  never set is not written, so it follows the lot of the series chosen.
- Choosing another intent drops `strike`, `expiry`, `qty`, `premium` and `kind`.
- **Default series** (`terms.ts` `defaultSeries`): the soonest deadline at least 48 hours away that has something
  funded on the natural side of the reference price, at the strike nearest the reference.
- **Drafts** (`useGuidedSearch.ts` `useDraftParam`): what the user typed is kept, with the URL values its writes
  may still meet on the way, so `5.` and an emptied field stay on screen while the navigation lands. Nothing is
  written back to the URL. The pure parts are tested in `useGuidedSearch.test.ts`.

## The ticket

| State | Ticket intent | Step |
|---|---|---|
| a funded offer matches (floor, lock-buy) | `{ mode: 'buy', offerId }` | `review` |
| a resale listing matches | `{ mode: 'buy-resale', optionId }` | `review` |
| a funded request matches (earn-hold, earn-buy) | `{ mode: 'fill', bidId }` | `review` |
| no match, buyer | `{ mode: 'bid', … }` with the chosen terms | `review` with a premium, else `terms` |
| no match, seller | `{ mode: 'write', … }` with the chosen terms | `review` with a premium, else `terms` |
| "at your own price" beside a match | `bid` or `write` without a premium | `terms` |

A guest sees everything and gets "Connect wallet" as the action.

## Where the numbers come from

- Ladder, listed dates, reference price, cells: `useMarket`. Funded series and the match: `useGuidedMatch`.
  The wallet's own items: `usePositions`.
- Payoff figures: `guidedOutcome` and `guidedTermsOf` (`core/payoff/strategies`), display numbers under the
  caption `PAYOFF_CAPTION`. Breakeven and Most you can lose: `core/payoff/leg`, exact.
- `terms.ts` holds the little arithmetic beside core: strike times quantity as an exact total, the Max quantity,
  a per-unit price scaled to a quantity on the 0.01 tick, the lots of a series and what smaller lots cover, and
  the two round prices of the outcome cards.

## Copy

All of it is in `copy.ts`, whole sentences per intent. A figure of the deal is stated in the note's rows and in
the closing sentence, and nowhere else. `copy.test.ts` calls every template and checks the banned words of
`core/disclosures`, the punctuation rules, that no required sentence is retyped, and the sentences the rulings
removed stay removed.

## Files

`GuidedMode.tsx` (states and composition), `IntentPicker`, `Terms`, `Available`, `Outcome`, `Closing`,
`useGuidedModel.ts`, `useOutcome.ts`, `useGuidedSearch.ts`, `railClosing.ts`, `terms.ts`, `copy.ts`, one CSS
module per component. Tests: `terms.test.ts`, `copy.test.ts`, `useGuidedSearch.test.ts`, `e2e/guided.spec.ts`.
