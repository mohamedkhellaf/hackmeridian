// Every sentence of the Reserves page, in one place. Required disclosures are not here: they come from
// core/disclosures (the clawback-shortfall sentence has its home on this page).
//
// Wording rules (brief sections 0 and 0.1, DESIGN.md section 5): figures before adjectives, no promise words, no
// disclaimer taglines, Covered and Margin named apart. `copy.test.ts` runs the banned lists over these strings.

export const PAGE_TITLE = 'Reserves'

/** What the page compares, in one line under the title. */
export const PAGE_DESCRIPTION = 'What the Covered contract has locked for open offers, options and requests, beside the balance it holds, token by token.'

export const FIGURE_HEADING = 'Held against locked'
export const TABLE_CAPTION = 'Reserves by token'
/** The column headers, in order. Tests and the old suite rely on these four words. */
export const TABLE_COLUMNS = ['Token', 'Locked', 'Held', 'Difference'] as const

export const READING_HEADING = 'Notes'

export interface Definition {
  term: string
  text: string
  /** Where the figure is read from: the contract function (shown in mono) and the contract it is called on. */
  source?: { call: string; on: string }
}

export const DEFINITIONS: readonly Definition[] = [
  {
    term: 'Locked',
    text: 'What the contract owes in this token: collateral of open offers and active options, collateral of expired options not yet reclaimed, proceeds of exercises not yet claimed, and premiums escrowed by open requests.',
    source: { call: 'open_collateral(token)', on: 'the Covered contract' },
  },
  {
    term: 'Held',
    text: 'The balance of this token that the contract holds.',
    source: { call: 'balance(contract)', on: 'the token contract' },
  },
  {
    term: 'Difference',
    text: 'Held minus locked. Below zero, the issuer has clawed tokens back from the contract. Above zero, tokens were sent to the contract directly and are owed to nobody.',
  },
]

/** The split of what is locked. Labels are the contract's terms; the meaning says them in plain words. */
export const ITEM_COPY = {
  offered: { label: 'Offered', meaning: 'Collateral of open offers, not sold yet' },
  active: { label: 'Active', meaning: 'Collateral of sold options, before their deadline' },
  pendingReclaim: { label: 'Pending reclaim', meaning: 'Collateral of expired options the maker has not reclaimed' },
  unclaimed: { label: 'Unclaimed', meaning: 'Proceeds of exercised options the maker has not claimed' },
  // The contract never refunds by itself: a premium leaves when a maker fills the request or it is taken back.
  escrowed: { label: 'Escrowed', meaning: 'Premiums of open requests, held until a maker fills the request or the premium is taken back' },
} as const

/** Names the split on a phone, where its amounts cannot sit in the Locked column. */
export const BREAKDOWN_HEADING = 'Locked, by state'
export const BREAKDOWN_SUM_LABEL = 'Sum of items'
export const BREAKDOWN_UNAVAILABLE = 'The split could not be read. Locked above is the contract’s own figure.'

/** `Items sum to 1,060.00; the contract reports 1,080.00 locked. The contract's figure is used above.` */
export const itemsMismatch = (sum: string, locked: string): string =>
  `Items sum to ${sum}; the contract reports ${locked} locked. The contract’s figure is used above. The split is built from the list of options and can lag by one read.`

/** `2 more listed assets have nothing locked and nothing held. They are not shown.` */
export const hiddenEmptyNote = (count: number): string =>
  count === 1 ? 'One more listed asset has nothing locked and nothing held. It is not shown.' : `${count} more listed assets have nothing locked and nothing held. They are not shown.`

/** `3 more assets are listed in the contract. Each has its own page under Markets.` */
export const otherListedNote = (count: number): string =>
  count === 1 ? 'One more asset is listed in the contract. It has its own page under Markets.' : `${count} more assets are listed in the contract. Each has its own page under Markets.`

export const ROLE_LABEL = { quote: 'Quote token', underlying: 'Underlying' } as const

/** The word that goes with a signed difference. */
export const DIFFERENCE_WORD = { equal: 'equal', over: 'over', short: 'short' } as const
/** A difference of less than a cent, said in words: `under 0.01 short`. The exact value is one press away. */
export const UNDER_A_CENT = 'under 0.01'

export const HELD_UNAVAILABLE = 'Unavailable'

/** Said in the summary line when every token stands at zero. */
export const EMPTY_TITLE = 'Nothing is locked in the contract.'

export const ERROR_TITLE = 'Reserves could not be read'
/** Cause, consequence and fix, in plain words. The raw message sits behind `ERROR_DETAIL`. */
export const ERROR_TEXT = 'The read of the contract failed, so no figure is shown. Refresh to read again.'
export const ERROR_DETAIL = 'Technical detail'

export const PARTIAL_HELD_TITLE = 'Held balances could not be read'
export const PARTIAL_HELD_TEXT = 'Locked below is summed from the open offers, options and requests. Held and the difference are missing until the balances can be read.'
export const PARTIAL_SPLIT_TITLE = 'The split by state could not be read'
export const PARTIAL_SPLIT_TEXT = 'Locked and held below are the contract’s own figures. The split under each token is missing until the option list can be read.'

export const STALE_TITLE = 'The last read failed'
/** `The figures below are from 14:02:11 UTC.` */
export const staleText = (time: string): string => `The figures below are from ${time}. They may have changed since.`

/** The one name of the action that reads everything again, in the header and in the error notice. */
export const REFRESH = 'Refresh'

/** The read line of a mock build: the figures are mock data, read at this time. */
export const MOCK_READ = 'Mock data'

/** Announced after a manual refresh: `Reserves read again at 14:02:11 UTC.` */
export const refreshedAnnouncement = (time: string): string => `Reserves read again at ${time}.`

// ---------------------------------------------------------------------------------------------- summary line

export const SUMMARY_NONE_SHORT = (count: string): string => `Held is at or above locked for ${count}.`
export const SUMMARY_SHORT = (codes: string): string => `Held is below locked for ${codes}.`
export const SUMMARY_UNKNOWN = (count: string): string => `Held could not be read for ${count}.`

// ---------------------------------------------------------------------------------------------- contracts and roles

export const ROLES_HEADING = 'Contracts and roles'

/** Mock builds read no chain: the deployment shown is the recorded Testnet one. */
export const ROLES_MOCK_NOTE = 'The Testnet deployment is listed here as recorded on 26 Oct 2026.'
/** Margin on fixtures, Covered live. */
export const MARGIN_FIXTURE_NOTE = 'This build replays recorded scenarios for Margin and calls no Margin contract. The Testnet deployment is listed here as recorded on 26 Oct 2026.'
/** A contract id this app has no record for. */
export const UNRECORDED_NOTE = 'This build points at a contract id the app holds no record for. Read its wasm hash and history on the explorer.'

export const COVERED_HEADING = 'Covered contract'

export const COVERED_FACTS: readonly { label: string; text: string }[] = [
  { label: 'Admin', text: 'The contract has no admin function and no owner.' },
  { label: 'Upgrades', text: 'The code at this id cannot be replaced.' },
  { label: 'Oracle', text: 'The contract reads no price. Exercise happens at the strike.' },
  {
    label: 'Asset listing',
    text: 'Anyone can list a classic asset by code and issuer, and nobody can delist one. The issuer still decides who may hold the asset, the contract included.',
  },
  { label: 'Audit', text: 'No outside party has reviewed the code.' },
]

export const TOKENS_HEADING = 'Token contracts'
export const TOKENS_CAPTION = 'Token contracts, issuers and issuer flags'
export const TOKENS_NOTE = 'An issuer that can freeze or claw back can do so to any holder, the contract included.'
/**
 * Column headers of the token table. The three flag columns that follow them say what the issuer can do: their
 * names and answers are core/assetfacts's (`FLAG_LABELS`, `POWER_STATE`), the one vocabulary of the asset About
 * tab, the Issuer page and this table. Kept out of this file so the e2e specs can import it without the app config.
 */
export const TOKEN_COLUMNS = { token: 'Token', contract: 'Token contract', issuer: 'Issuer' } as const
export const FLAG_READING = 'Reading'
/** The Stellar names of the three columns, for readers who know them. */
export const FLAGS_KEY = 'On Stellar these are the issuer flags AUTH_REQUIRED, AUTH_REVOCABLE and AUTH_CLAWBACK_ENABLED.'
/** `Flags of RWA and BOND could not be read. They are shown as recorded on 26 Oct 2026.` */
export const flagsFromRecord = (codes: string): string => `Issuer flags of ${codes} could not be read. They are shown as recorded on 26 Oct 2026.`
export const flagsUnread = (codes: string): string => `Issuer flags of ${codes} could not be read.`
/** `The USDx issuer has none of these powers today, and can change these later.` */
export const notImmutableNote = (code: string): string => `The ${code} issuer has none of these powers today, and can change these later.`

export const MARGIN_HEADING = 'Margin contract'
export const MARGIN_LEDE =
  'A separate contract for uncovered calls on partial margin, settled in USDx. It shares no storage, balance or call with the Covered contract. Both roles are accounts run by the team.'

export const MARGIN_FACTS: readonly { label: string; text: string }[] = [
  { label: 'Upgrades', text: 'The code, the market parameters and both roles are fixed at deployment.' },
  { label: 'Prices', text: 'The price feed and the settlement price are published by the team’s own account, not by a market or an oracle network.' },
  { label: 'Audit', text: 'No outside party has reviewed the code.' },
]

export interface RoleCopy {
  role: string
  summary: string
}

export const MARGIN_ADMIN: RoleCopy = {
  role: 'Admin',
  summary: 'Lists the series that can be traded, each a strike and a deadline. It cannot publish a price or change the market parameters, which are fixed at deployment.',
}

export const MARGIN_PUBLISHER: RoleCopy = {
  role: 'Publisher',
  summary:
    'Publishes the risk snapshots and, once after the deadline, the settlement price of each series. These prices decide every liquidation, early exercise and payout. The contract checks a snapshot’s consistency (mark within arbitrage bounds, extreme-scenario floor, freshness, rising sequence), not the price itself.',
}

/** What neither role can do, said once for both. */
export const NEITHER_LABEL = 'Neither can'
export const NEITHER_CAN: readonly string[] = [
  'Change the terms of a listed series.',
  'Rewrite a final settlement price or delete a position.',
  'Trade, take over a position or deposit into the vault.',
]

export const ROLES_SEPARATION = 'The admin and the publisher must be different accounts.'

export const FIELD = {
  contract: 'Contract id',
  version: 'Version',
  wasm: 'Wasm hash',
  deployTx: 'Deploy transaction',
  deployer: 'Deployed by',
  admin: 'Admin',
  publisher: 'Publisher',
} as const
