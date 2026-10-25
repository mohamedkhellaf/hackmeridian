import { formatAmount } from '../options/format'
import type { CollateralHealth, CollateralLine } from '../options/types'

// Proof that every option is fully backed: what the contract holds, per token.
export function CollateralPanel({ lines, health = [], contractId }: { lines: CollateralLine[]; health?: CollateralHealth[]; contractId?: string }) {
  return (
    <section className="card">
      <h2>Collateral held by the contract</h2>
      <p className="hint">
        Every open offer and sold option is backed 1:1. Puts lock the full strike in cash; calls lock the underlying.
        {contractId ? (
          <>
            {' '}
            <a href={`https://stellar.expert/explorer/testnet/contract/${contractId}`} target="_blank" rel="noreferrer">
              Check balances on-chain
            </a>
          </>
        ) : null}
      </p>
      {lines.length === 0 ? (
        <p className="empty">No collateral locked.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Open offers</th>
                <th>Sold options</th>
                <th>Expired, to reclaim</th>
                <th>Unclaimed proceeds</th>
                <th>Total held</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.token.contractId}>
                  <td>{l.token.code}</td>
                  <td>{formatAmount(l.offered, l.token.decimals)}</td>
                  <td>{formatAmount(l.active, l.token.decimals)}</td>
                  <td>{formatAmount(l.pendingReclaim, l.token.decimals)}</td>
                  <td>{formatAmount(l.unclaimed, l.token.decimals)}</td>
                  <td>
                    <strong>{formatAmount(l.offered + l.active + l.pendingReclaim + l.unclaimed, l.token.decimals)}</strong>
                  </td>
                  <td>
                    <HealthCell h={health.find((x) => x.token.contractId === l.token.contractId)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function HealthCell({ h }: { h?: CollateralHealth }) {
  if (!h) return <span className="hint">n/a</span>
  if (h.held >= h.reserved) return <span className="health-ok">OK</span>
  return (
    <span className="health-bad" role="alert">
      Contract holds less than it owes — issuer clawback? ({formatAmount(h.held, h.token.decimals)} of {formatAmount(h.reserved, h.token.decimals)})
    </span>
  )
}
