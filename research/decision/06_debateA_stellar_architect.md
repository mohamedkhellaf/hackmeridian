# 06 — Debate Round A log: Stellar Architect

All times WET (= UTC today). Messages are verbatim. Spike scripts are in the session scratchpad `…/scratchpad/spikes/` (not in the repo). Raw spike output is appended at the end of this file.

## Summary of spike results (testnet, protocol 29, @stellar/stellar-sdk 17 from the repo)

| Spike | Claim tested | Result | Evidence |
|---|---|---|---|
| (a) WI-2 | Recipient claims CB before NOT(BEFORE_ABS(t)) | **Rejected**: `op_cannot_claim` | Verified |
| (a) WI-2 | Guardian-only (weight 1) Payment from parent (parent tx source) | **Rejected**: `op_bad_auth` (tx_failed; tx-level LOW passed, so the fee is charged to the parent) | Verified |
| (a) WI-2 | Guardian-only ClaimClaimableBalance (undo) on parent-sourced tx | **Success**, funds back to parent, tx 58f70035… | Verified |
| (a) WI-2 | Recipient claims after window | **Success**, tx 9dc6c354… | Verified |
| (a) WI-2 | Guardian-only setOptions (high) | **Rejected**: `op_bad_auth` | Verified |
| (a) WI-2 | Guardian-only bumpSequence (low) on parent | **Success**, tx 7e72ca75… (disclosure point) | Verified |
| (b) WI-1 | One self-to-self `path_payment_strict_send` A→A, CIOU→[BIOU]→AIOU, 60 units, clears the A→B→C→A cycle | **Success**, tx fce43284…; all edges 100→40; C's offer 100→40 | Verified |
| (b) WI-1 | Horizon `strictSendPaths(CIOU→AIOU)` finds the cycle | **Yes**, path [BIOU] | Verified |
| (c) SA-1 | Pre-signed SetOptions (seq S+2^32, minSeqNum S, minSeqAge 30s), heir fee-bump, submitted immediately | **Rejected**: `tx_fee_bump_inner_failed` / inner `tx_bad_minseq_age_or_gap` | Verified |
| (c) SA-1 | 20s after an owner payment (timer reset) | **Rejected**: same code | Verified |
| (c) SA-1 | 36s after the owner's last activity | **Success**, tx 3932dad7…; heir added; owner seq jumped to S+2^32 | Verified |
| (c) SA-1 | Revocation: owner bumpSequence to will seq, then submit will | **Rejected**: inner `tx_bad_seq` | Verified |
| (d) SA-1 two-stage | Stage 2 before stage 1 | **Rejected**: inner `tx_bad_seq` | Verified |
| (d) | Stage 1 after silence, heir at LOW weight | **Success**, tx 3eefd5f8…; heir Payment → `op_bad_auth` | Verified |
| (d) | Stage 2 immediately after stage 1 | **Rejected**: inner `tx_bad_minseq_age_or_gap` (grace clock auto-starts at stage 1) | Verified |
| (d) | Stage 2 after grace | **Success**, tx d5b4dd19…; heir Payment → success | Verified |
| (e) Guardian merge | Undo with **tx source = guardian, op source = parent**, guardian sig only | **Success**, tx 02e300ef…; funds to parent; parent `sequence` and `sequence_time` **unchanged**, so there is no clock reset and no parent fee | Verified |
| (e) | Same construction with a Payment op | **Rejected**: `op_bad_auth` | Verified |
| Market number | Mainnet Circle USDC on Stellar | 2,498,538 trustlines, **718,599 funded**, 122.3M payments (Stellar Expert API, 13:17) | Verified, https://api.stellar.expert/explorer/public/asset/USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN-1 |
| Freighter signing a far-ahead seqNum with preconditions | — | **Unknown dependency** (browser extension, can't be tested headlessly) | — |

---

## Messages

### 13:09 SENT → Wildcard Inventor (a478580ad9cad690f)

ROUND A ATTACK from the Stellar Architect on S1 Second Thought, S2 Loop and S6 Stamp. I'm running testnet spikes for S1 and S2 now and will send you the results.

S1 WI-2 Second Thought
1. [Verified, docs] The guardian's weight-1/low-threshold power isn't limited to ClaimClaimableBalance. It also covers BumpSequence and SetTrustLineFlags/AllowTrust on the parent account. Bumping is harmless today, but in the Guardian merge with SA-1 a guardian BumpSequence past the will's seqNum kills the will. That only hurts the guardian, so it's a disclosure point, not a blocker. Q: do you agree to state this in the README?
2. [Assumption, needs spike] A parent-sourced tx signed only by the guardian must satisfy the tx-level source signature at the LOW threshold. I believe that's how it works (tx envelope auth uses the low threshold of the source; op-level auth uses each op's threshold). Spike (a) will confirm.
3. [Verified, protocol] "Known payees are instant" and "new payee → claimable balance" are app rules. The parent's key (weight 2) can sign a direct Payment from any other wallet; Freighter, Lobstr or the scammer's own "help" site can build one. Q: the scam script is "install this app / import your key"; the protection disappears the moment Maria's key is used outside your UI. Do you move the parent to weight 1 so that EVERY payment needs guardian co-sign above a limit (a real protocol-level guarantee), or accept that it's app-level? A 2-of-2 for medium ops kills the UX. What is your exact weight/threshold table, and which guarantees are protocol-enforced and which are app-enforced?
4. [Verified, docs] The recipient needs an authorized USDC trustline to CLAIM. Creating the CB doesn't need it; claiming does. A real recipient (grandson, merchant) has to add a USDC trustline first. Q: what does the demo do for a fresh recipient? The scammer obviously will.
5. [Assumption] Each CB costs the sender 0.5 XLM base reserve per claimant (2 claimants = 1 XLM locked) until claimed or reclaimed. That's fine, but Maria's account must hold XLM. Q: who funds XLM? Sponsored reserves (BeginSponsoringFutureReserves by the family/app) can solve it. Do you use them?
6. Judges can test it? Three roles (parent, guardian, recipient) means three keypairs, and judges won't have three Freighter accounts. Q: will you ship in-app generated testnet keypairs with friendbot plus a role switcher? Without it, "can judges test it" fails.
7. "Scammer says wait 24h / adds you as a known payee": answer concretely which protocol mechanism stops a "known payee" being added by the scammer's instruction. If it's app-level, say so.

S2 WI-1 Loop
1. [Assumption, spiking now] Self-to-self path_payment_strict_send with source == destination. I believe it's allowed (arbitrage), but if core rejects it as malformed the concept dies. Spike (b) answers this.
2. [Verified, protocol] Every offer owner must hold an AUTHORIZED trustline for both the asset it sells and the one it buys, unless it is that asset's issuer. In your design B's netting offer sells A-IOU (held) and buys B-IOU (own, so no trustline needed). OK. But if IOUs are AUTH_REQUIRED, each issuer must authorize every counterparty: N² setup ops. Q: is AUTH_REQUIRED actually needed for the demo, or just plain trustline limits?
3. [Verified, protocol] Offers are public and anyone holding the right IOU can take them: a firm with any IOU and a trustline can route a payment through your netting offers, which is the "rippling" you mention. Concretely, any holder of C-IOU can swap it at 1:1 for B-IOU through C's standing offer, turning a claim on C into a claim on B without B's consent beyond the trustline limit. Q: how do you explain credit-risk transfer to judges? That's an exploit: a firm about to default dumps its counterparties' risk.
4. [Assumption] Offer amounts: a passive offer selling X units locks selling liabilities. When invoices change, every firm must update its offers. Q: who maintains offers in real time? A bot holding firms' keys is custody.
5. User value / "who asked for this": SMEs don't hold Stellar accounts or issue assets. Q: name the first 5 real users and the legal status of a self-issued IOU as an invoice (EU e-money rules?). The Judge will hammer "my mom can't use this".
6. Judges can test it? They'd need 3–5 funded firm accounts with offers. Q: a "spawn a fresh 4-firm scenario" button with server-side keys?

S6 WI-3 Stamp
1. [Verified, Raven agentic-payments skill: "x402's payTo route config and MPP's recipient are always a classic account (G...)"] The x402 exact scheme pays a G-account, not a contract. The bond can't land in a Soroban escrow via stock x402, so "neither party can override" is false unless the server forwards it, which is custodial. Q: (a) custom x402 scheme (how many hours?), (b) the agent calls escrow.bond() directly with a 402 response containing the contract call, which is no longer x402, or (c) the server holds bonds custodially? Pick one and defend it.
2. Refunds require someone to sign: the recipient clicking "reply" must sign a contract call (wallet), or the server signs as an admin, which is centralised again.
3. The judges literally said they saw many x402 builds. Q: what is the 10-second visual that makes this NOT look like "another x402 paywall"?
4. Build size: Soroban contract + Node x402 server + agent client + React inbox is 4 components for 3 Soroban newcomers. The x402 packages pin their own stellar-sdk versions (for the MPP equivalent: @stellar/mpp pins sdk ^15 vs our 17). Q: where is the cut-line?

Please answer point by point. I'll send spike evidence shortly.

### 13:09 SENT → Problem Hunter (ade2988c3cf167d97)

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

### ~13:10 RECEIVED ← Wildcard Inventor (a478580ad9cad690f)

Round A attack from the Wildcard Inventor on S3 Heirloom and S4 FairSeat: originality challenges, disruptive upgrades, and pointed questions.

== S3 HEIRLOOM ==
Would a judge think "seen it"? Partly yes. The category is familiar; the mechanism is not.
- Stellar: Boreal Pulse (PULSO, Soroban check-in vault), Obol (ZK dead-man's switch), Heritaz, and Legacy Suite (directory project). You cited these yourself. Scout lists about 21 hits for "dead man switch". [V via Scout, 2026-10-25]
- Bitcoin is the closest analog and weakens "impossible elsewhere": Liana (Wizardsardine) uses miniscript timelocked recovery paths aimed at "inheritance, loss protection". The timer runs per coin from receipt, and users "refresh coins" by spending to themselves. [V https://docs.rs/crate/liana/latest , https://delvingbitcoin.org/t/using-op-vault-for-recovery/150]
- Off-chain: Casa and Nunchuk inheritance products, and Safe/Argent guardians with a security delay. [UNVERIFIED details]
- Your real differentiator is that ANY account activity re-arms the will (seqTime), with no coin refreshing and no funds moved into a contract. Bitcoin's version is per-UTXO and needs deliberate refresh. That holds, but say "Liana-class recovery without the refresh chore, on an account chain". Don't say "impossible elsewhere", or one Bitcoiner judge sinks the claim.

Disruptive improvements, pick at least one:
(1) Reframe the user from death to LOST KEYS. Keys get lost far more often than people die. "Your own backup key, stored with your lawyer or in a safe, becomes valid after 30 days of silence." The same mechanism gives a bigger market and a more urgent problem. [S on frequency]
(2) Two-stage will with a veto. At T1 a pre-signed tx adds the heir at LOW weight. That only lets them claim pending claimable balances, and it creates a visible on-chain "warning" signal the owner's wallet surfaces. At T2 a second pre-signed tx raises the heir to HIGH. Any owner activity between T1 and T2 kills stage 2. This answers your own "heir-key compromise" risk.
(3) Business-continuity framing: a "QuadrigaCX could not happen here" hook. The CEO died holding the only keys, and roughly C$190M+ of customer funds were inaccessible [widely reported; UNVERIFIED exact figure]. Target: small treasuries and DAOs on Stellar.
(4) Merge as the second beat of Guardian (WI-2): same signer setup, same persona.

Pointed questions:
Q1. Your spike: does Freighter actually sign a tx with seqNum = S+2^32 and minSeqAge preconditions, and does testnet accept it after the window? Please share the hashes when you have them.
Q2. seqTime updates for the TX SOURCE account. Can an attacker who compromises only the heir's XDR grief the owner? Can anyone else submit a tx that makes the owner the tx source? I believe not without the owner's signature, so confirm.
Q3. What is your evidence for user pain? Who asked for this? I have no number for lost-at-death crypto on Stellar.
Q4. Single heir gets full control. Can you do per-heir partial payouts natively, e.g. pre-signed claimable balances to 3 heirs with the same minSeqAge? That would look less "too simple".

== S4 FAIRSEAT ==
Would a judge think "seen it"? Yes, this is the strongest "seen it" risk on the shortlist.
- Stellar: TicketReal (Chile ideathon), TokenTicket, Twin Ticket, BlockFest, ZK-Tix, KaizenX, Mint Up. About 9 builds matched "ticket resale". [V Scout]
- Other chains: GET Protocol and YellowHeart. [UNVERIFIED current status]
- Off-chain, and the killer: DICE (now part of Fever) already sells exactly this. Tickets are non-transferable without permission, resale happens at face value through a waiting list, and the returning fan is refunded automatically. [V https://en.wikipedia.org/wiki/Dice_(ticketing_company) , https://news.pollstar.com/2019/03/12/you-dont-have-to-discount-those-tickets-talking-ticketing-with-dice-cro-russ-tannen/]
- So a judge can say "DICE does face-value resale with a database. Your approval server IS a database with extra steps." The SEP-8 approval server is a central gatekeeper, which undercuts "enforced by the protocol, not an app".

Disruptive improvement:
(1) "The SDEX IS the waiting list", removing the server from price decisions.
  - Fans who want a sold-out show place a native DEX buy offer for TICKET at face value. That is the queue, and price-time priority is enforced by validators, not a company.
  - A fan who can't go returns the ticket by selling it to the ISSUER (the only authorized counterparty). The issuer re-offers it at face value, the protocol matches it to the oldest bid, and the returning fan is refunded atomically.
  - Bids ABOVE face value are visible on the order book: public demand data the organizer can use to add a second show. That is real value DICE keeps private.
  - Asks (wherever they are placed) could be capped via auth: only the issuer is authorized to hold/sell the ticket on the book. [A: needs a spike on auth flags plus offers; AUTH_REQUIRED holders with authorized-to-maintain-liabilities can't create new offers]
  - Net effect: "DICE's waiting list, but no company can jump the queue for its friends."
(2) Portability: any Stellar wallet shows the ticket, unlike DICE's app lock-in. This is weak with consumers, but it is the protocol argument.

Pointed questions:
Q5. Why would a venue choose this over DICE or Fever, which already do face-value resale with mainstream UX? What is the one thing only Stellar gives the venue?
Q6. Fans need G-accounts plus a trustline per event tier. What is the onboarding path for a non-crypto fan in under 30 seconds? Sponsored reserves plus what wallet?
Q7. If the approval server goes down or the organizer goes bust, what happens to resale? (DICE has the same problem, so is ours any better?)

I log all Round A messages verbatim in research/decision/06_debateA_wildcard_inventor.md. Please send your WI-1/WI-2 spike results to me when ready, because I'll use them as evidence in my defence.

### ~13:10 RECEIVED ← Problem Hunter (ade2988c3cf167d97)

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

### ~13:11 RECEIVED ← Problem Hunter (ade2988c3cf167d97), reply on S5

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

### ~13:12 RECEIVED ← Ruthless Judge (ac72ecdbce496fda1)

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

### 13:13 SENT → Wildcard Inventor (spike evidence)

SPIKE EVIDENCE (Stellar Architect, testnet, 2026-10-25 13:09–13:13 UTC): all three mechanisms work exactly as claimed. Raw output is in my log file research/decision/06_debateA_stellar_architect.md. Scripts use the repo's @stellar/stellar-sdk 17, classic ops only, no Freighter.

(a) WI-2 Second Thought: VERIFIED. Parent GCDN6RLW…MPZN, guardian GA2XMULG…57YM, recipient GAQ7CIBS…IZ7B.
- setOptions guardian weight 1, master 2, thresholds 1/2/2: OK, tx 9145cd5a…fc54
- createClaimableBalance 100 XLM, recipient NOT(BEFORE_ABS(now+60s)) + parent unconditional: OK, 0b12600f…7a7a
- recipient claims early: FAIL, op_cannot_claim (tx_failed)
- guardian-only Payment from parent (parent-sourced tx, guardian sig only): FAIL, op_bad_auth
- guardian-only ClaimClaimableBalance (UNDO) on a parent-sourced tx: OK, 58f70035…a3c; parent balance 9899.99997 → 9999.99996
- recipient claims a second CB after its 15s window: OK, 9dc6c354…46d7
- guardian-only setOptions (high): FAIL, op_bad_auth
- guardian-only bumpSequence (low): OK, 7e72ca75…602. Disclosure point: the guardian CAN bump the parent's sequence. In the Guardian merge with a CAP-21 will this means the guardian can kill the will, which only hurts the guardian.
- Note: the failure codes are op-level (op_bad_auth with tx_failed), not tx_bad_auth. The tx-level LOW threshold passed with the guardian's signature alone, so fees are charged to the parent even on failed attempts. Small, but a guardian could spam failed txs and burn parent fees, at 100 stroops each.

(b) WI-1 Loop: VERIFIED.
- Firms A, B, C each issue an IOU. B trusts AIOU, C trusts BIOU, A trusts CIOU (limit 1000). Invoices: A→B 100 AIOU, B→C 100 BIOU, C→A 100 CIOU.
- Passive offers at price 1: C sells BIOU buys CIOU (4d6b8f0f…f8df); B sells AIOU buys BIOU (405b7dad…edf5).
- A: path_payment_strict_send sendAsset CIOU 60, destination = A ITSELF, destAsset AIOU, destMin 60, path [BIOU]: OK, tx fce43284…40c9.
- After: A holds CIOU 40, B holds AIOU 40, C holds BIOU 40. Every edge fell by exactly 60, atomically, with one signature. C's remaining offer is 40.
- Self-payment (source == destination) is accepted. Issuers buying their own asset via offers works, and receiving your own IOU burns it.
- Bonus: Horizon strictSendPaths(CIOU 10 → [AIOU]) FOUND the path [BIOU]. Horizon's pathfinder discovers the cycle, so you may not need a client-side DFS for small graphs (it's still useful for choosing the max-clearing amount).
- No AUTH_REQUIRED in this spike (plain trustline limits). AUTH_REQUIRED would add authorize ops per counterparty; untested.
- Still open (not tested): the rippling/credit-risk-transfer exploit (an outsider holding CIOU can take C's netting offer) and loops of 4–6 parties.

(c) SA-1 Heirloom (FYI, my own): VERIFIED.
- The pre-signed SetOptions has seqNum S+2^32, minSeqNum S, minSeqAge 30s and no maxTime; the heir fee-bumps it.
- Submitted immediately: tx_fee_bump_inner_failed / inner tx_bad_minseq_age_or_gap.
- The owner makes a normal payment at t+18s. At t+38s (20s after that activity): still tx_bad_minseq_age_or_gap, so the timer reset is proven.
- 36s after the activity: OK, 3932dad7…c79f633. The heir is now a signer, and the owner's seq jumped to S+2^32.
- Revoke: the owner bumpSequence to will seq, then the heir submits → inner tx_bad_seq. Revocation is permanent.
- UNKNOWN: Freighter signing of a far-ahead seqNum (browser extension, can't be tested headlessly).

Use freely as evidence. Answers to your S3/S4 attacks follow in a separate message.

### 13:13 SENT → Chairman (main), cc

cc Chairman, from the Stellar Architect: Round A testnet spikes (13:09–13:13 UTC) all PASS. Details are in research/decision/06_debateA_stellar_architect.md.

(a) WI-2:
- Recipient's early claim → op_cannot_claim.
- Guardian-only Payment from the parent → op_bad_auth.
- Guardian-only ClaimClaimableBalance (undo) on a parent-sourced tx → SUCCESS, funds back to the parent.
- Recipient claim after the window → SUCCESS.
- Guardian-only setOptions → op_bad_auth.
- Guardian-only bumpSequence → SUCCESS. Disclosure point: the guardian can kill a CAP-21 will in the Guardian merge, and can burn parent fees with failed txs.

(b) WI-1:
- One path_payment_strict_send from A to A, CIOU → [BIOU] → AIOU for 60, cleared the A→B→C→A cycle atomically. All edges went 100 → 40.
- Horizon strictSendPaths even finds the cycle path itself.

(c) SA-1:
- The pre-signed SetOptions with minSeqNum + minSeqAge(30s) is rejected early: tx_bad_minseq_age_or_gap.
- It is still rejected 20s after a normal owner payment (timer reset proven), then accepted after the window, fee-bumped by the heir.
- Revocation via bumpSequence → tx_bad_seq.

Still unknown: whether Freighter will sign a tx with a far-ahead seqNum.

### 13:14 SENT → Problem Hunter (defence of S3/S4 + PrizeLock answer)

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

### 13:14 SENT → Ruthless Judge (defence of S3/S4)

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

### 13:14 SENT → Wildcard Inventor (defence of S3/S4)

Stellar Architect's reply to the Wildcard on S3 Heirloom and S4 FairSeat. Spike hashes are in my previous message.

== S3 ==
- Liana/Bitcoin: AGREED, I'll drop "impossible elsewhere". New claim: "Liana-class timelocked recovery on an account chain, with no coin-refresh chore: ANY outgoing tx re-arms it, funds never move, and the will artefact is non-secret". The last point is new: submitting the XDR can only ever make the named heir a signer after N days of silence, so it can be stored publicly.
- Improvements, which I'll bring to Round B:
  (1) Lost-keys reframe: YES. "Your own backup key becomes valid after N days of silence." It's the same tx with a different key holder.
  (2) Two-stage will: YES, and it is natively elegant.
    - Stage 1 (seq S+2^32, minSeqNum S, minSeqAge T1) adds the heir at LOW weight. That is a visible warning with no spending power: your WI-2 spike shows low weight → Payment op_bad_auth.
    - Stage 2 (seq S+2^33, minSeqNum S+2^32, minSeqAge grace) raises to HIGH.
    - Stage 2 is invalid until stage 1 executes, because the account seq is below its minSeqNum.
    - Stage 1 is owner-sourced, so it resets seqTime and the grace clock starts automatically.
    - [CAP-21 semantics Verified; end-to-end Assumption until a ~10-minute spike]
  (3) QuadrigaCX business continuity: good hook for treasuries, but the figure is [Unverified]. Use it only if verified.
  (4) Merge into Guardian: I lean YES. Same guardian key: the will raises its weight 1 → 2. I'll argue it in Round B.
- Q1 Freighter: [Unknown]. It's a browser extension and can't be tested headlessly. Testnet acceptance is VERIFIED (hash 3932dad7…c79f633). The fallback is an in-app keypair, which we need anyway for judge-testability.
- Q2: CONFIRMED, nobody can make the owner a tx source without a signature meeting the owner's LOW threshold.
  - Caveat from my WI-2 spike: in the Guardian merge, the guardian (low weight) CAN submit owner-sourced txs (bumpSequence succeeded, tx 7e72ca75). The guardian can therefore (a) reset the inactivity timer, delaying only their own claim, or (b) bump past the will seq to kill it, again hurting only themselves.
  - (c) Guardian-signed failed txs burn parent XLM fees at ~100 stroops each: a griefing vector, but tiny.
  - Disclose all three.
- Q3 pain: the Cremation Institute survey (via the Problem Hunter): 89% worry and only 23% have a plan [Verified via PH's link]. I have no Stellar-specific number [Unknown].
- Q4 per-heir partial payouts: natively only with FIXED amounts (pre-signed Payments or CreateClaimableBalance). They fail atomically (op_underfunded) if the balance drops, and leave a remainder if it rises. Percentages need a Soroban contract.
  - Option: stage 2 grants the signer, then the app runs a "distribute by %" helper that the heir executes.
  - So: no native percentage split. CONCEDED.

== S4 ==
- DICE: CONCEDED. It's the killer comparison, and the approval server is a database with extra steps for the cap.
- "SDEX as waiting list": a clever upgrade, but there's a protocol problem.
  - To place a BUY offer for TICKET, a fan's trustline must be FULLY authorized at offer creation. A fully authorized fan can also receive P2P transfers from other authorized fans, so the cap bypass returns.
  - The fix would be the sandwich: authorize → create buy offer → set AUTHORIZED_TO_MAINTAIN_LIABILITIES in the same tx, so the bid stays on the book but the fan can't otherwise transact.
  - Whether a maintain-liabilities offer can still be FILLED (receive the asset) is the crux. Docs say the state "allows an account to maintain current orders" [Verified wording, control-asset-access]. I believe fills are allowed [Assumption]; it needs a spike.
  - Even if it works, it doesn't fix the account-sale bypass or primary-sale bots, and DICE has the UX.
- Q5: honestly, only portability, organizer-bankruptcy survival and enforced royalties. That's thin.
- Q6: embedded in-browser keypair plus organizer-sponsored reserves; USDC acquisition is the gap.
- Q7: if the approval server dies, resale stops but tickets persist and remain usable at the door (the burn needs the issuer anyway). No better than DICE on resale.
- My lean for Round B: abandon S4 unless someone wants the SDEX waiting-list spike.

### ~13:15 RECEIVED ← Problem Hunter (follow-up)

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

### ~13:15 RECEIVED ← Ruthless Judge (follow-up)

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

### ~13:16 RECEIVED ← Wildcard Inventor (reply to my S1/S2/S6 attack)

Wildcard Inventor's reply to the Architect's Round A attack on S1, S2 and S6, using your spike as evidence. Thank you, those spikes were decisive.

Labels: [V] = verified (link or your spike tx), [A] = assumption, [S] = speculation, [U] = unknown dependency.

=== S1 SECOND THOUGHT: redesigned because of your points 1, 3 and 7 ===
New signer table for Mum's G-account (no contract):

| Signer | Weight |
|---|---|
| Mum (in-app key, no seed phrase shown) | 1 |
| Second Thought policy co-signer (server) | 1 |
| Offline recovery key | 1 |

Thresholds: low 1 / medium 2 / high 2. The guardian (daughter) has NO weight on Mum's account. Instead she is a CLAIMANT on each pending claimable balance (CB).

P1. Guardian bump, fee burn and clock conflict: all GONE.
- The guardian never signs on Mum's account. She undoes a payment by claiming the CB as a claimant (predicate BEFORE T) into safe-keeping, or Mum reclaims it herself (weight 1 ≥ low).
- Your spike proves the old variant's bug: tx 7e72ca75 (guardian bumpSequence OK), plus parent fees charged on op_bad_auth.
- README disclosure becomes unnecessary for the guardian. It still applies to the recovery key.
P2. Your spike confirmed it: the tx-level LOW threshold passed with the guardian alone (op-level failures only). [V spike]
P3. Exact table: see above. Which guarantee comes from where:

| Guarantee | Enforced by |
|---|---|
| (a) No single key moves funds: Mum's key in LOBSTR alone gets op_bad_auth, as your guardian-only Payment showed for weight 1 < medium 2 | Protocol [V spike] |
| (b) A CB recipient can't claim before T (your op_cannot_claim) | Protocol [V spike] |
| (c) Undo works | Protocol [V spike, 58f70035] |
| (d) Known payees get instant payments, because the policy key co-signs Payments only to the allowlist | Policy key (app level) |
| (e) New payees get CB-only payments | Policy key (app level) |
| (f) Adding a payee to the allowlist takes a 24h cooling period plus a guardian notification | Policy key (app level) |

- Liveness: if the policy server dies, Mum + recovery = 2 removes it. Optionally, your CAP-21 tx can raise Mum to weight 2 after N days of silence, which is where SA-1 fits.
- The trade-off: one external service (ours) in the critical path, and "2-of-3 collaborative custody" framing instead of "pure protocol".
P4. Recipient trustline: TRUE, but any Stellar USDC recipient needs one regardless of a CB.
- Demo: recipient accounts are pre-created with trustlines, in a role switcher.
- For a fresh recipient, the claim screen adds ChangeTrust + Claim in one tx; sponsored reserves are possible. [A]
P5. XLM: yes, sponsored reserves. The app/family sponsors Mum's account entries and CB reserves via Begin/EndSponsoringFutureReserves. [A: I believe CB entries are sponsorable; quick check welcome]
P6. Judge-testable: YES. In-app generated testnet keypairs, friendbot, and a three-role switcher (Mum / Daughter / Stranger). This is mandatory anyway because of the policy co-signer.
P7. Known-payee addition: this is app-level (the policy key), with a 24h delay and a guardian alert. The protocol part is only that Mum can't bypass the policy key alone. Stated honestly.

=== S2 LOOP ===
P1. Your spike: VERIFIED, tx fce43284…40c9. This is now the strongest mechanics evidence in the room, and Horizon's pathfinder finding [BIOU] is a bonus.
P2. AUTH_REQUIRED isn't needed for the core demo, since trustline limits are consent. But it is the FIX for your P3 (below), so I'd keep it as an optional "closed club" mode with N² authorizations. For 4–5 firms that's ≤20 ops in the seeding script, which is fine.
P3. Rippling/credit-risk transfer: real. Two mitigations:
  (i) AUTH_REQUIRED, so only a firm's actual approved creditors can hold its IOU. Then the only possible takers of C's offer are C's own creditors, and a swap is a legitimate assignment of C's claim on B in settlement of C's debt.
  (ii) Offers sized to min(holding, own debt) and refreshed atomically on each invoice.
  - Residual: a creditor-preference problem if C is about to default (bankruptcy-law "preference"). Disclose. [A on legal framing]
P4. Offer maintenance: invoice acceptance becomes ONE tx co-signed by debtor and creditor: the debtor pays its IOU and the creditor updates its netting offer, atomically. No bot holds keys.
P5. Real users and legal status: CONCEDED, there are no named users. Legal: a burned IOU = a recorded contractual set-off; e-money status is [U]. Loop scores low on User Value and Market & Ecosystem Potential.
P6. Judge-testable: YES, a "spawn a fresh 4-firm scenario" button with server-generated testnet keys.

=== S6 STAMP ===
P1. payTo flaw: CONCEDED.
- With stock x402 the bond is either custodial (c) or a non-x402 escrow call (b). I pick (b), which kills the x402/Composed story.
- Also, LinkedIn InMail already refunds credits when the recipient responds within 90 days [V https://www.linkedin.com/help/linkedin/answer/57013], so the mechanic is proven but not new.
P2. Refund signing: the recipient signs via an in-app key, but that is just escrow again.
P3. 10-second visual: I don't have one that survives "another x402".
P4. Cut-line: there isn't a good one.
- My Round B position is most likely to ABANDON Stamp.

=== Your S3/S4 replies ===
- S3: I support the two-stage will and the lost-keys reframe. In the Guardian merge, I now argue SA-1 belongs as the liveness/recovery hatch (or the lost-keys feature). It should not be framed as inheritance by the guardian, because I removed the guardian's weight, which also fixes the clock conflict the Judge raised.
- S4: agreed, abandon unless the maintain-liabilities fill question is spiked cheaply. I would NOT spend spike time on it.

### 13:18 SENT → Ruthless Judge (answers to follow-up)

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

### 13:18 SENT → Problem Hunter (answers to follow-up)

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

### 13:18 SENT → Wildcard Inventor (feedback on S1 redesign)

Stellar Architect on your S1 redesign: mostly good, with one regression and one new spike that changes the options.

1. REGRESSION: guardian-as-CB-claimant with BEFORE(T) means the daughter claims Mum's pending payment INTO HER OWN account. That is spending power over every pending payment. A compromised daughter key (or a scammer who social-engineers the daughter) can steal it, and it breaks the "guardian can undo but never spend" headline, which was the best line of the pitch.
2. A better native fix is now VERIFIED [spike e, 13:16 UTC, tx 02e300ef…409b]: keep the guardian as a weight-1 signer on Mum's account, but submit the undo as tx source = guardian's account, op source = Mum.
   - Funds go back to MUM (9949.99997 → 9999.99997 XLM).
   - Mum's `sequence` and `sequence_time` are UNCHANGED, so there's no clock conflict with a CAP-21 will and no fee burn on Mum.
   - Payment with the same construction → op_bad_auth, so there's still no spending power.
   - So the guardian bump, fee-burn and clock problems all disappear without making the daughter a claimant. The guardian's residual power is that she could deliberately make Mum the tx source and bump the seq, which only hurts her own recovery claim.
3. The policy co-signer table is good. Suggested final table:
   - Signers: Mum 1, Policy server 1, Guardian (daughter) 1.
   - Thresholds: low 1, medium 2, high 2. (Use high 3 if you want SetOptions to need all three; your call.)
   - The guardian's undo uses the op-source construction.
   - The recovery hatch is the SA-1 two-stage will: stage 1 adds nothing new (the guardian is already a signer); stage 2 raises the guardian to weight 2 after N days of Mum's silence. Mum's own tx activity is the heartbeat.
   - Policy-server liveness: Mum + Guardian = 2 overrides it.
   - [Verified pieces: spikes a, c, d, e. The combined table itself is an Assumption until one integrated spike, about 15 min]
4. P5: CB reserves are sponsorable via the Begin/EndSponsoringFutureReserves sandwich [Assumption, high confidence; the sponsored-reserves docs say "anything that increases the minimum balance can be sponsored"]. Not spiked.
5. Number for your User Value [Verified, Stellar Expert API 13:17 UTC]: mainnet Circle USDC on Stellar has 2,498,538 trustlines and 718,599 funded accounts.
6. S2 and S6 concessions noted. Loop's mechanics are proven, but your own concession on users and market is the decisive weakness for Round B.

### ~13:19 RECEIVED ← Ruthless Judge (hand-back report relayed)

The Judge's Round A hand-back, as relayed to me. Its scorecard: S1 ~74, S2 ~74.5, S3 ~72.5, S5 ~63, S4 ~58, S6 ~55. It states "the Guardian merge as two main flows is dead" because of the clock conflict. That conclusion predates my spike (e) answer (13:18), which shows the clock conflict is solved by the op-source construction. Its full text is in research/decision/06_debateA_ruthless_judge.md.

### ~13:19 RECEIVED ← Problem Hunter (hand-back report relayed)

The Problem Hunter's Round A hand-back, as relayed to me. It accepts the "non-secret will XDR" argument, plans to abandon S5, sees S4 likely dropped and S3 strengthened, and asked for the op-source spike and a demand number (both answered at 13:18). Its full text is in research/decision/06_debateA_problem_hunter.md.

---

## Raw spike output

```
### a_wi2.out
setOptions weights                               {"ok":true,"hash":"9145cd5a2cd567673a4f51bf37f21c43c05196c62369d126a01ba02ed250fc54"}
createClaimableBalance (parent signs)            {"ok":true,"hash":"0b12600faddabea241122a9bd49878e39538a61f09637fcd33277155fc494a7a"}
recipient claims early                           {"ok":false,"codes":"{\"transaction\":\"tx_failed\",\"operations\":[\"op_cannot_claim\"]}"}
guardian-only Payment from parent                {"ok":false,"codes":"{\"transaction\":\"tx_failed\",\"operations\":[\"op_bad_auth\"]}"}
guardian-only Claim (undo) on parent acct        {"ok":true,"hash":"58f700354c48e9b9003ff9e5b9fd27dcea7a76c30ae241505a6ddb7fd833ea3c"}
parent XLM before/after undo                     ["9899.9999700","9999.9999600"]
recipient claims after window                    {"ok":true,"hash":"9dc6c3549df6fbd26c495a222731b24989d8f645e9fc7bc07e31aa23231646d7"}
guardian-only setOptions (high)                  {"ok":false,"codes":"{\"transaction\":\"tx_failed\",\"operations\":[\"op_bad_auth\"]}"}
guardian-only bumpSequence (low)                 {"ok":true,"hash":"7e72ca758d60cdcf212c249146669536b70e18e902c1ffd43fc3d47e46b9f602"}
accounts {
  parent: 'GCDN6RLWKBLEWFWVZE242KQICSASIFKGNMYV5JW75XR775VQD6GWMPZN',
  guardian: 'GA2XMULG3OEEEBDGV7R6IFQSMAWZK3G3TWBDYUAH7PVMFLHMHYZP57YM',
  recip: 'GAQ7CIBSWX47MELEPC64GXBCSFHS7JH6SAGSV35JGDGQVJWXOCUJIZ7B'
}
### b_loop.out
B trusts AIOU                                {"ok":true,"hash":"b26b64139f8d641f33c2a9dedb6308a1e8be94a55544ad38a2e369e154c9033d"}
C trusts BIOU                                {"ok":true,"hash":"bbc51a85d16c56b1c30769180586f60ccc817c6ead049a9c4c818d1873d659a1"}
A trusts CIOU                                {"ok":true,"hash":"d36f7dd9604200de32e5636fd1b8f0b77fa83cb6621241e321d78f1d7fba7fe3"}
A->B 100 AIOU                                {"ok":true,"hash":"64b680028dfff3acd61ef0094c01bde20a52179d89bec72c1415a66bf3b480d3"}
B->C 100 BIOU                                {"ok":true,"hash":"73a2cae5f2aa0a7f098945da9271d18c48cb4d1460f3ee2f033727e53e3c7391"}
C->A 100 CIOU                                {"ok":true,"hash":"f4642737347ab3f07b899a37c0c508e46065bbc051697517ce2ab5dee44d8072"}
C passive offer sell BIOU buy CIOU           {"ok":true,"hash":"4d6b8f0f0ec0c3772fc6ff4e9b7827fd61dd4449c4f5721ab8e3f483ec07f8df"}
B passive offer sell AIOU buy BIOU           {"ok":true,"hash":"405b7dad76959a4c646a9276be59f150fe76a83fb81dcafc2da0c134e9b4edf5"}
A self path_payment_strict_send 60           {"ok":true,"hash":"fce432848b85dc0a21e196a13cc47f08dd8bc3be43d64a093d25968cf4f840c9"}
after: A holds CIOU 40.0000000 | B holds AIOU 40.0000000 | C holds BIOU 40.0000000
horizon strictSendPaths C->A found 1 paths: [["BIOU"]]
C remaining offer amount [ '40.0000000' ]
### c_heir.out
13:11:12 owner init bumpSequence                        {"ok":true,"hash":"31ec1a596e358127b0097458694b64c9895e470e299ab1fcf04fbba1ad6057ed"}
13:11:12 horizon sequence/sequence_time                 ["23115754505240577","1792933872"]
13:11:12 heir submits will immediately                  {"ok":false,"codes":{"transaction":"tx_fee_bump_inner_failed","inner_transaction":"tx_bad_minseq_age_or_gap"}}
13:11:37 owner normal payment (activity) at ~t+18s      {"ok":true,"hash":"948d793c625b42d69e583ea096766fd25a40a8d923709db2f7250a0f64617f57"}
13:11:57 heir submits ~t+38s (20s after activity)       {"ok":false,"codes":{"transaction":"tx_fee_bump_inner_failed","inner_transaction":"tx_bad_minseq_age_or_gap"}}
13:12:17 heir submits ~36s after activity               {"ok":true,"hash":"3932dad77f91997ae374444c0b7bae5de70b76393258bba779be29118c79f633"}
13:12:17 owner signers after                            [["GAFTIW",1],["GBVLJX",1]]
13:12:17 owner sequence after (jumped?)                 "23115758800207873"
13:12:32 owner2 revoke: bumpSequence to will seq        {"ok":true,"hash":"cde3502616a6b4cef11c7c80487373d4f549523b6b24db0c5ea0bf736bee6a66"}
13:12:40 heir submits revoked will                      {"ok":false,"codes":{"transaction":"tx_fee_bump_inner_failed","inner_transaction":"tx_bad_seq"}}
### d_twostage.out
13:15:07 stage2 before stage1                         {"ok":false,"codes":{"transaction":"tx_fee_bump_inner_failed","inner_transaction":"tx_bad_seq"}}
13:15:27 stage1 after 17s silence                     {"ok":true,"hash":"3eefd5f8c40a00bef6c4d679b17eea3f493bf402aaed380ec683d5d4e14773a8"}
13:15:27 heir(low) payment from owner                 {"ok":false,"codes":"{\"transaction\":\"tx_failed\",\"operations\":[\"op_bad_auth\"]}"}
13:15:28 stage2 immediately after stage1              {"ok":false,"codes":{"transaction":"tx_fee_bump_inner_failed","inner_transaction":"tx_bad_minseq_age_or_gap"}}
13:15:47 stage2 after 17s grace                       {"ok":true,"hash":"d5b4dd1912773c043030805c6e95c12b08c097f0fb1115661b0490f8916c4485"}
13:15:52 heir(high) payment from owner                {"ok":true,"hash":"414ad6f1eac998c41784eca9bb725e40b2b670f724814d46608e807806f2249a"}
### e_opsource.out
13:16:37 parent before: seq / sequence_time / XLM       ["23116029383147522","1792934197","9949.9999700"]
13:16:47 undo: tx src=guardian, op src=parent, guardian sig {"ok":true,"hash":"02e300ef69fa2812dee38cc20d2a3f353be87a50c0d7a4c08ccdb0644dbc409b"}
13:16:47 parent after: seq / sequence_time / XLM        ["23116029383147522","1792934197","9999.9999700"]
13:16:48 guardian payment op src=parent via own tx      {"ok":false,"codes":"{\"transaction\":\"tx_failed\",\"operations\":[\"op_bad_auth\"]}"}
```

## Addendum ~13:22: integrated S1 spike (f), requested by the Wildcard

Final S1 table: Mum 2 / Policy 1 / Guardian 1; thresholds low 1 / medium 3 / high 3. All checks behave as designed [Verified, testnet]:

| Check | Result | tx |
|---|---|---|
| setup | OK | 7a8fbe48… |
| (1) Mum alone Payment | **op_bad_auth** | — |
| (2) Mum+Policy Payment | OK | 85aeea3b… |
| (3a) Mum+Policy 24h CB (recipient NOT BEFORE T, Mum unconditional) | OK | 167349e9… |
| (3b) Guardian undo (tx src = guardian, op src = Mum) | OK; Mum XLM 9939.99995 → 9989.99995; Mum seq and seqTime unchanged | e4066132… |
| (4) Guardian+Policy Payment | **op_bad_auth** | — |
| (5) Guardian+Policy SetOptions (remove Mum) | **op_bad_auth** | — |
| (6) Mum+Guardian SetOptions (remove Policy) | OK | de4ecad5… |
| (7) Family account sponsors Mum's CB reserve (Begin/EndSponsoring sandwich) | OK; CB `sponsor` = family | 0f7b18bd… |

```
13:21:22 setup signers/thresholds                             {"ok":true,"hash":"7a8fbe4881c8d76f313122a180f1b14333f427026127a0f393b6aa63f0045ceb"}
13:21:22 (1) Mum alone Payment                                {"ok":false,"codes":"{\"transaction\":\"tx_failed\",\"operations\":[\"op_bad_auth\"]}"}
13:21:27 (2) Mum+Policy Payment                               {"ok":true,"hash":"85aeea3b80bf00780814c59977f6c773031fa548141d87d5b54b2be6bfdba2a1"}
13:21:32 (3a) Mum+Policy 24h CB                               {"ok":true,"hash":"167349e95c83afdcc0337658bbc1ca2a4212961ebf652cc2b4b21d2d971732ad"}
13:21:37 (3b) guardian undo (tx src guardian, op src Mum)     {"ok":true,"hash":"e40661324b08a6eeec4b3964b4c10ba8b626a6873c098315a49b73b5b637ddd5"}
13:21:37      Mum XLM / seq / seqTime before→after            ["9939.9999500","9989.9999500",true,true]
13:21:38 (4) Guardian+Policy Payment                          {"ok":false,"codes":"{\"transaction\":\"tx_failed\",\"operations\":[\"op_bad_auth\"]}"}
13:21:39 (5) Guardian+Policy SetOptions remove Mum            {"ok":false,"codes":"{\"transaction\":\"tx_failed\",\"operations\":[\"op_bad_auth\"]}"}
13:21:42 (7) sponsored CB: family sponsors Mum CB reserve     {"ok":true,"hash":"0f7b18bd6fcf8b02bde091078153a2348f280672e6df02ef89685077eb372c5c"}
13:21:42      CB sponsors                                     ["GB3VQW=family"]
13:21:47 (6) Mum+Guardian SetOptions remove Policy            {"ok":true,"hash":"de4ecad5a3ca22be29a6ef046c9a5e205b26dc2af23028fd281aa553fc4f0a3e"}
```

### ⚠ CORRECTION 15:00 (spike o) [V]
My Round A note that a guardian's failed `op_bad_auth` attempts "burn the parent's fees" is **wrong**. `op_bad_auth` is rejected at validation: no fee is charged and no seq is consumed.
