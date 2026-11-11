// Public surface of the wallet layer. Logic and context only: the connect dialog and the wallet menu are
// presentational and live in features/shell.
export { WalletProvider } from './WalletProvider'
export { useWallet, useWalletDialog } from './useWallet'
export type { DialogState, WalletState } from './walletContext'
export { E2E_ADDRESSES } from './useE2eWallet'
export { splitWallets, initials, wrongNetworkMessage, WALLET_STORAGE_KEY } from './helpers'
export type { WalletAvailability, WalletInfo } from './helpers'
