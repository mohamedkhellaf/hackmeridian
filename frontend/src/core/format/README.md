# core/format

Display text for amounts, time, words and contract ids (brief section 6.3). Pure TypeScript, no React, no `Intl.NumberFormat`.
Amounts are exact `bigint` units and are truncated, never rounded up. Import from `core/format` (the index).

## Amounts (`amount.ts`)

| Export | What it does |
|---|---|
| `formatUnits(units, decimals, { dp = 2, sign = false, group = true })` | Exact units to text: `1,080.00`. Truncates, groups by hand, uses the true minus sign (U+2212), and shows a non-zero amount that truncates to zero as `<0.01`. |
| `formatExact(units, decimals, { minDp = 2, sign, group })` | Every digit, trailing zeros trimmed down to `minDp`: `1.2345678`. For the exact-value popover. |
| `formatMoney(units, token, opts)` | `formatUnits` followed by the token code: `5.00 USDx`, joined by a no-break space so the figure never breaks from its unit. `opts.separator` sets another space (`THIN_NBSP` in dense cells). |
| `withUnit(text, code, separator = NBSP)` | Appends a unit to formatted text, after a no-break space. |
| `formatNumber(value, { dp, sign, group })` | A JavaScript `number` for chart labels only. Rounds to nearest; never use it for a token amount. |
| `groupDigits(digits)` | `1234567` to `1,234,567`. |
| `MINUS`, `NBSP`, `THIN_NBSP`, `NO_VALUE` | U+2212, U+00A0, U+202F (figure and unit in dense cells), U+2013 (no value). |
| `parseAmount` | Re-export of `core/options/format` `parseAmount` (user text to exact units). |
| Types | `FormatUnitsOptions`, `FormatExactOptions`, `FormatNumberOptions`, `UnitToken`. |

## Time (`time.ts`)

All timestamps are unix seconds. Every space inside a date, a time or a duration is a no-break space (U+00A0), so
`13 Nov`, `08:00 UTC` and `3 h 12 min` never break across lines; the full form may break only after its comma.

| Export | What it does |
|---|---|
| `formatUtc(ts)` | The canonical form: `13 Nov 2026, 08:00 UTC`. |
| `formatUtcDate(ts)`, `formatUtcDay(ts)`, `formatUtcTime(ts)` | `13 Nov 2026`, `13 Nov`, `08:00 UTC`. |
| `formatLocal(ts, timeZone?)` | Same shape in local time with the zone name: `13 Nov 2026, 09:00 CET`. |
| `isoUtc(ts)` | `2026-11-13T08:00:00Z`, for `<time dateTime>`. |
| `secondsUntil(expiryTs, nowSec)` | Whole seconds left, negative once past. |
| `formatCountdown(secondsLeft)` | `2 d 4 h`, `3 h 12 min`, `8 min`, `<1 min`, `expired`. Takes seconds left, not a timestamp. |
| `deadlineUrgency(secondsLeft)` | `far`, `within48h`, `within2h`, `within15min` or `past` (brief D17). |
| `URGENCY_48H_SECONDS`, `URGENCY_2H_SECONDS`, `URGENCY_15MIN_SECONDS` | The thresholds. |
| Type | `DeadlineUrgency`. |

`core/time.ts` keeps the compact legacy forms (`3d 0h`); new screens use the functions here.

## Words (`words.ts`)

| Export | What it does |
|---|---|
| `plural(count, { one, other })`, alias `pluralize` | The right form for a count, through `Intl.PluralRules`. |
| `countOf(count, forms)` | Count and noun: `2 makers`, `1,200 offers`. |
| `formatList(items, 'conjunction' \| 'disjunction')` | `RWA, BOND and EQTY` or `RWA, BOND or EQTY`, through `Intl.ListFormat`. |
| Type | `PluralForms`. |

## Option words (`option.ts`)

| Export | What it does |
|---|---|
| `serialOf(id)` | The contract id as the contract numbers it, never padded: `0`, `26`, `184`. The only formatter of an offer, option or request number (`No. 0`, `Offer No. 26`). |
| `KIND_WORD` | `Put`, `Call`, to start a label. |
| `strikePerUnitText(o)`, `strikePerUnitExact(o)` | The strike per unit at two decimals (`98.00`), and every digit for the exact-value popover. |
