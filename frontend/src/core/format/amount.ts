// Display text for exact token amounts (brief section 6.3).
//
// Amounts stay `bigint` from chain to screen. Everything here truncates (never rounds up), groups thousands by hand
// (no Intl.NumberFormat: its rounding modes are not available in every supported browser) and uses the true minus sign.
// The output is display text only: settlement always uses the exact units.

/** U+2212, the true minus sign. */
export const MINUS = '\u2212'
/** U+00A0, no-break space. */
export const NBSP = '\u00A0'
/** U+202F, narrow no-break space: between a figure and its unit in dense cells. */
export const THIN_NBSP = '\u202F'
/** U+2013, shown where there is no value. */
export const NO_VALUE = '–'

export interface FormatUnitsOptions {
  /** Fraction digits shown, fixed. Capped at the token's decimals. Default 2. */
  dp?: number
  /** Show `+` in front of a positive amount. Negative amounts always carry the minus sign. Default false. */
  sign?: boolean
  /** Group thousands with a comma. Default true. */
  group?: boolean
}

const isCount = (n: number) => Number.isInteger(n) && n >= 0

/** `1234567` to `1,234,567`. Digits only; anything else is returned unchanged. */
export function groupDigits(digits: string): string {
  if (!/^\d+$/.test(digits)) return digits
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ','
    out += digits[i]
  }
  return out
}

function split(units: bigint, decimals: number): { negative: boolean; whole: string; fraction: string } {
  const negative = units < 0n
  const abs = negative ? -units : units
  const base = 10n ** BigInt(decimals)
  return {
    negative,
    whole: (abs / base).toString(),
    fraction: decimals > 0 ? (abs % base).toString().padStart(decimals, '0') : '',
  }
}

const signOf = (negative: boolean, zero: boolean, sign: boolean) => (negative ? MINUS : sign && !zero ? '+' : '')

/**
 * Exact token units as display text: `formatUnits(10_800_000_000n, 7)` is `1,080.00`.
 *
 * - Truncates to `dp` fraction digits; it never rounds up.
 * - A non-zero amount is never shown as zero: `formatUnits(1n, 7)` is `<0.01` (`−<0.01` when negative).
 * - Negative amounts use U+2212. `sign: true` adds `+` to positive amounts; zero never has a sign.
 */
export function formatUnits(units: bigint, decimals: number, opts: FormatUnitsOptions = {}): string {
  if (!isCount(decimals)) return NO_VALUE
  const { sign = false, group = true } = opts
  const dp = Math.min(isCount(opts.dp ?? 2) ? (opts.dp ?? 2) : 2, decimals)
  const { negative, whole, fraction } = split(units, decimals)
  const shown = fraction.slice(0, dp)
  const prefix = signOf(negative, units === 0n, sign)
  if (units !== 0n && whole === '0' && !/[1-9]/.test(shown)) {
    return `${prefix}<${dp === 0 ? '1' : `0.${'0'.repeat(dp - 1)}1`}`
  }
  return `${prefix}${group ? groupDigits(whole) : whole}${dp > 0 ? `.${shown}` : ''}`
}

export interface FormatExactOptions {
  /** Trailing zeros are kept down to this many fraction digits. Default 2. */
  minDp?: number
  sign?: boolean
  group?: boolean
}

/**
 * Every digit of the amount, for the "exact value" popover: `formatExact(12_345_678n, 7)` is `1.2345678`,
 * `formatExact(50_000_000n, 7)` is `5.00`. Nothing is dropped, so no `<` form exists here.
 */
export function formatExact(units: bigint, decimals: number, opts: FormatExactOptions = {}): string {
  if (!isCount(decimals)) return NO_VALUE
  const { sign = false, group = true } = opts
  const minDp = Math.min(isCount(opts.minDp ?? 2) ? (opts.minDp ?? 2) : 2, decimals)
  const { negative, whole, fraction } = split(units, decimals)
  let shown = fraction.replace(/0+$/, '')
  if (shown.length < minDp) shown = shown.padEnd(minDp, '0')
  return `${signOf(negative, units === 0n, sign)}${group ? groupDigits(whole) : whole}${shown ? `.${shown}` : ''}`
}

/**
 * The same text with every space made a no-break space, so it stays on one line inside a sentence: a deadline
 * (`noBreak(formatUtc(ts))`), a figure with its unit.
 */
export const noBreak = (text: string): string => text.replaceAll(' ', NBSP)

/** `withUnit('1,080.00', 'USDx')` is `1,080.00 USDx`. Pass `THIN_NBSP` or `NBSP` as the separator in dense cells. */
export function withUnit(text: string, code: string, separator: string = ' '): string {
  return `${text}${separator}${code}`
}

/** What an amount needs to carry its unit. `TokenInfo` satisfies it. */
export interface UnitToken {
  code: string
  decimals: number
}

/**
 * `formatMoney(50_000_000n, USDX)` is `5.00 USDx`: `formatUnits` followed by the token code.
 * (Not named `formatAmount`: core/options/format already has one with another signature.)
 */
export function formatMoney(units: bigint, token: UnitToken, opts: FormatUnitsOptions & { separator?: string } = {}): string {
  return withUnit(formatUnits(units, token.decimals, opts), token.code, opts.separator ?? ' ')
}

export interface FormatNumberOptions {
  dp?: number
  sign?: boolean
  group?: boolean
}

/**
 * A JavaScript number as display text, for chart labels and hypothetical payoff figures only. It rounds to the
 * nearest `dp` digits (binary floats such as 9.639999999 must read 9.64), so it must never be used for a token
 * amount: those are `bigint` and go through `formatUnits`.
 */
export function formatNumber(value: number, opts: FormatNumberOptions = {}): string {
  const { sign = false, group = true } = opts
  const dp = isCount(opts.dp ?? 2) ? Math.min(opts.dp ?? 2, 20) : 2
  if (Number.isNaN(value)) return NO_VALUE
  if (!Number.isFinite(value)) return `${value < 0 ? MINUS : sign ? '+' : ''}∞`
  const fixed = Math.abs(value).toFixed(dp)
  const zero = !/[1-9]/.test(fixed)
  const [whole, fraction] = fixed.split('.')
  return `${signOf(value < 0 && !zero, zero, sign)}${group ? groupDigits(whole) : whole}${fraction ? `.${fraction}` : ''}`
}
