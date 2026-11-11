import { describe, expect, it } from 'vitest'
import { DAY, ME, MAKER, NO_REFERENCE, NOW, U, USDX, opt, reference, todo, view } from './fixtures.testhelper'
import {
  actionsFor,
  allows,
  exactMoney,
  glyphOf,
  money,
  noteKind,
  optionPhrase,
  optionTitle,
  exerciseShortOf,
  premiumPerUnitLine,
  rankInSeries,
  referenceName,
  referencePhrase,
  sellLabel,
  serialOf,
  showsCard,
  stateName,
  strikeExact,
  strikeText,
} from './model'

describe('names and glyphs', () => {
  it('draws the long shape for the holder and for a viewer, the short shape for the writer', () => {
    expect(glyphOf('put', 'holder')).toBe('long-put')
    expect(glyphOf('call', 'holder')).toBe('long-call')
    expect(glyphOf('put', 'writer')).toBe('short-put')
    expect(glyphOf('call', 'writer')).toBe('short-call')
    expect(glyphOf('put', null)).toBe('long-put')
  })

  it('names the note by side', () => {
    expect(noteKind(opt(), 'holder')).toBe('Long put, FUND')
    expect(noteKind(opt({ kind: 'call' }), 'writer')).toBe('Short call, FUND')
    expect(noteKind(opt(), null)).toBe('Put, FUND')
  })

  it('names the option in a sentence and as a title', () => {
    expect(optionPhrase(opt())).toBe('put on 5.00\u00A0FUND')
    expect(optionTitle(opt({ kind: 'call' }))).toBe('Call on 5.00\u00A0FUND')
  })

  it('prints the serial unpadded, as the contract numbers it', () => {
    expect(serialOf(0n)).toBe('0')
    expect(serialOf(184n)).toBe('184')
    expect(serialOf(1_234_567n)).toBe('1234567')
  })

  it('keeps the contract state names, with Expired for an option past its deadline whether reclaimed or not', () => {
    expect(stateName(opt({ state: 'offered' }))).toBe('Offered')
    expect(stateName(opt({ state: 'active' }))).toBe('Active')
    expect(stateName(opt({ state: 'exercised' }))).toBe('Exercised')
    expect(stateName(opt({ state: 'settled' }))).toBe('Settled')
    expect(stateName(opt({ state: 'expired' }))).toBe('Expired')
    expect(stateName(opt({ state: 'reclaimed' }))).toBe('Expired')
    expect(stateName(opt({ state: 'cancelled' }))).toBe('Cancelled')
  })
})

describe('figures', () => {
  it('truncates to two decimals in tables and keeps every digit in sentences', () => {
    const odd = { token: USDX, amount: 12_345_678n }
    expect(money(odd)).toBe('1.23\u00A0USDx')
    expect(exactMoney(odd)).toBe('1.2345678\u00A0USDx')
    expect(exactMoney({ token: USDX, amount: 50_000_000n })).toBe('5.00\u00A0USDx')
  })

  it('gives the strike per unit, floored, and a dash for a zero quantity', () => {
    expect(strikeText(opt())).toBe('10.00')
    // 50 USDx for 3 FUND is 16.666... per unit: never rounded up.
    expect(strikeText(opt({ underlyingQty: 30_000_000n }))).toBe('16.66')
    expect(strikeExact(opt({ underlyingQty: 30_000_000n }))).toBe('16.6666666')
    expect(strikeText(opt({ underlyingQty: 0n }))).toBe('–')
  })
})

describe('reference wording', () => {
  it('names the source of the price, never a market', () => {
    expect(referenceName({ kind: 'demo' })).toBe('demo price')
    expect(referenceName({ kind: 'fixed' })).toBe('Testnet faucet price')
    expect(referenceName({ kind: 'desk' })).toBe('Testnet desk price')
  })

  it('says where a moneyness word was measured, or nothing without a price', () => {
    expect(referencePhrase(reference(982), USDX)).toBe('at the demo price 9.82')
    expect(referencePhrase(NO_REFERENCE, USDX)).toBeNull()
    expect(referencePhrase(null, USDX)).toBeNull()
  })
})

describe('actionsFor', () => {
  it('lets a holder exercise and list a live option', () => {
    expect(actionsFor(view(opt()), ME, NOW, true)).toEqual(['exercise', 'sell'])
  })

  it('adds the withdrawal of a listing once the option is listed', () => {
    const o = opt()
    const listed = view(o, reference(982), ME, NOW, [{ id: o.id, holder: ME, askTotal: 2n * 10_000_000n }])
    expect(actionsFor(listed, ME, NOW, true)).toEqual(['exercise', 'sell', 'unlist'])
    expect(sellLabel(listed.listing)).toBe('Change price')
    expect(sellLabel(null)).toBe('List for sale')
  })

  it('offers no resale on a contract without it', () => {
    expect(actionsFor(view(opt()), ME, NOW, false)).toEqual(['exercise'])
  })

  it('offers nothing to exercise once the deadline has passed, even before the next read', () => {
    const late = view(opt({ expiry: NOW - 5 }))
    expect(actionsFor(late, ME, NOW, true)).toEqual([])
  })

  it('gives a writer the claim, the reclaim or the cancellation that its state allows', () => {
    expect(actionsFor(view(opt({ writer: ME, holder: MAKER, state: 'exercised' })), ME, NOW, true)).toEqual(['claim'])
    expect(actionsFor(view(opt({ writer: ME, holder: MAKER, state: 'expired' })), ME, NOW, true)).toEqual(['reclaim'])
    expect(actionsFor(view(opt({ writer: ME, holder: null, state: 'offered' })), ME, NOW, true)).toEqual(['cancel'])
    expect(actionsFor(view(opt({ writer: ME, holder: MAKER, state: 'active' })), ME, NOW, true)).toEqual([])
  })

  it('gives nothing to a guest or to a wallet on neither side', () => {
    expect(actionsFor(null, null, NOW, true)).toEqual([])
    expect(actionsFor(null, ME, NOW, true)).toEqual([])
  })

  it('says whether a link may open an action', () => {
    expect(allows(['exercise', 'sell'], 'exercise')).toBe(true)
    expect(allows(['exercise', 'sell'], 'claim')).toBe(false)
    expect(allows(['exercise'], null)).toBe(false)
    expect(allows([], undefined)).toBe(false)
  })
})

describe('showsCard', () => {
  it('gives a card to what the wallet can do now, and a quiet one to a held option near its deadline or with no price', () => {
    // In the money: an action, at any distance.
    expect(showsCard(todo(opt(), reference(982)))).toBe(true)
    // Out of the money, 8 days out: no card. Inside 48 hours: a quiet card.
    expect(showsCard(todo(opt(), reference(1040)))).toBe(false)
    expect(showsCard(todo(opt({ expiry: NOW + DAY }), reference(1040)))).toBe(true)
    // No reference price: the deadline is real, the moneyness unknown.
    expect(showsCard(todo(opt(), NO_REFERENCE))).toBe(true)
    // A claim and a reclaim always; an option that lapsed never (it is one line above the tabs).
    expect(showsCard(todo(opt({ writer: ME, holder: MAKER, state: 'exercised' })))).toBe(true)
    expect(showsCard(todo(opt({ state: 'expired', expiry: NOW - DAY })))).toBe(false)
  })
})

describe('premium per unit and the rank of an open offer', () => {
  it('prints the premium per unit of underlying', () => {
    expect(premiumPerUnitLine(opt())).toBe('0.36\u00A0per\u00A0FUND')
    expect(premiumPerUnitLine(opt({ underlyingQty: 0n }))).toBeNull()
  })

  it('says whether an open offer is the lowest of its series, or by how much it is above', () => {
    const mine = opt({ id: 1n, writer: ME, holder: null, state: 'offered' })
    const cheaper = opt({ id: 2n, writer: MAKER, holder: null, state: 'offered', totalPremium: (15n * U) / 10n })
    const other = opt({ id: 3n, writer: MAKER, holder: null, state: 'offered', expiry: NOW + 9 * DAY, totalPremium: U })
    expect(rankInSeries(mine, [mine, other])).toBe('Lowest in its series')
    expect(rankInSeries(mine, [mine, cheaper, other])).toBe('0.06 above the lowest')
    expect(rankInSeries(opt(), [mine])).toBeNull()
  })
})

describe('exerciseShortOf', () => {
  it('says what an exercise takes that the wallet does not hold, and nothing when it is covered or unknown', () => {
    const put = opt()
    expect(exerciseShortOf(put, { C_F: { balance: U } })).toEqual({ have: { token: put.underlying, amount: U }, need: { token: put.underlying, amount: 5n * U } })
    expect(exerciseShortOf(put, { C_F: { balance: 5n * U } })).toBeNull()
    expect(exerciseShortOf(put, { C_F: { balance: null } })).toBeNull()
    expect(exerciseShortOf(put, undefined)).toBeNull()
    const call = opt({ kind: 'call' })
    expect(exerciseShortOf(call, { C_Q: { balance: 40n * U } })?.need).toEqual({ token: USDX, amount: 50n * U })
  })
})
