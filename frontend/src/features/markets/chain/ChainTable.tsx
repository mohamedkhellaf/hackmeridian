// The mirrored chain: calls on the left, the strike in the centre on the sunken ground, puts on the right.
// Each side cell is one button (the series); the whole table is one tab stop with arrow-key movement.
import { Fragment, useMemo } from 'react'
import { formatUtc } from '../../../core/format'
import type { OptionKind } from '../../../core/options/types'
import type { ExpiryColumn, GridCell, MarketView } from '../../../data'
import { Glyph, Marker, RowHeader, TBody, THead, Table, TableWrap, Td, Th, Tr } from '../../../ui'
import { COPY } from './copy'
import { describeCell, homePosition, referenceLine, strikeText } from './model'
import type { CellPosition, CellText } from './model'
import { useRoving } from './useRoving'
import type { RovingCellProps } from './useRoving'
import styles from './ChainTable.module.css'

const SIDES: readonly OptionKind[] = ['call', 'put']

export interface ChainTableProps {
  view: MarketView
  column: ExpiryColumn
  /** `cellKey` of the selected series, or null. */
  selectedKey: string | null
  /** The contract has requests: an empty cell offers "Request". */
  bidsOn: boolean
  onPick: (cell: GridCell) => void
}

/**
 * The inside of a cell. The order in the markup is the order of the accessible name ("best premium 0.36, 2
 * makers"; "no offer, request a price"); the stylesheet mirrors one side so that premiums hug the strike.
 */
function CellContent({ text }: { text: CellText }) {
  const count = (
    <span className={styles.count}>
      {text.count}
      {text.yours ? `, ${COPY.yours}` : ''}
    </span>
  )
  if (text.variant === 'empty')
    return (
      <>
        {count}{' '}
        {text.request ? <span className={styles.request}>{COPY.request}</span> : <span className={styles.none} aria-hidden="true">–</span>}
      </>
    )
  return (
    <>
      <span className={styles.figure} data-variant={text.variant}>
        {text.variant === 'bid-only' ? (
          <span className={styles.bidWord}>{COPY.bid} </span>
        ) : null}
        {text.yours ? <Marker>{text.figure}</Marker> : text.figure}
      </span>{' '}
      {count}
    </>
  )
}

function SideCell({ cell, text, selected, roving, onPick }: { cell: GridCell; text: CellText; selected: boolean; roving: RovingCellProps; onPick: (cell: GridCell) => void }) {
  return (
    <Td className={styles.cell} data-itm={text.inTheMoney || undefined}>
      <button type="button" className={styles.button} aria-pressed={selected} aria-label={text.name} data-cell={cell.key} data-variant={text.variant} data-kind={cell.ref.kind} onClick={() => onPick(cell)} {...roving}>
        <CellContent text={text} />
      </button>
    </Td>
  )
}

export function ChainTable({ view, column, selectedKey, bidsOn, onPick }: ChainTableProps) {
  const decimals = view.quote.decimals
  const reference = useMemo(() => referenceLine(view.reference, decimals), [view.reference, decimals])
  const rows = column.rows
  const selected = useMemo<CellPosition | null>(() => {
    if (selectedKey === null) return null
    const row = rows.findIndex((r) => r.call.key === selectedKey || r.put.key === selectedKey)
    return row < 0 ? null : { row, side: rows[row].call.key === selectedKey ? 'call' : 'put' }
  }, [rows, selectedKey])
  const roving = useRoving(rows.length, SIDES, homePosition(view, rows.length, SIDES, selected))
  const ruleAt = reference && view.referenceRule ? view.referenceRule.below : -1
  const caption = `${COPY.chainHeading(view.asset.code)}, expiry ${formatUtc(column.expiry)}. ${COPY.units(view.quote.code, view.asset.code)}`

  const rule = reference ? (
    <tr className={styles.ruleRow} key="reference">
      <td className={styles.ruleSide} />
      <td className={styles.ruleMid}>
        <span className={styles.tag}>{reference.tag}</span>
      </td>
      <td className={styles.ruleSide} />
    </tr>
  ) : null

  return (
    <TableWrap label={caption} className={styles.wrap}>
      <Table density="compact" fixed caption={caption} className={styles.table} onKeyDown={roving.onKeyDown}>
        <colgroup>
          <col />
          <col className={styles.strikeCol} />
          <col />
        </colgroup>
        <THead>
          <tr>
            <Th className={styles.head}>
              <span className={styles.headInner}>
                <span>{COPY.makers}</span>
                <span className={styles.headKind}>
                  <Glyph name="long-call" />
                  {COPY.callPremium}
                </span>
              </span>
            </Th>
            <Th strike className={styles.strikeHead}>
              {COPY.strike}
            </Th>
            <Th className={styles.head}>
              <span className={styles.headInner}>
                <span className={styles.headKind}>
                  <Glyph name="long-put" />
                  {COPY.putPremium}
                </span>
                <span>{COPY.makers}</span>
              </span>
            </Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((row, i) => {
            const rowSelected = selected?.row === i
            return (
              <Fragment key={row.strikePerUnit.toString()}>
                {ruleAt === i ? rule : null}
                <Tr>
                  <SideCell cell={row.call} text={describeCell(row.call, decimals, reference?.phrase ?? null, bidsOn)} selected={row.call.key === selectedKey} roving={roving.cellProps(i, 'call')} onPick={onPick} />
                  <RowHeader className={styles.strike} data-selected={rowSelected || undefined}>
                    {strikeText(row.strikePerUnit, decimals)}
                  </RowHeader>
                  <SideCell cell={row.put} text={describeCell(row.put, decimals, reference?.phrase ?? null, bidsOn)} selected={row.put.key === selectedKey} roving={roving.cellProps(i, 'put')} onPick={onPick} />
                </Tr>
              </Fragment>
            )
          })}
          {ruleAt === rows.length ? rule : null}
        </TBody>
      </Table>
    </TableWrap>
  )
}
