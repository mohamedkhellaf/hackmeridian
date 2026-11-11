// The two fixed places the welcome guide can be started again: the Settings menu from 768 px, the More sheet
// under it. One label for both, the same words as the button of the welcome on Markets. They only ask through
// `useGuide()`; the tour itself is mounted by src/app.
import { GUIDE_COPY } from '../../core/guide'
import { useGuide } from '../../data'
import { IconGuide, MenuGroup, MenuItem, MenuSeparator } from '../../ui'
import styles from './GuideEntry.module.css'

/** The last group of the Settings menu: a separator, the label "Guide", one item. The menu closes on the choice. */
export function GuideMenuGroup() {
  const { start } = useGuide()
  return (
    <>
      <MenuSeparator />
      <MenuGroup label={GUIDE_COPY.group}>
        <MenuItem icon={<IconGuide />} onSelect={() => start('tour', 'replay')}>
          {GUIDE_COPY.start}
        </MenuItem>
      </MenuGroup>
    </>
  )
}

export interface GuideSheetRowProps {
  /** The class of the sheet's page rows, so this row has their look. */
  className?: string
  /** Closes the sheet. The tour starts once the sheet has gone and focus is back on the tab that opened it. */
  onClose: () => void
}

/** The row of the More sheet, under the list of pages: a button, not a page, so it carries no chevron. */
export function GuideSheetRow({ className, onClose }: GuideSheetRowProps) {
  const { start } = useGuide()
  return (
    <button
      type="button"
      className={className ? `${className} ${styles.row}` : styles.row}
      onClick={() => {
        onClose()
        start('tour', 'replay')
      }}
    >
      <IconGuide size={20} />
      <span>{GUIDE_COPY.start}</span>
    </button>
  )
}
