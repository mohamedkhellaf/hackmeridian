import { describe, expect, it } from 'vitest'
import { ME, MAKER, NOW, U, bid, opt } from '../fixtures.testhelper'
import { cancelBidCheck, simpleCheck } from './checks'

const written = (over = {}) => opt({ writer: ME, holder: MAKER, ...over })

describe('simpleCheck', () => {
  it('says "Checking" while the option is being re-read, and does not block', () => {
    const c = simpleCheck('claim', written({ kind: 'call', state: 'exercised' }), { me: ME, nowSec: NOW, option: undefined })
    expect(c.pending).toBe(true)
    expect(c.blocked).toBe(false)
    expect(c.lines[0]).toMatchObject({ label: 'Option', status: 'pending', text: 'Checking' })
  })

  it('never blocks on a read that failed: the contract is the final check', () => {
    const c = simpleCheck('reclaim', written({ state: 'expired' }), { me: ME, nowSec: NOW, option: 'unknown' })
    expect(c.blocked).toBe(false)
    expect(c.lines[0].status).toBe('unknown')
  })

  it('lets a writer claim an exercised call and says what is in the contract', () => {
    const o = written({ kind: 'call', state: 'exercised' })
    const c = simpleCheck('claim', o, { me: ME, nowSec: NOW, option: o })
    expect(c).toMatchObject({ blocked: false, pending: false, problem: null })
    expect(c.lines).toEqual([{ label: 'Option', status: 'ok', text: 'Exercised. 50.00 USDx in the contract' }])
  })

  it('checks the issuer authorization before a put writer claims the underlying', () => {
    const o = written({ state: 'exercised' })
    const ok = simpleCheck('claim', o, { me: ME, nowSec: NOW, option: o, eligible: true })
    expect(ok.blocked).toBe(false)
    expect(ok.lines[1]).toEqual({ label: 'Your account', status: 'ok', text: 'Authorized by the FUND issuer' })
    const no = simpleCheck('claim', o, { me: ME, nowSec: NOW, option: o, eligible: false })
    expect(no.blocked).toBe(true)
    expect(no.problem).toContain('The FUND issuer has not authorized your account')
    expect(simpleCheck('claim', o, { me: ME, nowSec: NOW, option: o, eligible: 'unknown' }).blocked).toBe(false)
    expect(simpleCheck('claim', o, { me: ME, nowSec: NOW, option: o, eligible: undefined }).pending).toBe(true)
  })

  it('refuses a claim that was already made', () => {
    const c = simpleCheck('claim', written({ state: 'exercised' }), { me: ME, nowSec: NOW, option: written({ state: 'settled' }), eligible: true })
    expect(c.blocked).toBe(true)
    expect(c.lines[0]).toMatchObject({ status: 'fail', text: 'Already claimed' })
    expect(c.problem).toBe('This delivery was already claimed. Nothing is left in the contract for this option.')
  })

  it('lets a writer reclaim an expired option, once', () => {
    const o = written({ state: 'expired', expiry: NOW - 60 })
    expect(simpleCheck('reclaim', o, { me: ME, nowSec: NOW, option: o }).lines[0].text).toBe('Expired. 50.00 USDx in the contract')
    const again = simpleCheck('reclaim', o, { me: ME, nowSec: NOW, option: { ...o, state: 'reclaimed' } })
    expect(again.blocked).toBe(true)
    expect(again.problem).toContain('already reclaimed')
  })

  it('waits for the ledger when the page clock is ahead of it', () => {
    const o = written({ state: 'expired', expiry: NOW - 1 })
    const c = simpleCheck('reclaim', o, { me: ME, nowSec: NOW, option: { ...o, state: 'active' } })
    expect(c.blocked).toBe(true)
    expect(c.problem).toBe('The ledger has not passed the deadline yet. Wait for the next ledger, then reclaim.')
  })

  it('lets a writer cancel an open offer and explains the race it can lose', () => {
    const o = opt({ writer: ME, holder: null, state: 'offered' })
    expect(simpleCheck('cancel', o, { me: ME, nowSec: NOW, option: o }).lines[0]).toMatchObject({ status: 'ok', text: 'Open, no buyer' })
    const sold = simpleCheck('cancel', o, { me: ME, nowSec: NOW, option: { ...o, holder: MAKER, state: 'active' } })
    expect(sold.blocked).toBe(true)
    expect(sold.problem).toBe('A buyer took this offer before the cancellation. It is now a sold option under Written.')
    const expired = simpleCheck('cancel', o, { me: ME, nowSec: NOW, option: { ...o, state: 'expired' } })
    expect(expired.problem).toBe('This offer has expired. Reclaim the collateral instead.')
  })

  it('withdraws a listing only while the option is listed and still held', () => {
    const o = opt()
    const ok = simpleCheck('unlist', o, { me: ME, nowSec: NOW, option: o, ask: 2n * U })
    expect(ok.blocked).toBe(false)
    expect(ok.lines).toEqual([
      { label: 'Option', status: 'ok', text: 'Active, held by you' },
      { label: 'Listing', status: 'ok', text: 'For sale at 2.00 USDx' },
    ])
    const gone = simpleCheck('unlist', o, { me: ME, nowSec: NOW, option: o, ask: null })
    expect(gone.blocked).toBe(true)
    expect(gone.lines[1]).toMatchObject({ status: 'fail', text: 'No longer listed' })
    const sold = simpleCheck('unlist', o, { me: ME, nowSec: NOW, option: { ...o, holder: MAKER }, ask: null })
    expect(sold.blocked).toBe(true)
    expect(sold.problem).toContain('no longer listed by you')
  })

  it('checks nothing for a guest beyond showing the lines', () => {
    const o = written({ kind: 'call', state: 'exercised' })
    expect(simpleCheck('claim', o, { me: null, nowSec: NOW, option: undefined }).pending).toBe(false)
  })
})

describe('cancelBidCheck', () => {
  it('lets the buyer take an open or an expired request back, with the escrowed figure', () => {
    expect(cancelBidCheck({ me: ME, bid: bid() }).lines[0]).toEqual({ label: 'Request', status: 'ok', text: 'Open. 2.00 USDx escrowed' })
    expect(cancelBidCheck({ me: ME, bid: bid({ state: 'expired' }) }).lines[0].text).toBe('Expired. 2.00 USDx escrowed')
  })

  it('refuses when a maker filled it first, and says where the option is', () => {
    const c = cancelBidCheck({ me: ME, bid: bid({ state: 'filled', optionId: 9n }) })
    expect(c.blocked).toBe(true)
    expect(c.problem).toContain('it is under Holding')
  })

  it('refuses a request that was already refunded, and never blocks on a failed read', () => {
    expect(cancelBidCheck({ me: ME, bid: bid({ state: 'cancelled' }) }).blocked).toBe(true)
    expect(cancelBidCheck({ me: ME, bid: 'unknown' }).blocked).toBe(false)
    expect(cancelBidCheck({ me: ME, bid: undefined })).toMatchObject({ pending: true, blocked: false })
  })
})
