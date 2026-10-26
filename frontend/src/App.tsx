import { lazy, Suspense } from 'react'
import { PresentationMode } from './demo/PresentationMode'
import { config } from './config'
import { BuyDialog } from './market/BuyDialog'
import { AppShell, WalletChip } from './layout/AppShell'
import { useHashRoute } from './layout/routes'
import { useNetworkStatus } from './layout/useNetworkStatus'
import { useStrata } from './state/useStrata'
import { Banner, NoticeToast } from './ui'
import { BalancesBar } from './wallet/BalancesBar'
import { IssuerView } from './views/IssuerView'
import { MarketsView } from './views/MarketsView'
import { PortfolioView } from './views/PortfolioView'
import { ProtectView } from './views/ProtectView'
import { ReservesView } from './views/ReservesView'
import { WriteView } from './views/WriteView'
import './App.css'

// Strata Pro (experimental): a lazy chunk that exists only when the build sets VITE_ENABLE_PRO=1.
const ProApp = import.meta.env.VITE_ENABLE_PRO === '1' ? lazy(() => import('./pro/ProApp')) : null

function App() {
  const s = useStrata()
  const [route] = useHashRoute()
  const { wallet, me } = s
  const network = useNetworkStatus(!s.isMock)

  // Real mode only: mock tokens have no on-chain balance.
  const menuBalances =
    !s.isMock && me && s.assets ? (
      <BalancesBar
        tokens={s.balanceTokens.map((t) => ({ contractId: t.contractId, code: t.code, decimals: t.decimals }))}
        balances={s.balances.balances}
        loading={s.balances.loading}
      />
    ) : null

  return (
    <>
      <PresentationMode />
      <AppShell
        route={route}
        portfolioBadge={s.actionsWaiting}
        contractId={s.isMock ? undefined : config.optionsContractId}
        network={s.isMock ? null : network}
        wallet={
          <WalletChip
            address={me}
            walletName={wallet.walletName}
            onConnect={() => void wallet.connect()}
            onDisconnect={wallet.disconnect}
            balances={menuBalances}
            onRefresh={menuBalances ? () => void s.refreshBalances() : undefined}
          />
        }
      >
        {wallet.wrongNetwork && <Banner tone="danger">{wallet.networkMessage ?? 'Wallet is not on Testnet. Switch network in the wallet.'}</Banner>}
        {wallet.error && <Banner tone="danger">{wallet.error}</Banner>}

        {route === 'markets' && (
          <MarketsView
            offers={s.market}
            me={me}
            busy={s.busy}
            busyId={s.busyId}
            onBuy={s.setBuying}
            collateral={s.collateral}
            health={s.health}
            mock={s.isMock}
          />
        )}
        {route === 'protect' && (
          <ProtectView assets={s.assets} offers={s.market} me={me} balances={s.balances.balances} mock={s.isMock} busy={s.busy} onBuy={s.setBuying} />
        )}
        {route === 'write' && <WriteView assets={s.assets} client={s.client} me={me} busy={s.busy} onSubmit={s.writeOffer} />}
        {route === 'portfolio' && <PortfolioView me={me} rows={s.positions} actionFor={s.actionFor} health={s.health} />}
        {route === 'reserves' && <ReservesView collateral={s.collateral} health={s.health} contractId={config.optionsContractId} />}
        {route === 'pro' && ProApp && (
          <Suspense fallback={null}>
            <ProApp />
          </Suspense>
        )}
        {route === 'issuer' && (
          <IssuerView address={wallet.address} sign={wallet.sign} optionsContractId={config.optionsContractId} tokens={s.assets?.underlyings} mock={s.isMock} />
        )}
      </AppShell>

      {s.buying && me && <BuyDialog offer={s.buying} client={s.client} me={me} health={s.health} onCancel={() => s.setBuying(null)} onConfirm={s.confirmBuy} onOutcomeShown={s.dismissNotice} />}

      <NoticeToast notice={s.notice} onDismiss={s.dismissNotice} />
    </>
  )
}

export default App
