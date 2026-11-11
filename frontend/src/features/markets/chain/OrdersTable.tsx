// Orders as a table: a side of a series book (offers and resale listings, or bids), or the "Other offers" list.
// Every row carries where it comes from (Maker, Resale or Bid), its exact terms and the one action it allows.
import { explorerAccount } from '../../../core/explorer'
import { formatExact, formatUnits } from '../../../core/format'
import { seriesRefOf } from '../../../core/market/selection'
import { Address, Amount, DateTime, Glyph, IconWarning, Marker, TBody, THead, Table, TableWrap, Td, Th, Tr, shortenAddress } from '../../../ui'
import { COPY, KIND_WORD, REASON_LABEL, SOURCE_LABEL } from './copy'
import { premiumText, strikeText } from './model'
import { OrderAction } from './OrderAction'
import { isMine, notesOf } from './orders'
import type { OrdersProps } from './orders'
import styles from './OrdersTable.module.css'

export function OrdersTable({ label, lines, side, showSeries = false, bestKey = null, ticketKey = null, health, explorer, busy, onTake, onCancel }: OrdersProps) {
  // With its own "why" column the reason is not repeated as a note.
  const notes = lines.map((line) => notesOf(line, health, !showSeries))
  const hasNotes = !showSeries && notes.some((n) => n.length > 0)
  const totalHead = side === 'bids' ? COPY.colEscrowed : COPY.colTotal

  return (
    <div className={styles.root} data-layout={showSeries ? 'series' : 'book'}>
      <TableWrap label={label}>
        <Table density={showSeries ? 'comfortable' : 'compact'} caption={label} className={styles.table}>
          <THead>
            <tr>
              {showSeries ? <Th>{COPY.colSeries}</Th> : null}
              <Th>{COPY.colFrom}</Th>
              <Th numeric>{COPY.colQty}</Th>
              <Th numeric>{COPY.colPerUnit}</Th>
              <Th numeric className={styles.totalCol}>
                {totalHead}
              </Th>
              {showSeries ? <Th>{COPY.colWhy}</Th> : null}
              {hasNotes ? <Th>{COPY.colNote}</Th> : null}
              <Th pinned className={styles.actionCol}>
                <span className="ui-vh">{COPY.colAction}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {lines.map((line, i) => {
              const { row } = line
              const mine = isMine(line.action)
              const ref = showSeries ? seriesRefOf(row) : null
              const perUnit = line.perUnit === null ? '–' : premiumText(line.perUnit, row.quote.decimals)
              const total = formatUnits(row.totalPremium, row.quote.decimals)
              return (
                <Tr key={row.key} selected={row.key === ticketKey} data-order={row.key} data-source={row.source}>
                  {showSeries ? (
                    <Td>
                      <span className={styles.series}>
                        <Glyph name={row.kind === 'call' ? 'long-call' : 'long-put'} />
                        <span>
                          {KIND_WORD[row.kind]} {ref ? strikeText(ref.strikePerUnit, row.quote.decimals) : `${formatUnits(row.totalStrike, row.quote.decimals)} in total`}
                        </span>
                      </span>
                      <span className={styles.sub}>
                        <DateTime value={row.expiry * 1000} />
                      </span>
                    </Td>
                  ) : null}
                  <Td>
                    <span className={styles.from}>
                      <span className={styles.source}>{SOURCE_LABEL[row.source]}</span>
                      {mine ? (
                        <span className={styles.own}>{COPY.yoursRow}</span>
                      ) : (
                        <Address
                          value={row.counterparty}
                          copyLabel={null}
                          explorerUrl={explorer ? explorerAccount(row.counterparty) : undefined}
                          explorerLabel={`View ${shortenAddress(row.counterparty)} on the explorer`}
                        />
                      )}
                    </span>
                  </Td>
                  <Td numeric>{formatUnits(row.underlyingQty, row.underlying.decimals)}</Td>
                  <Td numeric>
                    <span className={styles.perUnit}>
                      {row.key === bestKey ? <span className={styles.best}>{COPY.best}</span> : null}
                      <span className={styles.figure}>{mine ? <Marker>{perUnit}</Marker> : perUnit}</span>
                    </span>
                    <span className={styles.totalInline}>
                      {COPY.total} {total}
                    </span>
                  </Td>
                  <Td numeric className={styles.totalCol}>
                    <Amount value={total} exact={formatExact(row.totalPremium, row.quote.decimals)} />
                  </Td>
                  {showSeries ? (
                    <Td className={styles.why}>
                      {line.reason ? REASON_LABEL[line.reason] : null}
                      {notes[i].length ? <span className={styles.sub}>{notes[i].join(' ')}</span> : null}
                    </Td>
                  ) : null}
                  {hasNotes ? (
                    <Td className={styles.noteCell}>
                      {notes[i].length ? (
                        <span className={styles.note}>
                          <IconWarning size={16} />
                          <span>{notes[i].join(' ')}</span>
                        </span>
                      ) : null}
                    </Td>
                  ) : null}
                  <Td pinned className={styles.actionCol}>
                    <OrderAction line={line} busy={busy} onTake={onTake} onCancel={onCancel} />
                  </Td>
                </Tr>
              )
            })}
          </TBody>
        </Table>
      </TableWrap>
    </div>
  )
}
