import { useEffect, useRef } from 'react'
import { guideAnchor } from '../../core/guide'
import { Button, announce, shortenAddress } from '../../ui'
import { useWallet } from '../../wallet'
import type { Tier } from './useTier'
import { WalletMenu } from './WalletMenu'
import styles from './WalletMenu.module.css'

/** Long enough for the connect dialog or the wallet menu to close and hand focus back. */
const FOCUS_SETTLE_MS = 320

/**
 * The wallet control of the top bar. A guest gets "Connect wallet", the one primary action of the chrome. Below
 * 900 px the button reads "Connect"; the word "wallet" stays in its name for screen readers and speech input.
 * A connected wallet shows its short address, which opens the wallet menu.
 *
 * Connecting and disconnecting each replace one button with the other. When that takes the focused button
 * away, focus is put on its replacement, so a keyboard user is never left on nothing.
 */
export function WalletButton({ tier }: { tier: Tier }) {
  const wallet = useWallet()
  const phone = tier === 'phone'
  const address = wallet.address
  const control = useRef<HTMLButtonElement>(null)
  const previous = useRef(address)
  const askedHere = useRef(false)

  useEffect(() => {
    const was = previous.current
    previous.current = address
    if ((was === null) === (address === null)) return
    if (address !== null) announce(`Wallet connected: ${shortenAddress(address, 'short')}.`)
    // After a connect started elsewhere (a ticket's own button), focus stays where that flow left it.
    const mayTakeFocus = address === null || askedHere.current
    askedHere.current = false
    if (!mayTakeFocus) return
    const restore = () => {
      const active = document.activeElement
      if (active === null || active === document.body) control.current?.focus({ preventScroll: true })
    }
    const frame = requestAnimationFrame(restore)
    const timer = window.setTimeout(restore, FOCUS_SETTLE_MS)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [address])

  if (!address) {
    return (
      <Button
        ref={control}
        variant="primary"
        size={phone ? 'sm' : 'md'}
        className={styles.button}
        {...guideAnchor('wallet')}
        onClick={() => {
          askedHere.current = true
          void wallet.connect()
        }}
      >
        Connect<span className={styles.walletWord}> wallet</span>
      </Button>
    )
  }

  return (
    <WalletMenu
      address={address}
      walletName={wallet.walletName}
      tier={tier}
      triggerRef={control}
      onDisconnect={() => {
        wallet.disconnect()
        announce('Wallet disconnected.')
      }}
    />
  )
}
