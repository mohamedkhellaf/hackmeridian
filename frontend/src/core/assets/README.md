# core/assets

The app's reference asset list, tiers, asset URLs and the similar-code flag (brief D20). Plain data and pure
functions: no network access, no Stellar SDK. Import from `core/assets` (the index).

Anyone can list an asset in the contract. The list decides what this app shows first; it gives nobody power over
the contract, and an asset outside it still opens by URL and can be traded. Identity is the asset contract id.
A code is a label, never a key.

## The list (`referenceList.ts`)

| Export | What it does |
|---|---|
| `REFERENCE_ASSETS`, `referenceAssets(network)` | The entries per network, in list order: mock `FUND`, `BOND`, `EQTY`; Testnet `RWA`, `BOND`, `EQTY` (ids from AGENTS.md "Deployed contracts"). |
| `QUOTE_ASSETS` | The quote token (USDx) of each network. |
| `defaultReferenceAsset(network)` | The first entry: the asset a network opens on. |
| `findReferenceAsset(contractId)`, `isReferenceAsset(contractId)` | Lookup by contract id. |
| `findReferenceBySlug(network, slug)` | Lookup by URL slug. |
| `ASSET_TYPE_LABEL` | `Fund share`, `Bond`, `Equity`. |
| `MOCK_ISSUER`, `MOCK_QUOTE_ISSUER` | Placeholder issuers of the mock assets (not real keys). |
| Types | `AssetNetwork` (`mock` or `testnet`), `AssetType`, `ReferenceAsset`, `QuoteAsset`. |

`core/config` holds no asset ids, so the ids are literals here; `assets.test.ts` derives every Testnet contract
id from its code and issuer with the SDK to prove the table is consistent.

## Identity and URLs (`identity.ts`)

| Export | What it does |
|---|---|
| `assetKey(asset)` | The key in state, queries and lists: the contract id. |
| `tierOf(asset, { domainLinked? })` | `Reference`, `Domain-linked` or `No domain link`. Only `Reference` can be computed today. |
| `ASSET_TIERS`, `TIER_MEANING` | The tier words and their legend. |
| `parseAssetParam(param, network = 'testnet')` | Parses `$asset`: a slug (`bond`), `CODE-ISSUER` or `C...`. Checksums are enforced on Testnet; null for anything else. |
| `resolveAssetParam(raw, network, listed)` | `found` (contract id, canonical segment, whether the URL should be replaced), `unknown` (well formed, not known) or `invalid`. |
| `assetParam(asset)`, `assetPath(asset)` | The canonical segment and `/markets/<segment>`: slug for a reference asset, else `CODE-ISSUER`, else the contract id. |
| Types | `AssetTier`, `ListedAsset`, `AssetParam`, `AssetResolution`. |

## Similar codes (`similarCode.ts`)

| Export | What it does |
|---|---|
| `similarCodeFlag(asset, network)` | `{ reference, level }` when a non-reference asset's code resembles a reference code or the quote token; null otherwise. |
| `codeResemblance(code, referenceCode)` | `same` (equal confusable skeletons), `near` (one edit or a short affix) or null. |
| `skeleton(code)` | The confusable skeleton (`B0ND` to `bond`). |
| Types | `CodeResemblance`, `SimilarCodeFlag`. |

## StrKey (`strkey.ts`)

| Export | What it does |
|---|---|
| `isAccountId(text)`, `isContractId(text)` | Shape and CRC16 checksum of `G...` and `C...` ids, without the SDK. |
