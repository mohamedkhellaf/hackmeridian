import { describe, expect, it } from 'vitest'
import { explorerAccount, explorerAddress, explorerAsset, explorerContract, explorerLedger, explorerTx, explorerUrl, isMockId } from './explorer'

const G = 'GCNWQR5OA24X7LPTCXUEL4V4ZLSIFKUNIEZEO3UVCVXECPPGX7ERFDGM'
const C = 'CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6'

describe('explorer', () => {
  it('builds every link from one Testnet base', () => {
    expect(explorerTx('ab12')).toBe('https://stellar.expert/explorer/testnet/tx/ab12')
    expect(explorerAccount(G)).toBe(`https://stellar.expert/explorer/testnet/account/${G}`)
    expect(explorerContract(C)).toBe(`https://stellar.expert/explorer/testnet/contract/${C}`)
    expect(explorerAsset('BOND', G)).toBe(`https://stellar.expert/explorer/testnet/asset/BOND-${G}`)
    expect(explorerLedger(58331204)).toBe('https://stellar.expert/explorer/testnet/ledger/58331204')
    expect(explorerUrl('tx', 'a b')).toBe('https://stellar.expert/explorer/testnet/tx/a%20b')
  })
  it('never points at Mainnet', () => {
    for (const url of [explorerTx('x'), explorerAccount(G), explorerContract(C), explorerAsset('A', G), explorerLedger(1)]) expect(url).toContain('/explorer/testnet/')
  })
  it('picks account or contract from the address', () => {
    expect(explorerAddress(G)).toBe(explorerAccount(G))
    expect(explorerAddress(C)).toBe(explorerContract(C))
  })
  it('knows the mock placeholders, which have no page', () => {
    expect(isMockId('C_MOCK_RWA')).toBe(true)
    expect(isMockId('GMAKERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe(true)
    expect(isMockId('GMOCKISSUERAAAA')).toBe(true)
    expect(isMockId('GHEDGERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe(true)
    expect(isMockId(G)).toBe(false)
    expect(isMockId(C)).toBe(false)
  })
})
