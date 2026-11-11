import { explorerLedger } from '../../core/explorer'
import { formatUtc, groupDigits } from '../../core/format'
import { useNetworkStatus } from '../../data'
import type { NetworkStatus } from '../../data'
import { Link, Popover } from '../../ui'
import { NETWORK_MEANING, NETWORK_WORD } from './copy'
import styles from './NetworkChip.module.css'

/** The name of the network the wallet must be on. It appears here, as a state indicator, and nowhere else in the chrome. */
const NETWORK_NAME = 'Testnet'

const ledgerText = (sequence: number): string => groupDigits(String(sequence))

export interface NetworkSummaryProps {
  status: NetworkStatus
}

/**
 * The facts behind the chip: which network, the latest ledger with its close time, the state of the reads, and
 * one sentence on what that state means for the figures on screen. A mock build has no network and no ledger:
 * the sentence is all there is to say.
 */
export function NetworkSummary({ status }: NetworkSummaryProps) {
  const { state, ledger, closeTime } = status
  return (
    <div className={styles.summary}>
      {state === 'mock' ? null : (
        <dl className={styles.facts}>
          <div>
            <dt>Network</dt>
            <dd>Stellar {NETWORK_NAME}</dd>
          </div>
          <div>
            <dt>Latest ledger</dt>
            <dd>
              {ledger === null ? (
                'Not read yet'
              ) : (
                <Link href={explorerLedger(ledger)} external className={styles.ledgerLink}>
                  {ledgerText(ledger)}
                </Link>
              )}
              {closeTime !== null ? <span className={styles.closed}>Closed {formatUtc(closeTime)}</span> : null}
            </dd>
          </div>
          <div>
            <dt>RPC</dt>
            <dd>
              <span className={styles.state} data-state={state}>
                <span className={styles.dot} data-state={state} aria-hidden="true" />
                {NETWORK_WORD[state]}
              </span>
            </dd>
          </div>
        </dl>
      )}
      <p className={styles.meaning}>{NETWORK_MEANING[state]}</p>
    </div>
  )
}

export interface NetworkChipViewProps {
  status: NetworkStatus
  /**
   * Below 1200 px: the ledger number moves into the popover, and the word for the reads shows only when a read is
   * late or failing. The dot still tells "a ledger was read" (filled) from "none yet" (hollow).
   */
  compact?: boolean
}

/**
 * The chip itself, from plain props (the specimens render every state with it). It is a button that opens the
 * facts behind it, and its name carries the whole reading: "Network: Testnet, ledger 58,331,204, RPC ok".
 * In a build without a contract it reads "Mock data" and nothing else.
 */
export function NetworkChipView({ status, compact = false }: NetworkChipViewProps) {
  const { state, ledger } = status
  const mock = state === 'mock'
  const showLedger = ledger !== null && !compact
  const showWord = !compact || state === 'delayed' || state === 'down'
  return (
    <Popover
      title={mock ? NETWORK_WORD.mock : 'Network'}
      align="end"
      className={styles.popover}
      trigger={
        <button type="button" className={styles.chip} data-state={state} data-compact={compact || undefined}>
          <span className={styles.dot} data-state={state} aria-hidden="true" />
          {mock ? (
            <span className={styles.network}>
              <span className="ui-vh">Data source: </span>
              {NETWORK_WORD.mock}
            </span>
          ) : (
            <>
              <span className={styles.network}>
                <span className="ui-vh">Network: </span>
                {NETWORK_NAME}
              </span>
              {ledger !== null ? (
                <span className={showLedger ? styles.ledger : 'ui-vh'}>
                  <span aria-hidden="true">L </span>
                  <span className="ui-vh">, ledger </span>
                  {ledgerText(ledger)}
                </span>
              ) : null}
              <span className={showWord ? styles.word : 'ui-vh'} data-state={state}>
                <span className="ui-vh">, </span>
                {NETWORK_WORD[state]}
              </span>
            </>
          )}
        </button>
      }
    >
      <NetworkSummary status={status} />
    </Popover>
  )
}

/**
 * The network chip of the top bar: "Testnet", the latest ledger and a word for the state of the RPC, or
 * "Mock data" in a build without a contract.
 */
export function NetworkChip({ compact }: { compact?: boolean }) {
  return <NetworkChipView status={useNetworkStatus()} compact={compact} />
}
