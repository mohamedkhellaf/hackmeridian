import type { OptionsClient } from './client'
import { collateralLines, reservedOf } from './abi'
import { OPTIONS_ERRORS } from '../stellar/errors'
import { MAX_OPEN_PER_WRITER, MAX_TENOR_SECONDS } from './types'
import { MAX_OPEN_BIDS_PER_BUYER } from '../requests/types'
import type { Bid, NewBid } from '../requests/types'
import type { Ask, CollateralHealth, NewOffer, OptionOffer, TokenInfo, TxResult } from './types'

// In-memory stand-in for the options contract. Fictional assets and accounts,
// fake tx hashes. The UI shows a "mock data" banner while this is in use.

const USDX: TokenInfo = { contractId: 'C_MOCK_USDX', code: 'USDx', decimals: 7 }
const FUND: TokenInfo = { contractId: 'C_MOCK_FUND', code: 'FUND', decimals: 7 }
const BOND: TokenInfo = { contractId: 'C_MOCK_BOND', code: 'BOND', decimals: 7 }

const UNIT = 10_000_000n
const MAKER_A = 'GMAKERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const MAKER_B = 'GMAKERBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

const now = () => Math.floor(Date.now() / 1000)
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fakeHash = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')

function seed(): OptionOffer[] {
  const t = now()
  return [
    { id: 0n, kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * UNIT, totalStrike: 50n * UNIT, totalPremium: 2n * UNIT, expiry: t + 3 * 86400, writer: MAKER_A, holder: null, state: 'offered' },
    { id: 1n, kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * UNIT, totalStrike: 50n * UNIT, totalPremium: 18n * UNIT / 10n, expiry: t + 3 * 86400, writer: MAKER_B, holder: null, state: 'offered' },
    { id: 2n, kind: 'call', underlying: FUND, quote: USDX, underlyingQty: 3n * UNIT, totalStrike: 36n * UNIT, totalPremium: 15n * UNIT / 10n, expiry: t + 7 * 86400, writer: MAKER_A, holder: null, state: 'offered' },
    { id: 3n, kind: 'put', underlying: BOND, quote: USDX, underlyingQty: 10n * UNIT, totalStrike: 980n * UNIT, totalPremium: 12n * UNIT, expiry: t + 14 * 86400, writer: MAKER_B, holder: null, state: 'offered' },
  ]
}

export class MockOptionsClient implements OptionsClient {
  readonly isMock = true
  private options = seed()
  // Resale asks by option id (contract v1.4 semantics; the mock moves no tokens).
  private asks = new Map<bigint, { holder: string; askTotal: bigint }>()
  // Buyer requests (contract v1.5 semantics; the mock moves no tokens). Stored state is open/filled/cancelled;
  // 'expired' is derived on read like options.
  private bids: Bid[] = []

  private find(id: bigint): OptionOffer {
    const o = this.options.find((x) => x.id === id)
    if (!o) throw new Error(OPTIONS_ERRORS[101])
    return o
  }

  private async tx(mutate: () => void): Promise<TxResult> {
    await delay(600)
    mutate()
    return { hash: fakeHash() }
  }

  private withExpiry(o: OptionOffer): OptionOffer {
    return (o.state === 'active' || o.state === 'offered') && o.expiry <= now() ? { ...o, state: 'expired' } : { ...o }
  }

  async supportedAssets() {
    return { quote: USDX, underlyings: [FUND, BOND] }
  }

  async listOptions() {
    await delay(150)
    return this.options.map((o) => this.withExpiry(o))
  }

  async getOption(id: bigint) {
    return this.withExpiry(this.find(id))
  }

  async openCollateral() {
    return collateralLines(this.options.map((x) => this.withExpiry(x)))
  }

  // The mock contract is never clawed back: held always equals reserved.
  async collateralHealth(): Promise<CollateralHealth[]> {
    return collateralLines(this.options.map((x) => this.withExpiry(x))).map((l) => ({
      token: l.token,
      reserved: reservedOf(l),
      held: reservedOf(l),
    }))
  }

  async isEligible(_token: string, _who: string) {
    return true
  }

  async writerOpenCount(writer: string) {
    return this.options.filter((o) => o.writer === writer && o.state === 'offered' && o.expiry > now()).length
  }

  async createOffer(offer: NewOffer, writer: string) {
    let id = 0n
    const res = await this.tx(() => {
      if (offer.underlyingQty <= 0n || offer.totalStrike <= 0n || offer.totalPremium <= 0n) throw new Error('Amounts must be positive')
      if (offer.expiry <= now()) throw new Error('Expiry must be in the future')
      if (offer.expiry > now() + MAX_TENOR_SECONDS) throw new Error(OPTIONS_ERRORS[119])
      if (this.options.filter((o) => o.writer === writer && o.state === 'offered' && o.expiry > now()).length >= MAX_OPEN_PER_WRITER)
        throw new Error(OPTIONS_ERRORS[116])
      id = BigInt(this.options.length)
      this.options.push({ ...offer, id, quote: USDX, writer, holder: null, state: 'offered' })
    })
    return { ...res, id }
  }

  buy(id: bigint, buyer: string) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.state !== 'offered') throw new Error('Offer is no longer available')
      if (o.expiry <= now()) throw new Error('Offer has expired')
      if (o.writer === buyer) throw new Error('You cannot buy your own offer')
      o.holder = buyer
      o.state = 'active'
    })
  }

  exercise(id: bigint, holder: string) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.holder !== holder) throw new Error('Only the holder can exercise')
      if (o.state !== 'active') throw new Error('Option is not active')
      if (o.expiry <= now()) throw new Error('Option has expired')
      o.state = 'exercised'
      this.asks.delete(id)
    })
  }

  reclaim(id: bigint, writer: string) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.writer !== writer) throw new Error('Only the writer can reclaim')
      if (o.expiry > now()) throw new Error('Option has not expired yet')
      if (o.state !== 'offered' && o.state !== 'active') throw new Error('Nothing to reclaim')
      o.state = 'reclaimed'
    })
  }

  claimDelivery(id: bigint, writer: string) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.writer !== writer) throw new Error('Only the writer can claim')
      if (o.state !== 'exercised') throw new Error('Nothing to claim')
      o.state = 'settled'
    })
  }

  // Allowed for unsold offers before or after expiry (ABI cancel_offer).
  cancelOffer(id: bigint, writer: string) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.writer !== writer) throw new Error('Only the writer can cancel')
      if (o.state !== 'offered') throw new Error('Only open offers can be cancelled')
      o.state = 'cancelled'
    })
  }

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
    const out: Ask[] = []
    for (const id of [...this.asks.keys()].sort((a, b) => (a < b ? -1 : 1))) {
      const a = this.liveAsk(id)
      if (a) out.push({ id, holder: a.holder, askTotal: a.askTotal })
    }
    return out
  }

  async getAsk(id: bigint) {
    return this.liveAsk(id)?.askTotal ?? null
  }

  // Check order matches the contract: NotFound -> WrongState -> NotHolder -> Expired -> InvalidArgs.
  listForSale(id: bigint, holder: string, askTotal: bigint) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.state !== 'active') throw new Error(OPTIONS_ERRORS[106])
      if (o.holder !== holder) throw new Error(OPTIONS_ERRORS[108])
      if (o.expiry <= now()) throw new Error(OPTIONS_ERRORS[109])
      if (askTotal <= 0n) throw new Error(OPTIONS_ERRORS[102])
      this.asks.set(id, { holder, askTotal })
    })
  }

  // Allowed after expiry (only removes the ask).
  cancelSale(id: bigint, holder: string) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.holder !== holder) throw new Error(OPTIONS_ERRORS[108])
      const a = this.asks.get(id)
      if (!a || a.holder !== o.holder || o.state !== 'active') throw new Error(OPTIONS_ERRORS[120])
      this.asks.delete(id)
    })
  }

  // Pays at most `maxTotal`: a re-priced ask fails with PriceMoved (121) instead of charging more.
  buyResale(id: bigint, buyer: string, maxTotal: bigint) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.state === 'active' && o.expiry <= now()) throw new Error(OPTIONS_ERRORS[109])
      const a = this.liveAsk(id)
      if (!a) throw new Error(OPTIONS_ERRORS[120])
      if (buyer === o.holder || buyer === o.writer) throw new Error(OPTIONS_ERRORS[111])
      if (a.askTotal > maxTotal) throw new Error(OPTIONS_ERRORS[121])
      o.holder = buyer
      this.asks.delete(id)
    })
  }
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
    return this.bids.map((b) => this.bidWithExpiry(b))
  }

  async getBid(id: bigint) {
    return this.bidWithExpiry(this.findBid(id))
  }

  async buyerOpenCount(buyer: string) {
    return this.openBidsOf(buyer)
  }

  async createBid(bid: NewBid, buyer: string) {
    let id = 0n
    const res = await this.tx(() => {
      if (bid.underlyingQty <= 0n || bid.totalStrike <= 0n || bid.totalPremium <= 0n || bid.expiry <= now()) throw new Error(OPTIONS_ERRORS[102])
      if (bid.expiry > now() + MAX_TENOR_SECONDS) throw new Error(OPTIONS_ERRORS[119])
      if (![FUND, BOND].some((t) => t.contractId === bid.underlying.contractId)) throw new Error(OPTIONS_ERRORS[103])
      if (this.openBidsOf(buyer, bid.underlying.contractId) >= MAX_OPEN_BIDS_PER_BUYER) throw new Error(OPTIONS_ERRORS[125])
      id = BigInt(this.bids.length)
      this.bids.push({ ...bid, id, buyer, quote: USDX, state: 'open', optionId: null })
    })
    return { ...res, id }
  }

  // Allowed after expiry (refunds the escrowed premium).
  cancelBid(id: bigint, buyer: string) {
    return this.tx(() => {
      const b = this.findBid(id)
      if (b.buyer !== buyer) throw new Error(OPTIONS_ERRORS[123])
      if (b.state !== 'open') throw new Error(OPTIONS_ERRORS[122])
      b.state = 'cancelled'
    })
  }

  // Check order: NotFound -> BidNotOpen (122) -> Expired (109) -> SelfTrade (111).
  async fillBid(id: bigint, writer: string) {
    let optionId = 0n
    const res = await this.tx(() => {
      const b = this.findBid(id)
      if (b.state !== 'open') throw new Error(OPTIONS_ERRORS[122])
      if (b.expiry <= now()) throw new Error(OPTIONS_ERRORS[109])
      if (b.buyer === writer) throw new Error(OPTIONS_ERRORS[111])
      optionId = BigInt(this.options.length)
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
    })
    return { ...res, optionId }
  }
}
