import { Link as RouterLink } from '@tanstack/react-router'
import { EmptyNote, Link, PageHeader } from '../../ui'
import { COPY } from './copy'
import styles from './MockIssuer.module.css'

/**
 * The page in a build without a Testnet contract. Nothing can be read or signed, so there is no console and no
 * button that would do nothing: the page says so and explains what the console does on Testnet.
 */
export function MockIssuer() {
  const c = COPY.mock
  return (
    <div className={styles.page}>
      <PageHeader title={COPY.page.title} description={COPY.page.description} />

      <EmptyNote className={styles.note} title={c.sentence} hint={c.hint} headingLevel={2} />

      <section className={styles.section} aria-labelledby="issuer-what">
        <div className={styles.head}>
          <h2 id="issuer-what" className="ui-h2">
            {c.whatTitle}
          </h2>
          <p className={styles.lead}>{c.whatLead}</p>
        </div>
        <ul className={styles.actions}>
          {c.actions.map((action) => (
            <li key={action.name} className={styles.action}>
              <h3 className={styles.name}>{action.name}</h3>
              <div className={styles.cell}>
                <p className={styles.cellLabel}>{c.signsHeader}</p>
                <p className={styles.cellText}>{action.signs}</p>
              </div>
              <div className={styles.cell}>
                <p className={styles.cellLabel}>{c.optionsHeader}</p>
                <p className={styles.cellText}>{action.options}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.columns}>
        <section className={styles.section} aria-labelledby="issuer-reads">
          <h2 id="issuer-reads" className="ui-h2">
            {c.readsTitle}
          </h2>
          <dl className={styles.reads}>
            {c.reads.map((read) => (
              <div key={read.name} className={styles.read}>
                <dt className={styles.readName}>{read.name}</dt>
                <dd className={styles.readText}>{read.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="issuer-who">
          <h2 id="issuer-who" className="ui-h2">
            {c.whoTitle}
          </h2>
          <p className={styles.lead}>{c.who}</p>
          <ul className={styles.links}>
            <li>
              <Link render={<RouterLink to="/reserves" />}>{c.reservesLink}</Link>
            </li>
            <li>
              <Link render={<RouterLink to="/learn" hash="risks" />}>{c.learnLink}</Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
