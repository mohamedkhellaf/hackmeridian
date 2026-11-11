// Every sentence of the order ticket that is not a required disclosure (those live in core/disclosures.ts).
// Sentence case, numbers before adjectives, who acts and by when. copy.test.ts checks the wording rules.
import type { OptionKind } from '../../core/options/types'
import type { TxEffect, TxPhase } from '../../core/tx/machine'
import type { TicketMode } from './intent'

/** "a put", "a call". */
export const aKind = (kind: OptionKind): string => `a ${kind}`

export const STEP_LABEL = { terms: 'Terms', review: 'Review', sign: 'Sign', receipt: 'Receipt' } as const
export type StepName = keyof typeof STEP_LABEL
export const STEPS: readonly StepName[] = ['terms', 'review', 'sign', 'receipt']

/** The heading of the Terms and Review steps. */
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

/** The heading before the subject is known. */
export const LOADING_TITLE: Record<TicketMode, string> = {
  buy: 'Buy an option',
  'buy-resale': 'Buy an option from its holder',
  write: 'Write an option',
  bid: 'Request an option',
  fill: 'Fill a request',
  list: 'Sell your option',
}

export const SIGN_TITLE = 'Sign in your wallet'

/** The heading of the Sign step once the attempt has ended without a confirmation. */
export const OUTCOME_TITLE: Partial<Record<TxPhase, string>> = {
  failed: 'The transaction did not go through',
  unknown: 'Not confirmed yet',
  expired: 'The transaction expired',
  declined: 'Declined in the wallet',
}

/** The heading of the receipt. */
export function receiptTitle(mode: TicketMode, kind: OptionKind, repricing = false): string {
  switch (mode) {
    case 'buy':
      return `Bought. The ${kind} is yours.`
    case 'buy-resale':
      return `Bought from its holder. The ${kind} is yours.`
    case 'write':
      return 'Written. Your offer is open.'
    case 'bid':
      return 'Posted. Your premium is in escrow.'
    case 'fill':
      return `Filled. You wrote this ${kind}; the buyer holds it.`
    case 'list':
      return repricing ? 'Price changed. Your listing is open.' : 'Listed. Your option is for sale.'
  }
}

/** What the receipt reminds the user to do next, and by when. */
export function receiptReminder(mode: TicketMode, kind: OptionKind): string {
  switch (mode) {
    case 'buy':
    case 'buy-resale':
      return `Nothing settles by itself. To use the ${kind}, exercise before the deadline.`
    case 'write':
      return 'The collateral stays in the contract. You can cancel the offer and take it back while nobody has bought it.'
    case 'bid':
      return 'A seller can fill this request until the deadline. Cancel it before that to take the premium back.'
    case 'fill':
      return 'The buyer can exercise until the deadline. After it, reclaim the collateral if the option was not exercised.'
    case 'list':
      return 'The option stays yours until a buyer takes the listing. Exercising or cancelling ends the sale.'
  }
}

/** The sentence the consent checkbox carries. It gates the action of the Review step. */
export const CONSENT: Record<TicketMode, string> = {
  buy: 'I understand that nothing settles by itself: I must exercise before the deadline, or the option expires.',
  'buy-resale': 'I understand that nothing settles by itself: I must exercise before the deadline, or the option expires.',
  write: 'I understand that my collateral stays locked in the contract until I cancel the offer, claim after an exercise, or reclaim after the deadline.',
  bid: 'I understand that a seller can fill this request at any moment, and that the premium is then paid and not refundable.',
  fill: 'I understand that my collateral stays locked until the buyer exercises or the deadline passes, and that I must claim or reclaim it myself.',
  list: 'I understand that a buyer can take this listing at any moment, and then holds the option.',
}

export const CONSENT_MISSING = 'Tick the box above to continue.'
export const CHECKS_PENDING = 'Still reading from the contract.'

export const GUEST_NOTE = 'Connect a Testnet wallet to review and sign. The terms stay as you set them.'

export const DEADLINE_RULE = 'Decided by ledger close time.'

/** Resale buy: who is paid, and what happens to the collateral. Said once, above the terms. */
export const RESALE_NOTE = "You pay the seller, not the writer. The option's collateral stays locked in the contract."

/** List for sale: what a listing is. */
export function listingNote(quoteCode: string, repricing: boolean): string {
  const base = `A buyer pays you this price in ${quoteCode} and becomes the holder. The collateral stays locked in the contract. The sale ends if you exercise, the option expires, or you cancel it.`
  return repricing ? `${base} Listing again replaces your current price.` : base
}

export const WRITE_STANDING_NOTE = 'An offer is a standing quote: it pays nothing until someone buys it, and you can cancel it until then.'

/** Shown when a writer picks the Margin card: that product lives in its own section. */
export const MARGIN_ELSEWHERE = 'Margin has its own section, its own contract and its own entry warning. This ticket only writes fully collateralized offers.'
export const MARGIN_NOT_HERE = 'Margin offers are written in the Margin section.'

export const CUSTOM_TERMS_LABEL = 'Custom terms'
export const CUSTOM_TERMS_HINT = 'Off the standard grid. The contract accepts any terms; the chain lists them under "Other offers".'
export const OFF_GRID_NOTE = 'These terms are off the standard grid, so the chain lists them under "Other offers".'

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

/** What an exercise moves, seen from each side. `gives` and `receives` are the holder's legs, formatted. */
export function settlementSentence(side: 'long' | 'short', kind: OptionKind, gives: string, receives: string): string {
  if (side === 'long') return kind === 'put' ? `If you exercise, you deliver ${gives} and receive ${receives} in the same transaction.` : `If you exercise, you pay ${gives} and receive ${receives} in the same transaction.`
  return kind === 'put'
    ? `If the holder exercises, the ${receives} you locked is paid out and ${gives} waits in the contract until you claim it.`
    : `If the holder exercises, the ${receives} you locked goes to the holder and ${gives} waits in the contract until you claim it.`
}

// ------------------------------------------------------------------------------------------------ sign step

/** What each state of the transaction means and what to do. `until` is the end of the validity window, in UTC. */
export function signHelp(phase: Exclude<TxPhase, 'idle'>, effect: TxEffect, until: string | null): string {
  switch (phase) {
    case 'checking':
      return 'Simulating the transaction against the contract. Nothing has been sent.'
    case 'signing':
      return 'Approve the transaction in your wallet. Nothing is sent until you sign.'
    case 'submitting':
      return 'Signed. Sending the transaction to the network.'
    case 'pending':
      return 'The network accepted the transaction. Waiting for a ledger to include it. You can close the ticket: the Activity list keeps it.'
    case 'confirmed':
      return 'A ledger included the transaction.'
    case 'declined':
      return 'You declined the request in the wallet. Nothing was sent and no fee was charged. You can sign again.'
    case 'expired':
      return 'No ledger included the transaction and none can any more. Nothing was charged. You can sign again.'
    case 'unknown':
      return until
        ? `The transaction was sent and no ledger has included it yet. It can still go through until ${until}. Do not send another one before that: check again first.`
        : 'The transaction was sent and no ledger has included it yet. It can still go through. Do not send another one: check again first.'
    case 'failed':
      return effect === 'fee-charged'
        ? 'A ledger included the transaction and the contract refused it. The network fee was charged. Go back to the review: everything is read again there.'
        : 'Nothing was sent and no fee was charged. Go back to the review to see what changed, then sign again.'
  }
}

/** Before the wallet is asked: the last fresh read of everything the trade depends on. */
export const RECHECK_HELP = 'Reading the terms, your balances and the reserves again from the contract. Nothing has been sent.'
export const RECHECK_BLOCKED = 'Something changed since you opened the review. Nothing was sent. The review below shows what.'

/** The label of the action bar while the transaction is in flight. */
export const WORKING_LABEL: Record<'recheck' | 'checking' | 'signing' | 'submitting' | 'pending', string> = {
  recheck: 'Checking',
  checking: 'Checking',
  signing: 'Waiting for your wallet',
  submitting: 'Submitting',
  pending: 'Pending',
}

export const SIGN_AGAIN = 'Sign again'
export const CHECK_AGAIN = 'Check again'
export const BACK_TO_REVIEW = 'Back to review'
