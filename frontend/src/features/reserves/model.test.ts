import { describe, expect, it } from 'vitest'
import { MockOptionsClient } from '../../core/options/mockClient'
import type { CollateralHealth, CollateralLine, SupportedAssets, TokenInfo } from '../../core/options/types'
import { chartNumber, differenceExact, differenceMagnitude, differenceShown, differenceSpoken, differenceText, subCent, amountText, exactText, ledgerText, readTimeIso, readTimeText, reserveRows, shortRows, summaryLine, visibleRows } from './model'

const USDX: TokenInfo = { contractId: 'C_USDX', code: 'USDx', decimals: 7 }
const BOND: TokenInfo = { contractId: 'C_BOND', code: 'BOND', decimals: 7 }
const EQTY: TokenInfo = { contractId: 'C_EQTY', code: 'EQTY', decimals: 7 }
const ASSETS: SupportedAssets = { quote: USDX, underlyings: [BOND, EQTY] }

const u = (whole: number, frac = 0): bigint => BigInt(whole) * 10_000_000n + BigInt(frac)
const line = (token: TokenInfo, part: Partial<Omit<CollateralLine, 'token'>> = {}): CollateralLine => ({ token, offered: 0n, active: 0n, pendingReclaim: 0n, unclaimed: 0n, escrowed: 0n, ...part })
const health = (token: TokenInfo, reserved: bigint, held: bigint): CollateralHealth => ({ token, reserved, held })

describe('reserveRows', () => {
  it('puts the quote token first, then the underlyings in the contract order', () => {
    const rows = reserveRows(ASSETS, [line(EQTY, { offered: u(1) }), line(USDX, { active: u(5) })], [health(EQTY, u(1), u(1)), health(USDX, u(5), u(5))])
    expect(rows.map((r) => r.token.code)).toEqual(['USDx', 'BOND', 'EQTY'])
    expect(rows.map((r) => r.role)).toEqual(['quote', 'underlying', 'underlying'])
  })

  it('reads held equal to locked as equal with a zero difference', () => {
    const [row] = reserveRows(ASSETS, [line(USDX, { offered: u(500), active: u(480), pendingReclaim: u(50), unclaimed: u(30), escrowed: u(20) })], [health(USDX, u(1080), u(1080))])
    expect(row.state).toBe('equal')
    expect(row.locked).toBe(u(1080))
    expect(row.held).toBe(u(1080))
    expect(row.difference).toBe(0n)
    expect(differenceText(row)).toBe('0.00')
    expect(row.itemsTotal).toBe(u(1080))
    expect(row.itemsMatch).toBe(true)
  })

  it('names a shortfall and keeps the exact amount', () => {
    const rows = reserveRows(ASSETS, [line(BOND, { active: u(250) })], [health(USDX, 0n, 0n), health(BOND, u(250), u(230)), health(EQTY, 0n, 0n)])
    const bond = rows[1]
    expect(bond.state).toBe('short')
    expect(bond.difference).toBe(-u(20))
    expect(differenceText(bond)).toBe('−20.00')
    expect(differenceMagnitude(bond)).toBe('20.00')
    expect(differenceSpoken(bond)).toBe('short by 20.00 BOND')
    expect(shortRows(rows).map((r) => r.token.code)).toEqual(['BOND'])
  })

  it('never shows a shortfall of less than a cent as zero', () => {
    const [, bond] = reserveRows(ASSETS, [line(BOND, { active: u(250) })], [health(BOND, u(250), u(250) - 1n)])
    expect(bond.state).toBe('short')
    expect(differenceText(bond)).toBe('−<0.01')
    expect(differenceExact(bond)).toBe('−0.0000001')
  })

  it('says a difference under a cent in words, with the word beside it carrying the side', () => {
    const [, bond] = reserveRows(ASSETS, [line(BOND, { active: u(250) })], [health(BOND, u(250), u(250) - 1n)])
    expect(subCent(bond)).toBe(true)
    expect(differenceShown(bond)).toBe('under 0.01')
    expect(differenceSpoken(bond)).toBe('short by under 0.01 BOND')
    const [, whole] = reserveRows(ASSETS, [line(BOND, { active: u(250) })], [health(BOND, u(250), u(230))])
    expect(subCent(whole)).toBe(false)
    expect(differenceShown(whole)).toBe('−20.00')
  })

  it('reads held above locked as over, with a plus sign', () => {
    const [, bond] = reserveRows(ASSETS, [line(BOND, { active: u(3) })], [health(BOND, u(3), u(3, 4_000_000))])
    expect(bond.state).toBe('over')
    expect(differenceText(bond)).toBe('+0.40')
    expect(differenceSpoken(bond)).toBe('0.40 BOND over')
  })

  it('shows the escrow line for the quote token only, unless an underlying has some', () => {
    const rows = reserveRows(ASSETS, [line(USDX, { escrowed: u(2) }), line(BOND, { offered: u(1) })], [health(USDX, u(2), u(2)), health(BOND, u(1), u(1))])
    expect(rows[0].items?.map((i) => i.key)).toEqual(['offered', 'active', 'pendingReclaim', 'unclaimed', 'escrowed'])
    expect(rows[1].items?.map((i) => i.key)).toEqual(['offered', 'active', 'pendingReclaim', 'unclaimed'])
  })

  it('without the health read, sums the items and leaves held unknown', () => {
    const [usdx] = reserveRows(ASSETS, [line(USDX, { offered: u(10), escrowed: u(2) })], undefined)
    expect(usdx.state).toBe('unknown')
    expect(usdx.locked).toBe(u(12))
    expect(usdx.held).toBeNull()
    expect(usdx.difference).toBeNull()
    expect(differenceText(usdx)).toBe('')
    expect(differenceSpoken(usdx)).toBe('difference unknown')
  })

  it('without the option list, keeps the contract figures and drops the split', () => {
    const [usdx] = reserveRows(ASSETS, undefined, [health(USDX, u(12), u(12)), health(BOND, 0n, 0n), health(EQTY, 0n, 0n)])
    expect(usdx.state).toBe('equal')
    expect(usdx.locked).toBe(u(12))
    expect(usdx.items).toBeNull()
    expect(usdx.itemsTotal).toBeNull()
    expect(usdx.itemsMatch).toBe(true)
  })

  it('flags a split that does not add up to the contract figure', () => {
    const [usdx] = reserveRows(ASSETS, [line(USDX, { offered: u(1060) })], [health(USDX, u(1080), u(1080))])
    expect(usdx.itemsMatch).toBe(false)
    expect(usdx.locked).toBe(u(1080))
    expect(usdx.itemsTotal).toBe(u(1060))
  })

  it('treats a token with no line and no health entry as empty, when both reads are in', () => {
    const rows = reserveRows(ASSETS, [line(USDX, { offered: u(1) })], [health(USDX, u(1), u(1))])
    expect(rows[1].state).toBe('equal')
    expect(rows[1].locked).toBe(0n)
    expect(rows[1].held).toBe(0n)
  })

  it('lists a token that only the reads know', () => {
    const other: TokenInfo = { contractId: 'C_OTHER', code: 'OTHR', decimals: 7 }
    const rows = reserveRows(ASSETS, [line(other, { offered: u(1) })], [health(other, u(1), u(1))])
    expect(rows.map((r) => r.token.code)).toEqual(['USDx', 'BOND', 'EQTY', 'OTHR'])
  })

  it('matches the mock contract: every seeded token is equal and its items add up', async () => {
    const client = new MockOptionsClient()
    const [assets, lines, healthRead] = await Promise.all([client.supportedAssets(), client.openCollateral(), client.collateralHealth()])
    const rows = reserveRows(assets, lines, healthRead)
    expect(rows.length).toBe(1 + assets.underlyings.length)
    expect(rows[0].role).toBe('quote')
    for (const row of rows) {
      expect(row.state).toBe('equal')
      expect(row.itemsMatch).toBe(true)
      expect(differenceText(row)).toBe('0.00')
    }
    expect(rows[0].locked > 0n).toBe(true)
    expect(summaryLine(rows)).toBe(`Held is at or above locked for all ${rows.length} tokens.`)
  })
})

describe('visibleRows', () => {
  const SPAM_A: TokenInfo = { contractId: 'C_SPAM_A', code: 'B0ND', decimals: 7 }
  const SPAM_B: TokenInfo = { contractId: 'C_SPAM_B', code: 'FREE', decimals: 7 }
  const listed: SupportedAssets = { quote: USDX, underlyings: [BOND, SPAM_A, SPAM_B] }
  const isReference = (id: string) => id === BOND.contractId

  it('keeps the quote token and the reference assets, and only counts an empty listed token', () => {
    const rows = reserveRows(listed, [], [health(USDX, 0n, 0n), health(BOND, 0n, 0n), health(SPAM_A, 0n, 0n), health(SPAM_B, 0n, 0n)])
    const { shown, hiddenEmpty } = visibleRows(rows, isReference)
    expect(shown.map((r) => r.token.code)).toEqual(['USDx', 'BOND'])
    expect(hiddenEmpty).toBe(2)
  })

  it('always shows a token with something locked or held, whoever listed it', () => {
    const rows = reserveRows(listed, [line(SPAM_A, { offered: u(5) })], [health(USDX, 0n, 0n), health(BOND, 0n, 0n), health(SPAM_A, u(5), u(5)), health(SPAM_B, 0n, 1n)])
    const { shown, hiddenEmpty } = visibleRows(rows, isReference)
    expect(shown.map((r) => r.token.code)).toEqual(['USDx', 'BOND', 'B0ND', 'FREE'])
    expect(hiddenEmpty).toBe(0)
  })

  it('shows a short token outside the list', () => {
    const rows = reserveRows(listed, [line(SPAM_B, { active: u(2) })], [health(USDX, 0n, 0n), health(BOND, 0n, 0n), health(SPAM_A, 0n, 0n), health(SPAM_B, u(2), 0n)])
    expect(visibleRows(rows, isReference).shown.map((r) => r.token.code)).toEqual(['USDx', 'BOND', 'FREE'])
  })
})

describe('summaryLine', () => {
  it('names the short tokens', () => {
    const rows = reserveRows(ASSETS, [], [health(USDX, u(1), u(1)), health(BOND, u(2), u(1)), health(EQTY, u(2), u(1))])
    expect(summaryLine(rows)).toBe('Held is below locked for BOND and EQTY.')
  })

  it('says when held could not be read', () => {
    expect(summaryLine(reserveRows(ASSETS, [line(USDX, { offered: u(1) })], undefined))).toBe('Held could not be read for all 3 tokens.')
  })

  it('is empty without rows', () => {
    expect(summaryLine([])).toBe('')
  })
})

describe('text', () => {
  it('formats amounts with two decimals, truncated, and keeps every digit in the exact form', () => {
    expect(amountText(u(1080), USDX)).toBe('1,080.00')
    expect(amountText(u(229, 9_999_999), USDX)).toBe('229.99')
    expect(exactText(u(229, 9_999_999), USDX)).toBe('229.9999999')
  })

  it('formats the read line', () => {
    expect(ledgerText(58331204)).toBe('58,331,204')
    expect(readTimeText(Date.UTC(2026, 10, 11, 14, 2, 11))).toBe('14:02:11 UTC')
    expect(readTimeIso(Date.UTC(2026, 10, 11, 14, 2, 11, 500))).toBe('2026-11-11T14:02:11Z')
    expect(readTimeText(Number.NaN)).toBe('')
  })

  it('scales a bar length without touching the figures', () => {
    expect(chartNumber(u(230), 7)).toBe(230)
    expect(chartNumber(0n, 7)).toBe(0)
  })
})
