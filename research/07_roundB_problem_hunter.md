# 07 — Round B decisions (Agent 1, Problem Hunter)

Summary: **Roda: ABANDON. KeyHold / Deposit Passport: ABANDON. Contribution: COMBINE my demand evidence into purpose-bound money (ReliefRail+Earmark), with the NGO as first customer and diaspora as the second market.**

---

## 1. Roda: ABANDON

**Does guarantor vouching fix the collateral arithmetic? No. It moves the loss but doesn't remove the defector's gain.**

Setup: N = 10 members, c = €200 each round, pot = €2,000. Funmi is at position 1.
- Defection gain for the member at position k = (N−k)·c minus whatever *they personally* forfeit [VERIFIED as arithmetic, agreed in Round A by Judge, Architect and Wildcard].
- With vouching, Funmi posts €0. Two vouchers, Tia and Bola, back her obligation of (N−1)·c = €1,800, so €900 each.
- If Funmi takes €2,000 after paying €200 and walks away, **she still nets +€1,800**. The vouchers pay €900 each. The circle is made whole, but the defector's own payoff hasn't changed.
- Best capital-free variant I found: "vouch with your future pot". Vouchers must sit at later positions (e.g. 9 and 10), and their *unreceived* pot (€2,000 each) is the hostage. When Funmi stops paying, each voucher's per-round contribution rises by €100 for 9 rounds (€900 each), and anyone who stops topping up forfeits their own pot. This is incentive-compatible *for the vouchers* and needs no upfront capital [ASSUMPTION: my own derivation, untested]. It still gives Funmi +€1,800.
- What it actually achieves: the loss falls on the people who *chose* to trust Funmi, not on random members. That turns WhatsApp social pressure into priced, enforced joint liability. It is a real improvement, but deterrence still depends on social ties, which is exactly what ROSCAs already rely on. The contract doesn't create trust; it routes the cost of misplaced trust.
- Joint liability is also contested in the field. I recall Giné & Karlan finding that removing group liability in the Philippines didn't raise default [ASSUMPTION: not re-verified today], which weakens "vouching" as the selling point.

**What would make a judge remember ours over Amero and Clixpesa?** Honestly, nothing I can build in about 20h.
- On Stellar: Amero (SCF #28 + #31, beta users) and Clixpesa [VERIFIED by Wildcard https://communityfund.stellar.org/project/amero-defi-collective-savings-d28].
- Elsewhere, about 8 Celo dApps and several ETHGlobal entries, some already with reputation or credit scoring [VERIFIED https://www.karmahq.xyz/project/ajoai/about, https://ethglobal.com/showcase/ronda-7ck82, https://ethglobal.com/showcase/saving-circles-bmgxr].
- No Stellar protocol feature is load-bearing (Track about 2.5, agreed with Judge and Architect).
- Weighted rubric estimate: Track 2.5, User 3.5, Tech 3.5, Innov 2, Progress 4, Market 2.5, UX 3.5 ≈ **3.0**, below the Judge's 3.5 noise line [ASSUMPTION: my scoring].

**Decision: ABANDON.** The demand is real, but it's already served (custodial MoneyFellows, and Amero on Stellar), and we have no mechanism that fixes the core flaw.

---

## 2. KeyHold → Deposit Passport + final-offer arbitration: ABANDON

**Is it an improvement or a new idea? A new idea.** The passport changes the user (tenant → landlord-facing reputation), the value proposition (protection → portability and history) and the business model. Final-offer arbitration is a real dispute-rule improvement, but on its own it is a feature, not a product.

**First paying customer:** I can't name one [UNKNOWN DEPENDENCY].
- The landlord gains a proof-funded deposit plus tenant history, but deposit-replacement products already sell landlords cover at 6–8 weeks' rent, with the tenant paying a fee [VERIFIED https://www.augustapp.com/blog/zero-deposit-vs-flatfair-vs-reposit]. So landlords already have a "better than cash" option in markets that have the category.
- In Portugal, that category's presence is [UNKNOWN].
- The relocation, coliving and student-residence wedge is [SPECULATION] with no quote.

**Where does Stellar carry real weight?** It doesn't, sufficiently.
- A licensed custodian plus a Postgres database does the passport (Reposit is essentially a database-backed passport plus insurance).
- The only on-chain argument is "no custodian and auditable by both sides". In the EU that runs straight into "who is the regulated deposit-taker" [ASSUMPTION], and the legal status of an on-chain caução is [UNKNOWN DEPENDENCY].
- Trustless Work already documents rental security deposits [VERIFIED https://docs.trustlesswork.com/trustless-work/use-cases-unlocking-the-potential-of-smart-escrows/security-deposits] and has no native timeout release [VERIFIED https://docs.trustlesswork.com/trustless-work/llms-full.txt, partial read]. So our version would be their reference app plus a keeper contract.
- Two-sided cold start (F7) remains, and the passport needs *multiple* landlords to attest before it has any value, which is worse than the original.

Rubric estimate: Track 2, User 3, Tech 3.5, Innov 3 (final-offer helps), Progress 4, Market 2.5, UX 3.5 ≈ **3.0** [ASSUMPTION].

**Decision: ABANDON.** One salvageable piece: **final-offer arbitration** is a reusable dispute rule. If the purpose-bound money product needs a merchant-vs-NGO dispute path (e.g. a contested redemption), it fits there [SPECULATION].

---

## 3. COMBINE: my evidence into purpose-bound money (ReliefRail+Earmark)

**Is the diaspora sender a stronger *first* customer than an NGO? No. NGO first, diaspora second.** My reasoning on adoption:

1. **Who onboards the merchant?** This is the binding constraint, since the merchant is the hardest adopter (agreed in Round A).
   - An NGO solves it by contracting shops, as WFP Building Blocks does with contracted supermarkets in Azraq (106,000 people, $2.4M fee savings) [VERIFIED https://innovation.wfp.org/node/25].
   - A diaspora sender can't make a school or pharmacy in Praia or Lagos get a Stellar account.
   - So the NGO is a *single buyer who brings both sides of the market*, and that is the only way around F7 in 20h or in year one [ASSUMPTION, but grounded in the WFP model].
2. **Budget exists.** Cash and voucher assistance was $7.9B in 2022 (+41% YoY), about 21% of international humanitarian aid [VERIFIED https://www.calpnetwork.org/?p=199218, CALP press release]. The voucher-versus-cash split is [UNKNOWN]: I couldn't extract it. That number matters for the "the sector prefers unrestricted cash" objection, and we should not claim a voucher share.
3. **Why diaspora is weaker as first customer:** the RCT shows senders respond to the *label* (more than 15% more sent), while direct payment to the school added only about 2.2% [VERIFIED https://www.povertyactionlab.org/print/pdf/node/1937?lang=en]. Consumer demand for *hard enforcement* is therefore weak. And remittance is the most saturated Stellar category (K2, per 04).
4. **Why diaspora is still the right second market:** remittances to LMICs were $685B in 2024 [VERIFIED https://blogs.worldbank.org/en/peoplemove/in-2024--remittance-flows-to-low--and-middle-income-countries-ar], about 87× the CVA total [ASSUMPTION: rough ratio, different years]. Once NGO programs have onboarded merchants in a region, diaspora senders can earmark to the *same merchant network*. That's a credible Continuation and Market story: the NGO pays for merchant acquisition and the diaspora monetises it [SPECULATION].

**Sharpened first-user persona I'd hand the Architect:**
- A cash and voucher assistance program officer at a mid-size international or local NGO running *sector-specific* assistance (e.g. medicine vouchers redeemable at pharmacies, or school-supply grants).
- Restriction here is a donor or program requirement, not a default.
- They can't run a permissioned chain like WFP, and SDP gives them only unrestricted disbursement [VERIFIED SDP and Aid Assist are unrestricted USDC per https://stellar.org/case-studies/unhcr].
- No named organisation [UNKNOWN DEPENDENCY]. Do not claim one (K7).

**What I'd insist on in the pitch (demand honesty):**
- Say "restriction is a per-program toggle, not our ideology" (the Architect's reframe).
- Say "WFP proved the model at 100k+ scale on a private chain; we make it public-network and NGO-agnostic".
- Never claim enforcement increases giving (the RCT says labelling does).
- Show the diaspora earmark as one slide on the roadmap, not as built.

---

## 4. After the debate: my updated position on purpose-bound money (from the exchanges below)
- **The first user for whom the chain is non-decorative is a multi-NGO consortium sharing one merchant network**, not a single NGO. A single NGO passes the Postgres test against us. WFP's own chain was criticised as "one participant = a database" [VERIFIED https://davidgerard.co.uk/blockchain/2017/11/26/the-world-food-programmes-much-publicised-blockchain-has-one-participant-i-e-its-a-database/].
- **Privacy is the unanswered objection.** WFP left a public chain for "throughput, cost, and privacy reasons" [VERIFIED as quoted from the WFP FAQ via search, https://docs.wfp.org/api/documents/WFP-0000146542/download]. We need a no-PII, fresh-account-per-program line and a Confidential Tokens roadmap.
- **Clawback-and-reissue as lost-phone recovery** turns the scariest admin power into a beneficiary benefit [ASSUMPTION], and it makes a good demo beat.

---

## Round B message log (verbatim)

### SENT B1 → Ruthless Judge (a2cb972d7bcf3040e)
SendMessage result: `{"success":true,"message":"Resuming agent a2cb972", ...}`
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

### SENT B2 → Stellar Architect (a8dd31a4f45ac4f54)
SendMessage result: `{"success":true,"message":"Message queued for delivery to a8dd31a4f45ac4f54 at its next tool round. ..."}`
```
ROUND B DECISIONS (Problem Hunter): Roda ABANDON, KeyHold/Deposit Passport ABANDON, and COMBINE my demand evidence into your purpose-bound money with the NGO as first customer. Full reasoning is in research/07_roundB_problem_hunter.md.

1) RODA: ABANDON. Your R1–R4 hold. Guarantor vouching doesn't fix the arithmetic, it moves the loss: in a 10 × €200 circle the position-1 defector still nets +€1,800 while vouchers cover it. The capital-free "vouch with your future pot" variant (vouchers at positions 9–10 top up €100/round or forfeit their own €2,000 pot) is incentive-compatible for vouchers [ASSUMPTION: my derivation] but isn't deterrence. No load-bearing Stellar feature, plus Amero and Clixpesa on Stellar and about 8 Celo dApps [VERIFIED https://www.karmahq.xyz/project/ajoai/about]. About 3.0 weighted [ASSUMPTION].

2) KEYHOLD → DEPOSIT PASSPORT: ABANDON. It's a new idea with no paying customer [UNKNOWN]. Reposit and Zero Deposit already give landlords 6–8 weeks' cover [VERIFIED https://www.augustapp.com/blog/zero-deposit-vs-flatfair-vs-reposit], so it fails the Postgres test. Trustless Work's reference use case is rental deposits [VERIFIED https://docs.trustlesswork.com/trustless-work/use-cases-unlocking-the-potential-of-smart-escrows/security-deposits]. Your "why Stellar not Base" question has no honest answer. Salvage: final-offer arbitration as a dispute rule for contested merchant redemptions [SPECULATION].

3) COMBINE → your purpose-bound money: I back NGO-first, with diaspora as the second market.
- The merchant is the binding adopter, and only an NGO contracts merchants at scale (WFP Building Blocks: contracted shops, 106k people, $2.4M saved) [VERIFIED https://innovation.wfp.org/node/25].
- Cash and voucher assistance was $7.9B in 2022, about 21% of humanitarian aid [VERIFIED https://www.calpnetwork.org/?p=199218]. Voucher share is [UNKNOWN].
- Diaspora demand is for the *label* (more than 15%), not enforcement (about 2.2%) [VERIFIED https://www.povertyactionlab.org/print/pdf/node/1937?lang=en]. So diaspora is the Continuation slide: $685B in remittances in 2024 [VERIFIED https://blogs.worldbank.org/en/peoplemove/in-2024--remittance-flows-to-low--and-middle-income-countries-ar] earmarking into a merchant network that NGOs have already onboarded [SPECULATION].
- Persona to use: a cash and voucher assistance officer at a mid-size NGO running sector-specific vouchers (pharmacy or school supplies) who can't run a WFP-style private chain and for whom SDP is unrestricted. No named organisation (K7).
I'll reply on adoption when your Round B on ReliefRail arrives.
```

### SENT B3 → Wildcard Inventor replacement (a43d0cc536d5ed0bc)
SendMessage result: `{"success":true,"message":"Message queued for delivery to a43d0cc536d5ed0bc at its next tool round. ..."}`
```
ROUND B DECISIONS (Problem Hunter): Roda ABANDON, KeyHold/Deposit Passport ABANDON, and COMBINE my demand evidence into purpose-bound money with the NGO as first customer. Full reasoning is in research/07_roundB_problem_hunter.md.

1) RODA: ABANDON. I tested your predecessor's guarantor-vouching fix with numbers: it moves the loss but doesn't deter. 10 × €200: Funmi (position 1) posts €0, Tia and Bola vouch €900 each. Funmi takes €2,000, walks away and still nets +€1,800, while the vouchers cover it. The best variant I found is "vouch with your future pot": vouchers at positions 9–10 top up €100/round for 9 rounds or forfeit their own €2,000 pot. It needs no upfront capital and is incentive-compatible for vouchers [ASSUMPTION: my derivation], but the defector's payoff doesn't change. Bidding has WeTrust prior art. Against Amero and Clixpesa on Stellar and about 8 Celo dApps [VERIFIED https://www.karmahq.xyz/project/ajoai/about], I can't make it memorable in 20h.

2) KEYHOLD → DEPOSIT PASSPORT + FINAL-OFFER: ABANDON. The passport is a new idea rather than an improvement. No paying customer [UNKNOWN]. Reposit and Zero Deposit already give landlords 6–8 weeks' cover [VERIFIED https://www.augustapp.com/blog/zero-deposit-vs-flatfair-vs-reposit], which is the Postgres version of the passport. Multi-landlord attestation makes the cold start worse. I'd salvage **final-offer arbitration** as a dispute rule for contested merchant redemptions in purpose-bound money [SPECULATION]. That was your predecessor's best idea for my concepts, and thanks for it.

3) COMBINE → purpose-bound money: NGO first, diaspora second.
- The NGO contracts merchants (the WFP Building Blocks model) [VERIFIED https://innovation.wfp.org/node/25].
- Diaspora demand is for the label, not enforcement (more than 15% vs about 2.2%) [VERIFIED https://www.povertyactionlab.org/print/pdf/node/1937?lang=en].
- Remittances ($685B in 2024) are the Continuation story [VERIFIED https://blogs.worldbank.org/en/peoplemove/in-2024--remittance-flows-to-low--and-middle-income-countries-ar].
```

### RECEIVED B4 ← Ruthless Judge (a2cb972d7bcf3040e): kill-check on my decisions

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

### RECEIVED B5 ← Stellar Architect (a8dd31a4f45ac4f54): Round B on LeashPay and ReliefRail

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

### SENT B6 → Stellar Architect (a8dd31a4f45ac4f54): my one adoption reply on ReliefRail v3
SendMessage result: `{"success":true,"message":"Message queued for delivery to a8dd31a4f45ac4f54 at its next tool round. ..."}`
```
ADOPTION REPLY (Problem Hunter -> Stellar Architect) on ReliefRail v3: I back IMPROVE, but I think the first user is a multi-NGO consortium, not a single NGO. One reply, five points.

1) WHY PUBLIC, i.e. who really needs a shared ledger. WFP started Building Blocks on a public chain in Jan 2017 and switched to private-permissioned "for transaction throughput, cost, and privacy reasons" [VERIFIED via WFP FAQ quoted in search; https://docs.wfp.org/api/documents/WFP-0000146542/download, not fully read]. Critics noted that a PoA chain run by one party "has one participant", i.e. it's a database [VERIFIED https://davidgerard.co.uk/blockchain/2017/11/26/the-world-food-programmes-much-publicised-blockchain-has-one-participant-i-e-its-a-database/].
- Stellar answers two of WFP's three reasons (throughput and cost).
- A SINGLE NGO still passes the Postgres test against us, because one NGO with one merchant list is fine with a database [ASSUMPTION].
- The user for whom a public ledger is *necessary* is several NGOs sharing one merchant network and one rulebook (cash consortia or working groups in a response) without any one of them owning the database [ASSUMPTION: consortium cash programs exist; I haven't verified a named one today].
- So my recommended first user is a composite: "a CVA lead in a 3-NGO consortium that shares pharmacy merchants". Each NGO issues its own AID asset or program, merchants redeem all of them through one Program contract, and donors audit all of it.
- That makes "public + Soroban rules" the product, not decoration. It also beats SDP's single-sender model.

2) PRIVACY, WFP's third reason, which we do NOT answer yet. On a public ledger the beneficiary→merchant graph and amounts are visible. A merchant who knows Family A can de-anonymise their pharmacy spend [ASSUMPTION].
- Must-have pitch line: no PII on-chain, fresh G-account per program per household, amounts are program-standard.
- Roadmap: Stellar Confidential Tokens (testnet preview) to hide amounts [VERIFIED per your 02].
- If we skip this, an aid-literate judge's first question kills us, because WFP explicitly left public chains over it.

3) BENEFICIARY ADOPTION, which is the real UX question. Who holds the keys?
- If the NGO holds them, the design collapses into a custodial database.
- My suggestion: a beneficiary-held key in a simple PWA, with **clawback-and-reissue as lost-phone recovery**. The NGO claws back from the lost account and reissues to a new one.
- That turns a feature judges see as "scary admin power" into the most user-friendly thing in the product, because cash and paper vouchers can't be recovered [ASSUMPTION; I haven't seen this framing elsewhere]. Make it a demo beat: "phone stolen → balance frozen and reissued in 10s".
- Basic phones and feature phones remain [UNKNOWN DEPENDENCY]. Say "smartphone-first pilot".

4) MERCHANT ADOPTION. Merchants care about getting paid fast and in local currency.
- Show redemption → USDC → testanchor SEP-24 off-ramp, clearly labelled "simulated fiat".
- If you cut SEP-24, at least show redemption into USDC with the anchor network as the stated route (MoneyGram/anchor cash-out is real on mainnet [VERIFIED https://stellar.org/case-studies/unhcr]).
- Without a merchant cash-out story, judges will ask why a pharmacy accepts this [ASSUMPTION].

5) DEMO HONESTY. Good correction on "nobody pressed a button".
- The memorable beats should be: (a) off-category spend REJECTED on-chain, (b) clawback-and-reissue after a lost phone, (c) after T1 the unclaimed aid is claimable only by the waitlisted family.
- Composite persona label per the Judge (K7). No named NGO. Cite WFP and UNHCR as evidence of demand, not as partners.

Assumption behind my one disagreement with you: you frame the buyer as a single mid-size INGO. I think a single NGO doesn't need a public chain, so the consortium is the buyer for whom the chain is non-decorative. If you have evidence that single NGOs want public donor auditability, that would change my mind.
```

### SENT B7 → Ruthless Judge (a2cb972d7bcf3040e): the WFP-permissioned source the Judge asked for
SendMessage result: `{"success":true,"message":"Message queued for delivery to a2cb972d7bcf3040e at its next tool round. ..."}`
```
Problem Hunter -> Judge: the source you asked for on why WFP chose permissioned. No reply needed.
- WFP's own FAQ says Building Blocks began as a public-chain proof of concept in Jan 2017, then switched to private-permissioned "for transaction throughput, cost, and privacy reasons". The private chain keeps on-chain cost at zero and data "only visible to its approved humanitarian members" [VERIFIED as quoted in search results from https://docs.wfp.org/api/documents/WFP-0000146542/download; PDF not fully read]. Technical basis: Parity Ethereum client with PoA [VERIFIED as reported in the same search].
- Critique: "has one participant, i.e. it's a database" [VERIFIED https://davidgerard.co.uk/blockchain/2017/11/26/the-world-food-programmes-much-publicised-blockchain-has-one-participant-i-e-its-a-database/].
My read: Stellar answers throughput and cost. PRIVACY is unanswered, and so is your public-auditability assumption [ASSUMPTION, agreed: no source either way]. I've told the Architect that a single NGO fails the Postgres test, and that the non-decorative buyer is a multi-NGO consortium sharing one merchant network [ASSUMPTION]. I also told him we need a no-PII / fresh-account-per-program privacy line plus a Confidential Tokens roadmap.
```

### RECEIVED B8 ← Stellar Architect (a8dd31a4f45ac4f54): reply to my adoption notes

```
Stellar Architect reply to the Problem Hunter's adoption notes on ReliefRail v3: I accept 4 of your 5 points, and I concede the consortium buyer.

1) CONSORTIUM: conceded. My single-NGO framing assumed donor auditability alone justifies a public ledger. I have no evidence that single NGOs ask for that [UNKNOWN], so your assumption wins. Technically it's cheap:
- Each NGO issues its own AID-x asset, and each gets its own SAC [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract].
- One Program contract can be set_admin of several SACs, holding a shared merchant registry plus per-issuer programs [ASSUMPTION; set_admin accepts any Address].
- The MVP demo uses 2 issuers (a script parameter, not new code), and merchants redeem both through one Program.
- Caveat: each issuer must hand SAC admin to a contract that a shared governance controls. For the MVP that's a 2-of-2 multisig admin key [ASSUMPTION about governance; flag it as "pilot governance"].
- The single NGO stays the entry wedge on the GTM slide.

2) PRIVACY: agreed it's a must-answer. Pitch lines: no PII on-chain, a fresh G-account per household per program, program-standard amounts, and NGO-held mapping off-chain.
- Confidential Tokens on the roadmap is testnet-only [VERIFIED https://stellar.org/blog/developers/developer-preview-confidential-tokens-on-stellar].
- Wrapping AID into a confidential token likely sits outside the issuer's auth-flag control, because the wrapper holds the underlying asset [ASSUMPTION]. So it's "roadmap: amount confidentiality", not a solved problem. I'll say exactly that.

3) CLAWBACK-AND-REISSUE AS LOST-PHONE RECOVERY: adopted as demo beat #2. It's the best reframe of clawback I've seen. Technical requirement:
- The issuer must have AUTH_CLAWBACK_ENABLED set BEFORE beneficiary trustlines are created, because the trustline inherits the clawback flag at creation [ASSUMPTION, strong; CAP-35 semantics, to re-check].
- On-chain flow: Program.clawback(lostAcct) → mint/transfer to the new sponsored account. That's one tx through the SAC admin [VERIFIED SAC exposes clawback and mint].
- Label it "smartphone-first pilot", agreed.

4) MERCHANT CASH-OUT: partly accepted.
- I keep SEP-24 OUT of the build. It's an extra integration (F1), and testanchor is fake fiat [VERIFIED per Judge's 04].
- Instead, the merchant redeems AID → USDC with the issuer (one SAC transfer back to the Program/issuer, then payout).
- The slide shows "anchor/MoneyGram cash-out route", citing the UNHCR case as real-world proof the rail exists, not as our integration [VERIFIED https://stellar.org/case-studies/unhcr].
- If we're done by Mon 06:00, add a testanchor stretch labelled "simulated fiat".

5) Demo beats agreed, in this order:
(a) off-category spend REJECTED on-chain by the Program contract;
(b) lost phone → clawback-and-reissue in ~10 s;
(c) after T1, only the waitlisted family can claim.
Composite persona, no named NGO, WFP and UNHCR as evidence only.

Where I still differ: I don't think we should build multi-NGO governance UI. Two issuer assets plus one shared merchant registry is enough to prove the consortium point. The assumption I'm making is that judges reward one complete loop over breadth (Judge's failure mode #4).
```

My position: I agree with the Architect on no governance UI (two issuers plus one shared registry proves the point). The Chairman asked for one adoption reply, so I'm not sending a second.

### RECEIVED B9 ← Wildcard Inventor replacement (a43d0cc536d5ed0bc): Quorum ABANDON + "Keyless aid"

```
ROUND B (Wildcard 3b -> Problem Hunter): Quorum ABANDON, plus one improvement to purpose-bound money, "Keyless aid". Full text: research/07_roundB_wildcard_inventor.md. Thanks for your Round B; your NGO-first, diaspora-second COMBINE fits.

Note: I am the replacement Wildcard Inventor; prior Tripwire discussion is closed per Chairman, Tripwire is suspended.

1) QUORUM: ABANDON as a standalone build. Track stays at 2.5–3 and organiser demand is anecdotal. I'm closing the thread on your Round A points with the new evidence:
- (d) "Trusted fiat operators" isn't established. EnsureDone's page doesn't say how bonuses were held [VERIFIED https://www.lesswrong.com/posts/7koSvinoHSy6KBLqy/update-2-to-dominant-assurance-contract-platform-ensuredone]. The Manifold $2,172.67 is pre-market earnings and is excluded from the market, not a total [VERIFIED https://manifold.markets/moyamo/how-much-additional-revenue-will-my]. Your core point stands anyway: organiser reluctance is the binding risk.
- (e) Farming: with a fixed-rate bonus r·p·w and irrevocable pledges, a farmer who doesn't want the project profits only if P(fail) > 1/(1+r·w), which is about 91% at r = 10%. Their own pledge lowers P(fail), and the organiser's maximum cost is the pre-committed B [VERIFIED as arithmetic; rationality is an ASSUMPTION].
- (8) Lab vs field: still lab only. The new 2026 J. Urban Econ holdout result is also an experiment [VERIFIED https://marginalrevolution.com/marginalrevolution/2026/08/breaking-ground-can-refund-bonuses-solve-the-holdout-problem.html]. Conceded.
- Salvaged: Quorum's permissionless settle (anyone triggers the post-deadline step).

2) KEYLESS AID: lock the issuer once the Program contract is SAC admin [VERIFIED that a contract can be SAC admin https://developers.stellar.org/docs/build/guides/tokens/custom-sac-admin; ASSUMPTION that it works with the issuer locked].
- Unspent aid reallocates to the next waitlisted family. Anyone can call reallocate() after the deadline; that's Quorum's settle, plus KeyHold's "silence pays the weaker party" default.
- No function sends aid to the NGO, and clawback only burns.
- Pitch: "Aid that even the aid agency can't divert."
- Why this matters for your lens (who pays). The buyer is the NGO, but the *funder* is the donor, and diversion is a top-tier donor concern. WFP estimated at least 10% of $175M/month of Yemen aid diverted in 2019, and paused aid for about 850k people over it [VERIFIED https://www.newarab.com/news/un-suspends-food-aid-houthi-controlled-areas-yemen]. Caveat: that was seizure at distribution, and we cover post-delivery diversion only.
- Assumption to test: that a programme manager *wants* to give up their own override. That's the opposite of your Round A point that buyers want control (Immunefi) [ASSUMPTION]. My counter: what they keep is enrolment and the allowlist; what they give up is the ability to move money, which is exactly what a donor audit asks them to prove they can't do [SPECULATION]. Does this hold from your adoption lens, or does it kill the buyer?

3) Your final-offer arbitration for merchant disputes: good, but scope creep for 20h. I'd put it on the "next" slide. Agreed on diaspora as the Continuation story. Keyless also helps that slide, because the school-only rule becomes code the remitter can verify nobody can change [ASSUMPTION].
```

### SENT B10 → Wildcard Inventor replacement (a43d0cc536d5ed0bc): my adoption view on Keyless aid
SendMessage result: `{"success":true,"message":"Message queued for delivery to a43d0cc536d5ed0bc at its next tool round. ..."}`
```
Problem Hunter -> Wildcard 3b, on Keyless aid: it holds from an adoption lens, but only in a softened form. Pure keyless likely kills the buyer.

WHY IT HELPS: the funder is the donor, and provable non-diversion is a donor-facing feature. The Yemen figure (at least 10% diverted, aid paused for about 850k people) [VERIFIED per your link https://www.newarab.com/news/un-suspends-food-aid-houthi-controlled-areas-yemen] is a strong "why it matters" slide, as long as we keep your caveat that it was seizure at distribution and we only cover post-delivery.

WHERE PURE KEYLESS BREAKS ADOPTION (each [ASSUMPTION] unless noted):
1. Grant agreements often require unspent funds to be returned to the donor or reprogrammed. "No function sends aid to the NGO" may make the program non-compliant with its own grant [ASSUMPTION, typical grant terms, not verified today]. Fix: unspent funds can only go to (a) the waitlist or (b) a donor-return address FIXED AT PROGRAM CREATION. The NGO can't divert, and the donor can still be refunded. I think this sells better than "nobody can touch it".
2. Operational overrides managers can't live without: a mis-enrolled household, a merchant caught overcharging, program closure. Keep enrolment, allowlist and merchant suspension. Remove only "move money to an arbitrary address". That's your own split, and I agree it's the right line.
3. Conflict with lost-phone recovery (demo beat #2, now adopted by the Architect). Clawback-and-reissue needs a mint after the burn. If the Program is SAC admin, enforce "reissue mint ≤ amount clawed back from the same household, to a new account for that household". Then recovery survives and the NGO still can't mint itself money [ASSUMPTION: Program can bound its own mints; that seems straightforward].
4. Upgradeability is the honesty trap. If the Program contract is upgradable by the NGO, "keyless" is false (K7). If it's immutable, a bug is unfixable with real aid inside. Fix: one immutable contract instance per program (rules frozen at launch), new rules = new program. Say it in one line on the slide.

ON YOUR QUESTION (does giving up the override kill the buyer?): it doesn't, *if* the thing given up is framed as "you can't divert", not "you can't intervene". Immunefi shows payers want discretion over *judgement* (scope and severity). Here the manager keeps judgement (who is eligible, which merchants) and only loses the power to redirect funds, which is the thing auditors and donors want proof they don't have [SPECULATION, consistent with your framing]. Pitch: "Aid that even the aid agency can't divert", with the asterisk "donor refunds go only to an address fixed at launch". That's my recommendation.

Agreed: final-offer arbitration goes on the "next" slide, and permissionless reallocate() is a good salvage from Quorum.
```

### SENT B11 → Chairman (main): "Round B done" note
