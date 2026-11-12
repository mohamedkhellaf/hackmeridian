// The app's reference asset list: plain data, no network access, no SDK.
//
// Anyone can list an asset in the options contract. This list decides what the app shows first; it gives nobody
// power over the contract, and an asset that is not in it still opens by URL and can be traded.
//
// Identity is the asset contract id (`C...`). `code` is a display label and is never a key: two assets can share
// a code. Every asset here is fictional (the label says what kind of instrument it imitates, it is not a claim on
// one). Testnet ids are the ones in AGENTS.md "Deployed contracts"; referenceList.test.ts derives each contract id
// from its code and issuer to make sure the table is consistent.

export type AssetNetwork = 'mock' | 'testnet'

export type AssetType = 'fund' | 'bond' | 'equity'

/** Type label shown beside the code. */
export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  fund: 'Fund share',
  bond: 'Bond',
  equity: 'Equity',
}

export interface ReferenceAsset {
  network: AssetNetwork
  /** Display code, for example `BOND`. Not unique. */
  code: string
  /** URL slug, lower case, unique within a network: `/markets/bond`. Only assets in this list have one. */
  slug: string
  type: AssetType
  /** `ASSET_TYPE_LABEL[type]`, repeated here so a row needs one lookup. */
  typeLabel: string
  /** Issuer account (`G...`). */
  issuer: string
  /** Asset contract id (`C...`): the key in state, queries and lists. */
  contractId: string
  decimals: number
}

export interface QuoteAsset {
  network: AssetNetwork
  code: string
  issuer: string
  contractId: string
  decimals: number
}

const entry = (network: AssetNetwork, code: string, type: AssetType, issuer: string, contractId: string): ReferenceAsset => ({
  network,
  code,
  slug: code.toLowerCase(),
  type,
  typeLabel: ASSET_TYPE_LABEL[type],
  issuer,
  contractId,
  decimals: 7,
})

/** Placeholder issuer of the mock assets. Not a real key: mock ids never reach the network or an explorer. */
export const MOCK_ISSUER = 'GMOCKISSUER'.padEnd(56, 'A')
export const MOCK_QUOTE_ISSUER = 'GMOCKUSDXISSUER'.padEnd(56, 'A')

const TESTNET_ISSUER = 'GCNWQR5OA24X7LPTCXUEL4V4ZLSIFKUNIEZEO3UVCVXECPPGX7ERFDGM'

/** In list order. The first entry is the default asset of its network. */
export const REFERENCE_ASSETS: Record<AssetNetwork, readonly ReferenceAsset[]> = {
  mock: [
    entry('mock', 'RWA', 'fund', MOCK_ISSUER, 'C_MOCK_RWA'),
    entry('mock', 'BOND', 'bond', MOCK_ISSUER, 'C_MOCK_BOND'),
    entry('mock', 'EQTY', 'equity', MOCK_ISSUER, 'C_MOCK_EQTY'),
  ],
  testnet: [
    entry('testnet', 'RWA', 'fund', TESTNET_ISSUER, 'CCVYWYG56YL7VA7A3EKVJKAKZC4O2B6YXV6UJMERG2NYC7HJHELJLR7U'),
    entry('testnet', 'BOND', 'bond', TESTNET_ISSUER, 'CADCBCQ7TU5XCGPYDD32HANAVEWWDARGKIKXWF5YK7NTFOLAWGQYQGHP'),
    entry('testnet', 'EQTY', 'equity', TESTNET_ISSUER, 'CDBHRGVHB2NVKJCM5ZKBTUQ3RQHZUZJSSEZLATIUROWXNIEFZ7T7NIFU'),
  ],
}

/** The quote token of each network (USDx, fictional). */
export const QUOTE_ASSETS: Record<AssetNetwork, QuoteAsset> = {
  mock: { network: 'mock', code: 'USDx', issuer: MOCK_QUOTE_ISSUER, contractId: 'C_MOCK_USDX', decimals: 7 },
  testnet: {
    network: 'testnet',
    code: 'USDx',
    issuer: 'GAE6ONGU5S3JHDBR5Z3BUVXCL4WLEHQVLBDNTCKHKOYFBYBPBW4IARFS',
    contractId: 'CAKXMQVKSW2AEKF5DSMDPHJAYGNVOQANHXLI64QJS2H3GOCXRW2GCICU',
    decimals: 7,
  },
}

/** The reference assets of a network, in list order. */
export const referenceAssets = (network: AssetNetwork): readonly ReferenceAsset[] => REFERENCE_ASSETS[network]

/** The first list entry: the asset a network opens on. Never "the busiest", which anyone could inflate. */
export const defaultReferenceAsset = (network: AssetNetwork): ReferenceAsset => REFERENCE_ASSETS[network][0]

const ALL: readonly ReferenceAsset[] = [...REFERENCE_ASSETS.mock, ...REFERENCE_ASSETS.testnet]

/** The reference entry for a contract id, on whichever network it belongs to. Null for any other asset. */
export function findReferenceAsset(contractId: string): ReferenceAsset | null {
  return ALL.find((a) => a.contractId === contractId) ?? null
}

/** The reference entry for a slug on a network. Slugs are matched in lower case. */
export function findReferenceBySlug(network: AssetNetwork, slug: string): ReferenceAsset | null {
  const s = slug.toLowerCase()
  return REFERENCE_ASSETS[network].find((a) => a.slug === s) ?? null
}

export const isReferenceAsset = (contractId: string): boolean => findReferenceAsset(contractId) !== null
