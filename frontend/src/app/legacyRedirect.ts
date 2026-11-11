// Side effect on import: rewrites an old hash link to its new path before the router reads the location.
// main.tsx imports this file BEFORE the router; module evaluation follows import order.
import { legacyHashTarget } from './legacyHash'

if (typeof window !== 'undefined' && window.location.pathname === '/') {
  const target = legacyHashTarget(window.location.hash, import.meta.env.VITE_ENABLE_PRO === '1')
  // The query string is kept: the test wallet reads `?as=` from it.
  if (target) window.history.replaceState(null, '', target + window.location.search)
}
