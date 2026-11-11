import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { formatUnits, formatUtcDay } from '../../../core/format'
import { cellKey } from '../../../core/market/selection'
import { DEMO_WALLETS } from '../../../core/options/demoAccounts'
import { noReference } from '../../../core/reference'
import { FIXED_MS, demoWorld } from '../../../data/derived/demoSource.testhelper'
import type { DemoWorld } from '../../../data/derived/demoSource.testhelper'
import { buildMarket } from '../../../data/derived/market'
import type { GridCell, MarketView } from '../../../data'
import {
  chainColumns,
  defaultColumn,
  describeCell,
  gapLine,
  halfAction,
  halfRow,
  homePosition,
  leftLabel,
  missingDeadlineLine,
  moveForKey,
  nextPosition,
  premiumText,
  referenceLine,
  resolveSelection,
  selectionSearch,
  seriesTitle,
  strikeParam,
  strikeText,
} from './model'
import type { HalfContext } from './model'

const units = (n: number) => BigInt(Math.round(n * 100)) * 10n ** 5n // 7 decimals
/** Core keeps a short date or time on one line with no-break spaces (ruling F7); the pins below read them as spaces. */
const sp = (text: string | null | undefined): string | null | undefined => text?.replace(/\u00a0/g, ' ')

let w: DemoWorld
let fund: MarketView
let bond: MarketView
let fundA: MarketView
let bondA: MarketView
beforeAll(async () => {
  vi.useFakeTimers({ now: FIXED_MS, toFake: ['Date'] })
  w = await demoWorld()
  fund = buildMarket(w.source(null), w.assets.FUND, w.quote, w.reference(w.assets.FUND))
  bond = buildMarket(w.source(null), w.assets.BOND, w.quote, w.reference(w.assets.BOND))
  fundA = buildMarket(w.source(DEMO_WALLETS.a), w.assets.FUND, w.quote, w.reference(w.assets.FUND))
  bondA = buildMarket(w.source(DEMO_WALLETS.a), w.assets.BOND, w.quote, w.reference(w.assets.BOND))
})
afterAll(() => vi.useRealTimers())

const cells = (view: MarketView): GridCell[] => view.columns.flatMap((c) => c.rows.flatMap((r) => [r.call, r.put]))

describe('figures', () => {
  it('prints strikes exactly, with at least two decimals', () => {
    expect(strikeText(units(100), 7)).toBe('100.00')
    expect(strikeText(units(9.8), 7)).toBe('9.80')
    expect(strikeText(247_500_000n, 7)).toBe('24.75')
    expect(strikeText(12_345_678n, 7)).toBe('1.2345678')
    expect(strikeText(units(1250), 7)).toBe('1,250.00')
  })

  it('writes the strike param without grouping so it parses back', () => {
    expect(strikeParam(units(1250), 7)).toBe('1250.00')
    expect(strikeParam(units(9.8), 7)).toBe('9.80')
  })

  it('truncates a premium and never shows a non-zero one as zero', () => {
    expect(premiumText(3_699_999n, 7)).toBe('0.36')
    expect(premiumText(1n, 7)).toBe('<0.01')
  })

  it('keeps the largest unit of the time left', () => {
    expect(sp(leftLabel(44 * 3600))).toBe('1 d')
    expect(sp(leftLabel(15 * 86_400 + 3600))).toBe('15 d')
    expect(sp(leftLabel(5 * 3600 + 120))).toBe('5 h')
    expect(sp(leftLabel(12 * 60 + 5))).toBe('12 min')
    expect(sp(leftLabel(30))).toBe('<1 min')
    expect(leftLabel(-1)).toBe('expired')
  })

  it('names a series with the strike as the chain prints it', () => {
    expect(sp(seriesTitle('BOND', { kind: 'put', strikePerUnit: units(100), expiry: bond.expiries[0] }, 7))).toBe('BOND 100.00 put, 13 Nov')
    expect(sp(seriesTitle('FUND', { kind: 'call', strikePerUnit: units(9.8), expiry: fund.expiries[2] }, 7))).toBe('FUND 9.80 call, 27 Nov')
  })

  it('reads the reference with its label, and has none without a price', () => {
    expect(referenceLine(bond.reference, 7)).toEqual({ tag: 'Demo price 99.40', label: 'Demo price', phrase: 'the demo price', price: '99.40' })
    expect(referenceLine(noReference(), 7)).toBeNull()
  })

  it('states the gap between the best offer and the best request, truncated', () => {
    expect(gapLine(units(0.21), units(0.18), 7)).toBe('0.03 between the best offer and the best request.')
    expect(gapLine(2_149_999n, 1_850_001n, 7)).toBe('0.02 between the best offer and the best request.')
    expect(gapLine(units(0.2), units(0.2), 7)).toBe('The best request equals the best offer.')
    expect(gapLine(units(0.2), units(0.25), 7)).toBe('The best request is 0.05 above the best offer.')
    expect(gapLine(null, units(0.2), 7)).toBeNull()
    expect(gapLine(units(0.2), null, 7)).toBeNull()
  })
})

describe('selection from the URL', () => {
  it('lands on the first listed date that has offers', () => {
    expect(defaultColumn(fund.columns)?.day).toBe('2026-11-13')
    expect(defaultColumn([])).toBeNull()
    const quiet = fund.columns.map((c, i) => ({ ...c, offers: i === 2 ? 3 : 0, bids: i === 1 ? 1 : 0 }))
    expect(defaultColumn(quiet)?.day).toBe('2026-11-27')
    expect(defaultColumn(quiet.map((c) => ({ ...c, offers: 0 })))?.day).toBe('2026-11-20')
  })

  it('selects nothing without a kind and a strike', () => {
    const s = resolveSelection(fund, {})
    expect(s.column?.day).toBe('2026-11-13')
    expect(s.ref).toBeNull()
    expect(s.cell).toBeNull()
    expect(resolveSelection(fund, { kind: 'put' }).ref).toBeNull()
    expect(resolveSelection(fund, { strike: '10.00' }).ref).toBeNull()
  })

  it('selects the grid cell the params name, whatever the trailing zeros', () => {
    for (const strike of ['10', '10.0', '10.00', '10.0000000']) {
      const s = resolveSelection(fund, { expiry: '2026-11-20', kind: 'put', strike })
      expect(s.column?.day).toBe('2026-11-20')
      expect(s.ref).toEqual({ underlyingId: w.assets.FUND.contractId, expiry: fund.expiries[1], kind: 'put', strikePerUnit: units(10) })
      expect(s.cell?.key).toBe(cellKey(s.ref!))
    }
  })

  it('round-trips through the search params', () => {
    for (const cell of cells(fund)) {
      const back = resolveSelection(fund, selectionSearch(cell.ref, 7))
      expect(back.cell).toBe(cell)
    }
  })

  it('shows the default column for a date that is not listed and has no order, selects nothing and says so', () => {
    const s = resolveSelection(fund, { expiry: '2026-11-14', kind: 'put', strike: '10.00' })
    expect(s.column?.day).toBe('2026-11-13')
    expect(s.ref).toBeNull()
    expect(s.cell).toBeNull()
    expect(s.missing).toBe('2026-11-14')
    expect(resolveSelection(fund, { expiry: '2026-11-20' }).missing).toBeNull()
    const now = Math.floor(FIXED_MS / 1000)
    expect(sp(missingDeadlineLine('2026-11-14', s.column!, now))).toBe('14 Nov is not a listed deadline. Showing 13 Nov.')
    expect(sp(missingDeadlineLine('2020-01-03', s.column!, now))).toBe('The 3 Jan 2020 deadline has passed. Showing 13 Nov.')
    expect(missingDeadlineLine('not a day', s.column!, now)).toBeNull()
  })

  it('keeps a series on an unlisted date that carries an order, without a chain cell', () => {
    expect(fund.otherExpiries).toHaveLength(1)
    const day = new Date(fund.otherExpiries[0] * 1000).toISOString().slice(0, 10)
    const s = resolveSelection(fund, { expiry: day, kind: 'put', strike: '10.20' })
    expect(s.ref?.expiry).toBe(fund.otherExpiries[0])
    expect(s.cell).toBeNull()
    expect(s.column?.day).toBe('2026-11-13')
  })

  it('keeps an off-grid strike as a series without a cell, and rejects a strike that is not a positive amount', () => {
    const off = resolveSelection(fund, { kind: 'call', strike: '10.10' })
    expect(off.ref?.strikePerUnit).toBe(units(10.1))
    expect(off.cell).toBeNull()
    expect(resolveSelection(fund, { kind: 'call', strike: '0' }).ref).toBeNull()
    expect(resolveSelection(fund, { kind: 'call', strike: '1.23456789' }).ref).toBeNull()
    expect(resolveSelection(fund, { kind: 'call', strike: 'abc' }).ref).toBeNull()
  })
})

describe('cells', () => {
  /** A guest on a narrow page, nothing open: a price selects its series. */
  const ctx = (over: Partial<HalfContext> = {}): HalfContext => ({ phrase: 'the demo price', bidsOn: true, me: null, wide: false, form: null, ...over })
  const word = (kind: string) => (kind === 'put' ? 'put' : 'call')

  it('shows the best offer per unit with its size on the offer half; the maker count is in the name only', () => {
    const priced = cells(bond).filter((c) => !c.empty)
    expect(priced.length).toBeGreaterThan(20)
    for (const cell of priced) {
      const { offer, inTheMoney } = describeCell(cell, 7, ctx())
      expect(offer.figure).toBe(premiumText(cell.bestPerUnit!, 7))
      expect(offer.size).toBe(formatUnits(cell.best!.underlyingQty, 7))
      expect(offer.hint).toBeNull()
      expect(offer.name.startsWith(`Offer ${offer.figure} at ${strikeText(cell.ref.strikePerUnit, 7)}, ${word(cell.ref.kind)}, ${formatUtcDay(cell.ref.expiry)}, for ${offer.size} BOND`)).toBe(true)
      expect(offer.name).toMatch(/, \d+ offers?(, \d+ makers?)?(,|\.$)/)
      expect(offer.name.includes('in the money at the demo price')).toBe(cell.moneyness === 'in')
      expect(inTheMoney).toBe(cell.moneyness === 'in')
    }
    const one = priced.find((c) => c.makers === 1 && c.offers === 1)!
    expect(describeCell(one, 7, ctx({ phrase: null })).offer.name).toMatch(/, 1 offer, 1 maker\.$/)
    const two = priced.find((c) => c.makers === 2)!
    expect(describeCell(two, 7, ctx({ phrase: null })).offer.name).toMatch(/, 2 offers, 2 makers\.$/)
  })

  it('says nothing about moneyness without a reference', () => {
    for (const cell of cells(bond)) {
      const text = describeCell(cell, 7, ctx({ phrase: null }))
      expect(text.offer.name).not.toMatch(/the money/)
      expect(text.request?.name).not.toMatch(/the money/)
    }
  })

  it('shows nothing on an empty half at rest; its hint and name say a press posts a request (ruling F2)', () => {
    const empty = cells(fund).find((c) => c.empty && c.bids === 0)!
    const { offer, request } = describeCell(empty, 7, ctx({ phrase: null }))
    const at = `at ${strikeText(empty.ref.strikePerUnit, 7)}, ${word(empty.ref.kind)}, ${formatUtcDay(empty.ref.expiry)}`
    expect([offer.figure, offer.size, request!.figure, request!.size]).toEqual([null, null, null, null])
    expect(offer.hint).toBe('Post a request')
    expect(offer.name).toBe(`No offer ${at}. Post a request.`)
    expect(request!.name).toBe(`No request ${at}. Post a request.`)
    expect(offer.action).toEqual({ kind: 'post' })
    // The director's specimen, word for word, with the no-break space core puts inside a short date.
    const call102 = bond.columns[0].rows.find((r) => r.strikePerUnit === units(102))!.call
    expect(describeCell(call102, 7, ctx({ phrase: null })).offer.name.replace(/\u00a0/g, ' ')).toBe('No offer at 102.00, call, 13 Nov. Post a request.')
    // A contract without requests: no request half, and an empty offer half opens the write form.
    const noBids = describeCell(empty, 7, ctx({ phrase: null, bidsOn: false }))
    expect(noBids.request).toBeNull()
    expect(noBids.offer.hint).toBe('Write an offer')
    expect(noBids.offer.name).toBe(`No offer ${at}. Write an offer.`)
    // With the write form open, a press retargets it: the hint says so.
    expect(describeCell(empty, 7, ctx({ form: 'write' })).request!.hint).toBe('Write an offer')
  })

  it('gives a request its size like an offer, on its own half', () => {
    // Seeded: a request on a series nobody quotes (FUND put, second date).
    const requestOnly = cells(fund).find((c) => c.empty && c.bids > 0)!
    const { offer, request } = describeCell(requestOnly, 7, ctx({ phrase: null }))
    expect(offer.figure).toBeNull()
    expect(offer.hint).toBe('Post a request')
    expect(request!.figure).toBe(premiumText(requestOnly.bestBidPerUnit!, 7))
    expect(request!.size).toBe(formatUnits(requestOnly.bestBid!.underlyingQty, 7))
    expect(request!.hint).toBeNull()
    expect(request!.name).toBe(
      `Request ${request!.figure} at ${strikeText(requestOnly.ref.strikePerUnit, 7)}, put, ${formatUtcDay(requestOnly.ref.expiry)}, for ${request!.size} FUND, 1 request.`,
    )
    expect(describeCell(requestOnly, 7, ctx()).request!.name).toBe(`${request!.name.slice(0, -1)}, in the money at the demo price.`)
  })

  it('names a resale listing when it is the best offer', () => {
    const resale = cells(fund).find((c) => !c.empty && c.best?.source === 'resale')!
    expect(resale).toBeDefined()
    expect(describeCell(resale, 7, ctx({ phrase: null })).offer.name).toMatch(/, for [\d.,]+ FUND, a resale listing, \d+ offers?/)
  })

  it("marks only a figure that is the wallet's own order; a holding is said in words", () => {
    const me = DEMO_WALLETS.a
    expect(cells(fund).filter((c) => describeCell(c, 7, ctx()).yours)).toHaveLength(0)
    let ownSeen = 0
    for (const cell of [...cells(fundA), ...cells(bondA)]) {
      const text = describeCell(cell, 7, ctx({ phrase: null, me }))
      const ownOffer = !cell.empty && cell.best !== null && cell.best.counterparty === me
      const ownRequest = cell.bids > 0 && cell.bestBid !== null && cell.bestBid.counterparty === me
      expect(text.offer.own).toBe(ownOffer)
      expect(text.request!.own).toBe(ownRequest)
      expect(text.yours).toBe(ownOffer || ownRequest)
      if (ownOffer) expect(text.offer.name).toMatch(/^Your offer /)
      if (ownRequest) {
        ownSeen++
        expect(text.request!.name).toMatch(/^Your request \d+\.\d\d at /)
      }
      for (const half of [text.offer, text.request!]) {
        if (cell.holding) expect(half.name).toMatch(/you hold an option.* in this series(\.|$)/)
        if (cell.wrote) expect(half.name).toMatch(/you wrote an option.* in this series(\.|$)/)
        if (cell.mine && !text.yours) expect(half.name).toMatch(/you have an order in this series(\.|$)/)
      }
    }
    // Seeded: the default wallet's request on BOND put 98, third date, under a maker's dearer offer.
    expect(ownSeen).toBeGreaterThan(0)
    // An option the wallet holds never puts the highlighter on another maker's price.
    const held = [...cells(fundA), ...cells(bondA)].filter((c) => c.holding && !c.mine && !c.empty)
    expect(held.length).toBeGreaterThan(0)
    for (const cell of held) expect(describeCell(cell, 7, ctx({ me })).yours).toBe(false)
  })

  it('opens Buy on the offer half and Fill on the request half from 1200 px, never on its own order (ruling F3)', () => {
    const me = DEMO_WALLETS.a
    const wide = { bidsOn: true, me, wide: true, form: null } as const
    let buys = 0
    let fills = 0
    for (const cell of [...cells(fundA), ...cells(bondA)]) {
      const offer = halfAction(halfRow(cell, 'offer'), wide)
      const request = halfAction(halfRow(cell, 'request'), wide)
      if (offer.kind === 'take') {
        buys++
        expect(offer.row).toBe(cell.best)
        expect(offer.row.source).not.toBe('bid')
        expect(offer.row.counterparty).not.toBe(me)
      }
      if (request.kind === 'take') {
        fills++
        expect(request.row).toBe(cell.bestBid)
        expect(request.row.source).toBe('bid')
        expect(request.row.counterparty).not.toBe(me)
      }
      // The wallet's own order selects its series: its book has the Cancel.
      if (halfRow(cell, 'request')?.counterparty === me) expect(request.kind).toBe('select')
      const text = describeCell(cell, 7, { ...wide, phrase: null })
      if (offer.kind === 'take') expect(text.offer.name).toMatch(/\. Buy\.$/)
      if (request.kind === 'take') expect(text.request!.name).toMatch(/\. Fill request\.$/)
    }
    expect(buys).toBeGreaterThan(10)
    expect(fills).toBeGreaterThan(0)
    // Below 1200 px a price selects its series; an empty half still posts a request; an open form follows the selection.
    const priced = cells(bond).find((c) => !c.empty)!
    expect(halfAction(halfRow(priced, 'offer'), { ...wide, wide: false })).toEqual({ kind: 'select' })
    expect(halfAction(null, { ...wide, wide: false })).toEqual({ kind: 'post' })
    expect(halfAction(halfRow(priced, 'offer'), { ...wide, form: 'bid' })).toEqual({ kind: 'post' })
    expect(halfAction(halfRow(priced, 'offer'), { ...wide, form: 'write' })).toEqual({ kind: 'write' })
  })
})

describe('keyboard', () => {
  const four = chainColumns(true)

  it('maps keys to moves', () => {
    expect(moveForKey('ArrowUp', false)).toBe('up')
    expect(moveForKey('ArrowDown', false)).toBe('down')
    expect(moveForKey('ArrowLeft', false)).toBe('left')
    expect(moveForKey('ArrowRight', false)).toBe('right')
    expect(moveForKey('Home', false)).toBe('row-start')
    expect(moveForKey('End', false)).toBe('row-end')
    expect(moveForKey('Home', true)).toBe('first')
    expect(moveForKey('End', true)).toBe('last')
    expect(moveForKey('PageUp', false)).toBe('top')
    expect(moveForKey('PageDown', false)).toBe('bottom')
    expect(moveForKey('Enter', false)).toBeNull()
    expect(moveForKey('a', false)).toBeNull()
  })

  it('lists the halves left to right: the call side mirrored, the offers next to the strike', () => {
    expect(four).toEqual(['call-request', 'call-offer', 'put-offer', 'put-request'])
    expect(chainColumns(false)).toEqual(['call-offer', 'put-offer'])
  })

  it('moves between halves and stops at the edges', () => {
    expect(nextPosition({ row: 3, col: 'call-offer' }, 'down', 9, four)).toEqual({ row: 4, col: 'call-offer' })
    expect(nextPosition({ row: 3, col: 'call-offer' }, 'up', 9, four)).toEqual({ row: 2, col: 'call-offer' })
    expect(nextPosition({ row: 0, col: 'call-offer' }, 'up', 9, four)).toEqual({ row: 0, col: 'call-offer' })
    expect(nextPosition({ row: 8, col: 'put-request' }, 'down', 9, four)).toEqual({ row: 8, col: 'put-request' })
    expect(nextPosition({ row: 3, col: 'call-offer' }, 'right', 9, four)).toEqual({ row: 3, col: 'put-offer' })
    expect(nextPosition({ row: 3, col: 'put-offer' }, 'right', 9, four)).toEqual({ row: 3, col: 'put-request' })
    expect(nextPosition({ row: 3, col: 'put-request' }, 'right', 9, four)).toEqual({ row: 3, col: 'put-request' })
    expect(nextPosition({ row: 3, col: 'put-offer' }, 'left', 9, four)).toEqual({ row: 3, col: 'call-offer' })
    expect(nextPosition({ row: 3, col: 'call-request' }, 'left', 9, four)).toEqual({ row: 3, col: 'call-request' })
    expect(nextPosition({ row: 3, col: 'put-offer' }, 'row-start', 9, four)).toEqual({ row: 3, col: 'call-request' })
    expect(nextPosition({ row: 3, col: 'call-offer' }, 'row-end', 9, four)).toEqual({ row: 3, col: 'put-request' })
    expect(nextPosition({ row: 3, col: 'put-offer' }, 'top', 9, four)).toEqual({ row: 0, col: 'put-offer' })
    expect(nextPosition({ row: 3, col: 'call-offer' }, 'bottom', 9, four)).toEqual({ row: 8, col: 'call-offer' })
    expect(nextPosition({ row: 3, col: 'put-offer' }, 'first', 9, four)).toEqual({ row: 0, col: 'call-request' })
    expect(nextPosition({ row: 3, col: 'call-offer' }, 'last', 9, four)).toEqual({ row: 8, col: 'put-request' })
  })

  it('stays on the halves shown on a contract without requests', () => {
    const two = chainColumns(false)
    expect(nextPosition({ row: 3, col: 'put-offer' }, 'right', 9, two)).toEqual({ row: 3, col: 'put-offer' })
    expect(nextPosition({ row: 3, col: 'put-offer' }, 'left', 9, two)).toEqual({ row: 3, col: 'call-offer' })
    // A remembered request half lands on the first half shown.
    expect(nextPosition({ row: 3, col: 'put-request' }, 'down', 9, two)).toEqual({ row: 4, col: 'call-offer' })
    expect(nextPosition({ row: 0, col: 'call-offer' }, 'down', 0, two)).toEqual({ row: 0, col: 'call-offer' })
  })

  it('gives the tab stop to the selected half, else to the call offer on the row at the reference price', () => {
    expect(homePosition(fund, 9, four, { row: 6, col: 'put-offer' })).toEqual({ row: 6, col: 'put-offer' })
    expect(homePosition(fund, 9, four, null)).toEqual({ row: 4, col: 'call-offer' })
    expect(homePosition(fund, 9, chainColumns(false), { row: 6, col: 'put-request' })).toEqual({ row: 4, col: 'call-offer' })
    expect(homePosition({ referenceRule: null }, 9, four, null)).toEqual({ row: 0, col: 'call-offer' })
    expect(homePosition({ referenceRule: { below: 9, at: null } }, 9, four, null)).toEqual({ row: 8, col: 'call-offer' })
  })
})
