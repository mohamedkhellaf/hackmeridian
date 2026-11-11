import { PRO_ENABLED } from '../../core/config'
import { Badge, IconChevronDown, Mark, Menu, MenuLinkItem, Wordmark } from '../../ui'
import { PRIMARY_NAV, actionsWaitingLabel, containsSection, moreNav, secondaryNav, sectionTitle } from './nav'
import type { NavEntry } from './nav'
import { NetworkChip } from './NetworkChip'
import { RouteLink } from './RouteLink'
import { SECTION_ICON } from './sectionIcons'
import { SettingsMenu } from './Settings'
import type { Tier } from './useTier'
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

/** Between 768 and 1199 px the right-hand links fold into one menu, so every destination stays in the bar. */
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

export interface TopBarProps {
  tier: Tier
  pathname: string
  /** Actions waiting for the connected wallet: the count beside Portfolio. */
  actionsWaiting: number
}

/**
 * The top bar. Desktop: the logo, the four main sections, then Learn, Margin, the network chip, settings and the
 * wallet. Tablet widths fold Learn and Margin into "More" and shorten the chip. Phones keep the mark, the name of
 * the section, the short chip and the wallet; the sections move to the tab bar at the bottom.
 */
export function TopBar({ tier, pathname, actionsWaiting }: TopBarProps) {
  const phone = tier === 'phone'
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <RouteLink to="/" className={styles.brand} aria-label="StellSec home">
          <Mark size={24} />
          <Wordmark className={styles.wordmark} />
        </RouteLink>

        {phone ? (
          <span className={styles.pageTitle}>{sectionTitle(pathname)}</span>
        ) : (
          <nav aria-label="Main" className={styles.primary}>
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
          <NetworkChip compact={tier !== 'desktop'} />
          {phone ? null : <SettingsMenu />}
          <WalletButton tier={tier} />
        </div>
      </div>
    </header>
  )
}
