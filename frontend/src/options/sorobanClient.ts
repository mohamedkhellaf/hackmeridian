import { contract, rpc } from '@stellar/stellar-sdk'
import { describeError } from '../stellar/errors'
import { server } from '../stellar/rpc'
import { baseClientOptions, clientSigning, signAndSend } from '../stellar/signer'
import type { WalletSigner } from '../stellar/signer'
import { readBalance } from '../stellar/tokens'
import { askFromAbi, askTotalFromAbi, collateralLines, expiryToU64, idToU32, assertI128, kindToAbi, optionFromAbi } from './abi'
import type { AbiAsk, AbiConfig, AbiOptionData, AbiOptionType } from './abi'
import type { OptionsClient } from './client'
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

const nowSec = () => Math.floor(Date.now() / 1000)

export class SorobanOptionsClient implements OptionsClient {
  readonly isMock = false
  private bound: { key: string; p: Promise<Bound> } | null = null
  private tokenCache = new Map<string, Promise<TokenInfo>>()
  private cfg: Promise<AbiConfig> | null = null

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
      throw new Error(describeError(e), { cause: e })
    }
  }

  private async read<T>(call: (c: Bound) => Tx<T>): Promise<T> {
    const c = await this.client()
    const tx = await call(c)
    throwSimulationError(tx)
    return tx.result
  }

  private async write<T>(call: (c: Bound) => Tx<T>): Promise<{ hash: string; result: T }> {
    const c = await this.client()
    return signAndSend(await call(c))
  }

  private config(): Promise<AbiConfig> {
    this.cfg ??= this.read((c) => c.config()).catch((e: unknown) => {
      this.cfg = null
      throw e
    })
    return this.cfg
  }

  // SAC symbol()/decimals() are immutable, so cache them per token for the session.
  private tokenInfo(contractId: string): Promise<TokenInfo> {
    let p = this.tokenCache.get(contractId)
    if (!p) {
      p = Promise.all([
        server.queryContract<string>(contractId, 'symbol'),
        server.queryContract<number>(contractId, 'decimals'),
      ]).then(([code, decimals]) => ({ contractId, code: String(code.result), decimals: Number(decimals.result) }))
      const mine = p
      mine.catch(() => {
        if (this.tokenCache.get(contractId) === mine) this.tokenCache.delete(contractId)
      })
      this.tokenCache.set(contractId, p)
    }
    return p
  }

  // Underlying token ids. v1.3+: the live registry from list_assets (assets can be listed at runtime, so this is
  // not cached). v1.2: the constructor-time list from config().
  private async underlyingIds(): Promise<string[]> {
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
    return this.guard(async () => {
      const [count, tokens] = await Promise.all([this.read((c) => c.option_count()), this.tokenMap()])
      const now = nowSec()
      const raws: AbiOptionData[] = []
      while (raws.length < count) {
        const page = await this.read((c) => c.get_options({ from: raws.length, limit: PAGE }))
        if (page.length === 0) break
        raws.push(...page)
      }
      return raws.map((r) => optionFromAbi(r, tokens, now))
    })
  }

  openCollateral() {
    return this.guard(async () => collateralLines(await this.listOptions()))
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

  createOffer(offer: NewOffer, writer: string): Promise<TxResult & { id: bigint }> {
    return this.guard(async () => {
      const { hash, result } = await this.write((c) =>
        c.create_offer({
          writer,
          underlying: offer.underlying.contractId,
          option_type: kindToAbi(offer.kind),
          qty: assertI128(offer.underlyingQty),
          strike_total: assertI128(offer.totalStrike),
          premium_total: assertI128(offer.totalPremium),
          expiry: expiryToU64(offer.expiry),
        }),
      )
      return { hash, id: BigInt(unwrap(result)) }
    })
  }

  private simple(call: (c: Bound, id: number) => Tx<MaybeResult<null>>, id: bigint): Promise<TxResult> {
    return this.guard(async () => {
      const { hash, result } = await this.write((c) => call(c, idToU32(id)))
      unwrap(result)
      return { hash }
    })
  }

  buy(id: bigint, buyer: string) {
    return this.simple((c, n) => c.buy({ buyer, id: n }), id)
  }
  exercise(id: bigint, holder: string) {
    return this.simple((c, n) => c.exercise({ holder, id: n }), id)
  }
  reclaim(id: bigint, writer: string) {
    return this.simple((c, n) => c.reclaim({ writer, id: n }), id)
  }
  cancelOffer(id: bigint, writer: string) {
    return this.simple((c, n) => c.cancel_offer({ writer, id: n }), id)
  }
  claimDelivery(id: bigint, writer: string) {
    return this.simple((c, n) => c.claim_delivery({ writer, id: n }), id)
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
  private resaleWrite(call: (c: Bound, id: number) => Tx<MaybeResult<null>>, id: bigint): Promise<TxResult> {
    return this.simple((c, n) => {
      if (!has(c, 'list_for_sale')) throw new Error('This contract version has no resale (needs v1.4).')
      return call(c, n)
    }, id)
  }
  listForSale(id: bigint, holder: string, askTotal: bigint) {
    return this.resaleWrite((c, n) => c.list_for_sale!({ holder, id: n, ask_total: assertI128(askTotal) }), id)
  }
  cancelSale(id: bigint, holder: string) {
    return this.resaleWrite((c, n) => c.cancel_sale!({ holder, id: n }), id)
  }
  buyResale(id: bigint, buyer: string, maxTotal: bigint) {
    return this.resaleWrite((c, n) => c.buy_resale!({ buyer, id: n, max_total: assertI128(maxTotal) }), id)
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
}
