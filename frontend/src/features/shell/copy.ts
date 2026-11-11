// The shell's own words. Required disclosure sentences are not here: they come from core/disclosures.
import type { NetworkState } from '../../data'
import type { PnlScheme, ThemeChoice } from '../../data'
import type { BalanceStatus } from '../../core/stellar/tokens'

// ---- Network indicator -------------------------------------------------------------------------------------

/** The network the wallet must be on. Named once, in the top bar. */
export const NETWORK_NAME = 'Testnet'

/** A build without a contract says so in place of the network name. */
export const MOCK_DATA = 'Mock data'

/** The reading while the ledger reads are current: `ledgerReading('58,331,204')`. */
export const ledgerReading = (ledger: string): string => `Testnet, ledger ${ledger}`

/**
 * What the indicator says in place of the ledger number when the reads are not current: the full words from
 * 1200 px, the short ones on narrower bars.
 */
export const NETWORK_LATE: Record<Extract<NetworkState, 'delayed' | 'down'>, { full: string; short: string }> = {
  delayed: { full: 'Testnet, reads are late', short: 'Reads are late' },
  down: { full: 'Testnet, no connection', short: 'No connection' },
}

/** The banner under the bar when the reads stay late through one more poll, or none could be made at all. */
export const LATE_READ_TITLE = 'Figures may be out of date'
export const LATE_READ_TEXT: Record<'delayed' | 'down', string> = {
  delayed: 'The last ledger read failed or is late. The page keeps trying.',
  down: 'No ledger could be read. The page keeps trying.',
}

// ---- Settings ----------------------------------------------------------------------------------------------

export const SETTINGS_TITLE = 'Settings'
export const THEME_GROUP = 'Theme'
export const PNL_GROUP = 'Gain and loss colours'

export const THEME_LABEL: Record<ThemeChoice, string> = { system: 'System', light: 'Light', dark: 'Dark' }
export const PNL_LABEL: Record<PnlScheme, string> = { default: 'Teal and orange', classic: 'Green and red', mono: 'Ink only' }

// ---- Wallet ------------------------------------------------------------------------------------------------

/** Why a balance has no figure, shown in its place. */
export const BALANCE_REASON: Record<Exclude<BalanceStatus, 'ok'>, string> = {
  mock: 'Mock token',
  unfunded: 'Account not funded',
  'no-trustline': 'No trustline',
  'not-authorized': 'Not authorized by the issuer',
  error: 'Unavailable',
}

export const CONNECT_TITLE = 'Connect a wallet'
export const CONNECT_EMPTY = 'No wallets found.'
export const CONNECT_EMPTY_HINT = 'Install a Stellar wallet extension, reload this page, then connect again.'
/** On a touch device extension stores are not offered: what can open there is listed, and this says why. */
export const CONNECT_TOUCH_NOTE = 'Browser extensions are not offered on this device. To use one, open StellSec in a desktop browser.'
/** The wallet list could not be loaded: the error is shown above, and this is the way forward. */
export const CONNECT_RETRY = 'Try again'
/** While one wallet is asked. `name` is the wallet's own name. */
export const connectWaiting = (name: string): string => `Approve the connection in ${name}. Nothing is signed by connecting.`

export const WRONG_NETWORK_TITLE = 'Wrong network'
/** `name` is the connected wallet's name, or null when the wallet layer does not know it. */
export const wrongNetworkText = (name: string | null): string =>
  `${name ?? 'Your wallet'} is on another network. Open the wallet, choose Testnet (some wallets call it Test Net), then check again. Until then nothing can be signed here.`

/** Reads the wallet's network again. */
export const CHECK_AGAIN = 'Check again'
