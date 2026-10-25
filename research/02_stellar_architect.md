# 02 — Stellar Architect (Phase One, blind)

Core question: what is hard, slow, or much less useful to build anywhere except Stellar? Every concept below has to answer that before anything else.

Date checked: 2026-10-25. Network state per [Software Versions](https://developers.stellar.org/docs/networks/software-versions): **Protocol 29 is on both testnet (Sep 29) and mainnet (Oct 1)**. P29 is a security release with no new CAPs. P28 added CAP-83/85/86.

## A) Verified capability notes

| Primitive | Status | SDK maturity / notes | Source |
|---|---|---|---|
| Classic asset issuance + flags (AUTH_REQUIRED, AUTH_REVOCABLE, AUTH_CLAWBACK_ENABLED) | Mainnet + testnet (long-standing) | Mature. `@stellar/stellar-sdk` Operation.setOptions / setTrustLineFlags / clawback | [Assets overview](https://developers.stellar.org/docs/tokens/anatomy-of-an-asset) |
| Stellar Asset Contract (SAC), SEP-41 interface | Mainnet + testnet | Mature. Every classic asset gets a Soroban token contract. CAP-73 (P26) lets the SAC manage G-account balances | software-versions page |
| Path payments / SDEX | Mainnet + testnet | Mature. Testnet liquidity is thin, so we'd seed our own offers | developers.stellar.org |
| Claimable balances with time predicates | Mainnet + testnet | Mature (classic ops) | developers.stellar.org |
| Sponsored reserves, fee-bump txs | Mainnet + testnet | Mature | developers.stellar.org |
| Multisig / thresholds, muxed accounts | Mainnet + testnet | Mature. CAP-79 (P26) adds muxed strkey conversion in Soroban | software-versions page |
| Soroban contracts (Rust) | Mainnet + testnet | Mature. soroban-sdk v27 is out | [rs-soroban-sdk v27](https://newreleases.io/project/github/stellar/rs-soroban-sdk/release/v27.0.0) |
| CAP-71 auth delegation + address-bound credentials (P27 "Zipper") | Mainnet + testnet since Jul 8 2026 | New. The docs say client tooling (e.g. simulation) is still in progress, so it's a risk to depend on | [Zipper guide](https://stellar.org/blog/foundation-news/stellar-zipper-protocol-27-upgrade-guide), [delegate-auth example](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/delegate-auth) |
| Passkey smart wallets (secp256r1) – passkey-kit | Testnet usable | passkey-kit v0.14 now submits through the OpenZeppelin Relayer (it used Launchtube before). README: "demo only, not audited" | [passkey-kit](https://github.com/kalepail/passkey-kit) |
| OpenZeppelin Smart Accounts (context rules, policies e.g. spending limit, ≤5 policies/rule) | Testnet; RC v0.7.0 audited Apr 2026 | Medium maturity. Community report says spending_limit only meters `transfer` contexts (UNVERIFIED) | [OZ policies](https://docs.openzeppelin.com/stellar-contracts/accounts/policies), [audit](https://www.openzeppelin.com/news/stellar-contracts-rc-v0.7.0-audit) |
| x402 on Stellar (hosted facilitator on OZ Relayer, `exact` scheme, any SEP-41 token, default USDC) | **Testnet + mainnet** | `@x402/stellar` npm package (v2.x) and Rust `r402-stellar`. The buyer signs only a Soroban auth entry and the facilitator pays fees, so the buyer needs no XLM. Wallets that sign auth entries: Freighter, Albedo, Hana, HOT… | [x402 docs](https://developers.stellar.org/docs/build/agentic-payments/x402), [facilitator](https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar) |
| MPP (Machine Payments, direct SAC settlement, no facilitator) | Mentioned in the Stellar agentic-payments skill | UNVERIFIED maturity | [skills.stellar.org](https://skills.stellar.org/skills/agentic-payments/SKILL.md) |
| BN254 ops (CAP-74) + Poseidon/Poseidon2 (CAP-75) – P25 "X-Ray" | Mainnet since Jan 22 2026 | Low-level building blocks. More BN254 functions arrived in P26 (CAP-80). BLS12-381 has been there since P22 | [X-Ray](https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25), [ZK on Stellar](https://developers.stellar.org/docs/build/apps/zk) |
| Confidential Tokens (OZ wrapper over any SEP-41, Pedersen-committed balances, UltraHonk verifier by Nethermind; amounts hidden, addresses visible) | **Testnet only** (dev preview Jun 29 2026), not approved for mainnet, audits ongoing | Preview. I couldn't find the API docs (UNVERIFIED how easy it is to integrate) | [blog](https://stellar.org/blog/developers/developer-preview-confidential-tokens-on-stellar) |
| Stellar Private Payments (Nethermind shielded pool, KYC-gated, freeze, selective disclosure) | Testnet | Research-grade | [Nethermind](https://www.nethermind.io/blog/stellar-private-payments-confidential-and-compliant-transfers-on-public-rails) |
| Privacy-pools prototype (Groth16/BLS12-381, ~40M instructions per verify) | Prototype | Reference code only | [SDF blog](https://stellar.org/blog/ecosystem/prototyping-privacy-pools-on-stellar) |
| Reflector oracle (SEP-40, ~5 min updates) | Mainnet + testnet (addresses are in the docs table) | Mature enough. Testnet contract ID still to fetch | [Oracle providers](https://developers.stellar.org/docs/data/oracles/oracle-providers) |
| SEP-10/24/31/38 anchors | Mainnet. Testnet has the `testanchor.stellar.org` reference anchor | Mature, though the SEP-24 interactive flow is fiddly | developers.stellar.org (known; not re-fetched today) |
| SEP-7 payment URIs | Supported by some wallets | Mature spec. Wallet support varies (UNVERIFIED for Freighter) | — |
| Blend v2 / Soroswap / Aquarius | Mainnet | Testnet deployment and SDK for Blend are UNVERIFIED (search returned nothing) | — |

**What I take from this:** in Oct 2026 Stellar's real differentiators are (1) **regulated-asset controls built into the protocol** (auth/clawback flags, claimable balances, SAC bridging them into Soroban), (2) **programmable contract accounts that keep fees and auth off the user** (passkeys, OZ policies, x402, relayer sponsorship), and (3) **compliance-friendly confidentiality, live on testnet** (Confidential Tokens). The strongest projects combine at least two of these.

---

## B) Four concepts

### 1. LeashPay: spending-capped wallets for AI agents (Agentic commerce)
**Pitch:** A human approves a monthly budget with one passkey tap. Their AI agent then pays for APIs and data by itself over x402, and the cap and merchant allowlist are enforced on-chain by the agent's smart account, not by trusting the agent.

- **User:** Developers and small teams running AI agents that need paid APIs (search, scraping, inference, datasets). Also API sellers who want per-call revenue with no signup.
- **Problem:** If you hand an agent a hot key or a credit card, nothing limits what it spends except trust. Platform credits lock you into one vendor. Per-call payments under $0.01 don't work on card rails.
- **Solution (MVP):**
  1. Owner creates an OZ Smart Account with a passkey signer (passkey-kit / smart-account-kit) on testnet.
  2. Owner adds a context rule: the agent's ed25519 key may call USDC-SAC `transfer` only to allowlisted payees, with a spending-limit policy (e.g. 5 USDC/day).
  3. A demo seller API (Express + `@x402/stellar`) charges 0.01 USDC per call through the hosted testnet facilitator.
  4. A demo agent (a script, or a Claude tool-loop) calls the API. A 402 comes back, the agent signs the auth entry as the smart account, the facilitator settles, and the data returns.
  5. Dashboard: live spend against the cap, payees, and a revoke button (the owner deletes the rule with a passkey).
- **Stellar primitives and why:** Contract accounts with programmable `__check_auth`, OZ policies, x402 `exact` scheme over SAC USDC, relayer fee sponsorship (the agent holds no XLM), secp256r1 passkeys. On EVM you'd need ERC-4337 bundlers, paymasters, and session-key modules from several vendors. On Stellar, auth-entry signing plus the facilitator is the native flow. Fees around $0.00001 and ~5 s finality make sub-cent calls economical.
- **Differentiation:** Coinbase x402 + CDP wallets on Base, Skyfire, Crossmint agent wallets, Stripe agent toolkit. Those wallets mostly enforce limits in custodial or off-chain policy. LeashPay enforces them in the account contract on-chain and the owner never gives up custody. As far as I can tell no Stellar product yet pairs OZ policy accounts with x402 (UNVERIFIED that nobody has).
- **90-second demo:** The agent is asked to research 20 items. It pays 20 times at 0.01 USDC and the dashboard counter climbs. Then a prompt-injected instruction says "send 50 USDC to attacker G…". **The transaction is rejected on-chain by the policy**, and the explorer shows the failed auth. The owner taps their passkey, raises the cap, and the agent continues.
- **Biggest risk:** Getting the x402 facilitator to accept payment from a **contract (C-) account** whose auth is governed by an OZ policy. The facilitator has to simulate `__check_auth` with the agent's signature. This is likely fine because SEP-41 transfer from a C-address is standard, but it's UNVERIFIED end to end. Fallback: a thin custom "allowance vault" Soroban contract (owner deposit, agent `spend(payee, amount)` with a per-period cap). That's about 150 lines of Rust, and the agent pays through it while x402 stays the transport.
- **Verified vs assumed:** Verified: the x402 facilitator on testnet, SEP-41 any token, auth-entry model, OZ spending-limit policy exists, passkey-kit works on testnet. Assumed: smooth facilitator plus smart-account interop, and simulation of OZ auth in the TS SDK.
- **Track:** Composed (OZ Smart Accounts + x402/OZ Relayer facilitator + passkey-kit, with Reflector as an optional extra).

### 2. ReliefRail: restricted-use humanitarian vouchers (Humanitarian / public sector)
**Pitch:** An NGO issues a voucher stablecoin that beneficiaries can only spend at approved merchants for approved categories. Unused value expires and returns to the NGO automatically, and merchants cash out to fiat through an anchor.

- **User:** NGO cash-assistance program officers. Beneficiaries with basic phones. Local merchants (grocers, pharmacies).
- **Problem:** Unrestricted cash aid can be diverted. Paper or card vouchers are slow, easy to counterfeit, and need costly reconciliation. Expired or unused funds sit stranded at partners.
- **Solution (MVP):**
  1. NGO issuer account creates the `AID` asset with **AUTH_REQUIRED + AUTH_REVOCABLE + CLAWBACK_ENABLED**. Only KYC'd beneficiaries and approved merchants get authorized trustlines.
  2. A Soroban "program" contract (wrapping the SAC; the issuer is admin) holds the allowlist of merchants per category and per-beneficiary caps. Payments to non-merchants are blocked because the recipient has no authorized trustline, and the contract enforces category caps.
  3. Disbursement goes out as **claimable balances** with a time predicate: claimable by the beneficiary for 30 days, then reclaimable by the NGO. Sponsored reserves mean beneficiaries never need XLM.
  4. A beneficiary PWA uses a passkey wallet (no seed phrase) to pay merchants via a QR code (SEP-7 URI).
  5. Merchant redemption pays AID back to the issuer for USDC. The cash-out flow is demoed against `testanchor.stellar.org` SEP-24.
- **Stellar primitives and why:** Issuer-controlled authorization and clawback are **protocol-level** on Stellar. On EVM they're ad-hoc in each token contract and wallets don't understand them. Claimable balances with predicates give expiry and return-to-sender with no custom contract. Sponsored reserves and fee sponsorship give beneficiaries a zero-XLM experience. The anchor network handles last-mile fiat (MoneyGram and others on mainnet). Stellar is already used for aid, which makes ecosystem fit credible.
- **Differentiation:** **Stellar Aid Assist / Stellar Disbursement Platform** (SDF, used with UNHCR in Ukraine) handles *unrestricted* disbursement. WFP Building Blocks runs on a permissioned Ethereum fork. ReliefRail adds *restricted-use* spending (merchant and category rules) plus automatic expiry and clawback on the public network. We'd have to pitch it as a complement to SDP, not a duplicate.
- **90-second demo:** NGO dashboard: "Disburse 50 AID to 3 families" creates claimable balances. A beneficiary on a phone uses a passkey to claim and pays a pharmacy (accepted). They try to pay a random address or an alcohol merchant and get **rejected**. Fast-forward (we use a short predicate): unclaimed balance flows back to the NGO. Fraud case: the NGO claws back a stolen voucher. The merchant cashes out via the SEP-24 test anchor.
- **Biggest risk:** Mixing classic ops (trustline flags, claimable balances) with Soroban contract checks is a lot of moving parts. Category enforcement only works if spends go through the contract, so direct classic payments between authorized accounts would bypass it. Mitigation: only merchants plus the program contract get authorized trustlines. Beneficiaries keep their balance inside the contract (balance ledger) or as a C-account. SEP-24 testanchor can be slow or flaky in a live demo, so pre-record it.
- **Verified vs assumed:** Verified: all classic flags, claimable balances, sponsorship, SAC, SEP-24 test anchor exists. Assumed: passkey-kit UX on mobile browsers, and the exact split between the classic and Soroban enforcement layers (design work still needed).
- **Track:** Unlocked (regulated-asset primitives combined in a new way). It could be framed as Composed if we add SDP or an anchor.

### 3. QuietPay: confidential payroll with auditor disclosure (B2B fintech / HR)
**Pitch:** A company pays salaries and contractors in USDC on a public chain without exposing everyone's pay to competitors and coworkers, and its auditor can still verify totals.

- **User:** Crypto-native startups and DAOs paying international teams in stablecoins (a large share of Stellar USDC flows are payroll and remittance).
- **Problem:** On-chain payroll publishes every salary forever. Companies then go back to banks or custodial off-chain payroll and lose instant global settlement.
- **Solution (MVP):**
  1. Employer wraps testnet USDC (SAC) into the **OZ Confidential Token** wrapper. Balances become Pedersen commitments.
  2. A payroll contract or script runs batch confidential transfers to employee addresses. Addresses are visible, amounts hidden.
  3. Employee app: decrypt and view their own balance, then unwrap to plain USDC to spend or off-ramp.
  4. Auditor view: selective disclosure of the opening for a pay period, proving the total equals the sum (built on the preview's disclosure features, or opened off-chain to the auditor).
- **Stellar primitives and why:** The Confidential Token wrapper is live on Stellar testnet. It's built on P25/P26 BN254 host functions with an UltraHonk verifier, works over any SEP-41/SAC asset, so native USDC works, and keeps addresses visible, which suits compliance. Getting the same on EVM means Aztec, Railgun-style shielding with weaker compliance, or Zama fhEVM (UNVERIFIED mainnet status).
- **Differentiation:** Request Finance, Deel crypto payouts, Rise (transparent on-chain or custodial). Railgun and Tornado-style pools (anonymity rather than confidentiality, so there's regulatory friction). We'd be among the first apps on Stellar's confidential token preview.
- **90-second demo:** Run payroll for 4 people. Stellar Expert shows transfers with **no amounts**. Employee A logs in and sees only their own salary. The auditor enters a viewing key and sees the total match the budget. An employee unwraps and pays rent in plain USDC.
- **Biggest risk:** **Preview maturity.** I couldn't find API docs. Client-side proof generation (UltraHonk in browser via WASM?) could be heavy or need a prover service. Viewing-key and disclosure features may not be in the preview yet. This is the highest-risk concept for 3 devs new to Soroban in 20 h. We should spend 1 h on a spike before committing.
- **Verified vs assumed:** Verified: preview is live on testnet, wraps any SEP-41, hides amounts not addresses, not on mainnet. Assumed: there's a usable JS client or prover, batch transfer cost fits in budget, disclosure mechanism exists.
- **Track:** Unlocked (newest Stellar protocol capability).

### 4. DepositBox: rental security deposits in a neutral escrow (Proptech / consumer)
**Pitch:** A tenant's security deposit sits in a neutral on-chain escrow, not the landlord's bank account. At move-out it's released by 2-of-3 approval (tenant, landlord, mediator), and either party can open a time-limited dispute.

- **User:** Tenants and small landlords, especially foreign students and expats (Lisbon is a good example) who can't easily recover deposits across borders.
- **Problem:** Deposits are regularly withheld unfairly. Cross-border refunds take weeks and cost fees. Statutory deposit-protection schemes exist only in some countries (UK TDS/DPS) and not in Portugal (UNVERIFIED for PT).
- **Solution (MVP):**
  1. Soroban escrow contract: `open(tenant, landlord, mediator, amount, end_date)`. The tenant funds it in USDC via SAC transfer.
  2. At move-out, the landlord proposes a split (e.g. 90/10) with evidence hashes. The tenant accepts and funds release. If the tenant does nothing for N days, the release follows the landlord's proposal. Otherwise it goes to the mediator, who resolves with 2-of-3.
  3. Tenant onboards with a passkey wallet. The landlord can receive in EUR via path payment (USDC→EURC on SDEX) or an anchor.
  4. Optional extra: idle deposit supplied to Blend for yield that goes to the tenant (Blend testnet UNVERIFIED, so cut first).
- **Stellar primitives and why:** Soroban escrow plus SAC USDC/EURC, path payments for automatic FX at release, passkey wallet and sponsorship for non-crypto users. The cross-border refund is the part that really needs Stellar. The escrow logic itself could run on any chain, so this concept is the weakest on "necessary on Stellar."
- **Differentiation:** UK TDS/DPS (government-mandated, domestic only), Zero Deposit and Flatfair (insurance replacing deposits), Rhino (US). Generic crypto escrow: Escrow.com (custodial), Kleros (dispute DAO on Ethereum).
- **90-second demo:** A tenant in Brazil pays the deposit by passkey. A year passes (time travel in the demo). The landlord proposes a 50 € deduction with photo hash, the tenant disputes, the mediator approves a 25 € deduction. The tenant gets USDC back instantly and the landlord receives EUR via path payment.
- **Biggest risk:** Low "only on Stellar" factor, so a judge may score Track Alignment and Innovation low. Thin testnet SDEX liquidity means we'd have to make our own market.
- **Verified vs assumed:** Verified: Soroban, SAC, path payments, passkeys. Assumed: EURC on testnet (we'd likely issue our own test EUR asset), Blend testnet.
- **Track:** Composed only if Blend is added. Otherwise a weak fit.

---

## C) My ranking

1. **LeashPay (agent spending caps).** Best balance of timeliness, innovation, and feasibility. Stellar has official, working x402 on testnet, a hosted facilitator, and audited OZ policy accounts. Gluing them into "the agent cannot overspend, enforced on-chain" is a clear **Composed** story with a striking demo (a blocked prompt-injection). Most of the work is TypeScript, which suits our team. The Rust fallback vault is small. Main risk is facilitator-to-smart-account interop, and a 1–2 h spike settles it.
2. **ReliefRail (aid vouchers).** Highest User Value and deepest use of Stellar-only primitives (auth flags, clawback, claimable-balance expiry, sponsorship, anchors). Very low protocol risk because it's all mainnet-grade. Downsides: it overlaps with SDF's own Aid Assist/SDP, the classic/Soroban enforcement split needs careful design, and many moving parts make it harder to polish in 20 h.
3. **QuietPay (confidential payroll).** Highest Innovation and Unlocked score if it works, but it depends on an unaudited testnet preview with unclear client APIs. Only worth choosing if a 1 h spike gets a confidential transfer working from JS.
4. **DepositBox.** Solid consumer value and easy to build, but the blockchain is the least necessary here, so it fails the core question. Keep it as a fallback.

**Combination worth considering:** LeashPay with a confidential-budget option later (agent spend amounts hidden from competitors). Not for this weekend.
