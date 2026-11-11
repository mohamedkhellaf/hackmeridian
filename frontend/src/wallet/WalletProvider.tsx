import type { ReactNode } from 'react'
import { useE2eWallet } from './useE2eWallet'
import { useKitWallet } from './useKitWallet'
import { CLOSED_DIALOG, WalletContext, WalletDialogContext } from './walletContext'

// Wallet state for the whole app. The picker itself is presentational and lives in the shell: it reads
// useWalletDialog() and renders the wallet list, so this folder ships no UI and no CSS.

function KitWalletProvider({ children }: { children: ReactNode }) {
  const { wallet, dialog } = useKitWallet()
  return (
    <WalletContext.Provider value={wallet}>
      <WalletDialogContext.Provider value={dialog}>{children}</WalletDialogContext.Provider>
    </WalletContext.Provider>
  )
}

function E2eWalletProvider({ children }: { children: ReactNode }) {
  const wallet = useE2eWallet()
  return (
    <WalletContext.Provider value={wallet}>
      <WalletDialogContext.Provider value={CLOSED_DIALOG}>{children}</WalletDialogContext.Provider>
    </WalletContext.Provider>
  )
}

// Compile-time fold: production builds drop the test branch (and its fixed addresses); the test build
// never reaches the kit.
export const WalletProvider = import.meta.env.VITE_E2E === '1' ? E2eWalletProvider : KitWalletProvider
