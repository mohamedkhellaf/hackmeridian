import { Button, Callout } from '../../ui'
import { useWallet } from '../../wallet'
import { WRONG_NETWORK_FALLBACK, WRONG_NETWORK_FIX, WRONG_NETWORK_TITLE } from './copy'
import styles from './WalletBanners.module.css'

export interface WalletBannersViewProps {
  wrongNetwork: boolean
  networkMessage: string | null
  error: string | null
  onDisconnect: () => void
}

/** The wallet banners from plain props (the specimens stage them). Renders nothing when there is nothing to say. */
export function WalletBannersView({ wrongNetwork, networkMessage, error, onDisconnect }: WalletBannersViewProps) {
  if (!wrongNetwork && !error) return null
  return (
    <div className={styles.banners}>
      {wrongNetwork ? (
        <Callout
          variant="warning"
          title={WRONG_NETWORK_TITLE}
          alert
          actions={
            <Button size="sm" onClick={onDisconnect}>
              Disconnect
            </Button>
          }
        >
          <p>{networkMessage ?? WRONG_NETWORK_FALLBACK}</p>
          <p>{WRONG_NETWORK_FIX}</p>
        </Callout>
      ) : null}
      {error ? (
        <Callout variant="danger" title="Wallet" alert>
          {error}
        </Callout>
      ) : null}
    </div>
  )
}

/**
 * Above every page: the wrong-network banner with the fix (the wallet reports a network other than Testnet),
 * and a wallet error when the wallet layer has one.
 */
export function WalletBanners() {
  const wallet = useWallet()
  return <WalletBannersView wrongNetwork={wallet.wrongNetwork} networkMessage={wallet.networkMessage} error={wallet.error} onDisconnect={wallet.disconnect} />
}
