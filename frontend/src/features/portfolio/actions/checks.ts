// What is re-read before a claim, a reclaim, a cancel or the withdrawal of a listing is signed, and what it
// means. Pure. Same rules as core/options/preTrade: a read that is still running says "Checking", a read that
// failed is "unknown" and never blocks, because the contract is the final check.
import { clawbackShortfallDisclosure } from '../../../core/disclosures'
import { formatMoney } from '../../../core/format'
import type { Fact, PreTradeLine } from '../../../core/options/preTrade'
import { requiredCollateral } from '../../../core/options/types'
import type { OptionOffer, TokenInfo } from '../../../core/options/types'
import { claimAmount } from '../../../core/portfolio/positions'
import type { Bid } from '../../../core/requests/types'

export type SimpleAction = 'claim' | 'reclaim' | 'cancel' | 'unlist'

/** A status line with, when it passed, the words it adds to the review's one checks sentence. */
export interface CheckLine extends PreTradeLine {
  phrase?: string
}

export interface SimpleFacts {
  me: string | null
  nowSec: number
  /** The option re-read from the chain. */
  option: Fact<OptionOffer>
  /** `unlist`: the live ask of the option, null when it is not listed. */
  ask?: Fact<bigint | null>
  /** `claim` of a put: the issuer has authorized this account to hold the underlying. */
  eligible?: Fact<boolean>
  /** The token this action pays out in, when the contract holds less of it than it owes (an issuer clawback). */
  short?: TokenInfo | null
}

export interface SimpleCheck {
  lines: CheckLine[]
  /** The action cannot go ahead. */
  blocked: boolean
  /** Some reads are still running. */
  pending: boolean
  /** Cause, consequence and fix, when blocked. */
  problem: string | null
  /** Said before the button without blocking: the clawback shortfall sentence when the payout token is short. */
  warning: string | null
}

const CHECKING = 'Checking'
const NOT_CHECKED = 'Could not re-check. The contract refuses the call if the option has changed.'
const CHANGED = 'This option changed since the page was read. Close this and look at the position again.'

const line = (label: string, status: PreTradeLine['status'], text: string, phrase?: string): CheckLine => (phrase ? { label, status, text, phrase } : { label, status, text })

/** The contract's balance of a payout token that is short: a line that fails without blocking, and the sentence. */
const SHORT_LABEL = 'Contract balance'
const shortLine = (token: TokenInfo): CheckLine => line(SHORT_LABEL, 'fail', `Holds less ${token.code} than it owes`)

interface Verdict {
  ok: boolean
  text: string
  /** For a line that passed: its words in the checks sentence. */
  phrase?: string
  problem?: string
}

function verdict(action: SimpleAction, o: OptionOffer, f: SimpleFacts): Verdict {
  const mine = f.me !== null
  // While the payout token is short the contract may not hold the amount: the line says the state alone.
  const short = !!f.short
  switch (action) {
    case 'claim':
      if (o.state === 'exercised' && mine && o.writer === f.me) {
        const waiting = formatMoney(claimAmount(o).amount, claimAmount(o).token)
        return short
          ? { ok: true, text: 'Exercised', phrase: 'the option is exercised' }
          : { ok: true, text: `Exercised. ${waiting} in the contract`, phrase: `the option is exercised and ${waiting} waits in the contract` }
      }
      if (o.state === 'settled') return { ok: false, text: 'Already claimed', problem: 'This delivery was already claimed. Nothing is left in the contract for this option.' }
      return { ok: false, text: 'Nothing to claim', problem: CHANGED }
    case 'reclaim': {
      const c = requiredCollateral(o)
      if (o.state === 'expired' && mine && o.writer === f.me) {
        const waiting = formatMoney(c.amount, c.token)
        return short
          ? { ok: true, text: 'Expired', phrase: 'the option has expired' }
          : { ok: true, text: `Expired. ${waiting} in the contract`, phrase: `the option has expired and ${waiting} waits in the contract` }
      }
      if (o.state === 'reclaimed') return { ok: false, text: 'Already reclaimed', problem: 'This collateral was already reclaimed. Nothing is left in the contract for this option.' }
      if (o.state === 'offered' || o.state === 'active') {
        return { ok: false, text: 'Not expired on the ledger yet', problem: 'The ledger has not passed the deadline yet. Wait for the next ledger, then reclaim.' }
      }
      return { ok: false, text: 'Nothing to reclaim', problem: CHANGED }
    }
    case 'cancel':
      if (o.state === 'offered' && o.expiry > f.nowSec && mine && o.writer === f.me) return { ok: true, text: 'Open, no buyer', phrase: 'the offer is open with no buyer' }
      if (o.state === 'active' || o.state === 'exercised' || o.state === 'settled') {
        return { ok: false, text: 'Sold', problem: 'A buyer took this offer before the cancellation. It is now a sold option under Written.' }
      }
      if (o.state === 'expired' || (o.state === 'offered' && o.expiry <= f.nowSec)) {
        return { ok: false, text: 'Expired', problem: 'This offer has expired. Reclaim the collateral instead.' }
      }
      if (o.state === 'cancelled') return { ok: false, text: 'Already cancelled', problem: 'This offer was already cancelled. The collateral went back to your wallet.' }
      return { ok: false, text: 'No longer an open offer', problem: CHANGED }
    case 'unlist':
      if (o.state === 'active' && o.expiry > f.nowSec && mine && o.holder === f.me) return { ok: true, text: 'Active, held by you', phrase: 'you hold the option and it is active' }
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
    lines.push(line('Option', v.ok ? 'ok' : 'fail', v.text, v.ok ? v.phrase : undefined))
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
      lines.push(line('Listing', 'ok', `For sale at ${formatMoney(f.ask, q)}`, `it is for sale at ${formatMoney(f.ask, q)}`))
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
      lines.push(line('Your account', 'ok', `Authorized by the ${code} issuer`, `the ${code} issuer has authorized your account`))
    } else {
      lines.push(line('Your account', 'fail', `Not authorized by the ${code} issuer`))
      block(`The ${code} issuer has not authorized your account, so the contract cannot deliver ${code} to it. The delivery stays in the contract until the issuer authorizes you.`)
    }
  }

  let warning: string | null = null
  if (f.short && action !== 'unlist') {
    lines.push(shortLine(f.short))
    warning = clawbackShortfallDisclosure(f.short.code)
  }

  return { lines, blocked, pending: f.me !== null && pending, problem, warning }
}

export interface BidFacts {
  me: string | null
  bid: Fact<Bid>
  /** The premium's token, when the contract holds less of it than it owes. */
  short?: TokenInfo | null
}

/** The same re-check for the withdrawal of a request: it must still hold the escrowed premium. */
export function cancelBidCheck(f: BidFacts): SimpleCheck {
  const short = f.short ?? null
  const withShort = (c: Omit<SimpleCheck, 'warning'>): SimpleCheck =>
    short && !c.blocked ? { ...c, lines: [...c.lines, shortLine(short)], warning: clawbackShortfallDisclosure(short.code) } : { ...c, warning: null }
  if (f.bid === undefined) return withShort({ lines: [line('Request', 'pending', CHECKING)], blocked: false, pending: f.me !== null, problem: null })
  if (f.bid === 'unknown') return withShort({ lines: [line('Request', 'unknown', 'Could not re-check. The contract refuses the call if the request has changed.')], blocked: false, pending: false, problem: null })
  const b = f.bid
  if ((b.state === 'open' || b.state === 'expired') && f.me !== null && b.buyer === f.me) {
    const escrow = formatMoney(b.totalPremium, b.quote)
    const word = b.state === 'open' ? 'Open' : 'Expired'
    const state = b.state === 'open' ? 'the request is open' : 'the request has expired'
    return withShort({
      lines: [line('Request', 'ok', short ? word : `${word}. ${escrow} escrowed`, short ? state : `${state} and ${escrow} is escrowed`)],
      blocked: false,
      pending: false,
      problem: null,
    })
  }
  if (b.state === 'filled') {
    return withShort({ lines: [line('Request', 'fail', 'Filled')], blocked: true, pending: false, problem: 'A maker filled this request before the cancellation. You now hold the option: it is under Holding.' })
  }
  return withShort({
    lines: [line('Request', 'fail', 'Already refunded')],
    blocked: true,
    pending: false,
    problem: 'This request was already cancelled or refunded. Nothing is escrowed for it any more.',
  })
}

/**
 * The words of a passed status line in the checks sentence. Lines of this module carry their own; the exercise's
 * lines come from core/options/preTrade, whose texts are short labels ("Active"; "120.00 FUND" under "FUND balance").
 */
export function passedPhrase(l: CheckLine): string {
  if (l.phrase) return l.phrase
  if (l.label === 'Option') return `the option is ${l.text.toLowerCase()}`
  const issuer = /^Authorized by the (.+) issuer$/.exec(l.text)
  if (issuer) return `the ${issuer[1]} issuer has authorized your account`
  if (/ balance$/.test(l.label)) return `you hold ${l.text}`
  return `${l.label.toLowerCase()}: ${l.text}`
}

/** The passed lines as one sentence with the time of the read: "Read from the contract at 14:32:16 UTC: ...". */
export function checksSentence(at: string | null, lines: readonly CheckLine[]): string | null {
  const parts = lines.filter((l) => l.status === 'ok').map(passedPhrase)
  if (parts.length === 0) return null
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return at ? `Read from the contract at ${at}: ${list}.` : `Read from the contract: ${list}.`
}

/** `14:32:16 UTC`, the time of a read, for the checks sentence. Null before the first read. */
export const readTime = (ms: number | null | undefined): string | null => (ms && ms > 0 ? `${new Date(ms).toISOString().slice(11, 19)} UTC` : null)
