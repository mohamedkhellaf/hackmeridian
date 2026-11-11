// The demo market of mock mode: three fictional assets, four fictional makers, offers of both kinds on the
// standard grid (core/series), a few buyer requests, one resale listing and positions for the two test wallets.
// Everything is computed from the current time, so the demo never goes stale: expiries are the listed Fridays,
// and the positions that must be near or past their deadline are placed relative to now.
//
// Premiums are illustrative. They come from a textbook normal-model formula so that the chain is internally
// consistent (out of the money is cheaper than in the money, longer dated is dearer, makers differ by a spread).
// They are not quotes, not valuations and not calibrated on any data; the app footer says the data is mock data.
import { QUOTE_ASSETS, REFERENCE_ASSETS } from '../assets/referenceList'
import { demoPerUnit } from '../reference/providers'
import type { Bid } from '../requests/types'
import { WEEK_SECONDS, standardExpiries, strikeLadder } from '../series/standard'
import { nowSec } from '../time'
import { DEMO_HEDGERS, DEMO_MAKERS, DEMO_WALLETS } from './demoAccounts'
import type { Ask, OptionKind, OptionOffer, OptionState, TokenInfo } from './types'

export interface MockSeed {
  quote: TokenInfo
  underlyings: TokenInfo[]
  /** Ids must be 0..n-1 in order: the mock assigns the next id from the list length. */
  options: OptionOffer[]
  asks: Ask[]
  bids: Bid[]
  /** Starting balances: account -> token contract id -> units. */
  balances: Record<string, Record<string, bigint>>
  /** Balance of any account that is not listed, per token contract id. */
  defaultBalances: Record<string, bigint>
}

const token = (a: { contractId: string; code: string; decimals: number; issuer: string }): TokenInfo => ({
  contractId: a.contractId,
  code: a.code,
  decimals: a.decimals,
  issuer: a.issuer,
})

export const MOCK_QUOTE: TokenInfo = token(QUOTE_ASSETS.mock)
export const MOCK_UNDERLYINGS: TokenInfo[] = REFERENCE_ASSETS.mock.map(token)

const whole = (n: number, t: TokenInfo): bigint => BigInt(n) * 10n ** BigInt(t.decimals)

const defaultBalances = (): Record<string, bigint> =>
  Object.fromEntries([[MOCK_QUOTE.contractId, whole(10_000, MOCK_QUOTE)], ...MOCK_UNDERLYINGS.map((t) => [t.contractId, whole(1_000, t)])])

/** An empty contract with the three assets listed: no options, no requests. For tests of the mock's rules. */
export function bareSeed(): MockSeed {
  return { quote: MOCK_QUOTE, underlyings: [...MOCK_UNDERLYINGS], options: [], asks: [], bids: [], balances: {}, defaultBalances: defaultBalances() }
}

// ------------------------------------------------------------------------------------------- demo premiums

/** Illustrative yearly move of each demo asset, as a fraction of its price. Not calibrated on anything. */
const DEMO_SWING: Record<string, number> = { FUND: 0.3, BOND: 0.14, EQTY: 0.45 }
const YEAR_SECONDS = 365 * 86_400

const pdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
/** Standard normal CDF (Abramowitz and Stegun 26.2.17, error below 1e-7). */
function cdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const upper = pdf(x) * poly
  return x >= 0 ? 1 - upper : upper
}

/** Normal-model value per unit, split into intrinsic value and a time value that grows with the square root of time. */
function modelPerUnit(kind: OptionKind, price: number, strike: number, spread: number): { intrinsic: number; time: number } {
  const intrinsic = Math.max(kind === 'call' ? price - strike : strike - price, 0)
  if (spread <= 0) return { intrinsic, time: 0 }
  const call = (price - strike) * cdf((price - strike) / spread) + spread * pdf((price - strike) / spread)
  const value = kind === 'call' ? call : call - (price - strike)
  return { intrinsic, time: Math.max(value - intrinsic, 0) }
}

/**
 * Demo premium per unit of underlying, in quote units, on the 0.01 tick and never below one tick.
 * `factor` scales the time value only (1.00 is the model value; above it is dearer), so no demo premium is
 * ever below intrinsic value. `round` is `up` for what a seller asks and `down` for what a buyer bids.
 */
export function demoPremiumPerUnit(
  kind: OptionKind,
  asset: TokenInfo,
  strikePerUnit: bigint,
  expiry: number,
  atSec: number,
  factor: number = 1,
  round: 'up' | 'down' = 'up',
): bigint {
  const q = MOCK_QUOTE
  const scale = 10 ** q.decimals
  const price = Number(demoPerUnit(asset.code, q.decimals) ?? 0n) / scale
  const strike = Number(strikePerUnit) / scale
  const years = Math.max(expiry - atSec, 0) / YEAR_SECONDS
  const spread = price * (DEMO_SWING[asset.code] ?? 0.3) * Math.sqrt(years)
  const { intrinsic, time } = modelPerUnit(kind, price, strike, spread)
  const exact = (intrinsic + time * factor) * 100
  const ticks = Math.max(1, round === 'up' ? Math.ceil(exact - 1e-9) : Math.floor(exact + 1e-9))
  return BigInt(ticks) * 10n ** BigInt(q.decimals - 2)
}

/** The lowest spread any demo maker applies: a demo bid is always at least one tick under an ask at this spread. */
const TIGHTEST_FACTOR = 0.95
const BID_FACTOR = 0.8

// ------------------------------------------------------------------------------------------- the demo market

/** Which series each maker quotes. `s` is the strike index 0..4 across the five central ladder strikes (2 is nearest the demo price), `e` the expiry index 0..2. */
interface Quoting {
  maker: string
  /** Spread on the model premium. */
  factor: number
  /** Lot per asset code, in whole units. */
  lots: Record<string, number>
  quotes: (code: string, e: number, s: number, kind: OptionKind) => boolean
}

const otm = (s: number, kind: OptionKind) => (kind === 'put' ? s <= 2 : s >= 2)
const itm = (s: number, kind: OptionKind) => (kind === 'put' ? s >= 2 : s <= 2)

const QUOTING: Quoting[] = [
  // The broad maker: out-of-the-money and at-the-money series of every asset.
  { maker: DEMO_MAKERS.a, factor: 1, lots: { FUND: 10, BOND: 2, EQTY: 5 }, quotes: (code, e, s, kind) => otm(s, kind) && (e < 2 || code === 'FUND') },
  // Tighter prices on the three central strikes of FUND and BOND, nearest and furthest expiry.
  { maker: DEMO_MAKERS.b, factor: TIGHTEST_FACTOR, lots: { FUND: 5, BOND: 1 }, quotes: (code, e, s) => code !== 'EQTY' && e !== 1 && s >= 1 && s <= 3 },
  // In-the-money series of EQTY, and of BOND for the middle expiry.
  { maker: DEMO_MAKERS.c, factor: 1.05, lots: { EQTY: 4, BOND: 2 }, quotes: (code, e, s, kind) => itm(s, kind) && (code === 'EQTY' || (code === 'BOND' && e === 1)) },
  // Sparse and dearer, larger lots.
  {
    maker: DEMO_MAKERS.d,
    factor: 1.1,
    lots: { FUND: 25, BOND: 5, EQTY: 10 },
    quotes: (code, e, s, kind) => (code === 'FUND' ? e === 0 && kind === 'put' && (s === 2 || s === 3) : e === 2 && (kind === 'put' ? s === 0 || s === 2 : s === 2 || s === 4)),
  },
]

/** The five central strikes of an asset's ladder (per unit, quote units, ascending) around its demo price. */
export function demoStrikes(asset: TokenInfo): bigint[] {
  return strikeLadder(demoPerUnit(asset.code, MOCK_QUOTE.decimals), MOCK_QUOTE.decimals, 7).slice(1, 6)
}

/** The three expiries the demo makers quote: the first three listed ones. */
export function demoExpiries(atSec: number): number[] {
  return standardExpiries(atSec).slice(0, 3)
}

/** The Friday 08:00 UTC before the first listed expiry that has already passed: where expired demo options sit. */
function lastPassedExpiry(atSec: number): number {
  let t = standardExpiries(atSec)[0] - WEEK_SECONDS
  while (t >= atSec) t -= WEEK_SECONDS
  return t
}

/** A deadline inside the next 48 hours: the first listed expiry when it is 2 to 48 hours away, else about 30 hours from now, on the hour. */
function soonDeadline(atSec: number): number {
  const first = standardExpiries(atSec)[0]
  if (first - atSec >= 2 * 3600 && first - atSec <= 48 * 3600) return first
  return Math.ceil((atSec + 30 * 3600) / 3600) * 3600
}

export function demoSeed(atSec: number = nowSec()): MockSeed {
  const q = MOCK_QUOTE
  const asset = (code: string): TokenInfo => {
    const t = MOCK_UNDERLYINGS.find((x) => x.code === code)
    if (!t) throw new Error(`The mock asset list has no ${code}`)
    return t
  }
  const [FUND, BOND, EQTY] = [asset('FUND'), asset('BOND'), asset('EQTY')]
  const expiries = demoExpiries(atSec)
  const strikes = new Map(MOCK_UNDERLYINGS.map((t) => [t.contractId, demoStrikes(t)]))
  const K = (t: TokenInfo, s: number) => strikes.get(t.contractId)![s]
  const passed = lastPassedExpiry(atSec)

  const options: OptionOffer[] = []
  const add = (o: { kind: OptionKind; asset: TokenInfo; strike: bigint; lot: number; expiry: number; writer: string; holder?: string | null; state?: OptionState; factor?: number; pricedAt?: number }): OptionOffer => {
    const qty = whole(o.lot, o.asset)
    // A position was priced when it was bought: use a moment before its deadline, never after.
    const pricedAt = o.pricedAt ?? Math.min(atSec, o.expiry - 5 * 86_400)
    const perUnit = demoPremiumPerUnit(o.kind, o.asset, o.strike, o.expiry, pricedAt, o.factor ?? 1)
    const option: OptionOffer = {
      id: BigInt(options.length),
      kind: o.kind,
      underlying: o.asset,
      quote: q,
      underlyingQty: qty,
      totalStrike: o.strike * BigInt(o.lot),
      totalPremium: perUnit * BigInt(o.lot),
      expiry: o.expiry,
      writer: o.writer,
      holder: o.holder ?? null,
      state: o.state ?? (o.holder ? 'active' : 'offered'),
    }
    options.push(option)
    return option
  }

  const A = DEMO_WALLETS.a
  const B = DEMO_WALLETS.b
  const { a: makerA, b: makerB, c: makerC } = DEMO_MAKERS

  // ---- positions of the default test wallet (ids 0 to 6)
  // 0: a put it holds, in the money at the demo price, with the deadline inside 48 hours.
  add({ kind: 'put', asset: FUND, strike: K(FUND, 4), lot: 10, expiry: soonDeadline(atSec), writer: makerA, holder: A })
  // 1: a put it holds, out of the money.
  add({ kind: 'put', asset: BOND, strike: K(BOND, 0), lot: 2, expiry: expiries[1], writer: makerB, holder: A })
  // 2: a covered call it wrote and sold: 4 EQTY stay locked until exercise or the deadline.
  add({ kind: 'call', asset: EQTY, strike: K(EQTY, 4), lot: 4, expiry: expiries[1], writer: A, holder: DEMO_HEDGERS.b })
  // 3: a call it wrote that the holder exercised: the strike paid waits in the contract for claim_delivery.
  add({ kind: 'call', asset: BOND, strike: K(BOND, 1), lot: 1, expiry: expiries[0], writer: A, holder: DEMO_HEDGERS.a, state: 'exercised' })
  // 4: a put it wrote that expired unexercised: the collateral waits for reclaim (the state reads as expired).
  add({ kind: 'put', asset: EQTY, strike: K(EQTY, 1), lot: 2, expiry: passed, writer: A, holder: DEMO_HEDGERS.b })
  // 5: a call it held that expired out of the money. Nothing to do.
  add({ kind: 'call', asset: FUND, strike: K(FUND, 4), lot: 5, expiry: passed, writer: makerA, holder: A })
  // 6: an open offer it wrote, still for sale.
  add({ kind: 'put', asset: FUND, strike: K(FUND, 0), lot: 5, expiry: expiries[2], writer: A, factor: 1.02, pricedAt: atSec })

  // ---- positions of the second test wallet (ids 7 and 8)
  add({ kind: 'call', asset: EQTY, strike: K(EQTY, 2), lot: 4, expiry: expiries[1], writer: makerC, holder: B })
  add({ kind: 'put', asset: FUND, strike: K(FUND, 1), lot: 5, expiry: expiries[1], writer: B, holder: DEMO_HEDGERS.a })

  // ---- one option a third party holds and has listed for resale (id 9)
  const listed = add({ kind: 'call', asset: FUND, strike: K(FUND, 3), lot: 5, expiry: expiries[1], writer: makerB, holder: DEMO_HEDGERS.a })
  const resalePerUnit = demoPremiumPerUnit('call', FUND, K(FUND, 3), expiries[1], atSec, 0.9)
  const asks: Ask[] = [{ id: listed.id, holder: DEMO_HEDGERS.a, askTotal: resalePerUnit * 5n }]

  // ---- the makers' open offers, on the standard grid
  for (const asset of MOCK_UNDERLYINGS)
    for (let e = 0; e < expiries.length; e++)
      for (let s = 0; s < 5; s++)
        for (const kind of ['put', 'call'] as const)
          for (const m of QUOTING) {
            const lot = m.lots[asset.code]
            if (lot && m.quotes(asset.code, e, s, kind)) add({ kind, asset, strike: K(asset, s), lot, expiry: expiries[e], writer: m.maker, factor: m.factor, pricedAt: atSec })
          }

  // ---- two offers off the grid, for the "Other offers" list
  // A strike between two ladder strikes.
  add({ kind: 'call', asset: EQTY, strike: (K(EQTY, 2) + K(EQTY, 3)) / 2n, lot: 3, expiry: expiries[0], writer: DEMO_MAKERS.d, factor: 1.1, pricedAt: atSec })
  // A deadline two days after a listed Friday.
  add({ kind: 'put', asset: FUND, strike: K(FUND, 2), lot: 8, expiry: expiries[0] + 2 * 86_400, writer: DEMO_MAKERS.d, factor: 1.1, pricedAt: atSec })

  // ---- buyer requests: a premium already escrowed, below what the makers ask
  const bids: Bid[] = []
  const tick = 10n ** BigInt(q.decimals - 2)
  const bid = (o: { kind: OptionKind; asset: TokenInfo; strike: bigint; lot: number; expiry: number; buyer: string }) => {
    // Below the makers: a lower time value, rounded down, and never at or above the tightest ask.
    const wanted = demoPremiumPerUnit(o.kind, o.asset, o.strike, o.expiry, atSec, BID_FACTOR, 'down')
    const ceiling = demoPremiumPerUnit(o.kind, o.asset, o.strike, o.expiry, atSec, TIGHTEST_FACTOR) - tick
    const perUnit = ceiling < tick ? tick : wanted < ceiling ? wanted : ceiling
    bids.push({
      id: BigInt(bids.length),
      buyer: o.buyer,
      kind: o.kind,
      underlying: o.asset,
      quote: q,
      underlyingQty: whole(o.lot, o.asset),
      totalStrike: o.strike * BigInt(o.lot),
      totalPremium: perUnit * BigInt(o.lot),
      expiry: o.expiry,
      state: 'open',
      optionId: null,
    })
  }
  // 0: the default wallet's own request.
  bid({ kind: 'put', asset: BOND, strike: K(BOND, 1), lot: 2, expiry: expiries[2], buyer: A })
  // 1: the second wallet bids under the makers on a busy series.
  bid({ kind: 'put', asset: FUND, strike: K(FUND, 1), lot: 5, expiry: expiries[2], buyer: B })
  // 2: a series nobody quotes: the cell shows a bid and no offer.
  bid({ kind: 'put', asset: FUND, strike: K(FUND, 3), lot: 10, expiry: expiries[1], buyer: DEMO_HEDGERS.a })
  // 3: a call request on EQTY.
  bid({ kind: 'call', asset: EQTY, strike: K(EQTY, 3), lot: 4, expiry: expiries[1], buyer: DEMO_HEDGERS.b })

  const balances: Record<string, Record<string, bigint>> = {
    [A]: { [q.contractId]: whole(2_500, q), [FUND.contractId]: whole(120, FUND), [BOND.contractId]: whole(12, BOND), [EQTY.contractId]: whole(40, EQTY) },
    [B]: { [q.contractId]: whole(1_200, q), [FUND.contractId]: whole(60, FUND), [BOND.contractId]: whole(6, BOND), [EQTY.contractId]: whole(25, EQTY) },
    // An empty wallet, for the first-run states ("Get test funds"): every other account gets the default balances.
    [DEMO_WALLETS.c]: { [q.contractId]: 0n, [FUND.contractId]: 0n, [BOND.contractId]: 0n, [EQTY.contractId]: 0n },
  }

  return { quote: q, underlyings: [...MOCK_UNDERLYINGS], options, asks, bids, balances, defaultBalances: defaultBalances() }
}
