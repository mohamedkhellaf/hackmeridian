import { formatDisplay } from '../options/format'
import type { Ask, OptionOffer } from '../options/types'

// Pure resale helpers (contract v1.4). Prices are set by the holder: never a market quote.

/** Ask in quote units per one whole unit of underlying, floored. Display only; settlement uses `askTotal`. */
export function askPerUnit(o: Pick<OptionOffer, 'underlying' | 'underlyingQty'>, askTotal: bigint): bigint | null {
  if (o.underlyingQty <= 0n) return null
  return (askTotal * 10n ** BigInt(o.underlying.decimals)) / o.underlyingQty
}

export function formatAskPerUnit(o: Pick<OptionOffer, 'underlying' | 'quote' | 'underlyingQty'>, askTotal: bigint): string {
  const v = askPerUnit(o, askTotal)
  return v === null ? '–' : formatDisplay(v, o.quote.decimals)
}

/** Active and not yet expired: the only state in which an option can be listed or bought from its holder. */
export const isLive = (o: OptionOffer, nowSec: number) => o.state === 'active' && nowSec < o.expiry

/** The connected wallet holds this option and may list it (contract: holder of an Active, unexpired option). */
export const canList = (o: OptionOffer, me: string | null, nowSec: number) => !!me && o.holder === me && isLive(o, nowSec)

export const askOf = (asks: Ask[] | null, id: bigint): Ask | undefined => asks?.find((a) => a.id === id)

export interface ResaleRow {
  option: OptionOffer
  ask: Ask
}

/** Joins asks with their options; drops asks whose option is unknown, no longer live, or held by someone else. */
export function resaleRows(options: OptionOffer[], asks: Ask[] | null, nowSec: number): ResaleRow[] {
  if (!asks) return []
  const byId = new Map(options.map((o) => [o.id, o]))
  const rows: ResaleRow[] = []
  for (const ask of asks) {
    const option = byId.get(ask.id)
    if (option && isLive(option, nowSec) && option.holder === ask.holder) rows.push({ option, ask })
  }
  return rows.sort((a, b) => (a.option.id < b.option.id ? -1 : a.option.id > b.option.id ? 1 : 0))
}

export type ResaleCheck = 'ok' | 'fail' | 'changed'

/**
 * Pre-trade re-check of a listing against fresh chain reads. `fail`: the option is no longer Active and unexpired,
 * changed hands, or has no ask. `changed`: still for sale by the same holder, at a different price than shown.
 */
export function resaleCheck(fresh: OptionOffer, liveAsk: bigint | null, seen: Ask, nowSec: number): ResaleCheck {
  if (!isLive(fresh, nowSec) || fresh.holder !== seen.holder || liveAsk === null) return 'fail'
  return liveAsk === seen.askTotal ? 'ok' : 'changed'
}

/** Why the connected wallet cannot buy this listing, or null. Mirrors the contract's SelfTrade (111) rule. */
export function selfTradeReason(o: OptionOffer, ask: Ask, me: string | null): string | null {
  if (!me) return null
  if (ask.holder === me) return 'This is your listing.'
  if (o.writer === me) return 'You wrote this option, so you cannot buy it back.'
  return null
}
