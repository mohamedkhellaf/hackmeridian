import { afterEach, describe, expect, it } from 'vitest'
import { LEDGER_OFFSET_MIN_MS, ledgerOffsetMs, noteLedgerTime, resetLedgerOffset, steppedNow } from './clock'

afterEach(() => resetLedgerOffset())

describe('ledger clock (review finding 48)', () => {
  const READ_AT = Date.UTC(2026, 10, 13, 8, 0, 0)

  it('leaves a gap of one or two ledgers alone: the latest ledger closed a few seconds before it was read', () => {
    expect(noteLedgerTime(READ_AT / 1000 - 5, READ_AT)).toBe(0)
    expect(noteLedgerTime(READ_AT / 1000 + 3, READ_AT)).toBe(0)
  })

  it('corrects a device clock that is minutes off, and every derived now follows', () => {
    // The device runs 4 minutes fast: the ledger says 07:56.
    expect(noteLedgerTime(READ_AT / 1000 - 240, READ_AT)).toBe(-240_000)
    expect(ledgerOffsetMs()).toBe(-240_000)
    expect(steppedNow(1, READ_AT + ledgerOffsetMs())).toBe(READ_AT / 1000 - 240)
    expect(Math.abs(steppedNow(1) * 1000 - (Date.now() - 240_000))).toBeLessThan(1_500)
  })

  it('ignores a missing close time and a broken reading', () => {
    expect(noteLedgerTime(null, READ_AT)).toBe(0)
    expect(noteLedgerTime(READ_AT / 1000 - 3 * 86_400, READ_AT)).toBe(0)
    expect(LEDGER_OFFSET_MIN_MS).toBeGreaterThan(5_000)
  })
})
