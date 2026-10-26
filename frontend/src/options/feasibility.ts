import type { BalanceStatus } from '../stellar/tokens'
import { formatDisplay } from './format'
import type { OptionOffer } from './types'

// Pure checks for the buy-dialog warning and the market "Check terms" tag. The contract cannot judge
// economics: "trap" offers (a put on more than anyone holds, a call whose strike nobody can pay, an absurd
// premium) are valid on chain, can be bought, and can never be exercised. No pricing model here, only
// arithmetic on the terms and on the buyer's balances.

export interface BalanceView {
  status: BalanceStatus
  balance: bigint | null
}

export type Feasibility = { level: 'ok' | 'unknown' } | { level: 'warn'; message: string }

type Terms = Pick<OptionOffer, 'kind' | 'underlying' | 'quote' | 'underlyingQty' | 'totalStrike'>

/**
 * Could the buyer exercise this option today? PUT: the holder delivers `underlyingQty` of the underlying.
 * CALL: the holder pays `totalStrike` of the quote. Warn-only: balances can change before expiry.
 * `unknown` when balances are unavailable (not connected, mock, RPC error).
 */
export function exerciseFeasibility(o: Terms, underlyingBal: BalanceView | undefined, quoteBal: BalanceView | undefined): Feasibility {
  const put = o.kind === 'put'
  const token = put ? o.underlying : o.quote
  const need = put ? o.underlyingQty : o.totalStrike
  const bal = put ? underlyingBal : quoteBal
  if (!bal) return { level: 'unknown' }
  const amount = `${formatDisplay(need, token.decimals)} ${token.code}`
  const what = put ? `deliver ${amount}` : `pay ${amount}`
  if (bal.status === 'no-trustline')
    return { level: 'warn', message: `To exercise you would need to ${what}, but your account has no ${token.code} trustline.` }
  if (bal.status === 'not-authorized')
    return { level: 'warn', message: `To exercise you would need to ${what}, but the ${token.code} issuer has not authorized your account.` }
  if (bal.status !== 'ok' || bal.balance === null) return { level: 'unknown' }
  if (bal.balance < need)
    return {
      level: 'warn',
      message: `To exercise you would need to ${what}, but you hold ${formatDisplay(bal.balance, token.decimals)} ${token.code}. Unless you acquire the difference before expiry, this option cannot be exercised.`,
    }
  return { level: 'ok' }
}

/** True only when a real balance reading shows the buyer cannot pay the premium. */
export function premiumUnaffordable(o: Pick<OptionOffer, 'totalPremium'>, quoteBal: BalanceView | undefined): boolean {
  return !!quoteBal && quoteBal.status === 'ok' && quoteBal.balance !== null && quoteBal.balance < o.totalPremium
}

/**
 * Neutral market flag ("Check terms"). A put pays its holder at most the total strike, so a premium at or above
 * it can never be recovered; the same bound is applied to calls as a sanity check. Not a valuation.
 */
export function implausibleTerms(o: Pick<OptionOffer, 'totalPremium' | 'totalStrike' | 'underlyingQty'>): boolean {
  return o.totalPremium >= o.totalStrike || o.underlyingQty <= 0n || o.totalStrike <= 0n
}
