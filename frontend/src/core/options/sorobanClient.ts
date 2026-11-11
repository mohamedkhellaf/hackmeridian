import { contract, rpc } from '@stellar/stellar-sdk'
import { parseSacName } from '../assetfacts/assetFacts'
import { describeError } from '../stellar/errors'
import { server } from '../stellar/rpc'
import { baseClientOptions, checkTransaction, clientSigning, signAndSend } from '../stellar/signer'
import type { WalletSigner } from '../stellar/signer'
import { readBalance, readBalances } from '../stellar/tokens'
import type { TokenBalance } from '../stellar/tokens'
import { nowSec } from '../time'
import { TxError } from '../tx/errors'
import type { TxCheck, TxOptions } from '../tx/types'
import { askFromAbi, askTotalFromAbi, collateralLines, expiryToU64, idToU32, assertI128, kindToAbi, optionFromAbi } from './abi'
import type { AbiAsk, AbiConfig, AbiOptionData, AbiOptionType } from './abi'
import type { OptionsClient } from './client'
import { bidFromAbi } from '../requests/abi'
import type { AbiBid } from '../requests/abi'
import type { Bid, NewBid } from '../requests/types'
import type { Ask, CollateralHealth, NewOffer, OptionOffer, SupportedAssets, TokenInfo, TxResult } from './types'

// Hand-written typed view of the `options` contract (docs/contract-abi.md section 3), shaped like the
// code `stellar contract bindings typescript` generates: named-argument objects, AssembledTransaction
// results. Methods returning Result<T, Error> are unwrapped by `unwrap` below. Checked against the
// deployed v1.2 spec (`stellar contract info interface`, 2026-10-26): names, argument order and types match
// exactly, so we keep this hand-written view instead of vendoring generated bindings.
type Tx<T> = Promise<contract.AssembledTransaction<T>>
type Opt = contract.MethodOptions
type MaybeResult<T> = T | { isOk?: () => boolean; isErr?: () => boolean; unwrap?: () => T; unwrapErr?: () => unknown }

interface OptionsContract {
  config: (o?: Opt) => Tx<AbiConfig>
  get_option: (a: { id: number }, o?: Opt) => Tx<MaybeResult<AbiOptionData>>
  option_count: (o?: Opt) => Tx<number>
  open_collateral: (a: { token: string }, o?: Opt) => Tx<bigint>
  is_eligible: (a: { token: string; who: string }, o?: Opt) => Tx<boolean>
  list_open: (o?: Opt) => Tx<number[]>
  get_options: (a: { from: number; limit: number }, o?: Opt) => Tx<AbiOptionData[]>
  extend_ttl: (a: { ids: number[] }, o?: Opt) => Tx<MaybeResult<null>>
  transfer: (a: { holder: string; to: string; id: number }, o?: Opt) => Tx<MaybeResult<null>>
  create_offer: (
    a: {
      writer: string
      underlying: string
      option_type: AbiOptionType
      qty: bigint
      strike_total: bigint
      premium_total: bigint
      expiry: bigint
    },
    o?: Opt,
  ) => Tx<MaybeResult<number>>
  buy: (a: { buyer: string; id: number }, o?: Opt) => Tx<MaybeResult<null>>
  exercise: (a: { holder: string; id: number }, o?: Opt) => Tx<MaybeResult<null>>
  cancel_offer: (a: { writer: string; id: number }, o?: Opt) => Tx<MaybeResult<null>>
  reclaim: (a: { writer: string; id: number }, o?: Opt) => Tx<MaybeResult<null>>
  claim_delivery: (a: { writer: string; id: number }, o?: Opt) => Tx<MaybeResult<null>>
  // v1.3+. Absent on a v1.2 contract: feature-detect with `has` before calling.
  asset_count?: (o?: Opt) => Tx<number>
  list_assets?: (a: { from: number; limit: number }, o?: Opt) => Tx<string[]>
  is_listed?: (a: { token: string }, o?: Opt) => Tx<boolean>
  writer_open_count?: (a: { writer: string }, o?: Opt) => Tx<number>
  list_asset?: (a: { lister: string; code: string; issuer: string }, o?: Opt) => Tx<MaybeResult<string>>
  // v1.3 takes only `ids`; v1.3.1 adds a leading `pruner` (require_auth). Returns the number pruned.
  prune_expired?: (a: { pruner?: string; ids: number[] }, o?: Opt) => Tx<MaybeResult<number>>
  // v1.3.1+
  list_open_for?: (a: { asset: string; from: number; limit: number }, o?: Opt) => Tx<number[]>
  // v1.4 resale
  list_for_sale?: (a: { holder: string; id: number; ask_total: bigint }, o?: Opt) => Tx<MaybeResult<null>>
  cancel_sale?: (a: { holder: string; id: number }, o?: Opt) => Tx<MaybeResult<null>>
  buy_resale?: (a: { buyer: string; id: number; max_total: bigint }, o?: Opt) => Tx<MaybeResult<null>>
  get_ask?: (a: { id: number }, o?: Opt) => Tx<bigint | null | undefined>
  list_asks?: (a: { from: number; limit: number }, o?: Opt) => Tx<AbiAsk[]>
  // v1.5 buyer requests (bids)
  create_bid?: (
    a: {
      buyer: string
      kind: AbiOptionType
      underlying: string
      quote: string
      qty: bigint
      strike_total: bigint
      premium_total: bigint
      expiry: bigint
    },
    o?: Opt,
  ) => Tx<MaybeResult<number>>
  cancel_bid?: (a: { buyer: string; id: number }, o?: Opt) => Tx<MaybeResult<null>>
  fill_bid?: (a: { writer: string; id: number }, o?: Opt) => Tx<MaybeResult<number>>
  prune_bids?: (a: { pruner: string; ids: number[] }, o?: Opt) => Tx<MaybeResult<number>>
  get_bid?: (a: { id: number }, o?: Opt) => Tx<MaybeResult<AbiBid>>
  get_bids?: (a: { from: number; limit: number }, o?: Opt) => Tx<AbiBid[]>
  bid_count?: (o?: Opt) => Tx<number>
  list_open_bids_for?: (a: { asset: string; from: number; limit: number }, o?: Opt) => Tx<number[]>
  buyer_open_count?: (a: { buyer: string }, o?: Opt) => Tx<number>
}

type Bound = contract.Client & OptionsContract
type V13Fn =
  | 'asset_count'
  | 'list_assets'
  | 'is_listed'
  | 'writer_open_count'
  | 'list_asset'
  | 'prune_expired'
  | 'list_open_for'
  | 'list_for_sale'
  | 'cancel_sale'
  | 'buy_resale'
  | 'get_ask'
  | 'list_asks'
  | 'bid_count'
  | 'buyer_open_count'

// The generated client only has methods for functions in the deployed contract's spec, so presence of the
// method is the feature flag: the same build runs against v1.2 and v1.3(.1).
const has = (c: Bound, fn: V13Fn): boolean => typeof c[fn] === 'function'

// Generated bindings wrap `Result<T, Error>` in Ok/Err; plain values pass through.
export function unwrap<T>(r: MaybeResult<T>): T {
  if (r && typeof r === 'object' && 'isErr' in r && typeof r.isErr === 'function') {
    if (r.isErr()) {
      const err = r.unwrapErr?.() as { message?: string } | undefined
      throw new Error(err?.message ?? 'Contract returned an error')
    }
    return r.unwrap!()
  }
  return r as T
}

// A failed Result<T, Error> simulation: the SDK maps it to Err(doc text) and drops the numeric code, but keeps
// the raw host error ("Error(Contract, #101)") in `simulation.error`. Rethrow that so errors.ts can decode it.
function throwSimulationError(tx: contract.AssembledTransaction<unknown>): void {
  const sim = tx.simulation
  if (sim && rpc.Api.isSimulationError(sim)) throw new Error(sim.error)
}

const PAGE = 50 // contract MAX_PAGE

/** The asset registry can grow at runtime (list_asset), but rarely: re-read it at most this often. */
const ASSETS_TTL_MS = 30_000

export class SorobanOptionsClient implements OptionsClient {
  readonly isMock = false
  private bound: { key: string; p: Promise<Bound> } | null = null
  private tokenCache = new Map<string, Promise<TokenInfo>>()
  private cfg: Promise<AbiConfig> | null = null
  private assetIds: { at: number; p: Promise<string[]> } | null = null
  /** Reads in flight, so the queries of one refresh round share one RPC pass instead of repeating it. */
  private inflight = new Map<string, Promise<unknown>>()

  private readonly contractId: string
  private readonly wallet: WalletSigner

  constructor(contractId: string, wallet: WalletSigner) {
    this.contractId = contractId
    this.wallet = wallet
  }

  // The signing options capture the wallet address, so rebuild when it changes.
  private client(): Promise<Bound> {
    const key = this.wallet.address ?? ''
    if (!this.bound || this.bound.key !== key) {
      const p = contract.Client.from<OptionsContract>({
        contractId: this.contractId,
        ...baseClientOptions,
        ...clientSigning(this.wallet),
      }) as Promise<Bound>
      p.catch(() => {
        if (this.bound?.p === p) this.bound = null
      })
      this.bound = { key, p }
    }
    return this.bound.p
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof TxError) throw e // already described, and its kind matters to the caller
      throw new Error(describeError(e), { cause: e })
    }
  }

  /** One call per key at a time: concurrent callers get the same promise. */
  private share<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const running = this.inflight.get(key) as Promise<T> | undefined
    if (running) return running
    const p = fn().finally(() => {
      if (this.inflight.get(key) === p) this.inflight.delete(key)
    })
    this.inflight.set(key, p)
    return p
  }

  private async read<T>(call: (c: Bound) => Tx<T>): Promise<T> {
    const c = await this.client()
    const tx = await call(c)
    throwSimulationError(tx)
    return tx.result
  }

  /**
   * simulate -> sign in the wallet -> send -> wait, reporting each stage. Anything that goes wrong before the
   * wallet signs (no account, a refused simulation) is a `refused` TxError: nothing was sent.
   */
  private async write<T>(call: (c: Bound) => Tx<T>, opts?: TxOptions): Promise<{ hash: string; result: T; ledger: number | null }> {
    if (!this.wallet.address) throw new TxError('refused', 'Connect a wallet first.')
    opts?.onStage?.({ stage: 'checking' })
    let tx: contract.AssembledTransaction<T>
    try {
      const c = await this.client()
      tx = await call(c)
      throwSimulationError(tx)
    } catch (e) {
      if (e instanceof TxError) throw e
      throw new TxError('refused', describeError(e), { cause: e })
    }
    return signAndSend(tx, { onStage: opts?.onStage })
  }

  private config(): Promise<AbiConfig> {
    this.cfg ??= this.read((c) => c.config()).catch((e: unknown) => {
      this.cfg = null
      throw e
    })
    return this.cfg
  }

  // SAC symbol()/decimals()/name() are immutable, so cache them per token for the session. name() is
  // "CODE:ISSUER" for a classic asset: the issuer tells same-code assets apart and enables trustline checks.
  private tokenInfo(contractId: string): Promise<TokenInfo> {
    let p = this.tokenCache.get(contractId)
    if (!p) {
      p = Promise.all([
        server.queryContract<string>(contractId, 'symbol'),
        server.queryContract<number>(contractId, 'decimals'),
        server.queryContract<string>(contractId, 'name').then(
          (r) => parseSacName(r.result),
          () => null, // the issuer is optional: a failed read must not hide the token
        ),
      ]).then(([code, decimals, sac]): TokenInfo => {
        const info: TokenInfo = { contractId, code: String(code.result), decimals: Number(decimals.result) }
        if (sac?.kind === 'issued') info.issuer = sac.issuer
        return info
      })
      const mine = p
      mine.catch(() => {
        if (this.tokenCache.get(contractId) === mine) this.tokenCache.delete(contractId)
      })
      this.tokenCache.set(contractId, p)
    }
    return p
  }

  // Underlying token ids. v1.3+: the live registry from list_assets. Assets can be listed at runtime, so the
  // list is cached for 30 s only (it was re-read four times per refresh round). v1.2: the constructor-time list.
  private underlyingIds(): Promise<string[]> {
    const hit = this.assetIds
    if (hit && Date.now() - hit.at < ASSETS_TTL_MS) return hit.p
    const p = this.readUnderlyingIds()
    this.assetIds = { at: Date.now(), p }
    p.catch(() => {
      if (this.assetIds?.p === p) this.assetIds = null
    })
    return p
  }

  private async readUnderlyingIds(): Promise<string[]> {
    const c = await this.client()
    if (!has(c, 'asset_count') || !has(c, 'list_assets')) return (await this.config()).underlyings
    const count = await this.read((x) => x.asset_count!())
    const ids: string[] = []
    while (ids.length < count) {
      const page = await this.read((x) => x.list_assets!({ from: ids.length, limit: PAGE }))
      if (page.length === 0) break
      ids.push(...page)
    }
    return ids.length > 0 ? ids : (await this.config()).underlyings
  }

  private async tokenMap(): Promise<Map<string, TokenInfo>> {
    const [cfg, ids] = await Promise.all([this.config(), this.underlyingIds()])
    const infos = await Promise.all([...new Set([cfg.quote, ...ids])].map((id) => this.tokenInfo(id)))
    return new Map(infos.map((t) => [t.contractId, t]))
  }

  supportedAssets(): Promise<SupportedAssets> {
    return this.guard(async () => {
      const [cfg, ids] = await Promise.all([this.config(), this.underlyingIds()])
      const [quote, underlyings] = await Promise.all([this.tokenInfo(cfg.quote), Promise.all(ids.map((id) => this.tokenInfo(id)))])
      return { quote, underlyings }
    })
  }

  // v1.3+: number of open (Offered) offers by this writer, capped at MAX_OPEN_PER_WRITER. null on a v1.2 contract.
  writerOpenCount(writer: string): Promise<number | null> {
    return this.guard(async () => {
      const c = await this.client()
      if (!has(c, 'writer_open_count')) return null
      return this.read((x) => x.writer_open_count!({ writer }))
    })
  }

  getOption(id: bigint): Promise<OptionOffer> {
    return this.guard(async () => {
      const [raw, tokens] = await Promise.all([
        this.read((c) => c.get_option({ id: idToU32(id) })),
        this.tokenMap(),
      ])
      return optionFromAbi(unwrap(raw), tokens, nowSec())
    })
  }

  // All options ever created (positions need non-open ones too). v1.2 get_options pages 50 at a time
  // (MAX_PAGE), so this is ceil(n/50) simulations instead of 1+n.
  listOptions(): Promise<OptionOffer[]> {
    return this.share('options', () =>
      this.guard(async () => {
        const [count, tokens] = await Promise.all([this.read((c) => c.option_count()), this.tokenMap()])
        const now = nowSec()
        const raws: AbiOptionData[] = []
        while (raws.length < count) {
          const page = await this.read((c) => c.get_options({ from: raws.length, limit: PAGE }))
          if (page.length === 0) break
          raws.push(...page)
        }
        return raws.map((r) => optionFromAbi(r, tokens, now))
      }),
    )
  }

  // Shares the option and request reads of the same refresh round. A failed bids read only drops the escrow column.
  openCollateral() {
    return this.guard(async () => {
      const [options, bids] = await Promise.all([this.listOptions(), this.listBids().catch(() => null)])
      return collateralLines(options, bids)
    })
  }

  balances(who: string, tokens?: TokenInfo[]): Promise<TokenBalance[]> {
    return this.guard(async () => {
      let list = tokens
      if (!list) {
        const assets = await this.supportedAssets()
        list = [assets.quote, ...assets.underlyings]
      }
      return readBalances(list, who)
    })
  }

  async checkTx(hash: string, maxTime: number | null): Promise<TxCheck> {
    const r = await checkTransaction(server, hash, maxTime)
    if (r.status === 'confirmed') return { status: 'confirmed', ledger: r.ledger }
    if (r.status === 'failed') return { status: 'failed', message: r.message }
    return { status: r.status }
  }

  collateralHealth(): Promise<CollateralHealth[]> {
    return this.guard(async () => {
      const assets = await this.supportedAssets()
      return Promise.all(
        [assets.quote, ...assets.underlyings].map(async (token) => {
          const [reserved, held] = await Promise.all([
            this.read((c) => c.open_collateral({ token: token.contractId })),
            readBalance(token.contractId, this.contractId),
          ])
          return { token, reserved: BigInt(reserved), held }
        }),
      )
    })
  }

  isEligible(token: string, who: string): Promise<boolean> {
    return this.guard(() => this.read((c) => c.is_eligible({ token, who })))
  }

  createOffer(offer: NewOffer, writer: string, opts?: TxOptions): Promise<TxResult & { id: bigint }> {
    return this.guard(async () => {
      const { hash, ledger, result } = await this.write(
        (c) =>
          c.create_offer({
            writer,
            underlying: offer.underlying.contractId,
            option_type: kindToAbi(offer.kind),
            qty: assertI128(offer.underlyingQty),
            strike_total: assertI128(offer.totalStrike),
            premium_total: assertI128(offer.totalPremium),
            expiry: expiryToU64(offer.expiry),
          }),
        opts,
      )
      return { hash, ledger, id: BigInt(unwrap(result)) }
    })
  }

  private simple(call: (c: Bound, id: number) => Tx<MaybeResult<null>>, id: bigint, opts?: TxOptions): Promise<TxResult> {
    return this.guard(async () => {
      const { hash, ledger, result } = await this.write((c) => call(c, idToU32(id)), opts)
      unwrap(result)
      return { hash, ledger }
    })
  }

  buy(id: bigint, buyer: string, opts?: TxOptions) {
    return this.simple((c, n) => c.buy({ buyer, id: n }), id, opts)
  }
  exercise(id: bigint, holder: string, opts?: TxOptions) {
    return this.simple((c, n) => c.exercise({ holder, id: n }), id, opts)
  }
  reclaim(id: bigint, writer: string, opts?: TxOptions) {
    return this.simple((c, n) => c.reclaim({ writer, id: n }), id, opts)
  }
  cancelOffer(id: bigint, writer: string, opts?: TxOptions) {
    return this.simple((c, n) => c.cancel_offer({ writer, id: n }), id, opts)
  }
  // Both kinds: a put writer claims the delivered underlying, a call writer the strike paid in the quote token.
  claimDelivery(id: bigint, writer: string, opts?: TxOptions) {
    return this.simple((c, n) => c.claim_delivery({ writer, id: n }), id, opts)
  }

  // v1.4 resale. Feature-detected: on an older contract listAsks is null and the UI hides resale.
  listAsks(): Promise<Ask[] | null> {
    return this.guard(async () => {
      const c = await this.client()
      if (!has(c, 'list_asks')) return null
      const count = await this.read((x) => x.option_count())
      const out: Ask[] = []
      // list_asks scans ids from..from+limit and returns only those with an ask, so advance by PAGE, not by length.
      for (let from = 0; from < count; from += PAGE) {
        const page = await this.read((x) => x.list_asks!({ from, limit: PAGE }))
        out.push(...page.map(askFromAbi))
      }
      return out
    })
  }
  getAsk(id: bigint): Promise<bigint | null> {
    return this.guard(async () => {
      const c = await this.client()
      if (!has(c, 'get_ask')) return null
      return askTotalFromAbi(await this.read((x) => x.get_ask!({ id: idToU32(id) })))
    })
  }
  // The SDK only binds functions in the deployed spec; a pre-v1.4 contract has no resale functions.
  private resaleWrite(call: (c: Bound, id: number) => Tx<MaybeResult<null>>, id: bigint, opts?: TxOptions): Promise<TxResult> {
    return this.simple(
      (c, n) => {
        if (!has(c, 'list_for_sale')) throw new Error('This contract version has no resale (needs v1.4).')
        return call(c, n)
      },
      id,
      opts,
    )
  }
  listForSale(id: bigint, holder: string, askTotal: bigint, opts?: TxOptions) {
    return this.resaleWrite((c, n) => c.list_for_sale!({ holder, id: n, ask_total: assertI128(askTotal) }), id, opts)
  }
  cancelSale(id: bigint, holder: string, opts?: TxOptions) {
    return this.resaleWrite((c, n) => c.cancel_sale!({ holder, id: n }), id, opts)
  }
  buyResale(id: bigint, buyer: string, maxTotal: bigint, opts?: TxOptions) {
    return this.resaleWrite((c, n) => c.buy_resale!({ buyer, id: n, max_total: assertI128(maxTotal) }), id, opts)
  }

  // v1.2 capabilities, client only (no UI yet). transfer moves no tokens: payment is settled off-chain.
  transferHolder(id: bigint, holder: string, to: string) {
    return this.simple((c, n) => c.transfer({ holder, to, id: n }), id)
  }
  openIds(): Promise<bigint[]> {
    return this.guard(async () => (await this.read((c) => c.list_open())).map(BigInt))
  }
  // v1.3 capabilities, client only (no UI yet). list_asset is permissionless: it derives the canonical SAC of a
  // classic asset on chain (the issuer must still authorize the escrow). Returns the SAC address.
  listAsset(lister: string, code: string, issuer: string): Promise<TxResult & { sac: string }> {
    return this.guard(async () => {
      const c = await this.client()
      if (!has(c, 'list_asset')) throw new Error('This contract version cannot list assets (needs v1.3).')
      const { hash, result } = await this.write((x) => x.list_asset!({ lister, code, issuer }))
      return { hash, sac: unwrap(result) }
    })
  }
  isListed(token: string): Promise<boolean | null> {
    return this.guard(async () => {
      const c = await this.client()
      return has(c, 'is_listed') ? this.read((x) => x.is_listed!({ token })) : null
    })
  }
  // Anyone may prune expired offers. v1.3.1 takes a `pruner` (require_auth); v1.3 takes ids only.
  pruneExpired(ids: bigint[], pruner: string): Promise<TxResult & { pruned: number }> {
    return this.guard(async () => {
      const c = await this.client()
      if (!has(c, 'prune_expired')) throw new Error('This contract version cannot prune offers (needs v1.3).')
      const withPruner = c.spec.getFunc('prune_expired').inputs.length > 1
      const nums = ids.map(idToU32)
      const { hash, result } = await this.write((x) => x.prune_expired!(withPruner ? { pruner, ids: nums } : { ids: nums }))
      return { hash, pruned: Number(unwrap(result)) }
    })
  }
  extendTtl(ids: bigint[]) {
    return this.guard(async () => {
      const { hash, result } = await this.write((c) => c.extend_ttl({ ids: ids.map(idToU32) }))
      unwrap(result)
      return { hash }
    })
  }
  // v1.5 buyer requests (bids). Feature-detected on `bid_count`: null on an older contract, and the UI hides requests.
  listBids(): Promise<Bid[] | null> {
    return this.share('bids', () =>
      this.guard(async () => {
        const c = await this.client()
        if (!has(c, 'bid_count')) return null
        const [count, tokens] = await Promise.all([this.read((x) => x.bid_count!()), this.tokenMap()])
        const now = nowSec()
        const raws: AbiBid[] = []
        // get_bids returns at most min(limit, 50) bids from `from`; step by the page size until bid_count.
        for (let from = 0; from < count; from += PAGE) {
          const page = await this.read((x) => x.get_bids!({ from, limit: PAGE }))
          raws.push(...page)
        }
        return raws.map((r) => bidFromAbi(r, tokens, now))
      }),
    )
  }
  private async bidClient(): Promise<Bound> {
    const c = await this.client()
    if (!has(c, 'bid_count')) throw new Error('This contract version has no requests (needs v1.5).')
    return c
  }
  getBid(id: bigint): Promise<Bid> {
    return this.guard(async () => {
      await this.bidClient()
      const [raw, tokens] = await Promise.all([this.read((x) => x.get_bid!({ id: idToU32(id) })), this.tokenMap()])
      return bidFromAbi(unwrap(raw), tokens, nowSec())
    })
  }
  buyerOpenCount(buyer: string): Promise<number | null> {
    return this.guard(async () => {
      const c = await this.client()
      if (!has(c, 'buyer_open_count')) return null
      return this.read((x) => x.buyer_open_count!({ buyer }))
    })
  }
  createBid(bid: NewBid, buyer: string, opts?: TxOptions): Promise<TxResult & { id: bigint }> {
    return this.guard(async () => {
      await this.bidClient()
      const cfg = await this.config()
      const { hash, ledger, result } = await this.write(
        (c) =>
          c.create_bid!({
            buyer,
            kind: kindToAbi(bid.kind),
            underlying: bid.underlying.contractId,
            quote: cfg.quote,
            qty: assertI128(bid.underlyingQty),
            strike_total: assertI128(bid.totalStrike),
            premium_total: assertI128(bid.totalPremium),
            expiry: expiryToU64(bid.expiry),
          }),
        opts,
      )
      return { hash, ledger, id: BigInt(unwrap(result)) }
    })
  }
  cancelBid(id: bigint, buyer: string, opts?: TxOptions): Promise<TxResult> {
    return this.guard(async () => {
      await this.bidClient()
      const { hash, ledger, result } = await this.write((c) => c.cancel_bid!({ buyer, id: idToU32(id) }), opts)
      unwrap(result)
      return { hash, ledger }
    })
  }
  fillBid(id: bigint, writer: string, opts?: TxOptions): Promise<TxResult & { optionId: bigint }> {
    return this.guard(async () => {
      await this.bidClient()
      const { hash, ledger, result } = await this.write((c) => c.fill_bid!({ writer, id: idToU32(id) }), opts)
      return { hash, ledger, optionId: BigInt(unwrap(result)) }
    })
  }
  // Client only (no UI yet): anyone may prune expired Open requests, which refunds the escrowed premium.
  pruneBids(ids: bigint[], pruner: string): Promise<TxResult & { pruned: number }> {
    return this.guard(async () => {
      await this.bidClient()
      const { hash, result } = await this.write((c) => c.prune_bids!({ pruner, ids: ids.map(idToU32) }))
      return { hash, pruned: Number(unwrap(result)) }
    })
  }
}
