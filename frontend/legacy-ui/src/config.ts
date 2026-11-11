import { Networks } from '@stellar/stellar-sdk'

// Testnet only (AGENTS.md: never Mainnet in this hackathon).
export const config = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
  // Set once Dev 2 deploys; while empty the app runs on the mock client.
  optionsContractId: import.meta.env.VITE_OPTIONS_CONTRACT_ID as string | undefined,
  // StellSec Pro (experimental): the Pro contract id. Used only when VITE_ENABLE_PRO=1; while empty, Pro runs on fixtures.
  proContractId: (import.meta.env.VITE_PRO_CONTRACT_ID as string | undefined) || undefined,
}

export const explorerTx = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`
