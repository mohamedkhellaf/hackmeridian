import type { ReactNode } from 'react'
import type { TokenInfo } from '../options/types'
import { Banner } from '../ui'
import './reserves.css'

// Shared clawback-shortfall disclosure (PRODUCT_SPEC D6). Payouts are first come, first served until the pooled balance
// runs out; never say that every exercise fails.

export function ShortfallBody({ code }: { code: string }) {
  return (
    <>
      The issuer clawed back {code} from the escrow. Payouts on {code} options are served first come, first served until the balance runs out, so the last
      holders may not be paid. New offers, purchases and transfers on {code} are blocked until the balance is restored. There is no refund.
    </>
  )
}

/** Full banner (Reserves, Buy dialog, exercise confirmation). */
export function ShortfallBanner({ token, children }: { token: TokenInfo; children?: ReactNode }) {
  return (
    <Banner tone="warn" title={`The contract holds less ${token.code} than it owes. `}>
      <ShortfallBody code={token.code} />
      {children}
    </Banner>
  )
}

/** Short form for lists: one line plus a link to Reserves. */
export function ShortfallNotice({ tokens, className }: { tokens: TokenInfo[]; className?: string }) {
  if (tokens.length === 0) return null
  const codes = tokens.map((t) => t.code).join(', ')
  return (
    <p className={['rs-short-note', className].filter(Boolean).join(' ')} role="note">
      <b>Reserve shortfall on {codes}.</b> The contract holds less than it owes. Payouts are first come, first served until the balance runs out; there is no
      refund. <a href="#/reserves">See Reserves</a>
    </p>
  )
}
