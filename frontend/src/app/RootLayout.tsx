import { Outlet, useMatches } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'
import { GuideMount } from './GuideMount'
import { loadShell } from './shellChunk'
import { StatusPage } from './StatusPage'

const AppShell = lazy(() => loadShell().then((m) => ({ default: m.AppShell })))

/**
 * The root of every route. `/` (the landing) renders bare, with its own layout; every other route, the
 * not-found page included, renders inside the app shell, which stays mounted from one app route to the next.
 */
export function RootLayout() {
  const bare = useMatches({ select: (matches) => matches.some((match) => match.staticData.bare === true) })
  if (bare) return <Outlet />
  return (
    <Suspense fallback={<StatusPage frame="shell" busy />}>
      <AppShell>
        <Outlet />
      </AppShell>
      <GuideMount />
    </Suspense>
  )
}
