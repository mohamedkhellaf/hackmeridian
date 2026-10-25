import { createContext } from 'react'
import type { WalletInfo } from './helpers'

// What useFreighter()/useWallet() return. The first seven fields are the original Freighter-only
// shape that App.tsx and src/stellar/signer.ts depend on; walletName/networkMessage are additive.
export interface WalletState {
  address: string | null
  /** Display name of the connected wallet ("Freighter", "xBull", ...), null when disconnected. */
  walletName: string | null
  wrongNetwork: boolean
  /** Ready-made banner text for wrongNetwork, naming the connected wallet. */
  networkMessage: string | null
  error: string | null
  /** Opens Strata's connect dialog (or connects instantly under the e2e mock). */
  connect: () => Promise<void>
  disconnect: () => void
  sign: (xdr: string) => Promise<string>
  signAuthEntry: (entryXdr: string) => Promise<string>
}

export interface DialogState {
  open: boolean
  loading: boolean
  wallets: WalletInfo[]
  busyId: string | null
  error: string | null
  pick: (id: string) => void
  close: () => void
}

export const WalletContext = createContext<WalletState | null>(null)
