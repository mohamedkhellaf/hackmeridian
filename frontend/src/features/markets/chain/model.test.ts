import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { formatUnits } from '../../../core/format'
import { cellKey } from '../../../core/market/selection'
import { DEMO_WALLETS } from '../../../core/options/demoAccounts'
import { noReference } from '../../../core/reference'
import { FIXED_MS, demoWorld } from '../../../data/derived/demoSource.testhelper'
import type { DemoWorld } from '../../../data/derived/demoSource.testhelper'
import { buildMarket } from '../../../data/derived/market'
import type { GridCell, MarketView } from '../../../data'
import {
  defaultColumn,
  describeCell,
  gapLine,
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
  takeableOf,
} from './model'

const units = (n: number) => BigInt(Math.round(n * 100)) * 10n ** 5n // 7 decimals

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
    expect(leftLabel(44 * 3600)).toBe('1 d')
    expect(leftLabel(15 * 86_400 + 3600)).toBe('15 d')
    expect(leftLabel(5 * 3600 + 120)).toBe('5 h')
    expect(leftLabel(12 * 60 + 5)).toBe('12 min')
    expect(leftLabel(30)).toBe('<1 min')
    expect(leftLabel(-1)).toBe('expired')
  })

  it('names a series with the strike as the chain prints it', () => {
    expect(seriesTitle('BOND', { kind: 'put', strikePerUnit: units(100), expiry: bond.expiries[0] }, 7)).toBe('BOND 100.00 put, 13 Nov')
    expect(seriesTitle('FUND', { kind: 'call', strikePerUnit: units(9.8), expiry: fund.expiries[2] }, 7)).toBe('FUND 9.80 call, 27 Nov')
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
    expect(missingDeadlineLine('2026-11-14', s.column!, now)).toBe('14 Nov is not a listed deadline. Showing 13 Nov.')
    expect(missingDeadlineLine('2020-01-03', s.column!, now)).toBe('The 3 Jan 2020 deadline has passed. Showing 13 Nov.')
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
  it('shows the best offer per unit with its size; the maker count is in the name only', () => {
    const priced = cells(bond).filter((c) => !c.empty)
    expect(priced.length).toBeGreaterThan(20)
    for (const cell of priced) {
      const text = describeCell(cell, 7, 'the demo price')
      const kind = cell.ref.kind === 'put' ? 'Put' : 'Call'
      expect(text.variant).toBe('priced')
      expect(text.offer).toBe(premiumText(cell.bestPerUnit!, 7))
      expect(text.size).toBe(formatUnits(cell.best!.underlyingQty, 7))
      expect(text.name.startsWith(`${kind} at ${strikeText(cell.ref.strikePerUnit, 7)}, best offer ${text.offer} for ${text.size} BOND`)).toBe(true)
      expect(text.name).toMatch(/, \d+ offers?(, \d+ makers?)?(,|$)/)
      expect(text.name.includes('in the money at the demo price')).toBe(cell.moneyness === 'in')
      expect(text.inTheMoney).toBe(cell.moneyness === 'in')
      expect(text.ask).toBe(false)
    }
    const one = priced.find((c) => c.makers === 1 && c.offers === 1)!
    expect(describeCell(one, 7, null).name).toMatch(/, 1 offer, 1 maker$/)
    const two = priced.find((c) => c.makers === 2)!
    expect(describeCell(two, 7, null).name).toMatch(/, 2 offers, 2 makers$/)
  })

  it('says nothing about moneyness without a reference', () => {
    for (const cell of cells(bond)) expect(describeCell(cell, 7, null).name).not.toMatch(/the money/)
  })

  it('asks for a price on an empty cell and shows the best request on a cell with only a request', () => {
    const empty = cells(fund).find((c) => c.empty && c.bids === 0)!
    const e = describeCell(empty, 7, null)
    expect(e.variant).toBe('empty')
    expect([e.offer, e.size, e.request]).toEqual([null, null, null])
    expect(e.ask).toBe(true)
    expect(e.name).toBe(`${empty.ref.kind === 'put' ? 'Put' : 'Call'} at ${strikeText(empty.ref.strikePerUnit, 7)}, no offer or request, ask for a price`)
    // A contract without requests offers nothing on an empty cell.
    expect(describeCell(empty, 7, null, false).ask).toBe(false)
    expect(describeCell(empty, 7, null, false).name).toMatch(/, no offer$/)

    // Seeded: a request on a series nobody quotes (FUND put, second date).
    const requestOnly = cells(fund).find((c) => c.empty && c.bids > 0)!
    const r = describeCell(requestOnly, 7, null)
    expect(r.variant).toBe('request-only')
    expect(r.offer).toBeNull()
    expect(r.request).toBe(premiumText(requestOnly.bestBidPerUnit!, 7))
    expect(r.ask).toBe(false)
    expect(r.name).toBe(`Put at ${strikeText(requestOnly.ref.strikePerUnit, 7)}, no offer, best request ${r.request}, 1 request`)
    expect(describeCell(requestOnly, 7, 'the demo price').name).toBe(`${r.name}, in the money at the demo price`)
  })

  it('names a resale listing when it is the best offer', () => {
    const resale = cells(fund).find((c) => !c.empty && c.best?.source === 'resale')!
    expect(resale).toBeDefined()
    expect(describeCell(resale, 7, null).name).toMatch(/, best offer \d+\.\d\d for [\d.,]+ FUND, a resale listing, \d+ offers?/)
  })

  it("marks only a figure that is the wallet's own order; a holding is said in words", () => {
    const me = DEMO_WALLETS.a
    expect(cells(fund).filter((c) => describeCell(c, 7, null, true, null).yours)).toHaveLength(0)
    let ownSeen = 0
    for (const cell of [...cells(fundA), ...cells(bondA)]) {
      const text = describeCell(cell, 7, null, true, me)
      const ownOffer = !cell.empty && cell.best !== null && cell.best.counterparty === me
      const ownRequest = cell.bids > 0 && cell.bestBid !== null && cell.bestBid.counterparty === me
      expect(text.ownOffer).toBe(ownOffer)
      expect(text.ownRequest).toBe(ownRequest)
      expect(text.yours).toBe(ownOffer || ownRequest)
      if (text.yours) {
        ownSeen++
        expect(text.name).toMatch(/, yours: the best (offer|request|offer and the best request)(,|$)/)
      }
      if (cell.holding) expect(text.name).toMatch(/you hold an option.* in this series$/)
      if (cell.wrote) expect(text.name).toMatch(/you wrote an option.* in this series$/)
      if (cell.mine && !text.yours) expect(text.name).toMatch(/you have an order in this series$/)
    }
    // Seeded: the default wallet's request on BOND put 98, fourth date, under a maker's dearer offer.
    expect(ownSeen).toBeGreaterThan(0)
    // An option the wallet holds never puts the highlighter on another maker's price.
    const held = [...cells(fundA), ...cells(bondA)].filter((c) => c.holding && !c.mine && !c.empty)
    expect(held.length).toBeGreaterThan(0)
    for (const cell of held) expect(describeCell(cell, 7, null, true, me).yours).toBe(false)
  })

  it('takes the best order the wallet can take, never its own', () => {
    const me = DEMO_WALLETS.a
    for (const cell of cells(fundA)) {
      const row = takeableOf(cell, me)
      if (row === null) continue
      expect(row.counterparty).not.toBe(me)
      if (!cell.empty && cell.best && cell.best.counterparty !== me && cell.best.offer?.writer !== me) expect(row).toBe(cell.best)
    }
    const empty = cells(fund).find((c) => c.empty && c.bids === 0)!
    expect(takeableOf(empty, null)).toBeNull()
    const requestOnly = cells(fund).find((c) => c.empty && c.bids > 0)!
    expect(takeableOf(requestOnly, null)?.source).toBe('bid')
  })
})

describe('keyboard', () => {
  const both = ['call', 'put'] as const

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

  it('moves between cells and stops at the edges', () => {
    expect(nextPosition({ row: 3, side: 'call' }, 'down', 9, both)).toEqual({ row: 4, side: 'call' })
    expect(nextPosition({ row: 3, side: 'call' }, 'up', 9, both)).toEqual({ row: 2, side: 'call' })
    expect(nextPosition({ row: 0, side: 'call' }, 'up', 9, both)).toEqual({ row: 0, side: 'call' })
    expect(nextPosition({ row: 8, side: 'put' }, 'down', 9, both)).toEqual({ row: 8, side: 'put' })
    expect(nextPosition({ row: 3, side: 'call' }, 'right', 9, both)).toEqual({ row: 3, side: 'put' })
    expect(nextPosition({ row: 3, side: 'put' }, 'right', 9, both)).toEqual({ row: 3, side: 'put' })
    expect(nextPosition({ row: 3, side: 'put' }, 'left', 9, both)).toEqual({ row: 3, side: 'call' })
    expect(nextPosition({ row: 3, side: 'call' }, 'left', 9, both)).toEqual({ row: 3, side: 'call' })
    expect(nextPosition({ row: 3, side: 'put' }, 'row-start', 9, both)).toEqual({ row: 3, side: 'call' })
    expect(nextPosition({ row: 3, side: 'call' }, 'row-end', 9, both)).toEqual({ row: 3, side: 'put' })
    expect(nextPosition({ row: 3, side: 'put' }, 'top', 9, both)).toEqual({ row: 0, side: 'put' })
    expect(nextPosition({ row: 3, side: 'call' }, 'bottom', 9, both)).toEqual({ row: 8, side: 'call' })
    expect(nextPosition({ row: 3, side: 'put' }, 'first', 9, both)).toEqual({ row: 0, side: 'call' })
    expect(nextPosition({ row: 3, side: 'call' }, 'last', 9, both)).toEqual({ row: 8, side: 'put' })
  })

  it('stays in the half shown on a phone', () => {
    const puts = ['put'] as const
    expect(nextPosition({ row: 3, side: 'put' }, 'left', 9, puts)).toEqual({ row: 3, side: 'put' })
    expect(nextPosition({ row: 3, side: 'put' }, 'right', 9, puts)).toEqual({ row: 3, side: 'put' })
    expect(nextPosition({ row: 3, side: 'put' }, 'down', 9, puts)).toEqual({ row: 4, side: 'put' })
    // A remembered position from the other half lands in the half shown.
    expect(nextPosition({ row: 3, side: 'call' }, 'down', 9, puts)).toEqual({ row: 4, side: 'put' })
    expect(nextPosition({ row: 0, side: 'call' }, 'down', 0, puts)).toEqual({ row: 0, side: 'call' })
  })

  it('gives the tab stop to the selected cell, else to the row at the reference price', () => {
    expect(homePosition(fund, 9, both, { row: 6, side: 'put' })).toEqual({ row: 6, side: 'put' })
    expect(homePosition(fund, 9, both, null)).toEqual({ row: 4, side: 'call' })
    expect(homePosition(fund, 9, ['put'], { row: 6, side: 'call' })).toEqual({ row: 4, side: 'put' })
    expect(homePosition({ referenceRule: null }, 9, both, null)).toEqual({ row: 0, side: 'call' })
    expect(homePosition({ referenceRule: { below: 9, at: null } }, 9, both, null)).toEqual({ row: 8, side: 'call' })
  })
})
