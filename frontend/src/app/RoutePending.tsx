import { useMatches } from '@tanstack/react-router'
import { StatusPage } from './StatusPage'

/** Shown when a page's code takes longer than a moment to arrive. */
export function RoutePending() {
  const bare = useMatches({ select: (matches) => matches.some((match) => match.staticData.bare === true) })
  return <StatusPage busy frame={bare ? 'bare' : 'none'} />
}
