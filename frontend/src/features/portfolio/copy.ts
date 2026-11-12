// The words of the portfolio feature. Whole sentences per case, never assembled from fragments; figures arrive
// formatted from exact integer units. Required disclosure sentences are not here: they live in core/disclosures.
import { formatUnits, formatUtc } from '../../core/format'
import type { Money, OptionOffer } from '../../core/options/types'
import { requiredCollateral } from '../../core/options/types'
import { claimAmount } from '../../core/portfolio/positions'
import type { Role } from '../../core/portfolio/positions'
import type { BidState } from '../../core/requests/types'
import type { PositionView, TodoView } from '../../data'
import { exactMoney, money, optionPhrase, qtyOf, referenceFigure, referenceName, referencePhrase, strikeOf, strikeText } from './model'
import type { PositionAction } from './model'

export const PAGE_TITLE = 'Portfolio'

export const GUEST_TITLE = 'Connect a wallet to see your positions.'
export const NOTHING_TITLE = 'You hold no options.'

export const LOAD_ERROR_TITLE = 'Could not read your positions'

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
  title: string
  /** One sentence under the title, or empty when the title and the button say it all. */
  body: string
  /** The action the card offers, or null when the card only links to the position. */
  action: PositionAction | null
}

/** Where a strike stands against the reference, in one sentence, from the price that would change it. */
function exerciseBody(t: TodoView): string {
  const o = t.option
  const qty = exactMoney(qtyOf(o))
  const strike = exactMoney(strikeOf(o))
  const figure = referenceFigure(t.reference, o.quote)
  const k = strikeText(o)
  const code = o.underlying.code
  if (!t.reference || figure === null || t.moneyness === 'unknown' || t.moneyness === null) {
    return o.kind === 'put'
      ? `No reference price for ${code}. Exercising pays only if ${code} is below ${k} when you do it.`
      : `No reference price for ${code}. Exercising pays only if ${code} is above ${k} when you do it.`
  }
  const source = referenceName(t.reference)
  if (t.moneyness === 'in') {
    return o.kind === 'put'
      ? `In the money at the ${source} ${figure}. You deliver ${qty} and receive ${strike}.`
      : `In the money at the ${source} ${figure}. You pay ${strike} and receive ${qty}.`
  }
  if (t.moneyness === 'at') return `At the money at the ${source} ${figure}: exercising would change nothing at that price.`
  return o.kind === 'put'
    ? `Exercise only if ${code} falls below ${k} before the deadline. At the ${source} ${figure} it is out of the money.`
    : `Exercise only if ${code} rises above ${k} before the deadline. At the ${source} ${figure} it is out of the money.`
}

/** The title, sentence and action of one to-do card. */
export function todoCopy(t: TodoView): TodoCopy {
  const o = t.option
  switch (t.kind) {
    case 'exercise': {
      const soon = t.urgency !== null && t.urgency !== 'far'
      return {
        title: t.actionable ? `Exercise your ${optionPhrase(o)}` : soon ? `Your ${optionPhrase(o)} expires soon` : `Your ${optionPhrase(o)}`,
        body: exerciseBody(t),
        action: t.actionable ? 'exercise' : null,
      }
    }
    case 'claim': {
      const amount = exactMoney(t.amount ?? claimAmount(o))
      return { title: `Claim ${amount} from your exercised ${o.kind}`, body: '', action: 'claim' }
    }
    case 'reclaim': {
      const amount = exactMoney(t.amount ?? requiredCollateral(o))
      return {
        title: o.holder ? `Reclaim ${amount} from your expired ${o.kind}` : `Reclaim ${amount} from your expired offer`,
        body: '',
        action: 'reclaim',
      }
    }
    case 'expired-unexercised':
      return { title: expiredLine(o), body: '', action: null }
  }
}

/** An exercise the wallet cannot cover yet: what it holds of what the exercise takes. */
export function exerciseCover(o: Pick<OptionOffer, 'kind'>, have: Money, need: Money): string {
  const held = formatUnits(have.amount, have.token.decimals)
  return o.kind === 'put' ? `You hold ${held} of the ${money(need)} this exercise delivers.` : `You have ${held} of the ${money(need)} the strike costs.`
}

/** The one line for an option of this wallet that expired without being exercised (no card, no action). */
export const expiredLine = (o: Pick<OptionOffer, 'kind' | 'underlying' | 'underlyingQty' | 'expiry'>): string =>
  `Your ${optionPhrase(o)} expired on ${formatUtc(o.expiry)} without being exercised.`

/** A request of this wallet past its deadline: a cancel takes the escrowed premium back. The body names the request. */
export function expiredRequestCopy(premium: Money, phrase: string): TodoCopy {
  return {
    title: `Take back ${exactMoney(premium)} from your expired request`,
    body: `No maker filled your request for a ${phrase}.`,
    action: null,
  }
}

export const CANCEL_REQUEST = 'Cancel request'

// ------------------------------------------------------------------------------------------- summary

export const SUMMARY_HEADING = 'Summary'
export const SUMMARY = {
  /** The chain records the premium each option was first sold for, not a resale price. */
  premiumPaid: { label: 'Original premiums', hint: 'Of the options you hold or held, as first sold. A resale price is not recorded.' },
  premiumEarned: { label: 'Premium earned' },
  locked: { label: 'Locked' },
  readyBack: { label: 'Ready to take back' },
} as const

// ------------------------------------------------------------------------------------------- tables

export const TABS = { holding: 'Holding', written: 'Written', orders: 'Orders' } as const
export const SHOW_CLOSED = 'Show closed'

export const EMPTY = {
  holding: { title: 'You hold no options.', closedHint: 'Closed positions are hidden.' },
  written: { title: 'You have written no options that found a buyer.', closedHint: 'Closed positions are hidden.' },
  offers: 'No offers of yours are waiting for a buyer.',
  requests: 'No requests of yours are waiting for a maker.',
  listings: 'None of your options is listed for resale.',
} as const

export const SELL_ONE = 'List an option you hold'
/** An offer of the wallet that found a buyer since it last opened Portfolio in this browser. */
export const SOLD_SINCE = 'Sold since your last visit'

export const ORDERS = {
  offers: 'Offers',
  requests: 'Requests',
  listings: 'Resale listings',
} as const

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

/** Where the strike stands against the reference, as the second line under the moneyness word. */
export function strikeAgainst(p: PositionView): string | null {
  const o = p.option
  const figure = referenceFigure(p.reference, o.quote)
  if (!p.reference || figure === null || !p.moneyness || p.moneyness === 'unknown') return null
  const k = strikeText(o)
  const label = p.reference.label
  const priceAbove = (o.kind === 'put') === (p.moneyness === 'out')
  if (p.moneyness === 'at') return `${label} ${figure}, at the strike`
  return priceAbove ? `${label} ${figure}, above the strike ${k}` : `${label} ${figure}, below the strike ${k}`
}

/** What a written option or an open offer of the wallet locks in the contract, as the second line of its row. */
export const LOCKS = (amount: string): string => `Locks ${amount}`

/**
 * What an in-the-money holding is worth if exercised, at the labelled reference, as the second line of its row:
 * `Exercise value 4.00 at the demo price 10.20`. The premium is not counted. Null when it is not in the money.
 */
export function exerciseValueLine(p: PositionView): string | null {
  const o = p.option
  const at = referencePhrase(p.reference, o.quote)
  if (p.exerciseValue === null || p.exerciseValue <= 0n || at === null) return null
  return `Exercise value ${formatUnits(p.exerciseValue, o.quote.decimals)} ${at}`
}

/** The premium of a row on a phone, with what it was. */
export function phonePremium(p: PositionView): string {
  const amount = money({ token: p.option.quote, amount: p.option.totalPremium })
  if (p.role === 'holder') return `Original premium ${amount}`
  if (p.option.holder) return `Earned ${amount}`
  return `Asking ${amount}`
}

// ------------------------------------------------------------------------------------------- position page

/** What the option is, in one sentence, from the side of whoever is looking. */
export function positionSentence(o: OptionOffer, role: Role | null, listing: Money | null = null): string {
  const qty = exactMoney(qtyOf(o))
  const strike = exactMoney(strikeOf(o))
  const collateral = exactMoney(requiredCollateral(o))
  const premium = exactMoney({ token: o.quote, amount: o.totalPremium })
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
      return `Your offer is for sale in Markets. A buyer pays you ${premium} and becomes the holder. Until then you can cancel it and take back your ${collateral}.`
    case 'active':
      if (role === 'holder') {
        const right = put ? `Exercise to sell ${qty} for ${strike}, at any time before the deadline.` : `Exercise to buy ${qty} for ${strike}, at any time before the deadline.`
        return listing ? `${right} It is listed for resale at ${exactMoney(listing)}.` : right
      }
      return put
        ? `If the holder exercises, you buy ${qty} for ${strike}. Your ${collateral} stays in the contract until you claim after an exercise or reclaim after the deadline.`
        : `If the holder exercises, you sell ${qty} for ${strike}. Your ${collateral} stays in the contract until you claim after an exercise or reclaim after the deadline.`
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
  premium: { holder: 'Original premium', writerSold: 'Premium earned', writerOpen: 'Premium asked', none: 'Premium' },
  premiumHint: 'Paid to the maker when the option was first sold. A later resale price is not recorded.',
  resoldHint: 'Paid to the maker when the option was first sold. You bought it from a holder, so it is not what you paid.',
  breakeven: 'Breakeven',
  /** A holder whose own price is not proven: the breakeven comes from the original premium and says so. */
  breakevenOriginal: 'Breakeven at the original premium',
  deadline: 'Deadline',
  collateral: { held: 'Collateral in the contract', paidOut: 'Collateral paid out', returned: 'Collateral returned', owed: 'Collateral' },
  maker: 'Maker',
  holder: 'Holder',
  noHolder: 'No buyer yet',
  moneyness: 'At the reference',
  exerciseValue: 'Exercise value',
  exerciseValueHint: 'At the reference price. The premium is not counted.',
  listing: 'Resale listing',
  claim: 'Waiting for you',
  claimOther: 'Waiting for the maker',
} as const

export const NOT_FOUND_TITLE = 'No option has this number.'
export const POSITION_ERROR_TITLE = 'Could not read this option'

export const NOT_YOURS = 'This wallet is neither the holder nor the maker of this option, so it has no action here.'
export const GUEST_ACTIONS = 'Connect the wallet that holds or wrote this option to act on it.'

/** Why the page shows no action button for a wallet that is on one side of the option, when the header has not said it. */
export function noActionNote(p: PositionView): string | null {
  if (p.closed) return null
  // A maker's live option: the header sentence already says when the collateral comes back.
  if (p.role === 'writer' && p.option.state === 'active') return null
  if (p.role === 'holder' && p.option.state === 'exercised') return 'Nothing is left for you to do. The maker still claims its side from the contract.'
  return 'Nothing for you to do now.'
}

/** Shown when a reminder link asks for an action the position no longer allows. */
export function staleLink(action: PositionAction): string {
  switch (action) {
    case 'exercise':
      return 'This link opens the exercise, which is no longer possible for this wallet.'
    case 'claim':
      return 'This link opens the claim, and nothing is waiting to be claimed by this wallet.'
    case 'reclaim':
      return 'This link opens the reclaim, and no collateral is waiting for this wallet.'
    case 'cancel':
      return 'This link cancels an open offer, and this is no longer an open offer of this wallet.'
    case 'sell':
    case 'unlist':
      return 'This link opens the resale listing, which this wallet can no longer change.'
  }
}

export const PAYOFF_HEADING = 'Payoff at the deadline'
export const LIFECYCLE_HEADING = 'Lifecycle'
export const SERIES_IN_MARKETS = 'This series in Markets'
export const ASSET_IN_MARKETS = (code: string): string => `${code} in Markets`
export const LISTED_IN_MARKETS = 'This listing in Markets'
export const UNTIL = 'Until'

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
  /** Title of the dialog once the ledger confirmed. */
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
    after: `The option is closed for you. The maker can now claim the ${leg} that the exercise left in the contract.`,
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

/** The contract holds less of a token than it owes: one plain line for a row or a card, linked to Reserves. */
export const SHORT_LINE = (codes: string): string => `Clawback shortfall on ${codes}`

// ------------------------------------------------------------------------------------------- calendar

export const CALENDAR = {
  trigger: 'Add the deadline to your calendar',
  short: 'Add to calendar',
  file: 'Download calendar file',
  google: 'Open in Google Calendar',
  downloaded: 'Calendar file downloaded.',
} as const

/** `Exercise deadline: RWA 10.40 put (10.00 RWA)`. */
export const calendarTitle = (o: OptionOffer): string => `Exercise deadline: ${o.underlying.code} ${strikeText(o)} ${o.kind} (${money(qtyOf(o))})`

export function calendarDescription(o: OptionOffer): string {
  const qty = exactMoney(qtyOf(o))
  const strike = exactMoney(strikeOf(o))
  const at = formatUtc(o.expiry)
  return o.kind === 'put'
    ? `Your right to sell ${qty} for ${strike} ends at ${at}. Nothing happens automatically. To exercise you need ${qty} in your wallet. This entry does not update if you sell or exercise the option.`
    : `Your right to buy ${qty} for ${strike} ends at ${at}. Nothing happens automatically. To exercise you need ${strike} in your wallet. This entry does not update if you sell or exercise the option.`
}

/** The maker's entry: after the deadline something waits in the contract either way. */
export function makerCalendarTitle(o: OptionOffer): string {
  const collateral = exactMoney(requiredCollateral(o))
  return o.kind === 'put' ? `Reclaim ${collateral}, or claim the ${o.underlying.code} delivered` : `Reclaim ${collateral}, or claim the ${o.quote.code} paid`
}

export function makerCalendarDescription(o: OptionOffer): string {
  const collateral = exactMoney(requiredCollateral(o))
  const claim = exactMoney(claimAmount(o))
  return `Your ${optionPhrase(o)} at ${strikeText(o)} ends at ${formatUtc(o.expiry)}. If the holder exercised it, claim the ${claim} it left in the contract; if not, reclaim your ${collateral}. Nothing happens automatically, and the entry does not update.`
}

// ------------------------------------------------------------------------------------------- payoff

/** Added to the required caption: what the drawn line includes. */
export const PREMIUM_INCLUDED = 'Premium included.'
/**
 * For a holder whose own price is not proven: the line comes from the original premium, and the caption says so
 * for the whole figure (its breakeven included, whose short label keeps its place on a phone). The two extremes
 * speak to the holder, so they carry the qualifier themselves.
 */
export const ORIGINAL_PREMIUM_INCLUDED = 'Original premium included.'
export const ORIGINAL_PREMIUM_LABELS = {
  maxGain: 'Most you can gain at the original premium',
  maxLoss: 'Most you can lose at the original premium',
} as const
export const PREMIUM_NOT_COUNTED = 'Premium not counted: you bought this option from a holder, and the price you paid is not recorded on the chain.'
export const VIEWER_PAYOFF_NOTE = 'Premium included, from the side of the holder.'
/** A wallet on neither side reads the holder's figure: the extremes are the holder's, not the viewer's. */
export const VIEWER_LABELS = { maxGain: 'Most the holder can gain', maxLoss: 'Most the holder can lose' } as const

/** The holder's readout under the payoff figure: what exercising pays, then what is left after the premium. */
export const READOUT = {
  at: (asset: string, price: string): string => `If ${asset} is at ${price} at the deadline, exercising pays`,
  nothing: (asset: string, price: string): string => `If ${asset} is at ${price} at the deadline, exercising pays nothing.`,
  net: (premium: string, unit: string): string => `After the ${premium}\u00a0${unit} original premium:`,
} as const
