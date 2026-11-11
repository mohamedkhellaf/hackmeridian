import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { usePro } from '../../../data'
import { Button, Dialog } from '../../../ui'
import { useMarginUi } from './marginUi'
import { UNSETTLED_REASON, UnsettledNote } from './UnsettledNote'
import css from './ConfirmDialog.module.css'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** One sentence under the title: what the call does. */
  description?: ReactNode
  /** The facts the decision rests on (a KeyValue), then any note. */
  children?: ReactNode
  /** The action button keeps the name of the action: "Take over to the vault". */
  confirmLabel: string
  /** Starts the call. The dialog closes at once; the result region shows progress and the outcome. */
  onConfirm: () => void
  /** For a call that cannot be undone and takes something over (liquidation): opens on Cancel. */
  destructive?: boolean
  /** Blocks the action with its reason. */
  blocked?: string | null
  /**
   * The model already expects the contract to refuse this call (the dialog says why): the action is no longer the
   * primary one and reads "Try anyway". Nothing is taken away: the call can still be made.
   */
  expectRefusal?: boolean
}

/**
 * One confirmation before a Margin call that cannot be undone: early exercise, a takeover, an LP deposit.
 * Never stacked: it closes before the call runs. Cancel returns focus to the button that opened it; going
 * ahead sends focus to the result (see MarginUiProvider).
 */
export function ConfirmDialog({ open, onClose, title, description, children, confirmLabel, onConfirm, destructive = false, blocked, expectRefusal = false }: ConfirmDialogProps) {
  const { busy, canCheckAgain } = usePro()
  const { canAct, connect } = useMarginUi()
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  // Going ahead hands focus to the result region (MarginUiProvider), so the dialog must not send it back to the
  // button that opened it, which is disabled while the call runs. Cancel and Escape return to that button.
  const [wentAhead, setWentAhead] = useState(false)
  if (open && wentAhead) setWentAhead(false)
  return (
    <Dialog
      open={open}
      finalFocus={wentAhead ? false : undefined}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={title}
      description={description}
      role={destructive ? 'alertdialog' : 'dialog'}
      initialFocus={destructive ? cancelRef : 'title'}
      footer={
        <>
          <Button ref={cancelRef} onClick={onClose}>
            Cancel
          </Button>
          {canAct ? (
            <Button
              variant={expectRefusal ? 'secondary' : 'primary'}
              disabled={busy || !!blocked || canCheckAgain}
              disabledReason={blocked ?? (busy ? 'Another call is in progress.' : canCheckAgain ? UNSETTLED_REASON : undefined)}
              onClick={() => {
                setWentAhead(true)
                onClose()
                onConfirm()
              }}
            >
              {expectRefusal ? 'Try anyway' : confirmLabel}
            </Button>
          ) : (
            <Button variant="primary" onClick={connect}>
              Connect wallet
            </Button>
          )}
        </>
      }
    >
      <div className={css.body}>
        <UnsettledNote />
        {children}
      </div>
    </Dialog>
  )
}
