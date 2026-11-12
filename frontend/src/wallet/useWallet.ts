import { useContext } from 'react'
import { WalletContext, WalletDialogContext, type DialogState, type WalletState } from './walletContext'

/** The connected wallet (address, name, network state, connect, disconnect, sign). Needs <WalletProvider>. */
export function useWallet(): WalletState {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>')
  return ctx
}

/**
 * State of the wallet picker: the shell renders its connect dialog from this. Under the test wallet
 * (VITE_E2E=1) connecting is instant and the dialog never opens.
 */
export function useWalletDialog(): DialogState {
  return useContext(WalletDialogContext)
}
