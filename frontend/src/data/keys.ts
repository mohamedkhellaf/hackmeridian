// Query keys. One factory, so every key is greppable and every invalidation is a prefix of something listed here.
//
// Rules:
//   - a key never holds a `bigint`: TanStack Query hashes keys with JSON.stringify, which throws on one. Ids go
//     through `idKey` (decimal text);
//   - every Covered key starts with ['covered', <contract id>] so a build pointed at another contract (or at the
//     mock) can never read a cached answer of the previous one;
//   - keys are hierarchical: `keys.balances()` is a prefix of `keys.balancesOf(address)`, which is a prefix of
//     the key of one token set, so an invalidation can be as wide or as narrow as the transaction needs.
import { config } from '../core/config'

/** The scope word used in keys when the build has no contract id (the in-memory mock). */
export const MOCK_SCOPE = 'mock'

/** A bigint or numeric id as it appears in a key. */
export const idKey = (id: bigint | number | string): string => (typeof id === 'string' ? id : id.toString())

/** Token contract ids as one stable key part: sorted, without duplicates. `all` means "the contract's default set". */
export function tokensKey(tokens: readonly { contractId: string }[] | readonly string[] | undefined): string {
  if (!tokens) return 'all'
  const ids = tokens.map((t) => (typeof t === 'string' ? t : t.contractId))
  return [...new Set(ids)].sort().join(',')
}

export function makeKeys(contractId: string | undefined | null) {
  const root = ['covered', contractId || MOCK_SCOPE] as const
  return {
    /** Everything read from the Covered contract. */
    root: () => root,
    assets: () => [...root, 'assets'] as const,
    options: () => [...root, 'options'] as const,
    /** Prefix of every single-option read. */
    optionAll: () => [...root, 'option'] as const,
    option: (id: bigint | number | string) => [...root, 'option', idKey(id)] as const,
    asks: () => [...root, 'asks'] as const,
    askAll: () => [...root, 'ask'] as const,
    ask: (id: bigint | number | string) => [...root, 'ask', idKey(id)] as const,
    bids: () => [...root, 'bids'] as const,
    bidAll: () => [...root, 'bid'] as const,
    bid: (id: bigint | number | string) => [...root, 'bid', idKey(id)] as const,
    collateral: () => [...root, 'collateral'] as const,
    health: () => [...root, 'health'] as const,
    /** Prefix of every balance read, of any address. */
    balances: () => [...root, 'balances'] as const,
    /** Prefix of every balance read of one address. */
    balancesOf: (address: string) => [...root, 'balances', address] as const,
    balancesFor: (address: string, tokens?: readonly { contractId: string }[] | readonly string[]) => [...root, 'balances', address, tokensKey(tokens)] as const,
    eligibilityAll: () => [...root, 'eligible'] as const,
    eligibility: (token: string, address: string) => [...root, 'eligible', token, address] as const,
    writerOpenCountAll: () => [...root, 'writer-open'] as const,
    writerOpenCount: (address: string) => [...root, 'writer-open', address] as const,
    buyerOpenCountAll: () => [...root, 'buyer-open'] as const,
    buyerOpenCount: (address: string) => [...root, 'buyer-open', address] as const,
    /** Not a contract read: the network's latest ledger. */
    ledger: () => ['ledger', config.rpcUrl] as const,
    /** Not a contract read: issuer account and asset record from Horizon. */
    assetFacts: (tokenContractId: string) => ['asset-facts', tokenContractId] as const,
    holderStatus: (code: string, issuer: string, address: string) => ['holder-status', code, issuer, address] as const,
  }
}

export type Keys = ReturnType<typeof makeKeys>

/** The keys of this build's Covered contract. */
export const keys: Keys = makeKeys(config.optionsContractId)
