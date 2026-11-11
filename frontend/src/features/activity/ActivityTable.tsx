import { Button, RowHeader, TBody, THead, Table, TableWrap, Td, Th, Tr } from '../../ui'
import { CHECK_AGAIN, COLUMNS, TABLE_CAPTION, yourZone } from './copy'
import { HashCell } from './HashCell'
import type { ActivityGroup } from './model'
import { State, Time, What } from './RowParts'
import { TargetLink } from './TargetLink'
import css from './ActivityTable.module.css'

export interface ActivityRowsProps {
  /** The rows in the page's order: open ones first, then the finished ones by day. */
  groups: readonly ActivityGroup[]
  /** The viewer's zone (`UTC+1`) when it is not UTC: each row then also gives its own time. */
  zone: string | null
  /** The id of the row being looked up again, or null. */
  checking: string | null
  onCheck: (id: string) => void
}

/**
 * The list as a ruled table, from 1200 px up. Each group is a row group under a ruled heading: the open
 * transactions first, then one heading per day, so a row only gives its time. A confirmed row is one line; a row
 * whose state needs explaining carries the sentence under its label, where the widest column has room for it.
 */
export function ActivityTable({ groups, zone, checking, onCheck }: ActivityRowsProps) {
  const anyAction = groups.some((g) => g.rows.some((r) => r.canCheck))
  const span = anyAction ? 6 : 5
  return (
    <TableWrap label={TABLE_CAPTION}>
      <Table caption={TABLE_CAPTION} className={css.table}>
        <THead>
          <Tr>
            <Th>{COLUMNS.what}</Th>
            <Th>{COLUMNS.state}</Th>
            <Th className={css.timeHead}>
              {COLUMNS.time}
              {zone ? <span className={css.zone}> {yourZone(zone)}</span> : null}
            </Th>
            <Th>{COLUMNS.hash}</Th>
            <Th>{COLUMNS.about}</Th>
            {anyAction ? (
              <Th pinned>
                <span className="ui-vh">{COLUMNS.action}</span>
              </Th>
            ) : null}
          </Tr>
        </THead>
        {groups.map((group) => (
          <TBody key={group.key} className={css.group}>
            <Tr>
              <Th scope="rowgroup" colSpan={span} className={css.groupHead}>
                {group.title}
              </Th>
            </Tr>
            {group.rows.map((row) => (
              <Tr key={row.id} data-tone={row.tone} data-testid="activity-row" className={row.note ? css.tall : undefined}>
                <RowHeader className={css.what}>
                  <What row={row} />
                  {row.note ? <span className={css.note}>{row.note}</span> : null}
                </RowHeader>
                <Td>
                  <State row={row} note={false} />
                </Td>
                <Td>
                  <Time row={row} local={zone !== null} />
                </Td>
                <Td>
                  <HashCell row={row} />
                </Td>
                <Td>{row.target ? <TargetLink target={row.target} /> : null}</Td>
                {anyAction ? (
                  <Td pinned>
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
        ))}
      </Table>
    </TableWrap>
  )
}
