import { describe, expect, it } from 'vitest'
import { curveFamily } from './curveFamily'

describe('curveFamily', () => {
  const family = curveFamily({ width: 520, height: 280, count: 13 })

  it('draws the payoff last, so it sits on top, with its kink exact', () => {
    expect(family).toHaveLength(14)
    const payoff = family.at(-1)!
    expect(payoff.payoff).toBe(true)
    expect(payoff.d).toBe('M0 2L239.2 278H520')
    expect(family.filter((c) => c.payoff)).toHaveLength(1)
  })

  it('fades the curves that are further from the payoff', () => {
    const opacities = family.filter((c) => !c.payoff).map((c) => c.opacity)
    expect(opacities).toEqual([...opacities].sort((a, b) => a - b))
    expect(opacities[0]).toBeCloseTo(0.16, 3)
    expect(Math.max(...opacities)).toBeLessThan(1)
  })

  it('keeps every curve above the payoff and inside the plate on the right', () => {
    for (const curve of family.filter((c) => !c.payoff)) {
      const last = curve.d.split('L').at(-1)!.split(' ').map(Number)
      expect(last[0]).toBe(520)
      expect(last[1]).toBeLessThan(278)
      expect(last[1]).toBeGreaterThan(0)
    }
  })
})
