import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import { useId } from 'react'
import type { OverlayProps } from './Dialog'
import { cx } from './internal/cx'
import { OverlayFrame } from './internal/OverlayFrame'
import { resolveInitialFocus } from './internal/overlayFocus'
import styles from './Drawer.module.css'

const PARTS = { Title: BaseDrawer.Title, Description: BaseDrawer.Description, Close: BaseDrawer.Close }

export type DrawerProps = OverlayProps

/**
 * A panel that slides in from the right (420 px). It carries the order ticket between 768 and 1199 px.
 * Modal: focus is trapped, Escape closes it, focus returns to the opener. It can be swiped away to the right;
 * the close button is the alternative to the gesture.
 */
export function Drawer(props: DrawerProps) {
  return <SlidingPanel {...props} placement="right" />
}

export type SheetProps = OverlayProps

/**
 * A bottom sheet for phones, for short confirmations only (exercise, cancel, wallet, More).
 * Flows with inputs and a review step are full pages on phones, not sheets.
 */
export function Sheet(props: SheetProps) {
  return <SlidingPanel {...props} placement="bottom" />
}

function SlidingPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  initialFocus = 'title',
  finalFocus,
  dismissible = true,
  closeLabel = 'Close',
  className,
  placement,
}: OverlayProps & { placement: 'right' | 'bottom' }) {
  const titleId = useId()
  const bodyId = useId()
  return (
    <BaseDrawer.Root
      open={open}
      onOpenChange={(next) => onOpenChange(next)}
      swipeDirection={placement === 'right' ? 'right' : 'down'}
      disablePointerDismissal={!dismissible}
    >
      <BaseDrawer.Portal>
        <BaseDrawer.Backdrop className={styles.backdrop} />
        <BaseDrawer.Viewport className={styles.viewport} data-placement={placement}>
          <BaseDrawer.Popup
            className={cx(styles.popup, className)}
            data-placement={placement}
            initialFocus={resolveInitialFocus(initialFocus, titleId, bodyId)}
            finalFocus={finalFocus}
          >
            <BaseDrawer.Content className={styles.content}>
              <OverlayFrame
                parts={PARTS}
                title={title}
                description={description}
                footer={footer}
                closeLabel={closeLabel}
                titleId={titleId}
                bodyId={bodyId}
                handle={placement === 'bottom'}
              >
                {children}
              </OverlayFrame>
            </BaseDrawer.Content>
          </BaseDrawer.Popup>
        </BaseDrawer.Viewport>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  )
}
