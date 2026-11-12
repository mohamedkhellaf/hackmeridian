import { Link as RouterLink, useLocation, useMatches, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatUtcTime } from '../core/format'
import { Button, Link, announce } from '../ui'
import { focusPageHeading } from './navigation'
import { errorDetail, isChunkLoadError } from './routeErrors'
import { StatusPage } from './StatusPage'
import styles from './RouteError.module.css'

/**
 * The last "Try again" pressed on an error page. When the same error comes back, React may keep this error page
 * or mount a new one; the attempt is remembered outside it so that either way the page says so and keeps focus on
 * its button.
 */
let lastRetry: { href: string; at: number; claimed: boolean } | null = null

/** How soon after a retry a new error page counts as "the same error came back". */
const RETRY_WINDOW_MS = 5_000

const SAME_ERROR = 'The same error came back.'

/**
 * The error boundary of every route. A page that throws while rendering lands here: the shell, the wallet and
 * the other pages keep working. The screen points to Activity, where a transaction signed just before keeps its state.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const href = useLocation({ select: (location) => location.href })
  const pathname = useLocation({ select: (location) => location.pathname })
  const bare = useMatches({ select: (matches) => matches.some((match) => match.staticData.bare === true) })
  const stale = isChunkLoadError(error)
  const retryButton = useRef<HTMLButtonElement>(null)
  const mounted = useRef(false)
  // An error page mounted right after "Try again" on the same address: the retry failed. The router may mount
  // the error page more than once on the way, so each one inside the window says so.
  const [failedAgainAt, setFailedAgainAt] = useState<number | null>(() => {
    const retry = lastRetry
    return retry && retry.href === href && Date.now() - retry.at <= RETRY_WINDOW_MS ? retry.at : null
  })

  useEffect(() => {
    console.error(error)
  }, [error])

  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Mounted after a failed retry: keep focus where the user pressed, and say it once.
  useLayoutEffect(() => {
    const retry = lastRetry
    if (failedAgainAt === null || !retry || retry.at !== failedAgainAt) return
    retryButton.current?.focus()
    if (retry.claimed) return
    retry.claimed = true
    announce(SAME_ERROR)
  }, [failedAgainAt])

  const retry = () => {
    const attempt = { href, at: Date.now(), claimed: false }
    lastRetry = attempt
    reset()
    void router.invalidate()
    // Two frames on: if this page is still mounted, the error came back here, and it says so. Otherwise the page
    // is rendering again: focus goes to its heading, as after a navigation. If the error comes back on a new error
    // page instead (the router may show its pending state first), that page claims the attempt when it mounts,
    // within RETRY_WINDOW_MS, and takes focus back to its own button.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (attempt.claimed) return
        if (mounted.current) {
          attempt.claimed = true
          setFailedAgainAt(attempt.at)
          retryButton.current?.focus()
          announce(SAME_ERROR)
          return
        }
        focusPageHeading()
      }),
    )
  }

  // The way out leads somewhere else than the page that failed.
  const away = pathname === '/markets' || pathname.startsWith('/markets/') ? { to: '/portfolio' as const, label: 'Go to Portfolio' } : { to: '/markets' as const, label: 'Go to Markets' }

  return (
    <StatusPage
      frame={bare ? 'bare' : 'none'}
      title={stale ? 'This page could not be loaded' : 'This page could not be shown'}
      description={
        stale ? (
          'The code for this page did not arrive. The connection may have dropped, or a newer version of the app was published. Reloading fetches the current version.'
        ) : (
          <>
            Something failed while drawing this page. If you had just signed a transaction, its state is in{' '}
            <Link render={<RouterLink to="/activity" activeOptions={{ exact: true }} />}>Activity</Link>.
          </>
        )
      }
      detail={stale ? undefined : errorDetail(error)}
      actions={
        <>
          {stale ? (
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload the page
            </Button>
          ) : (
            <Button ref={retryButton} variant="primary" onClick={retry}>
              Try again
            </Button>
          )}
          <Link render={<RouterLink to={away.to} activeOptions={{ exact: true }} />}>{away.label}</Link>
        </>
      }
    >
      {failedAgainAt !== null ? (
        <p className={styles.again}>
          Tried again at {formatUtcTime(Math.floor(failedAgainAt / 1000))}. {SAME_ERROR}
        </p>
      ) : null}
    </StatusPage>
  )
}
