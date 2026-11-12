// "Add the deadline to your calendar": nothing settles by itself, so the holder gets the deadline as a calendar
// file built in the page, or as a Google Calendar link they choose to open. No reminder service is promised.
import type { OptionOffer } from '../../core/options/types'
import type { Role } from '../../core/portfolio/positions'
import { Button, IconCalendar, IconCalendarAdd, IconDownload, Menu, MenuItem, MenuLinkItem, announce } from '../../ui'
import { deadlineFile, downloadFile, googleLink } from './calendar'
import { CALENDAR } from './copy'
import css from './CalendarMenu.module.css'

export function CalendarMenu({ option, role = 'holder' }: { option: OptionOffer; role?: Role }) {
  const file = deadlineFile(option, undefined, undefined, role)
  const google = googleLink(option, undefined, role)
  if (!file && !google) return null
  return (
    <div className={css.root}>
      <Menu
        align="start"
        trigger={
          <Button variant="secondary" iconStart={<IconCalendarAdd />} className={css.trigger}>
            <span className={css.long}>{CALENDAR.trigger}</span>
            <span className={css.short}>{CALENDAR.short}</span>
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
    </div>
  )
}
