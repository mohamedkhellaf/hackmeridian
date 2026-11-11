// The issuer console's logic, without React, the network or the Stellar SDK. Everything here is a pure function of
// what was read, so it runs in Node tests. Amounts are exact `bigint` units from the read to the screen.
import { parseHolderStatus } from '../../core/assetfacts/assetFacts'
import type { AssetFlags, HolderStatus } from '../../core/assetfacts/assetFacts'
import { isAccountId, isContractId } from '../../core/assets/strkey'
import { formatExact, parseAmount } from '../../core/format'
import { actionsFor } from '../../core/issuer/issuerView'
import type { AuthState } from '../../core/issuer/issuerView'
import { shortAddress } from '../../core/options/format'
import type { OptionOffer } from '../../core/options/types'
import { shortfall } from '../../core/reserves/reserves'
import type { TxErrorKind } from '../../core/tx/errors'
import { isIssuerAction, issuerActionName, issuerSubject, parseIssuerSubject } from '../../data'
import type { IssuerActionKind } from '../../data'
import { COPY, RESULT_CODE_TEXT } from './copy'

// ---------------------------------------------------------------------------------------------------- assets

/** A listed asset as the console needs it. `issuer` is absent when the asset contract's name could not be read. */
export interface IssuerAsset {
  /** The asset contract id (the SAC): the key. */
  contractId: string
  code: string
  decimals: number
  issuer?: string
}

export type TargetKind = 'account' | 'contract'

/** `account` for a valid `G...`, `contract` for a valid `C...`, null for anything else. Checksums are enforced. */
export function targetKind(text: string): TargetKind | null {
  return isAccountId(text) ? 'account' : isContractId(text) ? 'contract' : null
}

/** The last four characters of an address: what the eye checks, and what the clawback confirmation asks for. */
export const tailOf = (address: string): string => address.slice(-4)

// ---------------------------------------------------------------------------------------------------- access

/** Who is looking at the console, which decides what it offers. */
export type Access =
  /** The build has no Testnet contract: nothing is read, nothing can be signed. */
  | { kind: 'mock' }
  /** No wallet: the asset's public facts are shown, with "Connect wallet". */
  | { kind: 'guest' }
  /** A wallet is connected and the asset's issuer is still being read. */
  | { kind: 'checking' }
  /** A wallet is connected and it is not the issuer. `issuer` is null when the issuer could not be read. */
  | { kind: 'not-issuer'; connected: string; issuer: string | null }
  | { kind: 'issuer'; issuer: string }

/**
 * `issuer` is the asset's issuer account: `undefined` while it is being read, `null` when it cannot be known
 * (the asset contract did not answer, or it does not wrap a classic asset).
 */
export function accessOf(input: { mock: boolean; address: string | null; issuer: string | null | undefined }): Access {
  if (input.mock) return { kind: 'mock' }
  if (!input.address) return { kind: 'guest' }
  if (input.issuer === undefined) return { kind: 'checking' }
  if (input.issuer !== null && input.issuer === input.address) return { kind: 'issuer', issuer: input.issuer }
  return { kind: 'not-issuer', connected: input.address, issuer: input.issuer }
}

// ---------------------------------------------------------------------------------------------------- holders

/** The six states of a holder (core/assetfacts), plus `unknown` when the read failed. */
export type HolderState = HolderStatus | 'unknown'

/** What one read of an account or a contract found. */
export interface HolderRead {
  kind: TargetKind
  state: HolderState
  /** Exact units. Null when there is no balance line or it could not be read. */
  balance: bigint | null
  /** Whether a clawback can take this balance. Null when the read does not say (contracts, failed reads). */
  clawback: boolean | null
  /** Why the read failed, when `state` is `unknown`. */
  error?: string
}

export const UNKNOWN_READ = (kind: TargetKind, error: string): HolderRead => ({ kind, state: 'unknown', balance: null, clawback: null, error })

interface BalanceLine {
  asset_code?: unknown
  asset_issuer?: unknown
  balance?: unknown
  is_clawback_enabled?: unknown
}

/**
 * One Horizon account document (or `null` for an account that does not exist) as a holder read of `code:issuer`.
 * The balance string of Horizon always has 7 fraction digits; it is parsed to exact units, never through a float.
 */
export function parseHolderDocument(json: unknown, asset: Pick<IssuerAsset, 'code' | 'decimals'>, issuer: string, address: string): HolderRead {
  const state = parseHolderStatus(json, asset.code, issuer, address)
  const balances = (json as { balances?: BalanceLine[] } | null)?.balances
  const line = Array.isArray(balances) ? balances.find((b) => b.asset_code === asset.code && b.asset_issuer === issuer) : undefined
  const balance = line && typeof line.balance === 'string' ? parseAmount(line.balance, asset.decimals) : null
  return { kind: 'account', state, balance, clawback: line ? line.is_clawback_enabled === true : null }
}

/** One page of Horizon `/accounts?asset=CODE:ISSUER` as holder reads, in the order Horizon gave them. */
export function parseHoldersPage(json: unknown, asset: Pick<IssuerAsset, 'code' | 'decimals'>, issuer: string): { address: string; read: HolderRead }[] {
  const records = (json as { _embedded?: { records?: unknown[] } } | null)?._embedded?.records
  if (!Array.isArray(records)) return []
  return records.flatMap((record) => {
    const address = (record as { account_id?: unknown; id?: unknown } | null)?.account_id ?? (record as { id?: unknown } | null)?.id
    if (typeof address !== 'string' || !isAccountId(address) || address === issuer) return []
    return [{ address, read: parseHolderDocument(record, asset, issuer, address) }]
  })
}

/** A contract's read: the asset contract's `authorized(id)` and `balance(id)`. */
export function contractRead(authorized: boolean, balance: bigint | null): HolderRead {
  return { kind: 'contract', state: authorized ? 'authorized' : 'unauthorized', balance, clawback: null }
}

const AUTH_STATE: Record<HolderState, AuthState> = {
  authorized: 'authorized',
  'maintain-only': 'partial',
  unauthorized: 'unauthorized',
  'no-trustline': 'no-trustline',
  unfunded: 'no-trustline',
  issuer: 'no-trustline',
  unknown: 'unknown',
}

// ---------------------------------------------------------------------------------------------------- rows

/** Where a row comes from: the options contract (always listed), an address the issuer typed, or Horizon's holder list. */
export type RowSource = 'escrow' | 'added' | 'holder'

export interface AccountRow {
  address: string
  kind: TargetKind
  source: RowSource
  /** The options contract: the escrow of every option on the asset. */
  escrow: boolean
  /** Undefined while the first read is running. */
  read: HolderRead | undefined
}

/**
 * The table's rows: the options contract first, then the addresses typed in this session (newest first), then
 * the holders Horizon lists. An address appears once, at its first place in that order.
 */
export function mergeRows(input: {
  escrow: string | undefined
  added: readonly string[]
  holders: readonly { address: string; read: HolderRead }[]
  reads: Readonly<Record<string, HolderRead | undefined>>
}): AccountRow[] {
  const seen = new Set<string>()
  const rows: AccountRow[] = []
  const push = (address: string, source: RowSource, read: HolderRead | undefined) => {
    const kind = targetKind(address)
    if (!kind || seen.has(address)) return
    seen.add(address)
    rows.push({ address, kind, source, escrow: source === 'escrow', read })
  }
  if (input.escrow) push(input.escrow, 'escrow', input.reads[input.escrow])
  for (const address of input.added) push(address, 'added', input.reads[address])
  // A fresh single read (made after an action) wins over the row of the holder list.
  for (const h of input.holders) push(h.address, 'holder', input.reads[h.address] ?? h.read)
  return rows
}

export type AddResult = { ok: true; address: string } | { ok: false; error: string }

/** Validates an address typed into "Add an account". */
export function checkNewAccount(text: string, listed: readonly string[]): AddResult {
  const address = text.trim()
  if (!targetKind(address)) return { ok: false, error: COPY.add.invalid }
  if (listed.includes(address)) return { ok: false, error: COPY.add.duplicate }
  return { ok: true, address }
}

// ---------------------------------------------------------------------------------------------------- actions

export type { IssuerActionKind }

export interface ActionState {
  enabled: boolean
  /** Why it is not available, in one sentence. Present whenever `enabled` is false. */
  reason?: string
}

/**
 * The actions one row offers. An action is `null` when the row's state does not call for it (nobody authorizes an
 * authorized account); an offered action can still be disabled, with its reason. `note` says why a row offers
 * nothing at all.
 */
export interface RowActions {
  authorize: ActionState | null
  freeze: ActionState | null
  clawback: ActionState | null
  note: string | null
}

const off = (reason: string): ActionState => ({ enabled: false, reason })
const ON: ActionState = { enabled: true }
const nothing = (note: string): RowActions => ({ authorize: null, freeze: null, clawback: null, note })

/**
 * Which of the three actions a row offers. The rules, in order:
 *   - the issuing account, an account that does not exist and an account without a trustline have nothing to act on;
 *   - core's `actionsFor` decides authorize and freeze from the authorization state (an unknown state leaves both
 *     open, so a failed read never locks the issuer out);
 *   - freezing needs the issuer's revocable flag, clawback its clawback flag (when the flags were read);
 *   - clawback also needs a balance it applies to;
 *   - one transaction at a time: while one runs (or its outcome is unknown), what is offered stays in place,
 *     disabled, with `busy` as the reason.
 */
export function rowActions(row: Pick<AccountRow, 'read'>, flags: AssetFlags | null, code: string, busy: string | null = null): RowActions {
  const read = row.read
  const state: HolderState = read?.state ?? 'unknown'
  if (state === 'issuer') return nothing(COPY.reasons.issuerRow)
  if (state === 'unfunded') return nothing(COPY.reasons.unfunded)
  if (state === 'no-trustline') return nothing(COPY.reasons.noTrustline(code))
  const base = actionsFor(AUTH_STATE[state])

  let authorize: ActionState | null = base.authorize ? ON : null
  let freeze: ActionState | null = base.freeze ? ON : null
  if (freeze && flags && !flags.authRevocable) freeze = off(COPY.reasons.notRevocable)

  let clawback: ActionState = ON
  if (flags && !flags.clawback) clawback = off(COPY.reasons.clawbackOff)
  else if (read?.clawback === false) clawback = off(COPY.reasons.clawbackNotOnLine)
  else if (read?.balance === 0n) clawback = off(COPY.reasons.nothingToClaw(code))

  if (busy !== null) {
    const wait = off(busy)
    authorize = authorize && wait
    freeze = freeze && wait
    clawback = wait
  }
  return { authorize, freeze, clawback, note: null }
}

/** The actions the issuer's flags rule out for every account, as sentences for the flags card. */
export function flagLimits(flags: AssetFlags): string[] {
  const out: string[] = []
  if (!flags.authRevocable) out.push(COPY.reasons.notRevocable)
  if (!flags.clawback) out.push(COPY.reasons.clawbackOff)
  return out
}

// ---------------------------------------------------------------------------------------------------- clawback

export type AmountCheck = { ok: true; units: bigint; text: string } | { ok: false; error: string | null }

/**
 * The clawback amount as typed. `text` is the amount written out exactly, without grouping (`25`, `2.5`): the
 * form the confirmation phrase uses. An empty field is not an error yet (`error: null`).
 */
export function checkClawbackAmount(input: string, balance: bigint | null, asset: Pick<IssuerAsset, 'code' | 'decimals'>): AmountCheck {
  const raw = input.trim()
  if (raw === '') return { ok: false, error: null }
  const units = parseAmount(raw, asset.decimals)
  if (units === null || units <= 0n) return { ok: false, error: COPY.clawback.invalidAmount(asset.decimals) }
  if (balance !== null && units > balance) {
    return { ok: false, error: COPY.clawback.overBalance(formatExact(balance, asset.decimals), asset.code) }
  }
  return { ok: true, units, text: formatExact(units, asset.decimals, { minDp: 0, group: false }) }
}

/** What the issuer types to confirm a clawback: the amount, the asset code and the tail of the account. */
export function clawbackPhrase(amountText: string, code: string, target: string): string {
  return `${amountText} ${code} ${tailOf(target)}`
}

/** Case and spacing are forgiven; every character of the phrase is not. */
export function phraseMatches(typed: string, phrase: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase()
  return phrase !== '' && norm(typed) === norm(phrase)
}

export type PhraseProgress = 'empty' | 'partial' | 'match' | 'mismatch'

/** How far the typed confirmation is: still being typed (`partial`), exact (`match`) or wrong (`mismatch`). */
export function phraseProgress(typed: string, phrase: string): PhraseProgress {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase()
  const t = norm(typed)
  if (t === '') return 'empty'
  if (phraseMatches(typed, phrase)) return 'match'
  return norm(phrase).startsWith(t) ? 'partial' : 'mismatch'
}

/** A declined or refused attempt sent nothing: the confirmation stays open so it can be sent again as typed. */
export function sentNothing(state: { phase: string; effect: string }): boolean {
  return state.phase === 'idle' || state.phase === 'declined' || (state.phase === 'failed' && state.effect === 'nothing-sent')
}

export interface ClawbackImpact {
  reserved: bigint
  heldNow: bigint
  heldAfter: bigint
  /** What the contract would owe beyond what it holds after the clawback. Zero when it stays covered. */
  short: bigint
}

/**
 * What a clawback of `units` from the options contract does to its reserves: `reserved` is what the contract owes
 * in this token (`open_collateral`), `held` what it holds. Uses the same `shortfall` as the Reserves page.
 */
export function clawbackImpact(health: { reserved: bigint; held: bigint }, units: bigint): ClawbackImpact {
  const heldAfter = units >= health.held ? 0n : health.held - units
  return { reserved: health.reserved, heldNow: health.held, heldAfter, short: shortfall(heldAfter, health.reserved) }
}

// ---------------------------------------------------------------------------------------------------- exposure

type OptionLike = Pick<OptionOffer, 'underlying' | 'quote' | 'state' | 'holder' | 'writer'>

const touches = (o: OptionLike, assetId: string): boolean => o.underlying.contractId === assetId || o.quote.contractId === assetId

/** Options on the asset that still have something to settle, counted for the whole contract. */
export interface EscrowExposure {
  /** Bought and before the deadline: the holder can still exercise. */
  active: number
  /** Offered and not bought: collateral is locked. */
  offered: number
  /** Exercised or past the deadline, with collateral or proceeds still waiting for the writer. */
  awaiting: number
  total: number
}

export function escrowExposure(options: readonly OptionLike[], assetId: string): EscrowExposure {
  let active = 0
  let offered = 0
  let awaiting = 0
  for (const o of options) {
    if (!touches(o, assetId)) continue
    if (o.state === 'active') active++
    else if (o.state === 'offered') offered++
    else if (o.state === 'exercised' || o.state === 'expired') awaiting++
  }
  return { active, offered, awaiting, total: active + offered + awaiting }
}

/** What one account has open on the asset. */
export interface AccountExposure {
  /** Active options it holds. */
  holding: number
  /** Options it wrote that are not finished (offered, active, or waiting for its claim or reclaim). */
  written: number
}

export function accountExposure(options: readonly OptionLike[], assetId: string, account: string): AccountExposure {
  let holding = 0
  let written = 0
  for (const o of options) {
    if (!touches(o, assetId)) continue
    if (o.holder === account && o.state === 'active') holding++
    if (o.writer === account && (o.state === 'offered' || o.state === 'active' || o.state === 'exercised' || o.state === 'expired')) written++
  }
  return { holding, written }
}

/** The exposure of a row as one sentence for the confirmations. Null when the options were not read. */
export function exposureText(row: Pick<AccountRow, 'address' | 'escrow'>, code: string, escrow: EscrowExposure | null, account: AccountExposure | null): string | null {
  if (row.escrow) {
    if (!escrow) return null
    return escrow.total === 0 ? COPY.exposure.escrowNone(code) : COPY.exposure.escrow(escrow.total, escrow.active, escrow.offered, escrow.awaiting, code)
  }
  if (!account) return null
  if (account.holding > 0 && account.written > 0) return COPY.exposure.both(account.holding, account.written, code)
  if (account.holding > 0) return COPY.exposure.holdingOnly(account.holding, code)
  if (account.written > 0) return COPY.exposure.writtenOnly(account.written, code)
  return COPY.exposure.none(code)
}

// ---------------------------------------------------------------------------------------------------- transactions

export interface IssuerActionInput {
  kind: IssuerActionKind
  asset: Pick<IssuerAsset, 'contractId' | 'code' | 'decimals'>
  target: string
  /** Clawback only: exact units. */
  units?: bigint
}

/** How an action reads in the transaction panel, the announcements and the Activity list. */
export function actionLabel(input: IssuerActionInput): string {
  const who = shortAddress(input.target)
  if (input.kind === 'authorize') return COPY.labels.authorize(who, input.asset.code)
  if (input.kind === 'freeze') return COPY.labels.freeze(who, input.asset.code)
  return COPY.labels.clawback(formatExact(input.units ?? 0n, input.asset.decimals), input.asset.code, who)
}

export const ACTION_DONE: Record<IssuerActionKind, string> = { authorize: 'Authorized', freeze: 'Frozen', clawback: 'Clawed back' }

// The names an issuer transaction is recorded under live in the data layer, so the Activity page can tell an
// issuer action from a trade.
export const actionName = issuerActionName
export { issuerSubject, parseIssuerSubject }

/** The fields of a recorded transaction that the log reads (an Activity entry satisfies it). */
export interface RecordedTx {
  id: string
  action: string
  label: string
  subject: string | null
  phase: string
  hash: string | null
  startedAt: number
}

export interface LogRow {
  id: string
  label: string
  /** The account or contract acted on, when the record says. */
  target: string | null
  phase: string
  hash: string | null
  /** Milliseconds since the epoch. */
  at: number
}

/** The issuer's own actions among the recorded transactions, newest first, at most `limit`. */
export function logRows(entries: readonly RecordedTx[], limit = 20): LogRow[] {
  return entries
    .filter((e) => isIssuerAction(e.action))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit)
    .map((e) => ({ id: e.id, label: e.label, target: parseIssuerSubject(e.subject)?.target ?? null, phase: e.phase, hash: e.hash, at: e.startedAt }))
}

// ---------------------------------------------------------------------------------------------------- submit errors

export interface SubmitFailure {
  kind: Extract<TxErrorKind, 'refused' | 'failed' | 'unknown'>
  message: string
}

interface HorizonErrorShape {
  response?: { status?: number; data?: { extras?: { result_codes?: { transaction?: unknown; operations?: unknown } } } }
}

/**
 * Where a rejected Horizon submission stopped, from its result codes:
 *   - `tx_failed`: a ledger included the transaction and an operation failed there. The fee was charged.
 *   - any other transaction code: the network refused it before any ledger. Nothing was charged.
 *   - no result codes (a timeout, a dropped connection): the outcome is not known.
 */
export function classifySubmitError(e: unknown): SubmitFailure {
  const codes = (e as HorizonErrorShape | null)?.response?.data?.extras?.result_codes
  const tx = typeof codes?.transaction === 'string' ? codes.transaction : null
  if (!tx) return { kind: 'unknown', message: COPY.tx.sentNotConfirmed }
  const ops = Array.isArray(codes?.operations) ? codes.operations.filter((c): c is string => typeof c === 'string' && c !== 'op_success') : []
  const known = [...ops, tx].map((c) => RESULT_CODE_TEXT[c]).find((t) => t !== undefined)
  const message = known ?? COPY.tx.rejectedWith([tx, ...ops].join(', '))
  return { kind: tx === 'tx_failed' ? 'failed' : 'refused', message }
}
