import type { CollateralHealth, CollateralLine, TokenInfo } from '../options/types'
import { AssetBadge, Banner, Card, Mono, StatusDot, Tag } from '../ui'
import { backingFor, formatFixed, formatTenths, lineTotal, stellarExpertContract } from './reserves'
import './reserves.css'

// Proof that every option is fully backed: what the contract owes vs what it holds, per token.
export function CollateralPanel({ lines, health = [], contractId }: { lines: CollateralLine[]; health?: CollateralHealth[]; contractId?: string }) {
  if (lines.length === 0) {
    return (
      <Card>
        <p className="rs-empty">No collateral locked.</p>
      </Card>
    )
  }
  return (
    <div className="rs-grid">
      {lines.map((l) => (
        <TokenCard key={l.token.contractId} line={l} health={health.find((x) => x.token.contractId === l.token.contractId)} real={!!contractId} />
      ))}
    </div>
  )
}

function TokenCard({ line, health, real }: { line: CollateralLine; health?: CollateralHealth; real: boolean }) {
  const t = line.token
  const b = backingFor(line, health)
  const fmt = (v: bigint) => formatFixed(v, t.decimals)
  return (
    <section className={b.status === 'short' ? 'rs-card rs-card--short' : 'rs-card'} aria-label={`${t.code} reserves`}>
      <div className="rs-head">
        <AssetBadge code={t.code} />
        <div className="rs-title">
          <span className="rs-code">{t.code}</span>
          <Mono className="rs-sub">{t.contractId.length > 12 ? `${t.contractId.slice(0, 4)}…${t.contractId.slice(-4)}` : t.contractId}</Mono>
        </div>
        {b.status === 'short' && <Tag tone="warn">Short {fmt(b.shortfall)}</Tag>}
        {b.status === 'backed' && <Tag tone="ok">Fully backed</Tag>}
        {b.status === 'unknown' && <Tag tone="neutral">Balance unavailable</Tag>}
      </div>

      <div className="rs-ratio">
        <div className="rs-ratio-line">
          <span>Held {b.held === null ? 'n/a' : fmt(b.held)}</span>
          <span>
            Owed <span data-testid="owed">{fmt(b.owed)}</span>
          </span>
        </div>
        <div className="rs-bar" role="img" aria-label={`${t.code} backing ${b.tenthsPct === null ? 'nothing owed' : formatTenths(b.tenthsPct)}`}>
          <div className={`rs-bar-fill rs-bar-fill--${b.status === 'short' ? 'warn' : 'ok'}`} style={{ width: `${b.fill}%` }} />
        </div>
        {b.tenthsPct !== null ? (
          <span className="rs-pct">{formatTenths(b.tenthsPct)}</span>
        ) : (
          <span className="rs-pct rs-pct--idle">
            {b.status === 'unknown' ? (
              'n/a'
            ) : (
              <>
                <StatusDot tone="ok" /> Nothing owed
              </>
            )}
          </span>
        )}
      </div>

      <div className="rs-rows">
        <Row label="Open offers" value={fmt(line.offered)} />
        <Row label="Sold options" value={fmt(line.active)} />
        <Row label="Unclaimed proceeds" value={fmt(line.unclaimed)} />
        <Row label="Expired, to reclaim" value={fmt(line.pendingReclaim)} />
        <Row label="Total owed" value={fmt(lineTotal(line))} strong />
      </div>

      {b.status === 'short' && <ShortfallNote token={t} real={real} />}
    </section>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'rs-row rs-row--strong' : 'rs-row'}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function ShortfallNote({ token, real }: { token: TokenInfo; real: boolean }) {
  return (
    <Banner tone="warn" title={`The contract holds less ${token.code} than it owes. `}>
      This happens when the issuer claws back tokens from the contract. Affected exercises and claims will fail until the balance is restored.
      {real && (
        <>
          {' '}
          <a href={stellarExpertContract(token.contractId)} target="_blank" rel="noreferrer">
            {token.code} asset contract ↗
          </a>
        </>
      )}
    </Banner>
  )
}
