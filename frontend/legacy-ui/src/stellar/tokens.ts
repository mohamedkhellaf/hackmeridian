import { Address, Horizon, NotFoundError } from '@stellar/stellar-sdk'
import { config } from '../config'
import { server } from './rpc'

export interface TokenRef {
  contractId: string // SAC contract ID; `C_MOCK_*` placeholders are skipped
  code?: string
  issuer?: string // classic issuer; enables trustline / authorization checks via Horizon
}

export type BalanceStatus = 'ok' | 'mock' | 'unfunded' | 'no-trustline' | 'not-authorized' | 'error'

export interface TokenBalance {
  contractId: string
  status: BalanceStatus
  balance: bigint | null // null for mock / error / no-trustline
  error?: string
}

export const isMockToken = (id: string) => id.startsWith('C_MOCK_')

const horizon = new Horizon.Server(config.horizonUrl)

// SEP-41 balance(address) via read-only simulation (queryContract never signs).
export async function readBalance(contractId: string, address: string): Promise<bigint> {
  if (isMockToken(contractId)) throw new Error('mock token')
  Address.fromString(address) // validate early
  const { result } = await server.queryContract<bigint>(contractId, 'balance', { id: address })
  return BigInt(result)
}

// Trustline / authorization state from Horizon for a classic issued asset.
async function trustlineFlag(token: TokenRef, address: string): Promise<BalanceStatus | null> {
  if (!token.code || !token.issuer || token.issuer === address) return null
  try {
    const acct = await horizon.loadAccount(address)
    const line = acct.balances.find(
      (b) => 'asset_code' in b && b.asset_code === token.code && b.asset_issuer === token.issuer,
    )
    if (!line) return 'no-trustline'
    if ('is_authorized' in line && line.is_authorized === false) return 'not-authorized'
    return null
  } catch (e) {
    if (e instanceof NotFoundError) return 'no-trustline'
    return null // Horizon hiccup: fall back to the plain balance
  }
}

export async function readBalances(tokens: TokenRef[], address: string): Promise<TokenBalance[]> {
  return Promise.all(
    tokens.map(async (t): Promise<TokenBalance> => {
      if (isMockToken(t.contractId)) return { contractId: t.contractId, status: 'mock', balance: null }
      try {
        const [balance, flag] = await Promise.all([readBalance(t.contractId, address), trustlineFlag(t, address)])
        if (flag === 'no-trustline') return { contractId: t.contractId, status: flag, balance: null }
        return { contractId: t.contractId, status: flag ?? 'ok', balance }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        // Verified on Testnet: the native SAC fails with "account entry is missing" for unfunded accounts.
        if (/account entry is missing/i.test(msg)) return { contractId: t.contractId, status: 'unfunded', balance: null }
        if (/trustline entry is missing/i.test(msg)) return { contractId: t.contractId, status: 'no-trustline', balance: null }
        return { contractId: t.contractId, status: 'error', balance: null, error: msg }
      }
    }),
  )
}
