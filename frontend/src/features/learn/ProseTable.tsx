import { RowHeader, Table, TableWrap, TBody, Td, Th, THead, Tr } from '../../ui'
import css from './ProseTable.module.css'

export interface ProseRow {
  /** The cell that names the row. */
  header: string
  cells: readonly string[]
}

export interface ProseTableProps {
  /** Names the table for screen readers and, when it scrolls, its scroll region. */
  caption: string
  /** Column headers, the row-header column first. */
  head: readonly string[]
  rows: readonly ProseRow[]
  /** Width of the first column: `narrow` for one or two words, `wide` for a phrase. */
  first?: 'narrow' | 'wide'
}

/**
 * A ruled table whose cells are sentences: the rules in brief, put against call, what each issuer action does.
 * The kit's `prose` table does the typesetting; this file sets the width of the naming column and, in a narrow
 * column, stacks each row: its name on one line, its sentences under it, each led by its column's name when there
 * are several. The explicit roles keep the table a table for assistive technology once its cells are blocks.
 */
export function ProseTable({ caption, head, rows, first = 'narrow' }: ProseTableProps) {
  const labelled = head.length > 2
  return (
    <TableWrap label={caption} className={css.wrap}>
      <Table caption={caption} prose data-first={first} role="table" className={css.table}>
        <THead role="rowgroup" className={css.head}>
          <Tr role="row">
            {head.map((label) => (
              <Th key={label} role="columnheader">
                {label}
              </Th>
            ))}
          </Tr>
        </THead>
        <TBody role="rowgroup">
          {rows.map((row) => (
            <Tr key={row.header} role="row" className={css.row}>
              <RowHeader role="rowheader" className={css.rowHeader}>
                {row.header}
              </RowHeader>
              {row.cells.map((cell, i) => (
                <Td key={i} role="cell" className={css.cell}>
                  {labelled ? (
                    <span className={css.cellLabel} aria-hidden="true">
                      {head[i + 1]}:{' '}
                    </span>
                  ) : null}
                  {cell}
                </Td>
              ))}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}
