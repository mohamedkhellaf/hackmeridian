import { findScripted, nextRequirementStep, stepActor } from '../../../core/pro/replay'
import type { RawStep } from '../../../core/pro/replay'
import { usePro } from '../../../data'

/** The recorded step a button would replay, and the steps a press runs before it. */
export interface RecordedStep {
  /** 1-based, as the replay counts steps. */
  number: number
  op: string
  args: RawStep['args']
  /** Steps between the replay's position and this one: a press runs them first, in order. */
  before: { number: number; op: string; actor: string | null }[]
}

/**
 * Fixture builds: whether the recorded scenario has a later step for an action, so a button the replay cannot
 * run is disabled with its reason instead of answering "Not in this scenario". The matchers follow the ones the
 * fixture client plays with (core/pro/FixtureProClient.ts). On the contract build every action is available.
 *
 * `next(op, match)` gives the step a press would replay, with the steps it runs first, so a form can show the
 * recorded amounts and say what happens before the press (ruling F11). Null on the contract build.
 * `reason(what)` words the refusal: "The scenario records no deposit by Maker A after step 22."
 * `requirementAt(who)` is the step where the scenario next records that account's requirement, or null.
 */
export function useReplayable(): {
  simulated: boolean
  can: (op: string, match: (args: RawStep['args']) => boolean) => boolean
  next: (op: string, match: (args: RawStep['args']) => boolean) => RecordedStep | null
  reason: (what: string) => string
  requirementAt: (who: string) => number | null
  position: number
} {
  const { sim } = usePro()
  const scenario = sim ? sim.file.scenarios.find((s) => s.name === sim.scenarioName) : undefined
  const position = sim?.position ?? 0
  const next = (op: string, match: (args: RawStep['args']) => boolean): RecordedStep | null => {
    if (!scenario) return null
    const i = findScripted(scenario, position, op, (s) => match(s.args))
    if (i < 0) return null
    const s = scenario.steps[i]
    const before = scenario.steps.slice(position, i).map((b, k) => ({ number: position + k + 1, op: b.op, actor: stepActor(b) }))
    return { number: i + 1, op: s.op, args: s.args, before }
  }
  return {
    simulated: sim !== null,
    can: (op, match) => !sim || !scenario || findScripted(scenario, position, op, (s) => match(s.args)) >= 0,
    next,
    reason: (what) => `The scenario records no ${what} after step ${position}.`,
    requirementAt: (who) => {
      if (!scenario) return null
      const i = nextRequirementStep(scenario, position, who)
      return i < 0 ? null : i + 1
    },
    position,
  }
}
