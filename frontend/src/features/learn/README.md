# `src/features/learn`: Learn (`/learn`)

The page that explains the product: what an option is here, the life of one, the four things a user can do with
exact figures, requests and resale, what can go wrong, a glossary and questions. The router lazy-loads the named
export `LearnPage` from `index.tsx` (title "Learn", the one name of the page: route, h1, navigation and footer); the
page takes no params and no search.

It is a document. It reads no chain data and no wallet, so it has no loading, empty, error or guest state of its
own; the route's pending and error screens belong to the router.

## Files

| File | What it holds |
|---|---|
| `content.ts` | Every sentence of the page, as constants and full-sentence templates. Facts come from `PRODUCT_SPEC.md`, `README.md`, `AGENTS.md` and `src/core` only. `STATIC_COPY` lists them for the wording tests. |
| `examples.ts` | The worked examples: one lot of 5.00 BOND seen through the four intents. Exact terms are `bigint` units; breakeven, extremes, scenarios and curves come from `core/payoff/strategies`. `exampleDeadline` picks a standard expiry at least 48 hours away, so the page never prints a deadline that has passed. |
| `LearnPage.tsx` | The layout: page header, section navigation, seven sections. |
| `SectionNav.tsx` | The in-page navigation: a list that stays in view from 1200 px, and below that a select that stays at the top of the viewport. Both show the section being read (`useActiveSection`). |
| `Lifecycle.tsx` | One put from offer to end with the kit's `Timeline`: by when, a title that says who acts, and the contract state after each step; then the two ways it can end, side by side. |
| `IntentExample.tsx` | One intent in a `Disclosure`: closed, its name and statement; open, the deal in exact figures, the terms on a plain `ContractNote`, the with-and-without figure (captioned with the required sentence), what it costs, three outcomes under "What you would hold at the deadline", and the way into Markets. |
| `Disclosure.tsx` | A native `details` with the page's summary row (chevron, hover, focus ring clear of the words). Used by the examples and the questions. |
| `ProseTable.tsx` | A ruled table whose cells are sentences. In a narrow column each row stacks, its cells led by their column's name. |
| `Risks.tsx`, `Glossary.tsx`, `Questions.tsx` | Sections 5 to 7. Each glossary term has an id (`/learn#term-breakeven`). |

## Decisions

- **Sections are numbered** (in the list, the select and the headings) because they are cross-referenced like the
  clauses of a term sheet. The ids are URL fragments: `/learn#glossary` opens on that section.
- **In-page navigation moves focus** to the heading of the section (a focusable `h2`, ring for keyboard users only)
  and records the section in the URL with `replace`, so Back still leaves the page.
- **One accommodation for the kit's select**, in `SectionNav`. Focus after a choice goes to the heading through
  the kit's `finalFocus`. But an instance that has made a choice opens, the next time, with the keyboard highlight
  on the item chosen then, although the page has changed its value since (Base UI 1.9.0): the select gets a new
  `key` once a choice is done with.
- **One example open at a time.** The four examples share one lot (5.00 BOND, BOND at 10.00 USDx at the start) so
  they can be compared, and each is a disclosure: closed, the section reads as four names with their statements;
  the first is open when the page loads. Find-in-page still reaches the closed ones.
- **The figure the guided page draws.** Every example uses the with-and-without figure with the guided page's line
  labels ("With the floor", "Just holding", "Keeping the cash"), so what a reader learns here is what Markets shows.
  An outcome's difference keeps its sign and neutral words ("−1.80 USDx compared with no floor").
- **A written call has no loss figure**: its note prints what is given up and that the maker cannot owe more than
  the asset locked (ruling E14; the exact wording is Dev 1's).
- **The lifecycle is nobody's position**: no step is marked done, current or ahead. The first step of each ending
  names it ("The holder exercises", "The deadline passes").
- **No required sentence is retyped.** The payoff caption is imported from `core/disclosures` for the four
  figures. Limits are restated in the page's own words (brief D16), and the Margin block uses only the wording
  `AGENTS.md` allows. `content.test.ts` checks the copy against the banned words, price terms, taglines and hedge
  words ("experimental", "fictional").
- **A figure never parts from its unit, and a deadline stays on one line**: no-break spaces in the sentences of
  `examples.ts`; on the note every figure with a unit is an `Amount` (`qtyFigure`, `premiumFigure`,
  `collateralFigure` keep figure and unit apart for it), which owns the unit's style.
- **Each fact has one home on the page.** "What this is" is two sentences; the rules table under it carries the
  style, the settlement and the premium. That a settlement is all or nothing is said once, in the Settlement row.

## Tests

`examples.test.ts` (figures), `content.test.ts` (structure and wording), `e2e/learn.spec.ts` (headings in order,
disclosures, navigation and focus, captions, exact figures, banned wording, axe in both themes, phone layout and
stacked tables).
