import { Link as RouterLink, useLocation } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { explorerTx } from '../../../core/explorer'
import { txEffectText, usePro } from '../../../data'
import { Button, Callout, KeyValue, KeyValueItem, Link, TxLink, TxStepper } from '../../../ui'
import { Waterfall } from '../../../viz'
import { toChartNumber, usdx, withUnit } from '../model/money'
import { Usdx } from './figures'
import { useMarginUi } from './marginUi'
import type { ResultSplit, ResultView } from './marginUi'
import css from './OutcomeRegion.module.css'

const WORKING = new Set(['checking', 'signing', 'submitting', 'pending'])

/** A refusal with a next step names it: one link to the screen where that step is taken. */
function refusalNext(code: number, label: string): { label: string; to: string } | null {
  if (code === 224) return { label: 'Go to Liquidations', to: '/margin/liquidations' }
  if (code === 205 && label === 'Withdraw') return { label: 'Go to Positions', to: '/margin/positions' }
  if (code === 209) return { label: 'Go to Account', to: '/margin' }
  return null
}

/** Who paid, as the section draws it everywhere else: the waterfall with "Paid X of Y" at the break. */
function SplitFigure({ split }: { split: ResultSplit }) {
  const unpaid = split.parts.filter((p) => p.kind === 'deficit').reduce((t, p) => t + p.value, 0n)
  const read = split.parts.map((p) => `${p.label.toLowerCase()} ${usdx(p.value)}${p.kind === 'deficit' ? ' not paid' : ''}`).join(', ')
  return (
    <Waterfall
      className={css.split}
      heading={`Owed ${withUnit(usdx(split.due))}`}
      paidLabel={unpaid > 0n ? `Paid ${usdx(split.due - unpaid)} of ${usdx(split.due)}` : undefined}
      label={`Owed ${withUnit(usdx(split.due))}: ${read}.`}
      segments={split.parts.map((p) => ({ id: p.id, label: p.label, value: toChartNumber(p.value), valueLabel: usdx(p.value), kind: p.kind }))}
    />
  )
}

/** What the call made or paid, as a receipt: the terms that matter, the split when money moved, the way on. */
function Receipt({ view }: { view: ResultView }) {
  return (
    <div className={css.receipt}>
      {view.facts.length > 0 ? (
        <KeyValue className={css.facts}>
          {view.facts.map((f) => (
            <KeyValueItem key={f.label} label={f.label} hint={f.hint}>
              {typeof f.value === 'bigint' ? <Usdx v={f.value} unit figure="serif" tone={f.loss ? 'loss' : undefined} /> : f.value}
            </KeyValueItem>
          ))}
        </KeyValue>
      ) : null}
      {view.split && view.split.due > 0n ? <SplitFigure split={view.split} /> : null}
      {view.next ? (
        <p>
          <Link render={<RouterLink to={view.next.to} />}>{view.next.label}</Link>
        </p>
      ) : null}
    </div>
  )
}

/**
 * The result of the last Margin call, on every screen. A contract refusal reads as the action, the error name
 * with its code, then the reason in words: "Early exercise refused: LiquidateFirst (224)". The transaction
 * layer announces the outcome to screen readers; focus is moved here after each call.
 */
export function OutcomeRegion() {
  const { outcome, clearOutcome, tx, simulated, canCheckAgain, checkAgain } = usePro()
  const { result, resultRef } = useMarginUi()
  const { pathname } = useLocation()
  // A result belongs to the screen where the call ran: moving to another Margin screen clears it.
  const shownOn = useRef(pathname)
  useEffect(() => {
    if (pathname === shownOn.current) return
    shownOn.current = pathname
    clearOutcome()
  }, [pathname, clearOutcome])
  const working = !simulated && WORKING.has(tx.phase)
  const hash = !simulated && tx.hash ? <TxLink hash={tx.hash} explorerUrl={explorerTx(tx.hash)} copy /> : null

  let body = null
  if (working) {
    body = (
      <div className={css.progress}>
        <TxStepper state={tx.phase as 'checking' | 'signing' | 'submitting' | 'pending'} hash={hash} />
      </div>
    )
  } else if (outcome) {
    // The region empties when dismissed: focus goes back to the page heading, not nowhere.
    const dismiss = (
      <Button
        size="sm"
        onClick={() => {
          clearOutcome()
          document.querySelector<HTMLElement>('main h1')?.focus()
        }}
      >
        Dismiss
      </Button>
    )
    if (outcome.ok) {
      body = (
        <Callout variant="info" title={outcome.text.replace(/\.$/, '')} actions={dismiss}>
          {result ? <Receipt view={result} /> : null}
          {hash ? <p>Transaction {hash}</p> : null}
          {outcome.note ? <p className={css.note}>{outcome.note}</p> : null}
        </Callout>
      )
    } else if (outcome.name === 'NotScripted') {
      body = (
        <Callout variant="warning" title={`${outcome.label}: the recorded scenario has no later step for this action.`} actions={dismiss}>
          <p>
            Nothing changed. Pick another step or another scenario under <Link href="#replay">Replay a scenario</Link>.
          </p>
        </Callout>
      )
    } else if (outcome.code !== null) {
      const next = refusalNext(outcome.code, outcome.label)
      body = (
        <Callout variant="danger" title={`${outcome.label} refused: ${outcome.name ?? 'Error'} (${outcome.code})`} actions={dismiss}>
          <p>{outcome.text}</p>
          {next && next.to !== pathname ? (
            <p>
              <Link render={<RouterLink to={next.to} />}>{next.label}</Link>
            </p>
          ) : null}
          {!simulated ? <p>{txEffectText(tx)}</p> : null}
          {hash ? <p>Transaction {hash}</p> : null}
          {outcome.note ? <p className={css.note}>{outcome.note}</p> : null}
        </Callout>
      )
    } else if (!simulated && tx.phase === 'confirmed') {
      // The call ended unknown and a later look found it in a ledger: say so, in place of the earlier warning.
      body = (
        <Callout variant="info" title={`${outcome.label}: a ledger included it`} actions={dismiss}>
          <p>{txEffectText(tx)}</p>
          {hash ? <p>Transaction {hash}</p> : null}
        </Callout>
      )
    } else {
      const unknown = tx.phase === 'unknown'
      body = (
        <Callout variant={unknown ? 'warning' : 'danger'} title={unknown ? `${outcome.label}: sent, not confirmed yet` : `${outcome.label} did not go through`} actions={dismiss}>
          <p>{outcome.text}</p>
          {!simulated ? <p>{txEffectText(tx)}</p> : null}
          {unknown ? (
            <>
              <p>
                Do not send it again. It is also listed under <Link render={<RouterLink to="/activity" />}>Activity</Link>.
              </p>
              {canCheckAgain ? (
                <p>
                  <Button size="sm" onClick={() => void checkAgain()}>
                    Check again
                  </Button>
                </p>
              ) : null}
            </>
          ) : null}
          {hash ? <p>Transaction {hash}</p> : null}
        </Callout>
      )
    }
  }

  return (
    <section ref={resultRef} className={css.root} aria-label="Result" tabIndex={-1} data-empty={body === null || undefined}>
      {body}
    </section>
  )
}
