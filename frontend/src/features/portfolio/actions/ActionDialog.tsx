// One dialog for every position action: review (what signing does, what was checked), then the staged
// transaction, then the receipt. The same three stages for an exercise, a claim, a reclaim and a cancellation, so
// a user learns the flow once. A dialog never claims an outcome the ledger has not confirmed.
import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { explorerTx } from '../../../core/explorer'
import { groupDigits } from '../../../core/format'
import type { PreTradeLine } from '../../../core/options/preTrade'
import { stoppedStage } from '../../../core/tx/machine'
import type { TxState } from '../../../core/tx/machine'
import { TX_PHASE_HELP, txEffectText, useOptionsClient, useTxBusy, useUnsettledTx } from '../../../data'
import { Button, Callout, ContractNote, Dialog, IconCheck, IconDanger, IconInfo, Spinner, TxLink, TxStepper, UnsettledNotice } from '../../../ui'
import type { NoteTerm, PayoffGlyph } from '../../../ui'
import { useWallet } from '../../../wallet'
import { BUSY_REASON, CHECK_AGAIN, CHECKS_HEADING, CLOSE, CONNECT, DONE, RECEIPT, REVIEW_AGAIN } from '../copy'
import type { ActionCopy } from '../copy'
import { checksSentence } from './checks'
import type { CheckLine } from './checks'
import css from './ActionDialog.module.css'

/** The part of a transaction controller the dialog needs. Every `useExercise()`-style hook satisfies it. */
export interface TxView {
  state: TxState
  working: boolean
  canCheckAgain: boolean
  checkAgain: () => Promise<TxState>
  reset: () => void
}

export interface ActionDialogProps {
  open: boolean
  onClose: () => void
  copy: ActionCopy
  /** The option id as printed on the receipt. */
  serial: string
  glyph?: PayoffGlyph
  tx: TxView
  /** Runs the last checks, then the transaction. */
  onConfirm: () => void
  /** The last checks before signing are running. */
  checking?: boolean
  /** Why the action cannot start. The button stays focusable and says why. */
  blockedReason?: string | null
  /** The review: terms, sentences, check lines. */
  children: ReactNode
  /** What moved, for the receipt. The transaction and its ledger are added. */
  receiptTerms: ReadonlyArray<NoteTerm>
  /** The contract state the option is in once the transaction confirmed. */
  receiptState?: string
  /** The heading of the receipt's note: the position and asset ("Long put, RWA"). The dialog's title says what was done. */
  receiptKind?: ReactNode
  /** A link under the receipt, for example to the position. */
  receiptAction?: ReactNode
  /** Where focus goes on close when the element that opened the dialog is gone. */
  finalFocus?: RefObject<HTMLElement | null>
  size?: 'sm' | 'md'
}

function HashLink({ hash, isMock }: { hash: string; isMock: boolean }) {
  return <TxLink hash={hash} explorerUrl={isMock ? undefined : explorerTx(hash)} copy />
}

/** The staged transaction with what the current state means and what to do. */
function Progress({ state, isMock }: { state: TxState; isMock: boolean }) {
  if (state.phase === 'idle') return null
  return (
    <TxStepper state={state.phase} failedAt={stoppedStage(state)} hash={state.hash ? <HashLink hash={state.hash} isMock={isMock} /> : undefined}>
      {state.phase === 'failed' ? (
        <>
          <p>{state.error ?? TX_PHASE_HELP.failed}</p>
          <p>{txEffectText(state)}</p>
        </>
      ) : (
        <p>{TX_PHASE_HELP[state.phase]}</p>
      )}
    </TxStepper>
  )
}

const LINE_WORD: Record<PreTradeLine['status'], string> = { pending: 'checking', ok: 'passed', fail: 'failed', unknown: 'not checked' }

/**
 * What was re-read from the chain before signing: the lines that passed as one sentence with the time of the
 * read; a line that is still running, could not be checked or failed stays a row, with a mark that repeats its word.
 */
export function CheckLines({ lines, at = null }: { lines: ReadonlyArray<CheckLine | null>; at?: string | null }) {
  const { isMock } = useOptionsClient()
  const shown = lines.filter((l): l is CheckLine => l !== null)
  if (shown.length === 0) return null
  const sentence = checksSentence(at, shown, isMock)
  const rows = shown.filter((l) => l.status !== 'ok')
  return (
    <section className={css.checks} aria-label={CHECKS_HEADING}>
      {sentence ? <p className={css.checksSentence}>{sentence}</p> : null}
      {rows.length > 0 ? (
        <ul className={css.checkList}>
          {rows.map((l) => (
            <li key={l.label} className={css.check} data-status={l.status}>
              <span className={css.checkMark}>
                {l.status === 'pending' ? <Spinner /> : l.status === 'fail' ? <IconDanger size={16} /> : l.status === 'ok' ? <IconCheck size={16} /> : <IconInfo size={16} />}
              </span>
              <span className={css.checkLabel}>{l.label}</span>
              <span className={css.checkText}>
                {l.text}
                <span className="ui-vh">, {LINE_WORD[l.status]}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export function ActionDialog({
  open,
  onClose,
  copy,
  serial,
  glyph,
  tx,
  onConfirm,
  checking = false,
  blockedReason = null,
  children,
  receiptTerms,
  receiptState,
  receiptKind,
  receiptAction,
  finalFocus,
  size = 'md',
}: ActionDialogProps) {
  const { me, isMock } = useOptionsClient()
  const wallet = useWallet()
  const busyElsewhere = useTxBusy() && !tx.working
  // An earlier transaction of this wallet with an unknown outcome: this one waits for it (the runner would refuse it).
  const unsettled = useUnsettledTx()
  const { state } = tx
  const stage = state.phase === 'idle' ? 'review' : state.phase === 'confirmed' ? 'receipt' : 'progress'

  // Focus follows the flow: to the progress list when signing starts, to the receipt when the ledger confirms.
  const progressRef = useRef<HTMLDivElement | null>(null)
  const receiptRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    if (stage === 'progress') progressRef.current?.focus()
    if (stage === 'receipt') receiptRef.current?.focus()
  }, [open, stage])

  let footer: ReactNode
  if (stage === 'review') {
    footer = (
      <>
        <Button variant="secondary" onClick={onClose}>
          {copy.dismiss}
        </Button>
        {me ? (
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={checking}
            disabled={blockedReason !== null || busyElsewhere || unsettled !== null}
            disabledReason={blockedReason ?? (unsettled ? unsettled.reason : busyElsewhere ? BUSY_REASON : undefined)}
          >
            {copy.confirm}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void wallet.connect()}>
            {CONNECT}
          </Button>
        )}
      </>
    )
  } else if (stage === 'receipt') {
    footer = (
      <Button variant="primary" onClick={onClose}>
        {DONE}
      </Button>
    )
  } else if (tx.working) {
    footer = (
      <Button variant="secondary" onClick={onClose}>
        {CLOSE}
      </Button>
    )
  } else if (state.phase === 'unknown') {
    footer = (
      <>
        <Button variant="secondary" onClick={onClose}>
          {CLOSE}
        </Button>
        <Button variant="primary" onClick={() => void tx.checkAgain()} disabled={!tx.canCheckAgain}>
          {CHECK_AGAIN}
        </Button>
      </>
    )
  } else {
    footer = (
      <>
        <Button variant="secondary" onClick={onClose}>
          {CLOSE}
        </Button>
        <Button variant="primary" onClick={tx.reset}>
          {REVIEW_AGAIN}
        </Button>
      </>
    )
  }

  const receipt: NoteTerm[] = [
    ...receiptTerms,
    ...(state.hash ? [{ label: RECEIPT.transaction, value: <HashLink hash={state.hash} isMock={isMock} /> }] : []),
    ...(state.ledger !== null ? [{ label: RECEIPT.ledger, value: groupDigits(String(state.ledger)) }] : []),
  ]

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())} title={stage === 'receipt' ? copy.done : copy.title} size={size} footer={footer} finalFocus={finalFocus}>
      {stage === 'review' ? (
        <div className={css.review}>
          <p className={css.lead}>{copy.body}</p>
          {copy.caveat ? <p className={css.caveat}>{copy.caveat}</p> : null}
          {unsettled && me ? <UnsettledNotice onCheck={unsettled.check}>{unsettled.reason}</UnsettledNotice> : null}
          {children}
        </div>
      ) : null}
      {stage === 'progress' ? (
        <div className={css.progress} ref={progressRef} tabIndex={-1} role="group" aria-label="Transaction progress">
          <p className={css.progressLead}>{copy.body}</p>
          <Progress state={state} isMock={isMock} />
          {tx.working ? <p className={css.aside}>You can close this window. The transaction carries on and Activity keeps its record.</p> : null}
        </div>
      ) : null}
      {stage === 'receipt' ? (
        <div className={css.receipt} ref={receiptRef} tabIndex={-1} role="group" aria-label={`Receipt. ${copy.done}`} data-testid="receipt">
          <ContractNote
            printing
            serial={serial}
            ledger={state.ledger !== null ? groupDigits(String(state.ledger)) : undefined}
            glyph={glyph}
            kind={receiptKind ?? copy.done}
            headingLevel={3}
            state={receiptState}
            terms={receipt}
            footer={
              <>
                <span>{copy.after}</span>
                {receiptAction}
              </>
            }
          />
        </div>
      ) : null}
    </Dialog>
  )
}

/** A blocking problem or a warning inside a review, with its cause, consequence and fix. */
export function Issue({ level, children }: { level: 'block' | 'warn'; children: ReactNode }) {
  return <Callout variant={level === 'block' ? 'danger' : 'warning'}>{children}</Callout>
}
