import { MAX_OPEN_BIDS_PER_BUYER } from '../requests/types'
import type { Bid, NewBid } from '../requests/types'
import { OPTIONS_ERRORS, SAC_ERRORS } from '../stellar/errors'
import type { TokenBalance } from '../stellar/tokens'
import { nowSec as now } from '../time'
import { TxError, errorMessage } from '../tx/errors'
import type { TxErrorKind } from '../tx/errors'
import type { TxCheck, TxOptions } from '../tx/types'
import { byId } from '../units'
import { collateralLines, deliveryAmount, reservedOf } from './abi'
import type { OptionsClient } from './client'
import { demoSeed } from './mockSeed'
import type { MockSeed } from './mockSeed'
import { MAX_OPEN_PER_WRITER, MAX_TENOR_SECONDS, requiredCollateral } from './types'
import type { Ask, CollateralHealth, NewOffer, OptionOffer, TokenInfo, TxResult } from './types'

// In-memory stand-in for the options contract: fictional assets and accounts, fake transaction hashes, nothing
// read from a chain. The app footer says so while this client is in use. It follows the contract's rules
// (docs/contract-abi.md) closely enough to be a demo: collateral and premiums move between mock balances, and
// every write reports the same stages as a real one.

/** The mock contract's own account in the demo ledger (what holds the collateral). */
export const MOCK_CONTRACT = 'C_MOCK_OPTIONS'

/** The list reads `failNextRead` can stage a failure for. */
export const MOCK_LIST_READS = ['listOptions', 'listBids', 'listAsks'] as const
export type MockListRead = (typeof MOCK_LIST_READS)[number]

/** Read delay of `listOptions`, and the whole duration of a write (the four stage delays add up to it). */
export const MOCK_READ_MS = 150
const STAGE_MS = { checking: 150, signing: 150, submitting: 100, pending: 200 } as const
export const MOCK_TX_MS = STAGE_MS.checking + STAGE_MS.signing + STAGE_MS.submitting + STAGE_MS.pending // 600
/** A mock transaction's time bound, like the SDK default of five minutes. */
const MOCK_TIMEOUT_S = 300

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fakeHash = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')

type Prepared<T> = () => T

export class MockOptionsClient implements OptionsClient {
  readonly isMock = true
  private readonly quote: TokenInfo
  private readonly underlyings: TokenInfo[]
  private options: OptionOffer[]
  // Resale asks by option id (contract v1.4 semantics).
  private asks = new Map<bigint, { holder: string; askTotal: bigint }>()
  // Buyer requests (contract v1.5 semantics). Stored state is open/filled/cancelled; 'expired' is derived on read
  // like options.
  private bids: Bid[]
  // Demo balances: account -> token contract id -> units. Accounts that are not listed start from the defaults.
  private ledger = new Map<string, Map<string, bigint>>()
  private readonly defaults: Record<string, bigint>
  // Demo switch (see failNextWith) and the transactions it left undecided.
  private nextFailure: TxErrorKind | null = null
  private readFailures = new Map<MockListRead, number>()
  private undecided = new Map<string, () => void>()
  // How every mock transaction that got a hash ended, for checkTx.
  private outcomes = new Map<string, TxCheck>()

  /** `seed` defaults to the demo market (mockSeed.ts). Tests pass `bareSeed()` for an empty contract. */
  constructor(seed: MockSeed = demoSeed()) {
    this.quote = seed.quote
    this.underlyings = [...seed.underlyings]
    this.options = seed.options.map((o) => ({ ...o }))
    this.bids = seed.bids.map((b) => ({ ...b }))
    for (const a of seed.asks) this.asks.set(a.id, { holder: a.holder, askTotal: a.askTotal })
    this.defaults = { ...seed.defaultBalances }
    for (const [who, tokens] of Object.entries(seed.balances)) this.ledger.set(who, new Map(Object.entries(tokens)))
    // The contract holds exactly what the seeded options and requests reserve: the mock is never clawed back.
    const held = new Map<string, bigint>()
    for (const l of collateralLines(this.options.map((o) => this.withExpiry(o)), this.bids.map((b) => this.bidWithExpiry(b)))) held.set(l.token.contractId, reservedOf(l))
    this.ledger.set(MOCK_CONTRACT, held)
  }

  // ---- demo ledger

  private balanceOf(who: string, token: TokenInfo): bigint {
    return this.ledger.get(who)?.get(token.contractId) ?? (who === MOCK_CONTRACT ? 0n : (this.defaults[token.contractId] ?? 0n))
  }

  private setBalance(who: string, token: TokenInfo, units: bigint): void {
    let acct = this.ledger.get(who)
    if (!acct) this.ledger.set(who, (acct = new Map()))
    acct.set(token.contractId, units)
  }

  /** Throws like the token contract would (SAC error 10) when `who` cannot pay. */
  private need(who: string, token: TokenInfo, amount: bigint): void {
    if (this.balanceOf(who, token) < amount) throw new Error(SAC_ERRORS[10])
  }

  private move(token: TokenInfo, from: string, to: string, amount: bigint): void {
    this.need(from, token, amount)
    this.setBalance(from, token, this.balanceOf(from, token) - amount)
    this.setBalance(to, token, this.balanceOf(to, token) + amount)
  }

  // ---- transactions

  /**
   * Demo and test switch: the next write stops the way a real one can.
   *   refused   at `checking` (nothing sent)
   *   declined  at `signing` (the wallet user said no; nothing sent)
   *   failed    after `pending` (included, refused by the contract; state unchanged)
   *   expired   after `pending` (never included; state unchanged)
   *   unknown   after `pending`: the change is held back until `checkTx(hash)` is called, which applies it
   */
  failNextWith(kind: TxErrorKind | null): void {
    this.nextFailure = kind
  }

  /**
   * Demo and test switch: the next `times` calls of a list read reject, the way an unreachable RPC does, then
   * reads work again. Without `method`, any of the three list reads counts. `failNextRead(undefined, 0)` clears it.
   */
  failNextRead(method?: MockListRead, times = 1): void {
    if (method) this.readFailures.set(method, Math.max(0, times))
    else for (const m of MOCK_LIST_READS) this.readFailures.set(m, Math.max(0, times))
  }

  private failRead(method: MockListRead): void {
    const left = this.readFailures.get(method) ?? 0
    if (left <= 0) return
    this.readFailures.set(method, left - 1)
    throw new Error('The mock chain did not answer (demo switch).')
  }

  /**
   * Demo and test switch: takes `units` of one token away from the contract's own balance, as an issuer clawback
   * would. `collateralHealth()` then reports `held < reserved` for it: the clawback shortfall state (Reserves, the
   * ticket's notice, refused trades). The amount is capped at what the contract holds.
   */
  clawBack(tokenContractId: string, units: bigint): void {
    const token = [this.quote, ...this.underlyings].find((t) => t.contractId === tokenContractId)
    if (!token || units <= 0n) return
    const held = this.balanceOf(MOCK_CONTRACT, token)
    this.setBalance(MOCK_CONTRACT, token, units >= held ? 0n : held - units)
  }

  /**
   * One mock transaction. `prepare` validates against the current state and returns the change to apply; it runs
   * once at `checking` (a refusal there never reaches the wallet) and again when the ledger "includes" it, so
   * two overlapping transactions cannot both win.
   */
  private async tx<T>(opts: TxOptions | undefined, prepare: () => Prepared<T>): Promise<TxResult & { value: T }> {
    const stage = opts?.onStage ?? (() => {})
    const fail = this.nextFailure
    this.nextFailure = null

    stage({ stage: 'checking' })
    await delay(STAGE_MS.checking)
    try {
      prepare()
    } catch (e) {
      throw new TxError('refused', errorMessage(e), { cause: e })
    }
    if (fail === 'refused') throw new TxError('refused', 'The mock contract refused this call (demo switch). Nothing was sent.')

    stage({ stage: 'signing' })
    await delay(STAGE_MS.signing)
    if (fail === 'declined') throw new TxError('declined', 'You rejected the request in your wallet.')

    stage({ stage: 'submitting' })
    await delay(STAGE_MS.submitting)
    const hash = fakeHash()
    const maxTime = now() + MOCK_TIMEOUT_S
    stage({ stage: 'pending', hash, maxTime })
    await delay(STAGE_MS.pending)

    if (fail === 'failed') {
      this.outcomes.set(hash, { status: 'failed', message: OPTIONS_ERRORS[106] })
      throw new TxError('failed', OPTIONS_ERRORS[106], { hash, maxTime })
    }
    if (fail === 'expired') {
      this.outcomes.set(hash, { status: 'expired' })
      throw new TxError('expired', 'The transaction expired without being included. Nothing was charged.', { hash, maxTime })
    }
    if (fail === 'unknown') {
      this.undecided.set(hash, () => void prepare()())
      throw new TxError('unknown', 'Not confirmed yet. The transaction may still be included; check again before sending another.', { hash, maxTime })
    }
    let value: T
    try {
      value = prepare()()
    } catch (e) {
      // The state changed while this was in flight (someone else was first): included, refused, fee charged.
      this.outcomes.set(hash, { status: 'failed', message: errorMessage(e) })
      throw new TxError('failed', errorMessage(e), { hash, maxTime, cause: e })
    }
    this.outcomes.set(hash, { status: 'confirmed', ledger: null })
    return { hash, ledger: null, value }
  }

  /** A write with no result of its own. */
  private async simple(opts: TxOptions | undefined, prepare: () => Prepared<void>): Promise<TxResult> {
    const { hash, ledger } = await this.tx(opts, prepare)
    return { hash, ledger }
  }

  /**
   * How a mock transaction ended. One that was left undecided (`failNextWith('unknown')`) is applied now, the way
   * a late ledger would, and reported as confirmed, or as failed when the state has moved on meanwhile. A hash
   * this client never produced stays unknown.
   */
  async checkTx(hash: string, _maxTime: number | null): Promise<TxCheck> {
    const apply = this.undecided.get(hash)
    if (apply) {
      this.undecided.delete(hash)
      let outcome: TxCheck
      try {
        apply()
        outcome = { status: 'confirmed', ledger: null }
      } catch (e) {
        outcome = { status: 'failed', message: errorMessage(e) }
      }
      this.outcomes.set(hash, outcome)
    }
    return this.outcomes.get(hash) ?? { status: 'unknown' }
  }

  // ---- reads

  private find(id: bigint): OptionOffer {
    const o = this.options.find((x) => x.id === id)
    if (!o) throw new Error(OPTIONS_ERRORS[101])
    return o
  }

  private withExpiry(o: OptionOffer): OptionOffer {
    return (o.state === 'active' || o.state === 'offered') && o.expiry <= now() ? { ...o, state: 'expired' } : { ...o }
  }

  private isListed(token: TokenInfo): boolean {
    return this.underlyings.some((t) => t.contractId === token.contractId)
  }

  async supportedAssets() {
    return { quote: this.quote, underlyings: [...this.underlyings] }
  }

  async listOptions() {
    await delay(MOCK_READ_MS)
    this.failRead('listOptions')
    return this.options.map((o) => this.withExpiry(o))
  }

  async getOption(id: bigint) {
    return this.withExpiry(this.find(id))
  }

  private lines() {
    return collateralLines(
      this.options.map((x) => this.withExpiry(x)),
      this.bids.map((b) => this.bidWithExpiry(b)),
    )
  }

  async openCollateral() {
    return this.lines()
  }

  // Reserved (what the options and requests account for) against held (the contract's demo balance). They are
  // equal: nothing claws tokens back from the mock.
  async collateralHealth(): Promise<CollateralHealth[]> {
    return this.lines().map((l) => ({ token: l.token, reserved: reservedOf(l), held: this.balanceOf(MOCK_CONTRACT, l.token) }))
  }

  async isEligible(_token: string, _who: string) {
    return true
  }

  async writerOpenCount(writer: string) {
    return this.options.filter((o) => o.writer === writer && o.state === 'offered' && o.expiry > now()).length
  }

  async balances(who: string, tokens?: TokenInfo[]): Promise<TokenBalance[]> {
    return (tokens ?? [this.quote, ...this.underlyings]).map((t) => ({ contractId: t.contractId, status: 'ok', balance: this.balanceOf(who, t) }))
  }

  // ---- options

  async createOffer(offer: NewOffer, writer: string, opts?: TxOptions) {
    const { value: id, ...res } = await this.tx(opts, () => {
      if (offer.underlyingQty <= 0n || offer.totalStrike <= 0n || offer.totalPremium <= 0n) throw new Error('Amounts must be positive')
      if (offer.expiry <= now()) throw new Error('Expiry must be in the future')
      if (offer.expiry > now() + MAX_TENOR_SECONDS) throw new Error(OPTIONS_ERRORS[119])
      if (!this.isListed(offer.underlying)) throw new Error(OPTIONS_ERRORS[103])
      if (this.options.filter((o) => o.writer === writer && o.state === 'offered' && o.expiry > now()).length >= MAX_OPEN_PER_WRITER)
        throw new Error(OPTIONS_ERRORS[116])
      const created: OptionOffer = { ...offer, id: 0n, quote: this.quote, writer, holder: null, state: 'offered' }
      const lock = requiredCollateral(created)
      this.need(writer, lock.token, lock.amount)
      return () => {
        const id = BigInt(this.options.length)
        this.move(lock.token, writer, MOCK_CONTRACT, lock.amount)
        this.options.push({ ...created, id })
        return id
      }
    })
    return { ...res, id }
  }

  buy(id: bigint, buyer: string, opts?: TxOptions): Promise<TxResult> {
    return this.simple(opts, () => {
      const o = this.find(id)
      if (o.state !== 'offered') throw new Error('Offer is no longer available')
      if (o.expiry <= now()) throw new Error('Offer has expired')
      if (o.writer === buyer) throw new Error('You cannot buy your own offer')
      this.need(buyer, o.quote, o.totalPremium)
      return () => {
        this.move(o.quote, buyer, o.writer, o.totalPremium)
        o.holder = buyer
        o.state = 'active'
      }
    })
  }

  // PUT: the holder delivers the underlying and receives the strike. CALL: the holder pays the strike and receives
  // the underlying. Either way the writer's side stays in the contract until claimDelivery.
  exercise(id: bigint, holder: string, opts?: TxOptions): Promise<TxResult> {
    return this.simple(opts, () => {
      const o = this.find(id)
      if (o.holder !== holder) throw new Error('Only the holder can exercise')
      if (o.state !== 'active') throw new Error('Option is not active')
      if (o.expiry <= now()) throw new Error('Option has expired')
      const pays = deliveryAmount(o)
      const receives = requiredCollateral(o)
      this.need(holder, pays.token, pays.amount)
      return () => {
        this.move(pays.token, holder, MOCK_CONTRACT, pays.amount)
        this.move(receives.token, MOCK_CONTRACT, holder, receives.amount)
        o.state = 'exercised'
        this.asks.delete(id)
      }
    })
  }

  reclaim(id: bigint, writer: string, opts?: TxOptions): Promise<TxResult> {
    return this.simple(opts, () => {
      const o = this.find(id)
      if (o.writer !== writer) throw new Error('Only the writer can reclaim')
      if (o.expiry > now()) throw new Error('Option has not expired yet')
      if (o.state !== 'offered' && o.state !== 'active') throw new Error('Nothing to reclaim')
      const back = requiredCollateral(o)
      return () => {
        this.move(back.token, MOCK_CONTRACT, writer, back.amount)
        o.state = 'reclaimed'
      }
    })
  }

  // Put or call: the writer collects what the exercise left in the contract (deliveryAmount).
  claimDelivery(id: bigint, writer: string, opts?: TxOptions): Promise<TxResult> {
    return this.simple(opts, () => {
      const o = this.find(id)
      if (o.writer !== writer) throw new Error('Only the writer can claim')
      if (o.state !== 'exercised') throw new Error('Nothing to claim')
      const proceeds = deliveryAmount(o)
      return () => {
        this.move(proceeds.token, MOCK_CONTRACT, writer, proceeds.amount)
        o.state = 'settled'
      }
    })
  }

  // Allowed for unsold offers before or after expiry (ABI cancel_offer).
  cancelOffer(id: bigint, writer: string, opts?: TxOptions): Promise<TxResult> {
    return this.simple(opts, () => {
      const o = this.find(id)
      if (o.writer !== writer) throw new Error('Only the writer can cancel')
      if (o.state !== 'offered') throw new Error('Only open offers can be cancelled')
      const back = requiredCollateral(o)
      return () => {
        this.move(back.token, MOCK_CONTRACT, writer, back.amount)
        o.state = 'cancelled'
      }
    })
  }

  // ---- resale

  // An ask is live (listed, buyable) only while its option is Active, unexpired and still held by the lister.
  // Stale asks stay in the map so the holder can still cancel after expiry, as the contract allows.
  private liveAsk(id: bigint): { holder: string; askTotal: bigint } | null {
    const a = this.asks.get(id)
    if (!a) return null
    const o = this.options.find((x) => x.id === id)
    if (!o || o.state !== 'active' || o.expiry <= now() || o.holder !== a.holder) return null
    return a
  }

  async listAsks(): Promise<Ask[]> {
    await delay(100)
    this.failRead('listAsks')
    const out: Ask[] = []
    for (const id of [...this.asks.keys()].sort((a, b) => byId({ id: a }, { id: b }))) {
      const a = this.liveAsk(id)
      if (a) out.push({ id, holder: a.holder, askTotal: a.askTotal })
    }
    return out
  }

  async getAsk(id: bigint) {
    return this.liveAsk(id)?.askTotal ?? null
  }

  // Check order matches the contract: NotFound -> WrongState -> NotHolder -> Expired -> InvalidArgs.
  listForSale(id: bigint, holder: string, askTotal: bigint, opts?: TxOptions): Promise<TxResult> {
    return this.simple(opts, () => {
      const o = this.find(id)
      if (o.state !== 'active') throw new Error(OPTIONS_ERRORS[106])
      if (o.holder !== holder) throw new Error(OPTIONS_ERRORS[108])
      if (o.expiry <= now()) throw new Error(OPTIONS_ERRORS[109])
      if (askTotal <= 0n) throw new Error(OPTIONS_ERRORS[102])
      return () => void this.asks.set(id, { holder, askTotal })
    })
  }

  // Allowed after expiry (only removes the ask).
  cancelSale(id: bigint, holder: string, opts?: TxOptions): Promise<TxResult> {
    return this.simple(opts, () => {
      const o = this.find(id)
      if (o.holder !== holder) throw new Error(OPTIONS_ERRORS[108])
      const a = this.asks.get(id)
      if (!a || a.holder !== o.holder || o.state !== 'active') throw new Error(OPTIONS_ERRORS[120])
      return () => void this.asks.delete(id)
    })
  }

  // Pays at most `maxTotal`: a re-priced ask fails with PriceMoved (121) instead of charging more.
  buyResale(id: bigint, buyer: string, maxTotal: bigint, opts?: TxOptions): Promise<TxResult> {
    return this.simple(opts, () => {
      const o = this.find(id)
      if (o.state === 'active' && o.expiry <= now()) throw new Error(OPTIONS_ERRORS[109])
      const a = this.liveAsk(id)
      if (!a) throw new Error(OPTIONS_ERRORS[120])
      if (buyer === o.holder || buyer === o.writer) throw new Error(OPTIONS_ERRORS[111])
      if (a.askTotal > maxTotal) throw new Error(OPTIONS_ERRORS[121])
      this.need(buyer, o.quote, a.askTotal)
      return () => {
        this.move(o.quote, buyer, a.holder, a.askTotal)
        o.holder = buyer
        this.asks.delete(id)
      }
    })
  }

  // ---- buyer requests (bids)

  private findBid(id: bigint): Bid {
    const b = this.bids.find((x) => x.id === id)
    if (!b) throw new Error('Request not found.')
    return b
  }

  private bidWithExpiry(b: Bid): Bid {
    return b.state === 'open' && b.expiry <= now() ? { ...b, state: 'expired' } : { ...b }
  }

  private openBidsOf(buyer: string, underlying?: string): number {
    return this.bids.filter((b) => b.buyer === buyer && b.state === 'open' && b.expiry > now() && (!underlying || b.underlying.contractId === underlying)).length
  }

  async listBids(): Promise<Bid[]> {
    await delay(100)
    this.failRead('listBids')
    return this.bids.map((b) => this.bidWithExpiry(b))
  }

  async getBid(id: bigint) {
    return this.bidWithExpiry(this.findBid(id))
  }

  async buyerOpenCount(buyer: string) {
    return this.openBidsOf(buyer)
  }

  async createBid(bid: NewBid, buyer: string, opts?: TxOptions) {
    const { value: id, ...res } = await this.tx(opts, () => {
      if (bid.underlyingQty <= 0n || bid.totalStrike <= 0n || bid.totalPremium <= 0n || bid.expiry <= now()) throw new Error(OPTIONS_ERRORS[102])
      if (bid.expiry > now() + MAX_TENOR_SECONDS) throw new Error(OPTIONS_ERRORS[119])
      if (!this.isListed(bid.underlying)) throw new Error(OPTIONS_ERRORS[103])
      if (this.openBidsOf(buyer, bid.underlying.contractId) >= MAX_OPEN_BIDS_PER_BUYER) throw new Error(OPTIONS_ERRORS[125])
      this.need(buyer, this.quote, bid.totalPremium)
      return () => {
        const id = BigInt(this.bids.length)
        this.move(this.quote, buyer, MOCK_CONTRACT, bid.totalPremium)
        this.bids.push({ ...bid, id, buyer, quote: this.quote, state: 'open', optionId: null })
        return id
      }
    })
    return { ...res, id }
  }

  // Allowed after expiry (refunds the escrowed premium).
  cancelBid(id: bigint, buyer: string, opts?: TxOptions): Promise<TxResult> {
    return this.simple(opts, () => {
      const b = this.findBid(id)
      if (b.buyer !== buyer) throw new Error(OPTIONS_ERRORS[123])
      if (b.state !== 'open') throw new Error(OPTIONS_ERRORS[122])
      return () => {
        this.move(b.quote, MOCK_CONTRACT, buyer, b.totalPremium)
        b.state = 'cancelled'
      }
    })
  }

  // Check order: NotFound -> BidNotOpen (122) -> Expired (109) -> SelfTrade (111). The writer locks the collateral
  // and receives the escrowed premium; the option starts Active with the buyer as holder.
  async fillBid(id: bigint, writer: string, opts?: TxOptions) {
    const { value: optionId, ...res } = await this.tx(opts, () => {
      const b = this.findBid(id)
      if (b.state !== 'open') throw new Error(OPTIONS_ERRORS[122])
      if (b.expiry <= now()) throw new Error(OPTIONS_ERRORS[109])
      if (b.buyer === writer) throw new Error(OPTIONS_ERRORS[111])
      const lock = requiredCollateral(b)
      this.need(writer, lock.token, lock.amount)
      return () => {
        const optionId = BigInt(this.options.length)
        this.move(lock.token, writer, MOCK_CONTRACT, lock.amount)
        this.move(b.quote, MOCK_CONTRACT, writer, b.totalPremium)
        this.options.push({
          id: optionId,
          kind: b.kind,
          underlying: b.underlying,
          quote: b.quote,
          underlyingQty: b.underlyingQty,
          totalStrike: b.totalStrike,
          totalPremium: b.totalPremium,
          expiry: b.expiry,
          writer,
          holder: b.buyer,
          state: 'active',
        })
        b.state = 'filled'
        b.optionId = optionId
        return optionId
      }
    })
    return { ...res, optionId }
  }
}
