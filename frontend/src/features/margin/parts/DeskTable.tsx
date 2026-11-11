import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { RowHeader, Table, TableWrap, TBody, Td, Th, THead, Tr, useIsPhone, VisuallyHidden } from '../../../ui'
import css from './DeskTable.module.css'

export interface DeskColumn<R> {
  id: string
  /** The column header, and the label of the value in the list layout. */
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
   * Where the value goes in the list layout: `title` is the first line, `aside` sits at its right (a state),
   * `actions` is the last line; anything else is a labelled pair. No column is hidden in the list.
   */
  phone?: 'title' | 'aside' | 'actions' | 'pair'
  /** Leaves the pair out of the list for a row where it carries nothing. */
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
  /** A total under the rows: its label sits under the row header, each figure under its own column. */
  total?: { label: string; cells: Partial<Record<string, ReactNode>> }
  /** Two or three columns: the table keeps to the width of its content instead of the page. */
  narrow?: boolean
}

/**
 * The list layout replaces the table on phones, and wherever the table would not fit its column without
 * scrolling sideways (a desk table between 768 and 1199 px, or one whose cells grew). The table is measured on
 * every render: the visible one, or in the list layout a hidden, inert copy of it.
 */
function useListLayout(deps: readonly unknown[]): { box: (el: HTMLDivElement | null) => void; table: RefObject<HTMLTableElement | null>; phone: boolean; list: boolean } {
  const phone = useIsPhone()
  const [boxEl, box] = useState<HTMLDivElement | null>(null)
  const table = useRef<HTMLTableElement | null>(null)
  const [fits, setFits] = useState(true)

  // The column changed width.
  useLayoutEffect(() => {
    if (phone || !boxEl || typeof ResizeObserver === 'undefined') return
    const check = () => {
      if (table.current) setFits(table.current.offsetWidth <= boxEl.clientWidth + 1)
    }
    const observer = new ResizeObserver(check)
    observer.observe(boxEl)
    return () => observer.disconnect()
  }, [boxEl, phone])

  // The rows or the columns changed: measure again. Stable once the layout matches what was measured.
  useLayoutEffect(() => {
    if (phone || !boxEl || !table.current) return
    const next = table.current.offsetWidth <= boxEl.clientWidth + 1
    if (next !== fits) setFits(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxEl, phone, fits, ...deps])

  return { box, table, phone, list: phone || !fits }
}

/**
 * A dense desk table (compact rows, ruled, numerals aligned) and the same rows as a list of labelled pairs where
 * the table does not fit. One column definition feeds both, so a phone shows every value a desk does.
 */
export function DeskTable<R>({ caption, columns, rows, rowKey, empty, total, narrow = false }: DeskTableProps<R>) {
  const { box, table, phone, list } = useListLayout([rows, columns, total])
  if (rows.length === 0) return <>{empty}</>

  const tableMarkup = (
    <Table ref={table} density="compact" caption={caption} className={css.table} data-actions={columns.some((c) => c.pinned) || undefined}>
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
      {total ? (
        <tfoot className={css.foot}>
          <Tr>
            {columns.map((c) =>
              c.rowHeader ? (
                <RowHeader key={c.id}>{total.label}</RowHeader>
              ) : (
                <Td key={c.id} numeric={c.numeric}>
                  {total.cells[c.id] ?? null}
                </Td>
              ),
            )}
          </Tr>
        </tfoot>
      ) : null}
    </Table>
  )

  if (list) {
    const titles = columns.filter((c) => c.phone === 'title')
    const asides = columns.filter((c) => c.phone === 'aside')
    const actions = columns.filter((c) => c.phone === 'actions')
    const pairs = columns.filter((c) => !c.phone || c.phone === 'pair')
    return (
      <div ref={box} className={css.listBox}>
        {/* Not on phones: there the list is the layout whatever the width. */}
        {phone ? null : (
          <div className={css.measure} aria-hidden="true" inert>
            {tableMarkup}
          </div>
        )}
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
          {total ? (
            <li className={css.item}>
              <dl className={css.pairs}>
                {columns
                  .filter((c) => total.cells[c.id] !== undefined)
                  .map((c, _i, shown) => (
                    <div key={c.id} className={css.pair}>
                      {/* One figure: the total's own label says it ("All shares"); several: each names its column. */}
                      <dt>{shown.length === 1 ? total.label : `${total.label}, ${c.header.toLowerCase()}`}</dt>
                      <dd>{total.cells[c.id]}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          ) : null}
        </ul>
      </div>
    )
  }

  return (
    <div ref={box} className={narrow ? css.narrow : undefined}>
      <TableWrap label={caption}>{tableMarkup}</TableWrap>
    </div>
  )
}
