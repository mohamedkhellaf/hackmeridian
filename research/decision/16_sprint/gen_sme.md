# Seed: Portuguese SMEs that owe each other money (non-netting, non-factoring angles)

Time-boxed 20 min. Evidence gathered via web search + Stellar docs/Scout (2026-10-25). Netting, factoring, tokenized invoices avoided; escrow avoided (no funds are ever locked in any idea below).

## Shared evidence base

- Only ~20% of Portuguese companies pay suppliers on time; Portugal is 2nd-worst of 37 economies. 65% pay up to 30 days late, 9% 30–90 days, 5.6% >90 days. Accommodation & restaurants worst (11% compliant, avg 30 days late). Informa D&B, June 2026: https://blog.informadb.pt/wp-content/uploads/2026/07/20260608_Estudo_Pagamentos_SE.pdf ; press: https://dinheirovivo.dn.pt/empresas/portugal-no-penltimo-lugar-entre-37-pases-no-cumprimento-de-prazos-de-pagamento-pelas-empresas
- Statutory late-payment interest for B2B (DL 62/2013): 10.15% (H2 2025), 10.40% (H2 2026), plus a minimum EUR 40 recovery fee. Rate is published twice a year and almost never claimed by small suppliers. https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/legislacao/diplomas_legislativos/Documents/Aviso_16792_2025_2.pdf ; https://apcmc.pt/?p=44886
- Post-dated cheques ("cheques pré-datados") remain a common informal B2B credit instrument in Portugal (monthly invoices, construction "autos de medição"), despite being legally payable at sight and discouraged by Banco de Portugal; bouncing one is not even the crime of "cheque sem provisão". https://forms-legal.com/pt/portugal/financial/loans/cheque-pre-datado-portugal ; https://www.e-konomista.pt/cheque-pre-datado-como-funciona/
- EURC (Circle, MiCA e-money token) is a native Stellar asset since 2023: https://stellar.org/press/eurc-launches-on-the-stellar-network
- Stellar docs confirm the preconditions used below: minSeqNum (valid when `minSeqNum <= S < tx.seqNum`), time bounds, ledger bounds, extra signers: https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions#minimum-sequence-number
- Scout prior art: zero Stellar hackathon builds match "cheque", "post-dated" or "pre-signed transaction"; invoice builds are all factoring/ZK-settlement (StellarInvoice, Obscura, InvoiceVeil, BatchGuard). Whitespace confirmed.

---

## Idea 1 (BEST): "Cheque Pré-Datado" — one cheque, three faces

**Hook:** A digital post-dated cheque whose early-payment discount and statutory late interest are enforced by Stellar time bounds, and where the three versions can never all be cashed because they share one sequence number.

**User:** The buyer-side small business (café, builder, shop) that genuinely intends to pay its supplier in 30–60 days but has no liquidity today, and its supplier who currently holds a paper cheque or a promise.

**Problem:** Portuguese SMEs run on informal credit: post-dated cheques and "pago-te no fim do mês". The supplier gets no certainty, no early-payment option, and never dares claim the 10.15–10.40% statutory interest or the EUR 40 fee (relationship cost). The buyer cannot pre-commit without locking cash (escrow is exactly what cash-poor SMEs refuse). Evidence above.

**Stellar mechanism (exact features):**
1. App creates a tiny "cheque account" per cheque via **sponsored reserves** (BeginSponsoringFutureReserves + CreateAccount; payer pays 0 XLM). Cheque account's master weight is set to 0 and the payer's key is added as its only signer, so only the payer can authorise anything from it.
2. Payer signs **three transactions with the same source (cheque account) and the same sequence number**, each containing a `Payment` op whose *op source* is the payer's main account (EURC to supplier) plus an `AccountMerge` op (cheque account → payer, reclaiming the reserve):
   - Face A: 97% of invoice, **time bounds** maxTime = day 20 (early-payment discount).
   - Face B: 100%, minTime = day 21, maxTime = due date (day 60, the DL 62/2013 cap).
   - Face C: 100% + statutory interest + EUR 40, minTime = due + 1, no maxTime.
3. Supplier receives the three signed XDRs (SEP-7-style link / QR). It chooses *when* to cash by submitting one. Because all three carry the same seqNum, executing any one moves the cheque account's sequence past it and the other two become permanently invalid. No contract, no escrow, no funds locked: the payer keeps its liquidity until the moment of cashing, exactly like a real post-dated cheque — but with the discount/penalty ladder built into the paper.
4. Optional **aval** (see Idea 4) and **minSeqNum** on Face C so a stale cheque stays cashable after admin ops on the cheque account.
5. "Will it clear?" indicator: the payer's EURC balance is public, so the supplier sees in real time whether the cheque would bounce before submitting.

**Why an AI would not default to it:** Default AIs reach for escrow/claimable balances when they hear "guarantee payment". This deliberately refuses to lock funds (the real SME constraint), uses a *bounce-able* instrument on purpose, and gets mutual exclusivity from sequence-number semantics rather than a contract. It also encodes a Portuguese statutory interest table and the 60-day legal cap, which requires knowing DL 62/2013.

**90-second demo:** Supplier "Padaria" sends a EUR 1,000 invoice. Buyer "Café" signs the cheque in one click; three faces appear with their windows. Supplier's dashboard shows "cash now for EUR 970 / wait for EUR 1,000 / after 30 Nov: EUR 1,008.40". Memorable moment: supplier clicks "cash early"; Face A lands on-chain; the UI then tries to submit Face C and Horizon rejects it with `tx_bad_seq` — "the other two faces just died". Second beat: a second cheque from an empty account bounces, and the failed transaction (op_underfunded) is visible on-chain as a permanent, timestamped record that the cheque was presented and bounced — something a paper cheque cannot do.

**Ecosystem effect:** Every cheque onboards *two* businesses (payer + payee need Stellar accounts and an EURC trustline), creates one sponsored account, and routes the full invoice amount through EURC. One café paying 10 suppliers monthly = 10 new merchant accounts and ~EUR 10–30k/month of EURC payment volume; growth is viral along supply chains because the supplier must hold a Stellar account to be paid.

**Buildability (15h):** Classic ops only, no Soroban required; JS SDK builds all three txs in ~100 lines; frontend = issue / inbox / cash. Testnet EURC substitute: issue our own "EURt" asset. Risks: Freighter signing three txs in a row is clunky (use one approval UX per face or a local key for the demo); sponsorship + merge sequencing needs testing; time windows must be compressed to minutes for the demo (time bounds are seconds, fine).

**Biggest weakness:** The euro on-ramp. Businesses need EURC; no Portuguese SEP-24 anchor was confirmed in this sprint. And bounce risk is unchanged from paper (by design) — judges may ask "why not escrow"; the answer (SMEs will not lock cash) must be in the pitch.

---

## Idea 2: "Assinatura Conjunta" — the pacto social as a signing policy

**Hook:** Many Portuguese Lda companies are legally bound only by two managers' joint signature; mirror the company's own articles of association as Stellar multisig thresholds and give the two gerentes a shared payment inbox with expiring, pre-signed transactions.

**User:** 2–3 partner micro-companies (two sócios-gerentes) whose pacto social requires joint signature, but whose bank account in practice is run by one person with full access because dual-approval banking is painful.

**Problem (evidence):** Joint-signature clauses are standard in Portuguese company charters, often with a value threshold ("above X requires both managers"); see registered charters in Diário da República, e.g. https://files.diariodarepublica.pt/2s/2006/11/222000e00/2614626147.pdf and the OCC model charter https://www.occ.pt/fotos/editor2/minutapactosocialsp.doc . Evidence on the *cost* of this (fraud by sole-access managers, disputes between partners) was not gathered in the time-box — this is the thin spot.

**Stellar mechanism:** Company account with signers = gerentes (weights 1 each), medium threshold 2 for payments, high threshold 2 for signer changes; routine small payments via a Soroban custom account (`__check_auth`) that passes single-signature below the charter's amount limit and requires both above it. Gerente 1 pre-signs with **time bounds** (expires Friday 18:00) so unsigned payments die automatically; the inbox is just the half-signed XDR.

**Why not AI-default:** The twist is binding the policy to a legal document (the pacto social) and the value-threshold rule, which plain multisig cannot express. But "multisig treasury" itself is a default idea; the differentiation is thin.

**90-second demo:** Upload the pacto social clause; the app sets thresholds; a supplier payment above the limit sits in the inbox, the second gerente approves from a phone, an unsigned one expires on screen.

**Ecosystem effect:** One company account per Lda (new accounts), EURC payments for approved invoices; modest volume, no network effect beyond the company.

**Buildability:** Medium — custom-account contract plus threshold setup in 15h is doable; UX of two wallets is fiddly.

**Biggest weakness:** Looks like a corporate multisig wallet with Portuguese branding; weak on Innovation and on the "owe each other money" seed.

---

## Idea 3: "À Consignação" — goods and money move in one transaction

**Hook:** Small producers who leave goods on consignment in Lisbon shops get paid only when the shop admits a sale; tokenise each consigned unit as a revocable, auth-required supplier asset so that every sale returns the unit and pays EURC in the same atomic transaction.

**User:** Local producers (wine, ceramics, cosmetics, books) and the small shops that take their stock on consignment.

**Problem (evidence):** On consignment the producer finances the stock until sold, bears the unsold/expiry risk, and — in Portugal — IVA is due when the goods are placed at the shop's disposal, i.e. before any cash arrives; payment depends on the shop's periodic "prestação de contas". https://www.doutorfinancas.pt/carreira-e-rendimentos/o-que-sao-vendas-a-consignacao/ . Hard numbers on disputes were not found in the time-box.

**Stellar mechanism:** Producer issues `UNIT-<sku>` with **AUTH_REQUIRED + AUTH_REVOCABLE + AUTH_CLAWBACK_ENABLED**; shop's trustline is authorised for the delivered quantity. A sale = one transaction with two ops: shop sends 1 UNIT back to the issuer (burn) and pays EURC to the producer; both or neither. Unsold/expired stock is recalled with **Clawback**. The producer's live inventory per shop is literally the trustline balance; the "prestação de contas" becomes a Horizon query.

**Why not AI-default:** Uses the asset-authorisation flags as an inventory-custody instrument rather than as a security/compliance token, and clawback as a physical recall. AIs default to "NFT receipts" (banned) or revenue-share splits.

**90-second demo:** Producer delivers 20 bottles → 20 UNIT in the shop's trustline. POS sale → one tx: UNIT goes back, EUR 12 EURC arrives, producer's dashboard ticks 19. Memorable moment: producer clicks "recall expired" and 5 units vanish from the shop's balance via clawback while the shop owner watches.

**Ecosystem effect:** One new asset per producer, a trustline per shop–producer pair, and EURC flowing at retail granularity (many small payments). Good breadth (many tiny merchants), low per-tx volume.

**Buildability:** Easy — classic issuance + flags + two-op transactions; 15h is ample.

**Biggest weakness:** Enforcement still depends on the shop recording the sale on-chain; the honesty assumption is unchanged. The Stellar asset is a shared ledger of inventory, not a guarantee.

---

## Idea 4: "Aval Digital" — the guarantor's cheque that can never double-pay

**Hook:** Supplier credit in Portugal routinely requires the sócio-gerente's personal guarantee (aval / livrança em branco); make the aval a fourth face of Idea 1's cheque, signed by the guarantor from a personal account and valid only after a grace period — and, because it shares the cheque's sequence number, it is automatically void the moment the company pays.

**User:** A supplier extending 30–60 day terms to a new or shaky Lda customer; the owner who today signs a blank promissory note.

**Problem:** Personal guarantees are pervasive in Portuguese SME credit, paper-based, and over-broad (a blank livrança can be filled in for any amount). Evidence not gathered in the time-box beyond the general practice; treat as anecdotal.

**Stellar mechanism:** Same cheque account as Idea 1; a fourth tx with the same seqNum whose Payment op source is the guarantor's account, minTime = due + 15 days, amount capped at invoice + statutory interest. **Extra signers** precondition can require the guarantor's signature on the company faces too. Sequence-number exclusivity guarantees that the guarantor pays only if nobody else did.

**Why not AI-default:** It is a precise fix for "livrança em branco" over-reach (amount and date are fixed in the signed XDR), a Portuguese-credit-culture artefact an AI would not reach for.

**90-second demo:** Company cheque bounces (visible failed tx); supplier waits for the grace window; submits the aval face; it clears from the owner's personal account. Then show that re-submitting the company face is now invalid.

**Ecosystem effect:** Adds the owner's personal account to Stellar; marginal on top of Idea 1.

**Buildability:** Trivial once Idea 1 exists (one more signed tx).

**Biggest weakness:** It is a feature of Idea 1, not a standalone product; standing alone it would be judged as "another guarantee scheme".

---

## Verdict

**Build Idea 1 ("Cheque Pré-Datado — one cheque, three faces"), with Idea 4 as the stretch feature if time allows.**

Why: it sits exactly on the human seed (businesses that owe each other and pay late), on a Portuguese instrument judges will not have seen (the post-dated cheque culture plus DL 62/2013 interest), and on a protocol trick — same-sequence-number mutual exclusivity + time bounds + sponsored reserves — that is "old-school assets, new tricks" for the Stellar Unlocked track, with no prior art in the Scout hackathon index. It refuses escrow for a defensible reason, which is itself the pitch. It is classic-ops-only, so it is the most buildable of the four, and it has two concrete demo moments (the other faces dying with `tx_bad_seq`; a bounced cheque recorded on-chain). On the new ecosystem criterion it ranks first as well: every cheque forces the payee onto Stellar, so adoption spreads along supply chains and the full invoice value flows through EURC.

Ranking after the ecosystem criterion: 1 (strong network effect, full invoice volume) > 3 (many small merchants and new assets, small volume) > 2 (accounts, little volume) > 4 (rides on 1).
