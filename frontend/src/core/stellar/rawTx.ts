// The few SDK objects a hand-built transaction needs, for code outside this folder that assembles one (the
// issuer console's sender). Static SDK import: reach this module only from a lazily loaded chunk.
import { Account, Asset, Horizon, TransactionBuilder } from '@stellar/stellar-sdk'
import type { Transaction } from '@stellar/stellar-sdk'
import { config } from '../config'

export type { Account, Asset, Transaction }

/** The source account of a transaction about to be built, at its current sequence number. */
export const sourceAccount = (address: string, sequence: string): Account => new Account(address, sequence)

/** A classic asset by code and issuer. */
export const classicAsset = (code: string, issuer: string): Asset => new Asset(code, issuer)

/** A signed transaction as the wallet returned it. Throws when the text is not a transaction of this network. */
export const transactionFromXdr = (xdr: string, passphrase: string): Transaction => TransactionBuilder.fromXDR(xdr, passphrase) as Transaction

/** The hash of a transaction, in hex. */
export const transactionHash = (tx: Transaction): string => Array.from(tx.hash(), (b) => b.toString(16).padStart(2, '0')).join('')

/** Unix seconds after which the transaction can no longer be included, or null when it has no upper time bound. */
export function maxTimeOf(tx: Transaction): number | null {
  const n = Number(tx.timeBounds?.maxTime)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Submits a classic transaction to Horizon. Resolves once a ledger included it; rejects with Horizon's own error
 * otherwise (its result codes say whether a fee was charged).
 */
export async function submitToHorizon(signed: Transaction): Promise<{ hash?: string; ledger: number | null }> {
  const horizon = new Horizon.Server(config.horizonUrl)
  // The memo check looks up payment destinations; a transaction without a payment has none.
  const r = await horizon.submitTransaction(signed, { skipMemoRequiredCheck: true })
  return { hash: r.hash, ledger: typeof r.ledger === 'number' ? r.ledger : null }
}
