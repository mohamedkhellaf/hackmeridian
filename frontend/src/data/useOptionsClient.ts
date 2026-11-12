import { createContext, useContext } from 'react'
import type { OptionsClient } from '../core/options/client'
import { isMockMode } from '../core/options/createClient'

export interface OptionsClientHandle {
  /**
   * Resolves with the session's Covered client: the mock when the build has no contract id, else the Soroban
   * client. Call it inside query and write functions; the first call starts the (dynamic) load.
   */
  getClient: () => Promise<OptionsClient>
  /** The client once it is loaded, for synchronous use. Null before that. */
  client: OptionsClient | null
  /** True when the build runs on the in-memory mock. Known before the client is loaded. */
  isMock: boolean
  /** Why the client could not be loaded, or null. The next read tries again. */
  error: string | null
  /** The connected wallet address, or null. */
  me: string | null
  /**
   * Set when the connected wallet reports a network other than Testnet: the sentence to show ("Freighter is not on
   * Testnet. Switch the network in the wallet."). Null otherwise, also when the wallet cannot report its network.
   * A write is refused before anything is sent while it is set (never in mock mode, where nothing is sent).
   */
  wrongNetwork: string | null
}

export const OptionsClientContext = createContext<OptionsClientHandle | null>(null)

/** The Covered client of this session. Needs `<DataProvider>`. */
export function useOptionsClient(): OptionsClientHandle {
  const ctx = useContext(OptionsClientContext)
  if (!ctx) throw new Error('useOptionsClient must be used inside <DataProvider>')
  return ctx
}

/**
 * True when the build runs on the in-memory mock (no Covered contract id). A build-time fact, so it needs no
 * provider and is the same on every render.
 */
export function useIsMock(): boolean {
  return isMockMode()
}

/** The connected wallet address, or null. Hooks that take `me` default to this. */
export function useMe(): string | null {
  return useOptionsClient().me
}
