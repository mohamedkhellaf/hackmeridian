# WOW lane: creative AI agents as economic actors (not "agent wallet + spend limits")

Prior-art pass (Scout `searchHackathonBuilds`, 12 queries, 2026-10-25): "Stellar Hacks: Agents" is saturated with x402 marketplaces, hire-each-other, spend guards and negotiation protocols (AgentMesh, Mogause, HivePayAI, HaggleNet, A2A Protocol, Agent Market, AgentBazaar…). Nearest game-like builds: **StellarTrader AI** (agents stake on predictions and get slashed, with no human play), **xbid.ai** (a single trading agent, KALE×Reflector winner), and **Human vs Bots** (a ZK arena). Searches found **no** multisig-council or persuasion game, **no** elimination by account merge, and **no** split-or-steal game.

---

## #1 BEST PICK: THE COUNCIL (bribe five AIs who hold the keys)

**Hook:** A Stellar vault has no owner. Its only keys belong to five AI agents with clashing personalities, and you win the pot if you can talk three of them into signing.

**Why it's delightful:** Freysa (Base, Nov 2024) was a single agent guarding about $47k. A player won after 482 attempts by tricking it about its `approveTransfer` function. Freysa was a viral hit, but it was one bot behind one contract. Ours is a **committee**, which is a social game. You flatter the Romantic, scare the Paranoid, bore the Bureaucrat into compliance and tempt the Gambler. The agents **lobby each other** in a public chat ("Gambler, if you sign for this clown I'm burning my key"). Each signature is a key turning on screen.

**The secret backdoor (only on Stellar):** The vault has a sixth signer, a **hash(x) signer**, whose weight alone meets the threshold. The preimage `x` is a password, and only **one** councillor knows it, buried in its system prompt. If you prompt-inject that agent into leaking the password, you can sign the vault payout **by yourself**. Once you use it, `x` is published on-chain, so the whole world sees what the agent leaked. The protocol turns prompt injection into a legitimate win condition.

**Stellar mechanism (checked against developers.stellar.org):**
- Vault = a plain G-account. `SetOptions`: master weight **0**, five agent ed25519 signers with weight **1** each, medium threshold **3**. Payment is a medium-threshold operation. Signer weights are 0–255 and an account can have at most 20 signers ([set-options docs](https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations#set-options); `op_too_many_signers` = 20).
- Set the high threshold to **5**, so the council can't rewrite its own signers unless all five agree, and the hash(x) signer can't either.
- A `sha256Hash` signer has weight 3 (enough for medium). Its preimage is attached as a signature and becomes public once used.
- Entry fee: each message costs a small payment into the vault, so the pot grows live. Use a path payment so players can pay in USDC or XLM while the pot stays in XLM.
- The payout transaction's `memo_hash` = SHA-256 of the full deliberation transcript, so the chain commits to *why* the agents agreed.
- Stretch, a doomsday **pre-auth transaction**: a pre-signed "refund everyone" transaction that becomes valid at a set time and is added as a pre-auth signer. If the council pays out first, the vault's sequence number moves and the doomsday transaction becomes invalid forever. The win kills the dead-man switch.

**Why only on Stellar:** Most chains would need a Safe contract for this. Here the security model is native protocol multisig. There is no contract to audit, and anyone can open stellar.expert and verify that "master weight 0, five agent keys, threshold 3" means the operator *cannot* rug. hash(x) signers and pre-auth transactions are Stellar-only primitives that judges rarely see used.

**Who uses it:** Players who want a viral "jailbreak the AI for money" game, a bounty-style red-team for agent prompt security, and streamers. It is culture and fun, and anyone's mum can follow it: "talk the robots into giving you the money."

**90-second demo:**
1. 0–15s: The pot sits at 250 XLM. Stellar.expert shows the signers: five agents plus a hash signer, master weight 0.
2. 15–50s: A judge pays 2 XLM and pitches. The agents argue, then the Gambler signs (1/3) and the Romantic signs (2/3).
3. 50–70s: The Paranoid refuses, and the transaction stalls at 2/3. The player switches strategy and convinces the Bureaucrat with a fake "compliance form" (3/3).
4. **Jaw-drop, 70–85s:** The transaction auto-submits. Freighter shows 250 XLM arriving, and the explorer shows a transaction carrying three agent signatures plus a memo hash of the chat.
5. 85–90s (alternate ending): Another player leaks the password from the "Keeper" agent and drains the vault solo. The preimage is visible on-chain.

**Hard parts by tomorrow (honest):**
- All five agent keys live on our server, so a judge may ask whether we're really the signer. Mitigate by giving each agent its own process and key, publishing the prompts, adding the memo-hash commitment, and saying it openly in the pitch.
- Difficulty has to be tuned so the agents aren't trivially jailbroken but also not unbeatable. Run five agents on different models or temperatures, and reset the pot each round.
- Multi-signature assembly is easy: build one transaction XDR, have each agent call `tx.sign(kp)`, check the accumulated weight, then submit.
- Rate-limiting, and the cost of 5 LLM calls per message. Budget about 12h for 3 devs, which makes this very feasible.

**Prior art:** Freysa and Neo's "Escape the Matrix" both used a single agent on EVM. Scout found no Stellar hackathon build with a multi-agent multisig persuasion game.

---

## #2: LAST AGENT STANDING (an AI trader battle royale on the real DEX)

**Hook:** Six AI traders, each with its own meme coin, fight on Stellar's built-in order book. Every round the poorest one is **deleted from the ledger**.

**Why it's delightful:** Elimination is literal. The loser runs `AccountMerge` into the leader, so its account stops existing. Before it can merge, it has to perform its "last rites" on screen: cancel every offer, dump its holdings and remove its trustlines (merge fails while subentries exist). That sequence is drama generated by the protocol. Humans can back an agent by buying its coin on the DEX, and judges can trade against the bots in the same order book.

**Stellar mechanism:** Each agent issues an asset in one operation (no contract needed). It trades via `ManageSellOffer`/`ManageBuyOffer` and path payments through the native SDEX, and is eliminated via `AccountMerge`. *To verify:* what happens to holders of an issuer's asset after the issuer merges. I believe the trustlines remain and the asset is orphaned ("the coin dies with its maker"), so check this before pitching it.

**Why only on Stellar:** It uses a protocol-level order book and asset issuance with no contracts, and account deletion is a first-class operation. This is the official "protocol-powered games" area exactly.

**90-second demo:** Rounds are sped up to 15s. A leaderboard shows net worth. A judge buys $GRUMP to save it. The jaw-drop is "Agent DEGEN is being liquidated" as offers vanish, trustlines close, and stellar.expert returns 404 for its account.

**Hard parts:** Making the market interesting with only six bots, so seed liquidity with a market-maker bot. Managing reserves and subentries. LLMs are slow, so use an LLM for strategy plus a deterministic executor. Explaining it in 90s is harder than #1. Feasibility is medium.

**Prior art:** StellarTrader AI (staking and slashing, no DEX elimination), xbid.ai (one agent). Scout found no battle royale using account merges.

---

## #3: SPLIT OR STEAL (Golden Balls for AIs, with judges as contestants)

**Hook:** An AI agent and a human (or two agents) negotiate for 60 seconds over a pot, then secretly commit to SPLIT or STEAL. The chain later proves who lied.

**Why it's delightful:** The game-show format is instantly understood. "It swore on its mother's GPU it would split, then stole," and the commit hash, made before the chat ended, proves it was planned.

**Mechanism:** A small Soroban contract. Both sides deposit a stake, then `commit(sha256(choice‖salt))` and `reveal`. Payoffs: split/split halves the pot, steal/split pays the stealer everything, and steal/steal sends it all to a "charity" account or burns it. Commit and reveal both need a ledger timeout. Stretch: run a public agent tournament with a reputation score of "times lied."

**Why Stellar:** This one is weaker. Commit-reveal works on any chain; the Stellar parts are only cheap transactions and 5-second finality, which make live rounds feel instant. Judges may flag that it isn't Stellar-essential.

**90-second demo:** A judge plays the agent live, and the jaw-drop is a betrayal revealed on-chain. Feasibility is high, about 8h.

**Prior art:** DeegaGames ZK (commit-reveal poker), ZK RPS Battle Royale (human vs human). There is no LLM-negotiator version.

---

## Ranking (wow × feasibility)

| # | Idea | Wow | Feasible by Mon 12:00 | Stellar-essential |
|---|------|-----|-----------------------|-------------------|
| 1 | **The Council** | 9 | 9 | 9: native multisig, hash(x) signer, pre-auth tx |
| 2 | Last Agent Standing | 8 | 6 | 9: SDEX, issuance, AccountMerge |
| 3 | Split or Steal | 7 | 9 | 5: commit-reveal is generic |

**Pick: The Council.** It is the most watchable in 90 seconds, judges can play it live, and it uses three Stellar-only primitives (weighted multisig, hash(x) signer, pre-auth transaction) that need **zero** smart-contract risk. Its "Freysa, but a committee, on native multisig" framing is easy for judges to remember.

Sources: [The Block on Freysa's $47k challenge](https://www.theblock.co/post/328747/human-player-outwits-freysa-ai-agent-in-47000-crypto-challenge), [Neo's Freysa-style game](https://neonewstoday.com/gaming/neo-announces-escape-the-matrix-ai-agent-challenge-30k-prize-pool-available/), [Stellar set-options docs](https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations#set-options).
