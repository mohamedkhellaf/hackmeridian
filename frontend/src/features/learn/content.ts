// Every sentence of the Learn page, in one place (brief D18: copy lives in feature-level constants and is never
// concatenated from fragments). Facts come from PRODUCT_SPEC.md, README.md, AGENTS.md and src/core only.
//
// Voice: a clearing desk. Numbers before adjectives; "can" for rights, "is locked" for facts, "must" for
// deadlines; the contract's own verbs. The required disclosure sentences of core/disclosures are not retyped
// here: each has its one home elsewhere, and this page restates limits in its own words (brief D16).
// content.test.ts checks every string below against the banned wording.

import { NBSP } from '../../core/format'
import type { GuidedIntent } from '../../core/payoff/strategies'
import { FAUCET_PRICE } from '../../core/reference'
import type { Scenario, WorkedExample } from './examples'

// ---------------------------------------------------------------------------------------------- page

export const PAGE_TITLE = 'How it works'
export const PAGE_DESCRIPTION = 'What an option is here, who acts and by when, what it costs and what can go wrong.'

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

/** Three sentences, no more. */
export const WHAT_THIS_IS: readonly [string, string, string] = [
  'StellSec is a venue for options on tokenized assets, on Stellar Testnet: a put is the right to sell a set quantity of an asset at a set price until a deadline, and a call is the right to buy it.',
  'The seller, called the maker, locks the whole collateral in the contract before anyone can buy: the full strike for a put, the full quantity of the asset for a call.',
  'The buyer pays a premium once and can exercise at any time before the deadline; exercise swaps the tokens against the strike in one transaction, and nothing settles by itself.',
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
  { rule: 'Amounts', text: 'Exact integers with 7 decimals. The contract stores totals, not prices per unit.' },
  { rule: 'Longest term', text: '2 years from the day the offer is written.' },
  { rule: 'Open at once', text: '500 offers and 500 requests per asset; 50 offers per maker and 50 requests per buyer.' },
  { rule: 'Who can take part', text: 'Any account the issuer of the asset allows to hold it. The contract checks this; it does not decide it.' },
  { rule: 'Control', text: 'No admin, no price feed and no upgrade path.' },
]

// ---------------------------------------------------------------------------------------------- 2. lifecycle

export const LIFECYCLE_TIMELINE_LABEL = 'The life of one put, step by step'

export const lifecycleIntro = (x: WorkedExample): string =>
  `Follow one put on ${x.qtyText}: a strike of ${x.strikePerUnitText}${NBSP}${x.quoteCode} per ${x.assetCode}, ${x.strikeTotalText} in all, for a premium of ${x.premiumText}. It has just been bought, so the first two steps are behind it.`

export interface LifecycleStep {
  /** By when. */
  when: string
  /** Who acts. */
  who: string
  title: string
  text: string
  /** The contract state the option is in after the step, when the step changes it. */
  state?: string
}

/** `deadline` is the canonical UTC text of the deadline: `20 Nov 2026, 08:00 UTC`. */
export const lifecycleSpine = (x: WorkedExample, deadline: string): LifecycleStep[] => [
  {
    when: 'Before the sale',
    who: 'The maker acts',
    title: 'The maker locks the collateral and posts an offer',
    text: `${x.collateralText}, the whole strike, moves from the maker into the contract. The offer states every term: a put on ${x.qtyText} at ${x.strikePerUnitText}${NBSP}${x.quoteCode} each, a premium of ${x.premiumText}, a deadline of ${deadline}. While nobody has bought it, the maker can cancel it and take the collateral back.`,
    state: 'Offered',
  },
  {
    when: 'Any time before the deadline',
    who: 'The buyer acts',
    title: 'A buyer pays the premium and becomes the holder',
    text: `${x.premiumText} goes from the buyer to the maker. It is paid once and is never refunded. From here nobody can cancel the option: the right belongs to the holder.`,
    state: 'Active',
  },
  {
    when: `Until ${deadline}`,
    who: 'The holder decides',
    title: 'The holder can exercise',
    text: 'At any time before the deadline the holder can use the right, for the whole quantity or not at all. The contract reads no price and takes no decision: whether and when to exercise is up to the holder.',
  },
]

export const LIFECYCLE_FORK_INTRO = 'Then one of two things happens.'

export interface LifecycleBranch {
  id: 'exercised' | 'expired'
  title: string
  label: string
  steps: LifecycleStep[]
}

export const lifecycleBranches = (x: WorkedExample): LifecycleBranch[] => [
  {
    id: 'exercised',
    title: 'The holder exercises',
    label: 'If the holder exercises, step by step',
    steps: [
      {
        when: 'Before the deadline',
        who: 'The holder acts',
        title: 'Tokens against the strike, in one transaction',
        text: `The holder delivers ${x.qtyText} into the contract and receives the ${x.strikeTotalText} that were locked. Exercise is physical: the asset itself changes hands. If any part fails, nothing moves.`,
        state: 'Exercised',
      },
      {
        when: 'Any time after the exercise',
        who: 'The maker acts',
        title: 'The maker claims what was delivered',
        text: `The ${x.qtyText} wait in the contract until the maker claims them. The premium stays with the maker.`,
        state: 'Settled',
      },
    ],
  },
  {
    id: 'expired',
    title: 'The deadline passes',
    label: 'If the deadline passes without an exercise, step by step',
    steps: [
      {
        when: 'At the deadline',
        who: 'Nobody acts',
        title: 'The option can no longer be exercised',
        text: `An option that was not exercised in time ends there, whatever ${x.assetCode} is worth. The holder has spent the ${x.premiumText}.`,
      },
      {
        when: 'Any time after the deadline',
        who: 'The maker acts',
        title: 'The maker reclaims the collateral',
        text: `The ${x.collateralText} return to the maker. The premium stays with the maker.`,
        state: 'Expired',
      },
    ],
  },
]

export const STATE_AFTER = 'State after'

export const NOTHING_SETTLES_TITLE = 'Nothing settles by itself'
export const NOTHING_SETTLES_LABEL = 'Deadline'
export const NOTHING_SETTLES_TEXT =
  'Every step above is a transaction that somebody signs. An option that is not exercised before its deadline expires, even when exercising would have paid. Tokens that a maker has not claimed or reclaimed stay in the contract until the maker acts.'

export const SIDES_TITLE = 'A call is the mirror of a put'
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
  `Each one is a single option, seen from your side. The four examples share one fictional lot: ${x.qtyText}, with ${x.assetCode} at ${x.startText}${NBSP}${x.quoteCode} when you start and a deadline of ${deadline}. The premiums are examples, not offers.`

export const EXAMPLE_SERIAL_LABEL = 'Example'
export const exampleSerial = (index: number, total: number): string => `${index} of ${total}`

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
  breakevenLabel: (x: WorkedExample) => string
  breakevenHint: string
  collateralLabel: string
  maxLossHint: (x: WorkedExample) => string
  maxGainHint: (x: WorkedExample) => string
  /** One sentence for a scenario: what happens and who acts. */
  outcome: (x: WorkedExample, s: Scenario) => string
  chartTitle: (x: WorkedExample) => string
  /** Label of the solid line of a with-and-without chart. */
  withLabel: string
  withoutLabel: string
  /** `Floor 10.00`, `Cap 10.50`: the level a with-and-without chart marks. */
  levelLabel?: (x: WorkedExample) => string
  /** The price the chart opens on. */
  openAt: number
  /** Text of the link to the guided flow. */
  action: string
}

export const TERM_LABELS = {
  quantity: 'Quantity',
  deadline: 'Deadline',
  maxLoss: 'Most you can lose',
  maxGain: 'Most you can gain',
  noCap: 'No cap',
} as const

/** The premium per unit, under its total: `0.36 USDx per BOND`. */
export const premiumPerUnit = (x: WorkedExample): string => `${x.premiumPerUnitText}${NBSP}${x.quoteCode} per ${x.assetCode}`

export const scenarioLabel = (x: WorkedExample, s: Scenario): string => `If ${x.assetCode} is at ${s.priceText}`

/** The signed difference a scenario makes against not having the option, with its unit: `+8.20 USDx more than without`. */
export function scenarioDelta(x: WorkedExample, s: Scenario): string {
  if (s.difference > 0) return `${s.differenceText}${NBSP}${x.quoteCode} more than without`
  if (s.difference < 0) return `${s.differenceText}${NBSP}${x.quoteCode} less than without`
  return `${s.differenceText}${NBSP}${x.quoteCode}, same as without`
}
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
    breakevenLabel: (x) => `Breakeven, per ${x.assetCode}`,
    breakevenHint: 'The floor less the premium',
    collateralLabel: 'Locked by the maker',
    maxLossHint: (x) => `With ${x.assetCode} at ${x.startText} when you start`,
    maxGainHint: (x) => `You keep any rise in ${x.assetCode}`,
    outcome: (x, s) =>
      s.exercised
        ? `You exercise: deliver ${x.qtyText} and receive ${x.strikeTotalText}, less the ${x.premiumText} you paid.`
        : `You do nothing and the put expires. You keep ${x.qtyText} worth ${s.assetValueText}${NBSP}${x.quoteCode}, less the ${x.premiumText} you paid.`,
    chartTitle: (x) => `Value of ${x.qtyText} at the deadline, with and without a put at ${x.strikePerUnitText}`,
    withLabel: 'With the put',
    withoutLabel: 'Without',
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
    breakevenLabel: (x) => `Breakeven, per ${x.assetCode}`,
    breakevenHint: 'The sale price plus the premium',
    collateralLabel: 'You lock',
    maxLossHint: (x) => `If ${x.assetCode} falls to zero from ${x.startText}`,
    maxGainHint: (x) => `The rise from ${x.startText} to ${x.strikePerUnitText}, plus the premium`,
    outcome: (x, s) =>
      s.exercised
        ? `If the holder exercises, your ${x.qtyText} go for ${x.strikeTotalText}, which you claim. You keep the ${x.premiumText}; the rise above ${x.strikePerUnitText} is not yours.`
        : `The call is not exercised. After the deadline you reclaim ${x.qtyText} worth ${s.assetValueText}${NBSP}${x.quoteCode} and keep the ${x.premiumText}.`,
    chartTitle: (x) => `Value of ${x.qtyText} at the deadline, with and without a call written at ${x.strikePerUnitText}`,
    withLabel: 'With the call written',
    withoutLabel: 'Without',
    levelLabel: (x) => `Cap ${x.strikePerUnitText}`,
    openAt: 12,
    action: 'Earn on what you hold in Markets',
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
    breakevenLabel: (x) => `Breakeven, per ${x.assetCode}`,
    breakevenHint: 'The buy price less the premium',
    collateralLabel: 'You lock',
    maxLossHint: (x) => `If you buy at ${x.strikePerUnitText} and ${x.assetCode} falls to zero`,
    maxGainHint: () => 'The premium',
    outcome: (x, s) =>
      s.exercised
        ? `If the holder exercises, your ${x.collateralText} buy ${x.qtyText}, which you claim, now worth ${s.assetValueText}${NBSP}${x.quoteCode}. You keep the ${x.premiumText}.`
        : `The put is not exercised. After the deadline you reclaim your ${x.collateralText} and keep the ${x.premiumText}.`,
    chartTitle: (x) => `Payoff at expiry, put written on ${x.qtyText} at ${x.strikePerUnitText}`,
    withLabel: 'With the put written',
    withoutLabel: 'Without',
    openAt: 8,
    action: 'Earn while waiting to buy in Markets',
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
    breakevenLabel: (x) => `Breakeven, per ${x.assetCode}`,
    breakevenHint: 'The buy price plus the premium',
    collateralLabel: 'Locked by the maker',
    maxLossHint: () => 'The premium',
    maxGainHint: (x) => `You keep any rise above ${x.strikePerUnitText}`,
    outcome: (x, s) =>
      s.exercised
        ? `You exercise: pay ${x.strikeTotalText} and receive ${x.qtyText} worth ${s.assetValueText}${NBSP}${x.quoteCode}, less the ${x.premiumText} you paid.`
        : `You do nothing and the call expires. You keep your ${x.strikeTotalText}, less the ${x.premiumText} you paid.`,
    chartTitle: (x) => `Payoff at expiry, long call on ${x.qtyText} at ${x.strikePerUnitText}`,
    withLabel: 'With the call',
    withoutLabel: 'Without',
    openAt: 12,
    action: 'Lock a buy price in Markets',
  },
}

// ---------------------------------------------------------------------------------------------- 4. requests and resale

export const REQUESTS_TITLE = 'Requests'
export const REQUESTS_TEXT =
  'When no offer has your terms, you can post a request. You name the option you want (put or call, asset, quantity, strike, deadline) and the premium you offer, and that premium is escrowed in the contract. Any eligible maker can fill it in one transaction: the maker locks the whole collateral, receives the escrowed premium, and the option exists with you as its holder. Until then you can cancel and the premium comes back in full. A request that reaches its deadline unfilled can no longer be filled; its premium returns when you cancel it, or when anyone clears expired requests. A request is filled whole or not at all, and requests and offers never match automatically: a maker fills a request, or a buyer takes an offer.'

export const RESALE_TITLE = 'Resale'
export const RESALE_TEXT =
  'A holder who no longer wants an option can list it for resale at a price of their choosing, in USDx. An eligible buyer, other than the holder or the maker, pays that price to the holder and becomes the holder in one transaction. Strike, deadline, quantity and the collateral in the contract do not change. If the seller raises the price while a buyer is signing, the purchase fails and nothing is paid. An option has one listing at most; it ends when the option is bought, exercised or expires, and the maker cannot buy the option back. The price is a limit set by one holder, not a quote from a market.'

export const REQUESTS_LINK = 'See open requests'

// ---------------------------------------------------------------------------------------------- 5. what can go wrong

export const RISKS_INTRO = 'Five limits of the Covered contract and of this deployment, each with what it costs you. Margin has other risks; they are set apart at the end.'

export interface RiskItem {
  id: string
  title: string
  paragraphs: readonly string[]
}

export const RISK_ISSUER: RiskItem = {
  id: 'issuer',
  title: 'The issuer can freeze an account or claw tokens back',
  paragraphs: [
    'A tokenized asset has an issuer, who decides who may hold it and can freeze an account or take tokens back. The contract checks the decision of the issuer before every trade; it cannot override it. The collateral covers the option, not what the issuer does.',
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
      'Nothing is exercised for you. An option that is in the money at its deadline and was not exercised expires all the same, and the premium is spent. The deadline is decided by the close time of the ledger, not by the clock of your device, so a transaction signed in the last minutes may land too late.',
      'Put the deadline in your calendar when you buy. Portfolio lists what is waiting for you; it sends no reminder.',
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
      'Contract storage also expires unless its rent is extended. Anyone can extend it, and the team runs a script that does.',
    ],
  },
  {
    id: 'unaudited',
    title: 'The contracts are not audited',
    paragraphs: [
      'Nobody independent has reviewed the code. The Covered contract has 250 automated tests (146 unit tests, 18 property-based invariants, 86 negative tests), and the contract on Testnet is byte-identical to a build of the published source. That is evidence, not an audit.',
      'The Covered contract has no admin and no upgrade path. Nobody can change its rules, and nobody can patch a defect in place.',
    ],
  },
]

export const MARGIN_TITLE = 'Margin has its own risks'
export const MARGIN_INTRO =
  'Margin is a separate, experimental contract for uncovered calls, settled in cash in USDx. Nothing in the sections above describes it. The two contracts share no storage and no balance, so a loss in Margin cannot reach collateral locked in the Covered contract.'

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

/** In alphabetical order. The vocabulary is the one of the interface: one word per thing. */
export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: 'Bid', definition: 'The name of a request where it sits in the book of a series, opposite the offers.' },
  { term: 'Call', definition: 'The right to buy a set quantity of an asset for the strike, at any time before the deadline.' },
  { term: 'Claim delivery', definition: 'After an exercise, the maker collects what the holder delivered: the asset for a put, the strike for a call.' },
  { term: 'Collateral', definition: 'What the maker locks in the contract to settle the option: the whole strike in USDx for a put, the whole quantity of the asset for a call.' },
  { term: 'Covered', definition: 'The regime this page describes, in which the maker locks the whole collateral before the sale.' },
  { term: 'Deadline', definition: 'The moment after which the option can no longer be exercised, by the close time of the ledger; the chain view calls it the expiry.' },
  { term: 'Eligible', definition: 'Allowed by the issuer to hold the asset; the contract refuses a maker, a buyer or a new holder who is not.' },
  { term: 'Exercise', definition: 'The holder uses the right: the asset and the strike change hands through the contract in one transaction, for the whole quantity.' },
  { term: 'Expiry', definition: 'The same instant as the deadline, under the name the chain view uses.' },
  { term: 'Holder', definition: 'The account that owns the option and the only one that can exercise it.' },
  { term: 'Issuer', definition: 'The account that issued an asset; it decides who may hold it and can freeze an account or claw tokens back.' },
  { term: 'Maker', definition: 'The account that locks the collateral and sells the option; a position calls it the writer.' },
  { term: 'Margin', definition: 'The separate, experimental contract in which a writer posts partial margin and calls settle in cash.' },
  { term: 'Offer', definition: 'An option a maker has put up for sale, with its collateral already locked in the contract.' },
  { term: 'Premium', definition: 'The price of the option, paid once by the buyer to the maker at purchase and never refunded.' },
  { term: 'Put', definition: 'The right to sell a set quantity of an asset for the strike, at any time before the deadline.' },
  { term: 'Reclaim', definition: 'After the deadline, the maker takes back the collateral of an option that was not exercised.' },
  { term: 'Reference price', definition: 'A price the interface shows, always with its source, to say where a strike stands; the Covered contract never reads a price.' },
  { term: 'Request', definition: 'The terms a buyer wants and the premium they offer, with that premium escrowed in the contract until a maker fills the request or the buyer cancels it.' },
  { term: 'Resale listing', definition: 'The price, in USDx, at which a holder is willing to hand an option over to an eligible buyer.' },
  { term: 'Reserves', definition: 'The page that sets, token by token, what the contract has locked against what it holds.' },
  { term: 'Strike', definition: 'The price at which the holder can sell (put) or buy (call); the contract stores it as a total for the whole quantity.' },
  { term: 'USDx', definition: 'The fictional test token in which strikes and premiums are paid.' },
  { term: 'Writer', definition: 'The maker of an option, under the name a position uses.' },
]

// ---------------------------------------------------------------------------------------------- 7. questions

export interface Question {
  id: string
  question: string
  answer: readonly string[]
}

export const QUESTIONS: readonly Question[] = [
  {
    id: 'real-money',
    question: 'Is this real money?',
    answer: [
      'No. Everything runs on Stellar Testnet. The assets, the makers and the token USDx are fictional, and none of the tokens has a monetary value.',
    ],
  },
  {
    id: 'who-sells',
    question: 'Who sells the options?',
    answer: [
      'Makers: accounts that lock the collateral and post offers. On this deployment the makers are the accounts of the team. Any eligible account can write an offer, and any eligible account can fill a request.',
    ],
  },
  {
    id: 'do-nothing',
    question: 'What happens if I do nothing at the deadline?',
    answer: [
      'The option expires. It is not exercised for you, whatever the price. After the deadline an exercise fails, the maker can reclaim the collateral, and the premium stays with the maker.',
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
    id: 'issuer',
    question: 'Can the issuer stop me?',
    answer: [
      'Yes. The issuer decides who may hold the asset and can freeze an account or claw tokens back. A frozen holder cannot exercise, and the premium is not refunded. The section "What can go wrong" lists each case.',
    ],
  },
  {
    id: 'price',
    question: 'Where does the price on screen come from?',
    answer: [
      `Not from the contract: the Covered contract reads no price. The interface shows a reference price with its source so that you can see where a strike stands. On Testnet it is the rate of the test faucet, ${FAUCET_PRICE}${NBSP}USDx per unit, fixed by the team. With mock data it is a demo price chosen by the team. Neither is a market.`,
      'You can always set your own assumed price on a payoff figure.',
    ],
  },
  {
    id: 'fees',
    question: 'What does a transaction cost?',
    answer: [
      'The contract takes no fee: premium, strike and asset move in full between the two sides. The network fee is paid in test XLM. Measured on Testnet: 0.031 XLM to write an offer, 0.003 to buy, 0.008 to exercise, 0.001 to claim.',
    ],
  },
  {
    id: 'covered-margin',
    question: 'What is the difference between Covered and Margin?',
    answer: [
      'Covered is what this page describes: the maker locks the whole collateral, and exercise delivers the asset itself. Margin is a separate, experimental contract: the writer posts partial margin, calls settle in cash at a price published by the team, and a holder can be paid less than the payoff, with the deficit shown.',
    ],
  },
  {
    id: 'audit',
    question: 'Has it been audited?',
    answer: ['No. The Covered contract has 250 automated tests and no admin or upgrade path. That is evidence, not an audit.'],
  },
]

/** Every string of this module that reaches the screen, for the wording tests. Templates are rendered by the test. */
export const STATIC_COPY: readonly string[] = [
  PAGE_TITLE,
  PAGE_DESCRIPTION,
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
  NOTHING_SETTLES_LABEL,
  NOTHING_SETTLES_TEXT,
  SIDES_TITLE,
  SIDES_CAPTION,
  ...Object.values(SIDES_HEAD),
  ...SIDES.flatMap((r) => [r.step, r.put, r.call]),
  EXAMPLE_SERIAL_LABEL,
  ...Object.values(TERM_LABELS),
  OUTCOMES_LABEL,
  REQUESTS_TITLE,
  REQUESTS_TEXT,
  RESALE_TITLE,
  RESALE_TEXT,
  REQUESTS_LINK,
  RISKS_INTRO,
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
  ...QUESTIONS.flatMap((q) => [q.question, ...q.answer]),
]
