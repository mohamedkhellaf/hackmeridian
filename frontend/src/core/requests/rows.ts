// The view model of one request, in one place (review finding 13): the Requests board, the asset page's Requests
// tab and the Portfolio's Orders tab read the same row, with the same figures, state words and deadline. No React.
// Amounts stay exact integer units until they are formatted here; nothing is computed with floats.
import { findReferenceAsset } from '../assets'
import { NBSP, formatExact, formatUnits } from '../format/amount'
import { serialOf } from '../format/option'
import { URGENCY_15MIN_SECONDS, formatUtc } from '../format/time'
import type { TokenInfo } from '../options/types'
import { referenceFor } from '../reference'
import { shortBy, perUnit } from '../units'
import { fillCollateral } from './requests'
import type { Bid, BidState } from './types'

export interface Figure {
  /** Two decimals, grouped, truncated. */
  text: string
  /** Every digit, for the exact-value popover. */
  exact: string
  code: string
}

export const figureOf = (units: bigint, token: { decimals: number; code: string }): Figure => ({
  text: formatUnits(units, token.decimals),
  exact: formatExact(units, token.decimals),
  code: token.code,
})

/** `2.00 USDx`: a figure with its unit, joined by a no-break space so the two never part (ruling F7). */
export const figureText = (f: Figure): string => `${f.text}${NBSP}${f.code}`

/** The wallet's requests whose premium is still in the contract (open, or expired and not cancelled yet). */
export const holdsEscrow = (b: Bid): boolean => b.state === 'open' || b.state === 'expired'

/** What the money of a request is doing, by state. */
export type EscrowStatus = 'escrowed' | 'stranded' | 'paid' | 'refunded'

export const ESCROW_STATUS: Readonly<Record<BidState, EscrowStatus>> = { open: 'escrowed', expired: 'stranded', filled: 'paid', cancelled: 'refunded', pruned: 'refunded' }

/** The contract's own state name for the tag. A pruned request is `Expired` on chain. */
export const STATE_NAME: Readonly<Record<BidState, string>> = { open: 'Open', expired: 'Expired', filled: 'Filled', cancelled: 'Cancelled', pruned: 'Expired' }

/** A reference price as a row shows it: its two-word source label and the figure per unit. */
export interface RowReference {
  /** `Demo price`, `Testnet faucet price`. */
  label: string
  /** Quote units per whole unit of underlying, two decimals, truncated. */
  text: string
}

export interface RequestRow {
  bid: Bid
  key: string
  serial: string
  assetCode: string
  /** `Bond`, `Fund share`, `Equity` for a reference asset; null otherwise. */
  typeLabel: string | null
  kind: 'put' | 'call'
  kindWord: 'Put' | 'Call'
  /** The request is for a long option: the buyer will hold it. */
  glyph: 'long-put' | 'long-call'
  quantity: Figure
  /** Quote units for one whole unit of underlying, truncated. */
  strike: Figure
  /** The reference price of the underlying, labelled with its source; null when there is none. */
  reference: RowReference | null
  strikeTotal: Figure
  premium: Figure
  premiumPerUnit: Figure
  /** What a maker locks to fill it: the total strike for a put, the underlying for a call. */
  lock: Figure
  lockToken: TokenInfo
  lockUnits: bigint
  deadlineSec: number
  /** `13 Nov 2026, 08:00 UTC`. */
  deadlineText: string
  state: BidState
  stateName: string
  escrow: EscrowStatus
  mine: boolean
  /** Set once the request was filled. */
  optionId: bigint | null
  /** Every term in one phrase, for accessible names: "put on 5.00 RWA at 10.00 USDx, until 13 Nov 2026, 08:00 UTC, premium 2.00 USDx". */
  terms: string
}

/**
 * The view model of one request. `reference` names where reference prices come from (`referenceMode()` of the
 * data layer); without it the row carries none.
 */
export function requestRow(bid: Bid, me: string | null, reference: 'mock' | 'testnet' | null = null): RequestRow {
  const quote = { decimals: bid.quote.decimals, code: bid.quote.code }
  const strike = figureOf(perUnit(bid.totalStrike, bid) ?? 0n, quote)
  const premiumPerUnit = figureOf(perUnit(bid.totalPremium, bid) ?? 0n, quote)
  const quantity = figureOf(bid.underlyingQty, bid.underlying)
  const premium = figureOf(bid.totalPremium, bid.quote)
  const collateral = fillCollateral(bid)
  const deadlineText = formatUtc(bid.expiry)
  const listed = findReferenceAsset(bid.underlying.contractId)
  const ref = reference ? referenceFor(bid.underlying, reference, bid.quote.decimals) : null
  return {
    bid,
    key: bid.id.toString(),
    serial: serialOf(bid.id),
    assetCode: bid.underlying.code,
    typeLabel: listed?.typeLabel ?? null,
    kind: bid.kind,
    kindWord: bid.kind === 'put' ? 'Put' : 'Call',
    glyph: bid.kind === 'put' ? 'long-put' : 'long-call',
    quantity,
    strike,
    reference: ref && ref.perUnit !== null && ref.perUnit > 0n ? { label: ref.label, text: formatUnits(ref.perUnit, bid.quote.decimals) } : null,
    strikeTotal: figureOf(bid.totalStrike, bid.quote),
    premium,
    premiumPerUnit,
    lock: figureOf(collateral.amount, collateral.token),
    lockToken: collateral.token,
    lockUnits: collateral.amount,
    deadlineSec: bid.expiry,
    deadlineText,
    state: bid.state,
    stateName: STATE_NAME[bid.state],
    escrow: ESCROW_STATUS[bid.state],
    mine: me !== null && bid.buyer === me,
    optionId: bid.optionId,
    terms: `${bid.kind} on ${figureText(quantity)} at ${figureText(strike)}, until ${deadlineText}, premium ${figureText(premium)}`,
  }
}

export const requestRows = (bids: readonly Bid[], me: string | null, reference: 'mock' | 'testnet' | null = null): RequestRow[] => bids.map((b) => requestRow(b, me, reference))

/**
 * How much of the collateral the wallet is missing, or null when it has enough or the balance is not known.
 * Only a hint on the row: the ticket runs the full checks before anything is signed.
 */
export function lockShortfall(row: Pick<RequestRow, 'lockUnits' | 'lockToken'>, balance: bigint | null | undefined): { have: Figure; missing: Figure } | null {
  if (balance === null || balance === undefined) return null
  const missing = shortBy(balance, row.lockUnits)
  return missing > 0n ? { have: figureOf(balance, row.lockToken), missing: figureOf(missing, row.lockToken) } : null
}

// ------------------------------------------------------------------------------- how an open request is drawn
// /requests and an asset's Requests tab draw a request the same way (ruling F15): these columns in this order, the
// premium per unit with the total beneath it, the deadline as `13 Nov 2026, 08:00 UTC` with the time left beneath
// it, and on phones the same card. The words live here so that the two pages cannot drift apart.

/**
 * The column headers. `asset` leads only on /requests, where the board spans assets; `state` takes the place of
 * `buyer` in the wallet's own list.
 */
export const REQUEST_COLUMNS = {
  asset: 'Asset',
  kind: 'Kind',
  strike: 'Strike',
  quantity: 'Quantity',
  deadline: 'Deadline',
  premium: 'Premium per unit',
  buyer: 'Buyer',
  state: 'State',
  action: 'Action',
} as const

export const FILL_REQUEST = 'Fill request'
/** The one name of cancelling a request, before and after its deadline: either way the premium comes back (F9). */
export const CANCEL_REQUEST = 'Cancel request'
/** The wallet's own request, before its address in the buyer cell. */
export const YOURS = 'Yours'
/** Under a deadline less than 15 minutes away (brief D17): a fill signed now may land after it. */
export const LAPSE_LINE = 'A fill may land too late'

/** `No. 3`: the contract's id of the request, unpadded (ruling F1). */
export const serialText = (serial: string): string => `No. ${serial}`
/** The title of a phone card, what is wanted: `Put on 10.00 RWA`. */
export const requestTitle = (row: Pick<RequestRow, 'kindWord' | 'quantity'>): string => `${row.kindWord} on ${figureText(row.quantity)}`
/** After the total under the premium per unit (`2.80 USDx in total`); the figure is an Amount. */
export const IN_TOTAL = 'in total'
/** After the premium per unit on a phone card, where no column header names the unit: `per RWA`. */
export const perAsset = (row: Pick<RequestRow, 'assetCode'>): string => `per ${row.assetCode}`

/** Accessible names: the visible label first, then the data it acts on. */
export const fillRequestLabel = (row: RequestRow): string => `${FILL_REQUEST}: ${row.terms}, you lock ${figureText(row.lock)}`
export const cancelRequestLabel = (row: RequestRow): string => `${CANCEL_REQUEST} ${serialText(row.serial)}: ${row.terms}`

/** Under 48 hours the countdown of the wallet's own open request takes the warning tone and a clock. */
export const WARN_BELOW_MS = 48 * 3_600 * 1_000

/** The warning tone of a countdown: only on the wallet's own request, whose premium waits on it. */
export const warnBelowOf = (row: Pick<RequestRow, 'mine'>): number | undefined => (row.mine ? WARN_BELOW_MS : undefined)

/** A request of another wallet with under 15 minutes left: a fill signed now may land after the deadline. */
export function lapsing(row: Pick<RequestRow, 'mine' | 'state' | 'deadlineSec'>, nowSec: number): boolean {
  const left = row.deadlineSec - nowSec
  return !row.mine && row.state === 'open' && left > 0 && left <= URGENCY_15MIN_SECONDS
}
