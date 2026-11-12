import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'
import styles from './Tooltip.module.css'

export interface TooltipProviderProps {
  children: ReactNode
  /** Hover delay before the first tooltip opens. */
  delay?: number
}

/** Mount once around the app so neighbouring tooltips open without delay after the first one. */
export function TooltipProvider({ children, delay = 400 }: TooltipProviderProps) {
  return (
    <BaseTooltip.Provider delay={delay} closeDelay={0}>
      {children}
    </BaseTooltip.Provider>
  )
}

export interface TooltipProps {
  /** A short label. Never essential information: touch users do not get tooltips. */
  content: ReactNode
  /** One focusable element (a button or a link). */
  children: ReactElement<Record<string, unknown>>
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  disabled?: boolean
  /** Controlled open state, for a tooltip that also opens on a tap (the reason of a disabled button). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Keep the same element tree while the tooltip comes and goes (disabled, or no content): the child is never
   * remounted, so a focused button keeps its focus when its tooltip appears or leaves.
   */
  stable?: boolean
}

export function Tooltip({ content, children, side = 'top', align = 'center', disabled = false, open, onOpenChange, stable = false }: TooltipProps) {
  const off = disabled || content === null || content === undefined || content === ''
  if (off && !stable) return children
  return (
    <BaseTooltip.Root disabled={off} open={off ? false : open} onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner className={styles.positioner} side={side} align={align} sideOffset={6}>
          <BaseTooltip.Popup className={styles.popup}>{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
