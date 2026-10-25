# 03: Wildcard Inventor, four unconventional concepts

Agent 3, phase one (blind). I did not read the other research files. Novelty checks were done with web search on 2026-10-25. Anything I could not confirm is marked **UNVERIFIED**.

Filter I applied: the idea has to surprise a judge, be explainable in one sentence, show one "oh!" moment in a 90-second video, and use Stellar for something the product cannot work without. I dropped ideas that already have close hackathon prior art: lost-and-found bounty tags (LaF, ETHGlobal Cannes), stake-to-attend events (Kickback, Unlock "I'm Going!"), and generic AI-agent spending caps (REAPP on the Stellar Community Fund, OpenZeppelin smart-account policies, x402-policy).

---

## Concept 1: TRIPWIRE, a bug bounty that pays itself

**Pitch:** A Soroban bug bounty that pays the whitehat in the same transaction that proves the exploit, with no triage, no multisig and no "we'll get back to you in 90 days".

- **Domain:** developer infrastructure and security.
- **User:** Soroban protocol teams (DEXs, lending, vaults) on one side, and independent security researchers and AI auditing agents on the other.
- **Problem:** Bounty payouts depend on the project's goodwill. Whitehats report to platforms that still need human or multisig approval. Immunefi's vaults prove the funds exist, but the project still confirms the bug before paying (cointelegraph / The Block). Disputes, low-balling and slow triage push some researchers toward blackhat behaviour. New Soroban protocols launch without big audit budgets.
- **Solution (MVP):**
  1. The protocol team deploys `Tripwire` with a USDC bounty, a pointer to its target contract, and an **invariant verifier contract**. The verifier has one function, `holds(target) -> bool`, for example "total shares × price ≤ vault USDC balance" or "admin unchanged".
  2. The whitehat writes an **exploit contract** with an `execute(target)` function and calls `Tripwire.claim(exploit, payout_addr)`.
  3. `claim` runs the exploit inside a sub-invocation that ends by checking the invariant and then **deliberately failing** with error code `EXPLOIT_PROVEN`. Soroban rolls back the failed sub-call's state changes, so the live protocol is untouched. The outer call sees the specific error and pays the bounty. It can also flip a `paused` flag that the target honours as a circuit breaker.
  4. Fallback mode for the MVP if the rollback trick fights us: `claim` uses `env.deployer().deploy_v2(target_wasm_hash, ctor_args)` to spin up a **fresh sandbox copy** of the target with seeded state, runs the exploit there, and checks the invariant. That is weaker, because it proves the code is vulnerable rather than the live state, but it is safe and simple.
  5. Frontend: a bounty board showing open bounties, the verifier source, and a live "claimed" feed.
- **Stellar integration (load-bearing):** The whole product is a Soroban execution property: atomic cross-contract calls, error-typed `try_invoke` with state rollback, and in-contract deployment from a Wasm hash. USDC via the Stellar Asset Contract is the bounty asset. Without on-chain execution, "proof" goes back to being a PDF report. Good fit for **Stellar Unlocked**.
- **Differentiation:** HoneyPause (EthDenver 2024) does this on Ethereum. The repo lists only a Sepolia deployment, with mainnet "TBD". The Hydra Framework (Breidenbach, Daian, Tramèr, Juels) is academic. ExploitArena uses off-chain verifier votes. I found **no Soroban equivalent**. Stellar's own bounties run through HackerOne/Immunefi with human triage.
- **90-second demo moment:** A split screen. On the left, a deliberately buggy "LisbonVault" holds 10,000 test USDC behind a 1,000 USDC Tripwire bounty. On the right, a researcher runs `stellar contract invoke ... claim`. In about 5 seconds the researcher's balance goes +1,000 and the vault shows **PAUSED**, and the vault balance is still 10,000 because the exploit was rolled back. Caption: "Proof, payment and pause in one ledger close."
- **Biggest uncertainty:** (a) Exact Soroban semantics. Does a failing `try_invoke_contract` sub-call roll back all storage and token-balance writes made by deeper calls, including SAC transfers? I believe so; **UNVERIFIED**, and it is a 1-hour spike on Saturday morning. (b) Front-running. An observer copying the claim tx before it is included. Stellar has no public mempool like Ethereum's, but transactions are flooded between validators, so the risk is **UNVERIFIED**. Commit-reveal is the mitigation, as a v2 slide. (c) Judges may see "security infra" as niche. The pitch should frame it as "insurance for every Soroban protocol's TVL".
- **Verified vs assumed:**
  - *Verified:* HoneyPause exists and is EVM/Sepolia only. Immunefi vaults still need project confirmation. Soroban supports `deploy_v2(wasm_hash, ctor_args)` from inside a contract (Stellar docs deployer example).
  - *Assumed:* the rollback semantics; that writing invariant verifiers is easy for real protocols; that no Stellar team has built this already (only searched the open web).

---

## Concept 2: QUORUM, a Kickstarter where failing pays you

**Pitch:** Group-buy and crowdfund anything local, like a Portuguese tutor for 12 expats or a band for a street party. If the goal isn't reached, every backer gets a refund **plus a bonus**, guaranteed by escrow, so joining early is a dominant strategy.

- **Domain:** coordination and mechanism design (civic and economics).
- **User:** Small organisers: neighbourhood groups, coworking communities, open-source maintainers, a café owner testing demand for a "Sunday brunch club". Plus their non-crypto friends, who pledge from their phones.
- **Problem:** Collective-action failure. Everyone waits to see if others commit, so good projects never start. Kickstarter-style all-or-nothing helps, but you have no reason to pledge early. Alex Tabarrok's **dominant assurance contract** (1998) fixes this: the organiser pre-commits a refund bonus paid to backers if the campaign fails. Lab experiments by Cason, Tabarrok and Zubrickas found early refund bonuses raise success rates by 50% or more. Almost nobody uses it because the bonus promise is **not credible** unless it is escrowed by a neutral party.
- **Solution (MVP):**
  1. The organiser creates a campaign with a goal, a deadline, a minimum pledge and a bonus pool (for example 10% of the goal), and the bonus is locked in the contract at creation.
  2. Backers pledge USDC through a shareable link. Early-bird bonus weights reward the first X% of the goal.
  3. At the deadline, anyone can call `settle()`. If the goal is met, the pledges go to the organiser and the bonus pool returns to them. If not, each backer is refunded and gets a pro-rata share of the bonus.
  4. A mobile-first page with a live progress bar and an "if this fails you earn €X" counter, which is the persuasive hook.
- **Stellar integration (load-bearing):** The mechanism *is* the credibility of the escrow. A Soroban contract holding the bonus pool and USDC pledges, with permissionless settlement, is the only thing that turns Tabarrok's theory into a credible promise without a trusted platform. Stellar's sub-cent fees make €5 pledges with automatic multi-party refunds viable. That is not true on Ethereum L1, and it is awkward with card refunds and chargebacks. Option for **Stellar Composed:** Soroban + Circle USDC + passkey smart wallets (passkey-kit / OpenZeppelin smart accounts) so backers pledge with Face ID instead of seed phrases. **UNVERIFIED** how quickly the team can integrate passkey-kit; Freighter is the fallback.
- **Differentiation:** Gitcoin documents DACs as a mechanism. EnsureDone (reported by Marginal Revolution, Jan 2024) is an off-chain DAC platform, with current status **UNVERIFIED**. I found no smart-contract DAC implementation with public code in search. Kickstarter and Indiegogo have no refund bonus. This is an Econ-Nobel-adjacent idea that has never been given a credible enforcement layer, which makes a great pitch-deck slide.
- **90-second demo moment:** Two campaigns side by side, run live with three phones. "Hire a Fado guitarist for Rua X": the goal is hit and the guitarist's wallet receives €300. "Rooftop cinema night": it misses by €40, the deadline passes, and all three phones buzz with **refund + €4.17 bonus**. Narration: "On Quorum, backing a project that fails still *earns* you money, so people stop waiting."
- **Biggest uncertainty:** Why would organisers fund the bonus? The answer is that it is the cost of a credible demand signal, like a marketing spend that is only paid on failure. Judges may want evidence of organiser demand. Second, the contract is simple, so Technical Execution and Innovation have to come from the mechanism and UX rather than protocol depth.
- **Verified vs assumed:**
  - *Verified:* the mechanism's origin and lab evidence (Bath research portal, Gitcoin mechanism page, Marginal Revolution post).
  - *Assumed:* that no on-chain DAC is live on Stellar; organiser willingness to pay the bonus; passkey integration time.

---

## Concept 3: FOOTNOTE, an AI answer engine that pays the sentences it used

**Pitch:** Each time an AI answer uses your writing, the user's micro-fee is split **per citation** to the wallets of the authors whose chunks were retrieved, atomically, in one Stellar transaction.

- **Domain:** AI and the creator economy.
- **User:** Independent writers, small blogs, documentation authors and newsletter writers who lose traffic to AI answers. Plus answer-engine and RAG app builders who want a clean licensing story.
- **Problem:** AI answers removed the click, so long-tail creators get nothing. Current fixes are deals for big publishers: ProRata/Gist shares 50% of revenue with signed publishers on a recurring schedule, and Perplexity has a publisher program. Pay-per-crawl schemes such as Cloudflare and TollBit charge for *access*, not for *use in an answer*. An individual blogger cannot sign a licensing contract.
- **Solution (MVP):**
  1. Creators register a content source
> **Note:** Concept 3 (FOOTNOTE) above is incomplete and stays that way. Drafting it was interrupted and that part is deliberately not reproduced. Treat FOOTNOTE as not evaluated.

---

## Concept 4: VOLTA, one deposit for every café's reusable cup

**Pitch:** Pay a €2 deposit once for a reusable cup. Return it at *any* participating café, not just the one that sold it, and get the deposit back. The deposit sits in a shared Soroban pool, so no single brand or operator has to hold everyone's money.

- **Domain:** physical world and circular economy (IRL hospitality).
- **User:** Independent cafés and kiosks in one neighbourhood (for example Lisbon's Cais do Sodré or a university campus), plus their takeaway customers.
- **Problem:** Reusable-cup schemes stay inside single brands or need a central operator to hold deposits and reconcile between shops. Costa's BURT trial (Glasgow, 2021) ran across 14 Costa stores only. Small independents can't run a cross-shop deposit ledger, and customers won't carry a cup back to the exact shop they bought it from. EU reuse targets for takeaway packaging and Portugal's deposit-return scheme suggest regulatory pull: **UNVERIFIED**, I did not check the exact dates or scope.
- **Solution (MVP):**
  1. Each cup has a QR sticker that maps to a cup ID registered in the `Volta` contract.
  2. **Checkout:** the café scans the cup, the customer pays the coffee plus a €2 USDC deposit, and the contract records `cup -> holder` with the deposit held in the pool.
  3. **Return:** the customer drops the cup at any member café, staff scan it, the contract releases €2 to the customer and marks the cup as stocked at that café.
  4. **Rebalancing:** a café that takes in more cups than it hands out can see that on a dashboard. A small handling fee per return can be paid from the pool. Settlement between cafés is automatic, so there is no monthly reconciliation.
  5. Two web views: a café scanner (phone camera, QR) and a customer page showing "my cups / my deposits".
- **Stellar integration (load-bearing):** The product is the neutral shared deposit pool. Many independent businesses need a ledger none of them controls, where money moves the instant a cup is returned anywhere. Soroban holds the deposits and the cup state, and USDC through the Stellar Asset Contract keeps the €2 stable. Stellar's sub-cent fees make a €2 refund economical, which card refunds are not. Option for **Stellar Composed:** add passkey smart wallets so customers don't need a crypto app. How fast the team can integrate those is **UNVERIFIED**.
- **Differentiation:** Costa BURT used blockchain tracking but was single-brand with no stablecoin refunds. RecyCan (ETHGlobal Cannes 2026) is a hackathon mock for bottles and cans with refunds to the same wallet, not a multi-vendor pool. Revolv (on World Economic Forum pages) describes returns at any participating café but names no on-chain settlement. I found no pilot combining multi-vendor returns with automatic stablecoin refunds.
- **90-second demo moment:** Two phones as "Café A" and "Café B", plus a customer phone. Café A scans a cup and the customer pays €3.50 + €2 deposit. We walk across the room to Café B, which scans the same cup, and the customer's phone pings **+€2 refunded** while Café B's stock counter ticks up. Caption: "Bought here, returned there, refunded in five seconds, and no company in the middle."
- **Biggest uncertainty:** (a) Weak on Innovation versus Concepts 1 and 2. It reads as "deposit app" unless the multi-vendor neutral pool is the headline. (b) Real-world friction: cups going missing, deposits lower than the cup cost, staff willingness to scan. (c) The demo is logistics-heavy for a 90-second video, though it is very visual.
- **Verified vs assumed:**
  - *Verified:* Costa BURT trial details (14 stores, £5 deposit, QR unlink on return); RecyCan exists as a mock-interface hackathon project; Revolv description on WEF pages.
  - *Assumed:* café demand; the EU/Portugal regulatory angle (**UNVERIFIED**); no Stellar team having built it.

---

## My own ranking of my 4 and why

Only three concepts are fully written up. FOOTNOTE (3) is incomplete and I'm not ranking it.

1. **TRIPWIRE.** Most novel on Stellar (no Soroban equivalent found), and the Stellar usage is deepest: atomic sub-call rollback plus in-contract deployment fits Stellar Unlocked exactly. The demo moment (paid, paused, funds untouched) is unforgettable. Risks: one technical spike on rollback semantics, and a "niche" perception that the pitch has to handle.
2. **QUORUM.** Strongest user-value story for non-technical judges, a real economics result behind it, and the simplest contract to build reliably in 20 hours. Lower technical depth, so Innovation has to come from the mechanism and the UX.
3. **VOLTA.** Clear IRL value and a visual demo, but the least surprising of the three and the most dependent on real-world operations we can't prove in a weekend.
- **FOOTNOTE:** not ranked (write-up unfinished).

If the committee wants the safest high score, pick Quorum. If it wants the most likely "nobody else built this", pick Tripwire, but only if the rollback spike passes by Saturday midday. Otherwise fall back to the sandbox-copy mode.
