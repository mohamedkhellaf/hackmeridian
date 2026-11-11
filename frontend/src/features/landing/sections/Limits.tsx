import { Table, TableWrap, TBody, Td, Th, THead, Tr } from '../../../ui'
import { LIMITS, SECTION } from '../copy'
import { Section } from './Section'
import css from './Limits.module.css'

/*
 * What exists beside what does not, as full sentences. Under 600 px each row becomes a block (the CSS sets the
 * cells to `display: block`), so the table roles are given explicitly.
 */
export function Limits() {
  return (
    <Section id={SECTION.limits} heading={LIMITS.heading}>
      <TableWrap label={LIMITS.tableCaption}>
        <Table caption={LIMITS.tableCaption} className={css.table} data-testid="limits-table" role="table">
          <THead role="rowgroup">
            <Tr role="row">
              <Th role="columnheader">{LIMITS.exists}</Th>
              <Th role="columnheader">{LIMITS.missing}</Th>
            </Tr>
          </THead>
          <TBody role="rowgroup">
            {LIMITS.rows.map((row) => (
              <Tr key={row.id} role="row">
                <Td className={css.exists} role="cell">
                  {row.exists}
                </Td>
                <Td className={css.missing} role="cell">
                  {row.missing}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableWrap>
    </Section>
  )
}
