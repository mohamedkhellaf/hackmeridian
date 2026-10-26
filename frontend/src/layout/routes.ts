import { useCallback, useEffect, useState } from 'react'

export type Route = 'markets' | 'protect' | 'write' | 'portfolio' | 'reserves' | 'issuer' | 'pro'

/** Strata Pro is mounted only when the build sets VITE_ENABLE_PRO=1. */
export const PRO_ENABLED = import.meta.env.VITE_ENABLE_PRO === '1'

export interface NavItem {
  route: Route
  label: string
}

/** Sidebar and phone tab bar, same routes. */
export const NAV: NavItem[] = [
  { route: 'markets', label: 'Markets' },
  { route: 'protect', label: 'Protect' },
  { route: 'write', label: 'Write' },
  { route: 'portfolio', label: 'Positions' },
  { route: 'reserves', label: 'Collateral' },
  { route: 'issuer', label: 'Issuer' },
  ...(PRO_ENABLED ? [{ route: 'pro' as const, label: 'Pro' }] : []),
]

const ROUTES: Route[] = NAV.map((n) => n.route)

export const hrefFor = (r: Route) => `#/${r}`

/** Parses `#/portfolio` (or `#portfolio`). Anything unknown falls back to markets. */
export function parseRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0]
  return (ROUTES as string[]).includes(name) ? (name as Route) : 'markets'
}

/** Hash router without dependencies. `navigate` changes the hash; the hook re-renders on hashchange. */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const navigate = useCallback((r: Route) => {
    window.location.hash = hrefFor(r)
  }, [])
  return [route, navigate]
}
