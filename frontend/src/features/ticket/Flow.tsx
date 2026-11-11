// The steps of the ticket, the same for every mode: Terms (the forms only), Review, Sign, Receipt. A mode (buy,
// write, bid, fill, resale buy, list) supplies a `Deal`: its terms, its review rows, its sentences and how to send
// the transaction. This file owns the order of things: the re-check before the wallet is asked, the transaction
// states in words, what the receipt prints, and where focus goes. The wallet signature is the consent: there is
// no tick box.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { usePreTrade, useTxBusy, useUnsettledTx } from '../../data'
import type { PreTradeView, TxRun, UnsettledTx } from '../../data'
import { ISSUER_DISCLOSURE } from '../../core/disclosures'
import type { PreTradeAction, PreTradeLine } from '../../core/options/preTrade'
import type { ReferencePrice } from '../../core/reference'
import { refusedOnSend } from '../../core/tx/machine'
import type { TxState } from '../../core/tx/machine'
import { Button, Callout, KeyValue, KeyValueItem, UnsettledNotice } from '../../ui'
import type { NoteTerm } from '../../ui'
import { useWallet } from '../../wallet'
import { CHECK_AGAIN, CHECKS_PENDING, RECHECK_BLOCKED, SIGN_TITLE, TX_BUSY, checksSentence, outcomeTitle, pendingTxNotice } from './copy'
import type { StepName } from './copy'
import { Actions } from './Actions'
import { firstBlocker, readAtText } from './fmt'
import { useFrame } from './frame'
import type { SeriesRef } from './frame'
import type { TicketMode } from './intent'
import { Issues, StatusValue } from './parts'
import { PayoffFigure } from './PayoffFigure'
import { ReceiptStep } from './ReceiptStep'
import type { ReceiptView } from './ReceiptStep'
import { SignStep } from './SignStep'
import type { Leg, Side } from './terms'
import styles from './Flow.module.css'

/** What `data`'s transaction hooks give a flow, without the mode-specific `run`. */
export interface FlowTx {
  state: TxState
  working: boolean
  canCheckAgain: boolean
  checkAgain: () => Promise<TxState>
  reset: () => void
}

/** Everything a mode tells the flow. Built on every render from what was read. */
export interface Deal {
  mode: TicketMode
  /** Heading of the ticket: "Buy a put on BOND". */
  title: string
  /** Heading of the review of a form (write, request, list), which has a Terms step under `title`. */
  reviewTitle?: string
  /** One sentence for the Sign step: what the wallet is asked to sign, with its figures. */
  summary: string
  /** The terms, or null while a form does not describe a valid option yet. */
  leg: Leg | null
  side: Side
  /** What the pre-trade re-check evaluates. Null while there are no valid terms. */
  action: PreTradeAction | null
  /** The body of the Terms step (the forms). Null: the ticket opens on its review (buy, fill, resale buy). */
  terms: ReactNode | null
  /** Why the terms cannot be reviewed yet (a form that does not validate). */
  termsError: string | null
  /** Shows the re-check's warnings on the Terms step too (the forms, where the user can still change the terms). */
  warnOnTerms?: boolean
  /** The serial line above the review of an existing order: "Offer No. 000047". */
  serial?: string
  /** What moves: you pay, receive, lock or escrow, with the required sentence beside the premium. */
  money: NoteTerm[]
  /** The terms and what they mean for this side: strike, quantity, deadline, breakeven, most you can lose, the other party. */
  details: NoteTerm[]
  /** A way out of a blocking issue that the ticket can offer itself (show the seller's new price, take the next offer). */
  fix?: { label: string; onClick: () => void }
  /**
   * The order is no longer there to take (bought by another account, cancelled, past its deadline): the reason in
   * words. The review then says it once, and hides the payoff figure so the dead terms do not read as live.
   */
  gone?: string
  /** When the subject of the ticket was last read, in milliseconds (0 or absent: never, or a form). */
  readAt?: number
  /** Notices of the review only: a price a buyer could exercise at once, a better order on the other side. */
  notices?: ReactNode
  /** Two sentences: the case where the right is used, then the case where it is not. */
  outcome?: readonly string[]
  /** What the user commits to, in one sentence, printed above the action. */
  commitment: string
  /** Every mode but a listing shows the issuer sentence at its home. */
  issuerDisclosure: boolean
  /** The final action, named with its amount: "Pay 1.80 USDx". */
  actionLabel: string
  /** Accessible name of the payoff drawing. Null: no figure (a listing). */
  chartTitle: string | null
  series: SeriesRef | null
  bestOfferId?: bigint | null
  reference: ReferencePrice
}

export interface FlowProps<R> {
  deal: Deal
  tx: FlowTx
  /** Sends the transaction. Called after the fresh re-check passed. Never rejects. */
  start: () => Promise<TxRun<R>>
  /** The receipt, from the write's own result when there is one (null after a later "check again"). */
  receipt: (result: R | null, state: TxState) => ReceiptView
  startAt?: 'terms' | 'review'
}

/** What was sent, as it was when the wallet was asked: the Sign step and the receipt print this, never later terms. */
interface Sent<R> {
  summary: string
  receipt: (result: R | null, state: TxState) => ReceiptView
}

/** A status line of the re-check as a row of the review list. */
function statusRow(line: PreTradeLine): NoteTerm {
  return { label: line.label, value: <StatusValue line={line} /> }
}

/** A passed check as words for the checks sentence. */
function passedPhrase(which: 'state' | 'account' | 'funds', line: PreTradeLine): string {
  if (which === 'state') return `the ${line.label.toLowerCase()} is ${line.text.toLowerCase()}`
  if (which === 'account') {
    const issuer = /^Authorized by the (.+) issuer$/.exec(line.text)
    return issuer ? `the ${issuer[1]} issuer has authorized your account` : `your account is ${line.text.toLowerCase()}`
  }
  return `you hold ${line.text}`
}

/** The three status lines: the ones that passed fold into one sentence; a line that did not stays a row with its mark. */
function checksOf(pre: PreTradeView | null): { passed: string[]; rows: NoteTerm[] } {
  const passed: string[] = []
  const rows: NoteTerm[] = []
  if (!pre) return { passed, rows }
  for (const [which, line] of [['state', pre.state], ['account', pre.account], ['funds', pre.funds]] as const) {
    if (!line) continue
    if (line.status === 'ok') passed.push(passedPhrase(which, line))
    else rows.push(statusRow(line))
  }
  return { passed, rows }
}

/** Scrolls the nearest scrolling ancestor of the ticket back to its top (a step is a new sheet). */
function scrollToTop(el: HTMLElement | null): void {
  for (let node = el?.parentElement ?? null; node && node !== document.body; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) {
      node.scrollTop = 0
      return
    }
  }
}

export function Flow<R>({ deal, tx, start, receipt, startAt }: FlowProps<R>) {
  const frame = useFrame()
  const wallet = useWallet()
  const guest = wallet.address === null
  const busyElsewhere = useTxBusy()
  const unsettled = useUnsettledTx()
  const pre = usePreTrade(deal.action)
  const hasTerms = deal.terms !== null

  const [step, setStep] = useState<StepName>(!hasTerms || (startAt === 'review' && deal.leg !== null) ? 'review' : 'terms')
  const [rechecking, setRechecking] = useState(false)
  const [changed, setChanged] = useState(false)
  const [result, setResult] = useState<R | null>(null)
  const [sent, setSent] = useState<Sent<R> | null>(null)

  // A transaction that confirms (now, or after a later check) always lands on the receipt.
  const shown: StepName = step === 'sign' && tx.state.phase === 'confirmed' && sent ? 'receipt' : step === 'review' && deal.leg === null && hasTerms ? 'terms' : step
  const view = shown === 'receipt' && sent ? sent.receipt(result, tx.state) : null
  const phase = tx.state.phase
  const title =
    shown === 'receipt' && view
      ? view.title
      : shown === 'sign'
        ? rechecking || phase === 'idle'
          ? SIGN_TITLE.checking
          : phase === 'failed' || phase === 'unknown' || phase === 'expired' || phase === 'declined'
            ? outcomeTitle(phase, tx.state.effect, refusedOnSend(tx.state))
            : phase === 'checking' || phase === 'signing' || phase === 'submitting' || phase === 'pending'
              ? SIGN_TITLE[phase]
              : SIGN_TITLE.signing
        : shown === 'review' && deal.reviewTitle
          ? deal.reviewTitle
          : deal.title

  const { report, focusTitle, isOpen } = frame
  const { assetId, code: seriesCode, kind: seriesKind, strike: seriesStrike, expiry: seriesExpiry } = deal.series ?? {}
  const bestOfferId = deal.bestOfferId
  useEffect(() => {
    report({ title, step: shown, series: assetId && seriesKind ? { assetId, code: seriesCode, kind: seriesKind, strike: seriesStrike, expiry: seriesExpiry } : null, bestOfferId })
  }, [report, title, shown, assetId, seriesCode, seriesKind, seriesStrike, seriesExpiry, bestOfferId])

  // A new step is a new sheet: back to the top, focus on the heading so it is read first.
  const rootRef = useRef<HTMLDivElement>(null)
  const previous = useRef(shown)
  useEffect(() => {
    if (previous.current === shown) return
    previous.current = shown
    scrollToTop(rootRef.current)
    const frameId = requestAnimationFrame(focusTitle)
    return () => cancelAnimationFrame(frameId)
  }, [shown, focusTitle])

  // Closing the ticket before the wallet is asked cancels the attempt: the re-check may still be reading.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const recheck = pre?.recheck
  const confirm = useCallback(async () => {
    if (!recheck) return
    setChanged(false)
    setSent({ summary: deal.summary, receipt })
    setStep('sign')
    setRechecking(true)
    // Everything the trade depends on is read again, fresh, before the wallet is asked.
    const fresh = await recheck().catch(() => null)
    if (!alive.current || !isOpen()) return
    setRechecking(false)
    if (fresh?.blocked) {
      setChanged(true)
      setStep('review')
      return
    }
    const run = await start()
    if (run.result !== null && alive.current) setResult(run.result)
  }, [recheck, start, deal.summary, receipt, isOpen])

  const backToReview = () => {
    tx.reset()
    setStep('review')
  }

  const blocker = firstBlocker(pre?.issues)
  const connect = (
    <Button variant="primary" fullWidth className={styles.primary} onClick={() => void wallet.connect()}>
      Connect wallet
    </Button>
  )
  const reasonLine = (reason: string | null) =>
    reason ? (
      <p className={styles.reason} data-testid="action-reason">
        {reason}
      </p>
    ) : null

  let body: ReactNode
  if (shown === 'terms') {
    const reason = deal.termsError ?? blocker?.message ?? null
    const review = () => {
      if (reason === null && !guest) setStep('review')
    }
    // Enter in a field of the form goes to the review, as a submit would.
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      const t = e.target
      if (e.key !== 'Enter' || e.defaultPrevented || !(t instanceof HTMLInputElement) || t.type === 'radio' || t.type === 'checkbox') return
      e.preventDefault()
      review()
    }
    body = (
      <>
        <div className={styles.terms} onKeyDown={onKeyDown}>
          {deal.terms}
        </div>
        {pre && deal.action ? <Issues issues={pre.issues} only={deal.warnOnTerms ? undefined : 'block'} /> : null}
        {deal.fix ? <FixButton fix={deal.fix} /> : null}
        <Actions>
          {guest ? null : reasonLine(reason)}
          {guest ? (
            connect
          ) : (
            <Button variant="primary" fullWidth className={styles.primary} disabled={reason !== null} disabledReason={reason ?? undefined} onClick={review}>
              Review
            </Button>
          )}
        </Actions>
      </>
    )
  } else if (shown === 'review' && deal.leg) {
    const reason = deal.gone ?? blocker?.message ?? (unsettled ? pendingTxNotice(unsettled.sentAt, unsettled.until) : busyElsewhere ? TX_BUSY : !pre ? CHECKS_PENDING : null)
    body = (
      <ReviewStep deal={deal} leg={deal.leg} pre={pre} changed={changed} unsettled={unsettled}>
        <Actions>
          {guest ? null : reasonLine(reason)}
          {hasTerms ? (
            <Button variant="quiet" onClick={() => setStep('terms')}>
              Back
            </Button>
          ) : null}
          {guest ? (
            connect
          ) : (
            <Button variant="primary" fullWidth className={styles.primary} disabled={reason !== null} disabledReason={reason ?? undefined} onClick={() => void confirm()}>
              {deal.actionLabel}
            </Button>
          )}
        </Actions>
      </ReviewStep>
    )
  } else if (shown === 'sign') {
    body = (
      <SignStep
        summary={sent?.summary ?? deal.summary}
        state={tx.state}
        rechecking={rechecking}
        canCheckAgain={tx.canCheckAgain}
        onCheckAgain={() => tx.checkAgain()}
        onSignAgain={() => void confirm()}
        onBackToReview={backToReview}
      />
    )
  } else if (view) {
    body = <ReceiptStep view={view} state={tx.state} />
  }

  return (
    <div className={styles.flow} ref={rootRef} data-step={shown} data-testid="ticket-flow">
      {body}
    </div>
  )
}

function FixButton({ fix }: { fix: NonNullable<Deal['fix']> }) {
  return (
    <div className={styles.fix}>
      <Button variant="secondary" onClick={fix.onClick}>
        {fix.label}
      </Button>
    </div>
  )
}

function Rows({ rows, className }: { rows: NoteTerm[]; className?: string }) {
  if (rows.length === 0) return null
  return (
    <KeyValue className={className}>
      {rows.map((row, i) => (
        <KeyValueItem key={i} label={row.label} marked={row.marked} hint={row.hint}>
          {row.value}
        </KeyValueItem>
      ))}
    </KeyValue>
  )
}

/**
 * The review, ordered by what informs the decision: what moves (with the premium sentence), the issuer sentence,
 * the checks read from the contract, the terms, the outcome on either side of the strike with the commitment, and
 * the payoff figure last, closed.
 */
function ReviewStep(props: { deal: Deal; leg: Leg; pre: PreTradeView | null; changed: boolean; unsettled: UnsettledTx | null; children: ReactNode }) {
  const { deal, leg, pre, changed, unsettled } = props
  const checks = checksOf(pre)
  const at = readAtText(deal.readAt ?? 0) ?? null
  const [first, ...rest] = deal.money
  const blocker = firstBlocker(pre?.issues)
  // One notice, not two: after a re-check that stopped, the Changed notice carries the reason itself.
  const changedReason = changed ? (deal.gone ?? blocker?.message ?? null) : null
  const blocks = (pre?.issues ?? []).filter((i) => !(changed && i === blocker) && !(deal.gone && i.code === 'gone'))
  return (
    <>
      {changed ? (
        <Callout variant="danger" label="Changed" alert>
          {changedReason ? `${RECHECK_BLOCKED} ${changedReason}` : RECHECK_BLOCKED}
        </Callout>
      ) : deal.gone ? (
        <Callout variant="danger" label="Gone">
          {deal.gone}
        </Callout>
      ) : null}
      {unsettled ? (
        <UnsettledNotice onCheck={unsettled.check} checkLabel={CHECK_AGAIN}>
          {pendingTxNotice(unsettled.sentAt, unsettled.until)}
        </UnsettledNotice>
      ) : null}
      <Issues issues={blocks} only="block" />
      {deal.fix ? <FixButton fix={deal.fix} /> : null}
      {deal.serial ? <p className={styles.serial}>{deal.serial}</p> : null}
      <KeyValue className={styles.summary}>
        {first ? (
          <KeyValueItem label={first.label} marked={first.marked} hint={first.hint} size="lg">
            {first.value}
          </KeyValueItem>
        ) : null}
        {rest.map((row, i) => (
          <KeyValueItem key={i} label={row.label} marked={row.marked} hint={row.hint}>
            {row.value}
          </KeyValueItem>
        ))}
      </KeyValue>
      {deal.issuerDisclosure ? <p className={styles.issuer}>{ISSUER_DISCLOSURE}</p> : null}
      {checks.passed.length > 0 ? (
        <p className={styles.checks} data-testid="checks">
          {checksSentence(at, checks.passed)}
        </p>
      ) : null}
      <Rows rows={[...checks.rows, ...deal.details]} className={styles.summary} />
      {deal.notices}
      {pre ? <Issues issues={pre.issues} only="warn" /> : null}
      <p className={styles.outcome} data-testid="outcome">
        {[...(deal.outcome ?? []), deal.commitment].join(' ')}
      </p>
      {deal.chartTitle && !deal.gone ? <PayoffFigure leg={leg} side={deal.side} reference={deal.reference} title={deal.chartTitle} /> : null}
      {props.children}
    </>
  )
}
