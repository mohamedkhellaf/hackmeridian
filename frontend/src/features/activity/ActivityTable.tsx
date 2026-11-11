import { Button, DateTime, RowHeader, TBody, THead, Table, TableWrap, Td, Th, Tr } from '../../ui'
import { CHECK_AGAIN, COLUMNS, PRODUCT_LABEL, TABLE_CAPTION } from './copy'
import { HashCell } from './HashCell'
import type { ActivityRow } from './model'
import { StateWord } from './StateWord'
import { TargetLink } from './TargetLink'
import css from './ActivityTable.module.css'

export interface ActivityRowsProps {
  rows: readonly ActivityRow[]
  /** Show which contract each row was sent to. Only worth a line when the list holds more than Covered. */
  showProduct: boolean
  /** The id of the row being looked up again, or null. */
  checking: string | null
  onCheck: (id: string) => void
}

/** The list as a ruled table, from 768 px up. */
export function ActivityTable({ rows, showProduct, checking, onCheck }: ActivityRowsProps) {
  const anyAction = rows.some((r) => r.canCheck)
  return (
    <TableWrap label={TABLE_CAPTION}>
      <Table caption={TABLE_CAPTION} className={css.table}>
        <THead>
          <Tr>
            <Th>{COLUMNS.what}</Th>
            <Th>{COLUMNS.state}</Th>
            <Th>{COLUMNS.started}</Th>
            <Th>{COLUMNS.hash}</Th>
            <Th>{COLUMNS.about}</Th>
            {anyAction ? (
              <Th pinned>
                <span className="ui-vh">{COLUMNS.action}</span>
              </Th>
            ) : null}
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <Tr key={row.id} data-tone={row.tone} data-testid="activity-row">
              <RowHeader className={css.what}>
                <span className={css.label}>{row.label}</span>
                {row.terms ? <span className={css.sub}>{row.terms}</span> : null}
                {showProduct ? <span className={css.sub}>{PRODUCT_LABEL[row.product]}</span> : null}
              </RowHeader>
              <Td className={css.state}>
                <StateWord row={row} />
                <span className={css.note}>{row.note}</span>
              </Td>
              <Td className={css.cell}>
                <DateTime value={row.startedAt} local="below" />
              </Td>
              <Td className={css.cell}>
                <span className={row.hash ? css.hash : undefined}>
                  <HashCell row={row} />
                </span>
              </Td>
              <Td className={css.cell}>{row.target ? <TargetLink target={row.target} /> : null}</Td>
              {anyAction ? (
                <Td pinned className={css.cell}>
                  {row.canCheck ? (
                    <Button size="sm" variant="secondary" loading={checking === row.id} onClick={() => onCheck(row.id)}>
                      {CHECK_AGAIN}
                    </Button>
                  ) : null}
                </Td>
              ) : null}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}
