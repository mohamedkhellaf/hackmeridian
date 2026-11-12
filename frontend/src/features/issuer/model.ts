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
  /**
   * A wallet is connected and it is not the issuer. `issuer` is null when the issuer's address is not known but
   * the connected account was checked against the asset contract and does not match.
   */
  | { kind: 'not-issuer'; connected: string; issuer: string | null }
  /** A wallet is connected and whether it issues the asset could not be checked (the check itself failed). */
  | { kind: 'unchecked'; connected: string }
  | { kind: 'issuer'; issuer: string }

/**
 * `issuer` is the asset's issuer account: `undefined` while it is being read, `null` when it cannot be known
 * (the asset contract did not answer, or it does not wrap a classic asset). `checkFailed` is true when, for an
 * asset whose issuer is not known, the check of the connected account against the asset contract failed.
 */
export function accessOf(input: { mock: boolean; address: string | null; issuer: string | null | undefined; checkFailed?: boolean }): Access {
  if (input.mock) return { kind: 'mock' }
  if (!input.address) return { kind: 'guest' }
  if (input.issuer === undefined) return { kind: 'checking' }
  if (input.issuer !== null && input.issuer === input.address) return { kind: 'issuer', issuer: input.issuer }
  if (input.issuer === null && input.checkFailed) return { kind: 'unchecked', connected: input.address }
  return { kind: 'not-issuer', connected: input.address, issuer: input.issuer }
}

/**
 * Another listed asset that the connected account issues, when it is not the issuer of the one on screen: the
 * page offers to open it. Null when there is none.
 */
export function otherIssuedAsset(assets: readonly IssuerAsset[], current: IssuerAsset | null, address: string | null): IssuerAsset | null {
  if (!address) return null
  return assets.find((a) => a.issuer === address && a.contractId !== current?.contractId) ?? null
}

/** The asset the page opens on: the one picked, else the first the connected account issues, else the first listed. */
export function pickAsset(assets: readonly IssuerAsset[], picked: string | null, address: string | null): IssuerAsset | null {
  return assets.find((a) => a.contractId === picked) ?? (address ? assets.find((a) => a.issuer === address) : undefined) ?? assets[0] ?? null
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

/** Where a row comes from: the Covered contract (always listed), an address the issuer typed, or Horizon's holder list. */
export type RowSource = 'escrow' | 'added' | 'holder'

export interface AccountRow {
  address: string
  kind: TargetKind
  source: RowSource
  /** The Covered contract: the escrow of every option on the asset. */
  escrow: boolean
  /** Undefined while the first read is running. */
  read: HolderRead | undefined
}

/** The order of the holder list: the accounts that need a decision first, then the authorized by balance. */
const RANK: Record<HolderState, number> = { unauthorized: 0, 'maintain-only': 0, unknown: 1, authorized: 2, 'no-trustline': 3, unfunded: 3, issuer: 3 }

function byDecision(a: { address: string; read: HolderRead }, b: { address: string; read: HolderRead }): number {
  const rank = RANK[a.read.state] - RANK[b.read.state]
  if (rank !== 0) return rank
  const x = a.read.balance ?? -1n
  const y = b.read.balance ?? -1n
  if (x !== y) return x > y ? -1 : 1
  return a.address < b.address ? -1 : a.address > b.address ? 1 : 0
}

/**
 * The table's rows: the Covered contract first, then the addresses typed in this session (newest first), then
 * the holders Horizon lists, sorted so the accounts that need a decision come first (not authorized and
 * restricted), then the authorized ones by balance, largest first. An address appears once, at its first place.
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
  const holders = input.holders.map((h) => ({ address: h.address, read: input.reads[h.address] ?? h.read })).sort(byDecision)
  for (const h of holders) push(h.address, 'holder', h.read)
  return rows
}

/** Above this many accounts the list offers to show only the ones that need a decision. */
export const FILTER_ABOVE = 10

/** Not authorized, or restricted: the accounts the issuer has a decision to make about. */
export const needsDecision = (row: Pick<AccountRow, 'read'>): boolean => row.read?.state === 'unauthorized' || row.read?.state === 'maintain-only'

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

/** One action a row offers. `reason` says why it cannot run now; present whenever `enabled` is false. */
export interface RowAction {
  kind: IssuerActionKind
  enabled: boolean
  reason?: string
}

/**
 * The actions one row offers: at most one button (`primary`, the action its state calls for) and a menu with the
 * rest (`more`). Clawback is never the button: it takes the extra step of the menu. `note` says why a row
 * offers nothing at all.
 */
export interface RowActions {
  primary: RowAction | null
  more: RowAction[]
  note: string | null
}

const nothing = (note: string | null): RowActions => ({ primary: null, more: [], note })

/**
 * Which actions a row offers. The rules, in order:
 *   - nothing until the row's first read lands (a failed read is a read: it keeps every action open);
 *   - the issuing account, an account that does not exist and an account without a trustline have nothing to act on;
 *   - core's `actionsFor` decides authorize and freeze from the authorization state (an unknown state leaves both
 *     open, so a failed read never locks the issuer out);
 *   - an action the issuer's flags rule out for the whole asset is not offered at all: `flagLimits` says so once,
 *     above the accounts (flags that were not read rule nothing out);
 *   - clawback needs a balance it applies to: a trustline opened before clawback was enabled, or a zero balance,
 *     has nothing to claw back (the row's cells say which);
 *   - one transaction at a time: while one runs (or its outcome is unknown), what is offered stays in place,
 *     disabled, with `busy` as the reason.
 */
export function rowActions(row: Pick<AccountRow, 'read'>, flags: AssetFlags | null, code: string, busy: string | null = null): RowActions {
  const read = row.read
  if (!read) return nothing(null)
  const state = read.state
  if (state === 'issuer') return nothing(COPY.reasons.issuerRow)
  if (state === 'unfunded') return nothing(COPY.reasons.unfunded)
  if (state === 'no-trustline') return nothing(COPY.reasons.noTrustline(code))
  const base = actionsFor(AUTH_STATE[state])

  const kinds: IssuerActionKind[] = []
  if (base.authorize) kinds.push('authorize')
  if (base.freeze && (!flags || flags.authRevocable)) kinds.push('freeze')
  const claw = (!flags || flags.clawback) && read.clawback !== false && read.balance !== 0n
  const act = (kind: IssuerActionKind): RowAction => (busy !== null ? { kind, enabled: false, reason: busy } : { kind, enabled: true })
  return { primary: kinds.length > 0 ? act(kinds[0]) : null, more: [...kinds.slice(1), ...(claw ? (['clawback'] as const) : [])].map(act), note: null }
}

/** The actions the issuer's flags rule out for every account, as sentences said once above the accounts. */
export function flagLimits(flags: AssetFlags): string[] {
  const out: string[] = []
  if (!flags.authRevocable) out.push(COPY.limits.freeze)
  if (!flags.clawback) out.push(COPY.limits.clawback)
  return out
}

/**
 * Authorize runs at once, because it takes nothing away, except when the issuer cannot revoke: then it cannot be
 * undone, and it asks first. Flags that were not read ask nothing.
 */
export const authorizeIsFinal = (flags: AssetFlags | null): boolean => flags !== null && !flags.authRevocable

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
 * What a clawback of `units` from the Covered contract does to its reserves: `reserved` is what the contract owes
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

/** What a row has open on the asset, as rows of a confirmation. Null when the options were not read. */
export interface ExposureRow {
  label: string
  value: number
  hint?: string
}

export function exposureRows(row: Pick<AccountRow, 'escrow'>, escrow: EscrowExposure | null, account: AccountExposure | null): ExposureRow[] | null {
  if (row.escrow) {
    if (!escrow) return null
    return [{ label: COPY.exposure.open, value: escrow.total, hint: escrow.total > 0 ? COPY.contract.openSplit(escrow.active, escrow.offered, escrow.awaiting) : undefined }]
  }
  if (!account) return null
  return [
    { label: COPY.exposure.written, value: account.written },
    { label: COPY.exposure.held, value: account.holding },
  ]
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

/** A confirmed action in one line: "Frozen GDY2…ZUVN for BOND." */
export function doneLabel(input: IssuerActionInput): string {
  const who = shortAddress(input.target)
  if (input.kind === 'authorize') return COPY.done.authorize(who, input.asset.code)
  if (input.kind === 'freeze') return COPY.done.freeze(who, input.asset.code)
  return COPY.done.clawback(formatExact(input.units ?? 0n, input.asset.decimals), input.asset.code, who)
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
  /** The action without the account it acts on, which has its own column: "Freeze", "Claw back 5.00 BOND". */
  action: string
  /** The whole label, for screen readers and as a fallback. */
  label: string
  /** The account or contract acted on, when the record says. */
  target: string | null
  phase: string
  hash: string | null
  /** Milliseconds since the epoch. */
  at: number
}

const KIND_OF: Record<string, IssuerActionKind | undefined> = {
  [issuerActionName('authorize')]: 'authorize',
  [issuerActionName('freeze')]: 'freeze',
  [issuerActionName('clawback')]: 'clawback',
}

/** "Claw back 5.00 BOND from GAJ2…VC7G" without its account: the verb, and the amount of a clawback. */
function actionText(action: string, label: string): string {
  const kind = KIND_OF[action]
  if (kind === 'authorize') return COPY.log.authorize
  if (kind === 'freeze') return COPY.log.freeze
  const m = /^(.*) from \S+$/.exec(label)
  return m ? m[1] : label
}

/**
 * The issuer's own actions among the recorded transactions, newest first, at most `limit`. With `assetId`, only
 * the actions on that asset.
 */
export function logRows(entries: readonly RecordedTx[], assetId: string | null = null, limit = 20): LogRow[] {
  return entries
    .filter((e) => isIssuerAction(e.action))
    .map((e) => ({ e, subject: parseIssuerSubject(e.subject) }))
    .filter(({ subject }) => assetId === null || subject?.assetId === assetId)
    .sort((a, b) => b.e.startedAt - a.e.startedAt)
    .slice(0, limit)
    .map(({ e, subject }) => ({ id: e.id, action: actionText(e.action, e.label), label: e.label, target: subject?.target ?? null, phase: e.phase, hash: e.hash, at: e.startedAt }))
}

const OPEN_PHASES: ReadonlySet<string> = new Set(['checking', 'signing', 'submitting', 'pending', 'unknown'])

/**
 * The newest issuer action whose outcome is not final (in flight, or sent and not confirmed), from the persisted
 * list: it blocks every new action until it is resolved, also after the page was left and opened again.
 */
export function openIssuerAction(entries: readonly RecordedTx[]): { id: string; unknown: boolean } | null {
  const open = entries.filter((e) => isIssuerAction(e.action) && OPEN_PHASES.has(e.phase)).sort((a, b) => b.startedAt - a.startedAt)[0]
  return open ? { id: open.id, unknown: open.phase === 'unknown' } : null
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
