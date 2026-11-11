import { Link as RouterLink } from '@tanstack/react-router'
import { Link } from '../../../ui'
import { DIFFERENT, SECTION } from '../copy'
import { Section } from './Section'
import css from './Different.module.css'

/** Three properties of the Covered contract. Their limits are told once, in the Limits table. */
export function Different() {
  return (
    <Section id={SECTION.different} heading={DIFFERENT.heading}>
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
          </li>
        ))}
      </ul>
    </Section>
  )
}
