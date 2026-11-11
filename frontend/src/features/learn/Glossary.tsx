import { GLOSSARY } from './content'
import css from './Glossary.module.css'

/** The vocabulary of the interface, one sentence per term. A definition list: `dl > div > dt + dd`. */
export function Glossary() {
  return (
    <dl className={css.root}>
      {GLOSSARY.map((entry) => (
        <div key={entry.term} className={css.entry}>
          <dt className={css.term}>{entry.term}</dt>
          <dd className={css.definition}>{entry.definition}</dd>
        </div>
      ))}
    </dl>
  )
}
