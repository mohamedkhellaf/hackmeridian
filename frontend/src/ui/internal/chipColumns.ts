/**
 * How many columns a row of chips gets: at most `aim`, no more than fit at `need` px each (the widest figure, its
 * tick and the chip's padding), and, when the chips wrap, balanced across the rows (9 at five a row is 5 and 4,
 * never 8 and 1).
 */
export function chipColumns(count: number, aim: number, width: number, need: number, gap: number): number {
  const n = Math.max(1, count)
  const target = Math.max(1, Math.floor(aim))
  if (!(width > 0) || !(need > 0)) return target
  const fit = Math.max(1, Math.floor((width + gap) / (need + gap)))
  let columns = Math.min(target, fit)
  if (n > columns) columns = Math.ceil(n / Math.ceil(n / columns))
  return columns
}
