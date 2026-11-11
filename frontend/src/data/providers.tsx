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
import { useWallet } from '../wallet'
import { bindSigner, createClientSource } from './clientSource'
import type { ClientSource } from './clientSource'
import { queryClient as appQueryClient } from './queryClient'
import { SETTINGS_STORAGE_KEY, settingsStore } from './settings'
import { ACTIVITY_KEY_PREFIX, activityStore } from './tx/activityStore'
import { OptionsClientContext } from './useOptionsClient'
import type { OptionsClientHandle } from './useOptionsClient'

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
  const value = useMemo<OptionsClientHandle>(() => ({ getClient: src.get, client, isMock: isMockMode(), error, me }), [src, client, error, me])
  return <OptionsClientContext.Provider value={value}>{children}</OptionsClientContext.Provider>
}

/** Keeps the settings and the Activity list in step with other tabs of the same browser. */
function useStorageSync(): void {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === SETTINGS_STORAGE_KEY) settingsStore.reload()
      if (e.key?.startsWith(ACTIVITY_KEY_PREFIX)) activityStore.reload(e.key.slice(ACTIVITY_KEY_PREFIX.length))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
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
      <OptionsClientProvider source={source}>{children}</OptionsClientProvider>
    </QueryClientProvider>
  )
}
