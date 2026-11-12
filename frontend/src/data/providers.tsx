// The providers of the data layer. The app composes them once, inside the wallet provider:
//
//   <WalletProvider>
//     <DataProvider>
//       <RouterProvider ... />
//     </DataProvider>
//   </WalletProvider>
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { OptionsClient } from '../core/options/client'
import { createOptionsClient, isMockMode } from '../core/options/createClient'
import { ClockProvider } from '../ui/Clock'
import { useWallet } from '../wallet'
import { useLedgerOffsetMs } from './clock'
import { bindSigner, createClientSource } from './clientSource'
import type { ClientSource } from './clientSource'
import { GUIDE_STORAGE_KEY, guideStore } from './guide'
import { queryClient as appQueryClient } from './queryClient'
import { SETTINGS_STORAGE_KEY, settingsStore } from './settings'
import { ACTIVITY_KEY_PREFIX, activityStore } from './tx/activityStore'
import { resumeUnknown } from './tx/runner'
import { useRunnerDeps } from './tx/useTx'
import { OptionsClientContext } from './useOptionsClient'
import type { OptionsClientHandle } from './useOptionsClient'

const WRONG_NETWORK_FALLBACK = 'Your wallet is not on Testnet. Switch the network in the wallet.'

/**
 * Provides one Covered client for the whole session. Must sit inside `<WalletProvider>`.
 *
 * The client is bound to a long-lived signer whose `address` is a getter over the current wallet, so connecting,
 * disconnecting or switching wallets never rebuilds the client (its asset and token caches survive) and a write
 * always signs with the wallet that is connected when the button is pressed. Nothing is loaded until the first
 * read asks for the client.
 */
export function OptionsClientProvider({ children, source }: { children: ReactNode; source?: ClientSource<OptionsClient> }) {
  const wallet = useWallet()
  const [own] = useState(() => {
    const binding = bindSigner(wallet)
    return { binding, source: createClientSource(() => createOptionsClient(binding.signer)) }
  })
  useLayoutEffect(() => {
    own.binding.set(wallet)
  }, [own, wallet])
  const src = source ?? own.source
  const client = useSyncExternalStore(src.subscribe, src.peek, src.peek)
  const error = useSyncExternalStore(src.subscribe, src.error, src.error)
  const me = wallet.address
  const wrongNetwork = wallet.wrongNetwork ? (wallet.networkMessage ?? WRONG_NETWORK_FALLBACK) : null
  const value = useMemo<OptionsClientHandle>(() => ({ getClient: src.get, client, isMock: isMockMode(), error, me, wrongNetwork }), [src, client, error, me, wrongNetwork])
  return <OptionsClientContext.Provider value={value}>{children}</OptionsClientContext.Provider>
}

/** Keeps the settings and the Activity list in step with other tabs of the same browser. */
function useStorageSync(): void {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === SETTINGS_STORAGE_KEY) settingsStore.reload()
      if (e.key === null || e.key === GUIDE_STORAGE_KEY) guideStore.reload()
      if (e.key?.startsWith(ACTIVITY_KEY_PREFIX)) activityStore.reload(e.key.slice(ACTIVITY_KEY_PREFIX.length))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
}

/**
 * Looks up again, on a timer, the transactions of the connected wallet whose outcome was unknown when the page that
 * sent them closed (review finding 19): the runner refuses a new write while one of them can still land, so it
 * must not wait for someone to press Check again in Activity.
 */
function ResumeUnknown(): null {
  const deps = useRunnerDeps()
  const { address } = useWallet()
  useEffect(() => {
    if (address) resumeUnknown(deps, address)
  }, [deps, address])
  return null
}

/** Countdowns of the kit follow ledger time: the offset the ledger query measures. */
function LedgerClock({ children }: { children: ReactNode }) {
  return <ClockProvider offsetMs={useLedgerOffsetMs()}>{children}</ClockProvider>
}

export interface DataProviderProps {
  children: ReactNode
  /** A cache of your own (tests, the component gallery). Default: the app's. */
  client?: QueryClient
  /** A Covered client source of your own (tests). Default: `createOptionsClient` bound to the wallet. */
  source?: ClientSource<OptionsClient>
}

/**
 * Everything the data hooks need: the query cache, the Covered client and cross-tab sync of settings and
 * Activity. Must sit inside `<WalletProvider>`. Settings are applied to <html> when `./settings` is first
 * imported, which this file does, so the theme is set before the first paint of the app.
 */
export function DataProvider({ children, client = appQueryClient, source }: DataProviderProps) {
  useStorageSync()
  return (
    <QueryClientProvider client={client}>
      <OptionsClientProvider source={source}>
        <ResumeUnknown />
        <LedgerClock>{children}</LedgerClock>
      </OptionsClientProvider>
    </QueryClientProvider>
  )
}
