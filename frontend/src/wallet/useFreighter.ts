import { useCallback, useEffect, useState } from 'react'
import { getAddress, getNetworkDetails, isConnected, requestAccess, signTransaction } from '@stellar/freighter-api'
import { config } from '../config'

export function useFreighter() {
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

  const wrongNetwork = networkPassphrase !== null && networkPassphrase !== config.networkPassphrase

  return { address, wrongNetwork, error, connect, disconnect, sign }
}
