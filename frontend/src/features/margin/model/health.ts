// Where a margin account stands against its two requirements, in words. Every figure is a value of
// get_requirement or the difference of two of them; nothing here is a margin formula.
import type { Requirement } from '../../../core/pro/types'
import { usdx, usdxExact } from './money'

/**
 * liquidatable  account value below the liquidation level (NLV < MM): anyone can take the account over
 * restricted    at or above the liquidation level, below the opening requirement (MM <= NLV < IM)
 * open          at or above the opening requirement
 * unknown       the source has no requirement for this account at this moment
 */
export type HealthState = 'liquidatable' | 'restricted' | 'open' | 'unknown'

export interface Health {
  state: HealthState
  /** |NLV - MM| in exact units; 0 when unknown. */
  distance: bigint
  /** IM - NLV when the account is below the opening requirement, else 0. */
  toOpen: bigint
  /** (NLV - MM) / MM in tenths of a percent, rounded down; null when it has no meaning (MM is 0, or below MM). */
  aboveTenths: bigint | null
}

export function healthOf(req: Requirement | null | undefined): Health {
  if (!req) return { state: 'unknown', distance: 0n, toOpen: 0n, aboveTenths: null }
  const gap = req.nlv - req.mm
  if (gap < 0n) return { state: 'liquidatable', distance: -gap, toOpen: req.im - req.nlv, aboveTenths: null }
  const aboveTenths = req.mm > 0n ? (gap * 1000n) / req.mm : null
  if (req.nlv < req.im) return { state: 'restricted', distance: gap, toOpen: req.im - req.nlv, aboveTenths }
  return { state: 'open', distance: gap, toOpen: 0n, aboveTenths }
}

/** The word for each state. No state is called healthy: an account above both levels can still be liquidated later. */
export const HEALTH_WORD: Record<HealthState, string> = {
  liquidatable: 'Liquidatable',
  restricted: 'Below the opening requirement',
  open: 'Above the opening requirement',
  unknown: 'Requirement not available',
}

/** `55.6 %` from tenths of a percent. */
export function tenthsText(tenths: bigint): string {
  return `${(tenths / 10n).toString()}.${(tenths % 10n).toString()} %`
}

/**
 * The distance to liquidation, the line that leads the account: "20,437.84 USDx below the liquidation level".
 * Truncated like every other figure. `simulated` picks the wording for a missing requirement (a replay step
 * without one, or a failed read).
 */
export function healthLead(h: Health, simulated: boolean): string {
  const share = h.aboveTenths !== null ? ` (${tenthsText(h.aboveTenths)})` : ''
  switch (h.state) {
    case 'liquidatable':
      return `${usdx(h.distance)} USDx below the liquidation level`
    case 'restricted':
    case 'open':
      return `${usdx(h.distance)} USDx above the liquidation level${share}`
    default:
      return simulated ? 'This step of the scenario has no requirement for this account.' : 'The margin requirement could not be read.'
  }
}

/**
 * What it takes to move on, after the state word. An amount the user would have to add is given in full,
 * because a truncated one falls short. Null when there is nothing to add.
 */
export function healthNext(h: Health): string | null {
  switch (h.state) {
    case 'liquidatable':
      return `A deposit of at least ${usdxExact(h.distance)} USDx brings the account value back to the liquidation level.`
    case 'restricted':
      return `A new call needs ${usdxExact(h.toOpen)} USDx more.`
    default:
      return null
  }
}
