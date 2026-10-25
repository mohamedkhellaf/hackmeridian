# 05 — Independent Ranking (Agent 4, Ruthless Judge)

Phase 2, independent. Inputs: 01, 02, 03 and my own 04 (kill checklist K1–K7, flags F1–F8, where 3 or more flags count as a kill). FOOTNOTE is not ranked.
**Date fix:** today is **Sun Oct 25**, and the deadline is **Mon Oct 26 12:00**. Every spike that 01 and 03 placed on "Saturday" happens **today**, and it must pass by about 18:00 Sun or the idea falls back or dies.

Weighted score = (Track×20 + User×20 + Tech×15 + Innov×15 + Progress×10 + Market×10 + UX×10)/100, each on a 1–5 scale. These are my estimates of what a judge would give the *likely delivered* version, not the pitched one.

---

## 1. Kill checklist applied

| # | Proposal | Verdict | Kills / flags hit | Note |
|---|---|---|---|---|
| 1 | **KeyHold** (01) | **WARN** | F6 (Trustless Work and every escrow demo), F7 (landlord must opt in), F8 (needs a fast-forward; mitigable with short windows) | Passes K1 only partly: a licensed escrow agent does the same job. The Stellar part is generic Soroban escrow, so its Track fit is weak. |
| 2 | **Roda** (01) | **WARN** | F8 (rounds over time), F5-ish (the collateral paradox undermines the business), K2-adjacent (on-chain ROSCA/"chama/esusu" dApps are a common hackathon trope across chains; **UNVERIFIED** count) | The author admits the collateral flaw: full collateral removes the credit benefit, and partial collateral doesn't stop default. A sharp judge will ask about it. |
| 3 | **Earmark** (01) | **WARN** | K2-adjacent (remittance), F7 (payee schools need wallets and an off-ramp), F6 (SDP / Aid Assist), F3 (anchor corridors unverified) | The best evidence in the set (the labelling RCT, +15%). But a centralized payee registry plus a test anchor makes it a demo of remittance plumbing. 4 flags would mean a kill; I keep it at WARN only because the twist (purpose-locking) is real. |
| 4 | **Silence Is Consent** (01) | **KILL** | K2 (freelancer escrow is saturated, and the author says so), F6 (Trustless Work, Upwork) | "Yet another escrow". Its timeout-release idea is reusable as a module elsewhere. |
| 5 | **LeashPay** (02) | **WARN (spike-gated)** | K2-adjacent (x402/agent payments was my predicted #1 saturated category, and 03 found prior art: REAPP on SCF, x402-policy), K3 gate (facilitator ↔ OZ smart-account `__check_auth` interop **UNVERIFIED**, plus passkey-kit), F6 ("isn't this just OZ's spending_limit policy?"; 02 also flags spending_limit as possibly metering only `transfer`) | The strongest Composed story and the most impressive demo beat (prompt injection blocked on-chain). It needs to hit something like "only payees on the allowlist, and only in this context" that is not stock OZ, or it reads as configuration. |
| 6 | **ReliefRail** (02) | **WARN** | F1 (classic flags + claimable balances + Soroban program contract + passkey + SEP-24 means too many integrations), F6 (SDF's own SDP / Aid Assist) | Its Unlocked fit is the best in the set: AUTH_REQUIRED, revocable, clawback, claimable-balance predicates and sponsorship are genuinely protocol-native. It is survivable if we **cut passkey and the anchor to stretch goals**. The design hole (direct classic payments bypass the category rules) must be closed on paper today. |
| 7 | **QuietPay** (02) | **KILL** | K3 (Confidential Token preview with no API docs and unknown browser proving), K2 (payroll is saturated; PayZoll already won), F5 | High ceiling, but the expected value is the worst here. It only revives if a confidential transfer works from JS within 1 hour. Even then payroll is a tired frame. |
| 8 | **DepositBox** (02) | **KILL (merge)** | Duplicate of KeyHold. Its author admits it is the "weakest on necessary-on-Stellar" (K1). F3 (thin testnet SDEX for USDC→EURC) | Its one good idea, the path-payment refund in the landlord's currency, should be grafted onto KeyHold if KeyHold survives. |
| 9 | **Tripwire** (03) | **WARN (spike-gated)** | K3 gate (rollback of a failed `try_invoke` sub-call including SAC transfers; I believe the host rolls back failed frames, but it is **UNVERIFIED** until the spike runs), K5-adjacent (the user is niche: Soroban protocol teams and whitehats), F4 (CLI-heavy demo) | The most novel and the deepest Soroban use. Hidden traps: (a) a wrong invariant means anyone drains the bounty, so verifier quality is the product; (b) "pause" needs the target contract's cooperation; (c) a public claim tx can be copied (front-run) and needs commit-reveal. |
| 10 | **Quorum** (03) | **WARN** | K2-adjacent (crowdfunding), F7 (needs organisers *and* backers), weak Track (plain Soroban escrow + USDC) | A real mechanism (Tabarrok's dominant assurance contract) and a great slide. **New exploit I found:** with a pro-rata bonus, a whale can pledge up to just under the goal right before the deadline and capture most of the bonus. It needs early-bird weighting or a cap per pledge time. Fixable, but a judge may spot it. |
| 11 | **Volta** (03) | **KILL** | K1 (a café cooperative with a shared DB plus a payment provider does the same job), F7 (multi-café cold start), F4 (a customer needs a wallet for a €2 cup), F8-ish (logistics-heavy demo) | 3 or more flags. Its own author ranks it last. |

---

## 2. Ranked list (all 11)

| Rank | Proposal | Tr | Us | Te | In | Pr | Mk | UX | **Weighted** | One line |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **ReliefRail** | 4.5 | 4 | 3.5 | 3.5 | 4 | 3.5 | 3.5 | **3.85** | The only proposal whose core value *is* Stellar's protocol-level regulated-asset controls. It has real users (NGO cash programs) and an obvious SCF/SDF continuation path. Scope must be cut hard. |
| 2 | **Tripwire** | 5 | 2.5 | 4 | 5 | 4 | 2.5 | 3 | **3.80** | The highest Innovation and Track scores of anything here, and nobody else will build it. It loses 20%-weighted User Value points for being niche. Viable only if the rollback spike passes today. |
| 3 | **LeashPay** | 4.5 | 3 | 4 | 3 | 4 | 3.5 | 3.5 | **3.65** | The best Composed fit and demo beat, but it sits in the most crowded lane of this event. Its differentiator is close to "we configured OZ policies". |
| 4 | **Quorum** | 3 | 3.5 | 3 | 4 | 4 | 3 | 4 | **3.45** | The safest build and a delightful mechanism, but Stellar is a credible escrow, not a core-protocol feature, so Track Alignment caps it. |
| 5 | **Roda** | 2.5 | 4 | 3.5 | 2.5 | 4 | 3.5 | 3.5 | **3.30** | A real pain with MoneyFellows as proof of demand, but the ROSCA dApp is a familiar trope and the collateral paradox is a live hole. |
| 6 | **KeyHold** (+DepositBox path-payment graft) | 2.5 | 4 | 3.5 | 2.5 | 4 | 3 | 3.5 | **3.25** | Lisbon judges will feel it, but it is generic escrow with a two-sided adoption wall. |
| 7 | **Earmark** | 3 | 4 | 3 | 2.5 | 3.5 | 3.5 | 3 | **3.23** | Best evidence, but it is a remittance pitch at a Stellar event, and the payee side is fictional on testnet. |
| 8 | **DepositBox** | 2.5 | 3.5 | 3.5 | 2 | 4 | 3 | 3.5 | **3.10** | A weaker KeyHold. Merge it. |
| 9 | **Volta** | 2.5 | 3 | 3 | 3 | 4 | 2.5 | 3.5 | **3.00** | A visual demo, but the problem is ops and cold start, not trust. |
| 10 | **Silence Is Consent** | 2.5 | 3.5 | 3.5 | 1.5 | 4 | 3 | 3.5 | **2.90** | Saturated escrow. |
| 11 | **QuietPay** | (4.5) | (3) | (2) | (4.5) | (3) | (3) | (2.5) | **~2.8 risk-adjusted** | It could score 3.6+ if the preview SDK works, but there is a high chance of shipping nothing on-chain. |

**The spread is narrow (3.25–3.85).** Nothing clears my 4.0 winning bar as pitched. The winner will be decided by *execution polish and the 2-min video*, not by idea selection alone. ReliefRail and Tripwire are the only ones I see with a credible path to 4.0+:
- **ReliefRail reaches 4.0 if** it cuts to issuer flags + claimable-balance expiry + clawback + merchant allowlist, with Freighter only, and a real NGO quote or WFP/UNHCR voucher stat goes in the deck.
- **Tripwire reaches 4.0 if** the rollback spike passes, a polished web bounty board replaces the CLI, and it's reframed as "self-insuring TVL for every Soroban protocol" with a named prospective user (e.g., a Blend/Soroswap-style protocol).

---

## 3. Top 6, with the single strongest reason each would lose

1. **ReliefRail.** *It will lose by shipping half of too many parts.* Five primitives plus a passkey wallet plus an anchor in about 20h from a standing start in Soroban gives a demo with seams. Judges also ask "isn't this SDF's Disbursement Platform?" Fix: cut to 3 primitives today and pitch it as "SDP's missing restricted-spend layer".
2. **Tripwire.** *It will lose on User Value & Problem (20%)*: judges who aren't security people see a niche dev tool with a CLI demo and no named customer, and a security reviewer will ask "what if the invariant is wrong?" Fix: a web UI, a named target persona, and a slide on verifier design.
3. **LeashPay.** *It will lose by being one of N x402-agent projects at an event whose pre-workshops were "Build with AI powered by Stellar"*, and its moat is a stock OpenZeppelin policy. Fix: a mechanism OZ doesn't ship (e.g., per-merchant budgets with Reflector-priced caps in EUR), or don't pick it.
4. **Quorum.** *It will lose on Track Alignment (20%)*: it's a well-built escrow, with no core protocol feature and no ≥2-project composition unless passkeys actually ship. The whale-sniping exploit is a technical-review landmine.
5. **Roda.** *It will lose to the collateral paradox and familiarity*: judges have seen on-chain savings circles, and "how does partial collateral stop the round-1 recipient from walking away with 10× their collateral?" has no good answer.
6. **KeyHold.** *It will lose to "why would a landlord ever opt in?"*. Two-sided adoption with the powerful side having zero incentive, on generic escrow tech, sinks User Value, Market and Track together.

---

## 4. What I need to see before supporting a pick
- **ReliefRail:** a written answer today on how direct classic payments are prevented (only merchants and the program contract are authorized, and beneficiaries hold balances inside the contract), plus a cut list.
- **Tripwire:** spike output showing that a failed sub-call reverts a SAC `transfer` made inside it, on soroban-sdk 28 host tests, by about 14:00 Sun.
- **LeashPay:** a 402 → pay from a C-account (smart account) → 200 roundtrip on the testnet facilitator, plus a differentiator sentence that does not contain "OpenZeppelin policy".
- **Anything chosen:** a timestamped 2-min video storyboard and a 3-person hour plan with a Mon 06:00 cut line.
