import { Link as RouterLink } from '@tanstack/react-router'
import { ButtonLink, Link } from '../ui'
import { StatusPage } from './StatusPage'

/** An address that matches no route. Rendered inside the app shell; the address itself is never echoed. */
export function NotFoundPage() {
  return (
    <StatusPage
      title="Page not found"
      description="This address does not match a page of the app. The link may be old, or mistyped."
      actions={
        <>
          <ButtonLink variant="primary" render={<RouterLink to="/markets" />}>
            Go to Markets
          </ButtonLink>
          <Link render={<RouterLink to="/" />}>StellSec home</Link>
        </>
      }
    />
  )
}
