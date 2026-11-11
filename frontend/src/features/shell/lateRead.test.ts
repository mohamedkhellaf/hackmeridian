import { describe, expect, it } from 'vitest'
import { BANNED_TAGLINES, BANNED_WORDS, findBannedWords } from '../../core/disclosures'
import * as copy from './copy'
import { lateReadBanner } from './lateRead'

describe('lateReadBanner', () => {
  it('says nothing while the reads are current, connecting, or in a mock build', () => {
    for (const state of ['ok', 'connecting', 'mock'] as const) expect(lateReadBanner(state, true)).toBeNull()
  })

  it('waits until a late read has outlasted one more poll', () => {
    expect(lateReadBanner('delayed', false)).toBeNull()
    expect(lateReadBanner('delayed', true)).toBe('delayed')
  })

  it('shows at once when no ledger could be read at all', () => {
    expect(lateReadBanner('down', false)).toBe('down')
  })
})

describe('the shell copy', () => {
  const strings = [
    copy.NETWORK_NAME,
    copy.MOCK_DATA,
    copy.ledgerReading('58,331,204'),
    ...Object.values(copy.NETWORK_LATE).flatMap((late) => [late.full, late.short]),
    copy.LATE_READ_TITLE,
    ...Object.values(copy.LATE_READ_TEXT),
    copy.CONNECT_EMPTY,
    copy.CONNECT_EMPTY_HINT,
    copy.CONNECT_TOUCH_NOTE,
    copy.connectWaiting('Freighter'),
    copy.wrongNetworkText('Freighter'),
    copy.wrongNetworkText(null),
  ]

  it('names the network once and plainly, with no tagline and no developer words', () => {
    expect(copy.ledgerReading('58,331,204')).toBe('Testnet, ledger 58,331,204')
    const all = strings.join('\n')
    expect(findBannedWords(all, BANNED_WORDS)).toEqual([])
    expect(findBannedWords(all, BANNED_TAGLINES)).toEqual([])
    expect(all).not.toMatch(/\bRPC\b|\bonly\b.*testnet|testnet only/i)
  })

  it('has no em dashes, arrows or exclamation marks', () => {
    for (const text of strings) expect(text).not.toMatch(/[—→!]/)
  })

  it('tells the wallet user what to do on the wrong network, naming the wallet', () => {
    expect(copy.wrongNetworkText('Freighter')).toMatch(/^Freighter is on another network\. Open the wallet, choose Testnet/)
    expect(copy.wrongNetworkText(null)).toMatch(/^Your wallet is on another network\./)
  })
})
