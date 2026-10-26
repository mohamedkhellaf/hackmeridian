# Strata — fully collateralized options on tokenized Stellar assets

**HackMeridian Genesis / Stellar Unlocked, Lisbon, October 2026. Stellar Testnet only. All assets are fictional.**

Live app: https://hackmeridian-psi.vercel.app · Contract: [`CBASUA3L…MJUEE`](https://stellar.expert/explorer/testnet/contract/CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE) (options v1.3.1)

## What it is

Stellar has tokenized assets, but most of them have no risk-management products. Strata is a Soroban contract that turns any **supported, eligible** Stellar asset into physically settled, American-style **puts and calls** that are **100% collateralized on-chain** before they can be sold. The contract holds the collateral itself. There is no margin, no leverage, no oracle, no admin and no upgrade path.

- **Put:** the writer locks the total strike in `USDx`. The holder may deliver the underlying and receive the strike, in one atomic transaction, any time before expiry.
- **Call:** the writer locks the total underlying. The holder may pay the strike and receive the underlying, atomically, any time before expiry.
- **Premium:** paid buyer → writer at purchase, never refunded ([PRODUCT_SPEC.md](PRODUCT_SPEC.md) D1).
- **Issuer rules travel with the asset.** Eligibility is the classic `AUTH_REQUIRED` flag read through the Stellar Asset Contract. The issuer decides who may hold the underlying; the contract only checks it. Freeze, revoke and clawback behave exactly as Stellar defines them.
- **Listing (v1.3):** anyone can list a classic asset by `(code, issuer)` with `list_asset`; the contract derives the canonical SAC. The issuer must still authorize the contract before any offer on that asset can be funded.

**Honest claim:** this works for any Stellar asset whose issuer permits it, not for every token automatically. The demo uses fictional Testnet assets `RWA`, `BOND`, `EQTY` (regulated: auth required, revocable, clawback) and a fictional quote token `USDx`.

## Deployed on Testnet

| Contract | ID |
|---|---|
| options v1.3.1 (wasm sha256 `acecb2f2…354b`, byte-identical to `contracts/options` on `main`) | `CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE` |
| RWA SAC | `CCVYWYG56YL7VA7A3EKVJKAKZC4O2B6YXV6UJMERG2NYC7HJHELJLR7U` |
| BOND SAC | `CADCBCQ7TU5XCGPYDD32HANAVEWWDARGKIKXWF5YK7NTFOLAWGQYQGHP` |
| EQTY SAC (listed at runtime with `list_asset`) | `CDBHRGVHB2NVKJCM5ZKBTUQ3RQHZUZJSSEZLATIUROWXNIEFZ7T7NIFU` |
| USDx SAC (quote) | `CAKXMQVKSW2AEKF5DSMDPHJAYGNVOQANHXLI64QJS2H3GOCXRW2GCICU` |

Deploy transactions, earlier versions and every recorded demo transaction: [docs/contract-testnet-evidence.md](docs/contract-testnet-evidence.md). Full table: [AGENTS.md](AGENTS.md#deployed-contracts-testnet-only).

## Architecture

```
frontend/            Vite + React + TS. Stellar Wallets Kit (Freighter and others), RPC simulate/sign/send,
                     markets, write, portfolio, reserves (collateral attestation), issuer console.
contracts/options/   Soroban, #![no_std]. Holds collateral, tracks reserves per token, enforces require_auth,
                     checked i128, atomic exercise. Constructor allowlist + runtime list_asset registry.
packages/payoff/     Deterministic payoff math for charts (hypothetical, not quotes).
scripts/             Testnet issuers and flags, contract authorization, deploy, smoke test, issuer-action demo,
                     TTL keeper, demo-book seeding.
docs/                contract-abi.md (locked ABI), contract-testnet-evidence.md, demo-script.md, ui-spec.md.
```

Lifecycle: `Offered → Active → Exercised` (writer later `claim_delivery`), or `Offered → Expired/Cancelled`, or `Active → Expired → reclaim`. Holders can `transfer` an Active option to another eligible address. Anyone can `prune_expired` unsold offers.

## Run it

```sh
# contract
rustup target add wasm32v1-none
stellar contract build --package options
cargo test -p options            # 120 unit + 17 invariant + 65 negative tests

# frontend
cd frontend && npm install
cp .env.example .env             # set VITE_OPTIONS_CONTRACT_ID=CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE
npm run dev                      # npm test, npm run e2e, npm run build
```

Reproduce the Testnet setup end to end with `scripts/setup-testnet/` then `scripts/deploy/` (see their READMEs). `scripts/deploy/smoke-testnet.sh` replays the full put and call lifecycle against a fresh deployment and prints every transaction hash.

## Limitations and disclosures

- **Testnet only.** Fictional assets and disposable accounts. Nothing here is production-audited.
- **Issuer action is not insured.** If an issuer freezes a holder, de-authorizes the escrow or claws back collateral after a sale, the option can become unexercisable and the premium is not refunded. The escrow holds one pooled balance per token, so after a clawback payouts are served **first come, first served**; while a token is short, new offers, purchases and transfers on it fail with `CollateralShortfall` (#115). See PRODUCT_SPEC.md D6.
- **Not every token.** The contract settles only assets its issuer allows it to hold. Real RWA integrations need issuer cooperation and legal permission.
- **Quotes are indicative** until a funded on-chain offer is confirmed. Payoff charts are hypothetical. No order-book depth or market-maker liquidity is simulated; demo makers hold real funded Testnet positions.
- **Storage TTL** is maintained by `scripts/deploy/extend-ttl.sh`; anyone can call `extend_ttl`.

## Team

Dev 1 product and quant (spec, payoff), Dev 2 contract and Testnet (this repo's `contracts/`, `scripts/`), Dev 3 frontend and wallet integration. Decision record: [WINNING_IDEAS.md](WINNING_IDEAS.md), [research/decision/](research/decision/).
