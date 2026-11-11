import { useContext } from 'react'
import { WalletContext, type WalletState } from './walletContext'

// Reads the wallet from <WalletProvider> (src/main.tsx). Wallets come from Stellar Wallets Kit;
// the name `useFreighter` is kept so existing callers do not change.
export function useWallet(): WalletState {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>')
  return ctx
}

export const useFreighter = useWallet
