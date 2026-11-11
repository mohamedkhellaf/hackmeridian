// Number formatting for chart labels. Display only: these take floats that a chart derived (a point under the
// handle, an axis end). Anything that restates a contract term is formatted by the caller from exact integers and
// handed to the chart as a string.

export const MINUS = '−'

const formatters = new Map<number, Intl.NumberFormat>()

function formatter(decimals: number): Intl.NumberFormat {
  let f = formatters.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    formatters.set(decimals, f)
  }
  return f
}

function snapZero(value: number, decimals: number): number {
  // Below half of the last printed unit the figure prints as zero, so it must not carry a sign.
  return Math.abs(value) < 0.5 / 10 ** decimals ? 0 : value
}

/** Grouped, fixed decimals, true minus sign: `1,284.50`, `−1.80`. Never prints `−0.00`. */
export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? `${MINUS}∞` : ''
  const v = snapZero(value, decimals)
  const body = formatter(decimals).format(Math.abs(v))
  return v < 0 ? `${MINUS}${body}` : body
}

/** Always signed, for gains, losses and differences: `+5.70`, `−1.80`, and `0.00` without a sign. */
export function formatSigned(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return value > 0 ? '+∞' : value < 0 ? `${MINUS}∞` : ''
  const v = snapZero(value, decimals)
  const body = formatter(decimals).format(Math.abs(v))
  return v > 0 ? `+${body}` : v < 0 ? `${MINUS}${body}` : body
}

/** Axis ends only: full figures below 10,000, then `10K`, `1.2M`, `3B`. Never used for amounts in text. */
export function formatAxis(value: number, decimals = 2): string {
  const abs = Math.abs(value)
  if (!Number.isFinite(value) || abs < 10_000) return formatNumber(value, decimals)
  const units: Array<[number, string]> = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ]
  for (const [size, suffix] of units) {
    if (abs >= size) {
      // Up to two decimals, without trailing zeros: 750K, 1.75M, 12.5K.
      const scaled = abs / size
      const text = scaled >= 100 ? Math.round(scaled).toString() : (Math.round(scaled * 100) / 100).toString()
      return `${value < 0 ? MINUS : ''}${text}${suffix}`
    }
  }
  return formatNumber(value, decimals)
}

/**
 * Decimals that keep neighbouring prices apart on an axis of the given span: 2 for everyday prices, more for
 * very small ones (a span of 0.004 gives 5), none from 10,000 up. Capped at 7, the precision of a Stellar asset.
 */
export function autoDecimals(span: number): number {
  const s = Math.abs(span)
  if (!Number.isFinite(s) || s === 0) return 2
  if (s >= 10_000) return 0
  if (s >= 1) return 2
  return Math.min(7, 2 + Math.ceil(-Math.log10(s)))
}

/** Percentage with one decimal, rounded toward zero so a ratio never reads better than it is: `92.0 %`. */
export function formatPercent(ratio: number, decimals = 1): string {
  if (!Number.isFinite(ratio)) return ''
  const scale = 10 ** decimals
  const truncated = Math.trunc(ratio * 100 * scale + (ratio >= 0 ? 1e-9 : -1e-9)) / scale
  return `${formatNumber(truncated, decimals)} %`
}
