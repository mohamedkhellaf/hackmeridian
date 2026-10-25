# 06b: Debate log, replacement Wildcard Inventor (A3b), Round A

Session started about 14:05 Sun 25 Oct. Everything I sent and received is logged verbatim below, with the SendMessage results. Tags: [VERIFIED+link] / [ASSUMPTION] / [SPECULATION] / [UNKNOWN DEPENDENCY].

Context, read on arrival:
- The predecessor's Quorum defence had already reached the Judge (R-4 in 06_debate_ruthless_judge.md), the Problem Hunter (RECEIVED 5 in 06_debate_problem_hunter.md) and the Architect (acknowledged in its message to me).
- The Judge's verdict after R-4: Quorum at about 3.2, recommend dropping.
- My message to the Judge (S1) is a supplement. It contests three of the predecessor's concessions with new evidence.
- The Chairman then said the predecessor had answered all Round A Quorum attacks and told me to move to Round B. So I sent **no separate Round A messages to the Architect or the Problem Hunter**. My Quorum points to them are folded into the Round B messages in research/07_roundB_wildcard_inventor.md.

---

## RECEIVED R1 ← Problem Hunter (a74e19b9343da9802), verbatim

```
ROUND A DEFENCE (Problem Hunter -> Wildcard Inventor, replacement session): this resends my reply to your predecessor's attack on Roda and KeyHold. The predecessor acknowledged receiving it before its session ended. The full text is also in research/06_debate_problem_hunter.md under "SENT 5". Summary of my answers to its Q1–Q8:

Q1 Roda vs Amero: I concede I have no SCF-acceptable differentiator in the blind form. On-chain ROSCAs are saturated: AjoAI, ChamaVault, ChamaPay, ESUSU, Circlepot, CoSave on Celo; Ronda, Saving Circles, Tanda, ROSCA-Guard at ETHGlobal; Bloinx (UNICEF-backed); Amero and Clixpesa on Stellar [VERIFIED https://www.karmahq.xyz/project/ajoai/about, https://ethglobal.com/showcase/ronda-7ck82, https://ethglobal.com/showcase/saving-circles-bmgxr]. Reputation alone isn't new (AjoAI and Tanda already claim it). Guarantor *stake slashing* might be [UNKNOWN].
Q2 Arithmetic: defection gain at position k = (N−k)·c − C. With 10 × €200, round 1 needs C ≥ €1,800. At 20% (€400) the defector nets €1,400. Full collateral kills the credit benefit. The blind design is broken, conceded.
Q3 I lean toward guarantor vouching over bidding. It keeps the credit benefit and makes sybil re-entry cost new human vouchers. Open concerns: vouchers have capital locked for months for a small fee, and microfinance has partly moved away from joint liability [ASSUMPTION: e.g. Giné & Karlan, Philippines; not re-verified].
Q4 F8: round period as a contract parameter, "1 round = 1 minute in demo", shown with real ledger timestamps.
Q5 KeyHold: no named landlord or operator, no quote [UNKNOWN]. Plausible segment: student residences, coliving and relocation housing. The Deposit Passport is the best answer to F7 I've seen.
Q6 Trustless Work has no native timeout release ("Only the Release Signer can execute the release"; timers are a platform choice; automation "coming soon") [VERIFIED https://docs.trustlesswork.com/trustless-work/llms-full.txt, first 100k chars]. TW already documents rental security deposits [VERIFIED https://docs.trustlesswork.com/trustless-work/use-cases-unlocking-the-potential-of-smart-escrows/security-deposits]. Ours would be a keeper or arbiter contract holding TW's Approver/Release Signer role [ASSUMPTION: TW roles accept a C-address].
Q7 Portuguese law: [UNKNOWN DEPENDENCY]. The caução is contractual [VERIFIED https://amp.theportugalnews.com/ar/nieuws/2023-01-12/what-you-need-to-know-before-renting-a-home-in-portugal/73781]. Pitch it as "contractual mechanism, legal review pending".
Q8 Passport plus final-offer arbitration combine well: the passport is the product and final-offer is the dispute rule. Concern: move-out attestations from previous landlords become a reputation-farming target [SPECULATION]. Decision in Round B.

No reply needed unless you want to continue the Quorum thread. Your predecessor's Quorum defence is received and logged.
```

My handling: no separate reply. The Problem Hunter said none was needed, and its concessions are substantive. My Quorum points to it are folded into my Round B message.

## RECEIVED R2 ← Stellar Architect (a8dd31a4f45ac4f54), verbatim

```
Stellar Architect to the replacement Wildcard Inventor: here, on the Chairman's instruction, is my Round A defence to your predecessor's attack on ReliefRail+Earmark and LeashPay. The original was delivered to a68cdf315b30b705d and acknowledged. Full text is in research/06_debate_stellar_architect.md under "SENT 5".

Summary:
1. ReliefRail uses TRUSTLINES, not contract balances. Beneficiary trustlines stay at AUTHORIZED_TO_MAINTAIN_LIABILITIES. Each spend is an issuer-co-signed authorization sandwich (SEP-8 regulated-asset pattern [ASSUMPTION, SEP link pending]), so beneficiary-to-beneficiary resale fails on-chain. Cost: the rules engine sits in the NGO's off-chain approval server, and Soroban becomes optional.
2. A claimable-balance claimant is defined as a "destination account" [VERIFIED https://developers.stellar.org/docs/build/guides/transactions/claimable-balances]. C-addresses are likely excluded [ASSUMPTION], and the SAC can't create claimable balances [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract]. So passkeys are dropped in favour of sponsored G-accounts.
3. The SDF-judge sentence: "SDP delivers money; once it lands it can go anywhere. Purpose-bound money keeps the issuer's co-signature on every hop, and unclaimed aid flows to the next waitlisted family by itself." Concession: the AUTH_REQUIRED part is configurable by SDF in an afternoon.
4. I ADOPT the cascading-claimant waterfall (per-claimant predicates [VERIFIED, same guide]; ~10-claimant cap [ASSUMPTION]). Open item: whether a claim into a MAINTAIN_LIABILITIES trustline needs a full-auth sandwich [UNKNOWN DEPENDENCY]. Earmark goes on a deck slide only.
5–7. LeashPay: I can't state a differentiator that REAPP doesn't cover. REAPP is SCF #43, awarded $70k, with a Soroban MandateRegistry enforcing caps, periods and merchants plus x402, and a testnet merchant Query402 [VERIFIED https://communityfund.stellar.org/submissions/recrWPt0QGLHnbv5Z]. The 402 → C-account roundtrip is unrun (K3). The approve/transfer_from bypass of a transfer-only spending_limit is plausible [UNVERIFIED]. Round B lean: LeashPay ABANDON, ReliefRail IMPROVE.

Received and logged: your predecessor's Quorum defence (pull-based refund, time-weighted bonus formula, self-pledge conceded, no organiser-demand evidence). No reply needed unless you want to add to it. I'm sending no further Tripwire material, per the Chairman.
```

My handling: answered in Round B (07). There I propose an improvement that targets the weak point the Architect conceded here: an off-chain rules engine with Soroban optional.

## RECEIVED R3 ← Chairman (main), verbatim

```
Chairman: change of plan. Your predecessor's session came back and answered every Quorum attack in Round A. Its log is research/06_debate_wildcard_inventor.md; read the Quorum parts only. If you've already sent Quorum defences, they stand as a supplement. Move on to ROUND B now and finish by about 15:15.

1) QUORUM: explicitly pick DEFEND, IMPROVE, COMBINE or ABANDON. Your predecessor already conceded three things: claimable-balance refunds don't work (a Soroban contract can't create claimable balances, and claimants must be G-accounts), there is prior art (ether-on-a-stick, 2016), and track fit is about 2.5–3. Decide honestly.

2) CONTRARIAN DUTY: the committee is converging on purpose-bound money (ReliefRail+Earmark), and its weak spot is Innovation (SEP-8 is an old pattern). Propose ONE disruptive improvement or COMBINATION built only from pieces already on the table: the shortlist concepts, Earmark, Volta, or the eliminated ideas. No brand-new concept. It should raise Innovation and memorability without blowing the 20h budget. Alternatively, argue that a different surviving concept should lead instead.

Tag every claim [VERIFIED+link], [ASSUMPTION], [SPECULATION] or [UNKNOWN DEPENDENCY].

Write both to research/07_roundB_wildcard_inventor.md, and send them DIRECTLY to the Judge (a2cb972d7bcf3040e), the Architect (a8dd31a4f45ac4f54) and the Problem Hunter (a74e19b9343da9802). Respond to any replies. If you disagree with someone, name the assumption behind the disagreement.

Log everything verbatim. Then send me (to: "main") a 3-line "Round B done" note.

Address this before completing your current task.
```

---

## SENT S1 → Ruthless Judge (a2cb972d7bcf3040e): Quorum defence (supplement)

SendMessage result (verbatim):
`{"success":true,"message":"Message queued for delivery to a2cb972d7bcf3040e at its next tool round. If it finishes first, it is resumed with the message and notifies again, so wait for that notification before resending.","pin":{"id":"a2cb972d7bcf3040e","name":"a2cb972d7bcf3040e","ref":"5d5244"}}`

Message (verbatim):

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

## Not sent (by Chairman decision)
- Round A Quorum defence to the Architect and to the Problem Hunter. The predecessor had already answered both, and the Chairman moved me to Round B. Material I would have added, now carried in 07:
  - Organiser self-pledge is harmless to backers. It amounts to the organiser lowering the goal after the fact, and they keep the delivery obligation.
  - The farming break-even: P(fail) > 1/(1+r·w).
  - EnsureDone doesn't say how it held bonuses, so "trusted operators" is not established.

## Round A status
- Sent: 1 (Judge). Result: success (queued).
- Received: 3 (Problem Hunter, Architect, Chairman). The Judge has not yet replied to S1.
