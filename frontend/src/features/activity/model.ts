// The Activity list as rows. Pure: no React. The words for each state are the data layer's; this module adds
// the tone (which glyph and ink), the link to what the transaction concerns, and the explorer link.
import { explorerTx } from '../../core/explorer'
import { groupDigits } from '../../core/format'
import { TX_PHASE_HELP, TX_PHASE_LABEL, canCheckEntry, describeTx, entryState, isIssuerAction, isOpenEntry } from '../../data'
import type { ActivityEntry, ActivityPhase } from '../../data'
import { ISSUER_LINK, MARGIN_LINK, YOUR_OFFERS, YOUR_REQUESTS, YOUR_WRITTEN, confirmedIn, confirmedPlain, positionLabel, requestLabel } from './copy'

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
  /** What the state means for this transaction, and what happened to the fee. */
  note: string
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

/** The sentence under the state word. */
export function noteOf(entry: ActivityEntry): string {
  if (entry.phase === 'confirmed') {
    const done = entry.done ?? TX_PHASE_LABEL.confirmed
    return entry.ledger !== null ? confirmedIn(done, groupDigits(String(entry.ledger))) : confirmedPlain(done)
  }
  // An interrupted transaction carries its own explanation (the page was closed while it was in flight).
  if (entry.phase === 'unknown' && entry.error) return entry.error
  return describeTx(entryState(entry))?.detail ?? TX_PHASE_HELP[entry.phase]
}

export function activityRow(entry: ActivityEntry, options: TargetOptions): ActivityRow {
  return {
    id: entry.id,
    label: entry.label,
    terms: entry.detail ?? null,
    product: entry.product,
    startedAt: entry.startedAt,
    phase: entry.phase,
    state: TX_PHASE_LABEL[entry.phase],
    tone: TONE[entry.phase],
    note: noteOf(entry),
    hash: entry.hash,
    hashUrl: entry.hash && !entry.mock ? explorerTx(entry.hash) : null,
    mock: entry.mock,
    target: targetOf(entry, options),
    canCheck: canCheckEntry(entry),
    settled: !isOpenEntry(entry),
  }
}

export const activityRows = (entries: readonly ActivityEntry[], options: TargetOptions): ActivityRow[] => entries.map((e) => activityRow(e, options))

/** How many rows "Clear finished" would remove. */
export const settledCount = (rows: readonly ActivityRow[]): number => rows.filter((r) => r.settled).length
