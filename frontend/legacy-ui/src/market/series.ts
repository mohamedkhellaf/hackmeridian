import type { OptionOffer } from '../options/types'

// Cheaper premium per unit of underlying first. Cross-multiplied so it stays exact in bigint.
export function byPremiumPerUnit(a: OptionOffer, b: OptionOffer): number {
  const l = a.totalPremium * b.underlyingQty
  const r = b.totalPremium * a.underlyingQty
  return l < r ? -1 : l > r ? 1 : 0
}

// Strike per unit of underlying, compared exactly (cross-multiplied).
function byStrikePerUnit(a: OptionOffer, b: OptionOffer): number {
  const l = a.totalStrike * b.underlyingQty
  const r = b.totalStrike * a.underlyingQty
  return l < r ? -1 : l > r ? 1 : 0
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Same series: same underlying, quote, kind, expiry and strike per unit. Competing makers quote the same series. */
export function sameSeries(a: OptionOffer, b: OptionOffer): boolean {
  return (
    a.underlying.contractId === b.underlying.contractId &&
    a.quote.contractId === b.quote.contractId &&
    a.kind === b.kind &&
    a.expiry === b.expiry &&
    byStrikePerUnit(a, b) === 0
  )
}

// Market table order: expiry, strike per unit, asset, kind, then cheapest premium per unit, so the offers of one
// series (competing makers) sit next to each other. Returns a new array.
export function sortOffers(offers: OptionOffer[]): OptionOffer[] {
  return [...offers].sort(
    (a, b) =>
      a.expiry - b.expiry ||
      byStrikePerUnit(a, b) ||
      byText(a.underlying.code, b.underlying.code) ||
      byText(a.underlying.contractId, b.underlying.contractId) ||
      byText(a.quote.contractId, b.quote.contractId) ||
      byText(a.kind, b.kind) ||
      byPremiumPerUnit(a, b),
  )
}

// "3d 0h", "5h 12m", "12m", "expired". Pure; `nowMs` is injectable for tests.
export function formatCountdown(expiryUnix: number, nowMs: number = Date.now()): string {
  const secs = Math.floor(expiryUnix - nowMs / 1000)
  if (secs <= 0) return 'expired'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(m, 1)}m`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Compact local expiry for tables: "29 Oct 06:04"; the year is added when it is not the current one.
export function formatExpiryShort(expiryUnix: number, nowMs: number = Date.now()): string {
  const d = new Date(expiryUnix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const year = d.getFullYear() !== new Date(nowMs).getFullYear() ? ` ${d.getFullYear()}` : ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export type KindFilter = 'all' | 'put' | 'call'

// Asset/kind filters. `asset` is an underlying token code or 'all'.
export function filterOffers(offers: OptionOffer[], asset: string, kind: KindFilter): OptionOffer[] {
  return offers.filter((o) => (asset === 'all' || o.underlying.code === asset) && (kind === 'all' || o.kind === kind))
}
