import { NO_VALUE } from '../../core/format'
import { Address, Amount, Countdown, DateTime, Glyph, IconWarning, Marker, RowHeader, TBody, THead, Table, TableWrap, Tag, Td, Th, Tr, VisuallyHidden } from '../../ui'
import { holdsEscrow, money } from './board'
import { BOARD_CAPTION, COL, ESCROW_LINE, MINE_CAPTION, YOURS, perUnitOf, serialText, youHold } from './copy'
import { RowActions } from './RowActions'
import { WARN_BELOW_MS, shortfallOf } from './view'
import type { RequestsViewProps } from './view'
import styles from './BoardTable.module.css'

/** The board from 768 px up: a ruled table, two lines per row, the action pinned to the right edge. */
export function BoardTable({ rows, variant, selectedId, balances, explorerOf, onSell, onCancel }: RequestsViewProps) {
  const caption = variant === 'board' ? BOARD_CAPTION : MINE_CAPTION
  const board = variant === 'board'
  return (
    <TableWrap label={caption}>
      <Table caption={caption} className={styles.table}>
        <THead>
          <Tr>
            <Th>{COL.asset}</Th>
            <Th>{COL.kind}</Th>
            <Th numeric>{COL.quantity}</Th>
            <Th numeric>{COL.strike}</Th>
            <Th>{COL.deadline}</Th>
            <Th numeric>{board ? COL.premium : COL.premiumMine}</Th>
            {board ? <Th numeric>{COL.lock}</Th> : null}
            {board ? <Th>{COL.buyer}</Th> : <Th>{COL.state}</Th>}
            <Th pinned>{COL.action}</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => {
            const shortfall = board ? shortfallOf(row, balances) : null
            return (
              <Tr key={row.key} selected={selectedId === row.bid.id} interactive data-testid="request-row" data-mine={row.mine || undefined}>
                <RowHeader>
                  <span className={styles.asset}>
                    <span className={styles.code}>{row.assetCode}</span>
                    {row.typeLabel ? <span className={styles.type}>{row.typeLabel}</span> : null}
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
                  <Amount value={row.strike.text} exact={row.strike.exact} unit={row.strike.code} />
                </Td>
                <Td>
                  <span className={styles.stack}>
                    <DateTime value={row.deadlineSec * 1000} />
                    {board || holdsEscrow(row.bid) ? (
                      <span className={styles.sub}>
                        <Countdown to={row.deadlineSec * 1000} warnBelowMs={WARN_BELOW_MS} />
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td numeric>
                  <span className={styles.stack} data-align="end">
                    {row.mine && board ? (
                      <Marker>
                        <Amount value={row.premium.text} exact={row.premium.exact} unit={row.premium.code} />
                      </Marker>
                    ) : (
                      <Amount value={row.premium.text} exact={row.premium.exact} unit={row.premium.code} />
                    )}
                    <span className={styles.sub}>{perUnitOf(row)}</span>
                  </span>
                </Td>
                {board ? (
                  <Td numeric>
                    {row.mine ? (
                      <>
                        <span aria-hidden="true" className={styles.none}>
                          {NO_VALUE}
                        </span>
                        <VisuallyHidden>Not for your own request</VisuallyHidden>
                      </>
                    ) : (
                      <span className={styles.stack} data-align="end">
                        <Amount value={row.lock.text} exact={row.lock.exact} unit={row.lock.code} />
                        {shortfall ? (
                          <span className={styles.short}>
                            <IconWarning size={14} />
                            <span>{youHold(shortfall.have)}</span>
                            <VisuallyHidden>, {money(shortfall.missing)} short</VisuallyHidden>
                          </span>
                        ) : null}
                      </span>
                    )}
                  </Td>
                ) : null}
                {board ? (
                  <Td>
                    <Address
                      value={row.bid.buyer}
                      name={row.mine ? YOURS : undefined}
                      explorerUrl={explorerOf(row.bid.buyer)}
                      explorerLabel="View the buyer on the explorer"
                      copyLabel="Copy buyer address"
                    />
                  </Td>
                ) : (
                  <Td>
                    <span className={styles.stack}>
                      <span>
                        <Tag state={row.stateName} />
                      </span>
                      <span className={styles.sub} data-wrap>
                        {ESCROW_LINE[row.escrow]}
                      </span>
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
