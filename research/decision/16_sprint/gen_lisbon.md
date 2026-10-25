# Lisbon seed: 4 ideas (gen_lisbon)

Seed focus: Lisbon's own communities and bureaucracy. Everything below avoids the banned list. Prior-art check: Scout `searchHackathonBuilds` found **no** Stellar hackathon builds for residence attestation/witness vouching, multi-party swap cycles via path payments, or tourist VAT refunds (queried 2026-10-25).

---

## 1. Testemunha: rate-limited, revocable witness tokens for the *atestado de residência*

**Hook:** In Lisbon two registered neighbours can swear you live somewhere. Today that signature sells for €10–60 outside the Junta, so we turn each neighbour's word into a scarce, revocable Stellar asset.

**Specific user:** The staff at a Lisbon Junta de Freguesia (e.g. Lumiar, Penha de França, Arroios) who issue *atestados de residência*. Second user: honest immigrants, mostly Brazilian and PALOP, who need the atestado for AIMA, school enrolment and the SNS. They now get treated as suspects.

**Problem, with evidence:**
- A Junta issues an atestado on the sworn word of two registered voters of the parish (*testemunhas*). Sábado documented paid fake witnesses waiting outside Juntas. One Brazilian couple paid €170 by **MB Way** in under a minute. In Lumiar, Junta staff admit it is "often the same people" signing. ([Sábado](https://www.sabado.pt/portugal/detalhe/imigracao-os-esquemas-das-falsas-testemunhas))
- Penha de França (Lisbon) court case: a network of intermediaries plus ~23 residents testified for addresses at €10–60 each. 25 defendants were convicted, including a Junta employee. ([RTP](https://www.rtp.pt/noticias/pais/penas-suspensas-para-rede-que-usava-moradas-falsas-para-legalizar-imigrantes_n1753517))
- In 2022 SEF investigated at least 3 Lisbon Juntas. Some addresses had **100+ atestados** issued. ([DNoticias/Expresso](https://www.dnoticias.pt/2022/9/1/326152-emissao-de-atestados-de-residencia-em-massa-em-lisboa-sob-investigacao-criminal/))
- Amadora: addresses used without the owners knowing. ([RTP](https://www.rtp.pt/noticias/pais/moradas-de-casas-na-amadora-usadas-a-revelia-dos-donos-para-imigrantes-obterem-certificados_n1702846))
- Porto's Bonfim Junta president said Juntas "have no legal competence to investigate". Some Juntas (Arroios, one in the Alentejo) responded by refusing non-EU applicants outright, and the Government criticised that. ([DN](https://www.dn.pt/sociedade/junta-no-alentejo-limita-emissao-de-atestado-de-residencia-a-cidadaos-extracomunitarios))

The root cause: there are 24 Lisbon Juntas and ~3,000 in Portugal, with no shared view of how often one witness has vouched, or how many people already claim one flat.

**Stellar mechanism (exact features):**
- Each Junta is an **asset issuer** with `AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED`. Asset `TESTEMUNHA` (one per Junta).
- When a voter registers as a witness, the Junta authorises their trustline and mints a yearly quota (e.g. 3 tokens). Scarcity is enforced by issuance, not policy.
- Vouching = the witness sends 1 token to the applicant's account. The **memo** carries a salted hash of the address (`hash(address‖salt)`). No personal data goes on chain.
- The applicant's trustline is authorised by the Junta. Two tokens from two different witnesses → atestado issued. The tokens stay on the applicant's account as the public proof.
- **Clawback** when fraud is found. Every atestado backed by that witness turns visibly invalid at once (AIMA can check this).
- Cross-Junta view: anyone (AIMA, another Junta) can count, from Horizon, how many vouches point at the same address hash across all Juntas' assets → the "100 people in one T2" alarm. This is the thing a per-Junta database cannot give without a national integration project.
- Optional: **sponsored reserves**. The Junta sponsors applicants' accounts, so an applicant needs zero XLM (a means, not the pitch).

**Why it's not AI-default:** It comes from a specific Portuguese legal quirk (*atestado com testemunhas*) that an AI doesn't connect to Stellar. It uses auth flags and clawback as a **rate limiter and a revocation cascade for human testimony**, not as money. It is not a "credential NFT": the scarcity is the point.

**90-second demo:**
1. A Junta clerk screen (Lumiar). Register Dona Fátima as a witness: trustline authorised, 3 tokens minted.
2. An applicant (Brazilian name) asks. Fátima and a second neighbour each tap "vouch" in the wallet → the applicant's atestado shows "2/2 ✓".
3. A fake witness tries a 4th vouch → `op_underfunded`. Quota gone. Then an address heat-map: "Rua X 12, 2º Esq: 47 vouches across 3 Juntas" turns red.
4. **Memorable moment:** the clerk presses "witness was paid" → clawback. On a live Stellar Expert view, 9 atestados across 3 Juntas flip from valid to revoked in one ledger.

**Buildability risks:** Low. Classic ops only (changeTrust, setTrustLineFlags, payment, clawback) plus a React clerk/witness UI and a Horizon query for the heat-map. No Soroban needed. Multi-issuer counting is a simple indexer over 2–3 testnet issuers.

**Biggest weakness:** Adoption needs Juntas, which are public bodies, and GDPR review. A clean witness account can still be bribed once. The quota limits scale but doesn't stop a single lie. It also helps less where the fraud is the Junta employee.

**Ecosystem effect:** Every applicant and every witness gets a real Stellar account. Portugal had ~400k pending AIMA processes in 2024 (well-known figure, but not re-verified here). Each Junta becomes an issuer. Growth path: 1 Junta → the 24 Lisbon Juntas → ANAFRE (the national association). This brings many accounts, but it adds no financial liquidity.

---

## 2. Troca: three-way job-placement swaps for displaced public servants, matched by the DEX

**Hook:** A teacher from Porto stuck in Lisbon, one from Lisbon stuck in Faro, one from Faro stuck in Porto. No pair can swap, but the Stellar DEX finds the triangle and executes all three moves in one atomic path payment.

**Specific user:** Career teachers in Portugal placed far from home (*professores deslocados*), especially those placed in Lisbon who can't afford Lisbon rent. The same pattern applies to PSP agents: most rookies from the north are sent to Lisbon.

**Problem, with evidence:**
- Lisbon rents are pushing displaced teachers out. In 2023 the state's affordable-housing scheme for displaced teachers had **388 applicants and only 15 selected for 11 flats** in Lisbon and Portimão. ([Observador](https://observador.pt/2023/09/27/apenas-15-professores-selecionados-para-11-casas-com-renda-acessivel/), [IHRU–DGAE protocol](https://portugal.gov.pt/gc23/comunicacao/comunicados/ihru-e-dgae-assinam-protocolo-para-garantir-habitacao-a-professores-deslocados))
- Teacher mobility is huge: 14,396 career teachers changed binding placement in the 2026/27 internal contest. ([Gov PT / DGAE results](https://portugal.gov.pt/pt/gc25/comunicacao/comunicados/mais-de-5-400-professores-colocados-nas-zonas-com-maior-carencia-de-docentes))
- The state is buying housing for displaced police in Lisbon (PSP bought 3 buildings for €20M; Gebalis gave 18 flats). ([DN](https://www.dn.pt/sociedade/psp-comprou-por-20-milhoes-tres-imoveis-para-alojamento-de-novos-agentes-15588935.html), [ECO](https://eco.sapo.pt/2023/03/29/camara-de-lisboa-aprova-acordo-que-disponibiliza-18-casas-a-polícias/))
- ⚠️ **Unverified:** I believe the Teachers' Career Statute (ECD, art. 64) lists *permuta* (swap) as a mobility instrument, but I could not confirm the current procedure in the time box. Swaps today are informal, pairwise, and found through Facebook groups (not verified).

**Stellar mechanism (exact features):**
- The authority (DGAE-like) issues one **asset per placement zone + subject group**, e.g. `G300QZP07` (asset codes go up to 12 characters). It uses `AUTH_REQUIRED`, so only verified teachers can hold one. Each teacher holds exactly 1 unit of their current placement.
- A teacher wanting to move places a **DEX offer**: sell 1 `G300QZP07` (Lisbon), buy 1 `G300QZP01` (Porto), price 1:1.
- Anyone whose offer closes a cycle submits a **path payment strict send** to themselves: send `LX`, receive `PORTO`, path `[FARO]`. It consumes the other two offers. All three placements move atomically, or none do. Stellar considers paths of length ≤5, so up to 6-way cycles work. ([docs](https://developers.stellar.org/docs/data/apis/horizon/api-reference/errors/result-codes/operation-specific/path-payment-strict-receive))
- Horizon `/paths/strict-send` *is* the cycle finder, so no matching algorithm has to be written.
- **Clawback / revocable** lets the authority unwind or block an ineligible swap. Placement tokens can't go to unverified accounts.

**Why it's not AI-default:** It treats the order book as a **kidney-exchange-style cycle finder for jobs**, with path payments as atomic n-way barter. That matches the organisers' "old-school assets, new tricks: DEX/path payments for unexpected uses" almost word for word. The Portuguese *professor deslocado* pain is local knowledge.

**90-second demo:** Three teacher cards on a map of Portugal (Ana in Lisbon wants Porto, Rui in Porto wants Faro, Inês in Faro wants Lisbon). Each places an offer. The "no direct match" banner shows. The fourth click runs the path payment: **one transaction hash, three arrows on the map flip at once**, and the Stellar Expert trades tab shows 2 offer fills.

**Buildability risks:** Low to medium. Classic ops only. Edge cases: precision (use 1 unit, or 0.0000001 stroop units), and offers need trustlines for the buy-side asset (authorise in advance). Path-finding over illiquid 1-unit books works on testnet but needs a check in hour 1.

**Biggest weakness:** The legal basis for swaps is unverified, and the ministry would have to be the issuer, so adoption is government-gated. Is the DEX needed rather than a cycle-finding algorithm in a database? The honest answer is "atomic, auditable, nobody can jump the queue", which is weaker than in money use cases.

**Ecosystem effect:** Accounts for public servants (on the order of 10k+ movers per year in teaching alone), and hundreds of new zone assets with real DEX order-book activity. It adds no money liquidity. Growth: teachers → PSP/GNR → nurses (SNS).

---

## 3. Isento: tourist VAT refunds as a frozen asset that customs "unfreezes", paid out via path payment in the tourist's own currency

**Hook:** A Brazilian tourist on Rua Augusta gets a VAT-refund token that is frozen until the airport kiosk shows green. Then it's sold on the DEX straight into their own stablecoin, with no counter queue and no ~40% cut.

**Specific user:** Non-EU tourists shopping in Lisbon (Brazil and the US are top markets) and the small Chiado and Baixa shops that want tax-free shoppers but find operator onboarding heavy.

**Problem, with evidence:**
- Portugal's VAT is 23%, but tourists typically net **12–16%** of the price after refund-operator fees. That means the operators keep roughly a third or more of the VAT. ([Celina Tours guide](https://celina-tours.com/blog/en/shopping-in-lisbon-how-the-tax-free-system-works/), [Extrabux](https://extrabux.com/chs/guide/8231859). These are blog estimates, not official rates.)
- Validation is already digital (e-Taxfree kiosks at LIS show green or red). The *payment* is still a counter queue or a card refund days later. One complaint reports Global Blue demanding a card deposit before paying. ([withprive](https://www.withprive.com/en/blog/vat-refund-lisbon-airport), [Portal da Queixa](https://portaldaqueixa.com/brands/global-blue/complaints/global-blue-caucao-retirada-indevida-39239920))

**Stellar mechanism (exact features):**
- The shop (or a refund agent) issues `VATLX` with `AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED`. At purchase, the tourist gets `VAT` equal to the refund amount, with the trustline set to **authorized-to-maintain-liabilities**, i.e. frozen.
- Kiosk green light = the customs-validator key, a **co-signer on the issuer via a multisig threshold**, calls `setTrustLineFlags` → fully authorised. Red = **clawback**. The authorisation flags *are* the customs state machine.
- The tourist runs a **path payment strict send**: `VATLX → EURC → USDC/BRL stablecoin` against the shop's standing redemption offer (VATLX/EURC at 1:1) plus DEX liquidity. This creates new trading pairs and volume.
- No escrow: no funds are locked until validation. The shop redeems from operating cash, as today.

**Why it's not AI-default:** It uses the trustline authorization flags as a **customs gate**, not a compliance afterthought, inside a flow everyone in Lisbon tourism knows and no AI suggests. It's not invoice tokenization: the claim is a tax refund whose validity changes state from a third-party signer.

**90-second demo:** Buy a €200 azulejo at a "shop" → the phone shows 30.27 VATLX 🔒. Cut to an "airport kiosk" page → green → the lock opens live. Tap "receive in BRL" → path payment → R$ lands. **Memorable moment:** the receipt shows "Your refund: €37.40 · Operator fee: €0" against a split-screen of "typical: €26".

**Buildability risks:** Medium. You need testnet EURC/USDC (or self-issued mocks) and seeded DEX liquidity for the path. Auth-flag toggling is simple. Faking the customs signer is fine for a demo.

**Biggest weakness:** This is a regulated flow. Customs (AT) and licensed operators own it, and AT won't sign a hackathon key. It is the closest of the four to "RWA/receivable tokenization", so a judge may see it as a twin. It also has the thinnest human seed for this team.

**Ecosystem effect:** The **strongest of the four** for liquidity: real merchants issuing assets, tourists onboarded on arrival with stablecoins in hand, new VATLX/EURC/BRL pairs and payment volume each tourist season. Growth: Lisbon retail → Porto → any EU tax-free country.

---

## 4. Gorjeta: card tips that bypass the owner, paid straight into a staff tip pool (tronc)

**Hook:** Tips left by card in Lisbon's tourist restaurants land in the owner's account. Gorjeta routes them to a staff-owned pool the owner cannot touch.

**Specific user:** Waiters and kitchen staff in Baixa, Alfama and Bairro Alto restaurants with heavy tourist (card-tipping) traffic.

**Problem, with evidence:** Tips are taxable employment income in Portugal and must go through payslips ([e-konomista](https://www.e-konomista.pt/gorjetas-imposto/), [DECO](https://www.deco.proteste.pt/familia-consumo/ferias-lazer/noticias/como-funcionam-gorjetas-em-portugal)). The sector is still asking for clearer rules. ⚠️ I found **no solid evidence of systematic owner skimming** in the time box. This is anecdote only, so evidence is weak.

**Stellar mechanism:** A tip QR (SEP-7) pays an account whose **multisig** signers are the staff (owner weight 0). Distribution is a pre-agreed split (Soroban), and the payslip export is for the tax side. Path payments let tourists tip from USDC.

**Why it's not AI-default:** Not much. It sits next to split-bill and payroll, which are banned.

**90-second demo:** A tourist scans the QR, tips €5 in USDC → the pool shows it → the owner tries to withdraw → `tx_bad_auth`.

**Buildability risks:** Low.

**Biggest weakness:** The evidence is weak and it is close to banned categories. Owners have no reason to adopt it. **Included for completeness. I would drop it.**

**Ecosystem effect:** Restaurant staff accounts and small USDC tip volume. Modest.

---

## Ranking (with the "more users / more liquidity" criterion)

| # | Idea | Real pain evidence | Stellar essential | Not-AI-default | Ecosystem effect | Buildable |
|---|---|---|---|---|---|---|
| 1 | Testemunha | ★★★ (court case, Sábado, SEF) | ★★ (multi-issuer + clawback cascade) | ★★★ | ★★ (accounts, no liquidity) | ★★★ |
| 3 | Isento | ★★ (blog fee data) | ★★★ (auth flags + path payment) | ★★ | ★★★ (merchants, pairs, volume) | ★★ |
| 2 | Troca | ★★ (housing yes, swap law unverified) | ★★★ (DEX as cycle finder) | ★★★ | ★★ (accounts + DEX activity) | ★★ |
| 4 | Gorjeta | ★ | ★ | ★ | ★ | ★★★ |

## Best pick: **Testemunha**

It has the strongest *local, evidenced* human story: paid witnesses taking MB Way payments in front of the Junta, and a Lisbon court conviction. A Lisbon judge has read these headlines. It uses old-school protocol features (issuance, auth flags, clawback, memos) in a genuinely unexpected role, a rate limiter and revocation cascade for sworn testimony, which fits "Stellar Unlocked". It is the cheapest to build (classic ops, no Soroban), and the clawback cascade is a memorable demo moment. Its weakness is government adoption and zero liquidity.

If the team weights the new liquidity criterion above everything else, **Isento** is the alternative. It is the only one that creates real money pairs and merchant volume, at the cost of a thinner human seed and some twin risk.
