// The four steps of the ticket, the same for every mode: Terms, Review, Sign, Receipt. A mode (buy, write, bid,
// fill, resale buy, list) supplies a `Deal`: its terms, its impact rows, its consent sentence and how to send
// the transaction. This file owns the order of things: the re-check before the wallet is asked, the consent
// gate, the transaction states in words, and where focus goes.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { usePreTrade, useTxBusy } from '../../data'
import type { PreTradeView, TxRun } from '../../data'
import { ISSUER_DISCLOSURE } from '../../core/disclosures'
import type { PreTradeAction, PreTradeLine } from '../../core/options/preTrade'
import type { ReferencePrice } from '../../core/reference'
import type { TxState } from '../../core/tx/machine'
import { Button, Callout, Checkbox, KeyValue, KeyValueItem } from '../../ui'
import type { NoteTerm } from '../../ui'
import { useWallet } from '../../wallet'
import { CHECKS_PENDING, CONSENT_MISSING, GUEST_NOTE, OUTCOME_TITLE, RECHECK_BLOCKED, SIGN_TITLE } from './copy'
import type { StepName } from './copy'
import { Actions } from './Actions'
import { firstBlocker } from './fmt'
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
  /** Heading of the Terms and Review steps: "Buy a put on BOND". */
  title: string
  /** One sentence for the Sign step: what the wallet is asked to sign, with its figures. */
  summary: string
  /** The terms, or null while a form does not describe a valid option yet. */
  leg: Leg | null
  side: Side
  /** What the pre-trade re-check evaluates. Null while there are no valid terms. */
  action: PreTradeAction | null
  /** The body of the Terms step: read-only terms, or the form. */
  terms: ReactNode
  /** Why the terms cannot be reviewed yet (a form that does not validate). */
  termsError: string | null
  /** Shows the re-check's warnings on the Terms step too (the forms, where the user can still change the terms). */
  warnOnTerms?: boolean
  /** The impact summary of the Review step: you pay or receive, you lock, breakeven, most you can lose, deadline, counterparty. */
  impact: NoteTerm[]
  /** A way out of a blocking issue that the ticket can offer itself (show the seller's new price). */
  fix?: { label: string; onClick: () => void }
  /** Rows after the three status lines (the cap, the lowest competing offer). */
  extra?: NoteTerm[]
  /** A caption under the state line of the review: when it was last read. */
  readAt?: string
  /** A sentence above the review list (who is paid in a resale, the escrow sentence of a bid). */
  reviewNote?: ReactNode
  /** What happens at exercise, in one sentence under the list. */
  settlement?: string
  /** Buy, fill and resale buy show the issuer sentence at its home. */
  issuerDisclosure: boolean
  /** The sentence of the consent checkbox. */
  consent: string
  /** The final action, named with its amount: "Pay 1.80 USDx". */
  actionLabel: string
  /** Accessible name of the payoff drawing. */
  chartTitle: string
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

/** A status line of the re-check as a row of the review list. `hint` says when it was read. */
function statusRow(line: PreTradeLine | null, hint?: string): NoteTerm[] {
  if (!line) return []
  return [{ label: line.label, value: <StatusValue line={line} />, hint: line.status === 'ok' && hint ? hint : undefined }]
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
  const pre = usePreTrade(deal.action)

  const [step, setStep] = useState<StepName>(startAt === 'review' && deal.leg !== null ? 'review' : 'terms')
  // Consent is given by one wallet to one exact action: when the amount changes (a re-priced listing) or the
  // wallet does, it is asked again.
  const consentKey = `${wallet.address ?? ''}|${deal.actionLabel}`
  const [agreedFor, setAgreedFor] = useState<string | null>(null)
  const agreed = agreedFor === consentKey
  const setAgreed = (next: boolean) => setAgreedFor(next ? consentKey : null)
  const [rechecking, setRechecking] = useState(false)
  const [changed, setChanged] = useState(false)
  const [result, setResult] = useState<R | null>(null)

  // A transaction that confirms (now, or after a later check) always lands on the receipt.
  const shown: StepName = step === 'sign' && tx.state.phase === 'confirmed' ? 'receipt' : step === 'review' && deal.leg === null ? 'terms' : step
  const working = rechecking || tx.working
  const view = shown === 'receipt' ? receipt(result, tx.state) : null
  const title = shown === 'receipt' && view ? view.title : shown === 'sign' ? (working ? SIGN_TITLE : (OUTCOME_TITLE[tx.state.phase] ?? SIGN_TITLE)) : deal.title

  const { report, focusTitle } = frame
  const { assetId, kind: seriesKind, strike: seriesStrike, expiry: seriesExpiry } = deal.series ?? {}
  const bestOfferId = deal.bestOfferId
  useEffect(() => {
    report({ title, step: shown, series: assetId && seriesKind ? { assetId, kind: seriesKind, strike: seriesStrike, expiry: seriesExpiry } : null, bestOfferId })
  }, [report, title, shown, assetId, seriesKind, seriesStrike, seriesExpiry, bestOfferId])

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

  const recheck = pre?.recheck
  const confirm = useCallback(async () => {
    if (!recheck) return
    setChanged(false)
    setStep('sign')
    setRechecking(true)
    // Everything the trade depends on is read again, fresh, before the wallet is asked.
    const fresh = await recheck().catch(() => null)
    setRechecking(false)
    if (fresh?.blocked) {
      setChanged(true)
      setAgreedFor(null)
      setStep('review')
      return
    }
    const run = await start()
    if (run.result !== null) setResult(run.result)
  }, [recheck, start])

  const backToReview = () => {
    tx.reset()
    setAgreedFor(null)
    setStep('review')
  }

  const blocker = firstBlocker(pre?.issues)
  const connect = (
    <Button variant="primary" fullWidth className={styles.primary} onClick={() => void wallet.connect()}>
      Connect wallet
    </Button>
  )

  let body: ReactNode
  if (shown === 'terms') {
    const reason = deal.termsError ?? blocker?.message ?? null
    body = (
      <>
        {deal.terms}
        {pre && deal.action ? <Issues issues={pre.issues} only={deal.warnOnTerms ? undefined : 'block'} /> : null}
        {deal.fix ? <FixButton fix={deal.fix} /> : null}
        {guest && frame.container !== 'rail' ? <p className={styles.note}>{GUEST_NOTE}</p> : null}
        <Actions>
          {guest ? (
            connect
          ) : (
            <Button variant="primary" fullWidth className={styles.primary} disabled={reason !== null} disabledReason={reason ?? undefined} onClick={() => setStep('review')}>
              Review
            </Button>
          )}
          {guest && frame.container === 'rail' ? <p className={styles.note}>{GUEST_NOTE}</p> : null}
        </Actions>
      </>
    )
  } else if (shown === 'review' && deal.leg) {
    const reason = blocker?.message ?? (busyElsewhere ? 'Another transaction is in progress. Wait for it to finish.' : !agreed ? CONSENT_MISSING : !pre ? CHECKS_PENDING : null)
    body = (
      <ReviewStep deal={deal} leg={deal.leg} pre={pre} changed={changed} agreed={agreed} onAgreed={setAgreed}>
        <Actions>
          <Button variant="quiet" onClick={() => setStep('terms')}>
            Back
          </Button>
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
        summary={deal.summary}
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

function ReviewStep(props: { deal: Deal; leg: Leg; pre: PreTradeView | null; changed: boolean; agreed: boolean; onAgreed: (next: boolean) => void; children: ReactNode }) {
  const { deal, leg, pre, changed, agreed, onAgreed } = props
  const rows: NoteTerm[] = [...deal.impact, ...statusRow(pre?.state ?? null, deal.readAt), ...statusRow(pre?.account ?? null), ...statusRow(pre?.funds ?? null), ...(deal.extra ?? [])]
  return (
    <>
      {changed ? (
        <Callout variant="danger" label="Changed" alert>
          {RECHECK_BLOCKED}
        </Callout>
      ) : null}
      {pre ? <Issues issues={pre.issues} only="block" /> : null}
      {deal.fix ? <FixButton fix={deal.fix} /> : null}
      {deal.reviewNote ? <p className={styles.reviewNote}>{deal.reviewNote}</p> : null}
      <KeyValue className={styles.summary}>
        {rows.map((row, i) => (
          <KeyValueItem key={i} label={row.label} marked={row.marked} hint={row.hint}>
            {row.value}
          </KeyValueItem>
        ))}
      </KeyValue>
      {deal.settlement ? <p className={styles.settlement}>{deal.settlement}</p> : null}
      <PayoffFigure leg={leg} side={deal.side} reference={deal.reference} title={deal.chartTitle} />
      {pre ? <Issues issues={pre.issues} only="warn" /> : null}
      {deal.issuerDisclosure ? (
        <Callout variant="warning" label="Issuer control">
          {ISSUER_DISCLOSURE}
        </Callout>
      ) : null}
      <div className={styles.consent}>
        <Checkbox checked={agreed} onCheckedChange={onAgreed}>
          {deal.consent}
        </Checkbox>
      </div>
      {props.children}
    </>
  )
}
