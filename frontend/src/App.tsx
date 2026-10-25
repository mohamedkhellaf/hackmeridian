import { PresentationMode } from './demo/PresentationMode'
import { config } from './config'
import { BuyDialog } from './market/BuyDialog'
import { AppShell, WalletChip } from './layout/AppShell'
import { useHashRoute } from './layout/routes'
import { useStrata } from './state/useStrata'
import { Banner, NoticeToast } from './ui'
import { BalancesBar } from './wallet/BalancesBar'
import { IssuerView } from './views/IssuerView'
import { MarketsView } from './views/MarketsView'
import { PortfolioView } from './views/PortfolioView'
import { ReservesView } from './views/ReservesView'
import { WriteView } from './views/WriteView'
import './App.css'

function App() {
  const s = useStrata()
  const [route] = useHashRoute()
  const { wallet, me } = s

  return (
    <>
      <PresentationMode />
      <AppShell
        route={route}
        portfolioBadge={s.actionsWaiting}
        mock={s.isMock}
        contractId={config.optionsContractId}
        balances={
          me && s.assets ? (
            <BalancesBar
              tokens={s.balanceTokens.map((t) => ({ contractId: t.contractId, code: t.code, decimals: t.decimals }))}
              balances={s.balances.balances}
              loading={s.balances.loading}
              onRefresh={() => void s.refreshBalances()}
            />
          ) : null
        }
        wallet={<WalletChip address={me} onConnect={() => void wallet.connect()} onDisconnect={wallet.disconnect} />}
      >
        {wallet.wrongNetwork && <Banner tone="danger">Freighter is not on Testnet. Switch network in the extension.</Banner>}
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
        {route === 'write' && <WriteView assets={s.assets} client={s.client} me={me} busy={s.busy} onSubmit={s.writeOffer} />}
        {route === 'portfolio' && <PortfolioView me={me} rows={s.positions} actionFor={s.actionFor} />}
        {route === 'reserves' && <ReservesView collateral={s.collateral} health={s.health} contractId={config.optionsContractId} />}
        {route === 'issuer' && <IssuerView address={wallet.address} sign={wallet.sign} optionsContractId={config.optionsContractId} />}
      </AppShell>

      {s.buying && me && <BuyDialog offer={s.buying} client={s.client} me={me} onCancel={() => s.setBuying(null)} onConfirm={s.confirmBuy} />}

      <NoticeToast notice={s.notice} onDismiss={s.dismissNotice} />
    </>
  )
}

export default App
