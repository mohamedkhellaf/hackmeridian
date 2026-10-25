# WINNING_IDEAS.md: Operation Genesis committee verdict

HackMeridian 2026 · Genesis · decided Sun 2026-10-25, about 14:00 WET.
The full research trail is in [`research/decision/`](research/decision/). The chairman's timeline is in [`research/decision/00_chairman_log.md`](research/decision/00_chairman_log.md).

> **How this was produced.** Four separate AI agents worked as a committee, each with its own context, plus a chairman. They were a Problem Hunter, a Stellar Architect, a Wildcard Inventor and a Ruthless Judge, and they messaged each other directly.
>
> **What the team setup was.** Claude Code's experimental "Agent Teams" feature was not enabled in this session, so the teammates were background subagents that talked through `SendMessage`. Every message they sent or received is logged verbatim in `research/decision/06_*`, `07_*` and `10_*`.
>
> **The process.** 12 blind proposals, then 6 shortlisted, 2 criticism rounds, 3 finalists, and independent scoring. An independent reviewer on the Fable model then checked the result. Claims about Stellar behaviour were checked with testnet transactions (hashes below), not just reasoning.

---

## ✅ FINAL TEAM DECISION (17:15): options on tokenized real-world assets

**The team chose to build _Backstop_:** fully collateralized, physically settled put and call options on permissioned tokenized funds on Stellar. This overrides the committee recommendations below, which are kept as the decision record.

- **Plan, scope, roles and contract rules:** `AGENTS.md`.
- **Testnet proof that the core flow works:** `research/decision/20_rwa_options_spike.md`.
- **Competitors to position against:** Lusty (Stellar options, server-settled), Octarine (tokenized-asset trading), Arrows (collateralized options on other chains).

---

## ⚠️ UPDATE 14:40: after the uniqueness sprint, the recommendation changed

**New recommendation: build _Cheque Pré-Datado_ (C1), if the small-business call doesn't reject it. _Second Thought_ (§1–6 below) stays as the fully specified fallback.**

### Why we reopened the decision

- **The team asked: "is this easily gettable from an AI?"**
- **We tested it** with 8 fresh AIs (`research/decision/15_twin_test.md`). Second Thought's core, "undo a payment for 24h", was the #1 idea in 2 of the 4 runs that asked for *unique* Stellar ideas.
- **The team then set two new priorities:** uniqueness, and **bringing users or liquidity to Stellar**. That second one is an official idea area on hackmeridian.com/build, and adoption is the judges' #1 priority.
- **Process:**
  - A 45-minute sprint used 5 fresh generators (3 Opus/Fable runs, 1 more Fable run, 1 Codex run), each starting from the team's real stories and banned from every idea the AIs had already produced (`research/decision/16_sprint/`).
  - The 4 committee agents evaluated the results (`research/decision/17_sprint_eval_*.md`).
  - Testnet spikes h–l checked the mechanics.

### Cheque Pré-Datado in one sentence

*A post-dated cheque for Portuguese small businesses that the Stellar ledger enforces: cash it early for 97%, on time for 100%, or late with the legal interest. Cashing one version kills the others, and no money is locked up.*

### How it works

All classic Stellar operations, no contract, no server.

1. **A small dedicated cheque account per cheque.** It's 2-of-2 (payer + supplier) with master weight 0, so **nobody can cancel or re-sequence it alone**.
2. **The payer pre-signs three transactions with the same sequence number.** Each one pays from the payer's **own account** (operation source), so funds stay liquid until cashing:
   - **Face A:** 97% of the invoice, valid only until day 20 (early-payment discount).
   - **Face B:** 100%, valid from day 21 to the due date.
   - **Face C (optional):** 100% + statutory late interest (DL 62/2013, 10.40% for H2 2026) + €40, valid after the due date.
3. **The supplier picks the moment.** It co-signs the chosen face and submits it with a fee-bump. The other two faces become permanently invalid (`tx_bad_seq`).
4. **A bounce is a public, timestamped fact on the ledger.** If the payer empties the account or rotates keys, the cheque fails as a failed transaction anyone can see. A paper cheque can't do that.

### Verified on testnet today (spikes h, k, l)

Scripts and raw outputs: `research/decision/spikes/h_cheque.*`, `h2.*`, `k_preauth.*`, `k2*`, `l_2of2.*`.

| Check | Result |
|---|---|
| Each face is valid only inside its window | `tx_too_early` / `tx_too_late` outside it; cashed inside (`71a2a1c4…`, `23216f61…`) |
| The payer can't bump or close the cheque account | `tx_bad_auth` |
| Once one face is cashed, the others are dead | `tx_bad_seq` (face `9659652b…`) |
| A bounce is recorded on-chain | Failed tx `d8bf727f…`, `successful=false`. It consumes the sequence number, so all faces die. |
| The payer rotates keys | The face fails with `op_bad_auth`: a visible "stopped cheque" |
| Funds locked? | **None.** This is not escrow. |

### Why it now beats Second Thought

**Scores** (Judge, re-scored under the new priorities):

| Idea | Score |
|---|---|
| **C1 Cheque** | **75** |
| C3 Testemunha | 75 |
| C2+C5 | 72 |
| F1 Second Thought | 71 |
| C4 RASTO | 71 |

**Votes:**
- **Wildcard:** C1 78 vs F1 75.
- **Architect:** C1 beats F1 on both Track Alignment (4.5 vs 3.5–4) and Technical Execution (no server; about 14 vs 24 dev-hours).
- **Problem Hunter:** C1 is the best sprint idea, but not above F1 on user value unless the small-business call confirms it. **That is the gate.**

**The reasons:**
- **Uniqueness:** 0 of 8 fresh AIs produced the mechanism. Codex's sprint run found a related one (a pre-authorized transaction plus a shared sequence number), so twin risk is low to medium.
- **"Only on Stellar":** it combines a shared sequence number with time bounds on **both ends** of a pre-signed transaction, and keeps operation source separate from transaction source. EVM nonces have no "valid from" time, and Bitcoin's version locks the funds.
- **Users:** every cheque onboards **two** businesses and moves the full invoice in euro stablecoin, and it spreads along supply chains.
- **Human story:** the team's real link to small businesses that owe each other. **Real problem:** only **20.2% of Portuguese firms pay on time**, second-worst of 37 economies, with restaurants at 11% (Informa D&B, 2026, verified).
- **Cheaper and safer to build:** no backend, no secret key, every edge case already verified.

### Honest caveats (put them in the pitch)

1. **Paper cheques are rare now.** They're about 0.2% of Portuguese payments and falling (Problem Hunter, contradicted the generator's claim). **So don't pitch "a digital cheque".** Pitch **"pay-later terms the ledger enforces: the supplier can cash early at a discount, the buyer keeps its cash until then."** Use the cheque as a metaphor only.
2. **Buyers won't happily sign the late-interest face.** Make Face C optional in the product and the demo; the hero is the early-payment discount.
3. **One premature bounce kills every face.** A "will it clear?" balance check before cashing is mandatory UX.
4. **No legal force like a paper cheque, and no confirmed Portuguese euro-stablecoin on-ramp.** Demo with a clearly labelled test euro (`EURt`). Say what mainnet would need.
5. **Liquidity effect is modest and honest:** new business accounts and euro-stablecoin payment volume, not DEX depth. Put the empty BRZ/EURC order book on a "what's next" slide.

### Gate: the small-business call, ideally before 15:50

1. "When you buy from each other, do you pay later (30/60 days, end of month, post-dated cheques)? How late does it actually get?"
2. "Would you, as supplier, accept a payment promise you can cash early at 97%, where everyone can see if it bounces?"
3. "Would you, as buyer, sign one? Including a version with the legal late interest?"

**Rule:** if suppliers want it, or at least one side clearly does, build C1. If both sides say no, build Second Thought (§1–6), leading with the guardian twist, never with "undo".

### C1 build plan (Claude codes, humans review)

| Tier | Contents |
|---|---|
| **T1** | Issue form: invoice amount, due date, discount → creates the cheque account and 3 faces. Supplier inbox with QR / one link per face. "Cash" button with a balance pre-check. Explorer links. In-app keys, self-issued `EURt`, demo windows in minutes. |
| **T2** | Bounce and stopped-cheque history from Horizon (the public "protest" record). Business dashboard: cheques issued and received, on-time record. |
| **T3** | Unit tests for the face builders. A testnet integration test that replays spikes h/k/l. A reusable TS module. README with a "what the ledger enforces" table. |
| **T4** | Optional Face C (late interest). SEP-7 links. Polish. |

**Order:**
- 16:00–16:30: spike l ported into the app and on a public URL.
- 21:00: T1 working on the hosted URL.
- 01:00: T2 + T3.
- 06:00: feature stop.
- 09:00–11:00: video and deck.
- **11:00: submit.**

**90-second demo:**

| Time | What happens |
|---|---|
| 0–10s | "Only 1 in 5 Portuguese firms pays on time." |
| 10–25s | Café issues a €1,000 cheque to Padaria: three faces with their dates. |
| 25–45s | Padaria cashes early at €970. **Memorable moment:** the app then tries the other faces and the ledger refuses (`tx_bad_seq`): "the other two just died". |
| 45–60s | Café tries to cancel a second cheque alone → refused. |
| 60–75s | A third cheque from an empty account **bounces, and the failure sits on the public ledger forever**. |
| 75–90s | "No escrow. No locked cash. No server. The ledger is the cheque." |

---

## 1. Executive verdict (original decision; now the FALLBACK)

### Build: **Second Thought**

**One sentence:** *A 24-hour undo window for payments to strangers, on a plain Stellar account. The scammer impersonated the one person who can undo it.*

In a "Hi Mum, I lost my phone, send money to my new number" scam, the person being impersonated is the user's real child. Second Thought makes that child a **guardian** on the parent's account, with these properties:

- **Strangers wait 24 hours.** Any payment to a new recipient goes out as a Stellar **claimable balance**. The recipient cannot collect it for 24 hours; the network itself refuses (`op_cannot_claim`).
- **Mum can cancel alone.** She can take the money back herself at any time before it is claimed, with no server and no daughter needed. That is the "second thought".
- **The guardian can undo, but never spend.** The guardian gets an alert and can **pull the money back** to the parent at any time before it is claimed. The guardian **can never spend** the parent's money. Stellar's multisig thresholds enforce this, and it holds even if our server is compromised.
- **Known payees are instant.** Payments to people the family already trusts go through immediately. A new payee can also be approved instantly when the guardian taps "approve".
- **No smart contract.** Everything uses core Stellar account features that have been in the protocol for years.

### Why it is the strongest choice for Genesis

- **It solves a documented harm, for a specific person, on day one.**
  - In Australia's "Hi Mum" scam data, people 55+ make **82% of reports and suffer 95% of losses** (ACCC, Aug 2022, bank-transfer data, verified).
  - Here in Portugal, the police (PSP) logged **260 "Olá mãe / Olá pai" complaints in January 2024 alone** (verified).
  - The design turns the scam's own trick against it: the impersonated child is the guardian.
- **Every security promise is enforced by Stellar's validators, not by us.** All of them were proven on testnet using the exact final signer setup (§3, spike f).
- **It passes the judges' stated tests.** "My mom can understand it". "Judges can test it" (hosted, in-app keys, no wallet install). "No complex DeFi". "Delete what doesn't work" (scope cut to 3 roles).
- **It is buildable by Stellar newcomers.** It needs no Rust, no contract, and only one third-party service (SDF Horizon/friendbot). The core build is about 22–24 dev-hours.
  - **Capacity update (after the committee):** Claude writes most of the code, so coding hours are no longer the bottleneck.
  - **The bottlenecks are now:** human review and merging, testnet verification, the two real calls, and the video and deck.
  - The scope tiers in §4 use the extra capacity for things judges score (tests, a reusable SDK, the security fixes), not for more features. The 06:00 Lite cut-line stays as insurance.
- **An independent reviewer on the Fable model checked it after the committee: APPROVE WITH REQUIRED CHANGES.** All five changes cost almost nothing to build and are written into this spec (§5).
- **It was attacked hardest and survived.** It was everyone's #1 from the start, so the committee treated that agreement as a warning sign. It took the most damage of any idea: its original "protocol-enforced" claim was false and was conceded. It was then redesigned until the claim became true.

---

## 2. Final ranking

### Official weighted scores (out of 100; weights TA 20 · UV 20 · TE 15 · Inn 15 · HP 10 · MEP 10 · UX 10)

Scores are final, after the Judge's argument against the leader and the rebuttals. They are kept separate on purpose, not averaged away.

| Finalist | Problem Hunter | Stellar Architect | Wildcard Inventor | Ruthless Judge | Range |
|---|---|---|---|---|---|
| **F1 Second Thought** | 73 | 74.0 | 75 | 73 | 73–75 |
| **F2 Loop** (backup) | 70 | 73.0 | 73 | 70 | 70–73 |
| **F3 Heirloom** | 65 | 69.5 | 69 | 67 | 65–69.5 |

The Judge's final per-criterion scores for F1 were TA 4, UV 3, TE 4, Inn 3, HP 4, MEP 4, UX 4, for a total of 73. Full per-criterion sheets with reasons are in `research/decision/09_score_*.md`, with final adjustments in `research/decision/10_final_argument_responses.md`.

### Where the agents disagreed, and kept disagreeing

- **Loop's Innovation:** the Wildcard and the Architect give it 5; the Judge and the Problem Hunter give it 4, because of Ripple-era prior art (RipplePay, Trustlines Network).
- **F1's Track Alignment:** the Architect gives it 3.5, because the rule deciding which payments get delayed runs off-chain. The others give it 4.
- **F1's User Value:** both the Problem Hunter and the Judge cut it to 3 after admitting there is no direct evidence of older people holding self-custodied USDC on Stellar.
- **The Fable reviewer goes further on F1's Track Alignment.** It puts it at about 3, or 2.5 for a judge anchored on the organizers' spoken definition of Unlocked ("what you couldn't do before"). That would make F1 roughly level with Loop at about 70.
  - **The chairman keeps F1 anyway, for three reasons.** The Track Alignment gap can be fixed by framing (§4, Genesis track). Loop's User Value of 2 is structural and can't be fixed that way. And the reviewer found new evidence for F1's user: Vesseo (formerly Vibrant), SDF's own wallet, runs non-custodial classic accounts that already carry server signers.

### The three finalists

| | Second Thought (WIN) | Loop (BACKUP) | Heirloom |
|---|---|---|---|
| **What it is** | A 24h undo window and a guardian who can never spend, on a classic account | A small-business debt circle cancelled by one path payment from a firm back to itself | A pre-signed transaction that hands account control to an heir only after N days of inactivity (CAP-21 `minSeqAge`) |
| **Major strengths** | Evidenced harm. "Mom" test. Visible network refusals. Verified on testnet. | Best track fit and novelty. Memorable "€0 moved". Mechanism verified. No server. | Purest protocol trick. Lowest build risk (about 14 dev-h). |
| **Major weaknesses** | Familiar category (Coinbase Vault, Argent, LOBSTR Vault, Volta Circuit). No proof that older USDC holders exist on Stellar. One small server. | Evidenced pain is one-way late-payment chains, which netting can't touch. Firms won't publish their debt graph. No value until a whole cycle joins. | Liana (Bitcoin) already ships this. 4+ earlier Stellar inheritance builds. Weak user evidence. Abstract demo. |
| **MVP completion risk** | Medium | Low–Medium | Low |
| **Demo failure risk** | Medium (server uptime; undo works without it) | Low technically, Medium for comprehension | Low |
| **Critical dependency risk** | Low–Medium (Horizon + our own function) | Low | Low |
| **Differentiation confidence** | Medium | Medium–High for judges, Low for users | Low–Medium |
| **Future potential** | Medium–High (wallet feature/SDK for LOBSTR-class wallets) | Low–Medium | Medium–Low |

---

## 3. Debate record

### Timeline

| Phase | Time (WET) | What happened |
|---|---|---|
| Blind discovery | 12:55–13:03 | 12 concepts plus a judging framework, each written separately. |
| Independent ranking | 13:03–13:06 | All four agents ranked **WI-2 (Second Thought) #1** independently. Three of them independently invented the same "Guardian" merge. **The chairman flagged this as a possible AI-twin effect, not proof.** |
| Round A (attack) | 13:07–13:23 | Testnet spikes a–f were run. Three ideas were abandoned by their own authors. |
| Round B (defend / improve / combine / abandon) | 13:23–13:30 | The Architect was assigned to argue **for Loop and against the leader**. The Judge wrote a crux list. |
| Due diligence and scoring | 13:30–13:38 | Competitive landscape, architecture, demo scripts and kill criteria. Independent scores, the Judge's final argument against F1, rebuttals. |

### Most important disagreements, and the assumptions behind them (the Judge's crux list)

| Crux | Status | Who bet against it |
|---|---|---|
| C1: a 24h hold plus a guardian stops the targeted scams | Assumption, strong for "Hi Mum"; no effectiveness study | Architect (second choice) |
| C2: F1 has a distribution path | LOBSTR Vault shows the infrastructure exists [V]; LOBSTR's interest is speculative | Wildcard |
| C3: judges weight Adoption over Discovery | Neutral; the judge transcript supports both | none |
| **C4: Loop can be solved on a public ledger, and a first cluster of firms exists** | **Prior builds went to ZK to hide the debt graph; Portuguese pain is linear chains [V]** | **Problem Hunter and Architect (decisive)** |
| C5: the "aha" lands in a 3-minute video | Favours F1 | none |
| C6: F1 survives async judging with a server in the loop | Mitigated: undo needs no server, plus Family override | none |

### Strongest arguments FOR the winner

- **Problem Hunter:** "In 'Hi Mum' scams the impersonated child IS the guardian, so detection within 24h is near-certain."
- **Architect** (proposed pitch line): "Our server can only ever make a payment slower, never move money."
- **Architect:** what Stellar's validators enforce is "exactly the set of guarantees a security-minded judge cares about, and it doesn't depend on our server being honest."
- **Wildcard:** "Undo after sending means the guardian acts only when something is wrong. Approve-before-send (LOBSTR Vault, Argent) blocks every legitimate payment until the guardian acts."

### Strongest arguments AGAINST the winner (the Judge's final argument, condensed)

1. **The user we demo may barely exist on Stellar.** ACCC "Hi Mum" losses are bank transfers. We have zero evidence that people 55+ hold self-custodied USDC on Stellar. The 718,599 funded USDC accounts are an unsegmented count.
2. **It is a known product with a narrow twist.** A judge could fairly call it "LOBSTR Vault plus Argent's trusted contacts". All four agents converged on it, so expect twins in the room.
3. **The protocol story is thinner than the pitch implied.** The rule for which payments get delayed lives in our server or app.
4. **Complexity sits where judges test.** The original design had four roles, three keys, a server, an allowlist, Family mode and a recovery hatch.
5. **It adds friction to legitimate urgent payments.**
6. **Opportunity cost.** Loop wins Track Alignment and Innovation, which together are 35% of the score.

**How the team answered:** points 1 and 2 are partly conceded and points 3 and 4 are conceded, with the scope cut. Point 5 is mostly rebutted: the guardian's tap makes any payment instant. Point 6 is rejected on the numbers. All four of the Judge's proposed changes were adopted (see §4).

### Ideas that changed significantly during the debate

- **Second Thought (WI-2).**
  - It began as "protocol-enforced elder savings protection", with weights Mum 2 / guardian 1 and thresholds 1/2/2.
  - The Judge showed that Mum's key alone could pay from any other wallet. The Wildcard conceded: *"The line 'enforced by the Stellar protocol' was false."*
  - It was redesigned to a 2-of-3 setup: Mum 2 / policy 1 / guardian 1, thresholds 1/3/3, with a guardian-sourced undo.
  - Its user was re-scoped twice: from US elders, to remittance receivers, to "Hi Mum" families and non-crypto-native digital-dollar savers.
  - Its scope was then cut to 3 roles.
- **Heirloom (SA-1).** It went from a standalone #2–3 to S1's recovery hatch, and finally to the roadmap. Spike (g) found that incoming payments don't reset the inactivity clock, so the hatch would also need an app-open heartbeat.
- **PrizeLock (PH-1).** It was improved into a "native multisig and pre-signed refund" version. It was then abandoned by its own author after the Judge showed the organizer and referee could secretly pre-sign a competing payout for the same sequence slot.
- **The "Guardian" merge (WI-2 + SA-1).** It was declared dead because the guardian's own actions reset the inactivity timer. It was revived by spike (e): the undo is sent from the guardian's own account with Mum only as the operation source, which leaves Mum's sequence untouched.

### Instances where an agent changed its opinion

- **Architect (designated pro-Loop advocate):** moved from "near-tie, slight Loop (≈79 vs 77.5)" to "F1 ≥ Loop (≈76 vs 75)". In its words: *"My opinion moved because of the Vault evidence and because I can't name a Loop buyer who accepts a public debt graph."*
- **Judge:** changed its view twice, both times on evidence. Coinbase Vault prior art briefly put Loop ahead. The ACCC data, LOBSTR Vault, spike f, and two agents betting against C4 then put F1 back in front.
- **Problem Hunter:** abandoned its own idea, PrizeLock. It cut F1's User Value from 4 to 3 after failing to find any evidence of older Stellar USDC holders.
- **Wildcard:** owned both F1 and Loop. It conceded its own headline claim, abandoned Stamp, and admitted *"my own originality lens prefers F2"* while still staking on F1.

### Abandoned in debate, each by its own author

- **FairSeat:** scalpers can sell the whole account key off-chain, and DICE already does face-value resale.
- **PrizeLock:** the organizer and referee can collude on a hidden payout, the documented failures were prize money that never existed, and Matcherino is the incumbent.
- **Stamp:** x402 can only pay a classic account, so the bond can't land in a contract escrow. Nothing forces senders to use it, and LinkedIn InMail already refunds credits.
- **Eliminated at shortlist** (reasons in `research/decision/05_shortlist.md`):
  - **Caução** (proposed blind by two agents, which makes it a confirmed AI twin)
  - **Envelope**
  - **ShowUp**
  - **AllowanceVault**
  - **Always For Sale**

---

## 4. Winner specification: Second Thought

### Target users and concrete problem

- **Problem:** family-impersonation and urgent-payment scams ("Hi Mum, new number, send €900 today").
  - Victims are mostly 55+ (ACCC 2022: 82% of reports, 95% of losses; bank-transfer data).
  - In Portugal: PSP logged 260 "Olá mãe / Olá pai" complaints in January 2024, with victims paying by transfer or MB Way (observador.pt, 2024-02-08).
  - Crypto impersonation scams grew about 1,400% in 2025 (Chainalysis, as reported).
  - Once a stablecoin payment is sent, it cannot be recalled.
- **User:** a non-crypto-native family that saves in digital dollars in a self-custody Stellar wallet, plus one trusted family member as guardian. The older parent in the demo is an **illustrative persona**, not a claim.
  - **The evidenced class is Vesseo (formerly Vibrant) users:** USDC savers in Argentina on SDF's own non-custodial wallet. About 93% of its users are Argentine, and its monthly actives grew 282% year on year.
  - **Vesseo uses SEP-30:** recovery servers sit as signers on the user's classic account, with weights such that "neither has independent control" (SDF blog, verified by the Fable reviewer).
  - **So our target users already hold self-custody USDC on classic accounts that carry server signers.** That is the strongest precedent for our policy co-signer.
- **Distribution:** pitched as a **wallet feature / reference integration** for LOBSTR- or Vesseo-class wallets on classic G-accounts. LOBSTR Vault already ships co-signer multisig on Stellar. Whether any wallet would adopt ours is unverified.

### Unique value proposition

*Bank-grade new-payee scam holds, brought to self-custody.* What is new is the combination below, on a plain Stellar account with no contract:

- **Undo after sending,** not approve before sending.
- **Friction only for strangers.**
- **A guardian who can undo but can never spend,** even with our server compromised.

### What the network enforces vs what our app enforces (pitch hygiene, mandatory)

| Enforced by Stellar validators (verified on testnet) | Enforced by our policy server or app |
|---|---|
| A stranger can't claim before T (`op_cannot_claim`) | Which payees count as "known" (an allowlist stored on-chain in Mum's account data). **Family only. Exchanges are never pre-allowlisted** (see below). |
| Mum alone can cancel a pending payment (ClaimClaimableBalance is a low-threshold operation) | That new payees get the 24h claimable balance and not a direct payment |
| The guardian alone can undo a pending payment back to Mum | That allowlist edits are rejected unless the guardian co-signs |
| The guardian can never spend, even together with our server (G+P = 2 < 3, `op_bad_auth`) | |
| Mum's key alone (for example, phished) moves nothing (2 < 3, `op_bad_auth`) | |
| Mum + guardian can remove our server (Family override) | |

**Allowlist rule (Fable review, required):** the allowlist holds **family only**. If an exchange deposit address were pre-allowlisted, the scam has a one-hop bypass: "Mum, send it to your exchange, then withdraw to me." That payment would go through instantly, with no hold and no alert. So exchanges are new payees like anyone else, and the first payment to one goes through the guardian's "approve now" path (Mum + Daughter = 3). "Money already at an exchange or bank" goes on the "does NOT stop" slide.

**README security model table (required). Never say "no single compromise moves money" without the rows below it:**

| Compromised or lost | Outcome |
|---|---|
| Mum's key (phished) | Can't pay (2 < 3). Can cancel her own pending payments. |
| Our server | Can't pay alone (1 < 3). Worst case: co-signs a payment Mum also signed, so it degrades to an ordinary wallet. |
| Guardian | Can't pay (1 < 3). **Can block, never steal:** she could keep undoing payments, or bump Mum's sequence number to its maximum, which leaves Mum's account unable to send transactions. |
| Guardian + server | Can't pay or change signers (2 < 3, verified). |
| **Mum's key + server** | **Reaches 3 and could spend.** Disclosed. |
| **Server gone + guardian gone** | **Lockout.** Mum alone can only cancel pending payments, so her balance is frozen. Recovery is the break-glass transaction below (if built) or not available (disclose). |

**Break-glass, optional; build only if at least 1.5 dev-hours are spare after the co-signer is green.** At setup, all three keys sign one transaction: `setOptions` with master weight 3 and thresholds 1/1/1, using `minSeqAge` = 30 days, stored in Mum's app. It is the Heirloom mechanism (spikes c/d) turned into "protecting Mum from us". If unbuilt, document it in the README with the spike hashes.

**Never claim:** "first reversible payments", or "the 24h hold is protocol-enforced" in the serverless Lite fallback, where Mum alone could bypass it.

### Why Stellar makes this possible or materially better

1. **A pending, sender-reclaimable, time-gated payment is a native ledger object** (a claimable balance with predicates). On EVM this needs a custom escrow contract or a Safe module, and the funds must first move into it.
2. **Weighted multisig per operation type on a plain account,** plus the ability to send a transaction from one account that acts on another, lets a guardian reverse but never spend. We proved this on testnet rather than assumed it.
3. **Sub-cent fees** make a guardian-paid undo free in practice.

### Genesis track

**Stellar Unlocked, pitched under the organizers' WRITTEN prompt.** Quote it on the deck: *"Old-school assets, new tricks: built-in asset issuance, the DEX, or path payments applied to unexpected uses."*

- **Our trick:** a claimable balance used as a cancellable consumer payment, which CAP-23 designed for payouts, not this. Thresholds are used as a role system, where the guardian can undo but not spend.
- **Never claim "new capability" or "used to be impossible".** These primitives date from 2015 and 2020, and the reviewer warns that a judge anchored on the spoken definition ("what you couldn't do before") would mark that down. Say "a composition no Stellar wallet ships".
- **Prove the guarantees belong to Stellar, not us.** Use the "pull the plug" beat and the stellar.expert screenshot of the claimable balance's time condition.
- **Cite SEP-30 / Vesseo** as ecosystem precedent that non-custodial server signers on classic accounts are the Stellar way.

### Existing alternatives and competitors (name them all in the deck)

| Alternative | What it does | Our difference |
|---|---|---|
| Coinbase Vault / Transfer Protection (since 2014) | 48h cancellable withdrawals | It's custodial. We're self-custody, and the hold is enforced by validators. |
| Argent (since 2020) | Guardians, a trusted-contacts allowlist and limits on Ethereum smart wallets | It's an approve/limit model on a contract wallet. We do post-send undo on a plain account, with no contract. |
| LOBSTR Vault | A co-signer that approves every transaction on Stellar | It's approve-every-tx. Our friction applies only to strangers, and the guardian can never spend. |
| Volta Circuit / Smart Treasury | Stellar organisation multisig with limits, timelocks and whitelists | It's for organisations, with no consumer undo. |
| Bank new-payee holds (UK, Singapore, Australia) | Delay payments to new payees | That's banks; we bring the same idea to self-custody stablecoins. |
| Stellar CLI "co-signed vault" pattern | Documents a low-threshold delegate claiming a claimable balance | A building block; cite it in the README. |

### Technical architecture

```
┌────────────── Vite + React + TS (existing frontend/) ──────────────┐
│ Role switcher: Mum · Daughter (guardian) · Stranger                 │
│ "Create demo family" button + pre-made shared demo family (README)  │
│ second-thought-core (TS): tx builders + plain-language result codes │
└───────────┬──────────────────────────────────┬──────────────────────┘
            │ signed XDR                        │ Horizon reads (poll ~3s)
            ▼                                   ▼
  /api/cosign (stateless serverless       Horizon testnet + friendbot (SDF)
  function, ~80 LOC, POLICY_SECRET env)   claimable_balances?claimant=MUM,
  2 rules: payment to an allowlisted dest  loadAccount (signers, thresholds,
  or CB with exactly [recipient            data_attr allowlist)
  NOT_BEFORE ≥ now+window, Mum             stellar.expert links for every tx
  unconditional]; everything else
  rejected; /health
```

- **No Soroban contract.** Leave `contracts/hello-world` out of the pitch, or remove it in a PR.
- **Keys:** `Keypair.random()` per role, funded by friendbot, stored in `localStorage` and labelled "testnet only". Freighter is optional and not in the critical path.
- **Asset:** a self-issued demo dollar (for example `USDx`), because Circle's testnet faucet needs a captcha. Mainnet would use Circle USDC unchanged.

#### Signer setup (one transaction at setup)

- Mum `masterWeight 2`; Policy `weight 1`; Guardian `weight 1`.
- Thresholds: low 1 / medium 3 / high 3.
- Allowlist entries: `manageData('al:'+G…)`.

#### Flows

| Flow | Operation | Signers |
|---|---|---|
| Known payee | `payment` | Mum + Policy |
| New payee | `createClaimableBalance`, with claimants `[recipient: NOT(BEFORE_ABSOLUTE_TIME(T)), Mum: unconditional]` | Mum + Policy |
| Guardian approves a new payee instantly | `payment` | Mum + Guardian (= 3) |
| **Undo** | transaction **source = Guardian**, `claimClaimableBalance({ balanceId, source: MUM })` | Guardian only |
| Stranger collects after T | `claimClaimableBalance` | Stranger |
| Family override | `setOptions({ signer: POLICY, weight 0 })` | Mum + Guardian |

#### Specific Stellar dependencies and verification

**Docs:**
- Claimable balances: https://developers.stellar.org/docs/build/guides/transactions/claimable-balances
- Multisig and thresholds: https://developers.stellar.org/docs/learn/fundamentals/transactions/signatures-multisig
- Operation thresholds (Payment = medium, ClaimClaimableBalance = low): https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations
- Co-signed vault pattern: https://developers.stellar.org/docs/tools/cli/agent-cli/guides/delegate-spending#pattern-1-a-co-signed-vault
- Fee sponsorship: https://developers.stellar.org/docs/build/guides/transactions/fee-sponsorship
- Sponsored reserves: https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves
- CAP-21 (roadmap hatch): https://github.com/stellar/stellar-protocol/blob/master/core/cap-0021.md

**Network status:** both testnet and mainnet run protocol 29. Every operation used is a classic operation that runs unchanged on mainnet. Only friendbot is testnet-only.

**Testnet proof, run by the Architect on 2026-10-25** (scripts and raw output in the session scratchpad; hashes in `research/decision/06_debateA_stellar_architect.md`):

| Spike | What it proved | Evidence |
|---|---|---|
| a | Early claim refused | `op_cannot_claim` |
| a | Guardian-only payment refused | `op_bad_auth` |
| a | Guardian-only undo works | `58f70035…` |
| e | Undo from the guardian's own account leaves Mum's sequence and activity clock unchanged | `02e300ef…` |
| f | Final table: Mum alone can't pay | `op_bad_auth` |
| f | Mum + Policy pays | `85aeea3b…` |
| f | 24h claimable balance | `167349e9…` |
| f | Guardian undo | `e4066132…` |
| f | Guardian + Policy can't pay or remove Mum | `op_bad_auth` |
| f | Mum + Guardian can remove Policy | `de4ecad5…` |
| f | Family-sponsored reserve | `0f7b18bd…` |

### Smallest viable end-to-end MVP

1. **"Create demo family":** keypairs for Mum, Daughter, Stranger and Son, funded from one friendbot funder (the policy key lives only in the server's environment). It also creates a demo-dollar issuer, trustlines, the signer setup at 1/3/3, and pre-allowlists the son. Plus a pre-made shared family linked from the README.
2. **Mum view:** balance, a Send form (allowlisted → instant; new → protected claimable balance), and a pending list with a countdown and a **"Cancel" button that works with Mum's key alone**.
   - Each pending payment locks **1 XLM** of reserve (2 claimants × 0.5 XLM base reserve), returned when the payment is claimed or cancelled. Over-fund Mum, or use the family-sponsored reserve (spike f).
3. **Stranger view:** "Claim" → *"Refused by the Stellar network: this money can't be collected until 14:32"*. After the window, the claim succeeds.
4. **Daughter view:** a polled alert *"Mum sent €900 to a NEW recipient"*, an **Undo** button, an **Approve now** button, and a "try to pay myself" button that shows the `op_bad_auth` refusal.
5. **`/api/cosign`:** the two-rule stateless co-signer plus a `/health` badge.
   - **Cheap hardening (Fable review):**
     - reject any operation whose explicit `source` differs from the transaction source;
     - cap the fee and require timebounds;
     - require claimable balances to have exactly two claimants in the required shape, with T ≥ now + window;
     - reject `manageData` and `setOptions`;
     - give Horizon `loadAccount` a 5-second timeout with a plain error.
6. **Every transaction** shows a stellar.expert link, and every refusal shows the raw result code translated into plain language.
7. **Demo window:** 120 seconds by default, configurable, 24h in "real mode".

### Features deliberately excluded

- Heirloom as inheritance (roadmap). Its mechanism returns only as the optional break-glass above.
- Allowlist cool-off
- Passkeys / smart wallets (claimable balances only go to classic G-accounts)
- Freighter as a requirement
- Soroban contracts
- Anchors / off-ramp
- Real Circle USDC
- Push notifications (we poll instead)
- AI scam explainer
- Multiple guardians
- Mainnet deployment

### Scope tiers (updated for Claude-heavy coding)

Ship each tier only when the previous one works **on the hosted URL**. `main` must stay demoable.

| Tier | Contents | Why judges care |
|---|---|---|
| **T1: core (must)** | Spike f ported into the app; Mum, Daughter and Stranger views; Mum cancel, guardian undo, guardian "approve now", guardian can't spend; demo-family seeder; explorer links; plain-language refusals | The whole demo |
| **T2: full security (must, was a stretch)** | `/api/cosign` with the hardening rules, 1/3/3 thresholds, `/health` badge, Family override, the "pull the plug" beat, a family-only allowlist | Unlocks "Mum's key alone can't move money", which answers the Judge's main objection |
| **T3: credibility (should)** | `second-thought-core` as a clean, documented TS package. Unit tests for every tx builder and the co-sign policy. A **testnet integration test** that replays spike f's checks (Mum alone refused, guardian+server refused, early claim refused). README security table. | Technical Execution (15%), Market & Ecosystem via the "wallets can adopt this" SDK story, and pre-empting protocol-literate judges |
| **T4: lockout fix (should)** | Break-glass pre-signed transaction (`minSeqAge`, spikes c/d) with a status panel | Answers the reviewer's lockout finding on screen, not just in the README |
| **T5: polish (could)** | Guided "Play the story" mode, mobile layout, optional "connect Freighter as Mum" to show it works with a real wallet | UX (10%) |

**Still out of scope, whatever the capacity:** Soroban contracts, passkeys, anchors, mainnet, multiple guardians, AI scam detection, building Loop alongside. Judges reward a focused product, and "delete anything not 100% working" still applies.

### Task allocation (three humans + Claude)

| Who | Owns |
|---|---|
| **Claude** | Writes the code for T1–T4 in small PRs (`feat/core`, `feat/ui`, `feat/cosign`, `feat/tests`, `feat/breakglass`), runs tests and the testnet integration test before each PR, and keeps the README's "enforced by Stellar" table matching what the tests actually prove |
| **Dev A: Stellar reviewer** | Reviews and merges Claude's PRs to core and cosign, reads every tx builder against the spike scripts, and owns `POLICY_SECRET` and the hosting environment. **Nobody pastes secrets into chat or the repo.** |
| **Dev B: product and UX** | Drives the app as a judge would after every merge, files bugs, owns visual design and copy (plain-language refusals, the illustrative-persona label), and checks it on mobile |
| **Dev C: story and evidence** | **The two real calls before 17:00**, then the deck (prior-art slide, "does NOT stop" slide, the written Unlocked prompt), the video script and recording, and the submission answers |

### Recommended development order and go/no-go checkpoints

| Time (WET) | Milestone | Gate |
|---|---|---|
| 15:50–16:00 | Commit to the idea; create the branches (`feat/core`, `feat/ui`, `feat/cosign`) | — |
| 16:00–16:30 | **Spike f ported into the app on Lite thresholds and deployed to a public URL** (setup, send to new payee, undo, explorer links; no styling) | Fable review: if this artifact doesn't exist by hour 2, nothing else matters |
| 16:30–18:00 | Shared skeleton: seed button, in-app keys, role switcher. This is reusable for Loop if we switch. | **~17:00 evidence gate:** relative-call result (§6) |
| 18:00–21:00 | T1 complete on the hosted URL; T2 co-signer in progress | **21:00: T1 green, or freeze scope** |
| 21:00–01:00 | T2 (1/3/3, pull the plug, Family override) and T3 (tests, integration test, SDK packaging, security table) | **01:00: T2 green.** T4 only if T3 is done. Staggered sleep starts. |
| 01:00–06:00 | Sleep in shifts; one dev on a fix/polish rotation | **06:00 hard stop:** if Full isn't green, ship Lite and drop the claim that Mum's key alone can't move money |
| 06:00–09:00 | Polish, README, CI green, hosted run-through with the server deliberately off | — |
| 09:00–11:00 | Record the video on the hosted URL; build the deck | — |
| **11:00** | **Submit** (one hour of buffer; no late submissions at 12:00) | — |

### 90-second demo scenario

| Time | On screen | What it proves |
|---|---|---|
| 0–8s | WhatsApp-style text: *"Hi Mum, dropped my phone, new number. Can you send €900 for rent today?"* Caption: "Illustrative persona". VO: "In 'Hi Mum' scams, people 55+ make 82% of reports and bear 95% of losses." | The problem |
| 8–12s | Title: **"Second Thought: the scammer impersonated the one person who can undo it."** | — |
| 12–24s | Mum sends €900 to the new number. Banner: "New recipient: protected for 24h (demo: 2 min)". Explorer link. | Claimable balance with a time predicate |
| 24–30s | Stranger taps Claim → red card **"Refused by the Stellar network: `op_cannot_claim`"** | Validator-enforced hold |
| 30–36s | Mum has a second thought and taps **Cancel**. The money is back, signed with her key alone. Then she sends again (to set up the next beat). | Low-threshold reclaim: the product's name |
| 36–46s | "But what if Mum is still convinced?" The daughter's alert: *"Mum sent €900 to a NEW recipient."* She taps **Undo**, and Mum's balance animates back. | Guardian-sourced reclaim |
| 46–54s | "So can the daughter just take Mum's money?" She taps "send Mum's money to me" → **`op_bad_auth`** | Threshold arithmetic: can undo, never spend |
| **54–70s** | **MEMORABLE MOMENT: pull the plug.** First, a protected payment is already pending (it was created while the server was up). Our server's health badge goes red, live on camera. The stranger is refused again, the undo still works, and the guardian still can't spend. VO: *"Our server can only ever make a payment slower. It can never move money."* | The guarantees are Stellar's, not ours |
| 70–80s | stellar.expert shows the claimable balance's "not before 14:32" condition next to Mum's signer table. Mum pays her son instantly. | The rule lives on the ledger; friction only for strangers |
| 80–90s | End card: claimable balances · multisig thresholds · no smart contract. *"Bank-grade scam holds, for the money you hold yourself."* | — |

**Judge reproducibility:** hosted URL, a pre-made demo family, a "Create demo family" button, and a guided "Play the story" mode. No Freighter install. If the window is left to expire, the stranger can claim, and the UI explains that this is what happens without a guardian.

### Biggest technical risk and fallback

- **Risk:** the co-signing function, our first backend holding a secret, is down or cold during async judging (Monday to Wednesday). Close behind: `tx_bad_seq` races from fast clicks.
- **Fallback:**
  - The hero beat (refused claim → Undo → can't spend) **never needs the server**.
  - Family override (Mum + Guardian = 3) is one "Advanced" button.
  - A health badge, an uptime ping, and a README line: "badge red → use Family mode".
  - If Full isn't green by 06:00, ship Lite with downgraded claims.
  - Reload the account before every build and serialize submissions per account.

### What judges should remember

*"The scammer impersonated the one person who can undo it."* A plain Stellar account becomes a family safety net. Strangers wait 24 hours, the real daughter can pull money back but never spend it, and when the team switched its own server off on camera, every protection still held, because Stellar enforces them.

---

## 5. Independent Fable review

**Reviewer setup:** a separate agent on the Fable model, run after the committee finished and independent of it, requested by the human team. Full text: [`research/decision/11_fable_review.md`](research/decision/11_fable_review.md).

**Verdict: APPROVE WITH REQUIRED CHANGES.** It re-checked the threshold arithmetic against the official operation list and the spike outputs, and found no gap in the ledger logic. What it broke was framing, one design choice and two undisclosed failure modes.

| # | Finding | Severity | Applied in this document |
|---|---|---|---|
| 1 | F1 doesn't meet the organizers' **spoken** Unlocked definition ("what you couldn't do before"); realistic TA is about 3, which puts it level with Loop | Near-fatal (judging) | Pitch under the **written** "old-school assets, new tricks" prompt; cite SEP-30/Vesseo; never claim "new capability" (§4, Genesis track) |
| 2 | Pre-allowlisting an exchange is a **one-hop bypass** ("send it to your exchange, then withdraw to me") | Fatal if shipped | Allowlist is family only; exchanges need guardian approval |
| 3 | Server gone + guardian gone = **Mum's funds frozen** | Real, undisclosed | README security table, plus an optional break-glass transaction |
| 4 | A malicious guardian can brick the account (bump the sequence number to its maximum) or keep undoing payments forever | Real, undisclosed | Disclosed as "can block, never steal" |
| 5 | The hero flow should show **Mum cancelling alone** first | Product | Added to the demo (30–36s) |
| 6 | Claimable-balance reserve is **1 XLM**, not 0.5 (Contradicted). ACCC figures are 2022 bank-rail data. Portuguese PSP figure available. | Facts | Corrected throughout |
| 7 | Real capacity is about **26–28 dev-hours, not 36**: the buffer is 3–5h, not 12 | Execution | The 06:00 Lite cut-line is mandatory, and all fixes above cost almost nothing to build |

**Claims the reviewer checked:**
- **Confirmed:** ACCC 82%/95% (Aug 2022); LOBSTR Vault behaviour; Coinbase Vault 48h cancellable; ClaimClaimableBalance = Low; Portuguese "Olá mãe" scams.
- **Confirmed, and stronger than the committee thought:** Vibrant/Vesseo is non-custodial USDC on classic accounts with SEP-30 server signers.
- **Contradicted:** the 0.5 XLM reserve figure.
- **Could not verify independently:** the organizers' spoken Unlocked definition.

**On the backup and the eliminations:**
- Loop is correctly second, as a *different* bet.
- Switch rule (d) is right as written.
- No eliminated idea was wrongly killed.
- New Loop risk: once issued, an IOU is freely transferable, which raises legal questions about selling or assigning receivables.

**First 2 hours (reviewer's top instruction):**
- Port spike f into the Vite app: in-app keys funded by friendbot, a "Create demo family" setup transaction, "Send to new payee" (claimable balance), the daughter's "Undo", and explorer links under each.
- Use Lite thresholds with no server and no styling, **deployed to a public URL by about 16:30**.
- Everything else builds on that.
- Meanwhile, a teammate makes the relative call.

---

## 6. Final challenge

### "Against 100 capable teams, what makes this memorable, useful and technically credible enough to stand out?"

- **Memorable:** one human sentence ("the scammer impersonated the one person who can undo it"), plus a live moment no look-alike wallet will have. We switch off our own server on camera, and the protections still hold because Stellar's validators enforce them.
- **Useful:** it targets one documented, high-loss scam pattern with a mechanism that changes its outcome. It adds friction only for strangers, and the guardian's tap removes even that. It ships as a wallet feature, the way LOBSTR-class wallets could actually adopt it.
- **Technically credible:**
  - Every claim on the "enforced by Stellar" list was proven on testnet with the exact final configuration.
  - The README separates validator-enforced guarantees from app policy.
  - It names Coinbase Vault, Argent, LOBSTR Vault and Volta Circuit, and claims only the difference.
  - It discloses the one remaining weak point: a compromised server plus a phished key.
  - Protocol-literate judges see that we know where the line is.

### The strongest remaining reason NOT to build it

**We can't yet show that the person we're protecting exists on Stellar.** The scam evidence comes from bank transfers. There is no age data for any Stellar wallet, and no evidence of older people holding self-custodied USDC there. If a judge asks "who is this for, today?", the honest answer is "digital-dollar savers like Vesseo's users, whose accounts already carry server signers, once a wallet ships it". That is weaker than Loop's "nobody has done this with the protocol before". It is also a crowded category where AI-generated twins are likely.

**Mitigation:**
- Make the two calls before 17:00 and use the real answers.
- If the relative's scam turns out to be the wrong shape AND the small-business call finds a real closed debt cycle whose firms accept a pseudonymous public graph, switch to **Loop** before anything F1-specific is built. The first two hours of skeleton work serve both.

### Calls to make before 17:00

**Relative who was targeted by a scam:**
1. How did they first contact you? How long from the first message to sending money? How did you pay? When did you realise?
2. If your child had got an alert minutes later ("Mum sent €X to a new recipient. Undo?"), would they have spotted it? Would you have accepted them pulling it back?
3. Would you accept 24h for new people, with known people instant? What would make you switch that off?

**Small-business contact (decides whether Loop is still alive):**
1. Who owes whom? Is there a closed circle (A owes B, B owes C, C owes A), or does money mostly flow one way?
2. Would you join if the debts sat on a public ledger under code names?
3. Who would run it? Would every firm in the circle sign up within a month? What does a late payment cost you?

---

## 7. Every idea considered, and what happened to it

**Scores:** the Judge's /100 on the official rubric, at the stage each idea was last scored. **Status:** where it ended up.

### The winners

| Idea | Source | What it is | Status |
|---|---|---|---|
| **C1 Cheque Pré-Datado** | Sprint (SME seed, Fable) | Pay-later terms the ledger enforces. Three pre-signed versions (97% early / 100% on time / 100% + legal interest late) share one sequence number, so cashing one kills the others. No locked funds; a bounce is public on-chain. | **RECOMMENDED** (75), gated on the SME call; all mechanics verified on testnet |
| **F1 Second Thought** (WI-2) | Wildcard, then the committee | A 24h undo window for payments to strangers; the impersonated child is a guardian who can undo but never spend; 2-of-3 signing | **FALLBACK** (71–75). Fully specified in §1–6. Core "undo" was #1 for 2 of 8 fresh AIs, but the guardian twist was found by 0 of 8. |

### Sprint candidates (uniqueness round, 14:16–14:40)

| Idea | What it is | Why it lost |
|---|---|---|
| C3 Testemunha | Junta-issued witness-quota tokens for proof-of-address certificates; clawing back one bribed witness voids every certificate they backed | 75. Strong local evidence, but a public body must adopt it, address hashes raise GDPR issues, it voids honest people's documents, and it brings no liquidity. |
| C2+C5 Balcão / Prova de Caixa | Brazilian cafés take reais and receive euros, and become the first market makers on the empty BRZ/EURC book; failed sales become visible liquidity requests (Codex) | 72. Best liquidity story, but no evidenced demand: Pix and MB Way already work, Brazilians hold USDT, BRZ has 97 trustlines. Kept as a "what's next" slide. |
| C4 RASTO | A euro issuer freezes the mule accounts, claws back and repays the scam victim in one transaction (verified on testnet) | 71. Scam money isn't on Stellar today, and Circle USDC on Stellar can't be clawed back. |
| Others from the sprint | RELÓGIO (timestamped mule-IBAN warnings), QUINHÃO (victim claim tokens), SOU EU (signed "new number"), Troca (3-way teacher swaps), Isento / Tax-free (VAT refund as an asset), Subsídio (meal allowance), Gorjeta, Nomad desk, Assinatura Conjunta, À Consignação, Aval Digital, Cotação Fechada, Bairro em Alerta, Pode Circular? | Weaker evidence, banned-adjacent, or a feature of a stronger idea. Details in `research/decision/16_sprint/`. |

### Original committee finalists

| Idea | What it is | Why it lost |
|---|---|---|
| F2 Loop (WI-1) | Small-business debt circles cancelled by one circular Stellar payment (verified on testnet) | 70–73. The real pain is one-way late-payment chains; firms won't publish their debt graph; GPT's #1 idea in the twin test. |
| F3 Heirloom (SA-1) | Inheritance / lost-key recovery: a pre-signed transaction valid only after N days of inactivity (verified) | 65–69. Liana (Bitcoin) already does it; common AI idea (3/8); survives as an optional break-glass inside F1. |

### Abandoned by their own authors in debate

| Idea | Why |
|---|---|
| SA-2 FairSeat | Scalpers sell the whole wallet key; DICE already does this; most AI-twinned idea (4/8) |
| PH-1 PrizeLock | The organizer and referee can pre-sign a hidden payout; the cited failures were money that never existed; Matcherino exists |
| WI-3 Stamp | x402 can only pay a classic account; nothing forces senders to use it; LinkedIn InMail already refunds |

### Eliminated at the shortlist

| Idea | Why |
|---|---|
| PH-2 / SA-3 Caução (rent deposits) | Proposed blind by two agents and by a fresh Opus (AI twin); escrow category with 0 winners |
| SA-4 Envelope | Four third-party services in the demo path; crowded remittance category |
| PH-3 ShowUp | Kickback already did it on Ethereum; blockchain barely needed |
| PH-4 AllowanceVault | Its best use case (visa proof of funds) is ruled out by regulation |
| WI-4 Always For Sale | Weak track fit and weak demand |

**Where the evidence lives:** the chairman log, debate logs, scores, the Fable review, the twin test, sprint outputs and all testnet spikes are in `research/decision/`.
