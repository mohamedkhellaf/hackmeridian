// Where a Margin position stands in its lifecycle, and which call moves it on. Pure: the screen only renders it.
//
//   live          before expiry: the holder may exercise early (the contract may refuse, see errors.ts)
//   exercised     exercised early: paid, nothing left to do
//   await-price   expired, the publisher has not published the settlement price yet: nobody can act
//   settle        price published: anyone calls settle(book) for the writer's book
//   settle-vault  the book is settled: anyone calls settle_vault(series) once every book of the series is
//   claim         the series is closed: the holder calls claim(position)
//   claimed       claimed: what was paid and any deficit are final
import type { BookView, PositionView, SeriesView } from './types'
import { VAULT } from './types'

export type Phase = 'live' | 'exercised' | 'await-price' | 'settle' | 'settle-vault' | 'claim' | 'claimed'

/** `now` is the contract clock in unix seconds (`ProModel.now`), not the wall clock. */
export function phaseOf(p: PositionView, s: SeriesView | undefined, b: BookView | undefined, now: number): Phase {
  if (p.claim) return 'claimed'
  if (p.exercised) return 'exercised'
  if (!s || now < s.expiry) return 'live'
  if (s.settlementPrice == null) return 'await-price'
  if (s.closed) return 'claim'
  return b?.settled ? 'settle-vault' : 'settle'
}

/** State word per phase; `warn` when the position waits for an action. */
export const PHASE_STATE: Record<Phase, { label: string; warn: boolean }> = {
  live: { label: 'Open', warn: false },
  exercised: { label: 'Exercised', warn: false },
  'await-price': { label: 'Expired', warn: false },
  settle: { label: 'Expired', warn: true },
  'settle-vault': { label: 'Book settled', warn: true },
  claim: { label: 'Settled', warn: true },
  claimed: { label: 'Claimed', warn: false },
}

/** The client call that moves a position out of its phase, with the button label and the confirmation word. */
export type PhaseActionKind = 'exercise' | 'settle' | 'settle-vault' | 'claim'

export interface PhaseAction {
  kind: PhaseActionKind
  /** Button label. */
  label: string
  /** Label of the call in the result banner and the activity list. */
  runLabel: string
  /** Shown once the call went through. */
  done: string
  /** Only the holder can make this call (exercise and claim); the settle calls are open to anyone. */
  holderOnly: boolean
}

export const PHASE_ACTION: Partial<Record<Phase, PhaseAction>> = {
  live: { kind: 'exercise', label: 'Exercise early', runLabel: 'Early exercise', done: 'Exercised', holderOnly: true },
  settle: { kind: 'settle', label: 'Settle book', runLabel: 'Settle book', done: 'Book settled', holderOnly: false },
  'settle-vault': { kind: 'settle-vault', label: 'Settle series', runLabel: 'Settle series', done: 'Series settled', holderOnly: false },
  claim: { kind: 'claim', label: 'Claim', runLabel: 'Claim', done: 'Claimed', holderOnly: true },
}

/** Note for a phase where nobody can act. */
export const PHASE_WAITING: Partial<Record<Phase, string>> = {
  'await-price': 'Waiting for settlement price',
}

/** Everything a positions row shows, derived once. */
export interface PositionRow {
  position: PositionView
  series: SeriesView | undefined
  book: BookView | undefined
  phase: Phase
  state: { label: string; warn: boolean }
  action: PhaseAction | null
  /** "Waiting for settlement price" when nobody can act. */
  waiting: string | null
  /** A live position on a vault-owned book cannot be exercised early: it settles at expiry. */
  settlesAtExpiry: boolean
  /** Paid so far: the claim result once claimed, else the early-exercise payment; null while nothing was paid. */
  paid: bigint | null
  /** Deficit (the cut on the holder's payout), same rule as `paid`. */
  deficit: bigint | null
  /** What the position was due, known once claimed. */
  due: bigint | null
}

export function positionRow(p: PositionView, series: SeriesView[], books: BookView[], now: number): PositionRow {
  const s = series.find((x) => x.id === p.seriesId)
  const b = books.find((x) => x.id === p.book)
  const phase = phaseOf(p, s, b, now)
  return {
    position: p,
    series: s,
    book: b,
    phase,
    state: PHASE_STATE[phase],
    action: PHASE_ACTION[phase] ?? null,
    waiting: PHASE_WAITING[phase] ?? null,
    settlesAtExpiry: p.bookOwner === VAULT && phase === 'live',
    paid: p.claim?.paid ?? (p.exercised ? p.paid : null),
    deficit: p.claim?.deficit ?? (p.exercised ? p.deficit : null),
    due: p.claim?.due ?? null,
  }
}

/** Rows for every position of the model, in the model's order. */
export function positionRows(model: { positions: PositionView[]; series: SeriesView[]; books: BookView[]; now: number }): PositionRow[] {
  return model.positions.map((p) => positionRow(p, model.series, model.books, model.now))
}
