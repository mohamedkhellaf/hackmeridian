import { useLocation } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useActionsWaiting } from '../../data'
import { SkipLink } from '../../ui'
import { ConnectDialog } from './ConnectDialog'
import { Footer } from './Footer'
import { MoreSheet } from './MoreSheet'
import { TabBar } from './TabBar'
import { TopBar } from './TopBar'
import { useTier } from './useTier'
import { WalletBanners } from './WalletBanners'
import styles from './AppShell.module.css'

/**
 * The frame around every app route: the skip link, the top bar, the wallet banners, the page inside `main`, the
 * footer with its disclosures, and on phones the tab bar with its More sheet. The connect dialog is rendered here
 * from the wallet layer's state. The landing page renders without it.
 *
 * Order in the document, which is the tab order: skip link, logo, sections, tools and wallet, page, footer.
 * On phones the tab bar comes right after the top bar, so navigation is reached before the page, as on desktop.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const tier = useTier()
  const pathname = useLocation({ select: (location) => location.pathname })
  const actionsWaiting = useActionsWaiting()
  const phone = tier === 'phone'
  // The More sheet belongs to the phone tab bar and to the page it was opened on: the path it was opened at is
  // what is stored, so following one of its links, or going back, closes it without an effect.
  const [moreAt, setMoreAt] = useState<string | null>(null)
  const moreOpen = phone && moreAt === pathname
  const setMoreOpen = (open: boolean) => setMoreAt(open ? pathname : null)

  return (
    <div className={styles.shell} data-tier={tier}>
      <SkipLink href="#main" />
      <TopBar tier={tier} pathname={pathname} actionsWaiting={actionsWaiting} />
      {phone ? <TabBar pathname={pathname} actionsWaiting={actionsWaiting} moreOpen={moreOpen} onOpenMore={() => setMoreOpen(true)} /> : null}
      <WalletBanners />
      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>
      <Footer />
      {phone ? <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} /> : null}
      <ConnectDialog />
    </div>
  )
}
