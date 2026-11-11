// "Add the deadline to your calendar": nothing settles by itself, so the holder gets the deadline as a calendar
// file built in the page, or as a Google Calendar link they choose to open. No reminder service is promised.
import type { OptionOffer } from '../../core/options/types'
import { Button, IconCalendar, IconCalendarAdd, IconDownload, Menu, MenuItem, MenuLinkItem, announce } from '../../ui'
import { deadlineFile, downloadFile, googleLink } from './calendar'
import { CALENDAR } from './copy'
import css from './CalendarMenu.module.css'

export function CalendarMenu({ option }: { option: OptionOffer }) {
  const file = deadlineFile(option)
  const google = googleLink(option)
  if (!file && !google) return null
  return (
    <div className={css.root}>
      <Menu
        align="start"
        trigger={
          <Button variant="secondary" size="sm" iconStart={<IconCalendarAdd />}>
            {CALENDAR.trigger}
          </Button>
        }
      >
        {file ? (
          <MenuItem
            icon={<IconDownload />}
            onSelect={() => {
              if (downloadFile(file)) announce(CALENDAR.downloaded)
            }}
          >
            {CALENDAR.file}
          </MenuItem>
        ) : null}
        {google ? (
          <MenuLinkItem href={google} external icon={<IconCalendar />}>
            {CALENDAR.google}
          </MenuLinkItem>
        ) : null}
      </Menu>
      <p className={css.note}>{CALENDAR.note}</p>
    </div>
  )
}
