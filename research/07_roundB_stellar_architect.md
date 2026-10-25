# 07: Round B, Stellar Architect (decisions + verbatim log)

## Decisions

### LeashPay → **4 ABANDON**
The deciding evidence is REAPP, a project the Stellar Community Fund awarded ($70k, SCF #43). It's a Soroban MandateRegistry that already enforces per-agent budget caps, period limits and merchant restrictions with x402 settlement, and it has a live testnet merchant (Query402) [VERIFIED https://communityfund.stellar.org/submissions/recrWPt0QGLHnbv5Z]. Our core mechanism is therefore already funded prior art in the ecosystem that will judge us. No pivot rescues it: the bonded-agent variant only covers off-chain promises and so needs off-chain adjudication [SPECULATION].

### ReliefRail / purpose-bound money → **2 IMPROVE**
The improvement: **move the SEP-8 approval logic from an off-chain server into a Soroban contract that is the admin of the voucher asset's SAC.** Keep the native claimable-balance cascade for expiry and reallocation. Working name: **"Purpose-bound aid: the compliance officer is a contract."**

Design (v3):
1. The NGO issues the `AID` asset with AUTH_REQUIRED + AUTH_REVOCABLE + AUTH_CLAWBACK_ENABLED. SEP-8 requires both auth flags [VERIFIED https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md].
2. The SAC's admin is moved with `set_admin` to the **Program contract**. The SAC exposes `set_admin`, `set_authorized`, `authorized`, `clawback` and `mint` [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract].
3. Beneficiary trustlines sit **deauthorized** (balance held but frozen) between spends [ASSUMPTION: classic semantics; a deauthorized trustline keeps its balance].
4. `Program.spend(beneficiary, merchant, amount)`: `beneficiary.require_auth()` → check merchant ∈ category allowlist, per-period cap, program not expired → `sac.set_authorized(beneficiary, true)` → `sac.transfer(beneficiary, merchant, amount)` → `sac.set_authorized(beneficiary, false)`. This is an **on-chain authorization sandwich**: the same atomicity guarantee SEP-8 gets from a single transaction ("there will be no point where the clients' accounts have open, authorized trustlines", [VERIFIED SEP-8 link]), but the rules are public contract code instead of a server. [UNKNOWN DEPENDENCY: that SAC `transfer` from a G-trustline sees the authorization set earlier in the same invocation, and that `set_authorized(false)` doesn't trip anything. This is a 1-hour cargo-test spike, which is K3 for this concept.]
5. **Cascade (expiry and reallocation) uses native claimable balances**, created by the NGO's issuer/distribution G-account, not by the contract, because the SAC can't create claimable balances [VERIFIED SAC link]. See (d).
6. Claiming needs an AUTHORIZED trustline (`NOT_AUTHORIZED` otherwise) [VERIFIED https://github.com/stellar/stellar-protocol/blob/master/core/cap-0023.md]. The claim therefore runs in a small issuer-co-signed classic sandwich [authorize → claim → deauthorize]. That co-signature is mechanical: no rules, just "is this a claim of an AID balance by its listed claimant" [ASSUMPTION about design]. This is the one remaining off-chain signer.
7. Fraud: `clawback` through the Program (admin-gated, emits an event).

### Answers to the Chairman's / Judge's open risks

**(a) What's genuinely new.** SEP-8 itself is old (created 2018, v1.7.4) [VERIFIED SEP-8 link]. What's new is three things together:
- (i) **SEP-8 rules as a public Soroban contract instead of a private approval server.** A donor or auditor can read and verify "this grant can only reach pharmacies, at most €X/week", and no server operator can quietly approve an off-policy payment. I don't know of a deployed one [ASSUMPTION; not exhaustively searched].
- (ii) **A cascading claimable-balance waterfall** that reallocates unclaimed aid to the next waitlisted family by predicate. I found no prior use [ASSUMPTION].
- (iii) Combining a classic regulated asset, SAC admin delegation to a contract, and claimable balances, which uses both of Stellar's halves.

Honest limit: each primitive exists. The novelty is the composition and making the compliance rules public. Innovation is about 3.5, not 5 [SPECULATION].

**(b) Not "a Postgres with extra steps".** v3 removes the rules server.
- A Postgres-backed voucher system has to be trusted by the donor, the merchants and the beneficiaries, and the operator can edit balances or approve anything.
- Here, the balance sits in the beneficiary's own account. The spending rules are public code. Merchants get final settlement in an asset redeemable with the issuer. Clawback and reallocation are visible on-chain.
- The remaining off-chain piece (the claim co-signer in step 6) can only authorize claims of balances that already exist with predicates fixed at creation. It can't redirect money [ASSUMPTION about design].
- Where it is still centralized: the NGO controls the issuer and the merchant allowlist. That's correct for aid, since the NGO is accountable to the donor, and it's not hidden.

**(c) Soroban: yes, now load-bearing.** The Program contract is the SAC admin and enforces the spend rules: category allowlist, per-period caps, program expiry, clawback. That is non-trivial auth and invariant logic, which the Judge's rubric names for Tech 5 [VERIFIED research/04 §4]. Technical Execution ≥4 is plausible if:
- the contract is deployed and tested in CI;
- the sandwich spike passes;
- the demo shows a real signed transaction rejected by contract rules [SPECULATION on score].
If the spike fails, fall back to the classic SEP-8 server. Tech then drops to about 3.

**(d) Cascading claimable balances, verified against CAP-23** [VERIFIED https://github.com/stellar/stellar-protocol/blob/master/core/cap-0023.md]:
- `Claimant claimants<10>`: **max 10 claimants**, non-empty, no duplicate destinations.
- Predicates: UNCONDITIONAL, AND (2 children), OR (2 children), NOT (1), BEFORE_ABSOLUTE_TIME, BEFORE_RELATIVE_TIME. Max depth 4.
- BEFORE_ABSOLUTE_TIME is true if closeTime < absBefore, so NOT(BEFORE_ABSOLUTE_TIME(T)) means "at or after T".
- Mutually exclusive windows:
  - Family A: `BEFORE_ABSOLUTE_TIME(T1)`
  - Family B: `AND(NOT(BEFORE_ABSOLUTE_TIME(T1)), BEFORE_ABSOLUTE_TIME(T2))` (depth 3, within the limit)
  - NGO: `NOT(BEFORE_ABSOLUTE_TIME(T2))`
- Per-claimant predicates are also shown in the docs guide [VERIFIED https://developers.stellar.org/docs/build/guides/transactions/claimable-balances]. That makes 1 primary + up to 8 waitlisted families + NGO = 10.
- **Correction to my own Round A pitch:** the money does not *move* by itself. Family B becomes the only party able to claim after T1. B still has to submit a claim (via the app). The honest video line is "after 14:00, only Family B can claim it, and no admin action was needed". "Nobody pressed a button" overclaims [VERIFIED from claim semantics in CAP-23].
- Claim requires an AUTHORIZED trustline [VERIFIED CAP-23], hence the claim sandwich in step 6.
- Each claimant adds one base reserve, paid by the creator and returned to it on claim [VERIFIED CAP-23]. That's fine for the NGO.

**(e) Beneficiary trustline, auth limits and zero-XLM onboarding.**
- Claimants must be AccountID (G-accounts) [VERIFIED CAP-23], so no passkey C-accounts.
- Onboarding: the NGO sponsors account creation with **startingBalance 0** and the AID trustline reserve via Begin/EndSponsoringFutureReserves. Both the sponsor and the sponsored account sign [VERIFIED https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves].
- Fees: the NGO fee-bumps the beneficiary's transactions. Soroban `spend` calls can also be relayed with the beneficiary signing only the auth entry [ASSUMPTION; fee-bump exists, not re-verified today].
- The beneficiary key is generated in the PWA, which needs a recovery story; NGO-held recovery is a pitch point, not in the MVP [ASSUMPTION].
- Trustline auth: kept deauthorized or maintain-liabilities. Only the Program (on-chain) or the claim sandwich flips it momentarily.

**(f) Sharpest user and buyer.**
- **Buyer:** a cash-and-voucher programme manager at a mid-size INGO or local Red Cross/Red Crescent society running *restricted medical/pharmacy vouchers* in a refugee response. Donors require restriction there, and the NGO lacks WFP-scale infrastructure [ASSUMPTION; no named organisation or quote, so UNKNOWN DEPENDENCY for evidence].
- **User:** a beneficiary family plus a contracted pharmacy.
- **Why not SDP:** SDP is a disbursement tool. Once USDC lands it is unrestricted, and SDP's job ends at delivery [ASSUMPTION about SDP's current feature set; the UNHCR case study is unrestricted cash, VERIFIED https://stellar.org/case-studies/unhcr]. Our product governs what happens *after* delivery (purpose, cap, expiry, reallocation, clawback) with public rules.
- **Positioning:** a **complement to SDP**. SDP could disburse AID into our Program, which is a credible SCF continuation story [SPECULATION].
- Evidence of willingness to pay for restriction: WFP Building Blocks' restricted, shop-level redemption at scale [VERIFIED per A1 link https://innovation.wfp.org/node/25].

### Cut line (20h)
- **Build:** issuer setup script; Program contract (spend / allowlist / cap / clawback) with tests; claimable-balance cascade script; NGO dashboard; beneficiary PWA (generated key, sponsored); merchant view.
- **Cut:** passkeys, SEP-24, SEP-7, Earmark build (one deck slide only), multi-category UI.
- **Contracts: 1.** Integrations: SAC + classic ops, no third party.

---

## Verbatim log

### SENT 1–3: Decisions to the Judge (a2cb972d7bcf3040e), the Problem Hunter (a74e19b9343da9802) and the replacement Wildcard (a43d0cc536d5ed0bc)
All three received the identical text below:

> Round B decisions from the Stellar Architect: LeashPay is ABANDONED and ReliefRail is IMPROVED (v3). Full detail is in research/07_roundB_stellar_architect.md.
>
> LEASHPAY → ABANDON. The deciding evidence: REAPP, SCF #43, awarded $70k. Its Soroban MandateRegistry already enforces per-agent caps, period limits and merchant restrictions with x402, and it has a live testnet merchant, Query402 [VERIFIED https://communityfund.stellar.org/submissions/recrWPt0QGLHnbv5Z].
>
> RELIEFRAIL / PURPOSE-BOUND MONEY → IMPROVE (v3): "the compliance officer is a contract".
> - The NGO issues AID with AUTH_REQUIRED + REVOCABLE + CLAWBACK (SEP-8 requires both auth flags [VERIFIED https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md]).
> - The SAC's admin is moved via set_admin to a Soroban Program contract (SAC exposes set_admin/set_authorized/clawback [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract]).
> - Program.spend(beneficiary, merchant, amount): beneficiary.require_auth → check category allowlist, period cap and expiry → set_authorized(true) → transfer → set_authorized(false). That's an ON-CHAIN SEP-8 sandwich with public rules and no approval server. [UNKNOWN DEPENDENCY: whether transfer sees the in-invocation authorization. A 1h cargo-test spike; K3 for this concept.]
> - Expiry and reallocation stay native: a claimable-balance cascade created by the NGO's G-account.
>
> (a) What's new: SEP-8 is from 2018 [VERIFIED]. New here: SEP-8 rules as a public contract instead of a private server [ASSUMPTION that none is deployed], plus a predicate waterfall that reallocates unclaimed aid [ASSUMPTION it's novel]. My honest estimate is Innovation about 3.5.
>
> (b) Not Postgres: there's no rules server. Balances sit in beneficiaries' own accounts. The rules are auditable code. The only off-chain signer co-signs claims of balances whose predicates were fixed at creation, so it can't redirect funds [ASSUMPTION about design]. The NGO-controlled issuer and allowlist are centralised by design, and we say so openly.
>
> (c) Soroban: yes, and now load-bearing (auth, invariants, caps, clawback). Tech ≥4 is plausible if the spike passes and CI tests run. If it fails, we fall back to a SEP-8 server and Tech is about 3 [SPECULATION].
>
> (d) Verified against CAP-23 [https://github.com/stellar/stellar-protocol/blob/master/core/cap-0023.md]:
> - Claimant claimants<10>, so max 10. No duplicate destinations.
> - Predicates: AND/OR/NOT/BEFORE_ABSOLUTE_TIME/BEFORE_RELATIVE_TIME, max depth 4. BEFORE_ABS is true if closeTime < absBefore.
> - Windows: A = BEFORE_ABS(T1); B = AND(NOT(BEFORE_ABS(T1)), BEFORE_ABS(T2)); NGO = NOT(BEFORE_ABS(T2)). These are mutually exclusive, depth 3.
> - Claim requires an AUTHORIZED trustline, so the claim goes in an issuer-co-signed sandwich.
> - CORRECTION to my Round A pitch: money doesn't move by itself. After T1, ONLY Family B can claim, and B must still submit the claim. "Nobody pressed a button" overclaimed.
>
> (e) Claimants are AccountIDs [VERIFIED CAP-23], so beneficiaries get G-accounts.
> - Zero-XLM onboarding: the NGO sponsors CreateAccount with startingBalance 0 and the trustline reserve; both parties sign [VERIFIED https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves].
> - Fees: fee-bump or relayed auth entries [ASSUMPTION, not re-verified].
>
> (f) Buyer: a cash-and-voucher programme manager at a mid-size INGO or national Red Cross/Crescent society running restricted pharmacy/medical vouchers [ASSUMPTION; no named org = UNKNOWN DEPENDENCY].
> - Why not SDP: SDP ends at delivery, and delivered USDC is unrestricted (the UNHCR case is unrestricted cash [VERIFIED https://stellar.org/case-studies/unhcr]). We govern purpose, cap, expiry, reallocation and clawback after delivery. Positioned as a complement to SDP.
> - Demand evidence: WFP Building Blocks' restricted shop redemption [VERIFIED https://innovation.wfp.org/node/25].
>
> Cut line: 1 contract plus classic scripts. Passkeys, SEP-24, SEP-7 and the Earmark build are all cut.

SendMessage results:
- `{"success":true,"message":"Message queued for delivery to a2cb972d7bcf3040e at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a2cb972d7bcf3040e","name":"a2cb972d7bcf3040e","ref":"5d5244"}}`
- `{"success":true,"message":"Message queued for delivery to a74e19b9343da9802 at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a74e19b9343da9802","name":"a74e19b9343da9802","ref":"23bd0d"}}`
- `{"success":true,"message":"Message queued for delivery to a43d0cc536d5ed0bc at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a43d0cc536d5ed0bc","name":"a43d0cc536d5ed0bc","ref":"340015"}}`

### RECEIVED 1 ← Problem Hunter (a74e19b9343da9802): their Round B decisions

ROUND B DECISIONS (Problem Hunter): Roda ABANDON, KeyHold/Deposit Passport ABANDON, and COMBINE my demand evidence into your purpose-bound money with the NGO as first customer. Full reasoning is in research/07_roundB_problem_hunter.md.

1) RODA: ABANDON. Your R1–R4 hold. Guarantor vouching doesn't fix the arithmetic, it moves the loss: in a 10 × €200 circle the position-1 defector still nets +€1,800 while vouchers cover it. The capital-free "vouch with your future pot" variant (vouchers at positions 9–10 top up €100/round or forfeit their own €2,000 pot) is incentive-compatible for vouchers [ASSUMPTION: my derivation] but isn't deterrence. No load-bearing Stellar feature, plus Amero and Clixpesa on Stellar and about 8 Celo dApps [VERIFIED https://www.karmahq.xyz/project/ajoai/about]. About 3.0 weighted [ASSUMPTION].

2) KEYHOLD → DEPOSIT PASSPORT: ABANDON. It's a new idea with no paying customer [UNKNOWN]. Reposit and Zero Deposit already give landlords 6–8 weeks' cover [VERIFIED https://www.augustapp.com/blog/zero-deposit-vs-flatfair-vs-reposit], so it fails the Postgres test. Trustless Work's reference use case is rental deposits [VERIFIED https://docs.trustlesswork.com/trustless-work/use-cases-unlocking-the-potential-of-smart-escrows/security-deposits]. Your "why Stellar not Base" question has no honest answer. Salvage: final-offer arbitration as a dispute rule for contested merchant redemptions [SPECULATION].

3) COMBINE → your purpose-bound money: I back NGO-first, with diaspora as the second market.
- The merchant is the binding adopter, and only an NGO contracts merchants at scale (WFP Building Blocks: contracted shops, 106k people, $2.4M saved) [VERIFIED https://innovation.wfp.org/node/25].
- Cash and voucher assistance was $7.9B in 2022, about 21% of humanitarian aid [VERIFIED https://www.calpnetwork.org/?p=199218]. Voucher share is [UNKNOWN].
- Diaspora demand is for the *label* (more than 15%), not enforcement (about 2.2%) [VERIFIED https://www.povertyactionlab.org/print/pdf/node/1937?lang=en]. So diaspora is the Continuation slide: $685B in remittances in 2024 [VERIFIED https://blogs.worldbank.org/en/peoplemove/in-2024--remittance-flows-to-low--and-middle-income-countries-ar] earmarking into a merchant network that NGOs have already onboarded [SPECULATION].
- Persona to use: a cash and voucher assistance officer at a mid-size NGO running sector-specific vouchers (pharmacy or school supplies) who can't run a WFP-style private chain and for whom SDP is unrestricted. No named organisation (K7).
I'll reply on adoption when your Round B on ReliefRail arrives.

(No reply needed: their decisions match v3, and their persona matches (f).)
