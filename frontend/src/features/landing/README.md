# features/landing

The public page at `/` (`LandingPage`, loaded lazily by the router and rendered without the app shell). It has
its own layout: a thin network line, its own navigation, eight sections and the legal footer.

## Files

| Path | What it is |
|---|---|
| `index.tsx` | The route contract: `export { LandingPage }`. |
| `LandingPage.tsx` + `.module.css` | Layout, the network line, navigation, hero text, facts row, closing band, footer. The CSS also defines the landing type scale (`--landing-*`). |
| `copy.ts` (+ test) | Every string. Sentences are whole; the ones with a figure are functions of the formatted figure. |
| `recorded.ts` | The recorded options the page is told with, their transactions and the counted test figures. |
| `hero/HeroWidget.tsx` | The floor widget: a `ContractNote` with three terms, the with-and-without chart, two outcome figures, the source line. |
| `hero/Term.tsx` | A term of the note, fixed (`TermValue`) or selectable (`TermSelect`). |
| `hero/floor.ts` (+ test) | Chart model and outcome text of a put, from `core/payoff/strategies`. |
| `hero/selection.ts` (+ test) | Which open put is shown first, and which floors and deadlines the inputs offer. |
| `live/LiveBook.tsx` | The only code that reads the book. A headless component in its own chunk, imported after idle. |
| `live/useIdle.ts`, `live/LiveBoundary.tsx`, `live/types.ts` | When to start reading, what happens when that fails, and the plain data handed to the page. |
| `sections/*` | Intents, lifecycle, proof, what is different, Margin, limits, questions, and the shared `Section` scaffold. |
| `figures/CurveFamily.tsx` | The one ornament: a family of hyperbolas closing in on a put payoff. Pure geometry, captioned as decorative. |

## First paint and the lazy read

- The page imports `core`, `ui`, `viz` and the router only. It does not import `src/data` or `src/wallet`
  statically, and nothing it renders at first paint asks for a chain client.
- The hero opens on **the recorded option** (below), labelled "Recorded example, not an open offer".
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

## The recorded option

Option No. 8 of the v1.3.1 deployment of the covered contract: a put on 5.00 EQTY at 10.00 USDx per unit for
1.00 USDx, written, bought, exercised and claimed on Testnet on 26 Oct 2026. Its terms are the arguments of the
`create_offer` call; ledger, close time, fee charged and token movements of each transaction were re-read from
Horizon on 11 Nov 2026 (`recorded.ts` lists the hashes). The same option is the "Set a floor" example, the
"Earn while waiting to buy" example (seen from the maker's side) and the five steps of the lifecycle; option
No. 4 of the same run is the covered call, option No. 1 the reclaim after expiry. The page says that these ran
on an earlier deployment than the one the app uses.

Figures printed as proof, and what each counts:

- **250**: `#[test]` functions in `contracts/options` (146 in `src/test.rs`, 18 in `tests/invariants.rs`, 86 in
  `tests/negative.rs`), counted with grep on 11 Nov 2026. CI runs `cargo test`.
- **0**: `admin`, `oracle` and `upgrade` appear in `contracts/options/src/lib.rs` only in two comments that say
  there is none.
- **0.0079873 XLM**: `fee_charged` (79,873 stroops) of the exercise transaction `f2ad8d0e…`. The README rounds
  it to 0.008; the page prints the exact figure.
- **48,064 bytes, sha256 `64ab7265…2de8`**: taken from `docs/contract-testnet-evidence.md`. The byte-identity of
  a local build was not re-checked here, so the Proof table says "by the deployment record".

## Decisions

- **Owner's direction of 11 Nov 2026 (brief 0.1).** No disclaimer taglines: the status rule of the first brief
  ("Stellar Testnet", "Fictional assets", "Unaudited") is gone. The line above the navigation names the network
  once as a state ("Testnet", or "Mock data" in a build without a contract) and, on a live build, shows the
  ledger last read and the contract id. Margin has no "experimental" label: the fence is the separation. Limits
  are full sentences in a table. The footer is the app's legal footer (`COPYRIGHT_NOTICE`, `LEGAL_NOTICE`) plus
  the two lines the Stellar brand policy asks for.
- **One primary button per view.** "Try it on Testnet" is the ink button; "Open app" and "Open this offer" are
  outlined.
- **The three inputs list only terms that have an offer.** "I hold" chooses the asset; the quantity shown is the
  lot of the offer, because offers are whole lots. When a change of deadline leaves the chosen floor without an
  offer, the note says which floor it moved to.
- **`TermSelect` is a native `select` laid over typeset text.** The ui kit's `Select` is a boxed control and
  cannot carry the highlighter that marks the floor. Requested as a kit variant (see the requests folder).
- **No live region on the outcome figures.** The handle's `aria-valuetext` reads the same sentence, so nothing is
  announced twice. The swap from the recorded example to an open offer is announced once, politely.
- **Landing type scale.** `--landing-h1-size` runs from 42 px on a phone to 64 px at 1440 px; without the
  optical-size axis the serif is wider than in the research mock, so the text column is 608 px (not 560) to keep
  the headline on two lines. The marked words never break across lines.
- **Phones** read headline, widget, facts; wide screens put the facts on the foot of the text column, level with
  the foot of the note. A narrow note sets each term on one line (label left, value right).
- **Sections** use a twelve-column grid from 1000 px: the heading stays in the left margin (sticky) while the
  content runs beside it, except the two wide ones (intents, lifecycle), which stack.
