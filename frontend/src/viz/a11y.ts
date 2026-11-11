// Accessibility helpers shared by the charts: slider keyboard steps (APG slider pattern), the words that go
// with every gain and loss, and plain-text summaries for screen readers. Pure functions.

import { formatNumber, isNoise } from './format.ts'

export interface SliderStepInput {
  value: number
  min: number
  max: number
  /** Arrow keys. */
  step: number
  /** Page Up and Page Down, and Shift with an arrow key. Defaults to ten steps. */
  largeStep?: number
  shiftKey?: boolean
}

const tidy = (n: number): number => Number.parseFloat(n.toPrecision(12))

function stepUp(value: number, step: number): number {
  // From an off-grid value (the handle snapped on a breakeven) the next press lands on the grid.
  return tidy((Math.floor(value / step + 1e-9) + 1) * step)
}

function stepDown(value: number, step: number): number {
  return tidy((Math.ceil(value / step - 1e-9) - 1) * step)
}

/**
 * The value a slider takes after a key press, or null when the key is not a slider key (the event is then left
 * alone). Arrows move one step, Shift with an arrow or Page Up and Page Down a large step, Home and End go to
 * the ends. Up and Right increase.
 */
export function sliderKeyValue(key: string, { value, min, max, step, largeStep, shiftKey = false }: SliderStepInput): number | null {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  if (!(step > 0)) return null
  const large = largeStep && largeStep > 0 ? largeStep : step * 10
  const bound = (v: number) => Math.min(hi, Math.max(lo, v))
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return bound(shiftKey ? stepUp(value, large) : stepUp(value, step))
    case 'ArrowLeft':
    case 'ArrowDown':
      return bound(shiftKey ? stepDown(value, large) : stepDown(value, step))
    case 'PageUp':
      return bound(stepUp(value, large))
    case 'PageDown':
      return bound(stepDown(value, large))
    case 'Home':
      return lo
    case 'End':
      return hi
    default:
      return null
  }
}

export type Direction = 'gain' | 'loss' | 'even'

/** Which side of zero a result is on. Only arithmetic noise counts as even: a real sub-cent amount prints `<0.01` with its side. */
export function direction(value: number, decimals = 2): Direction {
  if (!Number.isFinite(value)) return value > 0 ? 'gain' : value < 0 ? 'loss' : 'even'
  if (isNoise(value, decimals)) return 'even'
  return value > 0 ? 'gain' : 'loss'
}

export interface PayoffTextInput {
  price: number
  value: number
  unit: string
  decimals?: number
  priceDecimals?: number
}

/**
 * The sentence a screen reader hears on the price handle: "At 8.00 you would gain 28.20 USDx". The word carries
 * the sign, so no plus or minus is read out.
 */
export function payoffValueText({ price, value, unit, decimals = 2, priceDecimals = decimals }: PayoffTextInput): string {
  const at = formatNumber(price, priceDecimals)
  const side = direction(value, decimals)
  if (side === 'even') return `At ${at} you would break even`
  return `At ${at} you would ${side === 'gain' ? 'gain' : 'lose'} ${formatNumber(Math.abs(value), decimals)} ${unit}`.trim()
}

/** One sentence for a series of values: where it starts, where it ends, its low and high. */
export function seriesSummary(values: readonly number[], decimals = 2, unit = ''): string {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length === 0) return 'No data.'
  const u = unit ? ` ${unit}` : ''
  const first = finite[0]
  const last = finite[finite.length - 1]
  if (finite.length === 1) return `One value, ${formatNumber(first, decimals)}${u}.`
  const low = Math.min(...finite)
  const high = Math.max(...finite)
  if (low === high) return `Flat at ${formatNumber(first, decimals)}${u} over ${finite.length} values.`
  const trend = direction(last - first, decimals)
  const moved = trend === 'even' ? 'unchanged' : trend === 'gain' ? 'up' : 'down'
  return `Starts at ${formatNumber(first, decimals)}${u}, ends at ${formatNumber(last, decimals)}${u} (${moved}), low ${formatNumber(low, decimals)}, high ${formatNumber(high, decimals)}.`
}

/** Joins the parts of an accessible name that are present, with a full stop between sentences. */
export function sentences(...parts: Array<string | null | undefined | false>): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    .map((p) => p.trim().replace(/[.]$/, ''))
    .join('. ')
    .concat('.')
    .replace(/^\.$/, '')
}
