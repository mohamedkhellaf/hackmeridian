import { GLOSSARY, termId } from './content'
import css from './Glossary.module.css'

/**
 * The vocabulary of the interface, one sentence per term. A definition list: `dl > div > dt + dd`. Each term has an
 * id, so another page can link straight to it: `/learn#term-breakeven`.
 */
export function Glossary() {
  return (
    <dl className={css.root}>
      {GLOSSARY.map((entry) => (
        <div key={entry.term} id={termId(entry.term)} className={css.entry}>
          <dt className={css.term}>{entry.term}</dt>
          <dd className={css.definition}>{entry.definition}</dd>
        </div>
      ))}
    </dl>
  )
}
