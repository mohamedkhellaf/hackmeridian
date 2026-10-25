# Wow round: Wildcard Inventor's evaluation and single design

Written Sun 2026-10-25, about 15:00–15:15 WET.

**Inputs read:** `wow_brief`, `wow_agents` (THE COUNCIL), `wow_zk` (MUTUAL, Unstealable Answer), `wow_new` (SEALED/drand, Crowd Key, Bribe the Bouncer), `wow_culture` (Pedido, Desvio, Manjerico) and `wow_games` (SARDINHA NA BRASA).

**Labels:** [V] verified, [A] assumption, [S] speculation, [U] unknown dependency.

## The design principle that decides everything

> **Put the AI where trust doesn't matter, and the protocol where it does.**

In every "AI guards a vault" design (Freysa, our own Bribe the Bouncer, a naive COUNCIL), the AI's key is custody. A judge's first question is "so your server holds the keys?". The jaw-dropping version keeps all custody and all endings protocol-enforced, and lets the AIs only be **voters** whose votes are real signatures inside a quorum that Stellar itself counts.

That rules some things out:
- **ZK inside the hero flow.** A classic G-account can't have a Soroban verifier as a signer. ZK would force the vault into a custom-account contract, which brings Rust, a circuit and a verifier, and loses the seq-exclusive endings. That's messy.
- **drand traitor selection.** The BLS verifier is 3–5h of risk [A, per wow_new] for little added drama.

## THE single version: **O CONSELHO: talk 3 of 5 Lisbon AIs into signing, before the sardine burns**

This is wow_agents' COUNCIL, plus wow_games' Sardinha mechanic as a **protocol-enforced doomsday clock**. ZK is an optional side-pot.

**Hook:** "250 XLM sits in a Stellar account nobody owns, not even us. Five AI Lisboetas each hold one key. Convince three to sign before the clock runs out, or the pot goes to the Santo António festival fund, and the network itself enforces that."

### Mechanism: all classic, all already-verified primitive families
1. **Vault V** (`setOptions`):

   | Setting | Value |
   |---|---|
   | Master weight | **0** |
   | Agent ed25519 signers | **5**, weight 1 each |
   | Medium threshold | 3 |
   | High threshold | 5 |

   Weighted thresholds are proven by our spikes a–f [V].
2. **Doomsday ending.** At round start we build the **burn transaction**: pot → festival fund, plus `accountMerge`.
   - Sequence number `S+1`; time bound `minTime = deadline`.
   - Its hash is added as a **pre-auth tx signer** with **weight 5**, so it also meets the high threshold that `accountMerge` needs. That is safe because a pre-auth signer authorizes only that one exact transaction.
   - The council's payout is a plain `payment` (medium 3), with no merge.
   - Before the deadline it is rejected (`tx_too_early`).
3. **Win.** The council's payout transaction to the player *also* uses sequence `S+1`.
   - **Whichever lands first kills the other** (`tx_bad_seq`). This is the same-sequence exclusivity verified in C1 and the Sardinha design [V for the mechanic family; A for this exact combination, needing a 30-minute spike].
   - Result: the operator can't extend, cancel or rig the deadline, and the council can't pay after it.
4. **Agents as voters.**
   - Each of the 5 agents runs as its own process with its own key and persona, and sees the shared public chat.
   - Agents **lobby each other**, not just the player.
   - An agent "votes" by calling a `sign` tool. That produces a real ed25519 signature over the *same* payout XDR.
   - The UI shows the signature bytes accumulating: 1/3, 2/3, 3/3, then auto-submit.
5. **Pay-per-message.** Each message is a 1-XLM payment into V, so the pot grows live. Payment memos carry message hashes.
6. **Transcript commitment.** The payout's `memo_hash` is the SHA-256 of the whole deliberation. The round-start transaction's memo is the hash of the five system prompts, published after the round so anyone can audit that the personas weren't swapped mid-game.

### Lisbon personas (the human fingerprint)

| Persona | Character | How to win them |
|---|---|---|
| **O Fadista** | Romantic | Moved by saudade |
| **A Contabilista** | Bureaucrat | Signs only with a proper *requerimento* |
| **O Pescador** | Gambler | |
| **A Avó** | Paranoid; warns the others | |
| **O Taxista** | Contrarian; votes against whoever spoke last | |

### Optional ZK side-pot (stretch, only if the BN254 verifier is green by about 02:00)
- *A Avó* knows a password. Tricking her lets you claim a **separate Soroban side-pot** with an Unstealable-Answer Groth16 proof bound to your address (wow_zk hook 2).
- The secret never touches the chain, and the claim can't be front-run. A classic hash(x) signer would publish x and could be raced.
- It is pitched as "Stellar's 2015 hash(x) signer, fixed by 2026's BN254".
- **It is not the hero flow.**

### Differentiation from Freysa and the inevitable "AI guards a vault" twins

| | Freysa (Base 2024) / Bouncer twins | O Conselho |
|---|---|---|
| Guardians | 1 agent | 5 agents that **argue with each other**, so persuasion is social, not a single jailbreak |
| Rules live in | an EVM contract or operator code | the account's **signer table**: master weight 0, 3-of-5, readable on stellar.expert |
| Deadline | operator-controlled | **validator-enforced doomsday transaction**; the operator can't extend it |
| Win proof | contract call | one payout transaction carrying **three AI signatures** plus a transcript hash |
| Trust hole | operator runs the AI and holds the funds | the operator runs the AIs (disclosed) but **holds no key to V**, and the losing ending is pre-committed |

Freysa: a single agent, ~$47k, 482 attempts [V The Block, OECD AI incident]. Twin likelihood:
- **"AI guards a vault"** as a category: **high**. Lane E produced one independently, and Freysa is famous.
- **This exact design** (a committee of agents that lobby each other, a protocol-enforced doomsday clock, three real signatures on one transaction): **low** [S].
- Scout: 0 Freysa-style builds on Stellar [V per wow_new and wow_agents].

### 90-second demo (★ = memorable moment)

| Time | What happens |
|---|---|
| 0–10s | stellar.expert on V: "master weight 0 · 5 agent keys · threshold 3 · 1 pre-auth ending at 15:30. These are the only futures this money has." |
| 10–20s | The five Lisbon personas appear around a table. The pot is 250 XLM, with a sardine-on-the-grill countdown. |
| 20–55s | A judge pitches in chat. The agents bicker (Avó: "Pescador, se assinas por este palhaço, eu queimo a minha chave"). Pescador signs (1/3, real signature hex flashes). Fadista signs after a fado-themed plea (2/3). Avó refuses. The player hands the Contabilista a stamped *requerimento*, and she signs (3/3). |
| ★ 55–70s | The transaction auto-submits and **the third AI signature turns the key**: 250 XLM lands in the judge's wallet. In the same instant the doomsday ending greys out with the network's own **`tx_bad_seq`**: "the burn just died". The explorer shows one transaction with three AI signatures and the transcript hash. |
| 70–85s | Alternate replay: nobody convinces the council, the clock hits zero, and the burn transaction fires. The pot goes to the festival fund and V is merged out of existence. "Not even we could stop it." |
| 85–90s | "Freysa had one guard. We built a parliament, and Stellar keeps the clock." |

### Feasibility (3 devs plus an AI coder, by Mon 12:00)
- **Estimate: about 13–15h.**

  | Work | Hours |
  |---|---|
  | Vault and doomsday script | 2 |
  | Five-agent orchestration (parallel LLM calls, a shared chat bus, a `sign` tool gated by the model's own decision, per-agent key isolation) | 5 |
  | Chat, table UI and signature meter | 4 |
  | Pay-per-message | 1 |
  | Polish and round reset | 2–3 |

- **ZK side-pot:** +5–7h, high risk, stretch only.
- **Must-spike first (30 min):** payout and doomsday share sequence `S+1`, with the doomsday added as a pre-auth signer (weight 5). Check that the pre-auth signer is consumed or removed and that the merge succeeds [A].
- **Risks:**
  - **Difficulty tuning.** Too easy is boring, too hard is unwinnable. Fix with a per-round temperature and model mix, and a short window.
  - **LLM latency.** Run the five agents in parallel and stream responses.
  - **Async judging.** Keep a always-open public round with a 30-minute clock and auto-restart, plus a "watch a recorded round" link.
  - **Content safety.** Personas are cartoonish, not real people.
  - **Honesty about custody of the AI keys.** Say it plainly; TEEs are future work.

### Honest ratings
- **Wow: 9/10.** It is viral ("I talked three AIs into signing a Stellar transaction"), judges can play it, and the clock-death beat is protocol theatre.
- **Twin risk:**
  - category: **medium–high**;
  - this design: **low**.
- **Feasibility:**
  - classic hero: **8/10**;
  - with the ZK side-pot: **5/10**.
- **Stellar-essential:** high. Native weighted multisig, pre-auth signers, sequence exclusivity and time bounds, with no contract.
- **"My mom gets it": yes.** "Talk the robots into giving you the money before the sardine burns."

## Sardinha: would AI or ZK make it better or messier?
- **AI agents as chicken opponents: better, and clean.**
  - Chicken is a bluffing game, so LLM opponents that trash-talk and **lie about when they'll grab** add real game depth.
  - Trust stays perfect: the agents are *players* with their own seats, not custodians.
  - Recommended as the **backup hero**: "Sardinha vs. the Bluffers". Wow 7.5, feasibility 9 (no LLM-custody question at all).
- **ZK commitment: messier.**
  - A sealed pre-committed grab tier turns chicken into a sealed-bid game and kills the live tension.
  - It needs a circuit for no visible gain. Skip it.
- **As used above:** Sardinha's single best contribution is the **doomsday clock inside O Conselho**. It is one account and one sequence number, not a second game.

## Others in the wow set, briefly
- **MUTUAL** (ZK crush):
  - The best pure-ZK delight (wow 9). It uses Semaphore v4 unchanged.
  - But its BN254 encoding risk is 2–3h before anything works, and it's a different product, not combinable without mess.
  - Keep it as the alternative if the team wants ZK as the hero.
- **SEALED** (drand timelock): a genuinely new primitive on Stellar (0 Scout hits), but the verifier is high-risk and the bet-resolution oracle is unresolved.
- **PEDIDO** (busker order book): charming, classic-only, a strong culture pick. Wow 7.

## Recommendation
1. **Build O Conselho** (classic hero, doomsday clock) as the hero.
2. **ZK side-pot only as a stretch.**
3. **Backup if LLM tuning fails by about 21:00:** Sardinha vs. the Bluffers, reusing the same seq-exclusive endings code.
