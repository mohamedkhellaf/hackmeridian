// Every string of the Issuer page. Sentences are whole (never assembled from fragments); counts go through Intl.
// The clawback shortfall sentence is not here: it comes from core/disclosures.
import { countOf } from '../../core/format'
import type { PluralForms } from '../../core/format'

const OPTION: PluralForms = { one: 'option', other: 'options' }
const ACTIVE_OPTION: PluralForms = { one: 'active option', other: 'active options' }

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

/** What each state means for the asset, in one line under the word. */
export const STATE_DETAIL = {
  authorized: (code: string) => `Can send and receive ${code}.`,
  'maintain-only': (code: string) => `Keeps its open offers. Cannot send or receive ${code}.`,
  unauthorized: (code: string) => `Cannot send or receive ${code}.`,
  'no-trustline': (code: string) => `Cannot hold ${code} until it opens a trustline.`,
  unfunded: () => 'Not funded on Testnet.',
  issuer: () => 'The issuing account.',
  unknown: () => 'The read failed.',
} as const

export const COPY = {
  page: {
    title: 'Issuer',
    description: "Who can hold a listed asset, who is frozen and what is taken back. Only the asset's issuer can sign.",
    assetLabel: 'Asset',
    loading: 'Loading the listed assets',
    assetsError: 'The listed assets could not be read.',
    noAssets: 'No asset is listed in the contract.',
    noAssetsHint: 'The console opens once the options contract lists an asset.',
    retry: 'Try again',
  },

  mock: {
    /** Exact wording, checked by the e2e spec. */
    sentence: 'Issuer actions need a Testnet contract.',
    hint: 'This build runs on mock data. There is no asset contract to read and no transaction to sign.',
    whatTitle: 'What the console does on Testnet',
    whatLead:
      'The issuer of a listed asset connects its account and decides who can hold the asset. Each action is one transaction signed by the issuer, and each one changes what an option on that asset can do.',
    actionHeader: 'Action',
    signsHeader: 'What the issuer signs',
    optionsHeader: 'What it means for options',
    actions: [
      {
        name: 'Authorize',
        signs: 'Approves an account or a contract to hold the asset. The options contract needs this approval before it can take the asset as collateral.',
        options: 'An authorized holder can exercise. An authorized writer can claim delivery and reclaim.',
      },
      {
        name: 'Freeze',
        signs: 'Revokes that approval. The balance stays where it is and cannot move.',
        options:
          'A frozen holder cannot exercise. A frozen writer cannot claim delivery or reclaim. If the options contract is frozen, no option written on the asset can settle.',
      },
      {
        name: 'Claw back',
        signs: 'Removes an amount of the asset from an account or a contract, without its consent. The tokens are destroyed, not sent to the issuer.',
        options:
          'Taken from the options contract, it leaves the collateral short: holders are paid first come, first served until the balance runs out.',
      },
    ],
    readsTitle: 'What it reads',
    reads: [
      {
        name: 'Issuer flags',
        text: 'Authorization required, authorization revocable and clawback enabled, each with what it allows, and whether the issuer can still change them.',
      },
      {
        name: 'Accounts',
        text: 'Every account with a trustline for the asset: its balance and whether it is authorized, restricted or not authorized.',
      },
      {
        name: 'The options contract',
        text: 'Always the first row: its balance, its authorization and how many open options depend on it.',
      },
    ],
    whoTitle: 'Who can sign',
    who: 'Only the issuer account of the asset. Anyone else sees the flags and the options contract, read only. Accounts are handled with classic operations through Horizon, contracts through the asset contract.',
    reservesLink: 'See what the contract holds',
    learnLink: 'How an issuer action affects an option',
  },

  access: {
    /** Exact wording kept from the previous console. */
    guestTitle: "Connect the asset issuer's account in your wallet.",
    guestBody: (code: string) => `Authorize, freeze and claw back are signed by the ${code} issuer. The flags and the options contract below are public and need no wallet.`,
    connect: 'Connect wallet',
    checking: (code: string) => `Reading who issues ${code}.`,
    notIssuerTitle: (code: string) => `The connected account is not the ${code} issuer.`,
    notIssuerIssuedBy: (code: string) => `${code} is issued by`,
    notIssuerYouAre: 'You are connected as',
    notIssuerFix: 'Switch to the issuer account in your wallet to authorize, freeze or claw back.',
    notIssuerUnknown: (code: string) => `The issuer of ${code} could not be read from the asset contract, so this account cannot be checked against it.`,
    issuer: (code: string) => `You are connected as the ${code} issuer.`,
  },

  asset: {
    title: 'Asset',
    code: 'Code',
    issuer: 'Issuer',
    contract: 'Asset contract',
    homeDomain: 'Home domain',
    noHomeDomain: 'None published',
    issuerUnknown: 'Could not be read',
    copyIssuer: 'Copy issuer address',
    copyContract: 'Copy asset contract id',
    viewIssuer: 'View the issuer on the explorer',
    viewContract: 'View the asset contract on the explorer',
  },

  flags: {
    title: 'Issuer flags',
    on: 'On',
    off: 'Off',
    canChange: 'Flags can still change',
    canChangeYes: 'Yes',
    canChangeNo: 'No',
    canChangeYesText: 'The issuer can turn any of these on or off later.',
    canChangeNoText: 'Fixed. The issuer can never change them.',
    locked: 'Issuer account locked',
    lockedYes: 'Yes',
    lockedText: 'No key can sign for the issuer. Supply and flags are frozen.',
    missing: 'The issuer account does not exist on Testnet.',
    error: (message: string) => `Could not load the flags: ${message}`,
    unknownIssuer: 'The flags are read from the issuer account, which is not known.',
    retry: 'Read again',
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
    caption: (code: string) => `Accounts and contracts for ${code}`,
    account: 'Account',
    balance: (code: string) => `${code} balance`,
    authorization: 'Authorization',
    actions: 'Actions',
    escrowName: 'Options contract',
    escrowDetail: (code: string) => `Escrow of every ${code} option.`,
    escrowOwes: (amount: string, code: string) => `Escrow of every ${code} option. ${amount} ${code} is reserved for open options.`,
    escrowNotAuthorized: (code: string) => `No ${code} option can be exercised, claimed or reclaimed until the issuer authorizes the options contract.`,
    addedName: 'Added by you',
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
    holdersForIssuer: (code: string) => `The issuer also sees every account with a ${code} trustline here.`,
    remove: (who: string) => `Remove ${who} from the list`,
    authorize: 'Authorize',
    freeze: 'Freeze',
    clawback: 'Claw back',
    authorizeName: (who: string) => `Authorize ${who}`,
    freezeName: (who: string) => `Freeze ${who}`,
    clawbackName: (who: string) => `Claw back from ${who}`,
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

  reasons: {
    busy: 'Another transaction is in progress.',
    unknownPending: 'The last transaction is not confirmed yet. Check it again first.',
    issuerRow: 'This is the issuing account.',
    unfunded: 'This account does not exist on Testnet.',
    noTrustline: (code: string) => `This account has no ${code} trustline.`,
    notRevocable: 'Freeze needs the Authorization revocable flag, which is off.',
    clawbackOff: 'Claw back needs the Clawback enabled flag, which is off.',
    clawbackNotOnLine: 'Clawback does not apply to this trustline: it was opened before clawback was enabled.',
    nothingToClaw: (code: string) => `The ${code} balance is zero.`,
  },

  exposure: {
    none: (code: string) => `It has no open option on ${code} in this contract.`,
    holdingOnly: (holding: number, code: string) => `It holds ${countOf(holding, ACTIVE_OPTION)} on ${code}.`,
    writtenOnly: (written: number, code: string) => `It wrote ${countOf(written, OPTION)} on ${code} that ${written === 1 ? 'is' : 'are'} still open.`,
    both: (holding: number, written: number, code: string) =>
      `It holds ${countOf(holding, ACTIVE_OPTION)} on ${code} and wrote ${countOf(written, OPTION)} that ${written === 1 ? 'is' : 'are'} still open.`,
    escrowNone: (code: string) => `No option on ${code} is open in the contract.`,
    escrow: (total: number, active: number, offered: number, awaiting: number, code: string) =>
      `${countOf(total, OPTION)} on ${code} ${total === 1 ? 'is' : 'are'} open in the contract: ${active} active, ${offered} offered, ${awaiting} waiting for a claim or a reclaim.`,
  },

  freeze: {
    title: (who: string, code: string) => `Freeze ${who} for ${code}`,
    escrowTitle: (code: string) => `Freeze the options contract for ${code}`,
    description: (code: string) => `Freezing revokes the authorization to hold ${code}. You can authorize it again later.`,
    asset: 'Asset',
    account: 'Account',
    contract: 'Contract',
    balance: 'Balance',
    blocksTitle: 'What freezing blocks',
    accountBlocks: (code: string) => [
      `The account cannot send or receive ${code} until you authorize it again.`,
      `Options written on ${code} cannot settle for it: as a holder it cannot exercise, as a writer it cannot claim delivery or reclaim.`,
    ],
    escrowBlocks: (code: string) => [
      `The options contract cannot send or receive ${code} until you authorize it again.`,
      `Settlement stops for every option written on ${code}: no exercise, no claim, no reclaim.`,
    ],
    cancel: 'Cancel',
    confirm: 'Freeze',
  },

  clawback: {
    title: (code: string) => `Claw back ${code}`,
    description: (code: string) => `Removes ${code} from the account. The tokens are destroyed, not sent to the issuer.`,
    escrowDescription: (code: string) => `Removes ${code} from the options contract. The tokens are destroyed, not sent to the issuer.`,
    from: 'From',
    balance: 'Balance',
    balanceUnknown: 'Not read',
    amount: 'Amount',
    max: (amount: string, code: string) => `use the full balance, ${amount} ${code}`,
    invalidAmount: (decimals: number) => `Enter an amount above zero with at most ${decimals} decimals.`,
    overBalance: (balance: string, code: string) => `This balance is ${balance} ${code}. Enter ${balance} or less.`,
    impactTitle: 'What it does to the reserves',
    reserved: 'Reserved for open options',
    heldNow: 'Held now',
    heldAfter: 'Held after this',
    shortAfter: 'Short after this',
    notShort: 'None',
    impactUnknown: 'The reserves of the options contract could not be read, so the effect on open options is not shown.',
    warningWord: 'Warning',
    escrowWarningTitle: 'This can create a shortfall for option holders',
    escrowWarning: (code: string) => `The options contract holds this ${code} as collateral for open options.`,
    /** Exact wording kept from the previous console. */
    accountWarning: "This takes the tokens without the holder's consent and cannot be undone.",
    confirmLabel: (phrase: string) => `Type ${phrase} to confirm`,
    confirmLabelIdle: 'Type the confirmation',
    confirmHint: 'The amount, the asset code and the last four characters of the account.',
    confirmHintIdle: 'Enter the amount first.',
    confirmMismatch: (phrase: string) => `That does not match. Type ${phrase}.`,
    cancel: 'Cancel',
    confirm: 'Claw back',
    blocked: 'Enter an amount and type the confirmation exactly.',
  },

  labels: {
    authorize: (who: string, code: string) => `Authorize ${who} for ${code}`,
    freeze: (who: string, code: string) => `Freeze ${who} for ${code}`,
    clawback: (amount: string, code: string, who: string) => `Claw back ${amount} ${code} from ${who}`,
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
    transaction: 'Transaction',
    tryAgain: 'You can send it again.',
  },

  log: {
    title: 'Recent actions',
    caption: 'Issuer actions signed from this browser',
    time: 'Time (UTC)',
    action: 'Action',
    account: 'Account',
    state: 'State',
    transaction: 'Transaction',
    none: 'No issuer action yet.',
    noneHint: 'Each action you sign here is listed with its transaction.',
    noHash: 'Not sent',
  },
} as const

/**
 * Horizon result codes this console can meet, as sentences. Operation codes are looked up before transaction
 * codes. None of them says what happened to the fee: the transaction panel adds that sentence from the outcome.
 */
export const RESULT_CODE_TEXT: Record<string, string | undefined> = {
  op_no_trust: 'The account has no trustline for this asset.',
  op_cant_revoke: 'The issuer account does not have the Authorization revocable flag, so it cannot freeze.',
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
