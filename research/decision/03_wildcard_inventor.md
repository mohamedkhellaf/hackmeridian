# Agent 3: Wildcard Inventor, blind-phase concepts

Written Sun 2026-10-25, about 13:00 to 13:25 Lisbon, without looking at any other committee file.

**Method.** I brainstormed about 30 ideas and checked the strongest against the Scout index of Stellar hackathon builds (`scout.searchHackathonBuilds`, 1,356 builds indexed as of 2026-10-25). I then checked the key protocol claims in the Stellar docs and the market claims on the web.

**What the organizers ask for.** The organizers' own "Stellar Unlocked" examples include *"Old-school assets, new tricks: built-in asset issuance, the DEX, or path payments applied to unexpected uses"* ([hackmeridian.com/build](https://www.hackmeridian.com/build)). Two of my concepts answer that prompt almost literally, with uses I have not found in any prior Stellar build.

**Evidence labels**
- **[V]**: verified, with a link
- **[A]**: reasonable assumption
- **[S]**: speculation
- **UNVERIFIED**: recalled from memory and not checked in this session

**Ranking:** WI-1 > WI-2 > WI-3 > WI-4.

---

## WI-1: "Loop": Stellar's DEX used to cancel debt

**One-sentence hook.** Five businesses that owe each other in a circle cancel their debts with **one Stellar path payment from a firm to itself**. No cash moves and no clearing house is involved. Each firm's IOU is a native Stellar asset, and each firm's consent to netting is a standing offer on the SDEX.

**Target user.**
- Clusters of small businesses that extend trade credit to each other. For example, a Lisbon restaurant, its bakery, its wholesaler, its laundry and its caterer, or freelance agencies that subcontract to each other.
- Secondary: business associations or chambers that want to run a set-off scheme without building a clearing house.

**Problem.**
- Small businesses hold receivables and payables at the same time, and late payments propagate along supply chains.
- Settling every invoice gross needs far more cash than the net positions require.
- Slovenia considered this important enough to make multilateral set-off compulsory. The state agency AJPES runs it monthly through the ePOBOT service. [V] ([GZS notice](https://www.gzs.si/zbornica_racunovodskih_servisov/Novice/ArticleId/47813/arhiv--epobot-ajpes--2-2-2011-bo-potekalo-vecstransko-pobotanje-medsebojnih-obveznosti), [Mondaq on the 2011 Act](https://mondaq.co.uk/eu-law/127460/act-on-prevention-of-late-payments-in-force-since-16-march-2011))
- There is academic work on obligation clearing as liquidity-saving for small businesses: Fleischman, Dini & Littera, *JRFM* 2020. [V] ([LSE listing](https://researchonline.lse.ac.uk/view/creators/Fleischman=3AToma==017E=3A=3A.html))
- Outside Slovenia, nobody runs this for small firms, because it needs a trusted central operator.

**Proposed solution (MVP).**

The core insight is that Stellar's founding model of issued assets and trustlines *is* a credit network. The DEX and path-payment engine can perform the "rippling" that clears a debt cycle.

1. **Each firm issues its own IOU asset**, for example `BAKERY:G...`. When an invoice is accepted, the debtor pays its own IOU to the creditor, which mints a claim.
2. **The trustline limit is the credit line.** The creditor chooses how much exposure to the debtor it accepts. `AUTH_REQUIRED` means only approved counterparties can hold a firm's IOU.
3. **Each firm signs standing "netting offers" once.** For every IOU it holds, the firm places a passive 1:1 offer that sells the IOU it holds and buys back its own IOU. The intent is: "I'll hand over my claim on B to cancel my own debt."
4. **Clearing is a single `path_payment_strict_send`.** Firm A sends the C-IOU it holds and receives its own A-IOU, along the path `[B-IOU]`.
   - C's offer swaps C-IOU for B-IOU. C receives its own IOU, which is burned, so C's debt to A is cancelled.
   - B's offer swaps B-IOU for A-IOU, which cancels B's debt to C.
   - A receives A-IOU, which is burned, so A's debt to B is cancelled.
   - All of this is atomic, needs one signature, and every edge falls by the cycle minimum.
5. **The frontend runs the clearing engine.** It reads balances and trustlines from Horizon, builds the debt graph, finds cycles with a DFS over at most about 6 nodes, and submits the path payments. Horizon's own pathfinding is an optional check.
6. **Remaining net positions are settled** in USDC or EURC on the same DEX.
7. **Stretch:** a small Soroban "invoice registry" that holds invoice metadata (hash, due date) linked to each IOU issuance.

**Stellar integration.**

| Primitive | Role | Why it is essential |
|---|---|---|
| Classic asset issuance | Each firm issues its own IOU | Turns debts into native assets |
| Trustlines | Credit limits and consent | A firm can only be handed claims it has agreed to hold |
| Authorization flags | Control who may hold an IOU | Restricts IOUs to approved counterparties |
| SDEX passive offers | Each firm's standing netting consent | Lets one signature clear the whole loop |
| Path payment to self | The clearing transaction | Atomic, and costs a fraction of a cent |
| Horizon | Reads the debt graph | |
| USDC/EURC | Settles the residual | |

- There is no smart contract on the critical path. The protocol *is* the clearing house.
- Without Stellar you would need a trusted operator holding everyone's ledger, which is exactly the AJPES model.

**Track fit.**
- **Stellar Unlocked (strong):** this almost literally matches the "old-school assets, new tricks" example.
- Composed (optional): use EURC (Circle) for settlement, plus anchor cash-out of residuals.

**Why almost nobody else will build this, and prior-art results.**
- The *problem* has been attempted on Stellar. **SettleZK** ([dorahacks.io/buidl/46011](https://dorahacks.io/buidl/46011)) and **zkNexus** ([dorahacks.io/buidl/46452](https://dorahacks.io/buidl/46452)) both appeared at *Stellar Hacks: Real-World ZK* and both do ZK-proved private netting. Neither shows an award in Scout. [V]
- No build I found uses **trustlines as credit lines and the SDEX/path payments as the clearing engine**. Searches for "mutual credit", "IOU trustline credit" and "trade credit" returned only credit-scoring and lending builds. [V via Scout search, 2026-10-25]
- This is Stellar returning to its Ripple-era credit-network roots (Ryan Fugger's RipplePay concept; UNVERIFIED in this session). Most hackathon teams treat the DEX as "a place to swap USDC", which is why few will think of it.
- **Honest risk:** the Ruthless Judge may say "netting has been done". The counter is that our *mechanism* is new and protocol-native, the prior builds are ZK-heavy and have no awards, and ours is demoable live on the explorer.

**Demo (90 seconds).**
- **0–10s:** "Five Lisbon businesses. €48k of invoices between them. €4k of cash in the bank."
- **10–30s:** A live graph from testnet. Firms are nodes and IOU balances are edges. Each firm has already clicked "Join netting", which placed its offers.
- **30–55s:** One click on **"Clear loops"**. Edges shrink and disappear live, and a counter reads **"€38,400 of debt cancelled · €0 moved."**
- **55–75s:** Open stellar.expert on the transaction. It is one `path_payment_strict_send` whose source equals its destination, with a path through the other firms' IOUs. *"The money went round in a circle and the debt vanished."* **This is the memorable moment.**
- **75–90s:** The residual is settled in USDC by one more path payment. Close with: *"Slovenia needs a state agency to do this monthly. Stellar does it in 5 seconds with features that have been in the protocol for years."*

**15-hour feasibility.** High.
- Everything is `@stellar/stellar-sdk` in TypeScript. No Rust is needed, which removes the team's biggest risk (Soroban inexperience).

| Work item | Estimate |
|---|---|
| Testnet seeding script (friendbot, 5 issuers, trustlines, invoice payments, offers) | ~3h |
| Cycle finder | ~1h |
| Path-payment builder plus error handling | ~2h |
| React graph UI (SVG or a force-graph lib) with live Horizon streaming | ~4h |
| Residual settlement | ~1h |
| Polish and demo | ~3h |

- **Do a 45-minute spike first.** It must prove that issuer offers buying the issuer's own asset, plus a self-to-self path payment, behave as described.

**Biggest uncertainty.**
1. **Mechanics.** I am confident of the theory: issuers can trade their own asset, and receiving your own asset burns it. Self-payment arbitrage paths are a known pattern ([A]). It still needs the spike above.
   - Max path length is 5 intermediate assets, which caps loops at about 6 parties. UNVERIFIED from memory; check the docs.
   - Horizon's pathfinding may not discover the cycles itself, so we compute paths client-side.
2. **Privacy.** Public IOUs reveal who owes whom, which is the very problem SettleZK attacked. Mitigation: pseudonymous accounts. ZK privacy is roadmap, not MVP.
3. **"Rippling" side effect.** A firm's netting offer can be hit by any holder of its IOU who also trusts the other asset. That is consent-bounded by trustlines but must be explained.
4. **Legal.** Whether IOUs count as e-money or invoices is out of scope for the MVP. [S]

**Evidence summary.**
- [V] Organizer track examples, AJPES compulsory set-off, Fleischman et al., and Scout prior-art results (SettleZK, zkNexus).
- [A] Path-payment-to-self and issuer-offer mechanics.
- [S] Market size; legal framing.

---

## WI-2: "Second Thought": scam-resistant payments with a protocol-native undo window

**One-sentence hook.** In this stablecoin wallet for your parents, every payment to a *new* recipient waits in a 24-hour undo window enforced by the Stellar protocol. A family "guardian" key can pull the money back but can never spend it.

**Target user.**
- Adults over 60 who hold, receive or send stablecoins (remittance receivers, retirees abroad), and the adult children who act as guardians.
- Secondary: Stellar wallets and anchors that could ship "Second Thought" as a feature.

**Problem.**
- Irreversibility is the scammer's favourite feature of crypto.
- **Americans over 60 lost about $2.84B to crypto scams in 2024** (IC3, via secondary coverage). [V] ([The Block](https://www.theblock.co/post/351746/fbi-says-americans-over-60-lost-nearly-3-billion-to-crypto-scams-in-2024), [TRM Labs](https://trmlabs.com/resources/blog/a-record-breaking-year-for-cybercrime-key-findings-from-the-fbis-2024-ic3-report))
- **UK authorised-push-payment fraud was £450.7m in 2024.** Since Oct 2024 the UK has *mandated* reimbursement (cap £85k), and the PSR reports 88% of lost money returned. [V] ([Edgar Dunn](https://www.edgardunn.com/articles/one-year-on-uks-app-fraud-reimbursement-rules), [FStech](https://fstech.co.uk/fst/PSR_Reveals_88_Of_Money_Lost_To_APP_Scams_Reimbursed.php))
- Regulators clearly want reversibility windows. Crypto wallets offer none.

**Proposed solution (MVP).** A web wallet with a sender view, a guardian view and a recipient view.

1. **Known payees are paid instantly** with a normal payment.
2. **New payees, or amounts over a threshold, are paid as a `CreateClaimableBalance`** with two claimants:
   - **Recipient:** `NOT(BEFORE_ABSOLUTE_TIME(now+24h))`, so it can claim only after the window.
   - **Sender:** unconditional, so the payment can be undone until the recipient claims. Alternatively, the sender's right is limited to `BEFORE(now+24h)` and a long-expiry fallback.
3. **Guardian is set up with native multisig weights:**

   | Setting | Value |
   |---|---|
   | Parent's key weight | 2 |
   | Guardian's key weight | 1 |
   | Low threshold | 1 |
   | Medium threshold | 2 |
   | High threshold | 2 |

   - `ClaimClaimableBalance` is a **low-threshold** operation, so the guardian alone can reclaim a pending payment back into the parent's account.
   - Payments are **medium**, so the guardian alone **can never send the parent's money anywhere**.
   - The protocol enforces "undo but never spend". No smart contract is involved.
4. **Guardian alerts** come from a Horizon event stream: "Mum sent €900 to a new recipient. Undo?"
5. **Recipient view** shows "Arriving in 23:59:12". A claim attempt during the window is rejected by the network.
6. **Stretch, toward Composed:** skip the window for merchants verified through their `stellar.toml` home domain (SEP-1). Recipients cash out after the window via a SEP-24 anchor. An LLM "why this looks like a scam" explainer could sit on the pending screen.

**Stellar integration.**
- Uses claimable balances with predicates, account multisig weights and thresholds, Horizon streaming, and USDC/EURC.
- Predicate support is documented. [V] ([claimable balances guide](https://developers.stellar.org/docs/build/guides/transactions/claimable-balances#additional-parameters))
- `ClaimClaimableBalance` threshold is Low. [V] ([list of operations](https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations#claim-claimable-balance)) Stellar's agent-CLI docs even mention low-threshold delegates being able to claim claimable balances ([delegate-spending guide](https://developers.stellar.org/docs/tools/cli/agent-cli/guides/delegate-spending#pattern-1-a-co-signed-vault)). The mechanism is documented; this *application* is new.
- **Why blockchain is essential:** reversibility is enforced by validators, not by a company that could refuse or go bust. On other chains the same thing needs a custom escrow contract.

**Track fit.**
- **Stellar Unlocked (strong):** "old-school" claimable balances and thresholds used for consumer protection.
- Composed (optional): anchor cash-out and SEP-1 verified merchants. This also touches the organizers' "wallets people want to use: shared accounts, recovery" prompt from a different angle.

**Why almost nobody else will build this, and prior-art results.**
- Scout searches for "scam protection reversible payment", "cooling off period payment", "elder fraud" and "undo payment" found only adjacent builds. Examples are ScamGuardAI (AI detection), escrow marketplaces and payment gateways. **No build on Stellar uses claimable-balance predicates as an undo window, or threshold weights for a guardian who cannot spend.** [V via Scout search, 2026-10-25]
- Off-Stellar analogues: ERC-20R reversible tokens (academic) and Bitcoin vault/covenant proposals (OP_VAULT). Both are UNVERIFIED in this session. Social-recovery wallets (Argent, Safe) recover keys; they do not reverse payments.
- Teams building "elder-safe wallets" usually reach for AI scam detection. Very few know claimable balances exist.

**Demo (90 seconds).**
- **0–15s:** Maria, 72, gets a WhatsApp from her "grandson": *"New number, send €900 now."*
- **15–35s:** In Maria's wallet she sends €900 USDC to a new address and sees "Sent with 24h protection". On the scammer's screen, a claim attempt is **rejected by the network** and the error is shown.
- **35–60s:** The daughter's phone shows an alert. She taps **Undo**, the transaction is signed *only* with her key, and the €900 is back in Maria's wallet.
- **60–75s:** The daughter tries to send Maria's money to herself, and **the protocol refuses** (insufficient signer weight). *"The guardian can undo, but can never spend."* **This is the memorable moment.**
- **75–90s:** A legitimate payment to a known payee is instant. A 2-minute window shows a recipient claiming successfully after expiry. The predicate is visible on the explorer.

**15-hour feasibility.** High.
- All of it is `stellar-sdk` TypeScript, with no Rust.
- Two to three views, plus multisig setup and a claimable-balance builder: about 8–10h.
- That leaves time for UX polish, which counts toward Product Design (10%).
- **Risk:** it may score lower on "Technical Execution" because it looks simple. Add the stretch features (SEP-1 verified merchants, anchor cash-out) to deepen it.

**Biggest uncertainty.**
- **Behavioural.** Does a guardian actually intervene within 24h? Scammers will adapt by pushing victims to wait out the window or to add the scammer as a "known payee". Mitigation: adding a known payee also needs guardian co-sign, or carries a delay. [S]
- **Recipient claimants must be classic G-accounts**, not passkey smart wallets (C-addresses). [A] So the parent's wallet is a classic account, which hurts the "no seed phrase" story.
- **Wallet category is crowded.** The differentiation must be front-and-centre.

**Evidence summary.**
- [V] IC3 and UK APP figures; claimable-balance predicates; Low threshold for claim.
- [A] Classic-only claimants.
- [S] Guardian intervention rates.

---

## WI-3: "Stamp": refundable attention bonds for AI agents (and humans)

**One-sentence hook.** Any AI agent or stranger who wants to reach your inbox posts a $1 bond on Stellar via x402. If you reply, it is refunded; if you mark it spam, you keep it.

**Target user.**
- People with heavy inbound contact: founders, VCs, recruiters, journalists, open-source maintainers.
- Builders of *legitimate* AI outreach agents, who want a credible "I'm not spam" signal.

**Problem.**
- AI sales and outreach agents push the marginal cost of a personalised cold message toward zero, so inbound volume explodes. [A]
- Filters are an arms race. The economic fix (make spam cost money, à la Hashcash) has never worked for email because micro-payments and refunds were impractical.
- Card rails cannot do a $0.50 refundable bond. Fixed fees are roughly $0.30 plus a percentage [A], and agents do not have cards.

**Proposed solution (MVP).**
1. **Contact endpoint.** A recipient publishes `stamp.link/<name>`: a web form plus an HTTP API.
2. **Bond via x402.** A POST without payment returns `402 Payment Required` using x402 on Stellar (`@x402/stellar`, facilitator sponsors fees). The agent wallet pays the bond in USDC into a **Soroban escrow contract** keyed by message hash.
3. **Delivery.** The message lands in the recipient's Stamp inbox with a "$1 bonded" badge. Email forwarding is a stretch goal.
4. **Recipient actions:**

   | Action | Result |
   |---|---|
   | **Reply / "worth it"** | Refund to the sender, with an optional tip |
   | **Spam** | Bond goes to the recipient, or to a charity they choose |
   | **No action in N days** | Automatic refund |

5. **Public sender score.** The contract records slashes and refunds per sender address, so any other inbox can query it. Repeat spammers face automatically higher prices.

**Stellar integration.**
- **Soroban escrow:** bond, refund, slash and timeout logic, with unit tests.
- **x402 on Stellar** for agent-native payment. [V] It has an official `@x402/stellar` package and facilitator, and Stellar launched x402 support around Mar 2026. ([jsDelivr README](https://cdn.jsdelivr.net/npm/@x402/stellar@2.20.0/README.md), [OpenZeppelin x402 facilitator](https://deepwiki.com/OpenZeppelin/relayer-plugin-x402-facilitator))
- **USDC** via the Stellar Asset Contract (SAC).
- **Optional:** an OpenZeppelin smart-account spending-limit policy on the agent's wallet, so an agent cannot burn more than $X/day on stamps. This is exactly the organizers' "agents that spend" stack, inverted.
- **Why blockchain is essential:** sub-dollar programmable escrow that agents can pay without accounts or cards. Neither party can override the escrow. Reputation is portable across inboxes.

**Track fit.**
- **Stellar Composed (strong):** x402, Soroban, USDC/SAC and OpenZeppelin policies.
- Not Unlocked.

**Why almost nobody else will build this, and prior-art results.**
- Every x402 build at *Stellar Hacks: Agents* has **agents paying to consume** (APIs, data, queries). Examples are Zap402, DevAsign and the x402-mcp templates. **Stamp inverts the direction: agents pay to reach a human, and the bond comes back if they are welcome.** [V via Scout]
- Scout searches for "inbox" and "cold outreach" returned 0 builds. "Spam" returned only AgentRep (agent reputation, not bonds). [V via Scout search, 2026-10-25]
- Off-chain prior art: Hashcash (proof-of-work postage) and Earn.com (paid inbox, acquired by Coinbase around 2018). Both UNVERIFIED in this session.

**Demo (90 seconds).**
- **0–10s:** "Mo gets 140 AI-written cold emails a week."
- **10–35s:** In a terminal, an LLM outreach agent POSTs to Mo's Stamp endpoint, gets a **402**, its wallet pays a $1 bond automatically, and the message appears in Mo's inbox with "$1 bonded". A second, spammy agent does the same.
- **35–60s:** Mo clicks **Spam** on one, and **$1 lands in Mo's wallet** (explorer link). Mo clicks **Reply** on the other, and the agent's terminal logs "bond refunded". **This is the memorable moment: Mo earns money from spam in real time.**
- **60–80s:** The sender-score page shows the spam agent's address with one slash, and Mo's price for that address doubles automatically.
- **80–90s:** *"Spam was free. Now it isn't, and good senders pay nothing."*

**15-hour feasibility.** Medium; the tightest of the four.

| Work item | Estimate |
|---|---|
| Soroban escrow contract (~150 lines) and tests | ~4h |
| Small Node/Express server with x402 middleware (the repo has no backend yet) | ~4h |
| Scripted LLM agent client | ~1h |
| React inbox and score page | ~4h |
| Integration debugging | ~2h+ |

- Risk: x402 package or version friction for a team new to Stellar.

**Biggest uncertainty.**
- **Two-sided adoption.** Why would legitimate senders pay? The answer: Stamp is a *priority lane*, not a gate, and bonds are refunded for good senders. Judges may still doubt it. [S]
- **Pattern-matching.** Judges may dismiss it as "yet another x402 build", given how many there were at the Agents hackathon.

**Evidence summary.**
- [V] x402 on Stellar; Scout whitespace for inbox/outreach bonds.
- [A] Outreach volume growth; card-fee floor.
- [S] Willingness to pay.

---

## WI-4: "Always For Sale": Harberger-taxed sponsor slots that fund open source

**One-sentence hook.**
- The sponsor slot at the top of a popular GitHub README is *always* for sale, at the price its current holder declares.
- The holder pays a continuous per-second tax to the maintainers.
- Anyone can buy the slot out in one click.

**Target user.**
- Maintainers of mid-popularity open-source projects (roughly 1k–50k stars), including Stellar ecosystem SDKs.
- On the other side: devtool startups that want developer attention.

**Problem.**
- **About 60% of open-source maintainers are unpaid** (Tidelift 2024). [V] ([TFiR](https://tfir.io/tidelift-study-reveals-that-60-of-maintainers-still-dont-get-paid-for-their-work/), [The Register](https://www.theregister.com/2024/09/18/open_source_maintainers_underpaid/))
- Sponsor deals are negotiated by hand, priced arbitrarily, and sticky. Slots are either empty or underpriced for years. [A]

**Proposed solution (MVP).**
1. **One Soroban contract per slot**, storing: holder, self-assessed price, tax deposit, last settlement time, tax rate, and content (logo URL plus link).
2. **Contract functions:**

   | Function | What it does |
   |---|---|
   | `buy(new_price, content)` | Pays the current holder their declared price atomically, settles accrued tax, and installs the new holder |
   | `set_price` | Changes the declared price |
   | `top_up` | Adds to the tax deposit |
   | `withdraw_tax` | Maintainer withdraws accrued tax; can be split across contributors |
   | Foreclosure | When the deposit runs out, the slot reverts to the default |

3. **Badge.** A GitHub Action (cron, or triggered on a contract event) reads contract state through RPC and rewrites the README sponsor block or serves an SVG.

**Stellar integration.**
- Soroban (time-based accrual from the ledger timestamp), USDC via SAC, Freighter, and Stellar RPC events.
- **Why blockchain is essential:**
  - A neutral custodian that *must* execute the forced sale and pay out, with no platform that could freeze or renegotiate.
  - Global sponsors and maintainers paid in stablecoins with no merchant account.
- Moderately essential: a Stripe platform could approximate it. **This is the weakest essentiality argument of the four.**

**Track fit.**
- Stellar Unlocked: weak to medium (plain Soroban).
- Composed: weak (Soroban, SAC and Freighter are table stakes).
- **This is the weakest track alignment of the four.**

**Why almost nobody else will build this, and prior-art results.**
- Scout searches for "harberger" and "sponsor slot readme" returned 0 relevant Stellar builds. [V via Scout search, 2026-10-25]
- Off-Stellar, Harberger mechanisms exist: *This Artwork Is Always On Sale* (Simon de la Rouviere, 2019, priced in ETH) and the *Radical Markets* book. [V] ([Outland](https://outland.art/artists/simon-de-la-rouviere), [Wikipedia](https://en.wikipedia.org/wiki/Harberger_Tax))
- Applying the mechanism to open-source sponsor slots is novel as far as I found [S].

**Demo (90 seconds).**
- **0–15s:** The team's own repo README shows "Your logo here: €20, 10%/month tax".
- **15–40s:** Sponsor A buys the slot at €20 and declares €100. The README updates, and the maintainer's tax ticker counts up every second.
- **40–65s:** Sponsor B buys it out instantly. **A receives €100 automatically**, and B's logo replaces A's. **This is the memorable moment: a live hostile takeover of a README.**
- **65–80s:** The maintainer withdraws the accrued tax.
- **80–90s:** *"Prices discover themselves. Maintainers get paid every second."*

**15-hour feasibility.** High.

| Work item | Estimate |
|---|---|
| ~250-line contract plus accrual tests (`env.ledger().set_timestamp`) | ~5h |
| React UI | ~4h |
| GitHub Action badge updater | ~2h |
| Demo | ~2h |

- A good on-ramp for learning Soroban.
- GitHub's image proxy (camo) caches images, so updates should be README commits, not a live image.

**Biggest uncertainty.**
- **Real demand.** Will sponsors accept forced-sale risk? Harberger systems have had little adoption in practice [S].
- **Market & Ecosystem Potential** (10%) and **Track Alignment** (20%) are both weakest here.

**Evidence summary.**
- [V] Tidelift 60% unpaid; Harberger prior art; Scout whitespace.
- [A] Sponsor-deal friction.
- [S] Demand.

---

## Quick comparison (my own view, before debate)

| | WI-1 Loop | WI-2 Second Thought | WI-3 Stamp | WI-4 Always For Sale |
|---|---|---|---|---|
| Domain | Small-business finance / coordination | Consumer protection / elder care | AI agents / attention economy | Open-source funding / mechanism design |
| Track | **Unlocked**, strong | **Unlocked**, strong | **Composed**, strong | Weak |
| Surprise factor | Very high | High | High | High |
| Prior art on Stellar | Problem yes (2 ZK builds, no awards); mechanism no | None found | None found | None found |
| Build risk (15h) | Low–medium (spike needed) | Low | Medium–high | Low |
| Rust/Soroban needed | No | No | Yes | Yes |
| Memorable moment | Debt vanishes in one circular transaction | "Guardian can undo, never spend" | Earning money from spam live | Live README buy-out |

**Ideas I considered and discarded:**
- **Exploit-canary bug bounties:** the economics fail for black-hat attackers.
- **City treasure hunt using hash(x) signers:** weak user value.
- **Verifiable housing-lottery sortition:** blockchain essentiality is arguable.
- **Parametric quake aid:** parametric insurance already built (ClaimProof, LumenSure).
- **Dead-man's-switch inheritance:** Obol and Boreal Pulse already exist.
- **Crowdfunding with dominant assurance:** the crowdfunding category is saturated.
- **Offline payments:** PayPulse and AbotPera already exist.

---

## Sources

**Official and protocol**
- HackMeridian build page (tracks, criteria, idea examples): https://www.hackmeridian.com/build
- Stellar claimable balances guide (predicates): https://developers.stellar.org/docs/build/guides/transactions/claimable-balances#additional-parameters
- Stellar list of operations (ClaimClaimableBalance, Threshold: Low): https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations#claim-claimable-balance
- Stellar multisig and thresholds: https://developers.stellar.org/docs/learn/fundamentals/transactions/signatures-multisig#thresholds
- Stellar hash(x) signer: https://developers.stellar.org/docs/learn/fundamentals/transactions/signatures-multisig#hashx
- Stellar CLI delegate-spending guide (low-threshold co-signed vault): https://developers.stellar.org/docs/tools/cli/agent-cli/guides/delegate-spending#pattern-1-a-co-signed-vault
- Stellar path payments guide: https://developers.stellar.org/docs/build/guides/transactions/path-payments#path-payment-strict-send

**Prior art (Scout hackathon-builds index, queried 2026-10-25)**
- SettleZK: https://dorahacks.io/buidl/46011 (GitHub: https://github.com/McYeremia/settlezk)
- zkNexus: https://dorahacks.io/buidl/46452 (GitHub: https://github.com/shane2512/zkNexus.git)

**Market and context**
- Slovenia AJPES multilateral set-off (ePOBOT): https://www.gzs.si/zbornica_racunovodskih_servisov/Novice/ArticleId/47813/arhiv--epobot-ajpes--2-2-2011-bo-potekalo-vecstransko-pobotanje-medsebojnih-obveznosti and https://mondaq.co.uk/eu-law/127460/act-on-prevention-of-late-payments-in-force-since-16-march-2011
- Fleischman et al. (obligation clearing): https://researchonline.lse.ac.uk/view/creators/Fleischman=3AToma==017E=3A=3A.html
- IC3 2024 crypto losses for ages 60+: https://www.theblock.co/post/351746/fbi-says-americans-over-60-lost-nearly-3-billion-to-crypto-scams-in-2024 and https://trmlabs.com/resources/blog/a-record-breaking-year-for-cybercrime-key-findings-from-the-fbis-2024-ic3-report
- UK APP fraud 2024 and reimbursement: https://www.edgardunn.com/articles/one-year-on-uks-app-fraud-reimbursement-rules and https://fstech.co.uk/fst/PSR_Reveals_88_Of_Money_Lost_To_APP_Scams_Reimbursed.php
- x402 on Stellar: https://cdn.jsdelivr.net/npm/@x402/stellar@2.20.0/README.md and https://deepwiki.com/OpenZeppelin/relayer-plugin-x402-facilitator
- Tidelift maintainer survey: https://tfir.io/tidelift-study-reveals-that-60-of-maintainers-still-dont-get-paid-for-their-work/ and https://www.theregister.com/2024/09/18/open_source_maintainers_underpaid/
- Harberger prior art: https://outland.art/artists/simon-de-la-rouviere and https://en.wikipedia.org/wiki/Harberger_Tax
