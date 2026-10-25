# 06: Debate log, Wildcard Inventor (A3), Round A

Status: **Round A complete; one early message was partly withheld.** One outgoing defence message was cut off by a safety classifier partway through. That message is marked below and the withheld part is not reproduced. Full verbatim copies of messages are in the session transcript. This file records the events and their delivery results.

## Sent

| # | To | Content | SendMessage result |
|---|---|---|---|
| S1 | Stellar Architect (a8dd31a4f45ac4f54) | Attack on ReliefRail+Earmark and LeashPay. Prior art: WFP Building Blocks, SDF Aid Assist/SDP, REAPP, OZ spending-limit policy, stellar.org/x402, x402-policy, tx402. Raised the design question of trustline vs in-contract balance for claimable-balance expiry. Twists: "cascading aid" (a multi-claimant claimable-balance waterfall) and "bonded agents". 7 questions. | success: queued for delivery |
| S2 | Problem Hunter (a74e19b9343da9802) | Attack on Roda and KeyHold. Prior art: Amero (SCF #28 + #31, $150k, on Stellar), Clixpesa, Orbit (Soroban), WeTrust, EsusuChain, Chord; Trustless Work lists rental deposits as a use case. Twists: guarantor vouching and a sealed-bid ROSCA for Roda; final-offer arbitration and a Deposit Passport for KeyHold. 8 questions. | success: queued for delivery |
| S3 | Ruthless Judge (a2cb972d7bcf3040e) | Defence of Tripwire and Quorum. **Only partly delivered: cut off by a safety classifier partway through the Q3 answer.** Delivered: Q1 (the rollback spike has NOT been run; sources cited; proposed kill time 15:30 Sun; sandbox fallback avoids K3) and Q2 (adopt the harness design; only the harness raises PROVEN; invariant pre-check; INCONCLUSIVE gives no payout; callbacks out of scope). The rest of Q3 and all of Q4–Q9 were **not delivered**, and the withheld part is not reproduced. | success (partial content): "Resuming agent a2cb972" |

## Received

| # | From | Summary |
|---|---|---|
| R1 | Problem Hunter | Attacks on Tripwire (who pays when projects want control over payouts; Immunefi disputes are about scope, not payment speed; verifier audit; small Soroban TVL market; HoneyPause never adopted) and on Quorum (DACs that stayed tiny: Dackie, a ~$2,173 platform, the Panickssery experiment; organisers unwilling to pay to fail; lab vs field evidence; bonus farming). Questions (a)–(f). **Not yet answered.** |
| R2 | Ruthless Judge | Tripwire W1 (soundness: verifier, forged error, re-entrancy, rollback unknown, atomic-only scope) and W2 (niche user, pause needs integration, front-running, CLI UX, HoneyPause prior art). Quorum W1 (weak Track) and W2 (whale sniping, organiser demand). Questions Q1–Q9. **Q1–Q2 answered; Q3–Q9 not answered** (see S3). |
| R3 | Stellar Architect | Tripwire T1–T8 (rollback, re-entrancy and harness, forged error, exploit leak and call-script executor, front-running, pause integration, verifier soundness, 5–6 contracts). Quorum Q1–Q5 (contracts cannot create claimable balances, so that fix fails; weak "why Stellar" against L2s; bonus farming; organiser self-pledging; demo honesty). Questions (a)–(e) and (a)–(d). **Not yet answered.** |

## Corrections to record (my own earlier claims)

- In 03 I wrote "no smart-contract DAC implementation with public code found". That is **wrong**. "ether-on-a-stick" (TreeHacks 2016) and a 2014 slide deck titled "Dominant assurance contracts using Ethereum" exist ([GitHub](https://github-redirect.dependabot.com/phlip9/ether-on-a-stick), [SlideShare](https://www.slideshare.net/slideshow/dominant-assurance-contracts-using-ethereum/33193977)). EnsureDone launched around Sept 2023 with 3 projects, and I found no 2025/26 status ([LessWrong](https://www.lesswrong.com/posts/7koSvinoHSy6KBLqy/update-2-to-dominant-assurance-contract-platform-ensuredone,)).
- Quorum's claimable-balance refund fix: I accept the Architect's point that a Soroban contract cannot create claimable balances (the SAC interface has no such function), so that twist is withdrawn [ASSUMPTION, strong].

---

## From here on: verbatim (per Chairman instruction)

### Received: Chairman (main)
> Chairman: please continue, within these limits. Don't resend or reword the part that was cut off. 1) Answer the Judge, the Architect and the Problem Hunter on QUORUM in full, sending each reply directly with SendMessage. 2) On TRIPWIRE, answer only the questions outside the cut-off area: buyer and market, who pays, demo UX, track fit and competitors. For any question inside that area, reply with exactly "Not answered in debate; open item." Don't explain further. 3) Make your log verbatim from here on; for earlier messages, the summaries are fine. Then send me (to: "main") a one-line note: Round A done.

### Received: Ruthless Judge (a2cb972d7bcf3040e), follow-up
> Ruthless Judge follow-up (my one allowed follow-up): your reply reached me truncated mid-Q3. Please resend Q3–Q9 in full.
>
> I accept your Q1 honesty and the Q2 harness chain with the pre-check. That is a real fix. Two challenges to address in the resend:
>
> (a) The sandbox fallback is weaker than you claim.
> - A fresh deploy_v2 copy has only constructor-seeded state. It has no live SAC balances, no live state in dependency contracts (oracle, AMM) and no real positions [ASSUMPTION].
> - So "proof" means "proof against a scenario the protocol team configured". A careless seed equals a free bounty, and a careful seed misses exactly the state-dependent bugs that matter.
> - That turns the pitch from "self-insuring TVL" into "automated on-chain CTF". Is that still a winner? Score it honestly.
>
> (b) Commit-reveal.
> - What stops a griefer from committing junk to front-run the reveal window?
> - What is the reveal delay in ledgers, and does it break the "proof, payment and pause in one ledger close" demo line?
> - Also give a one-line answer to Q4 (a named Soroban team) and Q5 (a non-terminal UI). Those decide User Value (20%) and UX (10%).

(Logging note: the Judge's message quoted the opening words of my cut-off reply. That quoted fragment is left out here so the withheld part is not reproduced.)

### Received: Stellar Architect (a8dd31a4f45ac4f54), defence of ReliefRail+Earmark and LeashPay
> Defence reply from the Stellar Architect to the Wildcard's Round A attack on ReliefRail+Earmark and LeashPay. Answers to questions 1–7.
>
> 1. Trustline or in-contract? TRUSTLINE, and resale is blocked at the protocol level, not in a contract. Beneficiary trustlines are kept at AUTHORIZED_TO_MAINTAIN_LIABILITIES, so they can hold but not send. Every spend is one atomic tx sandwich: [issuer SetTrustLineFlags→AUTHORIZED; beneficiary pays merchant; issuer→MAINTAIN_LIABILITIES], co-signed by the NGO's approval server only for allowlisted merchants within caps. This is the SEP-8 regulated-asset pattern [ASSUMPTION: long-standing SEP; I'll re-link]. A beneficiary-to-beneficiary transfer has no issuer co-sign and fails on-chain, so the resale market is dead. Cost: the rules engine is off-chain in the issuer's approval server, and Soroban becomes optional [ASSUMPTION that judges may mark Tech down for that].
>
> 2. Claimant as C-address: the docs define a Claimant as "the destination account that can claim" with a predicate, and every example uses G-keys [VERIFIED https://developers.stellar.org/docs/build/guides/transactions/claimable-balances]. I believe the XDR type is AccountID, so C-addresses are out [ASSUMPTION, strong]. Also, the SAC has no function that creates claimable balances, so Soroban can't use them [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract]. Yes, it conflicts with passkeys, so I'm dropping passkeys for sponsored G-accounts.
>
> 3. The UNHCR/SDF sentence: "SDP delivers money; once it lands it can go anywhere. Purpose-bound money keeps the issuer's co-signature on every hop, so a medical grant can only ever reach a pharmacy, and unclaimed aid flows to the next family on the waitlist without anyone touching it." Concession: SDF could configure the AUTH_REQUIRED part in an afternoon. The cascade plus program-rules engine is our delta.
>
> 4. Cascading claimants: YES, I'd adopt it. It's the best idea anyone has given ReliefRail. Per-claimant independent predicates are [VERIFIED, same guide, e.g. BEFORE_RELATIVE_TIME vs NOT(BEFORE_ABSOLUTE_TIME)]. The ~10-claimant cap is [ASSUMPTION per CAP-23]. Check: the claimant needs a trustline, and claiming into a MAINTAIN_LIABILITIES trustline may need full AUTHORIZED [UNKNOWN DEPENDENCY]. If so, the claim also goes in an issuer sandwich, which is fine since the NGO server builds it. Video frame: "14:02, Family A didn't come; at 14:03 Family B's phone shows +50 AID. Nobody pressed a button."
> Earmark: agreed, deck slide only.
>
> 5. LeashPay differentiator without those words: I can't write one that REAPP doesn't already cover. REAPP is AWARDED (SCF #43, $70k). Its Soroban MandateRegistry enforces per-agent caps, period limits and merchant restrictions with x402 settlement, and it has a live testnet merchant, Query402 [VERIFIED https://communityfund.stellar.org/submissions/recrWPt0QGLHnbv5Z]. Your bonded-agents pivot is the only non-thin version, and you named its catch yourself: violations of a policy enforced in __check_auth can't happen, so the bond only covers what the account can't enforce [SPECULATION]. That turns it into an insurance or reputation product with off-chain adjudication, so it's no longer a 20h build.
>
> 6. No. The 402 → C-account → 200 roundtrip has not been run (no spikes this round). Still K3 [UNKNOWN DEPENDENCY].
>
> 7. If spending_limit meters only `transfer` [UNVERIFIED, OZ forum post], then approve() + transfer_from by an attacker-controlled spender is a plausible bypass, unless context rules can scope by function name [UNKNOWN DEPENDENCY]. Closing it would be a nice demo, but it's a patch to someone else's library, not a product.
> Round B lean: LeashPay ABANDON. ReliefRail IMPROVE with your cascade, cut to issuer flags, SEP-8 sandwich, cascading claimable balances and sponsored reserves.

### Received: Problem Hunter (a74e19b9343da9802), defence of Roda and KeyHold
> ROUND A DEFENCE (Problem Hunter -> Wildcard Inventor) on Roda and KeyHold. Your originality evidence is strong, and I'm conceding parts of it. Answers to Q1–Q8:
>
> Q1 Roda vs Amero: in its blind form, I can't give a sentence a SCF reviewer would accept. My own search confirms saturation well beyond Stellar: AjoAI ("live on Celo mainnet"), ChamaVault, ChamaPay, ESUSU, Circlepot, CoSave on Celo; Ronda, Saving Circles, Tanda, ROSCA-Guard at ETHGlobal; Bloinx (UNICEF-backed) [VERIFIED https://www.karmahq.xyz/project/ajoai/about, https://ethglobal.com/showcase/ronda-7ck82, https://ethglobal.com/showcase/saving-circles-bmgxr, https://www.unicefventurefund.org/story/bloinx-crypto-more-reliable-savings-communities-among-low-income-populations]. The only defensible differentiator would be a *mechanism*, so your vouching idea is the right direction. Caveat: AjoAI already claims an "ERC-8004 reputation ledger" and Tanda claims "verified credit scoring" [VERIFIED as self-descriptions], so reputation alone isn't new. Guarantor *stake slashing* might be [UNKNOWN: not found yet].
> Q2 Collateral, with the arithmetic: defection gain at position k = (N−k)·c − C. With 10 × €200, round 1 needs C ≥ €1,800 for a non-positive gain. Any lower percentage, the round-1 recipient walks away ahead. At 20% (€400) they gain €1,400 net of the forfeited collateral. Full collateral kills the credit benefit. My blind design is broken on this point, conceded.
> Q3 Vouching vs bidding: on adoption grounds I lean toward **vouching**. It keeps the credit benefit, makes sybil re-entry cost *new human vouchers* (which answers the Architect's fresh-address attack), and maps to how real circles already work through social collateral [ASSUMPTION]. Bidding has WeTrust prior art, as you note, and is harder for non-financial users to understand [ASSUMPTION]. My open concerns about vouching: (i) a voucher's stake is capital locked for months, so who wants that job for a small fee? (ii) Vouching is joint liability, and the microfinance sector has moved away from group liability in places [ASSUMPTION: I recall evidence like Giné & Karlan in the Philippines finding individual liability did not raise default; not re-verified today]. That is worth checking before we bet on it.
> Q4 F8 fast-forward: make the period a contract parameter (e.g. 60 seconds per round on testnet) and say so on screen: "1 round = 1 minute in demo, 1 month in production". Show ledger timestamps rather than mocking a clock. It's honest and visibly the same code path [ASSUMPTION that judges accept it; most time-based demos do this].
> Q5 KeyHold, named opt-in landlord: none, no quote [UNKNOWN]. The plausible segment is student residences, coliving and corporate relocation operators with high turnover. Your Deposit Passport is the first framing that gives the *landlord* something (proof-funded deposit plus verified tenant history) rather than taking control away. That's the strongest answer to F7 I've seen.
> Q6 Ours vs Trustless Work: I checked. TW release needs the Release Signer, and the only timer reference is "auto-approving after a timer" as a platform choice, with automation "coming soon" [VERIFIED https://docs.trustlesswork.com/trustless-work/llms-full.txt, first 100k chars]. TW already documents rental security deposits [VERIFIED https://docs.trustlesswork.com/trustless-work/use-cases-unlocking-the-potential-of-smart-escrows/security-deposits]. So "frontend + timeout on TW" is near their reference app, and you're right about that. What would be ours: a keeper or arbiter contract holding TW's Approver/Release Signer role that enforces the timeout and/or final-offer rule [ASSUMPTION: TW roles accept a C-address].
> Q7 Portuguese law: [UNKNOWN DEPENDENCY], and I won't claim legal equivalence. The caução is contractual by nature, with the amount agreed by the parties [VERIFIED https://amp.theportugalnews.com/ar/nieuws/2023-01-12/what-you-need-to-know-before-renting-a-home-in-portugal/73781]. So a lease clause *could* specify escrow terms, but whether a USDC or test-EUR escrow counts as a valid caução is unverified, and the pitch must say "contractual mechanism, legal review pending" (K7).
> Q8 Final-offer arbitration vs Deposit Passport: both are better than the blind version. From an adoption lens: the **Passport** addresses who opts in (the landlord gets value), while **final-offer** addresses Innovation and memorability. They combine cleanly: the passport is the product and final-offer is the dispute rule inside it. One concern with the Passport: a rolling deposit means the *next* landlord must trust the previous one's move-out attestation, so attestations become a reputation-farming target [SPECULATION]. I'll decide in Round B.
>
> Net: your evidence moves Roda from "best demand" to "saturated unless the mechanism changes", and moves KeyHold from "generic escrow" to "possibly interesting if reframed as a passport with final-offer arbitration".

### Received: Ruthless Judge hand-back (relayed into this session)
The Judge finished Round A. Its report says that four of the six should be dropped, because each proposer conceded the decisive point (LeashPay, Roda, KeyHold, Quorum). It says Tripwire is "suspended", with the copied-claim question and both follow-up parts unanswered, no buyer named and the rollback test not run. It says ReliefRail is the only candidate left standing, at about 3.85, and names a replacement address a43d0cc536d5ed0bc. Its full text is in research/06_debate_ruthless_judge.md. I have not acted on the address change.

### Sent: to Ruthless Judge (a2cb972d7bcf3040e). Result: success, "Message queued for delivery to a2cb972d7bcf3040e at its next tool round."
> Wildcard Inventor, Round A defence continued, to the Ruthless Judge. On the Chairman's instruction, some Tripwire items are left as open items with no further explanation.
>
> === TRIPWIRE ===
> Q3: Not answered in debate; open item.
> Follow-up (a): Not answered in debate; open item.
> Follow-up (b): Not answered in debate; open item.
>
> Q4 (named team): No team has been contacted and I have no quote [UNKNOWN DEPENDENCY].
> - Plausible first prospects are Soroban DeFi teams: Blend (Script3), Soroswap, Aquarius, DeFindex (PaltaLabs) [ASSUMPTION: prospects only].
> - I could not find their bounty programs or typical sizes [UNKNOWN; a search found nothing for Blend/Soroswap/Aquarius].
> - SDF's own bounty moved to a single HackerOne program on 7 May 2026 [VERIFIED https://hackerone.com/stellar/policy_versions].
> - Honest User Value is about 2.5–3 until someone names a buyer.
>
> Q5 (non-terminal UI): a web app with three screens, signing through Freighter.
> - (1) A bounty board: target, USDC amount, status.
> - (2) A researcher claim page: submit and sign.
> - (3) A target dashboard: balance and status, with the stellar.expert link.
> - The terminal never appears in the video.
>
> Track fit, self-scored: the core is Soroban host semantics, not a classic core-protocol feature by your 04 definition, so Track is about 3.5–4, not 5. Composed is possible if the target uses OZ Stellar's Pausable plus SAC USDC [ASSUMPTION that OZ ships Pausable for Stellar].
> Competitors: HoneyPause (EVM, Sepolia), Hydra (academic), ExploitArena (off-chain votes), Immunefi vaults (human confirmation), Stellar's HackerOne.
>
> === QUORUM (full) ===
> First, two corrections to my own 03.
> - (i) On-chain DAC prior art EXISTS. I was wrong to say none was found. "ether-on-a-stick" (TreeHacks 2016) and a 2014 deck titled "Dominant assurance contracts using Ethereum" [VERIFIED https://github-redirect.dependabot.com/phlip9/ether-on-a-stick , https://www.slideshare.net/slideshow/dominant-assurance-contracts-using-ethereum/33193977].
> - (ii) EnsureDone launched around Sept 2023 with 3 projects. I found no 2025/26 status [VERIFIED https://www.lesswrong.com/posts/7koSvinoHSy6KBLqy/update-2-to-dominant-assurance-contract-platform-ensuredone,]. A related DAC platform earned about $2,172 per a resolved Manifold market [VERIFIED https://manifold.markets/moyamo/how-much-additional-revenue-will-my].
>
> Q6 (exact formula), with campaign open at T0, deadline T, cutoff Tc = T0 + 0.75·(T − T0), bonus pool B, and per-pledge cap r = 0.20:
> - Weight for pledge i made at time t_i with amount p_i: w_i = max(0, (Tc − t_i)/(Tc − T0)).
> - bonus_i = min( B · p_i·w_i / Σ_j p_j·w_j , r·p_i ). Any unallocated remainder returns to the organiser.
> - A whale pledging in the last 25% of the window has w = 0, so bonus = 0, exactly. A whale pledging just under the goal EARLY is not risk-free: anyone can tip the campaign over the goal, and then the whale's money funds the project.
> - Sybil splitting gains nothing, because the weight depends on amount and time, not on the address [ASSUMPTION: my analysis, not formally proven].
> - Residual: an early whale can still crowd honest early backers out of the bonus share, capped at r·p.
>
> Q7 (load-bearing Stellar feature): honestly, none from the core protocol.
> - The claimable-balance refund twist is WITHDRAWN. The Architect showed the SAC exposes no function that creates claimable balances [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract].
> - The only route is Composed via passkey-kit plus Circle USDC, and passkey is unproven for us [UNKNOWN DEPENDENCY].
> - Track is about 2.5–3. I accept your W1.
>
> Q8 (organiser demand): no evidence beyond the tiny data points above, plus the Problem Hunter's (Dackie, the Panickssery experiment that lost $45). Conceded: organiser willingness is unproven and the field record is weak [ASSUMPTION consistent with all data points].
>
> Q9 (why not Kickstarter plus a bank-escrowed bonus for €300):
> - Kickstarter has no refund-bonus feature [ASSUMPTION], and a bank escrow for a €30 bonus is uneconomic [ASSUMPTION].
> - But versus any L2 there is no Stellar-specific advantage [ASSUMPTION; I concede the Architect's point].
>
> Net: Quorum is weaker than I pitched it on Track and demand. I'll decide defend/improve/abandon in Round B.

### Sent: to Stellar Architect (a8dd31a4f45ac4f54). Result: success, "Message queued for delivery to a8dd31a4f45ac4f54 at its next tool round."
> Wildcard Inventor, Round A defence to the Stellar Architect on Tripwire and Quorum. Thanks for the detailed reply on ReliefRail/LeashPay; I'm logging it. On the Chairman's instruction, some Tripwire items are left as open items with no further explanation.
>
> === TRIPWIRE ===
> T1: Not answered in debate; open item.
> T2: Not answered in debate; open item.
> T3: Not answered in debate; open item.
> T4: Not answered in debate; open item.
> T5: Not answered in debate; open item.
> T6: Not answered in debate; open item.
> T7: Not answered in debate; open item.
> T8 (contract count and market): conceded. It trips F1 on count, though each contract is small. Market: Soroban TVL is small next to EVM. I can't name 10 customers, and Market is about 2.5–3 [SPECULATION on count; UNKNOWN on bounty budgets].
> (a): Not answered in debate; open item.
> (b): Not answered in debate; open item.
> (c): Not answered in debate; open item.
> (d), buyer part only:
> - Prospects are Blend (Script3), Soroswap, Aquarius, DeFindex (PaltaLabs) [ASSUMPTION: none contacted].
> - I found no public bounty program for Blend, Soroswap or Aquarius in a search [UNKNOWN]. SDF's own program is HackerOne-only since 7 May 2026 [VERIFIED https://hackerone.com/stellar/policy_versions].
> - The per-protocol invariant part: Not answered in debate; open item.
> (e): Not answered in debate; open item.
>
> === QUORUM ===
> Q1 (claimable balances): accepted in full. The SAC exposes no claimable-balance creation [VERIFIED by your link https://developers.stellar.org/docs/tokens/stellar-asset-contract]. I withdraw the twist. Refunds are pull-based `refund()`.
> Q2 (why Stellar vs L2): conceded. Credible escrow works the same on any chain, and L2 fees are also cents [ASSUMPTION]. The only path is Composed: passkey-kit (or OZ smart accounts) plus Circle USDC. I have NOT seen a passkey-kit example working on current SDKs [UNKNOWN DEPENDENCY]. Track is about 2.5–3.
> Q3 (farming): time-weighted with a cutoff and a per-pledge cap, with campaign open at T0, deadline T, cutoff Tc = T0 + 0.75·(T − T0), bonus pool B:
> - Weight for pledge i made at time t_i with amount p_i: w_i = max(0, (Tc − t_i)/(Tc − T0)).
> - bonus_i = min(B · p_i·w_i / Σ p_j·w_j, 0.2·p_i).
> - A last-minute whale gets exactly 0. Weights depend on amount and time, not on the address, so sybils gain nothing [ASSUMPTION: my analysis].
> Q4 (organiser self-pledge): no on-chain fix. A sock-puppet filling the gap is equivalent to the organiser funding the project themselves. Backers still get the project they pledged for, but the social proof is fake. Mitigation is only UX (show where pledges come from). Conceded as a real weakness [SPECULATION about how often it would happen].
> Q5 (demo honesty): agreed. Use a short-deadline parameter shown on screen. The phone "buzz" is just a polling balance view, with no push notifications claimed. The on-chain refund must be the wow, not the notification.
> (d) organiser data point:
> - EnsureDone launched around Sept 2023 with 3 projects and has no later status I can find [VERIFIED https://www.lesswrong.com/posts/7koSvinoHSy6KBLqy/update-2-to-dominant-assurance-contract-platform-ensuredone,].
> - A DAC platform's revenue was about $2,172 [VERIFIED https://manifold.markets/moyamo/how-much-additional-revenue-will-my].
> - Correction to my 03: on-chain DACs existed already, for example ether-on-a-stick at TreeHacks 2016 [VERIFIED https://github-redirect.dependabot.com/phlip9/ether-on-a-stick].
> - Net: no evidence that organisers will pay.
>
> Quick reaction to your ReliefRail answer: the SEP-8 sandwich plus cascading claimants is a coherent design. Please spike the open question of whether a claim into an AUTHORIZED_TO_MAINTAIN_LIABILITIES trustline needs a full-authorisation sandwich early, because the cascade demo depends on it [UNKNOWN DEPENDENCY].

### Sent: to Problem Hunter (a74e19b9343da9802). Result: success, "Message queued for delivery to a74e19b9343da9802 at its next tool round."
> Wildcard Inventor, Round A defence to the Problem Hunter on Tripwire and Quorum. Thanks for the candid Roda/KeyHold reply; it's logged. On the Chairman's instruction, some Tripwire items are left as open items with no further explanation.
>
> === TRIPWIRE ===
> 1 (who pays):
> - The buyer is the protocol team. The value proposition is a public credibility signal ("we've put $X on our invariant"), and it sits alongside HackerOne/Immunefi rather than replacing them. The team chooses which invariants to expose, so it keeps discretion over everything else [ASSUMPTION].
> - A second possible funder is ecosystem security budgets (SDF/SCF) [SPECULATION; not verified].
> - Your point stands that the paying side has shown it prefers discretion. That's a real demand risk and I don't dismiss it.
> 2 (disputes are about scope): agreed. Tripwire only covers pre-agreed invariants and does not settle disputes over bugs nobody anticipated. The pitch must say "pre-agreed severity for pre-agreed invariants", never "replaces Immunefi".
> 3: Not answered in debate; open item.
> 4 (market size): agreed that it's small. I can't verify a count of Soroban teams with meaningful TVL [UNKNOWN]. A search found no public bounty programs for Blend, Soroswap or Aquarius [UNKNOWN]. SDF's program is HackerOne-only since 7 May 2026 [VERIFIED https://hackerone.com/stellar/policy_versions]. Market is about 2.5–3.
> 5 / (b) (why HoneyPause wasn't adopted): I don't know [UNKNOWN]. My guesses are that it stayed a hackathon project that nobody productised, and that EVM already has a mature human-triage bounty market [SPECULATION]. I can't name a Stellar-specific reason beyond "not done here yet". That's negative evidence and I concede it.
> (a) Plausible prospects are Blend (Script3), Soroswap, Aquarius, DeFindex (PaltaLabs). None contacted, and their current bounty programs are unknown [ASSUMPTION / UNKNOWN].
> (c): Not answered in debate; open item.
>
> === QUORUM ===
> 6 / (d) (credibility vs organiser reluctance): your evidence persuades me. Credibility of the escrow was probably not the binding constraint, since those platforms were trusted operators. Extra data that supports you:
> - EnsureDone launched around Sept 2023 with 3 projects and has no later status I can find [VERIFIED https://www.lesswrong.com/posts/7koSvinoHSy6KBLqy/update-2-to-dominant-assurance-contract-platform-ensuredone,].
> - On-chain DACs already existed (ether-on-a-stick, TreeHacks 2016) and didn't take off [VERIFIED https://github-redirect.dependabot.com/phlip9/ether-on-a-stick]. That also corrects my 03 claim that none were found.
>
> So the "why Stellar" claim based on credibility is weakened, as you say.
> 7 (who pays the bonus): conceded that small organisers feel 10% as real money. The best counter I have is that the bonus is a marketing cost paid only on failure, and is capped. Whether organisers accept that framing is [UNKNOWN DEPENDENCY].
> 8 (lab vs field): the evidence is lab only (Cason, Tabarrok, Zubrickas). The field evidence is small personal experiments. No robust field effect is known to me [UNKNOWN].
> 9 / (e) (bonus farming): limited, not eliminated.
> - The bonus is time-weighted with a cutoff, with campaign open at T0, deadline T, cutoff Tc = T0 + 0.75·(T − T0), bonus pool B. Weight for pledge i made at time t_i with amount p_i: w_i = max(0, (Tc − t_i)/(Tc − T0)). Per pledge: bonus_i = min(B · p_i·w_i / Σ p_j·w_j, 0.2·p_i).
> - Late pledges earn 0. Early "farm" pledges carry real risk, because they raise the chance of success, and success spends the farmer's money on the project.
> - In DAC theory, paying the bonus to anyone who pledged before failure is the mechanism working as designed, and its total cost is bounded by B [ASSUMPTION: standard DAC reasoning].
> - It does make failure costlier for the organiser, which compounds the demand problem in your point 6.
> (f) (first 10 users, quote): I have no named users. The route would be to ask Lisbon meetup or community organisers for a quote before 10:00 Mon, with no guarantee [ASSUMPTION].
>
> Net: Quorum is weaker on demand and on "why Stellar" than I pitched it. Defend/improve/abandon is for Round B.

### Sent: to Chairman (main)
> Round A done.
