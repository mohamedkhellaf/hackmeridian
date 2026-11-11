import { Popover as BasePopover } from '@base-ui/react/popover'
import type { ReactElement, ReactNode } from 'react'
import { cx } from './internal/cx'
import styles from './Popover.module.css'

export interface PopoverProps {
  /** A button. Its purpose is to open this popover. */
  trigger: ReactElement<Record<string, unknown>>
  title?: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Also opens on hover (an info point). Touch and keyboard users still open it by activating the trigger. */
  openOnHover?: boolean
  className?: string
}

/** A small panel anchored to its trigger: an explanation, an exact value, a short form. Escape or a press outside closes it. */
export function Popover({
  trigger,
  title,
  children,
  side = 'bottom',
  align = 'start',
  open,
  onOpenChange,
  openOnHover = false,
  className,
}: PopoverProps) {
  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}>
      <BasePopover.Trigger render={trigger} openOnHover={openOnHover} delay={200} closeDelay={120} />
      <BasePopover.Portal>
        <BasePopover.Positioner className={styles.positioner} side={side} align={align} sideOffset={8} collisionPadding={12}>
          <BasePopover.Popup className={cx(styles.popup, className)}>
            {title ? <BasePopover.Title className={styles.title}>{title}</BasePopover.Title> : null}
            <div className={styles.body}>{children}</div>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
}
