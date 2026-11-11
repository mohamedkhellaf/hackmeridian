import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clawbackShortfallDisclosure } from '../disclosures'
import { demoReference } from '../reference/providers'
import type { Bid } from '../requests/types'
import type { BalanceView } from './feasibility'
import { MockOptionsClient } from './mockClient'
import { bareSeed } from './mockSeed'
import { preTrade, readPreTradeFacts, tokensFor } from './preTrade'
import type { PreTradeFacts, PreTradeIssue } from './preTrade'
import type { Ask, CollateralHealth, NewOffer, OptionOffer, TokenInfo } from './types'

const U = 10_000_000n
const NOW = 1_800_000_000
const USDX: TokenInfo = { contractId: 'C_MOCK_USDX', code: 'USDx', decimals: 7 }
const FUND: TokenInfo = { contractId: 'C_MOCK_FUND', code: 'FUND', decimals: 7 }
const ME = 'GME'
const MAKER = 'GMAKER'

const offer = (over: Partial<OptionOffer> = {}): OptionOffer => ({
  id: 1n, kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * U, totalStrike: 50n * U, totalPremium: (18n * U) / 10n,
  expiry: NOW + 3 * 86400, writer: MAKER, holder: null, state: 'offered', ...over,
})
const ok = (units: bigint): BalanceView => ({ status: 'ok', balance: units })
const bals = (usdx: bigint, fund: bigint) => ({ [USDX.contractId]: ok(usdx), [FUND.contractId]: ok(fund) })
const facts = (over: Partial<PreTradeFacts> = {}): PreTradeFacts => ({ me: ME, nowSec: NOW, eligible: true, balances: bals(1000n * U, 100n * U), health: [], ...over })
const codes = (issues: PreTradeIssue[]) => issues.map((i) => `${i.level}:${i.code}`)
const short: CollateralHealth[] = [{ token: FUND, reserved: 10n * U, held: 4n * U }]

describe('preTrade: buy an offer', () => {
  const action = { type: 'buy' as const, offer: offer() }

  it('passes when the offer is still open, the account is authorized and the premium is affordable', () => {
    const r = preTrade(action, facts({ option: offer() }))
    expect(r.blocked).toBe(false)
    expect(r.pending).toBe(false)
    expect(r.issues).toEqual([])
    expect(r.state).toEqual({ label: 'Offer', status: 'ok', text: 'Open' })
    expect(r.account).toEqual({ label: 'Your account', status: 'ok', text: 'Authorized by the FUND issuer' })
    expect(r.funds).toEqual({ label: 'USDx balance', status: 'ok', text: '1,000.00 USDx, enough' })
    expect(r.pays).toEqual({ token: USDX, amount: (18n * U) / 10n })
    expect(r.locks).toBeNull()
  })

  it('says "Checking" while facts are being read, and does not block', () => {
    const r = preTrade(action, { me: ME, nowSec: NOW })
    expect(r.pending).toBe(true)
    expect(r.blocked).toBe(false)
    expect(r.state?.text).toBe('Checking')
    expect(r.account?.text).toBe('Checking')
    expect(r.funds?.text).toBe('Checking')
  })

  it('a failed re-read is unknown and never blocks: the contract is the final check', () => {
    const r = preTrade(action, facts({ option: 'unknown', eligible: 'unknown', balances: {} }))
    expect(r.blocked).toBe(false)
    expect(r.pending).toBe(false)
    expect(r.state).toMatchObject({ status: 'unknown', text: 'Could not re-check. The contract rejects the purchase if it is gone.' })
    expect(r.account).toMatchObject({ status: 'unknown', text: 'Could not check' })
    expect(r.funds).toMatchObject({ status: 'unknown', text: 'Not checked' })
  })

  it('blocks when the offer was bought, cancelled or has expired meanwhile', () => {
    for (const fresh of [offer({ state: 'active', holder: 'GX' }), offer({ state: 'cancelled' }), offer({ expiry: NOW - 1 })]) {
      const r = preTrade(action, facts({ option: fresh }))
      expect(r.blocked).toBe(true)
      expect(r.issues[0]).toMatchObject({ level: 'block', code: 'gone', what: 'offer' })
      expect(r.issues[0].message).toBe('This offer is no longer open: it was bought, cancelled or has expired. Pick another offer.')
      expect(r.state).toMatchObject({ status: 'fail', text: 'No longer open' })
    }
  })

  it('blocks with exact figures when the premium is not affordable', () => {
    const r = preTrade(action, facts({ option: offer(), balances: bals((12n * U) / 10n, 100n * U) }))
    const issue = r.issues.find((i) => i.code === 'insufficient-funds')
    expect(issue).toMatchObject({ level: 'block', purpose: 'premium', need: { token: USDX, amount: (18n * U) / 10n }, have: { token: USDX, amount: (12n * U) / 10n }, short: { token: USDX, amount: (6n * U) / 10n } })
    expect(issue?.message).toBe('You have 1.20 USDx; this needs 1.80 USDx. Get test funds or pick a smaller offer.')
    expect(r.funds).toMatchObject({ status: 'fail', text: '0.60 USDx short' })
    expect(r.blocked).toBe(true)
  })

  it('blocks on a missing trustline, a frozen balance and an unfunded account', () => {
    const withStatus = (status: BalanceView['status']) => preTrade(action, facts({ option: offer(), balances: { [USDX.contractId]: { status, balance: null }, [FUND.contractId]: ok(100n * U) } }))
    expect(codes(withStatus('no-trustline').issues)).toEqual(['block:no-trustline'])
    expect(withStatus('no-trustline').issues[0].message).toBe('Your account has no USDx trustline, so it cannot pay the premium. Add the trustline first.')
    expect(codes(withStatus('not-authorized').issues)).toEqual(['block:frozen-balance'])
    expect(codes(withStatus('unfunded').issues)).toEqual(['block:unfunded-account'])
    // Mock and failed readings are unknown.
    expect(withStatus('mock').blocked).toBe(false)
    expect(withStatus('error').blocked).toBe(false)
  })

  it('blocks when the issuer has not authorized the account', () => {
    const r = preTrade(action, facts({ option: offer(), eligible: false }))
    expect(r.issues[0]).toMatchObject({ level: 'block', code: 'not-authorized', token: FUND })
    expect(r.issues[0].message).toBe('The FUND issuer has not authorized your account. You cannot buy this option yet.')
    expect(r.account).toMatchObject({ status: 'fail', text: 'Not authorized by the FUND issuer' })
  })

  it('blocks buying your own offer', () => {
    const r = preTrade({ type: 'buy', offer: offer({ writer: ME }) }, facts({ option: offer({ writer: ME }) }))
    expect(r.issues[0]).toMatchObject({ level: 'block', code: 'self-trade', what: 'own-offer' })
  })

  it('blocks on a clawback shortfall with the required sentence', () => {
    const r = preTrade(action, facts({ option: offer(), health: short }))
    const issue = r.issues.find((i) => i.code === 'clawback-shortfall')
    expect(issue).toMatchObject({ level: 'block', tokens: [FUND] })
    expect(issue?.message).toBe(clawbackShortfallDisclosure('FUND'))
  })

  it('warns, without blocking, when the buyer could not exercise with the balance it has today', () => {
    const r = preTrade(action, facts({ option: offer(), balances: bals(1000n * U, 2n * U) }))
    expect(r.blocked).toBe(false)
    expect(codes(r.issues)).toEqual(['warn:exercise-unfunded'])
    expect(r.issues[0].message).toMatch(/deliver 5\.00 FUND, but you hold 2\.00 FUND/)
  })

  it('warns on a premium at or above the total strike', () => {
    const trap = offer({ totalPremium: 50n * U })
    const r = preTrade({ type: 'buy', offer: trap }, facts({ option: trap }))
    expect(codes(r.issues)).toContain('warn:implausible-terms')
  })

  it('warns inside the last 15 minutes before the deadline', () => {
    const late = offer({ expiry: NOW + 14 * 60 })
    const r = preTrade({ type: 'buy', offer: late }, facts({ option: late }))
    expect(r.issues.find((i) => i.code === 'last-minutes')).toMatchObject({ level: 'warn', secondsLeft: 14 * 60 })
    const fine = offer({ expiry: NOW + 16 * 60 })
    expect(codes(preTrade({ type: 'buy', offer: fine }, facts({ option: fine })).issues)).not.toContain('warn:last-minutes')
  })

  it('lists blocking issues before warnings', () => {
    const r = preTrade(action, facts({ option: offer(), eligible: false, balances: bals(1000n * U, 0n) }))
    expect(codes(r.issues)).toEqual(['block:not-authorized', 'warn:exercise-unfunded'])
  })

  it('shows terms to a guest without pretending to have checked the account', () => {
    const r = preTrade(action, { me: null, nowSec: NOW, option: offer() })
    expect(r.pending).toBe(false)
    expect(r.blocked).toBe(false)
    expect(r.account?.text).toBe('Connect a wallet to check')
    expect(r.funds?.text).toBe('Connect a wallet to check')
  })
})

describe('preTrade: buy from a holder (resale)', () => {
  const option = offer({ id: 4n, state: 'active', holder: 'GSELLER' })
  const ask: Ask = { id: 4n, holder: 'GSELLER', askTotal: (18n * U) / 10n }
  const action = { type: 'buy-resale' as const, option, ask }

  it('passes when the listing is unchanged', () => {
    const r = preTrade(action, facts({ option, liveAsk: ask.askTotal }))
    expect(r.issues).toEqual([])
    expect(r.state).toEqual({ label: 'Listing', status: 'ok', text: 'For sale' })
    expect(r.pays).toEqual({ token: USDX, amount: ask.askTotal })
  })

  it('reports a re-priced listing with both prices', () => {
    const r = preTrade(action, facts({ option, liveAsk: (21n * U) / 10n }))
    expect(r.issues[0]).toMatchObject({ level: 'block', code: 'price-changed', was: { amount: (18n * U) / 10n }, now: { amount: (21n * U) / 10n } })
    expect(r.issues[0].message).toBe('The seller changed the price to 2.10 USDx (it was 1.80 USDx). Review the new price before buying.')
    expect(r.state).toMatchObject({ status: 'fail', text: 'Price changed to 2.10 USDx' })
  })

  it('blocks when the listing is gone (withdrawn, sold, exercised, transferred or expired)', () => {
    for (const f of [facts({ option, liveAsk: null }), facts({ option: { ...option, holder: 'GOTHER' }, liveAsk: ask.askTotal }), facts({ option: { ...option, state: 'exercised' }, liveAsk: ask.askTotal }), facts({ option: { ...option, expiry: NOW - 1 }, liveAsk: ask.askTotal })]) {
      const r = preTrade(action, f)
      expect(r.issues[0]).toMatchObject({ level: 'block', code: 'gone', what: 'listing' })
    }
  })

  it('blocks self trades: your own listing, and an option you wrote', () => {
    expect(preTrade(action, facts({ me: 'GSELLER', option, liveAsk: ask.askTotal })).issues[0]).toMatchObject({ code: 'self-trade', what: 'own-listing', message: 'This is your listing.' })
    expect(preTrade(action, facts({ me: MAKER, option, liveAsk: ask.askTotal })).issues[0]).toMatchObject({ code: 'self-trade', what: 'own-written' })
  })

  it('blocks when the price is not affordable, naming what the seller asks', () => {
    const r = preTrade(action, facts({ option, liveAsk: ask.askTotal, balances: bals(U, 100n * U) }))
    expect(r.issues[0].message).toBe('You have 1.00 USDx; the seller asks 1.80 USDx. Get test funds first.')
  })

  it('is pending until both the option and its ask were read', () => {
    expect(preTrade(action, facts({ option })).state?.text).toBe('Checking')
    expect(preTrade(action, facts({ option, liveAsk: 'unknown' })).state?.status).toBe('unknown')
  })
})

describe('preTrade: fill a request', () => {
  const bid: Bid = { id: 0n, buyer: 'GBUYER', kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * U, totalStrike: 50n * U, totalPremium: 2n * U, expiry: NOW + 86400, state: 'open', optionId: null }
  const action = { type: 'fill-bid' as const, bid }

  it('shows what is locked and what is received', () => {
    const r = preTrade(action, facts({ bid }))
    expect(r.issues).toEqual([])
    expect(r.locks).toEqual({ token: USDX, amount: 50n * U })
    expect(r.receives).toEqual({ token: USDX, amount: 2n * U })
    expect(r.state).toEqual({ label: 'Request', status: 'ok', text: 'Open' })
  })

  it('a call request locks the underlying', () => {
    const call = { ...bid, kind: 'call' as const }
    const r = preTrade({ type: 'fill-bid', bid: call }, facts({ bid: call, balances: bals(0n, 3n * U) }))
    expect(r.locks).toEqual({ token: FUND, amount: 5n * U })
    expect(r.issues[0].message).toBe('You have 3.00 FUND; this locks 5.00 FUND. Get test funds or lower the quantity.')
    expect(tokensFor({ type: 'fill-bid', bid: call })).toEqual([FUND])
  })

  it('blocks an own request, a request that is gone and an unauthorized writer', () => {
    expect(preTrade(action, facts({ me: 'GBUYER', bid })).issues[0]).toMatchObject({ code: 'self-trade', what: 'own-request' })
    expect(preTrade(action, facts({ bid: { ...bid, state: 'filled' } })).issues[0]).toMatchObject({ code: 'gone', what: 'request' })
    expect(preTrade(action, facts({ bid: { ...bid, expiry: NOW } })).issues[0]).toMatchObject({ code: 'gone', what: 'request' })
    expect(preTrade(action, facts({ bid, eligible: false })).issues[0].message).toBe('The FUND issuer has not authorized your account. You cannot fill this request yet.')
  })
})

describe('preTrade: write an offer', () => {
  const draft: NewOffer = { kind: 'put', underlying: FUND, underlyingQty: 5n * U, totalStrike: 50n * U, totalPremium: 2n * U, expiry: NOW + 3 * 86400 }
  const action = { type: 'write-offer' as const, offer: draft, quote: USDX }

  it('shows the collateral and the lowest open offer in the same series', () => {
    const cheaper = offer({ id: 9n, totalPremium: (18n * U) / 10n, expiry: draft.expiry })
    const r = preTrade(action, facts({ writerOpenCount: 3, openOffers: [offer({ id: 8n, totalPremium: 2n * U, expiry: draft.expiry }), cheaper] }))
    expect(r.issues).toEqual([])
    expect(r.locks).toEqual({ token: USDX, amount: 50n * U })
    expect(r.lowestInSeries?.id).toBe(9n)
  })

  it('blocks at the per-writer cap with the exact count', () => {
    const r = preTrade(action, facts({ writerOpenCount: 50 }))
    expect(r.issues[0]).toMatchObject({ level: 'block', code: 'open-cap', who: 'writer', open: 50, max: 50 })
    expect(r.issues[0].message).toBe('You have 50 of 50 open offers. Cancel one or wait for one to sell or expire.')
    expect(preTrade(action, facts({ writerOpenCount: 49 })).blocked).toBe(false)
    expect(preTrade(action, facts({ writerOpenCount: null })).blocked).toBe(false) // a contract without the cap
  })

  it('blocks when the collateral is not there (the old form only coloured the line)', () => {
    const r = preTrade(action, facts({ writerOpenCount: 0, balances: bals(20n * U, 0n) }))
    expect(r.blocked).toBe(true)
    expect(r.issues[0].message).toBe('You have 20.00 USDx; this locks 50.00 USDx. Get test funds or lower the quantity.')
  })

  it('blocks an unauthorized writer and a token in shortfall', () => {
    expect(preTrade(action, facts({ writerOpenCount: 0, eligible: false })).issues[0].message).toBe('The FUND issuer has not authorized your account. The contract would refuse this offer.')
    expect(codes(preTrade(action, facts({ writerOpenCount: 0, health: short })).issues)).toEqual(['block:clawback-shortfall'])
  })
})

describe('preTrade: post a request', () => {
  const bid: NewOffer = { kind: 'put', underlying: FUND, underlyingQty: 5n * U, totalStrike: 50n * U, totalPremium: 2n * U, expiry: NOW + 3 * 86400 }
  const action = { type: 'post-bid' as const, bid, quote: USDX }

  it('escrows the premium', () => {
    const r = preTrade(action, facts({ buyerOpenCount: 0 }))
    expect(r.issues).toEqual([])
    expect(r.locks).toEqual({ token: USDX, amount: 2n * U })
  })

  it('blocks at 50 open requests (the old form only warned) and on a short balance', () => {
    expect(preTrade(action, facts({ buyerOpenCount: 50 })).issues[0]).toMatchObject({ level: 'block', code: 'open-cap', who: 'buyer', open: 50 })
    expect(preTrade(action, facts({ buyerOpenCount: 0, balances: bals(U, 0n) })).issues[0].message).toBe('You have 1.00 USDx; this request escrows 2.00 USDx. Get test funds or lower the premium.')
  })

  it('only warns when the buyer is not authorized: the request can be posted, the option could not be exercised', () => {
    const r = preTrade(action, facts({ buyerOpenCount: 0, eligible: false }))
    expect(r.blocked).toBe(false)
    expect(codes(r.issues)).toEqual(['warn:not-authorized'])
  })
})

describe('preTrade: exercise', () => {
  const held = offer({ id: 3n, state: 'active', holder: ME })
  const action = { type: 'exercise' as const, option: held }

  it('a put delivers the underlying and receives the strike; a call pays the strike and receives the underlying', () => {
    const put = preTrade(action, facts({ option: held }))
    expect(put.issues).toEqual([])
    expect(put.pays).toEqual({ token: FUND, amount: 5n * U })
    expect(put.receives).toEqual({ token: USDX, amount: 50n * U })
    const call = { ...held, kind: 'call' as const }
    const r = preTrade({ type: 'exercise', option: call }, facts({ option: call }))
    expect(r.pays).toEqual({ token: USDX, amount: 50n * U })
    expect(r.receives).toEqual({ token: FUND, amount: 5n * U })
  })

  it('blocks with the exact gap when the holder cannot deliver', () => {
    const r = preTrade(action, facts({ option: held, balances: bals(0n, 2n * U) }))
    expect(r.issues[0]).toMatchObject({ level: 'block', code: 'insufficient-funds', purpose: 'exercise', short: { amount: 3n * U } })
    expect(r.issues[0].message).toBe('You have 2.00 FUND; exercising takes 5.00 FUND. Acquire 3.00 FUND before the deadline.')
  })

  it('blocks after the deadline, when it is no longer active, and for anyone but the holder', () => {
    expect(preTrade(action, facts({ option: { ...held, expiry: NOW - 1 } })).issues[0].message).toBe('The deadline has passed. This option can no longer be exercised.')
    expect(preTrade(action, facts({ option: { ...held, state: 'exercised' } })).issues[0]).toMatchObject({ code: 'gone', what: 'option' })
    expect(preTrade(action, facts({ me: 'GOTHER', option: held })).issues[0]).toMatchObject({ level: 'block', code: 'not-holder' })
    expect(preTrade(action, { me: null, nowSec: NOW, option: held }).issues[0]).toMatchObject({ code: 'not-connected' })
  })

  it('a shortfall only warns: payouts continue while the balance lasts', () => {
    const r = preTrade(action, facts({ option: held, health: short }))
    expect(r.blocked).toBe(false)
    expect(codes(r.issues)).toEqual(['warn:clawback-shortfall'])
  })

  it('warns, naming the price and its source, when exercising is out of the money', () => {
    // Demo price of FUND is 10.20; a put struck at 10.00 is out of the money.
    const r = preTrade(action, facts({ option: held, reference: demoReference('FUND') }))
    const issue = r.issues.find((i) => i.code === 'out-of-the-money')
    expect(issue?.level).toBe('warn')
    expect(issue?.message).toBe('At the demo price of 10.20 USDx per FUND, this put is out of the money: you would deliver 5.00 FUND, worth about 51.00 USDx, for 50.00 USDx.')
    expect(r.blocked).toBe(false)
    // In the money: no such warning. A bare number is the user's own assumed price.
    expect(codes(preTrade(action, facts({ option: held, reference: 9n * U })).issues)).toEqual([])
    const assumed = preTrade(action, facts({ option: held, reference: 11n * U })).issues[0]
    expect(assumed.message).toMatch(/^At the assumed price of 11\.00 USDx per FUND/)
    // No price: nothing is guessed.
    expect(preTrade(action, facts({ option: held, reference: null })).issues).toEqual([])
  })
})

describe('preTrade: list for sale', () => {
  const held = offer({ id: 3n, state: 'active', holder: ME })
  it('needs a live option held by the wallet and a price above zero', () => {
    expect(preTrade({ type: 'list-for-sale', option: held, askTotal: 2n * U }, facts({ option: held })).issues).toEqual([])
    expect(preTrade({ type: 'list-for-sale', option: held, askTotal: null }, facts({ option: held })).issues[0]).toMatchObject({ code: 'invalid-price' })
    expect(preTrade({ type: 'list-for-sale', option: held, askTotal: 0n }, facts({ option: held })).blocked).toBe(true)
    expect(preTrade({ type: 'list-for-sale', option: held, askTotal: U }, facts({ option: { ...held, holder: 'GX' } })).issues[0]).toMatchObject({ code: 'not-holder' })
    expect(preTrade({ type: 'list-for-sale', option: held, askTotal: U }, facts({ option: { ...held, expiry: NOW } })).issues[0]).toMatchObject({ code: 'gone' })
  })
})

describe('readPreTradeFacts against the mock client', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })
  const settle = async <T,>(p: Promise<T>) => {
    await vi.advanceTimersByTimeAsync(2000)
    return p
  }

  it('gathers every fact a buy needs, and the result passes', async () => {
    const c = new MockOptionsClient(bareSeed())
    const fund = (await c.supportedAssets()).underlyings[0]
    const expiry = Math.floor(Date.now() / 1000) + 3600
    const { id } = await settle(c.createOffer({ kind: 'put', underlying: fund, underlyingQty: 2n * U, totalStrike: 20n * U, totalPremium: U, expiry }, 'GWRITER'))
    const o = await c.getOption(id)
    const f = await settle(readPreTradeFacts(c, { type: 'buy', offer: o }, 'GBUYER'))
    expect(f.option).toMatchObject({ id, state: 'offered' })
    expect(f.eligible).toBe(true)
    expect(Object.keys(f.balances ?? {}).sort()).toEqual([fund.contractId, o.quote.contractId].sort())
    expect(f.health?.length).toBeGreaterThan(0)
    const r = preTrade({ type: 'buy', offer: o }, f)
    expect(r.blocked).toBe(false)
    expect(r.pending).toBe(false)
    expect(r.state?.text).toBe('Open')
  })

  it('turns a failed read into unknown instead of throwing', async () => {
    const c = new MockOptionsClient(bareSeed())
    const ghost = offer({ id: 99n })
    const f = await settle(readPreTradeFacts(c, { type: 'buy', offer: ghost }, 'GBUYER'))
    expect(f.option).toBe('unknown')
    expect(preTrade({ type: 'buy', offer: ghost }, f).blocked).toBe(false)
  })

  it('reads the caps for a writer and a buyer, and skips account reads for a guest', async () => {
    const c = new MockOptionsClient(bareSeed())
    const fund = (await c.supportedAssets()).underlyings[0]
    const draft: NewOffer = { kind: 'put', underlying: fund, underlyingQty: 2n * U, totalStrike: 20n * U, totalPremium: U, expiry: Math.floor(Date.now() / 1000) + 3600 }
    const quote = (await c.supportedAssets()).quote
    const w = await settle(readPreTradeFacts(c, { type: 'write-offer', offer: draft, quote }, 'GWRITER'))
    expect(w.writerOpenCount).toBe(0)
    expect(w.openOffers).toEqual([])
    const b = await settle(readPreTradeFacts(c, { type: 'post-bid', bid: draft, quote }, 'GBUYER'))
    expect(b.buyerOpenCount).toBe(0)
    const guest = await settle(readPreTradeFacts(c, { type: 'post-bid', bid: draft, quote }, null))
    expect(guest.eligible).toBeUndefined()
    expect(guest.balances).toBeUndefined()
  })
})
