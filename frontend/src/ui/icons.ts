/**
 * The only place that imports Phosphor. Icons are re-exported under domain names so a swap of the icon set, or of
 * one drawing, never touches a feature. Weight follows size: Regular at 16 px, Light from 20 px up.
 * Icons are decorative by default (`aria-hidden`); pass `label` only when no text sits next to the icon.
 * Each export is marked pure so an icon that no chunk uses is dropped from that chunk.
 */
import { createElement } from 'react'
import type { ReactElement, SVGAttributes } from 'react'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { ArrowClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowClockwise'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft'
import { ArrowSquareOutIcon } from '@phosphor-icons/react/dist/csr/ArrowSquareOut'
import { BookOpenIcon } from '@phosphor-icons/react/dist/csr/BookOpen'
import { BriefcaseIcon } from '@phosphor-icons/react/dist/csr/Briefcase'
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/csr/CalendarBlank'
import { CalendarPlusIcon } from '@phosphor-icons/react/dist/csr/CalendarPlus'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { CaretUpIcon } from '@phosphor-icons/react/dist/csr/CaretUp'
import { CaretUpDownIcon } from '@phosphor-icons/react/dist/csr/CaretUpDown'
import { ChartLineIcon } from '@phosphor-icons/react/dist/csr/ChartLine'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { CircleDashedIcon } from '@phosphor-icons/react/dist/csr/CircleDashed'
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock'
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { DesktopIcon } from '@phosphor-icons/react/dist/csr/Desktop'
import { DotsThreeIcon } from '@phosphor-icons/react/dist/csr/DotsThree'
import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/csr/DownloadSimple'
import { FunnelIcon } from '@phosphor-icons/react/dist/csr/Funnel'
import { GithubLogoIcon } from '@phosphor-icons/react/dist/csr/GithubLogo'
import { HandCoinsIcon } from '@phosphor-icons/react/dist/csr/HandCoins'
import { HourglassIcon } from '@phosphor-icons/react/dist/csr/Hourglass'
import { InfoIcon } from '@phosphor-icons/react/dist/csr/Info'
import { ListIcon } from '@phosphor-icons/react/dist/csr/List'
import { LockIcon } from '@phosphor-icons/react/dist/csr/Lock'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { MinusIcon } from '@phosphor-icons/react/dist/csr/Minus'
import { MoonIcon } from '@phosphor-icons/react/dist/csr/Moon'
import { PaletteIcon } from '@phosphor-icons/react/dist/csr/Palette'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { ProhibitIcon } from '@phosphor-icons/react/dist/csr/Prohibit'
import { QuestionIcon } from '@phosphor-icons/react/dist/csr/Question'
import { ReceiptIcon } from '@phosphor-icons/react/dist/csr/Receipt'
import { ScalesIcon } from '@phosphor-icons/react/dist/csr/Scales'
import { SignOutIcon } from '@phosphor-icons/react/dist/csr/SignOut'
import { SignatureIcon } from '@phosphor-icons/react/dist/csr/Signature'
import { SignpostIcon } from '@phosphor-icons/react/dist/csr/Signpost'
import { SlidersHorizontalIcon } from '@phosphor-icons/react/dist/csr/SlidersHorizontal'
import { StampIcon } from '@phosphor-icons/react/dist/csr/Stamp'
import { SunIcon } from '@phosphor-icons/react/dist/csr/Sun'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { TrayIcon } from '@phosphor-icons/react/dist/csr/Tray'
import { UserIcon } from '@phosphor-icons/react/dist/csr/User'
import { VaultIcon } from '@phosphor-icons/react/dist/csr/Vault'
import { WalletIcon } from '@phosphor-icons/react/dist/csr/Wallet'
import { WarningIcon } from '@phosphor-icons/react/dist/csr/Warning'
import { WarningOctagonIcon } from '@phosphor-icons/react/dist/csr/WarningOctagon'
import { WifiSlashIcon } from '@phosphor-icons/react/dist/csr/WifiSlash'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { XCircleIcon } from '@phosphor-icons/react/dist/csr/XCircle'

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children'> {
  /** 16 (Regular weight) in rows and buttons, 20 or more (Light weight) in navigation and callouts. */
  size?: number
  /** Accessible name. Leave out when the icon sits next to its word. */
  label?: string
}

export type IconComponent = (props: IconProps) => ReactElement

function icon(source: PhosphorIcon, name: string): IconComponent {
  function Icon({ size = 16, label, ...rest }: IconProps): ReactElement {
    return createElement(source, {
      size,
      weight: size >= 20 ? 'light' : 'regular',
      focusable: false,
      'aria-hidden': label ? undefined : true,
      'aria-label': label,
      role: label ? 'img' : undefined,
      ...rest,
    })
  }
  Icon.displayName = name
  return Icon
}

/* Actions */
export const IconCopy = /* @__PURE__ */ icon(CopyIcon, 'IconCopy')
export const IconCheck = /* @__PURE__ */ icon(CheckIcon, 'IconCheck')
export const IconClose = /* @__PURE__ */ icon(XIcon, 'IconClose')
export const IconExternal = /* @__PURE__ */ icon(ArrowSquareOutIcon, 'IconExternal')
export const IconRefresh = /* @__PURE__ */ icon(ArrowClockwiseIcon, 'IconRefresh')
export const IconSearch = /* @__PURE__ */ icon(MagnifyingGlassIcon, 'IconSearch')
export const IconFilter = /* @__PURE__ */ icon(FunnelIcon, 'IconFilter')
export const IconPlus = /* @__PURE__ */ icon(PlusIcon, 'IconPlus')
export const IconMinus = /* @__PURE__ */ icon(MinusIcon, 'IconMinus')
export const IconEdit = /* @__PURE__ */ icon(PencilSimpleIcon, 'IconEdit')
export const IconTrash = /* @__PURE__ */ icon(TrashIcon, 'IconTrash')
export const IconDownload = /* @__PURE__ */ icon(DownloadSimpleIcon, 'IconDownload')
export const IconBack = /* @__PURE__ */ icon(ArrowLeftIcon, 'IconBack')
export const IconMenu = /* @__PURE__ */ icon(ListIcon, 'IconMenu')
export const IconMore = /* @__PURE__ */ icon(DotsThreeIcon, 'IconMore')
export const IconCalendar = /* @__PURE__ */ icon(CalendarBlankIcon, 'IconCalendar')
export const IconCalendarAdd = /* @__PURE__ */ icon(CalendarPlusIcon, 'IconCalendarAdd')

/* Carets */
export const IconChevronDown = /* @__PURE__ */ icon(CaretDownIcon, 'IconChevronDown')
export const IconChevronUp = /* @__PURE__ */ icon(CaretUpIcon, 'IconChevronUp')
export const IconChevronLeft = /* @__PURE__ */ icon(CaretLeftIcon, 'IconChevronLeft')
export const IconChevronRight = /* @__PURE__ */ icon(CaretRightIcon, 'IconChevronRight')
export const IconSelect = /* @__PURE__ */ icon(CaretUpDownIcon, 'IconSelect')

/* Status. Always next to a word. */
export const IconInfo = /* @__PURE__ */ icon(InfoIcon, 'IconInfo')
export const IconWarning = /* @__PURE__ */ icon(WarningIcon, 'IconWarning')
export const IconDanger = /* @__PURE__ */ icon(WarningOctagonIcon, 'IconDanger')
export const IconSuccess = /* @__PURE__ */ icon(CheckCircleIcon, 'IconSuccess')
export const IconFailed = /* @__PURE__ */ icon(XCircleIcon, 'IconFailed')
export const IconUnknown = /* @__PURE__ */ icon(QuestionIcon, 'IconUnknown')
export const IconDeclined = /* @__PURE__ */ icon(ProhibitIcon, 'IconDeclined')
export const IconExpired = /* @__PURE__ */ icon(HourglassIcon, 'IconExpired')
export const IconClock = /* @__PURE__ */ icon(ClockIcon, 'IconClock')
export const IconUpcoming = /* @__PURE__ */ icon(CircleDashedIcon, 'IconUpcoming')
export const IconOffline = /* @__PURE__ */ icon(WifiSlashIcon, 'IconOffline')
export const IconLock = /* @__PURE__ */ icon(LockIcon, 'IconLock')

/* Transaction steps */
export const IconSign = /* @__PURE__ */ icon(SignatureIcon, 'IconSign')
export const IconSend = /* @__PURE__ */ icon(PaperPlaneTiltIcon, 'IconSend')
export const IconReceipt = /* @__PURE__ */ icon(ReceiptIcon, 'IconReceipt')

/* Navigation and shell */
export const IconMarkets = /* @__PURE__ */ icon(ChartLineIcon, 'IconMarkets')
export const IconPortfolio = /* @__PURE__ */ icon(BriefcaseIcon, 'IconPortfolio')
export const IconRequests = /* @__PURE__ */ icon(HandCoinsIcon, 'IconRequests')
export const IconReserves = /* @__PURE__ */ icon(VaultIcon, 'IconReserves')
export const IconLearn = /* @__PURE__ */ icon(BookOpenIcon, 'IconLearn')
export const IconIssuer = /* @__PURE__ */ icon(StampIcon, 'IconIssuer')
export const IconMargin = /* @__PURE__ */ icon(ScalesIcon, 'IconMargin')
export const IconActivity = /* @__PURE__ */ icon(ClockCounterClockwiseIcon, 'IconActivity')
export const IconDesign = /* @__PURE__ */ icon(PaletteIcon, 'IconDesign')
export const IconInbox = /* @__PURE__ */ icon(TrayIcon, 'IconInbox')
export const IconWallet = /* @__PURE__ */ icon(WalletIcon, 'IconWallet')
export const IconDisconnect = /* @__PURE__ */ icon(SignOutIcon, 'IconDisconnect')
export const IconUser = /* @__PURE__ */ icon(UserIcon, 'IconUser')
export const IconSettings = /* @__PURE__ */ icon(SlidersHorizontalIcon, 'IconSettings')
export const IconGuide = /* @__PURE__ */ icon(SignpostIcon, 'IconGuide')
export const IconThemeLight = /* @__PURE__ */ icon(SunIcon, 'IconThemeLight')
export const IconThemeDark = /* @__PURE__ */ icon(MoonIcon, 'IconThemeDark')
export const IconThemeSystem = /* @__PURE__ */ icon(DesktopIcon, 'IconThemeSystem')
export const IconGithub = /* @__PURE__ */ icon(GithubLogoIcon, 'IconGithub')
