import type { ErrorComponentProps } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from '../ui'
import { errorDetail, isChunkLoadError } from './routeErrors'
import { StatusPage } from './StatusPage'

/**
 * The error page of the root route: what is shown when the frame of the app itself fails (the shell, or the
 * layout around it), so there is no top bar, tab bar or footer to rely on. It has its own `main` and gutters,
 * the logo as a plain link home, and one action that does not need the app: reload. A page that fails inside
 * a working shell has its own boundary (RouteError) and never reaches this one.
 */
export function RootError({ error }: ErrorComponentProps) {
  const stale = isChunkLoadError(error)

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <StatusPage
      frame="bare"
      brand
      title="StellSec could not start"
      description={
        stale
          ? 'The code of the app did not arrive. The connection may have dropped, or a newer version was published. Reloading fetches the current version.'
          : 'Something failed while starting the app. If you had just signed a transaction, its state is listed in Activity once the app loads.'
      }
      detail={stale ? undefined : errorDetail(error)}
      actions={
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      }
    />
  )
}
