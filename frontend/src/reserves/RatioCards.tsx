import type { CollateralHealth, CollateralLine } from '../options/types'
import { AssetBadge, Mono, Tag } from '../ui'
import { backingFor, formatFixed, formatTenths } from './reserves'
import { FnRef } from './Footnotes'
import './reserves.css'

// Headline attestation: held / owed per token, one card each.
export function RatioCards({ lines, health = [] }: { lines: CollateralLine[]; health?: CollateralHealth[] }) {
  if (lines.length === 0) return null
  return (
    <div className="rs-ratios">
      {lines.map((l) => {
        const t = l.token
        const b = backingFor(l, health.find((h) => h.token.contractId === t.contractId))
        const fmt = (v: bigint) => formatFixed(v, t.decimals)
        const big = b.status === 'unknown' ? 'n/a' : b.tenthsPct === null ? '—' : formatTenths(b.tenthsPct)
        return (
          <section key={t.contractId} className={b.status === 'short' ? 'rs-ratio-card rs-ratio-card--short' : 'rs-ratio-card'} aria-label={`${t.code} backing ratio`}>
            <div className="rs-ratio-top">
              <AssetBadge code={t.code} />
              <span className="rs-code">{t.code}</span>
              {b.status === 'short' && <Tag tone="warn">Short {fmt(b.shortfall)}</Tag>}
              {b.status === 'backed' && <Tag tone="ok">{b.tenthsPct === null ? 'Nothing owed' : 'Fully backed'}</Tag>}
              {b.status === 'unknown' && <Tag tone="neutral">Balance unavailable</Tag>}
            </div>
            <div className="rs-ratio-pct">{big}</div>
            <div className="rs-ratio-cap">
              held / owed
              <FnRef n={5} />
            </div>
            <div className="rs-ratio-nums">
              <span>
                Owed <Mono>{fmt(b.owed)}</Mono>
              </span>
              <span>
                Held <Mono>{b.held === null ? 'n/a' : fmt(b.held)}</Mono>
              </span>
            </div>
          </section>
        )
      })}
    </div>
  )
}
