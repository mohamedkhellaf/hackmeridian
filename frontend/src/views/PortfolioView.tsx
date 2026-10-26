import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { OptionsTable } from '../market/OptionsTable'
import { formatCountdown, formatExpiryShort } from '../market/series'
import { formatAmount, shortAddress, strikePerUnit } from '../options/format'
import type { CollateralHealth, OptionOffer, TokenInfo } from '../options/types'
import { actionKindOf, computeKpis, filterPositions, moneyWith, nowMs, roleOf, waitingActions } from '../portfolio/positions'
import { shortfallFor } from '../reserves/reserves'
import { ShortfallNotice } from '../reserves/ShortfallWarning'
import { Banner, Button, Dialog, Mono, PageHeader, Stat, StatGrid } from '../ui'
import type { PositionAction } from '../state/useStrata'
import '../portfolio/portfolio.css'

export interface PortfolioViewProps {
  me: string | null
  /** Options the connected wallet holds or wrote. */
  rows: OptionOffer[]
  actionFor: (o: OptionOffer) => PositionAction | undefined
  /** Reserved vs held per token, for the clawback shortfall warning on affected rows. */
  health?: CollateralHealth[]
  /** Resale panel (contract v1.4), rendered below the positions. */
  resale?: ReactNode
}

function joinPhrases(p: string[]): string {
  if (p.length <= 1) return p.join('')
  return `${p.slice(0, -1).join(', ')}, and ${p[p.length - 1]}`
}

const exact = (units: bigint, t: TokenInfo) => `${formatAmount(units, t.decimals, t.decimals, 2)} ${t.code}`

/** The physical legs of an exercise in one sentence (PUT: deliver the underlying; CALL: pay the strike). */
function deliverySentence(o: OptionOffer): string {
  const qty = exact(o.underlyingQty, o.underlying)
  const strike = exact(o.totalStrike, o.quote)
  return o.kind === 'put' ? `You deliver ${qty} and receive ${strike}.` : `You pay ${strike} and receive ${qty}.`
}

function ExerciseConfirm({ o, health, onConfirm, onCancel }: { o: OptionOffer; health: CollateralHealth[]; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog
      title={`Exercise ${o.underlying.code} ${o.kind}`}
      width={440}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Exercise
          </Button>
        </>
      }
    >
      <dl className="ui-kv">
        <div>
          <dt>Qty</dt>
          <dd>{moneyWith(o.underlyingQty, o.underlying)}</dd>
        </div>
        <div>
          <dt>Strike</dt>
          <dd>
            {strikePerUnit(o)} {o.quote.code} per {o.underlying.code}
          </dd>
        </div>
        <div>
          <dt>Total strike</dt>
          <dd>{moneyWith(o.totalStrike, o.quote)}</dd>
        </div>
        <div>
          <dt>Original premium (paid to the writer)</dt>
          <dd>{moneyWith(o.totalPremium, o.quote)}</dd>
        </div>
        <div>
          <dt>Expiry</dt>
          <dd>
            {formatExpiryShort(o.expiry)} <span className="pf-cd">{formatCountdown(o.expiry, nowMs())}</span>
          </dd>
        </div>
        <div>
          <dt>Maker</dt>
          <dd>
            <Mono>{shortAddress(o.writer)}</Mono>
          </dd>
        </div>
      </dl>
      <p className="po-deliver">{deliverySentence(o)}</p>
      <ShortfallNotice tokens={shortfallFor(o, health)} />
    </Dialog>
  )
}

export function PortfolioView({ me, rows, actionFor, health = [], resale }: PortfolioViewProps) {
  const [exercising, setExercising] = useState<bigint | null>(null)
  const pending = exercising === null ? undefined : rows.find((r) => r.id === exercising)
  // Exercise is intercepted: the row button opens the confirmation, which then runs the original action.
  const guardedActionFor = (o: OptionOffer): PositionAction | undefined => {
    const a = actionFor(o)
    const role = roleOf(o, me)
    if (a && role && actionKindOf(o, role) === 'exercise') return { ...a, onClick: () => setExercising(o.id) }
    return a
  }
  const [showClosed, setShowClosed] = useState(false)

  const kpis = useMemo(() => computeKpis(rows, me), [rows, me])
  const waiting = useMemo(() => waitingActions(rows, me, nowMs()), [rows, me])
  const held = filterPositions(rows, me, 'holding', showClosed)
  const written = filterPositions(rows, me, 'writing', showClosed)

  return (
    <div className="pf">
      <PageHeader
        title="Positions"
        actions={
          me ? (
            <label className="pf-closed">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
              Show closed
            </label>
          ) : undefined
        }
      />
      {me ? (
        <>
          {waiting.length > 0 && (
            <Banner tone="warn">
              {waiting.length} {waiting.length === 1 ? 'action' : 'actions'} waiting: {joinPhrases(waiting)}.
            </Banner>
          )}

          {kpis.premium && (
            <StatGrid columns={2}>
              <Stat label="Premium earned">{moneyWith(kpis.premium.amount, kpis.premium.token)}</Stat>
              <Stat label="Reserves locked">
                {kpis.locked.length === 0 ? '0' : kpis.locked.map((l) => moneyWith(l.amount, l.token)).join(', ')}
              </Stat>
            </StatGrid>
          )}

          {held.length === 0 && written.length === 0 ? (
            <p className="pf-empty">
              {rows.length === 0 ? 'No positions.' : 'No open positions.'} <a href="#/markets">Browse markets</a>.
            </p>
          ) : (
            <>
              {held.length > 0 && (
                <section className="pf-section">
                  <h2>Held</h2>
                  <OptionsTable label="Held" rows={held} me={me} actionFor={guardedActionFor} health={health} />
                </section>
              )}
              {written.length > 0 && (
                <section className="pf-section">
                  <h2>Written</h2>
                  <OptionsTable label="Written" counterpartyLabel="Buyer" rows={written} me={me} actionFor={guardedActionFor} health={health} />
                </section>
              )}
            </>
          )}
          {resale}
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
