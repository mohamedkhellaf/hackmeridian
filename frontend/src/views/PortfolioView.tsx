import { useMemo, useState } from 'react'
import { OptionsTable } from '../market/OptionsTable'
import type { OptionOffer } from '../options/types'
import { computeKpis, filterPositions, moneyWith, nowMs, waitingActions } from '../portfolio/positions'
import type { PositionFilter } from '../portfolio/positions'
import { Banner, PageHero, Segmented } from '../ui'
import type { PositionAction } from '../state/useStrata'
import '../portfolio/portfolio.css'

export interface PortfolioViewProps {
  me: string | null
  /** Options the connected wallet holds or wrote. */
  rows: OptionOffer[]
  actionFor: (o: OptionOffer) => PositionAction | undefined
}

function joinPhrases(p: string[]): string {
  if (p.length <= 1) return p.join('')
  return `${p.slice(0, -1).join(', ')}, and ${p[p.length - 1]}`
}

export function PortfolioView({ me, rows, actionFor }: PortfolioViewProps) {
  const [filter, setFilter] = useState<PositionFilter>('all')
  const [showClosed, setShowClosed] = useState(false)

  const kpis = useMemo(() => computeKpis(rows, me), [rows, me])
  const waiting = useMemo(() => waitingActions(rows, me, nowMs()), [rows, me])
  const counts = {
    all: filterPositions(rows, me, 'all', showClosed).length,
    holding: filterPositions(rows, me, 'holding', showClosed).length,
    writing: filterPositions(rows, me, 'writing', showClosed).length,
  }
  const visible = filterPositions(rows, me, filter, showClosed)

  return (
    <div className="pf">
      <PageHero
        eyebrow={me ? `Your positions · ${me.slice(0, 4)}…${me.slice(-4)}` : 'Your positions'}
        title="Portfolio"
        lede="Everything you hold or have written, with the one thing each position is waiting for."
        sediment={{ seed: me ?? 'portfolio', captionLabel: 'Open and recent', caption: me ? `${counts.all} ${counts.all === 1 ? 'position' : 'positions'}` : 'Connect a wallet' }}
        stats={
          me
            ? [
                { label: 'Holding', value: kpis.holding },
                { label: 'Writing', value: kpis.writing },
                {
                  label: 'Your collateral locked',
                  value:
                    kpis.locked.length === 0 ? (
                      '—'
                    ) : (
                      <span className="pf-multi">
                        {kpis.locked.map((l) => (
                          <span key={l.token.contractId}>{moneyWith(l.amount, l.token)}</span>
                        ))}
                      </span>
                    ),
                },
                {
                  label: 'Premium earned',
                  value: kpis.premium ? <span className="pf-pos">+{moneyWith(kpis.premium.amount, kpis.premium.token)}</span> : '—',
                },
              ]
            : undefined
        }
      />
      {me ? (
        <>
          {waiting.length > 0 && (
            <Banner tone="info">
              {waiting.length} {waiting.length === 1 ? 'action' : 'actions'} waiting: {joinPhrases(waiting)}.
            </Banner>
          )}

          <div className="pf-toolbar">
            <Segmented
              label="Filter positions"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `All ${counts.all}` },
                { value: 'holding', label: `Holding ${counts.holding}` },
                { value: 'writing', label: `Writing ${counts.writing}` },
              ]}
            />
            <label className="pf-closed">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
              Show closed
            </label>
          </div>

          <OptionsTable
            rows={visible}
            me={me}
            actionFor={actionFor}
            empty={rows.length === 0 ? 'No positions yet. Buy an option in Markets or write one.' : 'Nothing matches this filter. Try "Show closed".'}
          />
        </>
      ) : (
        <p className="pf-empty">Connect a wallet to see your positions.</p>
      )}
    </div>
  )
}
