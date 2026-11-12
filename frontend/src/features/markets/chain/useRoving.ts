// The chain is one tab stop. Arrow keys move focus between its halves; Enter or Space presses the focused half
// (they are buttons). The same hook drives the wide table and the phone layout.
import { useCallback, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { moveForKey, nextPosition } from './model'
import type { CellPosition, ChainColumn } from './model'

export interface RovingCellProps {
  'data-row': number
  'data-col': ChainColumn
  tabIndex: 0 | -1
  onFocus: () => void
}

export interface Roving {
  /** Put on the element that contains every half. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  /** Spread on each half's button. */
  cellProps: (row: number, col: ChainColumn) => RovingCellProps
}

export function useRoving(rowCount: number, cols: readonly ChainColumn[], home: CellPosition): Roving {
  const [active, setActive] = useState<CellPosition | null>(null)
  // The remembered half only counts while it is on screen.
  const tab = active && active.row < rowCount && cols.includes(active.col) ? active : home

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.altKey || event.shiftKey) return
      const move = moveForKey(event.key, event.ctrlKey || event.metaKey)
      if (!move) return
      const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-row][data-col]')
      if (!cell || !event.currentTarget.contains(cell)) return
      event.preventDefault()
      const to = nextPosition({ row: Number(cell.dataset.row), col: cell.dataset.col as ChainColumn }, move, rowCount, cols)
      event.currentTarget.querySelector<HTMLElement>(`[data-row="${to.row}"][data-col="${to.col}"]`)?.focus()
    },
    [rowCount, cols],
  )

  const cellProps = useCallback(
    (row: number, col: ChainColumn): RovingCellProps => ({
      'data-row': row,
      'data-col': col,
      tabIndex: tab.row === row && tab.col === col ? 0 : -1,
      onFocus: () => setActive((prev) => (prev && prev.row === row && prev.col === col ? prev : { row, col })),
    }),
    [tab.row, tab.col],
  )

  return { onKeyDown, cellProps }
}
