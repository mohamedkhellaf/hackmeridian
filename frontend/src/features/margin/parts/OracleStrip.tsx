import { usePro } from '../../../data'
import { IconWarning } from '../../../ui'
import { QUOTE, usdx } from '../model/money'
import { UNDERLYING } from '../model/names'
import { oracleView, spanText } from '../model/oracle'
import css from './OracleStrip.module.css'

/**
 * The publisher's latest snapshot on every Margin screen: price, sequence, age with a word, whether early
 * exercise can use it, and any settlement price still pending. Who sets these prices is said once, under the
 * page title.
 */
export function OracleStrip() {
  const { model } = usePro()
  const o = oracleView(model)
  const snap = o.latest?.snapshot ?? null
  const limit = spanText(o.exerciseMaxAge)

  return (
    <section className={css.root} aria-label="Publisher prices">
      <dl className={css.facts}>
        <div className={css.fact}>
          <dt>{UNDERLYING}, publisher price</dt>
          <dd className={css.figure}>
            {snap ? (
              <>
                {usdx(snap.spot)} <span className={css.unit}>{QUOTE}</span>
              </>
            ) : (
              'No snapshot yet'
            )}
          </dd>
        </div>
        <div className={css.fact}>
          <dt>Snapshot</dt>
          <dd>{snap ? `No. ${snap.seq}` : 'None'}</dd>
        </div>
        <div className={css.fact}>
          <dt>Age</dt>
          <dd data-warn={o.freshness === 'stale' || undefined}>
            {o.age === null ? (
              'No snapshot'
            ) : (
              <>
                {o.freshness === 'stale' ? <IconWarning className={css.icon} /> : null}
                {spanText(o.age)}, {o.freshness === 'stale' ? `stale (limit ${spanText(o.maxAge)})` : 'fresh'}
              </>
            )}
          </dd>
        </div>
        <div className={css.fact}>
          <dt>Early exercise</dt>
          <dd data-warn={(snap !== null && !o.exerciseOpen) || undefined}>
            {snap === null ? (
              'Needs a snapshot'
            ) : o.exerciseOpen ? (
              `Open, snapshot within ${limit}`
            ) : (
              <>
                <IconWarning className={css.icon} />
                Paused, snapshot older than {limit}
              </>
            )}
          </dd>
        </div>
        {o.pending.length > 0 ? (
          <div className={css.fact}>
            <dt>Settlement price</dt>
            <dd data-warn>
              <IconWarning className={css.icon} />
              Pending for series {o.pending.map((s) => s.id).join(', ')}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}
