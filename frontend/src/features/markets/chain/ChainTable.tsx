// The mirrored chain: calls on the left, the strike in the centre, puts on the right. Each side of a strike shows
// the two sides of its book (ruling E9): the best offer per unit with its size, next to the strike, and the best
// request further out. Each side cell is one button (the series); the whole table is one tab stop with arrow-key
// movement. On a phone (`compact`) the same table keeps both halves: the request sits under the offer.
import { Fragment, useMemo } from 'react'
import type { OptionKind } from '../../../core/options/types'
import type { ExpiryColumn, GridCell, MarketView } from '../../../data'
import { Glyph, Marker, RowHeader, TBody, THead, Table, TableWrap, Td, Th, Tr } from '../../../ui'
import { COPY, KIND_PLURAL } from './copy'
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
  /** The contract has requests: an empty cell offers "Ask for a price". */
  bidsOn: boolean
  /** The connected address: only its own orders are marked. */
  me: string | null
  /** A narrow column (a phone): the request goes under the offer, and the rows are touch targets. */
  compact?: boolean
  /** The units and the deadline, read out as the table's caption. */
  caption: string
  onPick: (cell: GridCell) => void
}

/**
 * A cell is one button whose visible text is its one main figure (the best offer, else the best request, else
 * "Ask for a price"), so the words a voice user sees are words of its name. The size of the offer, the request
 * beside it and "yours" lie over the same cell in a layer the pointer passes through; the button's name already
 * says them, so that layer is hidden from assistive technology. Both use the same grid, mirrored on the call side
 * so the offer hugs the strike.
 */
function SideCell({ cell, text, selected, roving, onPick }: { cell: GridCell; text: CellText; selected: boolean; roving: RovingCellProps; onPick: (cell: GridCell) => void }) {
  // On a phone a priced cell takes a second line for the request or for "yours".
  const two = text.variant === 'priced' && (text.request !== null || text.yours)
  return (
    <Td className={styles.cell} data-itm={text.inTheMoney || undefined}>
      <button
        type="button"
        className={styles.button}
        aria-pressed={selected}
        aria-label={text.name}
        data-cell={cell.key}
        data-variant={text.variant}
        data-kind={cell.ref.kind}
        data-two={two || undefined}
        onClick={() => onPick(cell)}
        {...roving}
      >
        {text.variant === 'priced' ? (
          <span className={styles.premium}>{text.ownOffer ? <Marker>{text.offer}</Marker> : text.offer}</span>
        ) : text.variant === 'request-only' ? (
          <span className={styles.request}>{text.ownRequest ? <Marker>{text.request}</Marker> : text.request}</span>
        ) : text.ask ? (
          <span className={styles.ask}>{COPY.askPrice}</span>
        ) : (
          <span className={styles.none} aria-hidden="true">
            –
          </span>
        )}
      </button>
      {text.variant !== 'empty' ? (
        <span className={styles.overlay} data-kind={cell.ref.kind} data-variant={text.variant} data-two={two || undefined} aria-hidden="true">
          {text.variant === 'priced' ? <span className={styles.size}>× {text.size}</span> : null}
          {text.variant === 'priced' && text.request !== null ? <span className={styles.request}>{text.ownRequest ? <Marker>{text.request}</Marker> : text.request}</span> : null}
          {text.yours ? <span className={styles.mark}>{COPY.yours}</span> : null}
        </span>
      ) : null}
    </Td>
  )
}

function SideHead({ kind }: { kind: OptionKind }) {
  return (
    <Th className={styles.head} data-kind={kind}>
      <span className={styles.headKind}>
        <Glyph name={kind === 'call' ? 'long-call' : 'long-put'} />
        {KIND_PLURAL[kind]}
      </span>
      <span className={styles.headSlots}>
        <span className={styles.headOffer}>{COPY.offer}</span>
        <span className={styles.headRequest}>{COPY.request}</span>
      </span>
    </Th>
  )
}

export function ChainTable({ view, column, selectedKey, bidsOn, me, compact = false, caption, onPick }: ChainTableProps) {
  const decimals = view.quote.decimals
  const reference = useMemo(() => referenceLine(view.reference, decimals), [view.reference, decimals])
  const rows = column.rows
  const selected = useMemo<CellPosition | null>(() => {
    if (selectedKey === null) return null
    const row = rows.findIndex((r) => r.call.key === selectedKey || r.put.key === selectedKey)
    return row < 0 ? null : { row, side: rows[row].call.key === selectedKey ? 'call' : 'put' }
  }, [rows, selectedKey])
  const roving = useRoving(rows.length, SIDES, homePosition(view, rows.length, SIDES, selected))
  const phrase = reference?.phrase ?? null
  // The reference sits between two strikes: a dashed rule of its own. When it equals a strike, that strike's row
  // carries the label and no rule is drawn, so the rule never says the price is below a strike it equals.
  const atRow = reference && view.referenceRule ? view.referenceRule.at : null
  const ruleAt = reference && view.referenceRule && atRow === null ? view.referenceRule.below : -1

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
      <Table density="compact" fixed caption={caption} className={styles.table} data-compact={compact || undefined} onKeyDown={roving.onKeyDown}>
        <colgroup>
          <col />
          <col className={styles.strikeCol} />
          <col />
        </colgroup>
        <THead>
          <tr>
            <SideHead kind="call" />
            <Th strike className={styles.strikeHead}>
              {COPY.strike}
            </Th>
            <SideHead kind="put" />
          </tr>
        </THead>
        <TBody>
          {rows.map((row, i) => {
            const rowSelected = selected?.row === i
            const at = atRow === i
            return (
              <Fragment key={row.strikePerUnit.toString()}>
                {ruleAt === i ? rule : null}
                <Tr data-at={at || undefined}>
                  <SideCell cell={row.call} text={describeCell(row.call, decimals, phrase, bidsOn, me)} selected={row.call.key === selectedKey} roving={roving.cellProps(i, 'call')} onPick={onPick} />
                  <RowHeader className={styles.strike} data-selected={rowSelected || undefined}>
                    <span className={styles.strikeFigure}>{strikeText(row.strikePerUnit, decimals)}</span>
                    {at && reference ? <span className={styles.atTag}>{reference.label}</span> : null}
                  </RowHeader>
                  <SideCell cell={row.put} text={describeCell(row.put, decimals, phrase, bidsOn, me)} selected={row.put.key === selectedKey} roving={roving.cellProps(i, 'put')} onPick={onPick} />
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
