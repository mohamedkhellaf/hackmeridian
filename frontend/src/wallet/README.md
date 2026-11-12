# src/wallet

Wallet logic and context. No UI and no CSS here: the connect dialog and the wallet menu are presentational and
belong to `features/shell`. This folder may import React and `src/core`.

| Module | Exports |
|---|---|
| `index.ts` | Everything below that a caller needs: `WalletProvider`, `useWallet`, `useWalletDialog`, `WalletState`, `DialogState`, `E2E_ADDRESSES`, `splitWallets`, `initials`, `wrongNetworkMessage`, `WALLET_STORAGE_KEY`, `WalletInfo`, `WalletAvailability`. |
| `WalletProvider.tsx` | `WalletProvider`: the kit wallet, or the test wallet when the build sets `VITE_E2E=1` (compile-time fold). Provides both contexts. |
| `useWallet.ts` | `useWallet(): WalletState` (`address`, `walletName`, `wrongNetwork`, `networkMessage`, `recheckNetwork()`, `connect()`, `disconnect()`, `sign(xdr)`, `signAuthEntry(xdr)`), `useWalletDialog(): DialogState`. |
| `walletContext.ts` | `WalletState`, `DialogState` (`open`, `loading`, `wallets`, `busyId`, `error`, `pick(id)`, `close()`), `CLOSED_DIALOG`, the two contexts. |
| `useKitWallet.ts` | Stellar Wallets Kit state: lazy kit, silent restore of the last wallet, network check on connect and on window focus (`recheckNetwork`), which also reads the account again for Freighter (the wallet that answers without a prompt): an account switched in the extension replaces the old one. |
| `kit.ts` | `loadKit()`: dynamic import of the kit and its modules (Freighter, xBull, LOBSTR, Albedo, Rabet, HANA, OneKey, Bitget; WalletConnect only with `VITE_WALLETCONNECT_PROJECT_ID`). Set to the Stellar test network. |
| `useE2eWallet.ts` | The test wallet: connects at once as `E2E_ADDRESSES.a`, or as the address in `?as=G...` (read at connect time). Signs nothing. |
| `helpers.ts` | Pure helpers: `toWalletInfos`, `splitWallets`, `walletAvailability`, `probeWallets`, `initials`, `walletErrorKind`, `describeWalletError`, `wrongNetworkMessage`, `isWrongNetwork`, `readStoredWalletId`, `writeStoredWalletId`, `WALLET_STORAGE_KEY`. |

## For the shell

```tsx
const wallet = useWallet()          // wallet.connect() opens the picker (or connects at once under the test wallet)
const dialog = useWalletDialog()    // render the connect dialog from this: dialog.open, dialog.wallets, dialog.pick(id)
```

- `connect()` only opens the picker; the shell renders it. `splitWallets(dialog.wallets)` gives `installed` and
  `more`; a wallet with `availability: 'missing'` is a link to `url` ("Install"), not a button.
- The dialog must show the sentence `WALLET_DISCLOSURE` from `core/disclosures`.
- `wallet.wrongNetwork` with `wallet.networkMessage` is the wrong-network banner; `wallet.recheckNetwork()` is its "Check again".
- A refusal reads "You declined to sign in Freighter." when signing and "You declined the connection in Freighter." when
  connecting (`describeWalletError(e, name, action)`).
- A client needs `{ address, sign, signAuthEntry }`: pass `wallet` itself to `createOptionsClient`.
- The storage key `strata.wallet` predates the product name and is kept on purpose: returning users are
  reconnected from it.
