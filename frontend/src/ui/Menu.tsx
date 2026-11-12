import { Menu as BaseMenu } from '@base-ui/react/menu'
import type { ReactElement, ReactNode } from 'react'
import { IconCheck, IconExternal } from './icons'
import { cx } from './internal/cx'
import popup from './internal/popup.module.css'

export interface MenuProps {
  /** A button. Activating it opens the menu; arrow keys move, Enter chooses, Escape closes and returns focus. */
  trigger: ReactElement<Record<string, unknown>>
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** `tall` lets a menu with many 44 px rows (the wallet menu on phones) use most of the viewport before it scrolls. */
  size?: 'default' | 'tall'
  /** A class for the popup, for a width of its own. */
  popupClassName?: string
}

export function Menu({ trigger, children, side = 'bottom', align = 'end', open, onOpenChange, size = 'default', popupClassName }: MenuProps) {
  return (
    <BaseMenu.Root modal={false} open={open} onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner className={popup.positioner} side={side} align={align} sideOffset={6} collisionPadding={8}>
          <BaseMenu.Popup className={cx(popup.popup, popupClassName)} data-size={size === 'tall' ? 'tall' : undefined}>
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}

export interface MenuItemProps {
  onSelect?: () => void
  children: ReactNode
  icon?: ReactNode
  /** Secondary text on the right (a balance, a shortcut). */
  detail?: ReactNode
  tone?: 'default' | 'danger'
  disabled?: boolean
  /** Keep the menu open after the choice. */
  keepOpen?: boolean
}

export function MenuItem({ onSelect, children, icon, detail, tone = 'default', disabled, keepOpen = false }: MenuItemProps) {
  return (
    <BaseMenu.Item
      className={popup.item}
      data-tone={tone === 'danger' ? 'danger' : undefined}
      disabled={disabled}
      closeOnClick={!keepOpen}
      onClick={() => onSelect?.()}
    >
      {icon ? <span className={popup.indicatorSlot}>{icon}</span> : null}
      <span className={popup.itemText}>{children}</span>
      {detail ? <span className={popup.itemDetail}>{detail}</span> : null}
    </BaseMenu.Item>
  )
}

export interface MenuLinkItemProps {
  href?: string
  /** Replace the anchor with a router link: `render={<RouterLink to="/activity" />}`. */
  render?: ReactElement<Record<string, unknown>>
  /** Opens in a new tab and says so. */
  external?: boolean
  children: ReactNode
  icon?: ReactNode
}

export function MenuLinkItem({ href, render, external = false, children, icon }: MenuLinkItemProps) {
  return (
    <BaseMenu.LinkItem
      className={popup.item}
      href={href}
      render={render}
      closeOnClick
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {icon ? <span className={popup.indicatorSlot}>{icon}</span> : null}
      <span className={popup.itemText}>
        {children}
        {external ? <span className="ui-vh"> (opens in a new tab)</span> : null}
      </span>
      {external ? (
        <span className={popup.itemDetail}>
          <IconExternal size={14} />
        </span>
      ) : null}
    </BaseMenu.LinkItem>
  )
}

export interface MenuStaticProps {
  children: ReactNode
  className?: string
}

/**
 * Plain content inside a menu group (balances, a fact), starting where the words of the items start. It is not
 * an item: it takes no focus, the arrow keys skip it and assistive technology does not see it, so the group's
 * label must say the same thing for screen readers.
 */
export function MenuStatic({ children, className }: MenuStaticProps) {
  return (
    <div className={cx(popup.static, className)} aria-hidden="true">
      {children}
    </div>
  )
}

export function MenuSeparator() {
  return <BaseMenu.Separator className={popup.separator} />
}

export interface MenuGroupProps {
  label: ReactNode
  children: ReactNode
}

export function MenuGroup({ label, children }: MenuGroupProps) {
  return (
    <BaseMenu.Group>
      <BaseMenu.GroupLabel className={popup.groupLabel}>{label}</BaseMenu.GroupLabel>
      {children}
    </BaseMenu.Group>
  )
}

export interface MenuRadioGroupProps<V extends string = string> {
  label: ReactNode
  value: V
  onValueChange: (value: V) => void
  children: ReactNode
}

/** A single choice inside a menu (theme, density). The chosen row carries a tick and is announced as checked. */
export function MenuRadioGroup<V extends string = string>({ label, value, onValueChange, children }: MenuRadioGroupProps<V>) {
  return (
    <BaseMenu.Group>
      <BaseMenu.GroupLabel className={popup.groupLabel}>{label}</BaseMenu.GroupLabel>
      <BaseMenu.RadioGroup value={value} onValueChange={(next) => onValueChange(next as V)}>
        {children}
      </BaseMenu.RadioGroup>
    </BaseMenu.Group>
  )
}

export interface MenuRadioItemProps {
  value: string
  children: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export function MenuRadioItem({ value, children, icon, disabled }: MenuRadioItemProps) {
  return (
    <BaseMenu.RadioItem className={popup.item} value={value} disabled={disabled} closeOnClick={false}>
      <span className={popup.indicatorSlot}>
        <BaseMenu.RadioItemIndicator>
          <IconCheck />
        </BaseMenu.RadioItemIndicator>
      </span>
      <span className={cx(popup.itemText)}>{children}</span>
      {icon ? <span className={popup.itemDetail}>{icon}</span> : null}
    </BaseMenu.RadioItem>
  )
}
