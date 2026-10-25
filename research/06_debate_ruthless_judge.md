# 06 — Debate log (Agent 4, Ruthless Judge)

Phase 3, Round A (attack). Started 13:41 Sun Oct 25 2026. All messages below are logged verbatim, and so is each SendMessage tool result.

Tags: [VERIFIED+link] / [ASSUMPTION] / [SPECULATION] / [UNKNOWN DEPENDENCY].

---

## A-1. Sent to Stellar Architect (a8dd31a4f45ac4f54): ReliefRail+Earmark, LeashPay

**SendMessage result (verbatim):**
`{"success":true,"message":"Message queued for delivery to a8dd31a4f45ac4f54 at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a8dd31a4f45ac4f54","name":"a8dd31a4f45ac4f54","ref":"42ccab"}}`

**Message (verbatim):**

```
Round A attack from the Ruthless Judge: the two most serious weaknesses in each of ReliefRail+Earmark ("purpose-bound money") and LeashPay, with questions at the end.

=== 1. ReliefRail + Earmark ===
W1. The native-primitive story fights the enforcement design.
- Your own doc says category rules can be bypassed by direct classic payments between authorized accounts, and the mitigation is that beneficiaries hold their balance inside the program contract or as a C-account [VERIFIED: research/02 §B2 "Biggest risk"].
- If balances live inside the contract, then AUTH_REQUIRED/clawback/trustline flags protect only the merchant edge. The "Unlocked" headline then shrinks to "a Soroban ledger plus one SAC". That is exactly the Track score you're counting on.
- Worse, as far as I know classic claimable-balance claimants are account IDs (G-addresses), not contract addresses. If so, a passkey C-account beneficiary cannot claim the 30-day claimable balance at all [ASSUMPTION; please verify against the ClaimableBalance / Claimant XDR before 15:00].
- So you can pick passkey UX or claimable-balance expiry, maybe not both.
- Merging Earmark adds a second persona (NGO officer and diaspora sender) and a second payee-side fiction (schools with wallets). Testnet off-ramps are testanchor-only, with fake fiat [VERIFIED https://developers.stellar.org/docs/build/apps/wallet/intro]. One 2-minute video can't sell both.

W2. "Isn't this SDF's Disbursement Platform / Aid Assist?" plus too many parts.
- SDF already ships aid disbursement with UNHCR [VERIFIED https://stellar.org/case-studies/unhcr]. Stellar judges know it intimately.
- Your MVP lists 5+ integrations: issuer flags, a Soroban program contract, claimable balances, sponsorship, passkey-kit, SEP-7 QR and SEP-24. That is my F1 flag.
- The team is new to Soroban and has about 20h [ASSUMPTION]. The likely outcome is a demo with visible seams. The "restricted-use" delta over SDP then looks like a feature request, not a product.
- There is no named NGO buyer or quote yet [UNKNOWN DEPENDENCY].

Questions (please answer each directly):
Q1. One sentence: where does the money physically sit between disbursement and merchant spend (G trustline, claimable balance, or contract ledger)? Which rule does each primitive enforce that the contract does not?
Q2. Can a C-address be a claimable-balance claimant? Yes/no, with a link. If no, what replaces expiry?
Q3. Which persona leads the video: NGO or diaspora sender? What exactly do you cut from the other?
Q4. Give your cut list down to at most 3 primitives plus Freighter, and what remains demonstrably impossible on SDP plus a 50-line contract.
Q5. What public evidence do we have (WFP/UNHCR/CALP stat or quote) that restricted-use digital vouchers are a pain NGOs pay to solve?

=== 2. LeashPay ===
W1. Most crowded lane, and the moat is a stock OZ feature.
- Stellar documents x402 plus an OZ facilitator as first-class [VERIFIED https://developers.stellar.org/docs/build/agentic-payments/x402]. OZ ships spending-limit policies on smart accounts [VERIFIED https://docs.openzeppelin.com/stellar-contracts/accounts/policies].
- Pre-event "Build with AI powered by Stellar" Builder HQ sessions fed this hackathon [VERIFIED https://luma.com/5flc7dsp]. I expect several x402 agent entries [SPECULATION].
- The Wildcard found REAPP on SCF and x402-policy as prior art [UNVERIFIED by me, per research/03].
- If our differentiator is "configured an OZ policy on an x402 payer", Innovation scores 2–3.

W2. The critical path is an unproven interop.
- The facilitator must simulate and verify a C-account's __check_auth under an OZ context rule [UNKNOWN DEPENDENCY; you flag it yourself].
- spending_limit may only meter `transfer` contexts [UNVERIFIED, your note]. passkey-kit's README says "demo only, not audited" [VERIFIED per research/02 link].
- If the spike fails, the fallback "allowance vault" removes both the OZ and facilitator novelty. You're left with a 150-line cap contract in the most crowded category.

Questions:
Q6. Has the 402 → pay-from-C-account → 200 roundtrip run on the testnet facilitator yet? Show the tx hash or the error.
Q7. Name one thing LeashPay enforces on-chain that the OZ docs and policy examples don't already show. Answer without the words "OpenZeppelin policy".
Q8. Who is the named first user (a specific API seller or agent framework), and why wouldn't they just use Coinbase CDP wallets on Base?
Q9. You demoted LeashPay to #5 yourself. What changed, if anything, that justifies keeping it on the shortlist?
```

---

## A-2. Sent to Wildcard Inventor (a68cdf315b30b705d): Tripwire, Quorum

**SendMessage result (verbatim):**
`{"success":true,"message":"Message queued for delivery to a68cdf315b30b705d at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a68cdf315b30b705d","name":"a68cdf315b30b705d","ref":"b62a10"}}`

**Message (verbatim):**

```
Round A attack from the Ruthless Judge: the two most serious weaknesses in each of Tripwire and Quorum, with questions at the end.

=== 1. Tripwire ===
W1. Soundness: the bounty is only as safe as code nobody has audited, and the core trick is unproven.
- The protocol team writes `holds(target) -> bool`. A wrong, incomplete or state-dependent invariant means anyone can "prove" an exploit and drain the bounty. The verifier becomes the new attack surface [ASSUMPTION].
- The proof must be built by Tripwire's own wrapper (call exploit, then check invariant, then fail with EXPLOIT_PROVEN). If the exploit contract can return that error itself, the check is meaningless. Your doc doesn't specify who raises the error [VERIFIED: research/03 §1 step 3 is ambiguous].
- Soroban forbids contract re-entrancy [ASSUMPTION; I believe the host rejects re-entry, please verify]. So Tripwire may not be able to call an inner function on itself, and you'd need a separate harness contract. Exploits that call back into Tripwire would also fail.
- Rollback of a failed `try_invoke` sub-call, including SAC balance writes, is still [UNKNOWN DEPENDENCY]. It was meant to be spiked on "Saturday". Today is Sunday 13:41.
- Single-invocation proofs only catch atomic exploits. Multi-ledger or oracle-manipulation exploits are out of scope, so the claim "insurance for every protocol's TVL" overreaches [ASSUMPTION].

W2. User Value & Problem (20%) and Market (10%) are niche, and the demo is a CLI.
- The buyer is Soroban protocol teams. There is no named prospect, quote or bounty-budget figure [UNKNOWN DEPENDENCY].
- "Pause" only works if the target contract honours Tripwire's flag, so it needs integration by the protocol up front. That is a big adoption ask for unaudited infrastructure [ASSUMPTION].
- Claim front-running (copying the exploit contract plus a claim tx with a different payout address) is unresolved [SPECULATION about flooding on Stellar]. Commit-reveal is "v2".
- A non-security judge watching `stellar contract invoke ... claim` scores UX 2–3.
- HoneyPause already exists on EVM [VERIFIED per research/03], so Innovation is "first on Soroban", not "first ever".

Questions (please answer each directly):
Q1. Has the rollback spike run? Give the exact test result: does a SAC `transfer` inside a sub-call that fails get reverted, on soroban-sdk 28 host tests?
Q2. Who raises EXPLOIT_PROVEN, and how is self-invocation or re-entrancy handled (separate harness contract?)?
Q3. How do you stop someone copying a visible claim and redirecting the payout today, not in v2?
Q4. Name one real Soroban protocol team or person who'd deploy this, and what bounty size is typical for them.
Q5. What does the judge see on screen that isn't a terminal?

=== 2. Quorum ===
W1. Track Alignment (20%) is weak.
- The product is a Soroban escrow with a settle function. No core protocol feature is load-bearing, and no ≥2 ecosystem projects are composed unless passkeys actually ship. You flag passkey integration as [UNVERIFIED] yourself.
- The Chairman's condition, "claimable-balance refunds", is cosmetic. It adds a classic op, but the bonus math and settlement still live in the contract [ASSUMPTION].
- Crowdfunding is a saturated hackathon category, so "dominant assurance contract" has to carry all of Innovation by itself [ASSUMPTION].

W2. The mechanism has an exploitable incentive and no evidence of organiser demand.
- With a pro-rata bonus, a whale can pledge up to just below the goal near the deadline and capture most of the bonus at zero risk [SPECULATION, my analysis]. Others can then grief by refusing to cross the goal.
- Early-bird weights change who is rewarded but not this sniping, unless the weight decays to roughly zero near the deadline or pledges lock bonus eligibility at time t.
- Why would an organiser pay a 10% failure bonus? The lab evidence (Cason, Tabarrok, Zubrickas) is about backers, not organiser willingness [ASSUMPTION based on research/03]. EnsureDone's status is UNVERIFIED, and if it died, that's negative evidence.

Questions:
Q6. Write the exact bonus formula, and show that it pays the last-minute whale almost nothing.
Q7. Which Stellar core protocol feature, or which ≥2 named ecosystem projects, are load-bearing (not decorative)?
Q8. What evidence is there that organisers will fund bonuses? Is EnsureDone alive, and what did it learn?
Q9. Why is a credible escrow on Stellar better than Kickstarter plus a bank-escrowed bonus for a €300 fado gig?
```

---

## A-3. Sent to Problem Hunter (a74e19b9343da9802): Roda, KeyHold

**SendMessage result (verbatim):**
`{"success":true,"message":"Message queued for delivery to a74e19b9343da9802 at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a74e19b9343da9802","name":"a74e19b9343da9802","ref":"23bd0d"}}`

**Message (verbatim):**

```
Round A attack from the Ruthless Judge: the two most serious weaknesses in each of Roda and KeyHold (+DepositBox, +timeout rule), with questions at the end.

=== 1. Roda ===
W1. The collateral paradox breaks the core claim that "the treasurer is now a smart contract".
- Your example: 10 members at €200, so the round-1 recipient gets €2,000 and still owes €1,800 [VERIFIED: research/01 §2].
- With 20% collateral (€400), that recipient can walk away €1,600 ahead. The contract has only moved the theft from the treasurer to the first payee.
- Full collateral (€1,800) removes the credit benefit that is the reason ROSCAs exist. You say this yourself [VERIFIED: research/01 "Biggest uncertainty"].
- "On-chain reputation" doesn't deter anyone with fresh addresses, so it's sybil-cheap [ASSUMPTION].
- A judge doing the arithmetic on the demo will spot this in about 10 seconds.

W2. Familiar trope, weak Track fit, and the time-based demo.
- Savings circles on-chain (chama/esusu/tanda dApps) are a recurring hackathon entry across chains [ASSUMPTION; I couldn't verify a count, so prove me wrong if you have searched].
- Stellar adds USDC SAC plus cheap fees, which any L2 offers too. No core protocol feature is load-bearing, so Track Alignment (20%) scores about 2.5.
- Rounds are monthly, so the demo needs time-travel. Cross-border diaspora demand is untested by your own note [VERIFIED: research/01 "Assumed"].
- MoneyFellows proves demand for a custodial, fiat, single-country product [VERIFIED https://meatechwatch.com/2025/05/06/moneyfellows-raises-13-million-to-expand-digital-rosca-model-across-africa-and-beyond/]. That isn't evidence for the non-custodial USDC version.

Questions (please answer each directly):
Q1. Give the exact collateral and payout-ordering rule, and the worst-case payoff for a defector in round 1 of 10. Is it negative?
Q2. If the answer is "order payouts by collateral or reputation", why is that not just a lending protocol with extra steps?
Q3. Which Stellar core protocol feature, or which ≥2 named ecosystem projects, are load-bearing?
Q4. Have you found any existing on-chain ROSCA (Stellar or other chain)? Links, and what's different.

=== 2. KeyHold (+DepositBox, +Silence-Is-Consent timeout) ===
W1. Two-sided adoption with the powerful side having negative incentive.
- The default-to-tenant timeout is exactly why a landlord in a tight Lisbon market won't opt in [ASSUMPTION].
- There's no landlord or agency quote, and the legal status of an on-chain caução is [UNKNOWN DEPENDENCY, per your own note].
- Withholding frequency in Portugal is unknown ("no stat found") [VERIFIED: research/01 §1]. User Value rests on complaint anecdotes.

W2. Generic escrow, so the Track and Innovation scores are weak.
- Trustless Work already provides Soroban milestone escrow with roles and approvals [VERIFIED https://docs.trustlesswork.com/trustless-work].
- The folded-in DepositBox was rated by its own author as "the weakest on necessary-on-Stellar" [VERIFIED: research/02 §B4].
- The path-payment refund in EUR needs testnet USDC→EUR liquidity that doesn't exist. We'd make our own market, which judges may read as staged [VERIFIED per research/02; also https://developers.stellar.org/docs/learn/fundamentals/networks for the testnet context].
- Composing Trustless Work is the only Composed angle, but whether it supports timeout auto-release is [UNKNOWN DEPENDENCY].

Questions:
Q5. Who pays and who opts in first? Name the wedge customer (student housing operator, relocation firm, specific agency), and say why they choose a tenant-favoring default.
Q6. Does Trustless Work support time-based auto-release natively? Yes/no, with a link. If not, are we composing or forking?
Q7. What does Stellar specifically do here that a regulated escrow fintech with a PSD2 account doesn't, beyond "code enforces it"?
Q8. If the timeout defaults to the tenant (KeyHold) versus following the landlord's proposal (DepositBox), which is it, and why?
```

---

## Replies received

### R-1. From the Wildcard Inventor (a68cdf315b30b705d), received after Round A. The message arrived TRUNCATED mid-Q3. Text verbatim as delivered:

```
Wildcard Inventor, Round A defence to the Ruthless Judge. Direct answers to Q1–Q9, with concessions marked.

=== TRIPWIRE ===
Q1 (rollback spike): NOT RUN. I'm under a no-application-code rule in this phase, so I can't run it. I'm telling you that plainly rather than implying a result.
- Evidence so far: "When a function panics … all storage changes are rolled back" [VERIFIED https://www.mintlify.com/stellar/rs-soroban-sdk/guides/error-handling]. The errors example says all changes are reverted [VERIFIED https://developers.stellar.org/docs/build/smart-contracts/example-contracts/errors]. Advisory GHSA-pm4j-7r4q-ccg8 describes try_call into a failing sub-contract as "simply rolled back" [VERIFIED https://osv.dev/vulnerability/GHSA-pm4j-7r4q-ccg8].
- What is not proven: grandchild frames that include SAC `transfer` [UNKNOWN DEPENDENCY].
- Proposal: whoever owns contracts writes a ~40-line cargo test with `register_stellar_asset_contract_v2`. Kill time 15:30 Sun.
- K3 doesn't kill Tripwire even if the spike fails, because sandbox mode doesn't depend on rollback. In that mode the claim `deploy_v2`s a fresh copy of the target, the exploit wrecks that copy, the invariant fails on the copy, and the bounty pays. Nothing needs reverting, and the live protocol is never touched. We lose "live-state proof + pause" and keep "proof of vulnerable code + automatic payout" [ASSUMPTION about deploy_v2 + constructor seeding; deployer docs VERIFIED https://developers.stellar.org/docs/build/smart-contracts/example-contracts/deployer].

Q2 (who raises PROVEN; re-entrancy): I accept the Architect's harness design, and I agree my 03 text was ambiguous.
- Call chain: `Tripwire.claim → try_invoke(Harness.run) → (1) Verifier.holds() must be TRUE before anything runs (pre-check, so an already-broken state can't pay) → (2) try_invoke Executor.run(script); ANY error from the script is swallowed → (3) try_invoke Verifier.holds(); FALSE → Harness panics with PROVEN; TRUE → FAILED; verifier panics → INCONCLUSIVE (no payout, conservative)`.
- Only the Harness raises PROVEN. Tripwire only ever invokes the Harness, so a PROVEN code can only come from the Harness.
- Instruction-budget exhaustion fails the whole tx, so there is no payout.
- On re-entrancy: I believe Soroban rejects re-entry [ASSUMPTION; my search did not find the doc line]. The harness design doesn't need it. Exploits that require callbacks into a contract already on the stack are out of MVP scope, and I'll say so.

Q3 (copy-the-claim, today): commit-reveal in the MVP, not v2.
- Tx 1: `commit(hash(script, claimer, salt))
```

**Judge's assessment of R-1 (so far):**
- **Q1:** an honest non-answer, acceptable under the no-code rule. The cited evidence makes rollback of ordinary storage likely. SAC balance writes in grandchild frames remain an UNKNOWN DEPENDENCY. A 15:30 kill time is acceptable.
- **Sandbox fallback:** this is the weak point. The fresh `deploy_v2` copy carries only constructor-seeded state, not the live SAC balances or the live state of dependency contracts. So the proof is of a scenario the protocol team configured, and a sloppy seed means a free bounty. It also downgrades the pitch from "self-insuring TVL" to "automated CTF".
- **Q2:** the harness call chain with a pre-check is a real fix. It resolves who raises PROVEN.
- **Q3–Q9:** the message was cut off before these answers arrived. I am sending one follow-up.

### F-1. Follow-up sent to the Wildcard Inventor (my ONE allowed follow-up for this proposer)

**SendMessage result (verbatim):**
`{"success":true,"message":"Message queued for delivery to a68cdf315b30b705d at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a68cdf315b30b705d","name":"a68cdf315b30b705d","ref":"b62a10"}}`

**Message (verbatim):**

```
Ruthless Judge follow-up (my one allowed follow-up): your reply reached me truncated mid-Q3 at "Tx 1: `commit(hash(script, claimer, salt))". Please resend Q3–Q9 in full.

I accept your Q1 honesty and the Q2 harness chain with the pre-check. That is a real fix. Two challenges to address in the resend:

(a) The sandbox fallback is weaker than you claim.
- A fresh deploy_v2 copy has only constructor-seeded state. It has no live SAC balances, no live state in dependency contracts (oracle, AMM) and no real positions [ASSUMPTION].
- So "proof" means "proof against a scenario the protocol team configured". A careless seed equals a free bounty, and a careful seed misses exactly the state-dependent bugs that matter.
- That turns the pitch from "self-insuring TVL" into "automated on-chain CTF". Is that still a winner? Score it honestly.

(b) Commit-reveal.
- What stops a griefer from committing junk to front-run the reveal window?
- What is the reveal delay in ledgers, and does it break the "proof, payment and pause in one ledger close" demo line?
- Also give a one-line answer to Q4 (a named Soroban team) and Q5 (a non-terminal UI). Those decide User Value (20%) and UX (10%).
```

---

### R-2. From the Stellar Architect (a8dd31a4f45ac4f54). Verbatim:

```
Defence reply from the Stellar Architect to the Judge's Round A attack on ReliefRail+Earmark and LeashPay. Answers to Q1–Q9 in order. Defend/improve/abandon is for Round B, but I'm showing my evidence now.

=== ReliefRail + Earmark ===
You're right about W1: the blind-phase design contradicted itself. Here's the corrected design, which also answers Q1/Q2/Q4.

Q2 first. Most likely NO, a C-address can't be a claimant. Stellar's guide defines a Claimant as "the destination account that can claim the ClaimableBalanceEntry" plus a ClaimPredicate, and every example uses G-account keys. Nothing mentions contract addresses [VERIFIED https://developers.stellar.org/docs/build/guides/transactions/claimable-balances]. I believe the XDR claimant destination is an AccountID [ASSUMPTION, strong]. Separately, the SAC exposes no function that creates claimable balances, so a Soroban contract can't use them either [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract]. Conclusion: claimable-balance expiry and passkey C-accounts don't mix. I drop passkeys. Beneficiaries get G-accounts with sponsored reserves, which is Stellar's native "no XLM needed" onboarding.

Q1. The money sits in the beneficiary's own G-account trustline, which the issuer keeps at AUTHORIZED_TO_MAINTAIN_LIABILITIES. They can hold it but cannot send it. Each spend is an atomic "authorization sandwich" in ONE tx: [issuer sets AUTHORIZED → beneficiary pays merchant → issuer sets back to MAINTAIN_LIABILITIES]. The NGO's approval server co-signs only if payee ∈ merchant allowlist and the category cap holds. This is the documented SEP-8 Regulated Assets pattern [ASSUMPTION: SEP-8 and the sandwich pattern are long-standing; I'll re-link the SEP before 15:00]. What each primitive enforces that a contract doesn't:
- AUTH_REQUIRED plus maintain-liabilities: the asset physically cannot move peer-to-peer without the issuer co-signing. That kills the resale market at protocol level and is enforced by every wallet and the DEX, not just our app.
- Claimable balances with time predicates: expiry and return without any contract or keeper.
- Clawback: fraud recovery.
- Sponsored reserves: zero-XLM beneficiaries.
Honest cost: the rules engine is an off-chain approval server (the issuer is trusted anyway, since it's the NGO), so Soroban becomes optional. That is a Technical Execution optics risk [ASSUMPTION about judges wanting Soroban].

Q2 follow-up: what replaces expiry? Nothing needs replacing, because G-accounts keep claimable-balance expiry. Better still, I'd adopt the Wildcard's "cascading claimants": one balance with Family A before T1, waitlisted Family B between T1 and T2, and NGO reclaim after T2. Each claimant gets its own predicate [VERIFIED: the guide shows per-claimant predicates such as BEFORE_RELATIVE_TIME vs NOT(BEFORE_ABSOLUTE_TIME)]. The ~10-claimant cap is [ASSUMPTION, CAP-23].

Q4. Cut list: (1) AUTH_REQUIRED/REVOCABLE/CLAWBACK asset with SEP-8 sandwich approval, (2) cascading claimable balances, (3) sponsored reserves, plus Freighter or a generated key for the demo. CUT: passkey-kit, SEP-24, SEP-7, Soroban program contract, Earmark build. What SDP plus a 50-line contract can't do: SDP disburses an unrestricted asset to a wallet. Once it lands, the recipient can send it anywhere [ASSUMPTION about SDP's current feature set]. A 50-line Soroban contract can't stop the classic transfer either. Only issuer authorization can. Concession: SDF *could* configure an AUTH_REQUIRED asset in an afternoon. Our delta is the program-rules approval engine plus the cascade, which is a product, not a protocol invention. That's a fair hit to Innovation.

Q3. NGO leads. Earmark goes on one deck slide only ("market 2", citing the J-PAL labelling result), with no school off-ramp in the demo. I agree with you and the Wildcard.

Q5. My strongest evidence is that WFP Building Blocks in Jordan ran *restricted, shop-level* redemption at scale (other agents cite 106k people and US$2.4M in fees saved, and Building Blocks pages reporting 400k+ refugees) [VERIFIED by A1/A3 links: https://innovation.wfp.org/node/25]. So the largest food-aid buyer pays for restriction. I have NO CaLP statistic on the voucher share of cash and voucher assistance today. My search didn't return it [UNKNOWN]. Counter-evidence: the sector trend is toward unrestricted cash [ASSUMPTION per A1]. We should pitch restriction as donor-required programs (medical, food, education), not the default.

=== LeashPay ===
I'll be blunt, because the evidence moved against my own idea.
Q6. No. Nobody has run 402 → C-account → 200 on the testnet facilitator (the rules forbid spikes). It is still a K3 dependency [UNKNOWN DEPENDENCY].
Q7. Honest attempt: "an agent whose budget the payee can verify before serving it" (the Wildcard's bonded-agent idea), or closing the approve/transfer_from bypass if OZ spending_limit only meters transfer [UNVERIFIED]. But I just checked REAPP: it's an AWARDED SCF #43 project ($70k) with a Soroban MandateRegistry that enforces per-agent budget caps, period limits and merchant restrictions with x402 settlement. Its testnet merchant is Query402 [VERIFIED https://communityfund.stellar.org/submissions/recrWPt0QGLHnbv5Z]. So the core of LeashPay is already funded by the SCF.
Q8. The only third-party x402 merchant on Stellar testnet I can name is Query402 (REAPP's own) [VERIFIED, same link]. Against Coinbase CDP on Base, all I have is "non-custodial policy in the account contract plus fee-free auth entries" [ASSUMPTION about CDP's custody model]. That's weak.
Q9. Nothing new justifies it. If anything REAPP lowers it further. My Round B position will most likely be ABANDON unless the bonded-agent pivot survives scrutiny. I'll decide formally in Round B.
```

**Judge's assessment of R-2 (not evasive, so no follow-up sent):**
- **ReliefRail, redesigned:** this is now a classic-ops regulated asset: SEP-8 auth sandwich, cascading claimable balances and sponsored reserves, with no Soroban.
  - *Better:* Unlocked fit is genuinely protocol-native, scope is down to 3 primitives, and the contradiction is gone. The on-chain "rejection" beat survives, because a direct P2P send fails at protocol level [ASSUMPTION about the exact result code].
  - *New risks:*
    1. **Innovation drops:** the SEP-8 approval-server pattern is old. That is the Architect's own concession.
    2. **The rules engine is an off-chain server.** That is my flag F2: the "wow" happens off-chain.
    3. **Zero Soroban** may read as low Technical Execution [ASSUMPTION]. The repo's CI and contract scaffold would go unused.
    4. **The cascade is unproven:** waitlisted Family B needs a pre-existing authorized trustline to claim, so pre-onboarding is required [ASSUMPTION].
    5. The ~10-claimant cap is unverified.
  - *Net:* about flat at 3.85. More feasible, less novel.
- **LeashPay:** effectively conceded. REAPP is an SCF #43 award ($70k) with the same core [VERIFIED per the Architect's link]. That triggers my K2 + F6 kill. **Recommend dropping it.**

### R-3. From the Problem Hunter (a74e19b9343da9802). Verbatim:

```
ROUND A DEFENCE (Problem Hunter -> Ruthless Judge) on Roda and KeyHold. Direct answers below, with concessions where the evidence goes against me.

=== RODA ===
Q1 Collateral math, stated exactly. N members, contribution c, recipient at position k. If they defect right after their payout they have paid k·c, received N·c and forfeit collateral C. Defection gain = (N−k)·c − C. A non-positive gain requires C_k ≥ (N−k)·c. For your 10 × €200 case, round 1 needs C ≥ €1,800 and round 10 needs €0. Worked 4-person €200 circle: positions 1–4 must post €600 / €400 / €200 / €0. With that rule the worst-case defector payoff is ≤ 0, so it is safe. But you are right that the round-1 member then gets **zero net credit**. They lock €600 to receive €800 early. My blind "partial collateral + reputation" version is exploitable exactly as you computed (20% collateral means walking away €1,600 ahead) [VERIFIED as arithmetic]. I concede W1 as originally designed.
Q2 "Order by collateral" is lending with extra steps. Agreed, it is basically a collateralised loan. The only ways to keep the credit benefit are to replace self-collateral with *someone else's* capital at risk: guarantor vouching, which is what the Wildcard proposed (joint liability, Grameen-style [ASSUMPTION]), or bid discounts (bidding ROSCA, as in the Taiwan paper I cited [VERIFIED https://figshare.com/articles/ROSCA_Composition_and_Repayment_Evidence_from_Taiwanese_Bidding_ROSCAs/5117500]). Whether either survives is a Round B decision.
Q3 Load-bearing Stellar features: honestly weak. The candidates are claimable balances (pay a member who hasn't onboarded yet), sponsored reserves (zero-XLM members) and the MoneyGram/anchor cash-out network for diaspora members [VERIFIED that the network exists https://stellar.org/case-studies/unhcr]. None of these is *necessary* for the core mechanism. I'd score Track about 2.5 too.
Q4 Prior art: yes, and lots of it. I searched just now. On-chain ROSCAs are a saturated trope: ChamaVault, ChamaPay, ESUSU, AjoAI ("live on Celo mainnet"), Circlepot, CoSave (Celo); ROSCA-Guard, Ronda, Saving Circles, Tanda (ETHGlobal); Bloinx (UNICEF-backed, 2022) [VERIFIED as self-descriptions: https://www.karmahq.xyz/project/ajoai/about, https://ethglobal.com/showcase/ronda-7ck82, https://ethglobal.com/showcase/saving-circles-bmgxr, https://www.unicefventurefund.org/story/bloinx-crypto-more-reliable-savings-communities-among-low-income-populations]. On Stellar, the Wildcard reports Amero (SCF #28 and #31, beta users in Mexico and the DR) and Clixpesa [VERIFIED by Wildcard; my fetch of the Amero page didn't render]. So K2-style saturation now applies to Roda. That is the most damaging finding against my own idea, and I won't hide it.
On W2 (MoneyFellows proves custodial demand, not non-custodial demand): conceded. I have no user quote asking for non-custodial. The evidence for the treasurer problem is in *informal* groups (president-run groups collapse more often [VERIFIED https://core.ac.uk/outputs/7310857]), which custodial apps also solve.

=== KEYHOLD ===
Q5 Who pays and who opts in first: I have no named customer or quote [UNKNOWN]. The most plausible wedge is employer relocation and corporate or student housing operators, who rent to the same mobile population repeatedly and whose reputation suffers from deposit disputes [SPECULATION]. The landlord-side incentive problem is real. The best answer I've seen is the Wildcard's "Deposit Passport": a reusable deposit plus an on-chain move-out history. The landlord gains a proof-funded deposit and tenant history, which flips the incentive. I will evaluate it in Round B.
Q6 Trustless Work timeout: **No**, not natively, as far as I can read. Their docs say "Only the Release Signer can execute the release". The only timer reference is a platform choice ("auto-approving after a timer"), and automation is listed as "coming soon" [VERIFIED https://docs.trustlesswork.com/trustless-work/llms-full.txt, first 100k chars only]. They *do* document security deposits for rentals as a use case [VERIFIED https://docs.trustlesswork.com/trustless-work/use-cases-unlocking-the-potential-of-smart-escrows/security-deposits]. Possible real composition: our own small Soroban "timeout keeper" contract holds the Approver/Release Signer role on a TW escrow and auto-approves after the deadline [ASSUMPTION: that TW roles accept a contract address and use require_auth, which a contract can satisfy; needs a 30-min check]. Otherwise we fork, and Composed is a stretch.
Q7 vs a PSD2 escrow fintech: the honest difference is that no licensed custodian is needed and both parties can audit the funds without trusting the operator. That is a weak moat for a regulated EU market. Portugal has no statutory scheme that I could find [UNVERIFIED], so the comparison is to *nothing*, not to a fintech. A real fintech could do this too. I concede KeyHold is the softest on the Postgres test.
Q8 Default direction: tenant-default (KeyHold), with an amendment. The *undisputed* portion releases to the tenant at once. The landlord's *claimed* amount is frozen for the arbiter window, then returns to the tenant if no evidence-backed claim is filed. Rationale: in the UK scheme model the landlord bears the burden of proving deductions [ASSUMPTION from general knowledge, not re-verified today]. DepositBox's "landlord's proposal wins on tenant silence" punishes the absent or expat tenant, who is the core persona.
W2 testnet EUR: I agree the path payment would be staged. The honest demo is a self-issued test EUR asset, clearly labelled, with the path-payment leg dropped [ASSUMPTION about EURC testnet availability; not checked].

Overall: your attacks land hardest on Roda's originality (prior art) and on KeyHold's adoption wedge. I'll propose defend, improve or abandon in Round B.
```

**Judge's assessment of R-3 (not evasive, so no follow-up sent):**
- **Roda:** effectively dead.
  - The collateral rule that makes defection safe (C_k ≥ (N−k)·c) removes all credit benefit, which the author concedes.
  - Heavy prior art, including on Stellar: Amero (SCF #28 and #31) and Clixpesa [VERIFIED per the author and the Wildcard].
  - Track fit is weak (author's own score: 2.5).
  - This hits K2 + F6. **Recommend dropping it.** The guarantor and bidding pivots are new ideas, not defences, and there's no time to validate them.
- **KeyHold:** it fails the Postgres test on the author's own admission.
  - There is no wedge customer.
  - Trustless Work has no native timeout. The "keeper contract as Release Signer" composition is a 30-minute-check [ASSUMPTION].
  - "Deposit Passport" is a pivot, not evidence.
  - **Recommend dropping it**, unless Round B brings a named operator.

### R-4. From the Wildcard Inventor (a68cdf315b30b705d), continuation in reply to F-1. Verbatim:

```
Wildcard Inventor, Round A defence continued, to the Ruthless Judge. On the Chairman's instruction, some Tripwire items are left as open items with no further explanation.

=== TRIPWIRE ===
Q3: Not answered in debate; open item.
Follow-up (a): Not answered in debate; open item.
Follow-up (b): Not answered in debate; open item.

Q4 (named team): No team has been contacted and I have no quote [UNKNOWN DEPENDENCY].
- Plausible first prospects are Soroban DeFi teams: Blend (Script3), Soroswap, Aquarius, DeFindex (PaltaLabs) [ASSUMPTION: prospects only].
- I could not find their bounty programs or typical sizes [UNKNOWN; a search found nothing for Blend/Soroswap/Aquarius].
- SDF's own bounty moved to a single HackerOne program on 7 May 2026 [VERIFIED https://hackerone.com/stellar/policy_versions].
- Honest User Value is about 2.5–3 until someone names a buyer.

Q5 (non-terminal UI): a web app with three screens, signing through Freighter.
- (1) A bounty board: target, USDC amount, status.
- (2) A researcher claim page: submit and sign.
- (3) A target dashboard: balance and status, with the stellar.expert link.
- The terminal never appears in the video.

Track fit, self-scored: the core is Soroban host semantics, not a classic core-protocol feature by your 04 definition, so Track is about 3.5–4, not 5. Composed is possible if the target uses OZ Stellar's Pausable plus SAC USDC [ASSUMPTION that OZ ships Pausable for Stellar].
Competitors: HoneyPause (EVM, Sepolia), Hydra (academic), ExploitArena (off-chain votes), Immunefi vaults (human confirmation), Stellar's HackerOne.

=== QUORUM (full) ===
First, two corrections to my own 03.
- (i) On-chain DAC prior art EXISTS. I was wrong to say none was found. "ether-on-a-stick" (TreeHacks 2016) and a 2014 deck titled "Dominant assurance contracts using Ethereum" [VERIFIED https://github-redirect.dependabot.com/phlip9/ether-on-a-stick , https://www.slideshare.net/slideshow/dominant-assurance-contracts-using-ethereum/33193977].
- (ii) EnsureDone launched around Sept 2023 with 3 projects. I found no 2025/26 status [VERIFIED https://www.lesswrong.com/posts/7koSvinoHSy6KBLqy/update-2-to-dominant-assurance-contract-platform-ensuredone,]. A related DAC platform earned about $2,172 per a resolved Manifold market [VERIFIED https://manifold.markets/moyamo/how-much-additional-revenue-will-my].

Q6 (exact formula), with campaign open at T0, deadline T, cutoff Tc = T0 + 0.75·(T − T0), bonus pool B, and per-pledge cap r = 0.20:
- Weight for pledge i made at time t_i with amount p_i: w_i = max(0, (Tc − t_i)/(Tc − T0)).
- bonus_i = min( B · p_i·w_i / Σ_j p_j·w_j , r·p_i ). Any unallocated remainder returns to the organiser.
- A whale pledging in the last 25% of the window has w = 0, so bonus = 0, exactly. A whale pledging just under the goal EARLY is not risk-free: anyone can tip the campaign over the goal, and then the whale's money funds the project.
- Sybil splitting gains nothing, because the weight depends on amount and time, not on the address [ASSUMPTION: my analysis, not formally proven].
- Residual: an early whale can still crowd honest early backers out of the bonus share, capped at r·p.

Q7 (load-bearing Stellar feature): honestly, none from the core protocol.
- The claimable-balance refund twist is WITHDRAWN. The Architect showed the SAC exposes no function that creates claimable balances [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract].
- The only route is Composed via passkey-kit plus Circle USDC, and passkey is unproven for us [UNKNOWN DEPENDENCY].
- Track is about 2.5–3. I accept your W1.

Q8 (organiser demand): no evidence beyond the tiny data points above, plus the Problem Hunter's (Dackie, the Panickssery experiment that lost $45). Conceded: organiser willingness is unproven and the field record is weak [ASSUMPTION consistent with all data points].

Q9 (why not Kickstarter plus a bank-escrowed bonus for €300):
- Kickstarter has no refund-bonus feature [ASSUMPTION], and a bank escrow for a €30 bonus is uneconomic [ASSUMPTION].
- But versus any L2 there is no Stellar-specific advantage [ASSUMPTION; I concede the Architect's point].

Net: Quorum is weaker than I pitched it on Track and demand. I'll decide defend/improve/abandon in Round B.
```

**Judge's assessment of R-4:**
- **Tripwire:** the Chairman has SUSPENDED it (see 00_chairman_log.md). I will send no further Tripwire material. Its Q3 and both follow-ups remain open items. For the record, its self-scored Track is 3.5–4 and its User Value 2.5–3, with no named buyer.
- **Quorum:**
  - The Q6 time-decayed weight with cutoff Tc and the per-pledge cap r is a sound fix for last-minute sniping. I accept it.
  - Everything else is conceded:
    - Q7: there is no load-bearing Stellar feature, and the claimable-balance refund was withdrawn.
    - Prior art exists (ether-on-a-stick 2016).
    - Organiser demand is unproven.
    - There is no advantage over any L2.
  - Revised estimate: Track 2.5, Innovation 3 → weighted about **3.2**. **Recommend dropping it.**
- **No further follow-up to the Wildcard:** I already used my one follow-up (F-1).

### Roster note (from the Chairman)
- The Wildcard Inventor's session ended (API error). Its replacement is at **a43d0cc536d5ed0bc**, and any future Wildcard messages go there.
- Tripwire is suspended from the debate.
- R-4 above arrived from the old address a68cdf315b30b705d, sent before its session ended.

---

## Round A status
- 3 of 3 messages sent. All SendMessage calls returned success (queued). No failures.
- The Wildcard reply arrived truncated. One follow-up was sent (success), and the continuation (R-4) has been received. The follow-up quota for the Wildcard is used up.
- The Architect (R-2) and Problem Hunter (R-3) replied substantively. Neither was evasive, so no follow-ups.
- Judge's view after Round A:
  - **Drop** LeashPay (REAPP prior art, SCF #43), Roda (prior art on Stellar via Amero and Clixpesa, plus the collateral paradox), KeyHold (fails the Postgres test, no wedge customer) and Quorum (no Stellar-specific feature, prior art, no organiser demand).
  - **Tripwire** is suspended by the Chairman.
  - **The only live candidate with standing is ReliefRail**, in its redesigned classic-ops form (SEP-8 auth sandwich, cascading claimable balances, sponsored reserves), at about 3.85.
  - Its open risks are: Innovation (an old SEP-8 pattern), the off-chain rules engine (F2), no Soroban in the build, and the unverified cascade trustline and ~10-claimant limits.
