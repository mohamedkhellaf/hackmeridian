# 06 — Debate Round A log (Wildcard Inventor)

Every message the Wildcard Inventor (WI, agent a478580ad9cad690f) sends or receives, verbatim, with time (WET = UTC) and sender/recipient.

## 13:10 WET — SENT WI → Stellar Architect (afa57e164c5df066c): attack on S3/S4

```
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
```

## ~13:10 WET — RECEIVED Stellar Architect (afa57e164c5df066c) → WI: attack on S1/S2/S6

```
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
```

## ~13:11 WET — RECEIVED Problem Hunter (ade2988c3cf167d97) → WI: attack on S1/S2/S6

```
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
```

## ~13:13 WET — RECEIVED Ruthless Judge (ac72ecdbce496fda1) → WI: attack on S1 (+Guardian), S2, S6

```
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

## 13:13 WET — SENT WI → Problem Hunter (ade2988c3cf167d97): attack on S5

```
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
```

## ~13:15 WET — RECEIVED Stellar Architect (afa57e164c5df066c) → WI: SPIKE EVIDENCE

```
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
```

## ~13:17 WET — RECEIVED Problem Hunter (ade2988c3cf167d97) → WI: reply on S5

```
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
```

## ~13:18 WET — RECEIVED Stellar Architect (afa57e164c5df066c) → WI: reply on S3/S4

```
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
```

## 13:15 WET — SENT WI → Ruthless Judge (ac72ecdbce496fda1): replies on S1/S2/S6

```
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

## 13:16 WET — SENT WI → Stellar Architect (afa57e164c5df066c): replies on S1/S2/S6 + S3/S4

```
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
```

## 13:17 WET — SENT WI → Problem Hunter (ade2988c3cf167d97): replies on S1/S2/S6

```
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
```

## ~13:22 WET — RECEIVED Ruthless Judge (ac72ecdbce496fda1) → WI: follow-up

```
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

## ~13:24 WET — RECEIVED Stellar Architect (afa57e164c5df066c) → WI: on S1 redesign + spike e

```
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
```

## 13:18 WET — SENT WI → Ruthless Judge (ac72ecdbce496fda1): answers to follow-up A–D

```
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

## ~13:26 WET — RECEIVED Problem Hunter (ade2988c3cf167d97) → WI: follow-up on S1

```
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
```

## 13:19 WET — SENT WI → Problem Hunter (ade2988c3cf167d97): reconciliation on S1

```
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
```

## 13:19 WET — SENT WI → Stellar Architect (afa57e164c5df066c): adopt spike-e + integrated-spike request

```
Wildcard Inventor adopts the Architect's spike-e construction and final table for S1, and asks for one ~15-minute integrated spike.

- Regression CONCEDED. The guardian is no longer a claimant. Claimants are {recipient NOT BEFORE T, Mum unconditional}. Undo uses tx source = guardian, op source = Mum. [V tx 02e300ef…409b]
- Final table: Mum 1 / Policy 1 / Guardian 1. Thresholds: low 1, medium 2, high 2. No separate recovery key. Mum + guardian override a dead or "freezing" server.
- Disclosed residual: guardian + policy = 2 could pay; the policy server refuses guardian-initiated payments.

Request: one ~15-minute integrated spike of the final table, if you have time before Round B. Four checks:
(1) Mum alone signs a Payment → op_bad_auth
(2) Mum + policy co-sign a Payment → OK
(3) Mum + policy create the 24h CB → OK; then the guardian undoes it via spike e → OK
(4) Mum + guardian remove the policy signer (SetOptions) → OK
Optional, if cheap: a sponsored CB reserve.

Your 718,599 funded-USDC-accounts number is now in my user argument, credited to you. S3/S4: agreed on the lost-keys reframe and the two-stage will. I'd keep S3 only as S1's liveness/incapacity hatch (a stretch goal), not as a second hero flow.
```

## ~13:30 WET — RECEIVED Problem Hunter (ade2988c3cf167d97) → WI: threshold fix

```
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
```

## 13:19 WET — SENT WI → Problem Hunter (ade2988c3cf167d97) AND → Stellar Architect (afa57e164c5df066c), identical text: accept threshold fix

```
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
```

## ~13:33 WET — RECEIVED Ruthless Judge (ac72ecdbce496fda1) → WI: Chairman ruling relay + MoneyGram evidence

```
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

## ~13:33 WET — RECEIVED (via harness) Problem Hunter (ade2988c3cf167d97) hand-back report — summary only, verbatim text lives in research/decision/06_debateA_problem_hunter.md

PH confirms: the Wildcard accepted the reconciliation; PH flagged the guardian+policy=2 hole and sent the Mum 2 / Policy 1 / Guardian 1, low 1 / med 3 / high 3 fix. PH's Round B position: S1 re-seated (or Guardian-lite) is #1 conditional on the weight fix; S3 is #2; S2 is high-variance; S5 is abandoned; S4 and S6 are dropped by their authors.

## ~13:35 WET — RECEIVED (via harness) hand-back reports from Problem Hunter and Ruthless Judge — summaries only; verbatim in their own logs

- **Problem Hunter (06_debateA_problem_hunter.md):** final S1 weights Mum 2 / Policy 1 / Guardian 1, low 1 / med 3 / high 3, still to be confirmed by the integrated spike. Round B: S1 re-seated or Guardian-lite is #1 (conditional on the spike), S3 #2, S2 high-variance, S5 abandoned.
- **Ruthless Judge (06_debateA_ruthless_judge.md):** leans S1 re-pitched at ~75 vs S2 Loop ~74.5. MoneyGram/Crossmint is not a drop-in channel; S1 is pitched to LOBSTR-class G-account wallets, ~719k funded USDC accounts. Guardrails: don't claim the allowlist is protocol-enforced; disclose that guardian + server compromise is a risk (note: the PH's med-3 fix removes the guardian+server payment path); label personas as illustrative. S4/S5/S6 abandoned; S3 works best as S1's backup exit.

## 13:20 WET — SENT WI → Chairman (main), via final hand-back: Round A summary

```
Wildcard Inventor's Round A summary for the Chairman. The full verbatim log is in research/decision/06_debateA_wildcard_inventor.md.

ATTACKS I SENT
- S3 Heirloom (Architect):
  - Liana on Bitcoin is a near-analog, so "impossible elsewhere" is dropped.
  - Proposed and ACCEPTED by the Architect: the lost-keys reframe and a two-stage will (low-weight warning first, then high).
  - Per-heir % split is not native (conceded).
- S4 FairSeat (Architect):
  - DICE already does face-value resale with a waiting list, so the approval server is "a database with extra steps".
  - My "SDEX as waiting list" idea needs a maintain-liabilities fill spike.
  - The Architect now leans ABANDON.
- S5 PrizeLock (Problem Hunter):
  - Matcherino already escrows and pays out grassroots prize pools in 120+ countries.
  - Sponsor-locked claimable-balance pledges were called "the best S5 idea", but the Judge's drawer-tx hole remains.
  - The Problem Hunter now leans ABANDON.

DEFENCE OF MY CONCEPTS (evidence: Architect testnet spikes)
- S1 Second Thought: original sender-side claim CONCEDED (Mum weight 2 = app-level window), now REDESIGNED.
  - Final table: Mum 2 / Policy co-signer 1 / Guardian 1; thresholds low 1, medium 3, high 3 (Problem Hunter's fix). Guardian undo: tx source = guardian, op source = Mum.
    - [V spike e, tx 02e300ef: funds back to Mum, her seq/seqTime unchanged, guardian Payment → op_bad_auth]
    - Protocol-enforced: no single key and not guardian+server can move funds; early claim → op_cannot_claim [V]; undo.
    - Policy-enforced: the known-payee allowlist.
  - One external dependency: our serverless policy co-signer. Mum + guardian override it, so it can't freeze her.
  - User re-seated: classic G-account USDC holders (718,599 funded USDC accounts on mainnet [V, Architect]) via an SDK for LOBSTR-class wallets.
    - MoneyGram/Crossmint is NOT a drop-in channel (smart/embedded wallet) [V Judge].
    - US/EU elders: conceded.
  - One hero flow: the network refuses a stranger's early claim, the daughter taps Undo, the money is back. About 12h before polish.
  - PENDING: an integrated spike of the final table. I sent the Architect a 6-check list.
- S2 Loop: mechanics VERIFIED [spike, tx fce43284: 3-firm cycle cleared by ONE self-payment; Horizon pathfinding found the cycle].
  - CONCEDED: no named users, privacy unsolved, cold start, UV/MEP ≈ 2.
  - The Judge rescored S1 ≈ 74 and Loop ≈ 74.5, a tie.
- S6 Stamp: CONCEDED and ABANDON. The x402 payTo is a G-account (custodial or not x402), there is no forcing function, and LinkedIn InMail already refunds on reply [V].

MY POSITION GOING INTO ROUND B
- Back S1 (Guardian-lite: the S1 table plus an optional SA-1 liveness hatch as stretch).
- Flip to Loop only if the integrated spike fails, or if no G-account wallet channel is credible.
```

## ~13:37 WET — RECEIVED Stellar Architect (afa57e164c5df066c) → WI: INTEGRATED S1 SPIKE (f)

```
INTEGRATED S1 SPIKE (f): all checks pass. Testnet, 13:21 UTC. Table: Mum 2 / Policy 1 / Guardian 1; thresholds low 1, med 3, high 3. [Verified]
(1) Mum alone Payment → op_bad_auth
(2) Mum + Policy Payment → OK (85aeea3b…)
(3a) Mum + Policy 24h CB (recipient NOT BEFORE T, Mum unconditional) → OK (167349e9…)
(3b) Guardian undo with tx src = guardian, op src = Mum → OK (e4066132…)
     - Mum XLM 9939.99995 → 9989.99995
     - Mum seq and seqTime UNCHANGED
(4) Guardian + Policy Payment → op_bad_auth
(5) Guardian + Policy SetOptions (master weight 0) → op_bad_auth
(6) Mum + Guardian SetOptions removing Policy → OK (de4ecad5…)
(7) Optional: a family account sponsors Mum's CB reserve via the Begin/EndSponsoring sandwich → OK (0f7b18bd…); the CB's `sponsor` field = family

So "guardian can never spend, even with a compromised server" is protocol-enforced, and so are "Mum can't bypass from another wallet" and the family override.

One note for your design: in (3a) and (2), Mum is the tx source, so normal sends reset her seqTime. That is correct heartbeat behaviour if you add the SA-1 hatch.

Everything is logged in research/decision/06_debateA_stellar_architect.md.
```

## ~13:38 WET — SENT WI → Stellar Architect (afa57e164c5df066c): ack spike f

```
Wildcard Inventor acknowledges integrated spike (f). Thank you, it closes the last open item on S1.
- All 6 checks plus the sponsored-reserve check passed, so the final table (Mum 2 / Policy 1 / Guardian 1; low 1, med 3, high 3) is now [V] testnet-verified.
- I'll cite these tx hashes in Round B: 85aeea3b, 167349e9, e4066132, de4ecad5, 0f7b18bd.
- Heartbeat note understood: Mum-sourced sends reset her seqTime, which is the correct behaviour for the optional SA-1 hatch.
- My Round B position is unchanged: back S1 (Guardian-lite), with Loop as the fallback.
```

