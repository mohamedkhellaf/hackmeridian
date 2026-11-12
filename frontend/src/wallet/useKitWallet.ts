import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { config } from '../core/config'
import {
  describeWalletError,
  isWrongNetwork,
  readStoredWalletId,
  probeWallets,
  toWalletInfos,
  wrongNetworkMessage,
  writeStoredWalletId,
  type WalletInfo,
} from './helpers'
import { loadKit } from './kit'
import type { DialogState, WalletState } from './walletContext'

type Kit = Awaited<ReturnType<typeof loadKit>>

/**
 * Wallets whose account can be read again without a prompt (`skipRequestAccess`). The others (Albedo, xBull's web
 * bridge, ...) open a popup to answer, so their account is read only when the user connects.
 */
const SILENT_ADDRESS_IDS = new Set(['freighter'])

// Multi-wallet state on top of Stellar Wallets Kit. The kit is loaded lazily; the picker UI is
// StellSec's own (the shell's connect dialog), driven by `dialog` through useWalletDialog().
export function useKitWallet(): { wallet: WalletState; dialog: DialogState } {
  const [address, setAddress] = useState<string | null>(null)
  const [walletName, setWalletName] = useState<string | null>(null)
  const [reported, setReported] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [wallets, setWallets] = useState<WalletInfo[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const nameRef = useRef<string | null>(null)
  const addressRef = useRef<string | null>(null)
  useEffect(() => {
    nameRef.current = walletName
    addressRef.current = address
  }, [walletName, address])

  // A wallet that cannot report its network yields null: we show nothing rather than block.
  const refreshNetwork = useCallback(async (kit: Kit) => {
    try {
      const { networkPassphrase } = await kit.getNetwork()
      setReported(networkPassphrase || null)
    } catch {
      setReported(null)
    }
  }, [])

  // Restore the last wallet silently (no popup: skipRequestAccess).
  useEffect(() => {
    const id = readStoredWalletId()
    if (!id) return
    let cancelled = false
    void (async () => {
      try {
        const kit = await loadKit()
        kit.setWallet(id)
        const { address: restored } = await kit.selectedModule.getAddress({ skipRequestAccess: true })
        if (cancelled || !restored) return
        setAddress(restored)
        setWalletName(kit.selectedModule.productName)
        await refreshNetwork(kit)
      } catch {
        // Wallet locked, uninstalled or access revoked: stay disconnected, user can reconnect.
        if (!cancelled) writeStoredWalletId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshNetwork])

  // Reads again what the wallet reports: its network and, where that needs no prompt, its account. A user who
  // switches account inside the extension must not keep seeing, or signing for, the old one.
  const recheckNetwork = useCallback(async () => {
    if (!addressRef.current) return
    let kit: Kit
    try {
      kit = await loadKit()
    } catch {
      return
    }
    await refreshNetwork(kit)
    const id = readStoredWalletId()
    if (!id || !SILENT_ADDRESS_IDS.has(id)) return
    try {
      const { address: now } = await kit.selectedModule.getAddress({ skipRequestAccess: true })
      if (now && addressRef.current && now !== addressRef.current) setAddress(now)
    } catch {
      // Locked or unreachable: keep the account; signing will say what is wrong.
    }
  }, [refreshNetwork])

  // Check again when the user comes back from the wallet (network or account switched there).
  useEffect(() => {
    if (!address) return
    const onFocus = () => void recheckNetwork()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [address, recheckNetwork])

  const connect = useCallback(async () => {
    setDialogError(null)
    setOpen(true)
    setLoading(true)
    try {
      const kit = await loadKit()
      setWallets(toWalletInfos(await kit.refreshSupportedWallets(), probeWallets()))
    } catch (e) {
      setDialogError(describeWalletError(e, undefined, 'connect'))
    } finally {
      setLoading(false)
    }
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setBusyId(null)
    setDialogError(null)
  }, [])

  const pick = useCallback(
    (id: string) => {
      const info = wallets.find((w) => w.id === id)
      void (async () => {
        setBusyId(id)
        setDialogError(null)
        try {
          const kit = await loadKit()
          kit.setWallet(id)
          const { address: connected } = await kit.fetchAddress()
          setAddress(connected)
          setWalletName(kit.selectedModule.productName)
          writeStoredWalletId(id)
          setOpen(false)
          await refreshNetwork(kit)
        } catch (e) {
          setDialogError(describeWalletError(e, info?.name, 'connect'))
        } finally {
          setBusyId(null)
        }
      })()
    },
    [wallets, refreshNetwork],
  )

  const disconnect = useCallback(() => {
    setAddress(null)
    setWalletName(null)
    setReported(null)
    writeStoredWalletId(null)
    void loadKit().then((kit) => kit.disconnect()).catch(() => {})
  }, [])

  const sign = useCallback(
    async (xdr: string) => {
      if (!address) throw new Error('Wallet not connected')
      try {
        const kit = await loadKit()
        const res = await kit.signTransaction(xdr, { networkPassphrase: config.networkPassphrase, address })
        return res.signedTxXdr
      } catch (e) {
        throw new Error(describeWalletError(e, nameRef.current ?? undefined))
      }
    },
    [address],
  )

  const signAuthEntry = useCallback(
    async (entryXdr: string) => {
      if (!address) throw new Error('Wallet not connected')
      try {
        const kit = await loadKit()
        const res = await kit.signAuthEntry(entryXdr, { networkPassphrase: config.networkPassphrase, address })
        return res.signedAuthEntry
      } catch (e) {
        throw new Error(describeWalletError(e, nameRef.current ?? undefined))
      }
    },
    [address],
  )

  const wrongNetwork = isWrongNetwork(reported, config.networkPassphrase)

  const wallet = useMemo<WalletState>(
    () => ({
      address,
      walletName,
      wrongNetwork,
      networkMessage: wrongNetwork ? wrongNetworkMessage(walletName) : null,
      recheckNetwork,
      connect,
      disconnect,
      sign,
      signAuthEntry,
    }),
    [address, walletName, wrongNetwork, recheckNetwork, connect, disconnect, sign, signAuthEntry],
  )
  const dialog = useMemo<DialogState>(
    () => ({ open, loading, wallets, busyId, error: dialogError, pick, close }),
    [open, loading, wallets, busyId, dialogError, pick, close],
  )
  return { wallet, dialog }
}
