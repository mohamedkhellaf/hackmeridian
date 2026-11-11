import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PRO_ERROR_CODES, PRO_ERRORS, parseProErrorCode, proErrorMessage, proErrorName } from './errors'
import { parseFixtures } from './FixtureProClient'

describe('Pro error map', () => {
  it('covers exactly 201..226 and matches the fixture error table', () => {
    const fx = parseFixtures().errors
    expect(PRO_ERROR_CODES).toEqual(Array.from({ length: 26 }, (_, i) => 201 + i))
    for (const [name, code] of Object.entries(fx)) expect(PRO_ERRORS[code]?.name).toBe(name)
    expect(Object.keys(fx)).toHaveLength(26)
  })

  it('gives every code a plain sentence', () => {
    for (const c of PRO_ERROR_CODES) {
      const m = proErrorMessage(c)
      expect(m.length).toBeGreaterThan(20)
      expect(m.endsWith('.')).toBe(true)
    }
  })

  it('maps the early-exercise refusals to their reasons', () => {
    expect(proErrorMessage(226)).toBe('This position is owned by the vault and settles at expiry.')
    expect(proErrorMessage(207)).toMatch(/too old/)
    expect(proErrorMessage(223)).toMatch(/Out of the money/)
    expect(proErrorMessage(225)).toMatch(/settlement price/)
    expect(proErrorMessage(224)).toMatch(/taken over first/)
    expect(proErrorMessage(222)).toMatch(/quantity times the latest mark/)
    expect(proErrorMessage(209)).toMatch(/initial margin/)
    expect(proErrorMessage(215)).toMatch(/cannot be withdrawn/)
  })

  it('handles unknown codes and Soroban error text', () => {
    expect(proErrorMessage(999)).toContain('999')
    expect(proErrorName(999)).toBe('Error999')
    expect(parseProErrorCode('HostError: Error(Contract, #226)')).toBe(226)
    expect(parseProErrorCode('Error(Contract, #7)')).toBeNull()
    expect(parseProErrorCode('nothing here')).toBeNull()
  })
})

describe('Pro copy rules', () => {
  const banned = /guaranteed|insured|\bsafe\b|fully backed|fully collateralized/i
  it('never uses the banned words in user-facing Pro sources', () => {
    const dir = new URL('./', import.meta.url)
    for (const f of readdirSync(dir)) {
      if (!/\.(ts|tsx|css)$/.test(f) || f.endsWith('.test.ts')) continue
      expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(banned)
    }
  })
})
