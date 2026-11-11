import { IconChevronDown } from '../../ui'
import { QUESTIONS } from './content'
import css from './Questions.module.css'

/**
 * Questions as plain disclosures: native `details`, so they open with Enter or Space, are found by the browser's
 * own search, and need no script.
 */
export function Questions() {
  return (
    <div className={css.root}>
      {QUESTIONS.map((item) => (
        <details key={item.id} className={css.item}>
          <summary className={css.question}>
            <span>{item.question}</span>
            <IconChevronDown className={css.chevron} size={16} />
          </summary>
          <div className={css.answer}>
            {item.answer.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}
