# core/reference

The reference price model (brief D12). The Covered contract reads no price; a reference exists only so the
interface can say where a strike stands, and it is always shown with its label and note. Nothing here is called a
market price, an oracle price or a live price, and nothing here reaches a transaction. Exact `bigint` maths.
Import from `core/reference` (the index).

## Model (`types.ts`)

| Export | What it does |
|---|---|
| `ReferencePrice` | `{ kind, perUnit, label, note, asOf, source? }`. `perUnit` is quote units for one whole unit of underlying, or null. |
| `ReferenceKind` | `demo` (mock mode), `fixed` (Testnet faucet rate), `desk` (target state, no provider yet), `none`. |
| `REFERENCE_LABEL`, `REFERENCE_NOTE` | The label and the one-line note for each kind (`Testnet faucet price`, `Fixed by the team's faucet. Not a market.`). |

## Providers (`providers.ts`)

| Export | What it does |
|---|---|
| `demoReference(asset, quoteDecimals = 7)` | Mock mode: the demo price of FUND, BOND or EQTY; `none` otherwise. |
| `faucetReference(asset, quoteDecimals = 7)` | Live mode: 10 USDx per unit for RWA, BOND and EQTY. Pass the token (not just the code) so a look-alike from another issuer gets `none`. |
| `referenceFor(asset, 'mock' \| 'testnet')` | Picks the provider for the mode. |
| `noReference()` | The `none` state. |
| `DEMO_PRICES`, `demoPerUnit(code, quoteDecimals)` | The demo table (`FUND 10.20`, `BOND 99.40`, `EQTY 24.60`) and one entry in quote units. The mock seed prices around it. |
| `FAUCET_PRICE`, `FAUCET_SOURCE`, `DEMO_SOURCE` | The fixed rate and the source lines. |
| Type | `ReferenceSubject` (a code, or `{ code, contractId }`). |

## Helpers (`moneyness.ts`)

Each takes a `ReferencePrice`, a bare per-unit price (the user's assumed price) or null.

| Export | What it does |
|---|---|
| `priceOf(ref)` | The usable per-unit price, or null. |
| `moneyness(kind, strikePerUnit, ref, band = 0n)` | `in`, `at`, `out` or `unknown`. |
| `optionMoneyness(option, ref)` | The same from an option's totals, exact even when the strike per unit is uneven. |
| `intrinsicPerUnit(kind, strikePerUnit, ref)` | In-the-money amount per unit, floored at zero; null without a price. |
| `exerciseValue(option, ref)` | What exercising now is worth against not exercising: total, signed, truncated toward zero, premium not included. |
| `distancePct(strikePerUnit, ref)` | Strike relative to the reference in percent, signed, as a display number. |
| `describeReference(ref, { quoteCode, quoteDecimals, underlyingCode, dp? })` | One line with label, figure and note. |
| Types | `PriceInput`, `Moneyness`, `ExerciseTerms`, `DescribeOptions`. |
