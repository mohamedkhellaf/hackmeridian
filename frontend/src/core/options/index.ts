import { config } from '../config'
import type { WalletSigner } from '../stellar/signer'
import type { OptionsClient } from './client'
import { MockOptionsClient } from './mockClient'
import { SorobanOptionsClient } from './sorobanClient'

// Soroban client when VITE_OPTIONS_CONTRACT_ID is set, otherwise the in-memory mock.
// Recreate it when the wallet address changes (signing options capture the address).
export function createOptionsClient(wallet: WalletSigner): OptionsClient {
  return config.optionsContractId ? new SorobanOptionsClient(config.optionsContractId, wallet) : new MockOptionsClient()
}
