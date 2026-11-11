// Text forms used across the ticket. Amounts are exact integers, truncated to two decimals, never rounded up.
import { formatUnits } from '../../core/format'
import type { PreTradeIssue } from '../../core/options/preTrade'
import type { Money, TokenInfo } from '../../core/options/types'

/** `5.00 USDx`. */
export const moneyText = (m: Money): string => `${formatUnits(m.amount, m.token.decimals)} ${m.token.code}`

/** A per-unit price in quote units: `0.36 USDx`. An en dash when there is none. */
export const priceText = (units: bigint | null, quote: TokenInfo): string => (units === null ? '\u2013' : `${formatUnits(units, quote.decimals)} ${quote.code}`)

/** `08:01:30 UTC`: the end of a transaction's validity window needs its seconds. */
export function utcClock(ts: number): string {
  return `${new Date(ts * 1000).toISOString().slice(11, 19)} UTC`
}

/** The first blocking issue of the re-check, as the reason a button is disabled. */
export function firstBlocker(issues: readonly PreTradeIssue[] | undefined): PreTradeIssue | null {
  return issues?.find((i) => i.level === 'block' && i.code !== 'not-connected') ?? null
}

/** When the subject of a ticket was last read: `Re-read from the contract at 14:02:11 UTC`. `ms` is 0 before the first read. */
export function readAtText(ms: number): string | undefined {
  return ms > 0 ? `Re-read from the contract at ${utcClock(Math.floor(ms / 1000))}` : undefined
}

/** The message of a failed read, for telling "no such id" (data `isNotFoundMessage`) from a network failure. */
export const errorText = (error: unknown): string | null => (error instanceof Error ? error.message : typeof error === 'string' ? error : null)
