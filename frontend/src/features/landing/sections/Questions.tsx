import { QUESTIONS, SECTION } from '../copy'
import { Section } from './Section'
import css from './Questions.module.css'

/** Eight questions, each answered in a sentence or two. All open: there is nothing to unfold. */
export function Questions() {
  return (
    <Section id={SECTION.questions} heading={QUESTIONS.heading}>
      <ul className={css.list} role="list">
        {QUESTIONS.items.map((item) => (
          <li key={item.q} className={css.item}>
            <h3 className={css.question}>{item.q}</h3>
            <p className={css.answer}>{item.a}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
