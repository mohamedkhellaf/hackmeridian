// Every string of the landing page. Sentences are whole (never glued from fragments); the ones that carry a
// figure are functions that take the formatted figure. Required disclosures are not here: they come from
// core/disclosures. Voice: a clearing desk. Numbers before adjectives, who acts and by when, limits at the same
// size as benefits. No em dashes, arrows, exclamation marks or emoji; sentence case.
//
// Owner's direction of 11 Nov 2026 (brief 0.1): no disclaimer taglines ("Testnet only", "Fictional assets",
// "Unaudited" and the like) as slogans, chips, banners or footers. The network is named once, as a state, in
// the line above the navigation; limits are written as sentences; the footer is the legal footer of the app.

// The repository and document addresses live in core/links, shared with the app footer and Learn.
export { DOC_LINKS } from '../../core/links'

/** Section ids: the anchors of the top navigation and the footer. */
export const SECTION = {
  intents: 'what-you-can-do',
  lifecycle: 'how-it-works',
  proof: 'proof',
  different: 'what-is-different',
  margin: 'margin',
  limits: 'limits',
  questions: 'questions',
} as const

/** The thin line above the navigation: the network as a state, the ledger last read, the contract. */
export const STATUS = {
  label: 'Network',
  testnet: 'Testnet',
  mock: 'Mock data',
  ledger: 'Ledger',
  contract: 'Contract',
  contractLink: 'View the covered contract on the explorer',
} as const

export const NAV = {
  label: 'Landing',
  home: 'StellSec, top of the page',
  markets: 'Markets',
  lifecycle: 'How it works',
  proof: 'Proof',
  limits: 'Limits',
  openApp: 'Open app',
} as const

export const HERO = {
  label: 'Options on tokenized assets, on Stellar',
  h1Before: 'Set the ',
  h1Marked: 'lowest price',
  h1After: ' you would sell at.',
  lede: 'A put is the right to sell a tokenized fund, bond or equity at a set price until a set date. The seller’s full collateral is locked in the contract before you pay.',
  primary: 'Try it on Testnet',
  secondary: 'Read the contract',
  factsLabel: 'Three facts, each with its source',
  factTests: (unit: number, invariant: number, negative: number) => `contract tests run in CI: ${unit} unit, ${invariant} invariant, ${negative} negative`,
  factAdmin: 'admin keys, oracles or upgrade paths in the covered contract',
  factFee: 'network fee charged for the recorded exercise',
  factFeeLink: 'See the transaction',
  factTestsLink: 'Read the tests',
  factAdminLink: 'Read the source',
} as const

export const WIDGET = {
  heading: (code: string) => `Long put, ${code}`,
  recordedAside: 'Recorded example, not an open offer',
  openAside: 'Open offer',
  openAsideMock: 'Open offer, mock data',
  resaleAside: 'Resale listing',
  serialOffer: 'Offer No.',
  serialOption: 'No.',
  termsLabel: 'Terms of this put',
  hold: 'I hold',
  floor: 'Floor, per unit',
  until: 'Until',
  assetChoice: 'Asset I hold',
  floorChoice: 'Floor, per unit',
  untilChoice: 'Deadline',
  assetOption: (code: string, type: string) => `${code}, ${type.toLowerCase()}`,
  floorOption: (strike: string, perUnit: string) => `${strike}, premium ${perUnit} per unit`,
  wholeLot: (qty: string, code: string) => `Offers are whole lots. This one covers ${qty} ${code}.`,
  recordedLot: (premium: string, quote: string) => `Fixed terms of a past option. The premium was ${premium} ${quote}.`,
  premiumLine: (total: string, perUnit: string, quote: string) => `Premium ${total} ${quote} (${perUnit} per unit), paid once to the seller.`,
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
  more: (amount: string, quote: string) => `${amount} ${quote} more with the put.`,
  less: (amount: string, quote: string) => `${amount} ${quote} less with the put.`,
  same: 'The same with and without the put.',
  estimate: 'Estimate, depends on the price.',
  valueText: (code: string, price: string, withValue: string, withoutValue: string, quote: string, verdict: string) =>
    `${code} at ${price}. With the put ${withValue} ${quote}. Without ${withoutValue} ${quote}. ${verdict}`,
  captionExtra: 'Nothing settles by itself: you exercise before the deadline, and the issuer of the asset can freeze or claw it back.',
  figure: (n: number) => `Fig. ${n}.`,
  sourceRecorded: (ledger: string, amount: string) => `Exercised on Testnet at ledger ${ledger}. The maker had locked ${amount} in the contract.`,
  sourceRecordedLink: 'See the exercise',
  sourceLoading: 'Reading open offers from the contract.',
  sourceOpenLive: (amount: string, ledger: string) => `locked ${amount} in the contract. Read at ledger ${ledger}.`,
  sourceOpenNoLedger: (amount: string) => `locked ${amount} in the contract.`,
  sourceOpenMock: (amount: string) => `locked ${amount}. Mock data: no chain is read.`,
  sourceResale: (amount: string) => `is reselling it. The writer’s ${amount} stays locked in the contract.`,
  maker: 'Maker',
  holder: 'Holder',
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
  flow: string
  action: string
  actionContext: string
}

export const INTENTS = {
  heading: 'Three things you can do',
  lead: 'Each one is a single option seen from one side. The examples are options that ran on Testnet on 26 October 2026, in exact units.',
  recordedLabel: 'Recorded',
  recordedLink: 'See the transaction',
  items: [
    {
      id: 'floor',
      name: 'Set a floor',
      statement: 'Keep the right to sell at a price you choose, until a date you choose.',
      flowLabel: 'You pay',
      flow: 'a premium, once, now',
      action: 'Choose an asset',
      actionContext: ' to set a floor',
    },
    {
      id: 'earn-hold',
      name: 'Earn on what you hold',
      statement: 'Lock what you hold and agree to sell it at a higher price if a buyer asks before the deadline.',
      flowLabel: 'You are paid',
      flow: 'a premium now',
      action: 'Choose an asset',
      actionContext: ' to earn on what you hold',
    },
    {
      id: 'earn-buy',
      name: 'Earn while waiting to buy',
      statement: 'Lock USDx and agree to buy at a lower price if a holder asks before the deadline.',
      flowLabel: 'You are paid',
      flow: 'a premium now',
      action: 'Choose an asset',
      actionContext: ' to earn while waiting to buy',
    },
  ] satisfies IntentCopy[],
  floorExample: (premium: string, deadline: string, qty: string, strike: string) =>
    `The holder paid ${premium}. Until ${deadline} it could sell ${qty} for ${strike}, and it did.`,
  earnHoldExample: (qty: string, premium: string, strike: string) =>
    `The maker locked ${qty} and received ${premium}. The buyer took them for ${strike} before the deadline.`,
  earnBuyExample: (collateral: string, premium: string, qty: string) =>
    `The maker locked ${collateral} and received ${premium}. The holder then sold it ${qty} for the ${collateral}.`,
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
  afterNote: 'Nothing settles by itself. If you hold an option and do not exercise it before the deadline, it expires.',
  fourth: 'A fourth use, Lock a buy price, is the same call seen from the buyer’s side. It is in the app.',
} as const

export interface LifecycleStepCopy {
  id: 'write' | 'buy' | 'exercise' | 'deadline' | 'collect'
  title: string
  who: string
  when: string
  state: string
}

export const LIFECYCLE = {
  heading: 'One option, five steps',
  lead: (date: string) =>
    `Option No. 8 was written, bought, exercised and claimed on Testnet on ${date}. Each step below is one transaction, signed by the party named. Nothing happens between the steps unless someone acts.`,
  tableCaption: 'The five steps of an option: who acts, by when, what moves, and the recorded transaction',
  columns: { step: 'Step', who: 'Who acts', when: 'By when', moves: 'What moves', recorded: 'Recorded on Testnet' },
  stateAfter: 'State after',
  fee: (xlm: string) => `Fee ${xlm} XLM`,
  ledger: (n: string) => `Ledger ${n}`,
  noTx: 'No transaction. Time passes.',
  steps: [
    { id: 'write', title: 'The maker writes the offer', who: 'The maker', when: 'Any time. The offer names its own deadline, at most two years ahead.', state: 'Offered' },
    { id: 'buy', title: 'A buyer pays the premium', who: 'The buyer', when: 'Before the deadline, while the offer is open.', state: 'Active' },
    { id: 'exercise', title: 'The holder exercises', who: 'The holder. Nobody does it for them.', when: 'Before the deadline, by ledger close time.', state: 'Exercised' },
    { id: 'deadline', title: 'Or the deadline passes', who: 'Nobody', when: 'At the deadline.', state: 'Expired' },
    { id: 'collect', title: 'The maker collects', who: 'The maker', when: 'Any time after an exercise, or after the deadline.', state: 'Settled' },
  ] satisfies LifecycleStepCopy[],
  movesWrite: (collateral: string) => `${collateral} from the maker into the contract.`,
  movesBuy: (premium: string) => `${premium} from the buyer to the maker. It is not refunded.`,
  movesExercise: (qty: string, strike: string) => `${qty} to the contract and ${strike} to the holder, in one transaction. If either leg fails, nothing moves.`,
  movesDeadline: 'Nothing. The option can no longer be exercised and the premium stays with the maker.',
  movesCollect: (qty: string, collateral: string) => `After an exercise, ${qty} from the contract to the maker. After an expiry, the ${collateral} back to the maker.`,
  claimLabel: 'Claim delivery',
  reclaimLabel: 'Reclaim, option No. 1',
  earlier: 'These transactions called the v1.3.1 deployment of the covered contract. The contract the app uses today, v1.5, keeps these functions unchanged.',
  more: 'Read the full guide',
} as const

export const PROOF = {
  heading: 'Proof',
  lead: 'Each claim has its evidence beside it: a test suite, a file of source code or a Testnet transaction.',
  tableCaption: 'Claims and the evidence for each',
  columns: { claim: 'Claim', evidence: 'Evidence', kind: 'Kind' },
  kind: { tests: 'Test suite', source: 'Source code', tx: 'Testnet transaction', txs: 'Testnet transactions', record: 'Build record' },
  tests: (total: number, unit: number, invariant: number, negative: number) =>
    `${total} tests of the covered contract pass in CI: ${unit} unit, ${invariant} invariant against a reference model (two of them over random sequences of calls), ${negative} negative.`,
  testsEvidence: 'contracts/options',
  admin: 'The covered contract has no admin key, no oracle and no upgrade path.',
  adminEvidence: 'contracts/options/src/lib.rs',
  wasm: (bytes: string) => `The deployed wasm is ${bytes} bytes and, by the deployment record, byte-identical to a build of the source.`,
  wasmEvidence: 'Deployment record',
  lifecycle: 'A put was written, bought, exercised and claimed. It is the recorded option on this page.',
  fee: (xlm: string) => `That exercise was charged ${xlm} XLM in network fees.`,
  issuer: 'An asset was listed at runtime. Until its issuer authorized the contract to hold it, an offer on it was refused.',
  clawback: 'An issuer clawed collateral back from the contract. Offers on that token were refused until the issuer repaid.',
  resale: 'A holder resold an active option. The holder changed and the collateral did not move.',
  request: 'A buyer escrowed a premium for terms of its own, and a maker filled it in one transaction.',
  all: 'Every recorded transaction',
  shaLabel: 'sha256',
} as const

export const DIFFERENT = {
  heading: 'What is different',
  lead: 'Three properties of the covered contract, each with the limit that comes with it.',
  limitLabel: 'The limit',
  items: [
    {
      id: 'issuer',
      title: 'The issuer’s rules stay in force',
      body: 'Many tokenized assets are regulated: the issuer decides who may hold them. Eligibility here is the asset’s own authorization, read from its Stellar Asset Contract. The contract checks the issuer’s decision. It does not replace it.',
      limit: 'The issuer can also freeze an account or claw tokens back, and that can block settlement.',
    },
    {
      id: 'collateral',
      title: 'Collateral is locked before you pay',
      body: 'A maker cannot post an offer without funding it: the full strike for a put, the full underlying for a call, held by the contract itself. You can compare what the contract owes with what it holds on the Reserves page before you buy.',
      limit: 'Offers are whole lots. A lot cannot be split and an option cannot be partly exercised.',
    },
    {
      id: 'atomic',
      title: 'Delivery and payment are one transaction',
      body: 'At exercise the asset and the payment cross in a single contract call. There is no moment when one side has delivered and the other has not.',
      limit: 'Nothing is exercised for you. An option not exercised before its deadline expires.',
    },
  ],
  reserves: 'Open Reserves',
} as const

export const MARGIN = {
  heading: 'Margin',
  body: 'Margin is a second contract, kept apart from the covered one, for uncovered calls. The writer posts partial margin in USDx and can be liquidated, with a pre-funded vault as the backstop. Payouts can be reduced; any deficit is shown. Prices and the settlement price are set by the team’s publisher, not by a market.',
  isolation: 'It shares no storage and no balance with the covered contract.',
  open: 'Open Margin',
  evidence: 'Margin evidence run',
  off: 'Margin is not part of this build.',
} as const

export const LIMITS = {
  heading: 'Limits',
  lead: 'What the product does today, next to what it does not.',
  tableCaption: 'What exists and what does not',
  exists: 'What exists',
  missing: 'What does not',
  rows: [
    { id: 'audit', exists: (total: number) => `${total} contract tests run in CI.`, missing: 'No independent auditor has reviewed the contracts.' },
    {
      id: 'mainnet',
      exists: () => 'The contract is deployed on the Stellar test network.',
      missing: 'It is not deployed on the public network. Its tokens are test assets with no monetary value.',
    },
    {
      id: 'assets',
      exists: () => 'Three assets (RWA, BOND, EQTY) and a quote token (USDx) are listed, all issued by the team.',
      missing: 'They stand for no real instrument, and no outside issuer is involved.',
    },
    {
      id: 'makers',
      exists: () => 'The offers on the book are written by the team’s own accounts.',
      missing: 'There are no independent makers, no depth and no pricing model behind the premiums.',
    },
    {
      id: 'settle',
      exists: () => 'Every option has a deadline, decided by ledger close time.',
      missing: 'Nothing is exercised for you. An option not exercised before its deadline expires.',
    },
    {
      id: 'issuer',
      exists: () => 'The contract reads the issuer’s authorization from the asset itself.',
      missing: 'It cannot stop the issuer from freezing an account or clawing tokens back. That can block settlement, and the premium is not refunded.',
    },
    {
      id: 'clawback',
      exists: () => 'The Reserves page compares, per token, what the contract owes with what it holds.',
      missing: 'After a clawback there is no refund: the remaining payouts are first come, first served.',
    },
  ],
  reserves: 'Open Reserves',
} as const

export const QUESTIONS = {
  heading: 'Questions',
  items: [
    { q: 'Is this real money?', a: 'No. The contracts run on the Stellar test network, and the tokens (RWA, BOND, EQTY and the quote token USDx) are test assets issued by the team. They have no monetary value.' },
    { q: 'How do I get test tokens?', a: 'Fund a Testnet account with Friendbot, add trustlines for USDx and the asset, then swap test XLM for them on the Stellar DEX, where the two issuers keep standing offers.' },
    { q: 'Who sells the options?', a: 'On Testnet, the team’s own maker accounts. Any eligible account can write an offer or fill a request, and nothing matches automatically.' },
    { q: 'What happens if I do nothing at the deadline?', a: 'The option expires and the premium stays with the maker. Nothing settles by itself, so the deadline is shown on every position.' },
    { q: 'Can the issuer stop me?', a: 'Yes. The issuer of an asset can freeze an account, de-authorize the contract or claw tokens back. Any of these can make an option impossible to exercise, and the premium is not refunded.' },
    { q: 'What is the difference between Covered and Margin?', a: 'Covered is the contract this page describes: the maker locks the full strike or the full underlying before the sale. Margin is a separate contract for uncovered calls on partial margin, where payouts can be reduced.' },
    { q: 'Has it been audited?', a: 'No. No independent auditor has reviewed the contracts. What exists instead is listed under Proof.' },
    { q: 'Why Stellar?', a: 'Regulated assets on Stellar carry their rules in the ledger: authorization, freeze and clawback are flags on the asset itself, and one contract can serve every classic asset through the Stellar Asset Contract.' },
  ],
} as const

export const CLOSING = {
  heading: 'Try a put on Testnet.',
  body: 'It takes a wallet and a few test tokens.',
  primary: 'Open the markets',
  ornament: 'Decorative. Not a pricing model.',
} as const

export const FOOTER = {
  /** Legal lines the Stellar brand policy asks for where the name is used. They follow the app's legal notice. */
  trademark: '“Stellar” is a trademark of the Stellar Development Foundation. All rights reserved.',
  independent: 'This is independent software, not affiliated with, sponsored or endorsed by the Stellar Development Foundation.',
  groups: {
    app: 'The app',
    page: 'On this page',
    read: 'Read',
  },
  app: { markets: 'Markets', portfolio: 'Portfolio', requests: 'Requests', reserves: 'Reserves', learn: 'How it works', issuer: 'Issuer', design: 'Design system' },
  page: { intents: 'What you can do', lifecycle: 'Five steps', proof: 'Proof', different: 'What is different', limits: 'Limits', questions: 'Questions' },
  read: { spec: 'Product spec', abi: 'Contract ABI', evidence: 'Testnet evidence', source: 'Source code', llms: 'llms.txt' },
  contract: 'Covered contract',
  contractCopy: 'Copy contract id',
  contractExplorer: 'View the covered contract on the explorer',
  navLabel: 'Footer',
} as const
