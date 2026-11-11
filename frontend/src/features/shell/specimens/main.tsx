/**
 * Dev-only entry of /src/features/shell/specimens/specimens.html: the shell states page. It is not part of the
 * production build (vite.config.ts lists index.html only); e2e/shell-chrome.spec.ts opens it on the dev server.
 */
import '../../../ui/index.css'
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ShellStates } from './ShellStates'

// The footer's links are router links: a router of its own, in memory, so following one changes nothing here.
const router = createRouter({ routeTree: createRootRoute({ component: ShellStates, notFoundComponent: () => null }), history: createMemoryHistory({ initialEntries: ['/'] }) })

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router as never} />
    </StrictMode>,
  )
}
