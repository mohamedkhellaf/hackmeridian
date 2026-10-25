# 05: Ruthless Judge, independent ranking of the 12 proposals

Written Sun 2026-10-25, around 13:45 Lisbon. I wrote it without consulting the other agents and scored everything against `04_judging_framework.md`.

**Scoring basis.** Official weights: TA 20, UV 20, TE 15, Inn 15, HP 10, MEP 10, UX 10. Each idea's score is Σ(weight × score/5), out of 100.

**Context.** About 20 build hours. Three developers, none with Soroban experience.

**The ideas from the rest of the committee:**
- **Problem Hunter (PH):** PH-1 PrizeLock, PH-2 Caução (rental deposits), PH-3 ShowUp (no-show deposits), PH-4 AllowanceVault (student allowances).
- **Stellar Architect (SA):** SA-1 Heirloom (dead man's switch), SA-2 FairSeat (tickets), SA-3 Caução (independently the same idea as PH-2), SA-4 Envelope (cash by link).
- **Wildcard Inventor (WI):** WI-1 Loop (debt netting), WI-2 Second Thought (undo window), WI-3 Stamp (attention bonds), WI-4 Always For Sale (Harberger sponsor slots).

**Kill criteria I apply** (§7 of the framework):
1. Needs mainnet, USDT0 or NEAR Intents.
2. More than 2 third-party services in the critical demo path.
3. A from-scratch ZK circuit.
4. Unlocked track, but the Stellar part is only "store data in a contract or send XLM".
5. A zero-winner, saturated category with no protocol-native twist.
6. Rebuilds a partner's product.
7. Prior code.

**Observation.** PH-2 and SA-3 converged on Caução without seeing each other. Inheritance switches already exist on Stellar (Obol, Boreal Pulse, Heritaz, Heritage Protocol at BA 2025), and WI discarded the inheritance idea for that reason. That supports my AI-twin concern: the ideas that are safe from twins are the ones built on an obscure *mechanism*, not on a domain.

---

## Ranked list (best → worst)

| # | ID | Verdict | One-line reasoning |
|---|---|---|---|
| **1** | **WI-2 Second Thought** | **TOP 6** | The protocol itself enforces "the guardian can undo but never spend" (claimable-balance predicates plus Low/Medium thresholds). It passes Wlad's "my mom can understand and use" test literally, rests on verified figures ($2.84B lost by people over 60; UK APP-fraud reimbursement mandate), needs no Rust, and has two "the network refuses" demo moments. Risks: it can look simple, it needs a classic G-account (seed-phrase story), and scammers can coach victims to wait out the window. |
| **2** | **WI-1 Loop** | **TOP 6** | Best Track Alignment and Discovery of all 12. It answers the organizers' own "old-school assets, new tricks" prompt, and "debt vanishes in one circular path payment" is unforgettable. Risks: the user is abstract B2B with a cold-start network, judges may need the graph to follow it, and the mechanics are unproven until the 45-minute spike runs. My trace of the offers is consistent: issuer offers buy back their own IOU, and the self-payment burns it. |
| **3** | **SA-1 Heirloom** | **TOP 6** | Pure CAP-21 (`minSeqAge` pre-signed transaction): the validators enforce the switch, with no contract and no keeper. The protocol judges (Garand Tyson, Frontier Lab) will love it. But the domain is already crowded on Stellar (4+ prior builds), the target user (a cold-storage holder) is by nature *inactive*, and the market is narrow (Stellar self-custodians). Freighter signing an XDR with sequence S+2³² is unverified. |
| **4** | **PH-1 PrizeLock** | **TOP 6** | Strongest problem evidence of all 12 (YaLLa's ~$700k unpaid prizes, GXR, Valve v. GESC), and it is instantly relatable to hackathon judges. But as written it is plain Soroban escrow plus `require_auth`. That is weak Track Alignment, about 2.5/5, in a category where escrow has 34 builds and 0 winners (heavy penalty under kill criterion 5). It needs a protocol-native or Composed upgrade, e.g. building on Trustless Work, a HackMeridian partner. |
| **5** | **SA-2 FairSeat** | **TOP 6** | Real Unlocked depth (auth flags, authorization sandwich, clawback), and a good demo moment when a direct wallet transfer is rejected. But ticketing is crowded (about 40 builds), the approval server re-centralizes control (it invites the question "then why blockchain?"), and multi-signer XDR assembly is fiddly for newcomers. Medium risk. |
| **6** | **WI-3 Stamp** | **TOP 6** | Inverting x402 (agents pay to *reach* a human, and the bond is refunded) is the only agent idea here that answers Kaan's "not the same project again". But it needs a Soroban contract, an x402 server and an agent client, about the tightest build. Adoption is two-sided and judges will pattern-match it as "another x402". |
| 7 | PH-2 / SA-3 Caução | Penalized; **SA-3 as written hits KILL criterion 2** | The problem is real and Lisbon-relevant. But it is a confirmed AI twin, escrow has 0 winners, SafeTrust and BeTrusty×Trustless Work are prior art, and testnet "yield" is cosmetic. SA-3 puts passkeys, the OZ relayer, the Mercury indexer and DeFindex/Blend in the critical path, so it fails criterion 2. PH-2 with Freighter and mocked yield avoids that, but then Composed alignment collapses. It also risks criterion 6, rebuilding Trustless Work. |
| 8 | PH-3 ShowUp | Penalized | Fun demo, and the judges are the user. But Kickback did exactly this on Ethereum (low Innovation), and the author admits blockchain necessity is "moderate". The passkey and relayer path is the risky part. |
| 9 | PH-4 AllowanceVault | Penalized | Elegant use of claimable balances, but the author concedes the best use case (visa proof-of-funds) is dead for regulatory reasons. What remains is a crowded remittance pitch. WI-2 uses the same primitive with a far stronger story. |
| 10 | WI-4 Always For Sale | **KILL criterion 4** (weak Track Alignment) | Plain Soroban state plus payments, and the author rates Track Alignment and Market Potential the weakest. Off-the-wall is good, but Track Alignment of about 2/5 caps the total at roughly 60. |
| 11 | SA-4 Envelope | **KILL criteria 2 and 5** | Passkey kit, OZ relayer, Mercury indexer and SEP-45/SEP-24 testanchor are 4 third parties in the critical path. SEP-45 plus smart-account interoperability is untested. Remittance is the most crowded Stellar vertical. It also restates two organizer prompts almost verbatim, the highest twin risk. Its cut-line version (G-account claimable balance plus SEP-10) is safe but generic. |

---

## Provisional weighted scores for the top 6

Each cell is score/5, with the weighted points in parentheses.

| ID | TA 20 | UV 20 | TE 15 | Inn 15 | HP 10 | MEP 10 | UX 10 | **Total** |
|---|---|---|---|---|---|---|---|---|
| WI-2 Second Thought | 5 (20) | 4 (16) | 3.5 (10.5) | 4 (12) | 4 (8) | 3 (6) | 4 (8) | **80.5** |
| WI-1 Loop | 5 (20) | 3 (12) | 4 (12) | 5 (15) | 4 (8) | 3 (6) | 3 (6) | **79.0** |
| SA-1 Heirloom | 5 (20) | 3 (12) | 3.5 (10.5) | 4 (12) | 4 (8) | 2.5 (5) | 3.5 (7) | **74.5** |
| PH-1 PrizeLock | 2.5 (10) | 4.5 (18) | 3.5 (10.5) | 3 (9) | 4 (8) | 3.5 (7) | 3.5 (7) | **69.5** |
| SA-2 FairSeat | 4.5 (18) | 3 (12) | 3 (9) | 3 (9) | 3.5 (7) | 3 (6) | 3 (6) | **67.0** |
| WI-3 Stamp | 3.5 (14) | 3 (12) | 3 (9) | 4 (12) | 3.5 (7) | 2.5 (5) | 3 (6) | **65.0** |

The gap between #1 and #2 is within noise. The real choice between them is **User Value (WI-2) vs Innovation and Discovery (WI-1)**. Under the official priority "Adoption → Discovery → Continuation", Adoption comes first, which favours WI-2 by a hair.

---

## What would change my mind (evidence requests)

- **WI-1:** a 45-minute testnet spike showing a 3-firm cycle cleared by one `path_payment_strict_send` with source equal to destination. If it fails, WI-1 drops out of the top 3. Also: can a non-finance judge explain it back after 30 seconds of video?
- **WI-2:** a 30-minute spike showing that (a) a guardian-only signature (weight 1, Low threshold 1) can submit `ClaimClaimableBalance` on the parent's account, and (b) a guardian-only `Payment` fails with `tx_bad_auth`. Also a clear answer to "the scammer says wait 24h" (e.g. adding a new payee needs the guardian's co-signature).
- **SA-1:** Freighter signing a far-ahead-sequence transaction with preconditions. A real answer to "the cold-storage holder is inactive by design".
- **PH-1:** a protocol-native or partner composition that lifts Track Alignment to 4 or more. Without one it stays capped around 70.

---

## Combinations that beat their parts

1. **WI-2 + SA-1 → "Guardian": a family safety account built purely on native multisig.** Same user pair (aging parent and adult child), same primitive family (signers, thresholds, preconditions), no Rust. Hero flow is WI-2's undo window ("the guardian can undo, never spend"). The secondary 20-second beat is SA-1's inactivity recovery: if the parent's account is inactive for N months, a CAP-21 pre-signed transaction gives the guardian signing power.
   - It answers the "too simple" critique of both ideas (Technical Execution goes up).
   - It covers the organizers' "wallets people want to use: shared accounts and recovery live in the wallet" prompt *and* Unlocked.
   - The story becomes "protect Mum's money while she's here, and after."
   - Discipline required: one hero flow; recovery is a stretch goal behind a hard cut-line at hour 12.
   - Provisional score: about **83** (TE and MEP +0.5 each, Inn +0.5).
2. **PH-1 + WI-2's mechanism → PrizeLock paid by claimable balances.** Not a merger of products, but borrowing a primitive. After results are attested, prizes go out as claimable balances with predicates. The organizer can reclaim only after the expiry, and winners never need a pre-existing trustline. This lifts PH-1's Track Alignment from about 2.5 to 3.5 while keeping its best-in-class problem evidence, for a total of about **74**. It still loses to #1–#3.

**What I would argue in debate:** shortlist **WI-2 (or the Guardian fusion), WI-1 and SA-1**, run the two spikes in parallel within the next hour, and pick on evidence.
