import { describe, expect, it } from 'vitest'
import { MARGIN_BANNED_WORDS, findBannedWords } from '../../../core/disclosures'
import { PRO_ERRORS } from '../../../core/pro/errors'
import { FixtureProClient } from '../../../core/pro/FixtureProClient'
import type { Requirement, SeriesView } from '../../../core/pro/types'
import * as copy from '../copy'
import { coverageAt, coverageInputs, coveredUpTo, priceRange } from '../../../core/pro/coverage'
import { HEALTH_WORD, healthLead, healthNext, healthOf, tenthsText } from './health'
import { bpsPercent, lots, perLot, perLotAtLeast, toChartNumber, usdx, usdxExact, usdxInput, withUnit } from './money'
import { callName, contractName, contractTitle, isAddress, partyName, runsFirstText, scenarioCopy, stepPhrase } from './names'
import { oracleView, snapshotAge, spanText } from './oracle'
import { breakevenPerLot, callPayout } from './payout'
import { expiredSeries, seriesSettlements, takeovers } from './settlement'
import { exactPerLot, parseLots, parseUsdx, premiumFloor, premiumPerLot, writeDraft } from './write'

const U = 10_000_000n
/** The non-breaking space that holds a figure to its unit. */
const NB = '\u00a0'
const req = (nlv: bigint, mm: bigint, im: bigint): Requirement => ({ nlv, mm, im, liability: 0n, expired: 0n, scan: 0n, smin: 0n, liq: 0n, worst: 0 })
const series = (over: Partial<SeriesView> = {}): SeriesView => ({
  id: 0,
  strike: 110n * U,
  expiry: 1_801_814_400,
  oi: 1000n,
  settlementPrice: null,
  openBooks: 1,
  shortfall: 0n,
  vaultPaid: 0n,
  pool: 0n,
  claimed: 0n,
  closed: false,
  snapshot: { seriesId: 0, seq: 4, ts: 1_800_172_921, spot: 140n * U, mark: 300_035_218n },
  deficit: null,
  ...over,
})

describe('money', () => {
  it('truncates to two decimals and never rounds up', () => {
    expect(usdx(235_075_984_000n)).toBe('23,507.59')
    expect(usdx(null)).toBe('–')
    expect(usdxExact(235_075_984_000n)).toBe('23,507.5984')
    expect(usdxExact(50n * U)).toBe('50.00')
  })
  it('formats a mark at four decimals and lots as whole numbers', () => {
    expect(perLot(300_035_218n)).toBe('30.0035')
    expect(lots(1000n)).toBe('1,000')
    expect(lots(null)).toBe('–')
  })
  it('gives an amount back as it would be typed', () => {
    expect(usdxInput(204_378_473_000n)).toBe('20437.8473')
    expect(parseUsdx(usdxInput(204_378_473_000n))).toBe(204_378_473_000n)
    expect(usdxInput(5n * U)).toBe('5')
  })
  it('writes a share in basis points as a percentage, exactly', () => {
    expect(bpsPercent(1000)).toBe(`10${NB}%`)
    expect(bpsPercent(9000)).toBe(`90${NB}%`)
    expect(bpsPercent(250)).toBe(`2.5${NB}%`)
    expect(bpsPercent(1)).toBe(`0.01${NB}%`)
    expect(bpsPercent(0)).toBe(`0${NB}%`)
  })
  it('converts to a number for drawings only', () => {
    expect(toChartNumber(235_075_984_000n)).toBeCloseTo(23507.5984, 6)
    expect(toChartNumber(-15n * U)).toBe(-15)
  })
})

describe('health', () => {
  it('is liquidatable below the liquidation level, with the exact gap', () => {
    const h = healthOf(req(235_075_984_000n, 439_454_457_000n, 549_318_071_250n))
    expect(h.state).toBe('liquidatable')
    expect(h.distance).toBe(204_378_473_000n)
    expect(h.aboveTenths).toBeNull()
    expect(healthLead(h)).toBe(`20,437.84${NB}USDx below the liquidation level`)
    expect(healthNext(h)).toBe(`A deposit of at least 20,437.8473${NB}USDx brings the account value back to the liquidation level.`)
  })
  it('is restricted between the two levels and says what a new position needs', () => {
    const h = healthOf(req(491_200_000_000n, 439_454_400_000n, 549_318_000_000n))
    expect(h.state).toBe('restricted')
    expect(h.distance).toBe(51_745_600_000n)
    expect(h.toOpen).toBe(58_118_000_000n)
    // (49,120.00 - 43,945.44) / 43,945.44 = 11.775 %, rounded down to a tenth
    expect(tenthsText(h.aboveTenths!)).toBe(`11.7${NB}%`)
    expect(healthLead(h)).toBe(`5,174.56${NB}USDx above the liquidation level (11.7${NB}%)`)
    expect(healthNext(h)).toBe(`A new call needs 5,811.80${NB}USDx more.`)
  })
  it('is open at or above the opening requirement, and exactly at the liquidation level is not liquidatable', () => {
    expect(healthOf(req(684_000_000_000n, 439_454_400_000n, 549_318_000_000n)).state).toBe('open')
    expect(healthOf(req(100n, 100n, 125n)).state).toBe('restricted')
    expect(healthOf(req(125n, 100n, 125n)).state).toBe('open')
  })
  it('assumes nothing without a requirement', () => {
    const h = healthOf(null)
    expect(h.state).toBe('unknown')
    expect(healthLead(h)).toBe('The margin requirement could not be read.')
    expect(healthNext(h)).toBeNull()
  })
  it('omits the percentage when the liquidation level is zero', () => {
    const h = healthOf(req(50n * U, 0n, 0n))
    expect(h.aboveTenths).toBeNull()
    expect(healthLead(h)).toBe(`50.00${NB}USDx above the liquidation level`)
    expect(healthNext(h)).toBeNull()
  })
  it('never calls a state healthy', () => {
    for (const word of Object.values(HEALTH_WORD)) expect(findBannedWords(word, MARGIN_BANNED_WORDS)).toEqual([])
  })
})

describe('oracle', () => {
  const sim = new FixtureProClient(undefined, 'american_exercise', 22)
  it('reads the latest snapshot of the early-exercise scenario, just after the price was published', () => {
    const o = oracleView(sim.getModel())
    expect(o.latest?.snapshot.seq).toBe(4)
    expect(o.age).toBe(0)
    expect(o.freshness).toBe('fresh')
    expect(o.exerciseOpen).toBe(true)
    expect(o.exerciseMaxAge).toBe(120)
    expect(o.pending).toEqual([])
  })
  it('pauses early exercise once the snapshot is older than the limit', () => {
    const model = sim.getModel()
    const o = oracleView({ ...model, now: model.now + 121 })
    expect(o.exerciseOpen).toBe(false)
    expect(o.freshness).toBe('fresh')
    expect(oracleView({ ...model, now: model.now + 3601 }).freshness).toBe('stale')
  })
  it('lists expired series that wait for a settlement price', () => {
    const model = sim.getModel()
    const o = oracleView({ ...model, now: model.series[0].expiry })
    expect(o.pending.map((s) => s.id)).toEqual([0])
  })
  it('has no snapshot before the publisher posts one', () => {
    const model = sim.getModel()
    const o = oracleView({ ...model, series: model.series.map((s) => ({ ...s, snapshot: null })) })
    expect(o.latest).toBeNull()
    expect(o.age).toBeNull()
    expect(o.freshness).toBeNull()
    expect(o.exerciseOpen).toBe(false)
    expect(snapshotAge(model, { ...model.series[0], snapshot: null })).toBeNull()
  })
  it('writes spans with seconds under an hour', () => {
    // A figure never breaks from its unit: each pair is held by a non-breaking space.
    expect(spanText(0)).toBe(`0${NB}s`)
    expect(spanText(45)).toBe(`45${NB}s`)
    expect(spanText(120)).toBe(`2${NB}min`)
    expect(spanText(121)).toBe(`2${NB}min 1${NB}s`)
    expect(spanText(3600)).toBe(`1${NB}h`)
    expect(spanText(3900)).toBe(`1${NB}h 5${NB}min`)
    expect(spanText(86400 * 3 + 3600 * 4)).toBe(`3${NB}d 4${NB}h`)
  })
})

describe('payout of a long call', () => {
  it('pays quantity times the price over the strike, and nothing at or under it', () => {
    // 1,000 lots, publisher price 140.00, strike 110.00: the 30,000.00 USDx of the early-exercise scenario.
    expect(callPayout(1000n, 140n * U, 110n * U)).toBe(30_000n * U)
    expect(callPayout(1000n, 110n * U, 110n * U)).toBe(0n)
    expect(callPayout(1000n, 90n * U, 110n * U)).toBe(0n)
  })
  it('puts the breakeven at the strike plus the premium per lot, truncated', () => {
    // 619.17009 USDx for 1,000 lots on a 110.00 strike: 110.6191700 per lot.
    expect(breakevenPerLot(110n * U, 6_191_700_900n, 1000n)).toBe(1_106_191_700n)
    expect(perLot(breakevenPerLot(110n * U, 6_191_700_900n, 1000n))).toBe('110.6191')
    expect(breakevenPerLot(110n * U, 1n, 3n)).toBe(110n * U)
    expect(breakevenPerLot(110n * U, 6_191_700_900n, 0n)).toBeNull()
  })
})

describe('write', () => {
  it('parses whole lots only, grouped or not', () => {
    expect(parseLots('1000')).toBe(1000n)
    expect(parseLots('1,000')).toBe(1000n)
    expect(parseLots('12,345,678')).toBe(12_345_678n)
    expect(parseLots('1,00')).toBeNull()
    expect(parseLots(' 5 ')).toBe(5n)
    expect(parseLots('0')).toBeNull()
    expect(parseLots('1.5')).toBeNull()
    expect(parseLots('')).toBeNull()
    expect(parseLots('-3')).toBeNull()
  })
  it('parses USDx amounts with at most seven decimals', () => {
    expect(parseUsdx('619.17009')).toBe(6_191_700_900n)
    expect(parseUsdx('')).toBeNull()
    expect(parseUsdx('1.12345678')).toBeNull()
  })
  it('computes the mark floor as quantity times mark, exactly', () => {
    expect(premiumFloor(1000n, series())).toBe(300_035_218_000n)
    expect(premiumFloor(null, series())).toBeNull()
    expect(premiumFloor(1000n, series({ snapshot: null }))).toBeNull()
  })
  it('takes the premium per lot and gives the contract the exact total', () => {
    const d = writeDraft({ writer: 'MAKER_A', series: series(), qty: '1,000', perLot: '0.6191701' })
    expect(d.each).toBe(6_191_701n)
    expect(d.premium).toBe(6_191_701_000n)
    expect(d.params).toEqual({ writer: 'MAKER_A', seriesId: 0, qty: 1000n, premium: 6_191_701_000n, quoteExpiry: 1_801_814_400 })
  })
  it('flags a premium under the floor without blocking the order', () => {
    const low = writeDraft({ writer: 'MAKER_A', series: series(), qty: '1000', perLot: '30.0035' })
    expect(low.belowFloor).toBe(true)
    expect(low.params).toEqual({ writer: 'MAKER_A', seriesId: 0, qty: 1000n, premium: 300_035_000_000n, quoteExpiry: 1_801_814_400 })
    const exact = writeDraft({ writer: 'MAKER_A', series: series(), qty: '1000', perLot: '30.0035218' })
    expect(exact.belowFloor).toBe(false)
  })
  it('states a per-lot minimum rounded up, so the stated figure is never refused', () => {
    // A mark of 0.5628819 per lot: 0.5628 would fall under the floor, 0.5629 does not.
    expect(perLotAtLeast(5_628_819n)).toBe('0.5629')
    expect(perLotAtLeast(5_629_000n)).toBe('0.5629')
    expect(perLotAtLeast(300_035_218n)).toBe('30.0036')
    expect(1000n * 5_629_000n >= 1000n * 5_628_819n).toBe(true)
  })
  it('has no order until every field is valid', () => {
    expect(writeDraft({ writer: 'MAKER_A', series: series(), qty: '', perLot: '10' }).params).toBeNull()
    expect(writeDraft({ writer: 'MAKER_A', series: series(), qty: '10', perLot: '' }).params).toBeNull()
    expect(writeDraft({ writer: 'MAKER_A', series: series(), qty: '10', perLot: '0' }).params).toBeNull()
    expect(writeDraft({ writer: 'MAKER_A', series: undefined, qty: '10', perLot: '5' }).params).toBeNull()
  })
  it('writes a recorded total over its lots exactly, finer than a typed price allows', () => {
    expect(exactPerLot(6_191_700_900n, 1000n)).toBe('0.61917009')
    expect(exactPerLot(3_715_020_540n, 600n)).toBe('0.61917009')
    expect(exactPerLot(6_191_700_000n, 1000n)).toBe('0.61917')
    expect(exactPerLot(50n * U, 1n)).toBe('50')
    expect(exactPerLot(1n, 3n)).toBeNull()
    expect(exactPerLot(10n, 0n)).toBeNull()
  })
  it('gives the premium per lot rounded down', () => {
    expect(premiumPerLot(6_191_700_900n, 1000n)).toBe(6_191_700n)
    expect(premiumPerLot(10n, 0n)).toBeNull()
  })
})

describe('coverage (hypothetical payout split)', () => {
  const sim = new FixtureProClient(undefined, 'happy_path_otm', 5)
  const model = sim.getModel()
  const offer = model.offers[0]
  const s = model.series[0]
  const inputs = coverageInputs(model, offer, s)

  it('reads the writer cash and the vault value, cut to cents', () => {
    expect(inputs).toEqual({ qty: 1000, strike: 110, writerMargin: 26499.93, vault: 200000, price: 100 })
  })
  it('pays from the writer margin first, then the vault, then leaves a deficit', () => {
    expect(coverageAt(inputs, 100)).toEqual({ due: 0, fromWriter: 0, fromVault: 0, deficit: 0, paid: 0 })
    const inWriter = coverageAt(inputs, 130)
    expect(inWriter.due).toBe(20000)
    expect(inWriter.fromWriter).toBe(20000)
    expect(inWriter.fromVault).toBe(0)
    const inVault = coverageAt(inputs, 138)
    expect(inVault.fromWriter).toBeCloseTo(26499.93, 6)
    expect(inVault.fromVault).toBeCloseTo(1500.07, 6)
    expect(inVault.deficit).toBe(0)
    const short = coverageAt(inputs, 400)
    expect(short.due).toBe(290000)
    expect(short.paid).toBeCloseTo(226499.93, 6)
    expect(short.deficit).toBeCloseTo(63500.07, 6)
    expect(short.fromWriter + short.fromVault + short.deficit).toBeCloseTo(short.due, 6)
  })
  it('states the price up to which the payout is covered, rounded down', () => {
    expect(coveredUpTo(inputs)).toBe(336.49)
  })
  it('opens the slider on a payout and keeps the strike as its lower end', () => {
    const r = priceRange(inputs)
    expect(r.min).toBe(110)
    expect(r.step).toBe(1)
    expect(r.start).toBe(138)
    expect(r.max).toBeGreaterThan(coveredUpTo(inputs))
    expect(priceRange({ ...inputs, price: 140 }).start).toBe(140)
  })
})

describe('settlement', () => {
  it('splits what a series owed between owners, vault and deficit', () => {
    const sim = new FixtureProClient(undefined, 'settlement_pro_rata_deficit', 20)
    const [one] = seriesSettlements(sim.getModel())
    expect(one.due).toBe(500_000_000_000n)
    expect(one.fromOwners).toBe(250_571_912_750n)
    expect(one.vaultPaid).toBe(10_619_170_090n)
    expect(one.deficit).toBe(238_808_917_160n)
    expect(one.fromOwners + one.vaultPaid + one.deficit!).toBe(one.due)
  })
  it('owes nothing at settlement before expiry (a book emptied by early exercise counts as settled, with nothing due)', () => {
    const before = seriesSettlements(new FixtureProClient(undefined, 'american_exercise', 22).getModel())
    expect(before.every((s) => s.due === 0n && s.deficit === null)).toBe(true)
    expect(seriesSettlements({ series: [series()], books: [] })).toEqual([])
  })
  it('walks an expired series through its three calls: books, series, claims', () => {
    const sim = new FixtureProClient(undefined, 'settlement_pro_rata_deficit', 10)
    const at = (cursor: number) => {
      sim.moveTo(cursor)
      return expiredSeries(sim.getModel())[0]
    }
    expect(at(10).step).toBe('await-price')
    const books = at(12)
    expect(books.step).toBe('settle-books')
    expect(books.nextBook).not.toBeNull()
    expect(books.booksSettled).toBeLessThan(books.books.length)
    const last = sim.stepCount
    expect(at(last).step).toBe('done')
    expect(at(last).claimed).toBe(at(last).positions)
    expect(expiredSeries({ ...sim.getModel(), now: 0 })).toEqual([])
  })
  it('lists takeovers with their price, payment and shortfall, and refusals with their code', () => {
    const sim = new FixtureProClient(undefined, 'gap_to_vault', 12)
    const log = takeovers(sim.getModel().history)
    expect(log).toHaveLength(2)
    expect(log[0]).toMatchObject({ writer: 'MAKER_A', taker: 'MAKER_B', ok: false, code: 218, price: null })
    expect(log[1]).toMatchObject({ writer: 'MAKER_A', taker: 'VAULT', ok: true, price: 420_001_275_750n, paid: 250_571_912_750n, deficit: 169_429_363_000n })
  })
})

describe('names', () => {
  it('names a contract by underlying, strike and kind', () => {
    expect(contractName(series())).toBe('EQTY 110.00 call')
    expect(contractTitle(series())).toBe(`EQTY 110.00 call, 5${NB}Feb${NB}2027`)
    expect(contractName(undefined)).toBe('EQTY call')
  })
  it('turns replay parties into names and leaves addresses alone', () => {
    expect(partyName('MAKER_A')).toBe('Maker A')
    expect(partyName('ALICE')).toBe('Alice')
    expect(partyName('LP1')).toBe('LP 1')
    expect(partyName('VAULT')).toBe('Vault')
    expect(partyName('KEEPER')).toBe('Keeper')
    const g = 'GBE6ONGU5S3JHDBR5Z3BUVXCL4WLEHQVLBDNTCKHKOYFBYBPBW4I3ZEG'
    expect(partyName(g)).toBe(g)
    expect(isAddress(g)).toBe(true)
    expect(isAddress('MAKER_A')).toBe(false)
  })
  it('names the steps a press runs first, and says nothing when it runs the next one', () => {
    expect(stepPhrase('create_offer', 'MAKER_A')).toBe('write a call (Maker A)')
    expect(stepPhrase('set_time', null)).toBe('move the clock forward')
    expect(runsFirstText([])).toBe('')
    expect(runsFirstText([{ number: 4, op: 'deposit', actor: 'MAKER_A' }])).toBe('Step 4 runs first: deposit margin (Maker A).')
    expect(
      runsFirstText([
        { number: 5, op: 'create_offer', actor: 'MAKER_A' },
        { number: 6, op: 'buy', actor: 'ALICE' },
        { number: 7, op: 'get_requirement', actor: 'MAKER_A' },
      ]),
    ).toBe('Steps 5 to 7 run first: write a call (Maker A), buy a call (Alice), read the margin requirement (Maker A).')
    expect(
      runsFirstText([
        { number: 9, op: 'set_time', actor: null },
        { number: 10, op: 'publish_risk', actor: 'PUBLISHER' },
        { number: 11, op: 'set_time', actor: null },
        { number: 12, op: 'publish_risk', actor: 'PUBLISHER' },
      ]),
    ).toBe('Steps 9 to 12 run first: move the clock forward, publish a price snapshot (Publisher), move the clock forward and 1 more.')
  })
  it('holds a figure to its unit', () => {
    expect(withUnit('20,437.84')).toBe(`20,437.84${NB}USDx`)
    expect(withUnit('1,000', 'lots')).toBe(`1,000${NB}lots`)
  })
  it('has English copy for every recorded scenario', () => {
    const sim = new FixtureProClient()
    for (const name of sim.scenarioNames) {
      const c = scenarioCopy(name)
      expect(c.title, name).not.toMatch(/_/)
      expect(c.summary.length, name).toBeGreaterThan(20)
    }
    expect(scenarioCopy('some_new_case')).toEqual({ title: 'Some new case', summary: '' })
  })
  it('names every call the fixtures replay', () => {
    const sim = new FixtureProClient(undefined, 'american_exercise', 0)
    const ops = new Set(sim.file.scenarios.flatMap((s) => s.steps.map((step) => step.op)))
    for (const op of ops) expect(callName(op), op).not.toMatch(/_/)
  })
})

describe('copy', () => {
  const strings: string[] = []
  const collect = (value: unknown): void => {
    if (typeof value === 'string') strings.push(value)
    else if (Array.isArray(value)) value.forEach(collect)
    else if (value && typeof value === 'object') Object.values(value).forEach(collect)
  }
  collect(copy)
  const sim = new FixtureProClient()
  for (const name of sim.scenarioNames) collect(scenarioCopy(name))
  collect(Object.values(HEALTH_WORD))

  it('collects the copy of the section', () => {
    expect(strings.length).toBeGreaterThan(40)
  })
  it('never promises: no banned word, and Margin is never called fully collateralized', () => {
    for (const s of strings) expect(findBannedWords(s, MARGIN_BANNED_WORDS), s).toEqual([])
  })
  it('has no em dash, arrow, exclamation mark or emoji', () => {
    for (const s of strings) expect(s, s).not.toMatch(/[—→←⇒!]|\p{Extended_Pictographic}/u)
  })
  it('calls the instant a deadline, never an expiry (ruling F11)', () => {
    for (const s of strings) expect(s, s).not.toMatch(/\bexpiry\b/i)
    expect(PRO_ERRORS[226].message).toBe('This position is owned by the vault and settles at the deadline.')
  })
  it('explains every early-exercise refusal with a known contract error', () => {
    expect(copy.EARLY_EXERCISE_REFUSALS.map((code) => PRO_ERRORS[code].name)).toEqual(['NoEarlyExercise', 'StaleSnapshot', 'OutOfTheMoney', 'SettlementPending', 'LiquidateFirst'])
  })
  it('has a title and a path for each of the five screens', () => {
    expect(copy.SCREEN_ORDER).toEqual(['account', 'trade', 'positions', 'liquidations', 'vault'])
    expect(copy.SCREEN_ORDER.map((s) => copy.SCREEN_PATH[s])).toEqual(['/margin', '/margin/trade', '/margin/positions', '/margin/liquidations', '/margin/vault'])
    expect(new Set(copy.SCREEN_ORDER.map((s) => copy.SCREENS[s].title)).size).toBe(5)
  })
})
