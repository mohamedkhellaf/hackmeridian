import { describe, expect, it } from 'vitest'
import {
  BANNED_PRICE_TERMS,
  BANNED_WORDS,
  bidEscrowDisclosure,
  clawbackShortfallDisclosure,
  clawbackShortfallParts,
  BANNED_TAGLINES,
  COPYRIGHT_NOTICE,
  DISCLOSURE_HOMES,
  LEGAL_NOTICE,
  LEGAL_NOTICE_MOCK,
  legalNotice,
  findBannedWords,
  ISSUER_DISCLOSURE,
  MARGIN_BANNED_WORDS,
  MARGIN_BANNER_ONCHAIN,
  MARGIN_BANNER_SIMULATED,
  MARGIN_WARNING_BULLETS,
  MARGIN_WARNING_CONSENT,
  MARGIN_WARNING_TITLE,
  marginBanner,
  PAYOFF_CAPTION,
  PREMIUM_DISCLOSURE,
  RESALE_PRICE_DISCLOSURE,
  TRADEMARK_NOTICE,
  WALLET_DISCLOSURE,
} from './disclosures'

describe('required sentences, verbatim (brief section 6.2)', () => {
  it('keeps the exact wording of each fixed sentence', () => {
    expect(LEGAL_NOTICE).toBe(
      'This software is provided as is, without warranty of any kind. It runs on the Stellar test network, and the tokens it handles are test assets with no monetary value. Nothing here is an offer to sell, a solicitation to buy, or investment advice.',
    )
    expect(COPYRIGHT_NOTICE).toBe('\u00A9 2026 The StellSec authors.')
    expect(TRADEMARK_NOTICE).toBe(
      '\u201CStellar\u201D is a trademark of the Stellar Development Foundation. All rights reserved. This is independent software, not affiliated with, sponsored or endorsed by the Stellar Development Foundation.',
    )
    expect(LEGAL_NOTICE_MOCK).toBe(
      'This software is provided as is, without warranty of any kind. This build runs on an in-memory demo market: nothing is read from Stellar or sent to it, and the tokens shown have no monetary value. Nothing here is an offer to sell, a solicitation to buy, or investment advice.',
    )
    expect(findBannedWords(LEGAL_NOTICE, BANNED_TAGLINES)).toEqual([])
    expect(findBannedWords(LEGAL_NOTICE_MOCK, BANNED_TAGLINES)).toEqual([])
    expect(ISSUER_DISCLOSURE).toBe(
      'The issuer controls this asset and can freeze or claw it back, which can block settlement. Collateral does not cover that.',
    )
    expect(PREMIUM_DISCLOSURE).toBe('Paid to the maker now. Not refundable.')
    expect(RESALE_PRICE_DISCLOSURE).toBe('Set by the seller. Paid to the seller now.')
    expect(PAYOFF_CAPTION).toBe('Hypothetical payoff at the deadline. Not a quote.')
    expect(WALLET_DISCLOSURE).toBe('Set the wallet to Testnet. StellSec never asks for your secret key or recovery phrase.')
  })

  it('builds the clawback shortfall sentence for one token or several', () => {
    expect(clawbackShortfallDisclosure('BOND')).toBe(
      'Clawback shortfall on BOND: payouts are first come, first served until the balance runs out, with no refund, and new trades are refused.',
    )
    expect(clawbackShortfallDisclosure(['USDx'])).toBe(clawbackShortfallDisclosure('USDx'))
    expect(clawbackShortfallDisclosure(['RWA', 'USDx'])).toBe(
      'Clawback shortfall on RWA, USDx: payouts are first come, first served until the balance runs out, with no refund, and new trades are refused.',
    )
  })

  it('splits the shortfall sentence for a linked lead without changing a character', () => {
    for (const tokens of ['BOND', ['RWA', 'USDx']] as const) {
      const { lead, rest } = clawbackShortfallParts(tokens)
      expect(lead).toBe('Clawback shortfall')
      expect(lead + rest).toBe(clawbackShortfallDisclosure(tokens))
    }
  })

  it('builds the bid escrow sentence around a formatted amount', () => {
    expect(bidEscrowDisclosure('2.00 USDx')).toBe('You escrow 2.00 USDx now; refunded if you cancel or it expires.')
    expect(bidEscrowDisclosure('1,080.00 USDx')).toBe('You escrow 1,080.00 USDx now; refunded if you cancel or it expires.')
  })

  it('keeps both Margin banner variants and picks by build', () => {
    expect(MARGIN_BANNER_SIMULATED).toBe('Simulated: this section replays recorded scenarios, and no contract is called.')
    expect(MARGIN_BANNER_ONCHAIN).toBe(
      "Partial margin: payouts can be reduced; any deficit is shown. Prices and the settlement price are set by the team's publisher.",
    )
    expect(marginBanner(true)).toBe(MARGIN_BANNER_SIMULATED)
    expect(marginBanner(false)).toBe(MARGIN_BANNER_ONCHAIN)
  })

  it('keeps the three Margin warning bullets in order', () => {
    expect(MARGIN_WARNING_TITLE).toBe('Margin positions carry default risk')
    expect(MARGIN_WARNING_CONSENT).toBe('I understand')
    expect([...MARGIN_WARNING_BULLETS]).toEqual([
      'Partial margin can be liquidated at the published price.',
      'Payouts to holders can be reduced, and any deficit is shown.',
      'The price feed and the settlement price are published by the team, a demo oracle, not a market.',
    ])
  })

  it('picks one legal notice per build, never both', () => {
    expect(legalNotice(false)).toBe(LEGAL_NOTICE)
    expect(legalNotice(true)).toBe(LEGAL_NOTICE_MOCK)
    expect(LEGAL_NOTICE_MOCK).not.toContain('test network')
  })

  it('no longer carries the collateral cards of the old write ticket (ruling E1)', async () => {
    const mod: Record<string, unknown> = await import('./disclosures')
    expect(mod.COLLATERAL_CARDS).toBeUndefined()
    expect(DISCLOSURE_HOMES.some((d) => d.id.startsWith('collateral-card'))).toBe(false)
    expect(DISCLOSURE_HOMES.some((d) => /only risk/i.test(d.text))).toBe(false)
  })
})

describe('register of homes', () => {
  it('lists every required sentence once, each with a home', () => {
    const ids = DISCLOSURE_HOMES.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(DISCLOSURE_HOMES.map((d) => d.text)).size).toBe(DISCLOSURE_HOMES.length)
    for (const d of DISCLOSURE_HOMES) {
      expect(d.text.length, d.id).toBeGreaterThan(10)
      expect(d.home.length, d.id).toBeGreaterThan(5)
    }
    const texts = DISCLOSURE_HOMES.map((d) => d.text)
    for (const required of [
      LEGAL_NOTICE,
      LEGAL_NOTICE_MOCK,
      ISSUER_DISCLOSURE,
      PREMIUM_DISCLOSURE,
      RESALE_PRICE_DISCLOSURE,
      PAYOFF_CAPTION,
      WALLET_DISCLOSURE,
      MARGIN_BANNER_SIMULATED,
      MARGIN_BANNER_ONCHAIN,
      ...MARGIN_WARNING_BULLETS,
    ]) {
      expect(texts).toContain(required)
    }
    expect(texts.some((t) => t.startsWith('Clawback shortfall on '))).toBe(true)
    expect(texts.some((t) => t.startsWith('You escrow '))).toBe(true)
  })

  it('follows the copy rules: sentence case, a final full stop, no dashes, arrows or exclamation marks', () => {
    for (const d of DISCLOSURE_HOMES) {
      // Sentence case: a capital first, after an opening quotation mark if the sentence starts with a quoted name.
      expect(d.text, d.id).toMatch(/^\u201C?[A-Z]/)
      expect(d.text, d.id).toMatch(/\.$/)
      expect(d.text, d.id).not.toMatch(/[—–→←!]/)
      expect(d.text, d.id).toBe(d.text.trim())
      expect(d.text, d.id).not.toMatch(/\s{2,}/)
    }
  })
})

describe('banned wording', () => {
  it('lists the promise words of the honest-claims rules', () => {
    for (const w of ['guaranteed', 'insured', 'safe', 'secure', 'fully backed', 'risk-free', 'protected', 'insurance', 'protection', 'yield', 'apy', 'earn interest']) {
      expect(BANNED_WORDS, w).toContain(w)
    }
    expect(MARGIN_BANNED_WORDS).toEqual(expect.arrayContaining([...BANNED_WORDS, 'fully collateralized']))
    expect(BANNED_PRICE_TERMS).toEqual(expect.arrayContaining(['market price', 'oracle price']))
    for (const list of [BANNED_WORDS, MARGIN_BANNED_WORDS, BANNED_PRICE_TERMS]) {
      expect(new Set(list).size).toBe(list.length)
      for (const w of list) expect(w).toBe(w.toLowerCase())
    }
  })

  it('finds banned words as whole words, whatever the case', () => {
    expect(findBannedWords('Your collateral is safe and fully backed.')).toEqual(['safe', 'fully backed'])
    expect(findBannedWords('GUARANTEED payout')).toEqual(['guaranteed'])
    expect(findBannedWords('A risk free, Risk-Free trade')).toEqual(['risk-free'])
    expect(findBannedWords('Earn 12% APY')).toEqual(['apy'])
    expect(findBannedWords('Protect your holdings')).toEqual(['protect'])
    expect(findBannedWords('This position is fully collateralized.', MARGIN_BANNED_WORDS)).toEqual(['fully collateralized'])
    expect(findBannedWords('The market price is 10.00', BANNED_PRICE_TERMS)).toEqual(['market price'])
  })

  it('does not flag longer words or honest wording', () => {
    expect(findBannedWords('A cash-secured put locks the full strike.')).toEqual([])
    expect(findBannedWords('Unsafe, unsecured, uninsured, reinsured.')).toEqual([])
    expect(findBannedWords('You deliver 5.00 BOND and receive 50.00 USDx.')).toEqual([])
    expect(findBannedWords('13 Apr 2027, 08:00 UTC')).toEqual([])
    expect(findBannedWords('Fixed by the team’s faucet. Not a market.', BANNED_PRICE_TERMS)).toEqual([])
    expect(findBannedWords('')).toEqual([])
  })

  it('passes every required sentence, including the Margin ones against the Margin list', () => {
    for (const d of DISCLOSURE_HOMES) {
      expect(findBannedWords(d.text, MARGIN_BANNED_WORDS), d.id).toEqual([])
      expect(findBannedWords(d.text, BANNED_PRICE_TERMS), d.id).toEqual([])
    }
    expect(findBannedWords(MARGIN_WARNING_TITLE, MARGIN_BANNED_WORDS)).toEqual([])
  })
})
