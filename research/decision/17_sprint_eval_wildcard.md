# 17 — Uniqueness sprint evaluation (Wildcard Inventor)

Written Sun 2026-10-25, about 14:30–14:55 WET.

**Inputs**
- `16_sprint/` candidates: gen_sme, gen_liquidity, gen_lisbon, gen_scam, gen_codex.
- Twin corpus: `15_twin_test.md`, `15_twin_test_raw.md`, `15_twin_codex_A.txt`, `15_twin_codex_B.txt`. That is 8 fresh-AI runs: 4 with the "typical" prompt and 4 with the "unique" prompt.
- Scout `searchHackathonBuilds` (1,356 builds), queried 14:28 UTC.

**Labels:** [V] verified (link or tool result), [A] assumption, [S] speculation, [U] unknown dependency.

## 1. Originality: twin likelihood and demo memorability

Scout queries, hybrid search, 14:28 UTC [V]:

| Query | Builds matched |
|---|---|
| "post-dated cheque" | 0 |
| "BRZ EUR Brazilian" | 0 |
| "residence attestation witness" | 0 |
| "scam money mule tracing" | 0 |
| "meal voucher" | 0 |
| "clawback fraud recovery" | 2 (off-target: Obscura, Treasure Recovery) |
| "VAT refund tourist" | 1 (off-target: Turista) |
| "cafe accepts crypto path payment merchant" | 37 (generic crypto checkout: EzPay, PLUTO, cowrie…) |
| "merchant market maker order book" | 27 (none is "merchant as maker") |
| "FX limit order nomad" | 16 (NomadEx, FixedRateX, intent FX routers) |

| Candidate | Closest hits in the twin corpus (8 runs) | Scout prior art | Twin likelihood | Demo moment | Memorability |
|---|---|---|---|---|---|
| **C1 Cheque Pré-Datado** | No cheque framing in 0/8. Adjacent mechanism: Opus #3 "self-custodial standing orders via pre-signed txs". Codex's sprint idea "Cotação Fechada" independently reached the **same shared-sequence-number exclusivity** trick, so the *mechanism* is reachable by an AI given a Portuguese-SME seed. | 0 ("post-dated cheque") | **Low** for the product. Medium for the mechanism. | "Cash early" lands, then the other two faces die with `tx_bad_seq`. Sharpened version below: the payer tries to stop the cheque and the network refuses. | **4** (with the sharpened moment; 3 as written) |
| **C2 Balcão** (merchant as BRL/EUR maker) | "Merchant tap-to-pay via path payments" (Opus #5) and "local stablecoin swap + QR spending" (Sonnet #10) are close **as a category**. "Merchant posts resting offers on an empty corridor" appears 0/8. | 0 for BRZ/EUR. 37 generic crypto-checkout builds, 27 "market maker" builds, none merchant-as-maker. | **Medium.** Judges may file it under "crypto POS" unless the empty-book framing leads. | Mainnet BRZ/EURC book shows `bids: []`; the café posts the first offer; the next tourist's payment fills the café's own order. | **4** |
| **C2b Nomad desk** | "FX payroll strict-receive" (Codex A #9) is adjacent. | 16 FX/limit-order builds | **Medium–High** | The spread visibly narrows as bids arrive | 3 |
| **C3 Testemunha** | 0/8; nothing similar. | 0 | **Very low** | The clerk presses "witness was paid" and 9 atestados across 3 Juntas flip to revoked in one ledger (clawback cascade). | **5** |
| **C4 RASTO** | Clawback appears only as loyalty expiry, cup deposits or ticket fraud (Haiku #5, Fable #2, Opus #6). Mule tracing appears 0/8. **But it sits in the same "scam" domain as F1's twinned undo** (2/8). | 0 | **Low** for the mechanism. Medium for the domain. | A live hop graph turns red and "€900 recovered from 4 accounts in 1 ledger"; the mule's cash-out fails with `op_not_authorized`. | **5** |
| **C5 Prova de Caixa** (Codex) | Generic "merchant checkout" is a top-10 AI default. Its twist (failed sale → visible liquidity request) appears 0/8. | 37 checkout builds | **Medium.** Codex itself admits "an ordinary checkout restricted to an established euro asset already solves much of the problem". | A huge balance can't pay; one new offer makes the sale settle. | 3 |

**Originality ranking (my lens):** C3 > C4 ≈ C1 > C2 > C5 > C2b.

---

## 2. Stress test: what breaks on the way to a real user and a real demo

### C1 Cheque Pré-Datado
- **Hole 1 (as written): the payer can stop the cheque at will.** The cheque account's only signer is the payer, so a `BumpSequence` or `AccountMerge` by the payer voids all three faces. That leaves the supplier *less* protected than the generator implies.
- **Hole 2: a bounce kills every face.** A submitted transaction that fails (`op_underfunded`) is still applied, so it consumes the cheque account's sequence number [A, high confidence: failed transactions consume the sequence and pay the fee]. Faces B and C then become invalid too. Exclusivity and "re-present after a bounce" cannot both hold with one shared sequence number.
- **Hole 3: fees.** The transaction source (the cheque account) pays the fee, so it needs XLM. Alternatively the supplier fee-bumps it [V: fee-bump works, Architect spike c].
- **Where the user value is real:**
  - Portuguese SMEs pay late: only ~20% pay on time, ranked 2nd-worst of 37 economies [V Informa D&B, in gen_sme].
  - Statutory late interest (10.40%, DL 62/2013) plus the €40 fee is almost never claimed [V source cited in gen_sme].
  - Post-dated cheques are a living informal credit habit [V blog-grade sources only]. The team's SME contact can confirm or kill this on a single call.
- **EURC on-ramp:** no Portuguese anchor confirmed [U]. That is the same "do these users exist on Stellar?" gap that F1 has.

### C2 Balcão (+C5)
- **Market-maker risk is the killer the generator didn't name.** A café's resting BRZ/EURC offers become stale as BRL moves, and arbitrage bots pick off stale quotes [A, standard market-making economics]. Protection needs automatic re-quoting from a rate feed, i.e. a bot holding the merchant's key. That is a real product, not a toggle.
- **Who pays in BRZ?** BRZ has 97 trustlines on Stellar mainnet [V gen_liquidity]. Lisbon's Brazilians mostly earn euros and pay with Pix/MB Way [A].
- **Strengths:**
  - Liquidity is literally the product.
  - The empty-book evidence is hard data [V Horizon].
  - It hits the "bring users and liquidity" priority head-on.
  - CCTP testnet is verified [V gen_liquidity], which allows a Composed angle.

### C3 Testemunha
- Strongest local evidence of the batch: a Penha de França conviction and paid witnesses outside Juntas [V].
- **Weaknesses:**
  - The buyer is a public body, so adoption is government-gated and GDPR applies.
  - **No team seed.**
  - **No liquidity**, which runs against the team's stated preference.
  - Political optics: it could read as surveillance of immigrants unless framed as protecting honest applicants [S].
  - "Why not a shared database?" gets a medium-strength answer at best.

### C4 RASTO
- **Sits on the team's real seed** (Olá mãe) without touching the banned undo/guardian lane. It is receiver-side, multi-hop and issuer-driven.
- **Weaknesses:**
  - Same premise gap as F1: Olá-mãe money doesn't move on Stellar today. RASTO needs a regulated euro issuer to adopt it [U]. Whether Circle's EURC on Stellar has clawback enabled is [U], so the demo uses a self-issued EURT.
  - The DEX escape: a mule swaps to XLM, so the taint lands on an innocent market maker. And clawing back from possibly unwitting mules is ethically and legally delicate.
  - Pro-issuer-control framing may divide crypto judges. SDF itself supports clawback for regulated assets [A].

---

## 3. Single best version: C1 sharpened into "Cheque Pré-Datado: o cheque que não se pode cancelar" ("the cheque that can't be stopped")

This candidate ties the team's **real SME seed**, a **Portuguese-only instrument** and a **protocol-native trick**, and it has the lowest twin risk among the liquidity/user-bringing options. Here is how I would sharpen it with **zero added build risk**.

### Hero flow (one)
A café pays its bakery with a three-face post-dated cheque. The bakery chooses *when* to cash: early with a discount, on time at face value, or late with the statutory interest built in.

### Mechanism (classic operations only; changes vs. gen_sme in **bold**)
1. **Cheque account** (sponsored reserves, created by the payer): master weight 0, **signers payer 1 + supplier 1, thresholds low/med/high = 2/2/2.**
   - Any transaction sourced from the cheque account then needs **both** parties.
   - The payer **can't** void the cheque by bumping or merging alone, so the "can't be stopped" property is protocol-enforced.
   - The supplier co-signs at acceptance, which also freezes the terms.
2. **Three faces** sharing one sequence number. Each face has two ops:
   - a `Payment` whose op source is the payer's main account (EURC to the supplier);
   - an `AccountMerge` that closes the cheque account and frees the reserve.

   | Face | Amount | Time bounds |
   |---|---|---|
   | A | 97% | `maxTime` = day 20 |
   | B | 100% | day 21 to the due date (≤ 60 days, the DL 62/2013 cap) |
   | C | 100% + statutory interest + €40 | `minTime` = due date + 1 |

   Cashing one face consumes the sequence number, so the other two faces die.
3. **The supplier fee-bumps when cashing,** so the cheque account needs no XLM for fees [V fee-bump, spike c].
4. **"Will it clear?" pre-flight:**
   - The payer's EURC balance is public, so the supplier sees "covered / not covered" before presenting.
   - Presenting an uncovered cheque is an explicit **"Protestar"** action. The failed transaction (`op_underfunded`) is recorded on the ledger forever: a public, timestamped *protesto*.
   - This is honest about Hole 2: a protested cheque is void and the payer must issue a new one, just as with paper.
5. **Stretch: "aval" face** from the sócio-gerente's personal account, valid from the due date + 15 days, sharing the same sequence number. It fires only if nothing else did. Idea 4 of gen_sme.
6. **Light liquidity hook (stretch, no second flow):** the face's payment op becomes `pathPaymentStrictReceive` (supplier gets exactly N EURC; payer pays from USDC/BRZ up to `sendMax`).
   - This puts DEX volume on every cheque without a second hero flow.
   - Risk: if the path price moves beyond `sendMax`, the face fails and that counts as a bounce. Keep it **off** by default.

### 90-second demo (memorable moment marked ★)
- **0–12 s.** A real-looking paper cheque photo, labelled illustrative. Caption: "Only ~20% of Portuguese firms pay on time. Suppliers almost never ask for the legal 10.40% late interest." [V]
- **12–30 s.** Café signs the cheque in one click. The bakery co-signs to accept. Three faces appear: **€970 now / €1,000 from day 21 / €1,048.40 after 30 Nov.**
- **30–45 s.** ★ **The café tries to cancel the cheque.** The network refuses (`tx_bad_auth`). Caption: "A paper cheque can be stopped. This one can't."
- **45–65 s.** Demo clock jumps past the due date. Face C's amount includes the statutory interest. The bakery cashes it and the explorer link shows it. Faces A and B are re-submitted and die with `tx_bad_seq`.
- **65–80 s.** A second cheque from an empty café account. The bakery presses "Protestar", and the failed transaction is shown permanently on stellar.expert.
- **80–90 s.** "Every cheque brings two businesses and the full invoice in euros onto Stellar."

### Why this beats C1 as written
It fixes the two holes that a protocol-literate judge (Garand, Tyler) would find in 30 seconds: a payer-voidable cheque, and the bounce killing every face. It also turns one of the fixes into the memorable moment.

### Build estimate
About 10–12 dev-h (classic ops; the frontend is issue / accept / inbox / cash / protest).
- Spike first (≤45 min): one testnet run proving four things:
  - a 2-of-2 cheque account plus a payer-op-source payment;
  - same-sequence exclusivity;
  - a fee-bumped face;
  - an `op_underfunded` failure that consumes the sequence number [A until spiked].

### Merges considered and rejected
- **C1 + C2 (cheque + café market making):** two hero flows and two user groups. The FX inventory risk adds a bot. Only the light `pathPaymentStrictReceive` hook above survives, as a stretch.
- **C2 + C5 (Balcão + liquidity-request board):**
  - This is the strongest *liquidity* product: a failed sale becomes a visible request, a merchant or nomad posts the offer, the sale settles and the maker earns the spread. Memorability 4.
  - Its user value hinges on a merchant willing to carry FX inventory with arbitrage risk [A] and on BRZ demand that is 97 trustlines today [V].
  - I'd keep it as the **liquidity-first alternative** if the team values "bring liquidity" above everything.
- **C4 + RELÓGIO:** good, but it stays in the scam domain where F1 already sits and is already twinned (2/8).

---

## 4. Honest verdict: does any candidate beat F1 overall?

My rubric scores use the same lens as `09_score_wildcard_inventor.md` (F1 = 75). Weighted = Σ weight × score / 5.

| | TA 20 | UV 20 | TE 15 | Inn 15 | HP 10 | MEP 10 | UX 10 | **Weighted** |
|---|---|---|---|---|---|---|---|---|
| F1 Second Thought (current) | 4 | 4 | 4 | 3 | 4 | 3 | 4 | **75** |
| **C1 sharpened (Cheque)** | 5 | 3 | 4 | 4 | 4 | 3 | 4 | **78** |
| C2+C5 Balcão | 4 | 2 | 4 | 4 | 4 | 4 | 4 | **72** |
| C3 Testemunha | 4 | 3 | 4 | 5 | 4 | 2 | 4 | **75** |
| C4 RASTO | 4 | 3 | 4 | 4 | 4 | 3 | 4 | **74** |

Score notes:
- **C1, Track Alignment 5:** sequence-number exclusivity, time-bound price ladder and signer-weight irrevocability, all classic, no contract. That is "old-school assets, new tricks" exactly.
- **C1, User Value 3:** late payment and unclaimed interest are evidenced [V], but cheque usage evidence is blog-grade and the EURC on-ramp is [U].
- **C1, Innovation 4:** no product twin; the mechanism was independently reached by Codex.
- **C2+C5, User Value 2:** the market-maker and BRZ-demand gaps above.
- **C3:** it ties F1 on points but runs against the team's liquidity preference and has no seed.
- **Arithmetic:** C1 = 20+12+12+12+8+6+8 = 78; C2+C5 = 16+8+12+12+8+8+8 = 72; C3 = 16+12+12+15+8+4+8 = 75; C4 = 16+12+12+12+8+6+8 = 74.

**Answer: C1-sharpened is the only candidate that beats F1 overall: 78 vs 75, by 3 points. That margin depends on two unverified claims, so treat it as conditional.**
- **C1 > F1:**
  - Twin risk is low. F1's undo is reached 2/8 and ranked #1 [V 15_twin_test].
  - Track Alignment is higher.
  - It brings two businesses plus invoice volume per cheque, which fits the team's "users/liquidity" preference better than F1.
- **F1 > C1:**
  - Every F1 guarantee is already spiked on testnet; C1's four claims are not.
  - F1's user pain (Hi Mum, 82%/95% for ages 55+) is better evidenced than "Portuguese SMEs still use post-dated cheques" (blog-grade).
  - F1's demo is more emotional.

**Decision rule I recommend (fast, evidence-gated):**
1. In the next 45 min, run two checks in parallel:
   - **(a) the C1 spike** (four checks listed above);
   - **(b) one call to the team's SME contact:** "Do you or your customers use cheques pré-datados or 'pago no fim do mês'? Have you ever claimed late interest? Would you accept a digital cheque in euros-on-Stellar?"
2. **If both pass, switch to C1-sharpened.** It wins on uniqueness, leads on points (78 vs 75), and better matches the team's "bring users" preference.
3. **If either fails, stay on F1** and lead its pitch with the 0/8 guardian twist, not "undo".
4. **Keep C2+C5 Balcão** as the option only if the team decides "bring liquidity" outweighs User Value.
