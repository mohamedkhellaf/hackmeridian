# Strata

Fully collateralized, physically settled options on tokenized Stellar assets. Soroban contract plus a React app.

HackMeridian 2026, Lisbon · Genesis path · Stellar Unlocked track · Testnet only, fictional assets, unaudited.

| | |
|---|---|
| App | https://hackmeridian-psi.vercel.app |
| Contract (options v1.4) | [`CC6AI7AKKEVSXH3QQF7HBXZNIBS4ACFP2UQLXG3WOAZ5VDFCTXVFPWNK`](https://stellar.expert/explorer/testnet/contract/CC6AI7AKKEVSXH3QQF7HBXZNIBS4ACFP2UQLXG3WOAZ5VDFCTXVFPWNK) |
| Spec · ABI · evidence | [PRODUCT_SPEC.md](PRODUCT_SPEC.md) · [docs/contract-abi.md](docs/contract-abi.md) · [docs/contract-testnet-evidence.md](docs/contract-testnet-evidence.md) |
| Demo video · deck | added at submission |

## Problem

Tokenized funds, bonds and equities exist on Stellar. Many are regulated: the issuer decides who may hold them and can freeze or claw back. None of them has a way to hedge. A holder who expects a drawdown can only sell. Options elsewhere settle in cash via an oracle, run on margin, or ignore issuer rules, which disqualifies them for regulated assets.

## What Strata does

A market maker writes a put or a call on an eligible asset and locks the full collateral in the contract: the total strike for a put, the total underlying for a call. An investor buys it, paying the premium to the writer. The holder may exercise any time before expiry; the contract swaps tokens for payment in one transaction. If any leg fails, nothing moves.

- Eligibility is the asset's own `AUTH_REQUIRED` trustline authorization, read from the Stellar Asset Contract. The issuer keeps every power; the contract checks them, it does not replace them.
- Anyone can list a classic asset by `(code, issuer)`. The contract derives the canonical SAC. The issuer still decides who may hold it, including the escrow.
- A holder can list an active option for resale at a price they set. An eligible buyer pays that price to the holder and becomes the holder in one transaction. Strike, expiry, quantity and the writer's collateral do not change.
- No admin, no oracle, no margin, no upgrade path.

This works for any Stellar asset whose issuer permits it, not for every token. Freeze and clawback remain the issuer's powers and can block settlement (see [Limits](#limits)).

Demo assets: `RWA`, `BOND`, `EQTY` (auth required, revocable, clawback enabled) and the quote token `USDx`. All fictional, all Testnet.

## Stellar Unlocked

| Protocol feature | Use |
|---|---|
| Asset flags `AUTH_REQUIRED`, `AUTH_REVOCABLE`, `AUTH_CLAWBACK_ENABLED` | Regulated-asset rules come from the ledger. The issuer authorizes holders and the escrow with `set_trust_line_flags`. |
| Stellar Asset Contract | One Soroban contract serves every classic asset. It moves tokens through the SAC and reads `authorized(address)` for eligibility. Listing an asset is deriving its SAC address. |
| Soroban cross-contract calls | Exercise is one invocation with `require_auth` and checked `i128` math. Issuer actions during exercise fail the whole transaction; balances stay unchanged. |

Measured fees on Testnet: exercise 0.008 XLM ([tx](https://stellar.expert/explorer/testnet/tx/f2ad8d0e70ba15e5b487bd41b9d888a27fc8ba0d5551debe1fd4581560a210a5)), write 0.031, buy 0.003, claim 0.001.

## Evidence

Every transaction we claim is listed in [docs/contract-testnet-evidence.md](docs/contract-testnet-evidence.md). Highlights:

| Claim | Testnet tx |
|---|---|
| v1.4 deployed; `contracts/options` on `main` builds byte-identical to the on-chain wasm (`437de9d5…4e57`) | [`da27e9fd…`](https://stellar.expert/explorer/testnet/tx/da27e9fd2afebaefc7385ce813406cebff3b7fa469f4a0fb2926c06743237fb8) |
| Asset listed at runtime (EQTY), escrow authorized by its issuer, then a put created, bought, exercised and claimed | [`89147386…`](https://stellar.expert/explorer/testnet/tx/891473865d9330d7881b9208e02388166afe8e7cf13344853180ae5547de0512), [`26158344…`](https://stellar.expert/explorer/testnet/tx/261583446ee575fd29dc2b1a9b43eb08da0701fff78996f74e025a19c5714147) |
| Issuer claws back collateral from the escrow; RWA offers refused while the token is short, BOND unaffected; issuer repays | [`f45330be…`](https://stellar.expert/explorer/testnet/tx/f45330bed06985a957993ab49a8e81d1a276dc7e8444498fa5a57eaf5b5dcbeb), [`c6ef0692…`](https://stellar.expert/explorer/testnet/tx/c6ef06926cb5d47366ac16a89da0e9b87151c61e85aafe80a62ca4feae66432a) |
| Third party prunes an expired unsold offer, collateral returns to the writer | [`da477e8c…`](https://stellar.expert/explorer/testnet/tx/da477e8cc5d490bdfb8f88f90c65e3ae0121073668a9ce53908a31fc7622ac7d) |
| Holder transfers an active option | [`c4a60668…`](https://stellar.expert/explorer/testnet/tx/c4a60668b296e7c643d9aca1cee7e54d1b3e864de2604caef9a880ccd73c0c67) |
| Holder lists an option for resale, another eligible account buys it; holder changes, collateral untouched | [`a5c5a3d2…`](https://stellar.expert/explorer/testnet/tx/a5c5a3d2d80e510bfcebe9f9781b82bdc3313121feffaf30fa642d8556e69949) |

Tests: 133 unit, 17 property-based invariants (collateral conservation, no double use, per-token reserves), 76 negative (replay, double exercise, unauthorized cancel, withdrawn collateral, caps, tenor). Frontend: Vitest unit tests and a Playwright suite with a test-only wallet. All run in CI.

### Deployed (Testnet)

| | ID |
|---|---|
| options v1.4 | `CC6AI7AKKEVSXH3QQF7HBXZNIBS4ACFP2UQLXG3WOAZ5VDFCTXVFPWNK` |
| RWA SAC | `CCVYWYG56YL7VA7A3EKVJKAKZC4O2B6YXV6UJMERG2NYC7HJHELJLR7U` |
| BOND SAC | `CADCBCQ7TU5XCGPYDD32HANAVEWWDARGKIKXWF5YK7NTFOLAWGQYQGHP` |
| EQTY SAC (listed with `list_asset`) | `CDBHRGVHB2NVKJCM5ZKBTUQ3RQHZUZJSSEZLATIUROWXNIEFZ7T7NIFU` |
| USDx SAC | `CAKXMQVKSW2AEKF5DSMDPHJAYGNVOQANHXLI64QJS2H3GOCXRW2GCICU` |

Earlier versions v1 to v1.3.1: [AGENTS.md](AGENTS.md#deployed-contracts-testnet-only).

## Try it

Without a wallet: Markets, Reserves and option history in the [app](https://hackmeridian-psi.vercel.app) read from the chain.

With a wallet: Freighter on Testnet, funded by Friendbot. The underlyings require issuer authorization, so open an issue with your Testnet `G…` address and we run `scripts/setup-testnet/onboard-account.sh`: trustlines, authorization on the three assets, `USDx` and underlying balances. With `USDx` alone you can buy and exercise a call.

Locally:

```sh
rustup target add wasm32v1-none
stellar contract build --package options --meta source_repo=github:mohamedkhellaf/hackmeridian
sha256sum target/wasm32v1-none/release/options.wasm      # 437de9d56a05…
cargo test -p options

cd frontend && npm install && cp .env.example .env         # VITE_OPTIONS_CONTRACT_ID=CC6AI7AKKEVSXH3QQF7HBXZNIBS4ACFP2UQLXG3WOAZ5VDFCTXVFPWNK
npm run dev                                                 # npm test · npm run e2e · npm run build
```

Full Testnet reproduction: `scripts/setup-testnet/` (issuers, flags, trustlines) then `scripts/deploy/` (deploy, `smoke-testnet.sh` for the put and call lifecycle, `issuer-demo-testnet.sh` for freeze, revoke and clawback, `extend-ttl.sh`, `seed-demo-offers.sh`).

## App

Markets: every series, competing makers, best price, and resale asks with Buy. Protect: pick what you hold, see the puts that cover it. Write: maker form with the collateral to be locked and the remaining open-offer allowance. Portfolio: exercise, claim, reclaim, cancel, transfer, sell and cancel sale, with countdowns. Reserves: owed vs held per token, read at a ledger. Issuer: authorize, freeze, claw back on accounts or on the escrow, as real `SetTrustLineFlags` and `Clawback` operations. Amounts are exact integer units; floating point appears only in the hypothetical payoff chart.

## Contract

```mermaid
stateDiagram-v2
  [*] --> Offered: create_offer (collateral locked)
  Offered --> Active: buy (premium to writer)
  Offered --> Cancelled: cancel_offer
  Offered --> Expired: reclaim / prune_expired (anyone)
  Active --> Active: transfer (eligible holder)
  Active --> Active: buy_resale (ask paid to holder)
  Active --> Exercised: exercise (atomic)
  Active --> Expired: reclaim after expiry
  Exercised --> Settled: claim_delivery
```

| Function | Signer | Effect |
|---|---|---|
| `create_offer(writer, kind, underlying, quote, qty, strike_total, premium_total, expiry)` | writer | Locks collateral, opens the offer. Rejects ineligible writers, unlisted assets, full books, writers at the cap, bad amounts, tenor over 2 years, or a token the contract holds less of than it owes. |
| `buy(buyer, id)` | buyer | Premium to writer; buyer becomes holder. Rejects the writer, ineligible buyers, expired offers. |
| `exercise(holder, id)` | holder | Put: underlying in, strike out. Call: strike in, underlying out. One invocation. |
| `claim_delivery(writer, id)` | writer | Collects what the holder delivered. |
| `cancel_offer` · `reclaim` | writer | Collateral back before sale, or after expiry. |
| `prune_expired(pruner, ids)` | anyone | Returns expired unsold collateral to writers, frees the book. |
| `transfer(holder, to, id)` | holder | Hands an active option to an eligible address. |
| `list_for_sale(holder, id, ask_total)` · `cancel_sale(holder, id)` | holder | Sets or removes a resale ask, in the quote token. One ask per option. |
| `buy_resale(buyer, id, max_total)` | buyer | Pays `ask_total` to the holder; buyer becomes holder. Buyer must be eligible and not the holder or the writer. The option itself is unchanged. |
| `list_asset(lister, code, issuer)` | anyone | Adds the canonical SAC of a classic asset to the registry. |
| `extend_ttl(ids)` | anyone | Bumps storage rent. |
| `get_option`, `get_options`, `get_ask`, `list_asks`, `list_open`, `list_open_for`, `open_collateral`, `is_eligible`, `list_assets`, `writer_open_count`, `config`, … | read | What the app shows. |

Limits: 500 open offers per asset, 50 per writer, expiry within 2 years. Errors 101–121, decoded in the app: `NotFound` 101, `InvalidArgs` 102, `AssetNotAllowed` 103, `NotEligible` 104, `ContractNotAuthorized` 105, `WrongState` 106, `NotWriter` 107, `NotHolder` 108, `Expired` 109, `NotExpired` 110, `SelfTrade` 111, `Overflow` 112, `InvalidConfig` 113, `OpenListFull` 114, `CollateralShortfall` 115, `WriterOpenLimit` 116, `AlreadyListed` 117, `AssetNotDeployed` 118, `TenorOutOfRange` 119, `NoAsk` 120, `PriceMoved` 121 (the ask rose above the cap the buyer passed). An ask is removed on exercise, transfer, expiry, cancel or purchase.

Decisions and their reasons are in [PRODUCT_SPEC.md](PRODUCT_SPEC.md): premium paid at purchase, never refunded (D1); no self-purchase (D2); 2-year tenor (D4); no impaired state, no refund after issuer action (D6); free transfer to eligible addresses only (D7); resale at a holder-set price, option unchanged (D8).

Stack: Rust, soroban-sdk 28, proptest · Stellar CLI 28.1 · TypeScript, React 19, Vite, stellar-sdk, Stellar Wallets Kit, Stellar RPC and Horizon · Vitest, Playwright · GitHub Actions · Vercel.

## Limits

- Issuer action is not insured. A freeze, de-authorization of the escrow or clawback after a sale can make an option unexercisable. The premium is not refunded.
- After a clawback the escrow is short. It holds one balance per token, so remaining payouts are first come, first served. While a token is short, new offers, purchases and transfers on it fail with `CollateralShortfall`; other tokens continue. Reserves shows the shortfall.
- Quotes are indicative until an on-chain funded offer is confirmed. The demo makers are our own Testnet accounts. There is no order book depth and no pricing model.
- Resale prices are set by holders: one ask per option, no matching, no writer buy-back.
- Soroban storage expires; `extend_ttl` is public and a keeper script runs it.
- Testnet, fictional assets, unaudited.

## Built at the event

Started from an empty scaffold at 11:00 on 25 October. Idea chosen on site after a committee process and a Testnet spike ([WINNING_IDEAS.md](WINNING_IDEAS.md), [research/decision/](research/decision/)). Five contract iterations deployed and recorded: v1 (puts, calls, two assets), v1.1 (hardening), v1.2 (transfer, paged reads, invariant and negative suites), v1.3 / v1.3.1 (listing, per-asset books, writer cap, tenor, prune), v1.4 (resale). Six app screens on the live contract, issuer scenarios recorded on chain, spec, locked ABI, payoff package. 61 commits, 30 merged PRs. AI coding agents did much of the typing in bounded lanes; humans owned financial semantics, contract safety and UX, and every merged claim is backed by a test or a transaction ([AGENTS.md](AGENTS.md)).

## Next

- Position tokens. Resale exists on-chain; a token would make options tradable on the Stellar DEX and usable as collateral elsewhere.
- Strata Pro: cash-settled calls with partial margin. Specified in `docs/pro-*.md`, modelled in `packages/risk/`, implemented in `contracts/pro/` (replays all 691 fixture steps, passes its negative suite), previewed on fixtures behind a build flag. Not deployed: it needs an oracle and a liquidation design we would not put on chain unreviewed. It shares nothing with the options contract.
- Issuer onboarding for real tokenized assets. The contract already respects their rules; the rest is legal and operational.
- An RFQ layer for makers; the on-chain funded offer stays the only executable quote.

## Team

Three people: product and quant (spec, payoff, risk model), contract and Testnet (`contracts/`, `scripts/`), frontend and wallets (`frontend/`).
