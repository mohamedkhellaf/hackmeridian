import { DASH, usdx } from './format'
import { ageText, snapshotAge } from './helpers'
import { usePro } from './proCtx'

/** One line on every Pro screen: latest publisher snapshot, its age, early-exercise freshness, pending settlement prices. */
export function OracleStrip() {
  const { model } = usePro()
  const withSnap = model.series.filter((s) => s.snapshot)
  const latest = withSnap.reduce<(typeof withSnap)[number] | null>((best, s) => (!best || s.snapshot!.ts > best.snapshot!.ts ? s : best), null)
  const age = latest ? snapshotAge(model, latest) : null
  const exerciseOk = age != null && age <= model.config.exerciseMaxAge
  const waiting = model.series.filter((s) => model.now >= s.expiry && s.settlementPrice == null)

  return (
    <section className="pro-oracle" aria-label="Oracle">
      <span>
        <span className="pro-muted">EQTY spot</span> {latest ? usdx(latest.snapshot!.spot) : DASH}
      </span>
      <span>
        <span className="pro-muted">Snapshot</span> {latest ? latest.snapshot!.seq : DASH}
      </span>
      <span>
        <span className="pro-muted">Age</span> {ageText(age)}
      </span>
      <span>
        <span className="pro-muted">Early exercise</span>{' '}
        {latest ? (exerciseOk ? `allowed, limit ${model.config.exerciseMaxAge}s` : <span className="pro-warn">snapshot too old, limit {model.config.exerciseMaxAge}s</span>) : 'no snapshot'}
      </span>
      {waiting.length > 0 && (
        <span className="pro-warn">Settlement price pending for series {waiting.map((s) => s.id).join(', ')}</span>
      )}
    </section>
  )
}
