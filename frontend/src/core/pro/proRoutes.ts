// The five Margin screens and their paths. The section is mounted under /margin only when PRO_ENABLED.

export type ProRoute = 'margin' | 'trade' | 'positions' | 'liquidations' | 'vault'

export const PRO_NAV: { route: ProRoute; label: string; path: string }[] = [
  { route: 'margin', label: 'Account', path: '/margin' },
  { route: 'trade', label: 'Trade', path: '/margin/trade' },
  { route: 'positions', label: 'Positions', path: '/margin/positions' },
  { route: 'liquidations', label: 'Liquidations', path: '/margin/liquidations' },
  { route: 'vault', label: 'Vault', path: '/margin/vault' },
]

/** Path of a Margin screen: `/margin`, `/margin/trade`... */
export const proHref = (r: ProRoute): string => (r === 'margin' ? '/margin' : `/margin/${r}`)

/**
 * Screen named by an old hash link. `#/pro/trade` -> trade; `#/pro` and unknown sub-routes fall back to the
 * account screen. Used by the redirect of old `#/pro/*` links: `proHref(parseProRoute(location.hash))`.
 */
export function parseProRoute(hash: string): ProRoute {
  const parts = hash.replace(/^#\/?/, '').split(/[/?]/)
  const sub = parts[0] === 'pro' ? parts[1] : undefined
  return PRO_NAV.some((n) => n.route === sub) ? (sub as ProRoute) : 'margin'
}
