// Every sentence of the guided flow, per intent. Whole sentences only: a figure is dropped into a template,
// nothing is glued together from fragments. The words put, call, strike and premium each appear once, in
// passing (`lead`), and never carry the meaning alone. Required sentences are not here: they come from
// core/disclosures. No promise words (brief section 0), no em dashes, no arrows.
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
  /** One line in the intent picker. */
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
  /** The chosen level on the chart: `Floor 99.00`. */
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
  /** The whole deal in one sentence, above the action. */
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
    line: 'Lock USDx and agree to buy at a lower price if a holder asks before the deadline.',
    money: { label: 'You are paid', value: 'a premium now' },
    contract: 'A put, written',
    lead: (a, q) =>
      `You lock ${q} in the contract and agree to buy ${a} at your price if the holder asks before the deadline. The holder's right is called a put, what they pay you is the premium, and your price is its strike.`,
    qtyLabel: 'I would buy',
    strikeLabel: 'At, per unit',
    level: (strike) => `Buy at ${strike}`,
    withLabel: 'With the agreement',
    withoutLabel: 'Keeping the cash',
    moreThan: 'more than keeping the cash',
    lessThan: 'less than keeping the cash',
    sameAs: 'the same as keeping the cash',
    chartTitle: (w) => `What you would hold at the deadline with an agreement to buy ${w.qty} ${w.a} at ${w.strike} ${w.q}, and without`,
    summary: (w) => `You are paid ${w.premium} ${w.q} now and lock ${w.strikeTotal} ${w.q}. Until ${w.deadline} the holder can sell you ${w.qty} ${w.a} for it.`,
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
export const SECONDARY_INTENT_LEAD = 'Something else'

// ------------------------------------------------------------------------------------------- terms

export const UNTIL_LABEL = 'Until'
export const STRIKE_CHIPS_LABEL: Record<GuidedIntent, string> = {
  floor: 'Choose your floor',
  'earn-hold': 'Choose your sale price',
  'earn-buy': 'Choose your buy price',
  'lock-buy': 'Choose your highest buy price',
}
export const EXPIRY_CHIPS_LABEL = 'Choose the deadline'

/** Under the chips: what the tick and the dashed outline mean. */
export const FUNDED_LEGEND: Record<'buy' | 'write', string> = {
  buy: 'A tick marks a choice with a funded offer you can take now. A dashed one has none yet: you can post a request for it.',
  write: 'A tick marks a choice where a buyer has already escrowed a premium. A dashed one has no buyer yet: you can post your own offer.',
}
export const FUNDED_WORD: Record<'buy' | 'write', { yes: string; no: string }> = {
  buy: { yes: 'funded offer available', no: 'no offer yet' },
  write: { yes: 'a buyer is waiting', no: 'no buyer yet' },
}

export const QTY_EMPTY = 'Enter a quantity.'
export const HOLD = (amount: string, code: string) => `You hold ${amount} ${code}`
export const HAVE = (amount: string, code: string) => `You have ${amount} ${code}`
export const MAX_HOLDING = (amount: string, code: string) => `use all you hold, ${amount} ${code}`
export const MAX_AFFORD = (amount: string, code: string) => `the most your balance pays for, ${amount} ${code}`
export const LOCKS = (amount: string, q: string) => `Locks ${amount} ${q} in the contract.`
export const NEEDS_LATER = (amount: string, q: string) => `Buying at this price later takes ${amount} ${q}.`
export const OVER_HOLDING = (held: string, a: string) => `You hold ${held} ${a}. A floor on more than you hold is a bet on a fall, not a floor.`
export const SHORT_ASSET = (held: string, need: string, short: string, a: string) =>
  `You hold ${held} ${a}; locking ${need} ${a} needs ${short} ${a} more. Lower the quantity or get test funds.`
export const SHORT_QUOTE = (have: string, need: string, short: string, q: string) =>
  `You have ${have} ${q}; locking ${need} ${q} needs ${short} ${q} more. Lower the quantity or the price, or get test funds.`
export const DISTANCE_FULL = (short: string, label: string, price: string) => `${short} the ${label}, ${price}`
export const AT_REFERENCE = (label: string, price: string) => `At the ${label}, ${price}`
export const TIME_LEFT = (left: string) => `${left} left`
export const YOUR_TIME = (local: string) => `${local}, your time`
export const qtyNotExact = (a: string) => `At this price the total is not an exact amount. Use fewer decimals of ${a}.`

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
/** What the number on the note's serial line is, by where the matched order comes from. */
export const SERIAL_LABEL = { maker: 'Offer No.', resale: 'Listing No.', bid: 'Request No.' } as const
export const NOTHING_HEADING = 'Nothing funded for exactly these terms'
/** While the quantity field is empty: what is funded cannot be matched yet. */
export const NO_QTY_HEADING: Record<'buy' | 'write', string> = { buy: 'Offers come in fixed quantities', write: 'Requests come in fixed quantities' }
export const SUGGESTIONS_HEADING = 'Nearest funded terms'
export const USE_TERMS = 'Use these terms'

/** Read out when a change of terms changes what is available (the block sits well below the chips). */
export const ANNOUNCE = {
  offer: (premium: string, q: string) => `A funded offer matches these terms. You pay ${premium} ${q}.`,
  listing: (premium: string, q: string) => `A resale listing matches these terms. You pay ${premium} ${q}.`,
  request: (premium: string, q: string) => `A buyer's request matches these terms. You are paid ${premium} ${q}.`,
  nothing: 'Nothing funded for exactly these terms.',
} as const

/** One sentence on what was found, by intent and by where the order comes from. */
export const FOUND: Record<GuidedIntent, (w: Words & { collateral: string }) => string> = {
  floor: (w) => `A maker sells this floor for ${w.premium} ${w.q}. The ${w.collateral} they would pay you is already locked in the contract.`,
  'lock-buy': (w) => `A maker sells this right for ${w.premium} ${w.q}. The ${w.collateral} they would deliver is already locked in the contract.`,
  'earn-hold': (w) => `A buyer has escrowed ${w.premium} ${w.q} for exactly this. You are paid when you sign, and you lock ${w.collateral}.`,
  'earn-buy': (w) => `A buyer has escrowed ${w.premium} ${w.q} for exactly this. You are paid when you sign, and you lock ${w.collateral}.`,
}
export const FOUND_RESALE = (w: Words & { collateral: string }) =>
  `A holder is reselling this right for ${w.premium} ${w.q}. The maker's ${w.collateral} stays locked in the contract.`

/** The same deal in the contract's own words: where put, call, strike and premium are named with their figures. */
export const IN_CONTRACT_WORDS: Record<GuidedIntent, (w: Words) => string> = {
  floor: (w) => `In contract words: you buy a put on ${w.qty} ${w.a}, strike ${w.strike} ${w.q}, premium ${w.premium} ${w.q}. It can be used at any time before the deadline.`,
  'lock-buy': (w) => `In contract words: you buy a call on ${w.qty} ${w.a}, strike ${w.strike} ${w.q}, premium ${w.premium} ${w.q}. It can be used at any time before the deadline.`,
  'earn-hold': (w) => `In contract words: you write a call on ${w.qty} ${w.a}, strike ${w.strike} ${w.q}, premium ${w.premium} ${w.q}. The buyer can use it at any time before the deadline.`,
  'earn-buy': (w) => `In contract words: you write a put on ${w.qty} ${w.a}, strike ${w.strike} ${w.q}, premium ${w.premium} ${w.q}. The holder can use it at any time before the deadline.`,
}

export const NOT_FOUND: Record<'buy' | 'write', (w: Words & { deadline: string }) => string> = {
  buy: (w) => `No maker offers ${w.qty} ${w.a} at ${w.strike} ${w.q} until ${w.deadline}. An offer is sold whole, so the quantity has to match too.`,
  write: (w) => `No buyer has escrowed a premium for ${w.qty} ${w.a} at ${w.strike} ${w.q} until ${w.deadline}. A request is filled whole, so the quantity has to match too.`,
}
export const NOT_FOUND_NO_QTY: Record<'buy' | 'write', string> = {
  buy: 'Enter a quantity to see the offers that match it. An offer is sold whole.',
  write: 'Enter a quantity to see the requests that match it. A request is filled whole.',
}

export const FALLBACK: Record<'buy' | 'write', { heading: string; body: (collateral: string) => string; field: string; first: string }> = {
  buy: {
    heading: 'Post a request and escrow your premium',
    body: () => 'You name the premium you would pay. The contract holds it until a maker accepts your terms, and you can cancel and take it back while nobody has.',
    field: 'Premium you offer, in total',
    first: 'No offer at this price and date to compare with.',
  },
  write: {
    heading: 'Post an offer at your price',
    body: (collateral) => `You name the premium you ask and lock ${collateral}. You are paid when a buyer takes the offer, and you can cancel while nobody has.`,
    field: 'Premium you ask, in total',
    first: 'Nobody offers this price and date yet. Yours would be the first offer.',
  },
}
export const LOWEST_OFFER = (perUnit: string, q: string, qty: string, a: string) => `Lowest open offer at this price and date: ${perUnit} ${q} per unit, for ${qty} ${a}.`
export const matchPrice = (perUnit: string) => `Use ${perUnit} per unit`
export const perUnitHint = (perUnit: string, q: string, a: string) => `${perUnit} ${q} per ${a}.`

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
  offer: 'Offer',
  listing: 'Listing',
  request: 'Request',
} as const
export const PAID_ONCE = 'Once, when you sign.'
export const PAID_AT_SIGN = 'When you sign, in the same transaction.'
export const LOCKED_IN_CONTRACT = 'locked in the contract'
export const LOCK_UNTIL = 'In the contract, until the deadline or until the other side uses the right.'

// ------------------------------------------------------------------------------------------- outcome

export const OUTCOME_HEADING = 'What you would hold at the deadline'
export const OUTCOME_HINT = 'Move the price to see both lines answer. Arrow keys work too.'
export const NO_PREMIUM_NOTE = 'No premium is known for these terms yet, so the figures below leave it out.'
export const OWN_PREMIUM_NOTE = (premium: string, q: string) => `The figures below use your premium of ${premium} ${q}. Someone has to accept it first.`
export const NEED_QTY = 'Enter a quantity to see what you would hold.'
export const SLIDER_LABEL = (a: string) => `Assumed ${a} price at the deadline`
export const READOUT_LABEL = (a: string, price: string) => `If ${a} is at ${price} at the deadline`
export const CARDS_LABEL = 'Three prices at the deadline'

export interface OutcomeWords extends Words {
  /** Value of the asset quantity at the assumed price, formatted. */
  value: string
}

/**
 * What the user would hold at an assumed price, in one sentence. `used` is true when the right would be used at
 * that price (the option is in the money). Each branch exists with and without a premium.
 */
export function outcomeSentence(intent: GuidedIntent, used: boolean, w: OutcomeWords): string {
  const p = w.premium
  switch (intent) {
    case 'floor':
      if (used) return p ? `You sell ${w.qty} ${w.a} at ${w.strike} and hold ${w.strikeTotal} ${w.q}, less the ${p} you paid.` : `You sell ${w.qty} ${w.a} at ${w.strike} and hold ${w.strikeTotal} ${w.q}.`
      return p ? `You keep ${w.qty} ${w.a}, worth ${w.value} ${w.q} at that price, less the ${p} you paid.` : `You keep ${w.qty} ${w.a}, worth ${w.value} ${w.q} at that price.`
    case 'earn-hold':
      if (used) return p ? `The buyer takes your ${w.qty} ${w.a} at ${w.strike}. You hold ${w.strikeTotal} ${w.q}, plus the ${p} premium.` : `The buyer takes your ${w.qty} ${w.a} at ${w.strike}. You hold ${w.strikeTotal} ${w.q}.`
      return p ? `You keep ${w.qty} ${w.a}, worth ${w.value} ${w.q} at that price, plus the ${p} premium.` : `You keep ${w.qty} ${w.a}, worth ${w.value} ${w.q} at that price.`
    case 'earn-buy':
      if (used) return p ? `You buy ${w.qty} ${w.a} at ${w.strike}. You hold ${w.a} worth ${w.value} ${w.q} at that price, plus the ${p} premium.` : `You buy ${w.qty} ${w.a} at ${w.strike}. You hold ${w.a} worth ${w.value} ${w.q} at that price.`
      return p ? `Nobody sells to you. You keep your ${w.strikeTotal} ${w.q}, plus the ${p} premium.` : `Nobody sells to you. You keep your ${w.strikeTotal} ${w.q}.`
    case 'lock-buy':
      if (used) return p ? `You buy ${w.qty} ${w.a} at ${w.strike}. You hold ${w.a} worth ${w.value} ${w.q} at that price, less the ${p} you paid.` : `You buy ${w.qty} ${w.a} at ${w.strike}. You hold ${w.a} worth ${w.value} ${w.q} at that price.`
      return p ? `You do not buy. You keep your ${w.strikeTotal} ${w.q}, less the ${p} you paid.` : `You do not buy. You keep your ${w.strikeTotal} ${w.q}.`
  }
}

export const SCENARIO = {
  low: (a: string, price: string) => `If ${a} falls to ${price}`,
  mid: (a: string, price: string, label: string | null) => (label ? `If ${a} stays at ${price}, the ${label}` : `If ${a} is at ${price}`),
  high: (a: string, price: string) => `If ${a} rises to ${price}`,
}

export const FACT = {
  breakeven: 'Breakeven',
  maxLoss: 'Most you can lose',
  keep: 'What you keep',
  giveUp: 'What you give up',
} as const

export interface FactWords extends Words {
  breakeven: string
  maxLoss: string
  maxGain: string | null
  /** `demo price 99.40`, or null when the asset has no reference price. */
  reference: string | null
}

export const BREAKEVEN_HINT: Record<GuidedIntent, (w: FactWords) => string> = {
  floor: (w) => `${w.a} below this price at the deadline leaves you better off with the floor than without it.`,
  'earn-hold': (w) => `${w.a} above this price at the deadline would have paid you more if you had just held.`,
  'earn-buy': (w) => `${w.a} below this price at the deadline leaves you worse off than keeping the cash.`,
  'lock-buy': (w) => `${w.a} above this price at the deadline leaves you better off than keeping the cash.`,
}

export const MAX_LOSS_HINT: Record<GuidedIntent, (w: FactWords) => string> = {
  floor: (w) => (w.reference ? `Counted from the ${w.reference}: the fall to your floor, plus the premium.` : 'The premium. Your floor takes any fall below it.'),
  'earn-hold': (w) =>
    w.reference ? `If ${w.a} fell to zero: its value at the ${w.reference}, less the premium. The agreement does not limit a fall.` : `If ${w.a} fell to zero. The agreement does not limit a fall.`,
  'earn-buy': (w) => `If ${w.a} fell to zero after you bought it: the ${w.strikeTotal} ${w.q} you locked, less the premium.`,
  'lock-buy': (w) => `The premium. If ${w.a} ends below your price you simply do not buy.`,
}

export const THIRD_FACT: Record<GuidedIntent, { label: string; value: (w: Words) => string; hint: (w: FactWords) => string }> = {
  floor: {
    label: FACT.keep,
    value: (w) => `Any rise in ${w.a}`,
    hint: () => 'The floor has no cap. Above it you simply do not use it.',
  },
  'earn-hold': {
    label: FACT.giveUp,
    value: (w) => `Any rise above ${w.strike}`,
    hint: (w) =>
      w.maxGain && w.reference
        ? `However high ${w.a} goes, the buyer can take it at ${w.strike}. Your gain stops at ${w.maxGain} ${w.q}, counted from the ${w.reference}.`
        : `However high ${w.a} goes, the buyer can take it at ${w.strike}.`,
  },
  'earn-buy': {
    label: FACT.giveUp,
    value: (w) => `Any fall below ${w.strike}`,
    hint: (w) => (w.maxGain ? `However low ${w.a} goes, you buy at ${w.strike}. Your gain stops at the premium, ${w.maxGain} ${w.q}.` : `However low ${w.a} goes, you buy at ${w.strike}.`),
  },
  'lock-buy': {
    label: FACT.keep,
    value: (w) => `Any rise above ${w.strike}`,
    hint: () => 'The locked price has no cap. Below it you simply do not use it.',
  },
}

// ------------------------------------------------------------------------------------------- timeline

export const WHEN_HEADING = 'What happens and when'
export const WHEN_LEAD = 'Nothing settles by itself. The holder of the right must exercise it before the deadline, or it ends.'
export const WHEN_NEED_QTY = 'Enter a quantity to see each step with its amounts.'
export const WHEN = { now: 'Now', until: 'Until the deadline', at: 'At the deadline', after: 'After the deadline' } as const
export const ACTOR = { you: 'You', maker: 'The maker', buyer: 'The buyer', holder: 'The holder', nobody: 'Nobody' } as const

export interface Step {
  actor: string
  title: string
  body: string
}

/** How the order comes about: an order that is already funded, or terms of the user's own waiting for a taker. */
export type Route = 'take' | 'own'

export function timelineSteps(intent: GuidedIntent, route: Route, w: Words): { now: Step; until: Step; at: Step; after: Step } {
  const p = w.premium
  switch (intent) {
    case 'floor':
      return {
        now: {
          actor: ACTOR.you,
          title: route === 'take' ? 'You pay the premium' : 'You escrow your premium',
          body:
            route === 'own'
              ? `It waits in the contract until a maker accepts your terms and locks ${w.strikeTotal} ${w.q}. Until then you can cancel.`
              : p
                ? `${p} ${w.q}, once. The maker's ${w.strikeTotal} ${w.q} is already locked in the contract.`
                : `Once. The maker's ${w.strikeTotal} ${w.q} is already locked in the contract.`,
        },
        until: {
          actor: ACTOR.you,
          title: 'You can sell at your floor',
          body: `At any moment you can deliver ${w.qty} ${w.a} and receive ${w.strikeTotal} ${w.q} in one transaction. This is called exercising. You decide if and when.`,
        },
        at: {
          actor: ACTOR.nobody,
          title: 'The right ends',
          body: 'Nothing settles by itself. If you have not exercised by then, the right expires and the premium stays with the maker.',
        },
        after: {
          actor: ACTOR.maker,
          title: 'The maker takes back the collateral',
          body: `If you did not exercise, you still hold your ${w.a} and there is nothing left for you to do.`,
        },
      }
    case 'lock-buy':
      return {
        now: {
          actor: ACTOR.you,
          title: route === 'take' ? 'You pay the premium' : 'You escrow your premium',
          body:
            route === 'own'
              ? `It waits in the contract until a maker accepts your terms and locks ${w.qty} ${w.a}. Until then you can cancel.`
              : p
                ? `${p} ${w.q}, once. The maker's ${w.qty} ${w.a} is already locked in the contract.`
                : `Once. The maker's ${w.qty} ${w.a} is already locked in the contract.`,
        },
        until: {
          actor: ACTOR.you,
          title: 'You can buy at your price',
          body: `At any moment you can pay ${w.strikeTotal} ${w.q} and receive ${w.qty} ${w.a} in one transaction. This is called exercising. You need the ${w.strikeTotal} ${w.q} at that moment.`,
        },
        at: {
          actor: ACTOR.nobody,
          title: 'The right ends',
          body: 'Nothing settles by itself. If you have not exercised by then, the right expires and the premium stays with the maker.',
        },
        after: {
          actor: ACTOR.maker,
          title: 'The maker takes back the collateral',
          body: 'If you did not exercise, there is nothing left for you to do.',
        },
      }
    case 'earn-hold':
      return {
        now: {
          actor: ACTOR.you,
          title: `You lock ${w.qty} ${w.a}`,
          body:
            route === 'take'
              ? 'The premium the buyer escrowed is paid to you in the same transaction.'
              : `You are paid only when a buyer takes your offer. Until then you can cancel and take your ${w.a} back.`,
        },
        until: {
          actor: ACTOR.buyer,
          title: `The buyer can take your ${w.a}`,
          body: `At any moment, not only at the end, the buyer can pay ${w.strikeTotal} ${w.q} and receive your ${w.qty} ${w.a}. This is called exercising. The ${w.q} then waits in the contract until you claim it.`,
        },
        at: {
          actor: ACTOR.nobody,
          title: "The buyer's right ends",
          body: `Nothing settles by itself. If the buyer has not exercised by then, your ${w.a} stays locked until you act.`,
        },
        after: {
          actor: ACTOR.you,
          title: `You reclaim your ${w.a}`,
          body: `One transaction takes your ${w.qty} ${w.a} back from the contract. The premium is yours either way.`,
        },
      }
    case 'earn-buy':
      return {
        now: {
          actor: ACTOR.you,
          title: `You lock ${w.strikeTotal} ${w.q}`,
          body:
            route === 'take'
              ? 'The premium the buyer escrowed is paid to you in the same transaction.'
              : `You are paid only when a buyer takes your offer. Until then you can cancel and take your ${w.q} back.`,
        },
        until: {
          actor: ACTOR.holder,
          title: 'The holder can sell to you',
          body: `At any moment the holder can deliver ${w.qty} ${w.a} and take your ${w.strikeTotal} ${w.q}, even if ${w.a} is then worth far less. This is called exercising. The ${w.a} then waits in the contract until you claim it.`,
        },
        at: {
          actor: ACTOR.nobody,
          title: "The holder's right ends",
          body: `Nothing settles by itself. If the holder has not exercised by then, your ${w.q} stays locked until you act.`,
        },
        after: {
          actor: ACTOR.you,
          title: `You reclaim your ${w.q}`,
          body: `One transaction takes your ${w.strikeTotal} ${w.q} back from the contract. The premium is yours either way.`,
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
export const GUEST_NOTE = 'Connect a Testnet wallet to review and sign. The terms stay as you set them.'
export const NEXT_NOTE = 'Next: the ticket reads the order from the contract again, shows what you pay and lock, and asks before anything is signed.'
export const OWN_SUMMARY: Record<'buy' | 'write', (w: Words & { collateral: string; deadline: string }) => string> = {
  buy: (w) => `Your ${w.premium} ${w.q} waits in the contract until a maker accepts ${w.qty} ${w.a} at ${w.strike} ${w.q} until ${w.deadline}, or until you cancel.`,
  write: (w) => `You lock ${w.collateral} and ask ${w.premium} ${w.q}. You are paid only if a buyer takes the offer before ${w.deadline}.`,
}
export const OWN_SUMMARY_NO_PREMIUM: Record<'buy' | 'write', string> = {
  buy: 'Enter the premium you would pay above, or set it in the ticket.',
  write: 'Enter the premium you ask above, or set it in the ticket.',
}
export const NEED_QTY_ACTION = 'Enter a quantity first.'

// ------------------------------------------------------------------------------------------- states

export const LOADING_LABEL = 'Loading the guided flow'
export const LOAD_ERROR_TITLE = 'Could not read this market'
export const LOAD_ERROR_BODY = 'Nothing was read from the contract. Check your connection and try again.'
export const RETRY = 'Try again'
export const REFRESH_FAILED = 'Could not refresh. These figures are from the last successful read.'
export const NOT_LISTED = 'This asset is not listed in the contract.'
export const NO_GRID = 'There is no reference price and no offer to build a list of prices from.'
export const NO_GRID_HINT = 'Switch to Chain to post the first offer or request with terms of your own.'
