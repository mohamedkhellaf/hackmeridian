// Test-only entry: the order ticket outside the app, on the mock chain, for the end-to-end spec and for
// screenshots of every state. Not part of the build (vite.config.ts lists index.html as the only input) and not
// linked from anywhere. Open /src/features/ticket/harness/index.html on the dev server.
import { Outlet, RouterProvider, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DataProvider } from '../../../data'
import { LiveRegions, ToastRegion, TooltipProvider } from '../../../ui'
import { WalletProvider } from '../../../wallet'
import { Harness } from './Harness'

const rootRoute = createRootRoute({
  component: () => (
    <WalletProvider>
      <DataProvider>
        <TooltipProvider>
          <Outlet />
          <ToastRegion />
          <LiveRegions />
        </TooltipProvider>
      </DataProvider>
    </WalletProvider>
  ),
})

// One page for every path: a receipt's link changes the address and the harness shows where it went.
const anyRoute = createRoute({ getParentRoute: () => rootRoute, path: '$', component: Harness })

const router = createRouter({
  routeTree: rootRoute.addChildren([anyRoute]),
  // Plain key=value, as the app's router: an id or a decimal never passes through JSON.
  parseSearch: (text) => Object.fromEntries(new URLSearchParams(text)),
  stringifySearch: (search) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(search)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
    const text = params.toString()
    return text ? `?${text}` : ''
  },
})

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router as never} />
    </StrictMode>,
  )
}
