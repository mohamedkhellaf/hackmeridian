import { describe, expect, it } from 'vitest'
import { SCENES, stepScene } from './scenes'

describe('stepScene', () => {
  it('moves forward and back', () => {
    expect(stepScene(0, 1)).toBe(1)
    expect(stepScene(3, -1)).toBe(2)
  })
  it('clamps at both ends', () => {
    expect(stepScene(0, -1)).toBe(0)
    expect(stepScene(SCENES.length - 1, 1)).toBe(SCENES.length - 1)
  })
  it('handles an empty list', () => {
    expect(stepScene(0, 1, 0)).toBe(0)
  })
})

describe('SCENES', () => {
  it('has unique ids and strictly increasing start times within 3 minutes', () => {
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length)
    for (let i = 1; i < SCENES.length; i++) expect(SCENES[i].start).toBeGreaterThan(SCENES[i - 1].start)
    expect(SCENES[SCENES.length - 1].start).toBeLessThan(180)
  })
})
