# AGENTS.md — HackMeridian execution rules

<!-- Operational instructions for humans and coding agents. Keep accurate, short, and aligned with the running code. -->

## Mission and constraints

- **Product:** Strata (working name; previously Backstop). Repository: `hackmeridian`.
- **Event:** HackMeridian Genesis / Stellar Unlocked, Lisbon, October 25–26, 2026.
- **Hard deadline:** Monday, **October 26 at 12:00 Lisbon time**. Target submission by 11:00; feature freeze by 06:00. The demo, deck, README, GitHub repository, and submission answers are deliverables, not afterthoughts.
- **Thesis:** Stellar has tokenized assets, but many lack useful risk-management products. Build a **multi-asset, fully collateralized options layer** that turns eligible tokenized assets into physically settled calls/puts, with transparent collateral and issuer-enforced transfer rules. Simple strategies sit on top of this layer. **Strata Pro (experimental, decided 2026-10-25 by Dev 1):** a separate contract for naked, cash-settled European calls with partial margin, liquidation by takeover and a pre-funded backstop vault; see "Strata Pro" below. Pro never weakens the fully collateralized guarantees of `contracts/options/`.
- **Honest claim:** *Any supported, eligible Stellar asset* — NOT every token automatically. The MVP uses fictional Testnet assets; real RWA integrations need issuer cooperation, legal permission, and technical compatibility.
- **Existing evidence:** A put exercise was proven in a Testnet spike; see `research/decision/20_rwa_options_spike.md`. Original decision context: `WINNING_IDEAS.md` and `research/decision/`.
- **Coding gate:** Respect a human team's explicit **GO** before implementing. Once GO is given, work autonomously within your assigned scope. Never wait for blanket permission on each small task. If a freeze/stop is called, obey it.

## The three human owners — no ambiguity

| Owner | Role | Owns and decides | Primary code / artifacts |
|---|---|---|---|
| **Dev 1 — Founder / Product Architect / Quant Lead** | Financial logic, product and integration owner | Financial semantics, scope, payoff and risk formulas, strategy composition, RFQ requirements, maker economics, user story, financial acceptance criteria, trade-offs, final demo narrative | `PRODUCT_SPEC.md`, `packages/payoff/`, `packages/rfq/` (or frontend-side RFQ model), shared financial types, quantitative tests, `docs/demo-script.md` |
| **Dev 2 — Blockchain / Contract Lead** | On-chain correctness and security owner | Soroban contract ABI, collateral accounting, auth, options lifecycle, atomic settlement, Stellar asset issuance/permissions, deployment, contract tests, security review | `contracts/`, `scripts/setup-testnet/`, `scripts/deploy/`, contract tests, deployed IDs |
| **Dev 3 — Frontend / Stellar Integration Lead** | User experience and working dApp owner | React app, investor/maker/issuer journeys, payoff chart integration, Freighter/wallet UX, Stellar SDK transaction building, generated TS bindings consumption, hosting and end-to-end UI | `frontend/`, wallet/contract client integration, app deployment, UI/e2e tests, video capture support |

**Decision rights:** Dev 1 owns *what* the instrument promises; Dev 2 owns *how* it can safely execute on-chain; Dev 3 owns *how* users interact with it. Any mismatch between promise and code is a **stop-ship blocker**. All three review the public claims and end-to-end demo. Dev 1 coordinates priorities and submission; Dev 2 has veto on unsafe contract behavior.

## Interfaces to lock at kickoff (first 20–30 minutes)

1. **Dev 1 publishes `PRODUCT_SPEC.md`:** define CALL/PUT, American-style exercise before expiry, physical token delivery, one position per funded offer, no partial exercise in MVP, premium timing, expiry behavior, maker delivery claims, option ownership, cancellation/impairment policy. Include worked examples and acceptance tests. Explicitly decide when the maker earns the premium and whether/when it can be refunded; do not silently assume an economically sound policy.
2. **Agree on one financial data contract:** underlying token ID, quote token ID, option type, underlying quantity, **total** strike, **total** premium, expiry timestamp, writer, current holder, and lifecycle state. Use exact integer token units on-chain and for signing; `number` is allowed **only** for illustrative chart computation. Store asset decimals explicitly.
3. **Dev 2 publishes the actual Soroban ABI / generated client as soon as compiled:** `create_offer`, `buy`, `exercise`, `cancel_offer`, `reclaim`, `claim_delivery`, `get_option`, `list_open`, `open_collateral`, plus only the states/functions implemented. Function names above are illustrative until the compiled ABI is authoritative.
4. **Dev 3 mocks against this schema immediately**, then swaps to generated bindings. Dev 1's payoff/RFQ packages must be usable by Dev 3 without custom financial logic in React components.
5. **RFQ truth rule:** an off-chain quote is only *indicative*; it becomes *executable* only when Dev 2's contract confirms a valid, funded, available offer. Two demo maker accounts can publish competing **on-chain offers**; no backend is required for P0. A live RFQ service is optional and must never be critical to exercise.

## Scope and time gates (all times Lisbon)

- **P0 — by ~21:00 Sunday:** existing Testnet spike integrated into the repo; one cash-secured PUT on fictional `RWA` + test `USDx`; writer funds collateral → holder buys → holder exercises → immutable transaction proof. Minimal UI wired to contract, not a simulation.
- **P0+ — by ~01:00 Monday:** covered CALL; two distinct underlying Testnet assets using the *same* contract; maker competition (funded offers), eligibility checks, issuer authorization demo, collateral-proof UI, automated Rust tests and working hosted frontend.
- **P1 — only after P0+ succeeds:** transfer of option ownership; position token if feasible; issuer freeze/clawback failure demo; financial strategy presets (protective put, covered call, collar) with **accurate payoff previews**; trustworthy impairment/refund logic if fully specified and tested.
- **P2 — optional:** multi-leg on-chain execution and composed strategies, a more sophisticated RFQ backend, third asset class, Trustless Work integration. Do not claim that a multi-leg structured product is issued or guaranteed unless **all** legs are funded and settle consistently.
- **06:00 Monday:** freeze features. Then integration fixes, tests, README, deck, demo recording and submission only. **Submit by 11:00**, leaving a one-hour buffer.
- **Strata Pro track — in parallel, never at the expense of P0/P0+:** `contracts/pro/` v0 per `docs/pro-v0-brief-dev2.md`. Go/no-go at **04:00**: fill → price move → liquidation to the vault → settlement proven by tests and on Testnet, otherwise Pro ships as spec + simulator only and the demo says so.
- **Never in this hackathon:** Mainnet or real customer funds; real regulated-fund integrations without permission; unaudited claims of production security, hidden oracle assumptions. Margin and partial collateral are allowed **only** inside `contracts/pro/`, under the rules below; never present a Pro position as fully collateralized.

## Contract and asset architecture

- `contracts/options/`: Soroban contract that **holds collateral itself** and tracks reserves per option. Immutable constructor allowlists quote `USDx` SAC and supported underlying SACs for the MVP. Never accept arbitrary untrusted token contracts at runtime. **No admin; no upgrades.** This allowlist is a current deployment limitation, not permissionless support for every newly issued token.
- Issuer demo assets: **fictional Testnet** fund/bond/stock-style tokens (labels only, not ownership claims), authorization-required, revocable and clawback-enabled where tested; separate `USDx` Testnet issuer. The issuer must authorize the escrow contract as needed for it to receive regulated assets.
- Lifecycle from existing implementation plan: `Offered` → `Active` → `Exercised` (writer may later `claim_delivery`); or `Expired` → `reclaim`; or `Cancelled` (before purchase). An `Impaired` state with any premium refund is **not approved until the product owner specifies its economics and Dev 2 proves detection and settlement safely**.
- PUT exercise: option holder delivers underlying to the **contract**, receives locked `USDx` in the same invocation; writer claims the delivered asset when authorized. Do not allow a frozen writer to block payment to the holder when transfers otherwise remain permitted.
- CALL exercise: contract holds underlying beforehand; holder pays strike; contract transfers underlying to holder atomically. Writer's proceeds are accounted for correctly.
- Enforce signer authorization using `require_auth`, ensure eligibility where relevant, check exact balances/allowances, and reject unapproved asset IDs. Every state-changing path must be tested for replay/double exercise, unauthorized cancellation and withdrawn/insufficient collateral.
- Checked `i128` math; positive quantities/premiums as specified; no floating-point token accounting. State transitions and cross-contract calls must be atomic; any failure reverts the complete exercise. Maintain Soroban TTL beyond expiry and judging (through at least October 28).
- Issuer freeze/revoke/clawback can prevent settlement or alter collateral availability. Do **not** market a restricted-asset option as an unconditional guarantee against issuer action. Readme and UI must disclose limitations.
- Never embed private keys/seeds or reusable funded identities in the public frontend/repo. Demo roles may use disposable **Testnet-only** accounts with controlled signing; Freighter preferred for the interactive user flow.

## Strata Pro (experimental, `contracts/pro/`)

- **Isolation:** separate crate and deployment. No storage, balance or call is shared with `contracts/options/`; Pro losses can never touch options collateral. The locked options ABI is not modified for Pro.
- **Product:** naked European calls, cash-settled in `USDx` (unflagged, so margin is not exposed to clawback). One underlying market per deployment. The payoff is `qty × max(S_T − K, 0)`, paid from writer margin, then the backstop vault; any remainder is a recorded deficit and a haircut on the holder. Never call it guaranteed.
- **Roles (exception to "no admin", Pro only):** `admin` lists series (market parameters are fixed at deployment in v0); `publisher` publishes risk snapshots and the settlement price. Neither can move user balances, change a live series' terms, rewrite a final price, or delete a long position. Roles are disclosed in README and UI.
- **Oracle:** demo feed operated by the team, labelled as such. The contract bounds every snapshot (mark within arbitrage bounds, extreme-scenario floor, freshness, monotonic sequence); bounds limit, but do not remove, trust in the publisher.
- **Margin model:** owned by Dev 1 in `packages/risk/` (reference engine, integer reference model, fixtures). Contract tests must reproduce `packages/risk/fixtures/pro_v0.json` exactly. Parameters are illustrative, not calibrated on real data.
- **Claims:** "partial margin with liquidation and a pre-funded backstop; residual default risk is disclosed". Not: "safe", "insured", "fully backed".

## Financial and market-data rules (Dev 1)

- Put buyer receives the **right to sell** the underlying at the strike; call buyer the **right to buy** it. The market maker is the option writer and receives a premium under the agreed premium policy.
- Puts: reserve **total strike** in quote token. Covered calls: reserve **total underlying quantity**. Do not count one reserve twice across positions or legs. Keep offered vs active collateral accounted for.
- `packages/payoff/`: deterministic, unit-tested long/short call and put payoffs; protective put, covered call and collar previews; include premium, underlying holdings and fees assumptions explicitly. Label charts *hypothetical*, not guaranteed executable prices.
- `packages/rfq/`: model `QuoteRequest` and `MakerQuote`, show comparable terms (asset, lot, strike, maturity, quote token), expiry, maker, premium, funding state, and on-chain offer ID. A funded executable offer must be confirmed from chain immediately before purchase. Handle quote expiration and simultaneous buyers honestly.
- No fabricated order-book depth or live market-maker liquidity. Demo makers use funded Testnet positions. No Black–Scholes output should be misrepresented as a real market quote.
- Quant lead writes concrete numerical tests for premiums, collateral, payout profiles, exercise before/after expiry, holder transfers, and zero/double-use of collateral. Contract owner implements contract-level versions.

## Coding agents and Git workflow

- **Humans own decisions; agents own bounded tasks.** For each task, specify owner, files/directories, inputs, acceptance criteria, tests, expected output, and whether it may alter public interfaces. Coding agents must not redefine the product or silently change contract economics.
- Separate agent lanes: **Dev 1:** quant/payoff agent, RFQ agent, financial red-team (read-only); **Dev 2:** contract implementer, Rust/test agent, security auditor (read-only); **Dev 3:** UI agent, wallet/bindings agent, e2e agent. A documentation/pitch agent works on docs only under Dev 1.
- Never allow two agents to write the same files simultaneously. Use isolated branches/worktrees; coordinate API changes with all owners before merging. Human lead checks diffs, tests, and claims.
- `main` stays demoable. Code, dependency, CI and contract changes use small short-lived PRs (`feat/…`, `fix/…`, `chore/…`). Docs-only changes may go directly to `main` if harmless. CI/build/tests must pass; **contract or financial-settlement changes require human review by Dev 2**. For other PRs, the relevant owner reviews if time permits. Squash-merge, delete branch, pull `main` frequently.
- Every coding agent must report: **changed paths, commands/tests run, test results, blockers, and transaction/contract IDs if relevant**. Never claim success when it only compiled or rendered. Keep commit messages imperative; no AI/co-author attribution trailers.
- Never merge a claim unsupported by a test or real Testnet transaction. Contract redeploys must update **Deployed contracts** in the same PR. If a gate slips, reduce scope rather than defer the submission.

## Project layout

- `Cargo.toml`, `contracts/options/src/`: Soroban Rust, `#![no_std]`, tests under contract crate.
- `contracts/pro/`: experimental Strata Pro contract (Dev 2). `packages/risk/`: Pro margin engine, integer reference model and fixtures (Dev 1, Python 3 + numpy). `docs/pro-architecture.md`, `docs/pro-v0-brief-dev2.md`: Pro design and build brief.
- `scripts/`: Testnet asset creation/issuer permissions, deployment, funding demo accounts, repeatable integration steps.
- `frontend/`: Vite + React + TypeScript, Stellar SDK and Freighter, app and transaction UI, generated bindings.
- `packages/payoff/` and `packages/rfq/`: **planned** shared financial modules owned by Dev 1. If the existing monorepo structure differs, agree on paths once rather than having agents create competing package trees.
- `PRODUCT_SPEC.md`, `docs/`, `README.md`: product spec, risk assumptions, architecture, reproducible demo and submission materials.
- `research/decision/`, `WINNING_IDEAS.md`: ideation record, existing spike evidence.

## Deployed contracts (TESTNET ONLY)

| Contract | Alias | Contract ID | Deployed by |
|---|---|---|---|
| options v1.1 (deploy tx `a7ed7420db6be3d6a88ceebf7f54cdd4f44300df3c9ce7bcf744f6ed75911c08`, wasm sha256 `cd2ddf0cecd12cbd70bffbee3f7a1e061a8bd6a432693e0c4d0cccae55d45659`; v1 was `CDRS3BBF…L673`) | options | `CBRTUM4NF5P5ENYSPPOTT3NMRCPT65QSKMD2BB3AJPLU2C4YCFOCMSQC` | strata-deployer `GBVPEL6MT4IZ4XL5J7TTMB3GND7TPRS54KOJTUFCUOVFVFPZKE5HDA73` |
| RWA SAC (fictional; `RWA:GCNW…FDGM`, auth required/revocable/clawback) | — | `CCVYWYG56YL7VA7A3EKVJKAKZC4O2B6YXV6UJMERG2NYC7HJHELJLR7U` | strata-rwa-issuer `GCNWQR5OA24X7LPTCXUEL4V4ZLSIFKUNIEZEO3UVCVXECPPGX7ERFDGM` |
| BOND SAC (fictional; `BOND:GCNW…FDGM`, auth required/revocable/clawback) | — | `CADCBCQ7TU5XCGPYDD32HANAVEWWDARGKIKXWF5YK7NTFOLAWGQYQGHP` | strata-rwa-issuer `GCNWQR5OA24X7LPTCXUEL4V4ZLSIFKUNIEZEO3UVCVXECPPGX7ERFDGM` |
| USDx SAC (fictional quote token; `USDx:GAE6…ARFS`, no flags) | — | `CAKXMQVKSW2AEKF5DSMDPHJAYGNVOQANHXLI64QJS2H3GOCXRW2GCICU` | strata-usdx-issuer `GAE6ONGU5S3JHDBR5Z3BUVXCL4WLEHQVLBDNTCKHKOYFBYBPBW4IARFS` |

## Commands and references

```sh
# At repository root
stellar contract build
cargo test
# To build one crate: stellar contract build --package <name>

# Frontend
cd frontend && npm install && npm run dev
npm run build && npm run lint

# Confirm current CLI invocation syntax before using these examples
stellar contract deploy --wasm target/wasm32v1-none/release/<name>.wasm --source-account <identity> --network testnet --alias <alias>
stellar contract invoke --id <alias> --network testnet --source-account <identity> -- --help
stellar contract bindings typescript --network testnet --id <alias> --output-dir frontend/packages/<name>
```

- Use `stellar contract build` for network-compatible Wasm artifacts, not an ordinary `cargo build` substitute. Follow the installed CLI's exact options and generated contract commands.
- Stellar smart contracts: https://developers.stellar.org/docs/build/smart-contracts/overview
- Soroban examples: https://github.com/stellar/soroban-examples
- Stellar developer tools: https://developers.stellar.org/docs/tools/developer-tools
