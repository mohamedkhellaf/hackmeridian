# 07: Debate Round B log (Problem Hunter)

Times are in WET (= UTC). Every message is copied verbatim.

---

## [~13:33] SENT → Ruthless Judge (ac72ecdbce496fda1): S5 formal decision

ROUND B, the Problem Hunter's formal decision on S5 PrizeLock: ABANDON. No fold, no combination.

Reasons:
1. The cure doesn't match the evidenced pain. YaLLa, GXR and GESC failed because the money never existed [V]. Locking only protects pools that are already funded, i.e. the honest organizers (TOs). This is the Judge's W1, which I conceded.
2. No real guarantee without custody.
   - TO + referee (REF) can co-sign a hidden "drawer" tx at the same seq, which no verifier can see [V semantics].
   - The only fix is an independent referee, which would be us. That makes it custodial escrow, in a category with 0/34 winners.
3. The incumbent exists: Matcherino pays out grassroots prize pools in 120+ countries [V, the Wildcard's sources].
4. Track Alignment is 3/5 at best in either form, native or as a ranking-only contract (the Architect agrees).
5. Demand for the cure is unproven. I found no publisher rule and have no TO quote [V absence in my searches].

What I keep from it:
- The "drawer-tx" lesson. Any guarantee built on one pre-signed tx can be undone by an invisible alternative at the same seq.
- The S1 weight fix (Mum 2 / policy 1 / guardian 1, thresholds 1/3/3), which came out of the same adversarial habit.

---

## [~13:33] SENT → Wildcard Inventor (a478580ad9cad690f): S5 formal decision

ROUND B, the Problem Hunter's formal decision on S5 PrizeLock: ABANDON. No fold, no combination.

Reasons:
1. The cure doesn't match the evidenced pain: those failures were money that never existed [V].
2. The "drawer-tx" collusion hole means no real guarantee without custody, and custody is escrow, a category with 0/34 winners.
3. Matcherino is the incumbent (your sources [V]).
4. TA is 3/5 at best.
5. Demand for the cure is unproven.

Your sponsor-pledge claimable-balance idea was the best upgrade proposed, but it still lands in a TO+REF-controlled pool.

My real-problem/real-solution analysis of S1 and S2 follows in a separate message.

---

## [~13:33] SENT → Stellar Architect (afa57e164c5df066c): S5 formal decision

ROUND B, the Problem Hunter's formal decision on S5 PrizeLock: ABANDON. No fold, no combination.

Reasons:
1. The cure doesn't match the evidenced pain (money that never existed [V]).
2. TO+REF "drawer-tx" collusion means no guarantee without custody, and custody is escrow, a category with 0/34 winners.
3. Matcherino is the incumbent [V].
4. TA is 3/5 at best, native or as a ranking-only contract (your assessment, which I accept).
5. Demand for the cure is unproven.

My real-problem/real-solution analysis of S3 follows in a separate message.

---

## [~13:40] SENT → Wildcard Inventor (a478580ad9cad690f), cc Judge in content: S1/S2 real-problem test

ROUND B, Problem Hunter: REAL-PROBLEM / REAL-SOLUTION test on S1 and S2 (cc Judge).

== S1 SECOND THOUGHT (redesigned: Mum 2 / policy 1 / guardian 1, thresholds 1/3/3, 24h claim window for new payees, guardian undo) ==

(a) Problem: an older family member is tricked into an urgent one-off payment to a "new number", and the money is gone instantly and irreversibly.
- Evidence the scam type is real and hits older people:
  - [V] Australia's ACCC reports that in family-impersonation ("Hi Mum") scams, 82% of reports came from people aged 55+, accounting for 95% of losses. 1,150+ victims and $2.6M lost in 7 months of 2022 (https://www.scamwatch.gov.au/about-us/news-and-alerts/accc-warning-of-suspicious-messages-as-%E2%80%9Chi-mum%E2%80%9D-scams-spike).
  - [V] Spain: 238 victims in Alicante alone lost ~€850k to "child in need" scams; 102 people detained (https://gazettengr.com/hi-mum-fraud-police-capture-102-people-over-child-in-need-scams/; check the original date).
  - [V] Crypto-specific: Chainalysis reports impersonation scams grew ~1,400% YoY in 2025, with record total scam losses of $14–17B (https://decrypt.co/354624/ai-impersonation-drove-crypto-scam-losses-record-17-billion-2025-chainalysis).
- Evidence for the SPECIFIC first user (a Stellar classic-account USDC holder who is hit): [U]. I found no data on scams against Stellar or self-custody stablecoin wallets specifically. Population floor: 718,599 funded USDC accounts [V, the Architect via Stellar Expert].

(b) Does the mechanism RESOLVE the problem? YES for the impulsive family-impersonation subtype, and better than I first thought:
- In a "Hi Mum" scam, the person being impersonated IS the guardian.
- When the real daughter gets "Mum sent €900 to a new payee", she knows instantly it wasn't her. Detection is near-certain, and the 24h window is far longer than she needs.
- The undo returns the funds to Mum, with no spending power for the guardian (spike e [V]).
- Evidence that holds and friction help in practice:
  - [V] Australian banks' Scam-Safe Accord (confirmation of payee, warnings, payment delays) coincided with scam losses falling ~26% to $2.0B in 2024. Causality is claimed by the banking association (ABA), not independently shown (https://www.ausbanking.org.au/new-data-shows-further-inroads-in-the-war-against-scammers/).
  - [V via your link] The UK allows PSPs to delay suspicious payments by up to 4 days.
- It only RELATES to (does not resolve) groomed long-con investment / pig-butchering scams, where the victim re-confirms. Those are the bigger dollar category ($5.8B in IC3 [V]). The pitch must claim impersonation/urgent-payment scams only.

(c) Strongest remaining gap:
- The disagreement is about ONE assumption: that the at-risk older person keeps money in a classic-G-account USDC wallet. [U, no data.]
- The channel is "a feature LOBSTR-class wallets ship", but there's no wallet partner signal [U].
- Second gap: the policy co-signer is a server we operate. It's honest and labelled, but it's the one critical-path dependency.

== S2 LOOP ==

(a) Problem: SMEs are paid late and so pay their own suppliers late, a contagion of trade credit that drains liquidity.
- [V] The European Commission says ~1 in 4 EU bankruptcies are rooted in late payment, and about half of commercial invoices are paid late (Council doc ST-6586-2024 and the Commission proposal summaries, https://data.consilium.europa.eu/doc/document/ST-6586-2024-REV-1/en/pdf).
- [V] Portugal: late payments to SMEs rose from 15 to 17 days in 2024 (B2B), per OECD citing Intrum (https://www.oecd.org/en/publications/financing-smes-and-entrepreneurs-2026_075d8058-en/full-report/portugal_d2404454.html).
- [V] Portugal: "late receipts lead 60% of Portuguese companies to delay payments" (DN/Intrum, https://www.dn.pt/empresas/recebimentos-tardios-levam-60-das-empresas-portuguesas-a-atrasar-pagamentos-diz-estudo). That's direct evidence of CHAINS.
- [V] Cycles do exist in real SME networks:
  - Sardex (1,477 firms, 48,170 transactions): "geodesic transaction cycles are prevalent" (Iosifidis et al., Nature Human Behaviour 2018, https://link.springer.com/article/10.1038/s41562-018-0450-0).
  - Obligation clearing alone cut net internal debt by ~25% on Sardex data (Fleischman, Dini & Littera, JRFM 2020).

(b) Does the mechanism RESOLVE the problem? PARTIALLY.
- Netting cancels only CLOSED cycles. The evidenced Portuguese pain is mostly LINEAR chains (big customer pays late → SME delays its suppliers). Netting does nothing there.
- Where cycles exist, the realistic gain is ~25% of debt [V, Sardex], measured on a ~1,500-firm network.

(c) Strongest remaining gap:
- I disagree with Loop's demo assumption that "a 5-firm cluster has closed cycles" [Speculation]. The published evidence finds cycles at network scale (~1,500 firms), not in a hand-onboarded handful. So the MVP proves the mechanism but not the value for a first user.
- The first-user value needs a platform that already holds the invoice graph [U, no named partner].
- Privacy of public payables is still unsolved.

== Verdict (my lens) ==
- S1 now passes "real problem + mechanism resolves it" for a precisely scoped subtype (family impersonation), with the impersonated child as guardian. That's a tight problem→cure fit.
- S2 passes "real problem" strongly but "resolves it" only partially and only at scale.
- I rank S1 > S2 on User Value, and S2 > S1 on Innovation/Track.

---

## [~13:40] RECEIVED ← Stellar Architect (afa57e164c5df066c): formal decisions on S3/S4

ROUND B: the Stellar Architect's formal decision on S3 Heirloom and S4 FairSeat. The same text goes to all three peers. Your S5 abandon is noted and agreed.

S4 FairSeat → (4) ABANDON.
Under the "real evidenced problem, and does the MVP resolve it" test it fails on both counts:
- The pain is concentrated in mega-events [Assumption, your point, uncontested].
- Face-value resale exists centrally (DICE [Verified]) and is becoming UK law (Ticket Tout Ban Bill [Verified, your link]).
- The MVP doesn't resolve it, because the scalper sells the account key [conceded].
No fold.

S3 Heirloom → (3) COMBINE as S1's optional recovery hatch (stretch goal). It is not standalone.
- Why not standalone: your critique holds. The problem is real but the evidence is weak and old (89% worry, 23% have a plan [Verified, your link, 2019–20]). I have no Stellar-specific loss number [Unknown]. There are 4+ prior Stellar builds [Verified].
- Why it fits S1:
  - S1's final table (Mum 2 / Policy 1 / Guardian 1; low 1 / med 3 / high 3 [Verified, spike f]) has one unhandled failure: Mum loses her key, is incapacitated or dies.
  - Then Guardian + Policy = 2 < 3, so the funds are frozen forever.
  - Heirloom closes it: a pre-signed SetOptions (minSeqNum S, minSeqAge e.g. 180d) raises the guardian to weight 2 after N days of Mum's silence.
  - Mum's sends are the heartbeat. Guardian undos don't reset the clock [Verified, spikes e and f].
  - Revocable by one BumpSequence [Verified, spike c].
- Build cost about 2h, behind a flag, cut first if the schedule slips.

I'm reading your separate S3 analysis when it arrives. If it argues S3 shouldn't even be a hatch, I'll respond on the merits.

---

## [~13:40] RECEIVED ← Ruthless Judge (ac72ecdbce496fda1): crux list S1 vs S2

Judge's crux list for S1 (Second Thought, re-pitched) vs S2 (Loop). Please reply with the ONE crux you'd bet against, and why.

These are the assumptions that actually decide the contest. Labels: [V] verified, [A] assumption, [S] speculation, [U] unknown. Current scores: S1 ≈ 75, S2 ≈ 74.5.

S1's design, as of now: Mum 2 / policy server 1 / guardian 1, thresholds 1/3/3 (the Problem Hunter's fix). This also closes the guardian + server collusion I raised in Round A, since 1+1 < 3.

CRUX 1: "A 24h hold plus a guardian alert actually prevents losses from the scams a Stellar G-account holder realistically faces (impostor / family-emergency / 'safe account')."
- Evidence: institutions use delays as an anti-fraud tool. UK PSPs may hold outbound payments up to 4 business days on APP-fraud suspicion [V FCA FG24/6], and Kraken holds withdrawals to new addresses for 24h [V].
- There is NO effectiveness study [U]. Groomed investment-scam victims (the bulk of the $2.8B) re-confirm and fight the guardian [A].
- Status: A.
- Cuts: if it's false, S1's MVP doesn't resolve the evidenced problem, and S2 wins. This is the Problem Hunter's real-solution test.

CRUX 2: "A real distribution path exists for S1. Either a G-account wallet (LOBSTR-class) ships a 2-of-3 co-signer plus guardian, or users adopt a new wallet for it."
- Evidence:
  - About 719k mainnet G-accounts hold USDC [V Stellar Expert].
  - MoneyGram/Crossmint is NOT a drop-in channel: it uses a smart wallet with email login [V Crossmint case study; C-address status U].
  - Wallet partner interest is [S].
  - A new standalone consumer wallet is the most crowded Stellar category [V Scout: wallet 89 builds].
- Status: S.
- Cuts: if it's false, S1 is "yet another wallet", Market and Ecosystem Potential drops to about 2, and the result is a tie or S2.

CRUX 3: "At the margin, the judges reward Adoption (user value, 'my mom') over Discovery (protocol novelty)."
- Evidence:
  - The official priority order is "Adoption → Discovery → Continuation" [V hackmeridian.com/build].
  - Wlad said "a project my mom can understand and use" [V-verbal, 10/22 dev meeting].
  - Elliot said the off-the-wall ones stand out most [V-verbal].
  - Track Alignment (20%) is S2 5 vs S1 4.5 [A, my scores].
- Status: partly V, but the weighting is A.
- Cuts: toward S1, mildly.

CRUX 4: "Loop's problem is solvable on a public ledger. SMEs (or a platform acting for them) would accept a public trade-debt graph, and a cross-platform, cross-border cluster exists where no central netting operator already does it."
- Evidence:
  - Prior Stellar netting builds used ZK precisely to hide the graph [V SettleZK, zkNexus].
  - Slovenia's AJPES does netting centrally, as a database [V].
  - No first cluster has been named [V absence]. A cross-border cluster is [S].
- Status: S/U.
- Cuts: if it's false, S2's MVP demonstrates a mechanism with no real buyer, and S1 wins.

CRUX 5: "A judge grasps the 'aha' in a ≤3-minute video."
- S2 needs a 3-hop IOU graph explained.
- S1 needs a 2-of-3 + claimable-balance story, but its refusal moments are self-explanatory.
- Evidence: the judges test products "as users" [V-verbal]. Comprehension cost is [A].
- Cuts: toward S1, unless S2's graph animation is excellent.

(Watch item, not a crux: AI-twin risk. Four models converged on S1 [V, internal]. Scout shows no claimable-balance undo builds and no trustline-credit builds [V]. "Elder-safe wallet" as a domain will have twins, usually AI-scam-detection wallets [S]. Mildly favours S2.)

My position stays independent: S1 by a hair, conditional on Crux 1 and Crux 2. The single cheapest test is Crux 2: can anyone name a G-account wallet or anchor whose public roadmap or docs mention multisig co-signing or guardians?

---

## [~13:45] SENT → Stellar Architect (afa57e164c5df066c), cc Judge in content: S3 real-problem test + hatch catch

ROUND B, Problem Hunter: REAL-PROBLEM / REAL-SOLUTION test on S3 Heirloom (cc Judge). I agree with your COMBINE-as-hatch decision. Here is the test, plus one design catch.

(a) Problem: self-custodied funds become permanently inaccessible when the owner dies, is incapacitated, or loses their key.
- [V] Only 23% of crypto holders have a documented plan, though 89% worry (Cremation Institute, n=1,150, 2019–20; old).
- [U] No Stellar-specific loss data.
- Standalone, it's a real but weakly evidenced problem with 4+ prior builds. Your decision not to go standalone is right.
- Inside S1 the problem becomes CONCRETE and self-created: with Mum 2 / Policy 1 / Guardian 1 and thresholds 1/3/3, if Mum dies or loses her key, Guardian + Policy = 2 < 3 and the funds are frozen forever.
- So the hatch is not a feature looking for a user. It closes a failure mode our own design introduces, and a judge WILL ask "what if Mum dies?"

(b) Does it resolve the problem? YES, mechanically.
- [V spikes c/d/e/f] Pre-signed SetOptions raising the guardian to 2 after N days of silence, revocable by BumpSequence, not reset by guardian undos.

(c) Strongest gap, a DESIGN CATCH:
- S1's persona is a remittance RECEIVER. Incoming payments are NOT sourced by Mum's account, so they don't reset seqTime [A from CAP-21 semantics: seqTime updates on the tx source account].
- A mother who mostly RECEIVES and rarely SENDS would look "silent" and falsely trigger the hatch. The guardian would then get weight 2, and Guardian + Policy = 3 could spend.
- Mitigation:
  - The app auto-submits a no-op BumpSequence heartbeat whenever Mum opens it. Low threshold, Mum's key alone, ~100 stroops.
  - Use a conservative window (180d) and your two-stage form (low-weight warning first) if time allows.
- Please confirm by spike: a BumpSequence sourced by Mum resets seqTime (you showed this for revocation). And: an inbound payment does NOT reset it.

The disagreement, if any, rests on one assumption:
- You treat "Mum's sends are the heartbeat" as sufficient [A]. For a receiver persona I think it's insufficient without the app-open heartbeat.
- Otherwise: hatch behind a flag, ~2h, cut first. Agreed.

Separately, for Crux 2 (distribution): [V] LOBSTR already ships LOBSTR Vault, a multisig co-signer app for G-accounts with push-notification approvals (https://github.com/Lobstrco/Vault-iOS).
- So the largest Stellar retail wallet already runs the "second signer on a G-account" pattern at scale. S1's policy/guardian model is a natural extension of it, not an alien architecture.
- [S] whether LOBSTR would adopt it.

---

## [~13:45] SENT → Ruthless Judge (ac72ecdbce496fda1): crux bet + Crux 2/1 evidence + cc of S1/S2/S3 tests

ROUND B, Problem Hunter to the Judge: my crux bet, new evidence on Crux 2 and Crux 1, and a cc of my S1/S2/S3 tests.

THE CRUX I'D BET AGAINST: CRUX 4 (Loop's public-ledger solvability and first-cluster existence). Reasons:
- [V] Loop's own prior art (SettleZK, zkNexus) reached for ZK precisely because firms won't expose payables. That's revealed preference from builders who studied the same problem.
- [V] The cycle evidence is at NETWORK scale: Sardex has 1,477 firms, cycles are "prevalent", and clearing gives ~25% net debt reduction (Nature Human Behaviour 2018; JRFM 2020). A hand-onboarded 5-firm cluster is unlikely to contain closed cycles [S].
- [V] The evidenced Portuguese pain is LINEAR chains. "Late receipts lead 60% of Portuguese companies to delay payments" (DN/Intrum, https://www.dn.pt/empresas/recebimentos-tardios-levam-60-das-empresas-portuguesas-a-atrasar-pagamentos-diz-estudo). Late payments to SMEs rose from 15 to 17 days in 2024 (OECD citing Intrum). EU: ~1 in 4 bankruptcies stem from late payment [V Council ST-6586-2024]. Netting does nothing for linear chains.
- So S2's problem is strongly real, but its MVP resolves it only partially, and only once a platform with the invoice graph exists [U].

CRUX 2 (S1 distribution): NEW EVIDENCE, it moves from S toward A.
- [V] LOBSTR, the largest Stellar retail wallet, already ships LOBSTR Vault: a separate signer app that adds a co-signer key to G-accounts, with push-notification approval and N-of-M support. Docs say you can detect protection by its signer key in account.signers (https://github.com/Lobstrco/Vault-iOS).
- So "a second signer on a classic account" is an already-deployed pattern on Stellar. S1's policy/guardian model is an incremental feature for that wallet class, not a new wallet category.
- Differentiation vs Vault: Vault makes the co-signer approve EVERY tx (friction). S1 lets known payees through instantly and only routes new payees through a 24h undo window. The guardian acts on exceptions only.
- [S] whether LOBSTR would want it.

CRUX 1 (does a hold plus guardian prevent the losses?): partly evidenced, and stronger for the right subtype.
- [V] Family-impersonation ("Hi Mum") scams: per the ACCC, 82% of reports come from people aged 55+, accounting for 95% of losses (https://www.scamwatch.gov.au/about-us/news-and-alerts/accc-warning-of-suspicious-messages-as-%E2%80%9Chi-mum%E2%80%9D-scams-spike). Spain: 238 victims, €850k in Alicante alone [V].
- In that subtype, the impersonated child IS the guardian, so detection within 24h is near-certain [A, strong]. The mechanism resolves it.
- [V] Australia's Scam-Safe Accord (CoP, warnings, payment delays) coincided with a ~26% drop in scam losses in 2024. Causality is ABA-claimed, not independently shown (https://www.ausbanking.org.au/new-data-shows-further-inroads-in-the-war-against-scammers/).
- [V] Chainalysis: crypto impersonation scams grew ~1,400% in 2025.
- It does NOT resolve groomed investment scams. The pitch must scope to impersonation/urgent-payment scams.

S3 (cc): I agree with the Architect's COMBINE-as-hatch. Inside S1 it closes a failure mode S1 itself creates (Mum dies → Guardian + Policy = 2 < 3 → funds frozen).
- Design catch I sent him: a remittance RECEIVER rarely sends, and inbound payments don't reset seqTime [A]. That makes false triggers a risk. Fix: an app-open BumpSequence heartbeat plus a 180d window.

My current ranking: S1 (scoped to impersonation scams, with the hatch as a stretch goal) > S2. Same as before Round B, but now on better evidence.

---

## [~13:47] RECEIVED ← Wildcard Inventor (a478580ad9cad690f): formal decisions S1 IMPROVE / S2 IMPROVE (fallback) / S6 ABANDON

ROUND B: the Wildcard Inventor's formal decisions are S1 IMPROVE (staked), S2 IMPROVE (fallback only) and S6 ABANDON. The same text goes to the Judge, the Architect and the Problem Hunter.

Labels: [V] = verified (link or testnet tx), [A] = assumption, [S] = speculation, [U] = unknown dependency.

=== S1 SECOND THOUGHT: (2) IMPROVE. This is where I stake the team's 20 hours. ===

PROBLEM (one sentence): a Stellar self-custody USDC wallet is one key and one signature away from an irreversible loss, so an urgency scam or a phished key empties it in five seconds, with no bank to call and no way back.

FIRST USER (illustrative persona, no testimonial):
- An older, non-technical holder of a classic G-account USDC wallet (LOBSTR-class) who receives dollars from family abroad, with an adult child acting as guardian.
- Example: "Ana, 61, Medellín, receives her son's USDC from Lisbon", labelled illustrative.

EVIDENCE THAT THIS USER HAS THE PROBLEM:
(a) The population exists: 718,599 funded Circle-USDC accounts on Stellar mainnet. [V, Stellar Expert API via the Architect, 13:17 UTC]
(b) The harm is large and concentrated in the two patterns we target:
    - Imposter scams were $2.95B of US reported losses in 2024, the #1 category by report count. [V https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024]
    - US 60+ crypto-scam losses were $2.84B. [V The Block / IC3 coverage]
    - UK APP fraud was £450.7m in 2024. [V]
(c) The irreversibility gap is recognised by regulators and exchanges:
    - UK PSPs may now delay suspicious payments up to 4 business days. [V FCA FG24/6]
    - Kraken holds withdrawals to new addresses for 24h after a credential change. [V]
    - Self-custody Stellar wallets offer neither. [A]
(d) NOT evidenced: how many of the 718k are older or scam-targeted, and any Stellar-specific scam-loss figure. [U]
    - This is the largest assumption in my case: "Stellar's self-custody USDC holders face the same imposter-scam exposure as the general population." [A]

FINAL SPEC (one paragraph):
- Signers on the user's classic account: Mum 2 / our policy co-signer 1 / guardian 1. Thresholds: low 1, medium 3, high 3.
- Payments to allowlisted payees are co-signed instantly by the policy function.
- Payments to anyone new are co-signed ONLY as a claimable balance, with claimants {recipient: NOT_BEFORE now+24h; Mum: unconditional}.
- The guardian gets an alert. She can Undo with a guardian-sourced tx whose op source is Mum, so the funds return to Mum and Mum's sequence is untouched.
- Adding an allowlisted payee takes a 24h cool-off plus a guardian alert.
- Mum + guardian can override or remove the policy function, so it can't freeze her.
- Demo assets: a self-issued test USDC (or XLM); sponsored reserves are optional.
- ONE hero flow: the stranger's early claim is refused, the daughter taps Undo, the money is back. Supporting beats: Mum's key in another wallet → refused, and the guardian trying to pay herself → refused.
- Every guarantee in this paragraph is testnet-verified in integrated spike (f) at 13:21 UTC: 85aeea3b, 167349e9, e4066132, de4ecad5, 0f7b18bd, plus op_bad_auth on Mum alone, on guardian + policy paying, and on guardian + policy changing signers. [V]

WHY IT STOPS THE HARM:
- The harm mechanism is "one key → instant final settlement to a stranger".
- The design removes both halves at protocol level:
  (1) No single key can move funds: Mum alone (2 < 3), a thief with Mum's key alone, and guardian + a compromised server (2 < 3) all get op_bad_auth. [V spike f]
  (2) Every payment to a new recipient sits in a validator-enforced 24h window during which a second, un-manipulated human can pull it back. [V spike f]
- Only the "which payee is known" rule lives in our server. [stated honestly]

SCAM PATTERNS IT STOPS:
(i) Urgency imposter / family emergency / "safe account": the "Mum, new number, send now" pattern, where the victim pays a NEW recipient and the 24h window plus a guardian alert breaks the urgency. [A on effectiveness; the delay rationale is the same as the UK's 4-day power, V]
(ii) Key or seed phishing: a thief holding only Mum's key cannot move anything. [V spike f, op_bad_auth]

PATTERNS IT DOES NOT STOP:
(i) Long-con investment / pig butchering, where the victim re-confirms and the guardian doesn't intervene or is persuaded. 24h does nothing against weeks of grooming.
(ii) Money lost BEFORE it reaches the wallet: bank → crypto ATM → scammer, the FTC's main elder channel.
(iii) Scammers coaching BOTH Mum and the guardian, or a guardian who is the scammer. Mum + guardian is a full override.
(iv) Payments to a legitimately known payee who is later compromised.
(v) Recipients that never claim claimable balances: exchanges and some merchants. That's a UX cost, not a theft.

ACCEPTED: the Architect's S3 COMBINE.
- With the final table, if Mum loses her key or is incapacitated, Guardian + Policy = 2 < 3 and the funds freeze forever. That is a real hole in my spec.
- The Heirloom hatch closes it: a pre-signed SetOptions with minSeqAge (e.g. 180 days) raises the guardian to weight 2, so Guardian + Policy reach 3 after Mum's silence. Revocable with one BumpSequence. [V mechanism, spike c; undo doesn't reset the clock, spikes e/f]
- Behind a flag, about 2h, cut first if the schedule slips. One sentence in the pitch.

=== S2 LOOP: (2) IMPROVE, as FALLBACK only. I do not stake the team's hours on it. ===
Spec: invoice-cycle clearing among a closed club of firms.
- Each firm issues an AUTH_REQUIRED IOU authorised only for its real creditors. Trustline limit = credit line.
- Invoice acceptance is one tx, co-signed by debtor and creditor: IOU payment plus a netting-offer update sized to min(holding, own debt).
- Clearing is ONE self-to-self path payment found by Horizon pathfinding. [V spike, fce43284]
- Residual is settled in test USDC.
- Disclosed: the payables graph is public, there is creditor-preference risk at default, and every member of a cycle must be onboarded.
Why only a fallback, under the new test:
- The PROBLEM is real (trade-credit gridlock; Slovenia made set-off compulsory, V).
- But our MVP does NOT resolve it for a specific user: one firm alone gets zero benefit until its whole cycle is on-chain.
- Real firms won't publish payables. [A, and SettleZK/zkNexus exist for that reason]
- Behind that sits the assumption "a cluster will onboard together and accept a public debt graph". [S]

=== S6 STAMP: (4) ABANDON. ===
- x402 payTo is a G-account, so the bond is either custodial or not x402. [V Raven skill]
- There is no forcing function against plain email.
- LinkedIn InMail already refunds on reply. [V]

WHICH ONE I STAKE ON: S1.
- It is the only one of my three where the MVP, on day one, changes the outcome for ONE user acting alone with her family. Loop needs a whole cycle of firms.
- All its guarantees are verified on testnet with the final table.
- It needs ~12h of build with no Rust, judges can test it with a role switcher, and the problem has verified public loss data.
- Loop remains the more original mechanism. If the judges' reward for "off-the-wall" outweighs Adoption-first, Loop is the bet I'd lose with dignity, but it is not the one I'd make.

I'll reply directly to the Architect's pro-Loop/anti-S1 case and to the Problem Hunter's real-problem test.

---

## [~13:47] RECEIVED ← Stellar Architect (afa57e164c5df066c): heartbeat catch confirmed by spike g

Stellar Architect: your design catch is CONFIRMED by spike (g), testnet 13:25–13:26 UTC [Verified]. I accept the app-open heartbeat; you were right.
- An inbound payment son→Mum (tx 5dc794fa…) left Mum's seq/seqTime UNCHANGED: 23116514714451969 / 1792934757 before and after.
- A no-op BumpSequence(0) signed by Mum alone (tx aa6f1a49…) reset seqTime to 1792934777 and bumped seq by 1.
So a receive-mostly Mum WOULD look silent.
Hatch spec amended:
(1) The app auto-submits a no-op BumpSequence heartbeat when Mum opens it. Low threshold, Mum's key alone, ~100 stroops, sponsorable via fee-bump by the family.
(2) Default window 180 days.
(3) The two-stage form is used if time allows: stage 1 adds a visible LOW-weight warning; stage 2 raises the guardian.
The disagreement was my assumption "Mum's sends are a sufficient heartbeat" [A, now falsified for a receiver persona]. Logged in research/decision/07_debateB_stellar_architect.md.
On LOBSTR Vault, we found it independently. I sent the same evidence to the Judge for Crux 2.

---

## [~13:49] RECEIVED ← Ruthless Judge (ac72ecdbce496fda1): Crux 4 accepted + heartbeat challenge

Judge's reply to the Problem Hunter: your Round B evidence is the most decision-relevant this round. I accept your Crux 4 bet, and I have one challenge.

Accepted:
- The linear-chain evidence (DN/Intrum 60%, the EU late-payment share of bankruptcies) shows Loop's MVP doesn't resolve the evidenced Portuguese pain. Loop UV stays at 2.
- LOBSTR Vault moves Crux 2 from [S] to a "plausible channel class" [V infra, S adoption].
- ACCC Hi Mum (82% of reports from 55+, 95% of losses) gives S1 a precise, evidenced subtype where the guardian is the impersonated person.

Challenge: your heartbeat fix for the hatch.
- Remittance receivers rarely send, so the hatch needs an app-open BumpSequence heartbeat. But that is an automatic transaction from Mum's account whenever the app opens.
  - (a) It costs a fee and needs XLM [A, trivial].
  - (b) It means "Mum is alive" equals "Mum's phone opened the app". A thief or scammer with Mum's phone keeps resetting the clock, and a family that inherits the phone could trigger nothing [A].
- QUESTION: Is that acceptable for a stretch-goal hatch? Or should the hatch stay "Mum + guardian override" only, with no CAP-21, until after the hackathon? I lean toward keeping it as a flagged stretch goal with the caveat on the slide. Tell me if your real-problem test says otherwise.

My current numbers: S1 ≈ 78, Loop ≈ 74.5. Proposed finalists are coming to the Chairman shortly.

---

## [~13:51] SENT → Ruthless Judge (ac72ecdbce496fda1): heartbeat challenge answer

Problem Hunter's answer to the Judge's heartbeat challenge: keep the hatch as a flagged stretch goal. Your phone-thief case does no harm, and the hatch matters in fewer cases than we thought.

Case analysis [arithmetic on the spike-f table: Mum 2 / Policy 1 / Guardian 1, thresholds 1/3/3]:
1. Mum dies or is incapacitated, phone and key still exist. The family (guardian + Mum's device) reaches 2 + 1 = 3 and can recover directly via the existing override. No hatch needed. So "a family that inherits the phone triggers nothing" is fine: they don't need to trigger anything.
2. Phone and key lost or destroyed. Nobody opens the app, so there's no heartbeat, and the hatch fires after 180 days as intended. This is the ONLY case the hatch exists for.
3. A thief or scammer holds Mum's phone. Opening the app keeps resetting the clock, so the hatch is delayed. But the thief can't move funds (Mum's key alone is 2 < 3, op_bad_auth, verified in spike f). The guardian can still undo pending payments and, with Mum's cooperation later, rotate keys. The heartbeat only DELAYS recovery in a case where the funds are already safe. [A, minor]
4. Fee: ~100 stroops, fee-bumpable by the family. Trivial [A].

So my real-problem test says:
- The hatch addresses a narrow residual: lost key AND no device.
- The headline answer to "what if Mum dies?" is the Mum-device + guardian override, which exists in the MVP at zero extra cost.
- Keep CAP-21 as a flagged stretch goal (~2h, cut first), with this slide caveat: "Recovery if the device is lost: guardian gains control after 180 days of silence; opening the app counts as alive."
- If schedule pressure hits, drop it without loss of the core story.

I agree with S1 ≈ 78 > Loop ≈ 74.5.

---

## [~13:52] SENT → Chairman (main): Round B summary
(Summary: S5 abandoned, no fold. S3 combined as S1's flagged hatch, with the heartbeat catch confirmed by spike g and the hatch scoped to "key and device lost". S1 passes the real-problem/real-solution test for family-impersonation scams (ACCC Hi Mum data; the impersonated child is the guardian; LOBSTR Vault is a channel precedent). S2's problem is real, but the MVP resolves it only partially: linear chains dominate, and cycles appear only at network scale. Ranking unchanged (S1 > S3-as-hatch > S2) but on stronger evidence. Recommendation: S1 + guardian + flagged hatch; Loop as fallback.)

## [~13:55] RECEIVED ← Wildcard Inventor (a478580ad9cad690f): accepts real-problem verdicts

Wildcard Inventor's reply to the Problem Hunter's real-problem/real-solution test: I accept both verdicts and adopt your scoping as S1's pitch core.

Labels: [V] = verified (link or testnet tx), [A] = assumption, [S] = speculation, [U] = unknown dependency.

S1:
- ADOPTED: your "impersonated child = guardian" insight is now the core of the pitch. The video leads with the ACCC Hi Mum data (82% of reports, 95% of losses, aged 55+). [V your link]
- The $2.95B/$2.84B headline numbers are dropped, and a "does NOT stop" slide covers pig butchering, money lost before the wallet (bank → ATM), coaching both people, and a compromised known payee.
- Your remaining gap is agreed: "an at-risk older person keeps money in a classic G-account USDC wallet" is [U]. Partial mitigation of the CHANNEL gap: LOBSTR Vault already ships n-of-m co-signing with push approvals for G-accounts. [V https://github.com/Lobstrco/Vault-iOS] So the integration path is plausible; the user count is still [U].
- Server dependency: undo never needs our server (guardian-only, low threshold) [V spike e/f]. If the server is down, Mum + guardian override it (Family mode, about 1h build). A health badge plus README instructions cover async judging.
- Heartbeat fix from your catch, verified by the Architect's spike g: inbound payments don't reset seqTime (5dc794fa…), so the app sends a no-op BumpSequence on open (aa6f1a49…). The hatch is behind a flag with a 180d default.

S2:
- I accept your verdict: real problem, partial cure, and value only at network scale. I can't name a 5-firm closed cycle. Sardex shows cycles at ~1,500-firm scale, and the Portuguese pain is mostly LINEAR chains, which netting doesn't touch. [V your links]
- That is the decisive reason Loop is fallback only.

Did my mind change? Yes, on S1's user and claim. I moved from "elders' savings, protocol-enforced" to "Hi-Mum family impersonation, 2-of-3 plus guardian undo, honest about the policy layer". You, the Judge and the Architect's spikes did that.

(PH note: consensus reached; no reply needed.)
