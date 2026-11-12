import type { ReactNode } from 'react'
import { cx } from './internal/cx'
import { Marker } from './Marker'
import styles from './KeyValue.module.css'

export interface KeyValueProps {
  children: ReactNode
  /** `ruled` draws a hairline between rows (term sheets, review summaries). `plain` has none (compact facts). */
  variant?: 'ruled' | 'plain'
  /** Values in the serif (terms, impact summaries) or in the UI face (dense facts, ids). */
  figures?: 'serif' | 'sans'
  /** `stacked` puts the value under its label, for narrow columns. */
  layout?: 'row' | 'stacked'
  className?: string
}

/** A definition list: `dl > div > dt + dd`. The structure is a contract; tests and styles rely on it. */
export function KeyValue({ children, variant = 'ruled', figures = 'serif', layout = 'row', className }: KeyValueProps) {
  return (
    <dl className={cx(styles.root, className)} data-variant={variant} data-figures={figures} data-layout={layout}>
      {children}
    </dl>
  )
}

export interface KeyValueItemProps {
  label: ReactNode
  /** The value. */
  children: ReactNode
  /** The user's own term: the value goes under the highlighter. */
  marked?: boolean
  /**
   * A caption under the row. Only: a required sentence from core/disclosures next to its figure, a second figure of
   * the same quantity (per unit against total, local time, time left), or where the money sits. It never defines
   * its label and never describes the page. It sits right under the value when it fits one line, otherwise it
   * runs the full width of the row from the left.
   */
  hint?: ReactNode
  /** `lg` is the closing figure of a term sheet ("You pay 1.80 USDx"): a heavier rule above it and a larger figure. */
  size?: 'md' | 'lg'
  className?: string
}

export function KeyValueItem({ label, children, marked = false, hint, size = 'md', className }: KeyValueItemProps) {
  return (
    <div className={cx(styles.item, className)} data-size={size === 'lg' ? 'lg' : undefined}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>
        <span className={styles.figure}>{marked ? <Marker>{children}</Marker> : children}</span>
        {hint ? (
          <span className={styles.hint}>
            <span className={styles.hintText}>{hint}</span>
          </span>
        ) : null}
      </dd>
    </div>
  )
}
