import { config } from '../config'
import { isMockToken } from '../stellar/tokens'
import { server } from '../stellar/rpc'

/** Pure parsers (tested with fixtures) + cached Horizon / RPC reads for the Asset facts panel. */

export type SacAsset = { kind: 'native' } | { kind: 'issued'; code: string; issuer: string }

/** SAC `name()` is "native" or "CODE:ISSUER". Anything else is not a classic asset wrapper. */
export function parseSacName(name: unknown): SacAsset | null {
  if (typeof name !== 'string') return null
  if (name === 'native') return { kind: 'native' }
  const m = /^([A-Za-z0-9]{1,12}):(G[A-Z2-7]{55})$/.exec(name)
  return m ? { kind: 'issued', code: m[1], issuer: m[2] } : null
}

export interface AssetFlags {
  authRequired: boolean
  authRevocable: boolean
  clawback: boolean
  authImmutable: boolean
}

export interface TrustlineCounts {
  authorized: number
  maintainOnly: number
  unauthorized: number
  total: number
}

export interface AssetRecordFacts {
  flags: AssetFlags
  trustlines: TrustlineCounts
  contracts: number
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function readFlags(f: Record<string, unknown>): AssetFlags {
  return {
    authRequired: f.auth_required === true,
    authRevocable: f.auth_revocable === true,
    clawback: f.auth_clawback_enabled === true,
    authImmutable: f.auth_immutable === true,
  }
}

/** First record of Horizon `/assets?asset_code=&asset_issuer=`; null when the asset has no record. */
export function parseAssetsResponse(json: unknown): AssetRecordFacts | null {
  const rec = (json as { _embedded?: { records?: unknown[] } } | null)?._embedded?.records?.[0] as
    | Record<string, unknown>
    | undefined
  if (!rec) return null
  const a = (rec.accounts ?? {}) as Record<string, unknown>
  const authorized = num(a.authorized)
  const maintainOnly = num(a.authorized_to_maintain_liabilities)
  const unauthorized = num(a.unauthorized)
  return {
    flags: readFlags((rec.flags ?? {}) as Record<string, unknown>),
    trustlines: { authorized, maintainOnly, unauthorized, total: authorized + maintainOnly + unauthorized },
    contracts: num(rec.num_contracts),
  }
}

export interface IssuerFacts {
  homeDomain: string | null
  /** True when no signer can still sign for the issuer (master key weight 0, no other signers): supply is frozen. */
  locked: boolean
  flags: AssetFlags
}

export function parseIssuerAccount(json: unknown): IssuerFacts | null {
  const acc = json as { home_domain?: string; signers?: { weight?: number }[]; flags?: Record<string, unknown> } | null
  if (!acc || !Array.isArray(acc.signers)) return null
  return {
    homeDomain: acc.home_domain || null,
    locked: acc.signers.every((s) => !s.weight),
    flags: readFlags(acc.flags ?? {}),
  }
}

export type HolderStatus = 'issuer' | 'authorized' | 'maintain-only' | 'unauthorized' | 'no-trustline' | 'unfunded'

/** Authorization of `code:issuer` on a Horizon account document. */
export function parseHolderStatus(json: unknown, code: string, issuer: string, address: string): HolderStatus {
  if (address === issuer) return 'issuer'
  const balances = (json as { balances?: Record<string, unknown>[] } | null)?.balances
  if (!Array.isArray(balances)) return 'unfunded'
  const line = balances.find((b) => b.asset_code === code && b.asset_issuer === issuer)
  if (!line) return 'no-trustline'
  if (line.is_authorized === false) return line.is_authorized_to_maintain_liabilities === true ? 'maintain-only' : 'unauthorized'
  return 'authorized'
}

export interface FlagFact {
  key: string
  label: string
  on: boolean
  consequence: string
}

/** One line per authorization flag, phrased as what it means for a holder or for the options contract. */
export function describeFlags(f: AssetFlags): FlagFact[] {
  return [
    {
      key: 'required',
      label: 'Authorization required',
      on: f.authRequired,
      consequence: f.authRequired
        ? 'Holders need the issuer’s approval before they can hold this token, including the options contract.'
        : 'Anyone can open a trustline and hold this token without approval.',
    },
    {
      key: 'revocable',
      label: 'Authorization revocable',
      on: f.authRevocable,
      consequence: f.authRevocable
        ? 'The issuer can freeze a holder’s balance at any time, which can block transfers and exercise.'
        : 'The issuer cannot freeze balances once they are authorized.',
    },
    {
      key: 'clawback',
      label: 'Clawback enabled',
      on: f.clawback,
      consequence: f.clawback
        ? 'The issuer can take tokens back, including from the options contract.'
        : 'The issuer cannot take tokens back from holders.',
    },
  ]
}

export interface AssetFacts {
  code: string
  issuer: string | null // null for native
  native: boolean
  record: AssetRecordFacts | null
  issuerInfo: IssuerFacts | null
  /** A read that failed: the panel says so instead of guessing. */
  partial: boolean
}

async function getJson(url: string): Promise<unknown | null> {
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Horizon ${res.status}`)
  return res.json()
}

async function loadFacts(contractId: string, fallbackCode: string): Promise<AssetFacts> {
  const { result } = await server.queryContract<string>(contractId, 'name', {})
  const sac = parseSacName(result)
  if (!sac) throw new Error('Not a Stellar Asset Contract')
  if (sac.kind === 'native') {
    return { code: 'XLM', issuer: null, native: true, record: null, issuerInfo: null, partial: false }
  }
  const base = config.horizonUrl
  const q = new URLSearchParams({ asset_code: sac.code, asset_issuer: sac.issuer })
  const [rec, acc] = await Promise.allSettled([
    getJson(`${base}/assets?${q}`).then(parseAssetsResponse),
    getJson(`${base}/accounts/${sac.issuer}`).then(parseIssuerAccount),
  ])
  return {
    code: sac.code || fallbackCode,
    issuer: sac.issuer,
    native: false,
    record: rec.status === 'fulfilled' ? rec.value : null,
    issuerInfo: acc.status === 'fulfilled' ? acc.value : null,
    partial: rec.status === 'rejected' || acc.status === 'rejected',
  }
}

const factsCache = new Map<string, { at: number; p: Promise<AssetFacts> }>()
const TTL_MS = 60_000

/** Cached per SAC for a minute; failures are not cached. */
export function fetchAssetFacts(contractId: string, code: string): Promise<AssetFacts> {
  if (isMockToken(contractId)) return Promise.reject(new Error('mock token'))
  const hit = factsCache.get(contractId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p
  const p = loadFacts(contractId, code)
  factsCache.set(contractId, { at: Date.now(), p })
  p.catch(() => factsCache.delete(contractId))
  return p
}

export async function fetchHolderStatus(code: string, issuer: string, address: string): Promise<HolderStatus> {
  const json = await getJson(`${config.horizonUrl}/accounts/${address}`)
  if (json === null) return address === issuer ? 'issuer' : 'unfunded'
  return parseHolderStatus(json, code, issuer, address)
}

export const expertAsset = (code: string, issuer: string) =>
  `https://stellar.expert/explorer/testnet/asset/${code}-${issuer}`
export const expertAccount = (g: string) => `https://stellar.expert/explorer/testnet/account/${g}`
export const expertContract = (c: string) => `https://stellar.expert/explorer/testnet/contract/${c}`
