// The chain is one tab stop. Arrow keys move focus between its cells; Enter or Space presses the focused cell
// (they are buttons). The same hook drives the wide table and the phone list.
import { useCallback, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { OptionKind } from '../../../core/options/types'
import { moveForKey, nextPosition } from './model'
import type { CellPosition } from './model'

export interface RovingCellProps {
  'data-row': number
  'data-side': OptionKind
  tabIndex: 0 | -1
  onFocus: () => void
}

export interface Roving {
  /** Put on the element that contains every cell. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  /** Spread on each cell button. */
  cellProps: (row: number, side: OptionKind) => RovingCellProps
}

export function useRoving(rowCount: number, sides: readonly OptionKind[], home: CellPosition): Roving {
  const [active, setActive] = useState<CellPosition | null>(null)
  // The remembered cell only counts while it is on screen (the half can change on a phone).
  const tab = active && active.row < rowCount && sides.includes(active.side) ? active : home

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.altKey || event.shiftKey) return
      const move = moveForKey(event.key, event.ctrlKey || event.metaKey)
      if (!move) return
      const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-row][data-side]')
      if (!cell || !event.currentTarget.contains(cell)) return
      event.preventDefault()
      const to = nextPosition({ row: Number(cell.dataset.row), side: cell.dataset.side as OptionKind }, move, rowCount, sides)
      event.currentTarget.querySelector<HTMLElement>(`[data-row="${to.row}"][data-side="${to.side}"]`)?.focus()
    },
    [rowCount, sides],
  )

  const cellProps = useCallback(
    (row: number, side: OptionKind): RovingCellProps => ({
      'data-row': row,
      'data-side': side,
      tabIndex: tab.row === row && tab.side === side ? 0 : -1,
      onFocus: () => setActive((prev) => (prev && prev.row === row && prev.side === side ? prev : { row, side })),
    }),
    [tab.row, tab.side],
  )

  return { onKeyDown, cellProps }
}
