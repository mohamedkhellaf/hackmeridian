// Asset identity, tiers and URL forms (brief D20).
//
// - The key of an asset everywhere in state is its contract id.
// - URLs: `/markets/<slug>` for an asset in the app's reference list, `/markets/<CODE>-<ISSUER>` for any other
//   classic asset, `/markets/<C...>` when the issuer is not known. All three forms are accepted on the way in.
// - A tier is a word in a column that states what was checked. There is no "verified" mark.

import { findReferenceAsset, findReferenceBySlug, REFERENCE_ASSETS } from './referenceList'
import type { AssetNetwork, ReferenceAsset } from './referenceList'
import { isAccountId, isContractId } from './strkey'

export type AssetTier = 'Reference' | 'Domain-linked' | 'No domain link'

export const ASSET_TIERS: readonly AssetTier[] = ['Reference', 'Domain-linked', 'No domain link']

/** What each tier word means, for the legend beside the column. */
export const TIER_MEANING: Record<AssetTier, string> = {
  Reference: "Issued by this project's test issuer and kept in the app's asset list.",
  'Domain-linked': "The issuer's home domain publishes a stellar.toml that names this asset.",
  'No domain link': 'Listed in the contract. Nothing ties the issuer to a domain.',
}

/** The note under the tier legend: what the list is, and what it is not. */
export const ASSET_LIST_NOTE = 'Anyone can list an asset. The list decides what this app shows first. It gives nobody power over the contract.'

/** The minimum the app knows about a listed asset. `TokenInfo` satisfies it; `issuer` is added when it was read. */
export interface ListedAsset {
  contractId: string
  code: string
  issuer?: string | null
}

/** The key of an asset in state, queries, lists and React keys: its contract id. Never the code. */
export const assetKey = (asset: { contractId: string }): string => asset.contractId

/**
 * The tier of an asset. `Reference` comes from the app's list alone. `Domain-linked` needs the two-way
 * stellar.toml check, which the app does not run yet: pass `domainLinked: true` only when a caller has that
 * result. Everything else is `No domain link`.
 */
export function tierOf(asset: { contractId: string }, checks: { domainLinked?: boolean } = {}): AssetTier {
  if (findReferenceAsset(asset.contractId)) return 'Reference'
  return checks.domainLinked === true ? 'Domain-linked' : 'No domain link'
}

/** A parsed `$asset` URL segment. */
export type AssetParam =
  | { form: 'slug'; slug: string }
  | { form: 'code-issuer'; code: string; issuer: string }
  | { form: 'contract'; contractId: string }

const SLUG = /^[a-z0-9-]{2,24}$/i
const CODE_ISSUER = /^([A-Za-z0-9]{1,12})-(G[A-Z2-7]{55})$/
const CONTRACT = /^C[A-Z2-7]{55}$/
/** Placeholder ids of the mock client and of review fixtures (`C_MOCK_BOND`). They exist only on the mock network. */
const MOCK_CONTRACT = /^C_[A-Z0-9_]{1,40}$/

/**
 * Parses the `$asset` segment of `/markets/$asset`: a slug (`bond`), `CODE-ISSUER` or a contract id (`C...`).
 * Returns null for anything else; callers then render a fixed "no such asset" view and never echo the segment.
 *
 * On `testnet` the account and contract ids must carry a valid StrKey checksum. On `mock` the ids are
 * placeholders, so only their shape is checked and `C_MOCK_*` ids are accepted. The code part is case-sensitive;
 * a slug is returned in lower case.
 */
export function parseAssetParam(param: string, network: AssetNetwork = 'testnet'): AssetParam | null {
  if (typeof param !== 'string' || param.length < 2 || param.length > 80) return null
  const strict = network === 'testnet'
  if (CONTRACT.test(param)) return !strict || isContractId(param) ? { form: 'contract', contractId: param } : null
  if (!strict && MOCK_CONTRACT.test(param)) return { form: 'contract', contractId: param }
  const ci = CODE_ISSUER.exec(param)
  if (ci) return !strict || isAccountId(ci[2]) ? { form: 'code-issuer', code: ci[1], issuer: ci[2] } : null
  if (SLUG.test(param)) return { form: 'slug', slug: param.toLowerCase() }
  return null
}

/**
 * The canonical `$asset` segment for an asset: its slug when it is in the reference list, else `CODE-ISSUER`
 * when the issuer is known, else the contract id.
 */
export function assetParam(asset: ListedAsset): string {
  const ref = findReferenceAsset(asset.contractId)
  if (ref) return ref.slug
  return asset.issuer ? `${asset.code}-${asset.issuer}` : asset.contractId
}

/** `/markets/bond`, `/markets/BOND-G...` or `/markets/C...`. */
export const assetPath = (asset: ListedAsset): string => `/markets/${assetParam(asset)}`

export type AssetResolution =
  | {
      status: 'found'
      contractId: string
      /** The reference entry when the asset is in the app's list. */
      reference: ReferenceAsset | null
      /** The canonical `$asset` segment. */
      canonical: string
      /** False when the URL used an accepted alias and should be replaced by `canonical`. */
      isCanonical: boolean
    }
  /** Well formed, but not in the reference list or in `listed`. A caller may still look the asset up on chain. */
  | { status: 'unknown'; param: AssetParam }
  | { status: 'invalid' }

/**
 * Resolves a `$asset` segment to a contract id using the reference list and the assets the app already knows
 * (`listed`, for example the contract's supported assets with their issuers).
 */
export function resolveAssetParam(raw: string, network: AssetNetwork, listed: readonly ListedAsset[] = []): AssetResolution {
  const param = parseAssetParam(raw, network)
  if (!param) return { status: 'invalid' }
  const found = (contractId: string, canonical: string, reference: ReferenceAsset | null): AssetResolution => ({
    status: 'found',
    contractId,
    reference,
    canonical,
    isCanonical: raw === canonical,
  })
  if (param.form === 'slug') {
    const ref = findReferenceBySlug(network, param.slug)
    return ref ? found(ref.contractId, ref.slug, ref) : { status: 'unknown', param }
  }
  const onNetwork = (ref: ReferenceAsset | null) => (ref && ref.network === network ? ref : null)
  if (param.form === 'contract') {
    const ref = onNetwork(findReferenceAsset(param.contractId))
    if (ref) return found(ref.contractId, ref.slug, ref)
    const hit = listed.find((a) => a.contractId === param.contractId)
    return hit ? found(hit.contractId, assetParam(hit), null) : { status: 'unknown', param }
  }
  // CODE-ISSUER: an accepted alias of a reference asset, or the canonical form of any other known asset.
  const ref = REFERENCE_ASSETS[network].find((a) => a.code === param.code && a.issuer === param.issuer)
  if (ref) return found(ref.contractId, ref.slug, ref)
  const hit = listed.find((a) => a.code === param.code && a.issuer === param.issuer)
  return hit ? found(hit.contractId, assetParam(hit), null) : { status: 'unknown', param }
}
