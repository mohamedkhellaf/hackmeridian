// The "Write an uncovered call" form: parsing what was typed and the mark floor. The premium is typed per lot, as
// in Covered (ruling E18); the total is that price times the quantity, exactly, and the contract gets the total.
// The contract refuses a buy whose premium is below quantity times the latest mark (PremiumBelowMark, 222); the
// floor is that product, in exact units. The margin requirement after a fill is never computed here: it comes
// from the client.
import { parseAmount } from '../../../core/format'
import type { OfferParams, Party, SeriesView } from '../../../core/pro/types'
import { USDX_DECIMALS } from '../../../core/pro/types'

/** Whole lots as typed, grouped or not ("1,000"): digits only, above zero. Null otherwise. */
export function parseLots(text: string): bigint | null {
  const t = text.trim()
  if (!/^\d{1,3}(,\d{3})*$|^\d{1,18}$/.test(t)) return null
  const digits = t.replace(/,/g, '')
  if (digits.length > 18) return null
  const n = BigInt(digits)
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
  /** The order, when every field is valid. `premium` is the total. */
  params: OfferParams | null
  qty: bigint | null
  /** Per lot, as typed. */
  each: bigint | null
  /** Per lot times the quantity, exact: what the contract gets. */
  premium: bigint | null
  floor: bigint | null
  /** The premium is set and under the floor: a buy would be refused at the latest mark. */
  belowFloor: boolean
}

export function writeDraft(input: { writer: Party; series: SeriesView | undefined; qty: string; perLot: string }): WriteDraft {
  const qty = parseLots(input.qty)
  const each = parseUsdx(input.perLot)
  const premium = qty !== null && each !== null ? qty * each : null
  const floor = premiumFloor(qty, input.series)
  const valid = input.series !== undefined && premium !== null && premium > 0n
  return {
    params: valid ? { writer: input.writer, seriesId: input.series!.id, qty: qty!, premium: premium!, quoteExpiry: input.series!.expiry } : null,
    qty,
    each,
    premium,
    floor,
    belowFloor: premium !== null && floor !== null && premium < floor,
  }
}

/** Total premium over quantity, rounded down to the unit: comparable with the mark per lot. */
export function premiumPerLot(premium: bigint, qty: bigint): bigint | null {
  return qty > 0n ? premium / qty : null
}

/**
 * A recorded total over its quantity as an exact decimal string, with as many digits as it takes ("0.61917009"
 * for 619.17009 over 1,000 lots). For the locked field of a replayed order, whose per-lot price can be finer than
 * the 7 decimals a typed price allows. Null when the quotient does not end within 18 decimals.
 */
export function exactPerLot(total: bigint, qty: bigint): string | null {
  if (qty <= 0n || total < 0n) return null
  const whole = total / qty
  let rest = total % qty
  let digits = ''
  for (let i = 0; i < 18 && rest !== 0n; i++) {
    rest *= 10n
    digits += (rest / qty).toString()
    rest %= qty
  }
  if (rest !== 0n) return null
  const unit = 10n ** BigInt(USDX_DECIMALS)
  const intPart = whole / unit
  const frac = (whole % unit).toString().padStart(USDX_DECIMALS, '0') + digits
  const trimmed = frac.replace(/0+$/, '')
  return trimmed ? `${intPart}.${trimmed}` : intPart.toString()
}
