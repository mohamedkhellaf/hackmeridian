// Test helper: the demo market of the mock client at a fixed instant, as the selectors receive it.
import { MockOptionsClient } from '../../core/options/mockClient'
import { demoSeed } from '../../core/options/mockSeed'
import type { TokenInfo } from '../../core/options/types'
import { referenceFor } from '../../core/reference'
import type { ReferencePrice } from '../../core/reference'
import type { MarketSource } from './market'

/** Wednesday 11 November 2026, 12:00 UTC: the first listed expiry (Friday 13th, 08:00 UTC) is 44 hours away. */
export const FIXED_MS = Date.UTC(2026, 10, 11, 12, 0, 0)
export const FIXED_SEC = FIXED_MS / 1000

export interface DemoWorld {
  client: MockOptionsClient
  quote: TokenInfo
  assets: Record<'FUND' | 'BOND' | 'EQTY', TokenInfo>
  source: (me: string | null) => MarketSource
  reference: (asset: TokenInfo) => ReferencePrice
}

/** Call with the clock already set to `FIXED_MS` (vi.setSystemTime): the mock derives expiry from `Date.now()`. */
export async function demoWorld(): Promise<DemoWorld> {
  const client = new MockOptionsClient(demoSeed(FIXED_SEC))
  const [options, asks, bids, listed] = await Promise.all([client.listOptions(), client.listAsks(), client.listBids(), client.supportedAssets()])
  const byCode = (code: string) => listed.underlyings.find((t) => t.code === code)!
  return {
    client,
    quote: listed.quote,
    assets: { FUND: byCode('FUND'), BOND: byCode('BOND'), EQTY: byCode('EQTY') },
    source: (me) => ({ options, asks, bids, me, nowSec: FIXED_SEC }),
    reference: (asset) => referenceFor(asset, 'mock', listed.quote.decimals),
  }
}
