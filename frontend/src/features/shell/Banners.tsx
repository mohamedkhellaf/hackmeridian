import { useEffect, useState } from 'react'
import { POLL_MS, useNetworkStatus } from '../../data'
import { Button, Callout } from '../../ui'
import { useWallet } from '../../wallet'
import { CHECK_AGAIN, LATE_READ_TEXT, LATE_READ_TITLE, WRONG_NETWORK_TITLE, wrongNetworkText } from './copy'
import { lateReadBanner } from './lateRead'
import styles from './Banners.module.css'

export interface BannersViewProps {
  /** A late or failed ledger read that has outlasted its grace period (see lateRead.ts), or null. */
  lateRead: 'delayed' | 'down' | null
  wrongNetwork: boolean
  /** The connected wallet's name, for the wrong-network sentence. */
  walletName: string | null
  /** Reads the wallet's network again (and, for Freighter, the account). */
  onCheck: () => void
  onDisconnect: () => void
}

/** The banners from plain props (the specimens stage them). Renders nothing when there is nothing to say. */
export function BannersView({ lateRead, wrongNetwork, walletName, onCheck, onDisconnect }: BannersViewProps) {
  if (!lateRead && !wrongNetwork) return null
  return (
    <div className={styles.banners}>
      {wrongNetwork ? (
        <Callout
          variant="warning"
          title={WRONG_NETWORK_TITLE}
          alert
          actions={
            <>
              <Button size="sm" onClick={onCheck}>
                {CHECK_AGAIN}
              </Button>
              <Button size="sm" variant="quiet" onClick={onDisconnect}>
                Disconnect
              </Button>
            </>
          }
        >
          {wrongNetworkText(walletName)}
        </Callout>
      ) : null}
      {lateRead ? (
        <Callout variant="warning" title={LATE_READ_TITLE} alert={lateRead === 'down'}>
          {LATE_READ_TEXT[lateRead]}
        </Callout>
      ) : null}
    </div>
  )
}

/**
 * True once the reads have stayed late for `graceMs` while the page was visible. Coming back to the tab starts the
 * count again: the refetch that follows usually answers within a second.
 */
function useOutlasted(delayed: boolean, graceMs: number): boolean {
  const [outlasted, setOutlasted] = useState(false)
  useEffect(() => {
    if (!delayed) return
    let timer = window.setTimeout(() => setOutlasted(true), graceMs)
    const restart = () => {
      if (document.visibilityState !== 'visible') return
      window.clearTimeout(timer)
      setOutlasted(false)
      timer = window.setTimeout(() => setOutlasted(true), graceMs)
    }
    document.addEventListener('visibilitychange', restart)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', restart)
      setOutlasted(false)
    }
  }, [delayed, graceMs])
  return delayed && outlasted
}

/**
 * Under the top bar: the wrong-network banner with the fix (the wallet reports a network other than Testnet),
 * and the late-read banner when the ledger reads stay late through one more poll or none could be made.
 */
export function Banners() {
  const wallet = useWallet()
  const { state } = useNetworkStatus()
  const lateRead = lateReadBanner(state, useOutlasted(state === 'delayed', POLL_MS.ledger))
  return <BannersView lateRead={lateRead} wrongNetwork={wallet.wrongNetwork} walletName={wallet.walletName} onCheck={() => void wallet.recheckNetwork()} onDisconnect={wallet.disconnect} />
}
