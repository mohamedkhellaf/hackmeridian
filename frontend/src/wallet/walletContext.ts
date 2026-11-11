import { createContext } from 'react'
import type { WalletInfo } from './helpers'

/** What useWallet() returns. `address`, `sign` and `signAuthEntry` are the WalletSigner the clients capture. */
export interface WalletState {
  address: string | null
  /** Display name of the connected wallet ("Freighter", "xBull", ...), null when disconnected. */
  walletName: string | null
  wrongNetwork: boolean
  /** Ready-made banner text for wrongNetwork, naming the connected wallet. */
  networkMessage: string | null
  error: string | null
  /** Opens the wallet picker (or connects instantly under the test wallet). */
  connect: () => Promise<void>
  disconnect: () => void
  sign: (xdr: string) => Promise<string>
  signAuthEntry: (entryXdr: string) => Promise<string>
}

/** State of the wallet picker, rendered by the shell's connect dialog. */
export interface DialogState {
  open: boolean
  loading: boolean
  wallets: WalletInfo[]
  busyId: string | null
  error: string | null
  pick: (id: string) => void
  close: () => void
}

/** The picker when there is nothing to pick (test wallet, or outside a provider). */
export const CLOSED_DIALOG: DialogState = {
  open: false,
  loading: false,
  wallets: [],
  busyId: null,
  error: null,
  pick: () => {},
  close: () => {},
}

export const WalletContext = createContext<WalletState | null>(null)
export const WalletDialogContext = createContext<DialogState>(CLOSED_DIALOG)
