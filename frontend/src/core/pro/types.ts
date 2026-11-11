// Domain types and the client interface for StellSec Pro (experimental).
// Names follow the integer reference model (packages/risk/pro_v0_model.py) and docs/pro-v0-brief-dev2.md.
// Amounts are exact integer units (bigint, USDx has 7 decimals); quantities are whole lots.
// Margin figures (nlv, mm, im...) always come from the client (get_requirement); the UI never computes them.

export const USDX_DECIMALS = 7

/** A party: a fixture name (MAKER_A, VAULT...) while simulated, a G... address on chain. */
export type Party = string
/** The vault is a pseudo-account inside the contract. */
export const VAULT: Party = 'VAULT'

/** Result of get_requirement. */
export interface Requirement {
  nlv: bigint
  liability: bigint
  expired: bigint
  scan: bigint
  smin: bigint
  liq: bigint
  /** Maintenance margin. nlv < mm means the account can be taken over. */
  mm: bigint
  /** Initial margin. */
  im: bigint
  /** Index of the worst scenario (0..15). */
  worst: number
}

export interface SnapshotView {
  seriesId: number
  seq: number
  /** Unix seconds when the publisher signed the snapshot. */
  ts: number
  spot: bigint
  mark: bigint
}

export interface SeriesView {
  id: number
  strike: bigint
  expiry: number
  /** Open interest in lots. */
  oi: bigint
  settlementPrice: bigint | null
  openBooks: number
  shortfall: bigint
  vaultPaid: bigint
  pool: bigint
  claimed: bigint
  closed: boolean
  /** Latest published snapshot, if any. */
  snapshot: SnapshotView | null
  /** shortfall - vault_paid once the series is closed, else null. */
  deficit: bigint | null
}

export type OfferStatus = 'open' | 'bought' | 'cancelled'

export interface OfferView {
  id: number
  writer: Party
  seriesId: number
  qty: bigint
  /** Total premium for the whole quantity. */
  premium: bigint
  quoteExpiry: number
  status: OfferStatus
  buyer: Party | null
}

export interface BookView {
  id: number
  seriesId: number
  owner: Party
  qty: bigint
  settled: boolean
  due: bigint
  fromOwner: bigint
  shortfall: bigint
  /** Takeover payment reserved for this book (vault-owned books only). */
  reserve: bigint
}

export interface ClaimResult {
  due: bigint
  paid: bigint
  deficit: bigint
}

export interface PositionView {
  id: number
  seriesId: number
  holder: Party
  book: number
  bookOwner: Party | null
  qty: bigint
  settled: boolean
  exercised: boolean
  paid: bigint
  deficit: bigint
  /** Set once `claim` has run (from its result). */
  claim: ClaimResult | null
}

export interface ShortView {
  seriesId: number
  qty: bigint
}

export interface AccountView {
  id: Party
  cash: bigint
  /** Debt to the vault from a takeover shortfall. */
  owed: bigint
  /** Takeover payments reserved for moved books (vault only). */
  reserved: bigint
  shorts: ShortView[]
  books: number[]
  /** null when no value is available for the current state: shown as a dash, never computed in the UI. */
  requirement: Requirement | null
  /** requirement.nlv - requirement.mm, when both are known (negative = liquidatable). */
  cushion: bigint | null
  /** True while the account holds an expired short that is not settled: withdraw is blocked (SeriesExpired). */
  withdrawBlocked: boolean
}

export interface VaultView {
  cash: bigint
  reserved: bigint
  shorts: ShortView[]
  /** vault_value: cash when the vault has no shorts, else its nlv; null when unknown. */
  value: bigint | null
  totalShares: bigint
  lpShares: { lp: Party; shares: bigint }[]
  /** Sum of the debts writers owe the vault. */
  debtsOwed: bigint
  debtors: { writer: Party; owed: bigint }[]
}

export interface ConfigView {
  maxAge: number
  exerciseMaxAge: number
  settleWindow: number
  reserveFeeBps: number
  bonusBps: number
  imBps: number
}

export interface HistoryEntry {
  index: number
  op: string
  actor: string | null
  /** Scalar arguments of the call (ids, accounts); the snapshot object of publish_risk is left out. */
  args: (string | number)[]
  ok: boolean
  /** Error code when the step was refused. */
  code: number | null
  /** Result of an ok step (liquidate: x / paid / deficit, exercise: due / spot...). */
  result: Record<string, bigint> | null
}

export interface ProModel {
  /** Contract time (unix seconds). */
  now: number
  config: ConfigView
  series: SeriesView[]
  offers: OfferView[]
  books: BookView[]
  positions: PositionView[]
  /** Accounts other than the vault. */
  accounts: AccountView[]
  vault: VaultView
  /** Wallet balances in USDx. */
  wallets: Record<Party, bigint>
  history: HistoryEntry[]
}

/** Outcome of a state-changing call. Errors carry the contract error code (201..226). */
export type CallResult<T = null> =
  | { ok: true; value: T; /** Simulation only: which scripted step was replayed. */ note?: string }
  | { ok: false; code: number; name: string; note?: string }

export interface OfferParams {
  writer: Party
  seriesId: number
  qty: bigint
  /** Total premium for the whole quantity. */
  premium: bigint
  quoteExpiry: number
}

/**
 * Mirrors the functions and views of contracts/pro (brief section 6). The Fixture client replays
 * packages/risk/fixtures/pro_v0.json; the on-chain client (generated bindings) can implement the same
 * interface: `getModel()` returns the last read state, `subscribe` fires when it changes.
 */
export interface ProClient {
  readonly kind: 'fixture' | 'onchain'
  subscribe(listener: () => void): () => void
  getModel(): ProModel

  deposit(who: Party, amount: bigint): Promise<CallResult>
  withdraw(who: Party, amount: bigint): Promise<CallResult>
  createOffer(p: OfferParams): Promise<CallResult<number | null>>
  cancelOffer(writer: Party, offerId: number): Promise<CallResult>
  /** The margin check happens here, not at create_offer. */
  buy(buyer: Party, offerId: number): Promise<CallResult<number | null>>
  exercise(holder: Party, positionId: number): Promise<CallResult<{ due: bigint; spot: bigint }>>
  /** taker = null: take over to the vault (anyone can call it); otherwise a private takeover. */
  liquidate(caller: Party, writer: Party, taker: Party | null): Promise<CallResult<{ x: bigint; paid: bigint; deficit: bigint }>>
  settle(bookId: number): Promise<CallResult<{ due: bigint; fromOwner: bigint; shortfall: bigint }>>
  settleVault(seriesId: number): Promise<CallResult<{ shortfall: bigint; vaultPaid: bigint; deficit: bigint }>>
  claim(holder: Party, positionId: number): Promise<CallResult<ClaimResult>>
  /** No LP withdrawal in v0. */
  lpDeposit(lp: Party, amount: bigint): Promise<CallResult<bigint>>

  /** get_requirement(who) for the current state, or null when none is available. */
  getRequirement(who: Party): Requirement | null
  /**
   * get_requirement of the writer as it would stand right after this order is filled
   * (the IM-after-fill preview), or null when the source has no value for it.
   */
  requirementAfterFill(p: OfferParams): Requirement | null
}
