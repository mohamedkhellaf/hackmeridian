import { Outlet, useMatches, useRouter } from '@tanstack/react-router'
import { Suspense, lazy, useEffect } from 'react'
import { GuideMount } from './GuideMount'
import { loadShell, warmShell } from './shellChunk'
import { StatusPage } from './StatusPage'

const AppShell = lazy(() => loadShell().then((m) => ({ default: m.AppShell })))

/**
 * Once the landing page has loaded and the browser is idle, fetch the shell and the Markets page, so its main call
 * to action opens the app with its chrome and no skeleton. Nothing of it is on the landing's critical path.
 */
function useWarmAppAfterLanding(landing: boolean): void {
  const router = useRouter()
  useEffect(() => {
    if (!landing) return
    let cancelled = false
    let idle: number | undefined
    let timer: number | undefined
    const warm = () => {
      if (cancelled) return
      warmShell()
      router.preloadRoute({ to: '/markets' }).catch(() => {
        // A failed preload is retried by the navigation itself.
      })
    }
    const schedule = () => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(warm, { timeout: 5_000 })
      else timer = window.setTimeout(warm, 2_000)
    }
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    return () => {
      cancelled = true
      window.removeEventListener('load', schedule)
      if (idle !== undefined) window.cancelIdleCallback(idle)
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [landing, router])
}

/**
 * The root of every route. `/` (the landing) renders bare, with its own layout; every other route, the
 * not-found page included, renders inside the app shell, which stays mounted from one app route to the next.
 * Until the shell's code has arrived, a frame with its measures and the logo stands in for it.
 */
export function RootLayout() {
  const bare = useMatches({ select: (matches) => matches.some((match) => match.staticData.bare === true) })
  useWarmAppAfterLanding(bare)
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
