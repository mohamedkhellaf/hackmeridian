import { Link as RouterLink } from '@tanstack/react-router'
import { Link, Table, TableWrap, TBody, Td, Th, THead, Tr } from '../../../ui'
import { LIMITS, SECTION } from '../copy'
import { CONTRACT_TEST_TOTAL } from '../recorded'
import { Section } from './Section'
import css from './Limits.module.css'

export function Limits() {
  return (
    <Section id={SECTION.limits} heading={LIMITS.heading} lead={LIMITS.lead}>
      <TableWrap label={LIMITS.tableCaption}>
        <Table caption={LIMITS.tableCaption} className={css.table} data-testid="limits-table">
          <THead>
            <Tr>
              <Th>{LIMITS.exists}</Th>
              <Th>{LIMITS.missing}</Th>
            </Tr>
          </THead>
          <TBody>
            {LIMITS.rows.map((row) => (
              <Tr key={row.id}>
                <Td className={css.exists}>{row.exists(CONTRACT_TEST_TOTAL)}</Td>
                <Td className={css.missing}>{row.missing}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableWrap>
      <p className={css.more}>
        <Link render={<RouterLink to="/reserves" />}>{LIMITS.reserves}</Link>
      </p>
    </Section>
  )
}
