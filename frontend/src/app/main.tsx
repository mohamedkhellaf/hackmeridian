// The app entry. Order matters twice: the stylesheet declares the cascade layers before any component style,
// and the legacy hash redirect runs before the router reads the location.
import '../ui/index.css'
import './legacyRedirect'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createOptionsClient, isMockMode } from '../core/options/createClient'
import type { MockListRead, MockOptionsClient } from '../core/options/mockClient'
import type { TxErrorKind } from '../core/tx/errors'
import { activityStore, queryClient } from '../data'
import { AppProviders } from './providers'
import { router } from './router'

// Test builds only (VITE_E2E=1, folded away everywhere else): what a Playwright helper needs to reach inside
// the running app. It changes the test wallet's account through the router, without a page load that would
// reset the mock chain, and it stages states the mock market cannot reach by itself (a failed read, a clawback,
// a transaction that fails, an Activity entry). `e2e/helpers.ts` wraps every entry.
if (import.meta.env.VITE_E2E === '1') {
  /** The session's mock client: the instance the app itself reads and writes through. */
  const mock = async (): Promise<MockOptionsClient> => {
    if (!isMockMode()) throw new Error('This build runs on a contract: there is no mock client to stage.')
    return (await createOptionsClient({ address: null, sign: async (xdr) => xdr })) as unknown as MockOptionsClient
  }
  const hook = {
    router,
    queryClient,
    activityStore,
    /** Sets `?as=G...`, which the test wallet reads when it connects. The root route keeps the param from page to page. */
    setAccount: (address: string) => {
      const url = new URL(window.location.href)
      url.searchParams.set('as', address)
      return router.navigate({ href: url.pathname + url.search + url.hash, replace: true, resetScroll: false })
    },
    mock,
    /** How the next mock transaction ends (`null` clears it). */
    failNext: async (kind: TxErrorKind | null): Promise<void> => (await mock()).failNextWith(kind),
    /** Makes the next `times` calls of a list read reject (all three list reads when none is named). */
    failNextRead: async (method?: MockListRead, times = 1): Promise<void> => (await mock()).failNextRead(method, times),
    /** Takes `units` (a decimal string of token units) of a token away from the mock contract's own balance. */
    clawBack: async (tokenContractId: string, units: string): Promise<void> => (await mock()).clawBack(tokenContractId, BigInt(units)),
  }
  ;(window as unknown as { __stellsec?: typeof hook }).__stellsec = hook
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
}
