import { formatDisplay } from '../options/format'
import type { TokenBalance } from '../stellar/tokens'

export interface BalanceToken {
  contractId: string
  code: string
  decimals: number
}

// Why a balance is unavailable, shown in place of the amount.
const REASON: Partial<Record<TokenBalance['status'], string>> = {
  mock: 'Mock token',
  unfunded: 'Account not funded',
  'no-trustline': 'No trustline',
  'not-authorized': 'Not authorized by the issuer',
  error: 'Unavailable',
}

/** Token balances as `code amount` rows, for the wallet menu. Only render it in real mode. */
export function BalancesBar({ tokens, balances, loading }: { tokens: BalanceToken[]; balances: Record<string, TokenBalance>; loading?: boolean }) {
  return (
    <div className="balances-bar" aria-busy={loading}>
      {tokens.map((t) => {
        const b = balances[t.contractId]
        const bal = b?.balance
        const reason = (b && REASON[b.status]) ?? (loading ? 'Loading' : 'Unavailable')
        return (
          <div key={t.contractId} className="balance" title={bal == null ? b?.error : undefined}>
            <span className="balance-code">{t.code}</span>
            <span className={bal != null ? 'balance-amount' : 'balance-amount ui-label'}>{bal != null ? formatDisplay(bal, t.decimals) : reason}</span>
          </div>
        )
      })}
    </div>
  )
}
