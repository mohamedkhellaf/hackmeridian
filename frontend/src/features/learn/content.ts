// Every sentence of the Learn page, in one place (brief D18: copy lives in feature-level constants and is never
// concatenated from fragments). Facts come from PRODUCT_SPEC.md, README.md, AGENTS.md and src/core only.
//
// Voice: a clearing desk. Numbers before adjectives; "can" for rights, "is locked" for facts, "must" for
// deadlines; the contract's own verbs. One word per thing: request, deadline, maker (Margin keeps "writer", its
// contract's own term). The required disclosure sentences of core/disclosures are not retyped here: each has its
// one home elsewhere, and this page restates limits in its own words (brief D16).
// content.test.ts checks every string below against the banned wording.

import { CONTRACT_TEST_TOTAL, RECORDED_PUT_FEES } from '../../core/deployments'
import { NBSP, formatExact } from '../../core/format'
import { GLOSSARY as CORE_GLOSSARY } from '../../core/glossary'
import type { GuidedIntent } from '../../core/payoff/strategies'
import { FAUCET_PRICE } from '../../core/reference'
import type { Scenario, WorkedExample } from './examples'

/** A recorded network fee in XLM, every stroop shown: `0.0309366`. */
const xlm = (stroops: bigint): string => formatExact(stroops, 7, { minDp: 7, group: false })

// ---------------------------------------------------------------------------------------------- page

/** The page's one name: the route title, the h1, the navigation and the footer all say it. */
export const PAGE_TITLE = 'Learn'

export const NAV_LABEL = 'On this page'

export type SectionId = 'what-this-is' | 'lifecycle' | 'intents' | 'requests-resale' | 'risks' | 'glossary' | 'questions'

export interface SectionInfo {
  id: SectionId
  title: string
}

/** The id of a section's heading: where focus goes when the reader jumps to the section. */
export const sectionHeadingId = (id: SectionId): string => `${id}-title`

/** The sections, in reading order. The id is the URL fragment: `/learn#glossary`. */
export const SECTIONS: readonly SectionInfo[] = [
  { id: 'what-this-is', title: 'What this is' },
  { id: 'lifecycle', title: 'The life of an option' },
  { id: 'intents', title: 'Four things you can do' },
  { id: 'requests-resale', title: 'Requests and resale' },
  { id: 'risks', title: 'What can go wrong' },
  { id: 'glossary', title: 'Glossary' },
  { id: 'questions', title: 'Questions' },
]

// ---------------------------------------------------------------------------------------------- 1. what this is

/** Two sentences: the rules table under them carries the rest (style, settlement, premium). */
export const WHAT_THIS_IS: readonly [string, string] = [
  'StellSec is a venue for options on tokenized assets, on Stellar: a put is the right to sell a set quantity of an asset at a set price until a deadline, and a call is the right to buy it.',
  'The maker, who writes and sells the option, locks the whole collateral in the contract before anyone can buy: the full strike for a put, the full quantity of the asset for a call.',
]

export const RULES_TITLE = 'The rules in brief'
export const RULES_CAPTION = 'The rules of a Covered option in brief'
export const RULES_HEAD = { rule: 'Rule', text: 'What the contract does' } as const
export const RULES_NOTE = 'These are the rules of the Covered contract. Margin is a separate contract with other rules.'

export interface RuleRow {
  rule: string
  text: string
}

export const RULES: readonly RuleRow[] = [
  { rule: 'Style', text: 'American. The holder can exercise at any time before the deadline.' },
  { rule: 'Settlement', text: 'Physical. Tokens against the strike, in one transaction. If any part fails, nothing moves.' },
  { rule: 'Collateral', text: 'The whole obligation, locked in the contract before the sale.' },
  { rule: 'Premium', text: 'Paid once, by the buyer to the maker, at purchase. Never refunded.' },
  { rule: 'Lots', text: 'One offer, one position. No partial fill and no partial exercise.' },
  { rule: 'Longest term', text: '2 years from the day the offer is written.' },
  { rule: 'Who can take part', text: 'Any account the issuer of the asset allows to hold it.' },
  { rule: 'Control', text: 'No admin, no price feed and no upgrade path.' },
]

// ---------------------------------------------------------------------------------------------- 2. lifecycle

export const LIFECYCLE_TIMELINE_LABEL = 'The life of one put, step by step'

export const lifecycleIntro = (x: WorkedExample): string =>
  `Follow one put on ${x.qtyText}: a strike of ${x.strikePerUnitText}${NBSP}${x.quoteCode} per ${x.assetCode}, ${x.strikeTotalText} in all, for a premium of ${x.premiumText}.`

export interface LifecycleStep {
  /** By when. The title says who acts. */
  when: string
  title: string
  text: string
  /** The contract state the option is in after the step, when the step changes it. */
  state?: string
}

/** `deadline` is the canonical UTC text of the deadline: `20 Nov 2026, 08:00 UTC`. */
export const lifecycleSpine = (x: WorkedExample, deadline: string): LifecycleStep[] => [
  {
    when: 'Before the sale',
    title: 'The maker locks the collateral and posts an offer',
    text: `${x.collateralText}, the whole strike, moves from the maker into the contract. The offer states every term: a put on ${x.qtyText} at ${x.strikePerUnitText}${NBSP}${x.quoteCode} each, a premium of ${x.premiumText}, a deadline of ${deadline}. While nobody has bought it, the maker can cancel it and take the collateral back.`,
    state: 'Offered',
  },
  {
    when: 'Any time before the deadline',
    title: 'A buyer pays the premium and becomes the holder',
    text: `${x.premiumText} goes from the buyer to the maker. It is paid once and is never refunded. From here nobody can cancel the option: the right belongs to the holder.`,
    state: 'Active',
  },
  {
    when: `Until ${deadline}`,
    title: 'The holder can exercise',
    text: 'At any time before the deadline the holder can use the right, for the whole quantity or not at all. The contract reads no price and takes no decision: whether and when to exercise is up to the holder.',
  },
]

export const LIFECYCLE_FORK_INTRO = 'Then one of two things happens.'

export interface LifecycleBranch {
  id: 'exercised' | 'expired'
  /** Accessible name of the branch's list. Its first step names the branch on screen. */
  label: string
  steps: LifecycleStep[]
}

export const lifecycleBranches = (x: WorkedExample): LifecycleBranch[] => [
  {
    id: 'exercised',
    label: 'If the holder exercises, step by step',
    steps: [
      {
        when: 'Before the deadline',
        title: 'The holder exercises',
        text: `The holder delivers ${x.qtyText} into the contract and receives the ${x.strikeTotalText} that were locked.`,
        state: 'Exercised',
      },
      {
        when: 'Any time after the exercise',
        title: 'The maker claims what was delivered',
        text: `The ${x.qtyText} wait in the contract until the maker claims them. The premium stays with the maker.`,
        state: 'Settled',
      },
    ],
  },
  {
    id: 'expired',
    label: 'If the deadline passes without an exercise, step by step',
    steps: [
      {
        when: 'At the deadline',
        title: 'The deadline passes',
        text: `An option that was not exercised in time ends there, whatever ${x.assetCode} is worth. The holder has spent the ${x.premiumText}.`,
      },
      {
        when: 'Any time after the deadline',
        title: 'The maker reclaims the collateral',
        text: `The ${x.collateralText} return to the maker. The premium stays with the maker.`,
        state: 'Expired',
      },
    ],
  },
]

export const STATE_AFTER = 'State after'

export const NOTHING_SETTLES_TITLE = 'Nothing settles by itself'
export const NOTHING_SETTLES_TEXT =
  'Every step above is a transaction that somebody signs. An option that is not exercised before its deadline expires, even when exercising would have paid. Tokens that a maker has not claimed or reclaimed stay in the contract until the maker acts.'

export const SIDES_TITLE = 'Put and call, side by side'
export const SIDES_CAPTION = 'What each side locks, pays and receives for a put and for a call'
export const SIDES_HEAD = { row: 'At each step', put: 'Put', call: 'Call' } as const

export interface SidesRow {
  step: string
  put: string
  call: string
}

export const SIDES: readonly SidesRow[] = [
  { step: "The holder's right", put: 'Sell the quantity for the strike', call: 'Buy the quantity for the strike' },
  { step: 'The maker locks', put: 'The whole strike, in USDx', call: 'The whole quantity of the asset' },
  { step: 'The holder delivers at exercise', put: 'The quantity of the asset', call: 'The strike, in USDx' },
  { step: 'The holder receives at exercise', put: 'The strike, in USDx', call: 'The quantity of the asset' },
  { step: 'The maker claims after an exercise', put: 'The asset that was delivered', call: 'The strike that was paid' },
  { step: 'The maker reclaims if nobody exercised', put: 'The strike, in USDx', call: 'The quantity of the asset' },
]

// ---------------------------------------------------------------------------------------------- 3. four intents

export const intentsIntro = (x: WorkedExample, deadline: string): string =>
  `Each one is a single option, seen from your side. The four share one lot: ${x.qtyText}, with ${x.assetCode} at ${x.startText}${NBSP}${x.quoteCode} when you start and a deadline of ${deadline}. The premiums are examples, not offers.`

export interface IntentCopy {
  /** What you do, in one sentence, without the vocabulary of options. */
  statement: string
  /** The same in contract terms. */
  contract: string
  /** Position and asset, as printed on a contract note: "Long put, BOND". */
  position: (x: WorkedExample) => string
  /** The deal in exact figures. */
  deal: (x: WorkedExample, deadline: string) => string
  /** What it costs you, at the same weight as what it gives. */
  trade: (x: WorkedExample) => string
  strikeLabel: (x: WorkedExample) => string
  premiumLabel: string
  collateralLabel: string
  /** Where the figure comes from, under "Most you can lose". */
  maxLossHint?: (x: WorkedExample) => string
  maxGainHint?: (x: WorkedExample) => string
  /**
   * A written call: the maker cannot owe more than the asset already locked, so the note prints what is given up
   * in place of a loss figure.
   */
  givesUp?: { value: (x: WorkedExample) => string; hint: (x: WorkedExample) => string }
  /** One sentence for a scenario: what happens and who acts. */
  outcome: (x: WorkedExample, s: Scenario) => string
  /** Accessible name of the with-and-without figure. */
  chartTitle: (x: WorkedExample) => string
  /** Direct labels of the two lines of the figure, and of the three outcomes: the words of the guided page. */
  withLabel: string
  withoutLabel: string
  /** What the outcomes are measured against: "compared with keeping the cash", and the words for no difference. */
  comparedWith: string
  sameAs: string
  /** The level the figure marks, as the guided page names it: `Floor 10.00`, `Buy at 9.50`. */
  levelLabel: (x: WorkedExample) => string
  /** The price the figure opens on. */
  openAt: number
  /** Text of the link to the guided flow. */
  action: string
}

export const TERM_LABELS = {
  quantity: 'Quantity',
  deadline: 'Deadline',
  breakeven: 'Breakeven',
  maxLoss: 'Most you can lose',
  maxGain: 'Most you can gain',
  givesUp: 'You give up',
  noCap: 'No cap',
} as const

/** The premium per unit, under its total: `0.36 USDx per BOND`. */
export const premiumPerUnit = (x: WorkedExample): string => `${x.premiumPerUnitText}${NBSP}${x.quoteCode} per ${x.assetCode}`

export const breakevenLabel = (x: WorkedExample): string => `${TERM_LABELS.breakeven}, per ${x.assetCode}`

export const scenarioLabel = (x: WorkedExample, s: Scenario): string => `If ${x.assetCode} is at ${s.priceText}`

/**
 * The signed difference a scenario makes, with its unit, against the other line of the figure: `+8.20 USDx compared
 * with no floor`. The sign carries the direction, so the words stay neutral.
 */
export function scenarioDelta(x: WorkedExample, s: Scenario): string {
  const copy = INTENT_COPY[x.intent]
  if (s.difference === 0) return `${s.differenceText}${NBSP}${x.quoteCode}, ${copy.sameAs}`
  return `${s.differenceText}${NBSP}${x.quoteCode} ${copy.comparedWith}`
}

/** Visible heading over the three outcomes: the guided page's own words. */
export const OUTCOMES_TITLE = 'What you would hold at the deadline'
/** Accessible name of the list of outcomes, after the name of the intent. */
export const OUTCOMES_LABEL = 'Three outcomes at the deadline'

export const INTENT_COPY: Record<GuidedIntent, IntentCopy> = {
  floor: {
    statement: 'You hold an asset and want a lowest price you can sell it at, until a date you choose. You pay a premium, once.',
    contract: 'In contract terms you buy a put.',
    position: (x) => `Long put, ${x.assetCode}`,
    deal: (x, deadline) => `Pay ${x.premiumText}. Until ${deadline} you can sell ${x.qtyText} for ${x.strikeTotalText}.`,
    trade: (x) =>
      `The premium is spent whether or not you exercise. To exercise you must hold the ${x.qtyText} and press Exercise before the deadline.`,
    strikeLabel: (x) => `Floor, per ${x.assetCode}`,
    premiumLabel: 'You pay',
    collateralLabel: 'Locked by the maker',
    maxLossHint: (x) => `With ${x.assetCode} at ${x.startText} when you start`,
    maxGainHint: (x) => `You keep any rise in ${x.assetCode}`,
    outcome: (x, s) =>
      s.exercised
        ? `You exercise: deliver ${x.qtyText} and receive ${x.strikeTotalText}, less the ${x.premiumText} you paid.`
        : `You do nothing and the put expires. You keep ${x.qtyText} worth ${s.assetValueText}${NBSP}${x.quoteCode}, less the ${x.premiumText} you paid.`,
    chartTitle: (x) =>
      `What ${x.qtyText} would be worth to you at the deadline, with a floor at ${x.strikePerUnitText}${NBSP}${x.quoteCode} and without`,
    withLabel: 'With the floor',
    withoutLabel: 'Without',
    comparedWith: 'compared with no floor',
    sameAs: 'the same as without the floor',
    levelLabel: (x) => `Floor ${x.strikePerUnitText}`,
    openAt: 8,
    action: 'Set a floor in Markets',
  },
  'earn-hold': {
    statement: 'You hold an asset and agree to sell it at a higher price if a buyer asks before the deadline. You are paid a premium for it.',
    contract: 'In contract terms you write a call and lock the asset.',
    position: (x) => `Short call, ${x.assetCode}`,
    deal: (x, deadline) =>
      `Lock ${x.qtyText}. A buyer pays you ${x.premiumText} and, until ${deadline}, can buy them from you for ${x.strikeTotalText}.`,
    trade: (x) =>
      `You give up any rise above ${x.strikePerUnitText}, and a fall in ${x.assetCode} is still yours. The holder can exercise early, not only at the end. The premium reaches you when a buyer takes your offer, or at once if you fill a request.`,
    strikeLabel: (x) => `Sale price, per ${x.assetCode}`,
    premiumLabel: 'You are paid',
    collateralLabel: 'You lock',
    givesUp: {
      value: (x) => `Every rise above ${x.strikePerUnitText}${NBSP}${x.quoteCode} per ${x.assetCode}`,
      hint: (x) => `You cannot owe more than the ${x.qtyText} you lock; it can still fall in price.`,
    },
    outcome: (x, s) =>
      s.exercised
        ? `If the holder exercises, your ${x.qtyText} go for ${x.strikeTotalText}, which you claim. You keep the ${x.premiumText}; the rise above ${x.strikePerUnitText} is not yours.`
        : `The call is not exercised. After the deadline you reclaim ${x.qtyText} worth ${s.assetValueText}${NBSP}${x.quoteCode} and keep the ${x.premiumText}.`,
    chartTitle: (x) =>
      `What ${x.qtyText} would be worth to you at the deadline, with an agreement to sell at ${x.strikePerUnitText}${NBSP}${x.quoteCode} and without`,
    withLabel: 'With the agreement',
    withoutLabel: 'Just holding',
    comparedWith: 'compared with just holding',
    sameAs: 'the same as just holding',
    levelLabel: (x) => `Sell at ${x.strikePerUnitText}`,
    openAt: 12,
    action: 'Get paid to sell higher in Markets',
  },
  'earn-buy': {
    statement: 'You set USDx aside and agree to buy an asset at a lower price if a holder asks before the deadline. You are paid a premium for it.',
    contract: 'In contract terms you write a put and lock the strike.',
    position: (x) => `Short put, ${x.assetCode}`,
    deal: (x, deadline) =>
      `Lock ${x.collateralText}. A buyer pays you ${x.premiumText} and, until ${deadline}, can sell you ${x.qtyText} for it.`,
    trade: (x) =>
      `You may have to buy at ${x.strikePerUnitText} when ${x.assetCode} is worth far less. The holder can exercise early, not only at the end. The premium reaches you when a buyer takes your offer, or at once if you fill a request.`,
    strikeLabel: (x) => `Buy price, per ${x.assetCode}`,
    premiumLabel: 'You are paid',
    collateralLabel: 'You lock',
    maxLossHint: (x) => `If you buy at ${x.strikePerUnitText} and ${x.assetCode} falls to zero`,
    maxGainHint: () => 'The premium',
    outcome: (x, s) =>
      s.exercised
        ? `If the holder exercises, your ${x.collateralText} buy ${x.qtyText}, which you claim, now worth ${s.assetValueText}${NBSP}${x.quoteCode}. You keep the ${x.premiumText}.`
        : `The put is not exercised. After the deadline you reclaim your ${x.collateralText} and keep the ${x.premiumText}.`,
    chartTitle: (x) =>
      `What you would hold at the deadline with an agreement to buy ${x.qtyText} at ${x.strikePerUnitText}${NBSP}${x.quoteCode}, and without`,
    withLabel: 'With the agreement',
    withoutLabel: 'Keeping the cash',
    comparedWith: 'compared with keeping the cash',
    sameAs: 'the same as keeping the cash',
    levelLabel: (x) => `Buy at ${x.strikePerUnitText}`,
    openAt: 8,
    action: 'Get paid to buy lower in Markets',
  },
  'lock-buy': {
    statement: 'You want a highest price you can buy an asset at, until a date you choose. You pay a premium, once.',
    contract: 'In contract terms you buy a call.',
    position: (x) => `Long call, ${x.assetCode}`,
    deal: (x, deadline) => `Pay ${x.premiumText}. Until ${deadline} you can buy ${x.qtyText} for ${x.strikeTotalText}.`,
    trade: (x) =>
      `The premium is spent whether or not you exercise. To exercise you must hold the ${x.strikeTotalText} and press Exercise before the deadline.`,
    strikeLabel: (x) => `Buy price, per ${x.assetCode}`,
    premiumLabel: 'You pay',
    collateralLabel: 'Locked by the maker',
    maxLossHint: () => 'The premium',
    maxGainHint: (x) => `You keep any rise above ${x.strikePerUnitText}`,
    outcome: (x, s) =>
      s.exercised
        ? `You exercise: pay ${x.strikeTotalText} and receive ${x.qtyText} worth ${s.assetValueText}${NBSP}${x.quoteCode}, less the ${x.premiumText} you paid.`
        : `You do nothing and the call expires. You keep your ${x.strikeTotalText}, less the ${x.premiumText} you paid.`,
    chartTitle: (x) =>
      `What you would hold at the deadline with the right to buy ${x.qtyText} at ${x.strikePerUnitText}${NBSP}${x.quoteCode}, and without`,
    withLabel: 'With the locked price',
    withoutLabel: 'Keeping the cash',
    comparedWith: 'compared with keeping the cash',
    sameAs: 'the same as keeping the cash',
    levelLabel: (x) => `At most ${x.strikePerUnitText}`,
    openAt: 12,
    action: 'Lock a buy price in Markets',
  },
}

// ---------------------------------------------------------------------------------------------- 4. requests and resale

export const REQUESTS_TITLE = 'Requests'
export const REQUESTS_TEXT: readonly string[] = [
  'When no offer has your terms, you can post a request: the option you want and the premium you offer for it. The premium is escrowed in the contract. Any eligible maker can fill the request, whole or not at all, in one transaction: the maker locks the whole collateral, receives the premium, and you hold the option.',
  'Until a maker fills it you can cancel, and the premium comes back in full. After its deadline a request can no longer be filled, and the premium comes back when you cancel it or when anyone clears expired requests. Requests and offers are never matched automatically.',
]

export const RESALE_TITLE = 'Resale'
export const RESALE_TEXT: readonly string[] = [
  'A holder can list an option for resale at a price of their choosing, in USDx. An eligible buyer pays that price to the holder and becomes the holder in one transaction; the maker of the option cannot buy it back. Strike, deadline, quantity and the collateral in the contract do not change.',
  'An option has one listing at most, and the listing ends when the option is bought, exercised or expires. If the seller raises the price while a buyer is signing, the purchase fails and nothing is paid.',
]

export const REQUESTS_LINK = 'See open requests'

// ---------------------------------------------------------------------------------------------- 5. what can go wrong

export interface RiskItem {
  id: string
  title: string
  paragraphs: readonly string[]
}

export const RISK_ISSUER: RiskItem = {
  id: 'issuer',
  title: 'The issuer can freeze an account or claw tokens back',
  paragraphs: [
    'A tokenized asset has an issuer, who decides who may hold it and can freeze an account or take tokens back. The contract checks the decision of the issuer before every trade. The collateral covers the option, not what the issuer does.',
  ],
}

export const ISSUER_TABLE_CAPTION = 'What each issuer action does to an option'
export const ISSUER_TABLE_HEAD = { action: 'If the issuer', effect: 'Then' } as const

export interface IssuerRow {
  action: string
  effect: string
}

export const ISSUER_ROWS: readonly IssuerRow[] = [
  {
    action: 'Freezes the holder',
    effect: 'The holder cannot exercise. The maker reclaims the collateral after the deadline. The premium is not refunded.',
  },
  {
    action: 'Freezes the maker',
    effect: 'Exercise still works: the holder is paid from the contract. The maker cannot claim or reclaim the frozen asset until the issuer allows it again.',
  },
  {
    action: 'Removes the authorization of the contract',
    effect: 'The asset cannot move into or out of the contract: a put cannot be exercised or claimed, a call cannot be exercised or reclaimed. New purchases are refused. The maker of a put can still reclaim its USDx after the deadline.',
  },
  {
    action: 'Claws tokens back from the contract',
    effect: 'The contract holds less of that token than it owes. It keeps one balance per token, so what is left is paid first come, first served, and whoever comes last is not paid. New offers, purchases and transfers on that token are refused until the balance is restored. Other tokens are not affected.',
  },
]

export const ISSUER_QUOTE_NOTE =
  'USDx, the token strikes and premiums are paid in, is issued without the freeze and clawback flags, so the USDx locked behind a put is not exposed to them as issued. Its issuer account is not locked against setting flags later.'

export const RISKS: readonly RiskItem[] = [
  {
    id: 'deadline',
    title: 'You can miss the deadline',
    paragraphs: [
      'An option that is in the money at its deadline and was not exercised expires all the same, and the premium is spent. The deadline is decided by the close time of the ledger, not by the clock of your device, so a transaction signed in the last minutes may land too late.',
      'The receipt of a purchase and the position in Portfolio can add the deadline to your calendar. StellSec sends no reminder of its own.',
    ],
  },
  {
    id: 'thin',
    title: 'The market is thin',
    paragraphs: [
      'The makers on this deployment are the accounts of the team. There may be no offer at the strike or the deadline you want, and nobody may take an option you list for resale. Every price is a limit set by one maker, one buyer or one holder: there is no pricing model and no depth behind it.',
      'Offers are whole lots. A lot cannot be split, and an option cannot be exercised in part.',
    ],
  },
  {
    id: 'testnet',
    title: 'The test network is reset',
    paragraphs: [
      'Everything here runs on Stellar Testnet, which its operators reset from time to time. A reset erases every account, balance and contract, and every option with them.',
      'Contract storage also expires unless its rent is extended. Anyone can extend it. Nothing extends it automatically.',
    ],
  },
  {
    id: 'unaudited',
    title: 'The contracts are not audited',
    paragraphs: [
      `Nobody independent has reviewed the code. The Covered contract has ${CONTRACT_TEST_TOTAL} automated tests, and the contract on Testnet is byte-identical to a build of the published source.`,
      'The Covered contract has no admin and no upgrade path. Nobody can change its rules, and nobody can patch a defect in place.',
    ],
  },
]

export const MARGIN_TITLE = 'Margin has its own risks'
export const MARGIN_INTRO =
  'Margin is a separate contract for uncovered calls, settled in cash in USDx. The two contracts share no storage and no balance, so a loss in Margin cannot reach collateral locked in the Covered contract.'

export const MARGIN_POINTS: readonly string[] = [
  'The writer posts partial margin, not the whole obligation. A writer whose account value falls below the maintenance margin can be liquidated: the vault, or another account, takes the position over at the published price.',
  'A holder is paid from the margin of the writer, then from the vault. If both run out, the holder is paid less than the payoff, and the deficit is recorded and shown.',
  'Every price, the settlement price included, is published by the team. It is a demo feed, not a market, and it decides every liquidation, early exercise and payout.',
  'Margin has two roles the Covered contract does not have: an admin who lists series and a publisher who sets prices. Neither can change the terms of a live series or rewrite a final price.',
  'Capital provided to the vault cannot be withdrawn in this version.',
]

export const MARGIN_LINK = 'Open Margin'

// ---------------------------------------------------------------------------------------------- 6. glossary

export interface GlossaryEntry {
  term: string
  /** One sentence. */
  definition: string
}

/** The id of a term's row, so a page can link to it: `/learn#term-breakeven`. */
export const termId = (term: string): string => `term-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

/**
 * In alphabetical order, from core/glossary: the same sentences as the `Term` popovers in the flows. Escrow is
 * left out here, where the Request entry already says it.
 */
export const GLOSSARY: readonly GlossaryEntry[] = CORE_GLOSSARY.filter((g) => g.id !== 'escrow').map(({ term, definition }) => ({ term, definition }))

// ---------------------------------------------------------------------------------------------- 7. questions

export interface Question {
  id: string
  question: string
  answer: readonly string[]
  /** A way on from the answer, inside the app. */
  link?: { label: string; to: '/markets'; search?: { funds: '1' } }
}

export const QUESTIONS: readonly Question[] = [
  {
    id: 'real-money',
    question: 'Is this real money?',
    answer: [
      "No. Everything runs on Stellar Testnet. The tokens are test tokens issued by the team, the makers are the team's accounts, and nothing has a monetary value.",
    ],
  },
  {
    id: 'start',
    question: 'What do I need to start?',
    answer: [
      'A Stellar wallet set to Testnet, such as Freighter, and test tokens. Fund the account with test XLM from Friendbot, the Testnet faucet; add trustlines for USDx and the asset you want; then swap XLM for test tokens in your wallet.',
    ],
    link: { label: 'Get test funds', to: '/markets', search: { funds: '1' } },
  },
  {
    id: 'who-sells',
    question: 'Who sells the options?',
    answer: [
      'Makers: accounts that lock the collateral and post offers. On this deployment the makers are the accounts of the team. Any eligible account can write an offer, and any eligible account can fill a request.',
    ],
  },
  {
    id: 'premium-back',
    question: 'Can I get the premium back?',
    answer: [
      'No. The premium belongs to the maker from the moment you buy, whether you exercise, the option expires, or the issuer blocks settlement.',
      'A request is different. Its premium sits in the contract until a maker fills it, and comes back to you in full when you cancel it, before or after its deadline.',
    ],
  },
  {
    id: 'leave-early',
    question: 'Can I get out before the deadline?',
    answer: [
      'A holder can list the option for resale at a price of their choosing. It changes hands only if an eligible buyer takes it. A maker cannot close an option that has been bought: the collateral stays locked until the option is exercised or the deadline passes.',
    ],
  },
  {
    id: 'price',
    question: 'Where does the price on screen come from?',
    answer: [
      `Not from the contract: the Covered contract reads no price. The interface shows a reference price with its source so that you can see where a strike stands. On Testnet it is the rate of the test faucet, ${FAUCET_PRICE}${NBSP}USDx per unit, fixed by the team. With mock data it is a demo price chosen by the team.`,
      'On a payoff figure the price is an assumption, and you can move it.',
    ],
  },
  {
    id: 'fees',
    question: 'What does a transaction cost?',
    answer: [
      // The four fees of option No. 8 of the recorded Testnet run (landing/recorded.ts, RECORDED_PUT_TX), exact.
      `The contract takes no fee: premium, strike and asset move in full between the two sides. The network fee is paid in test XLM. For one option recorded on Testnet it was ${xlm(RECORDED_PUT_FEES.write)} XLM to write the offer, ${xlm(RECORDED_PUT_FEES.buy)} to buy, ${xlm(RECORDED_PUT_FEES.exercise)} to exercise and ${xlm(RECORDED_PUT_FEES.claim)} to claim.`,
    ],
  },
]

/** Every string of this module that reaches the screen, for the wording tests. Templates are rendered by the test. */
export const STATIC_COPY: readonly string[] = [
  PAGE_TITLE,
  NAV_LABEL,
  ...SECTIONS.map((s) => s.title),
  ...WHAT_THIS_IS,
  RULES_TITLE,
  RULES_CAPTION,
  RULES_NOTE,
  ...Object.values(RULES_HEAD),
  ...RULES.flatMap((r) => [r.rule, r.text]),
  LIFECYCLE_TIMELINE_LABEL,
  LIFECYCLE_FORK_INTRO,
  STATE_AFTER,
  NOTHING_SETTLES_TITLE,
  NOTHING_SETTLES_TEXT,
  SIDES_TITLE,
  SIDES_CAPTION,
  ...Object.values(SIDES_HEAD),
  ...SIDES.flatMap((r) => [r.step, r.put, r.call]),
  ...Object.values(TERM_LABELS),
  OUTCOMES_TITLE,
  OUTCOMES_LABEL,
  REQUESTS_TITLE,
  ...REQUESTS_TEXT,
  RESALE_TITLE,
  ...RESALE_TEXT,
  REQUESTS_LINK,
  RISK_ISSUER.title,
  ...RISK_ISSUER.paragraphs,
  ISSUER_TABLE_CAPTION,
  ...Object.values(ISSUER_TABLE_HEAD),
  ...ISSUER_ROWS.flatMap((r) => [r.action, r.effect]),
  ISSUER_QUOTE_NOTE,
  ...RISKS.flatMap((r) => [r.title, ...r.paragraphs]),
  MARGIN_TITLE,
  MARGIN_INTRO,
  ...MARGIN_POINTS,
  MARGIN_LINK,
  ...GLOSSARY.flatMap((g) => [g.term, g.definition]),
  ...QUESTIONS.flatMap((q) => [q.question, ...q.answer, q.link?.label ?? '']).filter((text) => text !== ''),
]
