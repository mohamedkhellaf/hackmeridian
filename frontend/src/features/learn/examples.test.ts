import { describe, expect, it } from 'vitest'
import { NBSP } from '../../core/format'
import { isStandardExpiry } from '../../core/series'
import { EXAMPLE_DOMAIN, EXAMPLE_TERMS, SCENARIO_PRICES, deadlineText, exampleDeadline, workedExample, workedExamples } from './examples'

// A figure and its unit are joined by a no-break space on the page; the tests read them with a plain one.
const plain = (text: string | null) => (text ?? '').replaceAll(NBSP, ' ')
const byIntent = (intent: string) => workedExamples().find((x) => x.intent === intent)!

describe('the worked examples of the Learn page', () => {
  it('covers the four intents once each, main ones first', () => {
    expect(workedExamples().map((x) => [x.intent, x.name])).toEqual([
      ['floor', 'Set a floor'],
      ['earn-hold', 'Get paid to sell higher'],
      ['earn-buy', 'Get paid to buy lower'],
      ['lock-buy', 'Lock a buy price'],
    ])
  })

  it('formats the exact terms from integer units', () => {
    const floor = byIntent('floor')
    expect(plain(floor.qtyText)).toBe('5.00 BOND')
    expect(plain(floor.strikeTotalText)).toBe('50.00 USDx')
    expect(floor.strikePerUnitText).toBe('10.00')
    expect(plain(floor.premiumText)).toBe('1.80 USDx')
    expect(floor.premiumPerUnitText).toBe('0.36')
    expect(floor.startText).toBe('10.00')
    // The figure and its unit stay on one line.
    expect(floor.premiumText).toBe(`1.80${NBSP}USDx`)
  })

  it('names the collateral the contract rule gives: the strike for a put, the asset for a call', () => {
    expect(plain(byIntent('floor').collateralText)).toBe('50.00 USDx')
    expect(plain(byIntent('earn-hold').collateralText)).toBe('5.00 BOND')
    expect(plain(byIntent('earn-buy').collateralText)).toBe('47.50 USDx')
    expect(plain(byIntent('lock-buy').collateralText)).toBe('5.00 BOND')
  })

  it('keeps each figure of the note apart from its unit, for Amount: the same figures as the sentences', () => {
    for (const x of workedExamples()) {
      for (const [f, text] of [
        [x.qtyFigure, x.qtyText],
        [x.premiumFigure, x.premiumText],
        [x.collateralFigure, x.collateralText],
      ] as const) {
        expect(`${f.value}${NBSP}${f.unit}`).toBe(text)
      }
    }
    expect(byIntent('earn-hold').collateralFigure).toEqual({ value: '5.00', unit: 'BOND' })
    expect(byIntent('earn-buy').collateralFigure).toEqual({ value: '47.50', unit: 'USDx' })
  })

  it('takes breakeven and the extremes from the payoff module', () => {
    const rows = workedExamples().map((x) => [x.intent, x.breakevenText, x.maxLossText, x.maxGainText])
    expect(rows).toEqual([
      // Put bought at 10.00 for 1.80: breakeven 10.00 - 0.36; the loss stops at the premium; no cap on the gain.
      ['floor', '9.64', '1.80', null],
      // Call written at 10.50 for 0.95, asset at 10.00: 10.50 + 0.19; 50.00 - 0.95; 2.50 + 0.95.
      ['earn-hold', '10.69', '49.05', '3.45'],
      // Put written at 9.50 for 1.20: 9.50 - 0.24; 47.50 - 1.20; the premium.
      ['earn-buy', '9.26', '46.30', '1.20'],
      // Call bought at 10.00 for 1.90: 10.00 + 0.38; the premium; no cap.
      ['lock-buy', '10.38', '1.90', null],
    ])
  })

  it('reads each example at 8.00, 10.00 and 12.00', () => {
    const table = (intent: string) => byIntent(intent).scenarios.map((s) => [s.priceText, s.withText, s.withoutText, s.differenceText, s.exercised])
    expect(table('floor')).toEqual([
      ['8.00', '48.20', '40.00', '+8.20', true],
      ['10.00', '48.20', '50.00', '−1.80', false],
      ['12.00', '58.20', '60.00', '−1.80', false],
    ])
    expect(table('earn-hold')).toEqual([
      ['8.00', '40.95', '40.00', '+0.95', false],
      ['10.00', '50.95', '50.00', '+0.95', false],
      ['12.00', '53.45', '60.00', '−6.55', true],
    ])
    expect(table('earn-buy')).toEqual([
      ['8.00', '41.20', '47.50', '−6.30', true],
      ['10.00', '48.70', '47.50', '+1.20', false],
      ['12.00', '48.70', '47.50', '+1.20', false],
    ])
    expect(table('lock-buy')).toEqual([
      ['8.00', '48.10', '50.00', '−1.90', false],
      ['10.00', '48.10', '50.00', '−1.90', false],
      ['12.00', '58.10', '50.00', '+8.10', true],
    ])
  })

  it('values the lot itself at each scenario price', () => {
    expect(byIntent('floor').scenarios.map((s) => s.assetValueText)).toEqual(['40.00', '50.00', '60.00'])
    expect(SCENARIO_PRICES).toEqual([8, 10, 12])
  })

  it('samples the curve over the chart range with the strike and the breakeven exactly', () => {
    for (const x of workedExamples()) {
      const xs = x.curve.map((p) => p.s)
      expect(xs[0]).toBe(EXAMPLE_DOMAIN[0])
      expect(xs[xs.length - 1]).toBe(EXAMPLE_DOMAIN[1])
      expect([...xs].sort((a, b) => a - b)).toEqual(xs)
      expect(xs).toContain(x.strike)
      expect(xs).toContain(x.breakeven)
      // The payoff is with minus without, and it is zero at the breakeven.
      const atBreakeven = x.curve.find((p) => p.s === x.breakeven)!
      expect(Math.abs(atBreakeven.payoff)).toBeLessThan(1e-9)
      for (const p of x.curve) expect(p.payoff).toBeCloseTo(p.withValue - p.withoutValue, 12)
    }
  })

  it('is pure: the same terms give the same view', () => {
    expect(workedExample(EXAMPLE_TERMS[0])).toEqual(workedExample(EXAMPLE_TERMS[0]))
  })
})

describe('the example deadline', () => {
  const at = (iso: string) => Math.floor(Date.parse(iso) / 1000)

  it('is a standard expiry at least 48 hours away', () => {
    // Wednesday 11 Nov 2026, 12:00 UTC: Friday 13 Nov 08:00 is 44 hours away, so the example uses the next one.
    const wednesday = at('2026-11-11T12:00:00Z')
    expect(exampleDeadline(wednesday)).toBe(at('2026-11-20T08:00:00Z'))
    // Monday 9 Nov: Friday 13 Nov is far enough.
    expect(exampleDeadline(at('2026-11-09T07:00:00Z'))).toBe(at('2026-11-13T08:00:00Z'))
  })

  it('never returns a deadline in the past, whatever the day', () => {
    const start = at('2026-11-01T00:00:00Z')
    for (let hour = 0; hour < 24 * 70; hour += 5) {
      const now = start + hour * 3600
      const deadline = exampleDeadline(now)
      expect(isStandardExpiry(deadline)).toBe(true)
      expect(deadline - now).toBeGreaterThanOrEqual(48 * 3600)
    }
  })

  it('prints on one line', () => {
    const text = deadlineText(at('2026-11-20T08:00:00Z'))
    expect(text.replaceAll(NBSP, ' ')).toBe('20 Nov 2026, 08:00 UTC')
    expect(text).not.toContain(' ')
  })
})
