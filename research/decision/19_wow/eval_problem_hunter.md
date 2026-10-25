# Wow round: demand evidence (Problem Hunter)

Written Sun 2026-10-25, 14:57–15:15 WET. Candidates: THE COUNCIL (wow_agents), MUTUAL (wow_zk), SEALED (wow_new).

Labels:
- **[V]**: verified via search/source today
- **[V-co]**: verified, company-reported
- **[A]**: assumption
- **[S]**: speculation

## Evidence: do people play or use these things?

### Prompt-injection and persuasion games (→ THE COUNCIL)

| Game | Evidence | Label |
|---|---|---|
| **Freysa** (Base, Nov 2024) | 195 players, 482 attempts. Pot $47,316 from a $3,000 seed. Fees started at $10/message, rising 0.78% each, peaking ~$443–450, cap $4,500. **70% of fees went to the pot**, the rest (~30%) to the developer. Payout rules for the non-winner case are disputed across sources (10%/90% vs 20%/80%). Winner p0pular.eth tricked it about `approveTransfer`. Rough gross ≈ $44k of fees → ~$13k developer revenue [arithmetic, A]. | [V] The Block: https://www.theblock.co/post/328747/human-player-outwits-freysa-ai-agent-in-47000-crypto-challenge ; https://www.theblock.co/post/328659/players-are-trying-to-convince-this-ai-to-hand-over-her-40000-crypto-stash |
| **Lakera Gandalf** (free) | Launched May 2023. **>1M players, >40M prompts and guesses**, ~107k prompts/day, 68+ languages, ~17% reach the final level. | [V-co] https://www.lakera.ai/news/gandalf-new-ui-and-enhanced-ai-security-education ; earlier figures (18M prompts) at https://www.destructoid.com/players-have-tried-to-crack-security-companys-password-game-over-4-million-times/ |
| **Tensor Trust** (Berkeley, ICLR 2024; free) | Dataset of **563k+ attacks and 118k+ defences** produced by players of the online game. Player count not stated. | [V] https://arxiv.org/abs/2311.01011 ; https://iclr.cc/virtual/2024/poster/18168 |
| **HackAPrompt** | Could not verify participant numbers in this session. | — |
| **RedTeam Arena** (LMSYS) | Exists as a community red-teaming game. Numbers not checked. | [V existence] https://lmsys.org/blog/2024-09-13-redteam-arena |

**Reading:**
- Free persuasion games attract **millions** (Gandalf); paid ones attract **hundreds** (Freysa's 195 players).
- Money turns it from mass play into a **small, crypto-native, high-stakes niche with a viral news moment**.
- Repeat play exists in the free versions (levels; 17% reach the end). The paid version was a **one-shot event**: once the pot is won, the game is over.

### Mutual-crush apps (→ MUTUAL)

| Product | Evidence | Label |
|---|---|---|
| **Datamatch** (Harvard, free, annual Valentine's) | 3,672 participants (2014). >4,000 = **>60% of undergraduates** (2016). ~4,300 (2018). | [V] https://www.thecrimson.com/article/2018/2/15/datamatch-numbers/ ; https://www.thecrimson.com/article/2014/2/19/the-data-on-datamatch/ |
| **Facebook Dating "Secret Crush"** | Up to 9 crushes among friends/followers. A match is revealed only if mutual; otherwise "no one will know". **No usage statistics found.** | [V mechanics] https://www.bustle.com/life/how-does-secret-crush-on-facebook-dating-work-heres-what-you-need-to-know-18722288 |
| **Instagram mutual-crush feature** | **None found.** Close Friends is a sharing feature, not matching. | [V absence] |

**Reading:**
- **The mechanic is proven and loved in closed communities with a moment.** Datamatch gets >60% of a campus once a year.
- **The mutual-reveal UX already exists free** inside Facebook Dating, which uses a trusted operator. Users haven't demanded that "even the operator can't see"; trust in the operator was enough [A].
- The ZK guarantee is real but **solves a problem users don't feel**. Its value is wow for judges, not pull for users.

### Prediction / dare markets with stakes (→ SEALED)

- **Polymarket is illegal in Portugal.** The SRIJ ordered a block in Jan 2026: no authorisation, and **"betting on political events is not allowed"**. Vodafone, NOS and MEO blocked it [V] (https://eco.sapo.pt/2026/01/21/operadoras-de-telecomunicacoes-bloqueiam-site-de-apostas-polymarket-apos-ordem-do-regulador/ ; https://www.theblock.co/post/386233/portugal-orders-polymarket-blocked-after-election-bets-surge-before-results-announced).
- Portuguese law allows only licensed online sports betting, casino games and horse racing. Every operator needs an SRIJ licence [V-sec, via sbcnews/theblock].
- **Prediction markets as a category:** demand clearly exists (Polymarket, Kalshi) [A, well known]. But SEALED's hook is *sealed predictions/dares between friends*. The demand evidence for "commit a prediction with money between friends" is anecdotal [S].

## Per candidate

### THE COUNCIL (persuade 3 of 5 AI agents to sign a multisig pot)
- **Who plays:** crypto-native players and prompt hackers. That's the Freysa crowd: 195 players, hundreds of attempts. Plus AI-curious devs from the Gandalf/Tensor Trust community, if a free practice mode exists.
- **Why they'd come back:** new councils, new personalities, a leaderboard of "how you broke them". Each pot is one-shot (Freysa), so retention needs **seasons** [A]. The free mode is the funnel (Gandalf scale); the paid mode is the event.
- **Do money stakes change it?** Yes. Money creates the **news moment** (Freysa's $47k headline) but cuts players from millions to hundreds.
- **Legal (Portugal/EU):**
  - A paid entry into a prize pot where outcome depends on persuading an LLM (non-deterministic) is at minimum **arguable as "jogo de fortuna ou azar" or an unlicensed online game**. SRIJ licenses only sports betting, casino and horse racing [V], and actively blocks unlicensed crypto platforms (Polymarket) [V].
  - "Game of skill" status for persuading a stochastic model is untested [A]. **A testnet prototype is fine. A real-money launch in PT would need legal advice or geo-restriction [A].**
- **Users/liquidity to Stellar:** small but real. A few hundred players funding pots, and the per-message fees are on-chain volume. Freysa did ~$44k of fees in days [V arithmetic].
  - Viral attention is the main ecosystem effect [S].
  - No sustained liquidity.

### MUTUAL (ZK anonymous crush matching)
- **Who plays:** members of a closed community at a moment: a hackathon tonight, a wedding, a campus at Valentine's. Datamatch proves a >60% campus take-up for a free, annual, operator-trusted version [V].
- **Why they'd come back:** a new event or community. Engagement is **episodic, not daily** [A].
- **Do money stakes change it?** No money is involved. Adding money would be odd or creepy [A].
- **Legal:** no gambling issue. GDPR is favourable, since the design minimises data. Risk: harassment or "crush on a minor" at a public event, which needs a community gate [A].
- **Users/liquidity to Stellar:**
  - Accounts only, created via relayer or sponsored and ephemeral. **No liquidity.**
  - Users may never knowingly touch Stellar, because the relayer hides it.
  - Real users per event: tens to hundreds [S].
- **Main weakness from my lens:** the privacy guarantee is the product, but users already accept Facebook Dating's operator-trusted version [A]. And ZK on Stellar is crowded (two ZK hackathons) [V-sec, wow_new].

### SEALED (drand timelock predictions/dares with stakes)
- **Who plays:** friends betting on football, group chats, "called it" culture. Also a no-money mode: time capsules and "I called it" receipts [A].
- **Why they'd come back:** weekly matches give natural recurrence [A].
- **Do money stakes change it?** **Yes, legally.** In Portugal, stakes on sports outcomes are **sports betting, licensable only by SRIJ** [V]. Political outcomes are **prohibited outright** [V]. A friends-only P2P stake is still unlicensed betting if operated as a platform [A].
  - **The no-stake version (proof-of-prediction / time capsule) is legally clean**, and the drand-on-Stellar novelty survives.
- **Users/liquidity to Stellar:** small P2P stakes (XLM/USDC). Hand-wavy as liquidity. Credible as **first unbiasable public randomness on Stellar** (a drand verifier is reusable infrastructure), which is an ecosystem contribution rather than users [S].

## Summary verdict (demand lens)

| | Proven demand for the mechanic | Money stakes help? | Legal risk (PT) | Users / liquidity to Stellar |
|---|---|---|---|---|
| **THE COUNCIL** | **Strong.** Gandalf >1M players (free); Freysa 195 players / $47k (paid) [V] | Yes for virality; shrinks the audience | **High** for real money (unlicensed game/betting) [A]; none on testnet | Hundreds of players, fee volume, viral attention |
| **MUTUAL** | **Strong for free, closed-community, episodic** (Datamatch >60% of campus) [V]; ZK privacy is not a felt need [A] | No | Low (needs a harassment gate) | Accounts only, no liquidity |
| **SEALED** | Moderate. Prediction markets yes; sealed friend-dares anecdotal [S] | Stakes = betting | **High** with stakes (SRIJ; political bets banned) [V]; **none** without | Small; drand verifier = infra contribution |

**Problem Hunter pick:** **THE COUNCIL**.
- Its mechanic has the strongest real-world demand evidence (Gandalf's million, Freysa's paid pot and press).
- It brings on-chain volume, and it is the "creative AI agents" ask from the judges.
- Run it as a **testnet / free-to-play** game with an opt-in pot, and disclose the PT gambling caveat.
- **SEALED** is second: the most novel tech (first drand verifier), but its demand case only survives in the *no-stakes* form.
- **MUTUAL** is third: delightful for one night, but the user doesn't need the ZK guarantee and it brings no liquidity.
