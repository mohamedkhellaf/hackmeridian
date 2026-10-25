# 05 — Independent ranking: Stellar Architect

Written Sun 2026-10-25 ~13:15 WET, after reading 01–04. No peer messaging.

**Lens:** technical feasibility for 3 devs new to Soroban in ~20h; whether Stellar is truly necessary (a Track Alignment score of 5 needs "used to not be possible"); protocol depth; integration risk (Judge's rule of at most 2 external dependencies in the critical path); plus the full rubric, the AI-twin penalty and "can judges test it".

**Meta-observation:** the strongest ideas from all three generators share one pattern: **classic-protocol tricks with no Rust on the critical path** (WI-1, WI-2, SA-1, SA-2, PH-4). That pattern is uncrowded (judges' data: inheritance, multisig and shared accounts each have 0–4 builds). It removes our biggest risk (Soroban inexperience) and gives a visible "the network itself refused" demo moment. Soroban-escrow ideas (PH-1, PH-2/SA-3, PH-3, WI-3, WI-4) fall in the escrow category, which has 34 builds and 0 winners, or risk rebuilding a partner's product (Trustless Work).

## Ranking (★ = my top 6)

| # | ID | One-line reasoning |
|---|---|---|
| 1 ★ | **WI-2 Second Thought** | Best overall fit. Claimable-balance predicates plus threshold weights give "guardian can undo but never spend", enforced by validators. TA 5 (Unlocked), "my mom" UX, no Rust, about 10h core, clean prior art. Judges can test it with in-app demo keypairs. |
| 2 ★ | **WI-1 Loop** | Highest "Discovery"/wow: trustlines as credit lines and one self-to-self path payment clears a debt cycle. Literal match for "old-school assets, new tricks"; no Rust. Risks: mechanics need a 45-minute spike (I think they're sound, see notes), and the user is a B2B SME cluster, which fails "my mom" and weakens adoption. |
| 3 ★ | **SA-1 Heirloom** | CAP-21 `minSeqAge` pre-signed recovery: protocol-enforced inactivity trigger, no contract, no keeper. Unique mechanism, low risk. Weaker on its own: inheritance has 3 prior Stellar builds (different mechanism), the use is rare and single-moment, and it may look "too simple". **Strongest as a feature of WI-2** (see C1). |
| 4 ★ | **SA-2 FairSeat** | Auth-required ticket asset plus approval-server "sandwich" gives a network-enforced resale cap. Good Unlocked fit and demo moment. Ticketing has many ideathon twins (TicketReal, TokenTicket…). Juggling multi-party XDR signatures is medium risk for newcomers. |
| 5 ★ | **PH-1 PrizeLock** | Best-evidenced pain (YaLLa ~$700k unpaid) and an easy build. But it is a plain Soroban escrow: the Unlocked claim is overstated (TA ~2–3), it sits in the zero-winner escrow category, and it borders on Trustless Work. Fixable as Composed (C2). |
| 6 ★ | **PH-3 ShowUp** | Judges *are* the user (organizers), so the demo is relatable and fun. Blockchain necessity is moderate (PH admits it). The passkey + relayer + indexer path is 2–3 external dependencies (Judge T6). Kickback-on-Ethereum prior art. |
| 7 | WI-3 Stamp | A clever inversion of x402, but judges are fatigued with x402, two-sided adoption is doubtful, and **its design has a technical flaw** (below). Medium-high risk. |
| 8 | PH-2 Caução | Real PT problem, well researched. But it is an **AI twin of SA-3** (proof that others in the room will have it too), it rebuilds Trustless Work escrow, and Blend testnet yield is cosmetic. |
| 9 | SA-3 Caução (mine) | Same as PH-2, with a heavier passkey + DeFindex stack, so more integration risk. I withdraw it in favour of PH-2's framing if the deposit idea survives at all. |
| 10 | SA-4 Envelope (mine) | The anchor category is over-rewarded, but remittance is the "default Stellar idea" (AI-twin magnet). SEP-45 + Smart Account Kit + relayer + anchor is more than 2 external dependencies. I withdraw it. |
| 11 | PH-4 AllowanceVault | Protocol-native (time-predicate claimable balances), but the visa use case is legally dead (PH admits it). Without it, it becomes "scheduled payments", a thin product. |
| 12 | WI-4 Always For Sale | A fun mechanism, but track alignment is weak (plain Soroban plus USDC) and demand is speculative. |

## Technical claims I believe are wrong or overstated

1. **WI-3 Stamp:** "agent pays the bond via x402 **into a Soroban escrow contract** keyed by message hash" does not work with stock x402 on Stellar. In the x402 `exact` scheme, `payTo` is always a classic **G-account** (Raven skill `agentic-payments`: "x402's `payTo` route config and MPP's `recipient` are always a classic account (G…)"). The bond would land in the server's account and need a custodial forward into escrow, which breaks the "neither party can override" claim. The alternatives are a custom x402 scheme or having the agent call the escrow contract directly without x402.
2. **PH-1 PrizeLock / PH-2 Caução:** labelling a Soroban escrow with multi-signer release or a time-locked refund as **"Unlocked"** overstates it. That is ordinary contract logic, possible on Stellar since 2024 and on every smart-contract chain. Judges defined Unlocked as "used to not be possible on Stellar". Expect a Track Alignment score of about 2–3 unless it is reframed as Composed with real partner integrations.
3. **PH-2 / SA-3:** the Blend testnet pool [U] would use Blend's own test tokens, not necessarily Circle testnet USDC/EURC [A]. EURC testnet availability is unverified, and testnet yield is cosmetic either way.
4. **PH-3 ShowUp:** "passkey-kit **or** OpenZeppelin smart accounts" are not interchangeable SDKs: Passkey Kit and Smart Account Kit use different on-chain auth models and are unaudited/early (docs). Also, a passkey C-address cannot be a claimable-balance claimant (claimants are G-accounts), so stick to SAC transfers.
5. **WI-2 Second Thought:** it works as described. Minor caveats:
   - The guardian (weight 1 ≥ low threshold) can also perform the *other* low-threshold ops on the parent's account, such as `BumpSequence` and `SetTrustLineFlags` (irrelevant for non-issuers). These are harmless but should be disclosed.
   - Each claimable balance locks a base reserve per claimant (~0.5 XLM each) until it is claimed.
   - "Known payees are instant" is an app-level rule, not a protocol rule. The protocol-enforced parts are the undo window and "guardian can't spend".
   - Recipient and sender must be G-accounts, as WI already noted.
6. **WI-1 Loop:** the mechanics look sound to me:
   - Issuers can place offers buying their own asset.
   - Receiving your own asset burns it.
   - Path payments don't require the sender to hold trustlines for intermediate assets.
   - Source = destination is allowed (the arbitrage pattern) [A, needs the spike].
   - Path length is capped at 5 intermediate assets [A, matches my memory].
   - Two extra caveats: (a) every offer owner needs an *authorized* trustline to the asset it sells and the one it buys, unless it is the issuer; (b) Horizon's `/paths` won't find self-cycles, so the client-side cycle finder is required, as WI planned.
7. **Judge T6** is correct and also applies to SA-3, SA-4 and PH-3: the passkey path is relayer plus indexer, two third-party dependencies.

## Combinations that beat their parts

**C1 (strong recommendation) — "Guardian": WI-2 Second Thought + SA-1 Heirloom.** One classic account, one family guardian key, two validator-enforced guarantees, zero contracts:
- **Undo window:** payments to new recipients go out as claimable balances. The guardian (weight 1, low threshold) can claw them back but can never spend (WI-2).
- **Lost key / death:** at setup the parent also pre-signs a CAP-21 transaction with `minSeqAge` = N days. If the account is inactive for N days, the guardian submits it with a fee-bump and their weight rises to full control (SA-1). Any activity by the parent silently re-arms it, and the parent can revoke it with one `BumpSequence`.
- **Why it beats its parts:** it is one coherent product ("a family safety net for your parents' stablecoins: undo scams, recover if lost, inherit if gone") instead of two narrow features. It reuses the same guardian signer and the same classic tx-building code. It adds a second "only on Stellar" moment, defuses the "too simple" Technical Execution risk of each part alone, and the inheritance part already has prior-art differentiation.
- **Scope rule:** one hero flow (Maria + daughter). Recovery is the second act of the demo, not a separate app.
- **Estimate:** about 14–16h, no Rust. Required: in-app demo keypairs (friendbot) so judges can test without Freighter; Freighter stays optional.

**C2 (only if the team prefers a Soroban/Composed project) — PrizeLock on Trustless Work + anchor payout:** PH-1's prize-pool problem, using Trustless Work's escrow (partner) for lock and release instead of our own escrow, and SDF testanchor SEP-24 for winner cash-out. This turns a "rebuild escrow" idea into a genuine Composed entry with a strong, evidenced user story. The risk is Trustless Work's testnet API and key [U]: verify within 30 minutes before committing.
