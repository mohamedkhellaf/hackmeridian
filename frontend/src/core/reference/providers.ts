// Where a reference price comes from tonight: a table for the mock data, and the faucet rate for the listed
// Testnet assets. Both are fixed figures with an honest label; neither is read from a market.

import { findReferenceAsset, referenceAssets } from '../assets/referenceList'
import { parseAmount } from '../options/format'
import { REFERENCE_LABEL, REFERENCE_NOTE } from './types'
import type { ReferencePrice } from './types'

/** An asset as the providers accept it: a code alone, or a token whose contract id can be checked. */
export type ReferenceSubject = string | { code: string; contractId: string }

/**
 * Demo prices of the mock assets, in USDx per unit, as decimal text. The mock seed prices its offers around
 * these figures (parse with the quote token's decimals, or use `demoPerUnit`).
 */
export const DEMO_PRICES: Readonly<Record<string, string>> = {
  FUND: '10.20',
  BOND: '99.40',
  EQTY: '24.60',
}

/**
 * The Testnet faucet rate, in USDx per unit. The issuers keep standing sell offers on the Stellar Testnet DEX at
 * 100 USDx per XLM and 10 RWA, BOND or EQTY per XLM (README "Try it"), which makes one unit cost 10 USDx.
 */
export const FAUCET_PRICE = '10.00'
export const FAUCET_SOURCE = 'Standing sell offers of the Testnet issuers on the Stellar DEX: 100 USDx per XLM and 10 units of each asset per XLM.'
export const DEMO_SOURCE = 'Mock data.'

const codeOf = (subject: ReferenceSubject): string => (typeof subject === 'string' ? subject : subject.code)

/** No reference price. The interface then offers only the user's own assumed price. */
export function noReference(): ReferencePrice {
  return { kind: 'none', perUnit: null, label: REFERENCE_LABEL.none, note: REFERENCE_NOTE.none, asOf: null }
}

/** The demo price of a mock asset in quote units, or null for a code that has none. */
export function demoPerUnit(assetCode: string, quoteDecimals: number = 7): bigint | null {
  const text = Object.hasOwn(DEMO_PRICES, assetCode) ? DEMO_PRICES[assetCode] : undefined
  return text === undefined ? null : parseAmount(text, quoteDecimals)
}

/**
 * Mock mode: the demo price of FUND, BOND or EQTY; `none` for any other code. Keyed by code because the mock
 * data has no second issuer; a token whose contract id belongs to another network gets `none`.
 */
export function demoReference(asset: ReferenceSubject, quoteDecimals: number = 7): ReferencePrice {
  if (typeof asset !== 'string') {
    const ref = findReferenceAsset(asset.contractId)
    if (ref && ref.network !== 'mock') return noReference()
  }
  const perUnit = demoPerUnit(codeOf(asset), quoteDecimals)
  if (perUnit === null) return noReference()
  return { kind: 'demo', perUnit, label: REFERENCE_LABEL.demo, note: REFERENCE_NOTE.demo, asOf: null, source: DEMO_SOURCE }
}

/**
 * Live mode: the faucet rate (10 USDx per unit) for RWA, BOND and EQTY; `none` for anything else.
 *
 * Pass the token, not just its code, wherever the asset may not be a reference asset: the contract id is then
 * checked against the app's list, so a look-alike `BOND` from another issuer gets no reference price. A bare code
 * is matched against the reference codes and is only correct for an asset already known to be in the list.
 */
export function faucetReference(asset: ReferenceSubject, quoteDecimals: number = 7): ReferencePrice {
  const listed =
    typeof asset === 'string'
      ? referenceAssets('testnet').some((a) => a.code === asset)
      : referenceAssets('testnet').some((a) => a.contractId === asset.contractId)
  const perUnit = listed ? parseAmount(FAUCET_PRICE, quoteDecimals) : null
  if (perUnit === null) return noReference()
  return { kind: 'fixed', perUnit, label: REFERENCE_LABEL.fixed, note: REFERENCE_NOTE.fixed, asOf: null, source: FAUCET_SOURCE }
}

/** The reference for an asset in the current mode: the demo table on the mock client, the faucet rate otherwise. */
export function referenceFor(asset: ReferenceSubject, mode: 'mock' | 'testnet', quoteDecimals: number = 7): ReferencePrice {
  return mode === 'mock' ? demoReference(asset, quoteDecimals) : faucetReference(asset, quoteDecimals)
}
