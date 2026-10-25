# WOW lane: culture, art, music, Lisbon

Ranked by wow × feasibility. All three run on **classic Stellar primitives only** (no Soroban needed for the hero flow). That makes them fast to build and hard to copy on another chain.

---

## 1. PEDIDO: the busker whose setlist is an order book ⭐ BEST PICK

**Hook:** A street musician on a Lisbon miradouro puts every song he knows on the Stellar DEX. The crowd buys slices of a song, and when the order book clears, he plays it.

**Why it's delightful**
- The crowd fights with money, live: "Grândola" fans and "Despacito" fans compete in public. The busker sets the prices: an overplayed song gets **surge pricing** (after it's played, its ask doubles automatically). There's also a `SILENCIO` asset: if enough people buy it, he stops mid-song.
- Every fan keeps a souvenir: a fraction of `GRANDOLA` that says "I made him play this at Graça, 25 Oct 2026". It's a real asset with its own stellar.toml image, not a JPEG NFT bolted on.
- It turns a tip jar into a game the whole square watches on a screen behind the guitarist.

**Who uses it and why:** Buskers, fado vadio nights, bar bands, DJs, wedding bands. Today a song request is "shout and throw a coin". Pedido makes requests public, competitive and pooled, so ten strangers chipping in €0.50 can buy a song nobody would pay €5 for alone. Busker income comes from tips, and pooling turns small tips into bigger ones.

**Exact Stellar mechanism**
- The busker's account issues one asset per song (`GRANDOLA`, `DESPACITO`, `FADOMENOR`; codes ≤12 chars). For each song it posts a `manage_sell_offer`, e.g. 100 units at 0.10 USDC.
- **Many takers partially fill one maker offer.** This is the native SDEX behaviour. When the offer has been fully consumed (Horizon offers/trades stream), the screen flips to "A TOCAR". A bot then re-posts the offer at 2× (surge pricing).
- Fans pay with whatever they hold: `path_payment_strict_receive` (receive X GRANDOLA, send USDC/EURC/XLM). Docs confirm that path payments route across the order books and liquidity pools.
- Zero-friction onboarding: the busker **sponsors reserves** for each fan's ephemeral account and trustline (`begin/end_sponsoring_future_reserves`). The fan scans a QR and holds a song 5 seconds later without owning any XLM.
- Optional v2: song tokens get `AUTH_CLAWBACK_ENABLED`. If the busker doesn't play within 10 minutes, a refund script returns the USDC and claws back the token, so fans can trust it.

**Why only on Stellar:** A protocol-level order book with partial fills, sponsored reserves and path payments are all L1 operations. No AMM contract or matching engine to write, sub-cent fees on €0.10 bids, and ~5 s finality that fits the gap between two songs. On an EVM chain you'd have to deploy and audit a CLOB.

**90-second demo:** A teammate with a guitar (or the shot outdoors at a miradouro). Behind him, a screen shows 3 songs as progress bars driven by the live testnet order book. Two friends scan the QR, the bars climb, and "Grândola" hits 100%. **Jaw-drop:** the screen flips to A TOCAR, the guitar starts, and the Despacito price jumps to 2× live on screen while the crowd groans. We end on a phone showing the fan's souvenir token, its trade visible on stellar.expert.

**Hard by tomorrow (honest)**
- Fast fan onboarding: an ephemeral keypair in the browser plus a sponsored create-account and trustline, all in one tx signed by the busker's server. About half a day.
- A reliable fill detector (Horizon stream with polling as a fallback).
- Getting the video shot. Everything else is simple frontend.
- Risk: a judge may read it as "crowdfunding a song". Counter with the competitive market, surge pricing, the SILENCIO veto and souvenirs.

**Prior art:** Scout hackathon builds return nothing for "busker" or "jukebox". "Song request" only hits pay-per-API agents and SoundStake (music licensing). A web check found Bitcoin QR tip jars and Lightning busking events, but no order-book or partial-fill song requests. **Whitespace.**

---

## 2. DESVIO: every tourist euro takes a detour through the neighbourhood

**Hook:** In Alfama, when a tourist pays for a coffee, the payment hops USDC → **ALFAMA** → EURC. The hop runs through liquidity pools owned by the people who live on that street, so the tourist literally pays the neighbours.

**Why it's delightful**
- It turns Lisbon's biggest fight (overtourism and Alojamento Local pushing residents out) inside out.
- Residents become the toll-booth of their own street. Nobody runs a fund, there's no council to trust, and no grant committee.
- There's a Marchas Populares leaderboard: bairros compete on how much tourist flow they capture, just as they compete in the June parades.

**Who uses it and why:**
- **Residents** earn passive income just by living there and parking savings in the pool.
- **Cafés** keep receiving plain EURC.
- **Tourists** pay ~0.6% more and see a "you just paid 3 neighbours" receipt, which feels like a gift rather than a tax.
- Juntas de freguesia get a mechanism that works like Venice's resident-benefit fee but can't be misspent.

**Exact Stellar mechanism**
- The `ALFAMA` asset has `AUTH_REQUIRED` + `AUTH_REVOCABLE`. The issuer (stand-in for the junta) authorizes trustlines only for verified residents.
- Two native constant-product pools (CAP-38): USDC/ALFAMA and ALFAMA/EURC, each with a 0.30% fee. Residents `liquidity_pool_deposit` into both.
- The merchant QR encodes `path_payment_strict_receive(dest=café, destAsset=EURC, amount, path=[ALFAMA])`. That's a single atomic op, and LP fees accrue on both hops.
- The move-out twist: revoking a resident's ALFAMA authorization force-redeems their pool shares into claimable balances (CAP-38 revocation semantics; **verify** against docs before pitching).

**Why only on Stellar:** Protocol-native AMM pools plus atomic multi-hop path payments plus issuer auth flags. That's three L1 primitives composed with zero contracts. "Old-school assets, new tricks", exactly.

**90-second demo:** A map of Alfama with houses as dots. A tourist phone scans the café QR and pays 2.50 USDC. An animated route hops through the ALFAMA coin, the café receives €2.30 EURC, and **three houses on the map pulse as their LP share ticks up**. Then we cut to the junta revoking one resident ("moved to Almada"): their house greys out and their funds come back to them as a claimable balance.

**Hard by tomorrow:** Very little. All of it is classic ops. Seeding the pools and keeping ALFAMA ≈ €1 (the issuer acts as arbitrageur) is half a day. The real risk is wow: some judges may see it as "a fee with extra steps". Answer: the fee becomes ownership, it's permissionless and atomic, and the token can circulate locally.

**Prior art:** Scout has Turista (tourism NFTs and rewards) and BairrouApp (local business coupons, a different mechanism). The web shows academic "local tourism currency" proposals and WindingTree's travel liquidity pool, but **no resident-owned pools on the payment path**.

---

## 3. MANJERICO: the Santo António gift that dies if you ignore it

**Hook:** On Santo António Lisboetas give their crush a basil pot with a love quadra. We make a digital manjerico that only grows if you come back and water it every day. Skip a day and that leaf's money withers back to the sender.

**Why it's delightful:** It's the world's first passive-aggressive gift, very Lisbon and very funny. A mom understands it instantly: "it's a plant, you water it." On the last day, the final verse of the quadra unlocks the bonus.

**Who uses it and why:** Couples, long-distance friends, parents giving kids a "daily habit" allowance, and festival sponsors running a 30-day June campaign. It's an attention gift, where the point is coming back.

**Exact Stellar mechanism (zero contracts)**
- The sender creates N claimable balances, one per day.
  - Recipient claimant: `AND(NOT(before_absolute_time(day_i_start)), before_absolute_time(day_i_end))`.
  - Sender claimant: `NOT(before_absolute_time(day_i_end))`.
- The windows are exactly the documented predicate composition from the CLI cookbook. "Watering" = `claim_claimable_balance`. A missed day becomes reclaimable by the sender.
- Final leaf: a balance held by an account with a **hash(x) signer** whose preimage is the last line of the quadra. The sender says it out loud, in person.

**Why only on Stellar:** Time-windowed, multi-claimant claimable balances and hash(x) signers are L1 primitives nobody uses this way.

**90-second demo:** A plant SVG grows one leaf per claim. Fast-forward with short (1-minute) windows on testnet: claim, claim, miss → a leaf browns and the sender's balance ticks back up. **Jaw-drop:** the sender whispers the last verse, the recipient types it, and the plant flowers as the hash(x) account releases the final gift.

**Hard by tomorrow:** Easy to build. The weak spot is wow. It sits close to "streaming payments" (a taken category), so the pitch must stay on the ritual and the humour.

**Prior art:** Scout returns nothing for basil, festival or daily-claim gift. The closest is Gift Pool ZK (a wedding registry), which is a different thing.

---

## Also-rans (if someone wants to riff)
- **Azulejo Vivo:** a 64-tile mural where each tile is an asset and its colour is its live bid/ask spread. Visual, but r/place-ish.
- **Pessoa's heteronyms:** one poet, 70 personas, mapped to muxed M-addresses on one account, each run as an AI agent. A clever pun, but Stellar isn't essential.
- **Santo António blind date:** a PRNG pairs two strangers who each lock €10 in a 2-of-2 that releases to the restaurant only if both sign at the table. Reads as escrow, which is a taken category.

## Recommendation
**PEDIDO.** It has the highest wow per hour of build. The demo is a live human performance, which judges remember and which shows our fingerprint. The core mechanic (crowd partial-fills a maker offer, offer cleared → music plays) is pure native SDEX, so "Stellar is essential" is obvious. It's buildable by 3 devs plus AI in ~10 hours with no contract risk. DESVIO is the backup if the team wants a Lisbon-civic story instead.

Sources: developers.stellar.org claimable-balances guide and CLI cookbook (predicates), path-payments guide (order books + pools); Scout `searchHackathonBuilds`, 2026-10-25; web: cointelegraph busker/Bitcoin, theartparty.org Busking 3.0, WindingTree LP blog, Venice tourism fee (CityLab).
