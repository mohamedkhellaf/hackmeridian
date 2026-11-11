import { describe, expect, it } from 'vitest'
import type { AssetSearch } from '../../app/search'
import { intentKey, parseId, searchFromTicketIntent, ticketIntentFromSearch } from './intent'
import type { TicketIntent } from './intent'

const ASSET = 'C_MOCK_BOND'
const FRIDAY = Date.UTC(2026, 10, 13, 8, 0, 0) / 1000

/** A search as the router holds it after a patch: keys set to undefined are gone. */
const applied = (patch: Partial<AssetSearch>): AssetSearch => Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as AssetSearch

describe('ticketIntentFromSearch', () => {
  it('opens nothing without a ticket param', () => {
    expect(ticketIntentFromSearch({}, ASSET)).toBeNull()
    expect(ticketIntentFromSearch({ mode: 'chain', kind: 'put', strike: '10', expiry: '2026-11-13' }, ASSET)).toBeNull()
  })

  it('opens nothing for side=buy alone: the page picks the offer', () => {
    expect(ticketIntentFromSearch({ side: 'buy', kind: 'put', strike: '10' }, ASSET)).toBeNull()
  })

  it('maps an offer, a listing and a request id to their tickets', () => {
    expect(ticketIntentFromSearch({ offer: '12' }, ASSET)).toEqual({ mode: 'buy', offerId: 12n })
    expect(ticketIntentFromSearch({ side: 'buy', ask: '9' }, ASSET)).toEqual({ mode: 'buy-resale', optionId: 9n })
    expect(ticketIntentFromSearch({ bid: '3' }, ASSET)).toEqual({ mode: 'fill', bidId: 3n })
  })

  it('keeps an id beyond the float range exact', () => {
    expect(ticketIntentFromSearch({ offer: '18446744073709551615' }, ASSET)).toEqual({ mode: 'buy', offerId: 18446744073709551615n })
  })

  it('drops ids that are not decimal strings', () => {
    for (const bad of ['', '-1', '1.5', '0x10', '12abc', ' 12', '1'.repeat(21)]) expect(ticketIntentFromSearch({ offer: bad }, ASSET)).toBeNull()
    expect(parseId(undefined)).toBeNull()
  })

  it('maps side=write and side=bid to the forms, with the series terms', () => {
    expect(ticketIntentFromSearch({ side: 'write', kind: 'call', strike: '10.20', expiry: '2026-11-13', qty: '5', premium: '1.8' }, ASSET)).toEqual({
      mode: 'write',
      assetId: ASSET,
      kind: 'call',
      strike: '10.20',
      expiry: FRIDAY,
      qty: '5',
      premium: '1.8',
    })
    expect(ticketIntentFromSearch({ side: 'bid' }, ASSET)).toEqual({ mode: 'bid', assetId: ASSET, kind: 'put' })
  })

  it('leaves out terms that do not parse instead of failing', () => {
    expect(ticketIntentFromSearch({ side: 'write', strike: 'ten', expiry: '2026-02-30', qty: '1e3', premium: '-2' }, ASSET)).toEqual({ mode: 'write', assetId: ASSET, kind: 'put' })
  })

  it('lets a form side win over a stray id', () => {
    expect(ticketIntentFromSearch({ side: 'bid', bid: '3', kind: 'call' }, ASSET)).toEqual({ mode: 'bid', assetId: ASSET, kind: 'call' })
  })
})

describe('searchFromTicketIntent', () => {
  it('clears every ticket key for a closed ticket and leaves the series alone', () => {
    const patch = searchFromTicketIntent(null)
    expect(patch).toEqual({ side: undefined, offer: undefined, bid: undefined, ask: undefined })
    expect(Object.keys(patch).sort()).toEqual(['ask', 'bid', 'offer', 'side'])
    expect('kind' in patch || 'strike' in patch || 'expiry' in patch).toBe(false)
  })

  it('is the inverse of ticketIntentFromSearch for every mode the asset route has', () => {
    const intents: TicketIntent[] = [
      { mode: 'buy', offerId: 12n },
      { mode: 'buy-resale', optionId: 9n },
      { mode: 'fill', bidId: 3n },
      { mode: 'write', assetId: ASSET, kind: 'put' },
      { mode: 'write', assetId: ASSET, kind: 'call', strike: '10.2', expiry: FRIDAY, qty: '5', premium: '1.8' },
      { mode: 'bid', assetId: ASSET, kind: 'put', strike: '99.5', expiry: FRIDAY },
    ]
    for (const intent of intents) expect(ticketIntentFromSearch(applied(searchFromTicketIntent(intent)), ASSET)).toEqual(intent)
  })

  it('replaces the previous ticket: stale ids are cleared by the patch', () => {
    const before: AssetSearch = { mode: 'chain', side: 'buy', offer: '12' }
    const after = applied({ ...before, ...searchFromTicketIntent({ mode: 'fill', bidId: 3n }) })
    expect(after).toEqual({ mode: 'chain', bid: '3' })
  })

  it('writes the expiry as its UTC day, so a custom time of day comes back as 08:00 UTC', () => {
    const custom = Date.UTC(2026, 10, 13, 15, 30, 0) / 1000
    const patch = searchFromTicketIntent({ mode: 'write', assetId: ASSET, kind: 'put', expiry: custom })
    expect(patch.expiry).toBe('2026-11-13')
    expect(ticketIntentFromSearch(applied(patch), ASSET)).toMatchObject({ expiry: FRIDAY })
  })

  it('has no place for a listing on the asset route', () => {
    expect(searchFromTicketIntent({ mode: 'list', optionId: 4n })).toEqual(searchFromTicketIntent(null))
  })
})

describe('intentKey', () => {
  it('does not change with the terms of a form, and changes with its subject or mode', () => {
    const a: TicketIntent = { mode: 'write', assetId: ASSET, kind: 'put', strike: '10' }
    const b: TicketIntent = { mode: 'write', assetId: ASSET, kind: 'call', strike: '11', qty: '2' }
    expect(intentKey(a)).toBe(intentKey(b))
    expect(intentKey({ mode: 'bid', assetId: ASSET, kind: 'put' })).not.toBe(intentKey(a))
    expect(intentKey({ mode: 'buy', offerId: 1n })).not.toBe(intentKey({ mode: 'buy', offerId: 2n }))
    expect(intentKey({ mode: 'buy', offerId: 1n })).not.toBe(intentKey({ mode: 'buy-resale', optionId: 1n }))
    expect(intentKey({ mode: 'list', optionId: 1n })).not.toBe(intentKey({ mode: 'fill', bidId: 1n }))
  })
})
