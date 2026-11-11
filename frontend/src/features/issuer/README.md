# features/issuer

The Issuer console (`/issuer`, brief 4.8). The router lazy-loads the named export `IssuerPage` from `index.tsx`.
The page reads no params and no search yet (`?asset=` is requested from the router). It is reached from "More" on a
phone and from the footer.

The issuer of a listed asset decides who can hold it: authorize, freeze, claw back. Each of those changes what an
option on the asset can do, which is why the console lives in this app.

## The states of who is looking

Everyone reads the same three blocks: the Covered contract as a statement (held, reserved for open options, open
options and, on Testnet, its authorization; a danger callout when the issuer has not authorized it, the state that
stops every option on the asset), **What the issuer can do** (the flags as the same table, in the same words, as
the asset's About tab) and the asset's facts in the rail. One quiet line under the title says who is looking.

| State | What the page shows |
|---|---|
| **Mock data** (no Testnet contract in the build) | Ruling R24's sentence in place of the description (`On mock data there is no asset contract to read and no transaction to sign.`), then the read-only blocks drawn from the mock data: the demo flags of each asset (`mockAssetFacts`), what the mock contract holds and reserves (`useHealth`), the open options (`useOptions`). No action, no field, no wallet prompt. |
| **Guest** | `Read only. Actions on BOND are signed by its issuer:` and the issuer's address, with "Connect wallet". |
| **A wallet that is not the issuer** | The same line. When it issues another listed asset: `You issue EQTY.` and "Open EQTY". When the issuer is not known and the check of the connected account failed: `Could not check who issues BOND.` and "Read again". |
| **The issuer** | Also the contract's two actions, the accounts (addresses typed in, then every account Horizon lists with a trustline, first 50, those that need a decision first), the actions, the transaction under the row it acts on, and the log once something was signed. |

## Files

| File | Role |
|---|---|
| `index.tsx` | `IssuerPage`: the hook and the view. |
| `useIssuerConsole.ts` | **The hook**: reads, actions, log. Everything below it is presentational. |
| `model.ts` | Pure logic, tested in Node: access, the asset on screen, the holder states, the rows and their order, which actions a row offers, the clawback amount and confirmation phrase, the effect on reserves, exposure counts, labels, the log, the unresolved action, Horizon result codes. |
| `net.ts` | `IssuerNet`: the reads (Horizon over `fetch`, the asset contract for a contract row) and `send`. The hook takes one as an argument, so it can be driven by a fake. |
| `actions.ts` | `sendIssuerAction`: builds, signs and sends with stages. **Imports the Stellar SDK**: loaded on the first action through `import('./actions')`. |
| `copy.ts` | Every string. |
| `IssuerConsoleView` | The layout, and which confirmation is open. |
| `AccessLine`, `ContractStatement`, `AccountsSection`, `RowActionButtons`, `ActionLog`, `IssuerPowers`, `AssetCard` | The parts of the page. |
| `ConfirmDialog` (freeze, and an authorization that cannot be undone), `ClawbackDialog` | The confirmations. |
| `TxPanel`, `TxProgress` | The staged transaction, under its row and inside a confirmation. |

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
| What the Covered contract owes and holds | `useHealth()` |
| Open options per account and for the contract | `useOptions()`, counted in `model.ts` |

On mock data only the listed assets, `useHealth()` and `useOptions()` are read (from the mock client), and the flags
come from `mockAssetFacts`; nothing goes to Horizon or the RPC.

All of the Testnet reads are queries under the key prefix `['issuer']` and are read again after every action, whatever its
outcome, and by "Read again". A failed read of one row is a row in the `Unknown` state with the reason; its
actions stay available, so a failed read never locks the issuer out.

## Actions

Classic accounts go through Horizon (`SetTrustLineFlags`, `Clawback`), contracts through the asset contract
(`set_authorized`, `clawback`), with the builders of `core/issuer/issuerTx`. They run through the app's one
transaction machine (`useTx`), so they have the same stages as a trade (check, sign, submit, confirm), the same
three ways to stop (nothing sent, outcome unknown, fee charged) and an entry in the Activity list. "Recent
actions" is that list filtered to `issuer-*` actions on the asset: it survives a reload and is not the asset's
history on chain.

- A row has at most two controls: the action its state calls for (Authorize, or Freeze) as the button, and a menu
  with the rest; Claw back is always in the menu. A row offers nothing until its first read lands.
- What the issuer's flags rule out for the whole asset is not offered in any row; one sentence above the accounts
  says so (`Freeze is not available: Authorization revocable is off.`).
- **Authorize** runs at once: it takes nothing away. When the issuer cannot revoke it cannot be undone, and it asks
  first, saying so.
- **Freeze** asks first, saying what freezing blocks, settlement of options included, with what the account or the
  contract has open. Focus starts on Cancel.
- **Claw back** asks for the amount, then for the amount again with the asset code and the last four characters
  of the address (`25 BOND ZUVN`). For the Covered contract it shows reserved, held now, held after and short
  after, and says once what that means: how much is not reserved before an amount is typed, that the contract
  still holds what it owes, or (when it would be short) the shortfall with the sentence of `core/disclosures`.
- Once a transaction starts, the confirmation shows what is signed and its progress in place of the form. It can
  be closed at any time ("Hide"): the page shows the same progress under the row the action acts on. A declined or
  refused attempt sent nothing, so the form comes back as typed. A confirmed action is one line with its
  transaction until it is dismissed or the next action starts.
- One transaction at a time: a ref in the hook stops a double click before any state update, and `useTx`
  refuses a second run while one is in flight or unknown. An issuer action whose outcome is unknown, also one left
  from an earlier visit (read from the persisted Activity list), keeps every action disabled until it is checked
  again; "Check again" is offered above the contract and in the log.

## Tests

- `model.test.ts`, `actions.test.ts`: Node. The sender is tested with fake network functions and real
  transactions signed by throwaway keys.
- `actions.live.test.ts`: the same sender and the reads against Stellar Testnet with throwaway accounts.
  Skipped unless `ISSUER_LIVE=1` (`ISSUER_LIVE=1 npx vitest run src/features/issuer/actions.live.test.ts`).
- `e2e/issuer.spec.ts`: the page on mock data (the suite runs on mock data, where nothing can be signed).
- To look at the console by hand without the issuer's key: a dev server with `VITE_OPTIONS_CONTRACT_ID` set and
  `VITE_E2E=1`, then `/issuer?as=<issuer address>` and "Connect wallet". Every read is real; the test wallet
  signs nothing, so an action ends with the network refusing the signature.
