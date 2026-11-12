// The one stellar.expert URL builder (Testnet only). Every explorer link in the app goes through here.

const BASE = 'https://stellar.expert/explorer/testnet'

export type ExplorerKind = 'tx' | 'account' | 'contract' | 'asset' | 'ledger'

/**
 * `explorerUrl('tx', hash)`, `explorerUrl('account', 'G…')`, `explorerUrl('contract', 'C…')`,
 * `explorerUrl('asset', 'CODE-ISSUER')`, `explorerUrl('ledger', 58331204)`.
 */
export function explorerUrl(kind: ExplorerKind, id: string | number | bigint): string {
  return `${BASE}/${kind}/${encodeURIComponent(String(id))}`
}

export const explorerTx = (hash: string) => explorerUrl('tx', hash)
export const explorerAccount = (g: string) => explorerUrl('account', g)
export const explorerContract = (c: string) => explorerUrl('contract', c)
export const explorerAsset = (code: string, issuer: string) => explorerUrl('asset', `${code}-${issuer}`)
export const explorerLedger = (sequence: number | bigint) => explorerUrl('ledger', sequence)

/** Link for any address: `C…` is a contract, anything else is treated as an account. */
export const explorerAddress = (address: string) => (address.startsWith('C') ? explorerContract(address) : explorerAccount(address))

/** Mock ids (`C_MOCK_*` contracts, the `GMAKER…`, `GHEDGER…` and `GMOCK…` placeholder accounts) have no page: show plain text instead. */
export const isMockId = (id: string) => id.startsWith('C_MOCK_') || /^G(MAKER|HEDGER|MOCK)/.test(id)
