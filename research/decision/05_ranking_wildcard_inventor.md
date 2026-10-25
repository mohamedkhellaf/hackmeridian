# 05: Wildcard Inventor's independent ranking (Phase 2)

Written Sun 2026-10-25, after reading 01, 02, 03 and 04.

I judged through my own lens first: originality, how memorable the demo is, and how likely other teams are to build an "AI twin" of it. I then sanity-checked every idea against the Judge's rubric and kill criteria in 04.

**What I weighted most:**
- **Track Alignment (20%):** what judges mean by "used to not be possible".
- **"My mom can understand and use it"** (Wlad, judge).
- **"Bring your own seed"** (Elliot and Wlad, judges).
- **At most 2 external dependencies in the critical demo path.**
- **Build risk** for 3 developers who are new to Soroban.

**Convergence check (Judge §7).** Several of our proposals arrived independently at the same idea or primitive. By the Judge's rule, that predicts twins in the room:
- PH-2 and SA-3 are the same idea (rental deposits in escrow plus yield).
- PH-4, WI-2 and SA-4 all use claimable-balance time predicates.

These are *different products on a shared primitive*, so the twin risk sits mostly with Caução.

## Ranking (best to worst for OUR situation). ★ = my personal top 6

| # | ID | Idea | One line of reasoning |
|---|---|---|---|
| 1 ★ | **WI-2** | Second Thought (24h undo window; guardian can undo but never spend) | **Track:** best "old-school primitives, new trick" fit: claimable-balance predicates and Low-threshold weights, with no Soroban needed. **User value:** literally a product for judges' mums, with verified numbers ($2.84B lost by over-60s to crypto scams, £450.7m UK APP fraud). **Prior art:** none on Stellar. **Demo:** "the network refuses the guardian" is a memorable moment. **Risk:** low. **Weaknesses:** may look technically thin; the wallet category is busy. |
| 2 ★ | **SA-1** | Heirloom (CAP-21 `minSeqAge` dead man's switch) | **Track:** the purest Unlocked idea. Validators enforce "valid only after N seconds of inactivity", which is impossible for an EVM externally owned account (EOA). **Demo:** "pay a coffee and the countdown resets" is a great beat. **Risk:** ~14h, no contracts. **Weakness:** the inheritance category exists (Boreal Pulse, Obol, Heritaz), so the novelty is the mechanism, not the problem. The user pain is less urgent than scams. |
| 3 ★ | **WI-1** | Loop (trustlines as credit lines; one self-path-payment clears a debt cycle) | **Fit and novelty:** the highest "weird but correct" score, almost word for word the "path payments for something they weren't designed for" prompt. **Demo:** a circular transaction that erases debt is very memorable. **Weaknesses:** it is B2B infrastructure with no "mum" user, which triggers the Judge's B2B penalty. The netting problem already has 2 ZK builds (with no awards). The mechanics need a spike in hour 1. |
| 4 ★ | **SA-2** | FairSeat (auth-required ticket assets + approval sandwich) | **Track:** strong Unlocked. **Demo:** "Freighter transfer rejected by the network" is a crowd-pleaser. **Weaknesses:** ticketing is a top AI suggestion with ~9 prior Stellar builds, including a winning concept (TicketReal), so twin risk is high. The approval server plus fiddly multi-signer transaction encoding (XDR) carries medium risk for newcomers. |
| 5 ★ | **PH-1** | PrizeLock (pre-funded esports prize pools) | **Seed:** the best *human* seed of all twelve: named victims and $700k unpaid at YaLLa, a niche nobody else will pick. **Weakness:** as written it is a Soroban escrow, which falls in the escrow category with zero winners and only scores TA ~2–3. Fixable: see Combination 2. |
| 6 ★ | **PH-3** | ShowUp (refundable RSVP deposits) | **Seed:** the judges *are* the users, and the no-show data is verified (28% vs 17%). Most fun to demo. **Weaknesses:** blockchain is only moderately necessary. Kickback (Ethereum) is prior art. Passkeys add dependency risk, and there is no core-protocol trick (TA ~3). |
| 7 | **WI-3** | Stamp (x402 attention bonds) | **Twist:** an inverted x402 flow (agents pay to *reach* a human). **Weaknesses:** judges will pattern-match it to the most saturated category. It needs a backend, x402 and Soroban, and has the tightest build time. |
| 8 | **PH-2** | Caução (Problem Hunter version) | **Strengths:** real Lisbon pain. The "arm only on key handover" anti-scam twist is good. **Weaknesses:** two agents converged on it, so twins are likely. It is in the escrow category, with SafeTrust and BeTrusty×Trustless Work as prior art. Yield on testnet is cosmetic. |
| 9 | **SA-3** | Caução (Architect version: passkeys + DeFindex/Blend + relayer) | The same idea as PH-2, but with more external dependencies: passkeys, a relayer, a vault and maybe Trustless Work. That breaks the "≤2 dependencies" rule for ~16–18h of build. |
| 10 | **SA-4** | Envelope (send a cash link; passkey; anchor cash-out) | **Twin risk:** maximal, since it matches the organizers' prompt list almost verbatim and remittance is the default Stellar idea. **Risk:** SEP-45 with Smart Account Kit has unproven interop. **Upside:** anchors are under-built relative to how often they win (Judge §3). |
| 11 | **PH-4** | AllowanceVault (time-released student funds) | The same claimable-balance primitive as WI-2, but the visa use case hits a regulatory wall. What remains is crowded remittance territory. |
| 12 | **WI-4** | Always For Sale (Harberger README sponsor slot) | Fun, but it has the weakest track alignment and the weakest case that a blockchain is needed. Market potential is the smallest of the twelve. |

## Combinations that beat their parts

### Combination 1: "Guardian", a family safety wallet (WI-2 + SA-1). My top recommendation.

The thesis fits in one line a judge's mum understands: **"Your daughter's key can undo a scam payment today, can inherit your savings if you're gone, and can never spend your money in between."** Each clause is enforced by Stellar validators, with no smart contract.

How each part works, all with classic Stellar primitives:

| Clause | Mechanism |
|---|---|
| **Undo** (hero flow, WI-2) | Payments to new payees go out as claimable balances with an `after 24h` predicate for the recipient. The guardian signer has weight 1, which meets the Low threshold, so the guardian alone can submit `ClaimClaimableBalance` back to Mum's account. Payments need Medium (2), so the guardian cannot spend. |
| **Inherit** (20-second second beat, SA-1) | A pre-signed CAP-21 transaction (`minSeqAge`) raises the same guardian's weight to the High threshold after N days of inactivity. Mum's normal activity re-arms it automatically. Revoking it takes one `BumpSequence`. |
| **Never spend** | The same weight and threshold setup, shown live when the network rejects the guardian's attempt to move Mum's money. |

**Two subtle design notes:**
- **Guardian actions must not reset the inheritance timer.** When the guardian undoes a payment, use the guardian's own account as the *transaction source* and Mum's account as the *operation source*. Then Mum's `seqTime` is not reset by the guardian. This is an [A] reading of CAP-21: `seqTime` updates for the transaction source. It must be verified in the spike.
- **Same persona, same signer setup.** One persona (Maria plus her daughter), one signer configuration, two protocol-native powers. Both parents (WI-2 and SA-1) estimated 9–14h individually, with heavy overlap: Freighter signing, transaction building and the guardian UI. Together that is ~15h.
- **Prior art:** none found for either mechanism.

**Risks:**
- Two flows. The Judge allows one hero flow, so undo is the hero and inheritance is a short closing beat.
- It may look "too simple". Counter with UX polish and an explicit "only-on-Stellar" overlay naming each primitive.

### Combination 2: "PrizeLock Unlocked" (PH-1 seed + SA-1 mechanism)

This keeps the Problem Hunter's excellent human seed (esports prize pools, $700k unpaid) but replaces the generic Soroban escrow with core-protocol guarantees:

1. **Native multisig pool.** The prize pool is a native Stellar account. The organizer and an independent referee are 2-of-2 signers, and the master key weight is 0.
2. **Pre-signed refund.** At creation, both sign a transaction that refunds registered teams pro-rata. It carries a CAP-21 timebound/`minSeqAge` precondition, and every team holds a copy.
3. **Automatic fallback.** If results are not posted by the deadline, anyone can submit the refund (fee-bumped).
4. **Normal payout.** If results are posted, the payout transaction consumes the sequence number first, which invalidates the refund.

This moves the idea from "escrow contract" (TA ~2) to "the network enforces the organizer's promise" (TA ~4–5).

**Residual risk:**
- The organizer and referee together could bump the sequence to cancel the refund. That is acceptable with a genuinely independent referee, but must be disclosed.
- It is weaker than Combination 1 on "my mum understands it", but much stronger on "bring your own seed".

## My position for the debate

- **First choice:** Combination 1, "Guardian".
- **Fallback:** WI-2 alone, if the team wants a single, very polished flow.
- **Wildcard upside pick:** WI-1 Loop, if the committee values "off-the-wall" over "mum test".
- I would argue **against** Caução (PH-2/SA-3), Envelope (SA-4) and Stamp (WI-3) on twin-risk and dependency grounds.
