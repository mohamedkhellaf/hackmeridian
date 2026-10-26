import type { CurveRange, PayoffPoint, StrategyPayoff } from './types.ts'

const EPS = 1e-9

/**
 * Build a StrategyPayoff from a piecewise-linear pnl whose slope only changes at `kinks`
 * (strikes). Analyses s in [0, inf).
 */
export function analyze(
  pnl: (s: number) => number,
  kinks: number[],
  capitalLocked: number,
): StrategyPayoff {
  const knots = [...new Set([0, ...kinks])].sort((a, b) => a - b)
  const last = knots[knots.length - 1]
  const tailSlope = pnl(last + 2) - pnl(last + 1)
  const values = knots.map(pnl)

  const maxGain = tailSlope > EPS ? Infinity : Math.max(...values)
  const maxLoss = tailSlope < -EPS ? Infinity : Math.max(0, -Math.min(...values))

  const roots: number[] = []
  const push = (x: number) => {
    if (!roots.some((r) => Math.abs(r - x) < 1e-7)) roots.push(x)
  }
  for (let i = 0; i < knots.length; i++) {
    if (Math.abs(values[i]) < EPS) push(knots[i])
    if (i + 1 < knots.length && values[i] * values[i + 1] < 0) {
      const t = values[i] / (values[i] - values[i + 1])
      push(knots[i] + t * (knots[i + 1] - knots[i]))
    }
  }
  const lastValue = values[values.length - 1]
  if (Math.abs(tailSlope) > EPS && Math.abs(lastValue) > EPS) {
    const x = last - lastValue / tailSlope
    if (x > last) push(x)
  }

  const curve = ({ from, to, steps = 100 }: CurveRange): PayoffPoint[] => {
    if (!Number.isInteger(steps) || steps < 1) throw new RangeError('steps must be a positive integer')
    return Array.from({ length: steps + 1 }, (_, i) => {
      const s = from + ((to - from) * i) / steps
      return { s, pnl: pnl(s) }
    })
  }

  return {
    label: 'hypothetical',
    pnl,
    breakevens: roots.sort((a, b) => a - b),
    maxGain,
    maxLoss,
    capitalLocked,
    curve,
  }
}
