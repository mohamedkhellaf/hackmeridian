// Adapter between Margin calls and the shared transaction machine (core/tx/machine.ts). A Margin write resolves
// with a CallResult, where a refusal is a value; the machine wants a write that resolves with a receipt and
// rejects with a TxError. `proReceipt` converts one into the other, so Covered and Margin run through the same
// states:
//
//   runMachine((opts) => proReceipt(client.exercise(holder, positionId, opts)), emit)
import { TxError } from '../tx/errors'
import type { TxErrorKind } from '../tx/errors'
import { proErrorMessage } from './errors'
import type { CallResult } from './types'

export interface ProReceipt<T> {
  /** Empty on fixtures: a replayed step sends nothing. */
  hash: string
  ledger: null
  value: T
  /** Fixtures: which scripted step was replayed. */
  note: string | null
}

/** A Margin call that did not go through. `code` and `refusal` are set for a contract refusal (201 to 226). */
export class ProTxError extends TxError {
  /** Contract error code, or null when the failure is not a contract refusal (wallet, network, no scripted step). */
  readonly code: number | null
  /** Contract error name (`LiquidateFirst`), for the `Name (code)` form the Margin screens show. */
  readonly refusal: string | null
  /** Fixtures: which scripted step was replayed. */
  readonly note: string | null

  constructor(kind: TxErrorKind, message: string, info: { code: number | null; refusal: string | null; note: string | null; hash?: string | null }) {
    super(kind, message, { hash: info.hash })
    this.name = 'ProTxError'
    this.code = info.code
    this.refusal = info.refusal
    this.note = info.note
  }
}

/** The sentence for a failed Margin call, the same mapping the result banner has always used. */
export function proFailureText(r: Extract<CallResult<unknown>, { ok: false }>): string {
  if (r.code === 0) return 'Not available in this simulation.'
  if (r.code < 0) return r.note ?? 'The transaction failed.'
  return proErrorMessage(r.code)
}

/** Resolves with a receipt for an ok result; rejects with a `ProTxError` otherwise. */
export async function proReceipt<T>(call: Promise<CallResult<T>>): Promise<ProReceipt<T>> {
  const r = await call
  if (r.ok) return { hash: r.hash ?? '', ledger: null, value: r.value, note: r.note ?? null }
  const contract = r.code > 0
  throw new ProTxError(r.kind ?? 'refused', proFailureText(r), {
    code: contract ? r.code : null,
    refusal: contract ? r.name : null,
    note: r.code < 0 ? null : (r.note ?? null),
    hash: r.hash,
  })
}
