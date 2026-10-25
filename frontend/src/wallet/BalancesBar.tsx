import { formatDisplay } from '../options/format'
import type { TokenBalance } from '../stellar/tokens'

export interface BalanceToken {
  contractId: string
  code: string
  decimals: number
}

const NOTE: Partial<Record<TokenBalance['status'], string>> = {
  mock: 'mock',
  unfunded: 'account not funded',
  'no-trustline': 'no trustline',
  'not-authorized': 'not authorized',
  error: 'unavailable',
}

export function BalancesBar({
  tokens,
  balances,
  loading,
  onRefresh,
}: {
  tokens: BalanceToken[]
  balances: Record<string, TokenBalance>
  loading?: boolean
  onRefresh?: () => void
}) {
  return (
    <div className="balances-bar" aria-busy={loading}>
      {tokens.map((t) => {
        const b = balances[t.contractId]
        const note = b ? NOTE[b.status] : undefined
        return (
          <span key={t.contractId} className="balance" title={b?.error}>
            <strong>{t.code}</strong> {b?.balance != null ? formatDisplay(b.balance, t.decimals) : '–'}
            {note ? <em> ({note})</em> : null}
          </span>
        )
      })}
      {onRefresh ? (
        <button type="button" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      ) : null}
    </div>
  )
}
