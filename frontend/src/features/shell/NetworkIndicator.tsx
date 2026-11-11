import { groupDigits } from '../../core/format'
import { useNetworkStatus } from '../../data'
import type { NetworkStatus } from '../../data'
import { MOCK_DATA, NETWORK_LATE, NETWORK_NAME, ledgerReading } from './copy'
import styles from './NetworkIndicator.module.css'

export interface NetworkIndicatorViewProps {
  status: NetworkStatus
  /** Below 1200 px: the network name alone, or the short warning words while reads are late. */
  compact?: boolean
}

/**
 * The network as plain text in the top bar, the one place the chrome names it: "Testnet, ledger 58,331,204".
 * When reads are late the ledger number gives way to words ("Testnet, reads are late"); a build without a
 * contract reads "Mock data". No box, no dot and nothing to press: the words are the state.
 */
export function NetworkIndicatorView({ status, compact = false }: NetworkIndicatorViewProps) {
  const { state, ledger } = status
  const late = state === 'delayed' || state === 'down' ? NETWORK_LATE[state] : null
  let text: string
  if (state === 'mock') text = MOCK_DATA
  else if (late) text = compact ? late.short : late.full
  else if (ledger !== null && !compact) text = ledgerReading(groupDigits(String(ledger)))
  else text = NETWORK_NAME
  return (
    <p className={styles.indicator} data-late={late ? '' : undefined}>
      {text}
    </p>
  )
}

/** The indicator, on the data layer's network status. */
export function NetworkIndicator({ compact }: { compact?: boolean }) {
  return <NetworkIndicatorView status={useNetworkStatus()} compact={compact} />
}
