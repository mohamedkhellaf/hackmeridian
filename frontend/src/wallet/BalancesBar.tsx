import { formatDisplay } from '../options/format'
import type { TokenBalance } from '../stellar/tokens'
import { Icon } from '../ui'

export interface BalanceToken {
  contractId: string
  code: string
  decimals: number
}

// Why a balance is unavailable; shown as a tooltip next to "—" instead of inline text.
const REASON: Partial<Record<TokenBalance['status'], string>> = {
  mock: 'Mock token: no on-chain balance',
  unfunded: 'Account not funded on Testnet',
  'no-trustline': 'No trustline for this asset',
  'not-authorized': 'Not authorized by the issuer',
  error: 'Balance unavailable',
}

/**
 * Token balances. `inline` is the desktop top-bar group (balances + small refresh icon);
 * `list` is the stacked variant used inside the wallet menu (the menu has its own Refresh button).
 * Only render it in real mode.
 */
export function BalancesBar({
  tokens,
  balances,
  loading,
  onRefresh,
  variant = 'inline',
}: {
  tokens: BalanceToken[]
  balances: Record<string, TokenBalance>
  loading?: boolean
  onRefresh?: () => void
  variant?: 'inline' | 'list'
}) {
  return (
    <div className={`balances-bar balances-bar--${variant}`} aria-busy={loading}>
      {tokens.map((t) => {
        const b = balances[t.contractId]
        const bal = b?.balance
        const tip = bal != null ? undefined : ((b && (b.error || REASON[b.status])) ?? (loading ? 'Loading…' : 'Balance unavailable'))
        return (
          <span key={t.contractId} className="balance" title={tip}>
            <strong>{t.code}</strong> {bal != null ? formatDisplay(bal, t.decimals) : <span className="balance-na">—</span>}
          </span>
        )
      })}
      {onRefresh && variant === 'inline' ? (
        <button type="button" className="balances-refresh" aria-label="Refresh balances" title="Refresh balances" onClick={onRefresh} disabled={loading}>
          <Icon name="refresh" size={14} />
        </button>
      ) : null}
    </div>
  )
}
