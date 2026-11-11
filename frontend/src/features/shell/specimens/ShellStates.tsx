/**
 * The states of the shell that a mock build with the test wallet never reaches: the connect dialog (the test
 * wallet connects at once), the wrong-network banner, the network chip while the RPC is late or down, and the
 * footer with contract ids. Each piece is rendered from plain props through its `*View` export.
 */
import { useState } from 'react'
import type { NetworkState, NetworkStatus } from '../../../data'
import { Button, LiveRegions, ToastRegion, TooltipProvider } from '../../../ui'
import type { DialogState, WalletInfo } from '../../../wallet'
import { ConnectDialogView } from '../ConnectDialog'
import { NETWORK_WORD } from '../copy'
import { FooterView } from '../Footer'
import { NetworkChipView } from '../NetworkChip'
import { WalletBannersView } from '../WalletBanners'
import styles from './specimens.module.css'

const WALLETS: WalletInfo[] = [
  { id: 'freighter', name: 'Freighter', availability: 'installed', url: 'https://www.freighter.app', kind: 'Browser extension or web wallet' },
  { id: 'xbull', name: 'xBull', availability: 'web', url: 'https://xbull.app', kind: 'Browser extension or web wallet' },
  { id: 'albedo', name: 'Albedo', availability: 'web', url: 'https://albedo.link', kind: 'Browser extension or web wallet' },
  { id: 'lobstr', name: 'LOBSTR', availability: 'missing', url: 'https://lobstr.co', kind: 'Browser extension or web wallet' },
  { id: 'rabet', name: 'Rabet', availability: 'missing', url: 'https://rabet.io', kind: 'Browser extension or web wallet' },
]

type Stage = 'list' | 'loading' | 'waiting' | 'error' | 'empty'
const STAGES: readonly Stage[] = ['list', 'loading', 'waiting', 'error', 'empty']
const STAGE_LABEL: Record<Stage, string> = { list: 'Wallet list', loading: 'Looking for wallets', waiting: 'Waiting for a wallet', error: 'Rejected request', empty: 'No wallets' }

function dialogFor(stage: Stage | null, close: () => void, pick: (id: string) => void): DialogState {
  return {
    open: stage !== null,
    loading: stage === 'loading',
    wallets: stage === 'empty' || stage === 'loading' ? [] : WALLETS,
    busyId: stage === 'waiting' ? 'freighter' : null,
    error: stage === 'error' ? 'You rejected the request in Freighter.' : null,
    pick,
    close,
  }
}

const LEDGER = 58_331_204
const CLOSE_TIME = 1_794_571_471

function statusFor(state: NetworkState): NetworkStatus {
  const none = state === 'mock' || state === 'connecting' || state === 'down'
  return { state, label: NETWORK_WORD[state], ledger: none ? null : LEDGER, closeTime: none ? null : CLOSE_TIME, readAt: none ? null : CLOSE_TIME * 1000 }
}

const CHIP_STATES: readonly NetworkState[] = ['ok', 'delayed', 'down', 'connecting', 'mock']

export function ShellStates() {
  const [stage, setStage] = useState<Stage | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <TooltipProvider>
      <main className={styles.page}>
        <h1 className={styles.title}>Shell states</h1>
        <p className={styles.lead}>States of the app shell that the mock build with the test wallet does not reach. Dev only.</p>

        <section className={styles.section} aria-labelledby="chip">
          <h2 id="chip">Network chip</h2>
          <div className={styles.row} data-testid="chips">
            {CHIP_STATES.map((state) => (
              <NetworkChipView key={state} status={statusFor(state)} />
            ))}
          </div>
          <h3>From 768 to 1199 px</h3>
          <div className={styles.row} data-testid="chips-compact">
            {CHIP_STATES.map((state) => (
              <NetworkChipView key={state} status={statusFor(state)} compact />
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
          <ConnectDialogView
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
          <h2 id="banners">Wallet banners</h2>
          <div className={styles.banners} data-testid="banners">
            <WalletBannersView wrongNetwork networkMessage="Freighter is not on Testnet. Switch the network in the wallet." error={null} onDisconnect={() => {}} />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="footer">
          <h2 id="footer">Footer with contract ids</h2>
          <div className={styles.frame} data-testid="footer-contracts">
            <FooterView coveredId="CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6" marginId="CBZNS63L23N3Y3GHU6H57AU6OVZ3FOAPM7Z54ATDRC472Q5DWV6UVKCN" />
          </div>
        </section>
      </main>
      <ToastRegion />
      <LiveRegions />
    </TooltipProvider>
  )
}
