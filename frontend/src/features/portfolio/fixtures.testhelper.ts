// Shared fixtures of the portfolio unit tests: one put and one call on FUND against USDx, seen from a wallet ME.
import type { OptionOffer, TokenInfo } from '../../core/options/types'
import type { ReferencePrice } from '../../core/reference'
import type { Bid } from '../../core/requests/types'
import { buildPositions, buildTodo, positionView } from '../../data/derived/positions'
import type { PositionView, TodoView } from '../../data'

export const U = 10_000_000n
export const USDX: TokenInfo = { contractId: 'C_Q', code: 'USDx', decimals: 7 }
export const FUND: TokenInfo = { contractId: 'C_F', code: 'FUND', decimals: 7 }
export const ME = 'GME'
export const MAKER = 'GMAKER'
export const NOW = 1_800_000_000
export const DAY = 86_400

/** A put on 5.00 FUND at 10.00, premium 1.80, written by MAKER and held by ME, with 8 days left. */
export const opt = (over: Partial<OptionOffer> = {}): OptionOffer => ({
  id: 184n,
  kind: 'put',
  underlying: FUND,
  quote: USDX,
  underlyingQty: 5n * U,
  totalStrike: 50n * U,
  totalPremium: (18n * U) / 10n,
  expiry: NOW + 8 * DAY,
  writer: MAKER,
  holder: ME,
  state: 'active',
  ...over,
})

export const bid = (over: Partial<Bid> = {}): Bid => ({
  id: 3n,
  buyer: ME,
  kind: 'put',
  underlying: FUND,
  quote: USDX,
  underlyingQty: 5n * U,
  totalStrike: 50n * U,
  totalPremium: 2n * U,
  expiry: NOW + 8 * DAY,
  state: 'open',
  optionId: null,
  ...over,
})

/** A demo reference at `price` USDx per FUND (two decimals: 982 is 9.82). */
export const reference = (cents: number): ReferencePrice => ({ kind: 'demo', perUnit: (BigInt(cents) * U) / 100n, label: 'Demo price', note: 'A fixed figure chosen by the team.', asOf: null })

export const NO_REFERENCE: ReferencePrice = { kind: 'none', perUnit: null, label: 'No reference price', note: 'Set an assumed price to see what an option would pay.', asOf: null }

export function view(o: OptionOffer, ref: ReferencePrice | null = reference(982), me: string = ME, nowSec: number = NOW, asks: { id: bigint; holder: string; askTotal: bigint }[] | null = []): PositionView {
  const v = positionView(o, { asks, me, nowSec, referenceOf: () => ref })
  if (!v) throw new Error('The wallet is on neither side of this option')
  return v
}

export function todo(o: OptionOffer, ref: ReferencePrice | null = reference(982), me: string = ME, nowSec: number = NOW): TodoView {
  const items = buildTodo([o], me, nowSec, () => ref)
  if (items.length !== 1) throw new Error(`Expected one to-do item, got ${items.length}`)
  return items[0]
}

export { buildPositions }
