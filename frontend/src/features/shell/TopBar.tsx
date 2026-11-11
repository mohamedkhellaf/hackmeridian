import { PRO_ENABLED } from '../../core/config'
import { guideAnchor } from '../../core/guide'
import { Badge, IconChevronDown, Mark, Menu, MenuLinkItem, Wordmark } from '../../ui'
import { PRIMARY_NAV, actionsWaitingLabel, containsSection, moreNav, secondaryNav } from './nav'
import type { NavEntry } from './nav'
import { NetworkIndicator } from './NetworkIndicator'
import { RouteLink } from './RouteLink'
import { SECTION_ICON } from './sectionIcons'
import { SettingsMenu } from './Settings'
import type { Tier } from './useTier'
import { useWide } from './useTier'
import { WalletButton } from './WalletButton'
import styles from './TopBar.module.css'

/** A link of the bar. The router sets `aria-current="page"` on the link of the current section. */
function NavItem({ entry, count = 0 }: { entry: NavEntry; count?: number }) {
  return (
    <li>
      <RouteLink to={entry.to} className={styles.navLink}>
        <span className={styles.navLabel}>{entry.label}</span>
        {count > 0 ? <Badge count={count} label={actionsWaitingLabel(count)} /> : null}
      </RouteLink>
    </li>
  )
}

/** Between 768 and 899 px the pages past the main four fold into one menu, so every destination stays in the bar. */
function MoreMenu({ entries, current }: { entries: readonly NavEntry[]; current: boolean }) {
  return (
    <Menu
      align="end"
      trigger={
        <button type="button" className={styles.navLink} aria-current={current ? 'true' : undefined}>
          <span className={styles.navLabel}>More</span>
          <IconChevronDown size={12} />
        </button>
      }
    >
      {entries.map((entry) => {
        const Icon = SECTION_ICON[entry.id]
        return (
          <MenuLinkItem key={entry.id} render={<RouteLink to={entry.to} />} icon={<Icon />}>
            {entry.label}
          </MenuLinkItem>
        )
      })}
    </Menu>
  )
}

/**
 * What stands in for the bar if it fails while rendering: the logo and the four main sections as plain links
 * (a full page load each), so a page is never left without a way on. No wallet, no settings.
 */
export function TopBarFallback() {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <a href="/" className={styles.brand} aria-label="StellSec home">
          <Mark size={24} />
        </a>
        <nav aria-label="Main" className={styles.primary}>
          <ul role="list" className={styles.links}>
            {PRIMARY_NAV.map((entry) => (
              <li key={entry.id}>
                <a href={entry.to} className={styles.navLink}>
                  {entry.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

export interface TopBarProps {
  tier: Tier
  pathname: string
  /** Actions waiting for the connected wallet: the count beside Portfolio. */
  actionsWaiting: number
}

/**
 * The top bar. From 900 px: the logo, the four main sections, then Learn and Margin, the network, settings and the
 * wallet. From 768 to 899 px Learn, Margin, Issuer and Activity fold into "More". Phones keep the logo, the network
 * and the wallet; the sections move to the tab bar at the bottom, which names the current one.
 */
export function TopBar({ tier, pathname, actionsWaiting }: TopBarProps) {
  const phone = tier === 'phone'
  const wide = useWide()
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <RouteLink to="/" className={styles.brand} aria-label="StellSec home">
          <Mark size={24} />
          <Wordmark className={styles.wordmark} />
        </RouteLink>

        {phone ? null : (
          <nav aria-label="Main" className={styles.primary} {...guideAnchor('nav')}>
            <ul role="list" className={styles.links}>
              {PRIMARY_NAV.map((entry) => (
                <NavItem key={entry.id} entry={entry} count={entry.id === 'portfolio' ? actionsWaiting : 0} />
              ))}
            </ul>
          </nav>
        )}

        <div className={styles.tools}>
          {tier === 'desktop' ? (
            <nav aria-label="Secondary">
              <ul role="list" className={styles.links}>
                {secondaryNav(PRO_ENABLED).map((entry) => (
                  <NavItem key={entry.id} entry={entry} />
                ))}
              </ul>
            </nav>
          ) : null}
          {tier === 'tablet' ? <MoreMenu entries={moreNav(PRO_ENABLED)} current={containsSection(moreNav(PRO_ENABLED), pathname)} /> : null}
          <NetworkIndicator compact={!wide} />
          {phone ? null : <SettingsMenu />}
          <WalletButton tier={tier} />
        </div>
      </div>
    </header>
  )
}
