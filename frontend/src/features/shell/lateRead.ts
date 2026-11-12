// When a late ledger read deserves a banner. Pure, unit-tested in lateRead.test.ts; the hook is in Banners.tsx.
//
// The indicator in the top bar changes its words in place the moment a read is late; that costs nothing. A
// banner pushes the page down, so it waits: a laptop that wakes from sleep, or a tab the browser throttled, is
// "late" for the moment between waking and the next read, and a banner then would flash on every return.
import type { NetworkState } from '../../data'

/**
 * Which banner to show, if any. `down` (no ledger could be read at all) shows at once. `delayed` shows only once
 * it has outlasted one more poll while the page was visible (`outlasted`; the hook in Banners.tsx times it).
 */
export function lateReadBanner(state: NetworkState, outlasted: boolean): 'delayed' | 'down' | null {
  if (state === 'down') return 'down'
  if (state === 'delayed' && outlasted) return 'delayed'
  return null
}
