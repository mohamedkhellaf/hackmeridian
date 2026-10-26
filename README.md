# Strata

**Fully collateralized, physically settled options on tokenized Stellar assets.**

HackMeridian 2026 · Lisbon, 25–26 October · Genesis path · **Stellar Unlocked** track

| | |
|---|---|
| Live app (Testnet) | https://hackmeridian-psi.vercel.app |
| Contract (options v1.3.1) | [`CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE`](https://stellar.expert/explorer/testnet/contract/CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE) |
| Product spec | [PRODUCT_SPEC.md](PRODUCT_SPEC.md) |
| Contract ABI (locked) | [docs/contract-abi.md](docs/contract-abi.md) |
| Every Testnet transaction we claim | [docs/contract-testnet-evidence.md](docs/contract-testnet-evidence.md) |
| Demo script | [docs/demo-script.md](docs/demo-script.md) |

> Testnet only. Every asset is fictional. The code is unaudited. Nothing here is investment advice or a production offer.

---

## The problem

Stellar already carries tokenized funds, bonds and equity-style assets, many of them regulated: the issuer decides who may hold them, can freeze a holder and can claw tokens back. What these assets do not have is **risk management**. A holder who fears a drawdown has two choices today: sell, or hold and hope. There is no way to buy protection, and no way for a market maker to earn a premium for providing it.

Options exist on other chains, but either settle in cash through an oracle, run on margin that can fail, or ignore the issuer's rules entirely, which is a non-starter for a regulated asset.

## What Strata does

Strata is a Soroban contract that turns any **supported, eligible** Stellar asset into **American-style puts and calls** that are:

- **Fully collateralized before sale.** A put writer locks the total strike in the quote token. A call writer locks the total underlying. The contract holds it; nothing can be sold until the collateral is in.
- **Physically settled, atomically.** Exercise is one transaction: the holder delivers the underlying and receives the strike (put), or pays the strike and receives the underlying (call). If any leg fails, nothing moves.
- **Issuer-aware by construction.** Eligibility is the asset's own `AUTH_REQUIRED` authorization, read live from the Stellar Asset Contract. The issuer never gives up a power; the contract just respects it.
- **Permissionless to list.** Anyone can list a classic asset by `(code, issuer)`. The contract derives the canonical SAC and refuses anything else. The issuer still decides who may hold it, including whether the escrow may.
- **Without an admin, oracle, margin or upgrade path.** No one can change the rules, pause settlement or move collateral.

Two demo market makers publish competing funded offers on-chain. An investor who holds `RWA` buys the cheaper put, exercises when they want, and the writer claims the delivered tokens. The **Reserves** page reads what the contract owes and what it holds, straight from the chain, so anyone can verify the backing.

### Honest claim

Strata works for **any Stellar asset whose issuer permits it**, not for every token automatically. Real tokenized assets need their issuer's cooperation and legal permission. Freeze and clawback remain the issuer's powers and can block settlement; we disclose exactly what happens below.

---

## Why this is "Stellar Unlocked"

The track asks for projects that get something new out of Stellar's core protocol features. Strata is built on three of them, and would not work the same way anywhere else:

| Core feature | How Strata uses it |
|---|---|
| **Classic asset issuance with `AUTH_REQUIRED`, `AUTH_REVOCABLE`, `AUTH_CLAWBACK_ENABLED`** | Regulated-asset semantics come from the ledger, not from our code. The issuer authorizes holders and the escrow contract with ordinary `set_trust_line_flags`. |
| **Stellar Asset Contract bridge** | The Soroban contract moves classic assets through the SAC and reads `authorized(address)` to decide eligibility, so one contract serves fund, bond and equity tokens alike. Listing a new asset is deriving its SAC address on-chain. |
| **Soroban atomic cross-contract calls** | Delivery-versus-payment in a single invocation, with `require_auth`, checked `i128` math and no partial states. Issuer actions during the hackathon were recorded failing cleanly on chain, with balances unchanged. |

An exercise costs well under 0.01 XLM in fees. The frontend signs through the Stellar Wallets Kit (Freighter and others) and talks to Stellar RPC; the issuer console issues real `SetTrustLineFlags` and `Clawback` operations.

---

## Proof on Testnet

All transactions below are on Testnet and listed with context in [docs/contract-testnet-evidence.md](docs/contract-testnet-evidence.md).

| Claim | Transaction |
|---|---|
| v1.3.1 deployed; source on `main` builds **byte-identical** to the on-chain wasm (`acecb2f2…354b`) | [`21ac14af…c9ec`](https://stellar.expert/explorer/testnet/tx/21ac14af7a16be02e9e1e87922b47a78f3593ad4a96f564f43d81ce22a53c9ec) |
| Issuer authorizes the escrow for a newly listed asset (EQTY) | [`89147386…0512`](https://stellar.expert/explorer/testnet/tx/891473865d9330d7881b9208e02388166afe8e7cf13344853180ae5547de0512) |
| Put on the listed asset: create, buy, exercise, claim | [`26158344…4147`](https://stellar.expert/explorer/testnet/tx/261583446ee575fd29dc2b1a9b43eb08da0701fff78996f74e025a19c5714147) (first of four) |
| Third party prunes an expired unsold offer; collateral returns to the writer | [`da477e8c…ac7d`](https://stellar.expert/explorer/testnet/tx/da477e8cc5d490bdfb8f88f90c65e3ae0121073668a9ce53908a31fc7622ac7d) |
| Issuer claws back collateral from the escrow; the deficit is detected per token and new RWA offers are refused while BOND continues | [`f45330be…bdeb`](https://stellar.expert/explorer/testnet/tx/f45330bed06985a957993ab49a8e81d1a276dc7e8444498fa5a57eaf5b5dcbeb) → repaid [`c6ef0692…432a`](https://stellar.expert/explorer/testnet/tx/c6ef06926cb5d47366ac16a89da0e9b87151c61e85aafe80a62ca4feae66432a) |
| Holder transfers an active option to another eligible address | [`c4a60668…0c67`](https://stellar.expert/explorer/testnet/tx/c4a60668b296e7c643d9aca1cee7e54d1b3e864de2604caef9a880ccd73c0c67) |
| Expired offer reclaimed; `buy` after expiry rejected | [`28e91bf7…6e48`](https://stellar.expert/explorer/testnet/tx/28e91bf7bbfdb58013329e8d4c438cd63b031438df1aa2e7eecc4c45165e6e48) |
| Storage TTL extended through judging | [`c6d8302e…3982`](https://stellar.expert/explorer/testnet/tx/c6d8302e3e6bc3716f2e2fe2ca6dbca4f62aff76b1601dd4ee932b9c1e513982) |

**Tests:** 202 automated tests on the contract: 120 unit, 17 property-based invariants (collateral conservation, no double use, per-token reserves) and 65 negative security tests (replay, double exercise, unauthorized cancel, withdrawn collateral, caps and tenor). `cargo test -p options` runs them in about 90 seconds. The frontend has Vitest unit tests and a Playwright end-to-end suite with a test-only wallet; all run in CI.

### Deployed contracts (Testnet)

| Contract | ID |
|---|---|
| options v1.3.1 | `CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE` |
| RWA SAC (fictional fund-style token, regulated flags) | `CCVYWYG56YL7VA7A3EKVJKAKZC4O2B6YXV6UJMERG2NYC7HJHELJLR7U` |
| BOND SAC (fictional bond-style token, regulated flags) | `CADCBCQ7TU5XCGPYDD32HANAVEWWDARGKIKXWF5YK7NTFOLAWGQYQGHP` |
| EQTY SAC (fictional equity-style token, listed at runtime with `list_asset`) | `CDBHRGVHB2NVKJCM5ZKBTUQ3RQHZUZJSSEZLATIUROWXNIEFZ7T7NIFU` |
| USDx SAC (fictional quote token, no flags) | `CAKXMQVKSW2AEKF5DSMDPHJAYGNVOQANHXLI64QJS2H3GOCXRW2GCICU` |

Earlier versions v1 → v1.3 and their deploy transactions are in [AGENTS.md](AGENTS.md#deployed-contracts-testnet-only) and the evidence file.

---

## Try it

**Without a wallet:** open the [live app](https://hackmeridian-psi.vercel.app). Markets, Reserves and every option's history read straight from the chain.

**With a wallet (Testnet):** install [Freighter](https://www.freighter.app/), switch to Testnet, fund the account with Friendbot. Because `RWA`, `BOND` and `EQTY` are authorization-required assets, a new account must be authorized by the demo issuer before it can hold them. Open an issue on this repo with your Testnet `G…` address and we run `scripts/setup-testnet/onboard-account.sh` for you: it adds trustlines, authorizes the address on the three assets and funds it with `USDx` and underlying so you can write, buy, exercise and claim. `USDx` alone is enough to buy and exercise a call.

**Run everything locally:**

```sh
# contract: build, verify against chain, test
rustup target add wasm32v1-none
stellar contract build --package options --meta source_repo=github:mohamedkhellaf/hackmeridian
sha256sum target/wasm32v1-none/release/options.wasm      # acecb2f278e2…
cargo test -p options

# frontend
cd frontend && npm install
cp .env.example .env    # VITE_OPTIONS_CONTRACT_ID=CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE
npm run dev             # also: npm test · npm run e2e · npm run build
```

**Reproduce the whole Testnet setup** with `scripts/setup-testnet/` (issuers, flags, trustlines, authorizations) and `scripts/deploy/` (deploy, `smoke-testnet.sh` for the full put and call lifecycle with every tx hash, `issuer-demo-testnet.sh` for freeze, revoke and clawback scenarios, `extend-ttl.sh` keeper, `seed-demo-offers.sh`). Each directory has a README.

---

## How it works

```
 Maker (writer)             Options contract (Soroban)                Investor (holder)
 ───────────────            ──────────────────────────                ─────────────────
 create_offer  ──collateral──►  Offered  ◄── funded, visible in Markets
                                  │  buy: premium buyer → writer, holder set
                                  ▼
                                Active  ──transfer──► new eligible holder
                                  │
         ┌────────────────────────┼─────────────────────────┐
         ▼ exercise (one tx)      ▼ expiry                  ▼ (Offered only)
   Exercised: put = underlying   Expired: writer reclaims   Cancelled / pruned:
   in, strike out; call = strike collateral                 collateral back
   in, underlying out
         │ claim_delivery
         ▼
   writer receives delivered asset
```

- `contracts/options/` — `#![no_std]` Soroban. Holds collateral, tracks `open_collateral` per token, enforces `require_auth` on every state change, checked `i128` only, immutable constructor allowlist plus a runtime asset registry, per-asset open books (max 500) and a per-writer cap (50) so one maker cannot crowd a book, 2-year tenor limit, `prune_expired` callable by anyone, `extend_ttl` callable by anyone. No admin, no upgrade.
- `frontend/` — Vite, React, TypeScript. **Markets** (competing funded offers per series), **Protect** (easy mode: pick what you hold, see the puts that cover it), **Write** (maker flow with live collateral preview), **Portfolio** (exercise, claim, reclaim, transfer with countdowns), **Reserves** (owed vs held per token, read at a ledger, as an attestation), **Issuer** console (authorize, freeze, clawback on classic and SAC targets). Exact integer units everywhere; `number` only inside hypothetical payoff charts.
- `packages/payoff/` — deterministic payoff math for long/short calls and puts and covered strategies. Charts are labelled hypothetical; there is no oracle and no pricing model.
- `scripts/` — reproducible Testnet setup, deployment and demos. `docs/` — locked ABI, evidence, demo script, UI spec.

Decisions a reader should know, each with its reasoning in [PRODUCT_SPEC.md](PRODUCT_SPEC.md): premium is paid at purchase and never refunded (D1); a writer cannot buy their own offer (D2); expiry must fall within two years (D4); no "impaired" state and no refund after issuer action (D6); transfer is free and only to an eligible address (D7).

---

## What can go wrong, and what we promise instead

- **Issuer action is not insured.** If an issuer freezes a holder, de-authorizes the escrow or claws back collateral after a sale, the option may become unexercisable and the premium is not refunded. The contract promises the economics of the option, not protection from the issuer.
- **After a clawback the escrow is short.** It holds one pooled balance per token, so remaining payouts are served **first come, first served**. While a token is short, new offers, purchases and transfers on that token fail with `CollateralShortfall` (#115); other tokens are unaffected. The Reserves page shows the shortfall.
- **Quotes are indicative until an on-chain offer is confirmed.** There is no order book depth and no live market-maker liquidity. The demo makers are our own funded Testnet accounts.
- **Storage rent.** Soroban entries expire; `extend_ttl` is public and a keeper script runs it.
- **Testnet, fictional assets, unaudited code.**

---

## Built during the event

Everything in this repository was written between 11:00 on Sunday 25 October and the submission, starting from an empty scaffold: 61 commits and 30 merged pull requests, all in the public history.

| When (Lisbon) | Milestone |
|---|---|
| Sun 14:00–17:00 | Idea committee: 12 proposals, debates, independent scoring, Testnet spikes. Decision record in [WINNING_IDEAS.md](WINNING_IDEAS.md) and [research/decision/](research/decision/). |
| Sun 17:00 | Spike proves put exercise, issuer freeze and clawback against a contract balance on Testnet ([20_rwa_options_spike.md](research/decision/20_rwa_options_spike.md)). |
| Sun 19:06 | **v1** deployed. Cash-secured put, covered call, two assets on one contract. |
| Sun 19:38 · 20:32 | **v1.1** hardening; **v1.2** holder transfer, paged reads, issuer-action evidence, invariant and negative test suites. |
| Sun 23:06 · Mon 00:50 | **v1.3** permissionless `list_asset`, per-writer cap, `prune_expired`, tenor cap; **v1.3.1** per-asset books and transfer guards after a five-reviewer gate. EQTY listed and traded on chain. |
| Mon 01:00–06:00 | Frontend redesign, multi-wallet connect, Protect easy mode, Reserves attestation, payoff charts, product spec and payoff package. |

We used AI coding agents throughout, in bounded lanes with human owners for financial semantics, contract safety and UX, and every merged claim is backed by a test or a Testnet transaction. The process is documented in [AGENTS.md](AGENTS.md).

## Where this goes

- **Position tokens** so options become composable collateral in the rest of the ecosystem.
- **Cash-settled spreads and a partial-margin product.** A risk model and integer reference implementation for a margined product ("Strata Pro") are specified and simulated in `packages/risk/` and `docs/pro-*.md`; it is deliberately not on chain yet, because it needs an oracle and a liquidation design we were not willing to ship unreviewed.
- **Issuer onboarding** for real tokenized assets: the contract already respects their rules; the work is legal and operational, not technical.
- **RFQ layer** for makers, with the on-chain funded offer remaining the only executable truth.

## Team

Three builders: product and quantitative design (spec, payoff and risk models), contract and Testnet operations (`contracts/`, `scripts/`), frontend and wallet integration (`frontend/`). Built at Warehouse ONE16, Lisbon.
