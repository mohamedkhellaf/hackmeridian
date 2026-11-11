import type { RefObject } from 'react'
import { explorerTx } from '../../core/explorer'
import { stoppedStage } from '../../core/tx/machine'
import { TX_PHASE_HELP, describeTx, useUnsettledTx } from '../../data'
import type { CoveredTx } from '../../data'
import type { TxResult } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import { Amount, Button, Callout, DateTime, Dialog, KeyValue, KeyValueItem, TxLink, TxStepper, UnsettledNotice } from '../../ui'
import type { RequestRow } from './board'
import {
  CANCELLED_TITLE,
  CANCEL_NOTE_EXPIRED,
  CANCEL_NOTE_OPEN,
  CANCEL_REQUEST,
  CANCEL_TERMS,
  CHECK_AGAIN,
  CLOSE,
  DONE,
  KEEP_REQUEST,
  RETRY,
  TX_LABEL,
  cancelTitle,
  confirmedInLedger,
  requestTitle,
} from './copy'
import styles from './CancelRequest.module.css'

export interface CancelRequestProps {
  /** The request being cancelled, as it read when the dialog opened. Null closes the dialog. */
  row: RequestRow | null
  tx: CoveredTx<[bid: Bid], TxResult>
  /** No explorer page exists for a mock transaction. */
  isMock: boolean
  onClose: () => void
  /** Where focus goes when the row that opened the dialog is gone. */
  fallbackFocus: RefObject<HTMLElement | null>
}

/**
 * Cancels one of the wallet's requests as a staged transaction: what comes back, then check, sign, submit and
 * confirm with what each state means. The action has one name before and after the deadline (ruling F9); the note
 * says what is different once the deadline has passed. The outcome stays on screen until the user closes it, and in
 * Activity. The dialog takes the room its content needs at rest and after the outcome; only while the transaction
 * runs does the stage keep the stepper's height, so it does not change size from one stage to the next.
 */
export function CancelRequest({ row, tx, isMock, onClose, fallbackFocus }: CancelRequestProps) {
  const { state } = tx
  const idle = state.phase === 'idle'
  const confirmed = state.phase === 'confirmed'
  const expired = row?.state === 'expired'
  // An earlier transaction of this wallet with an unknown outcome: this one waits for it.
  const unsettled = useUnsettledTx()
  const summary = describeTx(state)
  const hash = state.hash ? <TxLink hash={state.hash} explorerUrl={isMock ? undefined : explorerTx(state.hash)} copy /> : null

  const footer = !row ? null : idle ? (
    <>
      <Button variant="quiet" onClick={onClose}>
        {expired ? CLOSE : KEEP_REQUEST}
      </Button>
      <Button variant="primary" onClick={() => void tx.run(row.bid)} disabled={unsettled !== null} disabledReason={unsettled?.reason}>
        {CANCEL_REQUEST}
      </Button>
    </>
  ) : confirmed ? (
    <Button variant="primary" onClick={onClose}>
      {DONE}
    </Button>
  ) : tx.canCheckAgain ? (
    <>
      <Button variant="quiet" onClick={onClose}>
        {CLOSE}
      </Button>
      <Button variant="primary" onClick={() => void tx.checkAgain()}>
        {CHECK_AGAIN}
      </Button>
    </>
  ) : tx.working ? (
    <Button variant="quiet" onClick={onClose}>
      {CLOSE}
    </Button>
  ) : (
    <>
      <Button variant="quiet" onClick={onClose}>
        {CLOSE}
      </Button>
      {tx.canStart ? (
        <Button variant="primary" onClick={() => void tx.run(row.bid)}>
          {RETRY}
        </Button>
      ) : null}
    </>
  )

  const body = row ? (
    <div className={styles.body}>
      <KeyValue>
        <KeyValueItem label={CANCEL_TERMS.request}>{requestTitle(row)}</KeyValueItem>
        <KeyValueItem label={CANCEL_TERMS.strike}>
          <Amount value={row.strike.text} exact={row.strike.exact} unit={row.strike.code} />
        </KeyValueItem>
        <KeyValueItem label={CANCEL_TERMS.deadline}>
          <DateTime value={row.deadlineSec * 1000} />
        </KeyValueItem>
        <KeyValueItem label={CANCEL_TERMS.refund} marked>
          <Amount value={row.premium.text} exact={row.premium.exact} unit={row.premium.code} />
        </KeyValueItem>
      </KeyValue>
      <div className={styles.stage} data-phase={state.phase}>
        {state.phase === 'idle' ? (
          <>
            <p className={styles.note}>{expired ? CANCEL_NOTE_EXPIRED : CANCEL_NOTE_OPEN}</p>
            {unsettled ? <UnsettledNotice onCheck={unsettled.check}>{unsettled.reason}</UnsettledNotice> : null}
          </>
        ) : state.phase === 'confirmed' ? (
          <div className={styles.outcome} data-testid="cancel-outcome">
            {hash ? (
              <p className={styles.tx}>
                <span>{TX_LABEL}</span>
                {hash}
                {state.ledger !== null ? <span>{confirmedInLedger(state.ledger)}</span> : null}
              </p>
            ) : null}
          </div>
        ) : state.phase === 'failed' ? (
          <>
            <TxStepper state="failed" failedAt={stoppedStage(state)} hash={hash} />
            <Callout variant="danger" title={summary?.title} alert>
              {summary?.detail}
            </Callout>
          </>
        ) : (
          <TxStepper state={state.phase} hash={hash}>
            {TX_PHASE_HELP[state.phase]}
          </TxStepper>
        )}
      </div>
    </div>
  ) : null

  const common = {
    open: row !== null,
    onOpenChange: (open: boolean) => {
      if (!open) onClose()
    },
    title: confirmed ? CANCELLED_TITLE : row ? cancelTitle(row.serial) : CANCEL_REQUEST,
    footer,
    finalFocus: confirmed ? fallbackFocus : undefined,
  }
  // A dialog, which the kit sets as a bottom sheet on phones.
  return <Dialog {...common}>{body}</Dialog>
}
