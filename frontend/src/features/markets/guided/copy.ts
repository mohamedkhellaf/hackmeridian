// Every sentence of the guided flow, per intent. Whole sentences only: a figure is dropped into a template,
// nothing is glued together from fragments. The words put, call, strike and premium each appear once, in
// passing (`lead`), and never carry the meaning alone. Required sentences are not here: they come from
// core/disclosures. No promise words (brief section 0), no em dashes, no arrows. A figure of the deal is stated
// in the note's rows and in the sentence of the closing block, and nowhere else unless it is a new fact.
import type { GuidedIntent } from '../../../core/payoff/strategies'
import type { PayoffGlyph } from '../../../ui'

/** What a template needs. Every figure is already formatted from exact amounts by the caller. */
export interface Words {
  /** Asset code, quote code. */
  a: string
  q: string
  /** Quantity of the asset, strike per unit, strike for the whole quantity. */
  qty: string
  strike: string
  strikeTotal: string
  /** Total premium, or null when no price is known yet. */
  premium: string | null
}

export interface IntentCopy {
  glyph: PayoffGlyph
  /** The heading of the note: the intent with the asset in it. */
  heading: (a: string) => string
  /** One line about the intent, read with its name in the intent picker. */
  line: string
  /** Whether money leaves or arrives at the start. */
  money: { label: string; value: string }
  /** The contract in two words, for the corner of the note. */
  contract: string
  /** Introduces the contract words once, in a full sentence. */
  lead: (a: string, q: string) => string
  /** Labels of the three inputs (brief 4.3). */
  qtyLabel: string
  strikeLabel: string
  /** The chosen level on the chart and in a suggestion: `Floor 99.00`. */
  level: (strike: string) => string
  /** Direct labels of the two chart lines. */
  withLabel: string
  withoutLabel: string
  /** `more than …` and `less than …`, after a signed difference. */
  moreThan: string
  lessThan: string
  sameAs: string
  /** Accessible name of the chart. */
  chartTitle: (w: Words) => string
  /** The whole deal in one sentence, in the closing block. */
  summary: (w: Words & { deadline: string }) => string
}

export const INTENT_COPY: Record<GuidedIntent, IntentCopy> = {
  floor: {
    glyph: 'long-put',
    heading: (a) => `A floor on ${a}`,
    line: 'Keep the right to sell at a price you choose, until a date you choose.',
    money: { label: 'You pay', value: 'a premium, once, now' },
    contract: 'A put, bought',
    lead: (a) =>
      `You keep your ${a} and buy the right to sell it at your floor until the deadline. That right is called a put, its price is the premium, and the floor is its strike.`,
    qtyLabel: 'I hold',
    strikeLabel: 'Floor, per unit',
    level: (strike) => `Floor ${strike}`,
    withLabel: 'With the floor',
    withoutLabel: 'Without',
    moreThan: 'more than without the floor',
    lessThan: 'less than without the floor',
    sameAs: 'the same as without the floor',
    chartTitle: (w) => `What ${w.qty} ${w.a} would be worth to you at the deadline, with a floor at ${w.strike} ${w.q} and without`,
    summary: (w) => `You pay ${w.premium} ${w.q} now. Until ${w.deadline} you can sell ${w.qty} ${w.a} for ${w.strikeTotal} ${w.q}.`,
  },
  'earn-hold': {
    glyph: 'short-call',
    heading: (a) => `Earn on the ${a} you hold`,
    line: 'Lock what you hold and agree to sell it at a higher price if a buyer asks before the deadline.',
    money: { label: 'You are paid', value: 'a premium now' },
    contract: 'A call, written',
    lead: (a) =>
      `You lock your ${a} in the contract and agree to sell it at your price if the buyer asks before the deadline. The buyer's right is called a call, what they pay you is the premium, and your price is its strike.`,
    qtyLabel: 'I lock',
    strikeLabel: 'Sell at, per unit',
    level: (strike) => `Sell at ${strike}`,
    withLabel: 'With the agreement',
    withoutLabel: 'Just holding',
    moreThan: 'more than just holding',
    lessThan: 'less than just holding',
    sameAs: 'the same as just holding',
    chartTitle: (w) => `What ${w.qty} ${w.a} would be worth to you at the deadline, with an agreement to sell at ${w.strike} ${w.q} and without`,
    summary: (w) => `You are paid ${w.premium} ${w.q} now and lock ${w.qty} ${w.a}. Until ${w.deadline} the buyer can take it for ${w.strikeTotal} ${w.q}.`,
  },
  'earn-buy': {
    glyph: 'short-put',
    heading: (a) => `Earn while waiting to buy ${a}`,
    line: 'Lock USDx and agree to buy at a lower price if the other side sells to you before the deadline.',
    money: { label: 'You are paid', value: 'a premium now' },
    contract: 'A put, written',
    lead: (a, q) =>
      `You lock ${q} in the contract and agree to buy ${a} at your price if the other side sells to you before the deadline. Their right is called a put, what the put's buyer pays you is the premium, and your price is its strike.`,
    qtyLabel: 'I would buy',
    strikeLabel: 'At, per unit',
    level: (strike) => `Buy at ${strike}`,
    withLabel: 'With the agreement',
    withoutLabel: 'Keeping the cash',
    moreThan: 'more than keeping the cash',
    lessThan: 'less than keeping the cash',
    sameAs: 'the same as keeping the cash',
    chartTitle: (w) => `What you would hold at the deadline with an agreement to buy ${w.qty} ${w.a} at ${w.strike} ${w.q}, and without`,
    summary: (w) => `You are paid ${w.premium} ${w.q} now and lock ${w.strikeTotal} ${w.q}. Until ${w.deadline} the put's buyer can sell you ${w.qty} ${w.a} for it.`,
  },
  'lock-buy': {
    glyph: 'long-call',
    heading: (a) => `Lock a buy price for ${a}`,
    line: 'Keep the right to buy at a price you choose, until a date you choose.',
    money: { label: 'You pay', value: 'a premium, once, now' },
    contract: 'A call, bought',
    lead: (a) =>
      `You buy the right to buy ${a} at your price until the deadline. That right is called a call, its price is the premium, and your price is its strike.`,
    qtyLabel: 'I want',
    strikeLabel: 'At most, per unit',
    level: (strike) => `At most ${strike}`,
    withLabel: 'With the locked price',
    withoutLabel: 'Keeping the cash',
    moreThan: 'more than keeping the cash',
    lessThan: 'less than keeping the cash',
    sameAs: 'the same as keeping the cash',
    chartTitle: (w) => `What you would hold at the deadline with the right to buy ${w.qty} ${w.a} at ${w.strike} ${w.q}, and without`,
    summary: (w) => `You pay ${w.premium} ${w.q} now. Until ${w.deadline} you can buy ${w.qty} ${w.a} for ${w.strikeTotal} ${w.q}.`,
  },
}

// ------------------------------------------------------------------------------------------- picker

export const PICKER_LABEL = 'What do you want to do?'

// ------------------------------------------------------------------------------------------- terms

export const UNTIL_LABEL = 'Until'
export const STRIKE_CHIPS_LABEL: Record<GuidedIntent, string> = {
  floor: 'Choose your floor',
  'earn-hold': 'Choose your sale price',
  'earn-buy': 'Choose your buy price',
  'lock-buy': 'Choose your highest buy price',
}
export const EXPIRY_CHIPS_LABEL = 'Choose the deadline'

/** The key under the chips, beside the tick it explains. Shown only when a chip carries the tick. */
export const FUNDED_KEY: Record<'buy' | 'write', string> = {
  buy: 'Funded offer available',
  write: 'A buyer is waiting',
}
export const FUNDED_WORD: Record<'buy' | 'write', { yes: string; no: string }> = {
  buy: { yes: 'funded offer available', no: 'no offer yet' },
  write: { yes: 'a buyer is waiting', no: 'no buyer yet' },
}

export const QTY_EMPTY = 'Enter a quantity.'
export const HOLD = (amount: string, code: string) => `You hold ${amount} ${code}`
export const HAVE = (amount: string, code: string) => `You have ${amount} ${code}`
export const MAX_HOLDING = (amount: string, code: string) => `use all you hold, ${amount} ${code}`
export const MAX_LOT = (amount: string, code: string) => `the largest offer you hold enough for, ${amount} ${code}`
export const MAX_AFFORD = (amount: string, code: string) => `the most your balance pays for, ${amount} ${code}`
export const LOCKS = (amount: string, q: string) => `Locks ${amount} ${q} in the contract.`
export const NEEDS_LATER = (amount: string, q: string) => `Buying at this price later takes ${amount} ${q}.`
export const OVER_HOLDING = (held: string, a: string) => `You hold ${held} ${a}. A floor on more than you hold is a bet on a fall, not a floor.`
export const SHORT_ASSET = (held: string, need: string, short: string, a: string) =>
  `You hold ${held} ${a}; locking ${need} ${a} needs ${short} ${a} more. Lower the quantity or get test funds.`
export const SHORT_QUOTE = (have: string, need: string, short: string, q: string) =>
  `You have ${have} ${q}; locking ${need} ${q} needs ${short} ${q} more. Lower the quantity or the price, or get test funds.`
/** Under the quantity: the lots that exist at the chosen price and date. Offers are sold and requests filled whole. */
export const LOTS: Record<'buy' | 'write', (lots: string, a: string) => string> = {
  buy: (lots, a) => `Offers at this price and date come in lots of ${lots} ${a}.`,
  write: (lots, a) => `Requests at this price and date are for ${lots} ${a}.`,
}
export const DISTANCE_FULL = (short: string, label: string, price: string) => `${short} the ${label}, ${price}`
export const AT_REFERENCE = (label: string, price: string) => `At the ${label}, ${price}`
export const TIME_LEFT = (left: string) => `${left} left`
export const YOUR_TIME = (local: string) => `${local}, your time`
export const qtyNotExact = (a: string) => `At this price the total is not an exact amount. Use fewer decimals of ${a}.`
/** Said once above the chips when a link named a price or a date that is not on the list. */
export const OFF_GRID = {
  strike: (asked: string, shown: string, q: string) => `${asked} ${q} is not a listed price. Showing ${shown} ${q}.`,
  expiry: (asked: string, shown: string) => `${asked} is not a listed deadline. Showing ${shown}.`,
}

/** Said when the deadline is close (brief D17): 48 hours, 2 hours, and the last 15 minutes. */
export const DEADLINE_NEAR: Record<'within48h' | 'within2h' | 'within15min', { title: string; body: string }> = {
  within48h: {
    title: 'This deadline is under 48 hours away',
    body: 'Whoever holds the right has little time left to use it. A later date leaves more room.',
  },
  within2h: {
    title: 'This deadline is under 2 hours away',
    body: 'Whoever holds the right has to act almost at once. A later date leaves more room.',
  },
  within15min: {
    title: 'This deadline is under 15 minutes away',
    body: 'A signature may not land before it. Choose a later date.',
  },
}

// ------------------------------------------------------------------------------------------- available

export const AVAILABLE_HEADING = 'Available now for exactly these terms'
/** What the number beside the heading is, by where the matched order comes from. */
export const SERIAL_LABEL = { maker: 'Offer No.', resale: 'Listing No.', bid: 'Request No.' } as const
/** The buyer side with no exact match: a smaller offer of the same terms exists, or none does. */
export const NO_SINGLE_OFFER = (qty: string, a: string) => `No single offer for ${qty} ${a} at these terms`
export const NO_OFFER_HEADING = 'No offer at these terms'
/** The seller side opens on posting an offer: that is the normal way to earn here (E13). */
export const WRITE_HEADING = 'Post an offer at your price'
export const NO_BUYER = 'No buyer is waiting for these terms.'
/** While the quantity field is empty: what is funded cannot be matched yet. */
export const NO_QTY_HEADING: Record<'buy' | 'write', string> = { buy: 'Offers come in fixed quantities', write: 'Requests come in fixed quantities' }
export const SUGGESTIONS_HEADING: Record<'buy' | 'write', string> = { buy: 'Nearest offers', write: 'Requests at other terms' }
export const USE_TERMS = 'Use these terms'
export const READ_AT = (time: string) => `Read at ${time}. Could not refresh.`

/** Read out when a change of terms changes what is available (the block sits well below the chips). */
export const ANNOUNCE = {
  offer: (premium: string, q: string) => `A funded offer matches these terms. You pay ${premium} ${q}.`,
  listing: (premium: string, q: string) => `A resale listing matches these terms. You pay ${premium} ${q}.`,
  request: (premium: string, q: string) => `A buyer's request matches these terms. You are paid ${premium} ${q}.`,
  nothing: 'Nothing funded for exactly these terms.',
  terms: (qty: string, a: string, strike: string, q: string, day: string) => `Terms changed: ${qty} ${a} at ${strike} ${q} until ${day}.`,
  stale: 'Could not refresh. The figures are from the last successful read.',
} as const

export const NOT_FOUND = (w: Words & { deadline: string }) =>
  `No maker offers ${w.qty} ${w.a} at ${w.strike} ${w.q} until ${w.deadline}. An offer is sold whole, so the quantity has to match too.`
export const NOT_FOUND_NO_QTY: Record<'buy' | 'write', string> = {
  buy: 'Enter a quantity to see the offers that match it. An offer is sold whole.',
  write: 'Enter a quantity to see the requests that match it. A request is filled whole.',
}

const COUNT_WORD = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'] as const
const countWord = (n: number) => COUNT_WORD[n] ?? String(n)

/** Smaller offers of the same terms, taken one by one. `count` is at least 1. */
export const COVER = (count: number, total: string, qty: string, a: string) =>
  count === 1
    ? `A smaller offer at these terms covers ${total} of your ${qty} ${a}. It is sold whole.`
    : `${countWord(count)} smaller offers at these terms cover ${total} of your ${qty} ${a}, in ${countWord(count).toLowerCase()} purchases. Each is sold whole and signed on its own.`
export const START_WITH = (qty: string, a: string, perUnit: string) => `Start with ${qty} ${a} at ${perUnit}`

/** One suggestion, led by what differs from the terms asked for. */
export const DIFFERS = {
  qty: (theirs: string, yours: string, a: string) => `${theirs} ${a} instead of ${yours}`,
  strike: (level: string, yours: string) => `${level} instead of ${yours}`,
  expiry: (theirs: string, yours: string) => `Until ${theirs} instead of ${yours}`,
}
export const PER_UNIT = (perUnit: string, q: string) => `${perUnit} ${q} per unit`
export const IN_TOTAL = (total: string, q: string) => `${total} ${q} in total`

export const FALLBACK: Record<'buy' | 'write', { heading: string; body: (collateral: string) => string; field: string; first: string }> = {
  buy: {
    heading: 'Post a request and escrow your premium',
    body: () => 'You name the premium you would pay. The contract holds it until a maker accepts your terms, and you can cancel and take it back while nobody has.',
    field: 'Premium you offer, in total',
    first: 'No offer at this price and date to compare with.',
  },
  write: {
    heading: WRITE_HEADING,
    body: (collateral) => `You name the premium you ask and lock ${collateral}. You are paid when a buyer takes the offer, and you can cancel while nobody has.`,
    field: 'Premium you ask, in total',
    first: 'Nobody offers this price and date yet. Yours would be the first offer.',
  },
}
export const LOWEST_OFFER = (perUnit: string, q: string, qty: string, a: string) => `Lowest open offer at this price and date: ${perUnit} ${q} per unit, for ${qty} ${a}.`
export const matchPrice = (perUnit: string) => `Use ${perUnit} per unit`
export const perUnitHint = (perUnit: string, q: string) => `${perUnit} ${q} per unit.`

/** Field labels of the found order. */
export const FIELD = {
  perUnit: 'Premium, per unit',
  resalePerUnit: 'Price, per unit',
  pay: 'You pay',
  paid: 'You are paid',
  lock: 'You lock',
  maker: 'Maker',
  seller: 'Seller',
  buyer: 'Buyer',
  collateral: 'Collateral',
} as const
export const PAID_ONCE = 'Once, when you sign.'
export const PAID_AT_SIGN = 'When you sign, in the same transaction.'
export const LOCKED_IN_CONTRACT = 'Locked in the contract.'
export const LOCK_UNTIL = 'In the contract until you claim after an exercise or reclaim after the deadline.'

/** What the wallet already has for these terms: said first, so a second order is never the obvious next step. */
export const OWN = {
  holding: (w: Words & { deadline: string }) => `You already hold these terms: ${w.qty} ${w.a} at ${w.strike} ${w.q} until ${w.deadline}.`,
  written: (w: Words & { deadline: string }) => `A buyer took your offer at these terms: ${w.qty} ${w.a} at ${w.strike} ${w.q} until ${w.deadline}.`,
  offer: (serial: string, qty: string, a: string, premium: string, q: string) => `Your offer No. ${serial} is open at these terms: ${qty} ${a}, asking ${premium} ${q}.`,
  request: (serial: string, qty: string, a: string, premium: string, q: string) => `Your request No. ${serial} is open at these terms: ${qty} ${a}, ${premium} ${q} escrowed.`,
} as const
export const VIEW = { position: 'View position', offer: 'View your offer', request: 'View your request' } as const

// ------------------------------------------------------------------------------------------- outcome

export const OUTCOME_HEADING = 'What you would hold at the deadline'
export const DETAIL_HEADING = 'At any price at the deadline'
export const OWN_PREMIUM_NOTE = (premium: string, q: string) => `With your premium of ${premium} ${q}. Someone has to accept it first.`
export const ASSUMED_NOTE = (perUnit: string, q: string) => `Assuming ${perUnit} ${q} per unit, the lowest open offer at this price and date.`
export const NEED_QTY = 'Enter a quantity to see what you would hold.'
export const NEED_PREMIUM = 'Enter a premium to see what you would hold.'
export const SLIDER_LABEL = (a: string) => `Assumed ${a} price at the deadline`
export const READOUT_LABEL = (a: string, price: string) => `If ${a} is at ${price} at the deadline`
export const CARDS_LABEL = 'A lower and a higher price at the deadline'

export interface OutcomeWords extends Omit<Words, 'premium'> {
  /** The premium the figures use, formatted. */
  premium: string
  /** Value of the asset quantity at the assumed price, formatted. */
  value: string
}

/** What the user would hold at an assumed price, in one sentence. `used` is true when the right would be used there. */
export function outcomeSentence(intent: GuidedIntent, used: boolean, w: OutcomeWords): string {
  const p = w.premium
  switch (intent) {
    case 'floor':
      return used
        ? `You sell ${w.qty} ${w.a} at ${w.strike} and hold ${w.strikeTotal} ${w.q}, less the ${p} you paid.`
        : `You keep ${w.qty} ${w.a}, worth ${w.value} ${w.q} at that price, less the ${p} you paid.`
    case 'earn-hold':
      return used
        ? `The buyer takes your ${w.qty} ${w.a} at ${w.strike}. You hold ${w.strikeTotal} ${w.q}, plus the ${p} premium.`
        : `You keep ${w.qty} ${w.a}, worth ${w.value} ${w.q} at that price, plus the ${p} premium.`
    case 'earn-buy':
      return used
        ? `You buy ${w.qty} ${w.a} at ${w.strike}. You hold ${w.a} worth ${w.value} ${w.q} at that price, plus the ${p} premium.`
        : `Nobody sells to you. You keep your ${w.strikeTotal} ${w.q}, plus the ${p} premium.`
    case 'lock-buy':
      return used
        ? `You buy ${w.qty} ${w.a} at ${w.strike}. You hold ${w.a} worth ${w.value} ${w.q} at that price, less the ${p} you paid.`
        : `You do not buy. You keep your ${w.strikeTotal} ${w.q}, less the ${p} you paid.`
  }
}

export const SCENARIO = {
  low: (a: string, price: string) => `If ${a} falls to ${price}`,
  high: (a: string, price: string) => `If ${a} rises to ${price}`,
}

export const FACT = {
  breakeven: 'Breakeven',
  maxLoss: 'Most you can lose',
  giveUp: 'You give up',
} as const

export interface FactWords extends Words {
  /** The premium per unit the figures use, formatted. */
  premiumPerUnit: string
}

/** What the breakeven is for each intent, in its own words (the label stays "Breakeven", as in the ticket). */
export const BREAKEVEN_HINT: Record<GuidedIntent, (w: FactWords) => string> = {
  floor: (w) => `Your floor after the premium: ${w.strike} less the ${w.premiumPerUnit} you pay per ${w.a}.`,
  'earn-hold': (w) => `Your sale price with the premium: ${w.strike} plus the ${w.premiumPerUnit} you are paid per ${w.a}.`,
  'earn-buy': (w) => `Your buy price after the premium: ${w.strike} less the ${w.premiumPerUnit} you are paid per ${w.a}.`,
  'lock-buy': (w) => `Your buy price with the premium: ${w.strike} plus the ${w.premiumPerUnit} you pay per ${w.a}.`,
}

/** The hint of "Most you can lose": the same figure as the ticket's, from core/payoff/leg. Not used for earn-hold. */
export const MAX_LOSS_HINT: Record<Exclude<GuidedIntent, 'earn-hold'>, (w: FactWords) => string> = {
  floor: () => 'The premium, if you never use the floor.',
  'lock-buy': () => 'The premium, if you never use the right.',
  'earn-buy': (w) => `If ${w.a} fell to zero after you bought it: the ${w.strikeTotal} ${w.q} you locked, less the premium.`,
}

/** A written covered call has no loss figure (E14): what is given up, and what cannot be owed. */
export const GIVE_UP = {
  value: (w: Words) => `Every rise above ${w.strike} ${w.q} per ${w.a}`,
  hint: (w: Words) => `You cannot owe more than the ${w.qty} ${w.a} you lock; it can still fall in price.`,
}

// ------------------------------------------------------------------------------------------- timeline

export const WHEN_HEADING = 'What happens and when'
export const WHEN_NEED_QTY = 'Enter a quantity to see each step with its amounts.'
export const WHEN = {
  now: 'Now',
  until: 'Until the deadline',
  at: (day: string, time: string) => `At the deadline, ${day}, ${time}`,
  after: 'After the deadline',
} as const

export interface Step {
  title: string
  body: string
}

/** How the order comes about: an order that is already funded, or terms of the user's own waiting for a taker. */
export type Route = 'take' | 'own'

const AT_HOLDER = 'If you have not exercised by then, the right expires and the premium stays with the maker.'
const AT_REQUEST =
  'If a maker accepted and you have not exercised by then, the right expires and the premium stays with the maker. If nobody accepted, the request can no longer be filled.'
const escrowNow = (p: string | null, q: string, locks: string) =>
  p
    ? `Your ${p} ${q} waits in the contract until a maker accepts your terms and locks ${locks}. Until then you can cancel and take it back.`
    : `Your premium waits in the contract until a maker accepts your terms and locks ${locks}. Until then you can cancel and take it back.`

export function timelineSteps(intent: GuidedIntent, route: Route, w: Words): { now: Step; until: Step; at: Step; after: Step } {
  const p = w.premium
  const own = route === 'own'
  switch (intent) {
    case 'floor':
      return {
        now: own
          ? { title: 'You escrow your premium', body: escrowNow(p, w.q, `${w.strikeTotal} ${w.q}`) }
          : { title: 'You pay the premium', body: p ? `${p} ${w.q}, once.` : 'Once, when you sign.' },
        until: own
          ? {
              title: 'If a maker accepts, you can sell at your floor',
              body: `From then until the deadline you can deliver ${w.qty} ${w.a} and receive ${w.strikeTotal} ${w.q} in one transaction. This is called exercising. Until a maker accepts you have no floor.`,
            }
          : {
              title: 'You can sell at your floor',
              body: `At any moment you can deliver ${w.qty} ${w.a} and receive ${w.strikeTotal} ${w.q} in one transaction. This is called exercising. You decide if and when.`,
            },
        at: own
          ? { title: 'The deadline passes', body: AT_REQUEST }
          : { title: 'The deadline passes', body: AT_HOLDER },
        after: own
          ? { title: 'You take back an unfilled premium', body: 'If nobody accepted, cancel the request: the premium stays in the contract until you do.' }
          : { title: 'The maker takes back the collateral', body: `If you did not exercise, you still hold your ${w.a} and there is nothing left for you to do.` },
      }
    case 'lock-buy':
      return {
        now: own
          ? { title: 'You escrow your premium', body: escrowNow(p, w.q, `${w.qty} ${w.a}`) }
          : { title: 'You pay the premium', body: p ? `${p} ${w.q}, once.` : 'Once, when you sign.' },
        until: own
          ? {
              title: 'If a maker accepts, you can buy at your price',
              body: `From then until the deadline you can pay ${w.strikeTotal} ${w.q} and receive ${w.qty} ${w.a} in one transaction. This is called exercising. Until a maker accepts you have no right to buy.`,
            }
          : {
              title: 'You can buy at your price',
              body: `At any moment you can pay ${w.strikeTotal} ${w.q} and receive ${w.qty} ${w.a} in one transaction. This is called exercising. You need the ${w.strikeTotal} ${w.q} at that moment.`,
            },
        at: own
          ? { title: 'The deadline passes', body: AT_REQUEST }
          : { title: 'The deadline passes', body: AT_HOLDER },
        after: own
          ? { title: 'You take back an unfilled premium', body: 'If nobody accepted, cancel the request: the premium stays in the contract until you do.' }
          : { title: 'The maker takes back the collateral', body: 'If you did not exercise, there is nothing left for you to do.' },
      }
    case 'earn-hold':
      return {
        now: {
          title: `You lock ${w.qty} ${w.a}`,
          body: own ? `You are paid only when a buyer takes your offer. Until then you can cancel and take your ${w.a} back.` : 'The premium the buyer escrowed is paid to you in the same transaction.',
        },
        until: own
          ? {
              title: `If a buyer takes your offer, they can take your ${w.a}`,
              body: `From then until the deadline, not only at the end, the buyer can pay ${w.strikeTotal} ${w.q} and receive your ${w.qty} ${w.a}. This is called exercising. The ${w.q} then waits in the contract until you claim it.`,
            }
          : {
              title: `The buyer can take your ${w.a}`,
              body: `At any moment, not only at the end, the buyer can pay ${w.strikeTotal} ${w.q} and receive your ${w.qty} ${w.a}. This is called exercising. The ${w.q} then waits in the contract until you claim it.`,
            },
        at: {
          title: 'The deadline passes',
          body: own ? `If nobody took the offer, or the buyer has not exercised by then, your ${w.a} stays locked until you act.` : `If the buyer has not exercised by then, your ${w.a} stays locked until you act.`,
        },
        after: {
          title: `You reclaim your ${w.a}`,
          body: own
            ? `One transaction takes your ${w.qty} ${w.a} back from the contract. You keep the premium only if a buyer took the offer.`
            : `One transaction takes your ${w.qty} ${w.a} back from the contract. The premium is yours either way.`,
        },
      }
    case 'earn-buy':
      return {
        now: {
          title: `You lock ${w.strikeTotal} ${w.q}`,
          body: own ? `You are paid only when a buyer takes your offer. Until then you can cancel and take your ${w.q} back.` : "The premium the put's buyer escrowed is paid to you in the same transaction.",
        },
        until: own
          ? {
              title: 'If a buyer takes your offer, they can sell to you',
              body: `From then until the deadline the put's buyer can deliver ${w.qty} ${w.a} and take your ${w.strikeTotal} ${w.q}, even if ${w.a} is then worth far less. This is called exercising. The ${w.a} then waits in the contract until you claim it.`,
            }
          : {
              title: "The put's buyer can sell to you",
              body: `At any moment the put's buyer can deliver ${w.qty} ${w.a} and take your ${w.strikeTotal} ${w.q}, even if ${w.a} is then worth far less. This is called exercising. The ${w.a} then waits in the contract until you claim it.`,
            },
        at: {
          title: 'The deadline passes',
          body: own
            ? `If nobody took the offer, or the put's buyer has not exercised by then, your ${w.q} stays locked until you act.`
            : `If the put's buyer has not exercised by then, your ${w.q} stays locked until you act.`,
        },
        after: {
          title: `You reclaim your ${w.q}`,
          body: own
            ? `One transaction takes your ${w.strikeTotal} ${w.q} back from the contract. You keep the premium only if a buyer took the offer.`
            : `One transaction takes your ${w.strikeTotal} ${w.q} back from the contract. The premium is yours either way.`,
        },
      }
  }
}

// ------------------------------------------------------------------------------------------- action

export const ACTION = {
  offer: 'Review this offer',
  listing: 'Review this listing',
  request: 'Review this request',
  ownRequest: 'Review your request',
  ownOffer: 'Review your offer',
  postRequest: 'Post a request',
  postOffer: 'Post an offer',
  connect: 'Connect wallet',
  ownPriceRequest: 'Post a request at your own price',
  ownPriceOffer: 'Post an offer at your own price',
} as const
export const ACTION_REGION = 'Next step'
export const OWN_SUMMARY: Record<'buy' | 'write', (w: Words & { collateral: string; deadline: string }) => string> = {
  buy: (w) => `You escrow ${w.premium} ${w.q} now. It waits in the contract until a maker accepts ${w.qty} ${w.a} at ${w.strike} ${w.q} until ${w.deadline}, or until you cancel.`,
  write: (w) => `You lock ${w.collateral} and ask ${w.premium} ${w.q}. You are paid only if a buyer takes the offer before ${w.deadline}.`,
}
/** What the figure in the action bar is. */
export const BAR_FIGURE = { pay: 'You pay', paid: 'You are paid', escrow: 'You escrow', ask: 'You ask' } as const
export const NEED_QTY_ACTION = 'Enter a quantity first.'
/** The wallet cannot pay what the action needs (E25). */
export const CANNOT_PAY = (have: string, need: string, q: string) => `You have ${have} ${q}; this needs ${need} ${q}.`
export const GET_FUNDS = 'Get test funds'

// ------------------------------------------------------------------------------------------- states

export const LOADING_LABEL = 'Loading the guided flow'
export const LOAD_ERROR_TITLE = 'Could not read this market'
export const LOAD_ERROR_BODY = 'Nothing was read from the contract. Check your connection and try again.'
export const RETRY = 'Try again'
export const NOT_LISTED = 'This asset is not listed in the contract.'
export const NO_GRID = 'There is no reference price, and no offer with an exact price per unit, to build a list of prices from.'
export const NO_GRID_HINT = 'Switch to Chain to post the first offer or request with terms of your own.'
/** The same, when offers off the list exist: Chain lists them under "Other offers". */
export const NO_GRID_OTHERS = (count: number) =>
  count === 1 ? 'Switch to Chain: the one offer on this asset is listed there, under Other offers.' : `Switch to Chain: the ${count} offers on this asset are listed there, under Other offers.`
