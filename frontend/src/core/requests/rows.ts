// The view model of one request, in one place (review finding 13): the Requests board, the asset page's Requests
// tab and the Portfolio's Orders tab read the same row, with the same figures, state words and deadline. No React.
// Amounts stay exact integer units until they are formatted here; nothing is computed with floats.
import { findReferenceAsset } from '../assets'
import { formatExact, formatUnits } from '../format/amount'
import { serialOf } from '../format/option'
import { formatUtc } from '../format/time'
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

/** `2.00 USDx`: a figure with its unit. */
export const figureText = (f: Figure): string => `${f.text} ${f.code}`

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
  /** Every term in one phrase, for accessible names: "put on 5.00 FUND at 10.00 USDx, until 13 Nov 2026, 08:00 UTC, premium 2.00 USDx". */
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
