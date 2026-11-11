import { findScripted } from '../../../core/pro/replay'
import type { RawStep } from '../../../core/pro/replay'
import { usePro } from '../../../data'

/**
 * Fixture builds: whether the recorded scenario has a later step for an action, so a button the replay cannot
 * run is disabled with its reason instead of answering "Not in this scenario". The matchers follow the ones the
 * fixture client plays with (core/pro/FixtureProClient.ts). On the contract build every action is available.
 *
 * `reason(what)` words the refusal: "The scenario records no deposit by Maker A after step 22."
 */
export function useReplayable(): {
  can: (op: string, match: (args: RawStep['args']) => boolean) => boolean
  reason: (what: string) => string
} {
  const { sim } = usePro()
  const scenario = sim ? sim.file.scenarios.find((s) => s.name === sim.scenarioName) : undefined
  return {
    can: (op, match) => !sim || !scenario || findScripted(scenario, sim.position, op, (s) => match(s.args)) >= 0,
    reason: (what) => `The scenario records no ${what} after step ${sim?.position ?? 0}.`,
  }
}
