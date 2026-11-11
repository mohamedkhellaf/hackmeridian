# `src/features/learn`: How it works (`/learn`)

The page that explains the product: what an option is here, the life of one, the four things a user can do with
exact figures, requests and resale, what can go wrong, a glossary and questions. The router lazy-loads the named
export `LearnPage` from `index.tsx` (title "How it works"); the page takes no params and no search.

It is a document. It reads no chain data and no wallet, so it has no loading, empty, error or guest state of its
own; the route's pending and error screens belong to the router.

## Files

| File | What it holds |
|---|---|
| `content.ts` | Every sentence of the page, as constants and full-sentence templates. Facts come from `PRODUCT_SPEC.md`, `README.md`, `AGENTS.md` and `src/core` only. `STATIC_COPY` lists them for the wording tests. |
| `examples.ts` | The worked examples: one fictional lot of 5.00 BOND seen through the four intents. Exact terms are `bigint` units; breakeven, extremes, scenarios and curves come from `core/payoff/strategies`. `exampleDeadline` picks a standard expiry at least 48 hours away, so the page never prints a deadline that has passed. |
| `LearnPage.tsx` | The layout: page header, section navigation, seven sections. |
| `SectionNav.tsx` | The in-page navigation: a list that stays in view from 1200 px, and below that a select that stays at the top of the viewport. Both show the section being read (`useActiveSection`). |
| `Lifecycle.tsx` | One put from offer to end with the kit's `Timeline`: who acts, by when, and the contract state after each step; then the two ways it can end, side by side. |
| `IntentExample.tsx` | One intent: statement, the deal in exact figures, the terms as a `ContractNote`, the payoff figure (captioned with the required sentence), what it costs, and three outcomes. |
| `ProseTable.tsx` | A ruled table whose cells are sentences (the kit's table keeps a cell on one line). |
| `Risks.tsx`, `Glossary.tsx`, `Questions.tsx` | Sections 5 to 7. Questions are native `details`. |

## Decisions

- **Sections are numbered** (in the list, the select and the headings) because they are cross-referenced like the
  clauses of a term sheet. The ids are URL fragments: `/learn#glossary` opens on that section.
- **In-page navigation moves focus** to the heading of the section (a focusable `h2`, ring for keyboard users only)
  and records the section in the URL with `replace`, so Back still leaves the page.
- **One accommodation for the kit's select**, in `SectionNav`. Focus after a choice goes to the heading through
  the kit's `finalFocus`. But an instance that has made a choice opens, the next time, with the keyboard highlight
  on the item chosen then, although the page has changed its value since (Base UI 1.9.0): the select gets a new
  `key` once a choice is done with.
- **The examples share one lot** (5.00 BOND, BOND at 10.00 USDx at the start) so the four payoffs can be compared.
  The intents that start from the asset use the with-and-without figure; the two that start from USDx use the
  payoff figure, so a reader meets both figures the app uses.
- **No required sentence is retyped.** The payoff caption is imported from `core/disclosures` for the four
  figures. Limits are restated in the page's own words (brief D16), and the Margin block uses only the wording
  `AGENTS.md` allows. `content.test.ts` checks the copy against the banned words, price terms and taglines.
- **A figure never parts from its unit, and a deadline stays on one line**: no-break spaces in `examples.ts`.

## Tests

`examples.test.ts` (figures), `content.test.ts` (structure and wording), `e2e/learn.spec.ts` (headings in order,
navigation and focus, captions, exact figures, banned wording, axe in both themes, phone layout).
