import { describe, expect, it } from 'vitest'
import { FixtureProClient, parseFixtures } from './FixtureProClient'
import { PHASE_ACTION, PHASE_STATE, PHASE_WAITING, phaseOf, positionRow, positionRows } from './phase'
import type { Phase } from './phase'
import type { BookView, PositionView, SeriesView } from './types'
import { VAULT } from './types'

const series = (over: Partial<SeriesView> = {}): SeriesView => ({
  id: 0, strike: 100n, expiry: 1000, oi: 10n, settlementPrice: null, openBooks: 1, shortfall: 0n, vaultPaid: 0n, pool: 0n, claimed: 0n, closed: false, snapshot: null, deficit: null, ...over,
})
const book = (over: Partial<BookView> = {}): BookView => ({ id: 0, seriesId: 0, owner: 'MAKER_A', qty: 10n, settled: false, due: 0n, fromOwner: 0n, shortfall: 0n, reserve: 0n, ...over })
const position = (over: Partial<PositionView> = {}): PositionView => ({ id: 0, seriesId: 0, holder: 'HOLDER', book: 0, bookOwner: 'MAKER_A', qty: 10n, settled: false, exercised: false, paid: 0n, deficit: 0n, claim: null, ...over })

describe('phaseOf', () => {
  it('walks the lifecycle in order', () => {
    expect(phaseOf(position(), series(), book(), 999)).toBe('live')
    expect(phaseOf(position(), series(), book(), 1000)).toBe('await-price')
    expect(phaseOf(position(), series({ settlementPrice: 120n }), book(), 1000)).toBe('settle')
    expect(phaseOf(position(), series({ settlementPrice: 120n }), book({ settled: true }), 1000)).toBe('settle-vault')
    expect(phaseOf(position(), series({ settlementPrice: 120n, closed: true }), book({ settled: true }), 1000)).toBe('claim')
    expect(phaseOf(position({ claim: { due: 5n, paid: 4n, deficit: 1n } }), series({ closed: true }), book(), 1000)).toBe('claimed')
  })
  it('an early exercise ends the story, before or after expiry', () => {
    expect(phaseOf(position({ exercised: true }), series(), book(), 10)).toBe('exercised')
    expect(phaseOf(position({ exercised: true }), series({ settlementPrice: 1n, closed: true }), book(), 5000)).toBe('exercised')
  })
  it('a position whose series is not loaded is treated as live, and a missing book as not settled', () => {
    expect(phaseOf(position(), undefined, undefined, 5000)).toBe('live')
    expect(phaseOf(position(), series({ settlementPrice: 1n }), undefined, 5000)).toBe('settle')
  })
})

describe('phase tables', () => {
  const phases: Phase[] = ['live', 'exercised', 'await-price', 'settle', 'settle-vault', 'claim', 'claimed']
  it('has a state word for every phase and warns exactly where an action is waiting after expiry', () => {
    expect(phases.map((p) => PHASE_STATE[p].label)).toEqual(['Open', 'Exercised', 'Expired', 'Expired', 'Book settled', 'Settled', 'Claimed'])
    expect(phases.filter((p) => PHASE_STATE[p].warn)).toEqual(['settle', 'settle-vault', 'claim'])
  })
  it('names the call of each actionable phase; only exercise and claim need the holder', () => {
    expect(phases.filter((p) => PHASE_ACTION[p])).toEqual(['live', 'settle', 'settle-vault', 'claim'])
    expect(PHASE_ACTION.live).toMatchObject({ kind: 'exercise', label: 'Exercise early', holderOnly: true })
    expect(PHASE_ACTION.settle).toMatchObject({ kind: 'settle', label: 'Settle book', holderOnly: false })
    expect(PHASE_ACTION['settle-vault']).toMatchObject({ kind: 'settle-vault', label: 'Settle series', holderOnly: false })
    expect(PHASE_ACTION.claim).toMatchObject({ kind: 'claim', label: 'Claim', done: 'Claimed', holderOnly: true })
    expect(PHASE_WAITING['await-price']).toBe('Waiting for settlement price')
  })
})

describe('positionRow', () => {
  it('shows paid and deficit only once something was paid', () => {
    const open = positionRow(position(), [series()], [book()], 10)
    expect(open).toMatchObject({ phase: 'live', paid: null, deficit: null, due: null, waiting: null })
    expect(open.action?.kind).toBe('exercise')
    const exercised = positionRow(position({ exercised: true, paid: 7n, deficit: 0n }), [series()], [book()], 10)
    expect(exercised).toMatchObject({ phase: 'exercised', paid: 7n, deficit: 0n, action: null })
    const claimed = positionRow(position({ claim: { due: 9n, paid: 6n, deficit: 3n } }), [series({ closed: true })], [book()], 5000)
    expect(claimed).toMatchObject({ phase: 'claimed', due: 9n, paid: 6n, deficit: 3n })
  })
  it('flags a live position on a vault-owned book: it settles at expiry', () => {
    expect(positionRow(position({ bookOwner: VAULT }), [series()], [book({ owner: VAULT })], 10).settlesAtExpiry).toBe(true)
    expect(positionRow(position({ bookOwner: VAULT }), [series()], [book({ owner: VAULT })], 5000).settlesAtExpiry).toBe(false)
    expect(positionRow(position(), [series()], [book()], 10).settlesAtExpiry).toBe(false)
  })
  it('says who is waiting for the settlement price', () => {
    expect(positionRow(position(), [series()], [book()], 5000)).toMatchObject({ phase: 'await-price', waiting: 'Waiting for settlement price', action: null })
  })
  it('gives an exercised position its due: what was paid plus the deficit (review finding 27)', () => {
    const row = positionRow(position({ exercised: true, paid: 1_600n, deficit: 0n }), [series()], [book()], 10)
    expect(row).toMatchObject({ phase: 'exercised', paid: 1_600n, deficit: 0n, due: 1_600n })
    expect(positionRow(position({ exercised: true, paid: 900n, deficit: 100n }), [series()], [book()], 10).due).toBe(1_000n)
    expect(positionRow(position(), [series()], [book()], 10).due).toBeNull()
    expect(positionRow(position({ claim: { due: 5n, paid: 4n, deficit: 1n } }), [series({ closed: true })], [book()], 1000).due).toBe(5n)
  })
  it('derives a row for every position of the fixture model', () => {
    const model = new FixtureProClient(parseFixtures(), 'american_exercise', 22).getModel()
    const rows = positionRows(model)
    expect(rows).toHaveLength(model.positions.length)
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(PHASE_STATE[r.phase]).toBe(r.state)
  })
})
