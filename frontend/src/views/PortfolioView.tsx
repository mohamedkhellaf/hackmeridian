import { useMemo, useState } from 'react'
import { OptionsTable } from '../market/OptionsTable'
import { formatAmount, formatExpiry } from '../options/format'
import type { CollateralHealth, OptionOffer, TokenInfo } from '../options/types'
import { actionKindOf, computeKpis, filterPositions, moneyWith, nowMs, roleOf, waitingActions } from '../portfolio/positions'
import type { PositionFilter } from '../portfolio/positions'
import { shortfallFor } from '../reserves/reserves'
import { ShortfallBanner } from '../reserves/ShortfallWarning'
import { Banner, Button, Dialog, PageHero, Segmented } from '../ui'
import type { PositionAction } from '../state/useStrata'
import '../portfolio/portfolio.css'
import '../payoff/payoff.css'

export interface PortfolioViewProps {
  me: string | null
  /** Options the connected wallet holds or wrote. */
  rows: OptionOffer[]
  actionFor: (o: OptionOffer) => PositionAction | undefined
  /** Reserved vs held per token, for the clawback shortfall warning on affected rows. */
  health?: CollateralHealth[]
}

function joinPhrases(p: string[]): string {
  if (p.length <= 1) return p.join('')
  return `${p.slice(0, -1).join(', ')}, and ${p[p.length - 1]}`
}

const exact = (units: bigint, t: TokenInfo) => `${formatAmount(units, t.decimals, t.decimals, 2)} ${t.code}`

/** The two physical legs of an exercise, stated explicitly (PUT: deliver the underlying; CALL: pay the strike). */
function exerciseLegs(o: OptionOffer): { give: string; get: string; sentence: string } {
  const qty = exact(o.underlyingQty, o.underlying)
  const strike = exact(o.totalStrike, o.quote)
  return o.kind === 'put'
    ? { give: qty, get: strike, sentence: `You deliver ${qty} and receive ${strike}.` }
    : { give: strike, get: qty, sentence: `You pay ${strike} and receive ${qty}.` }
}

function ExerciseConfirm({ o, health, onConfirm, onCancel }: { o: OptionOffer; health: CollateralHealth[]; onConfirm: () => void; onCancel: () => void }) {
  const legs = exerciseLegs(o)
  const short = shortfallFor(o, health)
  return (
    <Dialog
      title={`Exercise ${o.underlying.code} ${o.kind}`}
      width={480}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Sign and exercise
          </Button>
        </>
      }
    >
      <p className="po-hint">Physical settlement. Both transfers happen in one transaction or not at all.</p>
      <ul className="po-deliver" aria-label="Exercise settlement">
        <li>
          {o.kind === 'put' ? 'You deliver' : 'You pay'} <b>{legs.give}</b>
        </li>
        <li>
          You receive <b>{legs.get}</b>
        </li>
      </ul>
      <p className="po-hint">
        {o.kind === 'put'
          ? `${o.underlying.code} leaves your wallet and ${o.quote.code} arrives from the contract.`
          : `${o.quote.code} leaves your wallet and ${o.underlying.code} arrives from the contract.`}{' '}
        Exercise is possible until {formatExpiry(o.expiry)}. After that the writer reclaims the collateral. Your wallet must hold what you deliver, or the transaction fails.
      </p>
      {short.map((t) => (
        <ShortfallBanner key={t.contractId} token={t} />
      ))}
    </Dialog>
  )
}

export function PortfolioView({ me, rows, actionFor, health = [] }: PortfolioViewProps) {
  const [exercising, setExercising] = useState<bigint | null>(null)
  const pending = exercising === null ? undefined : rows.find((r) => r.id === exercising)
  // Exercise is intercepted: the row button opens the confirmation, which then runs the original action.
  const guardedActionFor = (o: OptionOffer): PositionAction | undefined => {
    const a = actionFor(o)
    const role = roleOf(o, me)
    if (a && role && actionKindOf(o, role) === 'exercise') return { ...a, onClick: () => setExercising(o.id) }
    return a
  }
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
            actionFor={guardedActionFor}
            health={health}
            empty={rows.length === 0 ? 'No positions yet. Buy an option in Markets or write one.' : 'Nothing matches this filter. Try "Show closed".'}
          />
        </>
      ) : (
        <p className="pf-empty">Connect a wallet to see your positions.</p>
      )}
      {pending && (
        <ExerciseConfirm
          o={pending}
          health={health}
          onCancel={() => setExercising(null)}
          onConfirm={() => {
            setExercising(null)
            actionFor(pending)?.onClick()
          }}
        />
      )}
    </div>
  )
}
