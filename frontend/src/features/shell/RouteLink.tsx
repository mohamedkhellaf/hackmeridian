import { Link as RouterLink } from '@tanstack/react-router'
import type { AnchorHTMLAttributes, Ref } from 'react'
import type { AppPath } from './nav'

export type RouteLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  /** A top-level destination of the shell, or `/` for the landing page. */
  to: AppPath | '/'
  ref?: Ref<HTMLAnchorElement>
}

/**
 * The router's link for the shell's own destinations. The router marks the link of the current section with
 * `aria-current="page"` (a section stays current on its sub-pages: `/markets/bond` keeps Markets current); the
 * landing link only matches `/` itself. It is also what the ui kit's `Link`, `ButtonLink` and `MenuLinkItem`
 * take in their `render` prop.
 */
export function RouteLink({ to, ...rest }: RouteLinkProps) {
  return <RouterLink to={to} activeOptions={{ exact: to === '/' }} {...rest} />
}
