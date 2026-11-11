import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BANNED_PRICE_TERMS,
  BANNED_WORDS,
  bidEscrowDisclosure,
  clawbackShortfallDisclosure,
  clawbackShortfallParts,
  COLLATERAL_CARDS,
  DISCLOSURE_HOMES,
  findBannedWords,
  ISSUER_DISCLOSURE,
  MARGIN_BANNED_WORDS,
  MARGIN_BANNER_ONCHAIN,
  MARGIN_BANNER_SIMULATED,
  MARGIN_WARNING_BULLETS,
  MARGIN_WARNING_CONSENT,
  MARGIN_WARNING_TITLE,
  marginBanner,
  MOCK_DISCLOSURE,
  PAYOFF_CAPTION,
  PREMIUM_DISCLOSURE,
  RESALE_PRICE_DISCLOSURE,
  TESTNET_DISCLOSURE,
  WALLET_DISCLOSURE,
} from './disclosures'

describe('required sentences, verbatim (brief section 6.2)', () => {
  it('keeps the exact wording of each fixed sentence', () => {
    expect(TESTNET_DISCLOSURE).toBe('Stellar Testnet. Fictional assets and makers. No real funds.')
    expect(MOCK_DISCLOSURE).toBe('Mock data, not read from a chain.')
    expect(ISSUER_DISCLOSURE).toBe(
      'The issuer controls this asset and can freeze or claw it back, which can block settlement. Collateral does not cover that.',
    )
    expect(PREMIUM_DISCLOSURE).toBe('Paid to the maker now. Not refundable.')
    expect(RESALE_PRICE_DISCLOSURE).toBe('Set by the seller. Paid to the seller now.')
    expect(PAYOFF_CAPTION).toBe('Hypothetical payoff at expiry. Not a quote.')
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
    expect(MARGIN_BANNER_SIMULATED).toBe('Margin (experimental). Simulated on fixtures. No contract is called.')
    expect(MARGIN_BANNER_ONCHAIN).toBe(
      "Margin (experimental). Testnet contract. Partial margin: payouts can be reduced; any deficit is shown. Prices and the settlement price are set by the team's publisher.",
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

  it('keeps the two collateral cards', () => {
    expect(COLLATERAL_CARDS).toEqual([
      {
        value: 'full',
        title: 'Full collateral',
        body: 'You lock the full strike or the full underlying. Settlement is physical. Your only risk is issuer action.',
      },
      {
        value: 'margin',
        title: 'Margin',
        body: 'You post partial margin in USDx. Cash settlement at a published price. You can be liquidated, and if the vault runs dry the holder is paid less.',
      },
    ])
  })
})

// The old UI is the authority on wording. While its snapshot is still in the repository, every sentence is checked
// against the file it came from; the block is skipped once legacy-ui/ is deleted at the end of the revamp.
const LEGACY = fileURLToPath(new URL('../../legacy-ui/', import.meta.url))

describe.skipIf(!existsSync(LEGACY))('wording matches the legacy UI sources', () => {
  const read = (path: string) => readFileSync(`${LEGACY}${path}`, 'utf8')
  const sources: [string, string[]][] = [
    ['src/layout/AppShell.tsx', [`'${TESTNET_DISCLOSURE}'`, `'${MOCK_DISCLOSURE}'`]],
    ['src/market/BuyTicket.tsx', [ISSUER_DISCLOSURE, `>${PREMIUM_DISCLOSURE}<`]],
    ['src/resale/ResaleMarket.tsx', [ISSUER_DISCLOSURE, `>${RESALE_PRICE_DISCLOSURE}<`]],
    ['src/payoff/PayoffChart.tsx', [`>${PAYOFF_CAPTION}<`]],
    ['src/wallet/ConnectWalletDialog.tsx', [`>${WALLET_DISCLOSURE}<`]],
    ['src/requests/RequestDialog.tsx', [bidEscrowDisclosure('{amt(bid.totalPremium, q)}')]],
    ['src/reserves/ShortfallWarning.tsx', [`'${clawbackShortfallParts('X').rest.replace(' on X', '')}'`, 'Clawback shortfall on {token.code}']],
    ['src/pro/copy.ts', [`'${MARGIN_BANNER_SIMULATED}'`, `"${MARGIN_BANNER_ONCHAIN}"`]],
    [
      'src/market/MarginWarning.tsx',
      [
        `title="${MARGIN_WARNING_TITLE}"`,
        ...MARGIN_WARNING_BULLETS.map((b) => `<li>${b}</li>`),
        `<span>${MARGIN_WARNING_CONSENT}</span>`,
        ...COLLATERAL_CARDS.flatMap((c) => [`value: '${c.value}'`, `title: '${c.title}'`, `body: '${c.body}'`]),
      ],
    ],
    [
      'e2e/helpers.ts',
      [`'${TESTNET_DISCLOSURE}'`, `'${MOCK_DISCLOSURE}'`, `'${ISSUER_DISCLOSURE}'`, `'${PREMIUM_DISCLOSURE}'`, `'${PAYOFF_CAPTION}'`],
    ],
    ['e2e/requests.spec.ts', [`'${bidEscrowDisclosure('2.00 USDx')}'`]],
    ['e2e/pro.spec.ts', [`'${MARGIN_BANNER_SIMULATED}'`, `'${MARGIN_WARNING_BULLETS[0]}'`, `'${MARGIN_WARNING_BULLETS[1]}'`]],
  ]

  it.each(sources)('%s', (path, needles) => {
    const text = read(path)
    for (const needle of needles) expect(text, needle).toContain(needle)
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
      TESTNET_DISCLOSURE,
      MOCK_DISCLOSURE,
      ISSUER_DISCLOSURE,
      PREMIUM_DISCLOSURE,
      RESALE_PRICE_DISCLOSURE,
      PAYOFF_CAPTION,
      WALLET_DISCLOSURE,
      MARGIN_BANNER_SIMULATED,
      MARGIN_BANNER_ONCHAIN,
      ...MARGIN_WARNING_BULLETS,
      ...COLLATERAL_CARDS.map((c) => c.body),
    ]) {
      expect(texts).toContain(required)
    }
    expect(texts.some((t) => t.startsWith('Clawback shortfall on '))).toBe(true)
    expect(texts.some((t) => t.startsWith('You escrow '))).toBe(true)
  })

  it('follows the copy rules: sentence case, a final full stop, no dashes, arrows or exclamation marks', () => {
    for (const d of DISCLOSURE_HOMES) {
      expect(d.text, d.id).toMatch(/^[A-Z]/)
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
    for (const c of COLLATERAL_CARDS) expect(findBannedWords(c.title, MARGIN_BANNED_WORDS)).toEqual([])
  })
})
