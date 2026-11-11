// Which cached reads a transaction makes stale. Pure: a list of key prefixes per action, so the mapping can be
// read and tested without a cache.
//
// A confirmed write invalidates exactly what the contract call changes. Nothing is patched by hand in the cache
// (no optimistic update): the screen shows "pending" until the chain answers, then the fresh read.
// Never invalidated by a trade: the asset list, issuer eligibility, the ledger, issuer facts.
import type { Keys } from '../keys'

export type CoveredAction =
  | 'write-offer'
  | 'buy'
  | 'exercise'
  | 'claim-delivery'
  | 'reclaim'
  | 'cancel-offer'
  | 'list-for-sale'
  | 'cancel-sale'
  | 'buy-resale'
  | 'create-bid'
  | 'cancel-bid'
  | 'fill-bid'

export const COVERED_ACTIONS: readonly CoveredAction[] = [
  'write-offer',
  'buy',
  'exercise',
  'claim-delivery',
  'reclaim',
  'cancel-offer',
  'list-for-sale',
  'cancel-sale',
  'buy-resale',
  'create-bid',
  'cancel-bid',
  'fill-bid',
]

export interface InvalidationSubject {
  optionId?: bigint | null
  bidId?: bigint | null
}

type Key = readonly unknown[]

/** The subject of a transaction as it is written in Activity: `option:12`, `bid:3`. */
export const optionSubject = (id: bigint): string => `option:${id}`
export const bidSubject = (id: bigint): string => `bid:${id}`

// ---- Issuer actions ------------------------------------------------------------------------------------------
// The issuer console sends raw transactions (trustline flags, clawback) through the same staged layer. They are
// recorded as Covered entries under these action names. None is in the table below, so each one refreshes every
// Covered read and the trustline reads: reserves and balances move after a freeze or a clawback.

export type IssuerActionKind = 'authorize' | 'freeze' | 'clawback'
const ISSUER_ACTION_PREFIX = 'issuer-'

/** The machine name recorded with an issuer transaction: `issuer-freeze`. */
export const issuerActionName = (kind: IssuerActionKind): string => `${ISSUER_ACTION_PREFIX}${kind}`

/** True for an Activity entry made by the issuer console, so a list can name or link it apart from trades. */
export const isIssuerAction = (action: string): boolean => action.startsWith(ISSUER_ACTION_PREFIX)

/** What an issuer transaction acts on, as recorded with it: `issuer:<asset contract>:<target>`. */
export const issuerSubject = (assetId: string, target: string): string => `issuer:${assetId}:${target}`

export function parseIssuerSubject(subject: string | null | undefined): { assetId: string; target: string } | null {
  const m = /^issuer:([^:]+):([^:]+)$/.exec(subject ?? '')
  return m ? { assetId: m[1], target: m[2] } : null
}

/** The ids named by a subject string. Anything else (null, a Margin subject) names none. */
export function subjectIds(subject: string | null | undefined): InvalidationSubject {
  const m = /^(option|bid):(\d+)$/.exec(subject ?? '')
  if (!m) return {}
  return m[1] === 'option' ? { optionId: BigInt(m[2]) } : { bidId: BigInt(m[2]) }
}

/**
 * Key prefixes to invalidate after `action` settled on chain. An action this table does not know (an issuer
 * action sent through `useTx`, for instance) invalidates every Covered read and every trustline read, since it
 * may have changed who is authorized.
 */
export function keysToInvalidate(k: Keys, action: string, subject: InvalidationSubject = {}): Key[] {
  const option: Key[] = subject.optionId != null ? [k.option(subject.optionId)] : [k.optionAll()]
  const ask: Key[] = subject.optionId != null ? [k.ask(subject.optionId)] : [k.askAll()]
  const bid: Key[] = subject.bidId != null ? [k.bid(subject.bidId)] : [k.bidAll()]
  // Collateral split and reserved-against-held move together.
  const reserves: Key[] = [k.collateral(), k.health()]
  const balances: Key[] = [k.balances()]
  switch (action as CoveredAction) {
    case 'write-offer':
      return [k.options(), ...reserves, ...balances, k.writerOpenCountAll()]
    case 'buy':
      return [k.options(), ...option, ...reserves, ...balances, k.writerOpenCountAll()]
    case 'exercise':
      // An exercised option that was listed for sale is no longer for sale.
      return [k.options(), ...option, k.asks(), ...ask, ...reserves, ...balances]
    case 'claim-delivery':
    case 'reclaim':
      return [k.options(), ...option, ...reserves, ...balances]
    case 'cancel-offer':
      return [k.options(), ...option, ...reserves, ...balances, k.writerOpenCountAll()]
    case 'list-for-sale':
    case 'cancel-sale':
      return [k.asks(), ...ask]
    case 'buy-resale':
      return [k.options(), ...option, k.asks(), ...ask, ...balances]
    case 'create-bid':
      return [k.bids(), ...reserves, ...balances, k.buyerOpenCountAll()]
    case 'cancel-bid':
      return [k.bids(), ...bid, ...reserves, ...balances, k.buyerOpenCountAll()]
    case 'fill-bid':
      // Filling creates an option that is already active, with the buyer as holder.
      return [k.bids(), ...bid, k.options(), ...reserves, ...balances, k.buyerOpenCountAll()]
    default:
      return [k.root(), k.holderStatusAll()]
  }
}

/** A Margin call moves USDx in or out of the wallet: only the balances shown by the Covered side go stale. */
export function keysAfterMargin(k: Keys): Key[] {
  return [k.balances()]
}
