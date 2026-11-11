import { describe, expect, it } from 'vitest'
import { LANDING_TITLE, assetTitle, documentTitle, linkScrollKey, positionTitle, scrollKeyOf, titleOfMatches } from './navigation'

type Loc = Parameters<typeof scrollKeyOf>[0]
const at = (pathname: string, key: string, search = ''): Loc => ({ pathname, href: pathname + search, state: { __TSR_key: key } }) as unknown as Loc

describe('document titles', () => {
  it('puts the page before the site name', () => {
    expect(documentTitle('Markets')).toBe('Markets · StellSec')
  })

  it('gives the landing page the site title', () => {
    expect(documentTitle('')).toBe(LANDING_TITLE)
    expect(documentTitle(undefined)).toBe(LANDING_TITLE)
  })

  it('reads the leaf route, with its params', () => {
    expect(titleOfMatches([{ staticData: {} }, { staticData: { title: 'Reserves' } }])).toBe('Reserves · StellSec')
    expect(titleOfMatches([{ staticData: {} }, { staticData: { title: (p) => `Position ${p.id}` }, params: { id: '12' } }])).toBe('Position 12 · StellSec')
  })

  it('says so when no route matched', () => {
    expect(titleOfMatches([{ staticData: {}, _notFound: true }])).toBe('Page not found · StellSec')
    expect(titleOfMatches([{ staticData: {} }, { staticData: { title: 'Markets' }, status: 'notFound' }])).toBe('Page not found · StellSec')
  })
})

describe('titles from route params', () => {
  it('names an asset by its slug or its code', () => {
    expect(assetTitle({ asset: 'bond' })).toBe('BOND · Markets')
    expect(assetTitle({ asset: 'EQTY-GCNWQR5OA24X7LPTCXUEL4V4ZLSIFKUNIEZEO3UVCVXECPPGX7ERFDGM' })).toBe('EQTY · Markets')
  })

  it('never spells out a contract id or an arbitrary segment', () => {
    expect(assetTitle({ asset: 'CADCBCQ7TU5XCGPYDD32HANAVEWWDARGKIKXWF5YK7NTFOLAWGQYQGHP' })).toBe('Asset · Markets')
    expect(assetTitle({ asset: 'C_MOCK_BOND_WITH_A_LONG_NAME' })).toBe('Asset · Markets')
    expect(assetTitle({ asset: '<script>alert(1)</script>' })).toBe('Asset · Markets')
    expect(assetTitle({ asset: 'x'.repeat(60) })).toBe('Asset · Markets')
    expect(assetTitle({})).toBe('Asset · Markets')
  })

  it('names a position by its id, when it is one', () => {
    expect(positionTitle({ id: '12' })).toBe('Position 12 · Portfolio')
    expect(positionTitle({ id: 'abc' })).toBe('Position · Portfolio')
    expect(positionTitle({ id: '1'.repeat(30) })).toBe('Position · Portfolio')
    expect(positionTitle({})).toBe('Position · Portfolio')
  })
})

describe('scroll keys', () => {
  it('a history entry is its own key until it is linked', () => {
    expect(scrollKeyOf(at('/learn', 'k-unlinked'))).toBe('k-unlinked')
  })

  it('a new page gets a key of its own, so it starts at the top', () => {
    const from = at('/markets', 'k1')
    const to = at('/portfolio', 'k2')
    linkScrollKey(undefined, from)
    linkScrollKey(from, to)
    expect(scrollKeyOf(to)).toBe('k2')
    expect(scrollKeyOf(from)).toBe('k1')
  })

  it('a change of search params on the same page shares the key, so the page does not move', () => {
    const page = at('/markets/bond', 'k10')
    const withStrike = at('/markets/bond', 'k11', '?strike=10.00')
    const withTicket = at('/markets/bond', 'k12', '?strike=10.00&side=buy')
    linkScrollKey(undefined, page)
    linkScrollKey(page, withStrike)
    linkScrollKey(withStrike, withTicket)
    expect(scrollKeyOf(withStrike)).toBe('k10')
    expect(scrollKeyOf(withTicket)).toBe('k10')
  })

  it('going back to an entry keeps the key it had', () => {
    const a = at('/markets', 'k20')
    const b = at('/portfolio', 'k21')
    linkScrollKey(undefined, a)
    linkScrollKey(a, b)
    // Back from /portfolio to the same /markets entry: already linked, nothing changes.
    linkScrollKey(b, a)
    expect(scrollKeyOf(a)).toBe('k20')
  })

  it('a second visit to a path through a link is a new page', () => {
    const first = at('/markets', 'k30')
    const other = at('/reserves', 'k31')
    const second = at('/markets', 'k32')
    linkScrollKey(undefined, first)
    linkScrollKey(first, other)
    linkScrollKey(other, second)
    expect(scrollKeyOf(second)).toBe('k32')
  })
})
