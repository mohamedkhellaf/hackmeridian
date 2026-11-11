import { DEFINITIONS, READING_HEADING } from './copy'
import { FactList } from './FactList'
import css from './ReadingNotes.module.css'

/**
 * What the three columns mean, as visible text under the statement. On a live build each figure also says which
 * contract call it is read from; a mock build calls none, so it says nothing of the kind.
 */
export function ReadingNotes({ isMock }: { isMock: boolean }) {
  const facts = DEFINITIONS.map((d) => ({ term: d.term, text: d.text, source: isMock ? undefined : d.source }))
  return (
    <section className={css.root} aria-labelledby="reserves-reading">
      <h3 id="reserves-reading" className={css.heading}>
        {READING_HEADING}
      </h3>
      <FactList facts={facts} />
    </section>
  )
}

/** The notes' heading alone, for the loading state, where it already stands in its place. */
export function ReadingNotesHeading() {
  return <h3 className={css.heading}>{READING_HEADING}</h3>
}
