/**
 * Search params of the app routes. The field names are a contract between the router and the features:
 * do not rename them. Every field is optional; invalid values are dropped, never thrown.
 *
 * The router keeps every value a plain string in the URL (`?mode=chain&strike=10.00`, no JSON), so a decimal
 * keeps its trailing zeros and an id never passes through a float. The valibot schemas below are the runtime
 * side of the types: `router.tsx` validates with them, and `search.test.ts` holds both in step.
 */
import * as v from 'valibot'

export type Intent = 'floor' | 'earn-hold' | 'earn-buy' | 'lock-buy'

/** /markets/$asset */
export type AssetSearch = {
  mode?: 'guided' | 'chain'
  tab?: 'trade' | 'requests' | 'about'
  intent?: Intent
  /** UTC day of the expiry, YYYY-MM-DD. */
  expiry?: string
  kind?: 'put' | 'call'
  /** Decimal string: quote units for one whole underlying unit. */
  strike?: string
  /** Decimal string: underlying units. */
  qty?: string
  /** Decimal string: total premium in quote units. */
  premium?: string
  side?: 'buy' | 'write' | 'bid'
  /** Option id of an open offer (decimal string). */
  offer?: string
  /** Bid id (decimal string). */
  bid?: string
  /** Option id of a resale listing (decimal string). */
  ask?: string
  step?: 'terms' | 'review'
}

/** /markets */
export type MarketsSearch = { all?: '1'; intent?: Intent }

/** /portfolio */
export type PortfolioSearch = { tab?: 'holding' | 'written' | 'orders'; closed?: '1' }

/** /portfolio/$id */
export type PositionSearch = { do?: 'exercise' | 'claim' | 'reclaim' | 'sell' | 'cancel' }

/** /requests */
export type RequestsSearch = {
  asset?: string
  kind?: 'put' | 'call'
  sort?: 'premium' | 'deadline'
  /** Open the fill ticket for this bid id. */
  bid?: string
  /** Open the bid ticket. */
  new?: '1'
  mine?: '1'
}

// ---------------------------------------------------------------------------------------------------------
// Runtime schemas. A field that fails its check falls back to `undefined`: the rest of the link still works.
// ---------------------------------------------------------------------------------------------------------

const INTENTS = ['floor', 'earn-hold', 'earn-buy', 'lock-buy'] as const
const KINDS = ['put', 'call'] as const

/** One of a fixed set of words. */
const word = <const T extends readonly [string, ...string[]]>(values: T) => v.fallback(v.optional(v.picklist(values)), undefined)

/** A string that passes `check`. */
const text = (check: (value: string) => boolean) => v.fallback(v.optional(v.pipe(v.string(), v.check(check))), undefined)

/** The flag value `1`. Anything else means "off" and is dropped. */
const flag = v.fallback(v.optional(v.literal('1')), undefined)

/**
 * A non-negative decimal as a user types it: digits, at most one point, at most 7 decimals (the Stellar
 * maximum) and 19 integer digits. `10`, `10.00` and `0.36` pass; `1e3`, `-1`, `.5` and `1,000` do not. The
 * string is kept as typed: features parse it with the asset's own decimals.
 */
export const isDecimalParam = (value: string): boolean => /^\d{1,19}(\.\d{1,7})?$/.test(value)

/** An id as the contract prints it: a u64 in decimal, no sign, no leading zero. */
export const isIdParam = (value: string): boolean => /^(0|[1-9]\d{0,19})$/.test(value) && BigInt(value) <= 0xffff_ffff_ffff_ffffn

/** A real UTC calendar day, `YYYY-MM-DD`. */
export function isDayParam(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

/**
 * An asset as a link names it: a slug of the reference list (`bond`), `CODE-ISSUER`, or a contract id. The shape
 * only is checked here; `core/assets` resolves it.
 */
export const isAssetParam = (value: string): boolean => /^[A-Za-z0-9-]{1,80}$/.test(value)

const decimal = text(isDecimalParam)
const id = text(isIdParam)

export const AssetSearchSchema = v.object({
  mode: word(['guided', 'chain']),
  tab: word(['trade', 'requests', 'about']),
  intent: word(INTENTS),
  expiry: text(isDayParam),
  kind: word(KINDS),
  strike: decimal,
  qty: decimal,
  premium: decimal,
  side: word(['buy', 'write', 'bid']),
  offer: id,
  bid: id,
  ask: id,
  step: word(['terms', 'review']),
})

export const MarketsSearchSchema = v.object({ all: flag, intent: word(INTENTS) })

export const PortfolioSearchSchema = v.object({ tab: word(['holding', 'written', 'orders']), closed: flag })

export const PositionSearchSchema = v.object({ do: word(['exercise', 'claim', 'reclaim', 'sell', 'cancel']) })

export const RequestsSearchSchema = v.object({
  asset: text(isAssetParam),
  kind: word(KINDS),
  sort: word(['premium', 'deadline']),
  bid: id,
  new: flag,
  mine: flag,
})

type AnyObjectSchema = v.ObjectSchema<v.ObjectEntries, undefined>

/**
 * Runs a schema over the raw search of a location. The result names every field that the link carried: a valid
 * one with its value, an invalid one as `undefined`, so that a bad value can never reach a page through the
 * router's merge of raw and validated search. Fields the link did not carry are left out.
 */
function validate<TSchema extends AnyObjectSchema>(schema: TSchema, raw: Record<string, unknown>): v.InferOutput<TSchema> {
  const parsed = v.safeParse(schema, raw)
  const values: Record<string, unknown> = parsed.success ? (parsed.output as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(schema.entries)) {
    if (values[key] !== undefined) out[key] = values[key]
    else if (key in raw) out[key] = undefined
  }
  return out as v.InferOutput<TSchema>
}

export const validateAssetSearch = (raw: Record<string, unknown>): AssetSearch => validate(AssetSearchSchema, raw)
export const validateMarketsSearch = (raw: Record<string, unknown>): MarketsSearch => validate(MarketsSearchSchema, raw)
export const validatePortfolioSearch = (raw: Record<string, unknown>): PortfolioSearch => validate(PortfolioSearchSchema, raw)
export const validatePositionSearch = (raw: Record<string, unknown>): PositionSearch => validate(PositionSearchSchema, raw)
export const validateRequestsSearch = (raw: Record<string, unknown>): RequestsSearch => validate(RequestsSearchSchema, raw)

// ---------------------------------------------------------------------------------------------------------
// The URL form. Plain `key=value` pairs, values kept as strings.
// ---------------------------------------------------------------------------------------------------------

/** `?mode=chain&strike=10.00` as `{ mode: 'chain', strike: '10.00' }`. A repeated key keeps its last value. */
export function parseSearch(searchStr: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of new URLSearchParams(searchStr)) out[key] = value
  return out
}

/** The inverse: empty, `undefined` and `null` values are left out; no pairs gives an empty string. */
export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const key of Object.keys(search)) {
    const value = search[key]
    if (value === undefined || value === null || value === '') continue
    params.set(key, typeof value === 'string' ? value : String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}
