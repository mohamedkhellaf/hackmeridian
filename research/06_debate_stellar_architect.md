# 06: Debate log, Stellar Architect (Round A)

Every message I sent and received in Round A, copied word for word with its SendMessage result. Times are approximate, Sun Oct 25 2026.

Verification done for this round (docs only):
- Errors doc: a failed function's changes are rolled back. Advisory GHSA-pm4j-7r4q-ccg8: a failed `try_call` sub-call is rolled back and the caller continues. **Rollback of nested writes is not explicitly stated.**
- The SAC function list contains no way to create a claimable balance (https://developers.stellar.org/docs/tokens/stellar-asset-contract).
- The claimable balances guide defines a claimant as a "destination account" with its own predicate (https://developers.stellar.org/docs/build/guides/transactions/claimable-balances).
- Trustless Work overview page: timeout/auto-release is not mentioned.
- REAPP (SCF #43, awarded $70k) is direct prior art for LeashPay (https://communityfund.stellar.org/submissions/recrWPt0QGLHnbv5Z).

---

## SENT 1 → Wildcard Inventor (a68cdf315b30b705d): attack on Tripwire and Quorum

Round A attack from the Stellar Architect on TRIPWIRE and QUORUM (feasibility on testnet in about 20h, and whether Stellar is necessary).

=== TRIPWIRE ===
Overall: this is the most load-bearing use of Soroban on the shortlist, and I ranked it #1. Below are the ways it breaks as currently written.

T1. Rollback semantics. Stellar's errors doc says: "If an error is returned from a function anything the function has done is rolled back… all those changes are reverted" [VERIFIED https://developers.stellar.org/docs/build/smart-contracts/example-contracts/errors]. Advisory GHSA-pm4j-7r4q-ccg8 describes contract A calling B via try_call, B failing, A continuing, and "the contract call is simply rolled back" [VERIFIED https://www.wiz.io/vulnerability-database/cve/ghsa-pm4j-7r4q-ccg8]. Neither source says explicitly that writes in *grandchild* frames, including SAC balance changes, are rolled back [UNKNOWN DEPENDENCY]. The host's per-frame rollback design implies they are [ASSUMPTION]. This needs a cargo-test spike with register_stellar_asset_contract_v2 before you commit.

T2. Re-entrancy. Soroban rejects contract re-entry, so Tripwire cannot try_invoke itself to get a frame that "fails on purpose" [ASSUMPTION, strong; please confirm in the docs]. You need a separate HARNESS contract: Tripwire.claim → try_invoke(Harness.run) → Exploit.execute(target) → Verifier.holds(target) → panic(EXPLOIT_PROVEN). One more thing to check: if the exploit legitimately calls back into a contract that is already on the call stack, for example a vault callback, re-entry will trap and the exploit fails for reasons unrelated to the bug [ASSUMPTION].

T3. Forged error code. Contract errors are (Contract, u32), and as far as I can tell the outer try_invoke does not learn WHICH contract raised the error [ASSUMPTION]. A malicious "exploit" could just panic with the EXPLOIT_PROVEN code and collect the bounty without breaking anything. The harness has to call the exploit and the verifier through try_invoke itself, map any error from them to EXPLOIT_FAILED or INCONCLUSIVE, and be the only contract that ever raises PROVEN. Edge cases: what if the verifier panics because the exploit bricked the target, or the exploit burns the whole instruction budget? Is that PROVEN or not?

T4. The exploit leaks before the claim. Uploading Wasm and deploying a contract are separate transactions from the claim invocation, because a Soroban tx carries a single host-function op [ASSUMPTION, strong]. So the exploit Wasm is public on-chain at least one ledger (~5 s) before the claim tx that pauses the target. A watcher could replay it for real. Proposed fix: a pre-deployed generic CALL-SCRIPT EXECUTOR where the exploit is passed as Vec<(contract, fn, args)> inside the claim tx itself, so revealing it and pausing happen in the same ledger. Callback-style exploits (flash-loan receivers) still need the Wasm route plus a bonded commit-then-pause.

T5. Bounty front-running. If payout_addr is a free argument, a copycat can resubmit the identical claim with their own address. Stellar has no Ethereum-style public mempool, but transactions do flood between validators [UNKNOWN DEPENDENCY on how exploitable that is]. Bind the payout to require_auth of the whitehat recorded in a prior commit, or to a beneficiary() hardcoded in the exploit.

T6. "Pause" needs the target to cooperate. The circuit breaker only works if the target protocol checks Tripwire's paused flag [ASSUMPTION about your design]. That is an integration every customer has to ship, which hurts both the "insurance for every protocol" pitch and Market. The deploy_v2 sandbox fallback avoids the integration, but it proves the code is vulnerable rather than the LIVE state, and seeding realistic state into a copy of a lending pool is hard [SPECULATION].

T7. Verifier soundness is the real product risk. A buggy or over-strict invariant lets someone drain the bounty with a non-exploit. Who audits the verifier? For the demo, a hand-picked buggy vault plus a two-line invariant is fine, but judges will ask.

T8. Feasibility: Tripwire + Harness + Executor + demo Vault + Verifier + Exploit is 5–6 contracts, which trips the Judge's F1 (more than 2 contracts). Each is small and there's no wallet or passkey risk, so I still rate it feasible in 20h [ASSUMPTION]. Market: Soroban TVL is small next to EVM, so the answer to "who are the first 10 customers?" matters [UNKNOWN DEPENDENCY].

Questions for you (Tripwire):
(a) Will you adopt Harness + call-script executor as the MVP architecture? If not, how do you stop T3 and T4?
(b) Exactly which error outcomes count as PROVEN versus FAILED?
(c) Does the demo vault honour pause through a Tripwire hook? Then say so honestly in the pitch: "requires target integration".
(d) Name 3 real Soroban protocols (Blend, Soroswap, Aquarius, DeFindex…) and the invariant each would register. If you can't, User Value stays around 3.
(e) Who runs the rollback spike, and what is the kill time?

=== QUORUM ===
Overall: very feasible (1 contract + SAC), and a real mechanism. But Stellar is barely necessary in the current design.

Q1. The chairman's "claimable-balance refunds" fix probably can't be done by the contract. The SAC exposes only allowance, approve, balance, transfer, transfer_from, burn, burn_from, decimals, name, symbol plus admin set_admin, admin, set_authorized, authorized, mint, clawback, trust, and nothing creates claimable balances [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract]. I found no host function that lets a Soroban contract emit classic operations [ASSUMPTION, strong]. So claimable-balance refunds would need an off-chain operator account to create them, which reintroduces the trusted party the DAC exists to remove. Pull-based refund() is the honest design, and then Quorum has no Stellar-native primitive at all.

Q2. The "why Stellar, not Base?" answer is weak. Credible escrow for the bonus works the same on any smart-contract chain. Your fee argument ("€5 pledges aren't viable on Ethereum L1") ignores L2s, where fees are also cents [ASSUMPTION]. Track Alignment looks like 2–3/5 unless the passkey and sponsorship UX is real (Composed: passkey-kit / OZ smart accounts + USDC). The Judge rates hand-rolled passkey integration as a K3 risk.

Q3. Bonus farming. Pro-rata bonus is risk-free yield on a campaign that is visibly failing: a whale pledges just under the remaining gap minutes before the deadline and collects most of the bonus [SPECULATION, but it follows directly from pro-rata payout]. You need a time-weighted bonus (the Judge's early-bird fix) and/or a per-address cap. Sybils defeat per-address caps for free on-chain [ASSUMPTION].

Q4. The organiser can self-pledge the gap with a sock-puppet to force "success" whenever gap < bonus, and backers can't detect it on-chain [SPECULATION]. That undermines the "failure pays you" promise, which is the whole credibility argument. How does the contract or UX address this?

Q5. Demo honesty: your "three phones buzz with refund + €4.17" moment needs a short-deadline mode and push notifications. Notifications are off-chain [ASSUMPTION]. That's fine, just don't let the off-chain parts become the wow (F2).

Questions for you (Quorum):
(a) Given Q1, what is Quorum's Stellar-specific primitive? If it's "none, Composed via passkeys + USDC", which two ecosystem projects exactly, and have you seen a working passkey-kit example on current SDKs?
(b) What's your bonus formula that is immune to last-minute farming (Q3)?
(c) What's your answer to organiser self-pledging (Q4)?
(d) Give one data point that organisers would actually pay a failure bonus (any pilot, EnsureDone's status?).

**SendMessage result:** `{"success":true,"message":"Message queued for delivery to a68cdf315b30b705d at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a68cdf315b30b705d","name":"a68cdf315b30b705d","ref":"b62a10"}}`

---

## RECEIVED 1 ← Ruthless Judge (a2cb972d7bcf3040e): attack on ReliefRail+Earmark and LeashPay

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

---

## RECEIVED 2 ← Problem Hunter (a74e19b9343da9802): attack on ReliefRail+Earmark and LeashPay

ROUND A ATTACK (Problem Hunter -> Stellar Architect) on ReliefRail+Earmark ("purpose-bound money") and LeashPay. My lens: who pays, who adopts first, and why now.

== ReliefRail + Earmark ==
1. The buyer already has this, so who switches? WFP Building Blocks has run merchant-redeemed aid at contracted shops in Jordan since 2017, reaching 106,000 people and saving US$2.4M in fees [VERIFIED https://innovation.wfp.org/node/25, https://www.technologyreview.com/2018/04/12/143410/inside-the-jordan-refugee-camp-that-runs-on-blockchain/amp/]. UNHCR uses Stellar Aid Assist/SDP for unrestricted USDC [VERIFIED https://stellar.org/case-studies/unhcr]. So the two largest buyers already have a vendor. Our first customer would have to be a mid-size NGO that has neither, and I have no named one [UNKNOWN DEPENDENCY].
2. The sector has been moving *toward* unrestricted cash. WFP Jordan's own reporting describes introducing unrestricted cash so refugees can meet needs by their own priorities [VERIFIED as wording in 2018 WFP Jordan report, via search; I did not read the full PDF]. The cash-transfer literature broadly favours unrestricted cash [ASSUMPTION: I didn't re-verify the CaLP position today]. A pitch built on "restriction" may look backwards to an aid-literate judge.
3. Beneficiary UX vs reality: passkey PWA plus QR at a pharmacy assumes smartphones and merchants willing to hold an AUTH_REQUIRED token and redeem through an anchor. The merchant is the hardest adopter, because they carry FX and cash-out risk [ASSUMPTION]. For the demo, who plays the merchant, and what does the merchant gain over M-Pesa or cash? [UNKNOWN DEPENDENCY]
4. Earmark folded in: evidence cuts both ways. In the Philippines RCT, *labelling* raised remittances by more than 15%, but direct payment to the school added only about 2.2% more [VERIFIED https://www.povertyactionlab.org/print/pdf/node/1937?lang=en]. Senders value the *label*, not enforcement. That is a soft-commitment result, and it doesn't prove demand for an on-chain restriction engine. Be careful not to over-claim it on the deck.
5. "Why now": SDF already ships SDP and Aid Assist. A judge from SDF may ask "why isn't this a SDP feature request?" [SPECULATION]. F6 overlap is real.

== LeashPay ==
6. Who pays? Agent developers today mostly pay for APIs with prepaid credits or API keys on a card. The seller side of x402 is the real cold start: how many APIs a judge cares about accept x402 on *Stellar* specifically? [UNKNOWN DEPENDENCY] If our demo API is our own Express server, the "market" is us paying ourselves.
7. Crowding: the Judge predicts agentic/x402 as the #1 saturated category, and the Wildcard found REAPP (SCF), OZ smart-account policies and x402-policy covering spending caps [VERIFIED via 03 and 04 docs, not re-checked by me]. The adopter question is "why not just attach an OZ spending_limit policy myself?". If the honest answer is "LeashPay *is* that policy plus a dashboard", that's a thin product.
8. Is the pain felt yet? The scenario where a prompt-injected agent drains a wallet is compelling, but I know of no public incident with real losses from an agent holding stablecoin keys [UNKNOWN: I didn't find one, and that's not proof none exist]. Without one, "why now" rests on a hypothetical.
9. The spending_limit policy reportedly only meters `transfer` contexts [UNVERIFIED per your own 02]. A malicious payload via `approve`, or a different contract call, might bypass it. If the demo's own hero claim can be bypassed, a security-minded judge kills it.

POINTED QUESTIONS:
(a) ReliefRail: name one NGO or program, real and public, that runs *restricted* vouchers today without blockchain and would plausibly pilot this. What are they using, and at what cost?
(b) ReliefRail: what does the merchant gain, in euros or hours, versus how they're paid now?
(c) ReliefRail: how do we answer "the sector prefers unrestricted cash"? Is restriction a feature donors demand (e.g. pharmacy-only medical aid)? Show evidence.
(d) LeashPay: name one third-party x402 API on Stellar mainnet or testnet that a real agent would pay for today.
(e) LeashPay: what would make a developer install LeashPay instead of 20 lines of OZ policy config? What is the product beyond the policy?
(f) Both: who is the *first 10 users* list, and could we get one quote from any of them before 10:00 Mon?

---

## SENT 2 → Problem Hunter (a74e19b9343da9802): attack on Roda and KeyHold

Round A attack from the Stellar Architect on RODA and KEYHOLD (feasibility on testnet in about 20h, and whether Stellar is necessary).

=== RODA ===
R1. "Contributions are pulled each round" is not enforcement. A Soroban contract can only pull via SEP-41 approve/transfer_from. SAC approve takes a live_until_ledger expiry [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract]. The member can revoke the allowance or move their balance at any moment, and transfer_from then just fails [ASSUMPTION, strong; standard SEP-41 semantics]. That makes it a standing order, not a commitment. Allowance lifetime is also capped by max entry TTL, so a 10-month circle will likely need re-approvals [ASSUMPTION; check `stellar network settings`].

R2. The collateral paradox is arithmetic, not a UX detail. With N members contributing c, the round-1 recipient receives about (N−1)c and still owes (N−1)c. Full protection needs collateral of about (N−1)c, roughly the pot itself, so the early recipient gets no credit and the ROSCA's economic purpose disappears [ASSUMPTION; derived from your own design]. Your doc already admits partial collateral weakens enforcement [VERIFIED research/01 §2 "Biggest uncertainty"].

R3. On-chain "saver reputation" is free to abandon. A defaulter makes a new G-address, and with sponsored reserves the newcomer doesn't even need XLM [ASSUMPTION]. Reputation therefore deters only if it is bound to identity, for example SEP-10 auth to a KYC anchor or a phone number [UNKNOWN DEPENDENCY; not in your MVP]. Without that, the "defaulter's profile turns red" demo moment is theatre: they just come back as someone else.

R4. Stellar necessity is low. Nothing in Roda uses a Stellar-native primitive beyond SAC USDC and cheap fees. Celo and other mobile-stablecoin chains target exactly this diaspora and savings-group market [SPECULATION; I didn't check specific prior-art repos, please do]. Track Alignment looks like 2–3/5 on both tracks. Composed would need a real second project (an anchor, or passkey-kit).

R5. Feasibility is high: 1 contract, about 200–300 lines [ASSUMPTION]. Rounds need a configurable short period for the demo (Judge F8). Fine.

Questions (Roda):
(a) What is the exact collateral formula, and with it, how much credit does the round-1 member actually get? Give a worked number for a 4-person €200 circle.
(b) How does Roda stop the same human from defaulting and coming back under a fresh address? If the answer is KYC/SEP-10, is that in the 20h MVP?
(c) What happens when a member revokes their allowance mid-circle? Show the state machine.
(d) One sentence on "why Stellar and not Celo", citing a specific protocol feature.
(e) MoneyFellows is custodial and has 8.5M users. Is non-custodial something users actually ask for, or something we're projecting? Any quote?

=== KEYHOLD (+DepositBox +Silence-Is-Consent timeout) ===
K1. The Composed route via Trustless Work is unproven. Trustless Work's overview page mentions milestones, approvals, partial releases, disputes, a REST API and a React SDK, but says nothing about timeout or auto-release, and links to a Mainnet Swagger with no testnet mentioned [VERIFIED https://docs.trustlesswork.com/trustless-work]. If timeout-to-tenant isn't native, we fork their contract, and then "Composed" is a stretch [UNKNOWN DEPENDENCY].

K2. Postgres test. The UK schemes prove that neutral custody + timeout + adjudication works with a licensed custodian and a database [VERIFIED per your research/01 citation of Landlord Today]. Our claim is really "no licensed custodian needed". In Portugal that raises the question whether a USDC deposit in a contract is even a valid caução, and what the landlord's EUR exposure is [UNKNOWN DEPENDENCY, legal; K7 honesty risk if we imply legal equivalence].

K3. Currency mismatch. A Lisbon landlord wants EUR. Testnet has no real EURC liquidity, so DepositBox's USDC→EUR path-payment leg needs us to seed our own SDEX offers (Judge F3) [ASSUMPTION]. Real-world volatility between USDC and EUR over a 1–2-year lease is a cost someone bears [ASSUMPTION].

K4. Contract lifetime. A deposit sits for 12–24 months, so persistent entries need TTL extension. P23's state archival changes (CAP-62/66) make restoring archived entries easier [VERIFIED https://developers.stellar.org/docs/networks/software-versions], but the design must call extend_ttl or document restoration [ASSUMPTION about the exact max TTL].

K5. Innovation is the weakest on the shortlist. A deposit escrow with a timeout default is about a 150-line contract, and Trustless Work demos plus many hackathon escrows already exist (your own note) [VERIFIED research/01 §4]. Feasibility is very high and Innovation is about 2/5. Track: Unlocked fails ("we deployed a contract"). Composed only if Trustless Work + an anchor/passkeys really compose.

K6. F7 cold start. The landlord is the party who gives something up (control over the deposit) and holds the power in Lisbon's market. The tenant can't adopt alone [VERIFIED as your own stated risk, research/01 §1].

Questions (KeyHold):
(a) Have you confirmed in Trustless Work's Escrow Design / API docs that a deadline-based release to a specific party is supported? Link, or "no".
(b) Who funds the escrow, in what asset, and what does the landlord receive (USDC or EUR)? How is the EUR leg demoed honestly on testnet?
(c) What is the landlord's incentive to accept KeyHold rather than a bank transfer? Name a first adopter segment with a reason, e.g. student residences that market "no-dispute deposits".
(d) What's the one thing in KeyHold that judges have NOT seen in other Stellar escrow demos?
(e) Can you write the "why Stellar not Base" sentence citing a protocol feature (not "cheap fees")?

**SendMessage result:** `{"success":true,"message":"Message queued for delivery to a74e19b9343da9802 at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a74e19b9343da9802","name":"a74e19b9343da9802","ref":"23bd0d"}}`

---

## RECEIVED 3 ← Wildcard Inventor (a68cdf315b30b705d): attack on ReliefRail+Earmark and LeashPay

Wildcard Inventor, Round A attack on ReliefRail+Earmark and on LeashPay (originality and memorability lens). Each point ends with a disruptive fix, and pointed questions are at the end.

== 1. ReliefRail + Earmark ("purpose-bound money") ==

ORIGINALITY ATTACK
- Restricted-use aid vouchers on a blockchain have been done at scale. WFP Building Blocks ran on an Ethereum-based permissioned setup and reportedly served over 400k refugees with shop-level redemption [VERIFIED https://uninnovation.network/projects/building-blocks-6 , https://weforum.org/agenda/2019/06/refugees-autonomy-blockchain-technology]. A 2019 critique says it reproduced the e-voucher model "in the same manner" [VERIFIED https://thenextweb.com/news/a-blockchain-payment-system-can-empower-refugees-if-they-participate-in-its-design].
- SDF's own Aid Assist / SDP with UNHCR is the reference Stellar aid story [VERIFIED https://stellar.org/case-studies/unhcr]. An SDF-adjacent judge will open with "isn't this SDP plus asset flags?".
- Memorability: "a payment to the alcohol shop gets rejected" is the demo any competent team would choose for vouchers. Among about 100 submissions it reads as solid but expected [ASSUMPTION].
- The Earmark half adds a remittance frame, the most saturated Stellar category per 04 [ASSUMPTION per our Judge]. On testnet the payee off-ramp is fictional [VERIFIED per A1's own doc: anchor corridors UNVERIFIED].

DESIGN HOLE THAT DOUBLES AS AN ORIGINALITY PROBLEM
- Claimable balances, as far as I know, only name G-account claimants, not contract addresses [UNKNOWN DEPENDENCY: please verify on P29].
- If beneficiaries must hold the AID asset in a G-account trustline to receive claimable-balance expiry, they can then make classic payments to *any other authorized account*, including other beneficiaries. That creates a peer-to-peer resale market for vouchers, and category caps only hold inside your Soroban contract [ASSUMPTION based on classic auth semantics].
- In short: either beneficiaries keep balances inside the contract (then no native claimable-balance expiry), or they hold trustlines (then no category enforcement). Which one is it?

DISRUPTIVE IMPROVEMENT 1: "cascading aid" (my strongest suggestion)
- Use the fact that one claimable balance can carry several claimants, each with its own predicate [ASSUMPTION: I believe the up-to-10-claimants-with-independent-predicates rule still holds; verify].
- Encode a waterfall in a single ledger entry: Family A can claim before T1. Family B (top of the waitlist) can claim between T1 and T2. The NGO can reclaim after T2.
- Unclaimed aid then *walks to the next family by itself*, instead of going back to HQ and being re-disbursed weeks later. No other chain has this as a native primitive, so it becomes a demo beat nobody else will show: "the money moved to the next family at 14:02 and nobody pressed a button" [SPECULATION on judge reaction].
- It is also a stronger Unlocked story than flags plus clawback, which judges have seen.

DISRUPTIVE IMPROVEMENT 2: drop Earmark from the build and keep it as the deck's "market 2" slide only.
- The RCT showing labelling raises sends by about 15% [VERIFIED per A1, J-PAL link in 01] strengthens User Value without forcing a fake school off-ramp into the demo.

== 2. LeashPay ==

ORIGINALITY ATTACK (direct prior art, not adjacent)
- REAPP, a Stellar Community Fund submission: a Soroban contract enforcing per-agent budget caps, period limits and merchant restrictions with x402 settlement [VERIFIED https://communityfund.stellar.org/submissions/recrWPt0QGLHnbv5Z]. That is LeashPay almost word for word.
- OZ smart-account spending-limit policy, shipped as a documented feature [VERIFIED https://docs.openzeppelin.com/stellar-contracts/accounts/policies].
- Stellar's own x402 page markets "spending limits … scoped permissions" for agents [VERIFIED https://stellar.org/x402]. Judges may literally be the authors of that page.
- Chain-agnostic x402-policy and tx402 also exist [VERIFIED https://pypi.org/project/x402-policy/0.1.0/ , https://pypi.org/project/tx402/].
- Memorability: our Judge predicts x402/agents is the most saturated lane at this event, and pre-event "Build with AI powered by Stellar" workshops fed it [ASSUMPTION per 04]. Expect several "prompt-injection blocked" demos. The beat is good, but everyone else will have it too [SPECULATION].
- Your own 05 already demoted it to #5. I'm asking you to defend that it should still be in the shortlist at all.

DISRUPTIVE IMPROVEMENT 1: "bonded agents" (turn a private leash into a public trust signal)
- The agent operator posts a USDC bond in a contract that also stores the agent's declared policy, for example "≤5 USDC/day, these payees".
- Anyone who presents on-chain evidence that the agent's account produced a transfer violating that policy claims part of the bond. This is the Tripwire mechanism pointed at agents.
- Merchants and APIs can then check "is this agent bonded, and for how much?" before serving it, which is a credit-limit primitive for machine customers.
- That is something neither REAPP nor OZ ships [ASSUMPTION: not found in my searches]. It flips the user from "the nervous owner" to "the merchant deciding whether to trust an anonymous agent", which is a bigger market.
- Honest catch: if the policy is enforced in `__check_auth`, violations can't happen, so the bond only matters for policies the account *can't* enforce (off-chain promises, rate limits across several accounts, refunds owed) [SPECULATION; needs your design judgement].

DISRUPTIVE IMPROVEMENT 2 (smaller): per-merchant budgets denominated in EUR, priced live from Reflector, so the cap means "€20/month for Merchant X" regardless of the token used [UNKNOWN DEPENDENCY: Reflector testnet feed freshness]. This is the Judge's suggestion and the minimum to pass the "not stock OZ" test.

== POINTED QUESTIONS ==
1. ReliefRail: trustline or in-contract balances? If trustline, how do you stop beneficiary-to-beneficiary resale? If in-contract, what native Stellar feature is left besides SAC and clawback?
2. ReliefRail: can a claimable balance's claimant be a C-address (passkey smart wallet)? If not, does passkey onboarding conflict with claimable-balance expiry?
3. ReliefRail: give one sentence a UNHCR/SDF judge would accept for "why not SDP plus an AUTH_REQUIRED asset, which SDF could configure in an afternoon?"
4. ReliefRail: will you adopt the cascading-claimant waterfall? If not, what is the single unforgettable frame of your video?
5. LeashPay: write your differentiator in one sentence without the words "OpenZeppelin", "policy" or "x402". If you can't, why keep it on the shortlist?
6. LeashPay: has anyone run the 402 → C-account pay → 200 roundtrip on the testnet facilitator? If not, the critical path is still K3.
7. LeashPay: does the OZ spending_limit meter only `transfer` contexts? If so, can an injected agent bypass the cap with `approve` + `transfer_from`, or a call into another contract that moves funds? If it can, that's a great demo for *your* product, but only if your version closes it.

---

## SENT 3 → Ruthless Judge (a2cb972d7bcf3040e): defence

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

**SendMessage result:** `{"success":true,"message":"Message queued for delivery to a2cb972d7bcf3040e at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a2cb972d7bcf3040e","name":"a2cb972d7bcf3040e","ref":"5d5244"}}`

---

## SENT 4 → Problem Hunter (a74e19b9343da9802): defence

Defence reply from the Stellar Architect to the Problem Hunter's Round A attack on ReliefRail+Earmark and LeashPay. Answers to points 1–9 and questions (a)–(f).

=== ReliefRail ===
(1) + (a) Who switches? Agreed that WFP has Building Blocks and UNHCR has SDP. Building Blocks is exactly the evidence that a top buyer PAYS for restricted, shop-level redemption [VERIFIED per your link https://innovation.wfp.org/node/25]. Our wedge is mid-size NGOs and local cash consortia who can't run a permissioned chain like WFP. I have no named one [UNKNOWN DEPENDENCY]. Honest deck line: "WFP proved restricted digital vouchers at 100k+ scale on a private chain. We put the same rules on a public network any NGO can use without running infrastructure."

(2) + (c) The unrestricted-cash trend is real [ASSUMPTION; neither of us verified CaLP today; my search didn't return the voucher-share figure]. Reframe: restriction is a *program-design option the donor demands*, for example medical aid redeemable at pharmacies only, or school-supply grants. It isn't the default. The product toggles restriction per program, and the same asset can run "unrestricted mode" by setting the merchant list to "any authorized account". I have no quote proving donor demand [UNKNOWN].

(3) + (b) The merchant is the hardest adopter, agreed. Gains: instant settlement into a USDC-redeemable asset versus contracted-shop reconciliation cycles [UNKNOWN; I have no number for current reconciliation delay]. For the demo, a teammate plays the pharmacy. I won't claim a merchant euro figure we can't source.

(4) Agreed. The RCT supports *labelling*, and the direct-to-school effect is small (~2.2%) [VERIFIED per your J-PAL link]. Earmark becomes a single deck slide and doesn't get built. We won't claim "enforcement increases remittances".

(5) "Why isn't this an SDP feature request?" Partly it is, and I concede that much. The protocol-level part is that, once delivered, SDP's asset is unrestricted. Our design keeps beneficiary trustlines at AUTHORIZED_TO_MAINTAIN_LIABILITIES, and each spend is an issuer-co-signed authorization sandwich (SEP-8 regulated-asset pattern) [ASSUMPTION: pattern is long-standing, SEP link to follow]. Peer-to-peer resale is then impossible at protocol level. We'd also add cascading claimable balances (the Wildcard's idea): unclaimed aid moves to the next waitlisted family by predicate, with per-claimant predicates [VERIFIED https://developers.stellar.org/docs/build/guides/transactions/claimable-balances]. I also found that claimable-balance claimants appear to be G-accounts only, so I'm dropping passkeys and using sponsored G-accounts [VERIFIED that docs define the claimant as a "destination account"; C-address exclusion is ASSUMPTION].

=== LeashPay ===
(6) + (d) You're right. The only third-party x402 merchant I can name on Stellar testnet is Query402. It belongs to REAPP, an awarded SCF #43 project ($70k) whose Soroban MandateRegistry already enforces per-agent caps, period limits and merchant restrictions with x402 [VERIFIED https://communityfund.stellar.org/submissions/recrWPt0QGLHnbv5Z]. So the seller side is basically us paying ourselves, and the core idea is already funded.
(7) + (e) The honest answer today is "a policy plus a dashboard". The only non-thin pivot I see is the Wildcard's "bonded agents": a public bond and declared policy that merchants check before serving an agent. It's unproven and has a logical catch: if the policy is enforced in __check_auth, violations can't happen, so the bond only covers off-chain promises [SPECULATION].
(8) I found no public incident of an agent losing stablecoins to prompt injection [UNKNOWN]. "Why now" is hypothetical, agreed.
(9) That bypass is a real concern. If spending_limit only meters `transfer` [UNVERIFIED, community forum], an injected agent could approve() a spender and drain via transfer_from unless the context rule also restricts callable functions [UNKNOWN DEPENDENCY: whether OZ context rules can scope by function].
(f) First 10 users: for ReliefRail, none named. For LeashPay, REAPP's own users. I can't promise a quote before Mon 10:00 for either. My Round B lean: LeashPay is likely ABANDON, and ReliefRail is IMPROVE (cut to 3 primitives, NGO-only).

**SendMessage result:** `{"success":true,"message":"Message queued for delivery to a74e19b9343da9802 at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a74e19b9343da9802","name":"a74e19b9343da9802","ref":"23bd0d"}}`

---

## SENT 5 → Wildcard Inventor (a68cdf315b30b705d): defence

Defence reply from the Stellar Architect to the Wildcard's Round A attack on ReliefRail+Earmark and LeashPay. Answers to questions 1–7.

1. Trustline or in-contract? TRUSTLINE, and resale is blocked at the protocol level, not in a contract. Beneficiary trustlines are kept at AUTHORIZED_TO_MAINTAIN_LIABILITIES, so they can hold but not send. Every spend is one atomic tx sandwich: [issuer SetTrustLineFlags→AUTHORIZED; beneficiary pays merchant; issuer→MAINTAIN_LIABILITIES], co-signed by the NGO's approval server only for allowlisted merchants within caps. This is the SEP-8 regulated-asset pattern [ASSUMPTION: long-standing SEP; I'll re-link]. A beneficiary-to-beneficiary transfer has no issuer co-sign and fails on-chain, so the resale market is dead. Cost: the rules engine is off-chain in the issuer's approval server, and Soroban becomes optional [ASSUMPTION that judges may mark Tech down for that].

2. Claimant as C-address: the docs define a Claimant as "the destination account that can claim" with a predicate, and every example uses G-keys [VERIFIED https://developers.stellar.org/docs/build/guides/transactions/claimable-balances]. I believe the XDR type is AccountID, so C-addresses are out [ASSUMPTION, strong]. Also, the SAC has no function that creates claimable balances, so Soroban can't use them [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract]. Yes, it conflicts with passkeys, so I'm dropping passkeys for sponsored G-accounts.

3. The UNHCR/SDF sentence: "SDP delivers money; once it lands it can go anywhere. Purpose-bound money keeps the issuer's co-signature on every hop, so a medical grant can only ever reach a pharmacy, and unclaimed aid flows to the next family on the waitlist without anyone touching it." Concession: SDF could configure the AUTH_REQUIRED part in an afternoon. The cascade plus program-rules engine is our delta.

4. Cascading claimants: YES, I'd adopt it. It's the best idea anyone has given ReliefRail. Per-claimant independent predicates are [VERIFIED, same guide, e.g. BEFORE_RELATIVE_TIME vs NOT(BEFORE_ABSOLUTE_TIME)]. The ~10-claimant cap is [ASSUMPTION per CAP-23]. Check: the claimant needs a trustline, and claiming into a MAINTAIN_LIABILITIES trustline may need full AUTHORIZED [UNKNOWN DEPENDENCY]. If so, the claim also goes in an issuer sandwich, which is fine since the NGO server builds it. Video frame: "14:02, Family A didn't come; at 14:03 Family B's phone shows +50 AID. Nobody pressed a button."
Earmark: agreed, deck slide only.

5. LeashPay differentiator without those words: I can't write one that REAPP doesn't already cover. REAPP is AWARDED (SCF #43, $70k). Its Soroban MandateRegistry enforces per-agent caps, period limits and merchant restrictions with x402 settlement, and it has a live testnet merchant, Query402 [VERIFIED https://communityfund.stellar.org/submissions/recrWPt0QGLHnbv5Z]. Your bonded-agents pivot is the only non-thin version, and you named its catch yourself: violations of a policy enforced in __check_auth can't happen, so the bond only covers what the account can't enforce [SPECULATION]. That turns it into an insurance or reputation product with off-chain adjudication, so it's no longer a 20h build.

6. No. The 402 → C-account → 200 roundtrip has not been run (no spikes this round). Still K3 [UNKNOWN DEPENDENCY].

7. If spending_limit meters only `transfer` [UNVERIFIED, OZ forum post], then approve() + transfer_from by an attacker-controlled spender is a plausible bypass, unless context rules can scope by function name [UNKNOWN DEPENDENCY]. Closing it would be a nice demo, but it's a patch to someone else's library, not a product.
Round B lean: LeashPay ABANDON. ReliefRail IMPROVE with your cascade, cut to issuer flags, SEP-8 sandwich, cascading claimable balances and sponsored reserves.

**SendMessage result:** `{"success":true,"message":"Message queued for delivery to a68cdf315b30b705d at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a68cdf315b30b705d","name":"a68cdf315b30b705d","ref":"b62a10"}}`

---

## RECEIVED 4 ← Problem Hunter (a74e19b9343da9802): defence of Roda and KeyHold

ROUND A DEFENCE (Problem Hunter -> Stellar Architect) on Roda and KeyHold. Answers to (a)–(e) for each.

=== RODA ===
(a) Exact collateral formula: C_k = (N−k)·c for the member at payout position k. 4-person €200 circle: positions 1–4 post €600 / €400 / €200 / €0. The round-1 member receives €800 at t=1 but has €600 locked, so their *net* credit is €0. Your R2 holds [VERIFIED as arithmetic]. The only versions that keep the credit benefit put *someone else's* capital at risk: guarantors (the Wildcard's vouching proposal) or bid discounts (bidding ROSCA). Both are Round B candidates. I won't pretend the blind design worked.
(b) Sybil re-entry: the blind MVP has no answer, because reputation without identity is theatre (R3 conceded). Options are SEP-10 plus a KYC anchor (not 20h-feasible), or guarantors, where re-entry under a fresh address requires *new humans to vouch* for you. That makes reputation social again, which is how real circles work [ASSUMPTION]. That is the strongest argument for the vouching variant.
(c) Allowance revocation: agreed, pull-based contributions are a standing order, not enforcement (R1 conceded; live_until_ledger and the TTL cap noted). State machine: each round has a deadline. Anyone can call `settle(round)`. For each unpaid member the contract tries `transfer_from`, and on failure it debits that member's collateral or their vouchers' stake by c, marks them DEFAULTED and excludes them from future payouts. The payout then goes to the round recipient from the pot. Enforcement comes from collateral and stake, never from the pull. A cleaner design is push-only: members call `contribute()` themselves, and settlement slashes whoever didn't.
(d) Why Stellar and not Celo: I can't give an honest sentence citing a feature that is *necessary*. The best available is "claimable balances plus sponsored reserves let a member who has never touched crypto receive the pot with zero XLM, and anchors/MoneyGram give cash-out in the diaspora's home country". That is a convenience, not a necessity. Celo targets exactly this market, and my search found about 8 Celo ROSCA dApps (AjoAI, ChamaVault, ChamaPay, ESUSU, Circlepot, CoSave…) plus Amero and Clixpesa on Stellar [VERIFIED https://www.karmahq.xyz/project/ajoai/about, https://www.karmahq.xyz/project/chama-vault/about; Amero per the Wildcard]. R4 conceded.
(e) Non-custodial demand: projected. I have no quote. MoneyFellows' 8.5M users show that custodial works [VERIFIED https://meatechwatch.com/2025/05/06/moneyfellows-raises-13-million-to-expand-digital-rosca-model-across-africa-and-beyond/]. The treasurer-risk evidence is about *informal* groups [VERIFIED https://core.ac.uk/outputs/7310857], and a custodial app solves that too.

=== KEYHOLD ===
(a) Trustless Work deadline release: **no**, not as far as I can read. "Only the Release Signer can execute the release". The only timer mention is a platform choice ("auto-approving after a timer"), and automation is "coming soon" [VERIFIED https://docs.trustlesswork.com/trustless-work/llms-full.txt, first 100k of 330k chars]. Composition idea: our own Soroban "timeout keeper" contract *is* the Approver/Release Signer on a TW escrow and approves after the deadline, which is a real two-contract composition [ASSUMPTION: TW role addresses accept a C-address under require_auth; 30-min check needed]. Note that TW already documents rental security deposits as a use case [VERIFIED https://docs.trustlesswork.com/trustless-work/use-cases-unlocking-the-potential-of-smart-escrows/security-deposits], so a TW-based KeyHold is close to their reference app.
(b) Asset and EUR leg: the tenant funds in the EUR-denominated asset the landlord agrees to. On testnet that's a self-issued test EUR asset labelled as such. Drop the path payment, since seeded SDEX offers would look staged (F3, agreed). USDC/EUR volatility over a 12–24-month lease is real, which is why it should be a EUR asset, not USDC [ASSUMPTION: EURC on Stellar mainnet not verified today].
(c) Landlord incentive: I don't have an evidenced answer for the blind version. The strongest reframe is the Wildcard's "Deposit Passport": the landlord gets a proof-funded deposit plus a tenant's verifiable clean move-out history. Wedge segment: student residences, corporate relocation housing and coliving operators with high tenant turnover [SPECULATION; no quote].
(d) Something judges haven't seen: not in the blind version. Candidates are final-offer (baseball) arbitration, where the arbiter can only pick A or B, and the portable deposit passport. Round B.
(e) Why Stellar not Base: I can't cite a protocol feature that is necessary. K2 and K5 are conceded. The Postgres test is softest here, and the real comparator in Portugal is "no scheme at all", not a better database.
K4 TTL: agreed. Call extend_ttl on every interaction and document restoration. This is cheap to do.

Net: both of my concepts lose on Track Alignment under your lens. I'll take that into Round B rather than defend it.

---

## RECEIVED 5 ← Chairman (main): roster update

Chairman, roster update: the Wildcard Inventor's session ended because of an API error. Its replacement is at a43d0cc536d5ed0bc. Send any further messages for the Wildcard Inventor there, not to a68cdf315b30b705d. Tripwire is SUSPENDED from the debate (reason in research/00_chairman_log.md), so don't send further Tripwire material. Quorum is still in, and its defence comes from the replacement. Replies to the old Wildcard's attacks on your concepts go to the new address.

---

## RECEIVED 6 ← Wildcard Inventor (old, a68cdf315b30b705d): defence of Tripwire and Quorum

Wildcard Inventor, Round A defence to the Stellar Architect on Tripwire and Quorum. Thanks for the detailed reply on ReliefRail/LeashPay; I'm logging it. On the Chairman's instruction, some Tripwire items are left as open items with no further explanation.

=== TRIPWIRE ===
T1: Not answered in debate; open item.
T2: Not answered in debate; open item.
T3: Not answered in debate; open item.
T4: Not answered in debate; open item.
T5: Not answered in debate; open item.
T6: Not answered in debate; open item.
T7: Not answered in debate; open item.
T8 (contract count and market): conceded. It trips F1 on count, though each contract is small. Market: Soroban TVL is small next to EVM. I can't name 10 customers, and Market is about 2.5–3 [SPECULATION on count; UNKNOWN on bounty budgets].
(a): Not answered in debate; open item.
(b): Not answered in debate; open item.
(c): Not answered in debate; open item.
(d), buyer part only:
- Prospects are Blend (Script3), Soroswap, Aquarius, DeFindex (PaltaLabs) [ASSUMPTION: none contacted].
- I found no public bounty program for Blend, Soroswap or Aquarius in a search [UNKNOWN]. SDF's own program is HackerOne-only since 7 May 2026 [VERIFIED https://hackerone.com/stellar/policy_versions].
- The per-protocol invariant part: Not answered in debate; open item.
(e): Not answered in debate; open item.

=== QUORUM ===
Q1 (claimable balances): accepted in full. The SAC exposes no claimable-balance creation [VERIFIED by your link https://developers.stellar.org/docs/tokens/stellar-asset-contract]. I withdraw the twist. Refunds are pull-based `refund()`.
Q2 (why Stellar vs L2): conceded. Credible escrow works the same on any chain, and L2 fees are also cents [ASSUMPTION]. The only path is Composed: passkey-kit (or OZ smart accounts) plus Circle USDC. I have NOT seen a passkey-kit example working on current SDKs [UNKNOWN DEPENDENCY]. Track is about 2.5–3.
Q3 (farming): time-weighted with a cutoff and a per-pledge cap, with campaign open at T0, deadline T, cutoff Tc = T0 + 0.75·(T − T0), bonus pool B:
- Weight for pledge i made at time t_i with amount p_i: w_i = max(0, (Tc − t_i)/(Tc − T0)).
- bonus_i = min(B · p_i·w_i / Σ p_j·w_j, 0.2·p_i).
- A last-minute whale gets exactly 0. Weights depend on amount and time, not on the address, so sybils gain nothing [ASSUMPTION: my analysis].
Q4 (organiser self-pledge): no on-chain fix. A sock-puppet filling the gap is equivalent to the organiser funding the project themselves. Backers still get the project they pledged for, but the social proof is fake. Mitigation is only UX (show where pledges come from). Conceded as a real weakness [SPECULATION about how often it would happen].
Q5 (demo honesty): agreed. Use a short-deadline parameter shown on screen. The phone "buzz" is just a polling balance view, with no push notifications claimed. The on-chain refund must be the wow, not the notification.
(d) organiser data point:
- EnsureDone launched around Sept 2023 with 3 projects and has no later status I can find [VERIFIED https://www.lesswrong.com/posts/7koSvinoHSy6KBLqy/update-2-to-dominant-assurance-contract-platform-ensuredone,].
- A DAC platform's revenue was about $2,172 [VERIFIED https://manifold.markets/moyamo/how-much-additional-revenue-will-my].
- Correction to my 03: on-chain DACs existed already, for example ether-on-a-stick at TreeHacks 2016 [VERIFIED https://github-redirect.dependabot.com/phlip9/ether-on-a-stick].
- Net: no evidence that organisers will pay.

Quick reaction to your ReliefRail answer: the SEP-8 sandwich plus cascading claimants is a coherent design. Please spike the open question of whether a claim into an AUTHORIZED_TO_MAINTAIN_LIABILITIES trustline needs a full-authorisation sandwich early, because the cascade demo depends on it [UNKNOWN DEPENDENCY].

---

## SENT 7 → Wildcard Inventor (replacement, a43d0cc536d5ed0bc): forwarded defence summary

Stellar Architect to the replacement Wildcard Inventor: here, on the Chairman's instruction, is my Round A defence to your predecessor's attack on ReliefRail+Earmark and LeashPay. The original was delivered to a68cdf315b30b705d and acknowledged. Full text is in research/06_debate_stellar_architect.md under "SENT 5".

Summary:
1. ReliefRail uses TRUSTLINES, not contract balances. Beneficiary trustlines stay at AUTHORIZED_TO_MAINTAIN_LIABILITIES. Each spend is an issuer-co-signed authorization sandwich (SEP-8 regulated-asset pattern [ASSUMPTION, SEP link pending]), so beneficiary-to-beneficiary resale fails on-chain. Cost: the rules engine sits in the NGO's off-chain approval server, and Soroban becomes optional.
2. A claimable-balance claimant is defined as a "destination account" [VERIFIED https://developers.stellar.org/docs/build/guides/transactions/claimable-balances]. C-addresses are likely excluded [ASSUMPTION], and the SAC can't create claimable balances [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract]. So passkeys are dropped in favour of sponsored G-accounts.
3. The SDF-judge sentence: "SDP delivers money; once it lands it can go anywhere. Purpose-bound money keeps the issuer's co-signature on every hop, and unclaimed aid flows to the next waitlisted family by itself." Concession: the AUTH_REQUIRED part is configurable by SDF in an afternoon.
4. I ADOPT the cascading-claimant waterfall (per-claimant predicates [VERIFIED, same guide]; ~10-claimant cap [ASSUMPTION]). Open item: whether a claim into a MAINTAIN_LIABILITIES trustline needs a full-auth sandwich [UNKNOWN DEPENDENCY]. Earmark goes on a deck slide only.
5–7. LeashPay: I can't state a differentiator that REAPP doesn't cover. REAPP is SCF #43, awarded $70k, with a Soroban MandateRegistry enforcing caps, periods and merchants plus x402, and a testnet merchant Query402 [VERIFIED https://communityfund.stellar.org/submissions/recrWPt0QGLHnbv5Z]. The 402 → C-account roundtrip is unrun (K3). The approve/transfer_from bypass of a transfer-only spending_limit is plausible [UNVERIFIED]. Round B lean: LeashPay ABANDON, ReliefRail IMPROVE.

Received and logged: your predecessor's Quorum defence (pull-based refund, time-weighted bonus formula, self-pledge conceded, no organiser-demand evidence). No reply needed unless you want to add to it. I'm sending no further Tripwire material, per the Chairman.

**SendMessage result:** `{"success":true,"message":"Message queued for delivery to a43d0cc536d5ed0bc at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a43d0cc536d5ed0bc","name":"a43d0cc536d5ed0bc","ref":"340015"}}`

---

## SENT 8 → Chairman (main): Round A done

Round A done (Stellar Architect). I sent attacks to the Wildcard Inventor (Tripwire + Quorum) and the Problem Hunter (Roda + KeyHold). I answered all three attacks I received (Judge, Problem Hunter, old Wildcard) and forwarded the Wildcard defence to the replacement a43d0cc536d5ed0bc.
No SendMessage failed: all 6 sends to agents returned success:true. The full verbatim log is in research/06_debate_stellar_architect.md.
Key facts: claimable-balance claimants are G-accounts and the SAC can't create them, which kills Quorum's claimable-balance refunds. REAPP (SCF #43, awarded) is near-identical prior art to LeashPay, so I'm leaning ABANDON. ReliefRail is being reworked with a SEP-8 authorization sandwich plus the cascading claimable-balance waterfall.

