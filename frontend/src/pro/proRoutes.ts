export type ProRoute = 'margin' | 'trade' | 'positions' | 'liquidations' | 'vault'

export const PRO_NAV: { route: ProRoute; label: string }[] = [
  { route: 'margin', label: 'Margin' },
  { route: 'trade', label: 'Trade' },
  { route: 'positions', label: 'Positions' },
  { route: 'liquidations', label: 'Liquidations' },
  { route: 'vault', label: 'Vault' },
]

export const proHref = (r: ProRoute) => `#/pro/${r}`

/** `#/pro/trade` -> trade. `#/pro` and unknown sub-routes fall back to margin. */
export function parseProRoute(hash: string): ProRoute {
  const parts = hash.replace(/^#\/?/, '').split(/[/?]/)
  const sub = parts[0] === 'pro' ? parts[1] : undefined
  return PRO_NAV.some((n) => n.route === sub) ? (sub as ProRoute) : 'margin'
}
