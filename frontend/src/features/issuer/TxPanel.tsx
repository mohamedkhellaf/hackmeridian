import { Button, Card } from '../../ui'
import { COPY } from './copy'
import { IdText } from './IdText'
import { TxProgress } from './TxProgress'
import type { TxView } from './useIssuerConsole'
import styles from './TxPanel.module.css'

/**
 * The running or last issuer transaction, on the page. An unknown outcome offers "Check again" and nothing else:
 * the transaction can still be included, so it is never sent twice. A settled one can be dismissed; it stays in
 * "Recent actions".
 */
export function TxPanel({ tx }: { tx: TxView }) {
  if (tx.state.phase === 'idle') return null
  const label = tx.label ?? COPY.tx.title
  return (
    <Card
      title={<IdText text={label} />}
      headingLevel={2}
      className={styles.root}
      actions={
        tx.canCheckAgain ? (
          <Button size="sm" onClick={tx.checkAgain}>
            {COPY.tx.checkAgain}
          </Button>
        ) : !tx.working && tx.state.phase !== 'unknown' ? (
          <Button size="sm" variant="quiet" onClick={tx.dismiss}>
            {COPY.tx.dismiss}
          </Button>
        ) : null
      }
    >
      <TxProgress state={tx.state} label={label} />
    </Card>
  )
}
