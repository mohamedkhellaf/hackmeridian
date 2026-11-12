import { config } from '../config'
import type { WalletSigner } from '../stellar/signer'
import type { OptionsClient } from './client'

// The one place that decides mock or live for the Covered product, and the only way the rest of the app reaches
// a client. Both branches are dynamic imports, so the shell paints without the Stellar SDK (about 670 kB
// minified). The mock branch is guarded by `import.meta.env.VITE_OPTIONS_CONTRACT_ID` itself, which Vite replaces
// with a literal at build time: a live build folds the branch away and never emits the mock market chunk.

let mock: Promise<OptionsClient> | null = null

/** True when the build has no options contract id: the app runs on the in-memory mock. */
export const isMockMode = (): boolean => !import.meta.env.VITE_OPTIONS_CONTRACT_ID

/**
 * The options client for this build.
 *
 * Mock (no VITE_OPTIONS_CONTRACT_ID): one client for the whole session, whatever wallet is passed; creating a
 * second one would wipe the demo state.
 *
 * Live: a new SorobanOptionsClient bound to `wallet`. The client reads `wallet.address` at call time, so either
 * create a new client when the wallet changes, or pass one long-lived object whose `address` is a getter and
 * keep the client (its token and asset caches then survive a wallet switch).
 */
export function createOptionsClient(wallet: WalletSigner): Promise<OptionsClient> {
  if (!import.meta.env.VITE_OPTIONS_CONTRACT_ID) {
    if (mock === null) {
      // End-to-end builds price the demo market at fixed leads, so a spec can pin a premium (mockSeed fixedPricing).
      const fixedPricing = import.meta.env.VITE_E2E === '1'
      const loading = import('./mockClient').then((m): OptionsClient => new m.MockOptionsClient(fixedPricing ? m.demoSeed(undefined, { fixedPricing }) : undefined))
      mock = loading
      // A failed load of the chunk is not kept: the next call tries again, so "Try again" on a page can recover.
      loading.catch(() => {
        if (mock === loading) mock = null
      })
    }
    return mock
  }
  const contractId = config.optionsContractId
  if (!contractId) return Promise.reject(new Error('VITE_OPTIONS_CONTRACT_ID is set but empty.'))
  return import('./sorobanClient').then((m): OptionsClient => new m.SorobanOptionsClient(contractId, wallet))
}

/** Forget the session's mock client, so the next createOptionsClient starts from a fresh demo market. */
export function resetMockClient(): void {
  mock = null
}
