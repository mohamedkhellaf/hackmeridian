import { describe, expect, it } from 'vitest'
import { bulletGeometry, reserveState } from './bulletGeometry.ts'
import { samplePiecewise } from './geometry.ts'
import type { Point } from './geometry.ts'
import { healthLayout, healthState } from './healthLayout.ts'
import { estimateTextWidth, polylineHitsRect, rectsOverlap } from './labels.ts'
import type { Rect } from './labels.ts'
import { extremeAnchor, payoffLayout } from './payoffLayout.ts'
import type { ExtremeSpec, PayoffLayoutInput } from './payoffLayout.ts'
import { richText } from './richLabel.ts'
import type { Measure, RichLabel } from './richLabel.ts'
import { sparklineGeometry } from './sparklineGeometry.ts'
import { waterfallLayout } from './waterfallLayout.ts'
import { withWithoutLayout } from './withWithoutLayout.ts'

// No browser here: an estimate stands in for measured text, a little wide so the rules are tested with margin.
const measure: Measure = (text, strong) => estimateTextWidth(text, 12) * (strong ? 1.08 : 1.02)

const WIDTHS = [240, 280, 320, 336, 358, 420, 480, 560, 640, 760]

const variants = (word: string, figure: string, kind: 'max' | 'min', suffix?: string): RichLabel[] => {
  const tone = kind === 'max' ? 'gain' : 'loss'
  const core = [{ text: figure, tone, strong: true } as const, { triangle: kind === 'max' ? 'up' : 'down', tone } as const, ...(suffix ? [{ text: suffix, tone: 'muted' } as const] : [])]
  return [{ spans: [{ text: word, tone: 'muted' }, ...core] }, { spans: core }]
}

interface Scenario {
  name: string
  fn: (s: number) => number
  domain: [number, number]
  kinks: number[]
  strike: { value: number; text: string }
  breakevens: Array<{ value: number; text: string }>
  reference: { value: number; text: string }
  maxGain: { value: number; at?: number; figure: string; suffix?: string }
  maxLoss: { value: number; at?: number; figure: string; suffix?: string }
}

const scenarios: Scenario[] = [
  {
    name: 'long put',
    fn: (s) => 5 * Math.max(10 - s, 0) - 1.8,
    domain: [5.8, 13.8],
    kinks: [10],
    strike: { value: 10, text: 'K 10.00' },
    breakevens: [{ value: 9.64, text: 'BE 9.64' }],
    reference: { value: 9.82, text: 'Demo price 9.82' },
    maxGain: { value: 48.2, at: 0, figure: '+48.20', suffix: 'at 0.00' },
    maxLoss: { value: 1.8, figure: '−1.80' },
  },
  {
    name: 'long call',
    fn: (s) => 2 * Math.max(s - 120, 0) - 9,
    domain: [70, 166],
    kinks: [120],
    strike: { value: 120, text: 'K 120.00' },
    breakevens: [{ value: 124.5, text: 'BE 124.50' }],
    reference: { value: 118.4, text: 'Demo price 118.40' },
    maxGain: { value: Infinity, figure: 'unlimited' },
    maxLoss: { value: 9, figure: '−9.00' },
  },
  {
    name: 'written put',
    fn: (s) => 1.8 - 5 * Math.max(9.5 - s, 0),
    domain: [6, 14],
    kinks: [9.5],
    strike: { value: 9.5, text: 'K 9.50' },
    breakevens: [{ value: 9.14, text: 'BE 9.14' }],
    reference: { value: 10, text: 'Testnet faucet price 10.00' },
    maxGain: { value: 1.8, figure: '+1.80' },
    maxLoss: { value: 45.7, at: 0, figure: '−45.70', suffix: 'at 0.00' },
  },
  {
    name: 'zero premium',
    fn: (s) => 5 * Math.max(10 - s, 0),
    domain: [6, 14],
    kinks: [10],
    strike: { value: 10, text: 'K, BE 10.00' },
    breakevens: [],
    reference: { value: 10, text: 'Testnet faucet price 10.00' },
    maxGain: { value: 50, at: 0, figure: '+50.00', suffix: 'at 0.00' },
    maxLoss: { value: 0, figure: '0.00' },
  },
  {
    name: 'deep in the money',
    fn: (s) => 5 * Math.max(16 - s, 0) - 4,
    domain: [6, 16.6],
    kinks: [16],
    strike: { value: 16, text: 'K 16.00' },
    breakevens: [{ value: 15.2, text: 'BE 15.20' }],
    reference: { value: 10, text: 'Demo price 10.00' },
    maxGain: { value: 76, at: 0, figure: '+76.00', suffix: 'at 0.00' },
    maxLoss: { value: 4, figure: '−4.00' },
  },
  {
    name: 'deep out of the money',
    fn: (s) => 5 * Math.max(s - 20, 0) - 0.6,
    domain: [6, 14],
    kinks: [20],
    strike: { value: 20, text: 'K 20.00' },
    breakevens: [],
    reference: { value: 10, text: 'Demo price 10.00' },
    maxGain: { value: Infinity, figure: 'unlimited' },
    maxLoss: { value: 0.6, figure: '−0.60' },
  },
  {
    name: 'uncovered call written',
    fn: (s) => 42 - 10 * Math.max(s - 110, 0),
    domain: [76, 180],
    kinks: [110],
    strike: { value: 110, text: 'K 110.00' },
    breakevens: [{ value: 114.2, text: 'BE 114.20' }],
    reference: { value: 128, text: 'Publisher price 128.00' },
    maxGain: { value: 42, figure: '+42.00' },
    maxLoss: { value: Infinity, figure: 'unlimited' },
  },
  {
    name: 'very small prices',
    fn: (s) => 1_000_000 * Math.max(0.00012 - s, 0) - 6,
    domain: [0.00007, 0.00017],
    kinks: [0.00012],
    strike: { value: 0.00012, text: 'K 0.00012' },
    breakevens: [{ value: 0.000114, text: 'BE 0.000114' }],
    reference: { value: 0.000118, text: 'Demo price 0.000118' },
    maxGain: { value: 114, at: 0, figure: '+114.00', suffix: 'at 0.00' },
    maxLoss: { value: 6, figure: '−6.00' },
  },
  {
    name: 'very large amounts',
    fn: (s) => 250 * Math.max(s - 1_250_000, 0) - 12_500_000,
    domain: [750_000, 1_750_000],
    kinks: [1_250_000],
    strike: { value: 1_250_000, text: 'K 1,250,000' },
    breakevens: [{ value: 1_300_000, text: 'BE 1,300,000' }],
    reference: { value: 1_180_000, text: 'Demo price 1,180,000' },
    maxGain: { value: Infinity, figure: 'unlimited' },
    maxLoss: { value: 12_500_000, figure: '−12,500,000.00' },
  },
]

function inputFor(s: Scenario, width: number, price: number): PayoffLayoutInput {
  const points = samplePiecewise(s.fn, s.domain, s.kinks)
  const extremes: ExtremeSpec[] = []
  const gain = extremeAnchor(points, s.domain, 'max', s.maxGain)
  const loss = extremeAnchor(points, s.domain, 'min', s.maxLoss)
  if (gain) extremes.push({ id: 'max-gain', kind: 'max', anchor: gain, variants: variants('Max gain', s.maxGain.figure, 'max', gain.offScale ? s.maxGain.suffix : undefined) })
  if (loss) extremes.push({ id: 'max-loss', kind: 'min', anchor: loss, variants: variants('Max loss', s.maxLoss.figure, 'min', loss.offScale ? s.maxLoss.suffix : undefined) })
  return {
    width,
    height: width < 360 ? 200 : width < 560 ? 220 : 250,
    points,
    domain: s.domain,
    strikes: [s.strike],
    breakevens: s.breakevens,
    reference: s.reference,
    extremes,
    price,
    priceText: price.toFixed(2),
    minText: s.domain[0].toFixed(2),
    maxText: s.domain[1].toFixed(2),
    measure,
  }
}

const pairs = <T>(items: T[]): Array<[T, T]> => items.flatMap((a, i) => items.slice(i + 1).map((b): [T, T] => [a, b]))

describe('payoffLayout: labels never collide', () => {
  for (const s of scenarios) {
    it(`${s.name}: at every width and handle position`, () => {
      for (const width of WIDTHS) {
        for (let step = 0; step <= 16; step++) {
          const price = s.domain[0] + ((s.domain[1] - s.domain[0]) * step) / 16
          const layout = payoffLayout(inputFor(s, width, price))
          const where = `${s.name} at ${width}px, handle ${step}/16`

          // Inside the plot: no two labels touch, none leaves the drawing, none sits on the payoff line.
          for (const [a, b] of pairs(layout.labels)) {
            expect(rectsOverlap(a.box, b.box, 3), `${where}: "${richText(a)}" touches "${richText(b)}"`).toBe(false)
          }
          for (const label of layout.labels) {
            expect(label.box.x, `${where}: "${richText(label)}" left`).toBeGreaterThanOrEqual(0)
            expect(label.box.x + label.box.width, `${where}: "${richText(label)}" right`).toBeLessThanOrEqual(width + 0.01)
            expect(label.box.y, `${where}: "${richText(label)}" top`).toBeGreaterThanOrEqual(0)
            expect(label.box.y + label.box.height, `${where}: "${richText(label)}" bottom`).toBeLessThanOrEqual(layout.plot.bottom)
            expect(polylineHitsRect(layout.line, label.box, 2), `${where}: "${richText(label)}" on the line`).toBe(false)
          }

          // Under the plot: the flag is always there, and nothing touches it or anything else.
          expect(layout.handle, `${where}: handle`).not.toBeNull()
          const row: Rect[] = layout.lane.map((l) => ({ x: l.x, y: 0, width: measure(l.text), height: 10 }))
          if (layout.handle) row.push({ x: layout.handle.flagLeft, y: 0, width: layout.handle.flagWidth, height: 10 })
          for (const [a, b] of pairs(row)) expect(rectsOverlap(a, b, 5), `${where}: lane labels touch`).toBe(false)
          for (const r of row) {
            expect(r.x).toBeGreaterThanOrEqual(-0.01)
            expect(r.x + r.width).toBeLessThanOrEqual(width + 0.01)
          }
        }
      }
    })
  }
})

describe('payoffLayout: what is shown', () => {
  it('keeps the strike, breakeven, reference and both extremes of a long put at a ticket width', () => {
    const layout = payoffLayout(inputFor(scenarios[0], 336, 8))
    expect(layout.labels.map((l) => l.id).sort()).toEqual(['be-0', 'max-gain', 'max-loss', 'reference', 'strike-0'])
  })
  it('says where the largest gain is when it lies off the chart', () => {
    const layout = payoffLayout(inputFor(scenarios[0], 480, 8))
    const text = richText(layout.labels.find((l) => l.id === 'max-gain')!)
    expect(text).toBe('Max gain +48.20 at 0.00')
  })
  it('shortens a maximum or minimum label rather than drop the breakeven', () => {
    const layout = payoffLayout(inputFor(scenarios[4], 384, 10))
    expect(layout.labels.some((l) => l.id === 'be-0')).toBe(true)
    expect(richText(layout.labels.find((l) => l.id === 'max-loss')!)).toBe('−4.00')
    expect(richText(layout.labels.find((l) => l.id === 'max-gain')!)).toBe('Max gain +76.00 at 0.00')
  })
  it('puts the gain label above the highest point and the loss label below the lowest', () => {
    const layout = payoffLayout(inputFor(scenarios[0], 480, 8))
    const top = Math.min(...layout.line.map((p) => p.y))
    const low = Math.max(...layout.line.map((p) => p.y))
    const gain = layout.labels.find((l) => l.id === 'max-gain')!
    const loss = layout.labels.find((l) => l.id === 'max-loss')!
    expect(gain.box.y + gain.box.height).toBeLessThanOrEqual(top)
    expect(loss.box.y).toBeGreaterThanOrEqual(low)
  })
  it('splits the area at the breakeven: one gain polygon, one loss polygon', () => {
    const layout = payoffLayout(inputFor(scenarios[0], 480, 8))
    expect(layout.gain).toHaveLength(1)
    expect(layout.loss).toHaveLength(1)
    const be = layout.x(9.64)
    expect(Math.max(...layout.gain[0].map((p) => p.x))).toBeCloseTo(be, 6)
  })
  it('draws no loss area with a zero premium', () => {
    const layout = payoffLayout(inputFor(scenarios[3], 480, 9))
    expect(layout.loss).toHaveLength(0)
  })
  it('gives a flat line a third of the height instead of a wall of hatching', () => {
    const layout = payoffLayout(inputFor(scenarios[5], 480, 10))
    const band = Math.abs(layout.line[0].y - layout.zeroY)
    const plotHeight = layout.plot.bottom - layout.plot.top
    expect(band).toBeLessThan(plotHeight * 0.45)
    expect(band).toBeGreaterThan(plotHeight * 0.15)
  })
  it('puts the handle dot on the line and starts its drop line no lower than the zero line', () => {
    const layout = payoffLayout(inputFor(scenarios[0], 480, 12))
    const h = layout.handle!
    expect(h.y).toBeCloseTo(layout.y(-1.8), 6)
    expect(h.top).toBeLessThanOrEqual(layout.zeroY)
    expect(h.x).toBeCloseTo(layout.x(12), 0)
  })
  it('keeps the strike label when the top of the plot is crowded, at the foot of its rule', () => {
    // An uncovered call: the zero line sits at the top, where the gain and breakeven labels already are.
    const s = scenarios.find((c) => c.name === 'uncovered call written')!
    for (const width of [318, 344, 480]) {
      const layout = payoffLayout(inputFor(s, width, 128))
      const strike = layout.labels.find((l) => l.id === 'strike-0')
      expect(strike, `width ${width}`).toBeDefined()
      expect(layout.labels.map((l) => l.id).sort()).toEqual(['be-0', 'max-gain', 'max-loss', 'reference', 'strike-0'])
    }
  })
  it('leaves out the handle for a static figure', () => {
    const input = inputFor(scenarios[0], 480, 8)
    expect(payoffLayout({ ...input, price: undefined, priceText: undefined }).handle).toBeNull()
  })
})

describe('extremeAnchor', () => {
  const put = samplePiecewise((s) => 5 * Math.max(10 - s, 0) - 1.8, [6, 14], [10])
  it('attaches an off-chart maximum to the visible end nearest to it', () => {
    expect(extremeAnchor(put, [6, 14], 'max', { value: 48.2, at: 0 })).toEqual({ x: 6, y: 18.2, align: 'start', offScale: true })
  })
  it('attaches a flat minimum to its outer end', () => {
    expect(extremeAnchor(put, [6, 14], 'min', { value: 1.8 })).toEqual({ x: 14, y: -1.8, align: 'end', offScale: false })
  })
  it('flags a maximum that is not on the chart even without knowing where it is', () => {
    expect(extremeAnchor(put, [6, 14], 'max', { value: 48.2 })?.offScale).toBe(true)
  })
  it('sends an unlimited gain to the rising end', () => {
    const call = samplePiecewise((s) => 2 * Math.max(s - 120, 0) - 9, [70, 166], [120])
    expect(extremeAnchor(call, [70, 166], 'max', { value: Infinity })).toMatchObject({ x: 166, align: 'end', offScale: true })
  })
  it('centres on an interior peak', () => {
    const tent: Point[] = [
      { x: 0, y: -1 },
      { x: 4, y: 3 },
      { x: 6, y: 3 },
      { x: 10, y: -1 },
    ]
    expect(extremeAnchor(tent, [0, 10], 'max', { value: 3 })).toEqual({ x: 5, y: 3, align: 'middle', offScale: false })
  })
})

describe('withWithoutLayout', () => {
  const protectivePut = samplePiecewise((s) => 5 * Math.max(s, 10) - 1.8, [6, 14], [10]).map((p) => ({ x: p.x, with: p.y, without: 5 * p.x }))
  const coveredCall = samplePiecewise((s) => 5 * Math.min(s, 11) + 2.1, [6, 14], [11]).map((p) => ({ x: p.x, with: p.y, without: 5 * p.x }))
  const base = { domain: [6, 14] as [number, number], minText: '6.00', maxText: '14.00', measure }

  it('never lets two labels touch, sit on a line or leave the plot', () => {
    const cases = [
      { points: protectivePut, level: { value: 10, text: 'Floor 10.00' }, reference: { value: 9.82, text: 'Demo price 9.82' }, withText: 'With the put', withoutText: 'Without' },
      { points: coveredCall, level: { value: 11, text: 'Cap 11.00' }, reference: { value: 10, text: 'Testnet faucet price 10.00' }, withText: 'With the call written', withoutText: 'Without' },
    ]
    for (const c of cases) {
      for (const width of WIDTHS) {
        for (let step = 0; step <= 16; step++) {
          const price = 6 + (8 * step) / 16
          const layout = withWithoutLayout({ ...base, ...c, width, height: width < 360 ? 200 : 220, price, priceText: price.toFixed(2) })
          const where = `${c.withText} at ${width}px, handle ${step}/16`
          for (const [a, b] of pairs(layout.labels)) expect(rectsOverlap(a.box, b.box, 3), `${where}: "${richText(a)}" touches "${richText(b)}"`).toBe(false)
          for (const label of layout.labels) {
            expect(label.box.x, where).toBeGreaterThanOrEqual(0)
            expect(label.box.x + label.box.width, where).toBeLessThanOrEqual(width + 0.01)
            expect(label.box.y + label.box.height, where).toBeLessThanOrEqual(layout.axisY)
            expect(polylineHitsRect(layout.withLine, label.box, 2), `${where}: "${richText(label)}" on the solid line`).toBe(false)
            expect(polylineHitsRect(layout.withoutLine, label.box, 2), `${where}: "${richText(label)}" on the dashed line`).toBe(false)
          }
          // Either both lines are labelled directly, or neither is and the key under the plot names them.
          const series = layout.labels.filter((l) => l.id === 'with' || l.id === 'without').length
          expect(layout.keyNeeded ? series === 0 : series === 2, where).toBe(true)
          const row: Rect[] = layout.lane.map((l) => ({ x: l.x, y: 0, width: measure(l.text), height: 10 }))
          if (layout.handle) row.push({ x: layout.handle.flagLeft, y: 0, width: layout.handle.flagWidth, height: 10 })
          for (const [a, b] of pairs(row)) expect(rectsOverlap(a, b, 5), `${where}: lane labels touch`).toBe(false)
        }
      }
    }
  })
  it('labels both lines directly at a phone width, on the side where they part', () => {
    const layout = withWithoutLayout({ ...base, points: protectivePut, level: { value: 10, text: 'Floor 10.00' }, withText: 'With the put', withoutText: 'Without', width: 326, height: 200, price: 8, priceText: '8.00' })
    expect(layout.keyNeeded).toBe(false)
    const withLabel = layout.labels.find((l) => l.id === 'with')!
    const without = layout.labels.find((l) => l.id === 'without')!
    // A put floors the value on the left: both labels sit left of the floor, the solid one above the dashed one.
    expect(withLabel.box.x + withLabel.box.width).toBeLessThan(layout.level!.x)
    expect(without.box.x + without.box.width).toBeLessThan(layout.level!.x)
    expect(withLabel.box.y).toBeLessThan(without.box.y)
  })
  it('tints where the option leaves more and hatches where it costs', () => {
    const layout = withWithoutLayout({ ...base, points: protectivePut, withText: 'With the put', withoutText: 'Without', width: 480, height: 220 })
    expect(layout.helps).toHaveLength(1)
    expect(layout.costs).toHaveLength(1)
    // The crossing is the breakeven of the hedge: 9.64.
    expect(Math.max(...layout.helps[0].map((p) => p.x))).toBeCloseTo(layout.x(9.64), 6)
  })
  it('puts one dot on each line under the handle', () => {
    const layout = withWithoutLayout({ ...base, points: protectivePut, withText: 'With the put', withoutText: 'Without', width: 480, height: 220, price: 8, priceText: '8.00' })
    expect(layout.handle!.yWith).toBeCloseTo(layout.y(48.2), 6)
    expect(layout.handle!.yWithout).toBeCloseTo(layout.y(40), 6)
    expect(layout.handle!.top).toBeCloseTo(layout.y(48.2), 6)
  })
})

describe('healthLayout and healthState', () => {
  const labels = {
    nlvText: 'Account value 23,507.59',
    mmTexts: ['Liquidation (MM) 43,945.44', 'MM 43,945.44'],
    imTexts: ['Opening (IM) 54,931.80', 'IM 54,931.80'],
    measure,
  }
  it('names the three states and the unknown one', () => {
    expect(healthState(23_507.59, 43_945.44, 54_931.8)).toBe('liquidatable')
    expect(healthState(48_120, 43_945.44, 54_931.8)).toBe('restricted')
    expect(healthState(54_931.8, 43_945.44, 54_931.8)).toBe('open')
    expect(healthState(43_945.44, 43_945.44, 54_931.8)).toBe('restricted')
    expect(healthState(Number.NaN, 1, 2)).toBe('unknown')
  })
  it('scales to the larger of 1.5 IM and 1.1 NLV', () => {
    expect(healthLayout({ ...labels, width: 400, nlv: 23_507.59, mm: 43_945.44, im: 54_931.8 }).max).toBeCloseTo(82_397.7, 6)
    expect(healthLayout({ ...labels, width: 400, nlv: 200_000, mm: 43_945.44, im: 54_931.8 }).max).toBeCloseTo(220_000, 6)
  })
  it('keeps the threshold labels apart at every width, shortening or stacking them when needed', () => {
    for (const width of [160, 200, 240, 280, 320, 400, 560]) {
      for (const [mm, im] of [
        [43_945.44, 54_931.8],
        [50_000, 50_400],
        [0, 0],
        [100, 80_000],
      ]) {
        const layout = healthLayout({ ...labels, width, nlv: 23_507.59, mm, im })
        const [a, b] = layout.thresholds
        if (a.row === b.row) {
          const first = a.x < b.x ? a : b
          const second = a.x < b.x ? b : a
          expect(first.x + measure(first.text), `width ${width}, mm ${mm}, im ${im}`).toBeLessThanOrEqual(second.x - 4)
        }
        for (const t of layout.thresholds) {
          expect(t.x).toBeGreaterThanOrEqual(0)
          expect(t.x + measure(t.text)).toBeLessThanOrEqual(Math.max(width, measure(t.text) + 1))
        }
      }
    }
  })
  it('uses the long labels when there is room and the short ones when there is not', () => {
    expect(healthLayout({ ...labels, width: 560, nlv: 23_507.59, mm: 43_945.44, im: 54_931.8 }).thresholds[0].text).toBe('Liquidation (MM) 43,945.44')
    expect(healthLayout({ ...labels, width: 280, nlv: 23_507.59, mm: 43_945.44, im: 54_931.8 }).thresholds[0].text).toBe('MM 43,945.44')
  })
  it('keeps the account label inside the bar at both ends', () => {
    for (const nlv of [0, 500, 80_000, 500_000]) {
      const layout = healthLayout({ ...labels, width: 320, nlv, mm: 43_945.44, im: 54_931.8 })
      expect(layout.nlvLabel.x).toBeGreaterThanOrEqual(0)
      expect(layout.nlvLabel.x + measure(labels.nlvText, true)).toBeLessThanOrEqual(320)
    }
  })
})

describe('waterfallLayout', () => {
  const segments = [
    { id: 'margin', value: 300 },
    { id: 'vault', value: 100 },
    { id: 'deficit', value: 50, kind: 'deficit' as const },
  ]
  it('sizes the segments in proportion, with 2 px between them', () => {
    const layout = waterfallLayout({ width: 454, segments, labelWidths: [120, 80, 90] })
    expect(layout.bars.map((b) => Math.round(b.width))).toEqual([300, 100, 50])
    expect(layout.bars[1].x - (layout.bars[0].x + layout.bars[0].width)).toBeCloseTo(2, 6)
    expect(layout.bars[2].x + layout.bars[2].width).toBeCloseTo(454, 6)
  })
  it('marks the line between paid and unpaid just before the deficit', () => {
    const layout = waterfallLayout({ width: 454, segments, labelWidths: [120, 80, 90] })
    expect(layout.paidX).toBeCloseTo(layout.bars[2].x - 1, 6)
    expect(waterfallLayout({ width: 454, segments: segments.slice(0, 2), labelWidths: [120, 80] }).paidX).toBeNull()
  })
  it('orders the paid tones and draws nothing for a zero segment', () => {
    const layout = waterfallLayout({ width: 300, segments: [{ id: 'margin', value: 120 }, { id: 'vault', value: 0 }, { id: 'deficit', value: 0, kind: 'deficit' }], labelWidths: [100, 70, 80] })
    expect(layout.bars).toHaveLength(1)
    expect(layout.bars[0]).toMatchObject({ id: 'margin', order: 0, kind: 'paid' })
    expect(layout.paidX).toBeNull()
  })
  it('pushes the labels apart, and gives up on one row when they cannot fit', () => {
    const wide = waterfallLayout({ width: 454, segments, labelWidths: [140, 90, 90] })
    expect(wide.labels).not.toBeNull()
    const xs = wide.labels!.map((l) => l.x)
    expect(xs[1]).toBeGreaterThanOrEqual(xs[0] + 140)
    expect(xs[2]).toBeGreaterThanOrEqual(xs[1] + 90)
    expect(xs[2] + 90).toBeLessThanOrEqual(454)
    expect(waterfallLayout({ width: 280, segments, labelWidths: [140, 90, 90] }).labels).toBeNull()
  })
  it('shares a scale when a maximum is given, and survives an empty payout', () => {
    const layout = waterfallLayout({ width: 400, segments: segments.slice(0, 1), max: 600, labelWidths: [100] })
    expect(layout.bars[0].width).toBeCloseTo(200, 6)
    expect(waterfallLayout({ width: 400, segments: [{ id: 'margin', value: 0 }], labelWidths: [100] }).bars).toEqual([])
  })
  it('keeps the paid label inside the bar', () => {
    const layout = waterfallLayout({ width: 300, segments: [{ id: 'margin', value: 1 }, { id: 'deficit', value: 99, kind: 'deficit' }], labelWidths: [100, 100], paidLabelWidth: 150 })
    expect(layout.paidLabelX).toBe(0)
  })
})

describe('bulletGeometry and reserveState', () => {
  it('hatches a shortfall between the bar and the tick', () => {
    expect(bulletGeometry(230, 250, 250, 250)).toEqual({ bar: 230, tick: 250, shortfall: [230, 250], excess: null })
  })
  it('continues past the tick for an excess', () => {
    expect(bulletGeometry(3.4, 3, 4, 400)).toMatchObject({ bar: 300, tick: 300, shortfall: null })
    expect(bulletGeometry(3.4, 3, 4, 400).excess?.[1]).toBeCloseTo(340, 6)
  })
  it('draws neither when held equals locked, and no tick without a target', () => {
    expect(bulletGeometry(1080, 1080, 1200, 240)).toEqual({ bar: 216, tick: 216, shortfall: null, excess: null })
    expect(bulletGeometry(36, undefined, 72, 200)).toEqual({ bar: 100, tick: null, shortfall: null, excess: null })
  })
  it('stays inside the track for values beyond the scale or below zero', () => {
    expect(bulletGeometry(500, 100, 200, 200).excess).toEqual([100, 200])
    expect(bulletGeometry(-5, 100, 200, 200).bar).toBe(0)
    expect(bulletGeometry(0, 0, 0, 200)).toEqual({ bar: 0, tick: 0, shortfall: null, excess: null })
  })
  it('names the state of a reserve', () => {
    expect(reserveState(250, 230)).toBe('short')
    expect(reserveState(3, 3.4)).toBe('over')
    expect(reserveState(1080, 1080)).toBe('equal')
  })
})

describe('sparklineGeometry', () => {
  it('spreads the values across the box, highest at the top', () => {
    const g = sparklineGeometry([1, 3, 2], 104, 32)
    expect(g.line.map((p) => p.x)).toEqual([4, 52, 100])
    expect(g.line[1].y).toBe(4)
    expect(g.line[0].y).toBe(28)
    expect(g.last).toEqual(g.line[2])
  })
  it('centres a flat series and a single value', () => {
    expect(sparklineGeometry([10, 10, 10], 100, 32).line.every((p) => p.y === 16)).toBe(true)
    expect(sparklineGeometry([10], 100, 32).last).toEqual({ x: 96, y: 16 })
  })
  it('is empty without finite values', () => {
    expect(sparklineGeometry([], 100, 32)).toEqual({ line: [], last: null, ruleY: null })
    expect(sparklineGeometry([Number.NaN], 100, 32).last).toBeNull()
  })
  it('includes a level in the scale so its rule stays in the box', () => {
    const g = sparklineGeometry([10.1, 10.3], 100, 32, 10)
    expect(g.ruleY).not.toBeNull()
    expect(g.ruleY!).toBeLessThanOrEqual(32)
    expect(g.ruleY!).toBeGreaterThan(g.line[0].y)
  })
})
