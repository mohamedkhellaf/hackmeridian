import { Link as RouterLink } from '@tanstack/react-router'
import { Link } from '../../ui'
import { QUESTIONS } from './content'
import { Disclosure } from './Disclosure'
import css from './Questions.module.css'

/** Questions as plain disclosures, closed until the reader opens one. */
export function Questions() {
  return (
    <div className={css.root}>
      {QUESTIONS.map((item) => (
        <Disclosure key={item.id} className={css.item} summaryClassName={css.question} bodyClassName={css.answer} summary={item.question}>
          {item.answer.map((text) => (
            <p key={text}>{text}</p>
          ))}
          {item.link ? (
            <p>
              <Link render={<RouterLink to={item.link.to} search={item.link.search} />}>{item.link.label}</Link>
            </p>
          ) : null}
        </Disclosure>
      ))}
    </div>
  )
}
