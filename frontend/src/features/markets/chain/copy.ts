// Every string of the chain view. Sentences are whole (never assembled from fragments in a component); counts
// go through core/format `countOf`, lists through `formatList`.
import { countOf, plural } from '../../../core/format'
import type { OptionKind } from '../../../core/options/types'
import type { ReferenceKind } from '../../../core/reference'
import type { NonStandardReason } from '../../../core/series'

export const KIND_WORD: Record<OptionKind, string> = { call: 'Call', put: 'Put' }
export const KIND_PLURAL: Record<OptionKind, string> = { call: 'Calls', put: 'Puts' }

export const MAKERS = { one: 'maker', other: 'makers' } as const
export const BIDS = { one: 'bid', other: 'bids' } as const
export const OFFERS = { one: 'offer', other: 'offers' } as const
export const ORDERS = { one: 'order', other: 'orders' } as const
export const LISTINGS = { one: 'resale listing', other: 'resale listings' } as const

/** The tag on the dashed rule. The faucet rate says what it is in the tag itself (brief D12). */
export const REFERENCE_TAG: Record<Exclude<ReferenceKind, 'none'>, string> = {
  demo: 'Demo price',
  fixed: 'Testnet faucet price, fixed, not a market',
  desk: 'Testnet desk price',
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
  'non-standard expiry': 'Non-standard expiry',
  'premium off the 0.01 tick': 'Premium off the 0.01 tick',
  'put premium above strike': 'Put premium above strike',
}

/** What each reason means, for the legend under the "Other offers" table. */
export const REASON_MEANING: Record<NonStandardReason, string> = {
  'lot below 1 unit': 'The quantity is less than one whole unit of the asset.',
  'off-grid strike': 'The strike is not one of the listed strikes around the reference price.',
  'non-standard expiry': 'The deadline is not one of the listed Fridays at 08:00 UTC.',
  'premium off the 0.01 tick': 'The total premium is not a multiple of 0.01.',
  'put premium above strike': 'The premium is higher than the strike, which a put can never pay back.',
}

export const SOURCE_LABEL = { maker: 'Maker', resale: 'Resale', bid: 'Bid' } as const

/** What the holder of one unit of the series may do, as a sentence start. */
export const RIGHT_OF: Record<OptionKind, string> = { call: 'The right to buy', put: 'The right to sell' }

export const COPY = {
  chainHeading: (code: string) => `${code} option chain`,
  expiryLabel: 'Expiry',
  halfLabel: 'Side',
  left: 'left',
  deadlineIn: 'Deadline in',
  otherDates: 'Other dates',
  strike: 'Strike',
  makers: 'Makers',
  callPremium: 'Call premium',
  putPremium: 'Put premium',
  premium: 'Premium',
  noOffer: 'No offer',
  request: 'Request',
  yours: 'yours',
  bid: 'Bid',
  selectHint: 'Select a price to see every offer and bid on that series. An empty cell opens a request for a price.',
  selectHintNoBids: 'Select a price to see every offer on that series.',
  units: (quote: string, asset: string) => `Best premium for 1 ${asset}, in ${quote}.`,
  shaded: (phrase: string, price: string) => `Shaded cells are in the money at ${phrase}, ${price}.`,
  noReference: 'No reference price for this asset, so moneyness is not shown.',
  marked: 'The highlighter marks series where you hold an option, wrote one or have an order.',

  loading: (code: string) => `Loading the ${code} chain`,
  loadFailedTitle: 'The chain could not be read',
  loadFailedHint: 'Nothing is shown because no data was read from the contract.',
  retry: 'Try again',
  refreshFailed: 'The last refresh failed. Figures are from the last successful read.',
  refresh: 'Read again',
  notListed: 'This asset is not listed in the contract.',
  noStrikes: (code: string) => `No reference price and no offers on ${code}, so there are no strikes to list.`,
  noStrikesHint: 'Write the first offer or post a request at your own terms.',
  writeFirst: 'Write an offer',

  writeHere: 'Write an offer here',
  bidHere: 'Post a bid here',
  offers: 'Offers',
  bids: 'Bids',
  noOffers: 'No offers on this series.',
  noBids: 'No bids on this series.',
  emptySeries: 'Nothing is posted on this series.',
  emptySeriesHint: 'Post a bid to ask for a price, or write the first offer.',
  offGridSeries: 'This series is not on the standard grid. Its orders are also listed under Other offers.',
  bookNote: 'Every price is a limit set by a maker, a reselling holder or a buyer. Offers are funded in the contract before you pay.',
  best: 'Best',
  yoursRow: 'Yours',
  writtenByYou: 'Written by you',
  manage: 'Manage',
  buy: 'Buy',
  sellToBid: 'Sell to this bid',
  cancel: 'Cancel',
  colFrom: 'From',
  colQty: 'Quantity',
  colPerUnit: 'Premium per unit',
  colPerUnitShort: 'Per unit',
  colTotal: 'Total premium',
  colEscrowed: 'Premium escrowed',
  colNote: 'Note',
  colAction: 'Action',
  colSeries: 'Series',
  colExpiry: 'Expiry (UTC)',
  colWhy: 'Why it is here',
  total: 'Total',
  checkTerms: 'Check terms: the premium is at least the total strike.',
  shortfall: (code: string) => `Reserve shortfall on ${code}.`,

  otherHeading: 'Other offers',
  otherIntro: (count: number) =>
    plural(count, {
      one: '1 order on this asset is outside the standard grid, so it does not price a chain cell. It can still be traded.',
      other: `${countOf(count, ORDERS)} on this asset are outside the standard grid, so they do not price a chain cell. Each can still be traded.`,
    }),
  otherDatesLink: (count: number) => `Other dates, ${countOf(count, ORDERS)}`,

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
