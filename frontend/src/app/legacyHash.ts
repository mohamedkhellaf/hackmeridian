/**
 * The app before the revamp used hash routes (`#/markets`, `#/pro/trade`). Links to them are still out there
 * (the README, the submission, bookmarks), so they are mapped to the new paths once, before the router starts.
 */

/** Old Margin sub-routes (code name `pro`) to the new screens. `#/pro` and `#/pro/margin` were the account. */
const PRO_SCREENS: Record<string, string> = {
  margin: '/margin',
  trade: '/margin/trade',
  positions: '/margin/positions',
  liquidations: '/margin/liquidations',
  vault: '/margin/vault',
}

/** Old top-level routes. `#/write` and `#/protect` were retired into Markets before the revamp. */
const ROUTES: Record<string, string> = {
  markets: '/markets',
  write: '/markets',
  protect: '/markets',
  portfolio: '/portfolio',
  reserves: '/reserves',
  issuer: '/issuer',
}

/**
 * The new path for an old hash link, or null when the hash is not one (an in-page anchor such as `#limits`
 * must keep working). Only hashes that start with `#/` are treated as routes.
 */
export function legacyHashTarget(hash: string, proEnabled: boolean): string | null {
  if (!hash.startsWith('#/')) return null
  const parts = hash.slice(2).split(/[/?#]/)
  const name = parts[0]
  if (name === 'pro') return proEnabled ? (PRO_SCREENS[parts[1] ?? ''] ?? '/margin') : '/markets'
  // An unknown old route went to Markets in the old app; `#/` alone was Markets too.
  return ROUTES[name] ?? '/markets'
}
