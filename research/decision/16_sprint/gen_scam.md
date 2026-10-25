# Seed: the "Olá mãe / Hi Mum" target. Ideas from the whole scam ecosystem

Lens: I left the sender's wallet alone (guardian/undo is banned) and looked at four other points in the scam: **where the money goes** (mule fan-out), **who knows first** (people who were targeted but didn't pay), **what happens after** (restitution, and the recovery scams that follow), and **"it's really me"** (number changes).

## Shared evidence (all real, linked)

- PSP (Portuguese police): **4,389 "Olá pai/Olá mãe" complaints in 2023 and 260 in Jan 2024**, mostly on WhatsApp. Its advice is to call the old number. [Observador](https://observador.pt/2024/02/08/psp-recebeu-em-janeiro-260-denuncias-relativas-a-burla-ola-pai-ola-mae/), [CM](https://www.cmjornal.pt/portugal/detalhe/psp-recebeu-em-janeiro-260-denuncias-relativas-a-burla-ola-pai-ola-mae)
- PSP: about **13 victims a day**, paid "frequently via MB WAY" [Postal, Jan 2024](https://postal.pt/nacional/burla-ola-pai-ola-mae-faz-13-vitimas-diarias-em-portugal-veja-como-se-proteger/). PSP also tells people to **report even failed attempts** [RR, Nov 2024](https://rr.pt/noticia/pais/2024/11/24/psp-alerta-conheca-as-nove-burlas-por-telefone-mais-utilizadas-pelos-criminosos/402848/).
- **Cash-out uses mule fan-out.** Matosinhos, Sept 2025: one woman "opened and used about **20 bank accounts** to receive and dissipate" the proceeds of about **three dozen victims** (crimes from 2022–23, arrest in 2025) [RR](https://rr.pt/noticia/pais/2025/09/11/mulher-detida-em-matosinhos-por-burla-ola-pai-ola-mae/439418/). Leiria court case: 41 victims, about €110k, and a defendant who said he "didn't know it was fraud" (a mule) [RR, Apr 2025](https://rr.pt/noticia/pais/2025/04/10/arguido-das-burlas-ola-pai-ola-mae-disse-ao-tribunal-desconhecer-ser-fraude/421086/). PJ arrests are usually traced **through the receiving bank account** [DN](https://www.dn.pt/sociedade/pj-deteve-jovem-de-leiria-suspeito-de-burlas-ola-mae-ou-ola-pai-pelo-whatsapp-15290698.html).
- **The regulation now puts cost on banks.** In the EU PSR/PSD3 deal (27 Nov 2025), PSPs must **share fraud information with each other**, check that payee name and IBAN match, and refund certain impersonation frauds [EP press release](https://www.europarl.europa.eu/news/en/press-room/20251121IPR31540/payment-services-deal-more-protection-from-online-fraud-and-hidden-fees), [Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2025/11/eu-lawmakers-strike-a-deal-on-payments-reforms). In the UK, refunds are split **50:50 between the sending bank and the RECEIVING bank**, with £173m reimbursed in year one [bratby.law](https://bratby.law/app-fraud-reimbursement-cross-sector-liability/). In H1 2024, receiving PSPs handled 48% of fraud by count but only 10% of volume [PSR data](https://www.psr.org.uk/media/b50p3mlm/psr-2024-app-scam-performance-data-february-2026.pdf).
- **After the money is gone, victims get scammed again.** UK Action Fraud recorded 5,553 recovery-scam reports and **£185m** lost, Nov 2024 to Nov 2025. Which? found fake "recovery firms" on Trustpilot [Bitdefender/Which?](https://www.bitdefender.com/en-au/blog/hotforsecurity/uk-consumer-watchdog-warns-of-recovery-fraud-targeting-scam-victims-on-trustpilot), [IDCARE](https://www.idcare.org/learning-centre/newsletters/recovery-scams-a-growing-threat-for-scam-victims).
- **Stellar prior art (Scout):** only "Stellarscam.report", which collects reports of *crypto* scam sites, and Blockaid, which does wallet threat detection. No mule-tracing, liability-timestamp or restitution-claim builds came up.

---

## 1. RASTO: follow the mule fan-out and claw back every hop in one ledger close

- **Hook:** On bank rails, splitting Mum's €900 across 20 mule accounts takes two years to unwind. On a Stellar euro, the issuer follows the hops and claws back the tainted amount from each one in a single 5-second transaction.
- **User:** The buyer is the fraud/compliance team at a euro e-money issuer or anchor (EMI/PSP) that will carry impersonation-refund and shared-liability costs under PSR. The beneficiary is the mother who reports the scam.
- **Problem and evidence:** Mules fragment funds fast (Matosinhos: 20 accounts, about 36 victims, arrest 2–3 years later). Under PSR (EU) and the 50:50 split (UK), PSPs carry the loss. They have no rail where dissipated money can actually be recovered.
- **Stellar mechanism (exact):**
  - Issue a euro asset with `AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED` (clawback is only possible on trustlines created after that flag is set; docs: [clawbacks](https://developers.stellar.org/docs/build/guides/transactions/clawbacks), [asset flags](https://developers.stellar.org/docs/tokens/control-asset-access)).
  - A tracer reads the Horizon payments/effects graph from the scam transaction forward. It applies a legal taint rule (pro-rata haircut or "lowest intermediate balance", the rule courts use for tracing mixed funds).
  - One atomic transaction of up to 100 ops does three things. `SetTrustLineFlags` freezes every tainted account (removing authorization also pulls any open DEX offers). `Clawback` takes exactly the tainted share from each hop, plus `ClawbackClaimableBalance` if a mule parked funds in one. `Payment` re-issues the recovered euros to Mum.
  - Optional Soroban: a "case" contract records the report, the trace and the restitution as events, giving an auditable trail for the police (PJ).
- **Why it's not an AI default:** AIs reach for clawback on the *sender's* side ("undo"). This is *receiver-side forensic recovery across N hops*, built on legal tracing doctrine and driven by the new liability regime, and the idea comes from reading how the real Matosinhos mule network moved money.
- **90-second demo:**
  1. Mum gets "Olá mãe, novo número…" and sends 900 EURT.
  2. A script splits it in seconds: Mule1 sends €300 to each of Mule2–4, and Mule3 starts an anchor withdrawal.
  3. Mum taps **"Fui burlada"**.
  4. **Memorable moment:** a live graph lights up red hop by hop. One transaction lands, every node shows "frozen", and the counter reads **"€900 recovered from 4 accounts in 1 ledger (5s)"**. Mule3's cash-out fails live with `op_not_authorized`.
  5. Closing contrast slide: "Matosinhos: 20 accounts, 3 years."
- **Buildability:** High. Classic operations only (JS SDK) plus a Horizon graph walk and a D3/vis graph. The Soroban case log is optional. The fan-out is scripted on testnet.
- **Risks:** Getting the taint math right with mixed balances (keep one rule and show it). Explaining the scope of clawback flags. Making sure the demo accounts are created after the flags are set.
- **Biggest weakness:** Today Olá mãe money moves over MB Way/SEPA, not Stellar, so this only helps once P2P euros settle on a Stellar asset. A second gap: a mule who swaps on the **DEX into XLM** before the freeze passes the taint to an innocent market maker, and the trail stops. Mitigation is `AUTH_REQUIRED` with KYC'd trustlines, plus speed. We should say both openly.
- **Ecosystem effect:** It gives regulated euro issuers and EMIs a concrete compliance reason to issue on Stellar: a rail where impersonation losses can be recovered lowers their PSR liability. That brings a new euro asset, KYC'd P2P accounts (each user is a new trustline), and EURT/XLM and EURT/USDC volume. Growth follows issuer adoption, so it is slow but large per partner.

## 2. RELÓGIO: a liability clock built from the people who *didn't* fall for it

- **Hook:** Most mums who get "Olá mãe" don't pay, but they hold the mule's IBAN or MB Way number *before* the next victim pays. Relógio turns their near-miss into a public, timestamped warning that every bank must reckon with.
- **User:** The targeted-but-not-fooled family member (our real seed), and receiving banks that need to block or freeze the mule before payment #2.
- **Problem and evidence:** PSP asks people to report even failed attempts, but those reports go into a police queue, not the payment flow. One mule account serves dozens of victims (the 41 victims in the Leiria case). PSR now requires PSPs to share fraud data and splits damage, so *when a bank was warned* decides who pays.
- **Stellar mechanism (exact):**
  - A Soroban registry keyed by `sha256(normalized IBAN or MB Way phone)`. Each report is a contract call with a ledger timestamp that nobody, including the bank consortium, can backdate or quietly delete.
  - Reporter accounts are created with **sponsored reserves** (`BeginSponsoringFutureReserves`) by the operator, so a mum needs no XLM.
  - Banks hold an `AUTH_REQUIRED` "PSP" credential asset issued by the consortium. The contract checks that trustline (through the SAC) before accepting `confirm`/`frozen`/`cleared` status writes.
  - Contract events let any bank or app subscribe through RPC.
- **Why it's not an AI default:** The user is the *non-victim*, and the value is a **liability timestamp**, an evidence primitive for the 50:50 and PSR disputes, not a "scam database". AIs don't think from the receiving bank's legal exposure.
- **90-second demo:**
  1. Mum A pastes the scam message. The app extracts the IBAN and her report is stamped on testnet at 10:02.
  2. Two more reports arrive.
  3. At 11:30 Grandma B, at a *different* bank, tries to pay the same IBAN.
  4. **Memorable moment:** the bank's pre-payment check shows **"Reported 88 min ago by 3 independent people — ledger #…"** and the payment is held. A second screen shows the dispute view: "Receiving bank was warned at 10:02 → liability shifts."
- **Buildability:** High. One small Soroban contract, sponsored account creation and a simple web UI. Message parsing is a regex for IBAN/phone.
- **Risks:** IBAN hashes can be brute-forced (the space is small), so the privacy claim must be modest. Reports can be abused (a rival reports your IBAN), so it needs a threshold of independent reporters and a bank `cleared` status.
- **Biggest weakness:** "Why not a database run by SIBS (MB Way's operator) or the bank association?" Our answer: neutral, non-backdatable timestamps between competing banks with conflicting liability. That is a real argument, but judges may see it as thin.
- **Ecosystem effect:** Every reporter becomes a sponsored Stellar account: thousands of real Portuguese families, given 4,389+ complaints a year and far more attempts. PSPs join as credential holders. There is no new liquidity, only accounts and institutions.

## 3. QUINHÃO: restitution shares for victims of the same mule ring, with a fair exit instead of a "recovery firm"

- **Hook:** When police freeze a mule ring, its 36 victims each get an on-chain share of whatever is recovered. If they want cash now, they can sell that share at a visible price on the DEX instead of paying a fake "recovery firm" an upfront fee.
- **User:** A victim after the money is gone. These are older parents who are now targets of recovery scams (UK: £185m in one year).
- **Problem and evidence:** Recovery from frozen mule accounts is slow and per-case (crimes in 2022–23, arrest in 2025). Victims are isolated and get re-targeted by recovery scammers who charge upfront fees.
- **Stellar mechanism (exact):**
  - A per-case asset `QNH<case>` issued by a victims' lawyer or association with `AUTH_REQUIRED`. Trustlines are authorized only after the victim's police complaint number is verified, and tokens are minted equal to the euros lost.
  - A Soroban distributor pays every recovered euro paid in pro-rata to holders.
  - The SDEX order book `QNH/EURC` lets a recovery fund bid, for example 0.35, so victims who want certainty can exit now.
  - `AUTH_REVOCABLE` handles fraudulent claimants.
- **Why it's not an AI default:** It starts from the *second* scam (recovery fraud) and from victims of the *same mule* finding each other. Using the DEX as an honest price for a criminal-restitution claim is odd, but it has a real user.
- **90-second demo:**
  1. Three victims of Mule X each hold QNH.
  2. The police release €4,000 from one frozen account. It is paid in and splits pro-rata live.
  3. **Memorable moment:** split screen. Left: a WhatsApp from a "recovery lawyer" asking for €250 upfront. Right: Grandma sells her share on the DEX for €315, now, in one tap.
- **Buildability:** Medium. Asset, trustlines and offers are easy. The distributor contract is a small amount of Soroban.
- **Risks:** Under Portuguese criminal procedure, whether a victim's restitution claim can be assigned is unclear, and nobody has the role of "case issuer" today.
- **Biggest weakness:** It looks like claim/RWA tokenization (a banned neighbour) and depends on a legal actor we don't have.
- **Ecosystem effect:** A genuinely new asset class and a new trading pair (QNH/EURC), and it brings outside capital (litigation and recovery funds) into DEX liquidity. Small numbers per case, but it repeats for every case.

## 4. SOU EU: number changes signed by the key that owns your identity

- **Hook:** "Olá mãe, este é o meu número novo" is only believed if the child's long-lived Stellar identity signed that number change. A scammer with a new SIM can't.
- **User:** The impersonated child (an Erasmus student abroad, a son in Lisbon) and the parent who receives the message.
- **Problem and evidence:** The whole scam rests on the "new number" claim. PSP's only defence is "call the old number", which fails when the child really did lose the phone.
- **Stellar mechanism (exact):**
  - The child's account holds `ManageData` entries `tel:<n>` = `sha256(phone || salt)`, written only by the account's signer: a passkey smart wallet that survives phone loss through cloud sync, or a family multisig threshold.
  - Mum's app checks the claimed number against the latest signed entry. Account history gives "when changed" for free.
- **Why it's not an AI default:** It is identity *continuity across phone numbers*, not a wallet. But it borders on social recovery and passkey onboarding (both banned) if we use multisig or passkeys.
- **90-second demo:** The scam message arrives, Mum pastes the number, and the screen goes red: **"This number was never signed by Tiago's key."** Then Tiago really changes number on the new phone, signs it, and Mum sees green.
- **Buildability:** High (a few hours).
- **Biggest weakness:** It needs enrolment before the scam happens, and Stellar is largely decorative here: any PKI or Signal safety number does the same job. It is also close to banned ideas.
- **Ecosystem effect:** One account per family member, with no liquidity or volume. The weakest on the new criterion.

---

## Ranking after the "more users / more liquidity" criterion

1. **RASTO**: the strongest Stellar Unlocked fit (asset flags, clawback and atomic multi-op recovery used for something new), the best demo moment, and the biggest ecosystem effect (a euro issuer and P2P volume).
2. **RELÓGIO**: the closest to our real seed (Mum *didn't* pay but had the IBAN) and a strong user story, but it brings accounts, not liquidity.
3. **QUINHÃO**: brings new asset and DEX liquidity, but has legal fog and sits near banned tokenization.
4. **SOU EU**: easy to build, but Stellar is decorative and it sits close to banned ideas.

## Best pick: RASTO

It is the only idea where Stellar is doing something bank rails *cannot*: one issuer, one public ledger, and one atomic transaction that freezes and claws back a fan-out across many accounts. It is grounded in a real Portuguese mule case (20 accounts, about 36 victims), and its buyer has a new legal reason to care (PSR refund liability and data sharing). The graph lighting up and returning €900 in 5 seconds is the moment judges will remember.

Pitch framing: "Olá mãe money is unrecoverable because rails let mules fragment it. On Stellar, fragmentation stops working."

Address the two weaknesses openly in the deck:
- Victims don't pay over Stellar today. Our answer: this is why EMIs should settle P2P euros on Stellar.
- Escape through the DEX. Our answer: `AUTH_REQUIRED` with KYC'd trustlines, plus speed.

Optional stretch: feed RELÓGIO near-miss reports in as a pre-emptive freeze trigger, making it a single product.
