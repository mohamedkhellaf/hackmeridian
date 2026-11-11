# features/issuer

The Issuer console (`/issuer`, brief 4.8). The router lazy-loads the named export `IssuerPage` from `index.tsx`.
The page reads no params and no search. It is reached from "More" on a phone and from the footer.

The issuer of a listed asset decides who can hold it: authorize, freeze, claw back. Each of those changes what an
option on the asset can do, which is why the console lives in this app.

## The four states of who is looking

| State | What the page shows |
|---|---|
| **No Testnet contract in the build** (mock data) | `Issuer actions need a Testnet contract.` (exact), why, and what the console does on Testnet: the three actions with what the issuer signs and what each means for options, what is read, who can sign. No console, no button, no field: nothing on the page can be dead. |
| **Guest** | The asset's public facts (flags, trustline counts) and the options contract's row, read only, with `Connect the asset issuer's account in your wallet.` and "Connect wallet". |
| **A wallet that is not the issuer** | The same read-only view, and whose account is needed: the issuer's address and the connected one. |
| **The issuer** | The accounts (the options contract first, named as the escrow; then addresses typed in; then every account Horizon lists with a trustline, first 50), the three actions, the staged transaction and the log. |

## Files

| File | Role |
|---|---|
| `index.tsx` | `IssuerPage`: the mock page or the live console. |
| `useIssuerConsole.ts` | **The hook**: reads, actions, log. Everything below it is presentational. |
| `model.ts` | Pure logic, tested in Node: access, the holder states, the rows, which actions a row offers and why not, the clawback amount and confirmation phrase, the effect on reserves, exposure counts, labels, the log, Horizon result codes. |
| `net.ts` | `IssuerNet`: the reads (Horizon over `fetch`, the asset contract for a contract row) and `send`. The hook takes one as an argument, so it can be driven by a fake. |
| `actions.ts` | `sendIssuerAction`: builds, signs and sends with stages. **Imports the Stellar SDK**: loaded on the first action through `import('./actions')`. |
| `copy.ts` | Every string. |
| `MockIssuer` | The page without a Testnet contract. |
| `IssuerConsoleView` | The layout, and which confirmation is open. |
| `AccessNotice`, `AssetCard`, `AccountsSection`, `RowActionButtons`, `ActionLog` | The parts of the console. |
| `FreezeDialog`, `ClawbackDialog` | The two confirmations. |
| `TxPanel`, `TxProgress` | The staged transaction, on the page and inside a confirmation. |

## Reads

| Fact | Source |
|---|---|
| Listed assets | `useAssets()` (the underlyings; the quote token is not offered) |
| Issuer of an asset | `TokenInfo.issuer`; when the client could not read it, the connected account is tested against the asset contract id (`sacContractId`) |
| Flags, home domain, signer state | Horizon `/accounts/<issuer>`, `parseIssuerAccount` |
| Trustline counts | Horizon `/assets`, `parseAssetsResponse` |
| Accounts with a trustline | Horizon `/accounts?asset=CODE:ISSUER&limit=50`, issuer only |
| One account | Horizon `/accounts/<id>`: the six holder states of `core/assetfacts`, the exact balance, and whether clawback applies to that trustline (`is_clawback_enabled`) |
| One contract | The asset contract: `authorized(id)` and `balance(id)` |
| What the options contract owes and holds | `useHealth()` |
| Open options per account and for the contract | `useOptions()`, counted in `model.ts` |

All of them are queries under the key prefix `['issuer']` and are read again after every action, whatever its
outcome, and by "Read again". A failed read of one row is a row in the `Unknown` state with the reason; its
actions stay available, so a failed read never locks the issuer out.

## Actions

Classic accounts go through Horizon (`SetTrustLineFlags`, `Clawback`), contracts through the asset contract
(`set_authorized`, `clawback`), with the builders of `core/issuer/issuerTx`. They run through the app's one
transaction machine (`useTx`), so they have the same stages as a trade (check, sign, submit, confirm), the same
three ways to stop (nothing sent, outcome unknown, fee charged) and an entry in the Activity list. "Recent
actions" is that list filtered to `issuer-*` actions: it survives a reload and is not the asset's history on chain.

- **Authorize** runs at once: it takes nothing away.
- **Freeze** asks first, saying what freezing blocks, settlement of options included, with how many open options
  the account or the contract has. Focus starts on Cancel.
- **Claw back** asks for the amount, then for the amount again with the asset code and the last four characters
  of the account (`25 BOND ZUVN`). For the options contract it shows reserved, held now, held after and the
  shortfall after, and the shortfall sentence of `core/disclosures`. A press outside does not close it.
- A row offers only what its state calls for; what is offered and cannot run is disabled with its reason
  (the flag that is off, a trustline clawback does not apply to, a zero balance, a transaction in flight).
- One transaction at a time: a ref in the hook stops a double click before any state update, and `useTx`
  refuses a second run while one is in flight or unknown. While an outcome is unknown the only action is
  "Check again".
- A declined or refused attempt sent nothing, so the confirmation stays open and can be sent again as typed.

## Tests

- `model.test.ts`, `actions.test.ts`: Node. The sender is tested with fake network functions and real
  transactions signed by throwaway keys.
- `actions.live.test.ts`: the same sender and the reads against Stellar Testnet with throwaway accounts.
  Skipped unless `ISSUER_LIVE=1` (`ISSUER_LIVE=1 npx vitest run src/features/issuer/actions.live.test.ts`).
- `e2e/issuer.spec.ts`: the mock page. The suite runs on mock data, where the console is not shown.
- To look at the console by hand without the issuer's key: a dev server with `VITE_OPTIONS_CONTRACT_ID` set and
  `VITE_E2E=1`, then `/issuer?as=<issuer address>` and "Connect wallet". Every read is real; the test wallet
  signs nothing, so an action ends with the network refusing the signature.
