import { useCallback, useEffect, useState } from 'react'
import type { IconName } from '../ui'

export type Route = 'markets' | 'write' | 'portfolio' | 'reserves' | 'issuer'

export interface NavItem {
  route: Route
  label: string
  icon: IconName
}

export const NAV_TRADE: NavItem[] = [
  { route: 'markets', label: 'Markets', icon: 'markets' },
  { route: 'write', label: 'Write', icon: 'write' },
  { route: 'portfolio', label: 'Portfolio', icon: 'portfolio' },
]
export const NAV_TRANSPARENCY: NavItem[] = [
  { route: 'reserves', label: 'Reserves', icon: 'reserves' },
  { route: 'issuer', label: 'Issuer', icon: 'issuer' },
]
/** Bottom tab bar on phones. Issuer is reached from the top bar. */
export const NAV_TABS: NavItem[] = [...NAV_TRADE, NAV_TRANSPARENCY[0]]

const ROUTES: Route[] = ['markets', 'write', 'portfolio', 'reserves', 'issuer']

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
