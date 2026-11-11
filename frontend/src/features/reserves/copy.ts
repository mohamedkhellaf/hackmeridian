// Every sentence of the Reserves page, in one place. Required disclosures are not here: they come from
// core/disclosures (the clawback-shortfall sentence has its home on this page).
//
// Wording rules (brief sections 0 and 0.1, DESIGN.md section 5): figures before adjectives, no promise words, no
// disclaimer taglines, Covered and Margin named apart. `copy.test.ts` runs the banned lists over these strings.

export const PAGE_TITLE = 'Reserves'

/** What the page shows and what it does not, in one line under the title. */
export const PAGE_DESCRIPTION =
  'What the Covered contract has locked for open offers, options and requests, beside the balance it holds, token by token. It shows what is there now, not what an issuer may do next.'

export const FIGURE_HEADING = 'Held against locked'
export const TABLE_CAPTION = 'Reserves by token'
/** The column headers, in order. Tests and the old suite rely on these four words. */
export const TABLE_COLUMNS = ['Token', 'Locked', 'Held', 'Difference'] as const

/** How to read the bullet rows. Sits under them as the figure's caption. */
export const FIGURE_LEGEND = 'Bar: the balance the contract holds. Tick: what it has locked. A hatched gap is a shortfall. Each token has its own scale.'

export const READING_HEADING = 'How to read this'

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

export const LIMITS_HEADING = 'What this page does not show'

/** Limits of the page, in its own words. Not a required sentence. */
export const LIMITS: readonly string[] = [
  'Locked is the contract’s own count of what it owes. The split under each token is rebuilt from the list of options and requests, and the page says so when the two disagree.',
  'The issuer of a token can still freeze the contract’s balance or claw it back. A shortfall appears here after the fact.',
  'Margin is a separate contract. Its margin accounts and its vault are not in these figures.',
]

/** The split of what is locked. Labels are the contract's terms; the meaning says them in plain words. */
export const ITEM_COPY = {
  offered: { label: 'Offered', meaning: 'Collateral of open offers, not sold yet' },
  active: { label: 'Active', meaning: 'Collateral of sold options, before their expiry' },
  pendingReclaim: { label: 'Pending reclaim', meaning: 'Collateral of expired options the writer has not reclaimed' },
  unclaimed: { label: 'Unclaimed', meaning: 'Proceeds of exercised options the writer has not claimed' },
  escrowed: { label: 'Escrowed', meaning: 'Premiums of open requests, refunded on cancel or expiry' },
} as const

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

export const HELD_UNAVAILABLE = 'Unavailable'

export const EMPTY_TITLE = 'Nothing is locked in the contract.'
export const EMPTY_HINT = 'A row appears when a maker writes an offer or a buyer posts a request.'
export const EMPTY_ACTION = 'Go to markets'

export const ERROR_TITLE = 'Reserves could not be read'
export const ERROR_FALLBACK = 'The read failed and no earlier figure is on hand, so none is shown.'
/** `Reason given: RPC 503` */
export const errorReason = (reason: string): string => `Reason given: ${reason}`
export const RETRY = 'Read again'

export const PARTIAL_HELD_TITLE = 'Held balances could not be read'
export const PARTIAL_HELD_TEXT = 'Locked below is summed from the open offers, options and requests. Held and the difference are missing until the balances can be read.'
export const PARTIAL_SPLIT_TITLE = 'The split by state could not be read'
export const PARTIAL_SPLIT_TEXT = 'Locked and held below are the contract’s own figures. The split under each token is missing until the option list can be read.'

export const STALE_TITLE = 'The last read failed'
/** `The figures below are from 14:02:11 UTC.` */
export const staleText = (time: string): string => `The figures below are from ${time}. They may have changed since.`

export const REFRESH = 'Refresh'

/** Announced after a manual refresh: `Reserves read again at 14:02:11 UTC.` */
export const refreshedAnnouncement = (time: string): string => `Reserves read again at ${time}.`

// ---------------------------------------------------------------------------------------------- summary line

export const SUMMARY_NONE_SHORT = (count: string): string => `Held is at or above locked for ${count}.`
export const SUMMARY_SHORT = (codes: string): string => `Held is below locked for ${codes}.`
export const SUMMARY_UNKNOWN = (count: string): string => `Held could not be read for ${count}.`

// ---------------------------------------------------------------------------------------------- contracts and roles

export const ROLES_HEADING = 'Contracts and roles'
export const ROLES_LEDE = 'Who can change what. Ids are given in full so they can be checked against the explorer.'

/** Mock builds read no chain: the deployment shown is the recorded Testnet one. */
export const ROLES_MOCK_NOTE = 'This build runs on mock data and calls no contract. The Testnet deployment is listed here as recorded on 26 Oct 2026.'
/** Margin on fixtures, Covered live. */
export const MARGIN_FIXTURE_NOTE = 'This build replays recorded scenarios for Margin and calls no Margin contract. The Testnet deployment is listed here as recorded on 26 Oct 2026.'
/** A contract id this app has no record for. */
export const UNRECORDED_NOTE = 'This build points at a contract id the app holds no record for. Read its wasm hash and history on the explorer.'

export const COVERED_HEADING = 'Covered contract'
/** The three facts, as the brief words them. */
export const COVERED_STATEMENT = 'No admin. No upgrades. No oracle.'

export const COVERED_FACTS: readonly { label: string; text: string }[] = [
  { label: 'Admin', text: 'None. The contract has no admin function and no owner.' },
  { label: 'Upgrades', text: 'None. The code at this id cannot be replaced.' },
  { label: 'Oracle', text: 'None. Exercise happens at the strike. The contract reads no price.' },
  {
    label: 'Asset listing',
    text: 'Open. Anyone can list a classic asset by code and issuer, and nobody can delist one. Listing is not eligibility: the issuer still decides who may hold the asset, the contract included.',
  },
  { label: 'Audit', text: 'None. No outside party has reviewed the code.' },
]

export const TOKENS_HEADING = 'Token contracts'
export const TOKENS_CAPTION = 'Token contracts, issuers and issuer flags'
export const TOKENS_NOTE =
  'A revocable authorization lets the issuer freeze a holder’s balance, the contract’s included. Clawback lets the issuer take tokens back, from the contract too: that is the shortfall this page reports.'
/** Column headers of the token table. The three flag columns say what the issuer can do, in plain words. */
export const TOKEN_COLUMNS = { token: 'Token', contract: 'Token contract', issuer: 'Issuer', required: 'Approval required', revocable: 'Can freeze', clawback: 'Can claw back' } as const
export const FLAG_YES = 'Yes'
export const FLAG_NO = 'No'
export const FLAG_READING = 'Reading'
/** The Stellar names of the three columns, for readers who know them. */
export const FLAGS_KEY = 'On Stellar these are the issuer flags AUTH_REQUIRED, AUTH_REVOCABLE and AUTH_CLAWBACK_ENABLED.'
/** `Flags of RWA and BOND could not be read. They are shown as recorded on 26 Oct 2026.` */
export const flagsFromRecord = (codes: string): string => `Issuer flags of ${codes} could not be read. They are shown as recorded on 26 Oct 2026.`
export const flagsUnread = (codes: string): string => `Issuer flags of ${codes} could not be read.`
/** `USDx has no flag set today. Its issuer account is not immutable, so it could set them later.` */
export const notImmutableNote = (code: string): string => `${code} has no flag set today. Its issuer account is not immutable, so it could set them later.`
/** `EQTY was not part of the deployment: it was listed afterwards with list_asset.` */
export const listedLaterNote = (code: string): string => `${code} was not part of the deployment: it was listed afterwards with list_asset.`

export const MARGIN_HEADING = 'Margin contract'
export const MARGIN_STATEMENT = 'One admin. One publisher. No upgrades.'
export const MARGIN_LEDE =
  'A separate contract for uncovered calls on partial margin, settled in USDx. It shares no storage, balance or call with the Covered contract. Both roles are accounts run by the team.'

export const MARGIN_FACTS: readonly { label: string; text: string }[] = [
  { label: 'Upgrades', text: 'None. The code, the market parameters and both roles are fixed at deployment.' },
  { label: 'Prices', text: 'A price feed and a settlement price published by the team’s own account. Not a market, not an oracle network.' },
  { label: 'Audit', text: 'None. No outside party has reviewed the code.' },
]

export interface RoleCopy {
  role: string
  summary: string
  can: readonly string[]
  cannot: readonly string[]
}

export const MARGIN_ADMIN: RoleCopy = {
  role: 'Admin',
  summary: 'Lists the series that can be traded.',
  can: ['List a new series (a strike and an expiry).'],
  cannot: [
    'Change the terms of a series once it is listed.',
    'Change the market parameters, which are fixed at deployment.',
    'Publish a price, rewrite a final settlement price or delete a position.',
    'Trade, take over a position or deposit into the vault.',
  ],
}

export const MARGIN_PUBLISHER: RoleCopy = {
  role: 'Publisher',
  summary: 'Publishes the risk snapshots and the settlement price. These prices decide every liquidation, early exercise and payout.',
  can: [
    'Publish a risk snapshot for a series. The contract checks its consistency (mark within arbitrage bounds, extreme-scenario floor, freshness, rising sequence), not the price itself.',
    'Publish the settlement price of a series, once, after its expiry.',
  ],
  cannot: [
    'Change the terms of a live series.',
    'Rewrite a settlement price once it is final, or delete a position.',
    'Trade, take over a position or deposit into the vault.',
  ],
}

export const ROLES_SEPARATION = 'The admin and the publisher must be different accounts.'
export const CAN_LABEL = 'Can'
export const CANNOT_LABEL = 'Cannot'

export const FIELD = {
  contract: 'Contract id',
  version: 'Version',
  wasm: 'Wasm hash',
  deployTx: 'Deploy transaction',
  deployer: 'Deployed by',
  quote: 'Settles in',
} as const
