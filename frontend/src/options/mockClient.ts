import type { OptionsClient } from './client'
import type { OptionOffer, TokenInfo, TxResult } from './types'

// In-memory stand-in for the options contract. Fictional assets and accounts,
// fake tx hashes. The UI shows a "mock data" banner while this is in use.

const USDX: TokenInfo = { contractId: 'C_MOCK_USDX', code: 'USDx', decimals: 7 }
const FUND: TokenInfo = { contractId: 'C_MOCK_FUND', code: 'FUND', decimals: 7 }
const BOND: TokenInfo = { contractId: 'C_MOCK_BOND', code: 'BOND', decimals: 7 }

const UNIT = 10_000_000n
const MAKER_A = 'GMAKERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const MAKER_B = 'GMAKERBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

const now = () => Math.floor(Date.now() / 1000)
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fakeHash = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')

function seed(): OptionOffer[] {
  const t = now()
  return [
    { id: 0n, kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * UNIT, totalStrike: 50n * UNIT, totalPremium: 2n * UNIT, expiry: t + 3 * 86400, writer: MAKER_A, holder: null, state: 'offered' },
    { id: 1n, kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * UNIT, totalStrike: 50n * UNIT, totalPremium: 18n * UNIT / 10n, expiry: t + 3 * 86400, writer: MAKER_B, holder: null, state: 'offered' },
    { id: 2n, kind: 'call', underlying: FUND, quote: USDX, underlyingQty: 3n * UNIT, totalStrike: 36n * UNIT, totalPremium: 15n * UNIT / 10n, expiry: t + 7 * 86400, writer: MAKER_A, holder: null, state: 'offered' },
    { id: 3n, kind: 'put', underlying: BOND, quote: USDX, underlyingQty: 10n * UNIT, totalStrike: 980n * UNIT, totalPremium: 12n * UNIT, expiry: t + 14 * 86400, writer: MAKER_B, holder: null, state: 'offered' },
  ]
}

export class MockOptionsClient implements OptionsClient {
  readonly isMock = true
  private options = seed()

  private find(id: bigint): OptionOffer {
    const o = this.options.find((x) => x.id === id)
    if (!o) throw new Error('Option not found')
    return o
  }

  private async tx(mutate: () => void): Promise<TxResult> {
    await delay(600)
    mutate()
    return { hash: fakeHash() }
  }

  async listOptions() {
    await delay(150)
    const t = now()
    return this.options.map((o) =>
      (o.state === 'active' || o.state === 'offered') && o.expiry <= t ? { ...o, state: 'expired' as const } : { ...o },
    )
  }

  async getOption(id: bigint) {
    return { ...this.find(id) }
  }

  buy(id: bigint, buyer: string) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.state !== 'offered') throw new Error('Offer is no longer available')
      if (o.expiry <= now()) throw new Error('Offer has expired')
      o.holder = buyer
      o.state = 'active'
    })
  }

  exercise(id: bigint, holder: string) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.holder !== holder) throw new Error('Only the holder can exercise')
      if (o.state !== 'active') throw new Error('Option is not active')
      if (o.expiry <= now()) throw new Error('Option has expired')
      o.state = 'exercised'
    })
  }

  reclaim(id: bigint, writer: string) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.writer !== writer) throw new Error('Only the writer can reclaim')
      if (o.expiry > now()) throw new Error('Option has not expired yet')
      o.state = 'expired'
    })
  }

  cancelOffer(id: bigint, writer: string) {
    return this.tx(() => {
      const o = this.find(id)
      if (o.writer !== writer) throw new Error('Only the writer can cancel')
      if (o.state !== 'offered') throw new Error('Only open offers can be cancelled')
      o.state = 'cancelled'
    })
  }
}
