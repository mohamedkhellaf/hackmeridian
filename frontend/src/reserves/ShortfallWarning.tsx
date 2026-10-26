import type { ReactNode } from 'react'
import type { TokenInfo } from '../options/types'
import { Banner } from '../ui'

// Clawback-shortfall disclosure (PRODUCT_SPEC D6), one sentence. Payouts are first come, first served until the pooled
// balance runs out; never say that every exercise fails.
const rest = ': payouts are first come, first served until the balance runs out, with no refund, and new trades are refused.'

/** One-line danger banner for a single short token (Reserves, Buy dialog, exercise confirmation). */
export function ShortfallBanner({ token, children }: { token: TokenInfo; children?: ReactNode }) {
  return (
    <Banner tone="danger">
      Clawback shortfall on {token.code}
      {rest}
      {children}
    </Banner>
  )
}

/** The same line for one or more tokens, linking to Reserves (table rows, Markets). */
export function ShortfallNotice({ tokens, className }: { tokens: TokenInfo[]; className?: string }) {
  if (tokens.length === 0) return null
  return (
    <Banner tone="danger" className={className}>
      <a href="#/reserves">Clawback shortfall</a> on {tokens.map((t) => t.code).join(', ')}
      {rest}
    </Banner>
  )
}
