/**
 * Conversion between exact on-chain integers (token units) and display numbers.
 * `number` results are for illustrative charts only; never sign or send them.
 */

function scale(decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new RangeError(`decimals must be an integer in 0..18, got ${decimals}`)
  }
  return 10n ** BigInt(decimals)
}

/** On-chain units -> display number. `toNumber(10_000_000n, 7) === 1`. */
export function toNumber(units: bigint, decimals: number): number {
  const base = scale(decimals)
  const negative = units < 0n
  const abs = negative ? -units : units
  const value = Number(abs / base) + Number(abs % base) / Number(base)
  return negative ? -value : value
}

/** Display number -> on-chain units, rounded to the nearest unit. Inverse of `toNumber` for safe-range integers. */
export function toUnits(value: number, decimals: number): bigint {
  const base = scale(decimals)
  if (!Number.isFinite(value)) throw new RangeError('value must be finite')
  return BigInt(Math.round(value * Number(base)))
}
