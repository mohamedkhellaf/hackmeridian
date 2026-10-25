import { CollateralPanel } from '../reserves/CollateralPanel'
import { useReadAt } from '../reserves/useReadAt'
import { stellarExpertContract } from '../reserves/reserves'
import type { CollateralHealth, CollateralLine } from '../options/types'
import { Card, Mono, PageHeader, StatusDot } from '../ui'

export interface ReservesViewProps {
  collateral: CollateralLine[]
  health: CollateralHealth[]
  contractId?: string
}

export function ReservesView({ collateral, health, contractId }: ReservesViewProps) {
  const { readAt, ledger } = useReadAt(collateral, health, !!contractId)
  const tokens = collateral.map((l) => l.token)
  return (
    <>
      <PageHeader
        title="Reserves"
        subtitle="What the options contract owes, compared with what it actually holds. Both numbers are read from the chain."
        actions={
          contractId ? (
            <span className="rs-fresh">
              <StatusDot tone="ok" />
              Read at {readAt.toLocaleTimeString('en-GB')}
              {ledger !== null && ` · ledger ${ledger.toLocaleString('en-US')}`}
            </span>
          ) : (
            <span className="rs-fresh">
              <StatusDot tone="warn" />
              Mock data, not read from a chain
            </span>
          )
        }
      />
      <div className="rs-page">
        <CollateralPanel lines={collateral} health={health} contractId={contractId} />
        <Card title="How to verify this yourself">
          <p className="rs-verify">
            “Owed” is the contract's <Mono>open_collateral(token)</Mono>. “Held” is the token's <Mono>balance(contract)</Mono> on its Stellar
            Asset Contract. Both are public reads; nothing here is computed off-chain.
          </p>
          {contractId ? (
            <div className="rs-links">
              <a href={stellarExpertContract(contractId)} target="_blank" rel="noreferrer">
                Options contract ↗
              </a>
              {tokens.map((t) => (
                <a key={t.contractId} href={stellarExpertContract(t.contractId)} target="_blank" rel="noreferrer">
                  {t.code} asset contract ↗
                </a>
              ))}
            </div>
          ) : (
            <p className="rs-verify rs-verify--muted">No options contract is connected, so there is nothing on-chain to verify yet. Figures above are mock data.</p>
          )}
        </Card>
      </div>
    </>
  )
}
