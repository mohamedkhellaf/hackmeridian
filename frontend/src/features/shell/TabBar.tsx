import { PRO_ENABLED } from '../../core/config'
import { guideAnchor } from '../../core/guide'
import { Badge, IconMore } from '../../ui'
import { PRIMARY_NAV, actionsWaitingLabel, containsSection, moreNav } from './nav'
import { RouteLink } from './RouteLink'
import { SECTION_ICON } from './sectionIcons'
import styles from './TabBar.module.css'

export interface TabBarProps {
  pathname: string
  actionsWaiting: number
  moreOpen: boolean
  onOpenMore: () => void
}

/**
 * The phone tab bar: four sections and More. Each tab is one word under its icon; the current one carries an ink
 * rule on top and `aria-current`. More is current while a page it holds (Learn, Margin, Issuer, Activity) is open.
 */
export function TabBar({ pathname, actionsWaiting, moreOpen, onOpenMore }: TabBarProps) {
  const moreCurrent = containsSection(moreNav(PRO_ENABLED), pathname)
  return (
    <nav aria-label="Main" className={styles.bar} {...guideAnchor('nav', { ring: 'inset' })}>
      <ul role="list" className={styles.tabs}>
        {PRIMARY_NAV.map((entry) => {
          const Icon = SECTION_ICON[entry.id]
          const count = entry.id === 'portfolio' ? actionsWaiting : 0
          return (
            <li key={entry.id}>
              <RouteLink to={entry.to} className={styles.tab}>
                {/* The label comes first in the markup, so the name starts with the destination ("Portfolio 1 action waiting"), as in the top bar; the icon is drawn above it. */}
                <span className={styles.label}>{entry.label}</span>
                <span className={styles.icon}>
                  <Icon size={20} />
                  {count > 0 ? <Badge count={count} label={actionsWaitingLabel(count)} className={styles.count} /> : null}
                </span>
              </RouteLink>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            className={styles.tab}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreCurrent ? 'true' : undefined}
            onClick={onOpenMore}
          >
            <span className={styles.icon}>
              <IconMore size={20} />
            </span>
            <span className={styles.label}>More</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
