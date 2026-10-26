# Strata pitch and speech

**Draft for Dev 1 review.** Dev 1 owns the final narrative (AGENTS.md). Nothing here changes what the instrument promises. Every spoken line maps to evidence in the claims table (section 3). Amounts match `scripts/deploy/seed-demo-offers.sh`. Replace them if the recording uses different values.

**Contract version caveat.** `main` and the live app (https://hackmeridian-psi.vercel.app/) run options **v1.2** (`CAJ2WJP4…GBAX`). Permissionless listing (`list_asset`) and the EQTY asset exist only on **v1.3 / v1.3.1** (`CBASUA3L…JUEE`, deployed and recorded on branch `feat/contract-v1-3-1`, not merged at the time of writing). Lines marked **[v1.3.1]** are true on that deployment. They need one of two things: the app is switched to v1.3.1 before recording, or that scene shows the recorded v1.3.1 transaction on stellar.expert and says so.

---

## 1. Pitch lines

**One sentence (23 words):**

> Strata lets holders of tokenized assets on Stellar buy fully collateralized, physically settled puts and calls, with every option backed in full on-chain.

**Two sentences (submission form):**

> Strata is a fully collateralized options layer for eligible tokenized assets on Stellar: makers lock the full strike or underlying in a Soroban contract, investors buy puts or calls, and exercise swaps the tokens in one atomic transaction. It runs on Testnet with fictional assets and keeps each issuer's authorization, freeze and clawback rules in force.

If v1.3.1 is live in the app, a third sentence can be added where the form allows: "Anyone can list a new Stellar asset; its issuer still decides who may hold it."

---

## 2. Video voice-over (3:00 max, 376 words; 390 with the optional 5b line)

Pace: about 140 words per minute, with room for pauses and transaction waits. **Bold** = stress. `/` = short pause.

| # | Time | On screen | Voice-over |
|---|---|---|---|
| 1 | 0:00–0:16 | Markets page, the offers table. No wallet yet. | "Stellar already carries tokenized funds, bonds and stocks. / But most of them come with **no risk tools**. If you hold one, you can't easily buy **protection** against it falling, / or earn a premium on what you hold." |
| 2 | 0:16–0:30 | Stay on Markets; open "How settlement works". | "This is **Strata**: fully collateralized options for eligible tokenized assets on Stellar. / Puts and calls, **physically settled**, and every one is backed **in full** before anyone can buy it. Everything you'll see runs on **Testnet**, with fictional assets." |
| 3 | 0:30–0:50 | Wallet: Maker A. **Write**: PUT on RWA, qty 5, total strike 50 USDx, premium 1 USDx. Sign. StrataBar shows the locked layer. | "A market maker writes a put on **RWA**, a fictional fund token: / five RWA, fifty USDx total strike. When they sign, the **full fifty USDx** moves into the contract. / No margin. No leverage." |
| 4 | 0:50–1:02 | Wallet: Maker B. Same put, premium 0.8 USDx. Sign. Back to Markets: two quotes on one series. | "A second maker posts the same put for **less**: zero point eight USDx instead of one. / Both offers are funded on-chain. These are real offers, not a mock order book." |
| 5 | 1:02–1:20 | Wallet: Investor. Markets → buy the 0.8 offer. Buy dialog: premium, eligibility, payoff sketch. Sign. Portfolio: `active`. | "Our investor holds RWA and wants protection. / They buy the **cheaper** put. The premium goes straight to the maker. / The investor now has the right to sell five RWA for fifty USDx, **any time before expiry**." |
| 5b | (optional, in 5) | Only if the buy dialog shows the "Assumed price" payoff chart (PR #37). | "The chart uses a price **you** type in. It's hypothetical; there's no oracle." |
| 6 | 1:20–1:45 | Portfolio → Exercise → sign. Click the tx link → stellar.expert: RWA investor → contract, USDx contract → investor, one transaction. | "Say RWA falls. The investor exercises. / In **one transaction**, five RWA go into the contract and fifty USDx come back to the investor. Here it is on stellar.expert. / If any leg fails, **the whole thing reverts**. That's delivery-versus-payment, enforced by the contract." |
| 7 | 1:45–1:55 | Wallet: **Maker B** (writer of the bought offer). Portfolio → Claim delivery → sign → `settled`. | "The writer then claims the five RWA from the contract, / and the option is **settled**." |
| 8 | 1:55–2:08 | **Reserves** page: Owed vs Held per token, "Read at … ledger …", contract links. | "Anyone can check the backing. / The Reserves page reads two numbers straight from the chain: what the contract **owes**, and what it **actually holds**." |
| 9 | 2:08–2:30 | Wallet: RWA issuer. **Issuer console** → freeze the investor on RWA. Wallet: Investor → Exercise on the pre-staged active option → error banner. | "Now the **honest** part. RWA is a regulated asset, and its issuer keeps its powers. / When the issuer **freezes** this holder, exercise fails, and **nothing moves**. / Strata respects issuer rules. It doesn't override them, and it's **not** a guarantee against issuer action." |
| 10 | 2:30–2:42 | **[v1.3.1]** EQTY listing: app if switched, otherwise stellar.expert tx `94f1f28c…75b4` then the EQTY exercise `f2ad8d0e…10a5`. | "New assets don't need our permission. / Anyone can list a Stellar asset with **one call**. Here's EQTY, a fictional equity token: listed, authorized by its issuer, and a put on it **settled**." |
| 11 | 2:42–2:52 | Simple card: three icons (asset + issuer flags, atomic tx, fee). | "Why Stellar? Assets are native, with **issuer controls built in**. / Soroban gives us atomic settlement. / And an exercise costs **less than a hundredth of an XLM** in fees." |
| 12 | 2:52–3:00 | Closing card: Strata, live URL, repo URL, footer disclaimer. | "Testnet, fictional assets, unaudited code. Real assets need their issuer on board. / **Strata**: protection for any **eligible** Stellar asset." |

**If scene 10 cannot be shown** (app on v1.2 and no time to cut in the stellar.expert clip), replace it with: "Each asset is listed once, and its issuer decides who may hold it." That line is true on v1.2 (constructor allowlist plus issuer authorization). Give the freed seconds to scene 6.

**Scene 7 correction for `docs/demo-script.md`:** the investor buys Maker B's cheaper offer, so the writer who claims is **Maker B**, not Maker A. The current demo script says Maker A in scene 6. Either switch to Maker B there, or have the investor buy Maker A's offer and change the scene 4 line to "they buy one". Buying the cheaper one is the stronger story.

---

## 3. Claims → evidence

Contract IDs: v1.2 `CAJ2WJP4CUM2GGRB2A5P2M2H5GI45CTZSECV7SL3RTQMGYEKZ7ZDGBAX` (AGENTS.md table, live app); v1.3.1 `CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE` (branch `feat/contract-v1-3-1`). Hashes are from `docs/contract-testnet-evidence.md` (v1.2 on `main`; v1.3.1 on that branch). Replace them with the recording's own hashes once captured.

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
| Not a guarantee against issuer action | PRODUCT_SPEC §8 (required wording) | Required disclosure |
| Anyone can list a Stellar asset with one call **[v1.3.1]** | `list_asset` (ABI §12 on the v1.3.1 branch); the SAC address is derived on chain, so custom tokens can't be listed. v1.3.1 tx `94f1f28cbef1ec1e6318782976b58605d0b41f6ff74396753b294906148675b4`, sent by maker1 (not an admin) | Verified on v1.3.1 only |
| EQTY: listed, authorized by its issuer, a put settled **[v1.3.1]** | Issuer authorizes `891473865d…0512`; EQTY PUT #8 create / buy / exercise / claim `26158344…4147` / `ac3ce920…d718` / `f2ad8d0e…10a5` / `d7f84cdf…d1fe` | Verified on v1.3.1 only |
| Issuer controls are built into Stellar assets | Classic asset flags AUTH_REQUIRED / AUTH_REVOCABLE / AUTH_CLAWBACK_ENABLED, exposed through the SAC; `is_eligible` reads the SAC's own authorization (ABI §3, §6) | True |
| Exercise costs less than a hundredth of an XLM in fees | Horizon `fee_charged`: v1.2 exercise `df44d1ef…ed2e` = 53,561 stroops (0.0054 XLM); v1.3.1 EQTY exercise `f2ad8d0e…10a5` = 79,873 stroops (0.0080 XLM). These are Testnet figures | Verified (Testnet) |
| Testnet, fictional assets | AGENTS.md Deployed contracts table; asset labels in PRODUCT_SPEC §1 | True by construction |
| Unaudited code | PRODUCT_SPEC §8 ("the contract is not audited") | Required disclosure |
| "Any eligible Stellar asset" | Honest claim, AGENTS.md / PRODUCT_SPEC §1: supported (listed) **and** eligible (issuer allows escrow and counterparties). Never "every token" | Wording locked |

**Words that must not appear** (AGENTS.md, demo script): mainnet, production, launch date, "real" RWAs or funds, "every token", "guaranteed", "trustless" without qualification, "audited", "secure", "refund", "impaired", any liquidity, volume or user numbers, "first options on Stellar" (Lusty exists), "impossible before" / "new capability".

---

## 4. 60-second cut (about 150 words)

For a short video or a live pitch. Same claims, nothing new.

> Stellar has tokenized funds, bonds and stocks. But if you hold one, you can't easily protect yourself if it falls.
>
> Strata adds fully collateralized options for eligible Stellar assets. A maker writes a put on RWA, a fictional fund token, and the full strike is locked in the contract. A second maker undercuts on premium, and our investor buys the cheaper one.
>
> When they exercise, RWA goes in and USDx comes out in one atomic transaction. You can check it on stellar.expert. Reserves are public: what the contract owes against what it holds, read straight from the chain.
>
> And we're honest about the limits. If the issuer freezes a holder, exercise fails. Strata respects issuer controls; it doesn't override them.
>
> New Stellar assets, like EQTY, can be listed by anyone, and the issuer still decides who may hold them.
>
> Testnet, fictional assets, unaudited. Strata: protection for any eligible Stellar asset.

If the app is not on v1.3.1, cut the EQTY paragraph (about 18 words) or say "We've also shown permissionless listing on a newer deployment" only if the v1.3.1 tx is in the deck.

---

## 5. Pitch deck outline (10 slides)

Use the frontend style in `frontend/STYLE.md` throughout (IBM Plex Sans, Plex Mono only for ids and hashes, flat tables, no decoration).

| # | Title | Bullets | Visual |
|---|---|---|---|
| 1 | **Strata** | Fully collateralized options for eligible tokenized assets on Stellar. Testnet MVP, HackMeridian 2026, Genesis / Stellar Unlocked. | Wordmark on the dark ground; live URL and repo URL in Plex Mono |
| 2 | **Tokenized, but unhedgeable** | Funds, bonds and stocks are being issued on Stellar. Holders have few ways to buy downside protection or earn yield by writing options. Risk tools that ignore issuer rules can't touch regulated assets. | One token icon with an empty "protection" slot beside it |
| 3 | **What Strata does** | Makers lock the full worst-case obligation up front. Investors buy puts (protection) or calls. Exercise swaps tokens at the strike, atomically. | Three-step strip: Lock → Buy → Exercise, StrataBar under "Lock" |
| 4 | **Demo: a protective put on RWA** | Two funded quotes: 1.0 vs 0.8 USDx. Investor buys the cheaper one. Exercise: 5 RWA in, 50 USDx out, one tx. | Screenshots: Markets with two quotes; Portfolio `active`; stellar.expert tx page |
| 5 | **Proof of backing** | Reserves page: owed (`open_collateral`) vs held (SAC balance), both read from the chain. While a token is short after a clawback, new offers and buys on it are refused (#115). | Reserves screenshot with Owed and Held highlighted |
| 6 | **How it works** | One Soroban escrow contract, no admin, no upgrade. Assets are SACs over classic assets; eligibility = the issuer's own trustline authorization. Lifecycle: Offered → Active → Exercised → Settled (or Cancelled / Expired). | Diagram: Maker and Investor wallets ↔ options contract ↔ RWA / BOND / EQTY SACs and USDx SAC; issuer above the RWA SAC with an "authorize / freeze / clawback" arrow |
| 7 | **Why Stellar** | Issuer flags (auth required, revocable, clawback) are native and respected end to end. Soroban gives atomic delivery-versus-payment. Exercise fee on Testnet: about 0.005–0.008 XLM. [v1.3.1] Any classic asset can be listed by deriving its SAC address on chain. | Three tiles; a stellar.expert fee line in Plex Mono |
| 8 | **What's real, what isn't** | Real: deployed Testnet contract, signed txs, 171 contract tests on the v1.3 tree (unit, property-based, negative), smoke and issuer-demo scripts. Fictional: RWA, BOND, EQTY, USDx; demo makers are our own accounts. Not audited; Testnet only. | Two columns, "Real" and "Fictional", with tx hashes under "Real" |
| 9 | **Limits and roadmap** | Issuer action can block settlement; the premium is not refunded; a clawback is absorbed first come, first served. Next: paid secondary market or position token, per-offer quote tokens, keeper service, issuer pilots (with permission). Strata Pro (cash-settled, margined) is specified but not on chain. | Limitation table (freeze holder / freeze writer / de-authorize escrow / clawback) beside a roadmap line |
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
Correct, which is why this is Testnet with fictional assets. Strata doesn't run its own KYC list: eligibility is the issuer's own authorization on the asset, so the issuer controls who may write, buy or receive the asset. A real deployment needs the issuer's cooperation, legal permission and a licensed party where the law requires one. We don't claim compliance.

**6. Why physical delivery instead of cash settlement?**
It needs no oracle and so has no price-manipulation surface, and delivery runs through the asset's own transfer rules. The trade-off: a put holder must hold the asset to exercise. We have a cash-settled, margined design (Strata Pro), but it's only specified and simulated. It isn't on chain, and its guarantees are weaker.

**7. Soroban storage expires. What happens to an option after its TTL runs out?**
Every state-changing call extends the contract and the touched option by 30 days. Anyone can call `extend_ttl`, and a keeper script does it for every live option. Expiry is stored in the option itself, so TTL is never a security mechanism. Unsold expired offers can be pruned by anyone [v1.3.1], and the collateral always goes back to the writer. Caveat: Testnet resets quarterly.

**8. Can a maker post a "trap" offer, for example one that can't settle, or pull it while I'm buying?**
An open offer isn't treated as executable until the client simulates `buy` against the chain right before signing. `buy` itself checks that you're eligible, that the contract is authorized on the asset and that the asset isn't short. Terms can't change after creation. A writer can cancel only while the offer is unsold. If they cancel first, your buy fails and you pay nothing. Expiry is capped at two years [v1.3+], and all amounts must be positive. Odd terms (a far-out strike, a tiny quantity) are shown in full, but the user still has to read them.

**Backup questions:**
- *Is it secure? Audited?* Not audited, and we don't claim production security. On the v1.3 tree: 171 contract tests passing (105 unit, 12 property-based and invariant, 54 negative), clippy clean, and mutation testing on v1.2 with 0 surviving mutants. An internal review of v1 (including CoinFabrik Scout) confirmed two findings, pooled clawback exposure and an unbounded offer list. Both are handled: the first is disclosed and guarded, the second is capped.
- *How is this different from Lusty?* As we understand it, Lusty settles through a server. Strata's collateral and settlement live in the contract, with physical delivery of permissioned assets and the issuer's rules enforced at every step.
- *Why not every token?* Listing derives the canonical SAC address of a classic asset on chain, so arbitrary token contracts can never be listed [v1.3.1]. Eligibility then depends on the issuer.

---

## 7. Delivery notes

- **Voice:** calm and conversational. Record the voice-over separately from the screen capture, then cut the waits. Don't speak over a spinner. Never edit what a result shows (demo-script fallback rules).
- **Pace:** about 140 words per minute. Pause at each `/`. Read the numbers slowly: "five RWA", "fifty USDx", "zero point eight".
- **Stress:** *in full*, *no margin, no leverage*, *cheaper*, *one transaction*, *the whole thing reverts*, *owes / actually holds*, *honest*, *nothing moves*, *not a guarantee*, *eligible*.
- **Show while saying:**
  - Scene 3: zoom on the StrataBar locked layer as "fifty USDx moves into the contract" lands.
  - Scene 4: hold on the two quotes side by side.
  - Scene 6: on stellar.expert, highlight both transfers in one tx (a cursor circle or an editing callout).
  - Scene 8: hover Owed, then Held.
  - Scene 9: hold the error banner for about two seconds before speaking the "Strata respects issuer rules" line.
- **Keep the "Testnet / fictional" label visible:** the footer disclaimer in scenes 1 and 12. The mock-data banner must never appear in a live take.
- **If over time, cut in this order:** 5b (chart) → scene 11 fee line → scene 2's last sentence (scene 12 repeats it) → scene 10 (use the one-line fallback). **Never cut** scene 9 (the honesty beat) or the scene 12 disclaimer.
- **Suggested edits to `docs/demo-script.md`** (Dev 3 / Dev 1 to apply):
  1. Rename FUND to **RWA**. The deployed assets are RWA, BOND, EQTY and USDx, and `frontend/src/issuer/IssuerConsole.tsx` still defaults the asset code to `FUND`. Change it or retype it on camera.
  2. Claim delivery by **Maker B** (the writer of the cheaper offer), not Maker A.
  3. Move the collateral beat from the Write tab to the **Reserves** page.
  4. Add the EQTY listing scene (2:30–2:42), conditional on v1.3.1.
  5. Update `frontend/src/demo/scenes.ts` titles and start times to match section 2.

---

## 8. Open questions

**For Dev 1:**
- Is the hook wording ("most come with no risk tools", "can't easily buy protection") acceptable? Should we name a real tokenized fund on Stellar as context, without implying any integration?
- Approve the closing line "protection for any eligible Stellar asset", and the team and ask slide (names, ask).
- PRODUCT_SPEC open question 1: the first-come-first-served clawback disclosure is not yet in the UI or README. The deck states it on slide 9. Is that enough for the video, or should scene 8 say it?

**For Dev 2 and Dev 3:**
- Which contract will the recording use, v1.2 (live app today) or v1.3.1? This decides whether scene 10 is shown in the app, as a stellar.expert cut, or dropped.
- Is the buy-dialog payoff chart with "Assumed price" (PR #37) live before recording? If not, drop 5b.
- Is a pre-staged active option for the freeze scene ready (`seed-demo-offers.sh` creates offers, not bought positions)?
- Test counts for the v1.3.1 tree. Slide 8 quotes the v1.3 tree (171 passing, 1 ignored) and should be updated if v1.3.1 differs.
- Recording tx hashes for create A, create B, buy, exercise, claim and freeze, to replace the smoke-run hashes in section 3.
