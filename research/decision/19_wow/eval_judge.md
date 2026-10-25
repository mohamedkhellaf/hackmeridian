# 19: Wow-round evaluation (Ruthless Judge)

Written Sun 2026-10-25, 15:00–15:12 WET.

**Files read:** wow_agents (THE COUNCIL), wow_zk (MUTUAL), wow_new (SEALED, CROWD KEY, BRIBE THE BOUNCER), wow_games (SARDINHA NA BRASA, ELÉTRICO 28). wow_culture was not scored, because I was asked to score the others.

**Labels:** [V] verified · [A] assumption · [S] speculation · [U] unknown

**Scoring:** integer 1–5 per criterion; weighted total = Σ(weight × score / 5).

## 1. Official rubric scores

| Candidate | TA 20 | UV 20 | TE 15 | Inn 15 | HP 10 | MEP 10 | UX 10 | **Total** |
|---|---|---|---|---|---|---|---|---|
| C1 Cheque (reference) | 5 | 2 | 4 | 5 | 4 | 3 | 3 | **75** |
| **SARDINHA + AI rivals** (my merge, §4) | 5 | 2 | 4 | 5 | 4 | 2 | 5 | **76** |
| SARDINHA NA BRASA (as written) | 5 | 2 | 4 | 4 | 4 | 2 | 4 | **72** |
| THE COUNCIL | 4 | 2 | 4 | 4 | 4 | 3 | 5 | **72** |
| F1 Second Thought (reference) | 4 | 3 | 4 | 3 | 4 | 3 | 4 | **71** |
| SEALED | 5 | 2 | 3 | 5 | 4 | 2 | 3 | **70** |
| MUTUAL (as specified) | 5 | 2 | 2 | 4 | 4 | 2 | 4 | **66**, plus a **KILL** flag |

### Why each candidate scored as it did

**THE COUNCIL**
- **TA 4.** It uses native weighted multisig, a hash(x) signer and pre-auth transactions, and it fits the "protocol-powered games" track. It isn't 5 because the protocol only counts signatures. Whether the agents behave honestly is down to our server.
- **UV 2.** It's entertainment. The prompt-injection red-teaming framing is real, but there is a web2 incumbent: Lakera's Gandalf game [A].
- **Inn 4.** The committee that lobbies itself and the leak-the-preimage backdoor are fresh twists. But it is Freysa-derived.
- **UX 5.** Judges can play it, and three keys turning is very watchable.

**SARDINHA NA BRASA**
- **TA 5.** The whole rulebook is 17 pre-auth signers on an account with master weight 0. Sequence-number exclusivity plus time bounds act as the referee. That is literally the official "protocol-powered games" idea area. The mechanism was already verified on testnet in C1's spikes k, k2 and l: pre-auth signers are consumed whether the transaction succeeds or fails, and the siblings then fail with `tx_bad_seq` [V].
- **TE 4.** Roughly 7h of work, using classic operations only.
- **Inn 4.** No Scout prior art [V games lane]. The mechanism family is shared with C1 and with Codex's "Cotação Fechada".
- **UX 4.** Simple and tense. The fun is thin solo against bots, which is fixed in §4.

**SEALED**
- **TA 5 and Inn 5.** It would be the first drand verifier on Stellar, built with BLS12-381 hash_to_g1 and pairing. 0 Scout builds [V wow_new]. That is "used to not be possible" exactly.
- **TE 3.** The hash-to-curve domain-separation tag, point encoding and Rust/Soroban work are a 3–5h unknown for a team new to Soroban.
- **UV 2 and UX 3.** The use case is a time capsule or bet, and resolving the bet needs an oracle or a vote. The demo is "a countdown, then a decrypt", which is less interactive.

**MUTUAL**
- **TE 2.** It needs Groth16/BN254 proof encoding, Semaphore v4 public-signal mirroring and a LeanIMT root. That is the riskiest build here for Soroban newcomers. My kill rule on ZK needs a team member who has shipped a ZK system before, and nobody on the team has.
- **UV 2.** The core promise is false; see §3.

## 2. Twin risk (hard look)

**THE COUNCIL: Med–High.**
- Freysa (Base, Nov 2024; about $47k pot, won after 482 attempts) is famous [V The Block, via wow_agents]. Neo's "Escape the Matrix" cloned it [V]. Lakera's Gandalf is the web2 version [A].
- **Our own lane E independently produced "Bribe the Bouncer"** [V wow_new]. When two of our fresh generators reach "AI guards a pot", other teams' AIs asked for "creative AI-agent ideas" will too [S, strong].
- What differs: five agents that lobby each other, a native 3-of-5 multisig instead of one contract function, and a hash(x) password backdoor whose preimage goes on-chain.
- That is a real twist, but a judge's first sentence will still be "Freysa on Stellar".
- Scout shows 0 Freysa-style builds on Stellar [V], so it is novel on this chain but not in AI culture.

**SARDINHA: Low.**
- No hits for pre-signed or pre-auth games, chicken, or war-of-attrition [V games lane].
- Not in the 8-run twin corpus [V].
- The only sibling is our own C1 and Codex's B2B quote idea. Neither is a game.

**SEALED: Low.** 0 Scout builds for drand, timelock, BLS or time capsule [V]. "Sealed predictions" exists in ZK form (PrismX) [V].

**MUTUAL: Med.**
- Two Stellar ZK hackathons already ran: stellar-hacks-zk with 319 submissions and stellar-hacks-zk-gaming with 95 [V Scout, Phase 1]. ZK reads as "done here" to SDF judges.
- Crush/dating returns 0 builds on Stellar, but zkLove and zkRizz exist off-chain [V wow_zk].
- "Secret crush" is a textbook private-set-intersection example [A].

## 3. Kill criteria and the strongest case against each

### THE COUNCIL: PENALIZE (not KILL)

1. **The trust claim is false as written.**
   - The pitch says "master weight 0, the operator cannot rug". But all five agent keys live on our server, so the operator can sign anything at 3-of-5 [V wow_agents admits "all five keys live on our server"].
   - The protocol-enforced part is only "three of these five keys signed". It is not "three independent AIs agreed". Protocol-literate judges will spot this; the Freysa critique was the same.
   - Mitigations: separate processes, published prompts, and the memo-hash transcript commitment. These are disclosure, not enforcement.
2. **The hash(x) backdoor persists.** I could not find documentation that hash(x) signers are auto-removed after use; only pre-auth transaction signers are documented as auto-removed [A, high confidence]. After the first solo win the preimage is public, so anyone can reuse that signer. Each round must rotate it, which takes the 5-of-5 high threshold, i.e. the operator signs with all five keys anyway.
3. **The demo is nondeterministic.** LLM jailbreak difficulty is hard to tune, and a live judge session could be trivially easy or impossible. The video has to be recorded.
4. **Gambling optics.** A paid-entry prize pot is a gambling or skill-game question in any real deployment [A]. On testnet it is fine.
5. **Twin.** See §2.

### SARDINHA: PASS on all six criteria. PENALIZE on User Value (it's a game).

1. Its weak point is fun for one judge alone against bots. The tension needs real opponents or opponents with personality.
2. Payouts must be exact, because a failed apply still consumes the sequence number [V Architect spike l: a bounce consumes the sequence].
3. 17 of the 20 signer slots are used, so there is no room to grow beyond 4 players × 4 tiers.
4. "Only the owner can fire their ticket" depends on the extra op-source operation being rejected at *submission*, not at apply, so that it doesn't burn the sequence. This is to be confirmed in hour 1, as the games lane already flags. The Architect's spikes showed that payer-alone attempts are rejected with `tx_bad_auth` [V], which suggests yes [A].

### SEALED: PENALIZE (feasibility, user value)

- This is a verify-novel-crypto-in-Rust build by Soroban newcomers. If the quicknet domain-separation tag or encoding is wrong, there is no demo.
- Its strongest use, betting on outcomes, needs an oracle, which pulls in third-party risk or a weak "vote" resolution.
- "Time capsule" alone is a mild wow for non-crypto judges.

### MUTUAL: KILL as specified (the core promise is false)

- The tag is `Poseidon(ECDH(sk_A, pk_B).x, eventId)`, posted publicly on-chain.
- **B can compute the same S from sk_B and A's public key, which is in the public registry. So B can compute the tag for every registrant and scan the chain.** B therefore learns *everyone who picked B* without picking anyone.
- So "if they don't like you back, nobody ever knows you asked" is false for exactly the person who matters.
- Any deterministic value derivable from S that is stored publicly can be probed offline [A, from the construction in wow_zk].
- A fix needs an interactive or threshold private-set-intersection design. That is not achievable in 20h by a Soroban-new team.
- **KILL** (core user promise false, plus ZK fatigue on Stellar, plus highest build risk).

## 4. Verdict: build SARDINHA NA BRASA, with AI-agent rivals

**Decisive reason:** it is the only wow candidate whose headline promise ("no server, no contract, not even us: the validators referee") is literally true and **already verified on testnet** (it is the same pre-auth / same-sequence mechanism as C1's spikes k, k2 and l). It also has no twin, and it costs about 7h, which leaves time for polish.

**Why the alternatives lose:**
- **THE COUNCIL:** the core claim ("the operator can't rug") is false, because we hold all five keys. "AI guards a pot" is Freysa, and our own lane E reproduced it, so it is a twin magnet.
- **MUTUAL:** it leaks every crush to its target.
- **SEALED:** novel, but a risky BLS build with a weak user story.

**The merge (bounded, about 3–4h on top):** fill the empty seats at the grill with **three AI rivals that have personalities** (the Gambler, the Coward, the Bluffer).
- They trash-talk in a table chat and *bluff* about when they'll grab.
- Each decides when to fire its *own* ticket.
- They hold only their own buy-in and pot share. That avoids the Council's custody problem: no AI ever controls the pot, because the pot is controlled by the 17 pre-auth signers.

**What the merge buys:**
- It meets Kaan's "creative things with AI agents" [V-verbal] without entering the saturated agent-wallet space (91 builds [V]).
- It fixes Sardinha's "boring solo vs bots" weakness.
- It keeps the trustless rulebook as the "only on Stellar" moment: 16 tickets die with `tx_bad_seq`.
- The Council's best bit, persuading an AI, survives as table talk: "convince the Coward to blink first".

**Scores:** this lifts UX to 5 and Innovation to 5, for a total of **76**, the top of the board, above C1 at 75.

**Must-pass gates (hour 1):**
1. A ticket missing the owner's op-source signature is rejected at submission (`tx_bad_auth`) and does NOT consume sequence N+1.
2. Two tickets in one ledger: the first applies and the second fails with `tx_bad_seq`, and the payouts are exact.
3. The AI rivals run behind a strict 2h timebox. If they slip, ship deterministic bots with canned lines.

**If the team insists the AI is the centrepiece:** build THE COUNCIL, but put each agent key on a separate team member's machine (three independent hosts minimum). Pitch it honestly as "the multisig counts signatures; our agents decide". Lead with the committee-lobbying twist, never with "Freysa".

**Ranking of all options:**

| Rank | Option | Score |
|---|---|---|
| 1 | Sardinha + AI rivals | 76 |
| 2 | C1 Cheque | 75 (less wow) |
| 3 | Council | 72 |
| 3 | Sardinha (plain) | 72 |
| 5 | F1 Second Thought | 71 |
| 6 | SEALED | 70 |
| — | MUTUAL | killed |

---
## Addendum, 15:05: Architect spike o [V]

- A transaction with `op_bad_auth` is rejected at **validation**. It is not included in the ledger, consumes no sequence number and charges no fee.
- **Sardinha gate 1 effectively PASSES:** a ticket fired without its owner's op-source signature is rejected without burning sequence N+1. So publishing all 17 ticket bodies is safe. A same-ledger collision still needs checking in hour 1.
