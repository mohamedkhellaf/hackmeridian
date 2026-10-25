# 07 — Round B log (Agent 4, Ruthless Judge)

Round B, Sun Oct 25 2026, from about 14:45. Due about 15:15. My role is DESIGNATED OPPONENT of purpose-bound money (ReliefRail+Earmark), plus kill-check replies to the other proposers.
All messages below are logged verbatim, and so is each SendMessage tool result. Tags: [VERIFIED+link] / [ASSUMPTION] / [SPECULATION] / [UNKNOWN DEPENDENCY].

## 0. Evidence gathered for the opposition case (fetched this round)
- **SEP-8 (Regulated Assets):**
  - Status "Active", v1.7.4, **last updated 2022-02-21, created 2018-08-22**. It describes the authorize → op → deauthorize flow and ships a Go reference approval server (`stellar/go services/regulated-assets-approval-server`).
  - **Wallets must implement SEP-8 specifically:** check the flags, find the approval server in stellar.toml, submit to it, and handle success/revised/pending/action_required/rejected [VERIFIED https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md].
  - Whether Freighter supports SEP-8 natively is [UNKNOWN DEPENDENCY]. If it doesn't, our own app must build every tx and the approval server must co-sign, so the "enforced by every wallet" claim is only half true.
  - The reference approval server existing means the "rules engine" delta is partly SDF code already.
- **SDP:**
  - Bulk payouts, SMS-invite wallet creation, batches of up to 10k, roles, open-source and self-hostable [VERIFIED https://stellar.org/products-and-tools/disbursement-platform].
  - I found no evidence of restricted-use features [UNKNOWN; absence of evidence only].
- **Prior art in Stellar aid:**
  - *Anticipatory Aid on Soroban* (Coala Pay): an SCF award of $50K [VERIFIED https://communityfund.stellar.org/project/anticipatory-aid-on-soroban].
  - *Soter*: an open-source Stellar/Soroban aid platform with claimable packages [VERIFIED https://github.com/wheval/Soter].
  - *Stellar Aid Assist*: in production [VERIFIED https://stellar.org/case-studies/unhcr].
  - So "aid on Stellar" is **not** an empty lane.

---

## 1. Messages received this round

### B-R1. From the Wildcard replacement (a43d0cc536d5ed0bc): a Quorum defence (late Round A material), received about 14:50. Verbatim:

```
Note: I am the replacement Wildcard Inventor; prior Tripwire discussion is closed per Chairman, Tripwire is suspended.

QUORUM, Round A defence (Wildcard 3b -> Ruthless Judge), replying to your W1/W2, Q6–Q9 and your R-4 verdict ("~3.2, drop"). My predecessor conceded too quickly on three points, so I'm contesting those with new evidence. I'm not decided on defend/improve/abandon; that's Round B.

=== W2a: whale sniping. A tighter formula than R-4's ===
R-4 kept a pro-rata split of pool B, which leaves the residual you'd spot: an early whale dilutes honest early backers. Replacement:
- Organiser locks B = r·G at create (G = goal, r = bonus rate, e.g. 10%). Tc = T0 + 0.75·(T−T0). Weight w(t) = max(0, (Tc−t)/(Tc−T0)).
- bonus_i = r · p_i · w(t_i). This is a FIXED rate per euro, with no pool share.
- Solvency: failure means Σp_i < G, so Σbonus_i ≤ r·Σp_i < r·G = B. The pool can never run short, so nobody dilutes anybody [VERIFIED as arithmetic]. The unspent part of B returns to the organiser.
- Last-minute whale: w = 0, so bonus = 0, exactly.
- Early whale: earns r·p only by carrying the whole window's exposure. If anyone tips the goal, the whale's money funds the project. That early commitment is precisely what the organiser is paying for. This matches the paper's own design: "Limiting refund bonuses to early contributors works as well as offering refund bonuses to all potential contributors" [VERIFIED https://researchportal.bath.ac.uk/en/publications/early-refund-bonuses-increase-successful-crowdfunding/].
- New hole R-4 missed: if withdrawals are allowed, the early whale holds a free option. It pledges at w = 1, withdraws if the campaign trends towards success, and stays if it trends towards failure. Fix: pledges are irrevocable (no withdraw()). That is one line of contract logic. UX cost: unlike Kickstarter you can't cancel, and the pledge page must say so [ASSUMPTION about Kickstarter-style cancellation expectations].
- Sybil splitting: the bonus is linear in p, so splitting gains exactly 0 [VERIFIED as arithmetic].

=== W2b / Q8: organiser willingness. "No evidence" is too strong ===
- Lab evidence on organiser COST, not just backer behaviour: "even taking into account campaign failures, refund bonuses can be financially self-sustainable" (Cason, Tabarrok & Zubrickas, GEB 2021) [VERIFIED, same Bath link]. That directly addresses "why would an organiser pay?", though only in the lab [ASSUMPTION that it transfers to the field].
- Real organisers have paid or committed bonuses:
  - Arjun Panickssery ran a 25% bonus, missed by one funder and paid out [VERIFIED https://arjunpanickssery.substack.com/p/dominant-assurance-contract-experiment].
  - Make Sunsets, a company, ran a $1,000 DAC campaign on EnsureDone [VERIFIED https://www.lesswrong.com/posts/7koSvinoHSy6KBLqy/update-2-to-dominant-assurance-contract-platform-ensuredone].
  - Tiny, yes, but not zero.
- The mechanism is still active research. Cason, Tabarrok & Zubrickas, J. Urban Econ (MR post 21 Aug 2026): a refund bonus in a land-assembly holdout game met the threshold "nearly twice as often" [VERIFIED https://marginalrevolution.com/marginalrevolution/2026/08/breaking-ground-can-refund-bonuses-solve-the-holdout-problem.html]. Also lab.
- Factual correction to the record: the Manifold figure ($2,172.67) is the platform's earnings BEFORE the market and is explicitly excluded from it. The page I fetched doesn't show the resolved 2024 bucket [VERIFIED https://manifold.markets/moyamo/how-much-additional-revenue-will-my]. "Earned $2,173 total" is not established.
- Concession that stands: no field RCT exists. Tabarrok has written of hoping to partner with a crowdfunding site for one [ASSUMPTION: search snippet, not fetched]. Contrarian reframe for Continuation: Quorum is the instrument that would produce that missing field evidence. That is a Discovery story no other shortlisted idea has [SPECULATION about how judges weigh it].

=== W1 / Q7: Track. I mostly concede, and there's one thing to add ===
- There is no load-bearing classic core-protocol feature. Claimable-balance refunds stay withdrawn [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract].
- The honest Composed route is OZ Stellar smart accounts (passkeys) + a fee-sponsoring relayer + Circle USDC, with K3 gated on a 1 h passkey spike [UNKNOWN DEPENDENCY: no working example confirmed on current SDKs by me].
- Plain prior-art check: the closest Soroban thing I found is StellarFund, a milestone-escrow crowdfund on Soroban with refunds but NO refund bonus [VERIFIED https://dev.to/berkebey01/building-milestone-escrow-crowdfunding-on-soroban-5hc]. So "crowdfunding on Soroban" is K2-saturated. "DAC on Stellar" is still unseen as far as my search goes [ASSUMPTION: one search].
- Round B pivot I'll put on the table [SPECULATION]: use the DAC as a launch primitive for Stellar assets. The pool on Soroswap or Aquarius only seeds if LP commitments hit the threshold; otherwise LPs get refund plus a bonus paid by the issuer. That is a 2-project composition whose output (LP tokens) is on-chain. Soroswap testnet scripts exist [VERIFIED https://github.com/soroswap/aggregator]. The router add_liquidity signature is unchecked [UNKNOWN DEPENDENCY].

=== Q9: Kickstarter + bank escrow for a €300 gig ===
- Kickstarter charges 5% plus about 3% + $0.20 per pledge, only on success [VERIFIED third-party https://www.pledgebox.com/post/how-much-does-kickstarter-take]. It has no path to pay backers on failure.
- A bank escrow for a €30 bonus is uneconomic [ASSUMPTION; no fee quote fetched].
- Versus an L2: no Stellar-specific advantage for the core mechanism. I concede that.

=== Your rescore ===
I accept Track at 2.5–3 for the build as pitched. I contest Innovation at 3: "never seen on Stellar" plus a 2026-active mechanism is closer to 3.5–4. I also contest that W2 still counts against it, since it is now formally closed. Fair range: ~3.3–3.5 as pitched, and higher only if a Round B composition pivot works. That leaves it below ReliefRail's 3.85 unless the pivot changes Track.

Question back: does the fixed-rate + irrevocable design close W2 for you, yes or no?
```

**Judge's working assessment (my reply is held until the Wildcard's formal Round B decision, so the one-reply budget covers both):**
- **The W2 fix holds.** bonus_i = r·p_i·w(t_i) gives Σbonus < r·G = B on failure, so the pool stays solvent with no dilution. Sniping pays w = 0, splitting gains nothing, and irrevocable pledges remove the free option. I checked the arithmetic and it holds. **Answer: YES, W2 is closed.**
- **Track is still 2.5–3, and the verdict turns on it.** The LP-launch pivot (DAC that seeds a Soroswap pool) would give a genuine 2-project composition. But testnet AMM liquidity and the router signature are [UNKNOWN DEPENDENCY], and the pivot is under an hour old. It also changes the user from "café owner" to "token issuer", which is a weaker User Value story for non-crypto judges [ASSUMPTION].
- Rescore: about 3.35 as pitched (Innovation 3.5, Track 2.5).

---

## 2. Messages sent this round
(Appended below as they are sent.)

### B-R2. From the Problem Hunter (a74e19b9343da9802): Round B decisions. Verbatim:

```
ROUND B DECISIONS (Problem Hunter): Roda ABANDON, KeyHold/Deposit Passport ABANDON, and COMBINE my demand evidence into purpose-bound money with the NGO as first customer. Full reasoning is in research/07_roundB_problem_hunter.md.

1) RODA: ABANDON. Guarantor vouching does NOT fix the arithmetic; it moves the loss. 10 × €200: Funmi (position 1) posts €0, and vouchers Tia and Bola back €1,800 (€900 each). Funmi takes €2,000, walks away and still nets +€1,800, while the vouchers pay. The best capital-free variant is "vouch with your future pot": vouchers sit at positions 9–10, a default raises their per-round contribution by €100 for 9 rounds, and stopping forfeits their own €2,000 pot. That is incentive-compatible for the vouchers [ASSUMPTION: my derivation] but still leaves Funmi +€1,800. It routes the cost of misplaced trust; it doesn't create deterrence. With Amero (SCF #28/#31) and Clixpesa on Stellar, about 8 Celo dApps [VERIFIED https://www.karmahq.xyz/project/ajoai/about], and no load-bearing protocol feature, my estimate is about 3.0 weighted [ASSUMPTION], below your 3.5 line.

2) KEYHOLD → DEPOSIT PASSPORT: ABANDON. The passport is a new idea, not an improvement. No paying customer can be named [UNKNOWN]. Landlords already have deposit-replacement cover at 6–8 weeks' rent from Reposit and Zero Deposit [VERIFIED https://www.augustapp.com/blog/zero-deposit-vs-flatfair-vs-reposit]. Reposit is essentially a database-backed passport, so it fails the Postgres test. Trustless Work already documents rental deposits [VERIFIED https://docs.trustlesswork.com/trustless-work/use-cases-unlocking-the-potential-of-smart-escrows/security-deposits]. The passport needs several landlords attesting, which makes F7 worse. About 3.0 [ASSUMPTION]. Salvage: final-offer arbitration as a reusable dispute rule, e.g. for contested merchant redemptions in purpose-bound money [SPECULATION].

3) COMBINE → purpose-bound money: NGO first, diaspora second.
- The merchant is the binding adopter. An NGO contracts the shops, as WFP Building Blocks did (106k people, $2.4M fee savings) [VERIFIED https://innovation.wfp.org/node/25]. A diaspora sender can't onboard a school in Praia.
- Budget: cash and voucher assistance was $7.9B in 2022, about 21% of humanitarian aid [VERIFIED https://www.calpnetwork.org/?p=199218]. The voucher-vs-cash split is [UNKNOWN], so don't claim it.
- Diaspora consumer demand for *enforcement* is weak: the label raises sends by more than 15%, direct payment only about 2.2% [VERIFIED https://www.povertyactionlab.org/print/pdf/node/1937?lang=en]. Remittance is K2-saturated.
- Diaspora works as Continuation/Market: $685B in 2024 [VERIFIED https://blogs.worldbank.org/en/peoplemove/in-2024--remittance-flows-to-low--and-middle-income-countries-ar] can earmark to the merchant network NGOs have already onboarded [SPECULATION].
- First-user persona: a cash and voucher assistance officer at a mid-size NGO running sector-specific vouchers (pharmacy or school supplies), with no named organisation (K7).
```

### B-S1. Sent to the Problem Hunter (my one Round B reply)
**SendMessage result (verbatim):** `{"success":true,"message":"Message queued for delivery to a74e19b9343da9802 at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a74e19b9343da9802","name":"a74e19b9343da9802","ref":"23bd0d"}}`

**Message (verbatim):**
```
Ruthless Judge, Round B kill-check on your decisions. This is my one reply.

1) RODA ABANDON: SURVIVES. Your guarantor arithmetic is right: vouching moves the loss and creates no deterrence, so Funmi still nets +€1,800. K2 also applies (Amero, Clixpesa and about 8 Celo dApps) along with the weak Track fit. Agreed, it's dead.

2) KEYHOLD / DEPOSIT PASSPORT ABANDON: SURVIVES. It fails K1, because Reposit is a database-backed passport. F7 gets worse, and K5 has no named payer. The final-offer arbitration idea is worth keeping as a possible dispute rule in purpose-bound money, but only as a slide, not a build.

3) COMBINE INTO PURPOSE-BOUND MONEY: the decision survives, but two of your evidence claims cut BOTH ways, and I'll use them against it as designated opponent:
(a) WFP Building Blocks.
- It is evidence for restricted, shop-level redemption [VERIFIED https://innovation.wfp.org/node/25].
- But WFP deliberately chose a PERMISSIONED Ethereum fork, not a public chain [VERIFIED per research/02 §B2 differentiation]. So the largest buyer looked at this problem and decided it didn't need a public ledger. That is direct counter-evidence to "why Stellar public network".
- Here is the assumption you and the Architect are making that I don't share: NGOs want public auditability more than they fear exposing beneficiary data. Tag: [ASSUMPTION]. I have no source either way, and neither do you.
(b) CVA is $7.9B and about 21% of aid [VERIFIED https://www.calpnetwork.org/?p=199218].
- But the voucher share is [UNKNOWN], and you yourself flag that the sector trend is toward unrestricted cash.
- If the restricted slice is small and shrinking, then "Market & Ecosystem Potential" rests on a number we can't state.
- Also, without a named organisation, K7 says we must not imply one in the deck. The persona has to read "a CVA officer (composite)".
Net: it survives K1–K7 as a direction, carrying flags F2 (off-chain approval server) and F6 (SDP/Aid Assist, Soter, Anticipatory Aid SCF $50K [VERIFIED https://communityfund.stellar.org/project/anticipatory-aid-on-soroban]).
One thing that would materially help: a source saying why WFP chose permissioned (cost? privacy? control?), so we can answer the judge's first question.
```

**Disagreement record:**
- **Problem Hunter / Architect vs Judge: do NGOs value a public, auditable ledger more than they fear exposing beneficiary data?**
  - [ASSUMPTION] on both sides, with no source.
  - WFP's choice of a permissioned chain is [VERIFIED per research/02] and points against the Problem Hunter and Architect.

### B-R3. From the Stellar Architect (a8dd31a4f45ac4f54): Round B decisions. Verbatim:

```
Round B decisions from the Stellar Architect: LeashPay is ABANDONED and ReliefRail is IMPROVED (v3). Full detail is in research/07_roundB_stellar_architect.md.

LEASHPAY → ABANDON. The deciding evidence: REAPP, SCF #43, awarded $70k. Its Soroban MandateRegistry already enforces per-agent caps, period limits and merchant restrictions with x402, and it has a live testnet merchant, Query402 [VERIFIED https://communityfund.stellar.org/submissions/recrWPt0QGLHnbv5Z].

RELIEFRAIL / PURPOSE-BOUND MONEY → IMPROVE (v3): "the compliance officer is a contract".
- The NGO issues AID with AUTH_REQUIRED + REVOCABLE + CLAWBACK (SEP-8 requires both auth flags [VERIFIED https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md]).
- The SAC's admin is moved via set_admin to a Soroban Program contract (SAC exposes set_admin/set_authorized/clawback [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract]).
- Program.spend(beneficiary, merchant, amount): beneficiary.require_auth → check category allowlist, period cap and expiry → set_authorized(true) → transfer → set_authorized(false). That's an ON-CHAIN SEP-8 sandwich with public rules and no approval server. [UNKNOWN DEPENDENCY: whether transfer sees the in-invocation authorization. A 1h cargo-test spike; K3 for this concept.]
- Expiry and reallocation stay native: a claimable-balance cascade created by the NGO's G-account.

(a) What's new: SEP-8 is from 2018 [VERIFIED]. New here: SEP-8 rules as a public contract instead of a private server [ASSUMPTION that none is deployed], plus a predicate waterfall that reallocates unclaimed aid [ASSUMPTION it's novel]. My honest estimate is Innovation about 3.5.

(b) Not Postgres: there's no rules server. Balances sit in beneficiaries' own accounts. The rules are auditable code. The only off-chain signer co-signs claims of balances whose predicates were fixed at creation, so it can't redirect funds [ASSUMPTION about design]. The NGO-controlled issuer and allowlist are centralised by design, and we say so openly.

(c) Soroban: yes, and now load-bearing (auth, invariants, caps, clawback). Tech ≥4 is plausible if the spike passes and CI tests run. If it fails, we fall back to a SEP-8 server and Tech is about 3 [SPECULATION].

(d) Verified against CAP-23 [https://github.com/stellar/stellar-protocol/blob/master/core/cap-0023.md]:
- Claimant claimants<10>, so max 10. No duplicate destinations.
- Predicates: AND/OR/NOT/BEFORE_ABSOLUTE_TIME/BEFORE_RELATIVE_TIME, max depth 4. BEFORE_ABS is true if closeTime < absBefore.
- Windows: A = BEFORE_ABS(T1); B = AND(NOT(BEFORE_ABS(T1)), BEFORE_ABS(T2)); NGO = NOT(BEFORE_ABS(T2)). These are mutually exclusive, depth 3.
- Claim requires an AUTHORIZED trustline, so the claim goes in an issuer-co-signed sandwich.
- CORRECTION to my Round A pitch: money doesn't move by itself. After T1, ONLY Family B can claim, and B must still submit the claim. "Nobody pressed a button" overclaimed.

(e) Claimants are AccountIDs [VERIFIED CAP-23], so beneficiaries get G-accounts.
- Zero-XLM onboarding: the NGO sponsors CreateAccount with startingBalance 0 and the trustline reserve; both parties sign [VERIFIED https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves].
- Fees: fee-bump or relayed auth entries [ASSUMPTION, not re-verified].

(f) Buyer: a cash-and-voucher programme manager at a mid-size INGO or national Red Cross/Crescent society running restricted pharmacy/medical vouchers [ASSUMPTION; no named org = UNKNOWN DEPENDENCY].
- Why not SDP: SDP ends at delivery, and delivered USDC is unrestricted (the UNHCR case is unrestricted cash [VERIFIED https://stellar.org/case-studies/unhcr]). We govern purpose, cap, expiry, reallocation and clawback after delivery. Positioned as a complement to SDP.
- Demand evidence: WFP Building Blocks' restricted shop redemption [VERIFIED https://innovation.wfp.org/node/25].

Cut line: 1 contract plus classic scripts. Passkeys, SEP-24, SEP-7 and the Earmark build are all cut.
```

### B-S2. Sent to the Architect: the designated-opponent case (attack)
**SendMessage result (verbatim):** `{"success":true,"message":"Message queued for delivery to a8dd31a4f45ac4f54 at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a8dd31a4f45ac4f54","name":"a8dd31a4f45ac4f54","ref":"42ccab"}}`

**Message (verbatim):**
```
Ruthless Judge, as DESIGNATED OPPONENT: the strongest case against purpose-bound money v3 ("the compliance officer is a contract"). Rebut what you can. I get one follow-up after your answer.

A. INNOVATION. v3's novelty claim is already shipped by OpenZeppelin.
- OZ Stellar Contracts includes an RWA token whose constructor takes a compliance contract and an identity-verifier contract, which gives on-chain transfer rules on Soroban. It is built with the 3643 Association/Tokeny (T-REX/ERC-3643) [VERIFIED https://docs.openzeppelin.com/stellar-contracts/tokens/rwa/rwa ; https://docs.openzeppelin.com/impact/tokenization-and-real-world-assets]. There is also an OZ RWA Wizard that generates compliance modules [VERIFIED https://docs.openzeppelin.com/rwa-wizard].
- So "SEP-8 rules as a public contract instead of a private server" = "an OZ RWA compliance module with a category allowlist". SEP-8 itself dates from 2018, last updated 2022, with a reference approval server [VERIFIED https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md].
- The remaining novelty is the claimable-balance waterfall. You corrected it yourself: it doesn't move on its own (Family B must still claim).
- My Innovation score is 2.5–3, not 3.5.

B. "NO APPROVAL SERVER" IS NOT TRUE. Off-chain signers remain in three places [ASSUMPTION based on your own design text]:
- (1) Claiming the cascade "requires an AUTHORIZED trustline, so the claim goes in an issuer-co-signed sandwich". That is an issuer co-signing service.
- (2) Zero-XLM beneficiaries need fee-bump or a relayer for every Program.spend. That is a server that can censor.
- (3) Sponsored CreateAccount needs NGO co-signing.
- Worse, set_admin moves only the SAC admin. As far as I know, the classic issuer G-key can STILL run SetTrustLineFlags and clawback through classic ops, outside the Program contract [ASSUMPTION; verify whether SAC set_admin restricts classic issuer ops (I believe it does not)].
- If so, the "public auditable rules" are bypassable at will by the NGO key. The contract is a convention, not an enforcement, and that is my Postgres test (K1) again.

C. TECHNICAL EXECUTION and the critical path.
- K3: whether an in-invocation set_authorized → transfer → set_authorized sandwich works in one Soroban call, including authorizing the merchant side, is still [UNKNOWN DEPENDENCY], as you say.
- On top of it you stack: classic scripts (issuer flags, sponsorship, claimable cascade), a Soroban contract, a fee relayer and THREE UIs (NGO, beneficiary, merchant). From a standing start in Soroban that is F1 again [ASSUMPTION about team velocity].
- If the spike fails, you fall back to a SEP-8 server with Tech about 3, which you concede. That leaves Innovation 2.5 and the "Postgres" verdict.

D. DATA PROTECTION: a new, serious problem.
- v3's lead category is pharmacy/medical vouchers. On a public ledger every spend is permanent and linkable: beneficiary G-address, merchant G-address (a pharmacy), amount and time.
- NGO-issued AID plus an NGO-known allowlist means the NGO (and anyone who maps one merchant address) can re-identify health purchases of refugees [ASSUMPTION].
- Humanitarian data-protection norms (e.g., the ICRC data protection handbook) are strict about this [ASSUMPTION; I haven't fetched it, please cite if you disagree].
- This is exactly why WFP Building Blocks chose a PERMISSIONED chain [VERIFIED per research/02 §B2 that it's a permissioned Ethereum fork; WFP's motive is UNKNOWN].
- A sharp judge asks "why put refugee pharmacy purchases on a public chain?" and we have no answer. Confidential Tokens would answer it, but they're testnet-preview and K3.

E. OVERLAP AND THE BUYER.
- Aid on Stellar is occupied: SDP/Aid Assist [VERIFIED https://stellar.org/case-studies/unhcr], Anticipatory Aid on Soroban (SCF $50K) [VERIFIED https://communityfund.stellar.org/project/anticipatory-aid-on-soroban], Soter (Soroban aid with claimable packages) [VERIFIED https://github.com/wheval/Soter].
- There is no named NGO or quote [UNKNOWN DEPENDENCY]. The voucher share of CVA is [UNKNOWN], and the sector trend is toward unrestricted cash [ASSUMPTION per A1].
- Market & Ecosystem Potential rests on a number nobody can state.

F. DEMO.
- The beneficiary is a refugee with a basic phone. The demo will show a desktop Freighter or a generated key, which undercuts the persona [ASSUMPTION].
- The headline moment is now a *rejected* payment plus a manual claim by Family B. That is good but not jaw-dropping.

My score for v3 as specified: Track 4, User 3.5, Tech 3, Innov 2.5, Progress 4, Market 3, UX 3 → about 3.33, not 3.85. It only beats the field because the field collapsed.

Questions:
Q1. Does SAC set_admin to a contract stop the classic issuer key from running SetTrustLineFlags/clawback? Yes/no, with a link. If no, how is the Program the real enforcer?
Q2. List every off-chain signer or server in v3 and what each can censor or redirect.
Q3. What does v3 do that an OZ RWA token plus a custom compliance module does not? If "nothing, but on SAC", is that still 'Unlocked'?
Q4. Your answer to D: how do you publish refugee pharmacy spends on a public ledger, or which category do you lead with instead?
Q5. Who runs the 1h sandwich spike, and when? It's ~15:00 Sun.
```

### B-R4. From the Problem Hunter (a74e19b9343da9802): the WFP source (no reply requested; none sent). Verbatim:

```
Problem Hunter -> Judge: the source you asked for on why WFP chose permissioned. No reply needed.
- WFP's own FAQ says Building Blocks began as a public-chain proof of concept in Jan 2017, then switched to private-permissioned "for transaction throughput, cost, and privacy reasons". The private chain keeps on-chain cost at zero and data "only visible to its approved humanitarian members" [VERIFIED as quoted in search results from https://docs.wfp.org/api/documents/WFP-0000146542/download; PDF not fully read]. Technical basis: Parity Ethereum client with PoA [VERIFIED as reported in the same search].
- Critique: "has one participant, i.e. it's a database" [VERIFIED https://davidgerard.co.uk/blockchain/2017/11/26/the-world-food-programmes-much-publicised-blockchain-has-one-participant-i-e-its-a-database/].
My read: Stellar answers throughput and cost. PRIVACY is unanswered, and so is your public-auditability assumption [ASSUMPTION, agreed: no source either way]. I've told the Architect that a single NGO fails the Postgres test, and that the non-decorative buyer is a multi-NGO consortium sharing one merchant network [ASSUMPTION]. I also told him we need a no-PII / fresh-account-per-program privacy line plus a Confidential Tokens roadmap.
```
**Judge's note:** this upgrades opposition point D from [ASSUMPTION] to near-[VERIFIED]. WFP *tried a public chain and left it, citing privacy among its reasons* (WFP FAQ, as quoted in search results; the PDF was not fully read). The Problem Hunter's "multi-NGO consortium sharing one merchant network" is the most credible non-Postgres buyer framing so far [ASSUMPTION].
