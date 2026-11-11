import { LIMITS, SECTION } from '../copy'
import { Section } from './Section'
import css from './Limits.module.css'

/** What the product does not do, as one ruled list of sentences that each stand on their own. */
export function Limits() {
  return (
    <Section id={SECTION.limits} heading={LIMITS.heading}>
      <ul className={css.list} role="list" data-testid="limits-list">
        {LIMITS.items.map((item) => (
          <li key={item.id} className={css.item}>
            {item.text}
          </li>
        ))}
      </ul>
    </Section>
  )
}
