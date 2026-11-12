import { cx } from './internal/cx'
import { RowHeader, Table, TableWrap, TBody, Td, Th, THead, Tr } from './Table'
import styles from './FactTable.module.css'

export interface FactRow {
  key: string
  /** The fact's name, read as the row header. */
  label: string
  /** Its short answer ("Yes", "No", "Not read"). */
  state: string
  /** The answer is the one that matters (a power the issuer has): drawn in ink. */
  on?: boolean
  /** What it means, in one or two sentences. */
  effect: string
}

export interface FactTableProps {
  /** The table's caption and the list's accessible name. */
  caption: string
  /** The three column heads: the fact, its answer, what it means. */
  columns: { readonly label: string; readonly state: string; readonly effect: string }
  rows: readonly FactRow[]
  className?: string
}

/**
 * A short ruled table of facts, each with a one-word answer and a sentence on what it means (the issuer powers on
 * `/issuer` and the asset's About tab). A plain table from 768 px; under it a ruled list with the name and the
 * answer on one line and the sentence under them. One component, so one object is never drawn two ways.
 */
export function FactTable({ caption, columns, rows, className }: FactTableProps) {
  return (
    <div className={cx(styles.root, className)}>
      <TableWrap label={caption} className={styles.table}>
        <Table caption={caption}>
          <THead>
            <Tr>
              <Th className={styles.label}>{columns.label}</Th>
              <Th className={styles.state}>{columns.state}</Th>
              <Th>{columns.effect}</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.key}>
                <RowHeader className={styles.label}>{r.label}</RowHeader>
                <Td className={styles.state} data-on={r.on || undefined}>
                  {r.state}
                </Td>
                <Td className={styles.effect}>{r.effect}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableWrap>
      <ul className={styles.list} role="list" aria-label={caption}>
        {rows.map((r) => (
          <li key={r.key}>
            <p className={styles.head}>
              <span className={styles.label}>{r.label}</span>
              <span className={styles.state} data-on={r.on || undefined}>
                {r.state}
              </span>
            </p>
            <p className={styles.effect}>{r.effect}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
