import { Button, Card, PageHeader, Tag } from '../ui'
import { PRO_ERRORS } from './errors'
import { DASH, lots, usdx } from './format'
import { Who } from './parts'
import { usePro } from './proCtx'
import type { BookView, PositionView, SeriesView } from './types'
import { VAULT } from './types'

type Phase = 'live' | 'exercised' | 'await-price' | 'settle' | 'settle-vault' | 'claim' | 'claimed'

function phaseOf(p: PositionView, s: SeriesView | undefined, b: BookView | undefined, now: number): Phase {
  if (p.claim) return 'claimed'
  if (p.exercised) return 'exercised'
  if (!s || now < s.expiry) return 'live'
  if (s.settlementPrice == null) return 'await-price'
  if (s.closed) return 'claim'
  return b?.settled ? 'settle-vault' : 'settle'
}

const PHASE_LABEL: Record<Phase, string> = {
  live: 'Open',
  exercised: 'Exercised early',
  'await-price': 'Expired, waiting for the settlement price',
  settle: 'Expired: settle the book',
  'settle-vault': 'Book settled: settle the series',
  claim: 'Ready to claim',
  claimed: 'Claimed',
}

/** The three expiry steps, ticked as they complete. */
function Steps({ phase }: { phase: Phase }) {
  const order: Phase[] = ['settle', 'settle-vault', 'claim']
  const idx = phase === 'claimed' ? 3 : order.indexOf(phase)
  const labels = ['settle(book)', 'settle_vault(series)', 'claim']
  return (
    <ol className="pro-steps" aria-label="Settlement steps">
      {labels.map((l, i) => (
        <li key={l} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''}>
          {l}
        </li>
      ))}
    </ol>
  )
}

export function PositionsScreen() {
  const { client, model, run } = usePro()
  const refusals = [226, 207, 223, 225, 224]
  return (
    <>
      <PageHeader
        title="Positions"
        subtitle="Exercise early at the latest snapshot, or wait for expiry: settle the book, settle the series, then claim what was paid and see any deficit."
      />

      <Card title="Early exercise rules" subtitle="American calls: the whole position, at the latest snapshot. These are the reasons the contract refuses.">
        <ul className="pro-reasons">
          {refusals.map((c) => (
            <li key={c}>
              <Tag tone="warn">{PRO_ERRORS[c].name}</Tag>
              <span>{PRO_ERRORS[c].message}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Positions" subtitle="Actions run as the position holder." flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="ui-left">Position</th>
                <th>Holder</th>
                <th>Quantity</th>
                <th>Writer book</th>
                <th>State</th>
                <th>Paid</th>
                <th>Deficit</th>
                <th>
                  <span className="pro-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {model.positions.length === 0 && (
                <tr>
                  <td className="ui-left" colSpan={8}>
                    No positions at this point of the simulation. Buy a call on the Trade screen.
                  </td>
                </tr>
              )}
              {model.positions.map((p) => {
                const s = model.series.find((x) => x.id === p.seriesId)
                const b = model.books.find((x) => x.id === p.book)
                const phase = phaseOf(p, s, b, model.now)
                const shownPaid = p.claim?.paid ?? (p.exercised ? p.paid : null)
                const shownDeficit = p.claim?.deficit ?? (p.exercised ? p.deficit : null)
                return (
                  <tr key={p.id}>
                    <td className="ui-left ui-strong">
                      #{p.id}
                      <span className="ui-sub">
                        series #{p.seriesId}
                        {s ? ` · strike ${usdx(s.strike, 2)}` : ''}
                      </span>
                    </td>
                    <td>
                      <Who id={p.holder} />
                    </td>
                    <td>{lots(p.qty)} lots</td>
                    <td>
                      {p.bookOwner ? <Who id={p.bookOwner} /> : DASH}
                      {p.bookOwner === VAULT && phase === 'live' && <span className="ui-sub">settles at expiry</span>}
                    </td>
                    <td>
                      <Tag tone={phase === 'claim' || phase === 'settle' || phase === 'settle-vault' ? 'warn' : phase === 'claimed' || phase === 'exercised' ? 'ok' : 'call'}>
                        {PHASE_LABEL[phase]}
                      </Tag>
                      {(phase === 'settle' || phase === 'settle-vault' || phase === 'claim' || phase === 'claimed') && <Steps phase={phase} />}
                    </td>
                    <td>{shownPaid != null ? `${usdx(shownPaid)} USDx` : DASH}</td>
                    <td className={shownDeficit != null && shownDeficit > 0n ? 'pro-bad' : undefined}>
                      {shownDeficit != null ? `${usdx(shownDeficit)} USDx` : DASH}
                      {p.claim && <span className="ui-sub">of {usdx(p.claim.due)} due</span>}
                    </td>
                    <td>
                      {phase === 'live' && (
                        <Button size="sm" variant="primary" onClick={() => void run('Early exercise', client.exercise(p.holder, p.id), 'Exercised: paid from the writer margin.')}>
                          Exercise early
                        </Button>
                      )}
                      {phase === 'settle' && (
                        <Button size="sm" variant="primary" onClick={() => void run('Settle book', client.settle(p.book), 'Book settled.')}>
                          Settle book
                        </Button>
                      )}
                      {phase === 'settle-vault' && (
                        <Button size="sm" variant="primary" onClick={() => void run('Settle series', client.settleVault(p.seriesId), 'Series settled against the vault.')}>
                          Settle series
                        </Button>
                      )}
                      {phase === 'claim' && (
                        <Button size="sm" variant="primary" onClick={() => void run('Claim', client.claim(p.holder, p.id), 'Claimed.')}>
                          Claim
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
