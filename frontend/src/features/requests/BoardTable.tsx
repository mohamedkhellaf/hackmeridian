import { Address, Amount, Countdown, DateTime, Glyph, IconWarning, Marker, RowHeader, TBody, THead, Table, TableWrap, Tag, Td, Th, Tr } from '../../ui'
import type { RequestRow } from './board'
import { BOARD_CAPTION, COL, LAPSE_LINE, MINE_CAPTION, RETURNED_LINE, STRANDED_LINE, YOURS, IN_TOTAL, referenceLine, serialText } from './copy'
import { RowActions } from './RowActions'
import { lapsing, warnBelowOf } from './view'
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
 * The board from 1200 px up. An open request is drawn as on the asset page's Requests tab (ruling F15): Kind,
 * Strike, Quantity, Deadline, Premium per unit with the total beneath, Buyer, the action pinned right; the board
 * spans assets, so the asset leads. Fixed columns: nothing moves when the wallet connects or a figure changes.
 */
export function BoardTable({ rows, variant, selectedId, nowSec, sort, onSort, explorerOf, onSell, onCancel }: RequestsViewProps) {
  const board = variant === 'board'
  const caption = board ? BOARD_CAPTION : MINE_CAPTION
  return (
    <TableWrap label={caption} maxHeight={rows.length > STICKY_FROM ? '70vh' : undefined}>
      <Table caption={caption} fixed className={styles.table} data-variant={variant}>
        <colgroup>
          <col className={styles.colAsset} />
          <col className={styles.colKind} />
          <col className={styles.colStrike} />
          <col className={styles.colQty} />
          <col className={styles.colDeadline} />
          <col className={styles.colPremium} />
          <col className={board ? styles.colBuyer : styles.colState} />
          <col className={styles.colAction} />
        </colgroup>
        <THead>
          <Tr>
            <Th>{COL.asset}</Th>
            <Th>{COL.kind}</Th>
            <Th strike>{COL.strike}</Th>
            <Th numeric>{COL.quantity}</Th>
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
            <Th>{board ? COL.buyer : COL.state}</Th>
            <Th pinned>{COL.action}</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => {
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
                {/* The request's number sits under the first cell of the row, as on the asset Requests tab. */}
                <RowHeader>
                  <span className={styles.stack}>
                    <span className={styles.asset}>
                      <span className={styles.code}>{row.assetCode}</span>
                      {row.typeLabel ? <span className={styles.sub}>{row.typeLabel}</span> : null}
                    </span>
                    <span className={styles.sub}>{serialText(row.serial)}</span>
                  </span>
                </RowHeader>
                <Td>
                  <span className={styles.kind}>
                    <Glyph name={row.glyph} size={12} />
                    <span>{row.kindWord}</span>
                  </span>
                </Td>
                <Td strike>
                  <span className={styles.stack} data-align="center">
                    <Amount value={row.strike.text} exact={row.strike.exact} unit={row.strike.code} />
                    {reference ? <span className={styles.sub}>{reference}</span> : null}
                  </span>
                </Td>
                <Td numeric>
                  <Amount value={row.quantity.text} exact={row.quantity.exact} unit={row.quantity.code} />
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
                    <span className={styles.sub}>
                      <Amount value={row.premium.text} exact={row.premium.exact} unit={row.premium.code} /> {IN_TOTAL}
                    </span>
                  </span>
                </Td>
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
                        <span className={`${styles.stranded} ${styles.wraps}`}>
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
