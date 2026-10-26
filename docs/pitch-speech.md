# StellSec pitch and speech

**Owner: Dev 1** (final narrative, AGENTS.md). Current as of options v1.5 and the Margin contract on Testnet, 26 October. Nothing here changes what the instrument promises. Every spoken line maps to evidence in the claims table (section 3). Amounts match `scripts/deploy/seed-demo-offers.sh`. Replace them if the recording uses different values.

**Contract version caveat.** `main` carries options **v1.5** (`CAIKMS2B…GKY6`, PR #74; source builds byte-identical to the deployed wasm). v1.5 includes resale (v1.4) and funded buyer requests (v1.5). The live app must point `VITE_OPTIONS_CONTRACT_ID` at `CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6`; check the Markets page shows Requests and Resale before recording. Earlier ids: v1.4 `CC6AI7AK…PWNK`, v1.3.1 `CBASUA3L…JUEE`.

---

## 1. Pitch lines

**One sentence (23 words):**

> StellSec lets holders of tokenized assets on Stellar buy fully collateralized, physically settled puts and calls, with every option backed in full on-chain.

**Two sentences (submission form):**

> StellSec is a fully collateralized options layer for eligible tokenized assets on Stellar: makers lock the full strike or underlying in a Soroban contract, investors buy puts or calls, and exercise swaps the tokens in one atomic transaction. It runs on Testnet with fictional assets and keeps each issuer's authorization, freeze and clawback rules in force.

A third sentence where the form allows: "Anyone can list a new Stellar asset; its issuer still decides who may hold it."

---

## 2. Video voice-over (3:00 max, 376 words; 390 with the optional 5b line; 24 more with the optional 5c line)

Pace: about 140 words per minute, with room for pauses and transaction waits. **Bold** = stress. `/` = short pause.

| # | Time | On screen | Voice-over |
|---|---|---|---|
| 1 | 0:00–0:16 | Markets page, the offers table. No wallet yet. | "Stellar already carries tokenized funds, bonds and stocks. / But most of them come with **no risk tools**. If you hold one, you can't easily buy **protection** against it falling, / or earn a premium on what you hold." |
| 2 | 0:16–0:30 | Stay on Markets; open "How settlement works". | "This is **StellSec**: fully collateralized options for eligible tokenized assets on Stellar. / Puts and calls, **physically settled**, and every one is backed **in full** before anyone can buy it. Everything you'll see runs on **Testnet**, with fictional assets." |
| 3 | 0:30–0:50 | Wallet: Maker A. **Markets → Sell → Post an offer**: PUT on RWA, qty 5, total strike 50 USDx, premium 1 USDx. Sign. Open **Collateral**: Held rises by 50 USDx. | "A market maker writes a put on **RWA**, a fictional fund token: / five RWA, fifty USDx total strike. When they sign, the **full fifty USDx** moves into the contract. / No margin. No leverage." |
| 4 | 0:50–1:02 | Wallet: Maker B. Same put, premium 0.8 USDx. Sign. Back to Markets: two quotes on one series. | "A second maker posts the same put for **less**: zero point eight USDx instead of one. / Both offers are funded on-chain. These are real offers, not a mock order book." |
| 5 | 1:02–1:20 | Wallet: Investor. Markets → buy the 0.8 offer. Buy dialog: premium, eligibility, payoff sketch. Sign. Portfolio: `active`. | "Our investor holds RWA and wants protection. / They buy the **cheaper** put. The premium goes straight to the maker. / The investor now has the right to sell five RWA for fifty USDx, **any time before expiry**." |
| 5b | (optional, in 5) | Only if the buy dialog shows the "Assumed price" payoff chart (PR #37). | "The chart uses a price **you** type in. It's hypothetical; there's no oracle." |
| 5c | (optional) 1:20–1:30 | Wallet: Investor. Portfolio → **Sell** on a second, pre-staged put, ask 2 USDx → sign. Wallet: Investor 2. Markets → Resale → **Buy** → sign. Portfolio: Investor 2 is the holder. Cut the waits. | "Holders aren't locked in. / Here the investor sells a second put at a price **they** set. The buyer pays them; the collateral doesn't move." |
| 6 | 1:30–1:53 | Portfolio → Exercise → sign. Click the tx link → stellar.expert: RWA investor → contract, USDx contract → investor, one transaction. | "Say RWA falls. The investor exercises. / In **one transaction**, five RWA go into the contract and fifty USDx come back to the investor. Here it is on stellar.expert. / If any leg fails, **the whole thing reverts**. That's delivery-versus-payment, enforced by the contract." |
| 7 | 1:53–2:02 | Wallet: **Maker B** (writer of the bought offer). Portfolio → Claim delivery → sign → `settled`. | "The writer then claims the five RWA from the contract, / and the option is **settled**." |
| 8 | 2:02–2:13 | **Reserves** page: Owed vs Held per token, "Read at … ledger …", contract links. | "Anyone can check the backing. / The Reserves page reads two numbers straight from the chain: what the contract **owes**, and what it **actually holds**." |
| 9 | 2:13–2:33 | Wallet: RWA issuer. **Issuer console** → freeze the investor on RWA. Wallet: Investor → Exercise on the pre-staged active option → error banner. | "Now the **honest** part. RWA is a regulated asset, and its issuer keeps its powers. / When the issuer **freezes** this holder, exercise fails, and **nothing moves**. / StellSec respects issuer rules. It doesn't override them, and it's **not** a guarantee against issuer action." |
| 10 | 2:33–2:43 | EQTY listing on stellar.expert: `list_asset` tx `9e83e587…bf69` (maker1, v1.5), then the EQTY exercise `f2ad8d0e…10a5`. | "New assets don't need our permission. / Anyone can list a Stellar asset with **one call**. Here's EQTY, a fictional equity token: listed, authorized by its issuer, and a put on it **settled**." |
| 11 | 2:43–2:52 | Simple card: three icons (asset + issuer flags, atomic tx, fee). | "Why Stellar? Assets are native, with **issuer controls built in**. / Soroban gives us atomic settlement. / And an exercise costs **less than a hundredth of an XLM** in fees." |
| 12 | 2:52–3:00 | Closing card: StellSec, live URL, repo URL, footer disclaimer. | "Testnet, fictional assets, unaudited code. Real assets need their issuer on board. / **StellSec**: protection for any **eligible** Stellar asset." |

**If scene 5c is dropped**, scene 6 starts at 1:20 and the 10 seconds go back to scenes 6 to 11 (their pre-5c lengths: 25, 10, 13, 22, 12, 10 s).

---

## 3. Claims → evidence

Contract: options v1.5 `CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6` (live app). Hashes are from `docs/contract-testnet-evidence.md`; a version tag means the hash was recorded on that earlier deployment of the same code path. Replace them with the recording's own hashes once captured.

| Spoken claim | Evidence | Status |
|---|---|---|
| "Most tokenized assets come with no risk tools" | Thesis in AGENTS.md, decision record in `WINNING_IDEAS.md`. This is a market observation, not a measured fact. Phrased as "most" / "can't easily", not "none". | Dev 1 to confirm the wording |
| Fully collateralized; backed in full before anyone can buy | `create_offer` pulls the full `strike_total` (PUT) or `qty` (CALL) before the offer exists (ABI §3; PRODUCT_SPEC §1). v1.2 tx `9223699d…08bf`: maker1 −50 USDx, contract +50 USDx | Verified on chain |
| No margin, no leverage | ABI §2 derived-values table; no margin code path in `contracts/options/src/lib.rs`; AGENTS.md "Never in this hackathon" | True by construction |
| Physically settled puts and calls | PUT and CALL flows on v1.2: PUT #0 exercise `df44d1ef…ed2e`, CALL #4 exercise `6df4269c…a653` | Verified on chain |
| A second maker competes; real funded offers | v1.2 competition txs `2275ee06…0404` (maker1) and `9f7dce74…bd97` (maker2); `seed-demo-offers.sh` creates the 1.0 / 0.8 USDx pair | Verified; recording tx TODO |
| Premium goes straight to the maker | `buy` transfers buyer → writer (ABI §3); Dev 1 decision D1 (PRODUCT_SPEC §4); v1.2 tx `a6294a65…73cc` | Verified; policy decided by Dev 1 |
| Right to sell 5 RWA for 50 USDx any time before expiry | American style, `now < expiry` (ABI §1, PRODUCT_SPEC §2) | True by construction |
| Payoff chart is hypothetical; no oracle | ABI §1 "no oracle"; PRODUCT_SPEC §1; "Assumed price" input in Dev 1's UI spec (PR #37) | Say it only if the chart is on screen |
| Exercise is one transaction; any failed leg reverts all of it | ABI §3 (transaction is the atomicity boundary). Forced on-chain failure in the spike: tx `a005ab41…` left all balances identical (`research/decision/20_rwa_options_spike.md`, result d+) | Verified |
| Writer claims the delivered RWA; option settled | `claim_delivery`, v1.2 tx `e487b120…22bf` | Verified; recording tx TODO |
| Reserves page reads owed vs held from the chain | `open_collateral(token)` vs SAC `balance(contract)` (ABI §3 views); `frontend/src/views/ReservesView.tsx` ("Both are public reads") | Verified in code |
| Issuer freeze → exercise fails, nothing moves | ABI §6; PRODUCT_SPEC §8. v1.1 run (A1): freeze `b102fb5c…f109`, then exercise rejected with SAC #11. v1.3.1 A1: freeze `3f0d711d…f462`. A rejected exercise fails in simulation, so no fee is spent and nothing is sent | Verified on chain (v1.1 and v1.3.1); recording TODO |
| A holder sells at a price they set; the buyer pays them; the collateral doesn't move | `list_for_sale` / `buy_resale` on `CC6AI7AKKEVSXH3QQF7HBXZNIBS4ACFP2UQLXG3WOAZ5VDFCTXVFPWNK`; PRODUCT_SPEC D8 (the option, its strike, expiry and the writer's collateral are unchanged). Resale tx `a5c5a3d2d80e510bfcebe9f9781b82bdc3313121feffaf30fa642d8556e69949` | Verified on chain (v1.4 run) |
| Not a guarantee against issuer action | PRODUCT_SPEC §8 (required wording) | Required disclosure |
| Anyone can list a Stellar asset with one call | `list_asset` (ABI §12); the SAC address is derived on chain, so custom tokens can't be listed. v1.3.1 tx `94f1f28cbef1ec1e6318782976b58605d0b41f6ff74396753b294906148675b4`, sent by maker1 (not an admin); on v1.5 maker1 listed EQTY again, `9e83e587…bf69` | Verified on chain |
| EQTY: listed, authorized by its issuer, a put settled | Issuer authorizes `891473865d…0512`; EQTY PUT #8 create / buy / exercise / claim `26158344…4147` / `ac3ce920…d718` / `f2ad8d0e…10a5` / `d7f84cdf…d1fe` | Verified on chain (v1.3.1 run) |
| Issuer controls are built into Stellar assets | Classic asset flags AUTH_REQUIRED / AUTH_REVOCABLE / AUTH_CLAWBACK_ENABLED, exposed through the SAC; `is_eligible` reads the SAC's own authorization (ABI §3, §6) | True |
| Exercise costs less than a hundredth of an XLM in fees | Horizon `fee_charged`: v1.2 exercise `df44d1ef…ed2e` = 53,561 stroops (0.0054 XLM); v1.3.1 EQTY exercise `f2ad8d0e…10a5` = 79,873 stroops (0.0080 XLM). These are Testnet figures | Verified (Testnet) |
| Testnet, fictional assets | AGENTS.md Deployed contracts table; asset labels in PRODUCT_SPEC §1 | True by construction |
| Unaudited code | PRODUCT_SPEC §8 ("the contract is not audited") | Required disclosure |
| "Any eligible Stellar asset" | Honest claim, AGENTS.md / PRODUCT_SPEC §1: supported (listed) **and** eligible (issuer allows escrow and counterparties). Never "every token" | Wording locked |

**Words that must not appear** (AGENTS.md, demo script): mainnet, production, launch date, "real" RWAs or funds, "every token", "guaranteed", "trustless" without qualification, "audited", "secure", "refund", "impaired", any liquidity, volume or user numbers, "market price" or "order book" for a resale ask (it is a price set by one holder), "first options on Stellar" (Lusty exists), "impossible before" / "new capability".

---

## 4. 60-second cut (about 150 words)

For a short video or a live pitch. Same claims, nothing new.

> Stellar has tokenized funds, bonds and stocks. But if you hold one, you can't easily protect yourself if it falls.
>
> StellSec adds fully collateralized options for eligible Stellar assets. A maker writes a put on RWA, a fictional fund token, and the full strike is locked in the contract. A second maker undercuts on premium, and our investor buys the cheaper one.
>
> When they exercise, RWA goes in and USDx comes out in one atomic transaction. You can check it on stellar.expert. Reserves are public: what the contract owes against what it holds, read straight from the chain.
>
> And we're honest about the limits. If the issuer freezes a holder, exercise fails. StellSec respects issuer controls; it doesn't override them.
>
> New Stellar assets, like EQTY, can be listed by anyone, and the issuer still decides who may hold them.
>
> Testnet, fictional assets, unaudited. StellSec: protection for any eligible Stellar asset.

---

## 5. Pitch deck outline (10 slides)

Use the frontend style in `frontend/STYLE.md` throughout (IBM Plex Sans, Plex Mono only for ids and hashes, flat tables, no decoration).

| # | Title | Bullets | Visual |
|---|---|---|---|
| 1 | **StellSec** | Fully collateralized options for eligible tokenized assets on Stellar. Testnet MVP, HackMeridian 2026, Genesis / Stellar Unlocked. | Wordmark on the dark ground; live URL and repo URL in Plex Mono |
| 2 | **Tokenized, but unhedgeable** | Funds, bonds and stocks are being issued on Stellar. Holders have few ways to buy downside protection or earn yield by writing options. Risk tools that ignore issuer rules can't touch regulated assets. | One token icon with an empty "protection" slot beside it |
| 3 | **What StellSec does** | Makers lock the full worst-case obligation up front. Investors buy puts (protection) or calls. Exercise swaps tokens at the strike, atomically. | Three-step strip: Lock → Buy → Exercise, collateral bar under "Lock" |
| 4 | **Demo: a protective put on RWA** | Two funded quotes: 1.0 vs 0.8 USDx. Investor buys the cheaper one. Exercise: 5 RWA in, 50 USDx out, one tx. | Screenshots: Markets with two quotes; Portfolio `active`; stellar.expert tx page |
| 5 | **Proof of backing** | Reserves page: owed (`open_collateral`) vs held (SAC balance), both read from the chain. While a token is short after a clawback, new offers and buys on it are refused (#115). | Reserves screenshot with Owed and Held highlighted |
| 6 | **How it works** | One Soroban escrow contract, no admin, no upgrade. Assets are SACs over classic assets; eligibility = the issuer's own trustline authorization. Lifecycle: Offered → Active → Exercised → Settled (or Cancelled / Expired). | Diagram: Maker and Investor wallets ↔ options contract ↔ RWA / BOND / EQTY SACs and USDx SAC; issuer above the RWA SAC with an "authorize / freeze / clawback" arrow |
| 7 | **Why Stellar** | Issuer flags (auth required, revocable, clawback) are native and respected end to end. Soroban gives atomic delivery-versus-payment. Exercise fee on Testnet: about 0.005–0.008 XLM. Any classic asset can be listed by deriving its SAC address on chain. | Three tiles; a stellar.expert fee line in Plex Mono |
| 8 | **What's real, what isn't** | Real: deployed Testnet contract, signed txs, 250 contract tests (146 unit, 18 property-based and invariant, 86 negative), smoke and issuer-demo scripts. Fictional: RWA, BOND, EQTY, USDx; demo makers are our own accounts. Not audited; Testnet only. | Two columns, "Real" and "Fictional", with tx hashes under "Real" |
| 9 | **Limits and roadmap** | Issuer action can block settlement; the premium is not refunded; a clawback is absorbed first come, first served. Resale (v1.4) and funded buyer requests (v1.5) are on chain. Next: position token, per-offer quote tokens, keeper service, issuer pilots (with permission). Margin (the `pro` contract: cash-settled, partially margined uncovered calls) is a separate experimental contract on Testnet; payouts can be reduced and any deficit is shown. | Limitation table (freeze holder / freeze writer / de-authorize escrow / clawback) beside a roadmap line |
| 10 | **Team and ask** | Dev 1: product and quant. Dev 2: contracts. Dev 3: frontend and Stellar integration. Ask: an introduction to a Stellar asset issuer willing to pilot on Testnet, and feedback from market makers. | Three name cards (names TBD); live URL and QR code |

---

## 6. Q&A prep: the hardest judge questions

**1. Who prices the premium? There's no oracle.**
The maker does. Each offer carries its own total premium, and makers compete with funded offers on the same series, as in the demo (1.0 vs 0.8 USDx). The contract never needs a price: physical settlement means the holder decides whether exercising is worth it. Any chart in the app uses a price the user types in, labelled hypothetical. We don't claim a pricing model or market quotes.

**2. The issuer can freeze or claw back. Isn't the option worthless then?**
It's conditional, and we say so on screen. We recorded each case on Testnet. If the issuer freezes the holder, exercise fails. If it freezes the writer, the holder is still paid, because the payment lands in the contract. If it de-authorizes the contract, buys are refused (#105). A clawback from the contract creates a visible shortfall: new offers and buys on that token are refused (#115), and existing payouts are served first come, first served. USDx, the quote token, has no clawback flag, so put collateral can't be clawed. For regulated assets this is the point: an options layer that bypassed the issuer couldn't legally touch them.

**3. Why is the premium non-refundable, even if settlement fails?**
Dev 1's decision D1 (PRODUCT_SPEC §4). The writer locks 100% of the obligation before the sale, so the premium pays for carrying it. Paying at purchase needs no premium escrow and no refund logic, which we haven't specified or proven. To limit the damage, `buy` re-checks that the contract is still authorized and fully backed on the asset, so you can't pay for an option that can't settle at that moment. The remaining risk is issuer action after purchase, and we disclose it.

**4. Where does liquidity come from? Who are the makers?**
In the demo, our own funded Testnet accounts. We claim no liquidity. Natural writers are holders writing covered calls for yield, desks writing cash-secured puts, and issuers or distributors who want their asset to be hedgeable. The design makes it cheap to trust a maker you don't know, because every offer is fully funded. Per-writer and per-asset caps keep one actor from filling the book.

**5. What about regulation? Options on securities are regulated.**
Correct, which is why this is Testnet with fictional assets. StellSec doesn't run its own KYC list: eligibility is the issuer's own authorization on the asset, so the issuer controls who may write, buy or receive the asset. A real deployment needs the issuer's cooperation, legal permission and a licensed party where the law requires one. We don't claim compliance.

**6. Why physical delivery instead of cash settlement?**
It needs no oracle and so has no price-manipulation surface, and delivery runs through the asset's own transfer rules. The trade-off: a put holder must hold the asset to exercise. We also built a cash-settled, partially margined design (Margin, the `pro` contract): a separate experimental contract on Testnet with a team-run price publisher. Its guarantees are weaker, and every Margin screen says so.

**7. Soroban storage expires. What happens to an option after its TTL runs out?**
Every state-changing call extends the contract and the touched option by 30 days. Anyone can call `extend_ttl`, and a keeper script does it for every live option. Expiry is stored in the option itself, so TTL is never a security mechanism. Unsold expired offers can be pruned by anyone, and the collateral always goes back to the writer. Caveat: Testnet resets quarterly.

**8. Can a maker post a "trap" offer, for example one that can't settle, or pull it while I'm buying?**
An open offer isn't treated as executable until the client simulates `buy` against the chain right before signing. `buy` itself checks that you're eligible, that the contract is authorized on the asset and that the asset isn't short. Terms can't change after creation. A writer can cancel only while the offer is unsold. If they cancel first, your buy fails and you pay nothing. Expiry is capped at two years, and all amounts must be positive. Odd terms (a far-out strike, a tiny quantity) are shown in full, but the user still has to read them.

**Backup questions:**
- *Is it secure? Audited?* Not audited, and we don't claim production security. On v1.5: 250 contract tests passing (146 unit, 18 property-based and invariant, 86 negative), clippy clean, and mutation testing on v1.2 with 0 surviving mutants. An internal review of v1 (including CoinFabrik Scout) confirmed two findings, pooled clawback exposure and an unbounded offer list. Both are handled: the first is disclosed and guarded, the second is capped.
- *How is this different from Lusty?* As we understand it, Lusty settles through a server. StellSec's collateral and settlement live in the contract, with physical delivery of permissioned assets and the issuer's rules enforced at every step.
- *Why not every token?* Listing derives the canonical SAC address of a classic asset on chain, so arbitrary token contracts can never be listed. Eligibility then depends on the issuer.

---

## 7. Delivery notes

- **Voice:** calm and conversational. Record the voice-over separately from the screen capture, then cut the waits. Don't speak over a spinner. Never edit what a result shows (demo-script fallback rules).
- **Pace:** about 140 words per minute. Pause at each `/`. Read the numbers slowly: "five RWA", "fifty USDx", "zero point eight".
- **Stress:** *in full*, *no margin, no leverage*, *cheaper*, *one transaction*, *the whole thing reverts*, *owes / actually holds*, *honest*, *nothing moves*, *not a guarantee*, *eligible*.
- **Show while saying:**
  - Scene 3: zoom on the Collateral page's Held figure as "fifty USDx moves into the contract" lands.
  - Scene 4: hold on the two quotes side by side.
  - Scene 6: on stellar.expert, highlight both transfers in one tx (a cursor circle or an editing callout).
  - Scene 8: hover Owed, then Held.
  - Scene 9: hold the error banner for about two seconds before speaking the "StellSec respects issuer rules" line.
- **Keep the "Testnet / fictional" label visible:** the footer disclaimer in scenes 1 and 12. The mock-data banner must never appear in a live take.
- **If over time, cut in this order:** 5c (resale) → 5b (chart) → scene 11 fee line → scene 2's last sentence (scene 12 repeats it) → scene 10 (use the one-line fallback). **Never cut** scene 9 (the honesty beat) or the scene 12 disclaimer.
- `docs/demo-script.md` follows this section: RWA, Maker B claims, the Collateral page, the EQTY scene.

---

## 8. Open questions

**For Dev 1:**
- Is the hook wording ("most come with no risk tools", "can't easily buy protection") acceptable? Should we name a real tokenized fund on Stellar as context, without implying any integration?
- Approve the closing line "protection for any eligible Stellar asset", and the team and ask slide (names, ask).
- PRODUCT_SPEC open question 1: the first-come-first-served clawback disclosure is not yet in the UI or README. The deck states it on slide 9. Is that enough for the video, or should scene 8 say it?

**For Dev 2 and Dev 3:**
- Is a pre-staged active option for the freeze scene ready (`seed-demo-offers.sh` creates offers, not bought positions)?
- Recording tx hashes for create A, create B, buy, exercise, claim and freeze, to replace the smoke-run hashes in section 3.
