import { contract, rpc } from '@stellar/stellar-sdk'
import { describeError } from '../stellar/errors'
import { server } from '../stellar/rpc'
import { baseClientOptions, clientSigning, signAndSend } from '../stellar/signer'
import type { WalletSigner } from '../stellar/signer'
import { readBalance } from '../stellar/tokens'
import { collateralLines, expiryToU64, idToU32, assertI128, kindToAbi, optionFromAbi } from './abi'
import type { AbiConfig, AbiOptionData, AbiOptionType } from './abi'
import type { OptionsClient } from './client'
import type { CollateralHealth, NewOffer, OptionOffer, SupportedAssets, TokenInfo, TxResult } from './types'

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
}

type Bound = contract.Client & OptionsContract

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
  private tokens: Promise<Map<string, TokenInfo>> | null = null
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

  // SAC symbol()/decimals() are immutable, so cache them for the session.
  private tokenMap(): Promise<Map<string, TokenInfo>> {
    this.tokens ??= (async () => {
      const cfg = await this.config()
      const ids = [cfg.quote, ...cfg.underlyings]
      const infos = await Promise.all(
        ids.map(async (contractId): Promise<TokenInfo> => {
          const [code, decimals] = await Promise.all([
            server.queryContract<string>(contractId, 'symbol'),
            server.queryContract<number>(contractId, 'decimals'),
          ])
          return { contractId, code: String(code.result), decimals: Number(decimals.result) }
        }),
      )
      return new Map(infos.map((t) => [t.contractId, t]))
    })().catch((e: unknown) => {
      this.tokens = null
      throw e
    })
    return this.tokens
  }

  supportedAssets(): Promise<SupportedAssets> {
    return this.guard(async () => {
      const [cfg, tokens] = await Promise.all([this.config(), this.tokenMap()])
      return { quote: tokens.get(cfg.quote)!, underlyings: cfg.underlyings.map((u) => tokens.get(u)!) }
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

  // v1.2 capabilities, client only (no UI yet). transfer moves no tokens: payment is settled off-chain.
  transferHolder(id: bigint, holder: string, to: string) {
    return this.simple((c, n) => c.transfer({ holder, to, id: n }), id)
  }
  openIds(): Promise<bigint[]> {
    return this.guard(async () => (await this.read((c) => c.list_open())).map(BigInt))
  }
  extendTtl(ids: bigint[]) {
    return this.guard(async () => {
      const { hash, result } = await this.write((c) => c.extend_ttl({ ids: ids.map(idToU32) }))
      unwrap(result)
      return { hash }
    })
  }
}
