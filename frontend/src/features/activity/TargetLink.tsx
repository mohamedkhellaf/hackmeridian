import { Link as RouterLink } from '@tanstack/react-router'
import { Link } from '../../ui'
import type { ActivityTarget } from './model'

/** The link from a transaction to what it concerns, as a router link. */
export function TargetLink({ target }: { target: ActivityTarget }) {
  switch (target.kind) {
    case 'position':
      return <Link render={<RouterLink to="/portfolio/$id" params={{ id: target.id }} />}>{target.label}</Link>
    case 'offers':
      return <Link render={<RouterLink to="/portfolio" search={{ tab: 'orders' }} />}>{target.label}</Link>
    case 'written':
      return <Link render={<RouterLink to="/portfolio" search={{ tab: 'written' }} />}>{target.label}</Link>
    case 'requests':
      return <Link render={<RouterLink to="/requests" search={{ mine: '1' }} />}>{target.label}</Link>
    case 'margin':
      return <Link render={<RouterLink to="/margin" />}>{target.label}</Link>
    case 'issuer':
      return <Link render={<RouterLink to="/issuer" />}>{target.label}</Link>
  }
}
