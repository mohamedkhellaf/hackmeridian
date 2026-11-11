import { DEFINITIONS, READING_HEADING } from './copy'
import { FactList } from './FactList'
import css from './ReadingNotes.module.css'

/**
 * What the three columns mean, as visible text beside the figure. The old page kept these definitions in
 * hover-only tooltips, which touch and keyboard users never saw.
 */
export function ReadingNotes() {
  return (
    <section className={css.root} aria-labelledby="reserves-reading">
      <h3 id="reserves-reading" className={css.heading}>
        {READING_HEADING}
      </h3>
      <FactList facts={DEFINITIONS} />
    </section>
  )
}
