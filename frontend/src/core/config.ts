// Build-time configuration. Testnet only (never Mainnet, never real funds).
//
// This module must stay free of the Stellar SDK: it is imported by the shell, and the SDK is ~1 MB. The passphrase
// is therefore a literal; `stellar/passphrase.test.ts` asserts it equals the SDK's `Networks.TESTNET`.

export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015'

const clean = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)

export const config = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: TESTNET_PASSPHRASE,
  /** Covered options contract. While empty the app runs on the in-memory mock client. */
  optionsContractId: clean(import.meta.env.VITE_OPTIONS_CONTRACT_ID),
  /** Margin contract (code name `pro`). Used only when PRO_ENABLED; while empty, Margin runs on fixtures. */
  proContractId: clean(import.meta.env.VITE_PRO_CONTRACT_ID),
}

/** True when the Covered product runs on the mock client (no contract id in the build). */
export const IS_MOCK = !config.optionsContractId

/**
 * The Margin section is mounted only when the build sets VITE_ENABLE_PRO=1. Written against `import.meta.env`
 * directly so the bundler can fold it (vite.config.ts pins the value with `define`).
 */
export const PRO_ENABLED = import.meta.env.VITE_ENABLE_PRO === '1'
