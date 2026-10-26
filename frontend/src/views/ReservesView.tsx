import { CollateralPanel } from '../reserves/CollateralPanel'
import { useReadAt } from '../reserves/useReadAt'
import { stellarExpertContract } from '../reserves/reserves'
import type { CollateralHealth, CollateralLine } from '../options/types'
import { Card, Mono, PageHero, StatusDot } from '../ui'
import { backingFor } from '../reserves/reserves'

export interface ReservesViewProps {
  collateral: CollateralLine[]
  health: CollateralHealth[]
  contractId?: string
}

export function ReservesView({ collateral, health, contractId }: ReservesViewProps) {
  const { readAt, ledger } = useReadAt(collateral, health, !!contractId)
  const tokens = collateral.map((l) => l.token)
  const backings = collateral.map((l) => backingFor(l, health.find((h) => h.token.contractId === l.token.contractId)))
  const shortCodes = collateral.filter((_, i) => backings[i].status === 'short').map((l) => l.token.code)
  const unknown = backings.some((b) => b.status === 'unknown')
  let title = 'Owed equals held, on every token.'
  let tone: 'ok' | 'warn' | 'neutral' = 'ok'
  let caption = 'Owed equals held'
  if (collateral.length === 0) {
    title = 'Nothing is owed yet.'
    tone = 'neutral'
    caption = 'No collateral locked'
  } else if (shortCodes.length > 0) {
    title = `Held is below owed on ${shortCodes.join(', ')}.`
    tone = 'warn'
    caption = 'Shortfall shown below'
  } else if (unknown) {
    title = 'Owed is known; held could not be read.'
    tone = 'neutral'
    caption = 'Held balance unavailable'
  } else if (backings.some((b) => b.held !== null && b.held > b.owed)) {
    title = 'Every token is held in full.'
    caption = 'Held covers owed'
  }
  return (
    <>
      <PageHero
        eyebrow="Proof of collateral"
        title={title}
        lede="“Owed” is what the contract has promised across all open positions. “Held” is its actual balance on each asset contract. Both are public reads, shown side by side."
        sediment={{
          seed: 'reserves',
          captionLabel: contractId ? 'Testnet' : 'Mock data',
          caption: (
            <span className="rs-fresh">
              <StatusDot tone={tone} />
              {caption}
            </span>
          ),
        }}
        stats={[{ label: 'Tokens', value: String(collateral.length) }]}
      />
      <p className="rs-fresh rs-readline">
        {contractId ? (
          <>
            <StatusDot tone="ok" />
            <span>
              Read at <Mono>{readAt.toLocaleTimeString('en-GB')}</Mono>
              {ledger !== null && (
                <>
                  {' '}
                  · ledger <Mono>{ledger.toLocaleString('en-US')}</Mono>
                </>
              )}
            </span>
          </>
        ) : (
          <>
            <StatusDot tone="warn" />
            Mock data, not read from a chain
          </>
        )}
      </p>
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
              {tokens.filter((t) => !t.contractId.startsWith('C_MOCK_')).map((t) => (
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
