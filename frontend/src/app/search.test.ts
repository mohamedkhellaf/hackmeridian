import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import {
  AssetSearchSchema,
  MarketsSearchSchema,
  PortfolioSearchSchema,
  PositionSearchSchema,
  RequestsSearchSchema,
  isAssetParam,
  isDayParam,
  isDecimalParam,
  isIdParam,
  parseSearch,
  stringifySearch,
  validateAssetSearch,
  validateMarketsSearch,
  validatePortfolioSearch,
  validatePositionSearch,
  validateRequestsSearch,
} from './search'
import type { AssetSearch, MarketsSearch, PortfolioSearch, PositionSearch, RequestsSearch } from './search'

// The types are the contract with the features; the schemas are what the router runs. These objects fail to
// compile when a type gains or loses a field, and the tests below fail when a schema does.
const ASSET_FIELDS: Record<keyof AssetSearch, true> = {
  mode: true,
  tab: true,
  intent: true,
  expiry: true,
  kind: true,
  strike: true,
  qty: true,
  premium: true,
  side: true,
  offer: true,
  bid: true,
  ask: true,
  step: true,
}
const MARKETS_FIELDS: Record<keyof MarketsSearch, true> = { all: true, intent: true }
const PORTFOLIO_FIELDS: Record<keyof PortfolioSearch, true> = { tab: true, closed: true }
const POSITION_FIELDS: Record<keyof PositionSearch, true> = { do: true }
const REQUESTS_FIELDS: Record<keyof RequestsSearch, true> = { asset: true, kind: true, sort: true, bid: true, new: true, mine: true }

// Each schema's output is assignable to its type and back.
const assetOut: AssetSearch = {} as v.InferOutput<typeof AssetSearchSchema>
const assetIn: v.InferOutput<typeof AssetSearchSchema> = {} as AssetSearch
const marketsOut: MarketsSearch = {} as v.InferOutput<typeof MarketsSearchSchema>
const portfolioOut: PortfolioSearch = {} as v.InferOutput<typeof PortfolioSearchSchema>
const positionOut: PositionSearch = {} as v.InferOutput<typeof PositionSearchSchema>
const requestsOut: RequestsSearch = {} as v.InferOutput<typeof RequestsSearchSchema>
void [assetOut, assetIn, marketsOut, portfolioOut, positionOut, requestsOut]

const fieldsOf = (schema: { entries: Record<string, unknown> }) => Object.keys(schema.entries).sort()

describe('search schemas', () => {
  it('have exactly the fields of their types', () => {
    expect(fieldsOf(AssetSearchSchema)).toEqual(Object.keys(ASSET_FIELDS).sort())
    expect(fieldsOf(MarketsSearchSchema)).toEqual(Object.keys(MARKETS_FIELDS).sort())
    expect(fieldsOf(PortfolioSearchSchema)).toEqual(Object.keys(PORTFOLIO_FIELDS).sort())
    expect(fieldsOf(PositionSearchSchema)).toEqual(Object.keys(POSITION_FIELDS).sort())
    expect(fieldsOf(RequestsSearchSchema)).toEqual(Object.keys(REQUESTS_FIELDS).sort())
  })
})

describe('validateAssetSearch', () => {
  it('keeps a full, valid link as it is', () => {
    const link = {
      mode: 'chain',
      tab: 'trade',
      intent: 'earn-hold',
      expiry: '2026-11-27',
      kind: 'put',
      strike: '10.00',
      qty: '5',
      premium: '1.80',
      side: 'buy',
      offer: '12',
      bid: '3',
      ask: '184',
      step: 'review',
    }
    expect(validateAssetSearch(link)).toEqual(link)
  })

  it('returns nothing for an empty link', () => {
    expect(validateAssetSearch({})).toEqual({})
    expect(Object.keys(validateAssetSearch({}))).toEqual([])
  })

  it('drops an invalid value and keeps the rest', () => {
    const out = validateAssetSearch({ mode: 'expert', kind: 'put', strike: '10.00', intent: 'protect' })
    expect(out.mode).toBeUndefined()
    expect(out.intent).toBeUndefined()
    expect(out.kind).toBe('put')
    expect(out.strike).toBe('10.00')
  })

  it('names a dropped field as undefined, so the raw value cannot leak through the router merge', () => {
    const raw = { mode: 'expert', strike: 'ten' }
    const merged = { ...raw, ...validateAssetSearch(raw) }
    expect(merged).toEqual({ mode: undefined, strike: undefined })
    expect('mode' in validateAssetSearch(raw)).toBe(true)
  })

  it('drops fields that are not part of the route', () => {
    expect(validateAssetSearch({ kind: 'call', utm_source: 'x', as: 'G' })).toEqual({ kind: 'call' })
  })

  it('never throws, whatever the input', () => {
    const hostile: Record<string, unknown> = { mode: 7, strike: ['1', '2'], offer: { id: 1 }, expiry: null, kind: true, qty: Number.NaN }
    expect(() => validateAssetSearch(hostile)).not.toThrow()
    const out = validateAssetSearch(hostile)
    for (const key of Object.keys(out)) expect(out[key as keyof AssetSearch]).toBeUndefined()
  })

  it('keeps a decimal exactly as typed', () => {
    expect(validateAssetSearch({ strike: '10.00', qty: '0.5000000', premium: '1.80' })).toEqual({ strike: '10.00', qty: '0.5000000', premium: '1.80' })
  })
})

describe('the other routes', () => {
  it('/markets', () => {
    expect(validateMarketsSearch({ all: '1', intent: 'floor' })).toEqual({ all: '1', intent: 'floor' })
    expect(validateMarketsSearch({ all: 'true', intent: 'hedge' })).toEqual({ all: undefined, intent: undefined })
  })

  it('/portfolio', () => {
    expect(validatePortfolioSearch({ tab: 'written', closed: '1' })).toEqual({ tab: 'written', closed: '1' })
    expect(validatePortfolioSearch({ tab: 'all', closed: '0' })).toEqual({ tab: undefined, closed: undefined })
  })

  it('/portfolio/$id', () => {
    for (const action of ['exercise', 'claim', 'reclaim', 'sell', 'cancel']) expect(validatePositionSearch({ do: action })).toEqual({ do: action })
    expect(validatePositionSearch({ do: 'transfer' })).toEqual({ do: undefined })
  })

  it('/requests', () => {
    expect(validateRequestsSearch({ asset: 'bond', kind: 'put', sort: 'deadline', bid: '4', new: '1', mine: '1' })).toEqual({
      asset: 'bond',
      kind: 'put',
      sort: 'deadline',
      bid: '4',
      new: '1',
      mine: '1',
    })
    expect(validateRequestsSearch({ asset: '<script>', bid: '-1', sort: 'price' })).toEqual({ asset: undefined, bid: undefined, sort: undefined })
  })
})

describe('param checks', () => {
  it('decimals: digits, one point, at most 7 decimals', () => {
    for (const ok of ['0', '10', '10.00', '0.36', '1234567890123456789', '0.0000001']) expect(isDecimalParam(ok), ok).toBe(true)
    for (const bad of ['', '.5', '5.', '1e3', '-1', '+1', '1,000', '1.00000001', '0x10', ' 1', '1 ', '12345678901234567890', 'NaN', '١٢']) expect(isDecimalParam(bad), bad).toBe(false)
  })

  it('ids: a u64 in decimal with no leading zero', () => {
    for (const ok of ['0', '1', '184', '18446744073709551615']) expect(isIdParam(ok), ok).toBe(true)
    for (const bad of ['', '01', '-1', '1.0', '18446744073709551616', '99999999999999999999', 'abc', '1n', ' 1']) expect(isIdParam(bad), bad).toBe(false)
  })

  it('days: a real UTC calendar day', () => {
    for (const ok of ['2026-11-27', '2028-02-29']) expect(isDayParam(ok), ok).toBe(true)
    for (const bad of ['2026-02-30', '2026-13-01', '2026-1-1', '27-11-2026', '2026-11-27T08:00', '', 'today']) expect(isDayParam(bad), bad).toBe(false)
  })

  it('assets: a slug, CODE-ISSUER or a contract id, by shape only', () => {
    for (const ok of ['bond', 'BOND-GCNWQR5OA24X7LPTCXUEL4V4ZLSIFKUNIEZEO3UVCVXECPPGX7ERFDGM', 'CADCBCQ7TU5XCGPYDD32HANAVEWWDARGKIKXWF5YK7NTFOLAWGQYQGHP']) expect(isAssetParam(ok), ok).toBe(true)
    for (const bad of ['', 'a b', '../x', '<b>', 'x'.repeat(81)]) expect(isAssetParam(bad), bad).toBe(false)
  })
})

describe('the URL form', () => {
  it('parses plain pairs and keeps every value a string', () => {
    expect(parseSearch('?mode=chain&strike=10.00&offer=12')).toEqual({ mode: 'chain', strike: '10.00', offer: '12' })
    expect(parseSearch('')).toEqual({})
    expect(parseSearch('?')).toEqual({})
  })

  it('does not read JSON, numbers or booleans out of a value', () => {
    expect(parseSearch('?strike=10.00&all=true&offer=%7B%22a%22%3A1%7D')).toEqual({ strike: '10.00', all: 'true', offer: '{"a":1}' })
  })

  it('keeps the last value of a repeated key', () => {
    expect(parseSearch('?kind=put&kind=call')).toEqual({ kind: 'call' })
  })

  it('writes pairs in order and leaves out empty values', () => {
    expect(stringifySearch({ mode: 'chain', strike: '10.00', qty: undefined, premium: null, side: '' })).toBe('?mode=chain&strike=10.00')
    expect(stringifySearch({})).toBe('')
    expect(stringifySearch({ a: undefined })).toBe('')
  })

  it('round-trips a validated link', () => {
    const link: AssetSearch = { mode: 'chain', kind: 'put', strike: '10.00', expiry: '2026-11-27', offer: '12', step: 'review' }
    expect(validateAssetSearch(parseSearch(stringifySearch(link)))).toEqual(link)
  })

  it('escapes what needs escaping', () => {
    expect(stringifySearch({ asset: 'a b&c' })).toBe('?asset=a+b%26c')
    expect(parseSearch('?asset=a+b%26c')).toEqual({ asset: 'a b&c' })
  })
})
