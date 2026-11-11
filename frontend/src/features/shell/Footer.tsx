import { PRO_ENABLED, config } from '../../core/config'
import { COPYRIGHT_NOTICE, LEGAL_NOTICE } from '../../core/disclosures'
import { explorerContract } from '../../core/explorer'
import { Address, Link } from '../../ui'
import { REPOSITORY_URL } from '../../core/links'
import { FOOTER_NAV } from './nav'
import { RouteLink } from './RouteLink'
import styles from './Footer.module.css'

function ContractLine({ label, id }: { label: string; id: string }) {
  const name = label.toLowerCase()
  return (
    <p className={styles.contract}>
      <span>{label}</span>
      <Address value={id} length="medium" explorerUrl={explorerContract(id)} explorerLabel={`View the ${name} on the explorer`} copyLabel={`Copy the ${name} id`} />
    </p>
  )
}

export interface FooterViewProps {
  /** The Covered contract id. A build without one runs on mock data and has no contract to show. */
  coveredId?: string
  /** The Margin contract id, when Margin is enabled and runs against a contract. */
  marginId?: string
}

/** The footer from plain props (the specimens show the variant with contract ids). */
export function FooterView({ coveredId, marginId }: FooterViewProps) {
  return (
    <footer className={`shell-footer ${styles.footer}`}>
      <div className={styles.inner}>
        <div className={styles.notice}>
          <p className={styles.copyright}>{COPYRIGHT_NOTICE}</p>
          <p className={styles.legal}>{LEGAL_NOTICE}</p>
        </div>
        <div className={styles.aside}>
          <nav aria-label="Footer">
            <ul role="list" className={styles.links}>
              {FOOTER_NAV.map((entry) => (
                <li key={entry.id}>
                  <Link tone="quiet" render={<RouteLink to={entry.to} />}>
                    {entry.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link tone="quiet" href={REPOSITORY_URL} external>
                  GitHub
                </Link>
              </li>
            </ul>
          </nav>
          {coveredId ? <ContractLine label={marginId ? 'Covered contract' : 'Contract'} id={coveredId} /> : null}
          {marginId ? <ContractLine label="Margin contract" id={marginId} /> : null}
        </div>
      </div>
    </footer>
  )
}

/**
 * The footer of every app route, a conventional one: the copyright line, the legal notice in small print, the
 * links, and the contract id with copy and a link to the explorer. Nothing else belongs at the bottom of a page.
 * The class `shell-footer` is a structural contract: tests look for it.
 */
export function Footer() {
  return <FooterView coveredId={config.optionsContractId} marginId={PRO_ENABLED ? config.proContractId : undefined} />
}
