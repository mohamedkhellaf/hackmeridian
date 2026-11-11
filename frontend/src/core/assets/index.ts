// The reference asset list, tiers, asset URLs and the similar-code flag (brief D20). Plain data and pure functions.
export {
  ASSET_TYPE_LABEL,
  REFERENCE_ASSETS,
  QUOTE_ASSETS,
  MOCK_ISSUER,
  MOCK_QUOTE_ISSUER,
  referenceAssets,
  defaultReferenceAsset,
  findReferenceAsset,
  findReferenceBySlug,
  isReferenceAsset,
} from './referenceList'
export type { AssetNetwork, AssetType, ReferenceAsset, QuoteAsset } from './referenceList'
export { ASSET_TIERS, TIER_MEANING, assetKey, tierOf, parseAssetParam, assetParam, assetPath, resolveAssetParam } from './identity'
export type { AssetTier, ListedAsset, AssetParam, AssetResolution } from './identity'
export { skeleton, codeResemblance, similarCodeFlag } from './similarCode'
export type { CodeResemblance, SimilarCodeFlag } from './similarCode'
export { isAccountId, isContractId } from './strkey'
