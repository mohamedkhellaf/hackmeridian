import { config } from '../config'
import type { FixtureProClient } from './FixtureProClient'
import type { SorobanProClient } from './SorobanProClient'
import type { Party, ProClient } from './types'

// The one place that decides fixtures or live for Margin. Both clients are dynamic imports: the fixture client
// pulls in a 1 MB JSON file (packages/risk/fixtures/pro_v0.json), which a live build must never ship, and the
// live client pulls in the Stellar SDK, which a fixture build does not need. The fixture branch is guarded by
// `import.meta.env.VITE_PRO_CONTRACT_ID` itself, which Vite replaces with a literal at build time: with a
// contract id in the build the branch is folded away and the fixture chunk is not emitted at all.

/** The account the fixture simulation acts as when it starts. */
export const FIXTURE_DEFAULT_PARTY: Party = 'MAKER_A'

/** How often the live client re-reads the contract. */
export const PRO_REFRESH_MS = 15_000

export interface ProClientHandle {
  client: ProClient
  /** The fixture client with its simulation controls (scenario, step, parties). Null on the live contract. */
  sim: FixtureProClient | null
  /** The live client (`setWallet`, `refresh`, `start`, `getStatus`). Null on fixtures. */
  live: SorobanProClient | null
  /** True on fixtures: every Margin screen must then say "simulated, not on-chain". */
  simulated: boolean
}

/** True when Margin has no contract id in the build and replays fixtures. */
export const isProSimulated = (): boolean => !import.meta.env.VITE_PRO_CONTRACT_ID

/**
 * The Margin client for this build. Live: call `live.setWallet(...)` when the wallet changes, then
 * `live.refresh()`, and `live.start()` to poll (it returns the stop function). Fixtures: `sim` drives the
 * "Simulation" card.
 */
export async function createProClient(): Promise<ProClientHandle> {
  if (!import.meta.env.VITE_PRO_CONTRACT_ID) {
    const { FixtureProClient } = await import('./FixtureProClient')
    const sim = new FixtureProClient()
    return { client: sim, sim, live: null, simulated: true }
  }
  const contractId = config.proContractId
  if (!contractId) throw new Error('VITE_PRO_CONTRACT_ID is set but empty.')
  const { SorobanProClient } = await import('./SorobanProClient')
  const live = new SorobanProClient(contractId)
  return { client: live, sim: null, live, simulated: false }
}
