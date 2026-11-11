// The chain on a phone: one half at a time (calls or puts), the strike still in the centre. The premium is the
// button of its row, with the same accessible name as the cell of the wide table; a tap anywhere on the row
// presses it, so every target is a full row and nothing is clipped.
import { Fragment, useMemo } from 'react'
import { formatUtc } from '../../../core/format'
import type { OptionKind } from '../../../core/options/types'
import type { ExpiryColumn, GridCell, MarketView } from '../../../data'
import { Glyph, Marker, RowHeader, TBody, THead, Table, Td, Th } from '../../../ui'
import { COPY, KIND_PLURAL } from './copy'
import { describeCell, homePosition, referenceLine, strikeText } from './model'
import type { CellPosition } from './model'
import { useRoving } from './useRoving'
import styles from './ChainList.module.css'

export interface ChainListProps {
  view: MarketView
  column: ExpiryColumn
  /** The half shown. */
  half: OptionKind
  selectedKey: string | null
  /** The contract has requests: an empty cell offers "Request". */
  bidsOn: boolean
  onPick: (cell: GridCell) => void
}

export function ChainList({ view, column, half, selectedKey, bidsOn, onPick }: ChainListProps) {
  const decimals = view.quote.decimals
  const reference = useMemo(() => referenceLine(view.reference, decimals), [view.reference, decimals])
  const rows = column.rows
  const sides = useMemo<readonly OptionKind[]>(() => [half], [half])
  const selected = useMemo<CellPosition | null>(() => {
    const row = rows.findIndex((r) => r[half].key === selectedKey)
    return row < 0 ? null : { row, side: half }
  }, [rows, half, selectedKey])
  const roving = useRoving(rows.length, sides, homePosition(view, rows.length, sides, selected))
  const ruleAt = reference && view.referenceRule ? view.referenceRule.below : -1
  const caption = `${view.asset.code} ${KIND_PLURAL[half].toLowerCase()} by strike, expiry ${formatUtc(column.expiry)}. ${COPY.units(view.quote.code, view.asset.code)}`

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
    <Table density="compact" fixed caption={caption} className={styles.table} onKeyDown={roving.onKeyDown}>
      <colgroup>
        <col />
        <col className={styles.strikeCol} />
        <col />
      </colgroup>
      <THead>
        <tr>
          <Th numeric>
            <span className={styles.headKind}>
              <Glyph name={half === 'call' ? 'long-call' : 'long-put'} />
              {half === 'call' ? COPY.callPremium : COPY.putPremium}
            </span>
          </Th>
          <Th strike className={styles.strikeHead}>
            {COPY.strike}
          </Th>
          <Th>{COPY.makers}</Th>
        </tr>
      </THead>
      <TBody>
        {rows.map((row, i) => {
          const cell = row[half]
          const text = describeCell(cell, decimals, reference?.phrase ?? null, bidsOn)
          const on = cell.key === selectedKey
          return (
            <Fragment key={cell.key}>
              {ruleAt === i ? rule : null}
              {/* The row is a pointer target for the button it contains; the keyboard and assistive technology use the button. */}
              <tr className={styles.row} data-itm={text.inTheMoney || undefined} data-selected={on || undefined} onClick={() => onPick(cell)}>
                <Td className={styles.cell}>
                  <button
                    type="button"
                    className={styles.button}
                    aria-pressed={on}
                    aria-label={text.name}
                    data-cell={cell.key}
                    data-variant={text.variant}
                    onClick={(event) => {
                      event.stopPropagation()
                      onPick(cell)
                    }}
                    {...roving.cellProps(i, half)}
                  >
                    {text.variant === 'empty' ? (
                      text.request ? (
                        <span className={styles.request}>{COPY.request}</span>
                      ) : (
                        <span className={styles.none} aria-hidden="true">
                          –
                        </span>
                      )
                    ) : (
                      <span className={styles.figure}>
                        {text.variant === 'bid-only' ? <span className={styles.bidWord}>{COPY.bid} </span> : null}
                        {text.yours ? <Marker>{text.figure}</Marker> : text.figure}
                      </span>
                    )}
                  </button>
                </Td>
                <RowHeader className={styles.strike}>{strikeText(row.strikePerUnit, decimals)}</RowHeader>
                <Td className={styles.count}>
                  {text.count}
                  {text.yours ? `, ${COPY.yours}` : ''}
                </Td>
              </tr>
            </Fragment>
          )
        })}
        {ruleAt === rows.length ? rule : null}
      </TBody>
    </Table>
  )
}
