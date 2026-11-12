// The mirrored chain: calls on the left, the strike in the centre, puts on the right. Each side of a strike shows
// the two sides of its book (rulings E9 and F3): the best offer per unit with its size next to the strike, and the
// best request with its size further out. Each half is its own button: the offer opens Buy, the request opens
// Fill, an empty half posts a request. The whole table is one tab stop with arrow-key movement across the halves.
// On a phone (`compact`) the four halves keep their places and each prints its size under its figure.
import { Fragment, useMemo } from 'react'
import type { OptionKind } from '../../../core/options/types'
import type { ExpiryColumn, GridCell, MarketView } from '../../../data'
import { Glyph, Marker, RowHeader, TBody, THead, Table, TableWrap, Td, Th, Tr } from '../../../ui'
import { COPY, KIND_PLURAL } from './copy'
import { chainColumns, columnOf, describeCell, homePosition, referenceLine, strikeText } from './model'
import type { CellPosition, CellText, ChainColumn, Half, HalfContext, HalfText } from './model'
import { useRoving } from './useRoving'
import type { RovingCellProps } from './useRoving'
import styles from './ChainTable.module.css'

export interface ChainTableProps {
  view: MarketView
  column: ExpiryColumn
  /** `cellKey` of the selected series, or null. */
  selectedKey: string | null
  /** What a half's press does besides the cell: requests on the contract, the wallet, the ticket's place, an open form. */
  context: Omit<HalfContext, 'phrase'>
  /** A narrow column (a phone): each half prints its size under its figure, and the halves are touch targets. */
  compact?: boolean
  /** The units and the deadline, read out as the table's caption. */
  caption: string
  onPress: (cell: GridCell, half: Half) => void
}

/**
 * One half of a side: the figure with its size, or, when empty, nothing until it is pointed at or focused. The
 * button's text is its figure (or its hint), a run of words of its name, so what a voice user sees is what they can
 * say; the size is drawn by the stylesheet from `data-size`, and the name says it in words.
 */
function HalfButton({ cell, text, selected, roving, onPress }: { cell: GridCell; text: HalfText; selected: boolean; roving: RovingCellProps; onPress: (cell: GridCell, half: Half) => void }) {
  return (
    <button
      type="button"
      className={styles.half}
      aria-pressed={selected}
      aria-label={text.name}
      data-cell={cell.key}
      data-half={text.half}
      data-size={text.size === null ? undefined : `×${text.size}`}
      onClick={() => onPress(cell, text.half)}
      {...roving}
    >
      {text.figure !== null ? (
        <span className={styles.figure}>{text.own ? <Marker>{text.figure}</Marker> : text.figure}</span>
      ) : text.hint ? (
        <span className={styles.hint}>{text.hint}</span>
      ) : null}
    </button>
  )
}

/**
 * A side of a strike: two buttons in screen order (the call side mirrored, so the offer hugs the strike). "yours"
 * lies over the outer edge in a layer the pointer passes through; each half's name already says it.
 */
function SideCell({ cell, text, selected, row, roving, onPress }: { cell: GridCell; text: CellText; selected: boolean; row: number; roving: (row: number, col: ChainColumn) => RovingCellProps; onPress: (cell: GridCell, half: Half) => void }) {
  const kind = cell.ref.kind
  const halves = [text.offer, text.request].filter((h): h is HalfText => h !== null)
  const ordered = kind === 'call' ? [...halves].reverse() : halves
  return (
    <Td className={styles.cell} data-itm={text.inTheMoney || undefined}>
      <div className={styles.halves} data-kind={kind} data-one={halves.length === 1 || undefined}>
        {ordered.map((h) => (
          <HalfButton key={h.half} cell={cell} text={h} selected={selected} roving={roving(row, columnOf(kind, h.half))} onPress={onPress} />
        ))}
      </div>
      {text.yours ? (
        <span className={styles.mark} data-kind={kind} aria-hidden="true">
          {COPY.yours}
        </span>
      ) : null}
    </Td>
  )
}

function SideHead({ kind, requests }: { kind: OptionKind; requests: boolean }) {
  const offer = (
    <span key="offer" className={styles.headHalf}>
      <span className={styles.headLabel}>{COPY.offer}</span>
    </span>
  )
  const request = requests ? (
    <span key="request" className={styles.headHalf}>
      <span className={styles.headLabel}>{COPY.request}</span>
    </span>
  ) : null
  return (
    <Th className={styles.head} data-kind={kind}>
      <span className={styles.headKind}>
        <Glyph name={kind === 'call' ? 'long-call' : 'long-put'} />
        {KIND_PLURAL[kind]}
      </span>
      <span className={styles.headSlots} data-kind={kind} data-one={!requests || undefined}>
        {kind === 'call' ? [request, offer] : [offer, request]}
      </span>
    </Th>
  )
}

export function ChainTable({ view, column, selectedKey, context, compact = false, caption, onPress }: ChainTableProps) {
  const decimals = view.quote.decimals
  const reference = useMemo(() => referenceLine(view.reference, decimals), [view.reference, decimals])
  const rows = column.rows
  const cols = useMemo(() => chainColumns(context.bidsOn), [context.bidsOn])
  const selected = useMemo<CellPosition | null>(() => {
    if (selectedKey === null) return null
    const row = rows.findIndex((r) => r.call.key === selectedKey || r.put.key === selectedKey)
    return row < 0 ? null : { row, col: columnOf(rows[row].call.key === selectedKey ? 'call' : 'put', 'offer') }
  }, [rows, selectedKey])
  const roving = useRoving(rows.length, cols, homePosition(view, rows.length, cols, selected))
  const ctx: HalfContext = { ...context, phrase: reference?.phrase ?? null }
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
            <SideHead kind="call" requests={context.bidsOn} />
            <Th strike className={styles.strikeHead}>
              {COPY.strike}
            </Th>
            <SideHead kind="put" requests={context.bidsOn} />
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
                  <SideCell cell={row.call} text={describeCell(row.call, decimals, ctx)} selected={row.call.key === selectedKey} row={i} roving={roving.cellProps} onPress={onPress} />
                  <RowHeader className={styles.strike} data-selected={rowSelected || undefined}>
                    <span className={styles.strikeFigure}>{strikeText(row.strikePerUnit, decimals)}</span>
                    {at && reference ? <span className={styles.atTag}>{reference.label}</span> : null}
                  </RowHeader>
                  <SideCell cell={row.put} text={describeCell(row.put, decimals, ctx)} selected={row.put.key === selectedKey} row={i} roving={roving.cellProps} onPress={onPress} />
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
