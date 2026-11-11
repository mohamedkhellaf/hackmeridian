/**
 * The only place that names Phosphor icons for the app. Icons are re-exported under domain names so a swap of the
 * icon set, or of one drawing, never touches a feature. Weight follows size: Regular at 16 px, Light from 20 px up.
 * Icons are decorative by default (`aria-hidden`); pass `label` only when no text sits next to the icon.
 * Each icon is its own module (`src/ui/iconset/`), so a chunk carries only the drawings it uses, not all of them.
 */
export type { IconComponent, IconProps } from './iconset/factory'

/* Actions */
export { IconCopy } from './iconset/IconCopy'
export { IconCheck } from './iconset/IconCheck'
export { IconClose } from './iconset/IconClose'
export { IconExternal } from './iconset/IconExternal'
export { IconRefresh } from './iconset/IconRefresh'
export { IconSearch } from './iconset/IconSearch'
export { IconFilter } from './iconset/IconFilter'
export { IconPlus } from './iconset/IconPlus'
export { IconMinus } from './iconset/IconMinus'
export { IconEdit } from './iconset/IconEdit'
export { IconTrash } from './iconset/IconTrash'
export { IconDownload } from './iconset/IconDownload'
export { IconBack } from './iconset/IconBack'
export { IconMenu } from './iconset/IconMenu'
export { IconMore } from './iconset/IconMore'
export { IconCalendar } from './iconset/IconCalendar'
export { IconCalendarAdd } from './iconset/IconCalendarAdd'

/* Carets */
export { IconChevronDown } from './iconset/IconChevronDown'
export { IconChevronUp } from './iconset/IconChevronUp'
export { IconChevronLeft } from './iconset/IconChevronLeft'
export { IconChevronRight } from './iconset/IconChevronRight'
export { IconSelect } from './iconset/IconSelect'

/* Status. Always next to a word. */
export { IconInfo } from './iconset/IconInfo'
export { IconWarning } from './iconset/IconWarning'
export { IconDanger } from './iconset/IconDanger'
export { IconSuccess } from './iconset/IconSuccess'
export { IconFailed } from './iconset/IconFailed'
export { IconUnknown } from './iconset/IconUnknown'
export { IconDeclined } from './iconset/IconDeclined'
export { IconExpired } from './iconset/IconExpired'
export { IconClock } from './iconset/IconClock'
export { IconUpcoming } from './iconset/IconUpcoming'
export { IconOffline } from './iconset/IconOffline'
export { IconLock } from './iconset/IconLock'

/* Transaction steps */
export { IconSign } from './iconset/IconSign'
export { IconSend } from './iconset/IconSend'
export { IconReceipt } from './iconset/IconReceipt'

/* Navigation and shell */
export { IconMarkets } from './iconset/IconMarkets'
export { IconPortfolio } from './iconset/IconPortfolio'
export { IconRequests } from './iconset/IconRequests'
export { IconReserves } from './iconset/IconReserves'
export { IconLearn } from './iconset/IconLearn'
export { IconIssuer } from './iconset/IconIssuer'
export { IconMargin } from './iconset/IconMargin'
export { IconActivity } from './iconset/IconActivity'
export { IconDesign } from './iconset/IconDesign'
export { IconInbox } from './iconset/IconInbox'
export { IconWallet } from './iconset/IconWallet'
export { IconDisconnect } from './iconset/IconDisconnect'
export { IconUser } from './iconset/IconUser'
export { IconSettings } from './iconset/IconSettings'
export { IconGuide } from './iconset/IconGuide'
export { IconThemeLight } from './iconset/IconThemeLight'
export { IconThemeDark } from './iconset/IconThemeDark'
export { IconThemeSystem } from './iconset/IconThemeSystem'
export { IconGithub } from './iconset/IconGithub'
