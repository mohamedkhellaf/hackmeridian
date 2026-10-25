# 01 — Problem Hunter (Agent 1, blind phase)

Lens: painful, underserved problems in money, trust and coordination where a shared, neutral ledger with programmable custody is the *product*, not decoration. All four concepts move a stablecoin (USDC on Stellar) through a Soroban contract that holds funds which no single party, including us, can unilaterally take. That is the common "why chain" argument; each concept adds its own.

Sources are listed per concept. Anything not checked is marked **UNVERIFIED**.

---

## Concept 1: KeyHold — tenant deposits that neither side can grab

**Pitch:** A rental security deposit held in a Soroban escrow instead of the landlord's bank account, released by mutual sign-off, with a clear timeout and an arbiter path, so "the landlord kept my deposit" stops being the default outcome.

**User:** Ana, a 27-year-old Brazilian designer renting a T1 in Lisbon (Arroios) for €1,300/month. She paid 2 months' deposit (€2,600) plus rent in advance to a private landlord. Second user: a small landlord with 2–3 units who wants a deposit but not the dispute.

**Problem:**
- In Portugal the deposit (caução) amount is set by contract with no legal cap, and it is returned at nominal value, so the landlord keeps any interest earned ([The Portugal News](https://amp.theportugalnews.com/ar/nieuws/2023-01-12/what-you-need-to-know-before-renting-a-home-in-portugal/73781), [Economia & Finanças](https://economiafinancas.com/?p=89013)).
- Withheld deposits show up repeatedly in complaint channels: DECO Proteste ([1](https://www.deco.proteste.pt/reclamar/todas-as-reclamacoes/fraudulent-withholding-of-depo/35c0e9a31074617d49), [2](https://www.deco.proteste.pt/reclamar/todas-as-reclamacoes/unrefunded-security-deposit-E2-80-93-/3c4c0def2b0543e74f)), Portal da Queixa (e.g. [Blueground, €2,476 retained](https://portaldaqueixa.com/brands/blueground/complaints/blueground-retention-of-the-amount-of-the-deposit-of2476-after-termination-of-the-lease-158192426)), and [expat forums](https://www.expat.com/en/forum/europe/portugal/999493-landlord-not-returning-deposit.html).
- How tenants cope today: letters threatening default interest, a lawyer, or the Julgado de Paz small-claims court. Forum advice is to weigh lawyer fees against the amount owed, which often means giving up. Expats who are leaving the country have even less leverage.
- Contrast: England and Wales *require* deposits to sit in a government-backed protection scheme with free dispute resolution, and only about 1.3% of the roughly 7M protected deposits went to formal adjudication ([Landlord Today](https://www.landlordtoday.co.uk/news_features/Just-one-in-a-hundred-deposits-end-in-formal-dispute)). Neutral custody plus a clear process works. I found no equivalent statutory custodial scheme in Portugal (**UNVERIFIED**: needs a legal check).

**MVP (about 20h, 3 devs):**
- Soroban `deposit_escrow` contract with parties (tenant, landlord, optional arbiter), amount, lease end date and release window.
- At move-out, either side proposes a split (for example €2,300 / €300 for a damaged fridge). The other side accepts, which pays out at once, or counter-proposes.
- If nobody acts within N days after the lease ends, the funds default to the tenant (the burden of claiming falls on the landlord, mirroring UK practice). On a dispute, the arbiter can sign a split.
- React app with Freighter: create a lease, fund it with testnet USDC, use a move-out screen with photo evidence (store hashes on-chain and files off-chain), and view a timeline.
- Stretch: park the deposit in a yield source and give the interest to the tenant. Skip this unless time allows.

**Stellar integration:** Soroban custody contract; USDC through the Stellar Asset Contract; ledger timestamps for the timeout; auth (`require_auth`) for the multi-party split; cheap fees, so a €2 dispute is not eaten by gas. Why a chain: the core value is that *neither landlord, tenant nor the platform* can move the money unilaterally, and both can audit it. A custodial fintech can only make that promise legally. Here the code enforces it, which matters in a market with no statutory scheme. Fiat on- and off-ramp via SEP-24 anchors or MoneyGram is a pitch point, not part of the MVP.

**Differentiation:** UK schemes (TDS, DPS, MyDeposits) are statutory, UK-only and run by custodians. Deposit-replacement insurance (Reposit, Zero Deposit, flatfair) charges the tenant a non-refundable fee, around one week's rent for Reposit ([August comparison](https://www.augustapp.com/blog/zero-deposit-vs-flatfair-vs-reposit)), and does not protect the tenant at all. Generic escrow such as Trustless Work on Stellar ([docs](https://docs.trustlesswork.com/trustless-work)) is infrastructure, not a rental product. KeyHold could be built *on* it (Stellar Composed angle).

**90-second demo moment:** Split screen with the landlord in one browser and Ana in the other. The lease ends and the landlord claims €900 for "repainting". Ana counter-proposes €150 with move-in photos. The landlord goes silent, the clock is fast-forwarded, and the contract auto-returns €2,450 to Ana's wallet. Show the stellar.expert transaction: nobody pressed a "refund" button.

**Biggest uncertainty:** Two-sided adoption. Landlords hold the power in a tight Lisbon market and have little reason to opt in. The likely wedge is to sell to landlords and agencies as "no-dispute deposits", or to student housing and relocation firms. Legal status of an on-chain caução is **UNVERIFIED**.

**Verified vs assumed:** Verified: no cap, nominal return, complaints exist, UK scheme adjudication rate. Assumed: how often Portuguese deposits are withheld (no stat found), and landlord willingness to adopt.

---

## Concept 2: Roda — savings circles that can't be run off with

**Pitch:** A rotating savings circle (ROSCA: ajo, esusu, susu, tandas, gam'eya) run by a Soroban contract: members lock a small collateral, contributions are pulled each round, the pot pays out automatically in order, and a member who takes the pot and stops paying loses collateral and reputation.

**User:** Funmi, a Nigerian nurse in Lisbon or London who runs an "ajo" with 10 colleagues over WhatsApp: €200/month each, one member gets €2,000 each month. She is the treasurer: she chases late payers, holds the cash in her personal account, and bears the social risk if someone disappears after their payout.

**Problem:**
- The structural flaw is well studied: members who receive the pot early have an incentive to stop contributing. Groups survive through social sanctions or exclusion ([Kobe Univ. DP2015-31](https://www.rieb.kobe-u.ac.jp/academic/ra/dp/English/DP2015-31.pdf)). Early receivers with weak social ties raise default risk ([Taiwan bidding-ROSCA study](https://figshare.com/articles/ROSCA_Composition_and_Repayment_Evidence_from_Taiwanese_Bidding_ROSCAs/5117500)). Groups run by a single president are more prone to collapse ([Benin study](https://core.ac.uk/outputs/7310857)).
- Demand is proven at scale: MoneyFellows (Egypt) digitised money circles, reports more than 8.5M users, and has raised over $60M including a $13M pre-Series C in 2025 ([MEA TechWatch](https://meatechwatch.com/2025/05/06/moneyfellows-raises-13-million-to-expand-digital-rosca-model-across-africa-and-beyond/), [TechCrunch 2022](https://techcrunch.com/2022/10/31/money-fellows-an-egyptian-fintech-digitizing-money-circles-raises-31m-funding)).
- How people cope today: WhatsApp, a trusted treasurer's bank account, a spreadsheet, and social pressure. This does not work across borders (diaspora members in different countries) or among people who don't know each other well.

**MVP:**
- Soroban `circle` contract: create (members, amount, period, payout order, collateral %), join with collateral deposit, `contribute(round)`, `payout(round)` callable by anyone once the round is fully funded or past deadline.
- On a missed deadline, the defaulter's collateral covers the shortfall, the member is flagged, and the pot still pays.
- An on-chain record of completed circles per address gives portable "saver reputation".
- React app: create a circle, share an invite link, a round dashboard ("7/10 paid, 2 days left"), and a payout history.

**Stellar integration:** Soroban holds the pot and collateral and enforces order and penalties. USDC SAC means a euro-area member and a Lagos member join the same circle without FX on both legs. Sub-cent fees allow €20 circles. Reputation lives on-chain and is portable across apps. Pitch path: MoneyGram or anchors for cash in and out. Why a chain: the treasurer problem *is* a custody-and-trust problem. Code replaces the person who could run off, and cross-border membership needs a shared neutral rail.

**Differentiation:** MoneyFellows is custodial, Egypt and MENA focused, and single-country fiat. Informal WhatsApp circles have no enforcement. Brazil's consórcio is a regulated, administrator-run product with fees (**UNVERIFIED** detail). Roda is non-custodial, cross-border, with collateral-backed enforcement and portable reputation.

**90-second demo moment:** A 4-member circle on testnet. Rounds 1–2 pay out automatically. Member 1 (already paid out) misses round 3, the deadline passes, anyone triggers payout, collateral is slashed, the round-3 recipient still gets the full pot, and the defaulter's profile turns red. "The treasurer is now a smart contract."

**Biggest uncertainty:** Collateral weakens the economics. Full protection needs collateral close to the remaining obligation, which defeats the "credit" benefit for early receivers. The MVP would use partial collateral plus reputation; how good that is in practice is **UNVERIFIED**. Crypto onboarding for non-crypto users is also a hurdle; passkey smart wallets would help.

**Verified vs assumed:** Verified: the default-incentive literature and MoneyFellows' scale and funding. Assumed: diaspora circles want cross-border, and that partial collateral plus reputation is enough deterrent. I found no reliable global participant count.

---

## Concept 3: Earmark — remittances that arrive as a paid bill, not cash

**Pitch:** Diaspora senders fund a specific purpose (school term fees, pharmacy, rent) with USDC that can only be redeemed by a verified payee (the school or clinic). The payee confirms delivery, and the sender sees proof, all at a fraction of money-transfer-operator cost.

**User:** Carlos, a Cape Verdean or Angolan construction worker in Lisbon (or a Nigerian in London) who sends €150/month home. Every September he also sends €400 "for school fees" and is never sure it reached the school. Second user: the school bursar, who wants fees on time.

**Problem:**
- Cost: the global average cost of sending $200 was 6.49% in Q1 2025, against a G20 target of 5% ([World Bank RPW Q1 2025](https://remittanceprices.worldbank.org/sites/default/files/rpw_main_report_and_annex_q125_1_0.pdf)).
- Purpose: education is a top use of remittances. 31.4% of Kenyan recipient households spend on school fees ([KNBS via People Daily](https://peopledaily.digital/business/kenyan-families-spend-diaspora-money-mostly-on-food-education-and-hospital-bills-knbs/amp)). Diaspora media advise paying the school directly because school-fee requests are sometimes scams ([Techeconomy](https://www.techeconomy.ng/nigerians-in-diaspora-how-to-pay-school-fees-safely)).
- Key evidence: in an RCT, Filipino migrants in Italy sent **more than 15% more** when remittances were *labelled* for education ([J-PAL / IPA](https://www.povertyactionlab.org/print/pdf/node/1937?lang=en)). Senders value control and earmarking. Note that in the same study, direct payment to the school added only about 2.2% more on top, so the pitch should lead with *earmarking plus proof*, not just direct pay.
- How people cope today: Western Union, Wise or WorldRemit cash to a relative, then WhatsApp photos of receipts, or bank transfer to the school where the school has an account.

**MVP:**
- Soroban `earmark` contract: sender locks USDC with (payee address, purpose, expiry). The payee claims, and on expiry funds revert to the sender or fall back to the relative.
- Payee registry: an admin-verified list of schools and clinics (centralised for the MVP, honestly stated).
- Optional split: x% earmarked, the rest free cash to the relative.
- The payee claims and attaches a receipt hash, and the sender gets a "Paid: Escola Secundária X, term 1" proof page.
- Stretch: off-ramp via a SEP-24 anchor or MoneyGram cash-out on testnet.

**Stellar integration:** USDC SAC; Soroban conditional custody (payee-restricted, time-bounded); claimable balances are a lighter-weight alternative primitive; SEP-24 and anchors for local-currency cash-out; MoneyGram's Stellar cash-out network is already used by UNHCR's Stellar Aid Assist ([Stellar case study](https://stellar.org/case-studies/unhcr)). Why a chain: conditional, revocable, auditable value transfer across borders and between unrelated institutions, with a public proof the sender can verify without trusting the intermediary. This is also a strong "Stellar Composed" story (Soroban + USDC + anchors/MoneyGram + possibly the Stellar Disbursement Platform).

**Differentiation:** Western Union, Wise and WorldRemit move cash, not purpose. Some MTOs offer bill-pay in certain corridors (**UNVERIFIED** scope). Stellar Aid Assist and SDP serve NGO-to-beneficiary aid, not person-to-merchant earmarking. EduRemesa-style pilots were bank-run and corridor-specific.

**90-second demo moment:** Carlos in Lisbon sends €400 earmarked "Term 1 fees – Escola X" plus €50 free cash to his sister. The school's dashboard shows an incoming earmark and the bursar claims it. Carlos's phone flips to "Delivered to Escola X ✓" with the transaction link. Then a second earmark that the payee never claims expires and auto-refunds.

**Biggest uncertainty:** The payee side. Schools and clinics in Cabo Verde, Angola or Nigeria must hold a Stellar wallet and cash out locally. Anchor coverage in those corridors is **UNVERIFIED** (I could not confirm a live BRL or Pix Stellar anchor either). Without payee off-ramps it is a demo, not a product.

**Verified vs assumed:** Verified: remittance cost, the labelling RCT result, education spend share (Kenya), and the existence of the MoneyGram/Stellar cash-out network. Assumed: payee willingness, and anchor availability in target corridors.

---

## Concept 4: Silence Is Consent — milestone escrow for freelancers where the client's silence pays you

**Pitch:** Before work starts, the client funds a milestone escrow. When the freelancer delivers, the client has N days to approve or dispute, and *if they do nothing, the funds release to the freelancer automatically*, removing late payment without Upwork's take rate.

**User:** Rafael, a Brazilian full-stack freelancer in Lisbon on recibos verdes, invoicing a US startup and a German agency for €3–8k projects. He has been paid 45–90 days late before and once chased an unpaid €2,500 invoice for months.

**Problem:**
- In IPSE's Q1 2024 survey, 32% of UK freelancers had a payment delayed in the last 12 months, and 18% of those waited more than 3 months past the deadline ([IPSE](https://www.ipse.co.uk/policy/research/financial-wellbeing/late-payment-within-the-self-employed-sector.html)). 49% are concerned about late payment ([HR Director](https://thehrdirector.com/business-news/pay_and_reward/freelancers-crippled-by-late-payments)). Dutch data: 19% of freelancers sometimes face financial hardship from late payment ([NL Times](https://nltimes.nl/node/84053)). No EU-wide figure found.
- The marketplace fix (Upwork escrow) costs a variable 0–15% freelancer fee since May 2025, plus 3–10% on the client side, per third-party breakdowns ([goLance](https://golance.com/blogs/upwork-fees-explained-2026)) (**UNVERIFIED** against Upwork's own pages). It also only works inside the marketplace, so off-platform clients get no protection.
- How people cope today: deposits upfront (clients resist), chasing emails, late-payment interest they never enforce, and factoring or collections at a cost.

**MVP:**
- Simplest path: compose with Trustless Work's open-source Soroban escrow (milestones, approvals, roles) via its API or React SDK ([docs](https://docs.trustlesswork.com/trustless-work/technology-overview)), adding our own thin "auto-release after N days" logic, or fork the contract if their roles don't support timeout release (**UNVERIFIED** whether it supports this natively).
- Freelancer creates a contract link with milestones, and the client funds in USDC (pitch fiat on-ramp via anchor).
- Freelancer marks a milestone delivered (deliverable hash), which starts the review clock. The client then approves, disputes (funds freeze and go to an arbiter), or lets the clock expire, which releases the funds.
- A shareable "verified payment record" page doubles as freelancer reputation.

**Stellar integration:** Soroban custody plus timeout; USDC SAC; about 5-second finality and negligible fees, so a €300 milestone isn't eaten by fees; composes with Trustless Work (a Stellar ecosystem project), giving a clear Stellar Composed track fit. Why a chain: a client-funded, freelancer-protected pot that neither party nor a platform controls, across jurisdictions with no shared court. The timeout rule is enforced by code, not by a platform's discretion.

**Differentiation:** Upwork and Fiverr are walled gardens with 10%+ effective take. Escrow.com is a slow, high-fee legacy service (**UNVERIFIED** fees). Invoicing tools (Invoice Ninja, Wave, Request Finance) send invoices but don't guarantee funds exist. Trustless Work is infrastructure, while this is the freelancer-facing product with a default-to-worker rule.

**90-second demo moment:** Rafael creates a 2-milestone contract and the client funds €4,000. Rafael delivers milestone 1, the client approves, and €2,000 lands instantly. He delivers milestone 2 and the client ghosts. Fast-forward 7 days and the funds release to Rafael automatically. Overlay: "Upwork would have taken ~€400. We took €0.0001 in network fees."

**Biggest uncertainty:** Will clients pre-fund? Pre-funding is the whole mechanism, and clients with leverage refuse. It is also the most crowded space of the four (Trustless Work's own demos, many hackathon escrow apps), so it risks reading as "yet another escrow".

**Verified vs assumed:** Verified: IPSE stats, Upwork fee structure (secondary source), Trustless Work's existence and features. Assumed: client willingness to pre-fund, and the Trustless Work timeout capability.

---

## My own ranking of my 4 and why

1. **Roda (savings circles).** It solves the strongest *native* trust problem: the treasurer who can run off is exactly what a contract replaces, so blockchain is clearly not decorative. MoneyFellows proves huge demand (more than 8.5M users) for a custodial version, academic literature documents the default problem, and the cross-border diaspora angle needs a global stablecoin rail. It is self-contained (no off-chain counterparty like a school or landlord needs to exist), so the demo is fully real on testnet. The default-and-slash moment is visceral, and it is the most novel of the four for judges.
2. **KeyHold (rental deposits).** A very relatable, Lisbon-local pain judges will feel, and the "silence pays the tenant" demo is strong. The risk is that landlord adoption is a go-to-market problem, not a tech one, and it overlaps mechanically with Concept 4.
3. **Earmark (purpose-bound remittances).** Has the best evidence (RCT: labelling raises remittances by more than 15%) and the best Stellar Composed story (anchors, MoneyGram, SDP). But its real-world viability depends on payee off-ramps that I couldn't verify, and remittances are the most "expected" Stellar pitch.
4. **Silence Is Consent (freelancer escrow).** The pain is real and documented, but it is the most crowded space and the least novel. It is useful mainly as a fallback or as a module reused inside #2.

Cross-cutting note for the committee: Concepts 1, 2 and 4 share one Soroban pattern: custody, rules, a timeout default, and multi-party auth. Whichever we pick, the contract core is small (about 200–400 lines of Rust), which suits a team new to Soroban.
