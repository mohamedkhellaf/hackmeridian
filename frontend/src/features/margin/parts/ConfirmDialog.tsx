import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { usePro } from '../../../data'
import { Button, Dialog } from '../../../ui'
import { REPLAY_NOTE } from '../copy'
import { useMarginUi } from './marginUi'
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
}

/**
 * One confirmation before a Margin call that cannot be undone: early exercise, a takeover, an LP deposit.
 * Never stacked: it closes before the call runs. Cancel returns focus to the button that opened it; going
 * ahead sends focus to the result (see MarginUiProvider).
 */
export function ConfirmDialog({ open, onClose, title, description, children, confirmLabel, onConfirm, destructive = false, blocked }: ConfirmDialogProps) {
  const { simulated, busy } = usePro()
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
              variant="primary"
              disabled={busy || !!blocked}
              disabledReason={blocked ?? (busy ? 'Another call is in progress.' : undefined)}
              onClick={() => {
                setWentAhead(true)
                onClose()
                onConfirm()
              }}
            >
              {confirmLabel}
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
        {children}
        {simulated ? <p className={css.replay}>{REPLAY_NOTE}</p> : null}
      </div>
    </Dialog>
  )
}
