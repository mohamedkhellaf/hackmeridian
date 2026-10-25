import type { ReactNode } from 'react'
import { ConnectWalletDialog } from './ConnectWalletDialog'
import { useE2eWallet } from './useE2eWallet'
import { useKitWallet } from './useKitWallet'
import { WalletContext, type WalletState } from './walletContext'
import './wallet.css'

function KitWalletProvider({ children }: { children: ReactNode }) {
  const { wallet, dialog } = useKitWallet()
  return (
    <WalletContext.Provider value={wallet}>
      {children}
      <ConnectWalletDialog dialog={dialog} />
    </WalletContext.Provider>
  )
}

function E2eWalletProvider({ children }: { children: ReactNode }) {
  const wallet: WalletState = useE2eWallet()
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
}

// Compile-time fold: production builds drop the e2e branch (and its mock address); the e2e build
// never reaches the kit.
export const WalletProvider = import.meta.env.VITE_E2E === '1' ? E2eWalletProvider : KitWalletProvider

