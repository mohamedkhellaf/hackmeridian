import { parseAmount } from '../options/format'
import { MAX_TENOR_SECONDS } from '../options/types'
import type { NewOffer, OptionKind, SupportedAssets } from '../options/types'

/** The form field a refusal is about, so a form can show it under that field without reading the sentence. */
export type OfferField = 'underlying' | 'qty' | 'strike' | 'premium' | 'expiry'

export type Draft = { offer: NewOffer } | { error: string; field: OfferField }

export function buildOffer(
  assets: SupportedAssets,
  f: { kind: OptionKind; underlyingId: string; qty: string; strike: string; premium: string; expiry: string },
): Draft {
  const underlying = assets.underlyings.find((u) => u.contractId === f.underlyingId)
  if (!underlying) return { error: 'Pick an underlying asset', field: 'underlying' }
  const qty = parseAmount(f.qty, underlying.decimals)
  if (!qty) return { error: `Quantity must be a positive amount of ${underlying.code}`, field: 'qty' }
  const strike = parseAmount(f.strike, assets.quote.decimals)
  if (!strike) return { error: `Strike must be a positive ${assets.quote.code} price`, field: 'strike' }
  const premium = parseAmount(f.premium, assets.quote.decimals)
  if (!premium) return { error: `Premium must be a positive ${assets.quote.code} amount`, field: 'premium' }
  // Total strike must be an exact number of quote units; no rounding of settlement amounts.
  const scaled = strike * qty
  const base = 10n ** BigInt(underlying.decimals)
  if (scaled % base !== 0n) return { error: 'Strike × quantity is not an exact amount; adjust one of them', field: 'qty' }
  const expiry = Math.floor(new Date(f.expiry).getTime() / 1000)
  if (!Number.isFinite(expiry) || expiry <= Date.now() / 1000 + 60) return { error: 'The deadline must be in the future', field: 'expiry' }
  if (expiry > Date.now() / 1000 + MAX_TENOR_SECONDS - 60) return { error: 'The deadline must be within 2 years', field: 'expiry' }
  return { offer: { kind: f.kind, underlying, underlyingQty: qty, totalStrike: scaled / base, totalPremium: premium, expiry } }
}
