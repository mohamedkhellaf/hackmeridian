import { useEffect, useRef, useState } from 'react'
import type { HTMLAttributes, ReactNode, Ref, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { IconChevronDown, IconChevronUp, IconSelect } from './icons'
import { cx } from './internal/cx'
import styles from './Table.module.css'

export interface TableWrapProps {
  /** Names the scrolling region for keyboard and screen-reader users ("Open offers on BOND"). */
  label: string
  children: ReactNode
  /** Gives the table its own vertical scroll, so the sticky header stays in view (a CSS length). */
  maxHeight?: string
  className?: string
}

/**
 * The `.ui-table-wrap` scroll container. Horizontal scroll stays inside it, never on the page. When the table
 * overflows, the wrapper becomes a focusable, named region so it can be scrolled with the keyboard.
 */
export function TableWrap({ label, children, maxHeight, className }: TableWrapProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [scrolls, setScrolls] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={cx('ui-table-wrap', styles.wrap, className)}
      style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      role={scrolls ? 'region' : undefined}
      aria-label={scrolls ? label : undefined}
      tabIndex={scrolls ? 0 : undefined}
      data-scrolls={scrolls || undefined}
    >
      {children}
    </div>
  )
}

export interface TableProps extends Omit<HTMLAttributes<HTMLTableElement>, 'className'> {
  /** `compact` rows are 32 px on desktop (chain, Margin). Phones keep 44 px rows whatever the density. */
  density?: 'comfortable' | 'compact'
  /** The surface the table sits on, so pinned cells and the sticky header can paint an opaque ground. */
  on?: 'bg' | 'surface'
  /** A caption for screen readers. Give every data table one unless a heading right above names it. */
  caption?: string
  /** Fixed column widths: columns do not jump while figures change. */
  fixed?: boolean
  /**
   * Cells hold sentences, not figures: text wraps and sits on the first line of its row, in the body size, and
   * the row header is set in the serif like a term on a term sheet (rules in brief, limits, issuer powers).
   */
  prose?: boolean
  /** The table element, for a composite widget that manages focus inside it (the chain). */
  ref?: Ref<HTMLTableElement>
  className?: string
}

/** A native, ruled table: header underline, row hairlines, no outer box, no zebra. */
export function Table({ density, on = 'bg', caption, fixed = false, prose = false, ref, className, children, ...rest }: TableProps) {
  return (
    <table
      {...rest}
      ref={ref}
      className={cx(styles.table, className)}
      data-density={density === 'compact' ? 'compact' : undefined}
      data-on={on}
      data-fixed={fixed || undefined}
      data-prose={prose || undefined}
    >
      {caption ? <caption className="ui-vh">{caption}</caption> : null}
      {children}
    </table>
  )
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...rest} className={cx(styles.thead, className)} />
}

export function TBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...rest} className={cx(styles.tbody, className)} />
}

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  /** The row the ticket or detail is showing. */
  selected?: boolean
  /** Hover tone for rows that can be opened. The row itself is not a control: put a link or button in a cell. */
  interactive?: boolean
  ref?: Ref<HTMLTableRowElement>
}

export function Tr({ selected = false, interactive = false, ref, className, ...rest }: TrProps) {
  return (
    <tr
      {...rest}
      ref={ref}
      className={cx(styles.tr, className)}
      data-selected={selected || undefined}
      data-interactive={interactive || undefined}
    />
  )
}

interface CellLook {
  /** Right-aligned tabular figures. */
  numeric?: boolean
  align?: 'start' | 'center' | 'end'
  /** Sticks to the right edge while the table scrolls: the action column. */
  pinned?: boolean
  /** The strike column: serif, semibold, on the cell tone, centred. */
  strike?: boolean
  /** The cell tone (`--cell-tone`), for in-the-money cells. Always paired with a word elsewhere in the row. */
  sunken?: boolean
}

export type SortDirection = 'asc' | 'desc' | 'none'

export interface ThProps extends CellLook, Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'> {
  /** Makes the header a sort button and sets `aria-sort`. */
  sort?: SortDirection
  onSort?: () => void
}

export function Th({ numeric, align, pinned, strike, sunken, sort, onSort, className, children, scope = 'col', ...rest }: ThProps) {
  const sortable = sort !== undefined && onSort !== undefined
  return (
    <th
      {...rest}
      scope={scope}
      className={cx(styles.th, className)}
      data-align={align ?? (numeric ? 'end' : strike ? 'center' : undefined)}
      data-pinned={pinned || undefined}
      data-strike={strike || undefined}
      data-sunken={sunken || undefined}
      aria-sort={sortable ? (sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none') : undefined}
    >
      {sortable ? (
        <button type="button" className={styles.sort} onClick={onSort}>
          <span>{children}</span>
          {sort === 'asc' ? <IconChevronUp size={12} /> : sort === 'desc' ? <IconChevronDown size={12} /> : <IconSelect size={12} />}
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export interface TdProps extends CellLook, Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'> {
  /** Secondary ink, for supporting columns. */
  muted?: boolean
}

export function Td({ numeric, align, pinned, strike, sunken, muted, className, ...rest }: TdProps) {
  return (
    <td
      {...rest}
      className={cx(styles.td, className)}
      data-align={align ?? (numeric ? 'end' : strike ? 'center' : undefined)}
      data-numeric={numeric || undefined}
      data-pinned={pinned || undefined}
      data-strike={strike || undefined}
      data-sunken={sunken || undefined}
      data-muted={muted || undefined}
    />
  )
}

/** A row header cell (`<th scope="row">`): the cell that names the row, for example the asset code. */
export function RowHeader({ className, ...rest }: Omit<ThHTMLAttributes<HTMLTableCellElement>, 'scope'>) {
  return <th {...rest} scope="row" className={cx(styles.td, styles.rowHeader, className)} />
}
