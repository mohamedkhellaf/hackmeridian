import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { useId } from 'react'
import type { ReactNode, RefObject } from 'react'
import { cx } from './internal/cx'
import { OverlayFrame } from './internal/OverlayFrame'
import { resolveInitialFocus } from './internal/overlayFocus'
import type { InitialFocus } from './internal/overlayFocus'
import styles from './Dialog.module.css'

export type { InitialFocus } from './internal/overlayFocus'

export interface OverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** One or two sentences under the title. Linked to the dialog as its description. */
  description?: ReactNode
  children?: ReactNode
  /** Actions. The primary action comes last in the markup; on phones it is shown first, full width. */
  footer?: ReactNode
  /** Where focus goes on open. Focus is trapped while open and returns to the opener on close. */
  initialFocus?: InitialFocus
  /** Where focus returns on close, when the opener is gone (a row that was removed). */
  finalFocus?: RefObject<HTMLElement | null>
  /** `false` stops a press outside from closing it (a typed confirmation). Escape and the close button still work. */
  dismissible?: boolean
  closeLabel?: string
  className?: string
}

export interface DialogProps extends OverlayProps {
  size?: 'sm' | 'md' | 'lg'
  /** `alertdialog` for a confirmation that interrupts (clawback, liquidation). */
  role?: 'dialog' | 'alertdialog'
}

/**
 * A modal dialog. One per flow, never stacked. Focus is trapped, the page behind is inert, Escape closes it
 * and focus returns to what opened it.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  role = 'dialog',
  initialFocus = 'title',
  finalFocus,
  dismissible = true,
  closeLabel = 'Close',
  className,
}: DialogProps) {
  const titleId = useId()
  const bodyId = useId()
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)} disablePointerDismissal={!dismissible}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={styles.backdrop} />
        <BaseDialog.Viewport className={styles.viewport}>
          <BaseDialog.Popup
            className={cx(styles.popup, className)}
            data-size={size}
            role={role}
            initialFocus={resolveInitialFocus(initialFocus, titleId, bodyId)}
            finalFocus={finalFocus}
          >
            <OverlayFrame
              parts={{ Title: BaseDialog.Title, Description: BaseDialog.Description, Close: BaseDialog.Close }}
              title={title}
              description={description}
              footer={footer}
              closeLabel={closeLabel}
              titleId={titleId}
              bodyId={bodyId}
            >
              {children}
            </OverlayFrame>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
