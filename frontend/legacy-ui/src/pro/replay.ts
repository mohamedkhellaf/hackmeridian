// Pure replay of packages/risk/fixtures/pro_v0.json: derives what the UI shows after `cursor` steps.
// No margin maths: every number is read from a fixture step (state or result), only re-typed as bigint.
import type {
  AccountView,
  BookView,
  ClaimResult,
  ConfigView,
  HistoryEntry,
  OfferView,
  OfferParams,
  PositionView,
  ProModel,
  Requirement,
  SeriesView,
  ShortView,
  SnapshotView,
} from './types'
import { VAULT } from './types'

export interface RawStep {
  op: string
  args: unknown[]
  expect: 'ok' | { error: string; code: number }
  result?: unknown
  state?: RawState
}

interface RawAccount {
  cash: number
  shorts: Record<string, number>
  books: number[]
  owed: number
  reserved: number
}

export interface RawState {
  now: number
  accounts: Record<string, RawAccount>
  wallets: Record<string, number>
  series: Record<
    string,
    { oi: number; settlement_price: number | null; open_books: number; shortfall: number; vault_paid: number; pool: number; claimed: number; closed: boolean }
  >
  books: Record<string, { series_id: number; owner: string; qty: number; settled: boolean; due: number; from_owner: number; shortfall: number; reserve: number }>
  positions: Record<string, { holder: string; book: number; qty: number; settled: boolean; exercised: boolean; paid: number; deficit: number }>
  lp_shares: Record<string, number>
  total_shares: number
}

export interface RawScenario {
  name: string
  description: string
  t0: number
  config: Record<string, number>
  initial_wallets: Record<string, number>
  steps: RawStep[]
}

export interface RawFixtureFile {
  version: string
  errors: Record<string, number>
  scenario_order: string
  scenarios: RawScenario[]
}

const big = (n: number | undefined | null) => BigInt(n ?? 0)

const isOk = (s: RawStep) => s.expect === 'ok'
const codeOf = (s: RawStep): number | null => (s.expect === 'ok' ? null : s.expect.code)

function requirementFrom(r: unknown): Requirement {
  const o = r as Record<string, number>
  return {
    nlv: big(o.nlv),
    liability: big(o.liability),
    expired: big(o.expired),
    scan: big(o.scan),
    smin: big(o.smin),
    liq: big(o.liq),
    mm: big(o.mm),
    im: big(o.im),
    worst: o.worst,
  }
}

function emptyState(sc: RawScenario): RawState {
  return { now: sc.t0, accounts: {}, wallets: { ...sc.initial_wallets }, series: {}, books: {}, positions: {}, lp_shares: {}, total_shares: 0 }
}

/** Steps that cannot change what a margin figure depends on. */
const READ_ONLY = new Set(['get_requirement'])

/**
 * get_requirement(who) is only shown while it is still current: the latest get_requirement step for `who`
 * before `cursor`, with no successful state-changing step (including set_time and publish_risk) after it.
 */
export function currentRequirement(sc: RawScenario, cursor: number, who: string): Requirement | null {
  for (let i = cursor - 1; i >= 0; i--) {
    const s = sc.steps[i]
    if (s.op === 'get_requirement' && isOk(s) && s.args[0] === who) return requirementFrom(s.result)
    if (isOk(s) && !READ_ONLY.has(s.op)) return null
  }
  return null
}

/**
 * The IM-after-fill preview: a scripted order by the same writer on the same series and quantity, followed by its
 * buy and, right after it, a get_requirement of the writer. Searched from the cursor on.
 */
export function requirementAfterFill(sc: RawScenario, cursor: number, p: OfferParams): Requirement | null {
  const offerWriter = new Map<number, { writer: string; series: number; qty: number }>()
  for (let i = 0; i < sc.steps.length; i++) {
    const s = sc.steps[i]
    if (s.op === 'create_offer' && isOk(s)) {
      offerWriter.set(s.result as number, { writer: s.args[0] as string, series: s.args[1] as number, qty: s.args[2] as number })
    }
    if (i < cursor || s.op !== 'buy' || !isOk(s)) continue
    const o = offerWriter.get(s.args[1] as number)
    const next = sc.steps[i + 1]
    if (o && o.writer === p.writer && o.series === p.seriesId && BigInt(o.qty) === p.qty && next?.op === 'get_requirement' && isOk(next) && next.args[0] === p.writer) {
      return requirementFrom(next.result)
    }
  }
  return null
}

function resultRecord(r: unknown): Record<string, bigint> | null {
  if (r && typeof r === 'object') {
    const out: Record<string, bigint> = {}
    for (const [k, v] of Object.entries(r)) if (typeof v === 'number') out[k] = BigInt(v)
    return out
  }
  return null
}

export function configView(sc: RawScenario): ConfigView {
  const c = sc.config
  return { maxAge: c.max_age, exerciseMaxAge: c.exercise_max_age, settleWindow: c.settle_window, reserveFeeBps: c.reserve_fee_bps, bonusBps: c.bonus_bps, imBps: c.im_bps }
}

/** Everything the screens need, after the first `cursor` steps of the scenario have been applied. */
export function deriveModel(sc: RawScenario, cursor: number): ProModel {
  const n = Math.max(0, Math.min(cursor, sc.steps.length))
  let state: RawState = emptyState(sc)
  let now = sc.t0
  const seriesMeta = new Map<number, { strike: number; expiry: number }>()
  const snaps = new Map<number, SnapshotView>()
  const offers = new Map<number, OfferView>()
  const claims = new Map<number, ClaimResult>()
  const history: HistoryEntry[] = []

  for (let i = 0; i < n; i++) {
    const s = sc.steps[i]
    if (s.state) {
      state = s.state
      now = s.state.now
    }
    if (s.op === 'set_time' && isOk(s)) now = s.args[0] as number
    const ok = isOk(s)
    if (ok) {
      if (s.op === 'list_series') seriesMeta.set(s.result as number, { strike: s.args[1] as number, expiry: s.args[2] as number })
      if (s.op === 'publish_risk') {
        const sn = s.args[1] as { series_id: number; seq: number; ts: number; spot: number; mark: number }
        snaps.set(sn.series_id, { seriesId: sn.series_id, seq: sn.seq, ts: sn.ts, spot: big(sn.spot), mark: big(sn.mark) })
      }
      if (s.op === 'create_offer') {
        const a = s.args as [string, number, number, number, number]
        offers.set(s.result as number, {
          id: s.result as number, writer: a[0], seriesId: a[1], qty: big(a[2]), premium: big(a[3]), quoteExpiry: a[4], status: 'open', buyer: null,
        })
      }
      if (s.op === 'buy') {
        const o = offers.get(s.args[1] as number)
        if (o) {
          o.status = 'bought'
          o.buyer = s.args[0] as string
        }
      }
      if (s.op === 'cancel_offer') {
        const o = offers.get(s.args[1] as number)
        if (o) o.status = 'cancelled'
      }
      if (s.op === 'claim') {
        const r = s.result as { due: number; paid: number; deficit: number }
        claims.set(s.args[1] as number, { due: big(r.due), paid: big(r.paid), deficit: big(r.deficit) })
      }
    }
    if (s.op !== 'set_time' && s.op !== 'get_requirement') {
      history.push({
        index: i,
        op: s.op,
        actor: typeof s.args[0] === 'string' ? s.args[0] : null,
        args: s.args.filter((a): a is string | number => typeof a === 'string' || typeof a === 'number'),
        ok,
        code: codeOf(s),
        result: ok ? resultRecord(s.result) : null,
      })
    }
  }

  const series: SeriesView[] = Object.entries(state.series).map(([id, v]) => {
    const meta = seriesMeta.get(Number(id))
    return {
      id: Number(id),
      strike: big(meta?.strike),
      expiry: meta?.expiry ?? 0,
      oi: big(v.oi),
      settlementPrice: v.settlement_price == null ? null : big(v.settlement_price),
      openBooks: v.open_books,
      shortfall: big(v.shortfall),
      vaultPaid: big(v.vault_paid),
      pool: big(v.pool),
      claimed: big(v.claimed),
      closed: v.closed,
      snapshot: snaps.get(Number(id)) ?? null,
      deficit: v.closed ? big(v.shortfall) - big(v.vault_paid) : null,
    }
  })
  // A series listed but with no state row yet cannot happen (list_series carries state), but keep ids stable.
  series.sort((a, b) => a.id - b.id)
  const expiryOf = (id: number) => seriesMeta.get(id)?.expiry ?? Infinity

  const books: BookView[] = Object.entries(state.books).map(([id, b]) => ({
    id: Number(id),
    seriesId: b.series_id,
    owner: b.owner,
    qty: big(b.qty),
    settled: b.settled,
    due: big(b.due),
    fromOwner: big(b.from_owner),
    shortfall: big(b.shortfall),
    reserve: big(b.reserve),
  }))
  const ownerOfBook = new Map(books.map((b) => [b.id, b.owner]))
  const seriesOfBook = new Map(books.map((b) => [b.id, b.seriesId]))

  const positions: PositionView[] = Object.entries(state.positions).map(([id, p]) => ({
    id: Number(id),
    seriesId: seriesOfBook.get(p.book) ?? 0,
    holder: p.holder,
    book: p.book,
    bookOwner: ownerOfBook.get(p.book) ?? null,
    qty: big(p.qty),
    settled: p.settled,
    exercised: p.exercised,
    paid: big(p.paid),
    deficit: big(p.deficit),
    claim: claims.get(Number(id)) ?? null,
  }))

  const shortsOf = (a: RawAccount): ShortView[] =>
    Object.entries(a.shorts)
      .filter(([, q]) => q > 0)
      .map(([sid, q]) => ({ seriesId: Number(sid), qty: big(q) }))

  const accounts: AccountView[] = Object.entries(state.accounts)
    .filter(([id]) => id !== VAULT)
    .map(([id, a]) => {
      const requirement = currentRequirement(sc, n, id)
      return {
        id,
        cash: big(a.cash),
        owed: big(a.owed),
        reserved: big(a.reserved),
        shorts: shortsOf(a),
        books: a.books,
        requirement,
        cushion: requirement ? requirement.nlv - requirement.mm : null,
        withdrawBlocked: shortsOf(a).some((s) => expiryOf(s.seriesId) <= now),
      }
    })

  const v = state.accounts[VAULT]
  const vaultShorts = v ? shortsOf(v) : []
  const vaultReq = currentRequirement(sc, n, VAULT)
  const debtors = accounts.filter((a) => a.owed > 0n).map((a) => ({ writer: a.id, owed: a.owed }))
  const vault = {
    cash: big(v?.cash),
    reserved: big(v?.reserved),
    shorts: vaultShorts,
    // vault_value: the cash when the vault holds no shorts, otherwise its nlv (a fixture value or unknown).
    value: vaultShorts.length === 0 && big(v?.reserved) === 0n ? big(v?.cash) : (vaultReq?.nlv ?? null),
    totalShares: big(state.total_shares),
    lpShares: Object.entries(state.lp_shares).map(([lp, shares]) => ({ lp, shares: big(shares) })),
    debtsOwed: debtors.reduce((t, d) => t + d.owed, 0n),
    debtors,
  }

  return {
    now,
    config: configView(sc),
    series,
    offers: [...offers.values()],
    books,
    positions,
    accounts,
    vault,
    wallets: Object.fromEntries(Object.entries(state.wallets).map(([k, x]) => [k, big(x)])),
    history,
  }
}

/** Matches the next scripted step of `op` that an action refers to. */
export type StepMatcher = (s: RawStep) => boolean

/** First step at or after `cursor` with the op and arguments of the action; -1 when the script has none. */
export function findScripted(sc: RawScenario, cursor: number, op: string, match: StepMatcher): number {
  for (let i = cursor; i < sc.steps.length; i++) {
    const s = sc.steps[i]
    if (s.op === op && match(s)) return i
  }
  return -1
}
