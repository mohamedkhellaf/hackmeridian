import { lazy, Suspense } from 'react'
import { PresentationMode } from './demo/PresentationMode'
import { config } from './config'
import { BuyDialog } from './market/BuyDialog'
import { AppShell, WalletChip } from './layout/AppShell'
import { useHashRoute } from './layout/routes'
import type { Route } from './layout/routes'
import { useNetworkStatus } from './layout/useNetworkStatus'
import { useStrata } from './state/useStrata'
import { Banner, NoticeToast, TableSkeleton, ViewSkeleton } from './ui'
import { BalancesBar } from './wallet/BalancesBar'
import { IssuerView } from './views/IssuerView'
import { MarketsView } from './views/MarketsView'
import { PortfolioView } from './views/PortfolioView'
import { SellPanel } from './resale/SellPanel'
import { MyRequests } from './requests/MyRequests'
import { ReservesView } from './views/ReservesView'
import './App.css'

// StellSec Pro (experimental): a lazy chunk that exists only when the build sets VITE_ENABLE_PRO=1.
const ProApp = import.meta.env.VITE_ENABLE_PRO === '1' ? lazy(() => import('./pro/ProApp')) : null

const ROUTE_TITLES: Partial<Record<Route, string>> = { markets: 'Markets', portfolio: 'Positions', reserves: 'Collateral', issuer: 'Issuer' }

/** One skeleton per view, shaped like its real content, until the first data round completes. */
function LoadingView({ route, error, onRetry }: { route: Route; error: string | null; onRetry: () => void }) {
  const title = ROUTE_TITLES[route]!
  const body =
    route === 'markets' ? (
      <div className="mk-layout">
        <div className="mk-main">
          <TableSkeleton columns={3} rows={7} />
          <TableSkeleton columns={7} rows={3} />
        </div>
        <div className="tk-col" />
      </div>
    ) : (
      <TableSkeleton columns={route === 'portfolio' ? 9 : route === 'issuer' ? 4 : 6} rows={5} />
    )
  return (
    <ViewSkeleton title={title} error={error} onRetry={onRetry}>
      {body}
    </ViewSkeleton>
  )
}

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

        {!s.ready && ROUTE_TITLES[route] && <LoadingView route={route} error={s.status === 'error' ? s.loadError : null} onRetry={() => void s.retry()} />}
        {s.ready && route === 'markets' && (
          <MarketsView
            offers={s.market}
            me={me}
            busy={s.busy}
            busyId={s.busyId}
            onBuy={s.setBuying}
            onConnect={() => void wallet.connect()}
            collateral={s.collateral}
            health={s.health}
            mock={s.isMock}
            options={s.options}
            asks={s.asks}
            bids={s.bids}
            assets={s.assets}
            client={s.client}
            actionFor={s.actionFor}
            bidBusyId={s.bidBusyId}
            onCreateBid={s.createBid}
            onFillBid={s.fillBid}
            onCancelBid={s.cancelBid}
            onBuyResale={s.buyResale}
            onWriteOffer={s.writeOffer}
            onOutcomeShown={s.dismissNotice}
          />
        )}
        {s.ready && route === 'portfolio' && (
          <PortfolioView
            me={me}
            rows={s.positions}
            actionFor={s.actionFor}
            health={s.health}
            resale={
              <>
                <MyRequests me={me} bids={s.bids} busy={s.busy} busyId={s.busyId} bidBusyId={s.bidBusyId} onCancel={s.cancelBid} />
                <SellPanel
                  me={me}
                  rows={s.positions}
                  asks={s.asks}
                  busy={s.busy}
                  busyId={s.busyId}
                  onList={s.listForSale}
                  onCancel={s.cancelSale}
                />
              </>
            }
          />
        )}
        {s.ready && route === 'reserves' && <ReservesView collateral={s.collateral} health={s.health} contractId={config.optionsContractId} />}
        {route === 'pro' && ProApp && (
          <Suspense fallback={null}>
            <ProApp />
          </Suspense>
        )}
        {s.ready && route === 'issuer' && (
          <IssuerView address={wallet.address} sign={wallet.sign} optionsContractId={config.optionsContractId} tokens={s.assets?.underlyings} mock={s.isMock} />
        )}
      </AppShell>

      {s.buying && me && <BuyDialog offer={s.buying} client={s.client} me={me} health={s.health} onCancel={() => s.setBuying(null)} onConfirm={s.confirmBuy} onOutcomeShown={s.dismissNotice} />}

      <NoticeToast notice={s.notice} onDismiss={s.dismissNotice} />
    </>
  )
}

export default App
