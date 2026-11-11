// What the lazy chunk reports to the page. Plain data: the page and the hero widget never import the data layer.
import type { AssetSearch } from '../../../app/search'
import type { TokenInfo } from '../../../core/options/types'

/** The open put the widget shows. Every amount is exact units. */
export interface LiveOffer {
  /** Option id of the offer, or of the option a holder is reselling. */
  id: bigint
  source: 'maker' | 'resale'
  underlying: TokenInfo
  quote: TokenInfo
  underlyingQty: bigint
  totalStrike: bigint
  /** What the buyer pays: the maker's premium or the holder's ask. */
  totalPremium: bigint
  expiry: number
  strikePerUnit: bigint
  /** The maker, or the holder reselling. */
  seller: string
  /** What the contract holds for this option: the total strike of the put, in the quote token. */
  collateral: bigint
  /** Reference price per unit and its label ("Demo price"), or null when the asset has none. */
  reference: { perUnit: bigint; label: string } | null
  /** The `$asset` segment of the asset page. */
  assetParam: string
  /** Search of the asset page that opens the ticket on this offer. */
  ticketSearch: Partial<AssetSearch>
  /** Search of the asset page that opens the guided flow on these terms. */
  guidedSearch: AssetSearch
}

export interface LiveChoices {
  /** Reference assets with a put on offer. */
  assets: { id: string; code: string; typeLabel: string | null }[]
  assetId: string
  /** Floors on offer at the chosen deadline, per unit in quote units, with the cheapest premium per unit. */
  strikes: { value: bigint; perUnit: bigint | null }[]
  expiries: number[]
  /** Set when the floor asked for is not on offer at this deadline and the nearest one is shown. */
  movedFrom: bigint | null
}

interface Common {
  /** The build reads the in-memory demo book, not a chain. */
  mock: boolean
  /** Latest ledger of the network, when it was read (never in mock mode). */
  ledger: number | null
}

export type LiveState =
  | (Common & { status: 'loading' })
  | (Common & { status: 'open'; offer: LiveOffer; choices: LiveChoices })
  /** No standard put is on offer. `openOffers` counts what is open anyway on the reference assets, of any kind. */
  | (Common & { status: 'none'; openOffers: number })
  | (Common & { status: 'error'; retry: () => void })

/** What the visitor picked in the widget. Empty fields mean "the default". */
export interface LivePick {
  assetId?: string
  strike?: bigint
  expiry?: number
}
