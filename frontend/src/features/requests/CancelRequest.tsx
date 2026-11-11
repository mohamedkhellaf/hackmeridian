import type { RefObject } from 'react'
import { explorerTx } from '../../core/explorer'
import { stoppedStage } from '../../core/tx/machine'
import { TX_PHASE_HELP, describeTx } from '../../data'
import type { CoveredTx } from '../../data'
import type { TxResult } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import { Button, Callout, DateTime, Dialog, KeyValue, KeyValueItem, Sheet, TxLink, TxStepper } from '../../ui'
import { money } from './board'
import type { RequestRow } from './board'
import {
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
  cancelDone,
  cancelTitle,
  confirmedInLedger,
  listTitle,
  strikePerUnitOf,
} from './copy'
import styles from './CancelRequest.module.css'


export interface CancelRequestProps {
  /** The request being cancelled, as it read when the dialog opened. Null closes the dialog. */
  row: RequestRow | null
  tx: CoveredTx<[bid: Bid], TxResult>
  /** No explorer page exists for a mock transaction. */
  isMock: boolean
  onClose: () => void
  /** Phones get a bottom sheet. */
  sheet: boolean
  /** Where focus goes when the row that opened the dialog is gone. */
  fallbackFocus: RefObject<HTMLElement | null>
}

/**
 * Cancels one of the wallet's requests as a staged transaction: what comes back, then check, sign, submit and
 * confirm with what each state means. The outcome stays on screen until the user closes it, and in Activity.
 */
export function CancelRequest({ row, tx, isMock, onClose, sheet, fallbackFocus }: CancelRequestProps) {
  const { state } = tx
  const idle = state.phase === 'idle'
  const confirmed = state.phase === 'confirmed'
  const summary = describeTx(state)
  const hash = state.hash ? <TxLink hash={state.hash} explorerUrl={isMock ? undefined : explorerTx(state.hash)} copy /> : null

  const footer = !row ? null : idle ? (
    <>
      <Button variant="quiet" onClick={onClose}>
        {KEEP_REQUEST}
      </Button>
      <Button variant="primary" onClick={() => void tx.run(row.bid)}>
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
        <KeyValueItem label={CANCEL_TERMS.request}>{listTitle(row)}</KeyValueItem>
        <KeyValueItem label={CANCEL_TERMS.strike}>{strikePerUnitOf(row)}</KeyValueItem>
        <KeyValueItem label={CANCEL_TERMS.deadline}>
          <DateTime value={row.deadlineSec * 1000} />
        </KeyValueItem>
        <KeyValueItem label={CANCEL_TERMS.refund} marked>
          {money(row.premium)}
        </KeyValueItem>
      </KeyValue>
      {state.phase === 'idle' ? (
        <p className={styles.note}>{row.state === 'expired' ? CANCEL_NOTE_EXPIRED : CANCEL_NOTE_OPEN}</p>
      ) : state.phase === 'confirmed' ? (
        <div className={styles.outcome} data-testid="cancel-outcome">
          <p className={styles.done}>{cancelDone(row.premium)}</p>
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
  ) : null

  const common = {
    open: row !== null,
    onOpenChange: (open: boolean) => {
      if (!open) onClose()
    },
    title: row ? cancelTitle(row.serial) : CANCEL_REQUEST,
    footer,
    finalFocus: confirmed ? fallbackFocus : undefined,
  }
  return sheet ? <Sheet {...common}>{body}</Sheet> : <Dialog {...common}>{body}</Dialog>
}
