// The product's glossary, in one place (review finding 15). Learn's glossary renders `GLOSSARY`; the kit's `Term`
// takes `definitionOf(id)` where a term meets the user in a flow (the guided rows, the ticket review, the receipt,
// the position note), so the popover and Learn say the same sentence. One word per thing (ruling R7): request,
// deadline, maker; "Writer" is Margin's own term.

export type TermId =
  | 'breakeven'
  | 'call'
  | 'claim-delivery'
  | 'collateral'
  | 'covered'
  | 'deadline'
  | 'eligible'
  | 'escrow'
  | 'exercise'
  | 'holder'
  | 'in-the-money'
  | 'issuer'
  | 'long-short'
  | 'lot'
  | 'maker'
  | 'margin'
  | 'offer'
  | 'premium'
  | 'put'
  | 'reclaim'
  | 'reference-price'
  | 'request'
  | 'resale-listing'
  | 'reserves'
  | 'strike'
  | 'usdx'
  | 'writer'

export interface GlossaryEntry {
  id: TermId
  /** The word as a heading or a label: "Premium". */
  term: string
  /** One sentence. */
  definition: string
}

/** In alphabetical order of the term. */
export const GLOSSARY: readonly GlossaryEntry[] = [
  { id: 'breakeven', term: 'Breakeven', definition: 'The price of the asset at which the option pays back exactly its premium, so having it and not having it come out the same.' },
  { id: 'call', term: 'Call', definition: 'The right to buy a set quantity of an asset for the strike, at any time before the deadline.' },
  { id: 'claim-delivery', term: 'Claim delivery', definition: 'After an exercise, the maker collects what the holder delivered: the asset for a put, the strike for a call.' },
  { id: 'collateral', term: 'Collateral', definition: 'What the maker locks in the contract to settle the option: the whole strike in USDx for a put, the whole quantity of the asset for a call.' },
  { id: 'covered', term: 'Covered', definition: 'The regime in which the maker locks the whole collateral before the sale.' },
  { id: 'deadline', term: 'Deadline', definition: 'The moment after which the option can no longer be exercised, by the close time of the ledger; it is also called the expiry.' },
  { id: 'eligible', term: 'Eligible', definition: 'Allowed by the issuer to hold the asset; the contract refuses a maker, a buyer or a new holder who is not.' },
  { id: 'escrow', term: 'Escrow', definition: 'A premium a buyer has paid into the contract with a request; it goes to the maker who fills the request, or back to the buyer who cancels it.' },
  { id: 'exercise', term: 'Exercise', definition: 'The holder uses the right: the asset and the strike change hands through the contract in one transaction, for the whole quantity.' },
  { id: 'holder', term: 'Holder', definition: 'The account that owns the option and the only one that can exercise it.' },
  { id: 'in-the-money', term: 'In the money', definition: 'A put when the asset is below the strike, a call when it is above, so that exercising would pay; the reverse is out of the money.' },
  { id: 'issuer', term: 'Issuer', definition: 'The account that issued an asset; it decides who may hold it and can freeze an account or claw tokens back.' },
  { id: 'long-short', term: 'Long and short', definition: 'Long is the side that holds the option and short the side that wrote it: a long put is a put you hold, a short call is a call you wrote.' },
  { id: 'lot', term: 'Lot', definition: 'The quantity of one offer, which is bought whole or not at all.' },
  { id: 'maker', term: 'Maker', definition: 'The account that locks the collateral and sells the option.' },
  { id: 'margin', term: 'Margin', definition: 'The separate contract in which a writer posts partial margin and calls settle in cash.' },
  { id: 'offer', term: 'Offer', definition: 'An option a maker has put up for sale, with its collateral already locked in the contract.' },
  { id: 'premium', term: 'Premium', definition: 'The price of the option, paid once by the buyer to the maker at purchase and never refunded.' },
  { id: 'put', term: 'Put', definition: 'The right to sell a set quantity of an asset for the strike, at any time before the deadline.' },
  { id: 'reclaim', term: 'Reclaim', definition: 'After the deadline, the maker takes back the collateral of an option that was not exercised.' },
  { id: 'reference-price', term: 'Reference price', definition: 'A price the interface shows, always with its source, to say where a strike stands; the Covered contract never reads a price.' },
  { id: 'request', term: 'Request', definition: 'The terms a buyer wants and the premium they offer, escrowed in the contract until a maker fills the request or the buyer cancels it; the contract calls it a bid.' },
  { id: 'resale-listing', term: 'Resale listing', definition: 'The price, in USDx, at which a holder is willing to hand an option over to an eligible buyer.' },
  { id: 'reserves', term: 'Reserves', definition: 'What the contract holds of each token, set against what it has locked for open offers, options and requests.' },
  { id: 'strike', term: 'Strike', definition: 'The price at which the holder can sell (put) or buy (call); the contract stores it as a total for the whole quantity.' },
  { id: 'usdx', term: 'USDx', definition: 'The test token in which strikes and premiums are paid, issued by the team.' },
  { id: 'writer', term: 'Writer', definition: 'In Margin, the account that sells a call and posts margin for it.' },
]

const BY_ID: ReadonlyMap<TermId, GlossaryEntry> = new Map(GLOSSARY.map((g) => [g.id, g]))

/** The one sentence for a term, for `Term` popovers: `definitionOf('premium')`. */
export function definitionOf(id: TermId): string {
  return BY_ID.get(id)?.definition ?? ''
}

/** The entry of a term, or undefined. */
export const glossaryEntry = (id: TermId): GlossaryEntry | undefined => BY_ID.get(id)
