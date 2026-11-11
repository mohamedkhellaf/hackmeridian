// Interface copy of the markets feature (brief D18: whole sentences in feature constants, never glued from
// fragments). Required disclosure sentences are not here: they come from core/disclosures.
import type { Intent } from '../../app/search'
import type { PayoffGlyph } from '../../ui'

export const MARKETS_TITLE = 'Markets'

export const INTENTS_HEADING = 'What do you want to do?'
export const ASSETS_HEADING = 'Assets'

export interface IntentCopy {
  /** The payoff shape of the position the intent opens. Always shown with the intent's name. */
  glyph: PayoffGlyph
  /** One line: what the user gets or agrees to. `quote` is the quote token code. */
  consequence: (quote: string) => string
  /** Who pays, in two words: the short form of `premium`, for a phone row. */
  payer: 'You pay' | 'You are paid'
  /** Who pays the premium, when, and that the premium is the price of the agreement. */
  premium: string
  /** The question the Assets section asks once the intent is chosen. */
  question: string
  /** The accessible name of an asset's action once the intent is chosen: "Set a floor on BOND". */
  choose: (code: string) => string
}

const PAY_ONCE = 'You pay for that right once, when you buy: the premium.'
// True whether a request is filled or an offer posted: nothing is paid until a buyer takes the terms.
const PAID_WHEN_TAKEN = 'A buyer pays you for that agreement, the premium, when one takes your terms.'

export const INTENT_COPY: Record<Intent, IntentCopy> = {
  floor: {
    glyph: 'long-put',
    consequence: () => 'Keep the right to sell at a price you choose, until a date you choose.',
    payer: 'You pay',
    premium: PAY_ONCE,
    question: 'Set a floor on which asset?',
    choose: (code) => `Set a floor on ${code}`,
  },
  'earn-hold': {
    glyph: 'short-call',
    consequence: () => 'Lock what you hold and agree to sell it at a higher price if a buyer asks before the deadline.',
    payer: 'You are paid',
    premium: PAID_WHEN_TAKEN,
    question: 'Earn on which asset?',
    choose: (code) => `Earn on ${code}`,
  },
  'earn-buy': {
    glyph: 'short-put',
    consequence: (quote) => `Lock ${quote} and agree to buy at a lower price if a holder asks before the deadline.`,
    payer: 'You are paid',
    premium: PAID_WHEN_TAKEN,
    question: 'Which asset would you buy at a lower price?',
    choose: (code) => `Earn while waiting to buy ${code}`,
  },
  'lock-buy': {
    glyph: 'long-call',
    consequence: () => 'Keep the right to buy at a price you choose, until a date you choose.',
    payer: 'You pay',
    premium: PAY_ONCE,
    question: 'Lock a buy price on which asset?',
    choose: (code) => `Lock a buy price on ${code}`,
  },
}

/** Beside an intent that leads straight to one asset, so the jump is expected. */
export const onAsset = (code: string): string => `on ${code}`

export const CHOICE_CANCEL = 'Choose something else'

// ---------------------------------------------------------------------------------------------- assets table

export const COL = {
  asset: 'Asset',
  tier: 'Tier',
  /** The price column when the rows' prices come from different sources; otherwise the source names it. */
  reference: 'Reference price',
  offers: 'Open offers',
  expiry: 'Nearest deadline',
  put: 'Cheapest put',
  call: 'Cheapest call',
  hold: 'You hold',
  action: 'Action',
} as const
/** The unit line of a premium column: the figures below it are bare. */
export const perUnitOf = (quote: string): string => `${quote} per unit`
/** Under a cheapest premium: the terms it is for, "at 97.00, 13 Nov". */
export const cheapestTerms = (strike: string, day: string): string => `at ${strike}, ${day}`

export const NONE = 'None'
export const TRADE = 'Trade'
export const tradeLabel = (code: string): string => `Trade ${code}`
/**
 * `Bond` for an asset of the app's list: the kind of instrument its label imitates, and nothing more (owner's
 * direction of 11 Nov 2026: no hedge word in a caption). What the token really is is said once, in a sentence,
 * on the asset's About tab (`TEST_TOKEN_NOTE`). An asset outside the list is only known to be listed.
 */
export const typeLine = (typeLabel: string | null): string => typeLabel ?? 'Listed asset'

/** About tab, under the facts heading: what a token of the app's list is. Said once, here. */
export const TEST_TOKEN_NOTE = "A test token issued by this project's issuer account on Stellar Testnet. It represents no real instrument and has no monetary value."

export const noOffersOn = (code: string): string => `No open offers on ${code}.`
export const POST_REQUEST = 'Post a request'
export const WRITE_FIRST = 'write the first offer'
/** The row of a token the contract is short of after a clawback; it links to Reserves, where the figures are. */
export const shortRow = (code: string): string => `Clawback shortfall: new trades on ${code} are refused.`

/** The count line, only when assets are hidden: what is shown and how many more the contract lists. */
export function listCountLine(shown: number, more: number): string {
  const head = shown === 1 ? 'Showing 1 reference asset.' : `Showing ${shown} reference assets.`
  return more === 1 ? `${head} 1 more is listed in the contract.` : `${head} ${more} more are listed in the contract.`
}
export const SHOW_ALL = 'Show all listed assets'
export const SHOW_REFERENCE = 'Show reference assets only'
export const similarCodeNote = (reference: string): string => `Not the reference asset ${reference}: another issuer, same or similar code.`

export const ASSETS_EMPTY = 'No asset is listed in the contract.'
export const ASSETS_ERROR = 'The markets could not be read.'
export const REFRESH_FAILED = 'Could not refresh. Showing the last read.'
export const RETRY = 'Try again'

// ---------------------------------------------------------------------------------------------- get test funds

export const FUNDS_TITLE = 'Get test funds'
/** The lead, from what the wallet holds: nothing at all, no quote token, or enough (the strip was asked for). */
export const FUNDS_LEAD = {
  none: 'This wallet holds none of the tokens traded here. Three steps, all in your wallet.',
  noQuote: (quote: string) => `This wallet holds no ${quote}, the token premiums and strikes are paid in. Three steps, all in your wallet.`,
  asked: 'Three steps, all in your wallet.',
} as const
export const FUNDS_MOCK_NOTE = 'This build runs on mock data, so these steps will not change the balances shown here. They are the steps on Testnet.'
export const FUNDS_STEPS = {
  fund: {
    title: 'Fund the account',
    body: 'Friendbot, the Testnet faucet of Stellar, creates the account and gives it test XLM.',
    link: 'Fund this account with Friendbot',
  },
  trust: {
    title: 'Add trustlines',
    body: (quote: string) => `In your wallet, add ${quote} and the asset you want, each by code and issuer. The demo issuer authorizes every new trustline by itself.`,
  },
  swap: {
    title: 'Swap XLM for test tokens',
    body: "Use your wallet's swap. The rates are fixed by the faucet and are not a market.",
  },
} as const
export const STEP_DONE = 'Done'
export const FUNDS_CHECK = 'Check again'
/** Beside the balances of an asset page when the wallet cannot pay: leads to the strip above. */
export const FUNDS_LINK = 'Get test funds'

// ---------------------------------------------------------------------------------------------- asset page

export const BACK_TO_MARKETS = 'Markets'
export const MODE_LABEL = 'Mode'
/** The full name of each mode, and its short form on a phone. The accessible name is always the full one. */
export const MODE_NAMES = { guided: 'Guided', chain: 'Option chain' } as const
export const MODE_SHORT = { guided: 'Guided', chain: 'Chain' } as const
export const TAB_NAMES = { trade: 'Trade', requests: 'Requests', about: 'About' } as const
export const TABS_LABEL = 'Asset sections'
/** The menu beside the asset code: the other listed assets. */
export const SWITCH_LABEL = 'Other assets'

export const FACT = {
  issuer: 'Issuer',
  tier: 'Tier',
  balances: 'You hold',
} as const
export const NO_REFERENCE_VALUE = 'None'
/** The word under "You hold" when a balance cannot be shown; the About tab says the same in a sentence. */
export const BALANCE_WORD: Record<'unfunded' | 'no-trustline' | 'not-authorized' | 'error', string> = {
  unfunded: 'Account not funded',
  'no-trustline': 'No trustline',
  'not-authorized': 'Not authorized by the issuer',
  error: 'Could not be read',
}

export const NOT_FOUND_HEADING = 'Asset not found'
export const NOT_FOUND = {
  invalid: 'This link does not name an asset.',
  unknown: 'The contract does not list this asset.',
} as const
export const NOT_FOUND_LISTED = 'Assets you can open'
export const ALL_MARKETS = 'All markets'
export const ASSET_ERROR = 'The asset could not be read.'
export const ASSET_HEADING = 'Asset'
export const ASSET_LOADING = 'Loading the asset'

export const RAIL_LABEL = 'Order ticket'

// ---------------------------------------------------------------------------------------------- requests tab

export const REQUESTS_HEADING = 'Requests'
export const requestsLead = (code: string): string =>
  `A request is a buyer's premium already escrowed in the contract, waiting for a maker. Fill one and you write the option on ${code}: you lock the collateral and receive the premium.`
export const REQ_COL = {
  kind: 'Kind',
  strike: 'Strike',
  qty: 'Quantity',
  expiry: 'Deadline',
  premium: 'Premium escrowed',
  buyer: 'Buyer',
  action: 'Action',
} as const
/** Under an escrowed premium: the same amount for one unit of the asset. The unit is the one of the figure above. */
export const perUnitLine = (figure: string): string => `${figure} per unit`
/** In the deadline cell of the wallet's own request that lapsed and still holds its premium. */
export const LAPSED = 'Expired'
export const SELL_TO_BID = 'Fill request'
export const CANCEL_REQUEST = 'Cancel'
export const CANCEL_REFUND = 'Cancelling refunds your escrowed premium.'
export const YOURS = 'Yours'
export const requestsEmpty = (code: string): string => `No open requests on ${code}.`
export const REQUESTS_ERROR = 'The requests could not be read.'
export const REQUESTS_UNSUPPORTED = 'This contract version has no requests.'
export const requestsCaption = (code: string): string => `Open requests on ${code}`
export { KIND_WORD } from '../../core/format/option'

// ---------------------------------------------------------------------------------------------- about tab

export const ABOUT = {
  factsTitle: 'Asset facts',
  meansTitle: 'What it means for an option',
  accessTitle: 'Your access',
} as const

export const FACT_ROW = {
  issuer: 'Issuer',
  contract: 'Asset contract',
  domain: 'Home domain',
  tier: 'Tier',
  trustlines: 'Trustlines',
  contracts: 'Contracts holding it',
  signers: 'Issuer keys',
  options: 'Covered contract',
} as const
export const DOMAIN_NOT_SET = 'Not set'
export const NOT_READ = 'Not read'
export const UNKNOWN = 'Unknown'
export const trustlinesLine = (authorized: number, restricted: number, unauthorized: number): string =>
  `${authorized} authorized, ${restricted} restricted, ${unauthorized} not authorized`
export const SIGNERS_LOCKED = 'No key can sign for the issuer. Its settings can no longer change.'
export const SIGNERS_LIVE = 'The issuer account can still sign.'

// The powers' title, column heads, state words and fourth row are core/assetfacts's, shared with the Issuer page.
export const POWERS_CAPTION = 'Issuer powers'
export const FACTS_LOADING = 'Reading the asset from Testnet'
export const FACTS_ERROR = 'Could not read this asset from Testnet.'
export const FACTS_PARTIAL = 'Some facts could not be read from Horizon.'
export const UNKNOWN_POWERS_NOTE = 'The flags could not be read. The effects below are what each flag does when it is on.'
export const NATIVE_FACTS = 'Native XLM. No issuer and no flags.'
export const CONTRACTS_LINK = 'Reserves, contracts and roles'

/** The "Risks" block: the limits in our own words (the required sentence itself comes from core/disclosures). */
export const MEANS = (code: string): readonly string[] => [
  `A frozen holder cannot exercise. A frozen maker cannot claim delivery or reclaim.`,
  `If the issuer freezes the Covered contract, it cannot move ${code}, so no ${code} option can settle until it is unfrozen.`,
  `If the issuer claws ${code} back from the contract, open positions are left short: payouts go first come, first served, and new trades on ${code} are refused.`,
]

/**
 * "Your access": whether this wallet can hold the asset, and if not, whose move it is. Decided from the balance
 * status first (an account or trustline the wallet itself lacks), then from the issuer's authorization.
 */
export const ACCESS = {
  checking: 'Checking',
  unfunded: (code: string) => `Account not funded. This account is not on Testnet yet: fund it, then add ${code}.`,
  noTrustline: (code: string) => `No trustline. Your wallet has no trustline to ${code}: add ${code} in your wallet by its code and issuer.`,
  issuer: (code: string) => `This account is the ${code} issuer. It can hold and send ${code} without a trustline.`,
  maintainOnly: (code: string) => `Restricted by the ${code} issuer. You can keep and send back what you hold, but you cannot receive more, so trades that deliver ${code} to you are refused.`,
  yes: (code: string) => `Authorized by the ${code} issuer. You can buy, exercise and receive ${code}.`,
  no: (code: string) => `Not authorized by the issuer. You cannot receive ${code}, so trades that deliver it to you are refused. Only the ${code} issuer can change this.`,
  error: 'Could not check. The contract checks again when you trade.',
} as const
