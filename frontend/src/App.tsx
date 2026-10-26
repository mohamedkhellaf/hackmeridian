import { PresentationMode } from './demo/PresentationMode'
import { config } from './config'
import { BuyDialog } from './market/BuyDialog'
import { AppShell, WalletChip } from './layout/AppShell'
import { useHashRoute } from './layout/routes'
import { useReadAt } from './reserves/useReadAt'
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
  const { ledger } = useReadAt(s.collateral, s.health, !s.isMock)
  const backing = !s.isMock && s.health.length > 0 ? { ok: s.health.every((h) => h.held >= h.reserved), ledger } : null

  // Real mode only: in mock mode the demo banner already says the data is fictional.
  const menuBalances =
    !s.isMock && me && s.assets ? (
      <BalancesBar
        variant="list"
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
        mock={s.isMock}
        contractId={config.optionsContractId}
        backing={backing}
        balances={
          !s.isMock && me && s.assets ? (
            <BalancesBar
              tokens={s.balanceTokens.map((t) => ({ contractId: t.contractId, code: t.code, decimals: t.decimals }))}
              balances={s.balances.balances}
              loading={s.balances.loading}
              onRefresh={() => void s.refreshBalances()}
            />
          ) : null
        }
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
        {wallet.wrongNetwork && <Banner tone="danger">{wallet.networkMessage ?? 'Your wallet is not on Testnet. Switch network in the wallet.'}</Banner>}
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
        {route === 'portfolio' && <PortfolioView me={me} rows={s.positions} actionFor={s.actionFor} health={s.health} />}
        {route === 'reserves' && <ReservesView collateral={s.collateral} health={s.health} contractId={config.optionsContractId} />}
        {route === 'issuer' && <IssuerView address={wallet.address} sign={wallet.sign} optionsContractId={config.optionsContractId} />}
      </AppShell>

      {s.buying && me && <BuyDialog offer={s.buying} client={s.client} me={me} health={s.health} onCancel={() => s.setBuying(null)} onConfirm={s.confirmBuy} onOutcomeShown={s.dismissNotice} />}

      <NoticeToast notice={s.notice} onDismiss={s.dismissNotice} />
    </>
  )
}

export default App
