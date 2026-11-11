import { useMatches } from '@tanstack/react-router'
import { StatusPage } from './StatusPage'

/** Shown when a page's code takes longer than a moment to arrive: a title, a description and table rows. */
export function RoutePending() {
  const bare = useMatches({ select: (matches) => matches.some((match) => match.staticData.bare === true) })
  return <StatusPage busy="page" frame={bare ? 'bare' : 'none'} />
}

/** The same moment for a page that reads as a document (Learn): a title and lines of text, no table. */
export function DocumentPending() {
  return <StatusPage busy="document" />
}
