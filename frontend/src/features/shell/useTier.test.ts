import { describe, expect, it } from 'vitest'
import { DESKTOP_QUERY, PHONE_QUERY, WIDE_QUERY, tierOf } from './useTier'

describe('tierOf', () => {
  it('is phone below 768 px, whatever the other query says', () => {
    expect(tierOf(true, false)).toBe('phone')
    expect(tierOf(true, true)).toBe('phone')
  })

  it('is tablet from 768 to 899 px', () => {
    expect(tierOf(false, false)).toBe('tablet')
  })

  it('is desktop from 900 px', () => {
    expect(tierOf(false, true)).toBe('desktop')
  })

  it('uses the phone breakpoint of the design system, the bar breakpoint and the wide one', () => {
    expect(PHONE_QUERY).toBe('(max-width: 767.98px)')
    expect(DESKTOP_QUERY).toBe('(min-width: 900px)')
    expect(WIDE_QUERY).toBe('(min-width: 1200px)')
  })
})
