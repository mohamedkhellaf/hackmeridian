/**
 * The StellSec design system. Import from here, never from a file inside `ui/`.
 * The stylesheet comes first so the cascade layers, fonts and tokens exist before any component style.
 */
import './index.css'

export { applyDensity, applyPnlScheme, applyTheme, resolvedTheme, DENSITY_CHOICES, PNL_SCHEMES, THEME_CHOICES } from './theme'
export type { DensityChoice, PnlScheme, ThemeChoice } from './theme'

/* Actions */
export { Button, ButtonLink, IconButton } from './Button'
export type { ButtonLinkProps, ButtonProps, ButtonSize, ButtonVariant, IconButtonProps } from './Button'
export { Link } from './Link'
export type { LinkProps } from './Link'
export { CopyButton } from './CopyButton'
export type { CopyButtonProps } from './CopyButton'

/* Forms */
export { AmountField, Field, TextField } from './Field'
export type { AmountFieldProps, FieldProps, TextFieldProps } from './Field'
export { Select } from './Select'
export type { SelectOption, SelectProps } from './Select'
export { Combobox } from './Combobox'
export type { ComboboxItem, ComboboxProps } from './Combobox'
export { Checkbox } from './Checkbox'
export type { CheckboxProps } from './Checkbox'
export { RadioGroup } from './RadioGroup'
export type { RadioGroupProps, RadioOption } from './RadioGroup'
export { Segmented } from './Segmented'
export type { SegmentedOption, SegmentedProps } from './Segmented'
export { Switch } from './Switch'
export type { SwitchProps } from './Switch'
export { Slider } from './Slider'
export type { SliderProps } from './Slider'

/* Navigation */
export { NavTab, NavTabs, Tab, TabList, TabPanel, Tabs } from './Tabs'
export type { NavTabProps, NavTabsProps, TabListProps, TabPanelProps, TabProps, TabsProps } from './Tabs'
export { PageHeader, SkipLink } from './PageHeader'
export type { PageHeaderProps, SkipLinkProps } from './PageHeader'

/* Overlays */
export { Tooltip, TooltipProvider } from './Tooltip'
export type { TooltipProps, TooltipProviderProps } from './Tooltip'
export { Popover } from './Popover'
export type { PopoverProps } from './Popover'
export { Menu, MenuGroup, MenuItem, MenuLinkItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from './Menu'
export type { MenuGroupProps, MenuItemProps, MenuLinkItemProps, MenuProps, MenuRadioGroupProps, MenuRadioItemProps } from './Menu'
export { Dialog } from './Dialog'
export type { DialogProps, InitialFocus, OverlayProps } from './Dialog'
export { Drawer, Sheet } from './Drawer'
export type { DrawerProps, SheetProps } from './Drawer'

/* Feedback */
export { ToastRegion } from './Toast'
export type { ToastRegionProps } from './Toast'
export { clearToasts, dismissToast, toast } from './toastStore'
export type { ToastAction, ToastOptions, ToastTone } from './toastStore'
export { LiveRegions } from './LiveRegions'
export { announce } from './announce'
export type { Politeness } from './announce'
export { Callout } from './Callout'
export type { CalloutProps, CalloutVariant } from './Callout'
export { Skeleton } from './Skeleton'
export type { SkeletonProps } from './Skeleton'
export { Spinner } from './Spinner'
export type { SpinnerProps } from './Spinner'
export { Stepper, TxStepper } from './Stepper'
export type { StepItem, StepperProps, StepStatus, TxStage, TxStepperProps } from './Stepper'
export { TX_STATES, TX_STATE_LABEL } from './txStates'
export type { TxState } from './txStates'
export { Timeline } from './Timeline'
export type { TimelineItem, TimelineProps } from './Timeline'

/* Data display */
export { Tag } from './Tag'
export type { TagAppearance, TagProps } from './Tag'
export { Badge } from './Badge'
export type { BadgeProps } from './Badge'
export { RowHeader, Table, TableWrap, TBody, Td, Th, THead, Tr } from './Table'
export type { SortDirection, TableProps, TableWrapProps, TdProps, ThProps, TrProps } from './Table'
export { KeyValue, KeyValueItem } from './KeyValue'
export type { KeyValueItemProps, KeyValueProps } from './KeyValue'
export { Stat } from './Stat'
export type { StatProps } from './Stat'
export { Card } from './Card'
export type { CardProps } from './Card'
export { Amount } from './Amount'
export type { AmountProps } from './Amount'
export { Address, TxLink } from './Address'
export type { AddressProps, TxLinkProps } from './Address'
export { Countdown, DateTime } from './DateTime'
export type { CountdownProps, DateTimeProps } from './DateTime'

/* Signature pieces */
export { ContractNote, EmptyNote } from './ContractNote'
export type { ContractNoteProps, EmptyNoteProps, NoteTerm } from './ContractNote'
export { Marker } from './Marker'
export type { MarkerProps } from './Marker'
export { Glyph } from './glyphs/Glyph'
export type { GlyphProps } from './glyphs/Glyph'
export { DOMAIN_GLYPHS, PAYOFF_GLYPHS } from './glyphs/names'
export type { DomainGlyph, GlyphName, PayoffGlyph } from './glyphs/names'
export { Logo, Mark, Wordmark } from './brand/Mark'
export type { LogoProps, MarkCut, MarkProps, WordmarkProps } from './brand/Mark'

/* Accessibility helpers */
export { VisuallyHidden } from './VisuallyHidden'
export type { VisuallyHiddenProps } from './VisuallyHidden'

/* Pure helpers */
export {
  countdownParts,
  formatCountdown,
  formatCountdownWords,
  formatLocalTime,
  formatUtcDateTime,
  groupAddress,
  sanitizeDecimalInput,
  shortenAddress,
  shortenHash,
  toIsoUtc,
} from './format'
export type { AddressLength, CountdownParts, DateInput, UtcFormat } from './format'

export { contrastRatio, formatRatio, parseColor } from './tokens/contrast'

export * from './icons'
