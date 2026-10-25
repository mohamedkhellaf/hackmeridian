import { useEffect, useId, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Icon } from './Icon'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog. Centered on desktop, bottom sheet on <= 640px (CSS only).
 * Escape and backdrop click call `onClose`; focus moves inside on open, is trapped with Tab, and is restored on close.
 * Mount it conditionally: `{open && <Dialog ...>}`.
 */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  width = 440,
  initialFocusRef,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  /** Sticky action row (buttons). */
  footer?: ReactNode
  /** Max width in px on desktop. */
  width?: number
  /** Element to focus first; defaults to the close button. */
  initialFocusRef?: RefObject<HTMLElement | null>
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ;(initialFocusRef?.current ?? closeRef.current ?? panelRef.current)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previous?.focus?.()
    }
  }, [initialFocusRef])

  return (
    <div className="ui-dialog-backdrop" onClick={() => onClose()}>
      <div
        ref={panelRef}
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="ui-dialog-grabber" aria-hidden="true" />
        <div className="ui-dialog-head">
          <h2 id={titleId} className="ui-dialog-title">
            {title}
          </h2>
          <button ref={closeRef} type="button" className="ui-dialog-close" aria-label="Close" onClick={() => onClose()}>
            <Icon name="close" />
          </button>
        </div>
        <div className="ui-dialog-body">{children}</div>
        {footer && <div className="ui-dialog-footer">{footer}</div>}
      </div>
    </div>
  )
}
