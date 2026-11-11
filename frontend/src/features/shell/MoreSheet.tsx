import { useId } from 'react'
import type { KeyboardEvent } from 'react'
import { PRO_ENABLED } from '../../core/config'
import { IconChevronRight, Sheet } from '../../ui'
import { SETTINGS_TITLE } from './copy'
import { GuideSheetRow } from './GuideEntry'
import { moreNav, nextMenuIndex } from './nav'
import { RouteLink } from './RouteLink'
import { SECTION_ICON } from './sectionIcons'
import { SettingsControls } from './Settings'
import styles from './MoreSheet.module.css'

/** Arrow keys, Home and End move between the pages of the list; Tab leaves it for the settings. */
function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
  const next = nextMenuIndex(event.key, items.indexOf(document.activeElement as HTMLElement), items.length)
  if (next === null) return
  event.preventDefault()
  items[next]?.focus()
}

export interface MoreSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * What the fifth tab opens on phones: the pages that have no tab (Learn, Margin, Issuer, Activity) as a menu of
 * links, and the display settings the desktop bar keeps in its settings menu.
 */
export function MoreSheet({ open, onOpenChange }: MoreSheetProps) {
  const settingsId = useId()
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="More">
      <ul role="menu" aria-label="More pages" className={styles.links} onKeyDown={onListKeyDown}>
        {moreNav(PRO_ENABLED).map((entry, index) => {
          const Icon = SECTION_ICON[entry.id]
          return (
            <li key={entry.id} role="none">
              <RouteLink to={entry.to} role="menuitem" tabIndex={index === 0 ? 0 : -1} className={styles.link} onClick={() => onOpenChange(false)}>
                <Icon size={20} />
                <span className={styles.linkText}>{entry.label}</span>
                <IconChevronRight className={styles.chevron} />
              </RouteLink>
            </li>
          )
        })}
      </ul>
      <GuideSheetRow className={styles.link} onClose={() => onOpenChange(false)} />
      <section className={styles.section} aria-labelledby={settingsId}>
        <h3 id={settingsId} className={styles.heading}>
          {SETTINGS_TITLE}
        </h3>
        <SettingsControls />
      </section>
    </Sheet>
  )
}
