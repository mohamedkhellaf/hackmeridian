# src/features/margin

The Margin section (experimental): uncovered American calls on partial margin, cash-settled, kept apart from the
Covered product. Mounted only in a build with `VITE_ENABLE_PRO=1`; fixtures while `VITE_PRO_CONTRACT_ID` is empty,
the Testnet contract otherwise. Read AGENTS.md, "StellSec Pro" and "StellSec Pro UI", before changing copy.

## Route contract

`index.tsx` exports `MarginPage(props: { screen: MarginScreen })` and the type
`MarginScreen = 'account' | 'trade' | 'positions' | 'liquidations' | 'vault'`. The router keeps one `MarginPage`
mounted for `/margin`, `/margin/trade`, `/margin/positions`, `/margin/liquidations` and `/margin/vault`, so the
entry warning, the replay and the acting account survive a change of screen.

## Layout of every screen (`MarginPage.tsx`)

1. The one banner, verbatim from `core/disclosures` (`marginBanner`), plus the payout-risk line on fixtures.
2. `PageHeader` (one `h1` per screen) and the sub-navigation as links (`NavTabs`, "Margin sections").
3. Inside `ProLoader` (loading skeleton, load error with retry) and `MarginUiProvider`:
   the replay line (fixtures), the oracle strip (region "Oracle"), the result region (region "Result"),
   the screen, the "Replay a scenario" card (fixtures, `#replay`).
4. `EntryWarning`: once per browser tab (`core/market/marginAck`); Cancel goes to `/markets`.

## Folders

| Folder | What |
|---|---|
| `model/` | Pure TypeScript, unit-tested (`model.test.ts`): amounts, health in words, the oracle view, the write form and mark floor, the hypothetical payout split (`packages/payoff`), settlement and takeover rows, names and English scenario copy. No React. |
| `parts/` | Shared pieces: `DeskTable` (a compact table on a desk, a list of labelled pairs under 768 px, one column definition for both), `Usdx` / `Who` / `NoValue`, `OracleStrip`, `OutcomeRegion`, `ConfirmDialog`, `EntryWarning`, `ReplayCard`, `Section`, `MarginUiProvider`. |
| `screens/` | The five screens and the Buy dialog. |
| `copy.ts` | Copy that is not a required disclosure. |

## Rules that are easy to break

- **No margin maths here.** NLV, MM and IM come from `get_requirement` (the client); the requirement after a
  fill comes from `client.requirementAfterFill` and is a dash when the source has none. The payout split of the
  Buy dialog is `packages/payoff`, labelled hypothetical.
- **Every call goes through `useMarginUi().act`**: it runs the call in the shared transaction layer, keeps what
  it returned for the result region and moves focus there. The transaction layer announces the outcome; nothing
  here uses `role="alert"` or `role="status"`.
- **A refusal reads `Action refused: Name (code)`**, then the sentence of `core/pro/errors`. A fixture call with
  no matching step reads "Not in this scenario".
- **In the replay any recorded step can be run** (the button says "as Bob"). On the Testnet contract a holder
  call is offered to the holder only, and every write becomes "Connect wallet" without a wallet.
- **Wording:** never guaranteed, insured, safe, fully backed or fully collateralized; a price is "the publisher
  price". `model.test.ts` checks the copy against `MARGIN_BANNED_WORDS`; `e2e/margin.spec.ts` checks the pages.
