// Text forms used across the ticket. Amounts are exact integers, truncated to two decimals, never rounded up. A
// figure is joined to its unit, and a time is joined inside, by a no-break space (core/format): neither breaks.
import { formatMoney, formatUtcClock } from '../../core/format'
import type { PreTradeIssue } from '../../core/options/preTrade'
import type { Money, TokenInfo } from '../../core/options/types'

/** `5.00 USDx`. */
export const moneyText = (m: Money): string => formatMoney(m.amount, m.token)

/** A per-unit price in quote units: `0.36 USDx`. An en dash when there is none. */
export const priceText = (units: bigint | null, quote: TokenInfo): string => (units === null ? '\u2013' : formatMoney(units, quote))

/** `08:01:30 UTC`: the end of a transaction's validity window needs its seconds. */
export const utcClock = (ts: number): string => formatUtcClock(ts)

/** The first blocking issue of the re-check, as the reason a button is disabled. */
export function firstBlocker(issues: readonly PreTradeIssue[] | undefined): PreTradeIssue | null {
  return issues?.find((i) => i.level === 'block' && i.code !== 'not-connected') ?? null
}

/** When the subject of a ticket was last read, `14:02:11 UTC`, for the checks sentence. `ms` is 0 before the first read. */
export function readAtText(ms: number): string | undefined {
  return ms > 0 ? utcClock(Math.floor(ms / 1000)) : undefined
}

/** The message of a failed read, for telling "no such id" (data `isNotFoundMessage`) from a network failure. */
export const errorText = (error: unknown): string | null => (error instanceof Error ? error.message : typeof error === 'string' ? error : null)
