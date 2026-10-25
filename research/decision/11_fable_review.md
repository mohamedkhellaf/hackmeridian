# 11 — Independent red-team review (Fable)

Written Sun 2026-10-25 ~13:55 WET. Independent of the committee. Time-boxed to ~15 min. Labels: [V] verified by me this session (link or spike output), [C] committee claim I did not re-verify, [A] my assumption.

## Verdict on F1 "Second Thought": APPROVE WITH REQUIRED CHANGES

The mechanism holds. I re-read spikes a/e/f against the official list-of-operations thresholds and found no gap in the threshold arithmetic: ClaimClaimableBalance is Low, CreateClaimableBalance/Payment/ManageData/ChangeTrust are Medium, signer/threshold SetOptions is High [V docs]. With Mum 2 / Policy 1 / Guardian 1 and thresholds 1/3/3, every claim in the committee's table follows and the spike f output (txs 7a8fbe48, 85aeea3b, 167349e9, e4066132, de4ecad5; `op_bad_auth` for Mum alone and for Guardian+Policy; `op_cannot_claim` for early claim) is consistent with it [V spike outputs].

What I could break is not the ledger logic but (1) the Track Alignment framing, (2) one allowlist design choice that defeats the product in the very scam it targets, (3) two undisclosed failure modes of a 2-of-3 on a plain account, and (4) a couple of factual wobbles. None is a veto. All are fixable today at near-zero build cost. The required changes are listed at the end of the issues section.

## Issues found, ranked

### 1. NEAR-FATAL (judging): F1 does not meet the organizers' *verbal* definition of "Stellar Unlocked"

- Evidence: 04_judging_framework.md line 17 records the organizers saying Unlocked means "building something that used to not be possible on Stellar ... what you didn't have the ability to do in the last hackathon" [C, verbal quote]. The Judge's own 5/5 rubric row says "a judge could say: this used to not be possible".
- F1 is built from multisig thresholds (2015), op-source authorization (2015) and claimable balances (CAP-23, 2020). The "sender as unconditional claimant + time predicate on the recipient" pattern is already the documented reclaim pattern (CLI delegate-spending guide "co-signed vault", cited by the committee). CAP-23's own Motivation is payouts and non-interactive issuance, not cancellable consumer payments [V cap-0023.md], so "not what it was designed for" is defensible, but "used to not be possible" is not.
- Loop, by contrast, matches the *written* Unlocked prompt "old-school assets, new tricks: path payments for something they weren't obviously designed for" almost verbatim. That is why the Judge gave it TA 5 and F1 TA 4; I think F1 is a 3 for a protocol-minded judge and a 2.5 for one anchored on the verbal definition. On the 20% weight that is a 3–4 point swing against the committee's 73–75, which lands F1 at ~70, i.e. level with Loop.
- Fix (zero build cost, pitch only): (a) put the written prompt on the deck verbatim and claim it: "old-school assets, new tricks: a claimable balance used as a cancellable payment, thresholds used as a role system"; (b) never say "new capability"; say "a composition no Stellar wallet ships"; (c) make the "pull the plug" beat and the stellar.expert predicate screenshot the proof that the guarantee is the validator's, not the server's; (d) cite SEP-30 (below) as the ecosystem precedent that non-custodial server signers on classic accounts are the Stellar way, not a hack. This is the strongest honest TA argument available and the committee did not make it.

### 2. FATAL FOR THE PRODUCT STORY IF LEFT IN THE DEMO: an exchange deposit address on the allowlist is a one-hop bypass

- The Architect's scenario builder "seeds the allowlist (son, exchange)" (08_dd_stellar_architect.md, work item 2) and the Problem Hunter's mitigation for exchanges not claiming CBs is to pre-allowlist them.
- Attack, in the exact "Hi Mum" script: "Mum, send it to your exchange account, then withdraw to this address, it's faster." The first hop is a known-payee instant payment co-signed by the server; nothing pends, nobody is alerted, and the exchange has no undo. The product's one promise fails against its one scenario, and an attentive judge who reads the README allowlist will see it.
- Fix: in the demo the allowlist contains family only (the son). An exchange is a new payee like any other; its first payment goes through the guardian-approve instant path (Mum + Daughter = 3), after which it may be added by Mum + Daughter (ManageData, medium, server rejects it, so the scammer cannot coach Mum into it). Put "money already at an exchange or bank" on the "does NOT stop" slide. Zero build cost; it removes one seeded address.

### 3. REAL, UNDISCLOSED: in Full mode Mum's own money is hostage to two other parties (lockout)

- With thresholds 1/3/3 and master weight 2, Mum alone can do only Low ops: claim/reclaim claimable balances and BumpSequence. Every Payment, ChangeTrust, ManageData, offer, CreateAccount and AccountMerge needs the server or the daughter. The server, as specified, rejects everything except Payment-to-allowlist and the CB shape, so Mum cannot even open a new trustline without the daughter.
- If the server's key is lost or the service is shut down (a hackathon function on a free tier, judged async) AND the daughter is unreachable, dead, or has lost her key, Mum's balance is frozen forever. Coinbase Vault and bank holds do not have this failure mode; a custodian can always recover. This is the classic 2-of-3 problem and the committee's cut of the Heirloom hatch removed the only answer to it.
- Fix, two levels: (a) REQUIRED: a README security-model table that states it plainly. (b) RECOMMENDED if ≥1.5 dev-h is spare after the co-signer is green: at setup, all three keys sign one "break-glass" tx (`setOptions masterWeight 3, thresholds 1/1/1`) with `minSeqAge` = 30 days, stored as XDR in Mum's app; this is spike c verbatim, already verified (`tx_bad_minseq_age_or_gap` early, accepted after the window, revoked by BumpSequence). It also turns the hatch into something a judge sees as *protecting Mum from us*, which is a better story than inheritance.

### 4. REAL, UNDISCLOSED: a malicious or compromised guardian can brick or paralyse the account (griefing, not theft)

- Spike a verified "guardian-only bumpSequence (low) OK" (tx 7e72ca75). BumpSequence to INT64_MAX makes Mum's account unable to be a transaction source ever again (no next sequence number exists). Funds remain movable only as op-source inside someone else's transaction, which Mum cannot do alone. The guardian can also reclaim every pending new-payee payment indefinitely.
- The committee's security line ("no SINGLE compromise moves money") is true and should stay. Add one sentence: "a compromised guardian can block, never steal; recovery is the break-glass path in item 3". Disclose; do not try to design around it tonight.

### 5. PRODUCT: the hero flow should include Mum cancelling alone, because that is literally the product name

- Mum's reclaim is Low threshold: she can cancel a pending payment alone, from any wallet, with the server dead and the daughter asleep, and the validators enforce it [V threshold arithmetic; spike a variant per the Architect]. That is the "second thought". In the current plan the hero beat is the daughter's undo, which depends on a polled Horizon query in an open browser tab (no push in the MVP) and on the daughter acting within 24h.
- The honest causal story for stopping harm is: the scammer's urgency breaks because nothing leaves for 24h; Mum has time to phone the real daughter; either of them cancels. Show both cancels in the video (Mum first, 10 seconds; then the daughter's remote undo as the "even if Mum is still convinced" beat).

### 6. FACTUAL CORRECTIONS for README, deck and submission answers

- Claimable balance reserve is `claimants × baseReserve` [V cap-0023 spec; list-of-operations `CREATE_CLAIMABLE_BALANCE_LOW_RESERVE`]. With two claimants that is 1 XLM per pending payment, not the 0.5 XLM the Problem Hunter wrote. Returned on claim or reclaim. The family-sponsored variant (spike f, tx 0f7b18bd) covers a USDC-only Mum.
- ACCC "82% of reports / 95% of losses from over-55s" is from the August 2022 release (1,150 victims, A$2.6M, Jan–Jul 2022) [V]. Label it 2022 and bank-rail. Lisbon-local evidence exists and judges in the room will recognise it: PSP recorded 260 "Olá pai / Olá mãe" complaints in January 2024 alone, via WhatsApp, paid by transfer or MB Way [V observador.pt 2024-02-08]. Use it on the problem slide.
- Do not write "Vibrant/Vesseo is a channel". Do write (see verification table) that SDF's own consumer wallet runs non-custodial classic accounts with server signers that cannot act alone (SEP-30). That is the precedent for the policy co-signer.

### 7. EXECUTION risks the committee under-weighted (all manageable)

- Capacity: 22–24 dev-h estimated against ~36 dev-h "capacity" assumes three people each code ~12 productive hours between 16:00 and 09:00 while also sleeping, recording a video and making a deck. Treat real capacity as ~26–28 dev-h. The buffer is 3–5 h, not 12. This is why the hard cut-line (Lite at 06:00) matters and why items 2, 4, 5 and 6 above are chosen to cost nothing.
- Order of the video: do the Mum+server payment and CB creation *before* the "pull the plug" beat, because with the server off the only things that work are undo, reclaim and refusals (by design).
- Server statelessness means one Horizon `loadAccount` per co-sign to confirm the policy key is a signer; add a 5 s timeout and return a plain error, or the UI hangs when Horizon is slow.
- Policy function hardening that is cheap and judge-visible: reject any op whose explicit `source` differs from the tx source; cap fee; require `timebounds`; require CB `T ≥ now + window` and exactly two claimants in the required shape. The DD already lists most of this; make sure the op-source check is in, since op-source tricks are the whole point of the design.

## Handled adequately by the committee (no action)

- Mum's key alone cannot pay in Full mode; Guardian+Policy cannot pay or change signers; Mum+Guardian can remove the server (spike f) [V outputs].
- Guardian undo via guardian-sourced tx with Mum as op-source leaves Mum's seq/seqTime untouched (spike e, 02e300ef) [V output].
- "Coached Mum adds the scammer as a payee": server rejects ManageData, so it needs the daughter. Correct and a good talking point.
- Claimant needs a trustline for non-native assets (`CLAIM_CLAIMABLE_BALANCE_NO_TRUST`) [V docs]; demo recipients get one at setup. The real-world consequence is right: exchanges and most wallets will not claim CBs, hence the guardian-approve instant path for first sends. Fine, once item 2 is applied.
- Honest "does NOT stop" slide, prior-art slide naming Coinbase Vault / Argent / LOBSTR Vault / Volta Circuit, re-scoped user, no fabricated testimonials, "set up by family, used by Mum". All good.
- Hybrid build order (Lite flows first, co-signer second, hard stop 06:00). Correct.

## Verification table

| # | Claim | Result | Evidence |
|---|---|---|---|
| 1 | ACCC: over-55s = 82% of "Hi Mum" reports and 95% of losses | **Confirmed**, dated Aug 2022 | ACCC/Scamwatch release (scamwatch.gov.au returned 403 to fetch; figures confirmed via accc.gov.au media release and syndicated copies). 1,150 victims, A$2.6M Jan–Jul 2022. Losses via bank transfer. |
| 2 | LOBSTR Vault = co-signer app on classic G-accounts, push approval, N-of-M | **Confirmed with nuance** | github.com/Lobstrco/Vault-iOS README: local signer key added to the account, "receive signature requests with PUSH notifications", N-of-N wording, public POST endpoint `vault.lobstr.co/api/transactions/` for extra signatures. No delay, allowlist or undo features. "Approves every tx" follows from being a required signer, not from README text. |
| 3 | Coinbase Vault: 48h delay, cancellable, multiple approvers | **Confirmed** (page undated) | help.coinbase.com vaults FAQ: 48h delay cannot be changed, cancel during the wait takes effect immediately, separate 24h approval window. Status as of 2026 could not be dated. |
| 4 | Vibrant = USDC on Stellar, non-custodial, classic account | **Confirmed, and stronger than the committee thought** | stellar.org case study: Sunship (SDF subsidiary) wallet for Argentines to hold USDC; the case-study page now calls the app Vesseo while linking vibrantapp.com, so Vesseo is the renamed Vibrant [V]. SDF blog on SEP-30: "live and operational in one wallet, Vesseo, a non-custodial US dollar savings app"; two recovery servers are added as signers on the user's classic account with weights such that "neither has independent control"; "the only individual with independent control of the account is Alice" [V]. So the target user class holds self-custody USDC on a classic G-account that already carries server signers. Channel interest remains unverified. |
| 5 | ClaimClaimableBalance threshold = Low | **Confirmed** | developers.stellar.org list-of-operations: ClaimClaimableBalance Low; CreateClaimableBalance Medium; BumpSequence Low; ManageData Medium; signer/threshold SetOptions High. |
| 6 | CB reserve = 0.5 XLM per pending payment | **Contradicted** | CAP-23 spec and `CREATE_CLAIMABLE_BALANCE_LOW_RESERVE`: reserve = number of claimants × baseReserve = 1 XLM for the F1 shape. |
| 7 | No Stellar build uses claimable balances as a guardian-cancellable payment | **Confirmed (absence, weak)** | Scout project and repo searches at 13:42 UTC returned only generic wallets, Volta Circuit, Piggy Wallet, eunomia (Soroban agent treasury). A miss is not proof of absence. |
| 8 | "Olá mãe" scam is a documented Portuguese problem | **Confirmed** | PSP: 260 complaints in January 2024; PJ arrests 2022, 2024, 2025; payment by transfer/MB Way (observador.pt, rr.pt, postal.pt). |
| 9 | Organizers' verbal definition of Unlocked = "what you couldn't do before" | **Could not verify** independently (relies on the Judge's transcript of the kickoff); treated as credible and acted on in item 1. | 04_judging_framework.md line 17. |

## Verdict on the backup (F2 Loop) and on the eliminations

- Ranking F2 second is correct **as a different bet**, which is the point of a backup. Its ledger mechanism is verified (spike b, fce43284) and it is the finalist that most literally matches an official Unlocked prompt, so its Track Alignment ceiling is higher than F1's. Its floor is lower: User Value 2 is structural, not a pitch problem. One firm gets nothing until its whole cycle is on-chain, firms do not publish payables, and the evidenced Portuguese pain is linear late payment, which netting cannot touch. I add one thing the committee did not say: a firm's IOU is a freely transferable debt instrument once issued; any creditor can sell it to anyone with a trustline, which is either the feature (receivables market) or a legal problem (assignment of receivables, e-money). Do not let that into a 3-minute video.
- Switch rule (d) is right as written: switch only if the relative call undermines F1's premise AND the SME call finds a real closed cycle that accepts a pseudonymous public graph. An inconclusive SME call does not raise Loop's User Value.
- Eliminated ideas: none wrongly killed. Caução was a confirmed AI twin in an escrow category with partner prior art; PrizeLock had the best human seed but weak track fit and a real pre-signing hole; ShowUp, Envelope, AllowanceVault and Always-For-Sale died on their own authors' concessions. The one reversal I recommend is partial: Heirloom should come back as F1's **break-glass for Mum** (item 3), README-documented with spike c's hashes even if unbuilt, because it is the only answer to the lockout question a security-minded judge will ask.

## Required changes (conditions of approval)

1. Demo allowlist = family only; exchanges are new payees; first send to an exchange goes via guardian-approve. (Item 2.)
2. Pitch Track Alignment under the written "old-school assets, new tricks" prompt, quote it, and cite SEP-30/Vesseo as the ecosystem precedent for non-custodial server signers on classic accounts. Never claim "new capability". (Item 1.)
3. README security model as a table: single-compromise outcomes (Mum key / server / guardian / guardian+server / Mum key+server), guardian griefing (BumpSequence brick, perpetual undo), and the lockout case (server gone + guardian gone), with the break-glass tx as the documented recovery path. Build it only if ≥1.5 h spare after the co-signer is green. (Items 3, 4.)
4. The video shows Mum cancelling alone before the daughter's remote undo, then "pull the plug". (Item 5.)
5. Correct the reserve to 1 XLM; label ACCC as 2022 bank-rail data; add the PSP January-2024 figure. (Item 6.)

## The single most important thing in the first 2 hours

Port spike f into the Vite app and get it running from a public URL. Concretely: `@stellar/stellar-sdk` in the browser, in-app `Keypair.random()` roles funded by friendbot, one "Create demo family" button that runs the setup tx, one "Send to new payee" that creates the CB, one "Undo" in the daughter tab, and the stellar.expert link under each. Lite thresholds (1/2/2), no server, no styling. Deployed to Vercel/Netlify by 16:00–16:30. Everything else (co-signer, polish, video) is additive to that artifact; nothing is recoverable if it does not exist by hour 2. In parallel, a non-coding teammate makes the relative call with the Judge's three questions and writes the answer down verbatim.
