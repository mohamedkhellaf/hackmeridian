import { describe, expect, it } from 'vitest'
import { direction, payoffValueText, sentences, seriesSummary, sliderKeyValue } from './a11y.ts'
import { autoDecimals, formatAxis, formatNumber, formatPercent, formatSigned, MINUS } from './format.ts'

const slider = { value: 8, min: 6, max: 14, step: 0.1, largeStep: 0.5 }

describe('sliderKeyValue (APG slider keys)', () => {
  it('moves one step with the arrow keys', () => {
    expect(sliderKeyValue('ArrowRight', slider)).toBe(8.1)
    expect(sliderKeyValue('ArrowUp', slider)).toBe(8.1)
    expect(sliderKeyValue('ArrowLeft', slider)).toBe(7.9)
    expect(sliderKeyValue('ArrowDown', slider)).toBe(7.9)
  })
  it('moves a large step with Page Up, Page Down and Shift with an arrow', () => {
    expect(sliderKeyValue('PageUp', slider)).toBe(8.5)
    expect(sliderKeyValue('PageDown', slider)).toBe(7.5)
    expect(sliderKeyValue('ArrowRight', { ...slider, shiftKey: true })).toBe(8.5)
    expect(sliderKeyValue('ArrowLeft', { ...slider, shiftKey: true })).toBe(7.5)
  })
  it('defaults the large step to ten steps', () => {
    expect(sliderKeyValue('PageUp', { ...slider, largeStep: undefined })).toBe(9)
  })
  it('goes to the ends with Home and End', () => {
    expect(sliderKeyValue('Home', slider)).toBe(6)
    expect(sliderKeyValue('End', slider)).toBe(14)
  })
  it('stops at the ends', () => {
    expect(sliderKeyValue('ArrowRight', { ...slider, value: 14 })).toBe(14)
    expect(sliderKeyValue('ArrowLeft', { ...slider, value: 6 })).toBe(6)
    expect(sliderKeyValue('PageUp', { ...slider, value: 13.8 })).toBe(14)
  })
  it('returns to the grid from a snapped value such as a breakeven', () => {
    expect(sliderKeyValue('ArrowRight', { ...slider, value: 9.64 })).toBe(9.7)
    expect(sliderKeyValue('ArrowLeft', { ...slider, value: 9.64 })).toBe(9.6)
  })
  it('leaves no floating-point tail over many presses', () => {
    let value = 6
    for (let i = 0; i < 37; i++) value = sliderKeyValue('ArrowRight', { ...slider, value })!
    expect(value).toBe(9.7)
  })
  it('ignores other keys and a missing step', () => {
    expect(sliderKeyValue('Tab', slider)).toBeNull()
    expect(sliderKeyValue('a', slider)).toBeNull()
    expect(sliderKeyValue('ArrowRight', { ...slider, step: 0 })).toBeNull()
  })
})

describe('direction', () => {
  it('names the side of zero', () => {
    expect(direction(5.7)).toBe('gain')
    expect(direction(-1.8)).toBe('loss')
    expect(direction(0)).toBe('even')
  })
  it('counts a value that prints as zero as even', () => {
    expect(direction(0.004)).toBe('even')
    expect(direction(-0.004)).toBe('even')
    expect(direction(0.004, 3)).toBe('gain')
  })
  it('handles an unlimited gain', () => {
    expect(direction(Infinity)).toBe('gain')
  })
})

describe('payoffValueText', () => {
  it('reads a gain and a loss in words, without a sign', () => {
    expect(payoffValueText({ price: 8, value: 28.2, unit: 'USDx' })).toBe('At 8.00 you would gain 28.20 USDx')
    expect(payoffValueText({ price: 12, value: -1.8, unit: 'USDx' })).toBe('At 12.00 you would lose 1.80 USDx')
  })
  it('says break even at zero', () => {
    expect(payoffValueText({ price: 9.64, value: 0, unit: 'USDx' })).toBe('At 9.64 you would break even')
    expect(payoffValueText({ price: 9.64, value: -0.0000001, unit: 'USDx' })).toBe('At 9.64 you would break even')
  })
  it('uses the decimals it is given', () => {
    expect(payoffValueText({ price: 0.00012, value: 0.5, unit: 'USDx', priceDecimals: 5 })).toBe('At 0.00012 you would gain 0.50 USDx')
  })
})

describe('seriesSummary', () => {
  it('describes start, end, low and high', () => {
    expect(seriesSummary([10, 9.8, 10.45, 10.3])).toBe('Starts at 10.00, ends at 10.30 (up), low 9.80, high 10.45.')
    expect(seriesSummary([10, 9.5], 2, 'USDx')).toBe('Starts at 10.00 USDx, ends at 9.50 USDx (down), low 9.50, high 10.00.')
  })
  it('handles flat, single and empty series', () => {
    expect(seriesSummary([10, 10, 10])).toBe('Flat at 10.00 over 3 values.')
    expect(seriesSummary([10])).toBe('One value, 10.00.')
    expect(seriesSummary([])).toBe('No data.')
    expect(seriesSummary([Number.NaN])).toBe('No data.')
  })
})

describe('sentences', () => {
  it('joins the parts that are present', () => {
    expect(sentences('Payoff at expiry', '', undefined, 'Strike 10.00.')).toBe('Payoff at expiry. Strike 10.00.')
    expect(sentences()).toBe('')
  })
})

describe('format', () => {
  it('groups, fixes the decimals and uses the true minus sign', () => {
    expect(formatNumber(1284.5)).toBe('1,284.50')
    expect(formatNumber(-1.8)).toBe(`${MINUS}1.80`)
    expect(formatNumber(0.00012, 5)).toBe('0.00012')
  })
  it('never prints a negative zero', () => {
    expect(formatNumber(-0.001)).toBe('0.00')
    expect(formatSigned(-0.004)).toBe('0.00')
    expect(formatSigned(0.004)).toBe('0.00')
  })
  it('signs gains and losses, and leaves zero bare', () => {
    expect(formatSigned(5.7)).toBe('+5.70')
    expect(formatSigned(-1.8)).toBe(`${MINUS}1.80`)
    expect(formatSigned(0)).toBe('0.00')
  })
  it('rounds a float that sits just under its printed value', () => {
    // 5 × (10 − 8.36) − 1.8 is 6.400000000000001 or 6.3999999 in floats; both must print 6.40.
    expect(formatSigned(5 * (10 - 8.36) - 1.8)).toBe('+6.40')
    expect(formatNumber(8.2 - 1e-13)).toBe('8.20')
  })
  it('compacts axis ends from 10,000 up only', () => {
    expect(formatAxis(9999.5)).toBe('9,999.50')
    expect(formatAxis(10_000)).toBe('10K')
    expect(formatAxis(1_250_000)).toBe('1.25M')
    expect(formatAxis(1_750_000)).toBe('1.75M')
    expect(formatAxis(750_000)).toBe('750K')
    expect(formatAxis(12_500)).toBe('12.5K')
    expect(formatAxis(1_200_000)).toBe('1.2M')
    expect(formatAxis(-25_000)).toBe(`${MINUS}25K`)
    expect(formatAxis(3_000_000_000)).toBe('3B')
  })
  it('chooses decimals from the span of the axis', () => {
    expect(autoDecimals(8)).toBe(2)
    expect(autoDecimals(0.004)).toBe(5)
    expect(autoDecimals(2_000_000)).toBe(0)
    expect(autoDecimals(0)).toBe(2)
    expect(autoDecimals(1e-12)).toBe(7)
  })
  it('truncates a ratio so it never reads better than it is', () => {
    expect(formatPercent(0.9999)).toBe('99.9 %')
    expect(formatPercent(0.92)).toBe('92.0 %')
    expect(formatPercent(1.1333)).toBe('113.3 %')
  })
  it('prints an unlimited value as the infinity sign', () => {
    expect(formatSigned(Infinity)).toBe('+∞')
  })
})
