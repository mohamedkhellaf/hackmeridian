// What the order ticket is asked to do, and how that maps to the search params of the asset route.
// Pure: no React. The types here are the public contract of the feature (re-exported by index.tsx).
import type { AssetSearch } from '../../app/search'
import { expiryDayKey, expiryFromDayKey } from '../../core/series'

export type TicketIntent =
  | { mode: 'buy'; offerId: bigint }
  | { mode: 'write'; assetId: string; kind: 'put' | 'call'; strike?: string; expiry?: number; qty?: string; premium?: string }
  | { mode: 'bid'; assetId: string; kind: 'put' | 'call'; strike?: string; expiry?: number; qty?: string; premium?: string }
  | { mode: 'fill'; bidId: bigint }
  | { mode: 'buy-resale'; optionId: bigint }
  | { mode: 'list'; optionId: bigint }

export type TicketMode = TicketIntent['mode']

/** The two modes that carry a form of terms. */
export type FormIntent = Extract<TicketIntent, { mode: 'write' | 'bid' }>

/** Ids travel as decimal strings. Anything else is not an id. */
const ID = /^\d{1,20}$/

export function parseId(text: string | undefined): bigint | null {
  return text !== undefined && ID.test(text) ? BigInt(text) : null
}

/** A decimal as the user typed it: digits with at most one point. */
const DECIMAL = /^\d+(?:\.\d*)?$/

const decimal = (text: string | undefined): string | undefined => (text !== undefined && DECIMAL.test(text) ? text : undefined)

/**
 * The ticket an asset URL asks for, or null when it asks for none.
 *
 * - `side=write` and `side=bid` open the two forms, prefilled from `kind`, `strike`, `expiry`, `qty` and `premium`.
 * - Otherwise an id opens its ticket: `offer` buys that offer, `ask` buys that resale listing, `bid` fills that request.
 * - `side=buy` alone names no offer, so it opens nothing: the page picks the offer and sets `offer`.
 */
export function ticketIntentFromSearch(search: AssetSearch, assetId: string): TicketIntent | null {
  if (search.side === 'write' || search.side === 'bid') {
    const intent: FormIntent = { mode: search.side, assetId, kind: search.kind ?? 'put' }
    const strike = decimal(search.strike)
    const qty = decimal(search.qty)
    const premium = decimal(search.premium)
    const expiry = search.expiry === undefined ? null : expiryFromDayKey(search.expiry)
    if (strike !== undefined) intent.strike = strike
    if (expiry !== null) intent.expiry = expiry
    if (qty !== undefined) intent.qty = qty
    if (premium !== undefined) intent.premium = premium
    return intent
  }
  const offerId = parseId(search.offer)
  if (offerId !== null) return { mode: 'buy', offerId }
  const optionId = parseId(search.ask)
  if (optionId !== null) return { mode: 'buy-resale', optionId }
  const bidId = parseId(search.bid)
  if (bidId !== null) return { mode: 'fill', bidId }
  return null
}

/** Every key the ticket owns in the asset search, cleared. */
const CLOSED: Partial<AssetSearch> = { side: undefined, offer: undefined, bid: undefined, ask: undefined }

/**
 * The inverse of `ticketIntentFromSearch`, as a patch for `navigate({ search })`: keys the intent does not use
 * are `undefined`, so merging the patch removes them. `null` closes the ticket and leaves the series selection
 * (`kind`, `strike`, `expiry`) alone. A `list` intent has no place on the asset route and maps to a closed ticket.
 *
 * The expiry travels as its UTC day, so a custom time of day does not survive the URL: the form keeps it.
 */
export function searchFromTicketIntent(intent: TicketIntent | null): Partial<AssetSearch> {
  if (intent === null) return { ...CLOSED }
  switch (intent.mode) {
    case 'buy':
      return { ...CLOSED, side: 'buy', offer: intent.offerId.toString() }
    case 'buy-resale':
      return { ...CLOSED, side: 'buy', ask: intent.optionId.toString() }
    case 'fill':
      return { ...CLOSED, bid: intent.bidId.toString() }
    case 'write':
    case 'bid':
      return {
        ...CLOSED,
        side: intent.mode,
        kind: intent.kind,
        strike: intent.strike,
        expiry: intent.expiry === undefined ? undefined : expiryDayKey(intent.expiry),
        qty: intent.qty,
        premium: intent.premium,
      }
    case 'list':
      return { ...CLOSED }
  }
}

/**
 * Identity of a ticket for React: a new key starts a new flow (step, consent and transaction state are dropped).
 * The terms of a form are not part of it, so typing or choosing a strike never restarts the flow.
 */
export function intentKey(intent: TicketIntent): string {
  switch (intent.mode) {
    case 'buy':
      return `buy:${intent.offerId}`
    case 'buy-resale':
      return `buy-resale:${intent.optionId}`
    case 'fill':
      return `fill:${intent.bidId}`
    case 'list':
      return `list:${intent.optionId}`
    case 'write':
    case 'bid':
      return `${intent.mode}:${intent.assetId}`
  }
}
