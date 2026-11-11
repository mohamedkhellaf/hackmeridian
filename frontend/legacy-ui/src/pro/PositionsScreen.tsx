import { Button, Card, Tag } from '../ui'
import { DASH, lots, usdx } from './format'
import { Usdx, Who } from './parts'
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

/** State word per phase; `warn` when the position waits for an action. */
const PHASE_STATE: Record<Phase, { label: string; warn: boolean }> = {
  live: { label: 'Open', warn: false },
  exercised: { label: 'Exercised', warn: false },
  'await-price': { label: 'Expired', warn: false },
  settle: { label: 'Expired', warn: true },
  'settle-vault': { label: 'Book settled', warn: true },
  claim: { label: 'Settled', warn: true },
  claimed: { label: 'Claimed', warn: false },
}

export function PositionsScreen() {
  const { client, model, run } = usePro()
  return (
    <Card title="Positions" flush>
      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th className="num hide-sm">Position</th>
              <th className="num">Series</th>
              <th className="num">Strike (USDx)</th>
              <th className="num">Qty (lots)</th>
              <th className="hide-sm">Holder</th>
              <th className="hide-sm">Writer book</th>
              <th className="num hide-sm">Due (USDx)</th>
              <th className="num hide-sm">Paid (USDx)</th>
              <th className="num">Deficit (USDx)</th>
              <th>State</th>
              <th className="num hide-sm">
                <span className="pro-sr">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {model.positions.length === 0 && (
              <tr>
                <td colSpan={11}>No positions.</td>
              </tr>
            )}
            {model.positions.map((p) => {
              const s = model.series.find((x) => x.id === p.seriesId)
              const b = model.books.find((x) => x.id === p.book)
              const phase = phaseOf(p, s, b, model.now)
              const st = PHASE_STATE[phase]
              const shownPaid = p.claim?.paid ?? (p.exercised ? p.paid : null)
              const shownDeficit = p.claim?.deficit ?? (p.exercised ? p.deficit : null)
              const button =
                phase === 'live' ? (
                  <Button size="sm" variant="secondary" onClick={() => void run('Early exercise', client.exercise(p.holder, p.id), 'Exercised')}>
                    Exercise early
                  </Button>
                ) : phase === 'settle' ? (
                  <Button size="sm" variant="secondary" onClick={() => void run('Settle book', client.settle(p.book), 'Book settled')}>
                    Settle book
                  </Button>
                ) : phase === 'settle-vault' ? (
                  <Button size="sm" variant="secondary" onClick={() => void run('Settle series', client.settleVault(p.seriesId), 'Series settled')}>
                    Settle series
                  </Button>
                ) : phase === 'claim' ? (
                  <Button size="sm" variant="secondary" onClick={() => void run('Claim', client.claim(p.holder, p.id), 'Claimed')}>
                    Claim
                  </Button>
                ) : null
              return (
                <tr key={p.id}>
                  <td className="num hide-sm">{p.id}</td>
                  <td className="num">{p.seriesId}</td>
                  <td className="num">{s ? usdx(s.strike) : DASH}</td>
                  <td className="num">{lots(p.qty)}</td>
                  <td className="hide-sm">
                    <Who id={p.holder} />
                  </td>
                  <td className="hide-sm">
                    {p.bookOwner ? <Who id={p.bookOwner} /> : DASH}
                    {p.bookOwner === VAULT && phase === 'live' && <span className="pro-muted">, settles at expiry</span>}
                  </td>
                  <td className="num hide-sm">{p.claim ? <Usdx v={p.claim.due} /> : DASH}</td>
                  <td className="num hide-sm">{shownPaid != null ? <Usdx v={shownPaid} /> : DASH}</td>
                  <td className={shownDeficit != null && shownDeficit > 0n ? 'num pro-bad' : 'num'}>{shownDeficit != null ? <Usdx v={shownDeficit} /> : DASH}</td>
                  <td>
                    <Tag tone={st.warn ? 'warn' : 'neutral'} className={button ? 'pro-tag-act' : undefined}>
                      {st.label}
                    </Tag>
                    {button && <span className="pro-act-sm">{button}</span>}
                  </td>
                  <td className="num hide-sm">
                    {button}
                    {phase === 'await-price' && <span className="pro-muted">Waiting for settlement price</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
