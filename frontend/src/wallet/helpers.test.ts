import { describe, expect, it } from 'vitest'
import {
  describeWalletError,
  initials,
  isWrongNetwork,
  readStoredWalletId,
  splitWallets,
  toWalletInfos,
  walletErrorKind,
  writeStoredWalletId,
} from './helpers'

const w = (id: string, isAvailable: boolean, type = 'HOT_WALLET') => ({ id, name: id, type, isAvailable, url: 'u' })

describe('wallet helpers', () => {
  it('hides hardware wallets and splits by availability', () => {
    const list = toWalletInfos([w('freighter', true), w('lobstr', false), w('ledger', true, 'HW_WALLET'), w('trezor', false)])
    expect(list.map((x) => x.id)).toEqual(['freighter', 'lobstr'])
    const { installed, more } = splitWallets(list)
    expect(installed.map((x) => x.id)).toEqual(['freighter'])
    expect(more.map((x) => x.id)).toEqual(['lobstr'])
  })

  it('classifies errors', () => {
    expect(walletErrorKind({ code: -4, message: 'x' })).toBe('rejected')
    expect(walletErrorKind(new Error('User declined access'))).toBe('rejected')
    expect(walletErrorKind({ code: -1, message: 'Freighter is not connected' })).toBe('not-installed')
    expect(walletErrorKind(new Error('boom'))).toBe('other')
    expect(describeWalletError({ code: -4, message: 'x' }, 'xBull')).toContain('rejected')
    expect(describeWalletError(new Error('xBull is not installed'), 'xBull')).toContain('not installed')
  })

  it('only flags a wrong network when the wallet reports one', () => {
    expect(isWrongNetwork(null, 'T')).toBe(false)
    expect(isWrongNetwork('T', 'T')).toBe(false)
    expect(isWrongNetwork('P', 'T')).toBe(true)
  })

  it('makes initials', () => {
    expect(initials('Freighter')).toBe('Fr')
    expect(initials('xBull')).toBe('Xb')
  })

  it('persists the wallet id, tolerating broken storage', () => {
    const m = new Map<string, string>()
    const s = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    }
    writeStoredWalletId('freighter', s)
    expect(readStoredWalletId(s)).toBe('freighter')
    writeStoredWalletId(null, s)
    expect(readStoredWalletId(s)).toBeNull()
    const boom = () => {
      throw new Error('x')
    }
    const broken = { getItem: boom, setItem: boom, removeItem: boom }
    expect(readStoredWalletId(broken)).toBeNull()
    expect(() => writeStoredWalletId('a', broken)).not.toThrow()
  })
})
