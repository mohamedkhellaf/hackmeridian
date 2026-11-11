import type { RefObject } from 'react'
import { explorerTx } from '../../core/explorer'
import { stoppedStage } from '../../core/tx/machine'
import { TX_PHASE_HELP, describeTx, useUnsettledTx } from '../../data'
import type { CoveredTx } from '../../data'
import type { TxResult } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import { Button, Callout, DateTime, Dialog, KeyValue, KeyValueItem, TxLink, TxStepper, UnsettledNotice } from '../../ui'
import { money } from './board'
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
  listTitle,
  strikePerUnitOf,
  takeBack,
  takeBackTitle,
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
 * confirm with what each state means. An expired request is named for what cancelling it does: the premium is
 * taken back. The outcome stays on screen until the user closes it, and in Activity. The stage area keeps the
 * stepper's height from the start, so the dialog does not change size or move while the transaction runs.
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
        {expired ? takeBack(row.premium) : CANCEL_REQUEST}
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
        <KeyValueItem label={CANCEL_TERMS.request}>{listTitle(row)}</KeyValueItem>
        <KeyValueItem label={CANCEL_TERMS.strike}>{strikePerUnitOf(row)}</KeyValueItem>
        <KeyValueItem label={CANCEL_TERMS.deadline}>
          <DateTime value={row.deadlineSec * 1000} />
        </KeyValueItem>
        <KeyValueItem label={CANCEL_TERMS.refund} marked>
          {money(row.premium)}
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
    title: confirmed ? CANCELLED_TITLE : row ? (expired ? takeBackTitle(row.serial) : cancelTitle(row.serial)) : CANCEL_REQUEST,
    footer,
    finalFocus: confirmed ? fallbackFocus : undefined,
  }
  // A dialog, which the kit sets as a bottom sheet on phones.
  return <Dialog {...common}>{body}</Dialog>
}
