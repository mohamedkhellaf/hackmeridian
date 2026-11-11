// The pre-trade re-check, in one place. Before a wallet is asked to sign, the app re-reads what the trade depends
// on and tells the user, with exact figures, what would go wrong. The old UI repeated this in five dialogs; this
// module is the single, pure version: `preTrade(action, facts)` returns the issues, the three status lines of a
// review step and the amounts that move. `readPreTradeFacts` gathers the facts from a client in one go; the data
// layer can also feed it from cached queries.
//
// Rules carried over from the old dialogs:
//   - a read that failed is "unknown" and never blocks: the contract is the final check;
//   - an issue either blocks the action or is a warning the user can go past;
//   - messages give the cause, the consequence and the fix, with exact amounts, and no contract error names.
import { clawbackShortfallDisclosure } from '../disclosures'
import { lowestOpenInSeries } from '../maker/lowestOffer'
import { optionMoneyness, priceOf } from '../reference/moneyness'
import type { PriceInput } from '../reference/moneyness'
import type { Bid, NewBid } from '../requests/types'
import { MAX_OPEN_BIDS_PER_BUYER } from '../requests/types'
import { resaleCheck, selfTradeReason } from '../resale/resale'
import { shortfallFor } from '../reserves/reserves'
import type { BalanceStatus } from '../stellar/tokens'
import { amt, shortBy } from '../units'
import { deliveryAmount } from './abi'
import type { OptionsClient } from './client'
import { exerciseFeasibility, implausibleTerms } from './feasibility'
import type { BalanceView } from './feasibility'
import { MAX_OPEN_PER_WRITER, requiredCollateral } from './types'
import type { Ask, CollateralHealth, Money, NewOffer, OptionOffer, TokenInfo } from './types'

/** A value read from the chain: `undefined` while it is being read, `'unknown'` when the read failed. */
export type Fact<T> = T | 'unknown' | undefined

export type PreTradeAction =
  /** Buy a maker's funded offer. */
  | { type: 'buy'; offer: OptionOffer }
  /** Buy an option from its holder at the ask the buyer saw. */
  | { type: 'buy-resale'; option: OptionOffer; ask: Ask }
  /** Fill a buyer's funded request: lock the collateral, receive the premium. */
  | { type: 'fill-bid'; bid: Bid }
  /** Write a new offer (the terms come from `buildOffer`). */
  | { type: 'write-offer'; offer: NewOffer; quote: TokenInfo }
  /** Post a funded request (bid) and escrow its premium. */
  | { type: 'post-bid'; bid: NewBid; quote: TokenInfo }
  /** Exercise a held option. */
  | { type: 'exercise'; option: OptionOffer }
  /** List a held option for sale, or change its price. `askTotal` is null while the price field does not parse. */
  | { type: 'list-for-sale'; option: OptionOffer; askTotal: bigint | null }

export interface PreTradeFacts {
  /** Connected address, or null for a guest. */
  me: string | null
  /** Unix seconds. Expiry on chain is decided by ledger close time, which can run a little ahead of this. */
  nowSec: number
  /** The option re-read from the chain (buy, buy-resale, exercise, list-for-sale). */
  option?: Fact<OptionOffer>
  /** The live ask of the option, null when it is not listed (buy-resale). */
  liveAsk?: Fact<bigint | null>
  /** The request re-read from the chain (fill-bid). */
  bid?: Fact<Bid>
  /** `is_eligible(underlying, me)`: the issuer has authorized this account. */
  eligible?: Fact<boolean>
  /** Balances by token contract id. A token that is missing has not been read. */
  balances?: Record<string, BalanceView>
  /** Reserved against held per token. Empty when unknown. */
  health?: CollateralHealth[]
  /** Open offers of this writer; null when the contract has no cap (write-offer). */
  writerOpenCount?: Fact<number | null>
  /** Open requests of this buyer; null when the contract has no requests (post-bid). */
  buyerOpenCount?: Fact<number | null>
  /** Open offers, to find the lowest one in the same series (write-offer). */
  openOffers?: OptionOffer[]
  /**
   * A price to judge an exercise against: a `ReferencePrice` (core/reference) or a bare per-unit price in quote
   * units (the user's assumed price). Optional. It only adds a warning; it never decides anything.
   */
  reference?: PriceInput
}

export type FundsPurpose = 'premium' | 'price' | 'escrow' | 'collateral' | 'exercise'

export type IssueDetail =
  | { code: 'not-connected' }
  /** The offer, request, listing or option is no longer in the state the action needs. */
  | { code: 'gone'; what: 'offer' | 'request' | 'listing' | 'option' }
  /** The seller re-priced the listing since the buyer saw it. */
  | { code: 'price-changed'; was: Money; now: Money }
  | { code: 'self-trade'; what: 'own-offer' | 'own-request' | 'own-listing' | 'own-written' }
  | { code: 'not-holder' }
  /** The issuer has not authorized the account for the underlying. */
  | { code: 'not-authorized'; token: TokenInfo }
  | { code: 'insufficient-funds'; purpose: FundsPurpose; need: Money; have: Money; short: Money }
  | { code: 'no-trustline'; purpose: FundsPurpose; token: TokenInfo }
  /** The trustline exists and the issuer has frozen or not authorized it. */
  | { code: 'frozen-balance'; purpose: FundsPurpose; token: TokenInfo }
  | { code: 'unfunded-account' }
  /** Buying is possible, exercising would not be with today's balances. */
  | { code: 'exercise-unfunded'; need: Money }
  | { code: 'clawback-shortfall'; tokens: TokenInfo[] }
  | { code: 'open-cap'; who: 'writer' | 'buyer'; open: number; max: number }
  /** The premium is at least the total strike. */
  | { code: 'implausible-terms' }
  /** Exercising now is worth nothing at the given price. */
  | { code: 'out-of-the-money'; pricePerUnit: bigint; pays: Money; receives: Money; worth: Money }
  /** Inside the last 15 minutes: a signature may not land before the deadline. */
  | { code: 'last-minutes'; secondsLeft: number }
  | { code: 'invalid-price' }

export type PreTradeIssue = IssueDetail & {
  /** `block`: the action cannot go ahead. `warn`: the user may continue. */
  level: 'block' | 'warn'
  /** Ready-to-show sentence with exact figures. */
  message: string
}

export type LineStatus = 'pending' | 'ok' | 'fail' | 'unknown'

/** One status row of a review step ("Offer: Open", "Your account: Authorized by the FUND issuer"). */
export interface PreTradeLine {
  label: string
  status: LineStatus
  text: string
}

export interface PreTradeResult {
  issues: PreTradeIssue[]
  /** At least one issue blocks the action. */
  blocked: boolean
  /** Some facts are still being read. Pending never blocks; the lines say "Checking". */
  pending: boolean
  /** State of the offer, request, listing or option re-read from the chain. Null when the action has none. */
  state: PreTradeLine | null
  /** Issuer eligibility of the connected account. */
  account: PreTradeLine | null
  /** The balance the action needs. */
  funds: PreTradeLine | null
  /** What leaves the wallet for good when the transaction confirms (premium, price, or the exercise leg). */
  pays: Money | null
  /** What the wallet locks in the contract (collateral, or an escrowed premium that a cancel refunds). */
  locks: Money | null
  /** What the wallet receives when the transaction confirms. */
  receives: Money | null
  /** write-offer: the cheapest open offer in the same series, if any. */
  lowestInSeries: OptionOffer | null
}

/** Inside this many seconds of the deadline a signature may not land in time (brief D17). */
export const LAST_MINUTES_SECONDS = 15 * 60

const CHECKING = 'Checking'

const isKnown = <T>(f: Fact<T>): f is T => f !== undefined && f !== 'unknown'

function line(label: string, status: LineStatus, text: string): PreTradeLine {
  return { label, status, text }
}

function stateLine<T>(label: string, fact: Fact<T>, ok: (v: T) => { status: LineStatus; text: string }, unknownText: string): PreTradeLine {
  if (fact === undefined) return line(label, 'pending', CHECKING)
  if (fact === 'unknown') return line(label, 'unknown', unknownText)
  const r = ok(fact)
  return line(label, r.status, r.text)
}

const FUNDS_FIX: Record<FundsPurpose, (need: Money, have: Money, short: Money) => string> = {
  premium: (need, have) => `You have ${amt(have.amount, have.token)}; this needs ${amt(need.amount, need.token)}. Get test funds or pick a smaller offer.`,
  price: (need, have) => `You have ${amt(have.amount, have.token)}; the seller asks ${amt(need.amount, need.token)}. Get test funds first.`,
  escrow: (need, have) => `You have ${amt(have.amount, have.token)}; this request escrows ${amt(need.amount, need.token)}. Get test funds or lower the premium.`,
  collateral: (need, have) => `You have ${amt(have.amount, have.token)}; this locks ${amt(need.amount, need.token)}. Get test funds or lower the quantity.`,
  exercise: (need, have, short) =>
    `You have ${amt(have.amount, have.token)}; exercising takes ${amt(need.amount, need.token)}. Acquire ${amt(short.amount, short.token)} before the deadline.`,
}

const PURPOSE_VERB: Record<FundsPurpose, string> = {
  premium: 'pay the premium',
  price: 'pay the seller',
  escrow: 'escrow the premium',
  collateral: 'lock the collateral',
  exercise: 'exercise',
}

/** The funds line and, when a real balance reading shows the wallet cannot pay, the blocking issue. */
function fundsCheck(purpose: FundsPurpose, need: Money, facts: PreTradeFacts): { line: PreTradeLine; issue: PreTradeIssue | null } {
  const label = `${need.token.code} balance`
  if (!facts.me) return { line: line(label, 'unknown', 'Connect a wallet to check'), issue: null }
  const bal = facts.balances?.[need.token.contractId]
  if (!bal) return { line: line(label, facts.balances ? 'unknown' : 'pending', facts.balances ? 'Not checked' : CHECKING), issue: null }
  const status: BalanceStatus = bal.status
  const code = need.token.code
  if (status === 'no-trustline') {
    const message = `Your account has no ${code} trustline, so it cannot ${PURPOSE_VERB[purpose]}. Add the trustline first.`
    return { line: line(label, 'fail', `No ${code} trustline`), issue: { level: 'block', code: 'no-trustline', purpose, token: need.token, message } }
  }
  if (status === 'not-authorized') {
    const message = `The ${code} issuer has frozen or not authorized your ${code} balance, so you cannot ${PURPOSE_VERB[purpose]}.`
    return { line: line(label, 'fail', `Not authorized by the ${code} issuer`), issue: { level: 'block', code: 'frozen-balance', purpose, token: need.token, message } }
  }
  if (status === 'unfunded') {
    const message = 'Your account is not funded on Testnet. Fund it with Friendbot, then add the trustlines.'
    return { line: line(label, 'fail', 'Account not funded'), issue: { level: 'block', code: 'unfunded-account', message } }
  }
  if (status !== 'ok' || bal.balance === null) return { line: line(label, 'unknown', 'Not checked'), issue: null }
  const have: Money = { token: need.token, amount: bal.balance }
  if (bal.balance >= need.amount) return { line: line(label, 'ok', `${amt(have.amount, have.token)}, enough`), issue: null }
  const short: Money = { token: need.token, amount: shortBy(bal.balance, need.amount) }
  const message = FUNDS_FIX[purpose](need, have, short)
  return {
    line: line(label, 'fail', `${amt(short.amount, short.token)} short`),
    issue: { level: 'block', code: 'insufficient-funds', purpose, need, have, short, message },
  }
}

function accountLine(token: TokenInfo, facts: PreTradeFacts): PreTradeLine {
  const label = 'Your account'
  if (!facts.me) return line(label, 'unknown', 'Connect a wallet to check')
  return stateLine(
    label,
    facts.eligible,
    (ok) => (ok ? { status: 'ok', text: `Authorized by the ${token.code} issuer` } : { status: 'fail', text: `Not authorized by the ${token.code} issuer` }),
    'Could not check',
  )
}

function shortfallIssue(o: Pick<OptionOffer, 'underlying' | 'quote'>, facts: PreTradeFacts, level: 'block' | 'warn'): PreTradeIssue | null {
  const tokens = shortfallFor(o, facts.health ?? [])
  if (tokens.length === 0) return null
  return { level, code: 'clawback-shortfall', tokens, message: clawbackShortfallDisclosure(tokens.map((t) => t.code)) }
}

function lastMinutes(expiry: number, facts: PreTradeFacts): PreTradeIssue | null {
  const secondsLeft = Math.floor(expiry - facts.nowSec)
  if (secondsLeft <= 0 || secondsLeft > LAST_MINUTES_SECONDS) return null
  return {
    level: 'warn',
    code: 'last-minutes',
    secondsLeft,
    message: 'Less than 15 minutes to the deadline. The ledger decides the time, so a signature may not land before it.',
  }
}

const notConnected = (): PreTradeIssue => ({ level: 'block', code: 'not-connected', message: 'Connect a wallet to continue.' })

const notAuthorized = (token: TokenInfo, consequence: string, level: 'block' | 'warn' = 'block'): PreTradeIssue => ({
  level,
  code: 'not-authorized',
  token,
  message: `The ${token.code} issuer has not authorized your account. ${consequence}`,
})

function result(
  parts: Omit<Partial<PreTradeResult>, 'issues'> & { issues: (PreTradeIssue | null)[]; pendingFacts: Fact<unknown>[]; facts: PreTradeFacts },
): PreTradeResult {
  const { pendingFacts, facts, issues: found, ...rest } = parts
  const issues = found.filter((i): i is PreTradeIssue => i !== null)
  // Blocking issues first, in the order they were found.
  issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'block' ? -1 : 1))
  return {
    state: null,
    account: null,
    funds: null,
    pays: null,
    locks: null,
    receives: null,
    lowestInSeries: null,
    ...rest,
    issues,
    blocked: issues.some((i) => i.level === 'block'),
    pending: facts.me !== null && (pendingFacts.some((f) => f === undefined) || rest.funds?.status === 'pending'),
  }
}

const offerOpen = (o: OptionOffer, nowSec: number) => o.state === 'offered' && o.expiry > nowSec
const optionLive = (o: OptionOffer, nowSec: number) => o.state === 'active' && o.expiry > nowSec

function buy(offer: OptionOffer, facts: PreTradeFacts): PreTradeResult {
  const { me, nowSec } = facts
  const pays: Money = { token: offer.quote, amount: offer.totalPremium }
  const funds = fundsCheck('premium', pays, facts)
  const gone = isKnown(facts.option) && !offerOpen(facts.option, nowSec)
  const feas = exerciseFeasibility(offer, facts.balances?.[offer.underlying.contractId], facts.balances?.[offer.quote.contractId])
  return result({
    facts,
    pendingFacts: [facts.option, facts.eligible],
    state: stateLine(
      'Offer',
      facts.option,
      (o) => (offerOpen(o, nowSec) ? { status: 'ok', text: 'Open' } : { status: 'fail', text: 'No longer open' }),
      'Could not re-check. The contract rejects the purchase if it is gone.',
    ),
    account: accountLine(offer.underlying, facts),
    funds: funds.line,
    pays,
    issues: [
      gone ? { level: 'block', code: 'gone', what: 'offer', message: 'This offer is no longer open: it was bought, cancelled or has expired. Pick another offer.' } : null,
      me !== null && offer.writer === me ? { level: 'block', code: 'self-trade', what: 'own-offer', message: 'This is your own offer. You cannot buy it.' } : null,
      facts.eligible === false ? notAuthorized(offer.underlying, 'You cannot buy this option yet.') : null,
      funds.issue,
      shortfallIssue(offer, facts, 'block'),
      feas.level === 'warn' ? { level: 'warn', code: 'exercise-unfunded', need: deliveryAmount(offer), message: feas.message } : null,
      implausibleTerms(offer) ? { level: 'warn', code: 'implausible-terms', message: 'The premium is at least the total strike. Check the terms before buying.' } : null,
      gone ? null : lastMinutes(offer.expiry, facts),
    ],
  })
}

function buyResale(option: OptionOffer, ask: Ask, facts: PreTradeFacts): PreTradeResult {
  const { me, nowSec } = facts
  const q = option.quote
  const pays: Money = { token: q, amount: ask.askTotal }
  const funds = fundsCheck('price', pays, facts)
  const check = isKnown(facts.option) && isKnown(facts.liveAsk) ? resaleCheck(facts.option, facts.liveAsk, ask, nowSec) : null
  const liveAsk = isKnown(facts.liveAsk) ? facts.liveAsk : null
  const self = selfTradeReason(option, ask, me)
  const feas = exerciseFeasibility(option, facts.balances?.[option.underlying.contractId], facts.balances?.[q.contractId])
  const both: Fact<true> = facts.option === 'unknown' || facts.liveAsk === 'unknown' ? 'unknown' : facts.option === undefined || facts.liveAsk === undefined ? undefined : true
  return result({
    facts,
    pendingFacts: [both, facts.eligible],
    state: stateLine(
      'Listing',
      both,
      () =>
        check === 'ok'
          ? { status: 'ok', text: 'For sale' }
          : check === 'changed' && liveAsk !== null
            ? { status: 'fail', text: `Price changed to ${amt(liveAsk, q)}` }
            : { status: 'fail', text: 'No longer for sale' },
      'Could not re-check. The contract rejects the purchase if it is gone.',
    ),
    account: accountLine(option.underlying, facts),
    funds: funds.line,
    pays,
    issues: [
      check === 'fail' ? { level: 'block', code: 'gone', what: 'listing', message: 'This option is no longer for sale: it was bought, withdrawn, exercised or transferred.' } : null,
      check === 'changed' && liveAsk !== null
        ? {
            level: 'block',
            code: 'price-changed',
            was: pays,
            now: { token: q, amount: liveAsk },
            message: `The seller changed the price to ${amt(liveAsk, q)} (it was ${amt(ask.askTotal, q)}). Review the new price before buying.`,
          }
        : null,
      self ? { level: 'block', code: 'self-trade', what: ask.holder === me ? 'own-listing' : 'own-written', message: self } : null,
      facts.eligible === false ? notAuthorized(option.underlying, 'You cannot buy this option yet.') : null,
      funds.issue,
      shortfallIssue(option, facts, 'block'),
      feas.level === 'warn' ? { level: 'warn', code: 'exercise-unfunded', need: deliveryAmount(option), message: feas.message } : null,
      check === 'fail' ? null : lastMinutes(option.expiry, facts),
    ],
  })
}

function fillBid(bid: Bid, facts: PreTradeFacts): PreTradeResult {
  const { me, nowSec } = facts
  const locks = requiredCollateral(bid)
  const funds = fundsCheck('collateral', locks, facts)
  const open = (b: Bid) => b.state === 'open' && b.expiry > nowSec
  const gone = isKnown(facts.bid) && !open(facts.bid)
  return result({
    facts,
    pendingFacts: [facts.bid, facts.eligible],
    state: stateLine('Request', facts.bid, (b) => (open(b) ? { status: 'ok', text: 'Open' } : { status: 'fail', text: 'No longer open' }), 'Could not re-check. The contract rejects the fill if it is gone.'),
    account: accountLine(bid.underlying, facts),
    funds: funds.line,
    locks,
    receives: { token: bid.quote, amount: bid.totalPremium },
    issues: [
      gone ? { level: 'block', code: 'gone', what: 'request', message: 'This request is no longer open: it was filled, withdrawn or has expired.' } : null,
      me !== null && bid.buyer === me ? { level: 'block', code: 'self-trade', what: 'own-request', message: 'This is your own request. You cannot fill it.' } : null,
      // The writer receives the underlying on a put exercise and locks it for a call: both need the issuer's authorization.
      facts.eligible === false ? notAuthorized(bid.underlying, 'You cannot fill this request yet.') : null,
      funds.issue,
      shortfallIssue(bid, facts, 'block'),
      gone ? null : lastMinutes(bid.expiry, facts),
    ],
  })
}

function writeOffer(offer: NewOffer, quote: TokenInfo, facts: PreTradeFacts): PreTradeResult {
  const terms = { ...offer, quote }
  const locks = requiredCollateral(terms)
  const funds = fundsCheck('collateral', locks, facts)
  const open = isKnown(facts.writerOpenCount) ? facts.writerOpenCount : null
  return result({
    facts,
    pendingFacts: [facts.eligible, facts.writerOpenCount],
    account: accountLine(offer.underlying, facts),
    funds: funds.line,
    locks,
    lowestInSeries: facts.openOffers ? lowestOpenInSeries(facts.openOffers, offer, quote) : null,
    issues: [
      facts.eligible === false ? notAuthorized(offer.underlying, 'The contract would refuse this offer.') : null,
      open !== null && open >= MAX_OPEN_PER_WRITER
        ? {
            level: 'block',
            code: 'open-cap',
            who: 'writer',
            open,
            max: MAX_OPEN_PER_WRITER,
            message: `You have ${open} of ${MAX_OPEN_PER_WRITER} open offers. Cancel one or wait for one to sell or expire.`,
          }
        : null,
      funds.issue,
      shortfallIssue(terms, facts, 'block'),
      implausibleTerms(offer) ? { level: 'warn', code: 'implausible-terms', message: 'The premium is at least the total strike. Buyers see a "Check terms" note on such an offer.' } : null,
    ],
  })
}

function postBid(bid: NewBid, quote: TokenInfo, facts: PreTradeFacts): PreTradeResult {
  const terms = { ...bid, quote }
  const locks: Money = { token: quote, amount: bid.totalPremium }
  const funds = fundsCheck('escrow', locks, facts)
  const open = isKnown(facts.buyerOpenCount) ? facts.buyerOpenCount : null
  return result({
    facts,
    pendingFacts: [facts.eligible, facts.buyerOpenCount],
    account: accountLine(bid.underlying, facts),
    funds: funds.line,
    locks,
    issues: [
      open !== null && open >= MAX_OPEN_BIDS_PER_BUYER
        ? {
            level: 'block',
            code: 'open-cap',
            who: 'buyer',
            open,
            max: MAX_OPEN_BIDS_PER_BUYER,
            message: `You have ${open} of ${MAX_OPEN_BIDS_PER_BUYER} open requests. Cancel one or wait for one to fill or expire.`,
          }
        : null,
      funds.issue,
      shortfallIssue(terms, facts, 'block'),
      // Not blocking: the request can be posted, but the option it leads to could not be exercised.
      facts.eligible === false ? notAuthorized(bid.underlying, 'You could post this request, but you could not exercise the option.', 'warn') : null,
      implausibleTerms(bid) ? { level: 'warn', code: 'implausible-terms', message: 'The premium is at least the total strike. Check the terms before posting.' } : null,
    ],
  })
}

function exercise(option: OptionOffer, facts: PreTradeFacts): PreTradeResult {
  const { me, nowSec } = facts
  const fresh = isKnown(facts.option) ? facts.option : option
  // PUT: deliver the underlying, receive the strike. CALL: pay the strike, receive the underlying.
  const pays = deliveryAmount(option)
  const receives = requiredCollateral(option)
  const funds = fundsCheck('exercise', pays, facts)
  const live = optionLive(fresh, nowSec)
  const holder = me !== null && fresh.holder === me
  let otm: PreTradeIssue | null = null
  const price = priceOf(facts.reference)
  if (live && price !== null && optionMoneyness(option, price) === 'out') {
    const u = option.underlying
    // Value of the underlying leg at that price, in quote units, floored.
    const worth: Money = { token: option.quote, amount: (option.underlyingQty * price) / 10n ** BigInt(u.decimals) }
    const label = typeof facts.reference === 'object' && facts.reference ? facts.reference.label.toLowerCase() : 'assumed price'
    const at = amt(price, option.quote)
    const message =
      option.kind === 'put'
        ? `At the ${label} of ${at} per ${u.code}, this put is out of the money: you would deliver ${amt(pays.amount, pays.token)}, worth about ${amt(worth.amount, worth.token)}, for ${amt(receives.amount, receives.token)}.`
        : `At the ${label} of ${at} per ${u.code}, this call is out of the money: you would pay ${amt(pays.amount, pays.token)} for ${amt(receives.amount, receives.token)}, worth about ${amt(worth.amount, worth.token)}.`
    otm = { level: 'warn', code: 'out-of-the-money', pricePerUnit: price, pays, receives, worth, message }
  }
  return result({
    facts,
    pendingFacts: [facts.option],
    state: stateLine(
      'Option',
      facts.option,
      (o) => (optionLive(o, nowSec) ? { status: 'ok', text: 'Active' } : { status: 'fail', text: o.expiry <= nowSec ? 'Expired' : 'No longer active' }),
      'Could not re-check. The contract rejects the exercise if the option is no longer active.',
    ),
    funds: funds.line,
    pays,
    receives,
    issues: [
      me === null ? notConnected() : null,
      !live
        ? {
            level: 'block',
            code: 'gone',
            what: 'option',
            message: fresh.expiry <= nowSec ? 'The deadline has passed. This option can no longer be exercised.' : 'This option is no longer active, so it cannot be exercised.',
          }
        : null,
      live && me !== null && !holder ? { level: 'block', code: 'not-holder', message: 'Only the holder can exercise this option.' } : null,
      live ? funds.issue : null,
      // Payouts are first come, first served while the balance lasts: the exercise may still go through.
      live ? shortfallIssue(option, facts, 'warn') : null,
      otm,
      live ? lastMinutes(option.expiry, facts) : null,
    ],
  })
}

function listForSale(option: OptionOffer, askTotal: bigint | null, facts: PreTradeFacts): PreTradeResult {
  const { me, nowSec } = facts
  const fresh = isKnown(facts.option) ? facts.option : option
  const live = optionLive(fresh, nowSec)
  return result({
    facts,
    pendingFacts: [facts.option],
    state: stateLine('Option', facts.option, (o) => (optionLive(o, nowSec) ? { status: 'ok', text: 'Active' } : { status: 'fail', text: o.expiry <= nowSec ? 'Expired' : 'No longer active' }), 'Could not re-check.'),
    receives: askTotal !== null && askTotal > 0n ? { token: option.quote, amount: askTotal } : null,
    issues: [
      me === null ? notConnected() : null,
      !live ? { level: 'block', code: 'gone', what: 'option', message: 'Only an active option before its deadline can be listed for sale.' } : null,
      live && me !== null && fresh.holder !== me ? { level: 'block', code: 'not-holder', message: 'Only the holder can list this option for sale.' } : null,
      askTotal === null || askTotal <= 0n ? { level: 'block', code: 'invalid-price', message: 'Enter a price above zero.' } : null,
      live ? lastMinutes(option.expiry, facts) : null,
    ],
  })
}

/** Evaluates an action against what was read. Pure: same inputs, same result. */
export function preTrade(action: PreTradeAction, facts: PreTradeFacts): PreTradeResult {
  switch (action.type) {
    case 'buy':
      return buy(action.offer, facts)
    case 'buy-resale':
      return buyResale(action.option, action.ask, facts)
    case 'fill-bid':
      return fillBid(action.bid, facts)
    case 'write-offer':
      return writeOffer(action.offer, action.quote, facts)
    case 'post-bid':
      return postBid(action.bid, action.quote, facts)
    case 'exercise':
      return exercise(action.option, facts)
    case 'list-for-sale':
      return listForSale(action.option, action.askTotal, facts)
  }
}

/** The tokens whose balance an action depends on (what it pays or locks, plus the exercise leg when buying). */
export function tokensFor(action: PreTradeAction): TokenInfo[] {
  switch (action.type) {
    case 'buy':
      return [action.offer.quote, action.offer.underlying]
    case 'buy-resale':
      return [action.option.quote, action.option.underlying]
    case 'fill-bid':
      return [requiredCollateral(action.bid).token]
    case 'write-offer':
      return [requiredCollateral({ ...action.offer, quote: action.quote }).token]
    case 'post-bid':
      return [action.quote]
    case 'exercise':
      return [deliveryAmount(action.option).token]
    case 'list-for-sale':
      return []
  }
}

const settle = async <T>(p: Promise<T>): Promise<T | 'unknown'> => p.catch(() => 'unknown' as const)

/**
 * Reads everything `preTrade` needs for an action, in parallel. A read that fails becomes `'unknown'`; nothing
 * here throws. Pass the result (plus `health`, and a reference price when there is one) to `preTrade`.
 */
export async function readPreTradeFacts(
  client: OptionsClient,
  action: PreTradeAction,
  me: string | null,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<PreTradeFacts> {
  const facts: PreTradeFacts = { me, nowSec }
  const jobs: Promise<unknown>[] = []
  const read = <T>(p: Promise<T>, set: (v: T | 'unknown') => void) => jobs.push(settle(p).then(set))

  const underlying = action.type === 'buy' ? action.offer.underlying : action.type === 'fill-bid' ? action.bid.underlying : action.type === 'write-offer' ? action.offer.underlying : action.type === 'post-bid' ? action.bid.underlying : action.option.underlying
  const needsEligibility = action.type !== 'exercise' && action.type !== 'list-for-sale'

  if (action.type === 'buy') read(client.getOption(action.offer.id), (v) => (facts.option = v))
  if (action.type === 'buy-resale' || action.type === 'exercise' || action.type === 'list-for-sale') read(client.getOption(action.option.id), (v) => (facts.option = v))
  if (action.type === 'buy-resale') read(client.getAsk(action.option.id), (v) => (facts.liveAsk = v))
  if (action.type === 'fill-bid') read(client.getBid(action.bid.id), (v) => (facts.bid = v))
  read(client.collateralHealth(), (v) => (facts.health = v === 'unknown' ? [] : v))
  if (me) {
    if (needsEligibility) read(client.isEligible(underlying.contractId, me), (v) => (facts.eligible = v))
    const tokens = tokensFor(action)
    if (tokens.length > 0) read(client.balances(me, tokens), (v) => (facts.balances = v === 'unknown' ? {} : Object.fromEntries(v.map((b) => [b.contractId, b]))))
    if (action.type === 'write-offer') read(client.writerOpenCount(me), (v) => (facts.writerOpenCount = v))
    if (action.type === 'post-bid') read(client.buyerOpenCount(me), (v) => (facts.buyerOpenCount = v))
  }
  if (action.type === 'write-offer') read(client.listOptions(), (v) => (facts.openOffers = v === 'unknown' ? undefined : v.filter((o) => o.state === 'offered')))
  await Promise.all(jobs)
  return facts
}
