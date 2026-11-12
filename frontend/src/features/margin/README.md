# src/features/margin

The Margin section: uncovered American calls on partial margin, cash-settled, kept apart from the
Covered product. Mounted only in a build with `VITE_ENABLE_PRO=1`; fixtures while `VITE_PRO_CONTRACT_ID` is empty,
the Testnet contract otherwise. Read AGENTS.md, "StellSec Pro" and "StellSec Pro UI", before changing copy.

## Route contract

`index.tsx` exports `MarginPage(props: { screen: MarginScreen })` and the type
`MarginScreen = 'account' | 'trade' | 'positions' | 'liquidations' | 'vault'`. The router keeps one `MarginPage`
mounted for `/margin`, `/margin/trade`, `/margin/positions`, `/margin/liquidations` and `/margin/vault`, so the
entry warning, the replay and the acting account survive a change of screen.

## Layout of every screen (`MarginPage.tsx`)

1. `PageHeader` (one `h1` per screen, in the sub-navigation's words, and no description line) with, under the
   title, the required sentences as one plain paragraph: `marginBanner` from `core/disclosures`, and on fixtures
   the payout and publisher sentences after it. Outside the loader, so loading and error states carry them too.
2. The sub-navigation as links (`NavTabs`, "Margin sections").
3. Inside `ProLoader` (a loading shape per screen, load error with retry) and `MarginUiProvider`:
   one ruled row (`OracleStrip`): on fixtures the scenario, step, acting account and the scenario's clock on the
   left, and the publisher prices on the right (region "Publisher prices", labelled "EQTY, Margin publisher
   price"; the early-exercise state on Positions only; one sentence under 768 px); the result region (region
   "Result", a receipt after a call that went through, cleared when the screen changes); the screen; the
   "Replay a scenario" card (fixtures, `#replay`).
4. `EntryWarning`: on the contract build only, once per browser tab (`core/market/marginAck`); Cancel goes to
   `/markets`, Continue to the page heading. A fixture build signs nothing and does not ask.

## Folders

| Folder | What |
|---|---|
| `model/` | Pure TypeScript, unit-tested (`model.test.ts`): amounts and the fee share, health in words, the oracle view, the write form and mark floor, a long call's payout and breakeven, settlement, takeover and after-the-deadline rows, names. No React. |
| `parts/` | Shared pieces: `DeskTable` (a compact table, and a list of labelled pairs on phones or wherever the table would not fit its column; one column definition for both), `Usdx` / `Who` / `NoValue`, `OracleStrip`, `OutcomeRegion`, `ConfirmDialog`, `EntryWarning`, `ReplayCard`, `RecordedField`, `RunsFirst`, `Section`, `MarginUiProvider`, `useReplayable`. |
| `screens/` | The five screens and the Buy dialog. |
| `copy.ts` | Copy that is not a required disclosure. |

## Rules that are easy to break

- **No margin maths here.** NLV, MM and IM come from `get_requirement` (the client); the requirement after a
  fill comes from `client.requirementAfterFill` and is a dash when the source has none. The payout split of the
  Buy dialog is `packages/payoff`, labelled hypothetical.
- **Every call goes through `useMarginUi().act`**: it runs the call in the shared transaction layer, keeps what
  it returned for the result region and moves focus there. The transaction layer announces the outcome; nothing
  here uses `role="alert"` or `role="status"`.
- **A refusal reads `Action refused: Name (code)`**, then the sentence of `core/pro/errors`, and a link to the
  screen of the next step where there is one. Before a call, an expected refusal is the sentence first and the
  code after it, and the confirmation becomes "Try anyway". On fixtures a button the scenario has no later step
  for is disabled with that reason (`useReplayable`).
- **In the replay any recorded step can be run** (the button says "as Bob"). On the Testnet contract a holder
  call is offered to the holder only, and every write becomes "Connect wallet" without a wallet.
- **On fixtures a form shows the recorded step's amounts, locked** (`RecordedField`, "Recorded amount for step
  N"), and the button carries the amount ("Deposit 26,499.93 USDx"). A press that would replay a later step says
  first which steps run before it (`RunsFirst`, `useReplayable().next`). A receipt is built from the replayed
  step's arguments (`describe(value, step)`), never from what a form held. A step with no recorded requirement
  says where the scenario records it, in place of empty figures.
- **The premium is typed per lot** (as in Covered); the total is per lot times the quantity, exact, shown as a
  row, and is what the contract gets. A minimum per lot is stated rounded up, so it is never a refused figure.
- **Words:** "Deadline" for the instant, "after the deadline" in sentences; contract and refusal names keep
  "expired". A figure is held to its unit by a non-breaking space (`withUnit`, `numbered`, `spanText`).
- **Wording:** never guaranteed, insured, safe, fully backed or fully collateralized; a price is "the publisher
  price". `model.test.ts` checks the copy against `MARGIN_BANNED_WORDS`; `e2e/margin.spec.ts` checks the pages.
