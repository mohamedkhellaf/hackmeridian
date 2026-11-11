import { Link as RouterLink, useMatches, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button, Link } from '../ui'
import { errorDetail, isChunkLoadError } from './routeErrors'
import { StatusPage } from './StatusPage'
import styles from './RouteError.module.css'

/**
 * The error boundary of every route. A page that throws while rendering lands here: the shell, the wallet and
 * the other pages keep working. Nothing was sent to the network by this failure, and the screen says so.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const bare = useMatches({ select: (matches) => matches.some((match) => match.staticData.bare === true) })
  const stale = isChunkLoadError(error)

  useEffect(() => {
    console.error(error)
  }, [error])

  const retry = () => {
    reset()
    void router.invalidate()
  }

  return (
    <StatusPage
      frame={bare ? 'bare' : 'none'}
      title={stale ? 'This page could not be loaded' : 'This page could not be shown'}
      description={
        stale ? (
          'The code for this page did not arrive. The connection may have dropped, or a newer version of the app was published. Reloading fetches the current version.'
        ) : (
          <>
            Something failed while drawing this page. The failure itself sends nothing to the network. If you had just signed a transaction, its state is in{' '}
            <Link render={<RouterLink to="/activity" />}>Activity</Link>.
          </>
        )
      }
      actions={
        <>
          {stale ? (
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload the page
            </Button>
          ) : (
            <Button variant="primary" onClick={retry}>
              Try again
            </Button>
          )}
          <Link render={<RouterLink to="/markets" />}>Go to Markets</Link>
        </>
      }
    >
      {stale ? null : (
        <details className={styles.details}>
          <summary>Technical detail</summary>
          <pre className={styles.message}>{errorDetail(error)}</pre>
        </details>
      )}
    </StatusPage>
  )
}
