import { useEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import { IS_MOCK } from '../../core/config'
import { explorerAccount } from '../../core/explorer'
import { useActivity, useAssets, useBalances } from '../../data'
import {
  Button,
  IconActivity,
  IconCheck,
  IconCopy,
  IconDisconnect,
  IconRefresh,
  Menu,
  MenuGroup,
  MenuItem,
  MenuLinkItem,
  MenuSeparator,
  MenuStatic,
  Skeleton,
  announce,
  shortenAddress,
} from '../../ui'
import { RouteLink } from './RouteLink'
import type { Tier } from './useTier'
import { activityNote, balanceRows, balancesSentence, copyText } from './wallet'
import styles from './WalletMenu.module.css'

export interface WalletMenuProps {
  address: string
  walletName: string | null
  tier: Tier
  /** The button that opens the menu, so the shell can put focus on it after a connect. */
  triggerRef?: Ref<HTMLButtonElement>
  onDisconnect: () => void
}

/**
 * The wallet menu, opened from the short address in the top bar: the address with copy, the balances of the
 * contract's tokens with a refresh, the way to Activity, the account on the explorer (Testnet builds), and
 * disconnect. Balances are plain rows inside their group; the group's name carries them for screen readers.
 */
export function WalletMenu({ address, walletName, tier, triggerRef, onDisconnect }: WalletMenuProps) {
  const assets = useAssets()
  const balances = useBalances(address)
  const activity = useActivity(address)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const tokens = assets.data ? [assets.data.quote, ...assets.data.underlyings] : null
  const ready = tokens !== null && balances.data !== undefined
  const loading = !ready && (assets.isPending || balances.isPending)
  const rows = ready ? balanceRows(tokens, balances.data) : []
  const note = activityNote(activity.inFlight, activity.unknown)

  const copy = () => {
    void copyText(address).then((ok) => {
      if (!ok) {
        announce('Could not copy. Select the address and copy it by hand.', 'assertive')
        return
      }
      announce('Address copied.')
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    })
  }

  const refresh = () => {
    void Promise.all([assets.refetch(), balances.refetch()]).then(([a, b]) => {
      announce(a.isError || b.isError ? 'Balances could not be read.' : 'Balances refreshed.')
    })
  }

  const balancesLabel = (
    <>
      Balances
      <span className="ui-vh">{loading ? 'loading' : ready ? balancesSentence(rows) : 'could not be read'}</span>
    </>
  )

  return (
    <Menu
      align="end"
      size="tall"
      trigger={
        <Button ref={triggerRef} variant="secondary" size={tier === 'phone' ? 'sm' : 'md'} className={styles.button}>
          <span className="ui-vh">Wallet menu, </span>
          <span className={styles.address}>{shortenAddress(address, 'short')}</span>
        </Button>
      }
    >
      <MenuGroup label={walletName ?? 'Connected wallet'}>
        <MenuItem icon={copied ? <IconCheck /> : <IconCopy />} detail={<span className={styles.address}>{shortenAddress(address, 'medium')}</span>} keepOpen onSelect={copy}>
          {copied ? 'Address copied' : 'Copy address'}
        </MenuItem>
      </MenuGroup>
      <MenuSeparator />
      <MenuGroup label={balancesLabel}>
        {/* The same figures as the group's name: shown for the eye, hidden from the accessibility tree once. */}
        <MenuStatic className={styles.balances}>
          {loading ? (
            <Skeleton variant="rows" lines={4} />
          ) : ready ? (
            rows.map((row) => (
              <div key={row.token.contractId} className={styles.balance}>
                <span className={styles.code}>{row.token.code}</span>
                <span className={styles.value}>
                  {row.amount !== null ? <span className={styles.amount}>{row.amount}</span> : null}
                  {row.reason !== null ? <span className={styles.reason}>{row.reason}</span> : null}
                </span>
              </div>
            ))
          ) : (
            <p className={styles.problem}>Balances could not be read.</p>
          )}
        </MenuStatic>
        <MenuItem icon={<IconRefresh />} keepOpen onSelect={refresh} detail={balances.isFetching && ready ? 'Reading' : undefined}>
          Refresh balances
        </MenuItem>
      </MenuGroup>
      <MenuSeparator />
      <MenuLinkItem render={<RouteLink to="/activity" />} icon={<IconActivity />}>
        Activity
        {note ? <span className={styles.note}>{note}</span> : null}
      </MenuLinkItem>
      {IS_MOCK ? null : (
        <MenuLinkItem href={explorerAccount(address)} external>
          View account on the explorer
        </MenuLinkItem>
      )}
      <MenuSeparator />
      <MenuItem icon={<IconDisconnect />} onSelect={onDisconnect}>
        Disconnect
      </MenuItem>
    </Menu>
  )
}
