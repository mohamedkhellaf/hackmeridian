// Interface copy of the markets feature (brief D18: whole sentences in feature constants, never glued from
// fragments). Required disclosure sentences are not here: they come from core/disclosures.
import type { Intent } from '../../app/search'
import type { PayoffGlyph } from '../../ui'

export const MARKETS_TITLE = 'Markets'
export const MARKETS_LEAD = 'Puts and calls on tokenized assets. A maker locks the full collateral in the contract before you pay, and exercise delivers the asset itself.'

export const INTENTS_HEADING = 'What do you want to do?'
export const ASSETS_HEADING = 'Assets'

export interface IntentCopy {
  /** The payoff shape of the position the intent opens. Always shown with the intent's name. */
  glyph: PayoffGlyph
  /** One line: what the user gets or agrees to. `quote` is the quote token code. */
  consequence: (quote: string) => string
  /** Who pays the premium: the label and the figure-like phrase after it. */
  premiumLabel: 'You pay' | 'You are paid'
  premiumText: string
  /** The question of the asset choice. */
  question: string
  /** The link of one asset in the choice: "Set a floor on BOND". */
  choose: (code: string) => string
}

export const INTENT_COPY: Record<Intent, IntentCopy> = {
  floor: {
    glyph: 'long-put',
    consequence: () => 'Keep the right to sell at a price you choose, until a date you choose.',
    premiumLabel: 'You pay',
    premiumText: 'a premium, once, now',
    question: 'Set a floor on which asset?',
    choose: (code) => `Set a floor on ${code}`,
  },
  'earn-hold': {
    glyph: 'short-call',
    consequence: () => 'Lock what you hold and agree to sell it at a higher price if a buyer asks before the deadline.',
    premiumLabel: 'You are paid',
    premiumText: 'a premium now',
    question: 'Earn on which asset?',
    choose: (code) => `Earn on ${code}`,
  },
  'earn-buy': {
    glyph: 'short-put',
    consequence: (quote) => `Lock ${quote} and agree to buy at a lower price if a holder asks before the deadline.`,
    premiumLabel: 'You are paid',
    premiumText: 'a premium now',
    question: 'Which asset would you buy at a lower price?',
    choose: (code) => `Earn while waiting to buy ${code}`,
  },
  'lock-buy': {
    glyph: 'long-call',
    consequence: () => 'Keep the right to buy at a price you choose, until a date you choose.',
    premiumLabel: 'You pay',
    premiumText: 'a premium, once, now',
    question: 'Lock a buy price on which asset?',
    choose: (code) => `Lock a buy price on ${code}`,
  },
}

/** The line after the three main cards that leads to the fourth intent. */
export const LOCK_BUY_LEAD = 'Want to buy later at a price fixed today?'
/** Follows the link "Lock a buy price" in the same sentence. */
export const LOCK_BUY_REST = ': keep the right to buy at a price you choose, until a date you choose. You pay a premium, once, now.'

export const CHOICE_CANCEL = 'Choose something else'
export const CHOICE_GUEST_HINT = 'You can look at the terms without a wallet. Connect one to trade.'

// ---------------------------------------------------------------------------------------------- assets table

export const COL = {
  asset: 'Asset',
  issuer: 'Issuer',
  tier: 'Tier',
  reference: 'Reference price',
  offers: 'Open offers',
  expiry: 'Nearest expiry',
  put: 'Lowest put, per unit',
  call: 'Lowest call, per unit',
  action: 'Action',
} as const

export const NONE = 'None'
export const TRADE = 'Trade'
export const tradeLabel = (code: string): string => `Trade ${code}`
/**
 * `Bond` for an asset of the app's list: the kind of instrument its label imitates, and nothing more (owner's
 * direction of 11 Nov 2026: no hedge word in a caption). What the token really is is said once, in a sentence,
 * on the asset's About tab (`TEST_TOKEN_NOTE`). An asset outside the list is only known to be listed.
 */
export const typeLine = (typeLabel: string | null): string => typeLabel ?? 'Listed asset'

/** About tab, under the type: what a token of the app's list is. Said once, here. */
export const TEST_TOKEN_NOTE = "A test token issued by this project's issuer account on Stellar Testnet. It represents no real instrument and has no monetary value."

export const noOffersOn = (code: string): string => `No open offers on ${code}.`
export const POST_REQUEST = 'Post a request'
export const WRITE_FIRST = 'write the first offer'

export function listCountLine(shown: number, more: number, all: boolean): string {
  if (all) return shown === 1 ? 'Showing the 1 asset listed in the contract.' : `Showing all ${shown} assets listed in the contract.`
  const head = shown === 1 ? 'Showing 1 reference asset.' : `Showing ${shown} reference assets.`
  if (more === 0) return `${head} No other asset is listed in the contract.`
  return more === 1 ? `${head} 1 more is listed in the contract.` : `${head} ${more} more are listed in the contract.`
}
export const SHOW_ALL = 'Show all listed assets'
export const SHOW_REFERENCE = 'Show reference assets only'
export const similarCodeNote = (reference: string): string => `Not the reference asset ${reference}: another issuer, same or similar code.`

export const ASSETS_EMPTY = 'No asset is listed in the contract.'
export const ASSETS_EMPTY_HINT = 'Assets appear here once someone lists them.'
export const ASSETS_ERROR = 'The markets could not be read.'
export const REFRESH_FAILED = 'Could not refresh. Showing the last read.'
export const RETRY = 'Try again'

// ---------------------------------------------------------------------------------------------- get test funds

export const FUNDS_TITLE = 'Get test funds'
export const FUNDS_LEAD = 'This wallet holds none of the tokens traded here. Three steps in your wallet, about two minutes, no approval from anyone.'
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
export const STEP_NEXT = 'Next'

// ---------------------------------------------------------------------------------------------- asset page

export const BACK_TO_MARKETS = 'Markets'
export const MODE_LABEL = 'Mode'
export const MODE_NAMES = { guided: 'Guided', chain: 'Chain' } as const
export const TAB_NAMES = { trade: 'Trade', requests: 'Requests', about: 'About' } as const
export const TABS_LABEL = 'Asset sections'

export const FACT = {
  reference: 'Reference price',
  issuer: 'Issuer',
  tier: 'Tier',
  holdAsset: (code: string) => `You hold, ${code}`,
  balances: 'You hold',
} as const
export const NO_REFERENCE_VALUE = 'None'
export const BALANCES_GUEST = 'Connect a wallet to see what you hold.'
export const BALANCE_WORD: Record<'unfunded' | 'no-trustline' | 'not-authorized' | 'error', string> = {
  unfunded: 'Account not funded',
  'no-trustline': 'No trustline',
  'not-authorized': 'Not authorized by the issuer',
  error: 'Could not be read',
}

export const NOT_FOUND_HEADING = 'Asset not found'
export const NOT_FOUND = {
  invalid: {
    title: 'This link does not name an asset.',
    hint: 'An asset link ends in a code such as bond, a code with its issuer, or an asset contract id. This one may have been cut when it was copied.',
  },
  unknown: {
    title: 'The contract does not list this asset.',
    hint: 'The link is well formed, but nothing is traded under it. Anyone can list an asset; until then there is nothing to open.',
  },
} as const
export const NOT_FOUND_LISTED = 'Assets you can open'
export const ALL_MARKETS = 'All markets'
export const ASSET_ERROR = 'The asset could not be read.'
export const ASSET_HEADING = 'Asset'
export const ASSET_LOADING = 'Loading the asset'

// ---------------------------------------------------------------------------------------------- ticket rail, idle

export const RAIL_LABEL = 'Order ticket'
export const IDLE_TITLE = 'No order yet.'
export const IDLE_HINT = {
  guided: 'Choose what you want to do and set your terms on the left. The order then appears here, to review before you sign.',
  chain: 'Select a price in the chain or a row of the book. The order then appears here, to review before you sign.',
  requests: 'Choose a request to sell to, or post your own. The order then appears here, to review before you sign.',
} as const
export const IDLE_BLANK = ['Kind', 'Strike', 'Deadline', 'Premium'] as const

// ---------------------------------------------------------------------------------------------- requests tab

export const REQUESTS_HEADING = 'Requests'
export const requestsLead = (code: string): string =>
  `A request is a buyer's premium already escrowed in the contract, waiting for a seller. Sell to one and you write the option on ${code}: you lock the collateral and receive the premium.`
export const REQ_COL = {
  kind: 'Kind',
  strike: 'Strike',
  qty: 'Quantity',
  expiry: 'Expiry',
  premium: 'Premium escrowed',
  buyer: 'Buyer',
  state: 'State',
  action: 'Action',
} as const
/** Under an escrowed premium: the same amount for one unit of the asset. The unit is the one of the figure above. */
export const perUnitLine = (figure: string): string => `${figure} per unit`
export const SELL_TO_BID = 'Sell to this bid'
export const CANCEL_REQUEST = 'Cancel'
export const CANCEL_REFUND = 'Cancelling refunds your escrowed premium.'
export const YOURS = 'Yours'
export const requestsEmpty = (code: string): string => `No open requests on ${code}.`
export const REQUESTS_EMPTY_HINT = 'Post one and your premium waits in the contract for a seller. It is refunded if you cancel or it expires.'
export const REQUESTS_ERROR = 'The requests could not be read.'
export const REQUESTS_UNSUPPORTED = 'This contract version has no requests.'
export const requestsCaption = (code: string): string => `Open requests on ${code}`
export const KIND_WORD = { put: 'Put', call: 'Call' } as const

// ---------------------------------------------------------------------------------------------- about tab

export const ABOUT = {
  factsTitle: 'Asset facts',
  powersTitle: 'What the issuer can do',
  meansTitle: 'What it means for an option',
  accessTitle: 'Your access',
  contractTitle: 'Contract and roles',
  linksTitle: 'On the explorer',
} as const

export const FACT_ROW = {
  code: 'Code',
  type: 'Type',
  issuer: 'Issuer',
  contract: 'Asset contract',
  domain: 'Home domain',
  tier: 'Tier',
  trustlines: 'Trustlines',
  contracts: 'Contracts holding it',
  signers: 'Issuer keys',
} as const
export const DOMAIN_NOT_SET = 'Not set'
export const NOT_READ = 'Not read'
export const UNKNOWN = 'Unknown'
export const trustlinesLine = (authorized: number, restricted: number, unauthorized: number): string =>
  `${authorized} authorized, ${restricted} restricted, ${unauthorized} not authorized`
export const SIGNERS_LOCKED = 'No key can sign for the issuer. Its settings can no longer change.'
export const SIGNERS_LIVE = 'The issuer account can still sign.'

export const POWER_COL = { power: 'Power', state: 'State', effect: 'Effect' } as const
export const POWER_STATE = { on: 'On', off: 'Off' } as const
export const POWERS_CAPTION = 'Issuer powers'
export const POWER_CHANGE = {
  label: 'Change these settings',
  fixed: 'Fixed. The issuer can never change them.',
  open: 'The issuer can turn any of these on or off later.',
  yes: 'Yes',
  no: 'No',
} as const
export const MOCK_FACTS = 'Mock asset. No on-chain facts.'
export const MOCK_POWERS_NOTE = 'Mock asset: these flags are settings of the demo, not read from a chain. The effects are what each flag does when it is on.'
export const FACTS_LOADING = 'Reading the asset from Testnet'
export const FACTS_ERROR = 'Could not read this asset from Testnet.'
export const FACTS_PARTIAL = 'Some facts could not be read from Horizon.'
export const UNKNOWN_POWERS_NOTE = 'The flags could not be read. The effects below are what each flag does when it is on.'
export const NATIVE_FACTS = 'Native XLM. No issuer and no flags.'

/** The "Risks" block: the limits in our own words (the required sentence itself comes from core/disclosures). */
export const MEANS = (code: string): readonly string[] => [
  `A frozen holder cannot exercise. A frozen writer cannot claim delivery or reclaim.`,
  `If the issuer freezes the options contract, it cannot move ${code}, so no ${code} option can settle until it is unfrozen.`,
  `If the issuer claws ${code} back from the contract, open positions are left short: payouts go first come, first served, and new trades on ${code} are refused.`,
  `The contract cannot stop any of this. It only holds the collateral and applies the terms.`,
]

export const ACCESS = {
  guest: (code: string) => `Connect a wallet to see whether you can hold ${code}.`,
  checking: 'Checking',
  yes: (code: string) => `Authorized by the ${code} issuer. You can buy, exercise and receive ${code}.`,
  no: (code: string) => `Not authorized by the ${code} issuer. You cannot receive ${code}, so trades that deliver it to you are refused.`,
  error: 'Could not check. The contract checks again when you trade.',
} as const

export const CONTRACT = {
  id: 'Options contract',
  admin: 'Admin',
  adminValue: 'None. No admin function exists.',
  upgrades: 'Upgrades',
  upgradesValue: 'None. No upgrade function exists.',
  price: 'Price source',
  priceValue: 'None. Exercise is at the strike; the contract reads no price.',
  audit: 'Audit',
  auditValue: 'None. No outside party has reviewed the code.',
  listing: 'Listing',
  listingValue: 'Anyone can list a classic asset. Listing is not eligibility: the issuer still decides who may hold it.',
  reserves: 'Reserves, contracts and roles',
  mock: 'Mock contract. Nothing here is on a chain.',
} as const

export const LINKS = {
  asset: (code: string) => `${code} asset`,
  issuer: 'Issuer account',
  contract: 'Asset contract',
  options: 'Options contract',
  mock: 'Mock ids have no explorer page.',
} as const
