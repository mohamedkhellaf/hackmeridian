import { LIMITS, LIMITS_HEADING } from './copy'
import css from './Limits.module.css'

/** What the page leaves out, in its own words, always visible under the statement. */
export function Limits() {
  return (
    <section className={css.root} aria-labelledby="reserves-limits">
      <h3 id="reserves-limits" className={css.heading}>
        {LIMITS_HEADING}
      </h3>
      <ul className={css.list} role="list">
        {LIMITS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}
