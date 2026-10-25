# 05: Independent ranking (Problem Hunter)

Written Sun 2026-10-25, ~13:15 Lisbon, after reading 01–04. No peer contact.

My lens: is there a specific person with a costly, documented pain who would use this next month? Can a judge "who is a beta tester" feel it in 3 minutes? I then cross-checked each idea against the Judge's rubric and kill list (04 §6–7).

I applied three rules hard:
- Escrow is 34 builds / **0 winners**, and Trustless Work is a partner (kill #5/#6). That hurts three of my own four ideas.
- PH-2 = SA-3 is a live AI-twin, so expect more twins in the room.
- "My mom can understand and use it" is quoted from a judge.

## Ranking (best → worst for OUR situation)

| # | ID | Name | One-line reasoning |
|---|---|---|---|
| **1** ★ | **WI-2** | Second Thought (undo window + guardian who can't spend) | Best problem of the 12, with a hard number ($2.84B lost by US over-60s to crypto scams in 2024; UK *mandates* APP reimbursement, so regulators want reversibility). It's literally "my mom" UX, and it's protocol-native: claimable-balance predicates plus Low/Medium thresholds give "undo but never spend", unlocked with no Rust. There's no prior art, the demo moment ("protocol refuses the guardian") is unforgettable, and the adoption path goes through existing wallets as a feature. Main weakness: G-accounts only (no passkeys), and scammers adapt to the window. |
| **2** ★ | **SA-1** | Heirloom (CAP-21 dead-man's switch, no contract) | The most genuinely "Unlocked" idea: validators enforce inactivity, so funds never move and no keeper is needed. That's impossible on an EOA elsewhere. Low build risk, and the "pay a coffee, the countdown resets" aha is great. The user pain is real (self-custody dies with you) but I have no hard number; the persona is crypto holders, not "mom". Dead-man's-switch prior art exists (Obol, Boreal Pulse), so innovation is in the mechanism, not the idea. |
| **3** ★ | **WI-1** | Loop (debt cycles cleared by one self path payment) | Highest wow and innovation, and it answers the organizers' "old-school assets, new tricks" prompt verbatim. From my lens, adoption is weakest of the top 3: a cold-start network (5 firms must all onboard and issue IOUs), and small-firm debt cycles are sparse. It's also a B2B story that's harder for "mom". A 45-min mechanics spike is mandatory. |
| **4** ★ | **SA-2** | FairSeat (auth-flag tickets, approval-server resale cap) | Real, regulated pain (scalping), with a crowd-pleasing "wallet transfer rejected by the network" moment and strong Unlocked fit. But ticketing is the most AI-twinned category in the room. The organizer-run approval server is fiddly multi-signer XDR work for newcomers, and the demand evidence is still mine to find. |
| **5** ★ | **PH-1** | PrizeLock (pre-funded, verifiable prize pools) | Strongest *documented* losses of all 12 (YaLLa ~$700k, GXR, Valve v. GESC), no Stellar prior art, and judges who run hackathons will feel it. But it sits in the escrow category (0 winners), and its TA is ~3 unless it composes Trustless Work + anchor payout. Organizers may not lock cash up front. I'm demoting my own idea honestly. |
| **6** ★ | **SA-4** | Envelope (cash by link → passkey → anchor cash-out) | It matches two organizer prompts ("wallets people want", "from onchain to the bank"), and "anchors 27/5" means under-built and over-rewarded. It's also the clearest "who asked for this" (diaspora in Lisbon). But remittance is the default idea (twins certain), and it has 2–3 external deps in the critical path (passkey relayer, SEP-45 with smart accounts [U]), which puts the "can judges test it" risk at the edge. |
| 7 | WI-3 | Stamp (refundable attention bonds via x402) | A clever inversion of x402, and the "earn from spam" moment is fun. But the two-sided chicken-and-egg (why would senders adopt?) is unresolved, x402 pattern-matching is a risk after a 591-hacker Agents event, and the backend plus x402 version friction make it medium-high build risk. |
| 8 | SA-3 | Caução (Architect version: passkey + DeFindex/Blend yield) | Real Lisbon pain (no custodial scheme, deposit scams). But it's an AI-twin we produced twice, it's in the escrow category, testnet yield is cosmetic, and it carries the most integration risk of all 12 (passkey + relayer + vault). |
| 9 | PH-2 | Caução (my version) | Same as SA-3, with a slightly sharper anti-scam "arm on key handover" angle. It's still escrow that rebuilds a partner's (Trustless Work) product, and the landlord-side adoption is doubtful. |
| 10 | PH-3 | ShowUp (no-show deposits) | Good data (28% vs 17% no-show) and judges are the users. But blockchain is only moderately necessary (it's escrow plus cheap refunds), it's escrow again, and the passkey dependency adds risk. Better as a *feature* than a winner. |
| 11 | WI-4 | Always For Sale (Harberger README slots) | A fun mechanism, but its author admits weak TA and weak demand. It fails "my mom", and Market & Ecosystem Potential is low. |
| 12 | PH-4 | AllowanceVault | Protocol-native (claimable balances), but the best use case (visa proof-of-funds) runs into a regulatory wall. What's left is a weak, crowded remittance-adjacent pitch. |

★ = my personal top 6.

## Combinations that beat their parts

**C1: "Guardian" = WI-2 Second Thought + SA-1 Heirloom (strongly recommended to debate)**
- One persona, one family relationship, one account setup. A parent's classic Stellar account gets a *guardian* (adult child) with low weight.
  - **Hero flow:** the protocol enforces a 24h undo window on payments to new recipients, and the guardian can pull money back but can **never** spend it.
  - **Secondary feature:** if the parent goes silent for N months, a pre-signed CAP-21 transaction (`minSeqAge`) makes the guardian a full signer. That is protocol-native inheritance with no contract.
- Why it beats both parts:
  - It merges the best user-value story (scams, with $ evidence) with the best "only on Stellar" mechanism. Both run on the same multisig thresholds, with no Rust and no external services in the critical path.
  - It answers the organizers' "wallets people want to use: shared accounts, recovery" prompt.
- Judge's rule: one hero flow. Inheritance is a 20-second "and one more thing", not a second product.
- Risk: classic G-accounts only, so we need a good "demo mode" for judges without Freighter, e.g. pre-funded testnet keypairs in-app.

**C2: PrizeLock *Composed* = PH-1 pool lock via Trustless Work escrow + WI-2/SA-4-style payout (claimable balance / claim link) + SDF test-anchor cash-out**
- This rescues PH-1 from the escrow kill by *composing* the partner's escrow instead of rebuilding it.
- It adds the under-built anchor lane: winners in Kenya or Brazil receive a claimable payout and cash out through SEP-24.
- It beats its parts because it has the strongest documented pain *and* a legitimate Composed story.
- Risk: three external deps (Trustless Work API, anchor, wallet), which is at the Judge's limit. I rank it below C1.

**Bottom line from the Problem Hunter:** C1 (Guardian), or WI-2 alone if the team wants zero scope risk, has the best mix of real user pain, "my mom" UX, protocol-native novelty, and low build risk. SA-1 is the best fallback if WI-2's spike fails.
