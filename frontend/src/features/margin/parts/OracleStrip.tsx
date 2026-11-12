import { Fragment } from 'react'
import { formatUtc } from '../../../core/format'
import { usePro } from '../../../data'
import { IconWarning, Link, useIsPhone } from '../../../ui'
import { withUnit, usdx } from '../model/money'
import { UNDERLYING, numbered, partyName, scenarioCopy } from '../model/names'
import { oracleView, spanText } from '../model/oracle'
import { Usdx } from './figures'
import css from './OracleStrip.module.css'

/** The label of the Margin price: the publisher's, for this market, never to be read as the Covered token's price. */
export const PRICE_LABEL = `${UNDERLYING}, Margin publisher price`

/** Fixture builds: which scenario, which step, as whom and at what time on the scenario's clock, in one sentence. */
function ScenarioLine() {
  const { sim, me, model } = usePro()
  if (!sim) return null
  return (
    <p className={css.scenario}>
      <span className={css.strong}>{scenarioCopy(sim.scenarioName).title}</span>, step {sim.position} of {sim.stepCount}, as{' '}
      <span className={css.strong}>{partyName(me)}</span>. The scenario stands at {formatUtc(model.now)}.{' '}
      <Link href="#replay" aria-label="Change scenario, step or account">
        Change
      </Link>
    </p>
  )
}

/**
 * One ruled row on every Margin screen: on fixtures the scenario and its step on the left, and the publisher's
 * latest snapshot on the right (price, sequence, age with a word, any settlement price still pending). Whether
 * early exercise can use the snapshot is said on Positions only, where it decides an action. Under 768 px the
 * figures are one sentence, broken only between facts. Who sets these prices is said once, under the page title.
 */
export function OracleStrip({ exercise = false }: { exercise?: boolean }) {
  const { model } = usePro()
  const phone = useIsPhone()
  const o = oracleView(model)
  const snap = o.latest?.snapshot ?? null
  const limit = spanText(o.exerciseMaxAge)
  const stale = o.freshness === 'stale'
  const paused = snap !== null && !o.exerciseOpen
  const pending = o.pending.length > 0 ? `Pending for series ${o.pending.map((s) => s.id).join(', ')}` : null

  if (phone) {
    // One line: the price, then the snapshot and its age, then what is waiting.
    const parts = [
      ...(snap ? [`snapshot ${numbered(snap.seq)}, ${spanText(o.age ?? 0)} old${stale ? `, stale (limit ${spanText(o.maxAge)})` : ''}`] : []),
      ...(exercise && snap ? [o.exerciseOpen ? `early exercise open, snapshot within ${limit}` : `early exercise paused, snapshot older than ${limit}`] : []),
      ...(pending ? [`settlement price ${pending.toLowerCase()}`] : []),
    ]
    const warn = stale || (exercise && paused) || pending !== null
    return (
      <div className={css.row}>
        <ScenarioLine />
        <section className={css.line} aria-label="Publisher prices" data-warn={warn || undefined}>
          {warn ? <IconWarning className={css.icon} /> : null}
          <p>
            {/* Each part breaks as a whole, so a line ends between facts, never inside one. */}
            <span className={css.part}>
              {snap ? (
                <>
                  {PRICE_LABEL} <span className={css.price}>{withUnit(usdx(snap.spot))}</span>
                </>
              ) : (
                `${PRICE_LABEL}: no snapshot yet`
              )}
              {parts.length > 0 ? ',' : '.'}
            </span>
            {parts.map((part, i) => (
              <Fragment key={part}>
                {' '}
                <span className={css.part}>
                  {part}
                  {i < parts.length - 1 ? ',' : '.'}
                </span>
              </Fragment>
            ))}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className={css.row}>
      <ScenarioLine />
      <section className={css.root} aria-label="Publisher prices">
        <dl className={css.facts}>
          <div className={css.fact}>
            <dt>{PRICE_LABEL}</dt>
            <dd className={css.figure}>{snap ? <Usdx v={snap.spot} unit figure="serif" /> : 'No snapshot yet'}</dd>
          </div>
          <div className={css.fact}>
            <dt>Snapshot</dt>
            <dd>{snap ? numbered(snap.seq) : 'None'}</dd>
          </div>
          <div className={css.fact}>
            <dt>Age</dt>
            <dd data-warn={stale || undefined}>
              {o.age === null ? (
                'No snapshot'
              ) : (
                <>
                  {stale ? <IconWarning className={css.icon} /> : null}
                  {spanText(o.age)}, {stale ? `stale (limit ${spanText(o.maxAge)})` : 'fresh'}
                </>
              )}
            </dd>
          </div>
          {exercise ? (
            <div className={css.fact}>
              <dt>Early exercise</dt>
              <dd data-warn={paused || undefined}>
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
          ) : null}
          {pending ? (
            <div className={css.fact}>
              <dt>Settlement price</dt>
              <dd data-warn>
                <IconWarning className={css.icon} />
                {pending}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  )
}
