import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, BANNED_WORDS, findBannedWords } from '../../core/disclosures'
import * as copy from './copy'
import { ME, MAKER, NO_REFERENCE, NOW, DAY, U, USDX, bid, opt, reference, todo, view } from './fixtures.testhelper'

const {
  calendarDescription,
  calendarTitle,
  cancelListingCopy,
  cancelOfferCopy,
  cancelRequestCopy,
  claimCopy,
  deliverySentence,
  exerciseCopy,
  noActionNote,
  outOfTheMoneyConsent,
  positionSentence,
  reclaimCopy,
  staleLink,
  statusLine,
  todoCopy,
  expiredRequestCopy,
  strikeAgainst,
} = copy

describe('to-do cards', () => {
  it('asks for an exercise only when the put is in the money at the reference, and says what moves', () => {
    const t = todo(opt({ expiry: NOW + DAY }), reference(982))
    const c = todoCopy(t)
    expect(t.tone).toBe('urgent')
    expect(c.title).toBe('Exercise your put on 5.00 FUND')
    expect(c.body).toBe('In the money at the demo price 9.82. You deliver 5.00 FUND and receive 50.00 USDx.')
    expect(c.action).toBe('exercise')
  })

  it('keeps an in-the-money exercise with time left as an action', () => {
    expect(todoCopy(todo(opt(), reference(982))).action).toBe('exercise')
  })

  it('words an out-of-the-money put by the price that would make it worth exercising, with no action', () => {
    const t = todo(opt(), reference(1040))
    const c = todoCopy(t)
    expect(t.tone).toBe('neutral')
    expect(c.title).toBe('Your put on 5.00 FUND')
    expect(c.body).toBe('Exercise only if FUND falls below 10.00 before the deadline. At the demo price 10.40 it is out of the money.')
    expect(c.body).not.toContain('unless you exercise')
    expect(c.action).toBeNull()
  })

  it('says "expires soon" in the title inside 48 hours', () => {
    expect(todoCopy(todo(opt({ expiry: NOW + DAY }), reference(1040))).title).toBe('Your put on 5.00 FUND expires soon')
  })

  it('words a call the other way round', () => {
    const call = opt({ kind: 'call' })
    expect(todoCopy(todo(call, reference(1040))).body).toBe('In the money at the demo price 10.40. You pay 50.00 USDx and receive 5.00 FUND.')
    expect(todoCopy(todo(call, reference(982))).body).toBe('Exercise only if FUND rises above 10.00 before the deadline. At the demo price 9.82 it is out of the money.')
  })

  it('never guesses without a reference price', () => {
    const c = todoCopy(todo(opt(), NO_REFERENCE))
    expect(c.body).toBe('No reference price for FUND. Exercising pays only if FUND is below 10.00 when you do it.')
    expect(c.action).toBeNull()
  })

  it('tells both kinds of maker to claim, once', () => {
    const put = todoCopy(todo(opt({ writer: ME, holder: MAKER, state: 'exercised' })))
    expect(put.title).toBe('Claim 5.00 FUND from your exercised put')
    expect(put.body).toBe('It waits in the contract until you claim it.')
    expect(put.action).toBe('claim')
    const call = todoCopy(todo(opt({ kind: 'call', writer: ME, holder: MAKER, state: 'exercised' })))
    expect(call.title).toBe('Claim 50.00 USDx from your exercised call')
  })

  it('tells a maker to reclaim after an expiry, for a sold option and for an unsold offer', () => {
    const sold = todoCopy(todo(opt({ writer: ME, holder: MAKER, state: 'expired', expiry: NOW - DAY })))
    expect(sold.title).toBe('Reclaim 50.00 USDx from your expired put')
    expect(sold.body).toBe('It stays in the contract until you reclaim it.')
    expect(sold.action).toBe('reclaim')
    const unsold = todoCopy(todo(opt({ writer: ME, holder: null, state: 'expired', expiry: NOW - DAY })))
    expect(unsold.title).toBe('Reclaim 50.00 USDx from your expired offer')
  })

  it('names an option that expired unexercised in one line, with no action', () => {
    const c = todoCopy(todo(opt({ state: 'expired', expiry: 1_794_556_800 }), reference(982), ME, 1_794_556_800 + DAY))
    expect(c.title).toBe('Your put on 5.00 FUND expired on 13 Nov 2026, 08:00 UTC without being exercised.')
    expect(c.action).toBeNull()
  })

  it('asks the buyer of an expired request to take its premium back', () => {
    const c = expiredRequestCopy({ token: USDX, amount: 2n * U }, 'put on 5.00 FUND')
    expect(c.title).toBe('Take back 2.00 USDx from your expired request')
    expect(c.body).toBe('No maker filled your request for a put on 5.00 FUND. The premium stays in the contract until you cancel it.')
  })

  it('says what the wallet holds of what an exercise takes', () => {
    expect(copy.exerciseCover(opt(), { token: opt().underlying, amount: U }, { token: opt().underlying, amount: 5n * U })).toBe('You hold 1.00 of the 5.00 FUND this exercise delivers.')
    expect(copy.exerciseCover(opt({ kind: 'call' }), { token: USDX, amount: 40n * U }, { token: USDX, amount: 50n * U })).toBe('You have 40.00 of the 50.00 USDx the strike costs.')
  })

  it('says where the strike stands against the reference, with the two-word source label', () => {
    expect(strikeAgainst(view(opt(), reference(982)))).toBe('Demo price 9.82, below the strike 10.00')
    expect(strikeAgainst(view(opt(), reference(1040)))).toBe('Demo price 10.40, above the strike 10.00')
    expect(strikeAgainst(view(opt({ kind: 'call' }), reference(1040)))).toBe('Demo price 10.40, above the strike 10.00')
    expect(strikeAgainst(view(opt(), NO_REFERENCE))).toBeNull()
  })
})

describe('sentences of the position page and the dialogs', () => {
  it('states both legs of an exercise', () => {
    expect(deliverySentence(opt())).toBe('You deliver 5.00 FUND and receive 50.00 USDx.')
    expect(deliverySentence(opt({ kind: 'call' }))).toBe('You pay 50.00 USDx and receive 5.00 FUND.')
  })

  it('keeps every digit of an amount in a sentence about what moves', () => {
    expect(deliverySentence(opt({ underlyingQty: 51_234_567n }))).toBe('You deliver 5.1234567 FUND and receive 50.00 USDx.')
  })

  it('describes the option from the side of whoever looks', () => {
    expect(positionSentence(opt(), 'holder')).toBe('Exercise to sell 5.00 FUND for 50.00 USDx, at any time before the deadline.')
    expect(positionSentence(opt({ kind: 'call' }), 'holder')).toBe('Exercise to buy 5.00 FUND for 50.00 USDx, at any time before the deadline.')
    expect(positionSentence(opt(), 'writer')).toBe(
      'If the holder exercises, you buy 5.00 FUND for 50.00 USDx. Your 50.00 USDx stays in the contract until you claim after an exercise or reclaim after the deadline.',
    )
    expect(positionSentence(opt({ kind: 'call' }), 'writer')).toBe(
      'If the holder exercises, you sell 5.00 FUND for 50.00 USDx. Your 5.00 FUND stays in the contract until you claim after an exercise or reclaim after the deadline.',
    )
    expect(positionSentence(opt(), null)).toBe('The right to sell 5.00 FUND for 50.00 USDx until the deadline.')
    expect(positionSentence(opt({ state: 'expired' }), null)).toBe('This option expired without being exercised.')
    expect(positionSentence(opt({ kind: 'call', state: 'settled' }), null)).toBe('This call was exercised: its holder bought 5.00 FUND for 50.00 USDx.')
    expect(positionSentence(opt({ state: 'exercised' }), 'writer')).toBe('The holder exercised. 5.00 FUND waits in the contract until you claim it.')
    expect(positionSentence(opt(), 'holder', { token: USDX, amount: 2n * U })).toContain('It is listed for resale at 2.00 USDx.')
  })

  it('has a status line for every state and side', () => {
    expect(statusLine(view(opt()))).toBe('Exercisable until the deadline')
    expect(statusLine(view(opt({ writer: ME, holder: MAKER })))).toBe('Sold. Collateral locked until exercise or the deadline')
    expect(statusLine(view(opt({ writer: ME, holder: null, state: 'offered' })))).toBe('For sale in Markets')
    expect(statusLine(view(opt({ writer: ME, holder: MAKER, state: 'exercised' })))).toBe('Exercised. 5.00 FUND waits for your claim')
    expect(statusLine(view(opt({ writer: ME, holder: MAKER, state: 'expired' })))).toBe('Expired. 50.00 USDx waits for your reclaim')
    expect(statusLine(view(opt({ state: 'expired' })))).toBe('Expired without exercise')
    expect(statusLine(view(opt({ writer: ME, holder: null, state: 'cancelled' })))).toBe('Offer cancelled. Collateral returned')
  })

  it('explains why a position shows no button only where the header has not said it', () => {
    expect(noActionNote(view(opt({ writer: ME, holder: MAKER })))).toBeNull()
    expect(noActionNote(view(opt({ state: 'expired' })))).toBeNull()
    expect(noActionNote(view(opt({ state: 'exercised' })))).toBe('Nothing is left for you to do. The maker still claims its side from the contract.')
  })

  it('keeps the name of an action from the button to the receipt', () => {
    expect(exerciseCopy(opt())).toMatchObject({ title: 'Exercise put on 5.00 FUND', confirm: 'Exercise', done: 'Exercised: put on 5.00 FUND' })
    expect(claimCopy(opt({ state: 'exercised' }))).toMatchObject({ title: 'Claim delivery', confirm: 'Claim delivery', done: 'Delivery claimed: put on 5.00 FUND' })
    expect(reclaimCopy(opt({ state: 'expired' }))).toMatchObject({ confirm: 'Reclaim', done: 'Reclaimed: put on 5.00 FUND' })
    expect(cancelOfferCopy(opt({ holder: null, state: 'offered' }))).toMatchObject({ confirm: 'Cancel offer', dismiss: 'Keep offer' })
    expect(cancelListingCopy(opt(), { token: USDX, amount: 2n * U })).toMatchObject({ confirm: 'Cancel listing', dismiss: 'Keep listing' })
    expect(cancelRequestCopy({ token: USDX, amount: 2n * U }, 'put on 5.00 FUND', false).body).toBe('Your escrowed 2.00 USDx goes back to your wallet.')
    expect(cancelRequestCopy({ token: USDX, amount: 2n * U }, 'put on 5.00 FUND', false).caveat).toContain('the cancellation is refused and you hold the option')
    expect(cancelRequestCopy({ token: USDX, amount: 2n * U }, 'put on 5.00 FUND', true).caveat).toBeUndefined()
    expect(cancelRequestCopy({ token: USDX, amount: 2n * U }, 'put on 5.00 FUND', true).body).toContain('This request expired without a maker.')
  })

  it('warns that a cancellation can lose the race against a buyer', () => {
    expect(cancelOfferCopy(opt({ holder: null, state: 'offered' })).caveat).toContain('the cancellation is refused and the option is sold')
    expect(cancelListingCopy(opt(), { token: USDX, amount: 2n * U }).caveat).toContain('the buyer has paid you and holds the option')
  })

  it('names the source in the consent for an exercise that loses value', () => {
    expect(outOfTheMoneyConsent('demo price')).toBe('I want to exercise although the option is out of the money at the demo price.')
  })
})

describe('read errors', () => {
  it('keeps a readable message and translates a failed download', () => {
    expect(copy.readError(null)).toBe('The contract did not answer.')
    expect(copy.readError('RPC 503')).toBe('RPC 503.')
    expect(copy.readError('Option not found.')).toBe('Option not found.')
    expect(copy.readError('Failed to fetch dynamically imported module: http://x/y.ts')).toBe('The connection to the contract could not be loaded. Check your network.')
  })
})

describe('calendar entry', () => {
  it('says what ends, what is needed, and that nothing happens by itself', () => {
    const o = opt({ expiry: 1_794_556_800 }) // 13 Nov 2026, 08:00 UTC
    expect(calendarTitle(o)).toBe('Exercise deadline: FUND 10.00 put (5.00 FUND)')
    const text = calendarDescription(o)
    expect(text).toContain('Your right to sell 5.00 FUND for 50.00 USDx ends at 13 Nov 2026, 08:00 UTC.')
    expect(text).toContain('Nothing happens automatically.')
    expect(text).toContain('To exercise you need 5.00 FUND in your wallet.')
    expect(text).toContain('does not update if you sell or exercise')
    expect(calendarDescription(opt({ kind: 'call' }))).toContain('To exercise you need 50.00 USDx in your wallet.')
    for (const entry of [text, calendarDescription(opt({ kind: 'call' }))]) expect(findBannedWords(entry, BANNED_TAGLINES), entry).toEqual([])
  })
})

describe('honest wording', () => {
  // Every string and every sentence builder of the feature, with representative terms.
  const samples: string[] = []
  const collect = (value: unknown): void => {
    if (typeof value === 'string') samples.push(value)
    else if (Array.isArray(value)) value.forEach(collect)
    else if (value && typeof value === 'object') Object.values(value).forEach(collect)
  }
  const put = opt()
  const call = opt({ kind: 'call' })
  for (const [name, value] of Object.entries(copy)) if (typeof value !== 'function') collect({ [name]: value })
  const states = ['offered', 'active', 'exercised', 'settled', 'expired', 'reclaimed', 'cancelled'] as const
  for (const o of [put, call]) {
    for (const state of states) {
      for (const role of ['holder', 'writer', null] as const) collect(positionSentence({ ...o, state }, role))
      collect(statusLine(view({ ...o, state })))
      collect(statusLine(view({ ...o, state, writer: ME, holder: state === 'offered' || state === 'cancelled' ? null : MAKER })))
    }
    for (const ref of [reference(982), reference(1000), reference(1040), NO_REFERENCE]) collect(todoCopy(todo(o, ref)))
    collect(todoCopy(todo({ ...o, writer: ME, holder: MAKER, state: 'exercised' })))
    collect(todoCopy(todo({ ...o, writer: ME, holder: MAKER, state: 'expired', expiry: NOW - DAY })))
    collect(todoCopy(todo({ ...o, state: 'expired', expiry: NOW - DAY })))
    collect([exerciseCopy(o), claimCopy(o), reclaimCopy(o), cancelOfferCopy(o), cancelListingCopy(o, { token: USDX, amount: U })])
    collect([calendarTitle(o), calendarDescription(o), copy.makerCalendarTitle(o), copy.makerCalendarDescription(o), deliverySentence(o)])
    collect(noActionNote(view(o)) ?? '')
    collect(strikeAgainst(view(o)) ?? '')
  }
  collect(cancelRequestCopy({ token: bid().quote, amount: bid().totalPremium }, 'put on 5.00 FUND', false))
  collect(cancelRequestCopy({ token: bid().quote, amount: bid().totalPremium }, 'put on 5.00 FUND', true))
  for (const action of ['exercise', 'claim', 'reclaim', 'cancel', 'sell', 'unlist'] as const) collect(staleLink(action))
  collect(outOfTheMoneyConsent('demo price'))
  collect(expiredRequestCopy({ token: bid().quote, amount: bid().totalPremium }, 'put on 5.00 FUND'))

  it('collected the copy', () => {
    expect(samples.length).toBeGreaterThan(120)
  })

  it('never promises, never calls a reference a market price, and carries no disclaimer tagline', () => {
    for (const text of samples) {
      expect(findBannedWords(text), text).toEqual([])
      expect(findBannedWords(text, BANNED_PRICE_TERMS), text).toEqual([])
      expect(findBannedWords(text, BANNED_TAGLINES), text).toEqual([])
    }
    expect(BANNED_WORDS.length).toBeGreaterThan(10)
  })

  it('has no em dash, arrow, exclamation mark or middle dot, and no contract error names', () => {
    for (const text of samples) {
      expect(text, text).not.toMatch(/[—→←⇒!·]/)
      expect(text, text).not.toMatch(/\b(NotEligible|WrongState|SelfTrade|PriceMoved)\b/)
    }
  })

  it('says maker, request and deadline: never writer, bid or expiry as a noun', () => {
    for (const text of samples) {
      expect(text, text).not.toMatch(/\b(writer|counterparty|bid)\b/i)
      expect(text, text).not.toMatch(/\bat expiry\b|\bthe expiry\b/i)
    }
  })
})
