// The Activity list as rows. Pure: no React. The words for each state are the data layer's; this module adds
// the tone (which glyph and ink), the link to what the transaction concerns, the explorer link, and the order
// the page lists them in (open ones first, then the finished ones by day).
import { explorerTx } from '../../core/explorer'
import { formatUtcDate, groupDigits, noBreak } from '../../core/format'
import { TX_PHASE_HELP, TX_PHASE_LABEL, canCheckEntry, describeTx, entryState, isIssuerAction, isOpenEntry } from '../../data'
import type { ActivityEntry, ActivityPhase } from '../../data'
import { ISSUER_LINK, MARGIN_LINK, OPEN_GROUP, YOUR_OFFERS, YOUR_REQUESTS, YOUR_WRITTEN, checkedNote, positionLabel, requestLabel, unknownNote } from './copy'

/**
 * How a state reads at a glance, always beside its word:
 * `working` is in flight, `confirmed` is on the ledger, `failed` did not go through, `unknown` needs a look,
 * `stopped` ended without effect (declined, expired).
 */
export type ActivityTone = 'working' | 'confirmed' | 'failed' | 'unknown' | 'stopped'

/** Where the link of a row goes. The component turns it into a router link. */
export type ActivityTarget =
  | { kind: 'position'; id: string; label: string }
  | { kind: 'offers'; label: string }
  | { kind: 'written'; label: string }
  | { kind: 'requests'; label: string }
  | { kind: 'margin'; label: string }
  | { kind: 'issuer'; label: string }

export interface ActivityRow {
  id: string
  /** What it is, with figures: "Buy put on 5.00 BOND". */
  label: string
  /** The terms behind the label, when the caller gave them. */
  terms: string | null
  product: ActivityEntry['product']
  /** Milliseconds since the epoch. */
  startedAt: number
  phase: ActivityPhase
  /** The state in a word or two: Pending, Confirmed, Failed, Outcome unknown... */
  state: string
  tone: ActivityTone
  /** The ledger that included a confirmed transaction, grouped: `58,331,204`. Null otherwise or on mock data. */
  ledger: string | null
  /**
   * What the state means for this transaction and what to do, and what happened to the fee. Null for a confirmed
   * row: its state word and ledger say it all, and the row stays one line.
   */
  note: string | null
  hash: string | null
  /** The explorer page of the hash. Null without a hash and on mock data. */
  hashUrl: string | null
  mock: boolean
  target: ActivityTarget | null
  /** The outcome is unknown and the hash is known: it can be looked up again. */
  canCheck: boolean
  /** The outcome is final. */
  settled: boolean
}

const TONE: Record<ActivityPhase, ActivityTone> = {
  checking: 'working',
  signing: 'working',
  submitting: 'working',
  pending: 'working',
  confirmed: 'confirmed',
  failed: 'failed',
  unknown: 'unknown',
  expired: 'stopped',
  declined: 'stopped',
}

export interface TargetOptions {
  /** The build has the Margin section. Without it a Margin entry has nowhere to link. */
  marginEnabled: boolean
}

export interface RowOptions extends TargetOptions {
  /** Now, in milliseconds since the epoch: an unknown outcome names its cut-off only while it is ahead. */
  now?: number
  /** When this page last looked an unknown entry up and found nothing, by entry id (milliseconds). */
  checkedAt?: ReadonlyMap<string, number>
}

/** What a transaction concerns: the position, the request, or the list where the new thing appears. */
export function targetOf(entry: Pick<ActivityEntry, 'product' | 'action' | 'subject' | 'created'>, options: TargetOptions): ActivityTarget | null {
  if (entry.product === 'margin') return options.marginEnabled ? { kind: 'margin', label: MARGIN_LINK } : null
  // An issuer action concerns a holder's trustline, not a position: the console is where its effect shows.
  if (isIssuerAction(entry.action)) return { kind: 'issuer', label: ISSUER_LINK }
  // A confirmed write that created something links the thing itself: the new option, the new request.
  const created = /^(option|bid):(\d+)$/.exec(entry.created ?? '')
  if (created?.[1] === 'option') return { kind: 'position', id: created[2], label: positionLabel(created[2]) }
  if (created?.[1] === 'bid') return { kind: 'requests', label: requestLabel(created[2]) }
  const subject = /^(option|bid):(\d+)$/.exec(entry.subject ?? '')
  // Filling a request creates an option the filler wrote: that is where to look afterwards.
  if (entry.action === 'fill-bid') return { kind: 'written', label: YOUR_WRITTEN }
  if (subject?.[1] === 'option') return { kind: 'position', id: subject[2], label: positionLabel(subject[2]) }
  if (subject?.[1] === 'bid') return { kind: 'requests', label: requestLabel(subject[2]) }
  if (entry.action === 'write-offer') return { kind: 'offers', label: YOUR_OFFERS }
  if (entry.action === 'create-bid') return { kind: 'requests', label: YOUR_REQUESTS }
  return null
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** `14:37:47 UTC` for milliseconds since the epoch. */
export function utcClock(ms: number): string {
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? '' : `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UTC`
}

/**
 * The sentence under the state word, or null for a confirmed transaction. An unknown outcome with a hash is
 * said in the ticket's words, with the time it can still go through until while that time is ahead, and, after
 * a look that found nothing, when that look was made.
 */
export function noteOf(entry: ActivityEntry, options: Pick<RowOptions, 'now' | 'checkedAt'> = {}): string | null {
  if (entry.phase === 'confirmed') return null
  if (entry.phase === 'unknown') {
    // Without a hash nothing can be looked up: the entry carries its own explanation (the page was closed while
    // it was being sent).
    if (!entry.hash) return entry.error ?? TX_PHASE_HELP.unknown
    const now = options.now ?? Date.now()
    const until = entry.maxTime !== null && entry.maxTime * 1000 > now ? noBreak(utcClock(entry.maxTime * 1000)) : null
    const checked = options.checkedAt?.get(entry.id)
    return checked === undefined ? unknownNote(until) : `${unknownNote(until)} ${checkedNote(noBreak(utcClock(checked)))}`
  }
  return describeTx(entryState(entry))?.detail ?? TX_PHASE_HELP[entry.phase]
}

export function activityRow(entry: ActivityEntry, options: RowOptions): ActivityRow {
  return {
    id: entry.id,
    label: entry.label,
    terms: entry.detail ?? null,
    product: entry.product,
    startedAt: entry.startedAt,
    phase: entry.phase,
    state: TX_PHASE_LABEL[entry.phase],
    tone: TONE[entry.phase],
    ledger: entry.phase === 'confirmed' && entry.ledger !== null ? groupDigits(String(entry.ledger)) : null,
    note: noteOf(entry, options),
    hash: entry.hash,
    hashUrl: entry.hash && !entry.mock ? explorerTx(entry.hash) : null,
    mock: entry.mock,
    target: targetOf(entry, options),
    canCheck: canCheckEntry(entry),
    settled: !isOpenEntry(entry),
  }
}

export const activityRows = (entries: readonly ActivityEntry[], options: RowOptions): ActivityRow[] => entries.map((e) => activityRow(e, options))

/** How many rows "Clear finished" would remove. */
export const settledCount = (rows: readonly ActivityRow[]): number => rows.filter((r) => r.settled).length

export interface ActivityGroup {
  /** `open`, or the UTC day of the rows: `day:2026-11-11`. */
  key: string
  /** `Waiting for an outcome`, or the day: `11 Nov 2026`. */
  title: string
  rows: ActivityRow[]
}

const dayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

/**
 * The order of the page: rows whose outcome is not final first (an unknown outcome before one in flight: it is
 * the one that asks for a look), then the finished rows under a heading per UTC day, newest first. Within a
 * group the order of the list is kept.
 */
export function groupRows(rows: readonly ActivityRow[]): ActivityGroup[] {
  const groups: ActivityGroup[] = []
  const open = rows.filter((r) => !r.settled)
  if (open.length) groups.push({ key: 'open', title: OPEN_GROUP, rows: [...open.filter((r) => r.tone === 'unknown'), ...open.filter((r) => r.tone !== 'unknown')] })
  for (const row of rows) {
    if (!row.settled) continue
    const key = `day:${dayKey(row.startedAt)}`
    const last = groups[groups.length - 1]
    if (last?.key === key) last.rows.push(row)
    else groups.push({ key, title: formatUtcDate(Math.floor(row.startedAt / 1000)), rows: [row] })
  }
  return groups
}

/** A date and time inside the terms ("deadline 13 Nov 2026, 08:00 UTC") never breaks across two lines. */
const DATE_IN_TERMS = /\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC/g
export const termsText = (terms: string): string => terms.replace(DATE_IN_TERMS, (date) => noBreak(date))

/** `15:41`: the UTC time of day, for a row under its day heading. */
export function utcTime(ms: number): string {
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? '' : `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
}

/** `2026-11-11T15:41:20Z`, for `<time dateTime>`. */
export function isoTime(ms: number): string {
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** `16:41`: the same instant in the viewer's zone (or in `timeZone`, for tests). */
export function localTime(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms))
}

/** The viewer's offset from UTC as `UTC+1`, `UTC−3:30`; null when it is UTC itself, which needs no second time. */
export function zoneLabel(ms: number, timeZone?: string): string | null {
  let name = ''
  try {
    name = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return null
  }
  const offset = name.replace(/^(GMT|UTC)/, '')
  return offset === '' || offset === '+0' || offset === '-0' ? null : `UTC${offset.replace('-', '−')}`
}
