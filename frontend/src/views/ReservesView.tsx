import { useReadAt } from '../reserves/useReadAt'
import { backingFor, formatFixed, stellarExpertContract } from '../reserves/reserves'
import { ShortfallBanner } from '../reserves/ShortfallWarning'
import type { CollateralHealth, CollateralLine } from '../options/types'
import { Button, PageHeader, shortContractId } from '../ui'
import '../reserves/reserves.css'

export interface ReservesViewProps {
  collateral: CollateralLine[]
  health: CollateralHealth[]
  contractId?: string
  /** Re-read everything. Defaults to reloading the page (the route is kept in the URL hash). */
  onRefresh?: () => void
}

// Owed is the contract's open_collateral(token); held is the token's balance(contract). Both are public reads.
export function ReservesView({ collateral, health, contractId, onRefresh }: ReservesViewProps) {
  const { readAt, ledger } = useReadAt(collateral, health, !!contractId)
  const rows = collateral.map((l) => ({ token: l.token, b: backingFor(l, health.find((h) => h.token.contractId === l.token.contractId)) }))
  const assetLinks = collateral.map((l) => l.token).filter((t) => !t.contractId.startsWith('C_MOCK_'))

  const readLine = `Read at ${readAt.toLocaleTimeString('en-GB')}${ledger !== null ? `, ledger ${ledger.toLocaleString('en-US')}` : ''}`

  return (
    <div className="rs">
      <PageHeader
        title="Locked reserves"
        actions={
          contractId ? (
            <>
              <span className="rs-read">{readLine}</span>
              <Button size="sm" variant="ghost" onClick={onRefresh ?? (() => window.location.reload())}>
                Refresh
              </Button>
            </>
          ) : undefined
        }
      />

      {rows
        .filter((r) => r.b.status === 'short')
        .map((r) => (
          <ShortfallBanner key={r.token.contractId} token={r.token} />
        ))}

      {rows.length === 0 ? (
        <p className="rs-empty">No reserves locked.</p>
      ) : (
        <div className="ui-table-wrap rs-table">
          <table className="ui-table" aria-label="Locked reserves by token">
            <thead>
              <tr>
                <th>Token</th>
                <th className="num" title="Reserves the contract must hold for open options">
                  Locked
                </th>
                <th className="num" title="Balance the contract actually holds">
                  Held
                </th>
                <th className="num">Difference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ token: t, b }) => {
                const fmt = (v: bigint) => formatFixed(v, t.decimals)
                return (
                  <tr key={t.contractId}>
                    <td>{t.code}</td>
                    <td className="num" data-testid="owed">
                      {fmt(b.owed)}
                    </td>
                    <td className="num">{b.held === null ? 'Unavailable' : fmt(b.held)}</td>
                    <td className="num">
                      {b.held === null ? (
                        ''
                      ) : b.status === 'short' ? (
                        <span className="rs-short">−{fmt(b.shortfall)} Short</span>
                      ) : b.held > b.owed ? (
                        `+${fmt(b.held - b.owed)}`
                      ) : (
                        fmt(0n)
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {contractId && (
        <p className="rs-links">
          <span>
            Options contract{' '}
            <a className="ui-mono" href={stellarExpertContract(contractId)} target="_blank" rel="noreferrer">
              {shortContractId(contractId)}
            </a>
          </span>
          {assetLinks.map((t) => (
            <span key={t.contractId}>
              {t.code} asset contract{' '}
              <a className="ui-mono" href={stellarExpertContract(t.contractId)} target="_blank" rel="noreferrer">
                {shortContractId(t.contractId)}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
