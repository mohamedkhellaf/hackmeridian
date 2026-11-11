import type { ReactNode } from 'react'
import { RowHeader, Table, TableWrap, TBody, Td, Th, THead, Tr, useIsPhone, VisuallyHidden } from '../../../ui'
import css from './DeskTable.module.css'

export interface DeskColumn<R> {
  id: string
  /** The column header, and the label of the value in the phone list. */
  header: string
  /** Keeps the header for screen readers only (the action column). */
  hideHeader?: boolean
  numeric?: boolean
  /** The strike column: serif figures on the sunken tone. */
  strike?: boolean
  /** The cell that names the row. */
  rowHeader?: boolean
  /** The action column: stays in view while a wide table scrolls. */
  pinned?: boolean
  cell: (row: R) => ReactNode
  /**
   * Where the value goes in the phone list: `title` is the first line, `aside` sits at its right (a state),
   * `actions` is the last line; anything else is a labelled pair. No column is hidden on a phone.
   */
  phone?: 'title' | 'aside' | 'actions' | 'pair'
  /** Leaves the pair out of the phone list for a row where it carries nothing. */
  phoneSkip?: (row: R) => boolean
}

export interface DeskTableProps<R> {
  /** Names the table for screen readers and the scrolling region. */
  caption: string
  columns: ReadonlyArray<DeskColumn<R>>
  rows: readonly R[]
  rowKey: (row: R) => string | number
  /** Shown in place of the table when there are no rows. */
  empty: ReactNode
}

/**
 * A dense desk table on wide screens (compact rows, ruled, numerals aligned) and, under 768 px, the same rows
 * as a list of labelled pairs. One column definition feeds both, so a phone shows every value a desk does.
 */
export function DeskTable<R>({ caption, columns, rows, rowKey, empty }: DeskTableProps<R>) {
  const phone = useIsPhone()
  if (rows.length === 0) return <>{empty}</>

  if (phone) {
    const titles = columns.filter((c) => c.phone === 'title')
    const asides = columns.filter((c) => c.phone === 'aside')
    const actions = columns.filter((c) => c.phone === 'actions')
    const pairs = columns.filter((c) => !c.phone || c.phone === 'pair')
    return (
      <ul className={css.list} role="list" aria-label={caption}>
        {rows.map((row) => {
          const shown = pairs.filter((c) => !c.phoneSkip?.(row))
          const acts = actions.map((c) => ({ id: c.id, node: c.cell(row) })).filter((a) => a.node !== null && a.node !== undefined && a.node !== false)
          return (
            <li key={rowKey(row)} className={css.item}>
              <div className={css.head}>
                <div className={css.title}>
                  {titles.map((c) => (
                    <span key={c.id}>{c.cell(row)}</span>
                  ))}
                </div>
                {asides.length > 0 ? (
                  <div className={css.aside}>
                    {asides.map((c) => (
                      <span key={c.id}>{c.cell(row)}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              {shown.length > 0 ? (
                <dl className={css.pairs}>
                  {shown.map((c) => (
                    <div key={c.id} className={css.pair}>
                      <dt>{c.header}</dt>
                      <dd>{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {acts.length > 0 ? (
                <div className={css.actions}>
                  {acts.map((a) => (
                    <div key={a.id} className={css.action}>
                      {a.node}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <TableWrap label={caption}>
      <Table density="compact" caption={caption}>
        <THead>
          <Tr>
            {columns.map((c) => (
              <Th key={c.id} numeric={c.numeric} strike={c.strike} pinned={c.pinned}>
                {c.hideHeader ? <VisuallyHidden>{c.header}</VisuallyHidden> : c.header}
              </Th>
            ))}
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <Tr key={rowKey(row)}>
              {columns.map((c) =>
                c.rowHeader ? (
                  <RowHeader key={c.id}>{c.cell(row)}</RowHeader>
                ) : (
                  <Td key={c.id} numeric={c.numeric} strike={c.strike} pinned={c.pinned}>
                    {c.cell(row)}
                  </Td>
                ),
              )}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}
