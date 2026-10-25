# Phase 2: Initial rankings and shortlist (Chairman)

Recorded 13:07 WET, before any debate. Each agent ranked on its own, with no peer messaging (files `05_ranking_*.md`).

## Initial independent rankings (preserved for later comparison)

| Rank | Problem Hunter | Stellar Architect | Wildcard Inventor | Ruthless Judge (score/100) |
|---|---|---|---|---|
| 1 | WI-2 Second Thought | WI-2 Second Thought | WI-2 Second Thought | WI-2 Second Thought (80.5) |
| 2 | SA-1 Heirloom | WI-1 Loop | SA-1 Heirloom | WI-1 Loop (79) |
| 3 | WI-1 Loop | SA-1 Heirloom | WI-1 Loop | SA-1 Heirloom (74.5) |
| 4 | SA-2 FairSeat | SA-2 FairSeat | SA-2 FairSeat | PH-1 PrizeLock (69.5) |
| 5 | PH-1 PrizeLock | PH-1 PrizeLock | PH-1 PrizeLock | SA-2 FairSeat (67) |
| 6 | SA-4 Envelope | PH-3 ShowUp | PH-3 ShowUp | WI-3 Stamp (65) |
| 7 | WI-3 Stamp | WI-3 Stamp | WI-3 Stamp | PH-2/SA-3 Caução |
| 8 | SA-3 Caução | PH-2 Caução | PH-2 Caução | PH-3 ShowUp |
| 9 | PH-2 Caução | SA-3 Caução | SA-3 Caução | PH-4 AllowanceVault |
| 10 | PH-3 ShowUp | SA-4 Envelope | SA-4 Envelope | WI-4 Always For Sale (KILL) |
| 11 | WI-4 Always For Sale | PH-4 AllowanceVault | PH-4 AllowanceVault | SA-4 Envelope (KILL) |
| 12 | PH-4 AllowanceVault | WI-4 Always For Sale | WI-4 Always For Sale | (SA-3 KILL, counted in row 7) |

Combinations proposed independently:
- **"Guardian" = WI-2 + SA-1:** proposed by all four agents.
- **"PrizeLock Unlocked"** (PH-1 seed plus a native mechanism): proposed by the Wildcard Inventor, the Judge and the Architect, each in a different variant.

### Chairman's warning about the consensus
All four agents put WI-2 first, and three of them independently invented the same combination. That could mean WI-2 is the strongest idea. It could also be the same "AI twin" effect the judges warned about: different models given the same inputs land on the same answer. Unanimity is not evidence. Debate must test WI-2/Guardian hardest, and the Judge is assigned to argue against it.

## Chairman's observations

- **Most promising user problems:** elder scam losses (WI-2, verified $2.84B), unpaid esports prizes (PH-1, verified incidents), lost or orphaned self-custody (SA-1, no hard number).
- **Most technically distinctive:** WI-1 (DEX and path payments as a clearing engine), SA-1 (CAP-21 `minSeqAge`), WI-2 (claimable-balance predicates plus threshold weights), SA-2 (auth-flag sandwich).
- **Strongest contrarian:** WI-1 Loop (B2B, Ripple-era credit network), WI-3 Stamp (x402 reversed: agents pay to reach humans).
- **Best potential demo moments:** "the network refuses" (WI-2, SA-2, SA-1), "debt vanishes in one circular payment" (WI-1), "earn money from spam live" (WI-3).
- **Overlaps:** WI-2 + SA-1 (the same account and guardian setup). PH-1 plus a native time-locked refund (SA-1's mechanism). PH-2 and SA-3 are the same idea.

## Shortlist (6)

| # | Candidate | Proposer | Why it's here |
|---|---|---|---|
| S1 | **WI-2 Second Thought** (the Guardian merge with SA-1 is decided in Round B) | Wildcard | Unanimous #1. Strongest "mom" user and protocol-native. Needs the hardest attack. |
| S2 | **WI-1 Loop** | Wildcard | Highest Track Alignment and memorability. Unconventional B2B. Mechanics unproven. |
| S3 | **SA-1 Heirloom** | Architect | Purest "only on Stellar" mechanism. Kept on its own so the merge has to be argued for, not assumed. |
| S4 | **SA-2 FairSeat** | Architect | Real Unlocked depth with a good refusal moment. Ticketing twin risk to test. |
| S5 | **PH-1 PrizeLock**, judged in improved form (native multisig pool + pre-signed time-locked refund + claimable-balance payouts) | Problem Hunter | Best-documented real-world pain and a "human seed" the judges ask for. Track weakness must be fixed or it dies. |
| S6 | **WI-3 Stamp** (PROTECTED contrarian) | Wildcard | The Judge calls it the only truly new idea. Kept despite ranking 6–7 so it isn't eliminated early. Must answer the x402 `payTo` flaw the Architect found. |

## Eliminated, with reasons

- **PH-2 / SA-3 Caução:** confirmed AI twin (two agents produced it blind). It is escrow, a category with 0 winners in 34 prior builds, with prior art in SafeTrust and BeTrusty×Trustless Work. It risks rebuilding a partner's product, and testnet yield is cosmetic. SA-3 hits the dependency-count kill rule, and its author withdrew it.
- **SA-4 Envelope:** 4 third-party services in the demo path, with SEP-45 + smart-account interop unverified. It sits in the most crowded Stellar vertical and restates the organizers' own prompts, so twin risk is highest. Its author withdrew it.
- **PH-3 ShowUp:** Kickback already did this on Ethereum, its own author calls blockchain only "moderately necessary", and it is escrow-shaped. Passkey recipients can't receive claimable balances.
- **PH-4 AllowanceVault:** its best use case (proof of funds for a visa) is ruled out by regulation, and without it the idea is a weaker use of WI-2's primitive.
- **WI-4 Always For Sale:** hits a kill criterion (plain Soroban, Track Alignment about 2/5), and demand is speculative by the author's own account.
