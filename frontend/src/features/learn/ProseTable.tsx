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
 * The kit's `prose` table does the typesetting; this file only sets the width of the naming column.
 */
export function ProseTable({ caption, head, rows, first = 'narrow' }: ProseTableProps) {
  return (
    <TableWrap label={caption}>
      <Table caption={caption} prose data-first={first}>
        <THead>
          <Tr>
            {head.map((label) => (
              <Th key={label}>{label}</Th>
            ))}
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <Tr key={row.header}>
              <RowHeader className={css.rowHeader}>{row.header}</RowHeader>
              {row.cells.map((cell, i) => (
                <Td key={i}>{cell}</Td>
              ))}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}
