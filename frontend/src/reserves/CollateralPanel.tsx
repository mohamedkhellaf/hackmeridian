import type { CollateralHealth, CollateralLine, TokenInfo } from '../options/types'
import { AssetBadge, Card, Mono, StrataBar, Tag } from '../ui'
import { backingFor, formatFixed, formatTenths, lineTotal, stellarExpertContract } from './reserves'
import { ShortfallBanner } from './ShortfallWarning'
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
  const fmtN = (n: number | bigint) => fmt(BigInt(n))
  const surplus = b.held !== null && b.held > b.owed ? b.held - b.owed : 0n
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

      <div className="rs-figs">
        <div className="rs-fig">
          <span className="ui-num rs-fig-v" data-testid="owed">
            {fmt(b.owed)}
          </span>
          <span className="ui-label">Owed · open_collateral</span>
        </div>
        <div className="rs-fig">
          <span className="ui-num rs-fig-v">{b.held === null ? 'n/a' : fmt(b.held)}</span>
          <span className="ui-label">Held · balance(contract)</span>
        </div>
        <div className="rs-fig">
          <span className="ui-num rs-fig-v">{b.status === 'short' ? `-${fmt(b.shortfall)}` : b.held === null ? 'n/a' : fmt(surplus)}</span>
          <span className="ui-label">{b.status === 'short' ? 'Shortfall' : 'Surplus'}</span>
        </div>
      </div>

      {b.held !== null ? (
        <StrataBar
          owed={b.owed}
          held={b.held}
          unit={t.code}
          format={fmtN}
          layers={{ offered: line.offered, active: line.active, awaiting: line.unclaimed, reclaim: line.pendingReclaim }}
        />
      ) : (
        <p className="rs-empty">The held balance could not be read, so the backing cannot be drawn.</p>
      )}

      <div className="rs-rows">
        <Row label="Open offers" value={fmt(line.offered)} />
        <Row label="Sold options" value={fmt(line.active)} />
        <Row label="Unclaimed proceeds" value={fmt(line.unclaimed)} />
        <Row label="Expired, to reclaim" value={fmt(line.pendingReclaim)} />
        <Row label="Total owed" value={fmt(lineTotal(line))} strong />
        {b.tenthsPct !== null && <Row label="Held / owed" value={formatTenths(b.tenthsPct)} />}
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
    <ShortfallBanner token={token}>
      {real && (
        <>
          {' '}
          <a href={stellarExpertContract(token.contractId)} target="_blank" rel="noreferrer">
            {token.code} asset contract ↗
          </a>
        </>
      )}
    </ShortfallBanner>
  )
}
