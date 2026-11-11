// The Reserves page as data. Pure: no React, no network. Amounts stay exact `bigint` units; the only `number`
// here is the one handed to the bullet drawing (`chartNumber`), which decides a bar length and nothing else.
//
// The arithmetic (owed against held, the shortfall) is core/reserves `backingFor`; this module only orders the
// rows, names their state and formats the text.
import { countOf, formatExact, formatList, formatUnits, groupDigits } from '../../core/format'
import type { CollateralHealth, CollateralLine, SupportedAssets, TokenInfo } from '../../core/options/types'
import { backingFor, lineTotal } from '../../core/reserves/reserves'
import { ITEM_COPY, SUMMARY_NONE_SHORT, SUMMARY_SHORT, SUMMARY_UNKNOWN, UNDER_A_CENT } from './copy'

export type ReserveState = 'equal' | 'over' | 'short' | 'unknown'
export type TokenRole = 'quote' | 'underlying'
export type ItemKey = keyof typeof ITEM_COPY

export interface ReserveItem {
  key: ItemKey
  label: string
  meaning: string
  amount: bigint
}

export interface ReserveRow {
  token: TokenInfo
  role: TokenRole
  state: ReserveState
  /** What the contract owes: `open_collateral(token)`, or the sum of the items when that read is missing. */
  locked: bigint
  /** The contract's balance of the token; null when it could not be read. */
  held: bigint | null
  /** Held minus locked, signed; null when held is unknown. */
  difference: bigint | null
  /** The split of what is locked; null when the option list could not be read. */
  items: ReserveItem[] | null
  itemsTotal: bigint | null
  /** False when the split (built from the option list) and the contract's own figure disagree. */
  itemsMatch: boolean
}

const ZERO_LINE = (token: TokenInfo): CollateralLine => ({ token, offered: 0n, active: 0n, pendingReclaim: 0n, unclaimed: 0n, escrowed: 0n })

/** Escrow only ever exists in the quote token: the line is shown there, and anywhere it is not zero. */
function itemsOf(line: CollateralLine, role: TokenRole): ReserveItem[] {
  const keys: ItemKey[] = ['offered', 'active', 'pendingReclaim', 'unclaimed']
  if (role === 'quote' || line.escrowed !== 0n) keys.push('escrowed')
  return keys.map((key) => ({ key, label: ITEM_COPY[key].label, meaning: ITEM_COPY[key].meaning, amount: line[key] }))
}

/**
 * One row per token: the quote token first, then the underlyings in the contract's order, then any token that
 * only the reads know. `lines` or `health` may be missing (still loading, or the read failed):
 *   - no `health`: locked is the sum of the items, held and the difference are unknown;
 *   - no `lines`: locked and held are the contract's figures, the split is missing.
 */
export function reserveRows(assets: SupportedAssets | undefined, lines: readonly CollateralLine[] | undefined, health: readonly CollateralHealth[] | undefined): ReserveRow[] {
  const tokens = new Map<string, { token: TokenInfo; role: TokenRole }>()
  const add = (token: TokenInfo, role: TokenRole) => {
    if (!tokens.has(token.contractId)) tokens.set(token.contractId, { token, role })
  }
  if (assets) {
    add(assets.quote, 'quote')
    for (const u of assets.underlyings) add(u, 'underlying')
  }
  for (const h of health ?? []) add(h.token, 'underlying')
  for (const l of lines ?? []) add(l.token, 'underlying')

  return [...tokens.values()].map(({ token, role }) => {
    const line = lines?.find((l) => l.token.contractId === token.contractId)
    const read = health?.find((h) => h.token.contractId === token.contractId)
    // A token the health read does not list has nothing reserved and nothing held, when the split agrees.
    const assumedEmpty = health !== undefined && !read && lines !== undefined && lineTotal(line ?? ZERO_LINE(token)) === 0n
    const backing = backingFor(line ?? ZERO_LINE(token), read ?? (assumedEmpty ? { token, reserved: 0n, held: 0n } : undefined))
    const items = lines === undefined ? null : itemsOf(line ?? ZERO_LINE(token), role)
    const itemsTotal = lines === undefined ? null : lineTotal(line ?? ZERO_LINE(token))
    const state: ReserveState = backing.held === null ? 'unknown' : backing.status === 'short' ? 'short' : backing.held > backing.owed ? 'over' : 'equal'
    return {
      token,
      role,
      state,
      locked: backing.owed,
      held: backing.held,
      difference: backing.held === null ? null : backing.held - backing.owed,
      items,
      itemsTotal,
      itemsMatch: itemsTotal === null || itemsTotal === backing.owed,
    }
  })
}

export interface VisibleRows {
  shown: ReserveRow[]
  /** Listed tokens left out because nothing is locked and nothing is held, and the app does not list them first. */
  hiddenEmpty: number
}

/**
 * Anyone can list an asset in the contract, so the list of tokens can grow without anything being at stake.
 * The page always shows the quote token, the reference assets and every token with something locked, held or
 * unread; a listed token outside the reference list with nothing locked and nothing held is only counted.
 */
export function visibleRows(rows: readonly ReserveRow[], isReference: (contractId: string) => boolean): VisibleRows {
  const shown = rows.filter((r) => r.role === 'quote' || isReference(r.token.contractId) || r.locked !== 0n || (r.held !== null && r.held !== 0n) || r.state === 'short')
  return { shown, hiddenEmpty: rows.length - shown.length }
}

/** Rows whose held balance is below what is locked. */
export const shortRows = (rows: readonly ReserveRow[]): ReserveRow[] => rows.filter((r) => r.state === 'short')

/** `1,080.00`: two decimals, truncated, grouped. */
export const amountText = (units: bigint, token: Pick<TokenInfo, 'decimals'>): string => formatUnits(units, token.decimals)

/** Every digit, for the exact-value popover. */
export const exactText = (units: bigint, token: Pick<TokenInfo, 'decimals'>): string => formatExact(units, token.decimals)

/** The signed difference: `0.00`, `+0.40`, `−20.00`. Empty when held is unknown. */
export const differenceText = (row: Pick<ReserveRow, 'difference' | 'token'>): string => (row.difference === null ? '' : formatUnits(row.difference, row.token.decimals, { sign: true }))

/** The same with every digit. */
export const differenceExact = (row: Pick<ReserveRow, 'difference' | 'token'>): string => (row.difference === null ? '' : formatExact(row.difference, row.token.decimals, { sign: true }))

/** The magnitude of a shortfall or an excess without its sign: `20.00`; `under 0.01` below a cent. */
export const differenceMagnitude = (row: Pick<ReserveRow, 'difference' | 'token'>): string =>
  row.difference === null ? '' : subCent(row) ? UNDER_A_CENT : formatUnits(row.difference < 0n ? -row.difference : row.difference, row.token.decimals)

/** A difference that is not zero but smaller than one cent of the token, which two decimals cannot show. */
export function subCent(row: Pick<ReserveRow, 'difference' | 'token'>): boolean {
  if (row.difference === null || row.difference === 0n) return false
  const cent = row.token.decimals >= 2 ? 10n ** BigInt(row.token.decimals - 2) : 1n
  return (row.difference < 0n ? -row.difference : row.difference) < cent
}

/**
 * The difference as the Difference column shows it: the signed figure, or `under 0.01` (no sign: the word
 * beside it says short or over) when it is below a cent. The exact value stays one press away.
 */
export const differenceShown = (row: Pick<ReserveRow, 'difference' | 'token'>): string => (subCent(row) ? UNDER_A_CENT : differenceText(row))

/**
 * A length for the bullet drawing only. Scaled down first so a very large balance keeps its proportions as a
 * double; never shown as text and never used in arithmetic that reaches a figure.
 */
export function chartNumber(units: bigint, decimals: number): number {
  return Number(units) / 10 ** decimals
}

const TOKEN_FORMS = { one: 'token', other: 'tokens' }

/**
 * One plain sentence over the rows: which tokens are short, else that none is. It states two reads and their
 * comparison, nothing more.
 */
export function summaryLine(rows: readonly ReserveRow[]): string {
  if (rows.length === 0) return ''
  const short = rows.filter((r) => r.state === 'short')
  if (short.length > 0) return SUMMARY_SHORT(formatList(short.map((r) => r.token.code)))
  const unknown = rows.filter((r) => r.state === 'unknown')
  if (unknown.length > 0) return SUMMARY_UNKNOWN(unknown.length === rows.length ? `all ${countOf(rows.length, TOKEN_FORMS)}` : countOf(unknown.length, TOKEN_FORMS))
  return SUMMARY_NONE_SHORT(rows.length === 1 ? `${rows[0].token.code}` : `all ${countOf(rows.length, TOKEN_FORMS)}`)
}

/** What a screen reader hears for a row's difference: `short by 20.00 BOND`, `0.40 BOND over`, `no difference`. */
export function differenceSpoken(row: ReserveRow): string {
  if (row.difference === null) return 'difference unknown'
  if (row.state === 'short') return `short by ${differenceMagnitude(row)} ${row.token.code}`
  if (row.state === 'over') return `${differenceMagnitude(row)} ${row.token.code} over`
  return 'no difference'
}

/** `58,331,204`. */
export const ledgerText = (sequence: number): string => groupDigits(String(sequence))

const pad2 = (n: number) => String(n).padStart(2, '0')

/** `14:02:11 UTC` for milliseconds since the epoch: the read time, to the second. */
export function readTimeText(ms: number): string {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UTC`
}

/** ISO form for `<time dateTime>`. */
export function readTimeIso(ms: number): string {
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

