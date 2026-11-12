// Every string of the Issuer page. Sentences are whole (never assembled from fragments); counts go through Intl.
// The clawback shortfall sentence is not here: it comes from core/disclosures.
import { countOf } from '../../core/format'

/** The state words of a holder, as shown in the Authorization column. */
export const STATE_LABEL = {
  authorized: 'Authorized',
  'maintain-only': 'Restricted',
  unauthorized: 'Not authorized',
  'no-trustline': 'No trustline',
  unfunded: 'No account',
  issuer: 'Issuer',
  unknown: 'Unknown',
} as const

/**
 * What a state means for the asset, in one line under the word. "Authorized" and "Issuer" say it all and have
 * no line.
 */
export const STATE_DETAIL = {
  'maintain-only': (code: string) => `Keeps its open offers. Cannot send or receive ${code}.`,
  unauthorized: (code: string) => `Cannot send or receive ${code}.`,
  'no-trustline': (code: string) => `Cannot hold ${code} until it opens a trustline.`,
  unfunded: () => 'Not funded on Testnet.',
  unknown: () => 'The read failed.',
} as const

export const COPY = {
  page: {
    title: 'Issuer',
    /** The description of the console (a Testnet build). A mock build prints `mock.sentence` instead. */
    description: "Who can hold a listed asset, who is frozen and what is taken back. Only the asset's issuer can sign.",
    assetLabel: 'Asset',
    loading: 'Loading the listed assets',
    assetsError: 'The listed assets could not be read.',
    noAssets: 'No asset is listed in the contract.',
    noAssetsHint: 'The console opens once the Covered contract lists an asset.',
    retry: 'Read again',
  },

  mock: {
    /** Ruling R24, word for word: the one sentence of the page on mock data. Checked by the e2e spec. */
    sentence: 'On mock data there is no asset contract to read and no transaction to sign.',
  },

  access: {
    connect: 'Connect wallet',
    checking: (code: string) => `Reading who issues ${code}.`,
    /** Followed by the issuer's address. */
    readOnly: (code: string) => `Read only. Actions on ${code} are signed by its issuer:`,
    readOnlyUnknown: (code: string) => `Read only. Actions on ${code} are signed by its issuer.`,
    notIssuer: (code: string) => `The connected account is not the ${code} issuer.`,
    unchecked: (code: string) => `Could not check who issues ${code}.`,
    otherIssued: (code: string) => `You issue ${code}.`,
    openOther: (code: string) => `Open ${code}`,
    issuer: (code: string) => `You are connected as the ${code} issuer.`,
  },

  contract: {
    title: 'Covered contract',
    held: 'Held',
    reserved: 'Reserved for open options',
    short: 'Short',
    authorization: 'Authorization',
    open: 'Open options',
    openNone: 'None',
    openSplit: (active: number, offered: number, awaiting: number) => `${active} active, ${offered} offered, ${awaiting} waiting for a claim or a reclaim`,
    notRead: 'Not read',
    notAuthorized: (code: string) => `No ${code} option can be exercised, claimed or reclaimed until the issuer authorizes the Covered contract.`,
    /** One label per destination (ruling F19): the same words as the landing and the asset About tab. */
    reservesLink: 'Open Reserves',
  },

  powers: {
    // The title, the column heads, the state words and the fourth row are core/assetfacts's, shared with the asset
    // About tab.
    caption: 'Issuer powers',
    missing: 'The issuer account does not exist on Testnet.',
    error: (message: string) => `Could not load the flags: ${message}`,
    unknownIssuer: 'The flags are read from the issuer account, which is not known.',
    learnLink: 'How an issuer action affects an option',
  },

  asset: {
    title: 'Asset',
    code: 'Code',
    issuer: 'Issuer',
    contract: 'Asset contract',
    homeDomain: 'Home domain',
    noHomeDomain: 'Not set',
    issuerUnknown: 'Could not be read',
    keys: 'Issuer keys',
    keysLocked: 'No key can sign for the issuer. Its settings can no longer change.',
    keysLive: 'The issuer account can still sign.',
    copyIssuer: 'Copy issuer address',
    copyContract: 'Copy asset contract id',
    viewIssuer: 'View the issuer on the explorer',
    viewContract: 'View the asset contract on the explorer',
  },

  trustlines: {
    title: 'Trustlines',
    authorized: 'Authorized',
    restricted: 'Restricted',
    unauthorized: 'Not authorized',
    contracts: 'Contracts holding it',
  },

  accounts: {
    title: 'Accounts',
    caption: (code: string) => `Accounts holding ${code}`,
    account: 'Account',
    balance: (code: string) => `${code} balance`,
    authorization: 'Authorization',
    actions: 'Actions',
    escrowName: 'Covered contract',
    /** The contract as the object of an action, in an accessible name: "Freeze the Covered contract". */
    escrowWho: 'the Covered contract',
    reading: 'Reading',
    noBalance: 'No balance line',
    readError: (message: string) => `Could not read: ${message}`,
    clawbackNotOnLine: 'Clawback does not apply to this trustline.',
    refresh: 'Read again',
    readAt: (time: string) => `Read at ${time}`,
    holdersLoading: (code: string) => `Listing the ${code} trustlines.`,
    holdersError: (code: string, message: string) => `The ${code} trustlines could not be listed: ${message}`,
    holdersNone: (code: string) => `No account has a ${code} trustline yet.`,
    holdersMore: (shown: number) => `Showing the first ${countOf(shown, { one: 'trustline', other: 'trustlines' })}. Add an address to manage any other account.`,
    remove: (who: string) => `Remove ${who} from the list`,
    authorize: 'Authorize',
    freeze: 'Freeze',
    clawback: 'Claw back',
    authorizeName: (who: string) => `Authorize ${who}`,
    freezeName: (who: string) => `Freeze ${who}`,
    clawbackName: (who: string) => `Claw back from ${who}`,
    more: (who: string) => `More actions for ${who}`,
    filterLabel: 'Accounts to show',
    filterAll: 'All',
    filterDecide: 'Needs a decision',
    filterCount: 'accounts',
    copyAddress: 'Copy address',
    viewAddress: 'View on the explorer',
  },

  add: {
    label: 'Add an account or a contract',
    hint: (code: string) => `Paste a Testnet address to read its ${code} trustline.`,
    placeholder: 'G… or C…',
    submit: 'Add',
    /** Exact wording kept from the previous console. */
    invalid: 'Not an account (G…) or contract (C…) address.',
    duplicate: 'This address is already in the list.',
  },

  /**
   * What the issuer's flags rule out for every account of the asset, said once above the accounts, in the words
   * of the powers table (core/assetfacts).
   */
  limits: {
    freeze: 'Freeze is not available: this issuer cannot freeze.',
    clawback: 'Claw back is not available: this issuer cannot claw back.',
  },

  reasons: {
    busy: 'Another transaction is in progress.',
    unknownPending: 'The last transaction is not confirmed yet. Check it again first.',
    issuerRow: 'This is the issuing account.',
    unfunded: 'This account does not exist on Testnet.',
    noTrustline: (code: string) => `This account has no ${code} trustline.`,
  },

  /** What an account or the contract has open on the asset, as rows of the confirmations. */
  exposure: {
    written: 'Open options written',
    held: 'Active options held',
    open: 'Open options',
  },

  freeze: {
    title: (who: string, code: string) => `Freeze ${who} for ${code}`,
    escrowTitle: (code: string) => `Freeze the Covered contract for ${code}`,
    description: (code: string) => `Freezing revokes the authorization to hold ${code}. You can authorize it again later.`,
    asset: 'Asset',
    account: 'Account',
    contract: 'Contract',
    balance: 'Balance',
    blocksTitle: 'What freezing blocks',
    accountBlocks: (code: string) => [
      `The account cannot send or receive ${code} until you authorize it again.`,
      `Options written on ${code} cannot settle for it: as a holder it cannot exercise, as a maker it cannot claim delivery or reclaim.`,
    ],
    escrowBlocks: (code: string) => [
      `The Covered contract cannot send or receive ${code} until you authorize it again.`,
      `Settlement stops for every option written on ${code}: no exercise, no claim, no reclaim.`,
    ],
    confirm: 'Freeze',
  },

  /** Authorize asks first only when the issuer cannot revoke: then it cannot be undone. */
  authorizeFinal: {
    title: (who: string, code: string) => `Authorize ${who} for ${code}`,
    escrowTitle: (code: string) => `Authorize the Covered contract for ${code}`,
    description: (code: string) => `The ${code} issuer cannot freeze, so once this account is authorized it can never be frozen.`,
    escrowDescription: (code: string) => `The ${code} issuer cannot freeze, so once the Covered contract is authorized it can never be frozen.`,
    confirm: 'Authorize',
  },

  dialog: {
    cancel: 'Cancel',
    /** The close button once a transaction started: it hides the dialog, the transaction goes on. */
    hide: 'Hide',
  },

  clawback: {
    title: (code: string) => `Claw back ${code}`,
    description: (code: string) => `Removes ${code} from the account. The tokens are destroyed, not sent to the issuer.`,
    escrowDescription: (code: string) => `Removes ${code} from the Covered contract. The tokens are destroyed, not sent to the issuer.`,
    from: 'From',
    balance: 'Balance',
    balanceUnknown: 'Not read',
    amount: 'Amount',
    // A figure and its code never part at a line end: a no-break space joins them in these sentences.
    max: (amount: string, code: string) => `use the full balance, ${amount}\u00a0${code}`,
    invalidAmount: (decimals: number) => `Enter an amount above zero with at most ${decimals} decimals.`,
    overBalance: (balance: string, code: string) => `This balance is ${balance}\u00a0${code}. Enter ${balance} or less.`,
    impactTitle: 'What it does to the reserves',
    reserved: 'Reserved for open options',
    heldNow: 'Held now',
    heldAfter: 'Held after this',
    shortAfter: 'Short after this',
    notShort: 'None',
    impactUnknown: 'The reserves of the Covered contract could not be read, so the effect on open options is not shown.',
    free: (amount: string, code: string) => `Up to ${amount}\u00a0${code} is not reserved.`,
    freeNone: 'All of it is reserved: any amount leaves the contract short.',
    covered: (held: string, reserved: string) => `The contract still holds what it owes: ${held} held, ${reserved} reserved.`,
    shortTitle: (amount: string, code: string) => `This leaves the Covered contract ${amount}\u00a0${code} short`,
    unknownTitle: 'This can create a shortfall for option holders',
    /** Exact wording kept from the previous console. */
    accountWarning: "This takes the tokens without the holder's consent and cannot be undone.",
    confirmLabel: (phrase: string) => `Type ${phrase} to confirm`,
    confirmLabelIdle: 'Type the confirmation',
    confirmHint: 'The amount, the asset code and the last four characters of the address.',
    confirmHintIdle: 'Enter the amount first.',
    confirmMismatch: (phrase: string) => `That does not match. Type ${phrase}.`,
    confirm: 'Claw back',
    blocked: 'Enter an amount and type the confirmation exactly.',
  },

  labels: {
    authorize: (who: string, code: string) => `Authorize ${who} for ${code}`,
    freeze: (who: string, code: string) => `Freeze ${who} for ${code}`,
    clawback: (amount: string, code: string, who: string) => `Claw back ${amount}\u00a0${code} from ${who}`,
  },

  /** A confirmed action, in one line. */
  done: {
    authorize: (who: string, code: string) => `Authorized ${who} for ${code}.`,
    freeze: (who: string, code: string) => `Frozen ${who} for ${code}.`,
    clawback: (amount: string, code: string, who: string) => `Clawed back ${amount}\u00a0${code} from ${who}.`,
  },

  tx: {
    title: 'Transaction',
    checking: 'Reading the issuer account and preparing the transaction. Nothing has been sent.',
    sentNotConfirmed: 'Not confirmed yet. The transaction was sent and can still be included; check again before sending another.',
    rejectedWith: (codes: string) => `The network refused the transaction (${codes}).`,
    noSource: 'The issuer account could not be read from Horizon.',
    noSigned: 'The wallet returned no signed transaction.',
    busy: 'The network is busy and did not accept the transaction. Send it again later.',
    notAccepted: 'The network did not accept the transaction.',
    confirmedIn: (ledger: string) => `Included in ledger ${ledger}.`,
    neverIncluded: 'The transaction expired without being included. Nothing was charged.',
    checkAgain: 'Check again',
    dismiss: 'Dismiss',
  },

  log: {
    title: 'Recent actions',
    caption: (code: string) => `Issuer actions on ${code} signed from this browser`,
    time: 'Time (UTC)',
    action: 'Action',
    account: 'Account',
    state: 'State',
    transaction: 'Transaction',
    noHash: 'Not sent',
    authorize: 'Authorize',
    freeze: 'Freeze',
    all: 'All transactions',
  },
} as const

/**
 * Horizon result codes this console can meet, as sentences. Operation codes are looked up before transaction
 * codes. None of them says what happened to the fee: the transaction panel adds that sentence from the outcome.
 */
export const RESULT_CODE_TEXT: Record<string, string | undefined> = {
  op_no_trust: 'The account has no trustline for this asset.',
  op_cant_revoke: 'This issuer cannot freeze: its account does not allow it.',
  op_not_clawback_enabled: 'Clawback is not enabled for this trustline.',
  op_underfunded: 'The account holds less than the amount.',
  op_no_issuer: 'The asset issuer account does not exist.',
  op_malformed: 'The network rejected the operation as malformed.',
  op_low_reserve: 'The account does not hold enough XLM for this change.',
  tx_bad_auth: 'The network refused the signature: it is not the issuer account’s. Sign with the issuer account.',
  tx_bad_seq: 'The issuer account sent another transaction in the meantime, so the network refused this one. Send it again.',
  tx_too_late: 'The transaction reached the network after its time limit and was refused. Send it again.',
  tx_insufficient_balance: 'The issuer account does not hold enough XLM for the network fee, so the network refused the transaction.',
  tx_insufficient_fee: 'The network fee was too low at that moment and the transaction was refused. Send it again.',
  tx_no_source_account: 'The issuer account does not exist on Testnet, so the network refused the transaction.',
}
