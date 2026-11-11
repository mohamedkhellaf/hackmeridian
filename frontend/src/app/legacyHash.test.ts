import { describe, expect, it } from 'vitest'
import { legacyHashTarget } from './legacyHash'

describe('legacyHashTarget', () => {
  it('maps the old top-level routes', () => {
    expect(legacyHashTarget('#/markets', true)).toBe('/markets')
    expect(legacyHashTarget('#/portfolio', true)).toBe('/portfolio')
    expect(legacyHashTarget('#/reserves', true)).toBe('/reserves')
    expect(legacyHashTarget('#/issuer', true)).toBe('/issuer')
  })

  it('maps the old Margin screens', () => {
    expect(legacyHashTarget('#/pro', true)).toBe('/margin')
    expect(legacyHashTarget('#/pro/', true)).toBe('/margin')
    expect(legacyHashTarget('#/pro/margin', true)).toBe('/margin')
    expect(legacyHashTarget('#/pro/trade', true)).toBe('/margin/trade')
    expect(legacyHashTarget('#/pro/positions', true)).toBe('/margin/positions')
    expect(legacyHashTarget('#/pro/liquidations', true)).toBe('/margin/liquidations')
    expect(legacyHashTarget('#/pro/vault', true)).toBe('/margin/vault')
    expect(legacyHashTarget('#/pro/unknown', true)).toBe('/margin')
  })

  it('sends Margin links to Markets in a build without Margin', () => {
    expect(legacyHashTarget('#/pro/trade', false)).toBe('/markets')
    expect(legacyHashTarget('#/pro', false)).toBe('/markets')
  })

  it('sends retired and unknown old routes to Markets, as the old app did', () => {
    expect(legacyHashTarget('#/write', true)).toBe('/markets')
    expect(legacyHashTarget('#/protect', true)).toBe('/markets')
    expect(legacyHashTarget('#/', true)).toBe('/markets')
    expect(legacyHashTarget('#/anything', true)).toBe('/markets')
  })

  it('ignores what follows the route name', () => {
    expect(legacyHashTarget('#/portfolio?x=1', true)).toBe('/portfolio')
    expect(legacyHashTarget('#/reserves/extra', true)).toBe('/reserves')
  })

  it('leaves in-page anchors and an empty hash alone', () => {
    expect(legacyHashTarget('', true)).toBeNull()
    expect(legacyHashTarget('#', true)).toBeNull()
    expect(legacyHashTarget('#limits', true)).toBeNull()
    expect(legacyHashTarget('#markets', true)).toBeNull()
  })

  it('only ever returns a path of the app', () => {
    for (const hash of ['#/https://evil.example', '#//evil.example', '#/pro/https://evil.example', '#/../x']) {
      expect(legacyHashTarget(hash, true)).toMatch(/^\/(markets|margin)$/)
    }
  })
})
