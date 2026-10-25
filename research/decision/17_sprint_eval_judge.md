# 17: Uniqueness sprint evaluation (Ruthless Judge)

Written Sun 2026-10-25, 14:30–14:55 WET.

**Sources read:**
- `15_twin_test.md`, `15_twin_test_raw.md`, `15_twin_codex_A/B.txt`
- `16_sprint/brief.md`, `gen_sme.md`, `gen_liquidity.md`, `gen_lisbon.md`, `gen_scam.md`, `gen_codex.md`

**Labels:**
- [V] = verified (link or live check)
- [A] = assumption
- [S] = speculation
- [U] = unknown

**Scoring:** integer 1–5 per criterion. Weighted score = Σ(weight × score / 5).

**New criterion from the team:** prefer products that bring users or liquidity to Stellar. It also appears as an official idea area on /build [V].

## New facts checked during this evaluation

- **Circle USDC on Stellar mainnet has `auth_clawback_enabled: false`** (Horizon, 14:29 UTC) [V]. The largest regulated stablecoin on Stellar therefore cannot run C4's recovery. I could not resolve the EURC issuer's flags in time [U].
- **Cheques are about 2 in every 1,000 domestic payments in Portugal (2024)** [V secondary: Postal.pt citing Banco de Portugal, https://postal.pt/economia/ainda-usa-este-metodo-de-pagamento-muito-conhecido-esta-com-os-dias-contados/]. The paper instrument C1 builds on is fading.
- **Twin corpus:** F1's "undo via claimable balance" came up as #1 in 2 of the 4 "unique" runs [V 15_twin_test].
  - Merchant QR plus path payment checkout appears in the corpus. Sonnet run 1 #10 is "local stablecoin swap + QR spending"; Opus run 4 #5 is "merchant tap-to-pay via path payments" [V].
  - Clawback appears often, but for other uses: loyalty expiry, Pfand cups, tickets [V].
  - No run produced same-sequence pre-signed alternatives, witness quotas or receiver-side tracing [V].
  - However, Codex, a different vendor, given the same seeds, independently reached "pre-auth signer + shared sequence number" (Cotação Fechada) [V gen_codex]. C1's mechanism family is therefore reachable once a model is seeded. Its twin risk is Low–Med, not zero.

---

## 1. Official rubric scores

| Candidate | TA 20 | UV 20 | TE 15 | Inn 15 | HP 10 | MEP 10 | UX 10 | **Total** |
|---|---|---|---|---|---|---|---|---|
| **C1 Cheque Pré-Datado** | 5 | 2 | 4 | 5 | 4 | 3 | 3 | **75** |
| **C3 Testemunha** | 4 | 3 | 4 | 5 | 4 | 2 | 4 | **75** |
| C2+C5 merged ("Balcão": acceptance board plus merchant/nomad makers, no CCTP) | 4 | 2 | 4 | 4 | 4 | 5 | 3 | **72** |
| **F1 Second Thought (incumbent)** | 4 | 3 | 4 | 3 | 4 | 3 | 4 | **71** |
| C4 RASTO | 5 | 2 | 4 | 3 | 4 | 3 | 4 | **71** |
| C5 Prova de Caixa | 4 | 2 | 4 | 3 | 4 | 4 | 3 | **67** |
| C2 Balcão + Nomad desk (as written, with CCTP) | 4 | 2 | 3 | 3 | 4 | 5 | 3 | **66** |

### Notes per criterion

**C1 Cheque Pré-Datado**
- **TA 5:** three faces share one sequence number, so they are mutually exclusive. Time bounds set the discount and interest ladder. Op-source is separate from tx-source, and reserves are sponsored. This is "old-school primitives, new tricks" with no contract and no escrow.
- **UV 2:** the evidence for late payment is strong (only about 20% of Portuguese firms pay on time, Informa D&B [V]). But the MVP does **not** make payment more likely. A face can bounce, and as written the payer can cancel silently (see the fatal flaws below).
  - The *payer* signs Face C, the one that adds statutory interest. Cash-poor payers who avoid paying interest today will not sign it [A].
  - "Payer has no liquidity today" contradicts "supplier cashes early at 97%".
  - The real value is narrower: on-demand early payment at a pre-agreed discount (dynamic discounting without a bank), plus automatic terms.
- **TE 4:** classic operations only, about 100 lines of builder code [A]. Needs a 45-minute spike on pre-auth signers and same-sequence faces.
- **Inn 5:** no AI twin among the 8 runs, and no Scout prior art [V gen_sme]. Low–Med twin risk because Codex reached a related mechanism.
- **MEP 3:** onboards two businesses per cheque and moves EURC volume, but no Portuguese EURC on-ramp is confirmed [U].
- **UX 3:** businesses need a wallet plus EURC. The three-face UI is clear.

**C3 Testemunha**
- **TA 4:** issuance and AUTH flags used as a rate limiter, clawback as a revocation cascade, and a cross-issuer view.
- **UV 3:** the strongest evidence in the sprint: the Penha de França conviction, the Sábado report, the SEF investigation [V gen_lisbon]. But the MVP only partly resolves it: a paid witness can still lie once, and adoption requires public bodies.
- **Inn 5:** zero twins.
- **MEP 2:** brings accounts but no liquidity, and those accounts are likely custodial and run by the Junta.
- **UX 4:** the clerk view and the "flip" moment are clear.

**C2 + C5 merged**
- **TA 4:** strict-receive checkout with a pinned asset, plus SDEX maker offers.
- **UV 2:** no evidence that Lisbon merchants or Brazilian customers want stablecoin payments. Codex's own file says so.
- **Inn 4:** the "failed sale → liquidity request → maker fills it" loop is new. The base checkout is AI-default.
- **MEP 5:** literally "bring users and liquidity".
- **UX 3.**

**F1 Second Thought**
- Same sheet as in 09, with MEP reverted from 4 to 3: the SDK channel is speculative, and under the team's new criterion F1 brings no new liquidity.
- Innovation stays at 3 only because of the guardian twist, which 0 of 8 runs found. The headline ("undo") is AI-default [V].

**C4 RASTO**
- **TA 5:** freeze, clawback and repay in one atomic multi-operation transaction across hops.
- **UV 2:** the "Olá mãe" money is not on Stellar, and the largest stablecoin cannot claw back [V].
- **Inn 3:** clawback was designed for exactly this kind of issuer recovery. Only the multi-hop tracing UI is new [A on CAP-35 intent].
- **MEP 3:** speculative, requires an issuer.
- **UX 4:** the graph lighting up is a memorable moment.

**C5 alone**
- The base is a familiar checkout. The acceptance board is the only twist (UV 2, Inn 3).

**C2 alone**
- CCTP adds an EVM dependency (TE 3).
- The official prompt explicitly lists CCTP, so other teams will build CCTP bridges (twin magnet).

---

## 2. Decision factors

| | AI-twin risk | Users / liquidity effect | Real, evidenced problem? | Kill criteria |
|---|---|---|---|---|
| **C1** | **Low–Med.** 0/8 runs, but Codex reached a sibling mechanism. | **Med.** Two business accounts per cheque, viral along supply chains, full invoice value in EURC. Gated by a missing Portuguese EURC on-ramp [U]. | **Yes for late payment [V].** The instrument is fading: cheques are about 0.2% of Portuguese payments [V secondary]. Whether SMEs adopt a cheque that can bounce is [U]. | **PENALIZE, no kill** (see the fatal flaws). |
| **C3** | **Very low.** 0/8 runs; unusual local legal knowledge. | **Low.** Accounts only, likely Junta-custodial; no liquidity. | **Yes, strongest [V].** | **PENALIZE, heavy.** Adoption is government-gated, and there are GDPR and optics problems (see below). |
| **C2+C5** | **Med.** The base checkout is in the corpus, and two vendors converged on "merchants drive liquidity". | **High by design.** On testnet the liquidity is simulated. | **No evidence of demand.** Pix-at-the-till and MB Way already exist. Brazilians in Portugal hold mostly USDT (88.7% [V gen_liquidity]), which is not on Stellar testnet. BRZ has 97 trustlines [V]. | **PENALIZE, heavy** on user problem. If the CCTP leg stays, it hits the >2 dependency rule (CCTP + attestation API + EVM testnet). |
| **F1** | **High** for the headline (2/4 #1) [V]. Low for the guardian twist (0/8). | **Low.** Protects existing accounts; adds no liquidity. | **Yes for the scam pattern [V]**, on bank rails. Stellar users are [U]. | **PASS** (09). |
| **C4** | **Low–Med.** Clawback is common in the corpus; receiver-side tracing is not. | **Med (speculative).** Needs a regulated clawback-euro issuer. | **Yes [V],** but the money isn't on Stellar, and USDC can't claw back [V]. | **KILL-adjacent:** the MVP does not resolve the problem for any user today. |
| **C5** | **Med.** | Med–High. | Weak. The GNR screenshot warning is about bank transfers. | PENALIZE. |

---

## 3. Fatal-flaw hunt

### C1: does anyone adopt a cheque that can bounce?

**Flaw A, silent cancellation (the drawer-transaction lesson again).**
- As written, the payer is the cheque account's signer. It can kill all three faces at any time with one BumpSequence or a merge.
- If it does, the supplier's submission is rejected (`tx_bad_seq`) and **never recorded**. That breaks the "bounce is a public on-chain fact" claim.
- Proposed fix [A, sent to the Architect for confirmation]:
  - install the three face hashes as **pre-authorized transaction signers** and set master weight to 0, so nobody can bump or merge the cheque account;
  - the payer's escape is then only to empty the account. That produces an executed, failed, fee-charged transaction (`op_underfunded`), which IS in the ledger [A, high confidence].
- Without this fix, C1 = PrizeLock's fatal hole.

**Flaw B, the interest face is signed by the party who pays it.**
- No payer adds statutory interest voluntarily [A]. The supplier's leverage is unchanged, so Face C will mostly be absent.

**Flaw C, it has none of a paper cheque's legal teeth.**
- A Portuguese paper cheque's power comes from banking and legal sanctions: risk-listing of cheque users and the bad-cheque offence. A Stellar transaction has neither [A, Portuguese cheque regime].
- And the paper instrument is fading (about 0.2% of payments [V secondary]).

**What survives:**
- A **payment promise with a programmable early-payment and late-payment ladder** that the supplier exercises on demand. In effect, dynamic discounting without a bank or factor.
- A bounce becomes a public, timestamped fact, but only with Flaw A fixed.
- That is a real B2B category (dynamic discounting / supply-chain finance [A]), and it fits the team's real seed (SMEs that owe each other).
- Pitch it as **"the post-dated cheque, rebuilt honestly"**, not as a guarantee.

### C2: is there demand when Pix and MB Way already exist?

- **Residents:** the 493k Brazilian residents have Portuguese bank accounts and MB Way. They have no reason to pay a café in BRZ [A].
- **Tourists:** Pix-at-the-till already exists at large merchants via UNICRE/Braza [V gen_liquidity].
- **Stablecoins:** Brazilian stablecoin holders hold USDT [V], and USDT0 has no testnet [V 04].
- **Merchant risk:** cafés would carry BRL inventory and FX risk, and exchange-like activity may need a MiCA CASP licence [A].
- **No evidence of demand** anywhere in the file. The liquidity is the product, but nobody is asking for it.
- C5's acceptance board fixes C2's cold start, not its demand problem.

### C3: would a Junta ever issue an asset?

**Adoption:**
- The atestado procedure is set by law. A Junta is a public body under GDPR, and a public-ledger pilot needs political and legal sign-off.
- The "Junta issues a token" premise is [S] for any near-term pilot.

**Privacy:**
- Address hashes are **enumerable** (Portuguese addresses form a small, known space). Witness and applicant accounts are permanent and public. That creates linkable data about immigrants on a public chain [A]. That is a GDPR red flag.

**Ethics and optics (strongest objection):**
- The memorable moment, "9 atestados flip invalid in one ledger", also invalidates **honest immigrants who really live at the address** because a witness was later found bribed.
- The demo celebrates mass revocation of immigrants' documents. In front of SDF judges that could land as surveillance, not inclusion [S, but high-impact].

**Track criterion:** zero liquidity, against the team's new preference.

### C4: the money isn't on Stellar

- Confirmed: Circle USDC on Stellar has clawback disabled [V]. The product therefore needs a new regulated euro issuer that enables clawback.
- Clawing back on a victim's report raises due-process and false-report risk.
- A mule who swaps to XLM escapes.
- No user is helped today.

### F1 (unchanged from 09/10, plus the twin finding)

- The headline mechanism is the #1 AI suggestion in half of the "unique" runs [V].
- Judges will likely see one or two "Undo Send" entries. F1 then has to win on the guardian twist and the human seed, which are real but subtle in a 3-minute video.

---

## 4. Recommendation

**SWITCH to C1 (Cheque Pré-Datado, reframed as "the post-dated cheque, rebuilt honestly"), conditionally. Keep F1 as the fallback.**

**Decisive reason:**
- The team has now said it ranks uniqueness and bringing users or liquidity above everything else.
- On exactly those two axes, F1 is the worst-placed candidate: its core is AI-default [V], and it adds no users or liquidity.
- C1 scores the joint highest rubric total (75 vs F1 71).
  - Its mechanism produced no twin among 8 models.
  - It builds on the team's *real* SME seed, with hard late-payment evidence.
  - It onboards both sides of every B2B payment.
  - It is classic-ops buildable at F1-like cost.
- C3 ties on score but loses on liquidity, adoption and optics.

**The switch is conditional on three gates (all by ~16:30):**
1. **Technical spike, 45 minutes.** Same-sequence faces with pre-auth signers and master weight 0, op-source payment signed by the payer, and a supplier fee-bump.
   - It must show (a) the payer cannot cancel; (b) the other faces die after one executes; (c) an underfunded face is recorded on-chain as failed.
   - If (a) fails, KILL C1 and keep F1.
2. **SME call (the team's real contacts).** Ask the supplier side: "Would you accept a digital post-dated payment you can cash early at 97%?" Ask the buyer side: "Would you sign it, and would you include the interest face?"
   - If both sides say no, keep F1.
3. **Scope discipline:**
   - drop the "aval" stretch;
   - Face C is optional in the demo, and the pitch says the interest face is the supplier's negotiating ask, not a guarantee;
   - testnet "EURt" is self-issued and labelled as such.

**Do not merge C2+C5 into the build.** It is the best fit for the liquidity criterion (72) but has no evidenced demand. Use the empty BRZ/EURC order-book screenshot as a "what's next" slide in any choice.

**Do not pick C3 or C4.**
- C3: adoption, GDPR and optics risks. Its clawback cascade punishes honest immigrants.
- C4: no user today, and USDC can't claw back.

**If the gates fail, keep F1** with the 09/10 guardrails:
- lead with the guardian twist ("the person being impersonated is the one who can stop it") and the pull-the-plug beat;
- never lead with "undo".

---

## Addendum (about 14:35): the Architect's spikes k and l answer the C1 technical gate

**Gate 1 PASSES** [V, testnet 14:31–14:33]:
- **(a)** The locked cheque account (pre-auth signers, master weight 0) cannot be bumped or merged by anyone. Every attempt returns `tx_bad_auth`.
- **(b)** Once a face executes, every sibling face fails with `tx_bad_seq` (tx 9659652b…).
  - The pre-auth signer was confirmed consumed on a failed face.
  - Consumption on a successful face is [A].
- **(c)** A bounce is a FAILED transaction recorded in the ledger: `op_underfunded`, `successful=false`, fee charged to the supplier's fee-bump (tx d8bf727f…).
  - Rotating the payer's key also produces a recorded failure (`op_bad_auth`).
  - So "a bounce is a public on-chain fact" is TRUE.

**New design constraint:** one premature presentation voids the whole cheque.
- A face presented early that bounces consumes the sequence number, and all faces die.
- The "Will it clear?" balance check therefore becomes mandatory UX, not optional, before the supplier submits.

**Flaw A (silent cancellation) is resolved.** Flaws B (the payer signs the interest face) and C (no legal teeth) remain user-value issues for the SME call (Gate 2).

The recommendation stands: switch to C1 if Gate 2 doesn't return a double "no".
- **14:36 update:** the Architect's spike k2 (tx 2e9f7f51…) confirms the pre-auth signer is also consumed on a SUCCESSFUL face, and the sibling then fails with `tx_bad_seq`. Gate 1 is now fully verified.
- **15:05 correction (Architect spike o) [V]:** a payer who rotates its main key voids the cheque **without** any failed face on-chain, because `op_bad_auth` is rejected at validation and consumes no sequence number. Only the public SetOptions key change is visible, and the app should surface it as "drawer changed keys". Bounces caused by an empty balance are still recorded on-chain (`op_underfunded`). So Flaw A is mostly but not fully closed.
