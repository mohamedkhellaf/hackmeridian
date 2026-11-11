// What is re-read before a claim, a reclaim, a cancel or the withdrawal of a listing is signed, and what it
// means. Pure. Same rules as core/options/preTrade: a read that is still running says "Checking", a read that
// failed is "unknown" and never blocks, because the contract is the final check.
import { formatMoney } from '../../../core/format'
import type { Fact, PreTradeLine } from '../../../core/options/preTrade'
import { requiredCollateral } from '../../../core/options/types'
import type { OptionOffer } from '../../../core/options/types'
import { claimAmount } from '../../../core/portfolio/positions'
import type { Bid } from '../../../core/requests/types'

export type SimpleAction = 'claim' | 'reclaim' | 'cancel' | 'unlist'

export interface SimpleFacts {
  me: string | null
  nowSec: number
  /** The option re-read from the chain. */
  option: Fact<OptionOffer>
  /** `unlist`: the live ask of the option, null when it is not listed. */
  ask?: Fact<bigint | null>
  /** `claim` of a put: the issuer has authorized this account to hold the underlying. */
  eligible?: Fact<boolean>
}

export interface SimpleCheck {
  lines: PreTradeLine[]
  /** The action cannot go ahead. */
  blocked: boolean
  /** Some reads are still running. */
  pending: boolean
  /** Cause, consequence and fix, when blocked. */
  problem: string | null
}

const CHECKING = 'Checking'
const NOT_CHECKED = 'Could not re-check. The contract refuses the call if the option has changed.'
const CHANGED = 'This option changed since the page was read. Close this and look at the position again.'

const line = (label: string, status: PreTradeLine['status'], text: string): PreTradeLine => ({ label, status, text })

interface Verdict {
  ok: boolean
  text: string
  problem?: string
}

function verdict(action: SimpleAction, o: OptionOffer, f: SimpleFacts): Verdict {
  const mine = f.me !== null
  switch (action) {
    case 'claim':
      if (o.state === 'exercised' && mine && o.writer === f.me) return { ok: true, text: `Exercised. ${formatMoney(claimAmount(o).amount, claimAmount(o).token)} in the contract` }
      if (o.state === 'settled') return { ok: false, text: 'Already claimed', problem: 'This delivery was already claimed. Nothing is left in the contract for this option.' }
      return { ok: false, text: 'Nothing to claim', problem: CHANGED }
    case 'reclaim': {
      const c = requiredCollateral(o)
      if (o.state === 'expired' && mine && o.writer === f.me) return { ok: true, text: `Expired. ${formatMoney(c.amount, c.token)} in the contract` }
      if (o.state === 'reclaimed') return { ok: false, text: 'Already reclaimed', problem: 'This collateral was already reclaimed. Nothing is left in the contract for this option.' }
      if (o.state === 'offered' || o.state === 'active') {
        return { ok: false, text: 'Not expired on the ledger yet', problem: 'The ledger has not passed the deadline yet. Wait for the next ledger, then reclaim.' }
      }
      return { ok: false, text: 'Nothing to reclaim', problem: CHANGED }
    }
    case 'cancel':
      if (o.state === 'offered' && o.expiry > f.nowSec && mine && o.writer === f.me) return { ok: true, text: 'Open, no buyer' }
      if (o.state === 'active' || o.state === 'exercised' || o.state === 'settled') {
        return { ok: false, text: 'Sold', problem: 'A buyer took this offer before the cancellation. It is now a sold option under Written.' }
      }
      if (o.state === 'expired' || (o.state === 'offered' && o.expiry <= f.nowSec)) {
        return { ok: false, text: 'Expired', problem: 'This offer has expired. Reclaim the collateral instead.' }
      }
      if (o.state === 'cancelled') return { ok: false, text: 'Already cancelled', problem: 'This offer was already cancelled. The collateral went back to your wallet.' }
      return { ok: false, text: 'No longer an open offer', problem: CHANGED }
    case 'unlist':
      if (o.state === 'active' && o.expiry > f.nowSec && mine && o.holder === f.me) return { ok: true, text: 'Active, held by you' }
      return { ok: false, text: 'No longer yours to list', problem: 'This option is no longer listed by you: it was sold, exercised or has expired.' }
  }
}

/** Evaluates one of the four simple actions against what was re-read. */
export function simpleCheck(action: SimpleAction, snapshot: OptionOffer, f: SimpleFacts): SimpleCheck {
  const lines: PreTradeLine[] = []
  let blocked = false
  let pending = false
  let problem: string | null = null
  const block = (text: string) => {
    blocked = true
    problem ??= text
  }

  if (f.option === undefined) {
    pending = true
    lines.push(line('Option', 'pending', CHECKING))
  } else if (f.option === 'unknown') {
    lines.push(line('Option', 'unknown', NOT_CHECKED))
  } else {
    const v = verdict(action, f.option, f)
    lines.push(line('Option', v.ok ? 'ok' : 'fail', v.text))
    if (!v.ok) block(v.problem ?? CHANGED)
  }

  if (action === 'unlist') {
    const q = snapshot.quote
    if (f.ask === undefined) {
      pending = true
      lines.push(line('Listing', 'pending', CHECKING))
    } else if (f.ask === 'unknown') {
      lines.push(line('Listing', 'unknown', 'Could not re-check'))
    } else if (f.ask === null) {
      lines.push(line('Listing', 'fail', 'No longer listed'))
      block('This option is no longer listed: it was sold, exercised or the listing was already cancelled.')
    } else {
      lines.push(line('Listing', 'ok', `For sale at ${formatMoney(f.ask, q)}`))
    }
  }

  // A put writer receives the underlying: the issuer must have authorized the account to hold it.
  if (action === 'claim' && snapshot.kind === 'put') {
    const code = snapshot.underlying.code
    if (f.eligible === undefined) {
      pending = true
      lines.push(line('Your account', 'pending', CHECKING))
    } else if (f.eligible === 'unknown') {
      lines.push(line('Your account', 'unknown', 'Could not check'))
    } else if (f.eligible) {
      lines.push(line('Your account', 'ok', `Authorized by the ${code} issuer`))
    } else {
      lines.push(line('Your account', 'fail', `Not authorized by the ${code} issuer`))
      block(`The ${code} issuer has not authorized your account, so the contract cannot deliver ${code} to it. The delivery stays in the contract until the issuer authorizes you.`)
    }
  }

  return { lines, blocked, pending: f.me !== null && pending, problem }
}

export interface BidFacts {
  me: string | null
  bid: Fact<Bid>
}

/** The same re-check for the withdrawal of a request: it must still hold the escrowed premium. */
export function cancelBidCheck(f: BidFacts): SimpleCheck {
  if (f.bid === undefined) return { lines: [line('Request', 'pending', CHECKING)], blocked: false, pending: f.me !== null, problem: null }
  if (f.bid === 'unknown') return { lines: [line('Request', 'unknown', 'Could not re-check. The contract refuses the call if the request has changed.')], blocked: false, pending: false, problem: null }
  const b = f.bid
  if ((b.state === 'open' || b.state === 'expired') && f.me !== null && b.buyer === f.me) {
    const escrow = formatMoney(b.totalPremium, b.quote)
    return { lines: [line('Request', 'ok', b.state === 'open' ? `Open. ${escrow} escrowed` : `Expired. ${escrow} escrowed`)], blocked: false, pending: false, problem: null }
  }
  if (b.state === 'filled') {
    return { lines: [line('Request', 'fail', 'Filled')], blocked: true, pending: false, problem: 'A maker filled this request before the cancellation. You now hold the option: it is under Holding.' }
  }
  return {
    lines: [line('Request', 'fail', 'Already refunded')],
    blocked: true,
    pending: false,
    problem: 'This request was already cancelled or refunded. Nothing is escrowed for it any more.',
  }
}
