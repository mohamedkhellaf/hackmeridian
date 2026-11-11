/**
 * The states of the shell that a mock build with the test wallet never reaches: the connect dialog (the test
 * wallet connects at once), the wrong-network and late-read banners, the network indicator while reads are late
 * or failing, and the footer with contract ids. Each piece is rendered from plain props through its `*View` export.
 */
import { useState } from 'react'
import type { NetworkState, NetworkStatus } from '../../../data'
import { Button, LiveRegions, ToastRegion, TooltipProvider } from '../../../ui'
import type { DialogState, WalletInfo } from '../../../wallet'
import { BannersView } from '../Banners'
import { ConnectDialogView } from '../ConnectDialog'
import { FooterView } from '../Footer'
import { NetworkIndicatorView } from '../NetworkIndicator'
import styles from './specimens.module.css'

const KIND = 'Browser extension or web wallet'
const WALLETS: WalletInfo[] = [
  { id: 'freighter', name: 'Freighter', availability: 'installed', url: 'https://www.freighter.app', kind: KIND },
  { id: 'xbull', name: 'xBull', availability: 'web', url: 'https://xbull.app', kind: KIND },
  { id: 'albedo', name: 'Albedo', availability: 'web', url: 'https://albedo.link', kind: KIND },
  { id: 'lobstr', name: 'LOBSTR', availability: 'missing', url: 'https://lobstr.co', kind: KIND },
  { id: 'rabet', name: 'Rabet', availability: 'missing', url: 'https://rabet.io', kind: KIND },
]

type Stage = 'list' | 'loading' | 'waiting' | 'error' | 'empty' | 'failed' | 'touch'
const STAGES: readonly Stage[] = ['list', 'loading', 'waiting', 'error', 'empty', 'failed', 'touch']
const STAGE_LABEL: Record<Stage, string> = {
  list: 'Wallet list',
  loading: 'Looking for wallets',
  waiting: 'Waiting for a wallet',
  error: 'Rejected request',
  empty: 'No wallets',
  failed: 'List not loaded',
  touch: 'On a touch screen',
}

function dialogFor(stage: Stage | null, close: () => void, pick: (id: string) => void): DialogState {
  return {
    open: stage !== null,
    loading: stage === 'loading',
    wallets: stage === 'empty' || stage === 'loading' || stage === 'failed' ? [] : WALLETS,
    busyId: stage === 'waiting' ? 'freighter' : null,
    error: stage === 'error' ? 'You rejected the request in Freighter.' : stage === 'failed' ? 'The wallet list could not be loaded. The network could not be reached.' : null,
    pick,
    close,
  }
}

const LEDGER = 58_331_204
const CLOSE_TIME = 1_794_571_471

function statusFor(state: NetworkState): NetworkStatus {
  const none = state === 'mock' || state === 'connecting' || state === 'down'
  return { state, label: state, ledger: none ? null : LEDGER, closeTime: none ? null : CLOSE_TIME, readAt: none ? null : CLOSE_TIME * 1000 }
}

const NETWORK_STATES: readonly NetworkState[] = ['ok', 'delayed', 'down', 'connecting', 'mock']

export function ShellStates() {
  const [stage, setStage] = useState<Stage | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [retried, setRetried] = useState(0)
  return (
    <TooltipProvider>
      <main className={styles.page}>
        <h1 className={styles.title}>Shell states</h1>
        <p className={styles.lead}>States of the app shell that the mock build with the test wallet does not reach. Dev only.</p>

        <section className={styles.section} aria-labelledby="network">
          <h2 id="network">Network indicator</h2>
          <div className={styles.row} data-testid="network">
            {NETWORK_STATES.map((state) => (
              <NetworkIndicatorView key={state} status={statusFor(state)} />
            ))}
          </div>
          <h3>Below 1200 px</h3>
          <div className={styles.row} data-testid="network-compact">
            {NETWORK_STATES.map((state) => (
              <NetworkIndicatorView key={state} status={statusFor(state)} compact />
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="connect">
          <h2 id="connect">Connect dialog</h2>
          <div className={styles.row}>
            {STAGES.map((s) => (
              <Button key={s} onClick={() => setStage(s)}>
                {STAGE_LABEL[s]}
              </Button>
            ))}
          </div>
          <p className={styles.lead} data-testid="picked">
            {picked ? `Picked: ${picked}` : 'Nothing picked yet.'}
          </p>
          <p className={styles.lead} data-testid="retried">
            {`Retried: ${retried}`}
          </p>
          <ConnectDialogView
            touch={stage === 'touch'}
            onRetry={() => setRetried((n) => n + 1)}
            dialog={dialogFor(
              stage,
              () => setStage(null),
              (id) => {
                setPicked(id)
                setStage('waiting')
              },
            )}
          />
        </section>

        <section className={styles.section} aria-labelledby="banners">
          <h2 id="banners">Banners</h2>
          <div className={styles.banners} data-testid="banners">
            <BannersView lateRead={null} wrongNetwork walletName="Freighter" onCheck={() => {}} onDisconnect={() => {}} />
          </div>
          <div className={styles.banners} data-testid="banner-delayed">
            <BannersView lateRead="delayed" wrongNetwork={false} walletName={null} onCheck={() => {}} onDisconnect={() => {}} />
          </div>
          <div className={styles.banners} data-testid="banner-down">
            <BannersView lateRead="down" wrongNetwork={false} walletName={null} onCheck={() => {}} onDisconnect={() => {}} />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="footer">
          <h2 id="footer">Footer with contract ids</h2>
          <div className={styles.frame} data-testid="footer-contracts">
            <FooterView mock={false} coveredId="CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6" marginId="CBZNS63L23N3Y3GHU6H57AU6OVZ3FOAPM7Z54ATDRC472Q5DWV6UVKCN" />
          </div>
        </section>
      </main>
      <ToastRegion />
      <LiveRegions />
    </TooltipProvider>
  )
}
