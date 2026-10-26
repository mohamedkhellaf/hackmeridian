// On-chain Strata Pro client: contracts/pro on Testnet, read through simulated view calls and written through the
// connected wallet (simulate -> sign -> send), like the Covered options client (src/options/sorobanClient.ts).
// Encoding goes through the contract spec (proSpec.ts) with explicit i128/u32/u64 argument types; amounts stay
// bigint integer units end to end. Margin figures come from the contract's views (get_requirement, vault_value);
// the few values without a view are derived exactly as the fixture client does and are marked where they are made.
import { contract, rpc } from '@stellar/stellar-sdk'
import { config } from '../config'
import { describeError } from '../stellar/errors'
import { clientSigning } from '../stellar/signer'
import type { WalletSigner } from '../stellar/signer'
import { readBalance } from '../stellar/tokens'
import { proErrorName } from './errors'
import {
  bookFromAbi,
  configFromAbi,
  i128,
  offerFromAbi,
  positionFromAbi,
  proCodeOf,
  requirementFromAbi,
  seriesFromAbi,
  shortsFromAbi,
  u32,
  u64,
  writerArg,
} from './proAbi'
import type {
  AbiAccount,
  AbiBook,
  AbiClaimResult,
  AbiExerciseResult,
  AbiMarketConfig,
  AbiOffer,
  AbiPosition,
  AbiRequirement,
  AbiSeries,
  AbiSettleResult,
  AbiSnapshot,
  AbiTakeoverResult,
  AbiVault,
  AbiVaultSettleResult,
} from './proAbi'
import { PRO_SPEC } from './proSpec'
import type { AccountView, CallResult, ClaimResult, HistoryEntry, OfferParams, Party, ProClient, ProModel, Requirement } from './types'
import { VAULT } from './types'

type Tx<T> = Promise<contract.AssembledTransaction<T>>
type Opt = contract.MethodOptions
type Res<T> = T | { isOk?: () => boolean; isErr?: () => boolean; unwrap?: () => T; unwrapErr?: () => unknown }

/** Typed view of the functions the UI uses (names and argument names from the contract spec). */
export interface ProContract {
  config: (o?: Opt) => Tx<AbiMarketConfig>
  quote: (o?: Opt) => Tx<string>
  series_count: (o?: Opt) => Tx<number>
  get_series: (a: { series_id: number }, o?: Opt) => Tx<Res<AbiSeries>>
  get_snapshot: (a: { series_id: number }, o?: Opt) => Tx<Res<AbiSnapshot>>
  get_offer: (a: { offer_id: number }, o?: Opt) => Tx<Res<AbiOffer>>
  get_position: (a: { pos_id: number }, o?: Opt) => Tx<Res<AbiPosition>>
  get_book: (a: { book_id: number }, o?: Opt) => Tx<Res<AbiBook>>
  get_account: (a: { who: string }, o?: Opt) => Tx<AbiAccount>
  get_vault: (o?: Opt) => Tx<AbiVault>
  vault_value: (o?: Opt) => Tx<Res<bigint>>
  get_requirement: (a: { who: ReturnType<typeof writerArg> }, o?: Opt) => Tx<Res<AbiRequirement>>
  lp_shares: (a: { lp: string }, o?: Opt) => Tx<bigint>
  total_shares: (o?: Opt) => Tx<bigint>
  deposit: (a: { who: string; amount: bigint }, o?: Opt) => Tx<Res<null>>
  withdraw: (a: { who: string; amount: bigint }, o?: Opt) => Tx<Res<null>>
  create_offer: (a: { writer: string; series_id: number; qty: bigint; premium: bigint; quote_expiry: bigint }, o?: Opt) => Tx<Res<number>>
  cancel_offer: (a: { writer: string; offer_id: number }, o?: Opt) => Tx<Res<null>>
  buy: (a: { buyer: string; offer_id: number }, o?: Opt) => Tx<Res<number>>
  exercise: (a: { holder: string; pos_id: number }, o?: Opt) => Tx<Res<AbiExerciseResult>>
  liquidate: (a: { caller: string; writer: string; taker: string | undefined }, o?: Opt) => Tx<Res<AbiTakeoverResult>>
  settle: (a: { book_id: number }, o?: Opt) => Tx<Res<AbiSettleResult>>
  settle_vault: (a: { series_id: number }, o?: Opt) => Tx<Res<AbiVaultSettleResult>>
  claim: (a: { holder: string; pos_id: number }, o?: Opt) => Tx<Res<AbiClaimResult>>
  lp_deposit: (a: { lp: string; amount: bigint }, o?: Opt) => Tx<Res<bigint>>
}
type Bound = contract.Client & ProContract

/** Contract error raised by a view or a write, carrying the Pro code when there is one. */
export class ProCallError extends Error {
  readonly code: number | null
  constructor(message: string, code: number | null) {
    super(message)
    this.code = code
  }
}

function unwrap<T>(r: Res<T>): T {
  if (r && typeof r === 'object' && 'isErr' in r && typeof r.isErr === 'function') {
    if (r.isErr()) {
      const err = r.unwrapErr?.() as { message?: string } | undefined
      throw new ProCallError(err?.message ?? 'Contract returned an error', null)
    }
    return r.unwrap!()
  }
  return r as T
}

/** A failed simulation keeps the raw host error ("Error(Contract, #209)") in `simulation.error`: rethrow it. */
function throwIfSimFailed(tx: contract.AssembledTransaction<unknown>): void {
  const sim = tx.simulation
  if (sim && rpc.Api.isSimulationError(sim)) throw new ProCallError(sim.error, proCodeOf(sim.error))
}

/** Maps any failure to the CallResult the UI shows: Pro codes by number, anything else as a plain note (code -1). */
export function failureOf(e: unknown): { ok: false; code: number; name: string; note?: string } {
  const text = e instanceof Error ? e.message : String(e)
  const code = e instanceof ProCallError && e.code != null ? e.code : proCodeOf(text)
  if (code != null) return { ok: false, code, name: proErrorName(code) }
  return { ok: false, code: -1, name: 'TransactionFailed', note: describeError(e) }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

const NOT_FOUND = 202
/** Ids are probed in pages: offers and positions have no count view. */
const PROBE_PAGE = 10
/** Stop enumerating after this many ids (a demo deployment stays far below it). */
const MAX_IDS = 400
/** Parallel simulations per refresh. */
const CONCURRENCY = 6

export interface ProClientStatus {
  loading: boolean
  /** Last refresh failure, null when the last refresh succeeded. */
  error: string | null
  /** Unix seconds of the last successful refresh. */
  updatedAt: number | null
}

export interface SorobanProDeps {
  /** RPC server (tests inject a fake). */
  server?: rpc.Server
  /** USDx balance reader (tests inject a fake). */
  balanceOf?: (token: string, who: string) => Promise<bigint>
  /** Clock in unix seconds. */
  now?: () => number
}

const NO_WALLET: WalletSigner = {
  address: null,
  sign: () => Promise.reject(new Error('Connect a wallet first.')),
}

export function emptyModel(now: number): ProModel {
  return {
    now,
    config: { maxAge: 0, exerciseMaxAge: 0, settleWindow: 0, reserveFeeBps: 0, bonusBps: 0, imBps: 0 },
    series: [],
    offers: [],
    books: [],
    positions: [],
    accounts: [],
    vault: { cash: 0n, reserved: 0n, shorts: [], value: null, totalShares: 0n, lpShares: [], debtsOwed: 0n, debtors: [] },
    wallets: {},
    history: [],
  }
}

export class SorobanProClient implements ProClient {
  readonly kind = 'onchain' as const
  readonly contractId: string
  private wallet: WalletSigner = NO_WALLET
  private readonly server: rpc.Server
  private readonly balanceOf: (token: string, who: string) => Promise<bigint>
  private readonly clock: () => number
  private readonly spec = new contract.Spec([...PRO_SPEC])
  private readonly reader: Bound
  private writer: { key: string; c: Bound } | null = null
  private model: ProModel
  private status: ProClientStatus = { loading: false, error: null, updatedAt: null }
  private requirements = new Map<Party, Requirement | null>()
  private history: HistoryEntry[] = []
  private listeners = new Set<() => void>()
  private inflight: Promise<void> | null = null
  private again = false
  private quoteId: string | null = null

  constructor(contractId: string, deps: SorobanProDeps = {}) {
    this.contractId = contractId
    this.server = deps.server ?? new rpc.Server(config.rpcUrl)
    this.balanceOf = deps.balanceOf ?? readBalance
    this.clock = deps.now ?? (() => Math.floor(Date.now() / 1000))
    this.model = emptyModel(this.clock())
    // Views need no account: without a publicKey the SDK simulates from a null source and skips getAccount.
    this.reader = this.bind({})
  }

  private bind(signing: Partial<contract.ClientOptions>): Bound {
    return new contract.Client(this.spec, {
      contractId: this.contractId,
      rpcUrl: config.rpcUrl,
      networkPassphrase: config.networkPassphrase,
      server: this.server,
      ...signing,
    }) as Bound
  }

  /** The signing client captures the wallet address, so rebuild it when the wallet changes. */
  private signer(): Bound {
    const w = this.wallet
    if (!w.address) throw new ProCallError('Connect a wallet first.', null)
    if (!this.writer || this.writer.key !== w.address) this.writer = { key: w.address, c: this.bind(clientSigning(w)) }
    return this.writer.c
  }

  /** The connected wallet signs writes; its address is the account shown. Call again when the wallet changes. */
  setWallet(w: WalletSigner): void {
    this.wallet = w
  }

  // ---- ProClient: state ----

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getModel(): ProModel {
    return this.model
  }
  getStatus(): ProClientStatus {
    return this.status
  }
  private emit(): void {
    this.listeners.forEach((l) => l())
  }

  getRequirement(who: Party): Requirement | null {
    return this.requirements.get(who) ?? null
  }
  /** No view previews a fill (the margin check runs inside `buy`): unknown on chain, shown as a dash. */
  requirementAfterFill(p: OfferParams): Requirement | null {
    void p
    return null
  }

  /** Re-reads every `intervalMs` until the returned stop function is called (the first read is `refresh()`). */
  start(intervalMs = 15_000): () => void {
    const t = setInterval(() => void this.refresh(), intervalMs)
    return () => clearInterval(t)
  }

  /** Re-reads the whole state. Concurrent calls coalesce into one extra pass. */
  refresh(): Promise<void> {
    if (this.inflight) {
      this.again = true
      return this.inflight
    }
    this.status = { ...this.status, loading: true }
    this.emit()
    this.inflight = (async () => {
      do {
        this.again = false
        try {
          this.model = await this.load()
          this.status = { loading: false, error: null, updatedAt: this.model.now }
        } catch (e) {
          this.status = { ...this.status, loading: false, error: describeError(e) }
        }
      } while (this.again)
    })().finally(() => {
      this.inflight = null
      this.emit()
    })
    return this.inflight
  }

  // ---- reads ----

  private async view<T>(call: (c: Bound) => Tx<Res<T>>): Promise<T> {
    const tx = await call(this.reader)
    throwIfSimFailed(tx)
    return unwrap(tx.result)
  }

  /** null when the contract answers NotFound (202). */
  private async viewOrNull<T>(call: (c: Bound) => Tx<Res<T>>): Promise<T | null> {
    try {
      return await this.view(call)
    } catch (e) {
      if (e instanceof ProCallError && e.code === NOT_FOUND) return null
      throw e
    }
  }

  /** null for any contract error (get_requirement fails with StaleSnapshot when a snapshot is too old). */
  private async viewOrUnknown<T>(call: (c: Bound) => Tx<Res<T>>): Promise<T | null> {
    try {
      return await this.view(call)
    } catch (e) {
      if (e instanceof ProCallError && e.code != null) return null
      throw e
    }
  }

  /** Ids 0.. of a sequentially numbered store, read until the first NotFound. */
  private async enumerate<T>(get: (id: number) => (c: Bound) => Tx<Res<T>>): Promise<Map<number, T>> {
    const out = new Map<number, T>()
    for (let from = 0; from < MAX_IDS; from += PROBE_PAGE) {
      const ids = Array.from({ length: PROBE_PAGE }, (_, k) => from + k)
      const rows = await mapLimit(ids, CONCURRENCY, (id) => this.viewOrNull(get(id)))
      let ended = false
      rows.forEach((r, k) => {
        if (r == null) ended = true
        else if (!ended) out.set(ids[k], r)
      })
      if (ended) break
    }
    return out
  }

  private async load(): Promise<ProModel> {
    const now = this.clock()
    const me = this.wallet.address
    const [cfg, count, quote] = await Promise.all([
      this.view((c) => c.config()),
      this.view((c) => c.series_count()),
      this.quoteId ? Promise.resolve(this.quoteId) : this.view((c) => c.quote()),
    ])
    this.quoteId = quote
    const seriesIds = Array.from({ length: count }, (_, i) => i)
    const [seriesRows, offers, positions] = await Promise.all([
      mapLimit(seriesIds, CONCURRENCY, async (id) => {
        const [s, snap] = await Promise.all([this.view((c) => c.get_series({ series_id: u32(id) })), this.viewOrNull((c) => c.get_snapshot({ series_id: u32(id) }))])
        return seriesFromAbi(id, s, snap)
      }),
      this.enumerate((id) => (c) => c.get_offer({ offer_id: u32(id) })),
      this.enumerate((id) => (c) => c.get_position({ pos_id: u32(id) })),
    ])

    // Every book has at least one position, so the books are the ones positions point to.
    const bookIds = [...new Set([...positions.values()].map((p) => p.book))].sort((a, b) => a - b)
    const bookRows = await mapLimit(bookIds, CONCURRENCY, async (id) => {
      const b = await this.viewOrNull((c) => c.get_book({ book_id: u32(id) }))
      return b ? bookFromAbi(id, b) : null
    })
    const books = bookRows.filter((b) => b != null)
    const ownerOf = new Map(books.map((b) => [b.id, b.owner]))

    // There is no account list on chain: the accounts shown are the connected wallet plus every writer, holder and
    // book owner seen in offers, positions and books.
    const parties = new Set<string>()
    if (me) parties.add(me)
    for (const o of offers.values()) parties.add(o.writer)
    for (const p of positions.values()) parties.add(p.holder)
    for (const b of books) if (b.owner !== VAULT) parties.add(b.owner)
    const addrs = [...parties]

    const acctRows = await mapLimit(addrs, CONCURRENCY, async (who) => {
      const [a, req, shares] = await Promise.all([
        this.view((c) => c.get_account({ who })),
        this.viewOrUnknown((c) => c.get_requirement({ who: writerArg(who) })),
        this.view((c) => c.lp_shares({ lp: who })),
      ])
      return { who, a, req: req ? requirementFromAbi(req) : null, shares }
    })
    const [vault, vaultValue, totalShares, vaultReq, wallet] = await Promise.all([
      this.view((c) => c.get_vault()),
      this.viewOrUnknown((c) => c.vault_value()),
      this.view((c) => c.total_shares()),
      this.viewOrUnknown((c) => c.get_requirement({ who: writerArg(VAULT) })),
      me ? this.balanceOf(quote, me).catch(() => null) : Promise.resolve(null),
    ])

    const expiryOf = new Map(seriesRows.map((s) => [s.id, s.expiry]))
    const requirements = new Map<Party, Requirement | null>([[VAULT, vaultReq ? requirementFromAbi(vaultReq) : null]])
    const accounts: AccountView[] = []
    for (const { who, a, req } of acctRows) {
      requirements.set(who, req)
      const shorts = shortsFromAbi(a.shorts)
      const empty = a.cash === 0n && a.owed === 0n && shorts.length === 0 && a.books.length === 0
      if (empty && who !== me) continue
      accounts.push({
        id: who,
        cash: a.cash,
        owed: a.owed,
        reserved: 0n, // takeover reserves exist on the vault only
        shorts,
        books: [...a.books],
        requirement: req,
        // No view: same definitions as the fixture model (replay.ts). nlv - mm, and an expired short blocks withdraw.
        cushion: req ? req.nlv - req.mm : null,
        withdrawBlocked: shorts.some((s) => (expiryOf.get(s.seriesId) ?? Infinity) <= now),
      })
    }
    this.requirements = requirements

    const debtors = accounts.filter((a) => a.owed > 0n).map((a) => ({ writer: a.id, owed: a.owed }))
    return {
      now,
      config: configFromAbi(cfg),
      series: seriesRows,
      // Open offers only (see offerFromAbi).
      offers: [...offers.entries()].filter(([, o]) => o.open).map(([id, o]) => offerFromAbi(id, o)),
      books,
      positions: [...positions.entries()].map(([id, p]) => positionFromAbi(id, p, ownerOf.get(p.book) ?? null)),
      accounts,
      vault: {
        cash: vault.cash,
        reserved: vault.reserved,
        shorts: shortsFromAbi(vault.shorts),
        value: vaultValue,
        totalShares,
        // LPs cannot be listed on chain: shares are read for the known accounts only.
        lpShares: acctRows.filter((r) => r.shares > 0n).map((r) => ({ lp: r.who, shares: r.shares })),
        debtsOwed: debtors.reduce((t, d) => t + d.owed, 0n),
        debtors,
      },
      wallets: me && wallet != null ? { [me]: wallet } : {},
      // Calls made from this browser session only: the contract keeps no call history (events are not indexed here).
      history: [...this.history],
    }
  }

  // ---- writes ----

  /**
   * simulate -> sign in the wallet -> send -> wait. A refused simulation never reaches the wallet. After a
   * confirmed transaction the state is re-read; a failed re-read is reported in the status, never as a failed call.
   */
  private async send<T, R>(op: string, args: (string | number)[], call: (c: Bound) => Tx<Res<T>>, shape: (v: T) => R): Promise<CallResult<R>> {
    let out: CallResult<R>
    try {
      const tx = await call(this.signer())
      throwIfSimFailed(tx)
      const sent = await tx.signAndSend()
      const hash = sent.sendTransactionResponse?.hash ?? ''
      const value = shape(unwrap(sent.result))
      out = { ok: true, value, note: hash ? `Transaction ${hash}` : undefined }
    } catch (e) {
      out = failureOf(e)
    }
    const result = out.ok ? valueRecord(out.value) : null
    this.history.push({ index: this.history.length, op, actor: typeof args[0] === 'string' ? args[0] : null, args, ok: out.ok, code: out.ok || out.code < 0 ? null : out.code, result })
    this.model = { ...this.model, history: [...this.history] }
    if (out.ok) await this.refresh()
    else this.emit()
    return out
  }

  deposit(who: Party, amount: bigint) {
    return this.send('deposit', [who], (c) => c.deposit({ who, amount: i128(amount) }), () => null)
  }
  withdraw(who: Party, amount: bigint) {
    return this.send('withdraw', [who], (c) => c.withdraw({ who, amount: i128(amount) }), () => null)
  }
  createOffer(p: OfferParams) {
    return this.send(
      'create_offer',
      [p.writer, p.seriesId],
      (c) => c.create_offer({ writer: p.writer, series_id: u32(p.seriesId), qty: i128(p.qty), premium: i128(p.premium), quote_expiry: u64(p.quoteExpiry) }),
      (id): number | null => Number(id),
    )
  }
  cancelOffer(writer: Party, offerId: number) {
    return this.send('cancel_offer', [writer, offerId], (c) => c.cancel_offer({ writer, offer_id: u32(offerId) }), () => null)
  }
  buy(buyer: Party, offerId: number) {
    return this.send('buy', [buyer, offerId], (c) => c.buy({ buyer, offer_id: u32(offerId) }), (id): number | null => Number(id))
  }
  exercise(holder: Party, positionId: number) {
    return this.send('exercise', [holder, positionId], (c) => c.exercise({ holder, pos_id: u32(positionId) }), (r) => ({ due: r.due, spot: r.spot }))
  }
  liquidate(caller: Party, writer: Party, taker: Party | null) {
    return this.send(
      'liquidate',
      [caller, writer, taker ?? VAULT],
      (c) => c.liquidate({ caller, writer, taker: taker ?? undefined }),
      (r) => ({ x: r.x, paid: r.paid, deficit: r.deficit }),
    )
  }
  settle(bookId: number) {
    return this.send('settle', [bookId], (c) => c.settle({ book_id: u32(bookId) }), (r) => ({ due: r.due, fromOwner: r.from_owner, shortfall: r.shortfall }))
  }
  settleVault(seriesId: number) {
    return this.send('settle_vault', [seriesId], (c) => c.settle_vault({ series_id: u32(seriesId) }), (r) => ({ shortfall: r.shortfall, vaultPaid: r.vault_paid, deficit: r.deficit }))
  }
  claim(holder: Party, positionId: number) {
    return this.send('claim', [holder, positionId], (c) => c.claim({ holder, pos_id: u32(positionId) }), (r): ClaimResult => ({ due: r.due, paid: r.paid, deficit: r.deficit }))
  }
  lpDeposit(lp: Party, amount: bigint) {
    return this.send('lp_deposit', [lp], (c) => c.lp_deposit({ lp, amount: i128(amount) }), (shares) => BigInt(shares))
  }
}

/** Result of an ok call as the history row shows it (bigint fields only). */
function valueRecord(v: unknown): Record<string, bigint> | null {
  if (!v || typeof v !== 'object') return null
  const out: Record<string, bigint> = {}
  for (const [k, x] of Object.entries(v)) if (typeof x === 'bigint') out[k] = x
  return out
}
