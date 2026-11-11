import { describe, expect, it } from 'vitest'
import { errorDetail, isChunkLoadError } from './routeErrors'

describe('isChunkLoadError', () => {
  it('recognises a failed fetch of a lazy page in each browser', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/markets-abc.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/assets/markets-abc.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/markets-abc.css'))).toBe(true)
  })

  it('does not mistake a rendering bug for it', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'decimals')"))).toBe(false)
    expect(isChunkLoadError(new Error('Failed to fetch'))).toBe(false)
    expect(isChunkLoadError('boom')).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('errorDetail', () => {
  it('is the message, without a stack', () => {
    const error = new Error('No such option.')
    expect(errorDetail(error)).toBe('No such option.')
    expect(errorDetail(error)).not.toContain('at ')
  })

  it('falls back to the name, and takes anything thrown', () => {
    expect(errorDetail(new RangeError(''))).toBe('RangeError')
    expect(errorDetail('plain')).toBe('plain')
    expect(errorDetail(404)).toBe('404')
  })

  it('caps a very long message', () => {
    expect(errorDetail(new Error('x'.repeat(5000))).length).toBeLessThanOrEqual(601)
  })
})
