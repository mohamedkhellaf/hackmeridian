import type { Ref } from 'react'
import { explorerTx } from '../../core/explorer'
import { groupDigits } from '../../core/format'
import { Button, TxLink } from '../../ui'
import { COPY } from './copy'
import { IdText } from './IdText'
import { TxProgress } from './TxProgress'
import type { TxView } from './useIssuerConsole'
import styles from './TxPanel.module.css'

export interface TxPanelProps {
  tx: TxView
  /** The heading: focus goes here when a confirmation closes on a transaction it sent. */
  headingRef?: Ref<HTMLHeadingElement>
}

/**
 * The running or last issuer transaction, shown where it was started: under the row it acts on. While it runs,
 * or when it failed or its outcome is unknown, the staged progress; an unknown outcome offers "Check again" and
 * nothing else (the transaction can still be included, so it is never sent twice). A confirmed one is one line
 * with its transaction, until it is dismissed or the next action starts; it stays in "Recent actions".
 */
export function TxPanel({ tx, headingRef }: TxPanelProps) {
  if (tx.state.phase === 'idle') return null
  const label = tx.label ?? COPY.tx.title
  if (tx.state.phase === 'confirmed') {
    return (
      <div className={styles.done}>
        <h3 ref={headingRef} tabIndex={-1} className={styles.doneText}>
          <IdText text={tx.done ?? label} />
          {tx.state.ledger ? <span className={styles.ledger}> {COPY.tx.confirmedIn(groupDigits(String(tx.state.ledger)))}</span> : null}
        </h3>
        <div className={styles.doneActions}>
          {tx.state.hash ? <TxLink hash={tx.state.hash} explorerUrl={explorerTx(tx.state.hash)} /> : null}
          <Button size="sm" variant="quiet" onClick={tx.dismiss}>
            {COPY.tx.dismiss}
          </Button>
        </div>
      </div>
    )
  }
  return (
    <section className={styles.root} aria-label={label}>
      <header className={styles.head}>
        <h3 ref={headingRef} tabIndex={-1} className={styles.title}>
          <IdText text={label} />
        </h3>
        {tx.canCheckAgain ? (
          <Button size="sm" onClick={tx.checkAgain}>
            {COPY.tx.checkAgain}
          </Button>
        ) : !tx.working && tx.state.phase !== 'unknown' ? (
          <Button size="sm" variant="quiet" onClick={tx.dismiss}>
            {COPY.tx.dismiss}
          </Button>
        ) : null}
      </header>
      <TxProgress state={tx.state} label={label} />
    </section>
  )
}
