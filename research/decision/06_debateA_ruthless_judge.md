# 06: Debate Round A (Attack), Ruthless Judge log

This is the official record. It holds every message the Judge SENT and RECEIVED, verbatim, with the time (WET = UTC+0) and the from/to.

Evidence gathered for this round:
- Stellar docs, list of operations (https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations):
  - Payment and PathPayment: threshold **Medium**
  - ClaimClaimableBalance: threshold **Low**
  - BumpSequence: threshold **Low**
- IC3 2024 coverage of victims aged 60+:
  - about $2.8B in crypto losses, 33,369 complaints, average loss about $83k per victim
  - about $1.6B of that from investment scams
  - $107M through crypto ATMs (people 60+)
  - Sources: https://decrypt.co/316090/elderly-americans-hit-hardest-by-9-3b-crypto-scam-wave-in-2024-fbi and https://forklog.com/en/elderly-americans-lose-2-8-billion-to-crypto-scams-in-2024/amp
- Raven skill `stellar-dev.agentic-payments`: "x402's payTo route config and MPP's recipient are always a classic account (G...)".


---
## [13:11 WET] SENT, from Ruthless Judge to Wildcard Inventor (a478580ad9cad690f)

```text
Round A attack from the Ruthless Judge on S1 Second Thought (and the Guardian merge), S2 Loop and S6 Stamp. Please answer each question; you get one follow-up from me.

Labels: [V] = verified (link), [A] = assumption, [S] = speculation, [U] = unknown dependency.

=== S1 SECOND THOUGHT / GUARDIAN: I'm the designated opposition. Four models ranking it #1 is not evidence. ===

W1 (potentially fatal): the undo window is NOT protocol-enforced on the sender side. It is enforced only by our app.
- Facts:
  - Payment and PathPayment are **Medium** threshold [V https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations#payment].
  - In your config the parent weight is 2 and the medium threshold is 2. So Mum's key ALONE can sign a plain Payment from LOBSTR, Freighter or any wallet, and the window disappears.
  - Scammers routinely walk victims step by step through installing a different app [A, standard pig-butchering/tech-support playbook].
- The protocol only guarantees "the recipient can't claim early IF the sender chose a claimable balance". The pitch line "enforced by the Stellar protocol, not a company" is therefore false as stated, and a protocol-literate judge (Garand Tyson, Tyler van der Hoeven are listed mentors/judges [V hackmeridian.com/build/mentors]) will catch it.
- The only native fix is parent weight < medium (e.g. parent 1, guardian 1, medium 2). Then EVERY payment needs the guardian's co-signature. That is 2-of-2 custody, not "undo", and it kills "known payees are instant".
- The contract fix is an OZ smart account with a policy. That needs Rust, and smart-account C-addresses can't be claimable-balance claimants (the Architect's trap #8 [A]).
- QUESTION 1: Give me the exact signer weights and thresholds under which (a) Mum alone can pay a known payee instantly, AND (b) Mum alone cannot bypass the window by importing her key into another wallet. If no such config exists, say so and tell me the new pitch line.
- What would change my mind: a config or mechanism, verified in the Stellar docs or by a testnet spike, that satisfies both (a) and (b) without a contract.

W2 (user value): the threat model doesn't match where the $2.84B actually goes.
- Facts: IC3 2024 coverage puts 60+ crypto losses at about $2.8B with an average loss of about $83k per victim, and about $1.6B of it from INVESTMENT scams [V https://decrypt.co/316090/elderly-americans-hit-hardest-by-9-3b-crypto-scam-wave-in-2024-fbi , https://forklog.com/en/elderly-americans-lose-2-8-billion-to-crypto-scams-in-2024/amp].
- An $83k average is a long con: weeks of grooming, where the victim re-confirms after 24h and fights the guardian [A].
- The money flows bank → exchange or crypto ATM ($107M through ATMs for people 60+ [V same coverage]) → scammer. It does not come out of an elder's self-custody USDC wallet on Stellar.
- The "grandson on WhatsApp, send €900" impostor scam in your demo is the minority case [A].
- Also: payments to exchange deposit addresses or merchants arrive as claimable balances, which those recipients typically don't claim [A]. So legitimate first-time payments break.
- QUESTION 2: (a) Who is the concrete first user? Name the population of elders who hold self-custodied stablecoins on Stellar today, and a distribution channel (wallet partner? anchor? remittance receivers?). (b) Name ONE documented scam typology where a 24h window plus a guardian would have stopped the loss.
- What would change my mind: a credible channel such as remittance RECEIVERS of a Stellar wallet/anchor, or an existing wallet that could ship this, plus one cited case.

W3 (Guardian merge bug): the two mechanisms fight over the same account clock.
- Facts:
  - BumpSequence is **Low** threshold [V same docs page], so the guardian (weight 1 ≥ low 1) can submit BumpSequence on Mum's account.
  - Every guardian-signed transaction on Mum's account (including the undo ClaimClaimableBalance itself) uses Mum's account as source, which updates seqTime [V CAP-21 semantics as described by the Architect].
- Consequences:
  - Every undo re-arms the dead-man timer.
  - A guardian who is not the heir can bump past willSeq and silently REVOKE the will.
  - For an incapacitated parent whose guardian keeps undoing, the recovery never matures.
- QUESTION 3: How do you separate "guardian activity" from "owner activity", or do you accept guardian == heir? Either way, does the merge still beat S1 alone, or is it scope creep with a correctness hole?

W4 (secondary, AI-twin and "simple"): the mechanism is obscure, I'll grant that. But "elder-safe wallet" is a domain that other teams' models will also reach for (usually as AI scam detection).
- QUESTION 4: In one sentence, what is the human seed here, the fingerprint the judges asked for?

=== S2 LOOP ===

W1: the mechanics are unproven and the comprehension cost is high.
- You need, all working: issuer offers that buy back their own IOU, a source == destination path_payment_strict_send, client-side cycle finding, and a path-length cap (I believe the XDR path is limited to 5 assets [A, from memory, not re-verified]).
- Even if it works, the "aha" depends on a judge following a 3-hop IOU graph in under 30 seconds of video.
- QUESTION 5: Will you run the 45-minute spike BEFORE the decision, and post the testnet transaction hash? Without a hash I score Technical Execution risk as high.
- What would change my mind: a testnet transaction hash for a 3-firm cycle cleared by one self-payment.

W2: no real adopter, and privacy is unsolved.
- Real SMEs will not publish their full payables graph on a public ledger. The only prior Stellar netting builds (SettleZK, zkNexus [V Scout / dorahacks.io/buidl/46011, /46452]) exist precisely to hide it.
- Pseudonymous accounts don't survive: anyone who knows one counterparty can de-anonymise the cluster [A].
- The cold start needs ≥3 firms in a cycle, all with Stellar accounts and trustlines.
- QUESTION 6: Who is the first cluster, concretely (a named type of association, marketplace or platform that already holds the invoice graph)? And why would it accept public debts instead of running AJPES-style netting in a database?
- What would change my mind: a platform-mediated go-to-market, e.g. a B2B invoicing app or marketplace that holds the graph and uses Stellar as settlement, where the privacy answer is credible.

=== S6 STAMP (protected contrarian) ===

W1: the x402 payTo flaw.
- "x402's payTo route config and MPP's recipient are always a classic account (G...)" [V Raven skill stellar-dev.agentic-payments].
- So the bond cannot land directly in your Soroban escrow keyed by message hash. Either your server's G-account custodies every bond (then "neither party can override the escrow" is false, and you're a custodian), or you add a second hop that the server signs.
- QUESTION 7: What is the exact flow from 402 → funds in escrow, and who holds keys at each step?
- What would change my mind: a documented x402 scheme or facilitator option that settles into a contract address, or an honest custodial design that still beats the alternative.

W2: the adoption loop is broken.
- Stamp is an opt-in contact form. AI SDR agents email you directly, so spam keeps arriving via email unless you close every other channel.
- Legitimate senders won't integrate until inboxes require it; inboxes won't require it until senders integrate.
- QUESTION 8: Why would an outreach agent POST to stamp.link instead of just emailing? Name the forcing function.
- What would change my mind: an existing platform where the recipient already controls the only channel (e.g. a GitHub-issue or DM gate for maintainers, a Calendly-style booking page) and where a bond plausibly gets adopted.

Please reply directly to me (Ruthless Judge). I'll log everything verbatim in research/decision/06_debateA_ruthless_judge.md.
```

---
## [13:11 WET] SENT, from Ruthless Judge to Stellar Architect (afa57e164c5df066c)

```text
Round A attack from the Ruthless Judge on S3 Heirloom and S4 FairSeat. Please answer each question; you get one follow-up from me.

Labels: [V] = verified (link), [A] = assumption, [S] = speculation, [U] = unknown dependency.

=== S3 HEIRLOOM ===

W1: the target user contradicts the mechanism, and the domain is already crowded.
- Your heartbeat is "any normal transaction". But the users with the most at stake are cold-storage holders, who are inactive by design.
  - For them the switch either fires early (a short window) or they must remember to send a no-op BumpSequence. That is exactly the "check-in" you claim to eliminate.
  - Plus the trap you found yourself: never-transacted-since-P19 accounts have no seqTime, so they need an initialising transaction [V your probe].
- The inheritance domain already has 4+ Stellar builds: Obol, Boreal Pulse, Heritaz, Legacy Suite, and Heritage Protocol at BA 2025 [V Scout]. Judges have seen "crypto inheritance" before. The mechanism is new; the pitch is not.
- The market is narrow: people holding meaningful self-custodied value on Stellar G-accounts specifically [A].
- QUESTION 1: Who is user #1, concretely, and roughly how many exist? And what is the heartbeat story for a holder who doesn't transact for 6 months?
- What would change my mind: a user segment that transacts regularly AND holds enough to care, e.g. LatAm/African freelancers paid in USDC on Stellar, with a number or a wallet partner (LOBSTR, Beans, Vibrant) that could ship it.

W2: security and correctness edges.
- The heir holds a bearer instrument for FULL account control (SetOptions adds a high-weight signer), not a payout.
- Revocation via BumpSequence kills ALL wills, so staggered heirs are fragile.
- Any later SetOptions by the owner (thresholds or master weight changes) can make the will fail silently [A].
- Freighter signing an XDR whose seqNum is S+2^32 with preconditions is [U]. If Freighter refuses or rewrites the sequence, the demo needs a raw-keypair fallback, which looks bad in UX.
- QUESTION 2: (a) Will you run the Freighter signing spike before the decision and post the result? (b) Why should a judge accept "heir gets full control" rather than a payout? (c) What does the owner see if a will has silently become invalid?
- What would change my mind: a passing Freighter spike, plus a design where the heir's power is scoped. For example, the pre-signed tx is a payment/merge to the heir rather than a signer grant, with a "will health" check in the UI.

=== S4 FAIRSEAT ===

W1: the scalping cap is bypassable, and the gatekeeper is centralized.
- A ticket lives on a G-account whose secret key is trivially transferable. A scalper sells the ACCOUNT (the secret key) off-chain at 5x, and your auth flags never see a transfer [A, obvious attack].
- Bots still win the primary sale; you only cap resale.
- Every transfer is co-signed by the organizer's approval server holding issuer and escrow keys. So the honest answer to "why blockchain" is thin, given that centralized face-value resale exchanges already exist in some markets [A].
- QUESTION 3: How do you stop account-sale scalping and primary-sale bots without identity? If you can't, what exactly is the user value over a centralized face-value exchange?
- What would change my mind: a binding (e.g. a door check that matches the purchaser identity or passkey device) that defeats account resale within the build budget, or a reframe where the organizer's royalty on resale is the value rather than anti-scalping.

W2: fan UX, plus twin and build risk.
- Every fan needs a G-account, a trustline per event tier plus a USDC trustline, and reserves (sponsored, fine), and must sign multi-party sandwich XDR.
- That fails "my mom can use it" unless you custody keys.
- Ticketing has about 40 prior Stellar builds [V Scout hybrid search], so twin risk is real.
- You estimated about 15h at medium risk, with multi-signer XDR assembly being fiddly for Soroban/Stellar newcomers.
- QUESTION 4: What does the fan flow look like without Freighter? And which ONE flow do you cut to if the approval server isn't working by hour 10?
- What would change my mind: a demo plan where the fan never sees a wallet, plus a clear cut-line.

Please reply directly to me (Ruthless Judge). Everything is logged verbatim in research/decision/06_debateA_ruthless_judge.md.
```

---
## [13:11 WET] SENT, from Ruthless Judge to Problem Hunter (ade2988c3cf167d97)

```text
Round A attack from the Ruthless Judge on S5 PrizeLock, in its improved native form (multisig pool + pre-signed time-locked refund + claimable-balance payouts). Please answer each question; you get one follow-up from me.

Labels: [V] = verified (link), [A] = assumption, [S] = speculation, [U] = unknown dependency.

W1: the evidence you cite doesn't match the cure.
- YaLLa (~$700k unpaid), GXR and GESC failed because the money NEVER EXISTED or was never collected from sponsors [V, your own sources describe sponsor-dependence and insolvency].
- PrizeLock only protects pools that are already funded. A TO with the cash in hand is the TO that was going to pay anyway. The TOs who default are exactly those who will refuse to lock, or will lock only "$2k of $3k".
- You named this as your biggest uncertainty yourself.
- QUESTION 1: What fraction of tier-2/3 tournaments have the prize money in hand at registration? Give one data point or one organizer quote. And what is the forcing function: do teams or publishers start REQUIRING the badge?
- What would change my mind: a publisher or platform rule requiring escrowed prize pools (e.g. Valve's circuit rules or a start.gg policy), or an organizer saying "we'd lock if it brought teams/sponsors".

W2: the native mechanism as described doesn't work as stated.
- (a) A pre-signed time-locked refund must name its destinations at signing time. Teams register AFTER the pool is locked, so who does the refund pay?
  - If it pays the TO, the TO can let the deadline pass and take the money back. That defeats the guarantee.
  - If it pays the teams, you must re-sign after registration closes. And any other transaction from the pool account consumes the sequence number the pre-signed refund depends on, unless you use minSeqNum/minSeqAge preconditions [V CAP-21, per Architect].
- (b) Claimable-balance payouts require winners to have G-accounts plus a USDC trustline [A]. Then they need cash-out in Kenya or Mongolia, which means anchors you haven't verified on testnet [U, your own note].
- (c) Escrow has 34 Stellar builds and 0 winners [V Scout], and Trustless Work, a HackMeridian partner [V hackmeridian.com/build], sells escrow. A judge may ask "why not compose Trustless Work?"
- QUESTION 2: Write the exact account setup: signers, weights, thresholds, which transactions are pre-signed with which preconditions, and who receives the refund. Show me that the TO cannot recover the pool alone at ANY point.
- QUESTION 3: Under your design, is Track Alignment really ≥4/5 (Unlocked), or is it escrow with native plumbing?
- What would change my mind: a concrete signer/precondition table where no single party (including the TO) can ever reclaim, verified against the docs. Plus one sentence on why native beats Trustless Work.

Please reply directly to me (Ruthless Judge). Everything is logged verbatim in research/decision/06_debateA_ruthless_judge.md.
```

---
## [13:12 WET] RECEIVED, from Problem Hunter (ade2988c3cf167d97) to Ruthless Judge

```text
Problem Hunter's reply to the Judge on S5 PrizeLock. Honest answers, with concessions marked.

QUESTION 1 (pre-funding fraction and forcing function)
- [U] I have NO data on what fraction of tier-2/3 TOs hold the cash at registration, and no organizer quote. I won't invent one.
- [V] I looked for a publisher forcing rule and did NOT find one. Riot's current LoL community competition guidelines put no caps on prize pools, and I found no payout-deadline or escrow rule (https://lolesports.com/en-US/news/lol-esports-community-competition-guidelines).
- [V] The only forcing function I found is legal. Some jurisdictions require organizers to "post bonds to guarantee prize payment", and counsel recommends separating prize money into escrow (https://www.daeryunlaw.com/us/insights/esports-action-in-new-york). That's a weak, jurisdiction-specific driver, not a market pull.
- CONCEDED: your W1 is correct. The evidence shows money that never existed. PrizeLock filters out bad TOs (no badge = signal) but doesn't rescue their victims. The value proposition shifts from "guarantee" to "signal plus selection": teams and sponsors steer toward locked pools.
- That only works if teams care enough to choose. My evidence for that is anecdotal at best: the public outrage around YaLLa and GXR [V coverage]. [S] that it changes team behaviour.

QUESTION 2 (exact setup; can the TO ever recover alone?)
The pool is a dedicated account P, created at registration close (team list frozen).

| Step | Source | Content | Signers |
|---|---|---|---|
| T0 | TO | CreateAccount P (XLM covering 1 base + 1 trustline + N×0.5 CB reserves) | TO |
| T1 | P | ChangeTrust USDC; SetOptions: add signer TO w=1, add signer REF w=1, master weight 0, thresholds low = med = high = 2 | P master (last time it signs) |
| (P's seq is now S) | | | |
| R (pre-signed, published, NOT submitted) | P, seq S+1 | timebounds.minTime = deadline; ops: N × CreateClaimableBalance(USDC, pool/N, claimant = team_i, unconditional) | TO + REF |
| D | TO | Payment USDC → P (doesn't touch P's seq) | TO |
| Badge | — | Shown ONLY if a verifier confirms: P balance ≥ promised; P signers/thresholds exactly as in T1; P seq == S; R's signatures valid | — |
| W (final) | P, seq S+1 | CreateClaimableBalance to winners per the split fixed in the tournament terms | TO + REF |

- R and W are mutually exclusive: whichever lands first makes the other tx_bad_seq.
- **Can the TO recover alone at ANY point after D? No.** TO weight 1 < every threshold 2, and master weight is 0, so every op on P (payments, SetOptions, BumpSequence, AccountMerge) needs REF too [V: thresholds/weights semantics, https://developers.stellar.org/docs/learn/fundamentals/transactions/signatures-multisig#thresholds].
- Before D the money is in the TO's own account and there's no badge, so nothing is promised.
- The refund goes to the TEAMS, never to the TO.
- Sponsor top-ups after R: the refund covers only the base pool. Top-ups go out through W. A re-signed R' at the same seq S+1 with larger amounts is possible; both stay valid, and teams would submit the larger one.
- CONCEDED, residual risk: TO + REF colluding (2-of-2) can do anything. A 2-of-3 with a team-elected captain key still lets any 2 collude. "No single party" holds; "no collusion" does not, natively.
- The ONLY way to make collusion unable to redirect funds is a Soroban rule: signers submit a ranking (a permutation of registrants), never addresses. That's a contract, i.e. escrow.
- Verification status: the table follows documented semantics; I haven't run it. 1h spike needed.

QUESTION 3 (Track Alignment)
- No, it's not ≥4/5. Honest score: 3/5. Multisig, timebounds, sequence-number mutual exclusion and claimable balances are each used in their textbook way. It's "escrow with native plumbing", exactly as you put it.
- Native vs Trustless Work, one sentence: native has zero third-party API in the demo path and pays wallet-less winners via claimable balances. TW gives the Composed track with a partner plus dispute-resolver roles, but adds an external dependency and puts us squarely in the 0/34 escrow category.
- Neither reaches TA 4 on its own.

Where this leaves PrizeLock (my position going into Round B, not final): the strongest documented pain in the room, a weak cure for that pain (W1), and TA 3. Unless a sharper mechanism or a combination turns up, I expect to recommend folding its human seed ("money promised, never delivered") into another shortlisted concept rather than defending it to the end.

Your follow-up?
```

---
## [13:13 WET] SENT, from Ruthless Judge to Problem Hunter (ade2988c3cf167d97), follow-up 1/1

```text
Judge follow-up on S5 PrizeLock (my last message to you this round): your answers were honest and your design is correct; two holes remain.

1. The badge certifies less than it claims, and the gap is invisible.
   - The TO chooses REF. A sock-puppet REF makes the 2-of-2 equivalent to TO-alone [A, obvious].
   - Worse, the verifier can check P's signers, balance and seq == S, but it can never see OTHER transactions already co-signed off-chain at seq S+1. That includes, for example, a TO+REF-signed "pay P → TO" kept in a drawer. So the badge cannot rule out a pre-arranged exit, and nobody can detect one [V: signatures are off-chain until submission; sequence semantics per CAP-21 / tx docs].
   - The only fix is an independent REF, i.e. us or the platform. That makes us the trust anchor, which is a custodial escrow service with extra steps.
   - QUESTION A: In the demo, who is REF, and what sentence on the deck answers "what stops the TO picking their cousin as referee"?
2. A fold has to be justified. "Fold the human seed into another concept" is only worth anything if it raises that concept's User Value score with evidence; otherwise it's decoration.
   - QUESTION B: Name the ONE shortlisted concept you'd fold "money promised, never delivered" into, and the concrete demo beat or user that changes. If it doesn't change a beat or a user, say "no fold" and we drop S5 cleanly.

My current read: S5 is down from 69.5 to about 63. Track Alignment is honestly 3, its Problem→Cure fit is broken (W1 conceded), and it adds a residual collusion hole. I credit you for not inventing data. That is exactly the evidence discipline the judges reward.
```

---
## [13:13 WET] RECEIVED, from Problem Hunter (ade2988c3cf167d97) to Ruthless Judge

```text
Problem Hunter's reply to the Judge's follow-up on S5.

QUESTION A: who is REF?
- CONCEDED in full. The drawer-transaction hole is real and fatal to the badge's claim. TO+REF can co-sign a "P → TO" payment at seq S+1 off-chain, and no verifier can see it until it lands, at which point it also kills both R and W.
- The only fix is an independent REF, which would be us. That makes PrizeLock a custodial escrow service with extra steps, and puts us back in the 0/34 escrow category with a trust anchor that is no better than a bank.
- I have no honest deck sentence that answers "what stops the TO picking their cousin". Any sentence I wrote would be marketing.
- The Wildcard's sponsor-pledge variant (a claimable balance from the sponsor, claimable by the pool after the event starts) doesn't fix this either: the pool account is still TO+REF controlled.

QUESTION B: fold?
- NO FOLD. I checked each shortlisted concept honestly:
  - S1: elder scams. Different pain.
  - S2: late payments. It already has its own seed in the AJPES set-off and late-payment chains; "esports prizes" adds no beat.
  - S3: inheritance. Different pain.
  - S4: scalping. Different pain.
  - S6: inbox. Different pain.
- "Money promised, never delivered" would be decoration in every one of them. Drop S5 cleanly.
- I'll confirm this formally as "abandon" in Round B unless something new appears. I agree with your ~63.

One thing worth keeping from this exercise for whichever concept wins: the drawer-transaction insight applies to ANY design whose guarantee rests on "pre-signed tx at seq S+1". Off-chain co-signed alternatives at the same sequence number are invisible. That's directly relevant to S3 Heirloom: an owner could pre-sign a competing tx at the will's sequence number, though it's the owner's own account, so it's less of a threat. It's also relevant to S1 if any pre-signing is used. Please carry it into your attack on those.
```

**Judge note:** S5 is closed. The Problem Hunter recommends abandoning it with no fold. I'm noting the drawer-transaction insight for S3 and the Guardian merge. For Heirloom it is a minor point, because the owner can always revoke anyway. It matters more where the guardian or heir co-signs.

---
## [13:15 WET] RECEIVED, from Stellar Architect (afa57e164c5df066c) to Ruthless Judge

```text
Stellar Architect's reply to the Ruthless Judge on S3 Heirloom and S4 FairSeat.

Spike [Verified, testnet 13:11–13:12 UTC, hashes in research/decision/06_debateA_stellar_architect.md]:
- The pre-signed SetOptions (seq S+2^32, minSeqNum S, minSeqAge 30s, heir fee-bump) is rejected early with tx_bad_minseq_age_or_gap.
- An owner payment resets the timer: still rejected 20s after the payment.
- It is accepted 36s after the last owner activity.
- Revocation via bumpSequence → tx_bad_seq.
- I also spiked WI-2 and WI-1 for the Wildcard; both pass. Same file.

== S3 Q1: user #1 and the heartbeat ==
- User #1: an active USDC user on a Stellar G-account who transacts monthly, e.g. a LatAm/African freelancer paid in USDC, or a Vibrant/Beans/LOBSTR user. For them the heartbeat is free: any outgoing tx resets it [Verified spike].
- Count: [Unknown]. I have no number and won't invent one. Concede that.
- Cold holder: a one-tap no-op BumpSequence (100 stroops, moves nothing), with a reminder at 80% of the window. That is a check-in, CONCEDED, but with no funds parked in a contract and nothing to ping on-chain except your own account.
- Category familiarity: CONCEDED. The mechanism is new; the pitch "crypto inheritance" is not.
- Honest reframe:
  - "Access recovery": your OWN backup key held by a lawyer or family member becomes valid only after N days of silence. Lost keys are far more frequent than deaths [Speculation on ratio].
  - Strongest version: as the second act of WI-2 "Guardian". Same account, same guardian key, and the guardian's weight is raised 1 → 2 by the CAP-21 will. I believe the merge beats S3 standalone, and I'll argue that in Round B.

== S3 Q2 ==
(a) Freighter: it can't be tested headlessly here. It's a browser extension, so this stays [Unknown] until a human clicks it.
  - If the idea is picked, it's the first 30-minute task.
  - Fallbacks in order: another wallet via Stellar Wallets Kit (xBull/Albedo/LOBSTR signer); otherwise an in-app keypair (embedded wallet).
  - For a judge-testable demo we need in-app keypairs ANYWAY, because judges won't have 2–3 funded Freighter accounts. So a Freighter failure doesn't kill the demo.
(b) Why full control rather than a payout: payout amounts are fixed at signing time.
  - Payment ops fail atomically if the balance drops (op_underfunded), and leave the rest stranded if it rises.
  - AccountMerge fails while trustlines exist.
  - A signer grant is the only native way to pass "whatever is there, including USDC trustlines".
  - Scoping fix, a TWO-STAGE will:
    - Stage 1 (after T1) adds the heir at LOW weight. That gives no spending power (WI-2 spike: low weight → Payment op_bad_auth) and is a public on-chain warning the owner's wallet surfaces.
    - Stage 2 (minSeqNum = stage-1 seq, minSeqAge = grace) raises the heir to HIGH.
    - Stage 1 is owner-sourced, so it resets seqTime and the grace timer starts automatically [CAP-21 semantics Verified; behaviour Assumption until spiked, about 10 min].
    - Owner activity during grace blocks stage 2. The owner can also remove the heir signer (high op).
(c) Silent invalidity: a "will health" panel computed from Horizon state, with no submission needed. It checks:
  - account seq ≥ minSeqNum and < will seqNum (else "revoked");
  - the heir's resulting weight vs the CURRENT high threshold (else "insufficient after your threshold change");
  - signer count < 20;
  - sequence_time present (else "initialise").
  The wallet re-prompts a re-sign when health goes red. Revoking all wills with one BumpSequence is a feature for "revoke everything"; selective revocation = remove that heir's signer after it fires, or re-issue.

== S4 Q3 / Q4 ==
- Account-sale scalping: CONCEDED, not stoppable without identity at the door within budget. Primary-sale bots: not addressed.
- Against a centralized face-value exchange, the remaining protocol-only value is:
  - portability;
  - survival of organizer or platform bankruptcy (ticket and refund state lives on-ledger);
  - resale royalty enforced on every transfer.
  That's a thin user story. Your royalty reframe is the better one, but it's still B2B-ish.
- Fan flow without Freighter: an embedded in-browser keypair plus organizer-sponsored reserves (BeginSponsoring → CreateAccount 0 → ChangeTrust TICKET + USDC → EndSponsoring). USDC acquisition remains a gap; it is seeded in the demo.
- Cut-line at hour 10: drop the resale market entirely and keep primary sale, a non-transferable ticket (direct send rejected: op_not_authorized), and a door burn. That cut product is thin.
- My lean for Round B: S4 is my weakest. I expect to abandon it.

One follow-up welcome.
```

---
## [13:16 WET] SENT, from Ruthless Judge to Stellar Architect (afa57e164c5df066c), follow-up 1/1

```text
Judge follow-up to the Stellar Architect (my last message this round): the spikes are real progress, and S3 and the Guardian merge still each have one open hole.

Credit given, Verified per Chairman log 13:13 with real tx hashes:
- The SA-1 mechanism works.
- WI-1's self path payment clears a cycle (this resolves my S2 W1 mechanics doubt).
- WI-2's guardian undo works and guardian-only Payment fails.
- S4 is abandoned with honest concessions. Noted.

1. The Guardian merge clock conflict is now CONFIRMED by your own spike ("guardian-only bumpSequence OK, so a guardian can reset or kill a CAP-21 will").
   - Worse: the undo itself is an owner-sourced ClaimClaimableBalance. ClaimClaimableBalance must be sourced by the claimant, and the claimant must be Mum's account. If the claimant were the guardian's own account, the "undo" would land in the guardian's wallet, which is spending power [A, from CB semantics].
   - So every undo re-arms the recovery timer. In the exact scenario the merge sells (Mum incapacitated, being scammed, guardian actively undoing), stage 2 never matures.
   - QUESTION 1: Is there any native construction where guardian activity does NOT reset the recovery clock? For example, a recovery precondition keyed to a DIFFERENT account's sequence. I believe preconditions only see the tx source account [A], so I suspect not. If not, the merge has a built-in contradiction. Does recovery then go to a separate account, or do we drop it?
2. You are the protocol expert, so you're the right person for this one. My S1 W1 says the undo window is app-enforced: Mum at weight 2 equals the medium threshold, so she can pay from any wallet and bypass it.
   - QUESTION 2: Do you know ANY native signer/threshold/precondition configuration where (a) Mum alone can pay known payees instantly AND (b) Mum alone cannot bypass the window from another wallet? Or is the honest pitch "the guardian can always pull back a pending payment; the window is our wallet's default, not a protocol guarantee"?
3. S3 users: the count is Unknown, conceded.
   - QUESTION 3 (optional, only if cheap): one number from Scout/Stellar Expert/Hubble, e.g. the count of G-accounts holding ≥ 100 USDC with an outgoing transaction in the last 30 days. Without it, MEP stays at 2.5.
```

---
## [RECEIVED ~13:20 WET] from Wildcard Inventor (a478580ad9cad690f) to Ruthless Judge

```text
Wildcard Inventor's point-by-point reply to the Judge's Round A attack on S1 Second Thought, S2 Loop and S6 Stamp. Summary: concede W1 as originally pitched (with a fix), concede most of W2, fix W3, and concede most of Stamp.

Labels: [V] verified with a link or spike tx, [A] assumption, [S] speculation, [U] unknown dependency. "Spike" means the Architect's testnet run (13:09–13:13 UTC, research/decision/06_debateA_stellar_architect.md).

=== S1 ===
Q1 / W1: CONCEDED as originally pitched. With Mum at weight 2 and medium threshold 2, the window is app-level. The line "enforced by the Stellar protocol" was false. [V: Payment = Medium; the spike shows a weight-1 key alone gets op_bad_auth on Payment]

Pure classic, no co-signer, no contract: NO config satisfies both (a) and (b). Classic signing authority is not destination-aware, so "instant to a known payee, delayed to others" cannot be expressed by thresholds alone. [A, high confidence]

Fix that meets (a) and (b) with no contract: a 2-of-3 policy co-signer ("collaborative custody").
- Mum's G-account signers:
  - Mum key: weight 1 (kept in-app, never shown as a seed phrase)
  - Second Thought policy key: weight 1 (server/HSM)
  - Recovery key: weight 1 (offline backup, e.g. in a safe or with a lawyer; NOT the daughter)
  - Thresholds: low 1 / medium 2 / high 2
- (a) Known payee is instant: Mum signs, and the policy key co-signs automatically after an allowlist check. 1+1 = 2 ≥ medium. [V mechanics: ordinary multisig, same threshold math as the spike]
- (b) Mum's key imported into LOBSTR: weight 1 < medium 2, so op_bad_auth, enforced by validators. [V: the spike proved a weight-1 key alone fails on Payment]
- New payee: the policy key will ONLY co-sign a CreateClaimableBalance carrying the 24h predicate, never a direct Payment. The protocol then enforces that the recipient can't claim early. [V spike: op_cannot_claim before T]
- The policy key alone can't move anything (1 < 2). It is a co-signer, not a custodian.
- Liveness: if our server dies, Mum + recovery key = 2 can remove it. Optional escape hatch: SA-1's CAP-21 pre-signed tx raises Mum to weight 2 after N days of inactivity. [V spike (c) for the mechanism]
- Honest split of guarantees:
  - PROTOCOL-enforced: no single key moves money; the claim window; that undo works.
  - APP/POLICY-enforced: which payees count as "known"; the 24h rule for new ones.
- New pitch line: "No single key — not Mum's, not ours, not a scammer's who has Mum's — can send her savings to a stranger instantly. A stranger only ever gets a payment that waits 24 hours and can be pulled back. Stellar validators enforce that."
- Cost: one external service (our policy co-signer). That stays within your ≤2 dependency rule. The precedent is 2-of-3 collaborative custody, as Casa/Unchained do for Bitcoin. [UNVERIFIED in-session]

Q2 / W2: largely CONCEDED for the US/EU elder.
- The $2.8B flows bank → exchange/BTM → scammer, not out of Stellar self-custody. I won't claim it does.
- Re-seated user: families who ALREADY receive and hold USDC on Stellar in self-custody, i.e. remittance receivers.
  - Evidence: the MoneyGram app in Colombia gives a USDC balance built on Stellar, with self-custody via Crossmint. MoneyGram notes Colombian families receive >22× what they send. [V https://blockworks.co/news/moneygram-stablecoin-app-colombia , https://cointelegraph.com/news/moneygram-app-launch-colombia-stablecoin-savings]
  - The ageing parents of migrants are exactly the impostor-scam target ("your son is in trouble, send now"). [A]
  - [U] Crossmint wallets may be smart wallets (C-addresses), which cannot be claimable-balance claimants. If so, MoneyGram itself is not a drop-in channel.
  - Channel: ship Second Thought as an SDK/feature for Stellar wallets and anchors (LOBSTR, Beans, Vibrant, MoneyGram). B2B2C. [S on partner interest]
- (b) Documented typology: impostor / "family emergency" / "safe account" scams. Their lever is URGENCY, and a delay plus a second human breaks urgency.
  - Policy evidence that delay is accepted as an anti-fraud tool: since 30 Oct 2024, UK PSPs may delay outbound payments up to 4 business days on suspicion of APP fraud. [V https://fca.org.uk/publication/finalised-guidance/fg24-6.pdf]
  - Kraken holds withdrawals to NEW addresses for 24h after a credential change. [V https://support.kraken.com/hc/en-us/articles/360000672863]
  - CONCEDED: I have no causal effectiveness study, and a 24h window does NOT stop a groomed $83k investment-scam victim who re-confirms. There the guardian alert on "repeated sends to a new address" is the only lever. [A]
- Merchants and exchanges won't claim CBs: CONCEDED. Mitigations: verified merchants (SEP-1 home domain) and exchange deposit addresses go on the known-payee list after a one-time 24h cooling period, then get normal payments. [A]

Q3 / W3: FIXED by design. The guardian gets NO signer weight on Mum's account.
- The guardian becomes a CLAIMANT on each pending CB (predicate BEFORE T). Undo = the guardian claims it into a safe-keeping account and returns it, or Mum reclaims it herself (weight 1 ≥ low).
- That removes the guardian's BumpSequence power, the parent-fee burn the Architect found, and every interaction with the CAP-21 clock.
- The spike proved the guardian-signed parent-sourced undo works, but it also consumes Mum's sequence, so your bug is real for that variant. [V spike (a): bumpSequence by guardian OK]
- Merge verdict for Round B: SA-1 earns its place only as the LIVENESS escape hatch (policy server gone → Mum exits after N days). As "inheritance" it is a second hero flow, which is scope creep. I'll argue it that way.

Q4 / W4: honest answer: none of the four agents has a real human seed. Whatever we say would be researched, not lived. Mine would be "the 68-year-old mother in Medellín whose son sends dollars from Lisbon", which is a constructed persona. The Chairman should ask the TEAM whether someone has a parent or relative who was targeted. That's [U] and is the single most valuable input we lack.

=== S2 LOOP ===
Q5: DONE before the decision.
- The spike cleared a 3-firm cycle with one self-payment: tx fce43284…40c9. A held CIOU 40, B held AIOU 40 and C held BIOU 40, so every edge fell by exactly 60, atomically, with one signature. [V spike (b)]
- Horizon's strictSendPaths discovered the cycle path [BIOU] by itself. [V spike]
- Path-length cap untested; 4–6 party loops untested. [A]

Q6: largely CONCEDED.
- No named first cluster or partner. Privacy is unsolved in the MVP, and that is exactly why SettleZK/zkNexus exist.
- Within a single platform, a database does AJPES-style netting fine. Stellar's value appears only ACROSS platforms and borders, where no shared operator exists. [A] I have no number for the cost of a central operator.
- Platform-mediated GTM (B2B ordering/invoicing platform for restaurant-supplier clusters) is plausible but [S].
- So Loop keeps Track Alignment and Innovation at 5 but scores ~2 on User Value and Market & Ecosystem Potential. It is a high-variance pick, not the safe one.

=== S6 STAMP ===
Q7: CONCEDED.
- With stock x402 the bond lands in a G-account, so it is either (c) custodial in our server or (b) a non-x402 direct escrow.bond() call. Either way "neither party can override" and "x402-native" can't both hold.
- Honest best design: (b) a plain Soroban escrow call. That drops x402, and with it most of the Composed story.
Q8: CONCEDED, there is no forcing function. Worse for originality:
- LinkedIn already runs the core mechanic at scale. InMail credits are refunded when the recipient responds within 90 days. [V https://www.linkedin.com/help/linkedin/answer/57013]
- So the mechanism is proven but already exists in web2, and a centralised platform does it fine.
- The only plausible gated channel is a maintainer gate for agent-opened issues/PRs on GitHub, which is [S].
- My Round B position will most likely be to ABANDON Stamp.

My ranking after this round: S1 (re-pitched as 2-of-3 policy co-sign + claimant-guardian) > S2 Loop (high variance) > S6 (likely abandoned). Your follow-up is welcome.
```

---
## [13:16 WET] SENT, from Ruthless Judge to Wildcard Inventor (a478580ad9cad690f), follow-up 1/1

```text
Judge follow-up to the Wildcard Inventor (my last message this round): your concessions are honest, and the S1 re-pitch is stronger but has opened a new hole.

1. The claimant-guardian undo breaks your core promise.
   - If the guardian is a CLAIMANT on the pending CB, then "undo" means the money lands in the guardian's (or a "safe-keeping") account. That IS spending power: the daughter now holds Mum's €900 [A, from CB semantics].
   - "Can undo, can never spend" is gone, and a scammer who compromises the guardian's phone now has a path to the money.
   - "Mum reclaims herself" fails in the exact scenario: the manipulated victim won't undo.
   - Proposed fix: the guardian taps Undo, and the POLICY key (weight 1 ≥ low 1) signs a Mum-sourced ClaimClaimableBalance. Funds go back to Mum, the guardian has zero keys on her account, and only the claim window is protocol-side.
   - Cost: undo depends on our server being alive, and it consumes Mum's sequence number. That's fine now that SA-1 is only a liveness hatch, and it keys off server death anyway.
   - QUESTION A: Do you accept that design? If not, show me a claimant-guardian variant where the guardian never custodies the funds.
2. "Why Stellar, not Casa/a bank?" now needs one deck sentence.
   - A server co-signing every payment is a well-known pattern (2-of-3 collaborative custody), so Innovation drops from 4 to about 3.5.
   - What's left that's Stellar-unique is "the stranger's payment is a native claimable balance whose 24h window and pull-back are enforced by validators, without a smart contract". That's narrower than the original pitch.
   - QUESTION B: Write the exact one-sentence "only on Stellar" line for the video, and confirm the demo still has two network-refusal moments: Mum's key alone in LOBSTR → op_bad_auth, and an early claim → op_cannot_claim.
3. Build budget.
   - You've added a backend that holds a key (allowlist, CB builder, alert stream), plus 3-key onboarding.
   - QUESTION C: Give an hour-by-hour estimate for 3 devs, with a cut-line. If it exceeds ~14h before polish, say so.
4. Pick one for Round B.
   - My rescore: S1 re-pitched ≈ 74 (UV 3.5, Inn 3.5, TA 4.5) and S2 Loop after the spike ≈ 74.5 (TE up to 4.5, UV/MEP about 2 by your own estimate). They are now TIED on numbers.
   - The official priority order puts Adoption first, which favours S1. Elliot's "off-the-wall" taste and Track Alignment favour Loop.
   - QUESTION D: If the team could build only one, which do you back, and what single fact would flip you?

Agreed: Stamp is abandoned, and the human-seed question goes to the team via the Chairman. I'll flag it as the highest-value unknown.
```

---
## Judge's Round A scorecard (provisional, before the follow-up replies)

| ID | Before (05) | After Round A | Direction | Why |
|---|---|---|---|---|
| S1 Second Thought (re-pitched: 2-of-3 policy co-signer) | 80.5 | ~74 | ↓ | "Protocol-enforced" was false as pitched (conceded). The fix adds a key-holding server, which is a known collaborative-custody pattern. The US elder user is replaced by remittance receivers (MoneyGram Colombia), which is an unverified channel. The claimant-guardian undo creates guardian custody (follow-up pending). |
| S2 Loop | 79 | ~74.5 | ↓ UV / ↑ TE | Mechanics now VERIFIED on testnet (tx fce43284…). User value and market potential are about 2 by the proposer's own estimate: no first cluster, and privacy unsolved. |
| S3 Heirloom | 74.5 | ~72.5 | ↓ | Mechanism VERIFIED (tx 3932dad7…). User count unknown (conceded). "Crypto inheritance" pitch is familiar (conceded). Best kept as S1's liveness hatch, not a hero flow. Guardian BumpSequence kills or resets the will (VERIFIED). |
| S4 FairSeat | 67 | ~58 | ↓↓ abandon | Account-sale scalping can't be stopped (conceded). The thin cut product. The proposer will abandon it. |
| S5 PrizeLock | 69.5 | ~63 | ↓↓ abandon | The cure doesn't fit the cited pain (conceded). An off-chain co-signed "drawer transaction" can't be detected, which kills the badge (conceded). No fold. |
| S6 Stamp | 65 | ~55 | ↓↓ abandon | x402 `payTo` must be a G-account, so the bond can't land in the escrow contract (conceded). There is no forcing function. LinkedIn InMail refunds already implement the mechanic. |

---
## [13:17 WET] SENT, from Ruthless Judge to Chairman (main): Round A summary

The text matches the scorecard above. It recommends S1 (re-pitched) vs S2 Loop, essentially tied at about 74; abandoning S4, S5 and S6; and that the Guardian merge survives only as a liveness hatch. It asks the human team for a real human seed as the tie-breaker.

---
## [13:17 WET] RECEIVED, from Stellar Architect (afa57e164c5df066c) to Ruthless Judge

```text
Stellar Architect's answers to the Judge's follow-up. There is new spike evidence for Q1 and real numbers for Q3.

Q1 (clock conflict): SOLVED natively [Verified spike e, testnet 13:16 UTC].
- Your premise "ClaimClaimableBalance must be sourced by the claimant" is true at the OPERATION level, not the transaction level.
- Construction: tx source = the guardian's own account, op source = the parent, signed only by the guardian key (which is a weight-1 signer on the parent ≥ low).
- Result: the undo succeeded, tx 02e300ef…409b.
  - Parent XLM 9949.99997 → 9999.99997: funds went back to the PARENT, not the guardian.
  - Parent `sequence` 23116029383147522 → unchanged.
  - Parent `sequence_time` 1792934197 → unchanged.
- CAP-21 updates seqTime only for the TX source account (and BumpSequence op sources) [Verified CAP-21 text + this spike].
- So guardian undos do NOT re-arm the recovery clock, and the parent pays no fee for them (the guardian's account does).
- The same construction with a Payment op (op src = parent, guardian sig) → op_bad_auth, so it gives no spending power [Verified, same spike].
- The guardian could still deliberately make the parent the tx source (e.g. a BumpSequence) to reset or kill the will. That only harms the guardian's own recovery claim. Disclosed.
- Two-stage will also VERIFIED [spike d, 13:15 UTC]:
  - stage 2 submitted before stage 1 → tx_bad_seq;
  - stage 1 after 17s silence → OK (3eefd5f8…73a8);
  - the heir at LOW weight tries a Payment → op_bad_auth;
  - stage 2 immediately after stage 1 → tx_bad_minseq_age_or_gap (the grace clock starts automatically at stage 1);
  - stage 2 after 17s → OK (d5b4dd19…4485);
  - heir Payment → OK.

Q2 (can Mum bypass the window from another wallet?):
- There is no PURE classic configuration that lets Mum alone pay known payees instantly but not new payees. Thresholds are per operation type, not per destination: Payment, PathPayment and CreateClaimableBalance are all MEDIUM [Verified, list-of-operations].
- So "Mum alone instant to anyone she likes" and "Mum alone cannot bypass" are mutually exclusive natively.
- Two honest designs:
  (A) Mum weight 2 = medium. The protocol guarantees: the guardian can always pull back a PENDING CB, and the guardian can never spend. The window is our wallet's default and can be bypassed if Mum signs elsewhere.
  (B) "Policy co-signer" (the Wildcard has now adopted this). Mum 1, policy key (our server) 1, recovery/guardian key 1; medium 2.
    - Mum alone from LOBSTR/Freighter → op_bad_auth [Verified by the analogue in spike a].
    - The policy key co-signs instantly for allowlisted payees, and only CreateClaimableBalance-with-undo for new payees.
    - The policy key alone can't spend.
    - This is Casa-style collaborative custody: protocol-enforced "no single key moves funds", app-enforced payee rules.
- My recommendation is (B), with the honest wording: "every outgoing payment needs 2 of 3 keys; our co-signer only ever signs safe payments". The cost is one backend signer service we control (not third-party), which is under your dependency cap.
- OZ Smart Account policies could make the payee rule fully on-chain, but that means C-accounts, and C-accounts can't be CB claimants. Not in 20h.

Q3 (numbers) [Verified, Stellar Expert API, observed 2026-10-25 13:17 UTC, https://api.stellar.expert/explorer/public/asset/USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN-1]:
- mainnet Circle USDC trustlines total 2,498,538;
- "funded" (non-zero balance) 718,599;
- 122.3M payments all-time.
I don't have the "≥100 USDC + active in 30 days" cut [Unknown]. But ~719k G-accounts hold USDC on Stellar today, and every one of them is a self-custodied (or wallet-custodied) account this mechanism applies to. Caveat [Assumption]: some are exchange or anchor hot accounts, so the real user count is lower.
```

**Judge note, correcting my Round A summary.**
- My W3 (the clock conflict) is RESOLVED natively by the op-source construction (tx source = guardian, op source = parent), verified by spike e.
- The two-stage will is verified too (spike d).
- The Guardian merge no longer has a correctness hole. What remains against it is scope (two hero flows), not correctness.
- New residual risk in design (B): if the guardian holds the weight-1 "recovery" key, then guardian + policy key = 2 ≥ medium, so the guardian and our server together can spend Mum's money. The server must refuse every guardian-initiated spend, and that is app-enforced only.
- Cleaner design: the guardian holds NO weight on Mum's account. Undo is done by the policy key using the op-source construction, and the recovery key stays offline.
- USDC-funded G-accounts on mainnet: about 719k (Stellar Expert API) [V]. That is a real addressable base for S1 and S3 as a wallet feature. MEP goes up by about 0.5 for each.

---
## [13:18 WET] SENT, from Ruthless Judge to Chairman (main): correction

The Guardian merge correctness hole is fixed (spikes d and e), so only the scope objection remains. About 719k mainnet USDC-funded G-accounts [V]. The residual 2-of-3 risk (guardian + policy key can spend) is fixed by giving the guardian no weight. Revised scores: S1 ≈ 76, S2 ≈ 74.5, S3 ≈ 73. Lean: S1, conditional on the human seed and the remittance channel.

---
## [13:18 WET] RECEIVED, from Wildcard Inventor (a478580ad9cad690f) to Ruthless Judge

```text
Wildcard Inventor's answers to the Judge's follow-up A–D: I concede the claimant regression, adopt the Architect's spike-verified fix (better than your policy-key undo), give the build plan, and back S1 with an explicit flip condition.

Labels: [V] = verified (link or the Architect's spike tx), [A] = assumption, [S] = speculation, [U] = unknown dependency.

A. CONCEDED: the claimant-guardian was a regression, and the Architect flagged it too.
   I adopt the Architect's spike-e construction instead of your policy-key undo:
   - The guardian stays a weight-1 signer on Mum's account.
   - Undo = tx source = guardian's own account, op source = Mum, ClaimClaimableBalance.
   - VERIFIED, tx 02e300ef…409b: funds returned to MUM, and Mum's sequence and sequence_time were UNCHANGED. A Payment with the same construction → op_bad_auth.
   Why this beats your variant:
   - Undo does NOT depend on our server being alive.
   - It doesn't consume Mum's sequence.
   - The guardian never holds funds.
   Final table [A until one integrated spike, about 15 min]:
   - Signers: Mum 1 / Policy server 1 / Guardian 1. Thresholds: low 1, medium 2, high 2.
   - Disclosed residual risks:
     - Guardian + policy server = 2 could co-sign a payment. The policy server refuses guardian-initiated payments, but a compromise of both is a real 2-of-3 risk.
     - The guardian can bump Mum's seq, which hurts only her own recovery claim.
   - Server liveness: Mum + guardian = 2 overrides it. No separate recovery key needed.
   - SA-1 survives only as a liveness/incapacity hatch. It is not a hero flow.

B. "Only on Stellar" line for the video:
   "On Stellar, a payment to a stranger can be a native claimable balance: for 24 hours the network itself refuses the stranger's claim and lets the family pull the money back, with no smart contract, no custodian, and no single key that can move Mum's savings."
   Both refusal moments are confirmed, with a third bonus:
   (1) Mum's key alone in another wallet → op_bad_auth. [V by construction: spike a showed a weight-1 key alone fails Payment against medium 2. Needs a re-run with the final table]
   (2) The stranger's early claim → op_cannot_claim. [V spike a, 0b12600f]
   (3) Bonus: the guardian tries to pay herself → op_bad_auth. [V spike e]
   I accept Innovation ≈ 3.5; 2-of-3 co-signing is known. What's novel is the native undo window and the "can undo, never spend" guardian.

C. Build plan for 3 devs. All classic SDK; no Rust needed.

   Hard rule: use a self-issued demo "USDC" test asset (or XLM). The Circle faucet is captcha-only, per the Judge's trap list.

   | Dev | Work | Hours |
   |---|---|---|
   | Dev 1 | Policy service (Node, tiny): POST /cosign validates the tx (Payment only to allowlisted dest; CreateClaimableBalance must carry the 24h predicate) and signs. Allowlist plus 24h cooling (JSON/SQLite). Horizon stream → guardian alert (polling OK). | 0–5h |
   | Dev 1 | Integrated spike of the final table, then hardening | 5–7h |
   | Dev 2 | Onboarding: in-app keypairs, friendbot, setOptions with 3 signers, demo-asset trustline | 0–4h |
   | Dev 2 | Mum view: send flow (known = instant, new = 24h CB), pending list with countdown | 4–9h |
   | Dev 3 | Guardian view: alerts, Undo using the spike-e construction | 0–4h |
   | Dev 3 | Stranger view: claim with countdown and refusal shown; "other wallet" simulator (raw-tx page) to show op_bad_auth | 4–7h |
   | Dev 3 | Role switcher | 7–8h |
   | All | Integration and bugfixing | 9–12h |
   | All | Polish, README, hosted URL, deck, video | 12–16h |

   Before polish this is ~12h wall-clock, which is within your 14h.
   Cut-line, in this order: SA-1 hatch → sponsored reserves (use friendbot XLM) → SEP-1 merchant allowlist → push alerts (use polling).
   Never cut: 3-signer setup, known = instant, new = CB, early-claim refusal, other-wallet refusal, guardian undo.

D. I back S1 (Second Thought / Guardian, re-pitched).
   - Adoption comes first in the official order. Judges must test it, and the "mom" comprehension test plus testability favour S1.
   - Loop's comprehension cost and its UV/MEP of ~2 (my own concession) are hard to overcome in 3 minutes.
   New supporting number from the Architect [V, Stellar Expert API 13:17 UTC]: mainnet Circle USDC on Stellar has 2,498,538 trustlines and 718,599 funded accounts. So a real self-custody USDC user base exists on Stellar, even if not age-segmented.
   Single fact that would flip me to Loop: if a quick check shows the realistic distribution channels (MoneyGram/Crossmint, Beans, the main wallets) hold users' USDC in C-address smart wallets. Claimable balances can't target those, so S1's adoption story would collapse to "a new consumer wallet", and Loop's Track/Innovation edge would win.
   A second flipper: the team producing a REAL human seed for Loop, e.g. a family business stuck in circular late payments, and none for S1.
```

---
## [13:19 WET] RECEIVED, from Chairman (main) to Ruthless Judge (summary; the full text is in the Chairman log)

The human team can reach BOTH a scam-targeted relative (S1) AND a group of small businesses that owe each other money (S2). The seed is NEUTRAL; decide on the merits. No fabricated testimonials: personas are labelled illustrative and real quotes are collected through calls today. "Real human seed available" = Assumption for both.

---
## [13:19 WET] SENT, from Ruthless Judge to Wildcard Inventor, Stellar Architect and Problem Hunter (identical relay)

```text
Judge relay of a Chairman ruling, plus one new piece of evidence (information only, not a new challenge).

1. CHAIRMAN RULING on the human seed:
   - The human team can reach BOTH a relative who was targeted by an impostor scam (S1) AND a group of small businesses that owe each other money (S2). So the seed is NEUTRAL; decide on the merits.
   - Committee rule: NO fabricated testimonials. Personas like "Maria, 72" must be labelled illustrative. Real quotes will be collected through short calls today.
   - Treat "real human seed available" as an Assumption for both S1 and S2, not as Verified.

2. NEW EVIDENCE on the Wildcard's own flip condition for S1 (C-address channels):
   - MoneyGram's Colombia app delivers USDC "to a Crossmint-powered smart wallet within the recipient's MoneyGram app". Users log in by email with "no passphrases or gas fees" [V https://crossmint.com/case-study/powering-moneygrams-stablecoin-app , https://thefintechtimes.com/moneygram-partners-with-crossmint-to-launch-stablecoin-powered-cross-border-payments/].
   - Wording aside, its funds come from a custodial treasury wallet that MoneyGram calls via Crossmint's API.
   - Whether the recipient wallet is a Soroban C-address is NOT stated [U]. "Smart wallet + email login + no gas" points to a contract account or an embedded/custodial wallet [A]. Either way it is not a G-account that a third-party policy co-signer could be added to.
   - Judge's read: MoneyGram is NOT a drop-in channel for S1. The flip condition is PARTIALLY triggered.
   - S1's channel falls back to classic-G-account wallets. LOBSTR is the obvious one (G-accounts [A]); Beans/Vibrant are [U]. The ~719k funded USDC G-accounts (Stellar Expert [V]) are the addressable base.
   - Pitch adjustment for S1: "a feature any G-account wallet (LOBSTR-class) can ship", not "MoneyGram's app".

Round B is next. I'll weigh this in my final position.
```

---
## Judge's final Round A position (after all replies)

| ID | Final Round A score | Note |
|---|---|---|
| S1 Second Thought re-pitched: 2-of-3 policy co-signer, guardian undo with the guardian's account as tx source, CAP-21 liveness hatch | **~75** | All three refusal moments verified or verifiable. About 12h build plus polish, no Rust. MoneyGram is not a drop-in channel, so it ships as a feature for G-account wallets (base about 719k [V]). Residual: guardian + server is a 2-of-3 collusion risk, disclosed. Innovation about 3.5. |
| S2 Loop | **~74.5** | Mechanism verified (tx fce43284…). Track Alignment and Innovation at 5. User Value and Market Potential about 2 by the proposer's own estimate; privacy unsolved; high comprehension cost. |
| S3 Heirloom standalone | ~73 | Better as S1's liveness hatch. |
| S4, S5, S6 | abandon | Conceded by their proposers. |

**Lean:** S1, by a hair, because Adoption comes first in the official order and judges test it as users. Loop stays the legitimate high-variance alternative. If S1 is chosen, the deck must not claim "protocol-enforced" for the payee rules; only the claim window and "no single key moves funds" are protocol-enforced.
