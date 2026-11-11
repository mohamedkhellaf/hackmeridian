// Shared transaction types. Framework-free: the data layer binds them to React, the ui kit only renders them.

/**
 * A step a write reports while it runs, through the optional `{ onStage }` argument of every client write.
 *   checking    the call is being simulated (and pre-checked); nothing was sent
 *   signing     waiting for the wallet; nothing was sent
 *   submitting  signed, being sent to the network
 *   pending     accepted by the network; the hash is known; waiting for a ledger to include it
 * A write then resolves (confirmed) or rejects with a `TxError` (core/tx/errors.ts).
 */
export type TxStage =
  | { stage: 'checking' }
  | { stage: 'signing' }
  | { stage: 'submitting' }
  | {
      stage: 'pending'
      hash: string
      /** Unix seconds after which the signed transaction can no longer be included (its time bound). */
      maxTime: number | null
    }

export type TxStageName = TxStage['stage']

/** Optional last argument of every client write. */
export interface TxOptions {
  onStage?: (stage: TxStage) => void
}

/** What a confirmed write resolves with. `ledger` is the ledger that included it, when the client knows it. */
export interface TxReceipt {
  hash: string
  ledger?: number | null
}

/** Outcome of `runTx`: decided by the transaction alone, never by the reads that follow it. */
export type TxOutcome = { ok: true; hash: string; mock: boolean } | { ok: false; error: string }

/** Result of a transaction as a one-line notice. */
export type Notice = { kind: 'ok'; text: string; hash: string; mock: boolean } | { kind: 'err'; text: string }

/**
 * Answer of a later look at a transaction whose outcome was unknown (`OptionsClient.checkTx`):
 *   confirmed  included and successful
 *   failed     included, the contract refused it, the network fee was charged
 *   expired    not included, and a ledger has closed after its time bound: it can never be included
 *   unknown    not included yet and still within its time bound (or the RPC could not answer)
 */
export type TxCheck =
  | { status: 'confirmed'; ledger: number | null }
  | { status: 'failed'; message: string }
  | { status: 'expired' }
  | { status: 'unknown' }
