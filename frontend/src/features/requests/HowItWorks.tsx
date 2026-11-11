import { Link as RouterLink } from '@tanstack/react-router'
import { Link } from '../../ui'
import { HOW_MORE, HOW_STEPS, HOW_TITLE } from './copy'
import { LEARN_ROUTE } from './routing'
import styles from './HowItWorks.module.css'

/** Who acts and by when, for someone who has never seen a funded bid. Three steps, in order. */
export function HowItWorks() {
  return (
    <section className={styles.root} aria-labelledby="requests-how">
      <div className={styles.head}>
        <h2 id="requests-how" className="ui-h2">
          {HOW_TITLE}
        </h2>
        <Link tone="quiet" render={<RouterLink to={LEARN_ROUTE} />}>
          {HOW_MORE}
        </Link>
      </div>
      <ol className={styles.steps}>
        {HOW_STEPS.map((step) => (
          <li key={step.title} className={styles.step}>
            <p className={styles.when}>
              <span>{step.when}</span>
              <span className={styles.who}>{step.who}</span>
            </p>
            <p className={styles.title}>{step.title}</p>
            <p className={styles.text}>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
