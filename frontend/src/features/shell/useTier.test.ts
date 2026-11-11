import { describe, expect, it } from 'vitest'
import { DESKTOP_QUERY, PHONE_QUERY, tierOf } from './useTier'

describe('tierOf', () => {
  it('is phone below 768 px, whatever the other query says', () => {
    expect(tierOf(true, false)).toBe('phone')
    expect(tierOf(true, true)).toBe('phone')
  })

  it('is tablet from 768 to 1199 px', () => {
    expect(tierOf(false, false)).toBe('tablet')
  })

  it('is desktop from 1200 px', () => {
    expect(tierOf(false, true)).toBe('desktop')
  })

  it('uses the two breakpoints of the design system', () => {
    expect(PHONE_QUERY).toBe('(max-width: 767.98px)')
    expect(DESKTOP_QUERY).toBe('(min-width: 1200px)')
  })
})
