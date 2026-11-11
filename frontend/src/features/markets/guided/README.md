# `features/markets/guided`: guided mode of the asset page

`index.tsx` exports `GuidedMode(props: { assetId: string })`. The markets feature mounts it on the Trade tab of
`/markets/$asset` when the mode is `guided`; `assetId` is the underlying token contract id. Brief 4.3, D9 to D12
and D17. The page reads top to bottom as one decision:

1. **What do you want to do?** (`IntentPicker`): the four intents as one radio group. The three main ones are
   cards, "Lock a buy price" is a quieter row.
2. **Your terms** (`Terms`, inside a `ContractNote`): quantity (with the wallet balance and Max), price per unit
   and deadline as three figures, then two rows of chips from the standard grid (the kit's `ChoiceChips`). A chip with a tick
   and a solid outline has something funded behind it; a dashed one has not.
3. **What is available** (`Available`): the best funded order for exactly these terms and this quantity, or the
   nearest funded terms as one-tap suggestions and the way to post terms of one's own.
4. **What you would hold at the deadline** (`Outcome`): the with-and-without figure with the price handle,
   three prices as cards, then breakeven, the most that can be lost and what is kept or given up.
5. **What happens and when**: who acts and by when, and that nothing settles by itself.
6. **The action**: opens the order ticket (`features/ticket`) through `searchFromTicketIntent`.

## State is the URL

| Param | Meaning | When it is missing |
|---|---|---|
| `intent` | `floor`, `earn-hold`, `earn-buy`, `lock-buy` | `floor` |
| `strike` | price per unit, decimal; counts only when it is on the standard ladder | default series |
| `expiry` | UTC day `YYYY-MM-DD`; counts only when it is a listed date | default series |
| `qty` | underlying units, decimal, as typed | the lot of the best order of the series, else `1.00` |
| `premium` | total premium of the user's own request or offer (no funded match) | empty |

- A chip, an intent or a suggestion adds a history entry (Back undoes it). Typing replaces the entry.
- Any change of terms writes all of them, so a link is complete, and removes the ticket keys
  (`side`, `offer`, `bid`, `ask`, `step`): the ticket closes rather than show an order that no longer matches.
- Choosing another intent drops `strike`, `expiry`, `qty`, `premium` and `kind`: a floor and a sale price are
  not the same number. The new intent starts from its own default.
- **Default series** (`terms.ts` `defaultSeries`): the soonest deadline at least 48 hours away that has something
  funded on the natural side of the reference price (at or below it for a floor or a buy price, at or above it
  for a sale price or a locked buy price), at the strike nearest the reference. With nothing funded: that
  nearest strike and that deadline, and the flow shows the fallback.
- The asset page clears `qty` and `premium` when the ticket closes. `useDraftParam` keeps the last text of each
  field and writes it back, so the quantity the user set survives opening and closing the ticket.

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

- Ladder, listed dates, reference price, cells: `useMarket`. Funded series and the match: `useGuidedMatch`
  (called once with no terms for the chip marks and the defaults, once with the terms).
- Payoff figures: `guidedOutcome` and `guidedTermsOf` (`core/payoff/strategies`), display numbers under the
  caption `PAYOFF_CAPTION`. Moneyness words: `distancePct` (`core/reference`).
- Exact amounts stay `bigint`. `terms.ts` holds the little arithmetic the flow needs beside core: strike times
  quantity as an exact total (the rule of `core/maker/buildOffer`), the Max quantity a balance allows, a
  per-unit price scaled to a quantity on the 0.01 tick, and the three round prices of the outcome cards.

## Copy

All of it is in `copy.ts`, whole sentences per intent. `copy.test.ts` calls every template and checks the
banned words of `core/disclosures`, the punctuation rules, that no required sentence is retyped, and that put,
call, strike and premium are introduced once, in the lead sentence of the note. The intent picker and the
labels never use them.

## Files

`GuidedMode.tsx` (states and composition), `IntentPicker`, `Terms`, `Available`, `Outcome`,
`useGuidedSearch.ts` (URL read and patch, `useDraftParam`), `terms.ts`, `copy.ts`, one CSS module per component.
Tests: `terms.test.ts`, `copy.test.ts`, `e2e/guided.spec.ts`.
