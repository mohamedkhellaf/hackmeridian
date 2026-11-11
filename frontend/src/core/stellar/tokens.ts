import { fetchAccount, trustlineOf } from './horizon'

// Token balances. No static Stellar SDK import: the SAC `balance` read loads ./rpc on demand, and the trustline
// state comes from Horizon over fetch. Mock tokens (`C_MOCK_*`) never touch the network.

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

/** A Stellar account (`G…`) or contract (`C…`) address by shape. The RPC rejects anything else anyway. */
const ADDRESS = /^[GC][A-Z2-7]{55}$/

// SEP-41 balance(address) via read-only simulation (queryContract never signs).
export async function readBalance(contractId: string, address: string): Promise<bigint> {
  if (isMockToken(contractId)) throw new Error('mock token')
  if (!ADDRESS.test(address)) throw new Error('Not a Stellar address')
  const { server } = await import('./rpc')
  const { result } = await server.queryContract<bigint>(contractId, 'balance', { id: address })
  return BigInt(result)
}

// Trustline / authorization state from Horizon for a classic issued asset. Needs the issuer, which
// TokenInfo carries when the SAC wraps a classic asset.
async function trustlineFlag(token: TokenRef, address: string): Promise<BalanceStatus | null> {
  if (!token.code || !token.issuer || token.issuer === address || !address.startsWith('G')) return null
  try {
    const acct = await fetchAccount(address)
    if (!acct) return 'no-trustline'
    const line = trustlineOf(acct.balances, token.code, token.issuer)
    if (!line) return 'no-trustline'
    if (line.is_authorized === false) return 'not-authorized'
    return null
  } catch {
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

/** Balances keyed by token contract id, the shape the pre-trade checks read. */
export function balancesById(list: TokenBalance[]): Record<string, TokenBalance> {
  return Object.fromEntries(list.map((b) => [b.contractId, b]))
}
