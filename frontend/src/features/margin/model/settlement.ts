// What a series paid at settlement, read from the contract views: the books' `due` and `from_owner`, and the
// series' `vault_paid` and deficit. Sums of recorded amounts only; the split itself is the contract's.
import type { BookView, HistoryEntry, ProModel, SeriesView } from '../../../core/pro/types'

export interface SeriesSettlement {
  series: SeriesView
  /** Settled books of the series. */
  books: BookView[]
  /** Owed to holders across the settled books. */
  due: bigint
  /** Paid from the book owners' margin (a vault-owned book pays from its reserved takeover payment). */
  fromOwners: bigint
  /** Paid by the vault once the series is closed. */
  vaultPaid: bigint
  /** Left unpaid, known once the series is closed. */
  deficit: bigint | null
}

/** One entry per series that has at least one settled book, in series order. */
export function seriesSettlements(model: Pick<ProModel, 'series' | 'books'>): SeriesSettlement[] {
  const out: SeriesSettlement[] = []
  for (const series of model.series) {
    const books = model.books.filter((b) => b.seriesId === series.id && b.settled)
    if (books.length === 0) continue
    out.push({
      series,
      books,
      due: books.reduce((t, b) => t + b.due, 0n),
      fromOwners: books.reduce((t, b) => t + b.fromOwner, 0n),
      vaultPaid: series.vaultPaid,
      deficit: series.deficit,
    })
  }
  return out
}

export type VaultSeriesState = 'Open' | 'Settling' | 'Closed'

/** The vault's view of a series: open until a settlement price exists, closed once the vault has settled it. */
export function vaultSeriesState(s: SeriesView): VaultSeriesState {
  return s.closed ? 'Closed' : s.settlementPrice != null ? 'Settling' : 'Open'
}

export interface Takeover {
  /** Position in the call history (the replay step, or the order of calls made from this browser). */
  index: number
  writer: string
  taker: string
  ok: boolean
  /** Takeover price, what the writer paid of it, and the shortfall that became its debt. Null when refused. */
  price: bigint | null
  paid: bigint | null
  deficit: bigint | null
  /** Contract error code of a refusal. */
  code: number | null
}

/** Every `liquidate` call of the history, oldest first. */
export function takeovers(history: readonly HistoryEntry[]): Takeover[] {
  return history
    .filter((h) => h.op === 'liquidate')
    .map((h) => ({
      index: h.index,
      writer: String(h.args[1] ?? ''),
      taker: String(h.args[2] ?? ''),
      ok: h.ok,
      price: h.ok && h.result ? (h.result.x ?? null) : null,
      paid: h.ok && h.result ? (h.result.paid ?? null) : null,
      deficit: h.ok && h.result ? (h.result.deficit ?? null) : null,
      code: h.ok ? null : h.code,
    }))
}
