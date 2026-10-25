# 18: BNPL / agentic shopping wallet: Problem Hunter critique

Written Sun 2026-10-25, 14:45–15:05 WET.

Labels:
- **[V]**: verified, source opened or search-confirmed today
- **[V-sec]**: verified only via secondary or trade press
- **[A]**: assumption
- **[S]**: speculation

## 1. BNPL in Portugal and the EU

**Players in Portugal**
- Klarna ranks above Scalapay by monthly active users in Portugal (2025, apps with ≥10k MAU; exact figures paywalled) [V-sec] (https://www.statista.com/statistics/1610170/bnpl-apps-with-the-highest-mau-in-portugal/).
- Other providers named for PT: Klarna, FLOA Pay, Oney, Sequra [V-sec] (https://stripe.com/resources/more/payments-in-portugal ; https://www.comparaja.pt/credito-pessoal/artigos/bnpl-compra-agora-paga-depois).
- BNP Paribas launched a BNPL solution in PT [V-sec headline] (https://executivedigest.sapo.pt/?p=386789).
- Klarna on TAP Air Portugal checkout since Apr 2025 [V-sec, IMARC].
- **Cofidis Pay and MB Way instalments: could not verify** in today's searches.
- PT usage is mostly larger purchases (appliances, electronics), in 3–4 interest-free instalments over 30–90 days [V-sec, Stripe / Comparaja].
- **No Portugal-specific market size** was found [V absence].

**EU size**
- European BNPL ≈ **$191B in 2025**, dominated by Klarna, Afterpay/Riverty and PayPal (ResearchAndMarkets) [V-sec] (https://www.businesswire.com/news/home/20250228642047/en/).
- Klarna: ~93M users, $105B GMV in 2024 [V-sec] (https://cross-border-magazine.com/bnpl-in-europe-ecommerce-2025-review).

**Shopper pain**
- UK: **22% of BNPL users missed ≥1 repayment** in 6 months. More than a quarter of those saw their credit score fall or were contacted by debt collectors (Centre for Financial Capability) [V-sec].
- Klarna reintroduced UK late fees in 2023: £5 after 7 days, capped at 25% of the order, max 2 per order [V-sec] (https://www.pymnts.com/bnpl/2023/klarna-debuts-late-fees-in-uk-to-reduce-missed-payments/).
- No PT/EU-wide missed-payment survey was found [V absence].

**Merchant pain**
- Fees are "3–8% of the purchase price", but that comes from a single trade article with no primary source [V-sec, weak] (https://www.paymentsjournal.com/klarna-to-start-charging-late-fees-in-the-uk/).
- Slow settlement as a pain point is **not evidenced**: BNPL providers typically pay merchants upfront, which is the product's selling point [A].
- So "merchants paid slowly" is likely **wrong**. The merchant pain is the **fee**, not the timing.

## 2. Regulation (decisive)

**CCD2 (Directive (EU) 2023/2225)**
- Transposition deadline was **20 Nov 2025**; it **applies from 20 Nov 2026**, 26 days after this hackathon [V-sec, consistent across Taylor Wessing, Hogan Lovells, learnsignal] (https://www.taylorwessing.com/en/insights-and-events/insights/2025/06/new-consumer-credit-directive ; https://hoganlovells.com/en/publications/eu-second-consumer-credit-directive-scope-and-impact-for-buy-now-pay-later-bnpl-providers).
- It removes the old exemptions for interest-free and <3-month credit. Third-party BNPL providers come into full scope:
  - creditworthiness assessment;
  - pre-contract information;
  - advertising rules;
  - Member States must license or register non-bank creditors [V-sec; licensing detail A].
- The remaining carve-out (per secondary summaries) is narrow: interest-free deferred payment **offered directly by the supplier of the goods**, with no third-party creditor [V-sec; exact article wording not opened, A].
- Portugal's transposition status: **could not verify** [U].

**Implications**
- A **testnet prototype has no legal problem**. It's a demo with no real consumers or money [A, standard].
- Any real deployment where a **third party (us, or an LP pool) extends credit** to Portuguese consumers needs a **licensed or registered creditor** (Banco de Portugal-supervised credit or financial institution [A]), plus mandatory creditworthiness checks.
- **"Instalments without a credit check" is precisely what CCD2 outlaws** from Nov 2026. That shopper-side pitch is a regulatory red flag in front of SDF/enterprise judges [A, strong].
- The only lightly regulated path is **merchant-as-creditor** (the supplier offers its own interest-free instalments). Then the merchant carries the risk and gets no upfront cash.

## 3. Agentic commerce: real need or demo trope?

**What already exists [V-sec, dates differ across sources]**
- OpenAI + Stripe **Agentic Commerce Protocol / Instant Checkout** (29 Sep 2025, US, Etsy items in ChatGPT).
- **Google AP2** (open standard on A2A/MCP, 60+ partners; one source says donated to FIDO in Apr 2026).
- **Mastercard Agent Pay** (agentic tokens).
- **Visa Trusted Agent Protocol** (14 Oct 2025, with Cloudflare); its relation to "Visa Intelligent Commerce" is unclear.
- **Coinbase x402**.
- Sources: https://thepaypers.com/payments/expert-views/the-road-to-agentic-commerce-the-journey-so-far ; https://risingwave.com/blog/mastercard-agent-pay-vs-visa-vs-stripe-agentic-commerce/
- **On Stellar:** x402/MPP are officially supported [V, 02 file]. "Agent wallet with budget / spending limits" has **94 matching hackathon builds** in Scout (OrbitSafe, SpendGuard, AAEK, x402 Autopilot, Compass; **Cards402 won** Agents) [V Scout, 14:47 UTC]. **Saturated.**

**Consumer demand (surveys, all sponsor-funded)**
- Riskified Q1 2026: 61.5% use AI for discovery, but **55% are uncomfortable with agents buying for them** [V-sec] (https://forkast.news/73-use-ai-for-shopping-55-wont-let-it-buy-anything-the-trust-gap-is-widening/).
- Checkout.com Jun 2026: 24% will never delegate purchases [V-sec] (https://www.checkout.com/newsroom/consumer-demand-for-ai-shopping-is-forming-fast-but-trust-for-agentic-commerce-is-still-catching-up).
- Accenture 2026: 74% would delegate routine re-orders, but **only 9% are open to fully autonomous purchase including payment** [V-sec].

**Verdict:** "An AI agent shops for you with a budget" is a **demo trope today**. Discovery is real; autonomous payment is not wanted by ~90%. Incumbents (Visa, Mastercard, Stripe, Google) own the rails, and the Stellar version is the most saturated build category.

## 4. The sharpest real user: which candidate has evidence?

| Candidate | Evidence of pain | Fatal issue | Verdict |
|---|---|---|---|
| **Merchant: instant pay while shopper pays in instalments** | Fees 3–8% [weak, single source] | Merchants **already** get paid upfront by Klarna et al. [A]. To beat them we must front cash, which makes us the lender: licensed under CCD2, with credit risk. | Weak. Pain is the fee, and fee competition needs a balance sheet. |
| **Shopper: instalments without credit check / hidden fees** | UK 22% missed payments [V-sec]; late fees [V-sec] | "No credit check" is illegal for third-party BNPL from 20 Nov 2026. Hidden-fee pain is real, but the fix is regulatory (CCD2), not technical. | **Red flag.** Don't pitch. |
| **Lender: earn yield funding BNPL receivables** | No user evidence; it's a DeFi supply story | Needs real borrowers and underwriting. LPs bear consumer default risk. Testnet yield is cosmetic. Prior art: **The Simple Fund** (receivables liquidity, **HackMeridian 2025 1st place**), **Axial** (winner), StellarInvoice [V Scout] → twin of last year's winner. | Brings "liquidity" only on paper. |
| **Agent: AI shops with a budget** | Trust gap: only 9% want autonomous payment [V-sec] | 94 Stellar builds, Cards402 already won [V Scout]. | Trope; saturated. |
| *(Narrow, defensible)* **Merchant-as-creditor instalments**: a shop offers its own interest-free 3× plan, shopper pre-authorises time-bounded instalment payments | CCD2 supplier-direct carve-out [V-sec/A] | The merchant gets no upfront cash, which defeats why merchants use BNPL. Shopper can revoke or underfund (same default risk as cards). | Legally cleanest, commercially weakest. |

**Problem Hunter conclusion:** none of the four has a sharp, evidenced, legal user that a 3-person team can serve by tomorrow.
- The pains that are evidenced (missed payments, late fees) are being addressed **by regulation taking effect in 26 days**.
- Merchant settlement speed is not actually a pain.
- The agent version is a saturated trope.

## 5. Users and liquidity on Stellar

- **LP pool funding receivables (USDC/EURC):** the *only* variant that could bring liquidity (deposits).
  - It needs real originated receivables, an underwriting model, and a licensed originator. Within the hackathon horizon: **zero real liquidity**, testnet only [A].
  - Prior art includes last year's HackMeridian winner, so twin risk is high.
  - Composing with **Blend/DeFindex** (pool as a Blend lender) would be the honest "Composed" framing, but Blend testnet pools are cosmetic [V-sec, 02 file].
- **Shopper wallet with instalments:** new consumer accounts in theory. Real PT shoppers pay by MB Way/cards and would need EURC (no PT anchor) [A]. Hand-wavy.
- **Agent wallet:** no new users. Agent builders are already on Stellar.

## 6. Recommendation (Problem Hunter)

- **Do not switch to BNPL/agentic for this hackathon.** The regulatory clock (CCD2 from 20 Nov 2026) and incumbent coverage make the user story weaker than F1's or C1's.
- If the team insists, the least-bad framing is **"CCD2-ready instalment rails: merchant-as-creditor 3× plans with on-chain disclosure"**. Lead with compliance (pre-contract info, fee caps, no hidden fees) rather than "no credit check".
  - It's a narrow, defensible demo, but it has no liquidity story.
- Note for C1 (Cheque Pré-Datado): C1's early-payment-discount face is effectively **B2B supplier credit**, which is outside the *consumer* credit directive [A]. It sidesteps CCD2 entirely while serving the team's real SME seed. That makes C1 a better "pay later" product than consumer BNPL.
