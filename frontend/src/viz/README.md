# `src/viz`: the StellSec chart kit

Hand-written SVG, no chart library. Import from `src/viz` (the `index.ts` barrel). Every chart in one page:
the "Charts" chapter of `/design` (`src/viz/Gallery.tsx`, default export, mounted by `src/app/DesignPage.tsx`).

## Rules of the kit

- **Plain props.** Components take numbers (for positions) and strings (for exact text). Callers do the bigint
  and payoff maths (`packages/payoff`, `core/`) and pass labels they formatted from exact integers
  (`label: '9.64'`). The kit formats a number itself only when no label is given, and for values under the
  handle (`format.ts`: rounded, true minus sign, never `−0.00`).
- **No imports from `core/`, `data/`, `features/` or `ui/` components.** Only the CSS variables of
  `ui/tokens/tokens.css`. Styles live in `@layer ui`.
- **Engraved style** (brief 5.4): 1.5 px ink line, gain area tinted (`--gain-fill`), loss area hatched at 45°
  (`--loss-hatch`), strike as a dotted rule, breakeven as an open circle, the reference price as an ink tick,
  direct labels, no legend, no gridlines but the zero line.
- **Never colour alone.** Every gain or loss figure has a sign and a word (no triangle); a loss, shortfall or
  deficit is hatched; states have words.
- **Labels never collide.** Each label is placed by rule (`labels.ts`, `payoffLayout.ts`,
  `withWithoutLayout.ts`): candidates are tried in order, a label that cannot be placed is shortened, moved to the
  row under the plot, or dropped by priority. Rules and hatching are cut out behind labels. Unit tests check
  this over ten widths (240 to 760 px) and seventeen handle positions for nine payoff shapes.
- **Responsive by container.** Charts read their own width with a `ResizeObserver` (1 SVG unit = 1 CSS px, so
  text keeps its size); list-like components use container queries.
- **Captions and copy belong to the caller.** `caption` is a required prop: pass the sentence from
  `core/disclosures.ts`. The reference price label must carry its source ("Demo price 9.82").

## Components

| Component | What it shows | Props that matter |
|---|---|---|
| `PayoffChart` | Payoff at the deadline for one position, with the assumed-price handle | `points: {x, y}[]` (use `samplePiecewise(fn, domain, kinks)`), `domain`, `strike`, `breakevens`, `reference: {value, label}`, `maxGain` / `maxLoss: {value, label?, at?}` (`Infinity` = unlimited; a finite extreme outside the plotted range is said in a line above the plot, "Most you can gain +101.70 USDx, if FUND is at 0.00", never pinned to the end of the line), `price` + `onPriceChange` (or `defaultPrice`), `unit`, `asset`, `title`, `caption`, `readout`, `valueText`, `readOnly`, `tableVisible` |
| `WithWithoutChart` | Value of a holding at the deadline with the option (solid) and without (dashed) | `points: {x, with, without}[]`, `level: {value, label}` ("Floor 10.00" / "Cap 11.00"), `reference`, `withLabel`, `withoutLabel`, same price, unit, title, caption and readout props |
| `OutcomeCards` | Scenario cards side by side: label, serif figure, signed difference, sentence | `outcomes: {id, label, figure, unit?, delta?: {value, text}, sentence?, current?}[]`, `onSelect(id)` (makes cards buttons) |
| `HealthBar` | Margin: account value against MM and IM | `nlv`, `mm`, `im` (numbers), `nlvLabel`, `mmLabel`, `imLabel`, `mmShortLabel`, `imShortLabel` (exact strings), `status` (the sentence with the distance), `stateLabel` |
| `Waterfall` | Payout sources in order as one stacked bar | `segments: {id, label, value, valueLabel, kind?: 'paid' \| 'deficit'}[]`, `heading`, `paidLabel`, `max` (shared scale) |
| `BulletRow` | Reserves: held (bar) against locked (tick) | `name`, `locked`, `held`, `heldLabel`, `lockedLabel`, `differenceLabel` (exact, signed), `differenceWord`, `max`, `decorative` |
| `Sparkline` | A plain line with a last-value dot | `values`, `label` (what it is), `summary?`, `lastLabel?`, `rule?`, `height` |
| `TimelineDots` | Lifecycle steps as dots on a rule | `steps: {id, label, detail?, state: 'done' \| 'current' \| 'upcoming'}[]`, `label`, `orientation` |
| `Bullet`, `DataTable`, `VisuallyHidden` | Building blocks | |

### The price handle

Both payoff figures share one handle (`usePriceSlider`): an ink flag under the plot with `role="slider"`.

- Keys: arrows one step, Shift with an arrow or Page Up / Page Down a large step (ten steps by default),
  Home / End the ends of the range.
- Pointer: click or tap anywhere on the plot sets the price (the single-pointer alternative to dragging), drag
  scrubs, Escape during a drag restores. A drag snaps onto the strike, breakeven and reference price.
  On touch screens a vertical gesture scrolls the page (`touch-action: pan-y`).
- `aria-valuetext` reads "At 8.00 you would gain 28.20 USDx" (override with `valueText`). The read-out above the
  plot shows the same in a serif figure; it is not a live region, so nothing is announced twice.
- Controlled (`price`, `onPriceChange`) or uncontrolled (`defaultPrice`). Compute `domain` when the inputs
  change, never while dragging (`priceDomain({ center, include })`).

### Accessibility contract

- Payoff figures render `figure > figcaption` and `data-testid="payoff-chart"` on the `svg`
  (`with-without-chart` on the other one). The `svg` is `role="img"` with `aria-label={title}` and a generated
  description; a table of sampled points follows every chart (visually hidden unless `tableVisible`).
- `HealthBar`, `Waterfall` and `Sparkline` are `role="img"` with a name built from the labels you pass.
- `BulletRow decorative` hides the row when a table beside it carries the same figures.
- axe reports no violation on `/design` (which mounts every chart) in both themes at 1440 and 390 px.
- `HealthBar` treats `0, 0, 0` as a known account ("Above opening margin"). Pass `NaN` for a requirement that
  is not known yet: the bar then draws no state.
- `Waterfall` names a zero deficit "Deficit 0.00, not paid" in its accessible name. Pass your own `label` when a
  sentence reads better ("... no deficit.").
- `WithWithoutChart` takes `readoutDifference` (replaces the "Difference" line of the default read-out) and
  `readoutNote` (one sentence under it), so a caller adds its words without rebuilding the read-out with `readout`.

## Pure helpers (also exported)

`scales.ts` (`linearScale`, `niceTicks`, `niceStep`, `niceDomain`, `clamp`, `extent`, `priceDomain`),
`geometry.ts` (`samplePiecewise`, `interpolateAt`, `bandsBetween`, `linePath`, `polygonPath`, `crossingsAt`,
`snapToStep`, `magnet`), `labels.ts` (`placeLane`, `spreadLane`, `pickBox`, `boxIsFree`, `segmentHitsRect`,
`estimateTextWidth`), `a11y.ts` (`sliderKeyValue`, `payoffValueText`, `seriesSummary`, `direction`),
`format.ts` (`formatNumber`, `formatSigned`, `formatAxis`, `formatPercent`, `autoDecimals`).

## Example

```tsx
import { PayoffChart, priceDomain, samplePiecewise } from '../../viz'

const domain = priceDomain({ center: reference, include: [strike, breakeven] })
<PayoffChart
  title="Payoff at the deadline, long put on 5.00 BOND"
  points={samplePiecewise((s) => payoff.pnl(s), domain, [strike])}
  domain={domain}
  strike={{ value: strike, label: '10.00' }}
  breakevens={[{ value: breakeven, label: '9.64' }]}
  reference={{ value: reference, label: 'Demo price 9.82' }}
  maxGain={{ value: 48.2, label: '48.20', at: 0 }}
  maxLoss={{ value: 1.8, label: '1.80' }}
  price={assumed}
  onPriceChange={setAssumed}
  unit="USDx"
  asset="BOND"
  caption={HYPOTHETICAL_PAYOFF}
/>
```
