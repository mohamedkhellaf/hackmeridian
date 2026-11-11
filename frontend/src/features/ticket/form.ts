// The terms form of the write and bid tickets, without React: defaults from the standard grid, the draft the
// one validator of core builds from the fields, and which field an error belongs to.
import { formatCountdown } from '../../core/format'
import { buildOffer } from '../../core/maker/buildOffer'
import { parseAmount } from '../../core/options/format'
import type { NewOffer, OptionKind, SupportedAssets, TokenInfo } from '../../core/options/types'
import { DAY_SECONDS, LADDER_ROWS, expiryDayKey, nearestStrike, plainDecimal, standardExpiries, strikeLadder, strikesOf } from '../../core/series'
import type { SeriesTerms } from '../../core/series'
import type { FormIntent } from './intent'

/** Strikes offered as chips: the app-wide grid of core/series, so a ticket chip is always a cell of the chain. */
export const TICKET_LADDER_COUNT = LADDER_ROWS

export interface TermsForm {
  kind: OptionKind
  /** Strike for one whole unit of underlying, as typed or chosen. */
  strike: string
  /** Unix seconds, or null while a custom date does not parse. */
  expiry: number | null
  /** Underlying units, as typed. */
  qty: string
  /** Total premium in quote units, as typed. */
  premium: string
}

export type FormField = 'kind' | 'strike' | 'expiry' | 'qty' | 'premium'

export interface Grid {
  /** Listed expiries, ascending (core/series). */
  expiries: number[]
  /** Strikes per unit around the reference price, ascending, in quote units. */
  ladder: bigint[]
}

/** The standard grid for one asset at one moment. Without a reference the ladder is built from open offers. */
export function gridFor(args: { nowSec: number; referencePerUnit: bigint | null; quoteDecimals: number; existing?: readonly Pick<SeriesTerms, 'underlying' | 'underlyingQty' | 'totalStrike'>[] }): Grid {
  return {
    expiries: standardExpiries(args.nowSec),
    ladder: strikeLadder(args.referencePerUnit, args.quoteDecimals, TICKET_LADDER_COUNT, { existing: strikesOf(args.existing ?? []) }),
  }
}

/** A strike as the form holds it: `10.2`. */
export const strikeText = (perUnit: bigint, quoteDecimals: number): string => plainDecimal(perUnit, quoteDecimals)

/**
 * The form a ticket opens with: the intent's own terms where it has them, else the first listed expiry and
 * the strike nearest the reference price. Quantity and premium stay empty: the ticket never invents them.
 */
export function initialForm(intent: FormIntent, grid: Grid, referencePerUnit: bigint | null, quoteDecimals: number): TermsForm {
  const middle = grid.ladder.length > 0 ? grid.ladder[Math.floor((grid.ladder.length - 1) / 2)] : null
  const nearest = nearestStrike(referencePerUnit, grid.ladder) ?? middle
  return {
    kind: intent.kind,
    strike: intent.strike ?? (nearest === null ? '' : strikeText(nearest, quoteDecimals)),
    expiry: intent.expiry ?? grid.expiries[0] ?? null,
    qty: intent.qty ?? '',
    premium: intent.premium ?? '',
  }
}

/** The strike of the form as exact units per unit of underlying, or null while it does not parse. */
export const strikeUnitsOf = (form: Pick<TermsForm, 'strike'>, quoteDecimals: number): bigint | null => parseAmount(form.strike, quoteDecimals)

/** True when the form's strike and expiry are both on the standard grid. */
export function isOnGrid(form: Pick<TermsForm, 'strike' | 'expiry'>, grid: Grid, quoteDecimals: number): boolean {
  const k = strikeUnitsOf(form, quoteDecimals)
  return k !== null && grid.ladder.includes(k) && form.expiry !== null && grid.expiries.includes(form.expiry)
}

export type Draft = { ok: true; offer: NewOffer } | { ok: false; error: string; field: FormField }

/** Which field a validator message is about, so it can be shown under that field. */
export function fieldOfError(message: string): FormField {
  if (message.startsWith('Quantity') || message.startsWith('Strike ×')) return 'qty'
  if (message.startsWith('Strike')) return 'strike'
  if (message.startsWith('Premium')) return 'premium'
  return 'expiry'
}

/**
 * The offer (or bid: same terms) the form describes, or the first thing wrong with it. Blank fields get a
 * plain request; everything else is `buildOffer` of core/maker, the one validator: positive amounts, an exact
 * strike times quantity, an expiry in the future and within two years.
 */
export function draftOf(form: TermsForm, underlying: TokenInfo, assets: SupportedAssets): Draft {
  if (form.qty.trim() === '') return { ok: false, field: 'qty', error: `Enter a quantity of ${underlying.code}.` }
  if (form.strike.trim() === '') return { ok: false, field: 'strike', error: 'Pick a strike.' }
  if (form.premium.trim() === '') return { ok: false, field: 'premium', error: `Enter the premium in ${assets.quote.code}.` }
  if (form.expiry === null) return { ok: false, field: 'expiry', error: 'Pick an expiry, or enter a date and a time in UTC.' }
  const built = buildOffer(assets, {
    kind: form.kind,
    underlyingId: underlying.contractId,
    qty: form.qty,
    strike: form.strike,
    premium: form.premium,
    expiry: new Date(form.expiry * 1000).toISOString(),
  })
  if ('error' in built) return { ok: false, field: fieldOfError(built.error), error: withStop(built.error) }
  return { ok: true, offer: built.offer }
}

/** Validator messages come without a full stop; sentences on screen end with one. */
const withStop = (message: string): string => (/[.?]$/.test(message) ? message : `${message}.`)

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(\d{1,2}):(\d{2})$/

/** `2026-12-18` and `08:00`, read as UTC, to unix seconds. Null when either does not parse or the day does not exist. */
export function parseUtcDateTime(date: string, time: string): number | null {
  const d = DATE.exec(date.trim())
  const t = TIME.exec(time.trim())
  if (!d || !t) return null
  const [y, mo, day, h, mi] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2])]
  if (h > 23 || mi > 59) return null
  const ms = Date.UTC(y, mo - 1, day, h, mi, 0)
  const back = new Date(ms)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== day) return null
  return ms / 1000
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** The two custom fields for a timestamp: `2026-12-18` and `08:00` (UTC). */
export function utcDateTimeFields(ts: number): { date: string; time: string } {
  const d = new Date(ts * 1000)
  return {
    date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
    time: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`,
  }
}

/** The second line of an expiry chip: whole days from one day up (`9 d`), else the countdown (`3 h 12 min`). */
export function chipCountdown(secondsLeft: number): string {
  return secondsLeft >= DAY_SECONDS ? `${Math.floor(secondsLeft / DAY_SECONDS)} d` : formatCountdown(secondsLeft)
}

const sameDecimal = (a: string, b: string, decimals: number): boolean => {
  const [x, y] = [parseAmount(a, decimals), parseAmount(b, decimals)]
  return x !== null && y !== null ? x === y : a === b
}

/**
 * What the form takes over when the URL changes under it (another cell of the chain was chosen): every field the
 * intent carries and that differs from the form. An echo of the form's own terms differs in nothing. The expiry
 * is compared by its UTC day, the precision of the URL, so a custom time of day survives its own echo. A field
 * the intent does not carry is left alone: the URL never clears what was typed.
 */
export function takeOver(form: TermsForm, intent: FormIntent, decimals: { underlying: number; quote: number }): Partial<TermsForm> | null {
  const patch: Partial<TermsForm> = {}
  if (intent.kind !== form.kind) patch.kind = intent.kind
  if (intent.strike !== undefined && !sameDecimal(intent.strike, form.strike, decimals.quote)) patch.strike = intent.strike
  if (intent.expiry !== undefined && (form.expiry === null || expiryDayKey(intent.expiry) !== expiryDayKey(form.expiry))) patch.expiry = intent.expiry
  if (intent.qty !== undefined && !sameDecimal(intent.qty, form.qty, decimals.underlying)) patch.qty = intent.qty
  if (intent.premium !== undefined && !sameDecimal(intent.premium, form.premium, decimals.quote)) patch.premium = intent.premium
  return Object.keys(patch).length > 0 ? patch : null
}
