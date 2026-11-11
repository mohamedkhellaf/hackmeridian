import { NO_VALUE } from '../../core/format'
import { Address, Amount, Countdown, DateTime, Glyph, IconWarning, Marker, RowHeader, TBody, THead, Table, TableWrap, Tag, Td, Th, Tr, VisuallyHidden } from '../../ui'
import type { RequestRow } from './board'
import { BOARD_CAPTION, COL, LAPSE_LINE, MINE_CAPTION, NOT_FOR_OWN, RETURNED_LINE, STRANDED_LINE, YOURS, inTotal, referenceLine, serialText, shortBy, youHold } from './copy'
import { RowActions } from './RowActions'
import { lapsing, shortfallOf, warnBelowOf } from './view'
import type { RequestsViewProps } from './view'
import styles from './BoardTable.module.css'

/** From this many rows the table scrolls inside its frame, so the header row stays in view. */
const STICKY_FROM = 12

/** The figure the row is priced by: the premium per unit, under the highlighter on the wallet's own request. */
function PerUnit({ row, marked }: { row: RequestRow; marked: boolean }) {
  const amount = <Amount value={row.premiumPerUnit.text} exact={row.premiumPerUnit.exact} unit={row.premiumPerUnit.code} />
  return marked ? <Marker>{amount}</Marker> : amount
}

/**
 * The board from 1200 px up: a ruled table of fixed columns (nothing moves when the wallet connects or a figure
 * changes), figures on the first line of each row and what qualifies them beneath, the action pinned right.
 */
export function BoardTable({ rows, variant, selectedId, balances, emptyTokens, nowSec, sort, onSort, explorerOf, onSell, onCancel }: RequestsViewProps) {
  const board = variant === 'board'
  const caption = board ? BOARD_CAPTION : MINE_CAPTION
  return (
    <TableWrap label={caption} maxHeight={rows.length > STICKY_FROM ? '70vh' : undefined}>
      <Table caption={caption} fixed className={styles.table} data-variant={variant}>
        <colgroup>
          <col className={styles.colAsset} />
          <col className={styles.colKind} />
          <col className={styles.colQty} />
          <col className={styles.colStrike} />
          <col className={styles.colDeadline} />
          <col className={styles.colPremium} />
          {board ? <col className={styles.colLock} /> : null}
          <col className={board ? styles.colBuyer : styles.colState} />
          <col className={board ? styles.colAction : styles.colActionMine} />
        </colgroup>
        <THead>
          <Tr>
            <Th>{COL.asset}</Th>
            <Th>{COL.kind}</Th>
            <Th numeric>{COL.quantity}</Th>
            <Th numeric>{COL.strike}</Th>
            {board && onSort ? (
              <Th sort={sort === 'deadline' ? 'asc' : 'none'} onSort={() => onSort('deadline')}>
                {COL.deadline}
              </Th>
            ) : (
              <Th>{COL.deadline}</Th>
            )}
            {board && onSort ? (
              <Th numeric sort={sort === 'premium' ? 'desc' : 'none'} onSort={() => onSort('premium')}>
                {COL.premium}
              </Th>
            ) : (
              <Th numeric>{COL.premium}</Th>
            )}
            {board ? <Th numeric>{COL.lock}</Th> : null}
            {board ? <Th>{COL.buyer}</Th> : <Th>{COL.state}</Th>}
            <Th pinned>{COL.action}</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => {
            const shortfall = board ? shortfallOf(row, balances, emptyTokens) : null
            const reference = referenceLine(row)
            const closed = row.state === 'cancelled' || row.state === 'pruned'
            return (
              <Tr
                key={row.key}
                selected={selectedId === row.bid.id}
                interactive
                className={closed ? styles.closed : undefined}
                data-testid="request-row"
                data-mine={row.mine || undefined}
              >
                <RowHeader>
                  <span className={styles.asset}>
                    <span className={styles.code}>{row.assetCode}</span>
                    {row.typeLabel ? <span className={styles.sub}>{row.typeLabel}</span> : null}
                  </span>
                  <span className={styles.serial}>{serialText(row.serial)}</span>
                </RowHeader>
                <Td>
                  <span className={styles.kind}>
                    <Glyph name={row.glyph} size={12} />
                    <span>{row.kindWord}</span>
                  </span>
                </Td>
                <Td numeric>
                  <Amount value={row.quantity.text} exact={row.quantity.exact} unit={row.quantity.code} />
                </Td>
                <Td numeric>
                  <span className={styles.stack} data-align="end">
                    <Amount value={row.strike.text} exact={row.strike.exact} unit={row.strike.code} />
                    {reference ? <span className={styles.sub}>{reference}</span> : null}
                  </span>
                </Td>
                <Td>
                  <span className={styles.stack}>
                    <DateTime value={row.deadlineSec * 1000} />
                    {row.state === 'open' ? (
                      <span className={styles.sub}>
                        <Countdown to={row.deadlineSec * 1000} warnBelowMs={warnBelowOf(row)} />
                      </span>
                    ) : null}
                    {lapsing(row, nowSec) ? (
                      <span className={`${styles.warn} ${styles.wraps}`}>
                        <IconWarning size={12} />
                        <span>{LAPSE_LINE}</span>
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td numeric>
                  <span className={styles.stack} data-align="end">
                    <PerUnit row={row} marked={row.mine && board} />
                    <span className={styles.sub}>{inTotal(row)}</span>
                  </span>
                </Td>
                {board ? (
                  <Td numeric>
                    {row.mine ? (
                      <>
                        <span aria-hidden="true" className={styles.none}>
                          {NO_VALUE}
                        </span>
                        <VisuallyHidden>{NOT_FOR_OWN}</VisuallyHidden>
                      </>
                    ) : (
                      <span className={styles.stack} data-align="end">
                        <Amount value={row.lock.text} exact={row.lock.exact} unit={row.lock.code} />
                        {shortfall ? (
                          <span className={`${styles.warn} ${styles.wraps}`}>
                            <IconWarning size={12} />
                            <span>{youHold(shortfall.have)}</span>
                            <VisuallyHidden>{shortBy(shortfall.missing)}</VisuallyHidden>
                          </span>
                        ) : null}
                      </span>
                    )}
                  </Td>
                ) : null}
                {board ? (
                  <Td>
                    <Address value={row.bid.buyer} name={row.mine ? YOURS : undefined} explorerUrl={explorerOf(row.bid.buyer)} explorerLabel="View the buyer on the explorer" copyLabel={null} />
                  </Td>
                ) : (
                  <Td>
                    <span className={styles.stack}>
                      <span>
                        <Tag state={row.stateName} />
                      </span>
                      {row.escrow === 'stranded' ? (
                        <span className={styles.stranded}>
                          <IconWarning size={12} />
                          <span>{STRANDED_LINE}</span>
                        </span>
                      ) : row.state === 'pruned' ? (
                        <span className={styles.sub}>{RETURNED_LINE}</span>
                      ) : null}
                    </span>
                  </Td>
                )}
                <Td pinned>
                  <RowActions row={row} variant={variant} layout="table" onSell={onSell} onCancel={onCancel} />
                </Td>
              </Tr>
            )
          })}
        </TBody>
      </Table>
    </TableWrap>
  )
}
