// Pure mapping between the contracts/pro ABI (lib.rs, spec in proSpec.ts) and the Pro UI model (types.ts).
// No network access. Values are typed as the contract spec decodes them: i128/u64 -> bigint, u32 -> number,
// Option -> value | null | undefined, Map<u32, i128> -> [number, bigint][] (entry pairs), enum Writer -> { tag, values }.
import { PRO_ERRORS } from './errors'
import type { BookView, ClaimResult, ConfigView, OfferView, Party, PositionView, Requirement, SeriesView, ShortView, SnapshotView } from './types'
import { VAULT } from './types'

export type AbiWriter = { tag: 'Account'; values: readonly [string] } | { tag: 'Vault'; values: void }

export interface AbiMarketConfig {
  psr_bps: number
  ext_mult: number
  short_min_bps: number
  im_bps: number
  max_age: bigint
  max_series_oi: bigint
  max_writer_oi: bigint
  bonus_bps: number
  reserve_fee_bps: number
  settle_window: bigint
  exercise_max_age: bigint
}

export interface AbiSeries {
  strike: bigint
  expiry: bigint
  settlement_price: bigint | null | undefined
  oi: bigint
  open_books: number
  shortfall: bigint
  vault_paid: bigint
  pool: bigint
  claimed: bigint
  closed: boolean
}

export interface AbiSnapshot {
  series_id: number
  seq: bigint
  ts: bigint
  spot: bigint
  mark: bigint
  ra: bigint[]
  smin: bigint
  liq: bigint
}

/** Map<u32, i128>: the contract spec decodes it as entry pairs; a Map is accepted too. */
export type AbiShorts = [number, bigint][] | Map<number, bigint>

export interface AbiAccount {
  cash: bigint
  shorts: AbiShorts
  books: number[]
  owed: bigint
}

export interface AbiVault {
  cash: bigint
  shorts: AbiShorts
  reserved: bigint
}

export interface AbiBook {
  series_id: number
  owner: AbiWriter
  qty: bigint
  settled: boolean
  due: bigint
  from_owner: bigint
  shortfall: bigint
  reserve: bigint
}

export interface AbiOffer {
  writer: string
  series_id: number
  qty: bigint
  premium: bigint
  quote_expiry: bigint
  open: boolean
}

export interface AbiPosition {
  series_id: number
  holder: string
  book: number
  qty: bigint
  settled: boolean
  exercised: boolean
  paid: bigint
  deficit: bigint
}

export interface AbiRequirement {
  nlv: bigint
  liability: bigint
  expired: bigint
  scan: bigint
  smin: bigint
  liq: bigint
  mm: bigint
  im: bigint
  worst: number
}

export interface AbiExerciseResult {
  due: bigint
  spot: bigint
}
export interface AbiTakeoverResult {
  x: bigint
  paid: bigint
  deficit: bigint
}
export interface AbiSettleResult {
  due: bigint
  from_owner: bigint
  shortfall: bigint
}
export interface AbiVaultSettleResult {
  shortfall: bigint
  vault_paid: bigint
  deficit: bigint
}
export interface AbiClaimResult {
  due: bigint
  paid: bigint
  deficit: bigint
}

// ---- argument encoding (exact integer units, range-checked before they reach the spec encoder) ----

const I128_MIN = -(1n << 127n)
const I128_MAX = (1n << 127n) - 1n

export function i128(v: bigint): bigint {
  if (typeof v !== 'bigint' || v < I128_MIN || v > I128_MAX) throw new Error('Amount does not fit in i128')
  return v
}

export function u32(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error('Id out of range')
  return n
}

export function u64(n: number | bigint): bigint {
  const b = typeof n === 'bigint' ? n : Number.isInteger(n) ? BigInt(n) : -1n
  if (b < 0n || b > 0xffffffffffffffffn) throw new Error('Timestamp out of range')
  return b
}

/** Party in the UI -> `Writer` argument of get_requirement. */
export function writerArg(p: Party): AbiWriter {
  return p === VAULT ? { tag: 'Vault', values: undefined } : { tag: 'Account', values: [p] as const }
}

export function partyOf(w: AbiWriter): Party {
  return w.tag === 'Vault' ? VAULT : w.values[0]
}

/** Seconds as a JS number (unix time and config windows fit easily). */
export function secs(v: bigint | number): number {
  const b = BigInt(v)
  if (b > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Time out of range')
  return Number(b)
}

// ---- view mapping ----

export function configFromAbi(c: AbiMarketConfig): ConfigView {
  return {
    maxAge: secs(c.max_age),
    exerciseMaxAge: secs(c.exercise_max_age),
    settleWindow: secs(c.settle_window),
    reserveFeeBps: c.reserve_fee_bps,
    bonusBps: c.bonus_bps,
    imBps: c.im_bps,
  }
}

export function snapshotFromAbi(s: AbiSnapshot): SnapshotView {
  return { seriesId: s.series_id, seq: secs(s.seq), ts: secs(s.ts), spot: s.spot, mark: s.mark }
}

export function seriesFromAbi(id: number, s: AbiSeries, snap: AbiSnapshot | null): SeriesView {
  return {
    id,
    strike: s.strike,
    expiry: secs(s.expiry),
    oi: s.oi,
    settlementPrice: s.settlement_price ?? null,
    openBooks: s.open_books,
    shortfall: s.shortfall,
    vaultPaid: s.vault_paid,
    pool: s.pool,
    claimed: s.claimed,
    closed: s.closed,
    snapshot: snap ? snapshotFromAbi(snap) : null,
    // No view returns it: same definition as the fixture model (types.ts), shortfall - vault_paid once closed.
    deficit: s.closed ? s.shortfall - s.vault_paid : null,
  }
}

/**
 * `Offer` only has `open: bool`: a closed offer cannot be told apart as bought or cancelled from the view, so the
 * client keeps open offers only (the UI lists open offers only).
 */
export function offerFromAbi(id: number, o: AbiOffer): OfferView {
  return {
    id,
    writer: o.writer,
    seriesId: o.series_id,
    qty: o.qty,
    premium: o.premium,
    quoteExpiry: secs(o.quote_expiry),
    status: o.open ? 'open' : 'cancelled',
    buyer: null,
  }
}

export function bookFromAbi(id: number, b: AbiBook): BookView {
  return {
    id,
    seriesId: b.series_id,
    owner: partyOf(b.owner),
    qty: b.qty,
    settled: b.settled,
    due: b.due,
    fromOwner: b.from_owner,
    shortfall: b.shortfall,
    reserve: b.reserve,
  }
}

/**
 * `claim` is the only call that settles a position without exercising it, and it stores paid and
 * deficit = due - paid (lib.rs `claim`), so a settled, unexercised position carries its claim result.
 */
export function positionFromAbi(id: number, p: AbiPosition, bookOwner: Party | null): PositionView {
  const claim: ClaimResult | null = p.settled && !p.exercised ? { due: p.paid + p.deficit, paid: p.paid, deficit: p.deficit } : null
  return {
    id,
    seriesId: p.series_id,
    holder: p.holder,
    book: p.book,
    bookOwner,
    qty: p.qty,
    settled: p.settled,
    exercised: p.exercised,
    paid: p.paid,
    deficit: p.deficit,
    claim,
  }
}

export function shortsFromAbi(m: AbiShorts | undefined): ShortView[] {
  const entries: [number, bigint][] = m instanceof Map ? [...m.entries()] : (m ?? [])
  return entries
    .filter(([, q]) => q > 0n)
    .map(([seriesId, qty]) => ({ seriesId: Number(seriesId), qty: BigInt(qty) }))
    .sort((a, b) => a.seriesId - b.seriesId)
}

export function requirementFromAbi(r: AbiRequirement): Requirement {
  return { nlv: r.nlv, liability: r.liability, expired: r.expired, scan: r.scan, smin: r.smin, liq: r.liq, mm: r.mm, im: r.im, worst: r.worst }
}

// ---- errors ----

/**
 * First Pro error code (201..226) in a Soroban failure text ("Error(Contract, #209)"), or null. Codes of other
 * contracts in the same text (the USDx SAC: #1..#13) are skipped, so a SAC failure falls through to describeError.
 */
export function proCodeOf(text: string): number | null {
  for (const m of text.matchAll(/Error\(Contract,\s*#(\d+)\)/g)) {
    const code = Number(m[1])
    if (PRO_ERRORS[code]) return code
  }
  return null
}
