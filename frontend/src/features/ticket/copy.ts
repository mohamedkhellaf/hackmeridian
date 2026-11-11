// Every sentence of the order ticket that is not a required disclosure (those live in core/disclosures.ts).
// Sentence case, numbers before adjectives, who acts and by when. copy.test.ts checks the wording rules.
import type { OptionKind } from '../../core/options/types'
import type { TxEffect, TxPhase } from '../../core/tx/machine'
import type { TicketMode } from './intent'

/** "a put", "a call". */
export const aKind = (kind: OptionKind): string => `a ${kind}`

const KIND_TITLE: Record<OptionKind, string> = { put: 'Put', call: 'Call' }

/** The steps of a ticket. The heading names the step; there is no step trail. */
export type StepName = 'terms' | 'review' | 'sign' | 'receipt'

/** The heading of a ticket: the Terms step of a form, and the review of buy, fill and resale buy. */
export function ticketTitle(mode: TicketMode, kind: OptionKind, code: string, repricing = false): string {
  switch (mode) {
    case 'buy':
      return `Buy ${aKind(kind)} on ${code}`
    case 'buy-resale':
      return `Buy ${aKind(kind)} on ${code} from its holder`
    case 'write':
      return `Write ${aKind(kind)} on ${code}`
    case 'bid':
      return `Request ${aKind(kind)} on ${code}`
    case 'fill':
      return `Fill a request for ${aKind(kind)} on ${code}`
    case 'list':
      return repricing ? `Change the price of your ${kind} on ${code}` : `Sell your ${kind} on ${code}`
  }
}

/** The heading of the review of a form, so the two steps do not share one heading. */
export function reviewTitle(mode: 'write' | 'bid' | 'list', repricing = false): string {
  switch (mode) {
    case 'write':
      return 'Review your offer'
    case 'bid':
      return 'Review your request'
    case 'list':
      return repricing ? 'Review the new price' : 'Review your listing'
  }
}

/** The heading before the subject is known. */
export const LOADING_TITLE: Record<TicketMode, string> = {
  buy: 'Buy an option',
  'buy-resale': 'Buy an option from its holder',
  write: 'Write an option',
  bid: 'Request an option',
  fill: 'Fill a request',
  list: 'Sell your option',
}

/** The heading of the Sign step while the transaction is in flight: it follows the state. */
export const SIGN_TITLE: Record<'checking' | 'signing' | 'submitting' | 'pending', string> = {
  checking: 'Checking',
  signing: 'Sign in your wallet',
  submitting: 'Sending',
  pending: 'Waiting for the ledger',
}

/** The heading of the Sign step once the attempt has ended without a confirmation. */
export function outcomeTitle(phase: 'failed' | 'unknown' | 'expired' | 'declined', effect: TxEffect, refusedOnSend: boolean): string {
  switch (phase) {
    case 'failed':
      return effect === 'fee-charged' ? 'Refused on the ledger' : refusedOnSend ? 'Refused by the network' : 'Refused before sending'
    case 'unknown':
      return 'Not confirmed yet'
    case 'expired':
      return 'The transaction expired'
    case 'declined':
      return 'Declined in the wallet'
  }
}

/** The heading of the receipt: two or three words. */
export function receiptTitle(mode: TicketMode, kind: OptionKind, repricing = false): string {
  switch (mode) {
    case 'buy':
      return `${KIND_TITLE[kind]} bought`
    case 'buy-resale':
      return `${KIND_TITLE[kind]} bought from its holder`
    case 'write':
      return 'Offer written'
    case 'bid':
      return 'Request posted'
    case 'fill':
      return 'Request filled'
    case 'list':
      return repricing ? 'Price changed' : 'Listed for sale'
  }
}

/** The figures a holder's reminder needs, formatted: `5.00 BOND`, `495.00 USDx`, `99.00 USDx`, the deadline in UTC. */
export interface HolderWords {
  code: string
  qty: string
  strikeTotal: string
  strike: string
  deadline: string
}

/** What the receipt says the user can do next, and by when. A holder gets the right in words. */
export function receiptReminder(mode: TicketMode, kind: OptionKind, holder?: HolderWords): string {
  switch (mode) {
    case 'buy':
    case 'buy-resale':
      if (!holder) return `To use the ${kind}, exercise it from Portfolio before the deadline.`
      return kind === 'put'
        ? `Until ${holder.deadline} you can sell ${holder.qty} for ${holder.strikeTotal}. Use it only if ${holder.code} is worth less than ${holder.strike} then: exercise from Portfolio before the deadline.`
        : `Until ${holder.deadline} you can buy ${holder.qty} for ${holder.strikeTotal}. Use it only if ${holder.code} is worth more than ${holder.strike} then: exercise from Portfolio before the deadline.`
    case 'write':
      return 'The collateral stays in the contract. You can cancel the offer and take it back while nobody has bought it.'
    case 'bid':
      return 'A maker can fill this request until the deadline. Cancel it before that to take the premium back.'
    case 'fill':
      return 'The buyer can exercise until the deadline. After it, reclaim the collateral if the option was not exercised.'
    case 'list':
      return 'The option stays yours until a buyer takes the listing. Exercising or cancelling ends the sale.'
  }
}

/**
 * What the user commits to, printed as text above the action of the review. The wallet signature is the consent:
 * there is no tick box.
 */
export const COMMITMENT: Record<TicketMode, string> = {
  buy: 'Nothing settles by itself: exercise before the deadline, or the option expires.',
  'buy-resale': 'Nothing settles by itself: exercise before the deadline, or the option expires.',
  write: 'Your collateral stays locked in the contract until you cancel the offer, claim after an exercise, or reclaim after the deadline.',
  bid: 'A maker can fill this request at any moment. The premium is then paid and not refundable.',
  fill: 'Your collateral stays locked until the buyer exercises or the deadline passes. You claim or reclaim it yourself.',
  list: 'A buyer can take this listing at any moment and then holds the option. Until then it stays yours: you can still exercise it or cancel the listing.',
}

export const CHECKS_PENDING = 'Still reading from the contract.'
export const TX_BUSY = 'Another transaction is in progress. Wait for it to finish.'

/** Resale buy: who is paid, and what happens to the collateral. */
export const RESALE_NOTE = "You pay the seller, not the maker. The option's collateral stays locked in the contract."

/** List for sale: what a listing is. */
export function listingNote(quoteCode: string, repricing: boolean): string {
  const base = `A buyer pays you this price in ${quoteCode} and becomes the holder. The collateral stays locked in the contract. The sale ends if you exercise, the option expires, or you cancel it.`
  return repricing ? `${base} Listing again replaces your current price.` : base
}

/** Under the Original premium of a listing: the same words as the position page. */
export const ORIGINAL_PREMIUM_HINT = 'Paid to the maker when the option was first bought. A later resale price is not recorded.'
export const SAME_PRICE = 'This is the current price.'

/** Under the write form, only when the build has Margin: a link, not a choice inside this ticket. */
export const MARGIN_LINK = 'Write with partial margin instead'

/** The closed disclosure that holds the payoff figure of a review. */
export const PAYOFF_SUMMARY = 'Payoff at the deadline'

export const CHANGE_TERMS_LABEL = 'Change terms'
export const CUSTOM_TERMS_LABEL = 'Custom terms'
export const CUSTOM_TERMS_HINT = 'The chain lists off-grid terms under "Other offers".'

/** The empty Buy tab: the series has no offer. */
export const NO_OFFER = 'No open offer on this series. A request escrows your premium and waits for a maker.'

/** "a put on 5.00 BOND at 10.00 USDx, until 13 Nov 2026, 08:00 UTC": the option in words, from formatted parts. */
export function optionPhrase(kind: OptionKind, qty: string, strikePerUnit: string, deadline: string): string {
  return `${aKind(kind)} on ${qty} at ${strikePerUnit}, until ${deadline}`
}

/** What the wallet is asked to sign, in one sentence with its figures. */
export function signSummary(mode: TicketMode, option: string, amounts: { pays?: string; locks?: string; receives?: string }): string {
  switch (mode) {
    case 'buy':
      return `Buy ${option}. You pay ${amounts.pays}.`
    case 'buy-resale':
      return `Buy ${option} from its holder. You pay the seller ${amounts.pays}.`
    case 'write':
      return `Write ${option}. You lock ${amounts.locks} and ask a premium of ${amounts.receives}.`
    case 'bid':
      return `Request ${option}. You escrow ${amounts.locks}.`
    case 'fill':
      return `Write ${option} for this request. You lock ${amounts.locks} and receive ${amounts.receives}.`
    case 'list':
      return `List ${option} for sale at ${amounts.receives}.`
  }
}

/** The figures of the outcome pair, formatted: `BOND`, `99.00 USDx`, `2.00 BOND`, `198.00 USDx`, `1.36 USDx`. */
export interface OutcomeWords {
  code: string
  strike: string
  qty: string
  strikeTotal: string
  premium: string
}

/**
 * What happens on either side of the strike, in two sentences: the case where the right is used, then the case
 * where it is not. The holder's side for a buyer, the maker's side for whoever wrote it.
 */
export function outcomePair(side: 'long' | 'short', kind: OptionKind, w: OutcomeWords): [string, string] {
  if (side === 'long') {
    return kind === 'put'
      ? [`If ${w.code} is below ${w.strike}, exercising pays: you deliver ${w.qty} and receive ${w.strikeTotal} in the same transaction.`, `If it stays at or above ${w.strike}, you let the put expire and the ${w.premium} premium is the cost.`]
      : [`If ${w.code} is above ${w.strike}, exercising pays: you pay ${w.strikeTotal} and receive ${w.qty} in the same transaction.`, `If it stays at or below ${w.strike}, you let the call expire and the ${w.premium} premium is the cost.`]
  }
  return kind === 'put'
    ? [`If ${w.code} is below ${w.strike} and the holder exercises, the ${w.strikeTotal} you locked is paid out and ${w.qty} waits in the contract until you claim it.`, `If it stays at or above ${w.strike}, the put expires and you keep the ${w.premium} premium.`]
    : [`If ${w.code} is above ${w.strike} and the holder exercises, the ${w.qty} you locked goes to the holder and ${w.strikeTotal} waits in the contract until you claim it.`, `If it stays at or below ${w.strike}, the call expires and you keep the ${w.premium} premium.`]
}

/** A written or filled call: what the maker gives up, instead of a loss figure (the collateral is the underlying). */
export const giveUpValue = (strike: string, code: string): string => `Every rise above ${strike} per ${code}`
export const giveUpHint = (qty: string): string => `You cannot owe more than the ${qty} you lock; it can still fall in price.`

/** The read time and the checks that passed, as one sentence: "Read from the contract at 13:45:12 UTC: ...". */
export function checksSentence(at: string | null, parts: readonly string[]): string {
  const list = parts.length <= 1 ? (parts[0] ?? '') : parts.length === 2 ? `${parts[0]} and ${parts[1]}` : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
  return at ? `Read from the contract at ${at}: ${list}.` : `Read from the contract: ${list}.`
}

/** A transaction of this wallet whose outcome is not known yet blocks a second one. */
export function pendingTxNotice(sentAt: string, until: string): string {
  return `A transaction sent at ${sentAt} is not confirmed yet and can still go through until ${until}. Check it before you send another.`
}

/** At the contract's cap of open orders, said as the form opens (the same words as the pre-trade check). */
export const capOffers = (open: number, cap: number): string => `You have ${open} of ${cap} open offers. Cancel one or wait for one to sell or expire.`
export const capRequests = (open: number, cap: number): string => `You have ${open} of ${cap} open requests. Cancel one or wait for one to fill or expire.`

/** A request pays at least the premium asked, on the same series: filling it is paid now. */
export function betterRequest(escrowed: string, qty: string, serial: string): string {
  return `A buyer has escrowed ${escrowed} for ${qty} on these terms. Fill request No. ${serial} and be paid now.`
}

/** An open offer costs no more per unit than the request being written. */
export function cheaperOffer(perUnit: string, code: string, qty: string, serial: string): string {
  return `Offer No. ${serial} sells ${qty} on these terms at ${perUnit} per ${code} now. Buying it costs no more than this request.`
}

// ------------------------------------------------------------------------------------------------ sign step

/** What each state of the transaction means and what to do. `until` is the end of the validity window, in UTC. */
export function signHelp(phase: Exclude<TxPhase, 'idle' | 'failed'>, until: string | null): string {
  switch (phase) {
    case 'checking':
      return 'Simulating the transaction against the contract.'
    case 'signing':
      return 'Approve the transaction in your wallet.'
    case 'submitting':
      return 'Signed. Sending the transaction to the network.'
    case 'pending':
      return 'The network accepted the transaction. Waiting for a ledger to include it. You can close the ticket: the Activity list keeps it.'
    case 'confirmed':
      return 'A ledger included the transaction.'
    case 'declined':
      return 'Nothing was sent and no fee was charged. You can sign again.'
    case 'expired':
      return 'No ledger included the transaction and none can any more. Nothing was charged. You can sign again.'
    case 'unknown':
      return until
        ? `The transaction was sent and no ledger has included it yet. It can still go through until ${until}. Do not send another one before that: check again first.`
        : 'The transaction was sent and no ledger has included it yet. It can still go through. Do not send another one: check again first.'
  }
}

/** After a failure, under what happened to the fee (the data layer's sentence). */
export const FAILED_NEXT = 'Go back to the review to see what changed.'

/** Before the wallet is asked: the last fresh read of everything the trade depends on. */
export const RECHECK_HELP = 'Reading the terms, your balances and the reserves again from the contract.'
export const RECHECK_BLOCKED = 'Something changed since you opened the review. Nothing was sent.'

/** The label of the action bar while the transaction is in flight, before the ledger has it. */
export const WORKING_LABEL: Record<'recheck' | 'checking' | 'signing' | 'submitting', string> = {
  recheck: 'Checking',
  checking: 'Checking',
  signing: 'Waiting for your wallet',
  submitting: 'Sending',
}

export const SIGN_AGAIN = 'Sign again'
export const CHECK_AGAIN = 'Check again'
export const BACK_TO_REVIEW = 'Back to review'
export const WRITE_ANOTHER = 'Write another'
export const POST_ANOTHER = 'Post another'
export const TEST_FUNDS_LINK = 'How to get test funds'
