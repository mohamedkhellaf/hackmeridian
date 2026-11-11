import type { ReactNode } from 'react'
import { KeyValue, KeyValueItem } from '../../ui'
import type { NoteTerm } from '../../ui'
import styles from './TermsList.module.css'

/** The terms of the Terms step as a ruled list, closed by the one figure that matters: what the user pays, locks or receives. */
export function TermsList({ rows, total, children }: { rows: NoteTerm[]; total?: { label: string; value: ReactNode; hint?: ReactNode; marked?: boolean }; children?: ReactNode }) {
  return (
    <div className={styles.root}>
      <KeyValue>
        {rows.map((row, i) => (
          <KeyValueItem key={i} label={row.label} marked={row.marked} hint={row.hint}>
            {row.value}
          </KeyValueItem>
        ))}
      </KeyValue>
      {children}
      {total ? (
        <div className={styles.total} data-testid="ticket-total">
          <KeyValue variant="plain">
            <KeyValueItem size="lg" marked={total.marked ?? true} label={total.label} hint={total.hint}>
              {total.value}
            </KeyValueItem>
          </KeyValue>
        </div>
      ) : null}
    </div>
  )
}
