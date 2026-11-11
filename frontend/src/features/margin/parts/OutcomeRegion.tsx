import { Link as RouterLink } from '@tanstack/react-router'
import { explorerTx } from '../../../core/explorer'
import { txEffectText, usePro } from '../../../data'
import { Button, Callout, Link, TxLink, TxStepper } from '../../../ui'
import { QUOTE, usdx, usdxExact } from '../model/money'
import { useMarginUi } from './marginUi'
import type { ResultFact } from './marginUi'
import css from './OutcomeRegion.module.css'

const WORKING = new Set(['checking', 'signing', 'submitting', 'pending'])

function Facts({ facts }: { facts: ResultFact[] }) {
  return (
    <dl className={css.facts}>
      {facts.map((f) => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd data-loss={f.loss || undefined}>{typeof f.value === 'bigint' ? `${usdx(f.value)} ${QUOTE}` : f.value}</dd>
          {typeof f.value === 'bigint' && usdxExact(f.value) !== usdx(f.value) ? <dd className={css.exact}>exactly {usdxExact(f.value)}</dd> : null}
        </div>
      ))}
    </dl>
  )
}

/**
 * The result of the last Margin call, on every screen. A contract refusal reads as the action, the error name
 * with its code, then the reason in words: "Early exercise refused: LiquidateFirst (224)". The transaction
 * layer announces the outcome to screen readers; focus is moved here after each call.
 */
export function OutcomeRegion() {
  const { outcome, clearOutcome, tx, simulated, canCheckAgain, checkAgain } = usePro()
  const { facts, resultRef } = useMarginUi()
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
        <Callout variant="info" label={outcome.text.replace(/\.$/, '')} actions={dismiss}>
          {facts && facts.length > 0 ? <Facts facts={facts} /> : null}
          {hash ? <p>Transaction {hash}</p> : null}
          {outcome.note ? <p className={css.note}>{outcome.note}</p> : null}
        </Callout>
      )
    } else if (outcome.name === 'NotScripted') {
      body = (
        <Callout variant="warning" label="Not in this scenario" title={`${outcome.label}: the recorded scenario has no later step for this action.`} actions={dismiss}>
          <p>
            Nothing changed. Pick another step or another scenario under <Link href="#replay">Replay a scenario</Link>.
          </p>
        </Callout>
      )
    } else if (outcome.code !== null) {
      body = (
        <Callout variant="danger" label="Refused" title={`${outcome.label} refused: ${outcome.name ?? 'Error'} (${outcome.code})`} actions={dismiss}>
          <p>{outcome.text}</p>
          {!simulated ? <p>{txEffectText(tx)}</p> : null}
          {hash ? <p>Transaction {hash}</p> : null}
          {outcome.note ? <p className={css.note}>{outcome.note}</p> : null}
        </Callout>
      )
    } else if (!simulated && tx.phase === 'confirmed') {
      // The call ended unknown and a later look found it in a ledger: say so, in place of the earlier warning.
      body = (
        <Callout variant="info" label="Confirmed" title={`${outcome.label}: a ledger included it`} actions={dismiss}>
          <p>{txEffectText(tx)}</p>
          {hash ? <p>Transaction {hash}</p> : null}
        </Callout>
      )
    } else {
      const unknown = tx.phase === 'unknown'
      body = (
        <Callout
          variant={unknown ? 'warning' : 'danger'}
          label={unknown ? 'Outcome unknown' : 'Not done'}
          title={unknown ? `${outcome.label}: sent, not confirmed yet` : `${outcome.label} did not go through`}
          actions={dismiss}
        >
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
