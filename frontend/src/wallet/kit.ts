import type { ModuleInterface } from '@jsr/creit-tech__stellar-wallets-kit/types'
import { config } from '../config'

// Lazy loader for Stellar Wallets Kit v2 (JSR: @creit-tech/stellar-wallets-kit, installed from the
// JSR npm mirror as @jsr/creit-tech__stellar-wallets-kit). Imported dynamically so the e2e mock path
// and first paint never pull the kit in. Testnet only.
type Kit = typeof import('@jsr/creit-tech__stellar-wallets-kit').StellarWalletsKit
let loading: Promise<Kit> | null = null

export function loadKit(): Promise<Kit> {
  const p = (loading ??= (async () => {
    const [{ StellarWalletsKit, Networks }, ...mods] = await Promise.all([
      import('@jsr/creit-tech__stellar-wallets-kit'),
      import('@jsr/creit-tech__stellar-wallets-kit/modules/freighter'),
      import('@jsr/creit-tech__stellar-wallets-kit/modules/xbull'),
      import('@jsr/creit-tech__stellar-wallets-kit/modules/lobstr'),
      import('@jsr/creit-tech__stellar-wallets-kit/modules/albedo'),
      import('@jsr/creit-tech__stellar-wallets-kit/modules/rabet'),
      import('@jsr/creit-tech__stellar-wallets-kit/modules/hana'),
      import('@jsr/creit-tech__stellar-wallets-kit/modules/onekey'),
      import('@jsr/creit-tech__stellar-wallets-kit/modules/bitget'),
    ])
    const [freighter, xbull, lobstr, albedo, rabet, hana, onekey, bitget] = mods
    if (config.networkPassphrase !== Networks.TESTNET) throw new Error('Strata supports Testnet only')
    // Explicit list instead of defaultModules(): that helper also pulls in the MetaMask module, whose
    // dependency (@metamask/connect-stellar) imports the v1 npm package and breaks the Vite build.
    // Ledger/Trezor are deliberately not added.
    const modules: ModuleInterface[] = [
      new freighter.FreighterModule(),
      new xbull.xBullModule(),
      new lobstr.LobstrModule(),
      new albedo.AlbedoModule(),
      new rabet.RabetModule(),
      new hana.HanaModule(),
      new onekey.OneKeyModule(),
      new bitget.BitgetModule(),
    ]
    const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined
    if (projectId) {
      const { WalletConnectModule, WalletConnectTargetChain } = await import(
        '@jsr/creit-tech__stellar-wallets-kit/modules/wallet-connect'
      )
      modules.push(
        new WalletConnectModule({
          projectId,
          allowedChains: [WalletConnectTargetChain.TESTNET],
          metadata: {
            name: 'Strata',
            description: 'Tokenised options on Stellar Testnet',
            url: window.location.origin,
            icons: [`${window.location.origin}/favicon.svg`],
          },
        }),
      )
    }
    StellarWalletsKit.init({ modules, network: Networks.TESTNET })
    return StellarWalletsKit
  })())
  // Allow a retry if a chunk failed to load.
  p.catch(() => {
    loading = null
  })
  return p
}
