import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { referenceAssets } from '../assets'
import { BANNED_PRICE_TERMS, BANNED_WORDS, findBannedWords } from '../disclosures'
import type { OptionOffer } from '../options/types'
import { strikeLadder } from '../series'
import {
  DEMO_PRICES,
  DEMO_SOURCE,
  demoPerUnit,
  demoReference,
  describeReference,
  distancePct,
  exerciseValue,
  FAUCET_PRICE,
  FAUCET_SOURCE,
  faucetReference,
  intrinsicPerUnit,
  moneyness,
  noReference,
  optionMoneyness,
  priceOf,
  REFERENCE_LABEL,
  REFERENCE_NOTE,
  referenceFor,
} from './index'
import type { ReferenceKind, ReferencePrice } from './index'

const UNIT = 10_000_000n
const q = (text: string): bigint => {
  const [whole, frac = ''] = text.split('.')
  return BigInt(whole) * UNIT + BigInt(frac.padEnd(7, '0'))
}

const USDX = { contractId: 'C_MOCK_USDX', code: 'USDx', decimals: 7 }
const FUND = { contractId: 'C_MOCK_FUND', code: 'FUND', decimals: 7 }
const [RWA, BOND, EQTY] = referenceAssets('testnet')

describe('labels and notes', () => {
  const KINDS: ReferenceKind[] = ['demo', 'fixed', 'desk', 'none']

  it('uses the labels of the brief', () => {
    expect(REFERENCE_LABEL.demo).toBe('Demo price')
    expect(REFERENCE_LABEL.fixed).toBe('Testnet faucet price')
    expect(REFERENCE_LABEL.desk).toBe('Testnet desk price')
    expect(REFERENCE_NOTE.fixed).toBe("Fixed by the team's faucet. Not a market.")
  })

  it('never calls a reference a market, oracle or live price, and makes no promise', () => {
    for (const kind of KINDS) {
      for (const text of [REFERENCE_LABEL[kind], REFERENCE_NOTE[kind]]) {
        expect(findBannedWords(text, BANNED_PRICE_TERMS), text).toEqual([])
        expect(findBannedWords(text, BANNED_WORDS), text).toEqual([])
        expect(text.toLowerCase(), text).not.toMatch(/\b(oracle|live|spot|real-time)\b/)
        expect(text, text).not.toMatch(/[—–→!]/)
      }
      expect(REFERENCE_NOTE[kind]).toMatch(/^[A-Z].*\.$/)
    }
    for (const text of [FAUCET_SOURCE, DEMO_SOURCE]) {
      expect(findBannedWords(text, BANNED_PRICE_TERMS)).toEqual([])
      expect(text.toLowerCase()).not.toMatch(/\b(oracle|live|spot)\b/)
    }
  })

  it('says what the demo and the faucet figures are not', () => {
    expect(REFERENCE_NOTE.demo).toContain('Not a market.')
    expect(REFERENCE_NOTE.fixed).toContain('Not a market.')
  })
})

describe('demoReference (mock mode)', () => {
  it('exports the table the mock seed prices around', () => {
    expect(DEMO_PRICES).toEqual({ FUND: '10.20', BOND: '99.40', EQTY: '24.60' })
    expect(Object.keys(DEMO_PRICES).sort()).toEqual(referenceAssets('mock').map((a) => a.code).sort())
    expect(demoPerUnit('FUND')).toBe(q('10.2'))
    expect(demoPerUnit('BOND')).toBe(q('99.4'))
    expect(demoPerUnit('EQTY')).toBe(q('24.6'))
    expect(demoPerUnit('FUND', 2)).toBe(1020n)
    expect(demoPerUnit('GOLD')).toBeNull()
    expect(demoPerUnit('toString')).toBeNull()
    expect(demoPerUnit('constructor')).toBeNull()
  })

  it('gives a labelled demo price for each mock asset', () => {
    expect(demoReference('FUND')).toEqual({
      kind: 'demo',
      perUnit: q('10.2'),
      label: 'Demo price',
      note: 'Chosen by the team for this demo. Not a market.',
      asOf: null,
      source: 'Mock data.',
    })
    expect(demoReference(FUND).perUnit).toBe(q('10.2'))
    expect(demoReference('BOND').perUnit).toBe(q('99.4'))
    expect(demoReference('EQTY', 7).perUnit).toBe(q('24.6'))
  })

  it('has no price for other codes or for a Testnet token', () => {
    expect(demoReference('GOLD')).toEqual(noReference())
    expect(demoReference('fund')).toEqual(noReference())
    expect(demoReference(BOND)).toEqual(noReference()) // a Testnet contract id is not mock data
    expect(demoReference({ code: 'BOND', contractId: 'C_FIXTURE_BOND_TWIN' }).kind).toBe('demo') // keyed by code in mock data
  })

  it('puts each demo price on a ladder that brackets it', () => {
    for (const code of Object.keys(DEMO_PRICES)) {
      const ref = demoPerUnit(code)!
      const ladder = strikeLadder(ref, 7)
      expect(ladder[0] < ref && ref < ladder[ladder.length - 1], code).toBe(true)
    }
  })
})

describe('faucetReference (live mode)', () => {
  it('is 10 USDx per unit for the three listed assets', () => {
    expect(FAUCET_PRICE).toBe('10.00')
    for (const a of [RWA, BOND, EQTY]) {
      expect(faucetReference(a)).toEqual({
        kind: 'fixed',
        perUnit: q('10'),
        label: 'Testnet faucet price',
        note: "Fixed by the team's faucet. Not a market.",
        asOf: null,
        source: FAUCET_SOURCE,
      })
      expect(faucetReference(a.code).perUnit).toBe(q('10'))
    }
    expect(faucetReference('RWA', 2).perUnit).toBe(1000n)
  })

  it('matches the rate stated in the README when that sentence is present', () => {
    const readme = fileURLToPath(new URL('../../../../README.md', import.meta.url))
    const m = existsSync(readme) ? /(\d+) USDx per XLM, (\d+) RWA, BOND or EQTY per XLM/.exec(readme && readFileSync(readme, 'utf8')) : null
    if (!m) return // the sentence moved or the file is not there: nothing to compare against
    expect(Number(m[1]) / Number(m[2])).toBe(Number(FAUCET_PRICE))
  })

  it('gives no price to a look-alike from another issuer when the token is passed', () => {
    const twin = { code: 'BOND', contractId: 'CAHXPYLNWMBU6KSGG43IJP3I5AV4P6HA3RJD4HHPZSJCR2BVCGJZP53G' }
    expect(faucetReference(twin)).toEqual(noReference())
    expect(faucetReference({ code: 'GOLD', contractId: BOND.contractId }).kind).toBe('fixed') // identity is the contract id
  })

  it('has no price for unlisted codes, mock assets or the quote token', () => {
    expect(faucetReference('GOLD')).toEqual(noReference())
    expect(faucetReference('FUND')).toEqual(noReference())
    expect(faucetReference(FUND)).toEqual(noReference())
    expect(faucetReference('USDx')).toEqual(noReference())
    expect(faucetReference('bond')).toEqual(noReference())
  })
})

describe('referenceFor and noReference', () => {
  it('picks the provider for the mode', () => {
    expect(referenceFor('FUND', 'mock').kind).toBe('demo')
    expect(referenceFor('FUND', 'testnet').kind).toBe('none')
    expect(referenceFor(RWA, 'testnet').kind).toBe('fixed')
    expect(referenceFor(RWA, 'mock').kind).toBe('none')
    expect(referenceFor('BOND', 'mock').perUnit).toBe(q('99.4'))
    expect(referenceFor('BOND', 'testnet').perUnit).toBe(q('10'))
  })

  it('describes the absence of a reference', () => {
    expect(noReference()).toEqual({
      kind: 'none',
      perUnit: null,
      label: 'No reference price',
      note: 'Set an assumed price to see what an option would pay.',
      asOf: null,
    })
  })
})

const none = noReference()
const ref = (perUnit: bigint): ReferencePrice => ({ kind: 'demo', perUnit, label: 'Demo price', note: 'n', asOf: null })

describe('priceOf', () => {
  it('reads a reference, a bare price, or nothing', () => {
    expect(priceOf(ref(q('10')))).toBe(q('10'))
    expect(priceOf(q('10'))).toBe(q('10'))
    expect(priceOf(none)).toBeNull()
    expect(priceOf(null)).toBeNull()
    expect(priceOf(undefined)).toBeNull()
    expect(priceOf(0n)).toBeNull()
    expect(priceOf(-q('1'))).toBeNull()
    expect(priceOf(ref(0n))).toBeNull()
  })
})

describe('moneyness', () => {
  it('puts are in the money above the price, calls below', () => {
    expect(moneyness('put', q('10.4'), ref(q('10.2')))).toBe('in')
    expect(moneyness('put', q('10'), ref(q('10.2')))).toBe('out')
    expect(moneyness('call', q('10'), ref(q('10.2')))).toBe('in')
    expect(moneyness('call', q('10.4'), ref(q('10.2')))).toBe('out')
    expect(moneyness('put', q('10.2'), ref(q('10.2')))).toBe('at')
    expect(moneyness('call', q('10.2'), ref(q('10.2')))).toBe('at')
  })

  it('is exact to one unit', () => {
    expect(moneyness('put', q('10.2') + 1n, q('10.2'))).toBe('in')
    expect(moneyness('put', q('10.2') - 1n, q('10.2'))).toBe('out')
    expect(moneyness('call', q('10.2') - 1n, q('10.2'))).toBe('in')
  })

  it('widens at the money with a band', () => {
    expect(moneyness('put', q('10.25'), q('10.2'), q('0.05'))).toBe('at')
    expect(moneyness('put', q('10.15'), q('10.2'), q('0.05'))).toBe('at')
    expect(moneyness('put', q('10.25') + 1n, q('10.2'), q('0.05'))).toBe('in')
    expect(moneyness('call', q('10.25') + 1n, q('10.2'), q('0.05'))).toBe('out')
    expect(moneyness('put', q('10.2') + 1n, q('10.2'), -5n)).toBe('in') // a negative band is no band
  })

  it('is unknown without a price', () => {
    expect(moneyness('put', q('10'), none)).toBe('unknown')
    expect(moneyness('call', q('10'), null)).toBe('unknown')
    expect(moneyness('call', q('10'), undefined)).toBe('unknown')
    expect(moneyness('put', q('10'), 0n)).toBe('unknown')
  })

  it('marks the same strikes forever at the fixed faucet price', () => {
    const faucet = faucetReference(RWA)
    const ladder = strikeLadder(faucet.perUnit, 7)
    expect(ladder.map((k) => moneyness('put', k, faucet))).toEqual(['out', 'out', 'out', 'at', 'in', 'in', 'in'])
    expect(ladder.map((k) => moneyness('call', k, faucet))).toEqual(['in', 'in', 'in', 'at', 'out', 'out', 'out'])
  })
})

describe('intrinsicPerUnit', () => {
  it('is the in-the-money amount, floored at zero', () => {
    expect(intrinsicPerUnit('put', q('10'), q('9.2'))).toBe(q('0.8'))
    expect(intrinsicPerUnit('put', q('10'), q('10.2'))).toBe(0n)
    expect(intrinsicPerUnit('call', q('10'), q('10.2'))).toBe(q('0.2'))
    expect(intrinsicPerUnit('call', q('10'), q('9.2'))).toBe(0n)
    expect(intrinsicPerUnit('put', q('10'), q('10'))).toBe(0n)
    expect(intrinsicPerUnit('put', q('10'), ref(q('9.9999999')))).toBe(1n)
  })

  it('is null without a price', () => {
    expect(intrinsicPerUnit('put', q('10'), none)).toBeNull()
    expect(intrinsicPerUnit('call', q('10'), null)).toBeNull()
  })
})

const option = (over: Partial<OptionOffer> = {}): OptionOffer => ({
  id: 1n,
  kind: 'put',
  underlying: FUND,
  quote: USDX,
  underlyingQty: 5n * UNIT,
  totalStrike: q('50'),
  totalPremium: q('1.8'),
  expiry: 1_800_000_000,
  writer: 'GW',
  holder: 'GH',
  state: 'active',
  ...over,
})

describe('exerciseValue', () => {
  it('is what a put holder receives minus what the delivered asset is worth', () => {
    expect(exerciseValue(option(), q('7'))).toBe(q('15')) // 50 received for 5 FUND worth 35
    expect(exerciseValue(option(), q('10'))).toBe(0n)
    expect(exerciseValue(option(), q('10.2'))).toBe(-q('1')) // would give up 51 of value for 50
    expect(exerciseValue(option(), ref(q('9.64')))).toBe(q('1.8'))
  })

  it('is what a call holder receives in value minus the strike paid', () => {
    const call = option({ kind: 'call', underlyingQty: 3n * UNIT, totalStrike: q('36') })
    expect(exerciseValue(call, q('13'))).toBe(q('3'))
    expect(exerciseValue(call, q('12'))).toBe(0n)
    expect(exerciseValue(call, q('10.2'))).toBe(-q('5.4'))
  })

  it('does not include the premium', () => {
    expect(exerciseValue(option({ totalPremium: q('40') }), q('7'))).toBe(exerciseValue(option({ totalPremium: 0n }), q('7')))
  })

  it('truncates the exact difference toward zero, so neither a gain nor a loss is overstated', () => {
    // 0.3333333 FUND at 10.0000001 is worth 3.33333303333333 USDx; against a strike of 3.5 that is 0.16666696666667
    const sliver = option({ underlyingQty: 3_333_333n, totalStrike: q('3.5') })
    expect(exerciseValue(sliver, q('10') + 1n)).toBe(1_666_669n)
    expect(exerciseValue(option({ ...sliver, kind: 'call' }), q('10') + 1n)).toBe(-1_666_669n)
    // the smallest lot: 0.0000001 FUND is worth 0.000001 USDx at 10, against a strike of 0.0000001
    expect(exerciseValue(option({ underlyingQty: 1n, totalStrike: 1n }), q('10'))).toBe(-9n)
    expect(exerciseValue(option({ kind: 'call', underlyingQty: 1n, totalStrike: 1n }), q('10'))).toBe(9n)
    // a difference below one unit truncates to zero from either side
    expect(exerciseValue(option({ underlyingQty: 1n, totalStrike: 1n }), q('10.5'))).toBe(-9n) // exactly -9.5
    expect(exerciseValue(option({ underlyingQty: 3n, totalStrike: 1n }), 3_333_334n)).toBe(0n) // 1 against 1.0000002
    expect(exerciseValue(option({ kind: 'call', underlyingQty: 3n, totalStrike: 1n }), 3_333_334n)).toBe(0n)
  })

  it('respects the underlying decimals', () => {
    const cents = { contractId: 'CB', code: 'BOND', decimals: 2 }
    expect(exerciseValue({ kind: 'put', underlying: cents, underlyingQty: 250n, totalStrike: q('245') }, q('97'))).toBe(q('2.5'))
  })

  it('stays exact for amounts beyond the range of a number', () => {
    const big = option({ underlyingQty: 9_007_199_254_740_993n * UNIT, totalStrike: 9_007_199_254_740_993n * q('10') })
    expect(exerciseValue(big, q('9'))).toBe(9_007_199_254_740_993n * UNIT)
  })

  it('is null without a price', () => {
    expect(exerciseValue(option(), none)).toBeNull()
    expect(exerciseValue(option(), null)).toBeNull()
  })

  it('has the sign that moneyness reports', () => {
    for (const kind of ['put', 'call'] as const) {
      for (const price of [q('7'), q('9.9999999'), q('10'), q('10.0000001'), q('13')]) {
        const o = option({ kind })
        const v = exerciseValue(o, price)!
        const m = optionMoneyness(o, price)
        expect(m).toBe(moneyness(kind, q('10'), price))
        if (m === 'in') expect(v >= 0n).toBe(true)
        if (m === 'out') expect(v <= 0n).toBe(true)
        if (m === 'at') expect(v).toBe(0n)
      }
    }
  })
})

describe('optionMoneyness', () => {
  it('compares totals, so an uneven strike per unit is still exact', () => {
    const uneven = option({ underlyingQty: 3n * UNIT, totalStrike: q('10') }) // 3.3333333... per unit
    expect(optionMoneyness(uneven, q('3.3333333'))).toBe('in')
    expect(optionMoneyness(uneven, q('3.3333334'))).toBe('out')
    expect(optionMoneyness({ ...uneven, kind: 'call' }, q('3.3333334'))).toBe('in')
    expect(optionMoneyness(option(), q('10'))).toBe('at')
    expect(optionMoneyness(option(), none)).toBe('unknown')
  })
})

describe('distancePct', () => {
  it('is the strike relative to the reference, signed', () => {
    expect(distancePct(q('10.25'), q('10'))).toBe(2.5)
    expect(distancePct(q('9.6'), q('10'))).toBe(-4)
    expect(distancePct(q('10'), q('10'))).toBe(0)
    expect(distancePct(q('20'), q('10'))).toBe(100)
    expect(distancePct(q('10'), ref(q('10.2')))).toBe(-1.96) // -1.9607..., truncated
    expect(distancePct(q('10.4'), ref(q('10.2')))).toBe(1.96)
  })

  it('is null without a price', () => {
    expect(distancePct(q('10'), none)).toBeNull()
    expect(distancePct(q('10'), 0n)).toBeNull()
  })
})

describe('describeReference', () => {
  it('writes the figure with its label, unit and note', () => {
    expect(describeReference(faucetReference(RWA), { quoteCode: 'USDx', quoteDecimals: 7, underlyingCode: 'RWA' })).toBe(
      "Testnet faucet price: 10.00 USDx per RWA. Fixed by the team's faucet. Not a market.",
    )
    expect(describeReference(demoReference('BOND'), { quoteCode: 'USDx', quoteDecimals: 7, underlyingCode: 'BOND' })).toBe(
      'Demo price: 99.40 USDx per BOND. Chosen by the team for this demo. Not a market.',
    )
  })

  it('can show more digits for a low price', () => {
    const cents: ReferencePrice = { kind: 'demo', perUnit: q('0.064'), label: 'Demo price', note: 'Chosen by the team for this demo. Not a market.', asOf: null }
    const o = { quoteCode: 'USDx', quoteDecimals: 7, underlyingCode: 'MXBx' }
    expect(describeReference(cents, o)).toBe('Demo price: 0.06 USDx per MXBx. Chosen by the team for this demo. Not a market.')
    expect(describeReference(cents, { ...o, dp: 4 })).toBe('Demo price: 0.0640 USDx per MXBx. Chosen by the team for this demo. Not a market.')
  })

  it('says so when there is none', () => {
    expect(describeReference(none, { quoteCode: 'USDx', quoteDecimals: 7, underlyingCode: 'GOLD' })).toBe(
      'No reference price. Set an assumed price to see what an option would pay.',
    )
  })

  it('never uses the banned price terms', () => {
    for (const r of [faucetReference(RWA), demoReference('FUND'), none]) {
      const line = describeReference(r, { quoteCode: 'USDx', quoteDecimals: 7, underlyingCode: 'X' })
      expect(findBannedWords(line, BANNED_PRICE_TERMS)).toEqual([])
      expect(findBannedWords(line, BANNED_WORDS)).toEqual([])
    }
  })
})
