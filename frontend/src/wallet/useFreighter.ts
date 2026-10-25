import { useCallback, useEffect, useState } from 'react'
import { getAddress, getNetworkDetails, isConnected, requestAccess, signAuthEntry, signTransaction } from '@stellar/freighter-api'
import { config } from '../config'

function useRealFreighter() {
  const [address, setAddress] = useState<string | null>(null)
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshNetwork = useCallback(async () => {
    const details = await getNetworkDetails()
    if (!details.error) setNetworkPassphrase(details.networkPassphrase)
  }, [])

  // Restore an existing grant silently: getAddress returns "" until access is granted.
  useEffect(() => {
    void (async () => {
      const installed = await isConnected()
      if (installed.error || !installed.isConnected) return
      const res = await getAddress()
      if (res.error || !res.address) return
      setAddress(res.address)
      await refreshNetwork()
    })()
  }, [refreshNetwork])

  const connect = useCallback(async () => {
    setError(null)
    const installed = await isConnected()
    if (installed.error || !installed.isConnected) {
      setError('Freighter is not installed')
      return
    }
    const res = await requestAccess()
    if (res.error) {
      setError(res.error.message ?? 'Access denied')
      return
    }
    setAddress(res.address)
    await refreshNetwork()
  }, [refreshNetwork])

  const disconnect = useCallback(() => setAddress(null), [])

  const sign = useCallback(
    async (xdr: string) => {
      if (!address) throw new Error('Wallet not connected')
      const res = await signTransaction(xdr, { networkPassphrase: config.networkPassphrase, address })
      if (res.error) throw new Error(res.error.message ?? 'Signing rejected')
      return res.signedTxXdr
    },
    [address],
  )

  const signAuth = useCallback(
    async (entryXdr: string) => {
      if (!address) throw new Error('Wallet not connected')
      const res = await signAuthEntry(entryXdr, { networkPassphrase: config.networkPassphrase, address })
      if (res.error || !res.signedAuthEntry) throw new Error(res.error?.message ?? 'Signing rejected')
      return res.signedAuthEntry
    },
    [address],
  )

  const wrongNetwork = networkPassphrase !== null && networkPassphrase !== config.networkPassphrase

  return { address, wrongNetwork, error, connect, disconnect, sign, signAuthEntry: signAuth }
}

// Test-only wallet for Playwright (Freighter is a browser extension it cannot drive). Active only
// when VITE_E2E=1; in normal builds the constant below folds to the real hook.
const E2E_DEFAULT_ADDRESS = 'GBE65ZTLRGUEVNDQU65HG6EY36PW5QMJKXVSDVH72HOOIHTZYRZG3ZEG'

function useE2eWallet() {
  const [address, setAddress] = useState<string | null>(null)

  // `?as=G...` is read at connect time, so a test can switch identity without reloading.
  const connect = useCallback(async () => {
    setAddress(new URLSearchParams(window.location.search).get('as') || E2E_DEFAULT_ADDRESS)
  }, [])
  const disconnect = useCallback(() => setAddress(null), [])
  const sign = useCallback(async (xdr: string) => xdr, [])
  const signAuth = useCallback(async (entryXdr: string) => entryXdr, [])

  return { address, wrongNetwork: false, error: null as string | null, connect, disconnect, sign, signAuthEntry: signAuth }
}

export const useFreighter = import.meta.env.VITE_E2E === '1' ? useE2eWallet : useRealFreighter