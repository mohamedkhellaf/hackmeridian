# 09: Independent final scoring (Ruthless Judge)

Written Sun 2026-10-25, about 14:00 WET, after reading all four `08_dd_*.md` files. No agents were consulted during scoring.

**Inputs that changed scores since Round B**
- The Problem Hunter's due-diligence work added **Argent** (guardians, a trusted-contacts allowlist that bypasses limits, guardian co-sign above the limit, since 2020) and **Volta Circuit**, an SCF-funded Stellar wallet with spending limits, time locks and whitelists, as prior art for F1.
- It added **Trustlines Network** (Ripple-style credit lines with netting, on Ethereum) as prior art for F2.
- **Liana** is prior art for F3 [V, links in `08_dd_problem_hunter.md`].
- The Architect's estimates: F1 hybrid ≈30 dev-h (Lite ≈24) of ~36 available, F2 ≈20, F3 ≈14.
- The Wildcard's demo ratings (memorable / reproducible): F1 5/4, F2 4/5, F3 3/4.

**Scoring basis.** Integer scores (1–5) on the official rubric. Weighted = Σ(weight × score / 5).

---

## F1: Second Thought (hybrid: Lite 1/2/2 first, Full 1/3/3 with a stateless co-signer from about hour 6; Heirloom hatch flagged)

| Criterion (weight) | Score | Why |
|---|---|---|
| Track Alignment (20) | **4** | Unlocked: claimable-balance time predicates, weighted thresholds and op-source authorization are used for consumer protection without a contract, and every refusal is verified on testnet. It isn't a 5 because the rule that decides *which* payments get the window lives in our server (Full) or app (Lite), and the "delegate claims a CB" building block is a documented Stellar pattern. |
| User Value & Problem (20) | **4** | An evidenced, specific harm: "Hi Mum" impersonation, where people 55+ make 82% of reports and bear 95% of losses (ACCC), and the impersonated child is the guardian. The mechanism resolves that subtype for one family on day one. It isn't a 5 because Stellar-specific incidence and the existence of older self-custody USDC holders are unproven. |
| Technical Execution (15) | **4** | Every guarantee is verified on testnet (spikes a/e/f/g). The hybrid plan de-risks the build: Lite flows are identical, and Full adds one co-signature. It isn't a 5 because of the team's first backend, about 6h of buffer, and server uptime through async judging. |
| Innovation (15) | **3** | The concept already ships elsewhere: Coinbase Vault (2014 delay + cancel), Argent (guardians + trusted contacts), bank new-payee cooling periods, LOBSTR Vault and Volta Circuit on Stellar. The real delta is narrow: undo-by-default after sending, by a guardian who can never spend, on a plain classic account, enforced by validators. |
| Hackathon Progress (10) | **4** | Everything is built during the event. A clear staged plan (Lite by about hour 6, then Full) makes progress visible and credible. |
| Market & Ecosystem Potential (10) | **3** | About 719k funded USDC G-accounts [V], unsegmented and including exchanges and anchors. The plausible path is a feature for LOBSTR-class wallets (interest is [S]); MoneyGram/Crossmint is not a drop-in channel. Banks already sell this pattern, which validates demand. |
| Product Design & UX (10) | **4** | Two self-explanatory network refusals plus an instant "money is back" beat. Judges need no wallet: in-app keys and a role switcher. It isn't a 5 because of four role tabs and multisig setup that Mum couldn't do alone. |
| **Weighted** | **75** | 16 + 16 + 12 + 9 + 8 + 6 + 8 |

## F2: Loop

| Criterion (weight) | Score | Why |
|---|---|---|
| Track Alignment (20) | **5** | The DEX and path payments as a clearing house, through one self-to-self path payment, verified on testnet. A near-literal answer to the organizers' "old-school assets, new tricks" prompt, with no server and no contract. |
| User Value & Problem (20) | **2** | The problem (trade-credit gridlock) is real. But the evidenced Portuguese pain is linear late-payment chains, which netting doesn't touch. Cycles are only evidenced at network scale (Sardex). One firm gets nothing until its whole cycle joins, and firms won't publish payables. Unless the SME call finds a closed cycle, the MVP resolves the problem for no specific user. |
| Technical Execution (15) | **4** | Core clearing verified (tx fce43284…), frontend-only, ≈20 dev-h. Risks: 4–6-firm cycles and stale offer liabilities are not spiked, and the graph UI has to carry the demo. |
| Innovation (15) | **4** | The mechanism is new on Stellar (Scout-clean). But netting (AJPES, Sardex, treasury netting) and decentralised rippling credit networks (Trustlines Network on Ethereum, RipplePay) exist. The novelty is "natively in the protocol", not the concept. |
| Hackathon Progress (10) | **4** | Clean scope, all built during the event. |
| Market & Ecosystem Potential (10) | **2** | No named buyer or cluster. A database operator does the same for users. The intercompany reframe weakens "why blockchain". |
| Product Design & UX (10) | **3** | "€X cancelled, €0 moved" is striking, but a 3-hop IOU graph is hard for non-finance judges, and B2B fails the "my mom" test. |
| **Weighted** | **70** | 20 + 8 + 12 + 12 + 8 + 4 + 6 |

## F3: Heirloom (standalone)

| Criterion (weight) | Score | Why |
|---|---|---|
| Track Alignment (20) | **5** | Pure CAP-21 `minSeqAge` pre-signed recovery, a two-stage will, BumpSequence revocation and a fee-bump claim. All verified; validator-enforced, no contract. |
| User Value & Problem (20) | **2** | The only demand evidence is a 2019–20 survey (89% worry, 23% have a plan). No Stellar user count. Cold holders are inactive by design, and receive-mostly users need a heartbeat because inbound payments don't reset the clock. |
| Technical Execution (15) | **4** | Lowest-risk build (≈14 dev-h), frontend only. It isn't a 5 because the product's value isn't exercised at real timescales. |
| Innovation (15) | **3** | Liana already ships network-enforced inactivity-timelocked recovery on Bitcoin. CAP-21 itself names "time-delayed key recovery". Stellar has 3+ prior inheritance builds. Delta: account-level, any transaction is the heartbeat, no fund movement. |
| Hackathon Progress (10) | **4** | Small, clean and complete. |
| Market & Ecosystem Potential (10) | **2** | A crowded category with a familiar pitch, and no partner or user number. |
| Product Design & UX (10) | **3** | One clever beat ("coffee resets the clock"), but the value is "nothing happens for 180 days", which needs a labelled time skip, and the payoff is abstract. |
| **Weighted** | **67** | 20 + 8 + 12 + 9 + 8 + 4 + 6 |

## Summary table

| | TA 20 | UV 20 | TE 15 | Inn 15 | HP 10 | MEP 10 | UX 10 | **Total** |
|---|---|---|---|---|---|---|---|---|
| **F1 Second Thought** | 4 | 4 | 4 | 3 | 4 | 3 | 4 | **75** |
| **F2 Loop** | 5 | 2 | 4 | 4 | 4 | 2 | 3 | **70** |
| **F3 Heirloom** | 5 | 2 | 4 | 3 | 4 | 2 | 3 | **67** |

**My pick: F1 Second Thought**, with the conditions below. The gap to F2 (5 points) comes entirely from User Value and Market (−12 for F2) against Track and Innovation (+7 for F2).

---

## Decision factors (not official criteria)

| Factor | F1 Second Thought | F2 Loop | F3 Heirloom |
|---|---|---|---|
| MVP completion risk | **Med.** ≈30 of ~36 dev-h, with the first backend; the Lite fallback (≈24h) caps the downside. | **Low–Med.** ≈20h; longer cycles and offer liabilities unspiked. | **Low.** ≈14h. |
| Demo failure risk | **Med.** Server uptime Mon–Wed, `tx_bad_seq` races, clock skew. Mitigated: the hero undo needs no server, plus Family mode. | **Low** technically (no server). **Med** for comprehension. | **Low–Med.** The seqTime initialisation trap (scripted away), and a waiting window the judge must not touch. |
| Critical dependency risk | **Low–Med.** Horizon/friendbot plus our own stateless function. No third-party relayer, anchor or oracle. | **Low.** Horizon/friendbot only. | **Low.** Horizon/friendbot only. |
| Competitive differentiation confidence | **Med.** Coinbase Vault, Argent, LOBSTR Vault, Volta Circuit, bank holds; the delta is real but narrow, and the domain has AI twins. | **Med.** High to protocol judges, low to users; Trustlines Network and SettleZK/zkNexus exist. | **Low–Med.** Liana is a direct analogue; 3+ Stellar inheritance builds. |
| Potential for compelling future development | **Med–High.** Mainnet-ready unchanged; a natural SCF/partner story as a LOBSTR-class wallet feature or SDK; bank-validated pattern. | **Low–Med.** Needs a platform holding the invoice graph and an answer on privacy. | **Med–Low.** A wallet feature at best; already done elsewhere. |

---

## FINAL ARGUMENT AGAINST THE LEADING CONCEPT (F1)

This is the strongest honest case that building F1 loses. I scored F1 highest and I am not softening this.

### 1. The user we demo may barely exist, and our 4/5 on User Value rests on an analogy.
- The ACCC figures describe Hi Mum scams paid by **bank transfer** from ordinary bank accounts [V source context]. We have **zero** evidence that people over 55 hold self-custodied USDC on Stellar G-accounts, or have ever been Hi-Mum-scammed from one [U].
- The "719k funded USDC accounts" figure is unsegmented. It includes exchange, anchor and bot accounts, plus crypto-native traders [A].
- The Wildcard named this as the largest assumption in the case: "Stellar's self-custody USDC holders face the same imposter-scam exposure as the general population" [A].
- The only concrete channel we found for older non-technical USDC holders (MoneyGram Colombia) uses Crossmint smart wallets, where our classic-account design cannot be installed [V/A].
- If that assumption fails, F1 solves a real problem **for a population that isn't on Stellar**. User Value drops to 2–3, and F1 falls to about 67–71, level with Loop.

### 2. It is a well-known product with a narrow twist, in a domain other teams will also enter.
- Coinbase Vault (2014): delay plus cancel plus approvers.
- Argent (2020): guardians, plus a trusted-contacts allowlist that bypasses limits, plus guardian co-signing above the limit. That is F1's known-payee / new-payee split almost exactly.
- Bank cooling periods for new payees: Singapore, the UK, Australia.
- On Stellar itself: **LOBSTR Vault** (co-signer with push approval) and **Volta Circuit** (SCF-funded: spending limits, time locks, whitelists).
- A Stellar-ecosystem judge can fairly summarise F1 as "LOBSTR Vault plus Argent's trusted contacts". The only genuinely new piece is "undo after sending instead of approve before sending", which is a UX inversion, not a capability.
- All four committee agents converged on this idea independently. The judges warned explicitly that teams asking the same AI tools produce similar entries. Scout already holds AI scam-protection wallets (ScamGuardAI, TrustGenome AI) [V]. We should expect at least one "guardian / scam-safe wallet" twin in the room [S].
- With about 3 Genesis prize slots, a solid-but-familiar entry can easily land 4th–6th.

### 3. The "protocol-native" story is thinner than our pitch implies, and protocol judges will notice.
- The decision that matters, which payments get delayed, is made by **our server** (Full) or **our app** (Lite). That is app logic, not the protocol.
- What validators enforce is: a claimable balance cannot be claimed before T, and multisig thresholds. Claimable balances were designed for exactly this. The "low-threshold delegate claims a claimable balance" pattern is in Stellar's own CLI docs [V].
- In Lite mode, Mum can bypass the whole thing from any other wallet. That is precisely the objection that made us add the server.
- Judges like Garand Tyson and Tyler van der Hoeven could reasonably score Track Alignment at 3. That alone costs 4 points.

### 4. Complexity is concentrated exactly where judges test.
- Four roles, three keys, a policy server, an allowlist with a 24h cool-off, a Family-override mode and a flagged hatch.
- ≈30 of ~36 dev-h for a team new to Stellar, including its **first backend holding a secret key**.
- Judges "literally just use the product" [V-verbal]. In async judging they must navigate four tabs and, if the function is cold or down, a "Family mode" detour.
- Mum cannot set this up alone; the child has to. The "my mom can use it" claim is really "my mom's child can configure it".

### 5. It adds real friction to legitimate payments, in a market where urgency is often genuine.
- Every first payment to a new person waits 24h. Recipients must actively *claim* it. Exchanges and many wallets never claim claimable balances [A]. Each pending payment locks reserve.
- For remittance families, the very users we re-seated onto, urgent first payments (rent, medical, a new landlord) are common [A]. A product that delays them will be switched off, and switched-off protection protects nobody.

### 6. Opportunity cost: we may be choosing "safe" in a contest that rewards "distinct".
- Loop wins Track Alignment and Innovation (35% of the score), needs no server, and is the room's only genuine "off-the-wall" Discovery entry. Elliot said those "stand out most" [V-verbal].
- If our User Value assumption for F1 (point 1) is wrong, F1's advantage disappears and we will have spent the build on the more crowded idea.

### What we should do instead, or change (in order of preference)
1. **Make the evidence fix today, and gate the build on it.**
   - The relative call (`08_dd_ruthless_judge.md` §E4) must show that the scam happened via a payment flow where a pending, undoable payment would have arrived in time.
   - In parallel, find ONE real older or remittance-family person who holds USDC (or any Stellar asset) in a classic wallet. If the team can't, re-scope the user honestly: a **"self-custody stablecoin user + trusted family member"**, not an elder.
2. **Shrink F1 to its one novel primitive and frame it as a wallet feature, not a wallet.**
   - Ship as a **reference integration plus SDK for LOBSTR-class wallets**: three roles (Mum, Daughter, Stranger), the undo window, and the guardian who can never spend.
   - Treat the policy co-signer as the stage-2 hardening shown in one beat, and drop the Heirloom hatch from the video.
   - Name Coinbase Vault, Argent, LOBSTR Vault and Volta Circuit on one slide, and claim only "undo-by-default after sending, on a plain classic account, with no contract".
   - This lifts Continuation and Market Potential and removes the "yet another wallet" read.
3. **Keep honest go/no-go checkpoints.**
   - All Lite flows green on the **hosted** URL by ~21:00 tonight (about hour 6 of build). Otherwise freeze scope.
   - Full co-signer green by 06:00 Monday. Otherwise ship Lite with downgraded claims, as the Architect proposed.
4. **Switch to Loop only on evidence.** If the SME call finds a real closed cycle and acceptance of a pseudonymous graph, AND the relative call undermines F1's premise, Loop becomes the better bet and should be built instead, not alongside.

---

## Addendum: after the responses to the final argument (about 14:15 WET)

Responses came from the Architect (points 3–4), the Wildcard (points 2 and 6) and the Problem Hunter (points 1 and 5).

**Accepted**
- **The Architect's scope cut:** 3 roles, a two-rule stateless policy, no Heirloom hatch or cool-off, about 22–24 dev-h. Checkpoints are 21:00 for Lite and 01:00 for Full, with a 06:00 hard stop.
  - The simplified server rejects allowlist edits, so adding a payee needs the guardian. That is stronger than the cool-off design.
  - The README must disclose that a compromised server plus a phished Mum key reaches 3 and can spend: no SINGLE compromise moves money.
- **The Wildcard's "pull the plug" hero beat:** with the server OFF on camera, the claim refusal, the undo and "the guardian can't spend" all still work. Also the predicate shown on stellar.expert.
- **The Problem Hunter's honest re-scope of the user:** a non-crypto-native family saving digital dollars in a self-custody Stellar wallet, plus one trusted member.
  - Vibrant-class Argentine savers are the evidenced class [V]. Their usefulness as a channel is [U].
  - ACCC figures are cited only as the attack pattern.
- **The guardian-approve instant path:** Mum + guardian = 3.

**Rejected**
- The Wildcard's amendment to switch to Loop on F1 UV 3 with an inconclusive SME call. Re-scoped F1 still beats Loop.

**Updated scores**

| | TA | UV | TE | Inn | HP | MEP | UX | Total |
|---|---|---|---|---|---|---|---|---|
| F1 Second Thought (re-scoped, SDK framing) | 4 | 3 | 4 | 3 | 4 | 4 | 4 | **73** |
| F2 Loop | 5 | 2 | 4 | 4 | 4 | 2 | 3 | **70** |
| F3 Heirloom | 5 | 2 | 4 | 3 | 4 | 2 | 3 | **67** |

**Pick unchanged: F1**, conditional on the ~17:00 call gate. Switch to Loop only if F1's user premise fails AND the SME call is positive (a closed cycle, and the firms accept a pseudonymous public graph).
