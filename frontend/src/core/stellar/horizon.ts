import { config } from '../config'

// Horizon over plain `fetch` (Testnet). The Stellar SDK's Horizon.Server pulls ~100 kB of client code
// (eventsource, an HTTP client) for what is three GET requests, so nothing in core uses it for reads.

/** GET a Horizon URL. Null on 404 (the account or asset does not exist); throws on any other failure. */
export async function getJson(url: string): Promise<unknown | null> {
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Horizon ${res.status}`)
  return res.json()
}

export const horizonUrl = (path: string): string => `${config.horizonUrl}${path}`

/** One line of a Horizon account's `balances` array, as far as this app reads it. */
export interface HorizonBalance {
  asset_type?: string
  asset_code?: string
  asset_issuer?: string
  balance?: string
  is_authorized?: boolean
  is_authorized_to_maintain_liabilities?: boolean
}

/** The account document, or null when the account is not funded. */
export async function fetchAccount(address: string): Promise<{ balances: HorizonBalance[]; sequence?: string } | null> {
  const json = (await getJson(horizonUrl(`/accounts/${address}`))) as { balances?: HorizonBalance[]; sequence?: string } | null
  if (json === null) return null
  return { ...json, balances: Array.isArray(json.balances) ? json.balances : [] }
}

/** The trustline of `code:issuer` on an account document, if any. */
export function trustlineOf(balances: HorizonBalance[], code: string, issuer: string): HorizonBalance | undefined {
  return balances.find((b) => b.asset_code === code && b.asset_issuer === issuer)
}
