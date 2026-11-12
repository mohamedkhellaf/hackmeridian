import { Popover as BasePopover } from '@base-ui/react/popover'
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { IconButton } from './Button'
import { IconClose } from './icons'
import { cx } from './internal/cx'
import { useIsPhone } from './useMediaQuery'
import styles from './Coachmark.module.css'

export type CoachmarkCloseReason = 'escape' | 'close' | 'outside'

export interface CoachmarkProps {
  open: boolean
  /** The control or group the note is about: it gets the mark around it and the note as its description. */
  target: Element | null
  /** Where the note is positioned. Default: `target`. A phone passes the tab bar to dock the note above it. */
  anchor?: Element | null
  /** "2 of 4", set beside the buttons. Left out for a note that stands alone. */
  counter?: ReactNode
  title: ReactNode
  /** The body: a sentence, or a definition list. */
  children: ReactNode
  /** A closing line in small print. */
  foot?: ReactNode
  /** Kit buttons, in reading order: the way back first, the main one last. */
  actions: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  closeLabel: string
  /** Escape (from anywhere), the close button, or a click or tap outside the note. The press outside still lands. */
  onClose: (reason: CoachmarkCloseReason) => void
  /** A ref, or `false` for a note that opens by itself and must not take focus. */
  initialFocus?: RefObject<HTMLElement | null> | false
  /** A ref, or `false` when the caller puts focus back itself. */
  finalFocus?: RefObject<HTMLElement | null> | false
  /** Changes with each note of a sequence: the note fades in at its new place while it and its buttons stay mounted. */
  stepKey?: string | number
}

const TABBABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * Tab and Shift+Tab stay on the note's own controls while focus is on the note. Base UI orders a non-modal popup
 * after its trigger; this one has no trigger, and without the loop Tab would leave for the top of the document.
 * Not a trap: Escape and the close button leave it, and a visitor who pressed in the page is on the page again.
 */
function useTabLoop(popup: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return
      const root = popup.current
      const focused = document.activeElement
      if (!root || !focused || !root.contains(focused)) return
      const items = Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter((el) => !el.hasAttribute('data-base-ui-focus-guard'))
      if (items.length === 0) return
      const at = items.indexOf(focused as HTMLElement)
      const next = event.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === -1 || at === items.length - 1 ? 0 : at + 1
      event.preventDefault()
      items[next].focus()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [popup, active])
}

/**
 * While the note is open its target carries `data-coach-target` (the ruled mark, drawn by the stylesheet) and
 * the note's body as one more token of `aria-describedby`. One token is appended and the same token removed:
 * the attribute may hold others (a button's disabled reason).
 */
function useTargetMark(target: Element | null, describedBy: string, active: boolean): void {
  useEffect(() => {
    if (!active || !target) return
    target.setAttribute('data-coach-target', target.getAttribute('data-tour-ring') === 'inset' ? 'inset' : '')
    const tokens = (target.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    if (!tokens.includes(describedBy)) target.setAttribute('aria-describedby', [...tokens, describedBy].join(' '))
    return () => {
      target.removeAttribute('data-coach-target')
      const rest = (target.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((token) => token && token !== describedBy)
      if (rest.length > 0) target.setAttribute('aria-describedby', rest.join(' '))
      else target.removeAttribute('aria-describedby')
    }
  }, [target, describedBy, active])
}

/**
 * A note anchored to a control it did not create, saying what that control does: a small non-modal dialog with a
 * ruled mark around the control. The page stays fully usable: no scrim, no scroll lock, nothing hidden from
 * assistive technology. It knows nothing of steps or storage; the tour drives it.
 */
export function Coachmark({
  open,
  target,
  anchor,
  counter,
  title,
  children,
  foot,
  actions,
  side = 'bottom',
  align = 'start',
  closeLabel,
  onClose,
  initialFocus,
  finalFocus,
  stepKey,
}: CoachmarkProps) {
  const popup = useRef<HTMLDivElement | null>(null)
  const counterId = useId()
  const bodyId = useId()
  const footId = useId()
  const phone = useIsPhone()
  const shown = open && target !== null

  // The fade between two notes of a sequence. The two values name two identical animations, so a change of
  // step restarts it; a note that has just opened has none and uses the popup's entrance.
  const [step, setStep] = useState<{ key: string | number | undefined; turn: 'a' | 'b' | null }>({ key: stepKey, turn: null })
  if (!shown && (step.turn !== null || step.key !== stepKey)) setStep({ key: stepKey, turn: null })
  else if (shown && step.key !== stepKey) setStep({ key: stepKey, turn: step.turn === 'a' ? 'b' : 'a' })

  useTabLoop(popup, shown)
  useTargetMark(target, bodyId, shown)

  // A real click or tap outside the note ends it. The click is not stopped: it still does what it was for.
  // Judged on `click`, never on pointer-down: a finger that scrolls the page fires no click.
  useEffect(() => {
    if (!shown) return
    const onClick = (event: MouseEvent) => {
      const at = event.target as Node | null
      if (at && popup.current?.contains(at)) return
      onClose('outside')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [shown, onClose])

  return (
    <BasePopover.Root
      open={shown}
      modal={false}
      onOpenChange={(next, details) => {
        if (next) return
        if (details.reason === 'escape-key') onClose('escape')
        // Every other reason is ignored: Base UI reports a touch that starts a scroll as a press outside, and
        // focus leaving the note is not a reason to take it away.
      }}
    >
      <BasePopover.Portal>
        <BasePopover.Positioner className={styles.positioner} anchor={anchor ?? target} side={side} align={align} sideOffset={12} collisionPadding={12} positionMethod="fixed" sticky>
          <BasePopover.Popup
            ref={popup}
            className={styles.popup}
            data-coachmark=""
            data-turn={step.turn ?? undefined}
            data-self-opened={initialFocus === false || undefined}
            aria-describedby={cx(counter ? counterId : undefined, bodyId, foot ? footId : undefined)}
            initialFocus={initialFocus}
            finalFocus={finalFocus}
          >
            <div className={styles.head}>
              <BasePopover.Title className={styles.title}>{title}</BasePopover.Title>
              <IconButton className={styles.close} label={closeLabel} icon={<IconClose />} variant="quiet" size={phone ? 'md' : 'sm'} tooltip={false} onClick={() => onClose('close')} />
            </div>
            <BasePopover.Description id={bodyId} className={styles.body} render={<div />}>
              {children}
            </BasePopover.Description>
            {foot ? (
              <p id={footId} className={styles.foot}>
                {foot}
              </p>
            ) : null}
            <div className={styles.bar}>
              {counter ? (
                <p id={counterId} className={styles.counter}>
                  {counter}
                </p>
              ) : null}
              <div className={styles.actions}>{actions}</div>
            </div>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
}
