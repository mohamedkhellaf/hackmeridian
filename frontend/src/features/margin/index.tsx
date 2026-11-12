// The Margin section (experimental). The router lazy-loads `MarginPage` for /margin, /margin/trade,
// /margin/positions, /margin/liquidations and /margin/vault, only in a build with VITE_ENABLE_PRO=1.
export { MarginPage } from './MarginPage'
export type { MarginScreen } from './screen'
