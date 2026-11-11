// The typed failure every client write rejects with. `kind` says where the transaction stopped, which is what
// decides the copy: nothing was sent, the outcome is not known, or the network fee was charged.

export type TxErrorKind =
  /** The wallet user rejected the request. Nothing was sent. Not an error: one neutral line. */
  | 'declined'
  /** Refused before sending: a pre-check, the simulation, the wallet or the network rejected it. Nothing was sent. */
  | 'refused'
  /** Included in a ledger and failed there. The network fee was charged. */
  | 'failed'
  /** Sent (or possibly sent) and not found yet, still within its time bound. It can still go through. */
  | 'unknown'
  /** Not included and a ledger has closed after its time bound. It can never be included. Nothing was charged. */
  | 'expired'

export class TxError extends Error {
  readonly kind: TxErrorKind
  /** Known from `submitting` on (the hash of the signed transaction). */
  readonly hash: string | null
  /** Unix seconds of the transaction's time bound, when known. */
  readonly maxTime: number | null

  constructor(kind: TxErrorKind, message: string, info: { hash?: string | null; maxTime?: number | null; cause?: unknown } = {}) {
    super(message, info.cause === undefined ? undefined : { cause: info.cause })
    this.name = 'TxError'
    this.kind = kind
    this.hash = info.hash ?? null
    this.maxTime = info.maxTime ?? null
  }
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'string' ? e : String(e))

/**
 * True when a failure raised while signing is the user saying no. Wallets word it as rejected, denied, declined,
 * cancelled, closed or dismissed. Only meaningful for errors from the signing step.
 */
export function isWalletRejection(e: unknown): boolean {
  if (e instanceof Error && e.name === 'UserRejectedError') return true
  return /reject|denied|declin|cancel|closed|dismiss/i.test(errorMessage(e))
}
