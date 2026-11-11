import { describe, expect, it } from 'vitest'
import type { TokenInfo } from '../../core/options/types'
import type { TokenBalance } from '../../core/stellar/tokens'
import type { WalletInfo } from '../../wallet'
import { activityNote, balanceRows, balancesSentence, walletRows, walletStatus } from './wallet'

const USDX: TokenInfo = { contractId: 'C_USDX', code: 'USDx', decimals: 7 }
const BOND: TokenInfo = { contractId: 'C_BOND', code: 'BOND', decimals: 7 }
const EQTY: TokenInfo = { contractId: 'C_EQTY', code: 'EQTY', decimals: 2 }

const wallet = (id: string, availability: WalletInfo['availability']): WalletInfo => ({ id, name: id, availability, url: `https://example.org/${id}`, kind: 'Browser extension or web wallet' })

describe('walletRows', () => {
  it('lists installed extensions first and keeps the order inside each group', () => {
    const rows = walletRows([wallet('albedo', 'web'), wallet('freighter', 'installed'), wallet('lobstr', 'missing'), wallet('rabet', 'installed')])
    expect(rows.map((w) => w.id)).toEqual(['freighter', 'rabet', 'albedo', 'lobstr'])
  })

  it('is empty when no wallet was found', () => {
    expect(walletRows([])).toEqual([])
  })
})

describe('walletStatus', () => {
  it('says what choosing a wallet does', () => {
    expect(walletStatus(wallet('freighter', 'installed'), null)).toBe('Detected')
    expect(walletStatus(wallet('albedo', 'web'), null)).toBe('Web')
    expect(walletStatus(wallet('lobstr', 'missing'), null)).toBe('Install')
  })

  it('says Waiting only on the wallet that is being asked', () => {
    expect(walletStatus(wallet('freighter', 'installed'), 'freighter')).toBe('Waiting')
    expect(walletStatus(wallet('albedo', 'web'), 'freighter')).toBe('Web')
  })

  it('never says a missing extension is waiting', () => {
    expect(walletStatus(wallet('lobstr', 'missing'), 'lobstr')).toBe('Install')
  })
})

describe('balanceRows', () => {
  it('shows exact amounts, every digit, with at least two decimals', () => {
    const balances: TokenBalance[] = [
      { contractId: 'C_USDX', status: 'ok', balance: 25_000_000_000n },
      { contractId: 'C_BOND', status: 'ok', balance: 12_345_678n },
      { contractId: 'C_EQTY', status: 'ok', balance: 4_000n },
    ]
    const rows = balanceRows([USDX, BOND, EQTY], balances)
    expect(rows.map((r) => r.amount)).toEqual(['2,500.00', '1.2345678', '40.00'])
    expect(rows.every((r) => r.reason === null)).toBe(true)
  })

  it('never rounds: one unit of a seven-decimal token is shown in full', () => {
    const [row] = balanceRows([USDX], [{ contractId: 'C_USDX', status: 'ok', balance: 1n }])
    expect(row.amount).toBe('0.0000001')
  })

  it('keeps the order of the tokens, not of the balances', () => {
    const rows = balanceRows(
      [USDX, BOND],
      [
        { contractId: 'C_BOND', status: 'ok', balance: 10_000_000n },
        { contractId: 'C_USDX', status: 'ok', balance: 20_000_000n },
      ],
    )
    expect(rows.map((r) => r.token.code)).toEqual(['USDx', 'BOND'])
    expect(rows.map((r) => r.amount)).toEqual(['2.00', '1.00'])
  })

  it('gives the reason in place of a figure', () => {
    const rows = balanceRows(
      [USDX, BOND, EQTY],
      [
        { contractId: 'C_USDX', status: 'unfunded', balance: null },
        { contractId: 'C_BOND', status: 'no-trustline', balance: null },
        { contractId: 'C_EQTY', status: 'error', balance: null, error: 'boom' },
      ],
    )
    expect(rows.map((r) => r.amount)).toEqual([null, null, null])
    expect(rows.map((r) => r.reason)).toEqual(['Account not funded', 'No trustline', 'Unavailable'])
  })

  it('shows the figure of a frozen trustline together with the reason it cannot move', () => {
    const [row] = balanceRows([BOND], [{ contractId: 'C_BOND', status: 'not-authorized', balance: 50_000_000n }])
    expect(row).toMatchObject({ amount: '5.00', reason: 'Not authorized by the issuer' })
  })

  it('says Unavailable for a token the read did not return', () => {
    const [row] = balanceRows([BOND], [])
    expect(row).toMatchObject({ amount: null, reason: 'Unavailable' })
    expect(balanceRows([BOND], undefined)[0]).toMatchObject({ amount: null, reason: 'Unavailable' })
  })

  it('never shows a mock token as zero', () => {
    const [row] = balanceRows([BOND], [{ contractId: 'C_BOND', status: 'mock', balance: null }])
    expect(row).toMatchObject({ amount: null, reason: 'Mock token' })
  })
})

describe('balancesSentence', () => {
  it('reads the rows as one sentence for the name of the group', () => {
    const rows = balanceRows(
      [USDX, BOND, EQTY],
      [
        { contractId: 'C_USDX', status: 'ok', balance: 25_000_000_000n },
        { contractId: 'C_BOND', status: 'no-trustline', balance: null },
        { contractId: 'C_EQTY', status: 'not-authorized', balance: 4_000n },
      ],
    )
    expect(balancesSentence(rows)).toBe('USDx 2,500.00, BOND No trustline, EQTY 40.00, Not authorized by the issuer')
  })

  it('is empty without rows', () => {
    expect(balancesSentence([])).toBe('')
  })
})

describe('activityNote', () => {
  it('says nothing when everything is settled', () => {
    expect(activityNote(0, 0)).toBeNull()
  })

  it('counts transactions in progress', () => {
    expect(activityNote(2, 0)).toBe('2 in progress')
  })

  it('puts an unknown outcome first: it needs a check, never a resend', () => {
    expect(activityNote(1, 1)).toBe('1 to check')
  })
})
