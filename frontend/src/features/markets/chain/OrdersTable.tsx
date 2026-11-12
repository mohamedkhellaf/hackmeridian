// Orders as one table: the book of a series (offers above the gap line, requests below; ruling E9), "Your orders" or
// the "Other offers" list. Every row carries its number as the contract has it (ruling F1), who posted it (Maker,
// Seller or Buyer), its exact terms and the one action it allows. Columns have fixed widths, so a figure or a busy
// button never moves its neighbours; the spare width goes to the column that can use it.
import { Fragment } from 'react'
import { explorerAccount } from '../../../core/explorer'
import { formatExact, formatUnits, serialOf } from '../../../core/format'
import { seriesRefOf } from '../../../core/market/selection'
import { Address, Amount, DateTime, Glyph, IconWarning, Marker, TBody, THead, Table, TableWrap, Td, Th, Tr, shortenAddress } from '../../../ui'
import { COPY, KIND_WORD, REASON_LABEL, SOURCE_LABEL } from './copy'
import { premiumText, strikeText } from './model'
import { OrderAction } from './OrderAction'
import { idOf, isMine, notesOf } from './orders'
import type { OrderLine, OrdersProps } from './orders'
import styles from './OrdersTable.module.css'

/** "Fill request" and "Written by you" are wider than "Buy": the action column makes room only when one is there. */
const hasWide = (sections: OrdersProps['sections']): boolean => sections.some((s) => s.lines.some((l) => l.action.kind === 'fill' || (l.action.kind === 'none' && l.action.note !== 'Yours')))

export function OrdersTable({ label, sections, gap = null, showSeries = false, showReason = true, onSelect, allMine = false, sharedReason = null, ticketKey = null, health, explorer, busy, onTake, onCancel }: OrdersProps) {
  const reasonCol = showSeries && showReason
  // With its own "Reason" column the reason is not repeated as a note.
  const notes = new Map(sections.flatMap((s) => s.lines.map((line) => [line.row.key, notesOf(line, health, !showSeries, sharedReason)] as const)))
  const hasNotes = !showSeries && [...notes.values()].some((n) => n.warnings.length > 0 || n.reason !== null)
  // Book: No., From, Quantity, Per unit, Total, action. Series list: Series, No., From, Quantity, Per unit, action.
  const span = 6 + (reasonCol ? 1 : 0) + (hasNotes ? 1 : 0)

  const row = (line: OrderLine, best: boolean) => {
    const { row } = line
    const mine = isMine(line.action)
    const ref = showSeries ? seriesRefOf(row) : null
    const perUnit = line.perUnit === null ? '–' : premiumText(line.perUnit, row.quote.decimals)
    const total = formatUnits(row.totalPremium, row.quote.decimals)
    const note = notes.get(row.key) ?? { warnings: [], reason: null }
    const id = idOf(row)
    return (
      <Tr key={row.key} selected={row.key === ticketKey} data-order={row.key} data-source={row.source}>
        {showSeries ? (
          <Td>
            {onSelect && ref ? (
              <button type="button" className={styles.seriesButton} onClick={() => onSelect(row)} aria-label={`Show ${KIND_WORD[row.kind].toLowerCase()} ${strikeText(ref.strikePerUnit, row.quote.decimals)} in the chain`}>
                <Glyph name={row.kind === 'call' ? 'long-call' : 'long-put'} />
                <span>
                  {KIND_WORD[row.kind]} {strikeText(ref.strikePerUnit, row.quote.decimals)}
                </span>
              </button>
            ) : (
              <span className={styles.series}>
                <Glyph name={row.kind === 'call' ? 'long-call' : 'long-put'} />
                <span>
                  {KIND_WORD[row.kind]} {ref ? strikeText(ref.strikePerUnit, row.quote.decimals) : `${formatUnits(row.totalStrike, row.quote.decimals)} in total`}
                </span>
              </span>
            )}
            <span className={styles.sub}>
              <DateTime value={row.expiry * 1000} />
            </span>
          </Td>
        ) : null}
        <Td numeric className={styles.no}>
          {id === null ? null : serialOf(id)}
        </Td>
        <Td className={styles.fromCell}>
          <span className={styles.from}>
            <span className={styles.source}>{SOURCE_LABEL[row.source]}</span>
            {allMine ? null : mine ? (
              <span className={styles.own}>{COPY.yoursRow}</span>
            ) : (
              <Address value={row.counterparty} copyLabel={null} explorerUrl={explorer ? explorerAccount(row.counterparty) : undefined} explorerLabel={`View ${shortenAddress(row.counterparty)} on the explorer`} />
            )}
          </span>
        </Td>
        <Td numeric>{formatUnits(row.underlyingQty, row.underlying.decimals)}</Td>
        <Td numeric>
          <span className={styles.perUnit}>
            {best ? <span className={styles.best}>{COPY.best}</span> : null}
            <span className={styles.figure}>{mine ? <Marker>{perUnit}</Marker> : perUnit}</span>
          </span>
          {showSeries ? (
            <span className={styles.totalInline}>
              {COPY.total} {total}
            </span>
          ) : null}
        </Td>
        {showSeries ? null : (
          <Td numeric>
            <Amount value={total} exact={formatExact(row.totalPremium, row.quote.decimals)} />
          </Td>
        )}
        {reasonCol ? (
          <Td className={styles.why}>
            {line.reason ? REASON_LABEL[line.reason] : null}
            {note.warnings.length ? (
              <span className={styles.warn}>
                <IconWarning size={16} />
                <span>{note.warnings.join(' ')}</span>
              </span>
            ) : null}
          </Td>
        ) : null}
        {hasNotes ? (
          <Td className={styles.noteCell}>
            {note.reason ? <span className={styles.reason}>{note.reason}</span> : null}
            {note.warnings.length ? (
              <span className={styles.warn}>
                <IconWarning size={16} />
                <span>{note.warnings.join(' ')}</span>
              </span>
            ) : null}
          </Td>
        ) : null}
        <Td pinned className={styles.actionCol}>
          <OrderAction line={line} busy={busy} onTake={onTake} onCancel={onCancel} />
        </Td>
      </Tr>
    )
  }

  return (
    <div className={styles.root} data-layout={showSeries ? 'series' : 'book'} data-mine={allMine || undefined}>
      <TableWrap label={label}>
        <Table density={showSeries ? 'comfortable' : 'compact'} fixed caption={label} className={styles.table}>
          <colgroup>
            {showSeries ? <col className={styles.seriesCol} /> : null}
            <col className={styles.noCol} />
            <col className={styles.fromCol} />
            <col className={styles.qtyCol} />
            <col className={styles.perUnitCol} />
            {showSeries ? null : <col className={styles.totalCol} />}
            {reasonCol ? <col className={styles.whyCol} /> : null}
            {hasNotes ? <col className={styles.noteCol} /> : null}
            <col className={styles.actionColW} data-wide={hasWide(sections) || undefined} />
          </colgroup>
          <THead>
            <tr>
              {showSeries ? <Th>{COPY.colSeries}</Th> : null}
              <Th numeric>{COPY.colNo}</Th>
              <Th>{COPY.colFrom}</Th>
              <Th numeric>{COPY.colQty}</Th>
              <Th numeric>{COPY.colPerUnit}</Th>
              {showSeries ? null : <Th numeric>{COPY.colTotal}</Th>}
              {reasonCol ? <Th>{COPY.colWhy}</Th> : null}
              {hasNotes ? <Th>{COPY.colNote}</Th> : null}
              <Th pinned className={styles.actionCol}>
                <span className="ui-vh">{COPY.colAction}</span>
              </Th>
            </tr>
          </THead>
          {sections.map((section, i) => (
            <Fragment key={section.key}>
              {i === 1 && gap ? (
                <tbody className={styles.gapGroup}>
                  <tr>
                    <td colSpan={span} className={styles.gap}>
                      {gap}
                    </td>
                  </tr>
                </tbody>
              ) : null}
              <TBody data-section={section.key}>
                {section.title && section.lines.length ? (
                  <tr className={styles.groupRow}>
                    <th scope="rowgroup" colSpan={span} className={styles.group}>
                      {section.title} <span className={styles.groupCount}>{section.lines.length}</span>
                    </th>
                  </tr>
                ) : null}
                {section.lines.length ? (
                  section.lines.map((line) => row(line, section.best?.has(line.row.key) ?? false))
                ) : section.empty ? (
                  <Tr>
                    <Td colSpan={span} className={styles.emptyCell}>
                      {section.empty}
                    </Td>
                  </Tr>
                ) : null}
              </TBody>
            </Fragment>
          ))}
        </Table>
      </TableWrap>
    </div>
  )
}
