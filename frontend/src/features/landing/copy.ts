// Every string of the landing page. Sentences are whole (never glued from fragments); the ones that carry a
// figure are functions that take the formatted figure. Required disclosures are not here: they come from
// core/disclosures. Voice: a clearing desk. Numbers before adjectives, who acts and by when.
// No em dashes, arrows, exclamation marks or emoji; sentence case.
//
// Owner's direction of 11 Nov 2026 (brief 0.1): no disclaimer taglines, no line that is there to sound careful.
// A fact is told once on the page: each limit in the Limits table (plus the one step where it happens), each
// figure and each transaction hash in one place. The network is named where the visitor acts on it.

// The repository and document addresses live in core/links, shared with the app footer and Learn.
export { DOC_LINKS } from '../../core/links'

/** Section ids: the anchors of the top navigation. */
export const SECTION = {
  intents: 'what-you-can-do',
  lifecycle: 'how-it-works',
  proof: 'proof',
  different: 'what-is-different',
  margin: 'margin',
  limits: 'limits',
} as const

/** The thin line above the navigation, on a build that reads the chain: the network, the ledger, the contract. */
export const STATUS = {
  label: 'Network',
  testnet: 'Testnet',
  ledger: 'Ledger',
  contract: 'Contract',
  contractLink: 'View the Covered contract on the explorer',
} as const

export const NAV = {
  label: 'Landing',
  home: 'StellSec, top of the page',
  lifecycle: 'How it works',
  proof: 'Proof',
  limits: 'Limits',
  openApp: 'Open app',
} as const

export const HERO = {
  label: 'Options on tokenized assets, on Stellar',
  h1: 'Set the lowest price you would sell at.',
  /** One mechanism sentence (brief 4.1). That the maker's collateral is locked first is said by the note's source
   * line, with its figure, and by "What is different". */
  lede: 'A put is the right to sell a tokenized fund, bond or equity at a set price until a set date.',
  primary: 'Try it on Testnet',
  secondary: 'Read the contract',
} as const

/** Stands for the lot inside a lot sentence of `WIDGET` (see `lotOpen`). */
export const LOT_SLOT = '{lot}'

export const WIDGET = {
  heading: (code: string) => `Long put, ${code}`,
  recordedAside: 'Recorded example',
  openAsideMock: 'Mock data',
  resaleAside: 'Resale listing',
  serialOffer: 'Offer No.',
  serialOption: 'No.',
  termsLabel: 'Terms of this put',
  hold: 'I hold',
  floor: 'Floor, per unit',
  until: 'Until',
  assetOption: (code: string, type: string) => `${code}, ${type.toLowerCase()}`,
  floorOption: (strike: string, perUnit: string, lot: string) => `${strike}, premium ${perUnit} per unit, for ${lot}`,
  floorOptionBare: (strike: string, lot: string) => `${strike}, for ${lot}`,
  untilOption: (date: string, lot: string) => `${date}, for ${lot}`,
  /**
   * The lot and the premium of the put shown, one sentence each. The widget passes `LOT_SLOT` for `lot` and sets
   * the lot itself in its place, so that a changed lot can carry the marker flash.
   */
  lotOpen: (lot: string, total: string, perUnit: string) => `This offer covers ${lot} for ${total} (${perUnit} per unit), paid once to the maker.`,
  lotResale: (lot: string, total: string, perUnit: string) => `This listing covers ${lot} for ${total} (${perUnit} per unit), paid once to the seller.`,
  lotRecorded: (lot: string, total: string, perUnit: string) => `This option covered ${lot} for ${total} (${perUnit} per unit), paid once to the maker.`,
  moved: (asked: string, day: string, shown: string) => `No offer at ${asked} for ${day}. Showing the nearest floor, ${shown}.`,
  floorLevel: (strike: string) => `Floor ${strike}`,
  withLabel: 'With the put',
  withoutLabel: 'Without',
  chartTitle: (qty: string, code: string, strike: string) => `What ${qty} ${code} would be worth at the deadline, with and without a put at ${strike}`,
  slider: (code: string) => `Assumed ${code} price at the deadline`,
  xLabel: (code: string, quote: string) => `${code} price at the deadline, ${quote} per unit`,
  ifPrice: (code: string, price: string) => `If ${code} is at ${price} at the deadline, with the put`,
  without: 'Without',
  sellAtFloor: (qty: string, strike: string, premium: string) => `Sell ${qty} at ${strike}, less the ${premium} you paid.`,
  keepAsset: (qty: string, code: string, worth: string, premium: string) => `Keep ${qty} ${code} worth ${worth}, less the ${premium} you paid.`,
  more: (amount: string, quote: string) => `+${amount} ${quote} more with the put.`,
  less: (amount: string, quote: string) => `−${amount} ${quote} less with the put.`,
  same: 'The same with and without the put.',
  valueText: (code: string, price: string, withValue: string, withoutValue: string, quote: string, verdict: string) =>
    `${code} at ${price}. With the put ${withValue} ${quote}. Without ${withoutValue} ${quote}. ${verdict}`,
  sourceRecorded: (ledger: string, amount: string) => `Exercised at ledger ${ledger}. The maker had locked ${amount} in the contract.`,
  sourceRecordedLink: 'See the exercise',
  sourceOpenLive: (amount: string, ledger: string) => `locked ${amount} in the contract. Read at ledger ${ledger}.`,
  sourceOpenNoLedger: (amount: string) => `locked ${amount} in the contract.`,
  sourceOpenMock: (amount: string) => `locked ${amount}.`,
  sourceResale: (amount: string) => `is reselling it. The maker’s ${amount} stays locked in the contract.`,
  maker: 'Maker',
  holder: 'Seller',
  open: 'Open this offer',
  /** Nothing at all is open. `ledger` is null when no chain is read. */
  noOffer: (ledger: string | null) => (ledger === null ? 'No offer is open right now.' : `No offer is open in the contract at ledger ${ledger}.`),
  /** Offers are open, but no put on the dates and strikes the app lists. */
  noStandardPut: (ledger: string | null) =>
    ledger === null ? 'No put on the standard dates and strikes is open right now.' : `No put on the standard dates and strikes is open in the contract at ledger ${ledger}.`,
  otherOffers: { one: 'One other offer is open.', other: (count: string) => `${count} other offers are open.` },
  stillRecorded: 'The example above is recorded.',
  markets: 'See the markets',
  request: 'Post a request',
  error: 'Could not read the open offers. The example above is recorded.',
  retry: 'Try again',
  announceOpen: 'The example now shows an open offer from the contract.',
} as const

export interface IntentCopy {
  id: 'floor' | 'earn-hold' | 'earn-buy'
  name: string
  statement: string
  flowLabel: 'You pay' | 'You are paid'
  action: string
  actionContext: string
}

export const INTENTS = {
  heading: 'What you can do',
  items: [
    {
      id: 'floor',
      name: 'Set a floor',
      statement: 'Keep the right to sell at a price you choose, until a date you choose.',
      flowLabel: 'You pay',
      action: 'Choose an asset',
      actionContext: ' to set a floor',
    },
    {
      id: 'earn-hold',
      name: 'Earn on what you hold',
      statement: 'Lock what you hold and agree to sell it at a higher price if a buyer asks before the deadline.',
      flowLabel: 'You are paid',
      action: 'Choose an asset',
      actionContext: ' to earn on what you hold',
    },
    {
      id: 'earn-buy',
      name: 'Earn while waiting to buy',
      statement: 'Lock USDx and agree to buy at a lower price if a holder asks before the deadline.',
      flowLabel: 'You are paid',
      action: 'Choose an asset',
      actionContext: ' to earn while waiting to buy',
    },
  ] satisfies IntentCopy[],
  /** The recorded premium of each example, in the one row under its figure. */
  paid: (premium: string) => `${premium}, once, now`,
  received: (premium: string) => `${premium}, now`,
  floorFigure: (qty: string, strike: string) => `Hold ${qty} and buy a put at ${strike}.`,
  earnHoldFigure: (qty: string, strike: string) => `Hold ${qty} and write a call at ${strike}.`,
  earnBuyFigure: (collateral: string, strike: string) => `Set ${collateral} aside and write a put at ${strike}.`,
  floorWith: 'With the put',
  earnHoldWith: 'With the call written',
  earnBuyWith: 'With the put written',
  without: 'Without',
  floorLevel: (strike: string) => `Floor ${strike}`,
  capLevel: (strike: string) => `Cap ${strike}`,
  buyLevel: (strike: string) => `Buy at ${strike}`,
  chartTitle: (name: string) => `${name}: what you would hold at the deadline, with and without the option`,
} as const

export interface LifecycleStepCopy {
  id: 'write' | 'buy' | 'exercise' | 'deadline' | 'collect'
  title: string
  who: string
  when: string
}

export const LIFECYCLE = {
  heading: 'How it works',
  lead: (date: string) => `Option No. 8 was written, bought, exercised and claimed on ${date}. Each step is one transaction, signed by the party named.`,
  tableCaption: 'The steps of an option: who acts, by when, what moves, and the recorded transaction',
  columns: { step: 'Step', who: 'Who acts', when: 'By when', moves: 'What moves', recorded: 'Transaction' },
  /** The deadline row is the alternative to the exercise: it carries "or" where the others carry a number. */
  or: 'or',
  stepLabel: (n: number) => `Step ${n}: `,
  orLabel: (n: number) => `Step ${n}, or: `,
  noTx: 'No transaction.',
  steps: [
    { id: 'write', title: 'The maker writes the offer', who: 'The maker', when: 'Any time. The offer names its own deadline, at most two years ahead.' },
    { id: 'buy', title: 'A buyer pays the premium', who: 'The buyer', when: 'Before the deadline, while the offer is open.' },
    { id: 'exercise', title: 'The holder exercises', who: 'The holder', when: 'Before the deadline, by ledger close time.' },
    { id: 'deadline', title: 'The deadline passes', who: 'Nobody', when: 'At the deadline.' },
    { id: 'collect', title: 'The maker collects', who: 'The maker', when: 'Any time after an exercise, or after the deadline.' },
  ] satisfies LifecycleStepCopy[],
  movesWrite: (collateral: string) => `${collateral} from the maker into the contract.`,
  movesBuy: (premium: string) => `${premium} from the buyer to the maker. It is not refunded.`,
  movesExercise: (qty: string, strike: string) => `${qty} to the contract and ${strike} to the holder, in one transaction. If either leg fails, nothing moves.`,
  movesDeadline: 'Nothing. The option can no longer be exercised and the premium stays with the maker.',
  movesCollect: (qty: string, collateral: string) => `After an exercise, ${qty} from the contract to the maker. After the deadline, the ${collateral} back to the maker.`,
  claimLabel: 'Claim delivery',
  reclaimLabel: 'Reclaim, option No. 1',
  earlier: 'Recorded on v1.3.1 of the Covered contract. The app uses v1.5, where these functions are unchanged.',
  more: 'Read the full guide',
} as const

export const PROOF = {
  heading: 'Proof',
  tableCaption: 'Claims and the evidence for each',
  columns: { claim: 'Claim', evidence: 'Evidence' },
  tests: (total: number, unit: number, invariant: number, negative: number) =>
    `${total} tests of the Covered contract pass in CI: ${unit} unit, ${invariant} invariant against a reference model (two of them over random sequences of calls), ${negative} negative.`,
  testsEvidence: 'contracts/options',
  admin: 'The Covered contract has no admin key, no oracle and no upgrade path.',
  adminEvidence: 'contracts/options/src/lib.rs',
  wasm: 'According to the deployment record, the deployed code is byte-identical to a build of the source.',
  wasmEvidence: 'Deployment record',
  fee: (xlm: string) => `Exercising the recorded put cost ${xlm} XLM in network fees.`,
  issuer: 'An asset was listed at runtime and its issuer then authorized the contract to hold it. Before that, a simulated offer on it was refused.',
  clawback: 'On a separate instance of the same wasm, an issuer clawed collateral back. Simulated offers on that token were refused until the issuer repaid.',
  resale: 'A holder resold an active option. The holder changed and the collateral did not move.',
  request: 'A buyer escrowed a premium for terms of its own, and a maker filled it in one transaction.',
  all: 'Every recorded transaction',
} as const

export const DIFFERENT = {
  heading: 'What is different',
  items: [
    {
      id: 'issuer',
      title: 'The issuer’s rules stay in force',
      body: 'Many tokenized assets are regulated: the issuer decides who may hold them. Eligibility here is the asset’s own authorization, read from its Stellar Asset Contract. The contract checks the issuer’s decision and does not replace it. The issuer can still freeze an account or claw tokens back, and that can block settlement.',
    },
    {
      id: 'collateral',
      title: 'Collateral is locked before you pay',
      body: 'A maker cannot post an offer without funding it: the full strike for a put, the full underlying for a call, held by the contract itself. You can compare what the contract owes with what it holds on the Reserves page before you buy.',
    },
    {
      id: 'atomic',
      title: 'Delivery and payment are one transaction',
      body: 'At exercise the asset and the payment cross in a single contract call. There is no moment when one side has delivered and the other has not.',
    },
  ],
  reserves: 'Open Reserves',
} as const

export const MARGIN = {
  heading: 'Margin',
  body: 'Margin is a second contract for uncovered calls. The writer posts partial margin in USDx and can be liquidated, with a pre-funded vault as the backstop. Payouts can be reduced; any deficit is shown. Prices and the settlement price are set by the team’s publisher, not by a market.',
  isolation: 'It shares no storage and no balance with the Covered contract.',
  open: 'Open Margin',
  evidence: 'Margin evidence run',
  off: 'Margin is not part of this build.',
} as const

export const LIMITS = {
  heading: 'Limits',
  tableCaption: 'What exists and what does not',
  exists: 'What exists',
  missing: 'What does not',
  rows: [
    { id: 'audit', exists: 'The contracts are tested in CI.', missing: 'No independent auditor has reviewed them.' },
    {
      id: 'mainnet',
      exists: 'The contract is deployed on the Stellar test network.',
      missing: 'It is not deployed on the public network. Its tokens are test assets with no monetary value.',
    },
    {
      id: 'assets',
      exists: 'Three assets and a quote token are listed, all issued by the team.',
      missing: 'They stand for no real instrument, and no outside issuer is involved.',
    },
    {
      id: 'makers',
      exists: 'The offers on the book are written by the team’s own accounts.',
      missing: 'There are no independent makers, no depth and no pricing model behind the premiums.',
    },
    {
      id: 'settle',
      exists: 'Every option has a deadline, decided by ledger close time.',
      missing: 'Nothing is exercised for you. An option not exercised before its deadline expires.',
    },
    {
      id: 'issuer',
      exists: 'The contract reads the issuer’s authorization from the asset itself.',
      missing: 'It cannot stop the issuer from freezing an account or clawing tokens back. That can block settlement, and the premium is not refunded.',
    },
    {
      id: 'clawback',
      exists: 'The Reserves page compares, per token, what the contract owes with what it holds.',
      missing: 'After a clawback shortfall there is no refund: the remaining payouts are first come, first served.',
    },
  ],
} as const

export const CLOSING = {
  heading: 'Try a put.',
  /** One sentence; the middle words link to the app's steps for getting test tokens. */
  bodyBefore: 'It takes a wallet and ',
  bodyLink: 'a few test tokens',
  bodyAfter: '.',
  primary: 'Open the markets',
} as const

export const FOOTER = {
  groups: {
    app: 'The app',
    read: 'Read',
  },
  app: { markets: 'Markets', portfolio: 'Portfolio', requests: 'Requests', reserves: 'Reserves', learn: 'Learn', issuer: 'Issuer' },
  read: { spec: 'Product spec', abi: 'Contract ABI', evidence: 'Recorded transactions', source: 'Source code' },
  contract: 'Covered contract',
  contractCopy: 'Copy contract id',
  contractExplorer: 'View the Covered contract on the explorer',
  navLabel: 'Footer',
} as const
