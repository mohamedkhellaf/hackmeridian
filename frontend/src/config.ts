import { Networks } from '@stellar/stellar-sdk'

// Testnet only (AGENTS.md: never Mainnet in this hackathon).
export const config = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
  // Set once Dev 2 deploys; while empty the app runs on the mock client.
  optionsContractId: import.meta.env.VITE_OPTIONS_CONTRACT_ID as string | undefined,
}

export const explorerTx = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`
