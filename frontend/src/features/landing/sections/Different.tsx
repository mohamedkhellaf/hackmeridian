import { Link as RouterLink } from '@tanstack/react-router'
import { Link } from '../../../ui'
import { DIFFERENT, SECTION } from '../copy'
import { Section } from './Section'
import css from './Different.module.css'

export function Different() {
  return (
    <Section id={SECTION.different} heading={DIFFERENT.heading} lead={DIFFERENT.lead}>
      <ul className={css.list} role="list">
        {DIFFERENT.items.map((item) => (
          <li key={item.id} className={css.item}>
            <h3 className={css.title}>{item.title}</h3>
            <p className={css.text}>
              {item.body}
              {item.id === 'collateral' ? (
                <>
                  {' '}
                  <Link render={<RouterLink to="/reserves" />}>{DIFFERENT.reserves}</Link>
                </>
              ) : null}
            </p>
            <p className={css.limit}>
              <span className={css.limitLabel}>{DIFFERENT.limitLabel}</span>
              <span>{item.limit}</span>
            </p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
