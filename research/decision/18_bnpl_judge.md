# 18: BNPL / agentic payment wallet ecosystem (Ruthless Judge)

Written Sun 2026-10-25, 14:46–15:00 WET.

I wrote this independently. The peer files (18_bnpl_*) did not exist when I started. The idea is assessed in its best realistic form, defined in §2.

Labels:
- **[V]** verified (link or live query)
- **[A]** assumption
- **[S]** speculation
- **[U]** unknown

---

## 1. Strongest case AGAINST, with evidence

1. **Consumer BNPL becomes regulated consumer credit 26 days after the hackathon.**
   - The EU Consumer Credit Directive 2 (2023/2225) applies from **20 Nov 2026**. It extends scope to loans under €200 and to **interest-free BNPL**. [V: EP OEIL summary https://oeil.europarl.europa.eu/oeil/en/document-summary?id=1764052 ; Abreu Advogados https://abreuadvogados.com/wp-content/uploads/2023/11/New-rules-on-consumer-credit-in-the-EU-–-Directive-2023-2225-1.pdf ; Hogan Lovells https://hoganlovells.com/en/publications/eu-second-consumer-credit-directive-scope-and-impact-for-buy-now-pay-later-bnpl-providers ; application date per Briqpay https://briqpay.com/blog/ccd-2-update-sweden-s-new-consumer-credit-act-is-now-law-here-s-what-merchants-need-to-know-before-november-2026]
   - National transpositions are cutting the short-term exemptions. The Dutch one ends the "repaid within three months" exception. Denmark reportedly cuts its interest-free deferral window from 90 to 50 days. [V secondary, Mondaq; MakeInfluence]
   - So a consumer BNPL launched in Portugal needs creditworthiness assessment, pre-contract information and a licensed lender. Any judge with fintech exposure will ask "who is the lender, and are you licensed?"
2. **BNPL without a lender is not BNPL.**
   - What Klarna and its peers actually sell is that the **merchant is paid upfront and the provider carries default risk and does the underwriting** [A, industry structure].
   - We have no capital, no underwriting and no KYC. So:
     - **Version A (merchant-financed):** the merchant is paid in instalments and carries default risk. That is layaway or store credit with bounce risk, which merchants adopt BNPL precisely to avoid.
     - **Version B (paid upfront):** a liquidity provider buys the instalment stream. That is **invoice/receivable factoring (BANNED list)**, plus a lending pool, plus a credit-scoring oracle. That means Soroban and a third-party dependency, and it cannot be built credibly in 20h.
3. **The "agentic" half is the most saturated category on Stellar.**
   - Scout: "agent wallet shopping" returns **91 builds, 2 winners**, including Cards402 (1st, Stellar Hacks: Agents), and the field is full of spend-limit wallets (Compass, Stellar Smart Wallets, x402 Autopilot…). [V Scout, 14:46 UTC]
   - Agent spend limits appear in most of our 8-run twin corpus [V 15_twin_test_raw].
   - The 10/22 judges already said "not a similar project over and over again" [V-verbal].
4. **"Wallet ecosystem" is too broad for 20 hours.**
   - It means a wallet, a merchant checkout, a credit engine, an agent layer and repayment collections. That is the 10-feature trap the judges warned about ("only one of them worked") [V-verbal].
5. **Judges will see "Klarna on a blockchain".**
   - Nothing in the consumer value proposition needs Stellar. Instalments, the "pay later" UX and reminders are web2 [A].
   - The only Stellar-native part is C1's same-sequence, time-bounded pre-signed transactions, which is section 6.
6. **On-chain repayment can't be enforced.**
   - Pre-signed instalments bounce whenever the consumer's wallet is empty, exactly like C1 [V Architect spikes k/l: a bounce is a recorded failed tx, but it is still a bounce].
   - There is no collections path and no credit bureau link. On-chain default leaves only a public failed transaction, which is useless against an anonymous wallet [A].
7. **There are no real consumers to bring.**
   - Who shops with USDC/EURC from a self-custody Stellar wallet in Portugal today? [U]
   - The users-and-liquidity story depends on merchants AND consumers both arriving with on-chain euros. That is a two-sided cold start, plus the Portuguese EURC on-ramp gap we already flagged [U].
8. **It is C1 in consumer clothing.**
   - The only verified, novel mechanism is C1's: pre-signed time-bounded instalments, with the cheque account locked by pre-authorised signers [V spikes k/k2/l].
   - Moving it from B2B to consumers *adds* CCD2, removes the evidence base (Portuguese B2B late payment [V]) and keeps the bounce problem.
   - The one thing in its favour: **"BNPL" and "installments" return 0 Stellar hackathon builds** [V Scout], so the consumer framing is whitespace on Stellar, though not globally.

---

## 2. Best realistic form, and its score

**Best realistic form (my definition).** "Pay in 3 without a lender":
- At checkout, the shopper pre-signs 3 instalment transactions from a locked instalment account, with time bounds per month (the C1 mechanism).
- The merchant sees a "will it clear?" balance view and collects each instalment by submission.
- No agent layer, no credit pool, no Soroban.

**Score:**

| Criterion (weight) | Score | Why |
|---|---|---|
| Track Alignment (20) | 4 | Same native mechanism as C1 (preconditions, pre-auth signers, fee-bump), but for *sequential* instalments rather than mutually exclusive faces, so the clever "faces kill each other" trick mostly disappears. |
| User Value & Problem (20) | 2 | BNPL demand is real, but this version gives the merchant late payment plus default risk, the opposite of what BNPL sells, with no underwriting, under CCD2, and no evidenced Stellar consumer base. |
| Technical Execution (15) | 4 | Reuses the verified C1 spike code. |
| Innovation (15) | 3 | BNPL is mainstream. It is whitespace on Stellar (0 builds), but judges will read "Klarna on blockchain". |
| Hackathon Progress (10) | 4 | Buildable. |
| Market & Ecosystem (10) | 3 | Merchant and consumer accounts in principle, but a two-sided cold start. |
| Product Design & UX (10) | 4 | A familiar checkout pattern. |
| **Weighted** | **67** | |

The agentic variant (agents shop within limits and pay in instalments) scores **≈ 62**:
- Innovation drops to 2 (saturated, 91 builds).
- Technical Execution drops to 3 (an agent layer on top).
- User Value stays at 2.

**Comparison:** C1 Cheque 75 > F1 Second Thought 71 > BNPL best form 67 > BNPL agentic about 62.

---

## 3. Kill criteria

| Criterion | Verdict |
|---|---|
| Critical integration can't be verified | **PASS** (C1 spikes) for the no-lender version. **KILL** for the lender version (pool, scoring and KYC unverified in 20h). |
| MVP depends on infrastructure built from scratch | **KILL** if it means a "wallet ecosystem" or a lender. **PASS** for "pay in 3". |
| Stellar interaction is superficial | **PENALIZE.** The instalment UX is web2; only the locking mechanism is native. |
| Innovation already exists without meaningful differentiation | **PENALIZE, heavy.** Klarna, Afterpay and others exist. Agentic spending has 91 Stellar builds. |
| User problem unclear | **PENALIZE, heavy.** For whom is lender-less BNPL better? Not the merchant (late plus risky) and not the shopper (Klarna already exists). |
| Core workflow can't be shown end-to-end | **PASS** (pay-in-3 demo with compressed time). |
| Judge red flags (04 §7) | Saturated category (agents); "rebuilds a known product"; regulated consumer credit with no answer. |

---

## 4. Verdict

**REJECT as a replacement for C1.** Possible **narrow MERGE** into C1, described below.

**The single decisive reason:** BNPL's value *is* the lender: the merchant is paid now and someone else carries the risk.
- Without a lender, our version makes the merchant worse off than a card payment.
- With a lender, it becomes factoring (banned) plus licensed consumer credit under CCD2 from 20 Nov 2026, and it cannot be built credibly by tomorrow.
- The "agentic" half drops us into the most saturated category on Stellar (91 builds).

**Narrow MERGE worth taking:**
- Give C1 an **"instalments" mode for B2B supplier credit**: "pay this €3,000 invoice in 3 post-dated cheques". Each instalment keeps the early-discount / on-time / late-interest ladder.
- This keeps everything verified and adds a recognisable "pay-later" hook for judges.
- It stays in **B2B, outside consumer-credit law** [A, high confidence: the Consumer Credit Directive covers consumers, i.e. natural persons acting outside their trade].
- It is supported by the hard Portuguese late-payment evidence [V].
- It is about 2–3 extra dev-hours on top of C1 [A].
- Pitch phrase: **"BNPL for businesses, without a lender: the supplier decides when to cash."**

**Priorities check:**

| Priority | BNPL | C1 (+ B2B instalments) |
|---|---|---|
| Uniqueness | Fails ("Klarna on chain"; agents saturated) | Wins |
| Users and liquidity | Two-sided consumer cold start | Onboards both sides of each B2B payment |
| Real problem, real solution | Problem real, solution inverted for merchants | Fits the real seed |
| Buildable | Only the narrow form | Yes, mechanism already verified |
