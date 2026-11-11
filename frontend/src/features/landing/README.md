# features/landing

The public page at `/` (`LandingPage`, loaded lazily by the router and rendered without the app shell). It has
its own layout: a thin network line (chain builds only), a sticky navigation bar, the hero, six sections, a
closing line (one sentence and the button, no heading) and the legal footer.

## Files

| Path | What it is |
|---|---|
| `index.tsx` | The route contract: `export { LandingPage }`. |
| `LandingPage.tsx` + `.module.css` | Layout, the network line, navigation, hero text, closing band, footer. The CSS also defines the landing type scale (`--landing-*`). |
| `copy.ts` (+ test) | Every string. Sentences are whole; the ones with a figure are functions of the formatted figure. |
| `recorded.ts` | The recorded options the page is told with, their transactions and the counted test figures. |
| `hero/HeroWidget.tsx` | The floor widget: a `ContractNote` with three terms, the with-and-without chart, two outcome figures, the source line. |
| `hero/Term.tsx` | A term of the note, fixed (`TermValue`) or selectable (`TermSelect`). |
| `hero/floor.ts` (+ test) | Chart model and outcome text of a put, from `core/payoff/strategies`. |
| `hero/selection.ts` (+ test) | Which open put is shown first, and which floors and deadlines the inputs offer. |
| `live/LiveBook.tsx` | The only code that reads the book. A headless component in its own chunk, imported after idle. |
| `live/useIdle.ts`, `live/LiveBoundary.tsx`, `live/types.ts` | When to start reading, what happens when that fails, and the plain data handed to the page. |
| `sections/*` | What you can do, what is different, how it works, proof, Margin, limits, and the shared `Section` scaffold. |

## First paint and the lazy read

- The page imports `core`, `ui`, `viz` and the router only. It does not import `src/data` or `src/wallet`
  statically, and nothing it renders at first paint asks for a chain client.
- The hero opens on **the recorded option** (below), labelled "Recorded example".
- `useIdle` waits for the `load` event and then for `requestIdleCallback` (2.5 s at most). Only then is
  `live/LiveBook` imported. It calls `useMarketsIndex` and `useMarket` at the slow cadence (60 s) and `useLedger`,
  picks one open put (`hero/selection.ts`) and reports a `LiveState` to the page.
- `LiveState` is `loading`, `open` (the widget shows the offer, the inputs become selects), `none` (no put on
  the standard grid: the recorded example stays; the note says so, counts the other open offers when there are
  any and links to Markets, or offers "Post a request" when nothing at all is open) or `error` (the recorded
  example stays, with "Try again"). A chunk that fails to load ends in `error` through `LiveBoundary`; its retry
  reloads the page.
- Checked against Testnet on 11 Nov 2026 with a build that carries the contract id: the line above the
  navigation showed the ledger and the contract, and the note read "No put on the standard dates and strikes is
  open in the contract at ledger 5,675,178. 4 other offers are open." (four offers off the standard dates).
- The widget is never empty and never shows a skeleton: the recorded example is its loading state.
- Once the lazy chunk has reported, the page preloads the `/markets` route (`router.preloadRoute`): the app shell
  and the Markets chunk, code only, no data. The calls to action then open the app without a blank frame.

## The recorded option

Option No. 8 of the v1.3.1 deployment of the covered contract: a put on 5.00 EQTY at 10.00 USDx per unit for
1.00 USDx, written, bought, exercised and claimed on Testnet on 26 Oct 2026. Its terms are the arguments of the
`create_offer` call; ledger, close time, fee charged and token movements of each transaction were re-read from
Horizon on 11 Nov 2026 (`recorded.ts` lists the hashes). The same option is the "Set a floor" example, the
"Earn while waiting to buy" example (seen from the maker's side) and the five steps of the lifecycle; option
No. 4 of the same run is the covered call, option No. 1 the reclaim after expiry. The page says that these ran
on an earlier deployment than the one the app uses (under the "How it works" table).

Figures printed as proof (each once, in the Proof table), and what each counts:

- **250**: `#[test]` functions in `contracts/options` (146 in `src/test.rs`, 18 in `tests/invariants.rs`, 86 in
  `tests/negative.rs`), counted with grep on 11 Nov 2026. CI runs `cargo test`.
- **No admin key, oracle or upgrade path**: `admin`, `oracle` and `upgrade` appear in
  `contracts/options/src/lib.rs` only in two comments that say there is none.
- **0.0079873 XLM**: `fee_charged` (79,873 stroops) of the exercise transaction `f2ad8d0e…`. The README rounds
  it to 0.008; the page prints the exact figure.
- **Byte-identical build**: taken from `docs/contract-testnet-evidence.md`. It was not re-checked here, so the
  Proof row says "according to the deployment record".
- The issuer and clawback rows say that the refusals were simulated calls, and that the clawback ran on a
  separate instance of the same wasm, as the evidence document records.

## Decisions

- **Owner's direction of 11 Nov 2026 (brief 0.1) and the adversary pass.** No disclaimer taglines and nothing said
  twice. A mock build has no status line: its one "Mock data" label is on the hero note. A chain build keeps the
  line above the navigation (network, ledger, contract); that line is the only place the landing names the
  network. Each limit is told once, in the Limits list (plus the one step of "How it works" where it happens); each
  figure and each transaction hash has one home. There is no stat row, no
  questions section and no ornament. Margin is a plain panel on the sunken ground, with no tag and no glyph. The
  footer is the app's legal footer (`COPYRIGHT_NOTICE`, `LEGAL_NOTICE`) plus the two lines the Stellar brand policy
  asks for, two link groups and the contract.
- **Order of the sections.** What you can do, what is different, how it works, proof, Margin, limits: no two
  sections with the heading in the margin touch, and the navigation (How it works, Proof, Limits) is in page order.
- **One primary button per view.** "Open the markets" is the ink button, in the hero and again at the foot of the
  page (one label for one destination; ruling F17); "Open app" and "Open this offer" are outlined. There is no
  eyebrow above the headline.
- **Round 3 cuts (ruling F17).** The three intent names are the links into Markets (each says ", choose an asset"
  to a screen reader); "How it works" has no "Who acts" column, as each step title names who acts; Limits is one
  ruled list of sentences that each stand on their own, with no table head; the closing has no heading.
- **The hero note.** "Asset" picks the asset and shows its code; the lot is in the line under the terms ("This
  offer covers 10.00 FUND for 1.90 USDx ..."), because offers are whole lots, and each floor and deadline in the
  lists says which lot it would show. A lot changed by the visitor's own pick fades in under the marker flash.
  The floor is the note's one marked figure. When a change of deadline leaves the chosen floor without an offer,
  the note says which floor it moved to.
- **Nothing moves by itself.** The chart is mounted once: a new offer keeps the price the visitor set (clamped to
  the new axis) and focus stays on the handle; only a change of asset starts again at the new offer's price. The
  first swap from the recorded example to the open offer waits while the pointer moves in the note or focus is in
  it. The note never plays the "print" of a confirmed trade. The line under the terms keeps two lines in a narrow
  note so both states have the same height.
- **`TermSelect` is a native `select` laid over typeset text.** The ui kit's `Select` is a boxed control and
  cannot carry the highlighter that marks the floor. Requested as a kit variant (see the requests folder). A term
  carries one cue at rest (the caret); the underline appears on hover.
- **No live region on the outcome figures.** The handle's `aria-valuetext` reads the same sentence, so nothing is
  announced twice. The swap from the recorded example to an open offer is announced once, politely.
- **Landing type scale.** `--landing-h1-size` runs from 38 px on a phone (two lines at 390 px) to 64 px in one
  column; beside the note (from 1100 px) the headline grows from 44 px to 52 px at 1280 px and 64 px at 1440 px,
  and the note keeps at least 35rem so its three terms stay on one row. The chart's height follows the window's
  height (216 px at 900 px tall, about 170 px at 720 px) so the outcomes stay on a laptop's first screen.
- **Navigation.** The bar is sticky on the page ground with a hairline; sections land under it
  (`scroll-margin-top`). On a phone the bar holds the mark and "Open app", and the three section links sit in one
  quiet row under it.
- **Figures and units.** Every figure with a unit is the kit's `Amount` (the floor term through `TermAmount`, the
  two outcome figures, the premium under each intent figure), so one rule draws every unit (ruling F7). The time
  after the deadline's date ("08:00 UTC") is not an amount; `Term.module.css` sets it as `Amount` sets a unit
  beside a serif figure.
- **Phones.** Proof rows become blocks under 600 px (claim, then evidence), with the table roles set explicitly.
  Standalone links (the intent names among them) and stacked hashes get a finger-sized row on coarse pointers.
- **Sections** use a twelve-column grid from 1000 px: the heading stays in the left margin (sticky, under the
  bar) while the content runs beside it, except the two wide ones (what you can do, how it works), which stack.
