import type { ReactNode } from 'react'
import { Button } from './Button'
import { Callout } from './Callout'

export interface UnsettledNoticeProps {
  /** The sentence: when the earlier transaction was sent, until when it can still go through, what to do. */
  children: ReactNode
  /** Looks the earlier transaction up again. */
  onCheck: () => void
  checkLabel?: string
}

/**
 * Shown above a confirmation while an earlier transaction of the wallet has an unknown outcome and can still go
 * through: the action below waits for it, and "Check again" looks it up. The data layer's `useUnsettledTx` says
 * when, and with which sentence; this is only how it looks, the same in every dialog and in the ticket.
 */
export function UnsettledNotice({ children, onCheck, checkLabel = 'Check again' }: UnsettledNoticeProps) {
  return (
    <Callout
      variant="warning"
      label="Not confirmed yet"
      actions={
        <Button variant="secondary" size="sm" onClick={onCheck}>
          {checkLabel}
        </Button>
      }
    >
      {children}
    </Callout>
  )
}
