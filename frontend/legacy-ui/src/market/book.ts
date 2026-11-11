import type { Ask, OptionKind, OptionOffer, TokenInfo } from '../options/types'
import type { Bid } from '../requests/types'

// Two-sided book of one series. Bids are funded buyer requests; offers are funded maker offers and holders' resale
// asks. Every price here is a limit price a user set: nothing is a market quote. Ordering is exact (bigint).

export type BookSource = 'bid' | 'maker' | 'resale'

export interface BookRow {
  key: string
  source: BookSource
  kind: OptionKind
  underlying: TokenInfo
  quote: TokenInfo
  underlyingQty: bigint
  totalStrike: bigint
  /** Bid: premium the buyer escrowed. Maker: premium asked. Resale: the holder's ask. */
  totalPremium: bigint
  expiry: number
  /** Buyer, maker or reselling holder. */
  counterparty: string
  offer?: OptionOffer
  ask?: Ask
  bid?: Bid
}

/** Premium per unit, compared exactly by cross-multiplying. */
export function byPremiumPerUnit(a: BookRow, b: BookRow): number {
  const l = a.totalPremium * b.underlyingQty
  const r = b.totalPremium * a.underlyingQty
  return l < r ? -1 : l > r ? 1 : 0
}

const tie = (a: BookRow, b: BookRow) => a.expiry - b.expiry || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)

/** Bids: highest premium per unit first. Offers (maker and resale merged): lowest first. */
export function sortBook(rows: BookRow[]): { bids: BookRow[]; offers: BookRow[] } {
  const bids = rows.filter((r) => r.source === 'bid').sort((a, b) => byPremiumPerUnit(b, a) || tie(a, b))
  const offers = rows.filter((r) => r.source !== 'bid').sort((a, b) => byPremiumPerUnit(a, b) || tie(a, b))
  return { bids, offers }
}

type Terms = Pick<OptionOffer, 'kind' | 'underlying' | 'quote' | 'underlyingQty' | 'totalStrike' | 'expiry'>
const base = (o: Terms) => ({
  kind: o.kind,
  underlying: o.underlying,
  quote: o.quote,
  underlyingQty: o.underlyingQty,
  totalStrike: o.totalStrike,
  expiry: o.expiry,
})

/** All rows of the book: open maker offers, live resale listings (already joined) and open, unexpired bids. */
export function bookRows(offers: OptionOffer[], resale: { option: OptionOffer; ask: Ask }[], bids: Bid[] | null, nowSec: number): BookRow[] {
  const rows: BookRow[] = offers.map((o) => ({ ...base(o), key: `o${o.id}`, source: 'maker', totalPremium: o.totalPremium, counterparty: o.writer, offer: o }))
  for (const { option, ask } of resale)
    rows.push({ ...base(option), key: `r${option.id}`, source: 'resale', totalPremium: ask.askTotal, counterparty: ask.holder, offer: option, ask })
  for (const b of bids ?? [])
    if (b.state === 'open' && b.expiry > nowSec) rows.push({ ...base(b), key: `b${b.id}`, source: 'bid', totalPremium: b.totalPremium, counterparty: b.buyer, bid: b })
  return rows
}

/** A row in the shape the chain helpers read (kind, tokens, quantities, expiry, writer). Grouping only. */
export function asSample(r: BookRow): OptionOffer {
  return { ...(r.offer ?? {}), ...base(r), totalPremium: r.totalPremium, writer: r.counterparty, id: r.offer?.id ?? r.bid?.id ?? 0n } as OptionOffer
}
