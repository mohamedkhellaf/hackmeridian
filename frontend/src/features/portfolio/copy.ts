// The words of the portfolio feature. Whole sentences per case, never assembled from fragments; figures arrive
// formatted from exact integer units. Required disclosure sentences are not here: they live in core/disclosures.
import { formatUtc } from '../../core/format'
import type { Money, OptionOffer } from '../../core/options/types'
import { requiredCollateral } from '../../core/options/types'
import { claimAmount } from '../../core/portfolio/positions'
import type { Role } from '../../core/portfolio/positions'
import type { BidState } from '../../core/requests/types'
import type { PositionView, TodoView } from '../../data'
import { exactMoney, money, optionPhrase, optionTitle, premiumOf, qtyOf, referenceFigure, referenceName, strikeOf, strikeText } from './model'
import type { PositionAction } from './model'

export const PAGE_TITLE = 'Portfolio'
export const PAGE_DESCRIPTION = 'What you hold, what you wrote and what is waiting for you. Nothing settles by itself.'

export const GUEST_TITLE = 'Connect a wallet to see what you hold and what you wrote.'
export const GUEST_HINT = 'This page lists each position with its deadline and the one action it needs from you.'
/** What a connected wallet finds on the page, so a visitor knows what the wallet is for. */
export const GUEST_SECTIONS = [
  { label: 'To do', text: 'Options to exercise before their deadline, deliveries to claim and collateral to reclaim.' },
  { label: 'Holding', text: 'Options you bought, each with its deadline and where its strike stands at the reference price.' },
  { label: 'Written', text: 'Options you wrote and sold, with the collateral the contract holds for them.' },
  { label: 'Orders', text: 'Your offers without a buyer, your requests and your resale listings.' },
] as const

export const LOAD_ERROR_TITLE = 'Could not read your positions'
export const LOAD_ERROR_AFTER = 'Nothing was changed. Your positions are on the chain, not in this page.'

/**
 * A read error as a sentence. Errors from the contract and the RPC arrive readable from core; a browser message
 * about a failed download is replaced by what it means.
 */
export function readError(message: string | null): string {
  if (!message) return 'The contract did not answer.'
  if (/dynamically imported module|failed to fetch|networkerror|load failed/i.test(message)) return 'The connection to the contract could not be loaded. Check your network.'
  return /[.!?]$/.test(message) ? message : `${message}.`
}
export const REFRESH_FAILED = 'Could not refresh. The figures below are from the last successful read.'

export const LAST_MINUTES_NOTE = 'Less than 15 minutes left. The ledger decides the time, so a signature may not land before the deadline.'

// ------------------------------------------------------------------------------------------- to-do strip

export const TODO_HEADING = 'To do'

export interface TodoCopy {
  /** The word next to the icon: what kind of card this is. */
  label: string
  title: string
  body: string
  /** The action the card offers, or null when there is nothing to do. */
  action: PositionAction | null
}

const TODO_LABEL = {
  urgent: 'Action needed',
  inTheMoney: 'In the money',
  claim: 'Ready to claim',
  reclaim: 'Ready to reclaim',
  soon: 'Expires soon',
  reminder: 'Reminder',
  info: 'For information',
} as const

function exerciseBody(t: TodoView): string {
  const o = t.option
  const qty = exactMoney(qtyOf(o))
  const strike = exactMoney(strikeOf(o))
  const figure = referenceFigure(t.reference, o.quote)
  if (!t.reference || figure === null || t.moneyness === 'unknown' || t.moneyness === null) {
    return `No reference price for ${o.underlying.code}. If you do not exercise before the deadline, the option expires.`
  }
  const source = referenceName(t.reference)
  const k = strikeText(o)
  if (t.moneyness === 'in') {
    return o.kind === 'put'
      ? `In the money at the reference price ${figure} (${source}). You deliver ${qty} and receive ${strike}.`
      : `In the money at the reference price ${figure} (${source}). You pay ${strike} and receive ${qty}.`
  }
  if (t.moneyness === 'at') return `At the money at the reference price ${figure} (${source}). Exercising would change nothing at that price.`
  return o.kind === 'put'
    ? `Out of the money at the reference price ${figure} (${source}). Nothing to do unless the price falls below ${k}.`
    : `Out of the money at the reference price ${figure} (${source}). Nothing to do unless the price rises above ${k}.`
}

/** The label, title, sentence and action of one to-do card. */
export function todoCopy(t: TodoView): TodoCopy {
  const o = t.option
  switch (t.kind) {
    case 'exercise': {
      const soon = t.urgency !== null && t.urgency !== 'far'
      const label = t.tone === 'urgent' ? TODO_LABEL.urgent : t.actionable ? TODO_LABEL.inTheMoney : soon ? TODO_LABEL.soon : TODO_LABEL.reminder
      return {
        label,
        title: t.actionable ? `Exercise your ${optionPhrase(o)}` : `Your ${optionPhrase(o)}`,
        body: exerciseBody(t),
        action: t.actionable ? 'exercise' : null,
      }
    }
    case 'claim': {
      const amount = exactMoney(t.amount ?? claimAmount(o))
      return {
        label: TODO_LABEL.claim,
        title: `Claim ${amount} from your exercised ${o.kind}`,
        body:
          o.kind === 'put'
            ? `The holder exercised and delivered ${amount}. It waits in the contract until you claim it.`
            : `The holder exercised and paid ${amount}. It waits in the contract until you claim it.`,
        action: 'claim',
      }
    }
    case 'reclaim': {
      const amount = exactMoney(t.amount ?? requiredCollateral(o))
      return o.holder
        ? {
            label: TODO_LABEL.reclaim,
            title: `Reclaim ${amount} from your expired ${o.kind}`,
            body: 'The option expired without being exercised. Your collateral stays in the contract until you reclaim it.',
            action: 'reclaim',
          }
        : {
            label: TODO_LABEL.reclaim,
            title: `Reclaim ${amount} from your expired offer`,
            body: 'The offer expired without a buyer. Your collateral stays in the contract until you reclaim it.',
            action: 'reclaim',
          }
    }
    case 'expired-unexercised':
      return {
        label: TODO_LABEL.info,
        title: `${optionTitle(o)} expired`,
        body: `It was not exercised before the deadline. The original premium of ${exactMoney(premiumOf(o))} stays with the writer.`,
        action: null,
      }
  }
}

/** The line where a deadline would be, for the cards that have none. */
export const NO_DEADLINE = 'No deadline. It waits until you act.'

// ------------------------------------------------------------------------------------------- summary

export const SUMMARY_HEADING = 'Summary'
export const SUMMARY = {
  premiumPaid: { label: 'Premium paid', hint: 'Original premiums of the options you hold or held' },
  premiumEarned: { label: 'Premium earned', hint: 'On the options you wrote and sold' },
  collateral: { label: 'Collateral locked', hint: 'Yours, held by the contract' },
  open: { label: 'Positions open' },
} as const

// ------------------------------------------------------------------------------------------- tables

export const TABS = { holding: 'Holding', written: 'Written', orders: 'Orders' } as const
export const SHOW_CLOSED = 'Show closed'

export const EMPTY = {
  holding: { title: 'You hold no options.', closedHint: 'Closed positions are hidden. Turn on Show closed to see them.' },
  written: { title: 'You have written no options that found a buyer.', closedHint: 'Closed positions are hidden. Turn on Show closed to see them.' },
  offers: 'No offers of yours are waiting for a buyer.',
  requests: 'No requests of yours are waiting for a maker.',
  listings: 'None of your options is listed for resale.',
} as const

export const ORDERS = {
  offers: { heading: 'Offers', lead: 'Options you wrote that have no buyer yet. The collateral stays locked until one sells, you cancel, or it expires.' },
  requests: { heading: 'Requests', lead: 'Premiums you escrowed for an option at your price. A maker can fill each one until its deadline; cancelling refunds the premium.' },
  listings: { heading: 'Resale listings', lead: 'Options you hold and offer to another holder at your price.' },
} as const

export const BID_STATE_WORD: Record<BidState, string> = {
  open: 'Open',
  expired: 'Expired',
  filled: 'Filled',
  cancelled: 'Cancelled',
  pruned: 'Expired',
}

export const BID_STATUS: Record<BidState, string> = {
  open: 'Waiting for a maker',
  expired: 'Expired. Cancel it to get the premium back',
  filled: 'Filled. The option is under Holding',
  cancelled: 'Cancelled and refunded',
  pruned: 'Expired and refunded',
}

/** One line on where a position stands for the connected wallet. */
export function statusLine(p: PositionView): string {
  const o = p.option
  switch (o.state) {
    case 'offered':
      return 'For sale in Markets'
    case 'active':
      if (p.role === 'holder') return p.listing ? `Listed for resale at ${money({ token: o.quote, amount: p.listing.askTotal })}` : 'Exercisable until the deadline'
      return 'Sold. Collateral locked until exercise or the deadline'
    case 'exercised':
      return p.role === 'writer' && p.claim ? `Exercised. ${money(p.claim)} waits for your claim` : 'You exercised it'
    case 'settled':
      return p.role === 'writer' ? 'Exercised and claimed' : 'You exercised it'
    case 'expired':
      return p.role === 'writer' ? `Expired. ${money(p.collateral)} waits for your reclaim` : 'Expired without exercise'
    case 'reclaimed':
      return p.role === 'writer' ? 'Expired. Collateral reclaimed' : 'Expired without exercise'
    case 'cancelled':
      return 'Offer cancelled. Collateral returned'
  }
}

// ------------------------------------------------------------------------------------------- position page

/** What the option is, in one sentence, from the side of whoever is looking. */
export function positionSentence(o: OptionOffer, role: Role | null, listing: Money | null = null): string {
  const qty = exactMoney(qtyOf(o))
  const strike = exactMoney(strikeOf(o))
  const collateral = exactMoney(requiredCollateral(o))
  const premium = exactMoney(premiumOf(o))
  const put = o.kind === 'put'
  if (role === null) {
    switch (o.state) {
      case 'offered':
        return put
          ? `An open offer: the right to sell ${qty} for ${strike} until the deadline, for a premium of ${premium}.`
          : `An open offer: the right to buy ${qty} for ${strike} until the deadline, for a premium of ${premium}.`
      case 'active':
        return put ? `The right to sell ${qty} for ${strike} until the deadline.` : `The right to buy ${qty} for ${strike} until the deadline.`
      case 'exercised':
      case 'settled':
        return put ? `This put was exercised: its holder sold ${qty} for ${strike}.` : `This call was exercised: its holder bought ${qty} for ${strike}.`
      case 'expired':
      case 'reclaimed':
        return o.holder ? 'This option expired without being exercised.' : 'This offer expired without a buyer.'
      case 'cancelled':
        return 'This offer was cancelled before anyone bought it.'
    }
  }
  switch (o.state) {
    case 'offered':
      return `Your offer is for sale in Markets. A buyer pays you ${premium} and becomes the holder; your ${collateral} stays locked until then.`
    case 'active':
      if (role === 'holder') {
        if (listing) {
          return put
            ? `You can sell ${qty} for ${strike} until the deadline. It is listed for resale at ${exactMoney(listing)}.`
            : `You can buy ${qty} for ${strike} until the deadline. It is listed for resale at ${exactMoney(listing)}.`
        }
        return put ? `You can sell ${qty} for ${strike} until the deadline.` : `You can buy ${qty} for ${strike} until the deadline.`
      }
      return put
        ? `If the holder exercises, you buy ${qty} for ${strike}. Your ${collateral} is locked until then or until the deadline.`
        : `If the holder exercises, you sell ${qty} for ${strike}. Your ${collateral} is locked until then or until the deadline.`
    case 'exercised':
      if (role === 'writer') return `The holder exercised. ${exactMoney(claimAmount(o))} waits in the contract until you claim it.`
      return put ? `You exercised: you delivered ${qty} and received ${strike}.` : `You exercised: you paid ${strike} and received ${qty}.`
    case 'settled':
      if (role === 'writer') return `The holder exercised and you claimed ${exactMoney(claimAmount(o))}. Nothing is left in the contract.`
      return put ? `You exercised: you delivered ${qty} and received ${strike}.` : `You exercised: you paid ${strike} and received ${qty}.`
    case 'expired':
      if (role === 'writer') return `The deadline passed without an exercise. Your ${collateral} waits in the contract until you reclaim it.`
      return 'The deadline passed without an exercise. The right is gone and nothing is owed.'
    case 'reclaimed':
      if (role === 'writer') return `The deadline passed without an exercise and you reclaimed your ${collateral}.`
      return 'The deadline passed without an exercise. The right is gone and nothing is owed.'
    case 'cancelled':
      return `You cancelled this offer before anyone bought it. Your ${collateral} went back to your wallet.`
  }
}

export const NOTE_TERMS = {
  quantity: 'Quantity',
  strike: 'Strike',
  totalStrike: 'Total strike',
  premium: { holder: 'Original premium', writerSold: 'Premium earned', writerOpen: 'Premium asked', none: 'Premium' },
  premiumHint: 'Paid to the writer when the option was first bought. A later resale price is not recorded.',
  breakeven: 'Breakeven',
  deadline: 'Deadline',
  collateral: 'Collateral',
  writer: 'Writer',
  holder: 'Holder',
  noHolder: 'No buyer yet',
  moneyness: 'At the reference',
  exerciseValue: 'Exercise value',
  listing: 'Resale listing',
  claim: 'Waiting for you',
} as const

export const NOT_FOUND_TITLE = 'No option has this number.'
export const NOT_FOUND_HINT = 'The link may be mistyped, or it points at another contract.'
export const POSITION_ERROR_TITLE = 'Could not read this option'

export const NOT_YOURS = 'This wallet is neither the holder nor the writer of this option, so it has no action here.'
export const GUEST_ACTIONS = 'Connect the wallet that holds or wrote this option to act on it.'

/** Why the page shows no action button for a wallet that is on one side of the option. */
export function noActionNote(p: PositionView): string {
  if (p.closed) return 'Nothing is left to do on this position.'
  if (p.role === 'writer' && p.option.state === 'active') return 'Nothing for you to do now. You claim after an exercise, or reclaim after the deadline.'
  if (p.role === 'holder' && p.option.state === 'exercised') return 'Nothing is left for you to do. The writer still claims its side from the contract.'
  return 'Nothing for you to do now.'
}

/** Shown when a reminder link asks for an action the position no longer allows. */
export function staleLink(action: PositionAction): string {
  switch (action) {
    case 'exercise':
      return 'This link opens the exercise, which is no longer possible for this wallet. The position below shows where it stands.'
    case 'claim':
      return 'This link opens the claim, and nothing is waiting to be claimed by this wallet. The position below shows where it stands.'
    case 'reclaim':
      return 'This link opens the reclaim, and no collateral is waiting for this wallet. The position below shows where it stands.'
    case 'cancel':
      return 'This link cancels an open offer, and this is no longer an open offer of this wallet. The position below shows where it stands.'
    case 'sell':
    case 'unlist':
      return 'This link opens the resale listing, which this wallet can no longer change. The position below shows where it stands.'
  }
}

export const PAYOFF_HEADING = 'Payoff at expiry'
export const LIFECYCLE_HEADING = 'Lifecycle'

// ------------------------------------------------------------------------------------------- dialogs

/** PUT: the holder delivers the underlying and receives the strike. CALL: the holder pays the strike and receives the underlying. */
export function deliverySentence(o: OptionOffer): string {
  const qty = exactMoney(qtyOf(o))
  const strike = exactMoney(strikeOf(o))
  return o.kind === 'put' ? `You deliver ${qty} and receive ${strike}.` : `You pay ${strike} and receive ${qty}.`
}

export const ATOMIC_NOTE = 'Both sides move in one transaction. If either cannot move, nothing does.'

export interface ActionCopy {
  title: string
  /** What signing does, in one or two sentences. */
  body: string
  /** What can still go differently, if anything: said before the button, in the same dialog. */
  caveat?: string
  confirm: string
  /** The button that leaves the dialog without acting. */
  dismiss: string
  /** Heading of the receipt once the ledger confirmed. */
  done: string
  /** One line under the receipt: what happens next, if anything. */
  after: string
}

export function exerciseCopy(o: OptionOffer): ActionCopy {
  const leg = exactMoney(claimAmount(o))
  return {
    title: `Exercise ${optionPhrase(o)}`,
    body: deliverySentence(o),
    confirm: 'Exercise',
    dismiss: 'Not now',
    done: `Exercised: ${optionPhrase(o)}`,
    after: `The option is closed for you. The writer can now claim the ${leg} that the exercise left in the contract.`,
  }
}

export function claimCopy(o: OptionOffer): ActionCopy {
  const amount = exactMoney(claimAmount(o))
  return {
    title: 'Claim delivery',
    body:
      o.kind === 'put'
        ? `The holder exercised this put and delivered ${amount}. Claiming moves it from the contract to your wallet.`
        : `The holder exercised this call and paid ${amount}. Claiming moves it from the contract to your wallet.`,
    confirm: 'Claim delivery',
    dismiss: 'Not now',
    done: `Delivery claimed: ${optionPhrase(o)}`,
    after: 'Nothing is left in the contract for this option.',
  }
}

export function reclaimCopy(o: OptionOffer): ActionCopy {
  const amount = exactMoney(requiredCollateral(o))
  return {
    title: 'Reclaim collateral',
    body: o.holder
      ? `This ${o.kind} expired without being exercised. Reclaiming moves your ${amount} from the contract to your wallet.`
      : `This offer expired without a buyer. Reclaiming moves your ${amount} from the contract to your wallet.`,
    confirm: 'Reclaim',
    dismiss: 'Not now',
    done: `Reclaimed: ${optionPhrase(o)}`,
    after: 'Nothing is left in the contract for this option.',
  }
}

export function cancelOfferCopy(o: OptionOffer): ActionCopy {
  const amount = exactMoney(requiredCollateral(o))
  return {
    title: 'Cancel offer',
    body: `The offer leaves Markets and your ${amount} goes back to your wallet.`,
    caveat: 'If a buyer takes the offer before the cancellation lands, the cancellation is refused and the option is sold.',
    confirm: 'Cancel offer',
    dismiss: 'Keep offer',
    done: `Offer cancelled: ${optionPhrase(o)}`,
    after: `Your ${amount} is back in your wallet.`,
  }
}

export function cancelListingCopy(o: OptionOffer, ask: Money): ActionCopy {
  return {
    title: 'Cancel listing',
    body: `Your ${optionPhrase(o)} is no longer for sale at ${exactMoney(ask)}. You keep the option and can still exercise it before the deadline.`,
    caveat: 'If a buyer takes the listing before the cancellation lands, the cancellation is refused: the buyer has paid you and holds the option.',
    confirm: 'Cancel listing',
    dismiss: 'Keep listing',
    done: `Listing cancelled: ${optionPhrase(o)}`,
    after: 'You still hold the option.',
  }
}

export function cancelRequestCopy(premium: Money, phrase: string, expired: boolean): ActionCopy {
  const amount = exactMoney(premium)
  return {
    title: 'Cancel request',
    body: expired ? `This request expired without a maker. Cancelling returns your escrowed ${amount} to your wallet.` : `Your escrowed ${amount} goes back to your wallet.`,
    caveat: expired ? undefined : 'If a maker fills the request before the cancellation lands, the cancellation is refused and you hold the option.',
    confirm: 'Cancel request',
    dismiss: 'Keep request',
    done: `Request cancelled: ${phrase}`,
    after: `Your ${amount} is back in your wallet.`,
  }
}

/** The consent that gates an exercise the reference says loses value. */
export const outOfTheMoneyConsent = (source: string): string => `I want to exercise although the option is out of the money at the ${source}.`

export const RECEIPT = {
  delivered: 'You delivered',
  paid: 'You paid',
  received: 'You received',
  returned: 'Returned to you',
  transaction: 'Transaction',
  ledger: 'Ledger',
} as const

export const CHECKS_HEADING = 'Checked before you sign'
export const CONNECT = 'Connect wallet'
export const DONE = 'Done'
export const CLOSE = 'Close'
export const REVIEW_AGAIN = 'Review again'
export const CHECK_AGAIN = 'Check again'
export const VIEW_POSITION = 'View position'
export const BUSY_REASON = 'Another transaction is in progress.'

// ------------------------------------------------------------------------------------------- calendar

export const CALENDAR = {
  trigger: 'Add the deadline to your calendar',
  file: 'Download calendar file',
  google: 'Open in Google Calendar',
  note: 'The entry does not update if you sell or exercise. A reminder can arrive late or not at all: the deadline stays yours.',
  downloaded: 'Calendar file downloaded.',
} as const

/** `Exercise deadline: FUND 10.40 put (10.00 FUND)`. */
export const calendarTitle = (o: OptionOffer): string => `Exercise deadline: ${o.underlying.code} ${strikeText(o)} ${o.kind} (${money(qtyOf(o))})`

export function calendarDescription(o: OptionOffer): string {
  const qty = exactMoney(qtyOf(o))
  const strike = exactMoney(strikeOf(o))
  const at = formatUtc(o.expiry)
  return o.kind === 'put'
    ? `Your right to sell ${qty} for ${strike} ends at ${at}. Nothing happens automatically. To exercise you need ${qty} in your wallet. This entry does not update if you sell or exercise the option. Testnet only.`
    : `Your right to buy ${qty} for ${strike} ends at ${at}. Nothing happens automatically. To exercise you need ${strike} in your wallet. This entry does not update if you sell or exercise the option. Testnet only.`
}

// ------------------------------------------------------------------------------------------- payoff

/** What the chart of a written option leaves out: the collateral the writer locked. */
export function writerPayoffNote(o: OptionOffer): string {
  const qty = exactMoney(qtyOf(o))
  const strike = exactMoney(strikeOf(o))
  const k = strikeText(o)
  if (o.holder === null) {
    return o.kind === 'put'
      ? `The option alone, premium included, once it is sold. Below ${k} a holder would exercise: you buy ${qty} for the ${strike} you locked.`
      : `The option alone, premium included, once it is sold. Above ${k} a holder would exercise: you deliver the ${qty} you locked for ${strike} and give up any rise beyond that.`
  }
  return o.kind === 'put'
    ? `The option alone, premium included. Below ${k} the holder would exercise: you buy ${qty} for the ${strike} you locked.`
    : `The option alone, premium included. Above ${k} the holder would exercise: you deliver the ${qty} you locked for ${strike} and give up any rise beyond that.`
}

export const ENDED_PAYOFF_NOTE = 'This option is no longer live. The figure shows what its terms paid at expiry, premium included.'
export const HOLDER_PAYOFF_NOTE = 'Premium included. The original premium is used: a resale price is not recorded on chain.'
export const VIEWER_PAYOFF_NOTE = 'Shown from the side of the holder, premium included.'
