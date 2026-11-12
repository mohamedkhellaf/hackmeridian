# core/series

The standard series grid (brief D11). An app convention only: the contract accepts any terms, and an offer that is
off the grid stays buyable from "Other offers". Exact `bigint` maths; a price "per unit" is quote units for one
whole unit of underlying. Import from `core/series` (the index) or `core/series/standard`.

## Expiries

| Export | What it does |
|---|---|
| `standardExpiries(nowSec)` | The listed expiries: the next 2 Fridays 08:00 UTC and the next 3 month-end Fridays 08:00 UTC, without duplicates, ascending, each at least one hour ahead. |
| `isStandardExpiry(ts)` | True for any Friday 08:00:00 UTC (`ts % 604800 === 115200`). |
| `isMonthlyExpiry(ts)`, `expiryCycle(ts)` | Whether a Friday is the last of its month; `weekly`, `monthly` or null. |
| `lastFridayOfMonth(year, month)` | That month's last Friday 08:00 UTC. |
| `expiryDayKey(ts)`, `expiryFromDayKey(day)` | `2026-11-13` for the `expiry=` search param, and back to 08:00 UTC of that day. |
| Constants | `DAY_SECONDS`, `WEEK_SECONDS`, `FRIDAY_0800_UTC_OFFSET`, `MIN_EXPIRY_LEAD_SECONDS`, `WEEKLY_EXPIRIES`, `MONTHLY_EXPIRIES`. |

## Strikes

| Export | What it does |
|---|---|
| `strikeLadder(referencePerUnit, decimals, count = 7, { existing, tickDp })` | `count` strikes one step apart, centred on the reference. Without a reference (`null`), the ladder is built from `existing`. |
| `ladderStep(referencePerUnit, decimals, tickDp = 2)` | The smallest of {1, 2, 5} x 10^n that is at least 1 % of the reference (the smaller step where two fit), never below the 0.01 tick. |
| `ladderFromStrikes(existing, decimals, count)` | The strikes that exist, on the tick and with at most 3 significant digits; the `count` around the median. |
| `strikesOf(offers)` | Exact per-unit strikes of offers of at least 1 unit, to pass as `existing`. |
| `isStandardStrike(strikePerUnit, ladder)` | Ladder membership. |
| `nearestStrike(pricePerUnit, ladder)` | The ladder strike nearest a price. |
| `exactStrikePerUnit(offer)` | Strike per whole unit when it is an exact amount, else null. |
| `significantDigits(units)`, `tickUnits(decimals, tickDp)` | Helpers behind the rules. |
| Constants | `DEFAULT_LADDER_COUNT` (7), `MAX_STRIKE_SIGNIFICANT_DIGITS` (3), `TICK_DP` (2). |

## Standard offers

| Export | What it does |
|---|---|
| `classifyOffer(offer, ladder, expiries)` | `{ standard: true }`, or the first reason it is not: `lot below 1 unit`, `off-grid strike`, `non-standard expiry`, `premium off the 0.01 tick`, `put premium above strike`. Works for offers and bids. |
| `partitionOffers(offers, ladder, expiries)` | Standard offers, the "Other offers" list with reasons, and a count per reason. |
| `NON_STANDARD_REASONS` | The reasons, in rule order. |

## Names

| Export | What it does |
|---|---|
| `seriesName({ code, expiry, strikePerUnit, decimals, kind })` | `BOND-20261218-100-P`. |
| `seriesNameOf(offer)` | The same from an offer, or null when its strike per unit is not exact. |
| `parseSeriesName(name)` | The parts of a name, or null. |
| `plainDecimal(units, decimals)` | `10.2`: no grouping, no trailing zeros. |

Types: `SeriesTerms`, `OfferClass`, `NonStandardReason`, `Partition`, `LadderOptions`, `SeriesId`, `ParsedSeriesName`.

Decisions recorded here: "the next 3 month-ends" starts with the current month while its last Friday is still an hour
away; the premium tick applies to the total premium; an expired offer is never standard because its expiry is not listed.
