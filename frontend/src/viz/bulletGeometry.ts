import { clamp, linearScale } from './scales.ts'

export interface BulletGeometry {
  /** End of the solid bar. */
  bar: number
  /** Position of the target tick, or null. */
  tick: number | null
  /** Hatched stretch between the bar and a target it does not reach. */
  shortfall: [number, number] | null
  /** Stretch of the bar beyond the target. */
  excess: [number, number] | null
}

/** Pixel geometry of a bullet: a bar measured against a target tick. Pure. */
export function bulletGeometry(value: number, target: number | undefined, max: number, width: number): BulletGeometry {
  const top = Math.max(max, 0) || 1
  const x = linearScale([0, top], [0, width])
  const v = clamp(x(Math.max(0, value)), 0, width)
  if (target === undefined || !Number.isFinite(target)) return { bar: v, tick: null, shortfall: null, excess: null }
  const t = clamp(x(Math.max(0, target)), 0, width)
  return {
    bar: Math.min(v, t),
    tick: t,
    shortfall: v < t - 0.5 ? [v, t] : null,
    excess: v > t + 0.5 ? [t, v] : null,
  }
}

export type ReserveState = 'short' | 'over' | 'equal'

/** Held against locked: short when the contract holds less than it owes, over when it holds more. */
export function reserveState(locked: number, held: number): ReserveState {
  if (held < locked) return 'short'
  if (held > locked) return 'over'
  return 'equal'
}
