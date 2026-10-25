# 17: Uniqueness sprint evaluation (Problem Hunter)

Written Sun 2026-10-25, 14:28–14:50 WET. Covers C1 Cheque Pré-Datado (gen_sme), C2 Balcão (gen_liquidity), C3 Testemunha (gen_lisbon) and C4 RASTO (gen_scam).

Labels:
- **Verified**: I re-opened the source myself today.
- **Contradicted**: the source or other evidence says otherwise.
- **Could-not-verify**
- **[A]**: assumption
- **[S]**: speculation

## 1. Evidence check (re-verified myself)

| # | Claim | Status | What I found |
|---|---|---|---|
| C1 | "~20% of PT firms pay on time (Informa D&B, Jun 2026)" | **Verified**, with a date nuance | The DN/Dinheiro Vivo article (15 Jul 2026) on Informa D&B's 12th study gives **20.2%** of firms paying within terms. The data is May 2026 (firms active on 5 May). Portugal is **2nd-to-last of 37**. Accommodation & restaurants: **11%** on time, **30 days** average delay (the longest sector). https://dinheirovivo.dn.pt/empresas/portugal-no-penltimo-lugar-entre-37-pases-no-cumprimento-de-prazos-de-pagamento-pelas-empresas |
| C1 | "Post-dated cheques still common in Portuguese B2B" | **Contradicted in aggregate; could-not-verify for B2B niche** | Press citing Banco de Portugal says cheques were only **~2 of every 1,000 domestic payments in 2024**. Cheques were the fastest-falling instrument (−18.3% in number, −13.7% in value; year unclear). BdP is studying measures to discourage cheques further (ENPR 2030 consultation, Jul 2026) (https://postal.pt/economia/ainda-usa-este-metodo-de-pagamento-muito-conhecido-esta-com-os-dias-contados/ ; https://pplware.sapo.pt/informacao/portugueses-estao-a-abandonar-os-cheques/). The generator's "common" claim rests on how-to blogs (forms-legal, e-konomista), not data. Post-dated cheques **may** survive in construction and wholesale niches [A], but the pitch can't say "common" without the team's SME contacts confirming it. |
| C1 | DL 62/2013 late interest 10.15% (H2 2025) / 10.40% (H2 2026) + €40 | **Verified (secondary)** | APCMC: Aviso 16623/2026/2 (DR 3 Jul 2026) sets **10.40%** for H2 2026; H1 2026 was 10.15% (Aviso 822/2026/2) (https://apcmc.pt/legislacao/juros-de-mora-comerciais-2-o-semestre-2026/). I didn't open the DR text itself. The €40 minimum compensation is in DL 62/2013 [A, standard; not re-opened]. |
| C2 | Brazilians = 31% of foreigners in Portugal | **Verified** | DN Brasil (22 Sep 2026), citing AIMA's RMA: **493,622** Brazilian residents at end-2025 = **31.1%**; 115,709 new permits in 2025 (34.2% of the total; #1 nationality for the 6th year). https://dnbrasil.dn.pt/brasileiros-receberam-115709-novas-autorizaes-de-residncia-em-portugal-em-2025 |
| C2 | Brazilian-run cafés and businesses in Lisbon | **Could-not-verify (count)** | Plausible and visible [A], but I found no count of Brazilian-owned SMEs in Lisbon this session. |
| C2 | A café owner would want reais over Pix / MB Way | **Could-not-verify, and the evidence leans against** | The generator's own sources show Pix is already accepted in Portugal (UNICRE + Braza), with **automatic conversion to euro** for the merchant (DECO). So the demand that exists is "Brazilians want to *pay* with Pix". Nothing shows merchants want to *hold* BRL inventory or act as FX market makers. The generator's figures say Brazilian crypto is overwhelmingly **USDT (88.7%)**, which isn't BRZ-on-Stellar. BRZ on Stellar has **97 trustlines**, and the BRZ/EURC books are empty (generator's Horizon check, not re-run). Portuguese retail runs on **MB Way / Multibanco** [A, well known]. |
| C3 | Paid witnesses for the atestado de residência (Sábado) | **Verified** | Sábado, 16 Jan 2025: witnesses paid "outside the juntas". In Venteira (Amadora), 3 immigrants got **€170 via MB Way** from a Brazilian couple in under a minute. An Arroios aide says witnesses got **€50–100**. Lumiar admits "some witnesses will be paid" but has no proof. https://www.sabado.pt/portugal/detalhe/imigracao-os-esquemas-das-falsas-testemunhas. Correction to the generator: the €170 case was in **Amadora (Venteira)**, not outside a Lisbon Junta. |
| C3 | Penha de França court case | **Verified** | RTP: **all 26 defendants convicted** with suspended sentences (25 for aiding illegal immigration + forgery; 1 Junta employee for abuse of power, the only one who didn't profit). **23 residents** supplied or vouched for addresses at **€10–60** each. Ruling date not on the page. https://www.rtp.pt/noticias/pais/penas-suspensas-para-rede-que-usava-moradas-falsas-para-legalizar-imigrantes_n1753517. Minor correction: the generator said 25 convicted incl. the employee; RTP says 26 total. |
| C4 | Matosinhos mule case | **Verified** | RR (11 Sep 2025) and CM: PJ arrested a 44-year-old woman in Matosinhos. She "abriu e usou cerca de 20 contas" to receive and conceal proceeds; **~three dozen victims**, crimes **2022–2023**, losses still being tallied. https://rr.pt/noticia/pais/2025/09/11/mulher-detida-em-matosinhos-por-burla-ola-pai-ola-mae/439418/ ; https://www.cmjornal.pt/portugal/detalhe/burlona-do-ola-mae-ola-pai-tinha-20-contas-bancarias. (RR returned 403 to direct fetch; content confirmed via search snippets of RR + CM.) |

## 2. Demand: first user, why they'd switch, cold start, seed fit

### C1 Cheque Pré-Datado
- **First user:** the team's real SME group. The *supplier* in a buyer→supplier pair that pays late. The pain is verified: 20.2% pay on time, and restaurants 11%.
- **Why they'd switch:** the supplier gets a discount/penalty ladder and a visible "will it clear?" signal.
- **Demand problems:**
  1. **The payer has no reason to sign Face C.** Today they pay late *without* interest, which is the generator's own point: suppliers "never dare claim" interest because of the relationship cost. That same relationship cost stops a supplier demanding a cheque that encodes it [A, strong].
  2. **The guarantee is empty, by design.** The payer can empty the account (bounce). As specced, the payer is also the **only signer of the cheque account**, so they can `BumpSequence` it and **kill all three faces at any time** before cashing. That's the Judge's "drawer-tx" lesson again.
     - Fix: replace the payer key with **pre-auth-tx signers** (hashes of the 3 faces) so no other tx can touch the cheque account [A, unspiked].
     - The bounce stays possible.
  3. **Cold start:** both firms need EURC, and there's no Portuguese SEP-24 anchor (generator's own gap). These firms pay by SEPA / MB Way / Multibanco today. Getting EURC means Circle Mint or an exchange [A].
- **Seed fit: STRONG and testable.** One call to the SME group answers the decisive question: *"Do you use post-dated cheques or 'pago no fim do mês' with each other, and would the creditor accept a digital one with a discount for early cashing?"* Aggregate data says cheques are near-extinct (2 in 1,000 payments), so this call is make-or-break.

### C2 Balcão
- **First user:** a Brazilian-run café owner in Arroios/Anjos.
- **Why they'd switch:** to earn the FX spread. But the switch requires the owner to **hold BRL inventory and FX risk**, run resting offers, and accept a stablecoin most Brazilians don't use on Stellar (BRZ: 97 trustlines; Brazilians use USDT on other chains).
- **Today's alternatives:** Pix-at-the-till (UNICRE/Braza) already gives the customer Pix and the merchant euros. MB Way covers residents.
- **Cold start, two-sided:** tourists need BRZ on Stellar *and* merchants need offers. The CCTP leg brings USDC, not BRL.
- **Seed fit: none.** The team's seeds are an Olá-mãe relative and an SME group, not Brazilian merchants.

### C3 Testemunha
- **First user:** the Junta clerk, a public body. Applicants and witnesses are compelled participants, not choosers.
- **Why they'd switch:** fraud is verified and painful. But the root cause is **cross-Junta visibility** ("no shared view"), so one Junta adopting gets little value. That's a cold start at the level of 24 Juntas and then about 3,000.
- **Adoption barriers:** public procurement, GDPR review, legal change to how atestados are issued [A], and one Junta employee was himself in the fraud.
- **Seed fit: none.**

### C4 RASTO
- **First user:** the fraud team at a euro EMI or anchor on Stellar.
- **Why they'd switch:** PSR liability is real (EU deal of 27 Nov 2025 per the generator, not re-verified).
- **But there is no user today:** Olá-mãe money moves over **MB Way/SEPA, not Stellar** (generator concedes). No Portuguese P2P euro issuer on Stellar exists [A].
- **Issuer constraints [U]:** whether Circle's EURC on Stellar even has clawback enabled is unknown. If it doesn't, the buyer would be a new issuer. Issuer-side freeze-and-claw-back across holders is also a custodial power that crypto-native users avoid.
- **Seed fit: story only.** The relative paid (or was asked to pay) via MB Way, so RASTO wouldn't have helped her.

## 3. Users and liquidity: is the claim credible?

| | Claimed effect | Plausible real effect in 6–12 months | Credibility |
|---|---|---|---|
| **C1** | "Every cheque onboards two businesses; one café × 10 suppliers = 10 accounts, €10–30k/month EURC" | If the team's SME group adopts it: **~5–15 business accounts** and a few €k–€10k/month EURC. Viral spread along supply chains needs EURC on/off-ramps in PT that don't exist yet. | **Hand-wavy on scale, credible on mechanism.** It's the only candidate where the team can name the first ~5 accounts. |
| **C2** | "Cafés become the first BRL/EUR market makers" | Real resting liquidity requires merchants to hold BRZ inventory. Expect **near zero** without a subsidy. A few demo offers ≠ liquidity. | **Hand-wavy.** It's the best *narrative* (empty books are verified-in-file), but no evidence a merchant wants this. |
| **C3** | "Every applicant and witness gets an account; Junta = issuer" | **Zero** until a public body adopts it. If it did, many accounts (pending AIMA cases: ~400k, unverified) but **no liquidity**, and the accounts are compelled, not organic. | **Not credible in hackathon horizon.** |
| **C4** | "A euro issuer and P2P volume" | **Zero** until Portuguese P2P euros settle on a Stellar asset. | **Not credible.** It depends on an issuer that doesn't exist. |

## 4. Problem Hunter verdict
1. **C1 is the only candidate where verified pain, the team's real seed, and a nameable first user line up.** Two conditions:
   - **(a)** the SME call confirms they use post-dated cheques or "pay at month-end" with each other (aggregate data contradicts "common");
   - **(b)** the revocation hole is fixed with pre-auth-tx signers (or disclosed).
   - Its users/liquidity claim is small but honest at 5–15 accounts.
   - The penalty face (Face C) is a demand liability: suppliers won't impose it. Pitch Face A (early-payment discount) as the hero, and Face C as optional.
2. **C3 has the best-evidenced problem** (Sábado, the Penha de França conviction, SEF). But its user is a public body, it has no seed fit, and it brings no liquidity. It fails the team's "bring users or liquidity" preference.
3. **C2 has the best liquidity story and the weakest demand evidence.** Verified: Brazilians are 31.1% of foreigners. Not verified: any merchant wants BRL inventory. It also has no seed fit.
4. **C4 is evidence-solid (Matosinhos verified) but user-less today.** Its seed fit is story-only.

**Ranking (my lens):** C1 > C3 > C2 > C4. None of the four beats F1 on User Value **unless** the SME call validates C1's premise. Run that call before switching.
