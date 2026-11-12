// Every string of the chain view. Sentences are whole (never assembled from fragments in a component); counts
// go through core/format `countOf`, lists through `formatList`. One word per thing (DESIGN.md, ruling R7): a
// buyer's order is a request, the instant is the deadline, whoever wrote the option is the maker.
import { NBSP, countOf, plural } from '../../../core/format'
import type { OptionKind } from '../../../core/options/types'
import type { ReferenceKind } from '../../../core/reference'
import type { NonStandardReason } from '../../../core/series'

export { KIND_WORD } from '../../../core/format/option'
export const KIND_PLURAL: Record<OptionKind, string> = { call: 'Calls', put: 'Puts' }

export const MAKERS = { one: 'maker', other: 'makers' } as const
export const REQUESTS = { one: 'request', other: 'requests' } as const
export const OFFERS = { one: 'offer', other: 'offers' } as const
export const ORDERS = { one: 'order', other: 'orders' } as const

/** The tag on the dashed rule. The faucet rate says what it is in the tag itself (brief D12). */
export const REFERENCE_TAG: Record<Exclude<ReferenceKind, 'none'>, string> = {
  demo: 'Demo price',
  fixed: 'Testnet faucet price, fixed, not a market',
  desk: 'Testnet desk price',
}

/** The two-word label under a strike the reference equals (the strike already prints the figure). */
export const REFERENCE_LABEL: Record<Exclude<ReferenceKind, 'none'>, string> = {
  demo: 'Demo price',
  fixed: 'Faucet price',
  desk: 'Desk price',
}

/** The same reference inside a sentence ("in the money at the demo price"). */
export const REFERENCE_PHRASE: Record<Exclude<ReferenceKind, 'none'>, string> = {
  demo: 'the demo price',
  fixed: 'the Testnet faucet price',
  desk: 'the Testnet desk price',
}

/** The reasons of core/series `classifyOffer`, as a table cell. */
export const REASON_LABEL: Record<NonStandardReason, string> = {
  'lot below 1 unit': 'Lot below 1 unit',
  'off-grid strike': 'Off-grid strike',
  'non-standard expiry': 'Non-standard deadline',
  'premium off the 0.01 tick': 'Premium off the 0.01 tick',
  'put premium above strike': 'Put premium above strike',
}

/** The off-grid reason of an asset without a reference price: there is no ladder to be off. */
export const OFF_GRID_NO_REFERENCE = 'There is no reference price to place this strike on a ladder.'

/** What each reason means, for the legend under the "Other offers" table. */
export const REASON_MEANING: Record<NonStandardReason, string> = {
  'lot below 1 unit': 'The quantity is less than one whole unit of the asset.',
  'off-grid strike': 'The strike is not one of the listed strikes around the reference price.',
  'non-standard expiry': 'The deadline is not one of the listed Fridays at 08:00 UTC.',
  'premium off the 0.01 tick': 'The total premium is not a multiple of 0.01.',
  'put premium above strike': 'The premium is higher than the strike, which a put can never pay back.',
}

/** Who posted a row, by role: the maker of an offer, a holder selling on, a buyer's request. */
export const SOURCE_LABEL = { maker: 'Maker', resale: 'Seller', bid: 'Buyer' } as const

/** What the holder of one unit of the series may do, as a sentence start. */
export const RIGHT_OF: Record<OptionKind, string> = { call: 'The right to buy', put: 'The right to sell' }

export const COPY = {
  chainHeading: (code: string) => `${code} option chain`,
  deadlineLabel: 'Deadline',
  left: 'left',
  otherDates: 'Other dates',
  strike: 'Strike',
  offer: 'Offer',
  request: 'Request',
  yours: 'yours',
  /** The one instruction of chain mode, shown under the chain while nothing is selected (ruling E9). */
  selectHint: 'Select a premium to see its offers and requests.',
  selectHintNoBids: 'Select a premium to see its offers.',
  /** In place of the instruction when the deadline shown has no order at all (ruling F2). */
  noOrders: 'No orders on this deadline yet. Press a call or put cell to post a request, or write the first offer.',
  noOrdersNoBids: 'No orders on this deadline yet. Press a call or put cell to write the first offer.',
  /** The line under the deadlines. On a phone it also carries the number of orders on the deadline shown (ruling F3). */
  units: (quote: string, asset: string, deadline: string, orders: number | null = null) =>
    `Premiums per 1${NBSP}${asset} in ${quote}, sizes in ${asset}. Deadline ${deadline}${orders ? `, ${countOf(orders, ORDERS)}` : ''}.`,
  shaded: (phrase: string) => `Shaded cells are in the money at ${phrase}.`,
  noReference: 'No reference price for this asset, so moneyness is not shown.',
  deadlinePassed: (day: string, shown: string) => `The ${day} deadline has passed. Showing ${shown}.`,
  notADeadline: (day: string, shown: string) => `${day} is not a listed deadline. Showing ${shown}.`,
  /** Screen-reader words of an expiry tab: `2 offers and 1 request`, or none. */
  ordersOn: (offers: number, requests: number) =>
    offers === 0 && requests === 0 ? 'no orders' : [offers ? countOf(offers, OFFERS) : '', requests ? countOf(requests, REQUESTS) : ''].filter(Boolean).join(' and '),

  loading: (code: string) => `Loading the ${code} chain`,
  loadFailedTitle: 'The chain could not be read',
  loadFailedHint: 'Nothing is shown because no data was read from the contract.',
  retry: 'Try again',
  refreshFailed: 'The last refresh failed. Figures are from the last successful read.',
  refresh: 'Read again',
  notListed: 'This asset is not listed in the contract.',
  noStrikes: (code: string) => `No reference price and no offers on ${code}, so there are no strikes to list.`,
  /** No reference price to build a ladder on, but orders exist: they are listed under "Other offers". */
  noLadder: (code: string, count: number) =>
    plural(count, {
      one: `No reference price, so no strike ladder. The 1 order on ${code} is listed below.`,
      other: `No reference price, so no strike ladder. The ${countOf(count, ORDERS)} on ${code} are listed below.`,
    }),
  noStrikesHint: 'Write the first offer or post a request at your own terms.',
  writeFirst: 'Write an offer',

  writeHere: 'Write an offer',
  bidHere: 'Post a request',
  offers: 'Offers',
  requests: 'Requests',
  book: (title: string) => `Book of ${title}`,
  noOffers: 'No offers on this series.',
  noRequests: 'No requests on this series.',
  emptySeries: 'Nothing is posted on this series.',
  offGridSeries: 'Not on the listed grid.',
  bookUnits: (asset: string, quote: string) => `Quantities in ${asset}, premiums in ${quote}.`,
  /** The line between the two sides of the book. */
  gap: (spread: string) => `${spread} between the best offer and the best request.`,
  crossed: (spread: string) => `The best request is ${spread} above the best offer.`,
  level: 'The best request equals the best offer.',
  youHold: (qty: string, code: string, kind: OptionKind) => `You hold ${qty}${NBSP}${code} of this ${kind}.`,
  youWrote: (qty: string, code: string, kind: OptionKind) => `You wrote ${qty}${NBSP}${code} of this ${kind}.`,
  viewPosition: 'View position',
  best: 'Best',
  yoursRow: 'Yours',
  writtenByYou: 'Written by you',
  manage: 'Manage',
  buy: 'Buy',
  fillRequest: 'Fill request',
  cancel: 'Cancel',
  colNo: 'No.',
  colFrom: 'From',
  colQty: 'Quantity',
  colPerUnit: 'Premium per unit',
  colPerUnitShort: 'Per unit',
  colTotal: 'Total premium',
  colEscrowed: 'Premium escrowed',
  colNote: 'Note',
  colAction: 'Action',
  colSeries: 'Series',
  colExpiry: 'Deadline (UTC)',
  colWhy: 'Reason',
  total: 'Total',
  checkTerms: 'Check terms: the premium is at least the total strike.',
  shortfall: (code: string) => `Reserve shortfall on ${code}.`,

  otherHeading: 'Other offers',
  otherIntro: (count: number) =>
    plural(count, {
      one: '1 order is on terms the chain does not list. It can still be traded.',
      other: `${countOf(count, ORDERS)} are on terms the chain does not list. Each can still be traded.`,
    }),
  otherDatesLink: (count: number) => `Other dates, ${countOf(count, ORDERS)}`,

  yourOrders: (code: string) => `Your orders on ${code}`,

  cancelOfferTitle: 'Cancel offer',
  cancelBidTitle: 'Cancel request',
  cancelOfferBody: 'The offer leaves the book and its collateral returns to your wallet.',
  cancelOfferDone: 'The offer left the book and its collateral was returned to your wallet.',
  cancelBidDone: 'The request left the book and the premium you escrowed was refunded.',
  cancelBidBody: 'The request leaves the book and the premium you escrowed is refunded.',
  keepOffer: 'Keep offer',
  keepBid: 'Keep request',
  cancelOfferAction: 'Cancel offer',
  cancelBidAction: 'Cancel request',
  collateralReturned: 'Collateral returned',
  premiumRefunded: 'Premium refunded',
  close: 'Close',
  done: 'Done',
  checkAgain: 'Check again',
  tryAgain: 'Try again',
  busy: 'Another transaction is in progress.',
} as const
