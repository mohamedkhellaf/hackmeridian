// The shell's own words. Required disclosure sentences are not here: they come from core/disclosures.
import { NETWORK_STATE_LABEL } from '../../data'
import type { NetworkState } from '../../data'
import type { DensityChoice, PnlScheme, ThemeChoice } from '../../data'
import type { BalanceStatus } from '../../core/stellar/tokens'


// ---- Network chip ------------------------------------------------------------------------------------------

/**
 * The word for the state of the reads (the data layer's, so every screen says the same). The dot never carries
 * the state alone. In a build without a contract the chip reads "Mock data" in place of the network name: that
 * is where a mock build says what it is.
 */
export const NETWORK_WORD: Record<NetworkState, string> = NETWORK_STATE_LABEL

/** What the state means for the figures on screen. */
export const NETWORK_MEANING: Record<NetworkState, string> = {
  mock: 'This build runs on an in-memory demo market. Nothing is read from Stellar and nothing is sent to it.',
  connecting: 'Reading the latest ledger from the Testnet RPC.',
  ok: 'The last read succeeded. Figures on screen are current to this ledger.',
  delayed: 'The last read failed or is late. The ledger shown may be behind, and figures on screen may be out of date.',
  down: 'No ledger could be read. Figures on screen may be out of date. The page keeps trying.',
}

// ---- Settings ----------------------------------------------------------------------------------------------

export const SETTINGS_TITLE = 'Settings'
export const THEME_GROUP = 'Theme'
export const DENSITY_GROUP = 'Table density'
export const PNL_GROUP = 'Gain and loss colours'

export const THEME_LABEL: Record<ThemeChoice, string> = { system: 'System', light: 'Light', dark: 'Dark' }
export const DENSITY_LABEL: Record<DensityChoice, string> = { comfortable: 'Comfortable', compact: 'Compact' }
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
export const CONNECT_LOADING = 'Looking for wallets'
export const CONNECT_EMPTY = 'No wallets found.'
export const CONNECT_EMPTY_HINT = 'Install a Stellar wallet extension, reload this page, then connect again.'

export const WRONG_NETWORK_TITLE = 'Wrong network'
export const WRONG_NETWORK_FALLBACK = 'Your wallet is not on Testnet. Switch the network in the wallet.'
export const WRONG_NETWORK_FIX =
  'Open the wallet, find its network setting and choose Testnet (some wallets call it Test Net). This page checks again when you come back to it. A transaction signed for another network fails here.'
