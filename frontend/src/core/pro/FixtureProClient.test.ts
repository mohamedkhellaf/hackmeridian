import { describe, expect, it } from 'vitest'
import { DEFAULT_CURSOR, DEFAULT_SCENARIO, FixtureProClient, NOT_SCRIPTED, parseFixtures } from './FixtureProClient'
import { deriveModel, nextRequirementStep, stepActor } from './replay'

const file = parseFixtures()
const scenario = (n: string) => file.scenarios.find((s) => s.name === n)!

describe('fixture parsing', () => {
  it('loads the v0.3.2 fixtures', () => {
    expect(file.version).toBe('pro-v0.3.2')
    expect(file.scenarios).toHaveLength(16)
    expect(file.scenarios.reduce((n, s) => n + s.steps.length, 0)).toBe(691)
  })

  it('derives a model at every step of every scenario without throwing, with bigint amounts', () => {
    for (const sc of file.scenarios) {
      for (let i = 0; i <= sc.steps.length; i += sc.steps.length > 60 ? 7 : 1) {
        const m = deriveModel(sc, i)
        expect(typeof m.vault.cash).toBe('bigint')
        expect(m.now).toBeGreaterThanOrEqual(sc.t0)
      }
      const end = deriveModel(sc, sc.steps.length)
      for (const a of end.accounts) {
        expect(typeof a.cash).toBe('bigint')
        expect(typeof a.owed).toBe('bigint')
      }
    }
  })

  it('reads series terms, snapshots and offers from the steps', () => {
    const m = deriveModel(scenario('happy_path_otm'), 5)
    expect(m.series[0].strike).toBe(1_100_000_000n)
    expect(m.series[0].snapshot?.spot).toBe(1_000_000_000n)
    expect(m.offers).toHaveLength(1)
    expect(m.offers[0].status).toBe('open')
    expect(deriveModel(scenario('happy_path_otm'), 6).offers[0].status).toBe('bought')
  })
})

describe('requirement values', () => {
  it('shows get_requirement only while it is current', () => {
    const sc = scenario('american_exercise')
    // step 13 (index) is get_requirement(MAKER_A); step 14 is a successful exercise
    expect(deriveModel(sc, 14).accounts.find((a) => a.id === 'MAKER_A')?.requirement?.mm).toBe(71_196_628_000n)
    expect(deriveModel(sc, 15).accounts.find((a) => a.id === 'MAKER_A')?.requirement).toBeNull()
  })

  it('starts where the main path runs: deposit, write, buy, requirement and withdraw follow (E22)', () => {
    const c = new FixtureProClient()
    expect(c.scenarioName).toBe(DEFAULT_SCENARIO)
    expect(DEFAULT_SCENARIO).toBe('happy_path_otm')
    expect(c.position).toBe(DEFAULT_CURSOR)
    const next = scenario(DEFAULT_SCENARIO).steps.slice(DEFAULT_CURSOR).map((s) => s.op)
    for (const op of ['deposit', 'create_offer', 'buy', 'get_requirement', 'withdraw']) expect(next, op).toContain(op)
    expect(next[0]).toBe('deposit')
  })

  it('exposes a writer below maintenance in the early-exercise story', () => {
    const c = new FixtureProClient(file, 'american_exercise', 22)
    const a = c.getModel().accounts.find((x) => x.id === 'MAKER_A')!
    expect(a.requirement!.nlv).toBeLessThan(a.requirement!.mm)
    expect(a.cushion).toBeLessThan(0n)
    expect(c.getRequirement('MAKER_A')?.im).toBe(549_318_071_250n)
    expect(c.getRequirement('NOBODY')).toBeNull()
  })

  it('previews IM after fill from the scripted value, else null', () => {
    const c = new FixtureProClient(file, 'happy_path_otm', 4)
    const p = { writer: 'MAKER_A', seriesId: 0, qty: 1000n, premium: 6_191_700_900n, quoteExpiry: 1_801_814_400 }
    expect(c.requirementAfterFill(p)?.im).toBe(244_943_093_750n)
    expect(c.requirementAfterFill({ ...p, qty: 7n })).toBeNull()
  })

  it('gives no preview for another premium: the account value after a fill depends on it', () => {
    const c = new FixtureProClient(file, 'happy_path_otm', 4)
    const p = { writer: 'MAKER_A', seriesId: 0, qty: 1000n, premium: 1_000_000_000n, quoteExpiry: 1_801_814_400 }
    expect(c.requirementAfterFill(p)).toBeNull()
  })
})

describe('replayed actions', () => {
  it('walks the American exercise story with the real refusal codes', async () => {
    const c = new FixtureProClient(file, 'american_exercise', 22)
    const refused = await c.exercise('BOB', 1)
    expect(refused).toMatchObject({ ok: false, code: 224, name: 'LiquidateFirst' })
    const take = await c.liquidate('KEEPER', 'MAKER_A', null)
    expect(take.ok).toBe(true)
    if (take.ok) expect(take.value).toEqual({ x: 315_036_978_900n, paid: 315_036_978_900n, deficit: 0n })
    expect(await c.exercise('BOB', 1)).toMatchObject({ ok: false, code: 226, name: 'NoEarlyExercise' })
    expect(c.getModel().positions.find((p) => p.id === 1)?.bookOwner).toBe('VAULT')
    expect(await c.exercise('BOB', 1)).toMatchObject({ ok: false, code: 205 })
    const book = await c.settle(1)
    expect(book.ok).toBe(true)
    expect((await c.settleVault(0)).ok).toBe(true)
    const claim = await c.claim('BOB', 1)
    expect(claim).toMatchObject({ ok: true, value: { due: 300_000_000_000n, paid: 300_000_000_000n, deficit: 0n } })
    expect(c.getModel().positions.find((p) => p.id === 1)?.claim?.paid).toBe(300_000_000_000n)
  })

  it('reports a deficit when the vault takes over past the writer cash (gap_to_vault)', async () => {
    const c = new FixtureProClient(file, 'gap_to_vault', 10)
    const r = await c.liquidate('KEEPER', 'MAKER_A', null)
    expect(r.ok && r.value.deficit).toBe(169_429_363_000n)
    expect(c.getModel().accounts.find((a) => a.id === 'MAKER_A')?.owed).toBe(169_429_363_000n)
    expect(c.getModel().vault.debtsOwed).toBe(169_429_363_000n)
  })

  it('returns the replayed step with its own arguments, so a receipt never shows a typed amount', async () => {
    const c = new FixtureProClient()
    // The amount passed in is not the recorded one: the step's own amount is what ran.
    const r = await c.deposit('MAKER_A', 500n * 10_000_000n)
    expect(r.ok).toBe(true)
    expect(r.step).toEqual({ number: 4, op: 'deposit', args: ['MAKER_A', 264_999_381_940] })
    expect(r.note).toBe('Step 4 of the scenario.')
  })

  it('says which steps ran before a replayed step that was not the next one', async () => {
    const c = new FixtureProClient()
    await c.deposit('MAKER_A', 0n)
    const r = await c.withdraw('MAKER_A', 0n)
    expect(r).toMatchObject({ ok: false, code: 209, step: { number: 8, op: 'withdraw', args: ['MAKER_A', 20_000_000_001] } })
    expect(r.note).toBe('Step 8 of the scenario, after steps 5 to 7.')
    const one = new FixtureProClient(file, 'happy_path_otm', 3)
    expect((await one.createOffer({ writer: 'MAKER_A', seriesId: 0, qty: 1n, premium: 1n, quoteExpiry: 0 })).note).toBe('Step 5 of the scenario, after step 4.')
  })

  it('finds where the scenario next records a requirement, and who a step acts as', () => {
    const sc = scenario('happy_path_otm')
    expect(nextRequirementStep(sc, 4, 'MAKER_A')).toBe(6)
    expect(nextRequirementStep(sc, 7, 'MAKER_A')).toBe(-1)
    expect(nextRequirementStep(sc, 0, 'VAULT')).toBe(-1)
    expect(nextRequirementStep(scenario('gap_to_vault'), 12, 'VAULT')).toBe(12)
    expect(stepActor(sc.steps[3])).toBe('MAKER_A')
    expect(stepActor(sc.steps[9])).toBeNull()
  })

  it('refuses with code 0 when the script has no such step', async () => {
    const c = new FixtureProClient()
    const r = await c.cancelOffer('MAKER_A', 99)
    expect(r).toMatchObject({ ok: false, code: NOT_SCRIPTED })
    expect(c.position).toBe(DEFAULT_CURSOR)
  })

  it('notifies subscribers when the step moves', () => {
    const c = new FixtureProClient()
    let n = 0
    const off = c.subscribe(() => n++)
    c.moveTo(3)
    c.setScenario('gap_to_vault')
    off()
    c.moveTo(4)
    expect(n).toBe(2)
    expect(c.scenarioName).toBe('gap_to_vault')
  })
})
