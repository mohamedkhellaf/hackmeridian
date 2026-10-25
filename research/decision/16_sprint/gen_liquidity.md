# Liquidity & users sprint — 4 ideas that pull a real group on-chain

Focus: products that bring new accounts, new pairs, resting DEX offers or merchants to Stellar on day one. Written 2026-10-25 ~14:45 Lisbon, 20-minute time-box, no project files read.

## 0. Ground truth I measured first (mainnet, Horizon, 14:25 today)

These numbers are the human-free, verifiable "why liquidity is thin" story. Put them in the deck.

| Fact | Value | Source |
|---|---|---|
| EURC (Circle) on Stellar | ~$4.9M market cap, 48,442 holders, ~$94k/24h volume | Scout `getStablecoins`, data as of 2026-10-25 11:47 UTC |
| EURC/USDC order book top of book | bid 1.10733 / ask 1.11280 → **~0.5% spread**, with **1.65 EURC** on the best bid and **0.098 EURC** on the best ask | `horizon.stellar.org/order_book` (EURC GDHU6…NPP2 vs USDC GA5Z…KZVN) |
| BRZ (Transfero, brztoken.io) on Stellar | issuer `GABMA6FPH3OJXNTGWO7PROF7I5WPQUZOB4BLTBTP4FK6QV7HWISLIEO2`, **97 trustlines** | Horizon `/assets` |
| BRZ/EURC and BRZ/USDC order books | **both completely empty** (bids [], asks []) | Horizon `/order_book` |
| Only BRL stablecoin Scout tracks | BRLT (Settle Network), **$554** market cap | Scout |
| Brazilians in Portugal | 493,622 residents = **31.1% of all foreigners**; 115,709 new residence permits in 2025 (#1 nationality) | [DN Brasil / AIMA](https://dnbrasil.dn.pt/brasileiros-receberam-115709-novas-autorizaes-de-residncia-em-portugal-em-2025), [Postal](https://postal.pt/edicaopapel/faro-e-o-quarto-distrito-com-mais-residentes-estrangeiros/) |
| Brazilian crypto is stablecoins | 71.7% of all declared crypto volume 2019–2025 (R$1.13T); 76–80% in 2024/25; USDT 88.7%, USDC 7.1%, BRZ 3.4% | [InfoMoney / Receita Federal](https://www.infomoney.com.br/?p=3395143), [InvestNews](https://investnews.com.br/?p=810674) |

So: the single largest foreign community in Lisbon already lives on stablecoins, and the chain hosting this hackathon has **zero** BRL↔EUR liquidity and a near-empty EUR book. That gap is the pitch.

## 0b. Bridge testnet check (asked by coordinator)

| Bridge | Status | Evidence |
|---|---|---|
| **Circle CCTP (V2) on Stellar** | **Verified — testnet live.** Domain 27. Testnet `TokenMessengerMinter` `CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP`, `MessageTransmitter` `CBJ6MTCKKZG73PMDZCJMSFRD7DQEMI4FKDH7CGDSV4W6FHCRBCQAVVJY`, `CctpForwarder` `CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ`. Mainnet added 2026-05-18. Supports `deposit_for_burn_with_hook` (hook carries a Stellar `forwardRecipient`, muxed OK) and `handle_receive_unfinalized_message` (Fast Burn). Gotcha: Stellar USDC has 7 decimals vs 6 elsewhere. | [Circle Stellar contracts](https://developers.circle.com/cctp/references/stellar-contracts.md), [supported chains](https://developers.circle.com/cctp/concepts/supported-chains-and-domains), [2026 release notes](https://developers.circle.com/release-notes/cctp-2026.md), third-party testnet walkthrough both directions: [jamesbachini.com/cctp-on-stellar](https://jamesbachini.com/cctp-on-stellar/) |
| **Axelar GMP + ITS on Stellar** | **Verified — testnet live.** Chain key `stellar-2026-q1-2` (networkType testnet, RPC soroban-testnet). `AxelarGateway` `CB2JYOOZPHO43R57TC5PXV22QICKIDC5NKRF62BZG2J6JYFUIQPIAYY3` (v1.1.2), `AxelarGasService` `CCLZOCGHHC6F6JCZHEUP53LDQHRBPPCNRYXOVFZFS3O63OGRC47CKCGV`, `InterchainTokenService` `CC7LAC4S7KAPIM26WKWFSOXWLNLSG7EXTC2EVY2H2UPKSTX3Z2A7M5YP` (v1.4.1). Stellar ITS is hub-mode only. Docs have a "register existing Stellar token → EVM" tutorial. | [axelar-contract-deployments testnet.json](https://github.com/axelarnetwork/axelar-contract-deployments/blob/main/axelar-chains-config/info/testnet.json), [Stellar ITS docs](https://docs.axelar.dev/dev/send-tokens/stellar/intro/), [register existing token](https://docs.axelar.dev/dev/send-tokens/stellar/register-existing-stellar-token/) |
| **LayerZero V2 / OFT on Stellar** | **Could-not-verify testnet.** Mainnet endpoint live since 2026-09-02 (USDT0 first OFT); Code4rena audit Apr 2026; docs show `--network testnet` CLI examples and say "LayerZero deploys and maintains the Endpoint V2 on Stellar", but neither the FAQ, the OApp overview nor the deployed-contracts page I fetched exposes a Stellar testnet endpoint address/eid (page content truncated). Treat as **not buildable by tomorrow** unless someone finds the eid in `@layerzerolabs/lz-v2-stellar-sdk`. Coordinator's note that USDT0 has no testnet stands. | [LZ blog](https://layerzero.network/blog/layerzero-endpoint-on-stellar-usdt0), [Stellar FAQ](https://docs.layerzero.network/v2/developers/stellar/troubleshooting/faq.md), [OApp overview](https://docs.layerzero.network/v2/developers/stellar/oapp/overview.md) |
| NEAR Intents | Not rehearsable on testnet (per teammate's earlier check; not re-verified). | — |

Recommendation: if a bridge is in the build, use **CCTP** (one Soroban contract call + Circle attestation API; USDC lands as the exact asset the EURC book trades against). Axelar ITS is the fallback for a non-USDC token.

Prior art (Scout `searchHackathonBuilds`): CCTP-on-Stellar builds exist but are all **privacy** plays (Shade, Nebula Relay at stellar-hacks-zk). Zero prior builds for "meal voucher", "tax refund", or "merchant market maker". Merchant POS prior art is all agent/x402 flavoured.

---

## Idea 1 — "Balcão": every Lisbon café becomes a BRL/EUR market maker

**Hook:** Lisbon's Brazilian-run cafés, salons and hostels accept reais at the till and keep the FX spread themselves, because the app turns their natural two-way flow into resting offers on Stellar's empty BRZ/EURC book.

**Specific user:** The owner of a small Brazilian-run business in Lisbon (Arroios, Anjos, Cais do Sodré) with Brazilian customers paying in reais and Brazilian suppliers/family to pay — i.e. someone who already does informal BRL↔EUR both ways every week. Secondary user: the Brazilian customer or tourist holding USDT/USDC/BRZ.

**Problem + evidence:**
- Brazilians are 31.1% of Portugal's foreign residents and the #1 nationality for new permits (links above). Pix is now accepted at El Corte Inglés / Continente via UNICRE+Braza Bank, with "automatic conversion to euro" done by an eFX intermediary that takes the spread; coverage is patchy ("available in one restaurant, not the one next door") — [DECO Proteste](https://www.deco.proteste.pt/dinheiro/contas-ordem/noticias/brasileiros-usar-pix-pagar-reais-portugal), [InfoMoney](https://www.infomoney.com.br/?p=2862301), [NSC Total](https://www.nsctotal.com.br/?p=7987446). Small merchants are excluded; the intermediary earns the FX.
- Brazilian retail already holds stablecoins (72–80% of declared crypto volume), yet Stellar's BRZ/EURC and BRZ/USDC books are literally empty and BRZ has 97 trustlines. Nobody has a reason to post the first offer.
- Pix International costs the payer a 2–3% spread; cards up to 8% with IOF ([BP Money](https://bpmoney.com.br/?p=414670)).

**Stellar mechanism (exact features):**
- Merchant app issues a **SEP-7 `web+stellar:pay`** URI/QR with `destination`, `asset_code=EURC`, `amount`, and a `memo` = receipt id. Payer wallet executes a **`pathPaymentStrictReceive`** (send BRZ/USDC, receive exactly N EURC): merchant always gets exact euros, payer pays whatever the path costs.
- The merchant's "Keep reais" toggle: a share of inbound BRZ is **not** converted; the app places **`manageSellOffer`/`manageBuyOffer`** pairs on the native SDEX at the merchant's chosen spread around a reference rate (two resting orders, e.g. ±0.8%). Those orders are what the next tourist's path payment fills. **Merchants are the makers, tourists the takers.**
- Optional bridge leg: tourist's USDC on Base/Arbitrum arrives via **CCTP `deposit_for_burn_with_hook`** with the merchant's muxed address as `forwardRecipient`, then path-pays USDC→EURC. (Verified testnet above.)
- **Muxed accounts** (`M...`) per till/employee so one merchant account gets per-register attribution without new reserves.
- Testnet: we issue mock `BRZ` and `EURC` from our own issuers; mainnet BRZ issuer is known for the deck.

**Why not an AI-default idea:** AIs produce "crypto POS for merchants". They do not produce "merchant as market maker on an empty order book for a specific corridor", because that requires having looked at Horizon and seen `bids: []`. The human seed (Lisbon, Brazilian diaspora, Pix-at-the-till being a 2025 Portuguese news story) is concrete.

**90-second demo:**
1. Open stellar.expert mainnet: BRZ/EURC book — empty. "This is the largest foreign community in Portugal; this is their liquidity on Stellar."
2. Café phone shows a SEP-7 QR for 3.50 EURC (um galão e um pastel). Tourist wallet (holding testnet BRZ) scans; path payment settles in ~5 s; merchant screen shows "+3.50 EURC".
3. Owner flips "Keep 30% in reais, spread 0.8%". App posts two offers. Show the testnet order book: **the café is now the first market maker for BRL/EUR on Stellar.**
4. Memorable moment: second tourist pays and the fill goes through *the café's own offer* — the owner just earned the spread Braza Bank would have taken.
5. Optional: Base Sepolia USDC → CCTP → path payment → EURC at the till.

**Buildability risks:** path payment + offers are plain Horizon ops (easy). CCTP leg needs Circle attestation polling (`iris-api-sandbox`) and an EVM wallet — do it last or pre-record. Reference rate: hard-code or pull from a public FX API; no oracle needed.

**Biggest weakness:** On mainnet it only works once a real BRL stablecoin has a Stellar presence with on/off ramp (BRZ's Stellar issuance is tiny). The counter: that is *exactly* the chicken-and-egg this product breaks — merchants provide the first depth without being paid to.

**Ecosystem effect:** New merchant accounts holding EURC; the first standing BRZ/EURC offers on the DEX; Brazilian stablecoin holders (the biggest stablecoin retail base in LatAm) given a Stellar wallet reason; CCTP inbound USDC that is immediately *used* against the EUR book rather than parked. What keeps it there: merchants earn spread only while their offers are resting, so the liquidity is sticky by incentive.

---

## Idea 2 — "Nomad desk": remote workers' USDC becomes the EURC bid side

**Hook:** Lisbon's remote workers bridge their USDC in and park it as *resting* EURC bids at the rate they want, earning the spread they currently pay Wise, and in doing so they become the depth of Stellar's euro book.

**Specific user:** A D8-visa remote worker in Lisbon paid in USDC (Base/Arbitrum/Solana) who needs €1.5–3k of EUR every month for rent and bills. D8 requires ≥ ~€3,480/month income (2025), ~€3,680 (2026) ([Portugalist](https://www.portugalist.com/us/portugal-digital-nomad-visa/), [Bright!Tax](https://brighttax.com/blog/portugal-digital-nomad-visa/)), so the cohort is large and converts predictable monthly amounts.

**Problem + evidence:**
- Wise USD→EUR: $4.17 + 0.45% ([Wise US](https://transferwise.com/us/wishes/)), other pages quote 0.60% ([Wise blog](https://wise.com/us/blog/fees-changing-usd-jan-18-eur)); comparison sites measure ~0.9% below mid ([exiap](https://www.exiap.com/compare/wise-usd-to-eur-exchange-rate)). On-chain alternatives are worse: Stellar's EURC/USDC spread is ~0.5% with €15 of depth at the top; a €2,000 market order would walk the book.
- The user is a natural *limit* trader (no urgency, fixed monthly need) forced to be a *taker*.

**Stellar mechanism:**
- **CCTP** burn on Base Sepolia → mint USDC on Stellar testnet with `CctpForwarder` delivering to the user's account (verified).
- App places a **`manageBuyOffer`** for EURC at the user's chosen rate (e.g. "buy €2,000 at ≤1.105") — a native, zero-fee-to-rest order on the built-in DEX; or splits into a ladder of offers.
- **Transaction preconditions / time bounds** so the ladder expires automatically at month end; **sponsored reserves** so the user's offers' base reserves are paid by the app, not the user.
- Fill → optional SEP-24 cash-out via an existing EURC anchor (MyKobo EURC `GAQRF3…Z7NM` is live on mainnet with 12.8k holders) — mention, don't build.

**Why not an AI-default idea:** AI gives "bridge USDC to Stellar and swap". The maker-not-taker framing, with the empirical fact that Stellar's EUR book has €15 at the top, is what an AI without Horizon access cannot produce. It's also a deliberate answer to "a Stellar app worth staying for": the user stays because their money is *working* (earning spread) while it waits.

**90-second demo:** show EURC/USDC testnet book (we seed a thin, wide one mirroring mainnet). User bridges 2,000 USDC via CCTP (pre-recorded if slow), sets "I want euros at 1.105, by Nov 1". Offer appears in the book. Then a second actor (Idea 1's café, or a bot) sells EURC and the nomad's order fills — **memorable moment: the spread on the book visibly narrows from 0.5% to 0.1% as nomads' bids arrive.**

**Buildability risks:** CCTP end-to-end on testnet adds an EVM dependency; manageBuyOffer + Horizon order book stream is trivial. Sponsored reserves for offers is a nice-to-have.

**Biggest weakness:** Needs a trustworthy EUR off-ramp to be a real product; on its own it's a thin FX-limit-order UI. Pairs much better as the second half of Idea 1 (same book, two sides).

**Ecosystem effect:** Brings USDC from other chains *and leaves it as resting EURC bids*, i.e. order-book depth that persists across sessions. New EUR-side users with a monthly recurring reason to return.

---

## Idea 3 — "Subsídio on-chain": the €10.20/day meal allowance as a Stellar asset

**Hook:** Portuguese employers pay the tax-free €10.20/day meal allowance as a Stellar asset that only whitelisted restaurants can hold, and restaurants redeem it for euros the same second instead of waiting weeks and paying a cut.

**Specific user:** A 10–50-person Lisbon SME (the team's SME contacts) that currently pays Edenred/Pluxee/Coverflex for meal cards; and the small restaurants that accept them.

**Problem + evidence:**
- Tax: cash allowance is exempt only to €6/day; via card up to **€10.20/day** (2025, 70% uplift), and card balances "cannot be exchanged for cash" ([Postal](https://postal.pt/nacional/subsidio-de-alimentacao-2025-saiba-tudo-o-que-mudou/), [DECO Proteste](https://www.deco.proteste.pt/comunidades/financas-pessoais/orcamento-familia/conversation/18454/em-2025-o-limite-da-isencao-do-subsidio-de-refeicao-pago-em-cartao-aumenta-para-1020-euros)). So almost every private-sector worker in Portugal receives a card.
- Merchant-side pain: a 2023 budget proposal tried to force meal cards under debit-card interchange caps; the payments lobby said issuers would just charge employers instead ([Observador](https://observador.pt/2023/11/24/alteracao-ao-oe-ameaca-cartoes-de-refeicao-e-ira-agravar-carga-fiscal-sobre-trabalhadores-avisa-setor-dos-pagamentos/)). 2026 consumer complaints document restaurants dropping Edenred "citing the fees charged" ([Portal da Queixa](https://portaldaqueixa.com/brands/edenred-portugal/complaints/edenred-portugal-dificuldade-em-utilizar-o-cartao-refeicao-em-restaurantes-supostamente-aderentes-160291526)). I could **not** find a published Portuguese commission percentage; Brazil just capped the same product at 3.6% ([Forbes BR](https://forbes.com.br/forbes-money/2025/11/acoes-da-edenred-e-pluxee-despencam-apos-decreto-sobre-vale-alimentacao-e-vale-refeicao-no-brasil/)). Say "undisclosed, Brazil capped it at 3.6%" rather than invent a number.

**Stellar mechanism (this is the "old-school assets, new tricks" entry):**
- Employer (or a shared issuer) issues `REFEICAO` with **`AUTH_REQUIRED` + `AUTH_REVOCABLE` + `AUTH_CLAWBACK_ENABLED`**. **Trustline authorization *is* the merchant whitelist**: only restaurants (and employees) get `SetTrustLineFlags` authorized. A supermarket that's not food-related simply can't hold it. ([control-asset-access docs](https://developers.stellar.org/docs/tokens/control-asset-access#authorization-required-0x1))
- Employees can only *pay* to authorized accounts (because unauthorized accounts can't hold the asset) — the "can't be exchanged for cash" rule is enforced by the ledger, not by a card network.
- Restaurant redemption: an issuer-funded **liquidity pool** or standing **sell offer** REFEICAO→EURC at 1:1 means a restaurant's redemption is a path payment that settles in 5 s, with the fee set by the employer pool (we demo 0%).
- **Clawback** for leavers / expiry of unused balances (legally required behaviour of meal cards). **Muxed accounts** per employee on a single employer account if desired. Daily top-up is a batch of payments in one transaction (up to 100 ops).

**Why not an AI-default idea:** "Vouchers" is on the banned list in its *aid-disbursement* form; this is a regulated private-benefit product with a numerically specific fiscal hook (€10.20 vs €6) that exists in Portugal, Brazil, France and few other places. An AI without Portuguese payroll context won't propose it. Flag honestly to the team that a lazy judge may still bucket it as "vouchers" — the pitch must lead with "every Portuguese worker is already in this product" and "AUTH_REQUIRED trustline = merchant whitelist".

**90-second demo:** HR dashboard "Pay October: 20 employees × 22 days × €10.20" → one transaction. Employee wallet shows balance. Employee scans a tasca's SEP-7 QR → paid. Try to pay the same balance to a random wallet / a clothing shop → **fails on-chain (op_no_trust / not authorized)**; that failure is the memorable moment. Restaurant taps "Redeem" → EURC lands instantly; "Edenred pays you in weeks; this paid you in 5 seconds."

**Buildability risks:** Low. All classic ops, no Soroban required. Need a tiny issuer service for whitelisting.

**Biggest weakness:** Regulatory/legal: whether a self-issued on-chain allowance qualifies for the fiscal exemption is unproven; in reality the issuer would need to be a payment institution. Also banned-adjacent.

**Ecosystem effect:** Every employee of every adopting SME becomes a Stellar account that transacts *daily*; every restaurant becomes a merchant holding EURC; employers hold the monthly float in EURC on-chain. Highest account-count-per-customer of any idea here.

---

## Idea 4 — "Tax-free at the till": VAT refund as a claimable balance in the tourist's currency

**Hook:** A Lisbon shop issues a non-EU tourist's VAT refund on-chain at the moment of sale, locked until customs validates, and the tourist receives it in USDC/BRZ at the airport instead of waiting 3–10 days for Global Blue to keep a third of it.

**Specific user:** Non-EU shopper (Brazilians and Americans are the top luxury tax-free buyers in Portugal — [Sábado](https://www.sabado.pt/sabermais/tax-free)) and the independent Lisbon retailer who today must sign with a refund operator to offer tax-free at all.

**Problem + evidence:** Portugal's e-Taxfree is fully digital (kiosk scans passport + boarding pass, data goes to the tax authority) with €50 minimum ([CRN](https://crncontabilidade.pt/blog/tax-free-em-portugal-como-funciona-e-quem-pode-usar/)). Refund "up to 15% of spend"; Global Blue's own example returns €54 on €400 (13.5%) while the VAT embedded in €400 at 23% is €74.80 — the operator keeps ~28% ([Doutor Finanças](https://www.doutorfinancas.pt/vida-e-familia/viagens/tax-free-como-utilizar-este-reembolso-nas-ferias-de-verao/), arithmetic is mine). Payout "3 to 10 business days after validation".

**Stellar mechanism:**
- Merchant creates a **claimable balance** in EURC for the refund amount with two claimants: the tourist, with predicate `not(before_absolute_time = now)` gated by…—claimable-balance predicates are time-only ([docs](https://developers.stellar.org/docs/build/guides/transactions/claimable-balances#additional-parameters)), so the customs gate goes in a tiny **Soroban contract**: `lock(refund, tourist, merchant, deadline)`; `release()` callable only by the validator key (simulated kiosk); `reclaim()` by merchant after the legal validation window lapses (**time precondition / ledger timestamp**).
- Release does a **`pathPaymentStrictSend`** EURC→USDC (or BRZ) into the tourist's account; optionally **CCTP** burn to send USDC to their home chain.
- Tourist account is created with **sponsored reserves** by the merchant at purchase (first on-chain account for most tourists).

**Why not an AI-default idea:** VAT-refund intermediaries are an invisible, boring oligopoly; nobody in a hackathon brainstorm lands on them without having stood in the Global Blue queue at Humberto Delgado. Uses claimable/sponsored primitives for something other than "undo payments".

**90-second demo:** Shop sells €400 handbag; app issues €74.80 locked refund; tourist's phone shows "locked until customs". Kiosk screen "Validated" → tap → **€74.80 arrives as 82 USDC in 5 s (vs €54 in 10 days)**. Memorable moment: side-by-side "Global Blue €54 / 10 days" vs "you €74.80 / 5 s".

**Buildability risks:** Small Soroban contract + classic ops; CCTP leg optional. Low.

**Biggest weakness:** Legally only the seller can refund directly or via an authorised intermediary; the merchant must trust the refund never gets validated → reclaim path. And liquidity partly *leaves* Stellar if the tourist bridges out — weaker "stays" story than ideas 1–3.

**Ecosystem effect:** Tourists get a sponsored Stellar account because money arrives (the best onboarding there is); merchants keep EURC float on-chain; creates EURC→USDC/BRZ taker flow against the books that ideas 1–2 make.

---

## Best pick: **Idea 1 (Balcão), with Idea 2 as its second half**

Why:
1. **It is the only idea where the liquidity is the product.** Merchants post the first standing offers in an empty book because it pays them, not because SDF asked. Idea 2 supplies the other side (nomads' USDC → EURC bids) through the same book, so one codebase demos both maker populations and a visibly narrowing spread.
2. **The evidence is unusually hard:** Horizon shows `bids: []` on BRZ/EURC today; 493k Brazilians in Portugal; Pix-at-the-till is a 2025 Portuguese news cycle; Brazilian retail crypto is ~75% stablecoins. No invention needed.
3. **Track fit both ways:** Unlocked ("the DEX and path payments for unexpected uses": merchants as market makers) and Composed (CCTP inbound + SEP-7 + SDEX + optional anchor out). The organisers' own "bring users and liquidity" prompt is answered literally, with a verified-testnet bridge, and the twist is in *why they stay* (earning spread), not in the bridge.
4. **Buildable in 15 h:** SEP-7 QR, path payment, two manageOffer calls, Horizon order-book stream, two mock issuers. CCTP is additive and can be pre-recorded.
5. **Demo moment judges will repeat:** "They opened the mainnet order book, it was empty, and a café put the first order in it."

Idea 3 (meal allowance) is the strongest on raw user count and the most "old-school assets, new tricks", but it is banned-adjacent and legally shakier; keep it as the backup if the team prefers a no-bridge, no-Soroban build.
