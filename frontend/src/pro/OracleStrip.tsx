import { StatusDot, Tag } from '../ui'
import { DASH, usdx, when } from './format'
import { ageText, snapshotAge } from './helpers'
import { usePro } from './proCtx'

/** Oracle strip on every Pro screen: latest snapshot (sequence, age) and settlement-price status, with details. */
export function OracleStrip() {
  const { model } = usePro()
  const withSnap = model.series.filter((s) => s.snapshot)
  const latest = withSnap.reduce<(typeof withSnap)[number] | null>((best, s) => (!best || s.snapshot!.ts > best.snapshot!.ts ? s : best), null)
  const age = latest ? snapshotAge(model, latest) : null
  const exerciseOk = age != null && age <= model.config.exerciseMaxAge
  const fresh = age != null && age <= model.config.maxAge

  return (
    <section className="pro-oracle" aria-label="Oracle">
      <div className="pro-oracle-row">
        <span className="ui-label">Oracle (team publisher)</span>
        <span>
          EQTY spot <strong className="pro-num">{latest ? usdx(latest.snapshot!.spot, 2) : DASH}</strong>
        </span>
        <span>
          <StatusDot tone={latest ? (fresh ? 'ok' : 'warn') : 'neutral'} /> Snapshot {latest ? `#${latest.snapshot!.seq}` : DASH} · {ageText(age)} old
        </span>
        <span className="pro-hint">
          {latest ? (exerciseOk ? `Fresh enough for early exercise (limit ${model.config.exerciseMaxAge} s)` : `Too old for early exercise (limit ${model.config.exerciseMaxAge} s)`) : 'No snapshot yet'}
        </span>
      </div>
      <details className="pro-oracle-details">
        <summary>Snapshot and settlement price per series</summary>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="ui-left">Series</th>
                <th>Snapshot</th>
                <th>Spot</th>
                <th>Mark</th>
                <th>Age</th>
                <th>Settlement price</th>
              </tr>
            </thead>
            <tbody>
              {model.series.length === 0 && (
                <tr>
                  <td className="ui-left" colSpan={6}>
                    No series yet.
                  </td>
                </tr>
              )}
              {model.series.map((s) => {
                const expired = model.now >= s.expiry
                return (
                  <tr key={s.id}>
                    <td className="ui-left">
                      #{s.id}
                      <span className="ui-sub">expires {when(s.expiry)}</span>
                    </td>
                    <td>{s.snapshot ? `#${s.snapshot.seq}` : DASH}</td>
                    <td>{s.snapshot ? usdx(s.snapshot.spot, 2) : DASH}</td>
                    <td>{s.snapshot ? usdx(s.snapshot.mark) : DASH}</td>
                    <td>{ageText(snapshotAge(model, s))}</td>
                    <td>
                      {s.settlementPrice != null ? (
                        usdx(s.settlementPrice, 2)
                      ) : expired ? (
                        <Tag tone="warn">Waiting for the publisher</Tag>
                      ) : (
                        <span className="pro-hint">Not yet (series live)</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="pro-hint">
          The contract checks each snapshot for consistency (mark bounds, extreme-scenario floor, freshness, sequence), not the price itself. The publisher cannot change a live series' terms or rewrite a
          published settlement price.
        </p>
      </details>
    </section>
  )
}
