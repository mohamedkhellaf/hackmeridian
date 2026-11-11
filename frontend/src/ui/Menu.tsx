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
}

export function Menu({ trigger, children, side = 'bottom', align = 'end', open, onOpenChange }: MenuProps) {
  return (
    <BaseMenu.Root modal={false} open={open} onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner className={popup.positioner} side={side} align={align} sideOffset={6} collisionPadding={8}>
          <BaseMenu.Popup className={popup.popup}>{children}</BaseMenu.Popup>
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
