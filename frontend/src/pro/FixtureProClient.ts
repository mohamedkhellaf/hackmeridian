// Simulated Strata Pro client: replays packages/risk/fixtures/pro_v0.json. Not on chain.
// Calls do not compute anything. Each one finds the next scripted step with the same operation and arguments
// (who, position, book, series...), moves the cursor there and returns that step's recorded result or error.
// Amounts typed in a form are therefore not used: the script decides. When the script has no such step the
// call returns a "not scripted" refusal (code 0).
import raw from '../../../packages/risk/fixtures/pro_v0.json?raw'
import { proErrorName } from './errors'
import { currentRequirement, deriveModel, findScripted, requirementAfterFill } from './replay'
import type { RawFixtureFile, RawScenario, RawStep, StepMatcher } from './replay'
import type { CallResult, ClaimResult, OfferParams, Party, ProClient, ProModel, Requirement } from './types'
import { VAULT } from './types'

export function parseFixtures(text: string = raw): RawFixtureFile {
  return JSON.parse(text) as RawFixtureFile
}

/** Scenario shown first: exercise refusals, a healthy exercise, a gap that leaves the writer below maintenance, then vault takeover. */
export const DEFAULT_SCENARIO = 'american_exercise'
/** Steps already applied in the default scenario: the writer is below maintenance margin and a holder is waiting. */
export const DEFAULT_CURSOR = 22

export const NOT_SCRIPTED = 0

const big = (n: unknown) => BigInt(n as number)

export class FixtureProClient implements ProClient {
  readonly kind = 'fixture' as const
  readonly file: RawFixtureFile
  private scenario: RawScenario
  private cursor: number
  private model: ProModel
  private listeners = new Set<() => void>()

  constructor(file: RawFixtureFile = parseFixtures(), scenarioName: string = DEFAULT_SCENARIO, cursor?: number) {
    this.file = file
    this.scenario = file.scenarios.find((s) => s.name === scenarioName) ?? file.scenarios[0]
    this.cursor = cursor ?? (this.scenario.name === DEFAULT_SCENARIO ? DEFAULT_CURSOR : 0)
    this.model = deriveModel(this.scenario, this.cursor)
  }

  // ---- simulation controls (not part of ProClient) ----
  get scenarioNames(): string[] {
    return this.file.scenarios.map((s) => s.name)
  }
  get scenarioName(): string {
    return this.scenario.name
  }
  get stepCount(): number {
    return this.scenario.steps.length
  }
  get position(): number {
    return this.cursor
  }
  /** Parties that appear in the scenario (wallet owners plus the roles), for the "acting as" selector. */
  get parties(): Party[] {
    const names = new Set<string>(Object.keys(this.scenario.initial_wallets))
    for (const s of this.scenario.steps) if (typeof s.args[0] === 'string' && /^[A-Z][A-Z0-9_]*$/.test(s.args[0])) names.add(s.args[0])
    names.delete(VAULT)
    return [...names]
  }
  setScenario(name: string): void {
    const sc = this.file.scenarios.find((s) => s.name === name)
    if (!sc) return
    this.scenario = sc
    this.moveTo(sc.name === DEFAULT_SCENARIO ? DEFAULT_CURSOR : 0)
  }
  moveTo(cursor: number): void {
    this.cursor = Math.max(0, Math.min(cursor, this.scenario.steps.length))
    this.model = deriveModel(this.scenario, this.cursor)
    this.listeners.forEach((l) => l())
  }

  // ---- ProClient ----
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getModel(): ProModel {
    return this.model
  }
  getRequirement(who: Party): Requirement | null {
    return currentRequirement(this.scenario, this.cursor, who)
  }
  requirementAfterFill(p: OfferParams): Requirement | null {
    return requirementAfterFill(this.scenario, this.cursor, p)
  }

  /** Replays the next scripted step matching `op` and `match`; `read` shapes its recorded result. */
  private async play<T>(op: string, match: StepMatcher, read: (r: unknown) => T): Promise<CallResult<T>> {
    const i = findScripted(this.scenario, this.cursor, op, match)
    if (i < 0) {
      return { ok: false, code: NOT_SCRIPTED, name: 'NotScripted', note: 'Simulation: the fixture has no later step for this exact action. Use the step control to pick another moment or scenario.' }
    }
    const s: RawStep = this.scenario.steps[i]
    const skipped = i - this.cursor
    const note = `Simulated: replayed fixture step ${i + 1}${skipped > 0 ? ` (skipped ${skipped} earlier step${skipped === 1 ? '' : 's'})` : ''}. Values come from the script, not from what was typed.`
    this.moveTo(i + 1)
    if (s.expect !== 'ok') return { ok: false, code: s.expect.code, name: proErrorName(s.expect.code), note }
    return { ok: true, value: read(s.result), note }
  }

  deposit(who: Party, amount: bigint) {
    void amount
    return this.play('deposit', (s) => s.args[0] === who, () => null)
  }
  withdraw(who: Party, amount: bigint) {
    void amount
    return this.play('withdraw', (s) => s.args[0] === who, () => null)
  }
  createOffer(p: OfferParams) {
    return this.play('create_offer', (s) => s.args[0] === p.writer && s.args[1] === p.seriesId, (r) => (typeof r === 'number' ? r : null))
  }
  cancelOffer(writer: Party, offerId: number) {
    return this.play('cancel_offer', (s) => s.args[0] === writer && s.args[1] === offerId, () => null)
  }
  buy(buyer: Party, offerId: number) {
    void buyer // the script names its own buyer; the offer id selects the step
    return this.play('buy', (s) => s.args[1] === offerId, (r) => (typeof r === 'number' ? r : null))
  }
  exercise(holder: Party, positionId: number) {
    return this.play('exercise', (s) => s.args[0] === holder && s.args[1] === positionId, (r) => {
      const o = r as { due: number; spot: number }
      return { due: big(o.due), spot: big(o.spot) }
    })
  }
  liquidate(caller: Party, writer: Party, taker: Party | null) {
    void caller
    return this.play('liquidate', (s) => s.args[1] === writer && s.args[2] === (taker ?? VAULT), (r) => {
      const o = r as { x: number; paid: number; deficit: number }
      return { x: big(o.x), paid: big(o.paid), deficit: big(o.deficit) }
    })
  }
  settle(bookId: number) {
    return this.play('settle', (s) => s.args[0] === bookId, (r) => {
      const o = r as { due: number; from_owner: number; shortfall: number }
      return { due: big(o.due), fromOwner: big(o.from_owner), shortfall: big(o.shortfall) }
    })
  }
  settleVault(seriesId: number) {
    return this.play('settle_vault', (s) => s.args[0] === seriesId, (r) => {
      const o = r as { shortfall: number; vault_paid: number; deficit: number }
      return { shortfall: big(o.shortfall), vaultPaid: big(o.vault_paid), deficit: big(o.deficit) }
    })
  }
  claim(holder: Party, positionId: number) {
    return this.play<ClaimResult>('claim', (s) => s.args[0] === holder && s.args[1] === positionId, (r) => {
      const o = r as { due: number; paid: number; deficit: number }
      return { due: big(o.due), paid: big(o.paid), deficit: big(o.deficit) }
    })
  }
  lpDeposit(lp: Party, amount: bigint) {
    void amount
    return this.play('lp_deposit', (s) => s.args[0] === lp, (r) => big(r))
  }
}
