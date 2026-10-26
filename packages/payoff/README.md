# @strata/payoff

Pure, dependency-free payoff maths for the charts. Every result carries `label: "hypothetical"`: these are expiry payoffs, not executable prices. `number` is for display only; keep on-chain amounts as `bigint`.

```ts
import { toNumber, coveredCall, collar, proHolderPayout } from '@strata/payoff' // path: packages/payoff/src/index.ts
const strikeTotal = toNumber(option.strike_total, 7) // bigint units -> display number
const s = coveredCall({ qty: 10, entryPrice: 100 }, { qty: 10, strikeTotal, premiumTotal: 40 })
s.curve({ from: 50, to: 150, steps: 100 }) // [{ s, pnl }, ...] for the chart
```

- `toNumber(units, decimals)` / `toUnits(value, decimals)`: on-chain integer <-> display number (round-trips integers exactly at 7 decimals).
- `longCall`, `shortCall`, `longPut`, `shortPut` `(leg, spot)`: `{ perUnit, total }` P&L at expiry, premium included. `leg = { qty, strikeTotal, premiumTotal }` (totals, like the contract).
- `coveredCall(holding, call)`, `cashSecuredPut(put)`, `protectivePut(holding, put)`, `collar(holding, put, call)`: return `{ pnl(s), breakevens, maxGain, maxLoss, capitalLocked, curve(range) }`. `holding = { qty, entryPrice }`; `qty` must match the option legs.
- `maxGain`/`maxLoss` are `Infinity` when unbounded; `maxLoss` is a positive number. `capitalLocked` is gross (premiums received are not netted).
- `proHolderPayout(qty, K, S_T, margin, vault)`: `{ due, paid, deficit }` with `paid = min(due, margin + vault)`; show the deficit, never hide it. Single-writer simplification: in the v0.1 model the vault is shared pro rata across a series' shortfalls, so with several writers in deficit the real payout is lower.
- `fullCoverPrice(qty, K, margin, vault)`: `K + (margin + vault) / qty`, the highest settlement price paid in full under the same simplification. Label it "covered up to", never "guaranteed" (`guaranteedCoverPrice` is a deprecated alias).
- Prices `s` are per unit of the underlying; no fees or slippage are modelled.

Run: `npm install && npm test && npm run typecheck`.
