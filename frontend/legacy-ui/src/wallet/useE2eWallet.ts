import { useCallback, useState } from 'react'
import type { WalletState } from './walletContext'

// Test-only wallet for Playwright (browser extensions cannot be driven). Selected only when
// VITE_E2E=1 (see WalletProvider); in normal builds the constant fold drops this and the mock
// address. No kit code is involved on this path.
const E2E_DEFAULT_ADDRESS = 'GBE65ZTLRGUEVNDQU65HG6EY36PW5QMJKXVSDVH72HOOIHTZYRZG3ZEG'

export function useE2eWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null)

  // `?as=G...` is read at connect time, so a test can switch identity without reloading.
  const connect = useCallback(async () => {
    setAddress(new URLSearchParams(window.location.search).get('as') || E2E_DEFAULT_ADDRESS)
  }, [])
  const disconnect = useCallback(() => setAddress(null), [])
  const sign = useCallback(async (xdr: string) => xdr, [])
  const signAuth = useCallback(async (entryXdr: string) => entryXdr, [])

  return {
    address,
    walletName: address ? 'Test wallet' : null,
    wrongNetwork: false,
    networkMessage: null,
    error: null,
    connect,
    disconnect,
    sign,
    signAuthEntry: signAuth,
  }
}
