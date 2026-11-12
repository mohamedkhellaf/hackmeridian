// Simulated StellSec Pro client: replays packages/risk/fixtures/pro_v0.json. Not on chain.
// Calls do not compute anything. Each one finds the next scripted step with the same operation and arguments
// (who, position, book, series...), moves the cursor there and returns that step's recorded result or error,
// with the step itself (`step`: its number and arguments). Amounts passed in are not used: the Margin forms show
// the recorded amounts, locked, and say which steps run first. When the script has no such step the call
// returns a "not scripted" refusal (code 0).
import raw from '../../../../packages/risk/fixtures/pro_v0.json?raw'
import { proErrorName } from './errors'
import { currentRequirement, deriveModel, findScripted, requirementAfterFill, stepActor } from './replay'
import type { RawFixtureFile, RawScenario, RawStep, StepMatcher } from './replay'
import type { TxOptions } from '../tx/types'
import type { CallResult, ClaimResult, OfferParams, Party, ProClient, ProModel, Requirement } from './types'
import { VAULT } from './types'

export function parseFixtures(text: string = raw): RawFixtureFile {
  return JSON.parse(text) as RawFixtureFile
}

/**
 * Scenario shown first (ruling E22): the uncovered sale that expires out of the money, where the main path runs.
 * "Early exercise" (american_exercise) is one choice away in the Replay box.
 */
export const DEFAULT_SCENARIO = 'happy_path_otm'
/**
 * Steps already applied in the default scenario: the vault is funded, the series listed and a snapshot published.
 * Deposit, write, buy, the requirement and withdraw all follow, so no form of the section starts disabled.
 */
export const DEFAULT_CURSOR = 3

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
    for (const s of this.scenario.steps) {
      const actor = stepActor(s)
      if (actor) names.add(actor)
    }
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
  private async play<T>(op: string, match: StepMatcher, read: (r: unknown) => T, opts?: TxOptions): Promise<CallResult<T>> {
    // A replayed step has no wallet and no network: only `checking` is real. No hash exists, so none is reported.
    opts?.onStage?.({ stage: 'checking' })
    const i = findScripted(this.scenario, this.cursor, op, match)
    if (i < 0) {
      return { ok: false, code: NOT_SCRIPTED, name: 'NotScripted', note: 'Simulation: the fixture has no later step for this exact action. Use the step control to pick another moment or scenario.' }
    }
    const s: RawStep = this.scenario.steps[i]
    const from = this.cursor + 1
    // The screens say before the press which steps run first (useReplayable); the note repeats it after.
    const note = `Step ${i + 1} of the scenario${i + 1 > from ? (i === from ? `, after step ${from}` : `, after steps ${from} to ${i}`) : ''}.`
    const step = { number: i + 1, op: s.op, args: s.args }
    this.moveTo(i + 1)
    if (s.expect !== 'ok') return { ok: false, code: s.expect.code, name: proErrorName(s.expect.code), note, step }
    return { ok: true, value: read(s.result), note, step }
  }

  deposit(who: Party, amount: bigint, opts?: TxOptions) {
    void amount
    return this.play('deposit', (s) => s.args[0] === who, () => null, opts)
  }
  withdraw(who: Party, amount: bigint, opts?: TxOptions) {
    void amount
    return this.play('withdraw', (s) => s.args[0] === who, () => null, opts)
  }
  createOffer(p: OfferParams, opts?: TxOptions) {
    return this.play('create_offer', (s) => s.args[0] === p.writer && s.args[1] === p.seriesId, (r) => (typeof r === 'number' ? r : null), opts)
  }
  cancelOffer(writer: Party, offerId: number, opts?: TxOptions) {
    return this.play('cancel_offer', (s) => s.args[0] === writer && s.args[1] === offerId, () => null, opts)
  }
  buy(buyer: Party, offerId: number, opts?: TxOptions) {
    void buyer // the script names its own buyer; the offer id selects the step
    return this.play('buy', (s) => s.args[1] === offerId, (r) => (typeof r === 'number' ? r : null), opts)
  }
  exercise(holder: Party, positionId: number, opts?: TxOptions) {
    return this.play('exercise', (s) => s.args[0] === holder && s.args[1] === positionId, (r) => {
      const o = r as { due: number; spot: number }
      return { due: big(o.due), spot: big(o.spot) }
    }, opts)
  }
  liquidate(caller: Party, writer: Party, taker: Party | null, opts?: TxOptions) {
    void caller
    return this.play('liquidate', (s) => s.args[1] === writer && s.args[2] === (taker ?? VAULT), (r) => {
      const o = r as { x: number; paid: number; deficit: number }
      return { x: big(o.x), paid: big(o.paid), deficit: big(o.deficit) }
    }, opts)
  }
  settle(bookId: number, opts?: TxOptions) {
    return this.play('settle', (s) => s.args[0] === bookId, (r) => {
      const o = r as { due: number; from_owner: number; shortfall: number }
      return { due: big(o.due), fromOwner: big(o.from_owner), shortfall: big(o.shortfall) }
    }, opts)
  }
  settleVault(seriesId: number, opts?: TxOptions) {
    return this.play('settle_vault', (s) => s.args[0] === seriesId, (r) => {
      const o = r as { shortfall: number; vault_paid: number; deficit: number }
      return { shortfall: big(o.shortfall), vaultPaid: big(o.vault_paid), deficit: big(o.deficit) }
    }, opts)
  }
  claim(holder: Party, positionId: number, opts?: TxOptions) {
    return this.play<ClaimResult>('claim', (s) => s.args[0] === holder && s.args[1] === positionId, (r) => {
      const o = r as { due: number; paid: number; deficit: number }
      return { due: big(o.due), paid: big(o.paid), deficit: big(o.deficit) }
    }, opts)
  }
  lpDeposit(lp: Party, amount: bigint, opts?: TxOptions) {
    void amount
    return this.play('lp_deposit', (s) => s.args[0] === lp, (r) => big(r), opts)
  }
}
