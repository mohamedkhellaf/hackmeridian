# 04 — Judging Framework (Agent 4, Ruthless Judge)

Written blind (no other research/ files read). Sources retrieved 2026-10-25. Anything not confirmed from a fetched page is marked **UNVERIFIED**.

---

## 1. Official rules: confirmed or corrected

Sources: https://www.hackmeridian.com/build, https://www.hackmeridian.com/ (home), https://www.hackmeridian.com/faq, https://www.hackmeridian.com/terms.html

| Item the Chairman was told | Status | Source quote / correction |
|---|---|---|
| Genesis = Idea → MVP | **CONFIRMED** | Build: "Genesis is where a new idea becomes an MVP." Judged "Idea → MVP". (Scale = "Prototype → Product".) |
| Track "Stellar Unlocked" = novel meaningful use of protocol capabilities | **CONFIRMED, wording differs** | Build: "Your project gets something new out of Stellar's core protocol features." The word is *core protocol features*, not "capabilities". Judges will look for native features (SAC/assets, auth/smart accounts, multisig, path payments, claimable balances, sponsorship, muxed accounts, new host functions), not "we deployed a Soroban contract". |
| Track "Stellar Composed" = combine ≥2 ecosystem projects/tools | **CONFIRMED** | Build: "Your project combines two or more ecosystem tools or projects into something new." |
| Tracks are Genesis-only | **CONFIRMED** | "thematic tracks available only to Genesis projects." FAQ says Genesis builders can join **both** tracks. |
| Weights: Track Alignment 20, User Value & Problem 20, Technical Execution 15, Innovation 15, Hackathon Progress 10, Market & Ecosystem Potential 10, Product Design & UX 10 | **CONFIRMED** (Build and FAQ match) | "Each criterion is scored 1–5." "One rubric scores every project." |
| Priority: Adoption, Discovery, Continuation | **CONFIRMED, but undefined** | "Judging priority order: Adoption → Discovery → Continuation." None of the pages define the three terms. My reading (an interpretation, not verified): Adoption = will real users use it, Discovery = does it surface something new about Stellar, Continuation = will the team keep building (SCF pipeline). |
| Genesis path criteria | **CONFIRMED (extra detail)** | "Problem clarity, MVP quality, Stellar integration, Continued development potential." Use these four as the lens on every proposal. |
| Deliverables | **CONFIRMED** | "the demo video, pitch deck, GitHub repo, and submission answers", judged async. "A clear README that shows how your project works, including its specs, does most of the work for judges." |
| Video length | **NOT STATED** on any page. Assume 2–3 min unless the submission form says otherwise (UNVERIFIED). |
| Deadline | **CONFIRMED** | Mon 26 Oct 12:00, "No late submissions." Hacking started Sun 25 Oct 09:00. |
| Prizes | **$30,000 across 6 winners**, "paid in the equivalent value of XLM", "awarded on merit". FAQ: split "across the Genesis and Scale paths", "final breakdown is announced before the event". The per-track split is not on the site. |
| Finalists | Live pitches only for finalists, Wed 28 Oct (FAQ: 13:50) at Meridian, Convento do Beato, followed by a VC finale. **The deck and video must work without us in the room.** |
| Team size | Up to 5 (FAQ). |
| AI tools | Allowed ("Claude Code, Cursor … welcome"). |
| Pre-existing work | **No explicit rule.** The closest guidance is the Hackathon Progress criterion: "Can you clearly demonstrate what you built or improved during the event?" Terms: the submission must be "original or properly licensed"; plagiarism and misrepresentation are prohibited. Implication: git history should show all commits on Oct 25–26, and any reused library or template should be credited in the README. |
| IP / open source | "You own what you build." No open-source requirement, but the repo is judged, so it must be public (or shared). |
| Testnet vs mainnet | Not specified. Testnet is acceptable by convention (UNVERIFIED as a rule). |

**Context, HackMeridian 2025 (Rio)** (stellar.org/blog/foundation-news/the-blueprint-at-meridian-2025): 400+ builders, 110+ submissions, $50k pool. Tracks were Open Innovation (56 projects) and Composability (35 teams on Blend, Soroswap, DeFindex, Kale, Reflector). Innovation winners: The Simple Fund, 4Bridge, Stellar Forge. Composability winners: Lance, Star Lends, Panorama Block. What each project built is UNVERIFIED. Lesson: the 2025 "Composability" track maps directly to 2026 "Composed", and the named primitives (Blend, Soroswap, DeFindex, Reflector) are what judges expect to see composed. **Expect around 100+ submissions competing for 6 prizes.** Roughly 5% win.

---

## 2. Competitive landscape

### What has won (verified items only)
- **HackMeridian 2025:** see above. 2 of 6 names suggest DeFi or lending ("Star Lends", "The Simple Fund"). The rest are opaque.
- **Stellar Build Better (DoraHacks):** 1st place PayZoll (AI + payroll). 84 approved projects. Payroll **has already won**, so a new payroll project reads as derivative.
- **Stellar Hacks: Real-World ZK (DoraHacks, mid-2026, $10k pool, $5k first):** 1st place Wraith (shielded DeFi pool and order book), 2nd ANCHORSHIELD. The placements come from search-snippet titles of the DoraHacks winner page; the page itself returned 405. **UNVERIFIED.** Signal: ZK on Stellar has had a dedicated hackathon, so judges have seen many ZK privacy demos.
- **Sorobanathon 2023:** 1st place Cowchain Farm (idle game). Old.

### What the ecosystem is pushing in 2026 (verified via docs)
- **Smart accounts / auth:** Protocol 27 "Zipper" (CAP-71, mainnet Jul 8 2026) adds auth delegation for custom accounts and address-bound credentials (social recovery, delegated signing). Protocol 28 (mainnet Sep 16 2026) adds CAP-83, CAP-85 (externally managed contract executables) and CAP-86 (sparse map host functions). Protocol 29 (Oct 1 2026) adds no CAPs. That a later protocol brings "contract auth for classic accounts" is a forward-looking claim and UNVERIFIED. **This is the freshest "Unlocked" surface: few people have built on CAP-71 yet.**
- **ZK:** P25 X-Ray (BN254 and Poseidon) and P26 (CAP-80 BN254 additions) are live on mainnet. They are real but already worked over by a ZK hackathon.
- **Agentic payments / x402 / MPP:** first-class docs exist (developers.stellar.org/docs/build/agentic-payments), with an OpenZeppelin facilitator and Freighter support. "Build with AI powered by Stellar" Builder HQ events fed into this hackathon (luma listings). **Prediction: x402 or AI-agent-pays-for-API will be the #1 saturated category at this event.**
- **Oracles on testnet:** Reflector, RedStone, Band, DIA, Pyth, Chainlink all list testnet contracts (developers.stellar.org/docs/data/oracles/oracle-providers). This is not a blocker.

### Saturation map (my judgment, apply as a novelty penalty)
| Category | Saturation | Why |
|---|---|---|
| Remittances / cross-border send app | **Very high** | It is Stellar's founding use case. Every hackathon gets 10+ of these. |
| Payroll / streaming salaries | **Very high** | It has already won (PayZoll). |
| AI agent + x402 paywall / API payments | **Very high (predicted)** | It is the current SDF marketing push and the pre-event workshops pushed it. |
| Generic DeFi (yet another DEX, lending, yield vault) | **High** | Blend, Soroswap, DeFindex and Aquarius exist, so a new one competes with production. |
| NFT tickets / loyalty / cashback | **High** | Lumina (green cashback) was seen in 2025. Weak Stellar-specific angle. |
| Crowdfunding / donations / charity transparency | **High** | Easy to build, judges have seen dozens. |
| RWA tokenization dashboard (fake asset, no issuer) | **High** | It reads as a mock-up without a real issuer or compliance story. |
| ZK private payments | **Medium-high** | A ZK-specific hackathon just ran. |
| Smart-account features (delegation, recovery, session keys via CAP-71) | **Low-medium** | New since July 2026 and protocol-native, which fits Unlocked. |
| Vertical composition (e.g., Blend + Reflector + anchor for a specific real user segment) | **Medium** | It wins when the user and problem are concrete. |

---

## 3. Failure modes

### Generic hackathon mistakes (these kill async-judged entries)
1. **The demo video shows slides, not product.** Judges need to see a real tx hash or explorer link inside the first 60s.
2. **The problem is invented ("users want transparency").** There is no named persona, no number, no quote.
3. **Blockchain is decorative.** If a Postgres DB does the same job, User Value and Track Alignment both tank.
4. **Scope creep.** Five half-features lose to one complete loop. MVP quality is a named Genesis criterion.
5. **The README is a template.** The organizers say the README "does most of the work".
6. **No deployed contract ID, or a broken live link.** Judges click the links.
7. **Commit history doesn't show event-time work.** Hackathon Progress is 10%, and history raises misrepresentation questions.
8. **The pitch claims mainnet, users or partners that don't exist.** One false claim discredits everything.
9. **The video is recorded at 11:55.** Lock the feature set by Mon 08:00 and record by 10:00.
10. **No story for Continuation.** Judges want to see a next step, SCF fit and a team commitment.

### Stellar / Soroban feasibility traps (for a team with no Soroban experience)
| Trap | Reality (verified unless marked) | Mitigation |
|---|---|---|
| Testnet reset mid-hackathon | Next reset is **Dec 16 2026** (developers.stellar.org networks page). Resets run 2–4 times a year and are announced 2 weeks ahead. **Safe for this event.** | Still script deploys (`--alias`) so a redeploy takes one command. |
| Toolchain version drift | soroban-sdk 28.0.0, stellar-cli 28.1.0, JS SDK v17.x are current for P28/29 (software-versions page). | Pin versions in Cargo.toml and package.json. Don't mix SDK majors. TS bindings must be regenerated after every contract change. |
| TS bindings | `stellar contract bindings typescript` produces a package that needs its own `npm install && npm run build`, and it is tied to one contract ID. | Budget 1–2 hours the first time. Or call `contract.Client` directly from stellar-sdk. |
| Freighter integration | Wallet popups, network mismatch (Freighter set to mainnet while the app expects testnet), and unfunded accounts are common demo failures. Freighter signs auth entries (x402 docs). | Check the network and show a clear error. Fund via Friendbot in the onboarding. Consider Stellar Wallets Kit. Pre-fund demo accounts. |
| Passkeys / smart wallets | Possible: Meridian Pay, Cheesecake Labs PoC, SoroPass and OZ AccountFactory exist. But WebAuthn needs secp256r1 verification, a factory contract, a relayer or fee-payer for the first tx, and HTTPS / a real origin. Easily a full day for newcomers (my estimate). | Use an existing kit only. Don't hand-roll WebAuthn parsing. Have Freighter as a fallback path in the demo. |
| CAP-71 delegation (Zipper) | It is new (Jul 2026), so examples and SDK support may be thin. **The level of SDK and wallet support is UNVERIFIED.** | Spike for 1 hour first. Kill it if no working example exists in soroban-sdk 27/28. |
| ZK host functions | BN254 and Poseidon are live (P25/P26). You still need a circuit (circom/noir), a trusted setup and a Groth16 verifier contract. Newcomers will lose the whole window here. | Only with a ready-made verifier example. Otherwise kill it. |
| Anchors | testanchor.stellar.org gives SEP-6/24 flows on testnet only, with fake fiat. The KYC is fake. | It is fine for a demo, but say "simulated fiat ramp". Never claim a real ramp. |
| Oracles | Testnet feeds exist (Reflector, RedStone, Band, DIA, Pyth, Chainlink). Testnet prices may be stale or odd (UNVERIFIED). | Read `lastprice` early and handle a `None` result. |
| Resource limits | Wasm size, CPU and IO limits change by protocol. Check them with `stellar network settings` or lab.stellar.org/network-limits. | Keep contracts small. Avoid big loops over storage. Remember TTL and archival: unextended persistent entries expire. |
| Storage TTL / archival | Entries expire unless extended. A demo built on Sat can still work Wed, but don't count on it. | Call `extend_ttl` on writes. Re-check everything works on Wed 28 if we are finalists. |
| SAC vs custom token | Use the Stellar Asset Contract for issued assets. Hand-rolling a token wastes time and scores badly on "Unlocked". | `stellar contract asset deploy`. |

---

## 4. Scoring guide (Genesis, Idea → MVP, judged from video, deck and repo)

Weighted score = Σ(score × weight). The maximum is 5.0. **A realistic winning bar is ≥ 4.0. Below 3.5 is noise.**

| Criterion (weight) | 1: weak | 3: average entry | 5: winner |
|---|---|---|---|
| **Track Alignment (20%)** | Stellar is a payment rail that could be swapped for any chain. Unlocked: "we deployed a contract". Composed: one tool. | It uses Soroban plus one native feature, or composes 2 tools superficially (e.g., reads one oracle price). | **Unlocked:** the core value *depends* on a protocol-native feature (CAP-71 delegation, SAC, path payments, claimable balances, sponsored reserves, muxed accounts, BN254) that judges haven't seen used this way. **Composed:** ≥2 named ecosystem projects (Blend, Soroswap, DeFindex, Reflector, an anchor, OZ, x402 facilitator) wired so the combination creates something neither offers alone, and it shows on-chain. |
| **User Value & Problem (20%)** | Abstract problem, no persona, "for everyone". | Plausible persona, generic pain, no evidence. | A named, narrow user (e.g., "Lisbon freelancers paid in USDC by US clients"), a quantified pain (fees, days, % unbanked), ideally a real quote or interview, and a clear before/after in the demo. |
| **Technical Execution (15%)** | Mocked frontend, no deployed contract, or broken. | Contract on testnet plus a UI that works on the happy path. Thin tests. | Deployed contract IDs in the README, tests that pass in CI, a clean end-to-end flow with real signed transactions, error handling, and a sensible architecture diagram. Non-trivial contract logic (auth, invariants). |
| **Innovation (15%)** | Clone of a saturated category (see §2). | Known idea with a twist. | Judges say "I haven't seen that on Stellar." A new mechanism, not just a new UI. |
| **Hackathon Progress (10%)** | Unclear what was built here. Large initial commit. | Commits over the event, but scope is unclear. | Commit history across Oct 25–26, the README states exactly what was built during the event, and the demo matches it. |
| **Market & Ecosystem Potential (10%)** | No market, or a market Stellar can't reach. | TAM slide with a big number. | A specific go-to-market (who pays, first 100 users, which Stellar partner or anchor distributes it), SCF follow-on fit, and it drives on-chain activity or TVL for existing ecosystem projects. |
| **Product Design & UX (10%)** | Raw dev UI, wallet errors, crypto jargon. | Clean template UI, a few rough edges. | A non-crypto user could finish the flow. Fees, keys or onboarding are hidden or explained. The video is tight and narrated. |

**The video test** (apply to every proposal): could we show a convincing 2-minute video where a real on-chain transaction delivers the core value by 00:45? If not, the proposal fails.

---

## 5. Kill checklist (applied in later rounds)

A proposal is **killed** if it fails any **K** item. It is **flagged** (needs a fix or evidence) for each **F** item. Three or more flags count as a kill.

### Hard kills (K)
- **K1. The Postgres test.** If the core value works equally well with a centralized DB plus Stripe, it fails Track Alignment (20%) and User Value.
- **K2. Saturated without a mechanism twist.** Remittance, payroll, x402 paywall, generic DEX or lending, NFT tickets, donations or crowdfunding, *unless* the novelty is a protocol mechanism and not a vertical label.
- **K3. The critical path depends on an unproven integration.** This means a step no one on the team has seen working in 24h: hand-rolled ZK circuits, hand-rolled WebAuthn, CAP-71 without a working example, a real fiat ramp, mainnet KYC. It has to pass a **1-hour spike by Sun evening** or it dies.
- **K4. No demoable on-chain loop by Sun midnight.** If the build plan can't produce a deployed contract plus one signed tx from the UI in about 12h, kill it.
- **K5. No named user with a concrete pain.** "Users", "the unbanked" or "DeFi users" are not personas.
- **K6. Track ambiguity.** If we can't say in one sentence *which* track it targets and *which* core feature or which ≥2 ecosystem projects it uses, kill or reshape it.
- **K7. Honesty risk.** The pitch requires claiming partners, users, real money flows or regulatory status we don't have.

### Flags (F)
- **F1.** More than 2 smart contracts, or more than 1 new external integration. Too much for newcomers in 24h.
- **F2.** The main "wow" happens off-chain (AI, a backend) and Stellar is only settlement.
- **F3.** It needs real liquidity or prices on testnet to look good (thin testnet pools, stale feeds).
- **F4.** UX requires the judge to install a wallet and get test XLM themselves. The video must carry the demo, and a hosted demo should be optional.
- **F5.** No Continuation story: no plausible SCF ask or next milestone.
- **F6.** It overlaps an existing production project (Blend, DeFindex, Meridian Pay, Aquarius), so "why not just use X?" has no answer.
- **F7.** The idea only makes sense with a marketplace or network effects (two-sided, cold start).
- **F8.** The demo depends on timing (streaming over days, vesting, expirations) and can't be shown in 2 minutes without a "fast-forward" mode.

### Evidence that would change my mind (asked of every proposal)
1. A link to a working example or repo of the riskiest integration on current SDK versions.
2. One real user quote, or a public data point, for the pain.
3. A one-sentence answer to "why Stellar and not Base or Solana?" that cites a specific protocol feature.
4. A storyboard of the 2-minute demo, with timestamps.
5. Hour-by-hour build plan split across 3 engineers, with a cut line (what we drop at 06:00 Mon).

---

## 6. Expected score sheet template (for comparing proposals)

| Proposal | Track (20) | User (20) | Tech (15) | Innov (15) | Progress (10) | Market (10) | UX (10) | Weighted | Kills | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| … | | | | | | | | | | |

Weighted = (T×20 + U×20 + Te×15 + I×15 + P×10 + M×10 + UX×10) / 100.
