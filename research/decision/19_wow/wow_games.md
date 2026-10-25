# WOW lane: protocol-powered games

Three games whose rules are classic Stellar protocol features. **None needs a smart contract**: validators are the referee, and there is no game server to trust. They are ranked by wow × feasibility.

Prior-art method: Scout `searchHackathonBuilds` on about 30 queries (path payment game, order book game, DEX game, market-making game, tram, treasure hunt, hash preimage, claimable balance game, sequence number, duel, chicken, war of attrition, pre-authorized transaction, time bound, azulejo, sardine, lisbon, …), plus two web searches.

**Finding:** Stellar game prior art is overwhelmingly ZK. The "Stellar Hacks: ZK Gaming" hackathon produced at least 6 ZK Battleships, plus ZK treasure hunts, poker and UNO. **Avoid ZK games.** No build uses classic primitives (pre-auth transactions, the DEX, hash(x) signers) as game mechanics. "tram", "sardine", "lisbon" and "azulejo" returned zero builds.

---

## 1. SARDINHA NA BRASA: a game of chicken whose rules are 17 pre-signed transactions  ⭐ BEST PICK

**Hook:** The prize pot sits in a Stellar account that nobody can control, not even us. It has exactly 17 possible endings, all written on-chain before the round starts. The longer you wait, the bigger the sardine you grab, but the first person to grab ends it for everyone.

**Why it's delightful:** It's "chicken" at a Santos Populares grill, and anyone's mom gets it in 5 seconds: "The longer it grills, the bigger your piece. Wait too long and someone else takes it, or it burns." The surprising part for the technical audience is that the game logic is just a set of signers on an account plus sequence-number exclusivity. There's no Soroban, no backend, and no oracle. When someone grabs, every other ticket dies at the protocol level: the network rejects it as `tx_bad_seq`.

**Mechanism (verified against developers.stellar.org):**
- **Setup.**
  - Create a pot account P. Four players each pay a 25 XLM buy-in, so the pot is 100 XLM.
  - The game pre-builds one ticket transaction per (player, tier). **Every ticket uses the same sequence number N+1.**
  - Each ticket's time-bounds `minTime` is that tier's unlock time (tier 1 at +30 s, tier 2 at +60 s, …).
  - Each ticket pays its player a growing share and splits the rest among the others. Example (grabber / each other player): tier 1 = 40/20, tier 2 = 55/15, tier 3 = 70/10, tier 4 = 100/0. It then `accountMerge`s P so nothing is left over.
  - Add each ticket's hash as a **pre-auth tx signer** on P: 4 players × 4 tiers = 16 signers.
  - Add one **"burnt sardine" ticket** with `minTime = end`. It sends the pot to a charity or Santo António fund, so somebody has to blink. That makes 17 signers in total. The docs confirm 20 is the maximum.
  - Set P's master key weight to 0. P can now **only** ever execute one of these 17 transactions.
- **Grab.**
  - A player clicks GRAB and the browser submits their highest unlocked ticket.
  - Clicking before the tier unlocks is rejected as `tx_too_early`; the UI shows "the grill isn't hot yet".
  - The first ticket applied consumes sequence N+1. All other tickets are now permanently invalid.
  - The docs say a pre-auth signer "is automatically removed … when a matching transaction is applied", and `accountMerge` removes the rest.
- **Ties.** Tickets that land in the same ledger are ordered by the validators. Docs: "the apply order … shuffles the set's order to create uncertainty for competing transactions." So consensus itself is the coin flip in a photo finish.
- **Only the owner can fire their ticket.** Add a second operation to each ticket whose source is the player's account, for example a `bumpSequence` or a 0-value payment. The ticket then also needs the player's signature. The tx hash excludes signatures, so the pre-auth hash stays fixed. This means all 17 ticket bodies can be published at the start so anyone can audit the "rulebook" on-chain, and nobody can fire someone else's ticket.

**Why only on Stellar:** Pre-authorized transaction signers, account-level multisig weights, native time bounds, and sequence-number exclusivity are all L1 protocol features. On EVM you would write and audit a contract and trust its code. Here the rulebook is a list of signer hashes visible on Stellar Expert, and you can check that the account's master weight is 0. This takes classic primitives no one in Stellar game prior art has touched and makes them the whole game.

**Who would use it:**
- Booth, meetup and stream crowds: quick 2-minute rounds with real XLM tension.
- A teaching tool: "a smart contract with no smart contract."
- Long-term, a family of "pre-committed endings" games: auctions, races, tontines.

**90-second demo:**
1. 0–15 s: the hook. Show the pot account on Stellar Expert: master weight 0 and 17 signers. "These are the only 17 futures this money has."
2. 15–60 s: a live round against 3 bots. The sardine grills and the pot shares climb as tiers unlock. One bot blinks at tier 2.
3. **Jaw-drop:** the other 16 tickets turn grey in real time, each showing the network's own `tx_bad_seq` error. The coins land in wallets, then the Stellar Expert account page shows "merged".
4. 60–90 s: replay a photo finish where two grabs land in the same ledger and the validators' shuffle picks the winner. "No server. No contract. Not even us."

**Judges can play:** the lobby opens a new table every 3 minutes, with Freighter or a generated testnet keypair funded by friendbot, and bots fill the empty seats.

**Hard by tomorrow (honest):**
- Building tickets with pre-auth hashes is fiddly but small. Use `TransactionBuilder` with a fixed sequence and fee, then `tx.hash()`, then `setOptions({signer:{preAuthTx}})`.
- Set the ticket fee generously, for example 10 000 stroops paid by P, so surge pricing can't strand a ticket.
- **Verify on testnet in the first hour** that a ticket missing the player's op-source signature is rejected at submission (`tx_bad_auth`) and does not consume the sequence number. A 2017 protocol issue (stellar-protocol#51) complained that failed transactions burned sequence numbers. Modern core rejects bad auth before apply, but test it.
- If it fails, fallback: keep ticket bodies private per player and publish them after the round.
- Payouts must be exact, because a failed apply still consumes the sequence.
- The bots are a tiny Node loop.
- **Estimate:** 1 dev on tickets and bots, 1 on UI and animation. About 6–8 h to a solid demo.

**Prior art:** no Scout hits for "pre-authorized transaction", "pre-signed transaction game", "chicken game", "war of attrition" or "last man standing pot". The "chicken" hit was Chickenz.io, an unrelated ZK platformer. The web search found nothing either.

---

## 2. ELÉTRICO 28: the Stellar DEX as a Lisbon tram network

**Hook:** Every Lisbon neighbourhood is a token, every DEX order is a tram line you own, and every passenger is a real path payment. The network picks the cheapest fare on every hop, and the line owners get paid instantly.

**Why it's delightful:** It's a map game (Alfama, Baixa, Chiado, Belém, Graça, Estrela, Martim Moniz, Prazeres) where you're secretly a market maker. You "lay track" Baixa→Chiado by posting an offer, and your price is your fare. Undercut a rival's fare and passengers are routed through *your* line instead. Every ride also moves inventory, so your line runs out of seats and you must rebalance.

**Mechanism:**
- **Assets.** One game issuer creates 8 stop assets.
- **Laying track.**
  - Players hold inventory of each stop asset.
  - Track A→B is a `manageSellOffer` selling B for A at a fare price, for example 1 B for 1.05 A.
  - A "metro line" can be an AMM `liquidityPoolDeposit`.
- **Passengers.**
  - Bots, judges or tourists ride with `pathPaymentStrictReceive`: "deliver 10 BELEM, pay at most 12 ALFAMA".
  - The path comes from Horizon `/paths/strict-receive`, or a client-side BFS over 8 assets (28 pairs, trivial).
  - Docs: "Stellar only considers paths of length 5 or less."
- **Who enforces what.** Within each hop, the protocol fills against the best-priced offers first and, since AMMs were added, compares the order book against the pool. It is atomic all-or-nothing and respects the max-send limit. *Be precise in the pitch:* route discovery happens off-chain, while best-price fill and atomic settlement are enforced by the validators.
- **Score.** Total holdings valued at par.

**Why only on Stellar:** The protocol-native order book, AMM and multi-hop path payments have existed since 2015, with no router contract. Every move in the game is a real DEX trade, so the game literally creates testnet liquidity. This fits the "Bring users and liquidity" area and teaches market making by playing.

**Who would use it:** casual players who'd never touch a DEX, and the Stellar ecosystem itself, as an on-ramp that explains "what is a market maker" through trams.

**90-second demo:**
1. Map of Lisbon with yellow trams.
2. The judge lays a cheap Chiado→Belém line.
3. **Jaw-drop:** a tourist asks for Alfama→Belém. The tram animates along the 4-hop route the payment actually took, through three different players' lines. Coins pop into each owner's wallet. It's one atomic Stellar operation that settles in about 5 s, and the operation and its offer trades are shown on Stellar Expert.
4. A rival undercuts the judge's fare, and the next tram goes their way.

**Hard by tomorrow:**
- Setup is easy: 8 trustlines per player, friendbot, issuer distribution.
- Path finding through Horizon testnet should work. Verify it's live early, and keep the BFS fallback.
- Bots generating trips are easy.
- The real cost is the map UI and tram animation polish, plus game balance (fares, inventory).
- **Estimate:** about 10–12 h. It's more visual than #1 but has more moving parts.

**Prior art:** Scout found no game on the order book or path payments. The nearest is "DeFi Quest" (PaltaLabs Swaps & Vaults hackathon winner), an onboarding quest, not a market-making game. "Panda Pathways" is gamified earning, unrelated. "Stellar Arbitrage" is a trading tool. The web search found no DEX-as-board game.

---

## 3. AZULEJO HEIST: hash(x) multisig treasure hidden inside our own pitch

**Hook:** There are 50 XLM sitting in a Stellar account right now. Its keys are painted into 3 of the azulejo tiles in this video. Find them, and the money's yours.

**Why it's delightful:**
- The judges become players while they watch the submission.
- Each tile is a generated Lisbon-style azulejo whose mirrored 16×16 pattern encodes a random 256-bit preimage x. That's not brute-forceable, unlike riddle answers, which can be dictionary-attacked against SHA-256.
- Tiles are scattered across the video, the deck, a Lisbon street map in the app, and physically around the venue.
- **Twist:**
  - The chest is a k-of-n **hash(x) multisig**: 5 tile signers with weight 1 each and a threshold of 3.
  - One tile alone is worthless, so hunters have to trade or pool tiles.
  - Showing your tile to an ally lets them use it, which creates a social trust game.

**Mechanism:**
- **Chest setup.**
  - Chest account C uses `setOptions` to add 5 `sha256Hash` signers (weight 1).
  - Its med/high thresholds are set to 3 and its master weight to 0.
- **Claiming.**
  - The browser decodes the tiles and builds `payment` + `accountMerge → finder`.
  - It signs with `tx.signHashX(x)` for 3 preimages.
  - Docs: hash(x) "allows anyone who knows x to sign the transaction".
- Merge clears the signers atomically, so leftover funds can't be drained after the preimages become public.

**Why only on Stellar:** Hash-preimage signers and weighted thresholds are account-level protocol features, with no contract. This is the weakest "only on Stellar" claim of the three, since on EVM it would be a 20-line contract.

**Who would use it:** event organizers for scavenger hunts, Lisbon tourism and street-art trails, and brands running physical-to-digital campaigns. Thin, but it's fun.

**90-second demo:** tiles flash through the video, then a judge-style user screenshots a tile, drags it in, and the progress shows "1/3". A friend pastes a second, then a third. **Jaw-drop:** the chest empties into their wallet live, and the on-chain transaction shows the three preimages as signatures.

**Hard by tomorrow:**
- Tile encode/decode from screenshots needs robust grid sampling. Using a QR disguised as an azulejo is the safe fallback.
- **Mempool sniping:** once a claim is broadcast, the preimages are visible to watchers who could race with their own transaction. That's low risk on testnet, so mention it honestly.
- **Estimate:** about 6 h.

**Prior art:** there are many *ZK* treasure hunts (SUBAN TREASURE HUNT, Pirate's Treasure, Dead Drop, all from ZK Gaming), so the genre is crowded. None uses hash(x) signers or azulejo-encoded keys, and Scout returned zero builds for "azulejo" and "hash x signer".

---

## Ranking (wow × feasibility)

| # | Idea | Wow | Feasible by Mon 12:00 | Prior art | Mom test |
|---|------|-----|-----------------------|-----------|----------|
| 1 | Sardinha na Brasa (pre-auth chicken) | 9 | 9 (no contract, ~7 h) | none | "the longer it grills, the bigger your piece" |
| 2 | Elétrico 28 (DEX tram tycoon) | 8 | 7 (~11 h, UI-heavy) | none | "own a tram line, earn fares" |
| 3 | Azulejo Heist (hash(x) multisig hunt) | 7 | 8 | genre crowded (ZK hunts) | "find the tiles, open the chest" |

**Best pick: Sardinha na Brasa.** It has the strongest "wait, what?" ("a smart contract with no smart contract: 17 pre-written futures, validators as the referee"). It's the most reliable demo, because it's only classic operations and the failure modes are known protocol errors that the UI turns into game drama. It's also unclaimed by prior art and instantly understandable. If there's spare capacity, add Azulejo Heist tiles to the video as an easter egg (about 3 h extra). It reuses the same "account with only pre-committed exits" story.

## Sources

- developers.stellar.org: signatures-multisig (pre-auth tx auto-removal, hash(x)), list-of-operations (max 20 signers; path length ≤ 5), transaction-lifecycle (apply-order shuffle), liquidity-on-stellar-sdex-liquidity-pools.
- Scout `searchHackathonBuilds`, observed 2026-10-25 14:52–14:54 UTC.
- Web: https://github.com/stellar/stellar-protocol/issues/51 (old sequence-burn concern for public pre-auth transactions; verify on testnet).
