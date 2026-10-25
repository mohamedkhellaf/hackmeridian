import type { OptionOffer } from './types'

export function formatAmount(units: bigint, decimals: number, maxFraction = 2): string {
  const neg = units < 0n
  const abs = neg ? -units : units
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  const frac = (abs % base).toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '')
  return `${neg ? '-' : ''}${whole.toLocaleString('en-US')}${frac ? '.' + frac : ''}`
}

// Strike per one unit of underlying, for display only.
export function strikePerUnit(o: OptionOffer): string {
  if (o.underlyingQty === 0n) return '–'
  const scaled = (o.totalStrike * 10n ** BigInt(o.underlying.decimals)) / o.underlyingQty
  return formatAmount(scaled, o.quote.decimals)
}

export function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a
}

export function formatExpiry(unix: number): string {
  return new Date(unix * 1000).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}
