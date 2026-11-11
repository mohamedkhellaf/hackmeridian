import { describe, expect, it } from 'vitest'
import { BANNED_WORDS, findBannedWords } from '../../core/disclosures'
import type { TokenInfo } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import {
  DEFAULT_SORT,
  boardRequests,
  boardTotals,
  filterRequests,
  holdsEscrow,
  lockShortfall,
  myRequests,
  openRequests,
  parseBidId,
  serialOf,
  sortRequests,
  toRow,
} from './board'
import * as copy from './copy'

const UNIT = 10_000_000n
const USDX: TokenInfo = { contractId: 'C_MOCK_USDX', code: 'USDx', decimals: 7 }
const FUND: TokenInfo = { contractId: 'C_MOCK_FUND', code: 'FUND', decimals: 7 }
const BOND: TokenInfo = { contractId: 'C_MOCK_BOND', code: 'BOND', decimals: 7 }
const ODD: TokenInfo = { contractId: 'CODD', code: 'ODD', decimals: 2 }
const ME = 'GME'
const NOW = 1_800_000_000

const bid = (over: Partial<Bid> = {}): Bid => ({
  id: 0n,
  buyer: 'GOTHER',
  kind: 'put',
  underlying: FUND,
  quote: USDX,
  underlyingQty: 5n * UNIT,
  totalStrike: 50n * UNIT,
  totalPremium: 2n * UNIT,
  expiry: NOW + 86_400,
  state: 'open',
  optionId: null,
  ...over,
})

describe('which requests are on the board', () => {
  it('lists open requests whose deadline is ahead, and nothing else', () => {
    const bids = [
      bid({ id: 1n }),
      bid({ id: 2n, expiry: NOW }), // the deadline is now: no longer fillable
      bid({ id: 3n, state: 'expired', expiry: NOW - 10 }),
      bid({ id: 4n, state: 'filled', optionId: 9n }),
      bid({ id: 5n, state: 'cancelled' }),
      bid({ id: 6n, state: 'pruned', expiry: NOW - 10 }),
    ]
    expect(openRequests(bids, NOW).map((b) => b.id)).toEqual([1n])
  })

  it('filters by asset contract id and by kind', () => {
    const bids = [bid({ id: 1n }), bid({ id: 2n, underlying: BOND }), bid({ id: 3n, kind: 'call' }), bid({ id: 4n, underlying: BOND, kind: 'call' })]
    expect(filterRequests(bids, { assetId: null, kind: null })).toHaveLength(4)
    expect(filterRequests(bids, { assetId: BOND.contractId, kind: null }).map((b) => b.id)).toEqual([2n, 4n])
    expect(filterRequests(bids, { assetId: null, kind: 'call' }).map((b) => b.id)).toEqual([3n, 4n])
    expect(filterRequests(bids, { assetId: BOND.contractId, kind: 'put' }).map((b) => b.id)).toEqual([2n])
    expect(filterRequests(bids, { assetId: 'CUNKNOWN', kind: null })).toEqual([])
  })
})

describe('the order of the board', () => {
  const soonCheap = bid({ id: 1n, expiry: NOW + 100, totalPremium: 1n * UNIT }) // 0.20 per unit
  const lateDear = bid({ id: 2n, expiry: NOW + 900, totalPremium: 4n * UNIT }) // 0.80 per unit
  const lateBig = bid({ id: 3n, expiry: NOW + 900, totalPremium: 6n * UNIT, underlyingQty: 20n * UNIT, totalStrike: 200n * UNIT }) // 0.30 per unit

  it('opens on the soonest deadline', () => {
    expect(DEFAULT_SORT).toBe('deadline')
  })

  it('deadline: soonest first, then the higher premium per unit, then the id', () => {
    expect(sortRequests([lateBig, lateDear, soonCheap], 'deadline').map((b) => b.id)).toEqual([1n, 2n, 3n])
    const twin = bid({ id: 9n, expiry: NOW + 900, totalPremium: 4n * UNIT })
    expect(sortRequests([twin, lateDear], 'deadline').map((b) => b.id)).toEqual([2n, 9n])
  })

  it('premium: the highest premium per unit first, not the highest total', () => {
    // lateBig escrows the most (6.00) but pays the least per unit after soonCheap.
    expect(sortRequests([soonCheap, lateBig, lateDear], 'premium').map((b) => b.id)).toEqual([2n, 3n, 1n])
  })

  it('compares per unit exactly, without dividing', () => {
    // 1/3 against 0.3333333 per unit: the floored figures are equal, the exact ratios are not.
    const third = bid({ id: 1n, totalPremium: 1n * UNIT, underlyingQty: 3n * UNIT, totalStrike: 30n * UNIT })
    const justUnder = bid({ id: 2n, totalPremium: 3_333_333n, underlyingQty: 1n * UNIT, totalStrike: 10n * UNIT })
    expect(sortRequests([justUnder, third], 'premium').map((b) => b.id)).toEqual([1n, 2n])
  })

  it('compares assets with different decimals on the same per-unit scale', () => {
    // 3.00 USDx for 2.00 ODD (2 decimals) is 1.50 per unit; 2.00 USDx for 5.00 FUND is 0.40 per unit.
    const odd = bid({ id: 1n, underlying: ODD, underlyingQty: 200n, totalStrike: 20n * UNIT, totalPremium: 3n * UNIT })
    const fund = bid({ id: 2n })
    expect(sortRequests([fund, odd], 'premium').map((b) => b.id)).toEqual([1n, 2n])
  })

  it('does not reorder its input', () => {
    const input = [lateDear, soonCheap]
    sortRequests(input, 'deadline')
    expect(input.map((b) => b.id)).toEqual([2n, 1n])
  })

  it('boardRequests composes open, filter and order', () => {
    const bids = [lateDear, soonCheap, bid({ id: 7n, state: 'filled' }), bid({ id: 8n, underlying: BOND, expiry: NOW + 50 })]
    expect(boardRequests(bids, { assetId: null, kind: null, sort: 'deadline' }, NOW).map((b) => b.id)).toEqual([8n, 1n, 2n])
    expect(boardRequests(bids, { assetId: FUND.contractId, kind: 'put', sort: 'premium' }, NOW).map((b) => b.id)).toEqual([2n, 1n])
  })
})

describe('my requests', () => {
  const mine = (over: Partial<Bid>) => bid({ buyer: ME, ...over })
  const bids = [
    mine({ id: 1n, state: 'cancelled' }),
    mine({ id: 2n, state: 'filled', optionId: 30n }),
    mine({ id: 3n, state: 'expired', expiry: NOW - 5 }),
    mine({ id: 4n, expiry: NOW + 900 }),
    mine({ id: 5n, expiry: NOW + 100 }),
    mine({ id: 6n, state: 'filled', optionId: 31n }),
    mine({ id: 7n, state: 'pruned', expiry: NOW - 500 }),
    bid({ id: 8n }),
  ]

  it('is empty without a wallet', () => {
    expect(myRequests(bids, null)).toEqual([])
  })

  it('shows what still holds the premium first, then filled, then closed, newest first', () => {
    expect(myRequests(bids, ME).map((b) => b.id)).toEqual([5n, 4n, 3n, 6n, 2n, 7n, 1n])
  })

  it('knows which requests still hold the premium', () => {
    expect(bids.filter(holdsEscrow).map((b) => b.id)).toEqual([3n, 4n, 5n, 8n])
  })
})

describe('totals', () => {
  it('adds the escrowed premiums exactly', () => {
    const totals = boardTotals([bid({ totalPremium: 1n }), bid({ totalPremium: 2n * UNIT }), bid({ totalPremium: 9_999_999n })])
    expect(totals).toEqual({ count: 3, escrowed: 30_000_000n, quote: USDX })
  })

  it('has no figure for an empty board', () => {
    expect(boardTotals([])).toEqual({ count: 0, escrowed: null, quote: null })
  })
})

describe('a row', () => {
  it('formats every figure from exact units, truncated', () => {
    const row = toRow(bid({ id: 12n, totalPremium: 19_999_999n }), ME)
    expect(row.serial).toBe('000012')
    expect(row.kindWord).toBe('Put')
    expect(row.glyph).toBe('long-put')
    expect(row.quantity).toEqual({ text: '5.00', exact: '5.00', code: 'FUND' })
    expect(row.strike).toEqual({ text: '10.00', exact: '10.00', code: 'USDx' })
    // 1.9999999 is never shown as 2.00, and its per-unit figure is floored.
    expect(row.premium).toEqual({ text: '1.99', exact: '1.9999999', code: 'USDx' })
    expect(row.premiumPerUnit.text).toBe('0.39')
    expect(row.deadlineText).toBe('16 Jan 2027, 08:00 UTC')
    expect(row.mine).toBe(false)
    expect(row.terms).toBe('put on 5.00 FUND at 10.00 USDx, until 16 Jan 2027, 08:00 UTC, premium 1.99 USDx')
  })

  it('a put locks the total strike in the quote token, a call the underlying', () => {
    expect(toRow(bid(), null).lock).toEqual({ text: '50.00', exact: '50.00', code: 'USDx' })
    const call = toRow(bid({ kind: 'call' }), null)
    expect(call.lock).toEqual({ text: '5.00', exact: '5.00', code: 'FUND' })
    expect(call.glyph).toBe('long-call')
    expect(call.lockToken).toBe(FUND)
  })

  it('marks the wallet own request and carries the option of a filled one', () => {
    const row = toRow(bid({ buyer: ME, state: 'filled', optionId: 44n }), ME)
    expect(row.mine).toBe(true)
    expect(row.optionId).toBe(44n)
    expect(row.stateName).toBe('Filled')
    expect(row.escrow).toBe('paid')
  })

  it('names each state as the contract does and says where the premium is', () => {
    const of = (state: Bid['state']) => toRow(bid({ state }), null)
    expect([of('open').stateName, of('expired').stateName, of('cancelled').stateName, of('pruned').stateName]).toEqual(['Open', 'Expired', 'Cancelled', 'Expired'])
    expect([of('open').escrow, of('expired').escrow, of('cancelled').escrow, of('pruned').escrow]).toEqual(['escrowed', 'stranded', 'refunded', 'refunded'])
  })
})

describe('the collateral hint', () => {
  const row = toRow(bid(), null) // locks 50.00 USDx

  it('is silent when the balance covers the collateral or is not known', () => {
    expect(lockShortfall(row, 50n * UNIT)).toBeNull()
    expect(lockShortfall(row, 500n * UNIT)).toBeNull()
    expect(lockShortfall(row, null)).toBeNull()
    expect(lockShortfall(row, undefined)).toBeNull()
  })

  it('gives the exact figures when the wallet is short', () => {
    expect(lockShortfall(row, 12n * UNIT)).toEqual({
      have: { text: '12.00', exact: '12.00', code: 'USDx' },
      missing: { text: '38.00', exact: '38.00', code: 'USDx' },
    })
  })
})

describe('ids', () => {
  it('prints a serial of six digits', () => {
    expect(serialOf(0n)).toBe('000000')
    expect(serialOf(184n)).toBe('000184')
    expect(serialOf(1_234_567n)).toBe('1234567')
  })

  it('reads a bid id from the URL and refuses anything else', () => {
    expect(parseBidId('3')).toBe(3n)
    expect(parseBidId('0')).toBe(0n)
    expect(parseBidId(undefined)).toBeNull()
    expect(parseBidId('')).toBeNull()
    expect(parseBidId('-1')).toBeNull()
    expect(parseBidId('1.5')).toBeNull()
    expect(parseBidId('1e3')).toBeNull()
    expect(parseBidId('abc')).toBeNull()
  })
})

describe('copy', () => {
  const strings: string[] = []
  const collect = (value: unknown): void => {
    if (typeof value === 'string') strings.push(value)
    else if (Array.isArray(value)) value.forEach(collect)
    else if (value && typeof value === 'object') Object.values(value).forEach(collect)
  }
  collect(Object.values(copy).filter((v) => typeof v !== 'function'))
  const row = toRow(bid({ id: 3n }), null)
  strings.push(
    copy.boardSummary(1, 1, '2.00 USDx'),
    copy.boardSummary(4, 4, '5.99 USDx'),
    copy.boardSummary(2, 4, '3.00 USDx'),
    copy.boardSummary(0, 0, null),
    copy.sellLabel(row),
    copy.cancelLabel(row),
    copy.positionLabel(row),
    copy.cancelTitle(row.serial),
    copy.strikePerUnitOf(row),
    copy.confirmedInLedger(58_331_204),
    copy.cancelDone(row.premium),
    copy.chooserOpenCount(0),
    copy.chooserOpenCount(1),
    copy.chooserOpenCount(3),
    copy.youLock(row.lock),
    copy.listTitle(row),
    copy.strikeLine(row),
  )

  it('collected the strings of the page', () => {
    expect(strings.length).toBeGreaterThan(60)
  })

  it('uses no banned word, no em dash, no arrow, no exclamation mark', () => {
    for (const text of strings) {
      expect(findBannedWords(text, BANNED_WORDS), text).toEqual([])
      expect(text, text).not.toMatch(/[—→←!]|->/)
    }
  })

  it('never retypes the escrow sentence of the bid ticket', () => {
    for (const text of strings) expect(text).not.toMatch(/refunded if you cancel or it expires/)
  })

  it('counts with the right plural', () => {
    expect(copy.boardSummary(1, 1, '2.00 USDx')).toBe('1 open request. 2.00 USDx of premium is escrowed in the contract.')
    expect(copy.boardSummary(4, 4, '5.99 USDx')).toBe('4 open requests. 5.99 USDx of premium is escrowed in the contract.')
    expect(copy.boardSummary(2, 4, '3.00 USDx')).toBe('2 of 4 open requests shown, with 3.00 USDx of premium escrowed in the contract.')
    expect(copy.chooserOpenCount(0)).toBe('No open requests')
    expect(copy.chooserOpenCount(1)).toBe('1 open request')
  })

  it('starts each accessible name with the visible label', () => {
    expect(copy.sellLabel(row).startsWith(copy.SELL_TO_BID)).toBe(true)
    expect(copy.cancelLabel(row).startsWith(copy.CANCEL_REQUEST)).toBe(true)
    expect(copy.positionLabel(row).startsWith(copy.VIEW_POSITION)).toBe(true)
    expect(copy.sellLabel(row)).toBe('Sell to this bid: put on 5.00 FUND at 10.00 USDx, until 16 Jan 2027, 08:00 UTC, premium 2.00 USDx, you lock 50.00 USDx')
  })
})
