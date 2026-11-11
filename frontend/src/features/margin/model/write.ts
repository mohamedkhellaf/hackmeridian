// The "Write an uncovered call" form: parsing what was typed and the mark floor. The contract refuses a buy
// whose premium is below quantity times the latest mark (PremiumBelowMark, 222); the floor is that product,
// in exact units. The margin requirement after a fill is never computed here: it comes from the client.
import { parseAmount } from '../../../core/format'
import type { OfferParams, Party, SeriesView } from '../../../core/pro/types'
import { USDX_DECIMALS } from '../../../core/pro/types'

/** Whole lots as typed: digits only, above zero. Null otherwise. */
export function parseLots(text: string): bigint | null {
  const t = text.trim()
  if (!/^\d{1,18}$/.test(t)) return null
  const n = BigInt(t)
  return n > 0n ? n : null
}

/** A USDx amount as typed, in exact units; null when it does not parse or has more than 7 decimals. */
export function parseUsdx(text: string): bigint | null {
  return text.trim() === '' ? null : parseAmount(text, USDX_DECIMALS)
}

/** Quantity times the latest mark per lot: the lowest total premium a buy accepts right now. Null without a mark. */
export function premiumFloor(qty: bigint | null, series: SeriesView | undefined): bigint | null {
  if (qty === null || !series?.snapshot) return null
  return qty * series.snapshot.mark
}

export interface WriteDraft {
  /** The order, when every field is valid. */
  params: OfferParams | null
  qty: bigint | null
  premium: bigint | null
  floor: bigint | null
  /** The premium is set and under the floor: a buy would be refused at the latest mark. */
  belowFloor: boolean
}

export function writeDraft(input: { writer: Party; series: SeriesView | undefined; qty: string; premium: string }): WriteDraft {
  const qty = parseLots(input.qty)
  const premium = parseUsdx(input.premium)
  const floor = premiumFloor(qty, input.series)
  const valid = input.series !== undefined && qty !== null && premium !== null && premium > 0n
  return {
    params: valid ? { writer: input.writer, seriesId: input.series!.id, qty: qty!, premium: premium!, quoteExpiry: input.series!.expiry } : null,
    qty,
    premium,
    floor,
    belowFloor: premium !== null && floor !== null && premium < floor,
  }
}

/** Total premium over quantity, rounded down to the unit: comparable with the mark per lot. */
export function premiumPerLot(premium: bigint, qty: bigint): bigint | null {
  return qty > 0n ? premium / qty : null
}
