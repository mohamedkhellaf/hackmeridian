# 06: Debate Round A log (Problem Hunter)

Times are in WET (= UTC). Every message is copied verbatim.

---

## [~13:09] SENT → Wildcard Inventor (a478580ad9cad690f): attacks on S1, S2, S6

ROUND A ATTACK from the Problem Hunter on S1 Second Thought, S2 Loop and S6 Stamp. Please answer point by point. I ranked S1 #1 myself, so I'm going hardest on it.

== S1 SECOND THOUGHT ==
1. Wrong money location. [Verified] The FTC says older adults lose crypto mainly through BITCOIN ATMs: 60+ were more than 3x as likely to report a BTM loss, more than 2 of every 3 dollars lost at BTMs were lost by older adults, ~86% of those losses were government impersonation/tech-support scams, median loss $10k, $65M in H1 2024 (https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2024/08/bitcoin-atms-payment-portal-scammers). [Verified] The bulk of IC3's $9.3B in crypto losses is investment/pig-butchering ($5.8B) (https://www.theblock.co/post/351746/). In both cases the victim's money starts in a BANK, gets converted at a BTM or exchange, and goes straight to the scammer. It never sits in a self-custody stablecoin wallet that a guardian could set up.
   Q: Who is the real 72-year-old holding USDC in a classic Stellar G-account today? Name one segment with even one data point. [My Assumption: there are approximately zero in the EU/US. Possible exception: remittance receivers in PH/AR/NG using LOBSTR/Vibrant/Beans, but those are younger.]
2. Who installs first, and why would they move savings? The adult child must convince Mum to move money OUT of a bank (which in the UK now reimburses APP fraud up to £85k [Verified, your own source]) INTO an irreversible crypto wallet so it gets a 24h undo. That's a downgrade from her bank, not an upgrade.
   Q: What's the switch story versus "keep it in the bank"?
3. "Protocol-enforced" is only half true. The 24h window exists only because YOUR APP builds a CreateClaimableBalance. Mum's key alone meets the Medium threshold (weight 2 ≥ 2), so a plain Payment op signed in ANY wallet bypasses the window entirely. The scammer script is literally "install LOBSTR, import your secret key, send." [Verified mechanics, Stellar thresholds: Payment = Medium.]
   Q: How do you stop that without making the guardian a co-signer on every payment, which is custody-like friction?
4. The guardian can be removed. Your table has High threshold = 2 and parent weight = 2, so Mum (coached by the scammer) can SetOptions to remove the guardian or change thresholds alone. A fix exists: parent 2 / guardian 1 / low 1 / med 2 / high 3.
   Q: Do you adopt it? And then how does Mum recover if the guardian loses their key?
5. Scammer adaptation. [Verified pattern] Pig butchering runs over weeks. The scammer says "it takes 24h, that's normal for international transfers, don't tell your family." [Assumption: in many cases the guardian never sees or questions it in time.] The alert only works if the guardian reacts within 24h, every time, for years. Alert fatigue applies, since every new payee triggers an alert.
   Q: Any evidence that cooling-off or delay mechanisms reduce losses? Bank "confirmation of payee" or delayed-payment data would do.
6. Recipient UX: a legitimate new payee (a plumber, a grandchild) waits 24h and must claim with a G-account and a USDC trustline. Who are those recipients?
   Bottom line: I still think the MECHANISM is the best in the room. I'm not convinced the 72-year-old USER exists on Stellar. Can you re-seat it on a user who already holds stablecoins in self-custody, e.g. LATAM/Africa families receiving remittances, or crypto-native parents? Give one evidence point.

== S2 LOOP ==
1. Cold start. A cycle clears only if EVERY firm in it has onboarded, issued an IOU, set trustlines and placed offers. One non-member breaks the loop.
   Q: Name a real cluster (sector + city) where 4+ firms owe each other in a closed cycle, and say who onboards them.
2. Evidence that voluntary mutual-credit networks struggle to circulate:
   - [Verified] Sardex: the network grew but its strongly connected component shrank, i.e. "new nodes … not resulting in reciprocal transactional connectivity" (https://arxiv.org/pdf/2507.02678).
   - [Verified] The WIR currency is in long decline, with deposits down ~11% in 2022 (https://www.finews.ch/news/banken/55750-bank-wir-ergebnis-2022).
   - Slovenia made set-off COMPULSORY precisely because voluntary didn't happen [Assumption on causality].
   Q: Why will voluntary on-chain netting succeed where those failed?
3. Why not the trusted operator? SMEs already trust their accountant, bank or chamber; AJPES is a state agency and it works.
   Q: What's the concrete cost or failure of a centralised netting operator that a public ledger fixes? A slogan doesn't count; a number would.
4. Accounting and legal. Portugal requires certified invoicing software and SAF-T reporting [Assumption, needs check], and set-off of debts needs each party's declaration (compensação) [Assumption]. Issuing a transferable IOU token may create e-money or securities questions [Unknown].
   Q: How does a bakery's accountant book "my IOU was burned by a path payment"?
5. Privacy: every firm's debts become public on-chain. Pseudonymity breaks the moment you know one address.
   Q: Would a real firm accept its payables being public?
6. Judge test: "my mom can use it"? This is B2B with 5 synthetic firms in the demo.
   Q: Who is the single human in the 20-second opening?

== S6 STAMP ==
1. The bypass problem. My email address stays open. Spammers just email me directly for free; Stamp is opt-in for senders.
   Q: Why would ANY sender with my plain address choose to pay? If the answer is "priority lane", show one example of paid-priority inbound working at scale. [Unknown: I could not verify why Earn.com's paid inbox ended; it was acquired by Coinbase around 2018 per your file, UNVERIFIED.]
2. "Earn money from spam" contradicts itself: real spammers won't post bonds, so recipients earn nothing. Only good senders post bonds, and they get refunded.
   Q: In steady state, who pays whom?
3. Two-sided cold start. Recipients need senders who use Stamp, and senders need recipients who require it.
   Q: Which side do you seed first, and with what?
4. The x402 payTo flaw the Architect raised. Q: what's your fix?

Please reply directly to me. I'll log everything verbatim.

---

## [~13:09] SENT → Stellar Architect (afa57e164c5df066c): attacks on S3, S4

ROUND A ATTACK from the Problem Hunter on S3 Heirloom and S4 FairSeat. Please answer point by point. (I'll answer your S5 questions in a separate message.)

== S3 HEIRLOOM ==
1. The demand evidence is old and thin. [Verified] The Cremation Institute survey (n=1,150, 2019–20) found 89% of crypto holders worry about what happens after death and only 23% have a documented plan (https://cointelegraph.com/news/study-89-worry-what-happens-to-their-crypto-after-they-die). But worry isn't action: 77% have NO plan even though seed-phrase-in-a-safe and lawyer letters cost nothing.
   Q: Why does a free, simpler alternative fail, and why would Heirloom succeed where "write it down" fails?
2. Where the money is. [Assumption] Most retail crypto, and most Stellar retail value, sits on custodial exchanges, which already run deceased-user claim processes [Assumption, Coinbase-style estate process]. Your target is the subset of self-custodial Stellar G-account holders with meaningful balances.
   Q: How many is that? Give any number: LOBSTR MAU, the count of accounts with more than $1k USDC, anything.
3. The HODLer paradox. The users with the most to lose are long-term holders who DON'T transact. To avoid false triggers they need a window of 1–2 years, and then the heir waits up to 2 years after death. With a short window, Mum on a 6-month hospital stay hands the heir FULL control (signer weight ≥ high).
   Q: What window do you recommend, and isn't the "heartbeat" (a BumpSequence) exactly the check-in burden you claim to remove?
4. You moved the secret, you didn't remove it. The heir must keep a pre-signed XDR safe for years. Lose it and you're back to square one; leak it and anyone can submit it once the window passes. (The heir key is still needed after it fires, but whoever submits the XDR makes the heir a signer, so the risk sits with the heir's key.)
   Q: Why is "store this XDR for 5 years" easier than "store this seed for 5 years"?
5. Legal. Portugal, France and Spain have forced heirship (legítima / réserve héréditaire) [Assumption]. Handing one person full signing control outside probate can be challenged, and the heir may face tax or reporting issues.
   Q: Do you frame it as "access recovery" rather than "inheritance"? Which one goes in the pitch?
6. Twin and prior art. Obol and Boreal Pulse exist (your own find), and "crypto inheritance" is a classic AI suggestion.
   Q: Beyond "no contract", what will a non-technical judge see as new?
7. Who installs first? A wallet feature (LOBSTR/Freighter) is the realistic channel, not a standalone app.
   Q: Did you check whether any Stellar wallet already offers recovery or inheritance? Smart-account recovery in the OZ kit counts.

== S4 FAIRSEAT ==
1. Demand mismatch. Scalping hurts mega-demand events (stadium tours) controlled by Ticketmaster/Live Nation-type primaries. Your target, the indie or mid-size Lisbon venue, rarely sells out at 3–10x [Assumption].
   Q: Name the indie venue segment that actually suffers resale markups, with any data.
2. Regulation and incumbents are already moving. [Verified] UK King's Speech, 13 May 2026: a draft Ticket Tout Ban Bill would make resale above face value illegal, with platforms obliged to enforce and fines up to 10% of turnover (https://www.rpclegal.com/snapshots/consumer/spring-2026/uk-government-to-introduce-new-rules-banning-ticket-touting/). [Assumption, not verified this session] Platforms such as Ticketmaster (Face Value Exchange) and DICE already offer face-value resale.
   Q: Once face-value resale is law and a platform feature, what does a protocol-level cap add for a venue?
3. Fan onboarding. To buy a €30 ticket, a fan needs a Stellar account, XLM reserve, a ticket trustline, a USDC trustline AND USDC. Versus Apple Pay. Sponsored reserves help with XLM, but USDC acquisition remains.
   Q: What does the fan's first purchase look like, click by click? Is there a card on-ramp in the demo?
4. The key-sale bypass. A scalper sells the WALLET (secret key / account) holding the ticket, so the asset never moves and the auth flags never trigger. That's the same as selling a ticketing-app login, which already happens [Assumption].
   Q: How do you stop account sales? ID check at the door defeats the point of a wallet.
5. Venue adoption. Venues sign multi-year exclusive ticketing contracts that often include advances [Assumption].
   Q: Who signs first, and why switch from a provider that handles payments, VAT, refunds and support?
6. Twin risk. Ticketing is among the most AI-suggested hackathon ideas, with 6+ prior Stellar ticketing builds (your own list).
   Q: In 10 seconds, how does a judge tell yours apart from "another NFT ticket"?

Please reply directly to me. I'll log everything verbatim.

---

## [~13:08] RECEIVED ← Stellar Architect (afa57e164c5df066c): attack on S5 PrizeLock

ROUND A ATTACK from the Stellar Architect on S5 PrizeLock (improved native form: multisig pool account + pre-signed time-locked refund + claimable-balance payouts).

1. [Verified, protocol] A pre-signed refund tx has FIXED operations and amounts. At creation time you don't know the registered teams, the final pool size (sponsor top-ups), or each team's address. Q: when exactly is the refund pre-signed? If it's after registration closes, the window before then is unprotected (the organizer can still drain with the referee). If it's re-signed after every top-up or registration, the organizer can simply refuse to re-sign. What protects teams during registration?
2. [Verified, protocol] Mutual exclusion via sequence numbers (payout and refund share seqNum S+1) works. But the organizer + referee (2-of-2) can at any time sign ANY tx: pay themselves, bump the seq to kill the refund, or merge the account. So the guarantee is "trust the referee", exactly like a bank escrow with a co-signer. Q: who is the referee in reality, and why isn't this just a 2-of-2 joint account any chain (or bank) offers? Where is the "used to not be possible on Stellar" moment?
3. [Verified, docs] CB payouts: claimants must hold an AUTHORIZED trustline for USDC at CLAIM time (creation doesn't need it). The Judge's ranking says "winners never need a pre-existing trustline". That's only half true: they need one before claiming. Each CB also locks 0.5 XLM base reserve per claimant from the pool account. Q: how do players in Kenya/Mongolia get XLM plus a USDC trustline? Sponsored reserves from the pool account?
4. [Assumption] Pro-rata refund to "registered teams" = N Payment ops in one tx (max 100 ops per tx). Every team must have a trustline, or the refund tx fails ATOMICALLY: one missing or deleted trustline (a griefing team removes it) blocks everyone's refund. Q: use CBs in the refund too, which avoids op_no_trust? Then the refund tx creates N CBs, which needs N×0.5 XLM reserve in the pool. Is that budgeted?
5. [Verified, CAP-21] minSeqAge vs minTime: for "results not posted by the deadline", the right precondition is timebounds.minTime = deadline (absolute), not minSeqAge. Sponsor top-ups are payments TO the pool and don't touch its seq. But ANY tx sourced by the pool (e.g. creating a CB, a settings change) resets seqTime and also consumes seq numbers, which invalidates a refund pre-signed at seq S+1. Q: how do you keep the pool's seq frozen between pre-signing and the deadline, while still letting the organizer do anything with the account?
6. User value: the YaLLa failure was "organizer never had the money". Q: will TOs actually pre-fund? Your own "biggest uncertainty". What evidence do you have that even one TO would lock funds up front? A partial-lock badge weakens the story.
7. Judges can test it? The flow needs an organizer, a referee and 3+ team accounts. Q: a one-click demo scenario with in-app keypairs?
8. Track: with the native form this is classic multisig + timebounds + CBs. That's credible "old-school primitives", but each primitive is used in its textbook way. Q: what is the single "only on Stellar" moment for the video?

Please answer point by point. Concrete operations please.

---

## [~13:10] SENT → Stellar Architect (afa57e164c5df066c): S5 defence

Problem Hunter's reply on S5 PrizeLock, point by point. Several of your hits land, and I concede them explicitly.

1. CONCEDED for the pure pre-signed form. A pre-signed refund can't cover a dynamic team list or a growing pool.
   - My answer: lock at registration close. The pool account is created and pre-signed once the team list is frozen. Before that, the badge honestly reads "not yet locked".
   - Why that window is the one that matters: the documented failures are POST-event non-payment, not pre-event drains. GXR missed its own 180-day payout deadline [Verified, jamesfudge substack]. YaLLa owed prizes from tournaments already played [Verified, esports.gg].
   - The cleaner answer, which I'll probably bring in Round B, is a small Soroban rules contract. Dynamic registrant list, pull-based claims, no pre-signing at all.

2. CONCEDED. Native 2-of-2 = trust the referee, i.e. a joint account.
   - Native mitigation only: the referee is a neutral third key (a league, the game's community admin, or the platform itself) with thresholds requiring 2-of-3. Still trust.
   - The real "can't steal" guarantee needs a contract: organizer plus referee may only submit a RANKING (a permutation of registered teams), never a destination address. Payouts are computed from the split fixed at lock time. That is "they cannot pay themselves", which a bank joint account can't express.
   - So the native-only form fails your "used to not be possible" test, and I won't pretend otherwise.

3. AGREED, and it's solvable.
   - Each winner needs an authorized USDC trustline at claim time [Verified, your point].
   - Plan: the pool sponsors reserves. One tx: BeginSponsoringFutureReserves (pool) → CreateAccount(player) → ChangeTrust(USDC, source = player) → EndSponsoring(source = player), co-signed by the pool and the player's in-browser keypair. Then the player claims the claimable balance (CB).
   - Budget per player is ~1 XLM account + 0.5 XLM trustline + 0.5 XLM per CB. Trivial on testnet and cents on mainnet [Assumption on XLM price].

4. AGREED. Push refunds are griefable via trustline removal, and the whole tx fails atomically.
   - Fix: the refund also creates CBs, which need no trustline at creation [Verified, your point 3]. Budget N×0.5 XLM from the pool; 16 teams = 8 XLM, budgeted.
   - Max 100 ops per tx caps it at ~100 teams. Fine for an MVP.
   - In the contract version, refunds are pull-based (each team claims its share) and griefing disappears.

5. AGREED on minTime.
   - Refund preconditions: timebounds.minTime = deadline (absolute), at seq S+1.
   - The final payout tx also uses seq S+1, so whichever lands first invalidates the other. That's mutual exclusion via the sequence number.
   - Freezing the seq: the pool is a DEDICATED single-purpose account (master weight 0) and is never used for anything else. Sponsor top-ups are inbound payments and don't touch seq [Verified, your point].
   - Payout CB creation is itself the S+1 tx, so no extra tx is needed.
   - Any 2-of-2 SetOptions or other tx would invalidate the refund, but that's publicly visible. A watcher shows "Refund guarantee VOID" on the badge in real time. That's transparency, not prevention; I concede the difference.

6. Evidence TOs will pre-fund:
   - [Verified] A law-firm overview says some jurisdictions already require organizers to POST BONDS TO GUARANTEE PRIZE PAYMENT, and recommends separating prize money into escrow (https://www.daeryunlaw.com/us/insights/esports-action-in-new-york).
   - [Assumption] US game-promotion laws, e.g. Florida's, require a bond or trust for prizes above a threshold; this is recalled, UNVERIFIED this session.
   - So pre-funding is already an expected practice in places. PrizeLock makes it a public, cheap badge instead of a legal bond.
   - [Speculation] Newer TOs with no reputation have the strongest incentive. Teams pick tournaments, and a locked badge is a differentiator.
   - Honest gap: I have no quote from a real TO. That's the Round B risk.

7. YES to a one-click demo. A "Simulate tournament" button generates organizer, referee and 4 team keypairs in-browser, funds them via friendbot, seeds testnet USDC, and walks lock → results → payout, or deadline → refund. Each role is in a tab, and no Freighter is required. Freighter stays optional for the organizer.

8. Only-on-Stellar moment, native form: "two pre-signed futures, only one can happen."
   - The network rejects the refund before the deadline (tx_too_early).
   - Once the payout lands, the refund is dead forever (tx_bad_seq).
   - Winners without wallets still get paid via claimable balances.
   - I agree these are textbook primitives used textbook-style, so TA is ~3/5 at best. My honest read: PrizeLock's strength is User Value (the best-documented pain in the room), not Track Alignment. It needs either a sharper native twist or a composed real-world rail (anchor cash-out to Kenya/Brazil via the SDF test anchor) to compete.

Counter-question for you: in your view, would a minimal Soroban "ranking-only" payout contract with pull-based claims (no destination addresses, only a permutation of registrants) count as the "Unlocked" depth judges want, or is it still "just escrow" (0/34 winners)?

---

## [~13:11] RECEIVED ← Ruthless Judge (ac72ecdbce496fda1): attack on S5 PrizeLock

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

---

## [~13:14] SENT → Ruthless Judge (ac72ecdbce496fda1): S5 defence

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

---

## [~13:13] SENT → Chairman (main): Round A summary
(Summary of the above: attacks sent to the Wildcard (S1/S2/S6) and the Architect (S3/S4). S5 defended against the Architect and the Judge, with concessions on TA 3/5, the collusion residual, and W1 money-never-existed. Leaning: fold PrizeLock's seed into another concept. S1 needs its user re-seated on existing self-custody stablecoin holders.)

---

## [~13:14] RECEIVED ← Ruthless Judge (ac72ecdbce496fda1): follow-up on S5

Judge follow-up on S5 PrizeLock (my last message to you this round): your answers were honest and your design is correct; two holes remain.

1. The badge certifies less than it claims, and the gap is invisible.
   - The TO chooses REF. A sock-puppet REF makes the 2-of-2 equivalent to TO-alone [A, obvious].
   - Worse, the verifier can check P's signers, balance and seq == S, but it can never see OTHER transactions already co-signed off-chain at seq S+1. That includes, for example, a TO+REF-signed "pay P → TO" kept in a drawer. So the badge cannot rule out a pre-arranged exit, and nobody can detect one [V: signatures are off-chain until submission; sequence semantics per CAP-21 / tx docs].
   - The only fix is an independent REF, i.e. us or the platform. That makes us the trust anchor, which is a custodial escrow service with extra steps.
   - QUESTION A: In the demo, who is REF, and what sentence on the deck answers "what stops the TO picking their cousin as referee"?
2. A fold has to be justified. "Fold the human seed into another concept" is only worth anything if it raises that concept's User Value score with evidence; otherwise it's decoration.
   - QUESTION B: Name the ONE shortlisted concept you'd fold "money promised, never delivered" into, and the concrete demo beat or user that changes. If it doesn't change a beat or a user, say "no fold" and we drop S5 cleanly.

My current read: S5 is down from 69.5 to about 63. Track Alignment is honestly 3, its Problem→Cure fit is broken (W1 conceded), and it adds a residual collusion hole. I credit you for not inventing data. That is exactly the evidence discipline the judges reward.

---

## [~13:14] RECEIVED ← Wildcard Inventor (a478580ad9cad690f): attack on S5

Round A attack from the Wildcard Inventor on S5 PrizeLock (native form): originality, disruptive upgrades, and pointed questions.

ORIGINALITY: would a judge think "seen it"?
- Off-chain, the prize-pool product already exists. Matcherino is a crowdfunding plus prize-payout platform for grassroots esports. It pays out to 120+ countries, had served 4,200+ tournaments and about $2M of prize money by 2018, takes a cut of each pool, and runs Supercell's Brawl Stars matching program. [V https://www.geekwire.com/2018/top-vc-firms-team-liquid-owner-invest-esports-event-management-startup-matcherino/ , https://supercell.com/en/games/brawlstars/blog/esports/matcherino-empowering-grassroots-esports/]
  -> A judge who knows esports says: "Matcherino already escrows and pays prize pools." Your real differentiator must be "the TO cannot run with the money AND anyone can audit it", NOT "prize payouts".
- Web3: crypto tournament platforms exist on other chains (e.g. Community Gaming). [UNVERIFIED: not checked this session]
- Stellar: no direct match per your own Scout search. [V per your file] But "escrow" as a category has 34 builds and 0 winners (Judge §3), and the native redesign is what saves it.
- Verdict: medium "seen it" risk on the problem; low on the native mechanism.

DISRUPTIVE IMPROVEMENTS (pick one; #1 attacks your own biggest uncertainty):
(1) SPONSOR-LOCKED PLEDGES as claimable balances.
  - Your stated risk: TOs don't hold the money upfront because sponsors pay late. So don't ask the TO to pre-fund. Make the SPONSOR lock its pledge at signing.
  - The pledge is a claimable balance with two claimants: the prize-pool account (NOT before event start) and the sponsor (NOT before event end + 30 days).
  - The sponsor can't pull it back before the event, and the pool can't touch it early. The badge reads: "$3,000 locked: $1,000 by TO, $2,000 by Sponsor X (locked on-chain)."
  - This turns "TOs won't lock cash" into "sponsors prove their commitment publicly", and sponsors get a marketing asset (a verifiable pledge).
  - Protocol-native, no contract. [V: claimable-balance predicates https://developers.stellar.org/docs/build/guides/transactions/claimable-balances]
(2) "PAID THE MINUTE YOU'RE ELIMINATED".
  - Each bracket round settles immediately: 9th–16th place get their claimable balances the moment they lose, live on stream.
  - That gives a Twitch-overlay moment ("payout landed" ticker) and a growth loop for TOs. Demo memorable moment: the losing team's phone buzzes with the payout before they leave the stage.
(3) FAN TOP-UPS (Matcherino's best feature, made trustless).
  - Viewers add to the pool, and the overlay shows it growing with an on-chain link.

POINTED QUESTIONS
Q1. Pre-signed refund vs. late registration. The refund tx must name every team's destination when it is SIGNED, but teams register after the pool is created. Who re-signs the refund after registration closes? Is the window before re-signing unprotected?
Q2. Collusion and cancellation. With a 2-of-2 pool (TO + referee), the two can jointly BumpSequence or pay out to themselves, which invalidates the teams' refund. Is the referee really independent? Who appoints them, and what stops a TO from naming their cousin? Is the guarantee then just "2 people must collude" (the same as a bank escrow)?
Q3. Players need G-accounts plus USDC trustlines to claim. What is the 30-second onboarding for a Mongolian or Kenyan player? Sponsored reserves? Which wallet? Which anchor for cash-out, and does it have testnet? [U]
Q4. Who asked for this? Do you have even one TO or player quote saying they would pick a tournament for a "prize locked" badge? YaLLa's $700k proves pain, not demand for this fix.
Q5. Will TOs pay 1–2% when Matcherino already takes a cut and adds crowdfunding and brackets? What does the TO gain except credibility, and is credibility worth it to TOs who are already trusted?
Q6. Prize income often needs KYC or tax reporting for the TO. Does stablecoin payout create a compliance issue that kills TO adoption? [S]
Q7. Hero flow. Lock, register, attest, pay, refund is 5 steps. Which ONE do you show in 90 seconds?

I log all messages verbatim in research/decision/06_debateA_wildcard_inventor.md.

---

## [~13:16] SENT → Ruthless Judge (ac72ecdbce496fda1): follow-up answer

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

---

## [~13:16] SENT → Wildcard Inventor (a478580ad9cad690f): S5 reply

Problem Hunter's reply to the Wildcard on S5 PrizeLock. Short version: your Matcherino point lands, and combined with the Judge's drawer-tx hole, I'm leaning toward abandoning S5 (formal call in Round B).

- Originality. CONCEDED. Matcherino [V, your links] already escrows and pays grassroots prize pools to 120+ countries and runs Supercell's matching program. So "prize payout" is not new. The only differentiator left was "the TO can't run, and anyone can audit". The Judge showed the badge can't prove that: TO+REF can co-sign a "P→TO" tx at the same seq S+1 off-chain, invisible to any verifier. The only fix is an independent referee, i.e. us, i.e. custodial escrow.
- Your improvement (1), sponsor-locked pledges as claimable balances: this is the best idea anyone produced for S5. It directly attacks "TOs don't hold the cash", and it's protocol-native. But the claimant is still the TO+REF pool account, so the drawer hole persists downstream.
  - Your improvement (2), "paid the minute you're eliminated", is a lovely beat. It doesn't fix trust, though.
  - Neither moves Track Alignment above 3.
- Q1, late registration: the refund is signed only after registration closes, and the badge is off before that. CONCEDED: the pre-registration window is unprotected, and re-signing depends on the TO's cooperation.
- Q2, collusion: yes, it's "2 must collude", the same as a bank escrow, and the TO picks the referee. Conceded.
- Q3, onboarding: the pool sponsors reserves. BeginSponsoring → CreateAccount(player) → ChangeTrust(USDC) → EndSponsoring, co-signed by an in-browser keypair. Cash-out via the SDF test anchor only; Kenyan/Mongolian anchor testnet availability is [U].
- Q4, who asked: no TO or player quote. Pain proven, demand for this cure unproven. Conceded.
- Q5, Matcherino's cut vs ours: the TO gains only credibility, which trusted TOs don't need. Weak. Conceded.
- Q6, KYC/tax: [S] probably a TO-side issue regardless of rail. Not decisive, but adds friction.
- Q7, hero flow: it would have been "the network rejects the early refund, then the payout lands and the refund dies forever". Irrelevant if dropped.

Net: S5 has the strongest pain and the weakest cure. Your Matcherino evidence plus the Judge's drawer-tx hole are why I'll recommend abandoning rather than defending it. Still waiting on your answers to my S1/S2/S6 questions. S1's user (who is the 72-year-old holding USDC on Stellar?) is now the most important open question in the room.

---

## [~13:16] RECEIVED ← Stellar Architect (afa57e164c5df066c): reply on S3/S4 + PrizeLock counter-question

Stellar Architect's reply to the Problem Hunter on S3 Heirloom and S4 FairSeat, plus your PrizeLock counter-question.

Spike first [Verified, testnet 13:11–13:12 UTC, hashes in research/decision/06_debateA_stellar_architect.md]:
- The pre-signed SetOptions (seq S+2^32, minSeqNum S, minSeqAge 30s) is rejected early with tx_bad_minseq_age_or_gap.
- An owner payment resets the timer: still rejected 20s later.
- It is accepted 36s after the owner's last activity, fee-bumped by the heir.
- Revocation via bumpSequence gives tx_bad_seq.
The mechanism is real.

== S3 ==
1. Why "write it down" fails. A written seed is a bearer secret with immediate effect: whoever finds it (cleaner, ex-partner, burglar, the heir before your death) takes everything NOW. That is why 77% don't do it: it's a security risk, not laziness [Assumption, reasonable]. Heirloom's artifact is NOT a secret. The will XDR can be published, even on IPFS or in a registry, because submitting it only ever makes the named heir a signer, and only after N days of silence. Leaking it is harmless. This also answers your Q4: the heir stores nothing secret beyond their own key, which they already use.
2. Numbers: CONCEDED, I have none for Stellar self-custody balances [Unknown]. I won't invent one. The better segment is active USDC users (freelancers paid on Stellar, Vibrant/Beans/LOBSTR users), not cold HODLers [Speculation on size].
3. HODLer paradox: PARTLY CONCEDED.
   - For active users the heartbeat is free: any outgoing tx resets it [Verified spike].
   - For cold holders it is a one-tap no-op BumpSequence. That costs 100 stroops and moves no funds, unlike Boreal Pulse, where funds sit in a contract you must ping.
   - Mitigation for the hospital case: a TWO-STAGE will, which I now propose.
     - Stage 1 fires after T1 and adds the heir at LOW weight. This is a public on-chain warning the owner's wallet surfaces, and gives no spending power.
     - Stage 2 has minSeqNum = stage-1 seq and minSeqAge = grace. Stage 1 is itself an owner-sourced tx, so it resets seqTime, which means the grace clock starts automatically when stage 1 lands [Verified by CAP-21 semantics; Assumption until spiked].
     - Any owner activity during the grace period kills the escalation timer.
     - Recommended windows: T1 = 6 months, grace = 30 days, configurable.
4. Answered in 1: the XDR is non-secret and leak-safe.
5. Legal: AGREED. The pitch is "access recovery and continuity" (your backup key or your family regains access), not probate. Forced heirship applies to estates, not to who holds a signing key [Assumption]. The README disclaims legal inheritance.
6. What a non-technical judge sees as new: "your money never moves, you never check in, and the network itself refuses your heir until you've been silent N days". The demo has a countdown that visibly resets when the owner buys a coffee.
7. Wallets: the OZ Smart Account framework (C-accounts) can express recovery through context rules/policies [Verified docs], but I found no shipped inactivity-recovery feature in LOBSTR or Freighter [Unknown, not checked exhaustively]. CONCEDED: distribution is realistically a wallet feature (an SDK plus reference UI). That's the continuation story, SCF to wallets.

== S4 ==
1–2. Largely CONCEDED. Scalping pain concentrates on mega-events, and the UK Ticket Tout Ban plus DICE/Ticketmaster face-value exchanges cover the cap centrally. The only protocol-only remainders are portability (any wallet), surviving organizer bankruptcy (tickets and refunds don't depend on the operator's DB), and royalties enforced on every resale. That's a weak user story.
3. Fan flow: an in-browser keypair (embedded wallet), with sponsored reserves from the organizer: BeginSponsoring, CreateAccount(0), ChangeTrust TICKET, ChangeTrust USDC, EndSponsoring. The USDC acquisition is the honest gap, so the demo would seed USDC. A card on-ramp is not in scope.
4. Key-sale bypass: CONCEDED, it can't be stopped without identity at the door. The same is true of DICE logins, but it defeats "protocol-enforced cap" as a headline.
5–6. CONCEDED. Twin risk is high.
My current lean (final call in Round B): S4 is the weakest of my two. I will likely abandon it, or salvage only the "Old-school assets" auth-flag idea if a better domain appears.

== Your counter-question on PrizeLock ==
- A Soroban ranking-only payout contract (organizer and referee submit a permutation of registrants; pull-based claims; payout addresses fixed at registration) gives a genuinely better trust property: "they can't pay themselves".
- But it is still a contract written in Soroban the way you'd write it in Solidity. Judges' Unlocked = "used to not be possible on Stellar", so I'd score it TA 3/5, not 5 [my judgement].
- To lift it you need Composed: (i) Trustless Work escrow (partner) for the lock, and (ii) SDF testanchor SEP-24 USDC cash-out for winners [Verified live: testanchor /sep24/info shows USDC withdraw enabled, min 1 / max 10].
- That's 2 external dependencies, the maximum the Judge allows. Trustless Work's testnet API and key are still [Unknown].
- My honest read: PrizeLock's best path is as a Composed entry, not Unlocked.

---

## [~13:18] SENT → Stellar Architect (afa57e164c5df066c): follow-up on S3

Problem Hunter's follow-up to the Architect. Your spike and the "will XDR is non-secret and leak-safe" point are strong; that's the best answer I've had all round. I accept it: it reframes my Q1 and Q4 in Heirloom's favour.

I accept your S4 lean (likely abandon) and your PrizeLock read (Composed at best, TA 3). I'm abandoning S5 in Round B.

Three remaining points on S3, two of which matter for the Guardian merge:

1. Low-weight signers create "activity". [Verified op thresholds: BumpSequence and ClaimClaimableBalance are Low.] In your two-stage will, once stage 1 adds the heir at LOW weight, the heir can sign low-threshold ops on the owner's account. If such a tx is SOURCED by the owner's account, it consumes the owner's seq and resets seqTime [Assumption from CAP-21 semantics: seqTime updates for the tx source account].
   - Effects: the heir can only delay stage 2 or brick it (bumping seq past stage-2's seqNum). That hurts only the heir, so it's harmless.
   - BUT in the Guardian merge it matters. If the guardian's "undo" (ClaimClaimableBalance) is a tx sourced by the parent's account, every undo resets the inheritance clock, and a guardian could keep a dead parent's account "alive". The design must use tx source = the guardian's own account with op source = the parent, so the parent's seq isn't consumed. Please confirm in the spike that seqTime is untouched when the parent is only an op source.
2. Drawer-tx lesson (from the Judge on PrizeLock). Any pre-signed alternative at the same seq is invisible until it lands. For Heirloom that's benign, since only the owner can create competitors and revocation is intended. For staggered multi-heir wills, though, two heirs' pre-signed txs at related seqs race each other. Is the ordering deterministic in your design?
3. Demand: still my main worry. You switched the segment to ACTIVE USDC users (freelancers paid on Stellar, Vibrant/Beans/LOBSTR). Good, but that's still [Speculation] on size.
   - Can you pull ANY on-chain number before Round B? For example, from Raven/Scout or Horizon: count of accounts holding > $100 USDC on mainnet, or LOBSTR's stated user count from the Scout directory.
   - One real number would move User Value from 3 to 4 for both Heirloom and Guardian.

---

## [~13:19] RECEIVED ← Stellar Architect (afa57e164c5df066c): answers to follow-up

Stellar Architect's answers to the Problem Hunter's follow-up.

1. Confirmed, and SOLVED exactly as you proposed [Verified spike e, testnet 13:16 UTC, tx 02e300ef…409b].
   - Construction: tx source = guardian account, op source = parent, ClaimClaimableBalance signed only by the guardian key.
   - Funds returned to the parent (9949.99997 → 9999.99997 XLM).
   - The parent's `sequence` and `sequence_time` were UNCHANGED (23116029383147522 / 1792934197 before and after).
   - The same construction with a Payment op → op_bad_auth.
   - So undo doesn't reset the clock, costs the parent no fee, and gives no spending power.
   - Also verified, the two-stage will [spike d]:
     - stage 2 before stage 1 → tx_bad_seq;
     - stage 1 → OK;
     - low-weight heir Payment → op_bad_auth;
     - stage 2 right after stage 1 → tx_bad_minseq_age_or_gap;
     - stage 2 after grace → OK.
2. Ordering is DETERMINISTIC by construction.
   - Every will has its own seqNum and minSeqNum. Executing a tx sets the account seq to that tx's seqNum.
   - Heir 1's will: seq S+2^32, minSeqNum S, age 90d.
   - Heir 2's fallback will: seq S+2^33, minSeqNum S, age 180d.
   - If heir 1's lands first, the account seq becomes S+2^32. That is still < S+2^33, so heir 2's stays valid (a fallback after 90 more days of silence, since heir 1's tx reset seqTime).
   - If you want them EXCLUSIVE instead, set heir 2's minSeqNum = S and give it a seqNum below heir 1's. Executing heir 1's (higher seq) pushes the account seq past heir 2's seqNum, which kills it (tx_bad_seq, as in my revocation spike).
   - Both shapes can be chosen at signing time. The race is only "whoever submits first once valid", and the preconditions make the earliest-valid time different per heir.
   - The owner alone can create competing txs (needs a signature).
3. Number [Verified, Stellar Expert API, observed 13:17 UTC, https://api.stellar.expert/explorer/public/asset/USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN-1]:
   - mainnet Circle USDC trustlines 2,498,538;
   - funded (non-zero) 718,599;
   - 122.3M USDC payments all-time.
   - [Assumption] Some funded accounts are exchange or anchor operational accounts, so end users are fewer.
   - The ≥$100 + active-30d cut is [Unknown]; that needs Hubble/BigQuery, which I won't attempt now.

---

## [~13:20] PH assessment (not sent)
- The Guardian-merge interaction risk is resolved by spike (guardian-sourced tx, parent as op source, parent's seq and seqTime unchanged).
- The two-stage will is verified on testnet.
- Demand floor: 718,599 funded USDC accounts on Stellar mainnet [Verified, Stellar Expert]. That gives a real addressable base of self-custody-capable USDC holders, though the share that are end users vs. operational accounts is Unknown.
- This partly answers my own S1 objection: the user is not a "72-year-old in the EU" but an existing Stellar USDC holder and their family.

## [~13:21] RECEIVED ← Wildcard Inventor (a478580ad9cad690f): reply on S1/S2/S6

Wildcard Inventor's reply to the Problem Hunter's attack on S1, S2 and S6: I concede the user question for the US/EU elder, re-seat it, and redesign the bypass. Thank you for the S5 concessions; I agree with your abandon lean, and if anything survives, the sponsor-pledge claimable balance is the part to keep.

Labels: [V] = verified (link or the Architect's spike tx), [A] = assumption, [S] = speculation, [U] = unknown dependency.

=== S1 SECOND THOUGHT ===
1. Wrong money location: CONCEDED for US/EU elders. The FTC Bitcoin-ATM data and IC3 investment-scam data show money flowing bank → exchange or crypto ATM → scammer, not out of Stellar self-custody. [V, your links]
   Re-seated user: households that ALREADY receive and hold USDC on Stellar.
   - Evidence: MoneyGram's Colombia app gives a USDC balance on Stellar, self-custodied via Crossmint. Colombian families receive >22× what they send. [V https://blockworks.co/news/moneygram-stablecoin-app-colombia , https://cointelegraph.com/news/moneygram-app-launch-colombia-stablecoin-savings]
   - The receivers include the ageing parents of migrants, who are classic impostor-scam targets. [A]
   - [U] Crossmint may use C-address smart wallets, which can't be claimable-balance (CB) claimants. That would block a drop-in integration with MoneyGram specifically.
   - Distribution: an SDK/feature for Stellar wallets and anchors (B2B2C), not a new consumer wallet. [S]
   - I can't name a data point for Stellar users aged 60+ specifically. [U]
2. Switch story vs. the bank: CONCEDED for the UK. Mum should keep money in a bank that reimburses up to £85k.
   - The switch story only works where people ALREADY hold dollars on-chain because their local bank is worse: peso devaluation, remittance costs. [A]
   - There, the alternative isn't a protective bank; it's an unprotected wallet.
3. Bypass via LOBSTR: CONCEDED as originally designed. FIXED with a 2-of-3 policy co-signer, no contract. Thresholds are low 1 / medium 2 / high 2:

   | Signer | Weight |
   |---|---|
   | Mum (in-app key, no seed phrase) | 1 |
   | Policy key (our server) | 1 |
   | Offline recovery key | 1 |

   - Known payees are instant: Mum signs and the policy key co-signs automatically.
   - Mum's key imported elsewhere is weight 1 < medium 2, so op_bad_auth. [V: the Architect's spike showed a weight-1 key alone failing on Payment]
   - The policy key co-signs only claimable balances for new payees.
   - Honest split: "no single key can move the money" is protocol; "which payee is known" is policy.
4. Guardian removal: FIXED differently from your table.
   - The guardian now has NO signer weight on Mum's account. She is a claimant on each pending CB. Your concern about Mum removing her disappears, because there's nothing to remove on the account.
   - Removing the policy key needs high = 2 (Mum + recovery), so a scammer coaching Mum alone can't remove it.
   - Recovery if a key is lost: any 2 of the 3 rotate the third.
5. Scammer adaptation and alert fatigue: PARTLY CONCEDED.
   - A groomed long-con victim who re-confirms isn't stopped by 24h. [A]
   - Evidence that delay is an accepted anti-fraud lever: since 30 Oct 2024, UK PSPs may delay suspicious outbound payments up to 4 business days. [V https://fca.org.uk/publication/finalised-guidance/fg24-6.pdf] Kraken holds withdrawals to new addresses for 24h after a credential change. [V https://support.kraken.com/hc/en-us/articles/360000672863]
   - I have no causal effectiveness number. Alerts fire only on NEW payees, which should be rare for this user. [A]
6. Recipient UX: a legitimate new payee waits 24h ONCE, then is promoted to known payee via the cooling-off allowlist.
   - Any Stellar USDC recipient needs a G-account and trustline regardless. The claim screen bundles ChangeTrust + Claim. [A]
   - Merchants and exchanges don't claim CBs. Mitigation: SEP-1 verified merchants go straight to the allowlist. [A]

=== S2 LOOP ===
- Mechanics are now proven. The Architect cleared a 3-firm cycle with ONE self-payment: tx fce43284…40c9, every edge −60, atomic, one signature. Horizon pathfinding found the cycle by itself. [V spike]
1. Cold start: CONCEDED. Every firm in the cycle must be onboarded.
   - Best candidate: a platform that already holds the invoice graph, such as a B2B ordering platform for restaurant-supplier clusters or a business association. [S, no named partner]
2. Sardex/WIR: partly DISTINGUISHED.
   - Those are mutual-credit CURRENCIES that ask members to accept a new unit for future trade, i.e. circulation. Loop only CANCELS existing euro debts and never asks anyone to accept a new money.
   - That's closer to AJPES set-off than to Sardex. [A]
   - But I CONCEDE voluntary adoption is unproven, and Slovenia's compulsion is a warning sign.
3. Why not a trusted operator: CONCEDED within one jurisdiction or platform; a database works. Stellar only adds value across platforms and borders, where no shared operator exists. [A] I have no number.
4. Accounting: a burned IOU is booked as a contractual multilateral set-off, with the tx hash as evidence. The netting offer is the standing set-off declaration. [A] PT invoicing/SAF-T compatibility is [U].
5. Privacy: CONCEDED. It's unsolved in the MVP and a real market blocker.
6. Single human: Rita, a Lisbon bakery owner owed €4k by a café while owing €3.5k to her flour mill. Constructed, not lived. [S]
- Net: Loop keeps 5/5 on Track and Innovation but ~2 on User Value and Market & Ecosystem Potential. It's a high-variance option.

=== S6 STAMP ===
1. Bypass: CONCEDED. LinkedIn InMail already refunds credits if the recipient responds within 90 days [V https://www.linkedin.com/help/linkedin/answer/57013]. That shows refund-on-reply priority messaging works at scale, but on a closed platform that controls the channel. Email has no such gate.
2. Steady state: CONCEDED. "Earn money from spam" is a demo moment, not an economy. In steady state, good senders are refunded and bad senders avoid the channel.
3. Cold start: no good answer.
4. payTo: CONCEDED. With stock x402 the bond is either custodial or not x402.
- I'll most likely recommend ABANDONING Stamp in Round B.

The open question that matters most is yours: a REAL human seed for S1. None of us has one; the team might. I've asked the Judge/Chairman to raise it.

---

## [~13:23] SENT → Wildcard Inventor (a478580ad9cad690f): follow-up on S1 redesign

Problem Hunter's follow-up to the Wildcard on S1: good concessions and a better user. But the redesign has a new hole and a new dependency.

1. NEW HOLE: a guardian who is a CB claimant CAN spend. [Verified semantics: ClaimClaimableBalance credits the CLAIMING account.]
   - If the guardian is a claimant on each pending claimable balance (CB), her "undo" moves Mum's €900 into the GUARDIAN's account, not back to Mum. That breaks your own headline, "undo but never spend".
   - The Architect's spike e (13:16 UTC) solved this the other way: the guardian is a LOW-weight signer on Mum's account, and the tx source is the guardian with op source = Mum. The funds return to Mum, Mum's seq and seqTime don't change, and the guardian's Payment gets op_bad_auth.
   - Please reconcile. I think the claimants must be {recipient after 24h, Mum unconditional}, and the guardian undoes by signing a Mum-sourced Claim op at low weight. Then guardian removal needs high = 2 (Mum + recovery or policy), which still blocks scammer-coached Mum acting alone.
2. NEW DEPENDENCY: your policy key is our server co-signing EVERY payment.
   - That's a backend in the critical path. If it's down, Mum can't pay at all, and a regulator or judge may call it quasi-custodial ("they can freeze my payments").
   - Is it in the MVP? Can the policy signer run client-side for the demo? Is that honest?
   - Alternative with no server: Mum weight 1, guardian weight 1, recovery weight 1; low 1, med 2, high 2. Known payees are paid via pre-authorized txs [hash(x)/preauth signer, Unknown feasibility]... It gets complex fast. Your call, but the Judge will score dependencies.
3. USER: the MoneyGram Colombia evidence is the first real anchor [V your links]. But [U] Crossmint likely uses C-address smart wallets, which can't be CB claimants. So the realistic first user is a classic G-account USDC holder.
   - Floor on that population: the Architect pulled 718,599 funded Circle-USDC accounts on Stellar mainnet [V Stellar Expert API, 13:17 UTC], with an unknown share that are operational accounts.
   - That's enough to say "the user exists". It's not enough to say "elderly".
   - Suggest the pitch persona: "a Colombian mother who receives her son's dollars on Stellar". It's specific, verifiable in kind, and judges get it.
4. Scope warning: your S1 now has a known-payee allowlist, a policy server, a recovery key, 24h CBs, guardian alerts and SEP-1 merchant bypass. That's more than 3 features. For a 15h build, what's the ONE hero flow, and what gets cut?

My Round B position will likely be: S1 (re-seated on remittance receivers) or the Guardian merge, conditional on fixing point 1 and resolving point 2 honestly.

---

## [~13:26] RECEIVED ← Wildcard Inventor (a478580ad9cad690f): reconciliation on S1

Wildcard Inventor's reconciliation with the Problem Hunter's follow-up on S1: I accept all four points.

1. HOLE: CONCEDED. The claimant-guardian was a regression; the Architect and the Judge caught it too.
   Reconciled design, exactly as you propose:
   - Claimants: {recipient: NOT BEFORE T, Mum: unconditional}.
   - The guardian undoes with the spike-e construction: tx source = guardian, op source = Mum, ClaimClaimableBalance. Funds return to Mum, and Mum's seq and seqTime are unchanged. [V tx 02e300ef…409b]

2. DEPENDENCY: honest answer.
   Final table: Mum 1 / Policy 1 / Guardian 1. Thresholds: low 1, medium 2, high 2. There is no separate recovery key; it's dropped.
   - Why the server is needed: no server-free classic config gives both "known payee instant" and "Mum's key alone can't bypass". Classic auth isn't destination-aware. Preauth-tx signers are one-shot, so they don't scale to repeated payments. [A, high confidence]
   - Anti-freeze: if the server is down or "freezes" Mum, Mum + guardian = 2 overrides it and can remove it. The server can never move funds alone (1 < 2). That is the answer to "quasi-custodial". [A until the integrated spike]
   - MVP form: a tiny serverless function (cosign endpoint plus allowlist), labelled in the README as a separate policy service. That is ONE external dependency, and it's ours.
   - Running it client-side for the demo would be dishonest about the threat model, so: no. It stays a separate deployed function.

3. USER: adopted.
   - Persona: "a Colombian mother who receives her son's dollars on Stellar", in a classic G-account. [V that the class exists: 718,599 funded USDC accounts on mainnet, per the Architect via Stellar Expert]
   - Not age-segmented: CONCEDED, it's [U].
   - I'll pitch it as an SDK/feature for G-account wallets and anchors. MoneyGram/Crossmint stays [U] until the C-address question is answered.

4. ONE hero flow: "Stranger payment → the network refuses the early claim → daughter taps Undo → money is back with Mum."
   Supporting beats (≤15s each):
   - Mum's key in "another wallet" → op_bad_auth.
   - A known payee is paid instantly.
   CUT from the MVP:
   - SEP-1 merchant bypass
   - recovery key
   - SA-1 inheritance (only a stretch liveness hatch)
   - sponsored reserves (use friendbot XLM)
   - push alerts (use polling)
   Feature count: 3 (send with rules, pending/undo, refusal demo).

I'll back S1 re-seated this way in Round B, with the Guardian merge reduced to "the guardian signer plus an optional liveness hatch".

---

## [~13:27] SENT → Wildcard Inventor (a478580ad9cad690f): weight-table hole + fix

Problem Hunter on the Wildcard's final S1 table: one more hole, with a fix. With Mum 1, Policy 1, Guardian 1 and thresholds low 1, medium 2, high 2, the Guardian and the Policy server together reach 2. They can PAY Mum's money anywhere (medium) and even REMOVE Mum as a signer (high), without Mum. "Guardian can never spend" then rests on server policy, not the protocol, and a compromised server plus any guardian drains the account.

Fix [arithmetic on documented threshold semantics; Assumption until spiked]: Mum 2, Policy 1, Guardian 1; thresholds low 1, medium 3, high 3.

| Combination | Weight | Can do |
|---|---|---|
| Mum + Policy | 3 | Known-payee instant payments. The normal path. |
| Mum alone, key imported into LOBSTR | 2 < 3 | Nothing: op_bad_auth. The bypass stays blocked. |
| Guardian + Policy | 2 < 3 | Cannot spend, and cannot remove Mum. The protocol guarantee is restored. |
| Mum + Guardian | 3 | Can pay without the server and can remove a misbehaving server. Anti-freeze kept. |
| Guardian alone | 1 = low | Undo via ClaimClaimableBalance (spike e construction). |
| Policy alone | 1 = low | Low ops only, e.g. BumpSequence. Harmless griefing at worst. |

Please confirm this table in the integrated spike, especially: Guardian + Policy Payment → op_bad_auth; Mum + Guardian SetOptions → OK.

Otherwise I agree: one hero flow, three features, cuts accepted, and an honest separate policy function. With this table, I'll back S1 (or Guardian-lite) as #1 in Round B.

---

## [~13:29] RECEIVED ← Ruthless Judge (ac72ecdbce496fda1): Chairman ruling relay + MoneyGram evidence (info only)

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

(PH note: informational; no reply required. It shifts S1's channel story to "feature for G-account wallets". The persona "Colombian mother receiving her son's dollars" must be labelled illustrative unless the team's real contact confirms.)

## [~13:30] RECEIVED ← Wildcard Inventor (a478580ad9cad690f): threshold fix accepted

ACCEPTED: the Problem Hunter's threshold fix for S1. Final table: Mum 2 / Policy 1 / Guardian 1; thresholds low 1, medium 3, high 3.

- It closes the hole I left: in my table, guardian + policy = 2 could pay and even remove Mum.
- I checked every combination and agree with all of them:
  - Mum + Policy = 3: instant known-payee payments.
  - Mum alone = 2: op_bad_auth on Payment (the "other wallet" refusal).
  - Guardian + Policy = 2: cannot pay or change signers. "Guardian can never spend" is protocol-enforced again, even if the server is compromised.
  - Mum + Guardian = 3: family override, which removes a dead or freezing server.
  - Guardian alone: undo via spike e.
  - Mum alone: can still reclaim her own CB (low).
- Residual, disclosed: Mum + Guardian together can pay anywhere without the 24h window. That is the intended family override; a scammer would have to coach BOTH. [A]
- Status: [A] until the integrated spike.

Integrated-spike checklist (Architect):
(1) Mum alone: Payment → op_bad_auth
(2) Mum + Policy: Payment → OK
(3) Mum + Policy: 24h CB → OK; then guardian undo (spike-e construction) → OK, funds back to Mum
(4) Guardian + Policy: Payment → op_bad_auth
(5) Guardian + Policy: SetOptions removing Mum → op_bad_auth
(6) Mum + Guardian: SetOptions removing Policy → OK

(PH note: agreed; no reply needed. Round A closed on my side.)
