# 08 — Due diligence, Section D: Demo quality (Wildcard Inventor)

Written Sun 2026-10-25, ~14:00 WET, for the three finalists: F1 Second Thought, F2 Loop and F3 Heirloom.

**Evidence labels**
- **[V]**: verified, with a link or a testnet transaction from the Architect's spikes (a–g, logged in `06_debateA_stellar_architect.md` and the Round B logs).
- **[A]**: assumption.
- **[S]**: speculation.
- **[U]**: unknown dependency.

## Rules shared by all three demos (reproducibility contract)

1. **One hosted URL** (static frontend). No Freighter, no browser extension and no seed phrase for the judge.
2. **A "Seed demo" button** builds a fresh, isolated scenario for each browser session:
   - one friendbot call funds a *funder* account;
   - the funder creates every role account in **one** `createAccount` batch transaction, which avoids friendbot rate limits [A];
   - the funder issues a **self-issued test "USDC"** asset, because Circle's faucet is captcha-only (T7 in `04_judging_framework.md`) [V];
   - trustlines and signer setup follow.
3. **In-app keys** are kept in `localStorage`, and a **role switcher** tab bar lets one person play every role. Keys are testnet-only, and a visible label says so.
4. **Demo time compression.** A `demo` flag replaces long windows with short ones (24h → 60–120s, 180d → 30–45s). The flag is shown on screen: "demo window: 60 s (production: 24 h)".
5. **Countdowns are computed from the ledger close time, not the browser clock.** The app reads the latest ledger `closed_at` from Horizon and adds a 5s safety buffer.
6. **Every on-chain step shows its tx hash with a stellar.expert (testnet) link.** Every network rejection shows the raw result code (`op_cannot_claim`, `op_bad_auth`, `tx_bad_minseq_age_or_gap`, …) in a red "Rejected by the Stellar network" card. This makes the "only on Stellar" moment visible, as the judges asked.
7. **A one-command reseed script and a README "If something is down" section** cover testnet resets (T8) and TTL archival (T9).
8. **The video is recorded from the hosted URL on live testnet**, with no slides during the product section (Judge §8). Any time skip gets an on-screen "⏩ 60 s later" label.

---

## F1: Second Thought (Hi Mum scam protection)

### 90-second script

| Time | Screen | Voice-over / caption | Stellar functionality shown |
|---|---|---|---|
| 0–8s | A WhatsApp-style message: *"Hi Mum, I dropped my phone, this is my new number. Can you send €900 for rent today? x"* Caption: **"Illustrative persona: Ana, 61."** | "In 'Hi Mum' scams, people 55+ make 82% of reports and bear 95% of the losses." (ACCC [V]) | — |
| 8–12s | Title card: "Second Thought. The person being impersonated is the one who can stop it." | | — |
| 12–24s | **Mum** tab, balance 1,000 USDC (test). She pastes the "new number's" address and taps Send €900. A yellow banner: "New recipient: protected for 24 h (demo 60 s)." The tx link appears. | "Ana pays. Because it's a new recipient, the money leaves her balance, but it can't be collected yet." | `CreateClaimableBalance` with predicate `NOT(BEFORE_ABS(T))` for the recipient and unconditional for Mum. Co-signed by Mum (w2) + policy (w1) = 3. [V spike f, 167349e9] |
| 24–34s | **Stranger** tab. He taps "Claim €900". A **red card: "Rejected by the Stellar network: op_cannot_claim"**, plus a countdown. | "The scammer tries to collect. Stellar's validators refuse. Not us: the network." | `ClaimClaimableBalance` → `op_cannot_claim` [V spike a] |
| 34–48s | **Daughter (guardian)** tab. A notification: *"Mum sent €900 to a NEW recipient."* She thinks "That's not my number!", taps **Undo**, and Mum's balance animates back to 1,000. A tx link appears. | "Her real daughter gets the alert, and she knows instantly it wasn't her." | Guardian-sourced tx, op source = Mum, `ClaimClaimableBalance`. Funds go back to Mum, and Mum's sequence is unchanged. [V spike e/f, e4066132] |
| **48–58s** | **MEMORABLE MOMENT.** Caption: "So… can the daughter just take Mum's money?" The guardian taps "Send Mum's €1,000 to me". **Red card: op_bad_auth.** | "She can undo. She can never spend. Even if our server is hacked too." | Guardian + policy = 2 < 3 → `op_bad_auth` [V spike f] |
| 58–70s | An "Another wallet" panel (simulates the scammer saying "install this app and import your key"). A raw payment signed with Mum's key alone → **red card: op_bad_auth.** | "Scammers tell victims to install another app. Mum's key alone can't move a cent." | Mum alone, weight 2 < medium 3 [V spike f] |
| 70–80s | **Mum** pays her real son's saved address. It's instant, with a tx link. | "Known people get paid instantly. Friction only for strangers." | `Payment` with Mum + policy co-sign [V spike f, 85aeea3b] |
| 80–90s | End card with three icons: claimable balance · multisig thresholds · no smart contract. | "Coinbase-style transfer protection without Coinbase holding your money, on the plain Stellar account you already have." | — |

The "does NOT stop" list goes in the deck and README, not into these 90 seconds (agreed with the Judge in Round B).

### How judges reproduce it (no Freighter)
1. "Seed demo" creates **Mum, Daughter, Stranger and Son**, issues 1,000 test USDC to Mum, and runs `setOptions`: Mum w2, policy w1, guardian w1, thresholds 1/3/3. Son is pre-allowlisted.
2. The **demo window defaults to 120s**. 60s is too short for a judge who is reading the screen [A]. The window can be configured in the UI.
3. A **pre-seeded pending payment** lets the judge try "Undo" and "Stranger claim → rejected" immediately, even if they skip step 1 of the story.
4. A **"Play the story" guided mode** puts numbered hints on the role tabs.
5. If the 120s window expires, the Stranger *can* claim. The UI explains this: "window passed, this is what happens without a guardian". So letting it expire is also a valid demo path.

### Failure points → mitigations

| # | What breaks | Likelihood | Mitigation |
|---|---|---|---|
| 1 | Policy co-signer down or cold-starting during async judging (Mon 12:00 → Wed) | Medium | Health badge (green/red). **Family mode**: Mum + guardian = 3 signs without the server [V spike f, de4ecad5]. The hero beat (claim rejected → Undo) **never needs the server** [V]. An uptime ping keeps it warm. The README has a "badge red → Family mode" line. |
| 2 | Friendbot outage or rate limit | Low–Med | One friendbot call per seed (funder pattern). A fallback pre-funded funder key sits in server env, never in the repo. |
| 3 | Testnet reset wipes accounts | Low in the window [A] | The seed button rebuilds everything per session. The reseed script is for the video account set. |
| 4 | `tx_bad_seq` from rapid clicks (stale sequence) | Medium | Reload the account before every build, serialize submissions per account, and disable buttons while pending. |
| 5 | The countdown disagrees with the network (browser clock skew) | Medium | Compute T from the ledger `closed_at` plus a 5s buffer. On `op_cannot_claim` near the edge, show "try again in N s". |
| 6 | The claimable-balance ID isn't known to the UI | Low | Compute it from the tx result XDR, or query Horizon `/claimable_balances?claimant=`. |
| 7 | Horizon streaming flaky (guardian alert never arrives) | Medium | Poll every 3s. The alert is UI-only; the undo works regardless. |
| 8 | A judge clears `localStorage` and loses keys | Low | "Seed demo" again (cheap). |
| 9 | The policy secret leaks via repo or bundle | Process | Server env only; the seed generates keys at runtime. The README has a Security note (Judge, Round B). |
| 10 | XLM reserve shortfall on Mum (each claimable balance locks reserve) | Low | The funder over-funds Mum. Sponsored reserves are optional [V spike f, 0f7b18bd]. |

### Ratings
- **Memorable: 5/5.** "The impersonated daughter undoes it" plus "she can't spend it" gives two human-legible network refusals. A non-crypto judge gets it in 10 seconds [A].
- **Reproducible: 4/5.** Everything is in-app and short-windowed. The single soft spot is the policy server, and it is mitigated by Family mode.

---

## F2: Loop (debt cycles cancelled by one path payment)

### 90-second script

| Time | Screen | Voice-over / caption | Stellar functionality shown |
|---|---|---|---|
| 0–10s | Three shopfronts. Caption: **"Illustrative: a bakery, a café, a flour mill in Lisbon."** Invoice cards: Café owes Bakery €600, Bakery owes Mill €600, Mill owes Café €600. | "Three businesses, €1,800 of unpaid invoices, and each one is waiting on the next." | — |
| 10–22s | A graph view: 3 nodes, 3 arrows labelled with IOU balances. Hovering an arrow shows "BAKERY-IOU held by Mill, credit line €1,000 (trustline limit)". | "On Stellar, each business issues its own IOU. A trustline is a credit line." | Asset issuance, trustline limits [V spike b] |
| 22–34s | Each firm clicks "Join netting" (three quick clicks). An order-book panel shows three passive offers at price 1.0. | "Each firm agrees once: 'I'll accept my own IOU back in exchange for a claim I hold.'" | `ManagePassiveSellOffer` at price 1 [V spike b] |
| **34–52s** | **MEMORABLE MOMENT.** One big button: "Clear loops". The arrows shrink to zero in an animation. A counter: **"€1,800 of debt cancelled · €0 moved."** | "One transaction. The money went round in a circle and the debt disappeared." | Horizon `strictSendPaths` finds the cycle [V spike b]. One `path_payment_strict_send` where source = destination [V spike b, fce43284] |
| 52–66s | Stellar.expert opens on that tx: a single operation, from Bakery to Bakery, path [MILL-IOU, CAFE-IOU]. | "This is the whole clearing house: one operation on Stellar's built-in exchange." | Explorer link |
| 66–78s | An uneven 4th invoice (Café owes Bakery €200 extra). Clearing leaves a residual, and "Settle residual" pays €200 test USDC. | "Only the net difference ever needs real cash." | Second payment / path payment |
| 78–90s | End card | "Slovenia runs this monthly through a state agency. Stellar's DEX did it in five seconds, with no clearing house." | — |

### How judges reproduce it (no Freighter, no server)
1. "Seed scenario": one friendbot call funds a funder, which creates 3–4 firm accounts in one batch transaction. Each firm issues its IOU, and trustlines are set with limits. The invoices are seeded as IOU payments, and netting offers are placed: roughly 15–20 operations, batched into ≤4 transactions.
2. There is **no server in the trust path**; everything runs in the browser via Horizon [V spike b]. This is the most reproducible of the three.
3. A "Randomize invoices" option lets a judge see a different cycle and a different cleared amount, which proves it isn't canned.

### Failure points → mitigations

| # | What breaks | Likelihood | Mitigation |
|---|---|---|---|
| 1 | Horizon pathfinding returns no path (indexing lag right after offers are placed) | Medium | Retry after 1–2 ledgers. Fallback: client-side DFS builds an explicit `path` array, which works because the graph is known locally. |
| 2 | Amount or rounding mismatch at price 1 (7-decimal assets) | Low–Med | Integer amounts only. `destMin` = sendAmount. Clear min(edge) only. |
| 3 | Path-length cap: at most 5 intermediate assets [A, from memory] | Low | The demo uses ≤4 firms. The README states the limit. |
| 4 | Offer liabilities stale after new invoices, so the clear fails partway | Medium | Invoice acceptance updates the offer in the same tx. The demo seeds fresh offers before the clear. |
| 5 | Third-party offers interfere | Low | The IOUs are unique per scenario, so nobody else trades them. |
| 6 | Testnet reset | Low | The seed is per session. |
| 7 | **Comprehension:** a judge doesn't follow 3 hops in 18s | **High** | The graph animation must carry it. Caption every arrow in plain words ("Café owes Bakery €600"). Never show IOU codes before second 52. |

### Ratings
- **Memorable: 4/5.** "Debt vanishes, €0 moved" is a striking image, and protocol-literate judges will love the self-payment trick. But it lands only if the animation is excellent; a non-crypto judge may not see why it matters [A].
- **Reproducible: 5/5.** It needs no server, no waiting window and no third-party service. Seed and click.

---

## F3: Heirloom standalone (access recovery after silence)

### 90-second script

| Time | Screen | Voice-over / caption | Stellar functionality shown |
|---|---|---|---|
| 0–10s | **"Illustrative: João, 44, freelancer, holds his savings in USDC on Stellar."** A phone in a drawer, then a hospital-bed silhouette (keep it gentle). | "If João loses his phone, or something happens to him, his family can never reach his money. No bank, no 'forgot password'." | — |
| 10–24s | **Owner** tab: "Create recovery plan". Heir = his sister; "unlock after **45 s** of inactivity (production: 180 days)". He signs once. A QR code / "plan file" appears. Caption: **"His money never moves."** | "He signs one transaction today. His funds stay in his own account." | Pre-signed `SetOptions` (adds the heir signer), with seq = S+2³², `minSeqNum` = S, `minSeqAge` = 45 s [V spike c] |
| 24–34s | **Heir** tab: "Use recovery plan" → **red card: tx_bad_minseq_age_or_gap**, plus a countdown read from Horizon `sequence_time`. | "His sister tries now. The Stellar network itself says: not yet." | Fee-bump of the pre-signed tx → `tx_bad_minseq_age_or_gap` [V spike c] |
| **34–48s** | **MEMORABLE MOMENT.** Owner tab: João buys a coffee (any payment). On the heir tab, **the countdown snaps back to 45 s.** | "Every time João uses his account, the clock resets. Living *is* the heartbeat: no check-ins, no app to remember." | Owner tx updates `seqTime` [V spike c: still rejected 20 s after activity] |
| 48–56s | A **"⏩ 45 s later"** label (a real wait; the cut is labelled). | "João goes silent." | — |
| 56–72s | Heir submits again: green, with a tx link. Stellar.expert shows the sister added as a signer. She moves the USDC to her account. | "Now the network accepts the plan. His sister can reach the savings." | Fee-bumped tx accepted [V spike c, 3932dad7] |
| 72–84s | A second plan: the owner taps "Cancel plan" (one `BumpSequence`), and the heir's submit gets **tx_bad_seq**: dead forever. | "Changed your mind? One tap, and the old plan can never work again." | `BumpSequence` revocation [V spike c] |
| 84–90s | End card | "Time-locked recovery enforced by Stellar validators. No contract, no custodian, no check-in app." | — |

### How judges reproduce it
1. "Seed demo" creates Owner (with test USDC) and Heir. **It also sends one initial tx from Owner**, because accounts that have never transacted have no `seqTime`, so `minSeqAge` would pass instantly (Architect trap 11 [V probe]).
2. The demo window defaults to **30–45s**. The judge has to *wait* that long; the countdown makes the wait part of the show.
3. **No server is needed.** The heir pays the fee via fee-bump [V spike c].

### Failure points → mitigations

| # | What breaks | Likelihood | Mitigation |
|---|---|---|---|
| 1 | Uninitialised `seqTime`, so the "not yet" refusal never appears (instant success) | High if forgotten | The seed always makes one owner tx first. Assert `sequence_time` is present before enabling the plan. |
| 2 | A judge clicks something on the Owner tab while waiting, so the timer resets and confuses them | Medium | That *is* the feature. A toast explains it: "Owner activity reset the timer." The Owner tab is greyed during "silence" in guided mode. |
| 3 | Clock skew between countdown and network | Medium | Countdown from Horizon `sequence_time` plus ledger `closed_at`, with a 5s buffer. |
| 4 | Fee-bump construction errors (inner/outer signatures) | Low–Med | Already working in spike c [V]; reuse that code. |
| 5 | Pre-signed tx lost (`localStorage` cleared) | Low | Download as a file/QR, and re-create it in the demo. |
| 6 | Testnet reset | Low | The seed is per session. |
| 7 | Freighter signing a far-ahead seqNum | N/A | In-app keys, so it doesn't matter [U for Freighter only]. |

### Can F3 produce a convincing video? Honest assessment
- **Partly.** The mechanism is visual: a refusal, the countdown resetting on activity, then acceptance. The 30–45s demo windows make the whole arc fit in 90 seconds with **one labelled time skip**. That skip is legitimate, but it is still the moment where viewers have to trust the cut.
- **The core value is "nothing happens for 180 days".** In the video that is simulated, and a skeptical judge knows it. F1 and F2 show *real* outcomes at real speed (F1's undo is instant, and F2's clearing is one tx).
- **The emotional payoff is muted.** "The sister becomes a signer" is abstract next to "Mum's €900 is back". And the death framing risks being morbid. The **lost-phone framing** is safer and more relatable.
- **The memorable moment is good but niche.** "Coffee resets the clock" is clever. It is still weaker than F1's "the impersonated daughter undoes it, but can't spend it".

### Ratings
- **Memorable: 3/5.** One clever beat; abstract payoff; one time skip.
- **Reproducible: 4/5.** No server, but the judge must wait about 30–45s and must not touch the Owner tab. The `seqTime` initialisation trap is real but scripted away.

---

## Summary table

| Finalist | Memorable | Reproducible | Server in demo path | Signature on-screen proof | Biggest demo risk |
|---|---|---|---|---|---|
| **F1 Second Thought** | **5** | 4 | Yes (policy co-signer); Family mode and undo work without it | `op_cannot_claim`, then Undo, then `op_bad_auth` ×2 | Server liveness during async judging |
| **F2 Loop** | 4 | **5** | No | One self-to-self `path_payment_strict_send` on the explorer | Judge comprehension of a 3-hop graph |
| **F3 Heirloom** | 3 | 4 | No | `tx_bad_minseq_age_or_gap`, then reset, then accept | "Waiting" needs a time skip; abstract payoff |

**Demo-quality verdict:**
- F1 has the strongest demo. Its refusal moments need no explanation, and its hero beat survives a server outage.
- F2 is the most robust technically, but it lives or dies on the animation.
- F3 works as a 15-second beat inside F1 (the flagged recovery hatch) better than as a standalone 90-second video.
