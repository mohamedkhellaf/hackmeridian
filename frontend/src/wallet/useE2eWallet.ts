import { useCallback, useState } from 'react'
import { DEMO_WALLETS } from '../core/options/demoAccounts'
import type { WalletState } from './walletContext'

// Test-only wallet for Playwright and the mock demo (browser extensions cannot be driven). Selected only when
// VITE_E2E=1 (see WalletProvider); in normal builds the constant fold drops this and the addresses. No kit code
// is involved on this path. These are plain public keys: there is no secret anywhere, and `sign` signs nothing.

/** The two demo identities (core/options/demoAccounts.ts): the mock market gives both of them positions. */
export const E2E_ADDRESSES = DEMO_WALLETS

export function useE2eWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null)

  // `?as=G...` is read at connect time, so a test can switch identity without reloading.
  const connect = useCallback(async () => {
    setAddress(new URLSearchParams(window.location.search).get('as') || E2E_ADDRESSES.a)
  }, [])
  const disconnect = useCallback(() => setAddress(null), [])
  const sign = useCallback(async (xdr: string) => xdr, [])
  const signAuth = useCallback(async (entryXdr: string) => entryXdr, [])
  const recheckNetwork = useCallback(async () => {}, [])

  return {
    address,
    walletName: address ? 'Test wallet' : null,
    wrongNetwork: false,
    networkMessage: null,
    recheckNetwork,
    connect,
    disconnect,
    sign,
    signAuthEntry: signAuth,
  }
}
