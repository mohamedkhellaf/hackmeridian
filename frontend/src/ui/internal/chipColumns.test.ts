import { describe, expect, it } from 'vitest'
import { chipColumns } from './chipColumns'

describe('chipColumns', () => {
  it('fills one row when every chip fits at its measured width', () => {
    // Nine strikes on the desktop note: 758 px wide, 76 px per chip, 6 px gaps.
    expect(chipColumns(9, 9, 758, 76, 6)).toBe(9)
    expect(chipColumns(5, 5, 758, 78, 6)).toBe(5)
  })

  it('balances the rows when the chips wrap', () => {
    // 728 px holds eight: nine chips go five and four, never eight and one.
    expect(chipColumns(9, 9, 728, 80, 6)).toBe(5)
    // A phone: three a row.
    expect(chipColumns(9, 9, 254, 78, 6)).toBe(3)
    expect(chipColumns(5, 5, 254, 78, 6)).toBe(3)
  })

  it('keeps the aim when fewer chips than columns are shown', () => {
    expect(chipColumns(3, 5, 380, 64, 6)).toBe(5)
  })

  it('never goes under one column, and keeps the aim until measured', () => {
    expect(chipColumns(4, 5, 40, 80, 6)).toBe(1)
    expect(chipColumns(4, 5, 0, 80, 6)).toBe(5)
    expect(chipColumns(4, 5, 400, 0, 6)).toBe(5)
  })
})
