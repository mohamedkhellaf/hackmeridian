// Two of the portfolio totals, as exact sums per token of amounts the data layer already holds per row: what the
// wallet has locked in the contract now (sold options, open offers, open requests) and what it can take back now
// (an exercise's proceeds, an expired option's collateral, an expired request's premium). Nothing is valued.
import type { Money } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import type { PositionsView } from '../../data'

export interface PortfolioTotals {
  /** Collateral of active and offered options, plus premiums escrowed in requests that can still be filled. */
  locked: Money[]
  /** Unclaimed proceeds, collateral of expired options and premiums of expired requests: one action returns each. */
  readyBack: Money[]
}

/** A request whose deadline passed while it was open keeps its premium in the contract until it is cancelled. */
export const requestExpired = (b: Pick<Bid, 'state' | 'expiry'>, nowSec: number): boolean => b.state === 'expired' || (b.state === 'open' && b.expiry <= nowSec)

function adder() {
  const sums = new Map<string, Money>()
  return {
    add: (m: Money | null) => {
      if (!m || m.amount === 0n) return
      const prev = sums.get(m.token.contractId)
      sums.set(m.token.contractId, { token: m.token, amount: (prev?.amount ?? 0n) + m.amount })
    },
    list: (): Money[] => [...sums.values()],
  }
}

export function portfolioTotals(view: PositionsView, nowSec: number): PortfolioTotals {
  const locked = adder()
  const back = adder()
  for (const p of [...view.written, ...view.orders.offers]) {
    if (p.role !== 'writer') continue
    const state = p.option.state
    if (state === 'offered' || state === 'active') locked.add(p.collateral)
    else if (state === 'exercised') back.add(p.claim)
    else if (state === 'expired') back.add(p.collateral)
  }
  for (const b of view.orders.requests) {
    const premium = { token: b.quote, amount: b.totalPremium }
    if (requestExpired(b, nowSec)) back.add(premium)
    else if (b.state === 'open') locked.add(premium)
  }
  return { locked: locked.list(), readyBack: back.list() }
}
