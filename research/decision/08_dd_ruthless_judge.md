# 08: Due diligence, Section E: kill criteria (Ruthless Judge)

Written Sun 2026-10-25, around 13:45 WET.

**Finalists**
- F1: S1 Second Thought, full spec.
- F2: S2 Loop.
- F3: S3 Heirloom, standalone.

**Labels:** [V] verified (link or testnet tx), [A] assumption, [S] speculation, [U] unknown.

**Verdicts:** PASS = no material problem. PENALIZE = scored down, still viable. KILL = the idea should not be built.

**Testnet evidence** comes from the Architect's spikes a–f (tx hashes in `00_chairman_log.md` and `06_debateA_*`), which the Chairman checked against raw outputs.

---

## E1. F1: S1 Second Thought (2-of-3 policy co-signer + claimable-balance undo window + guardian undo)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Critical integration can't be verified | **PASS** | Every guarantee in the final table is verified on testnet: integrated spike f, 13:21 UTC, txs 85aeea3b, 167349e9, e4066132, de4ecad5, 0f7b18bd. The checks returned `op_bad_auth` for Mum alone, for guardian + policy paying, and for guardian + policy changing signers; `op_cannot_claim` for an early claim. Undo with the guardian as transaction source leaves Mum's seq and seqTime unchanged (02e300ef) [V]. Still to do: one hosted end-to-end run behind the deployed URL [U, ~30 min]. |
| 2 | MVP needs infrastructure built from scratch | **PENALIZE (light)** | It needs a small policy co-signer service (allowlist + claimable-balance predicate check + signing; ~5h estimated) [A]. That is not "from scratch infra" in the kill sense, but it is a key-holding backend in the trust path and a liveness risk during async judging (Crux 6). Mitigations: undo needs no server (guardian, low threshold [V spike e/f]), a Family-override mode (Mum + guardian = 3 [V de4ecad5]), a health badge and a reseed script. If the Architect picks serverless, this becomes PASS but criterion 4 below gets worse. |
| 3 | Stellar interaction is superficial | **PASS** | It uses native multisig weights and thresholds, claimable balances with time predicates, and op-source vs tx-source authorization. The protocol enforces "no single key moves funds" and the claim window [V]. No contract is needed. Track Alignment ≈ 4.5 (Unlocked). |
| 4 | Innovation already exists without meaningful differentiation | **PENALIZE** | **Coinbase Vault** (2014): 48h delay + cancel + multiple approvers, now "Transfer protection" [V https://www.coinbase.com/vault]. **LOBSTR Vault**: an n-of-m co-signer with push approval on Stellar G-accounts [V https://github.com/Lobstrco/Vault-iOS]. Also Casa/Unchained-style 2-of-3 custody [A]. The differentiation is real but narrow: post-send undo by a guardian who can never spend, plus friction only on new payees. Scout shows no claimable-balance undo build [V]. Innovation is 3/5. The pitch must name both Vaults (adopted). |
| 5 | User problem unclear | **PASS (with scope)** | Scoped to "Hi Mum" family impersonation: the ACCC says people 55+ make 82% of reports and suffer 95% of losses [V https://www.scamwatch.gov.au/about-us/news-and-alerts/accc-warning-of-suspicious-messages-as-%E2%80%9Chi-mum%E2%80%9D-scams-spike]. The impersonated child is the guardian [A, strong]. Unknowns: Stellar-specific scam incidence [U], and whether any wallet would ship it (Crux 2) [S]. The addressable base is ~719k funded USDC G-accounts [V Stellar Expert]. |
| 6 | Core workflow can't be shown end-to-end before submission | **PASS** | All demo beats are on testnet within seconds: send to a new payee becomes a claimable balance → the stranger's early claim is refused → the guardian taps Undo → funds return; Mum's key alone in another wallet is refused. Uses a self-issued demo USDC (the Circle faucet is captcha-only) [V trap T7]. ~12–13h before polish [A, Wildcard plan]. |
| R1 | Red flag: AI-twin convergence | **PENALIZE (light)** | All four agents ranked it #1 on their own [V internal]. Mechanism prior art on Stellar is clean [V Scout], but "elder-safe wallet" as a domain will have twins, usually AI scam detection [S]. |
| R2 | Red flag: judges need a wallet setup | **PASS** | In-app keypairs with a role switcher; no Freighter needed [A, plan]. |
| R3 | Red flag: over-claiming | **PASS (after fixes)** | Removed: "protocol-enforced" for the payee rules, "Coinbase proved", and "LOBSTR proved". Added a "does not stop" slide (pig butchering, money lost before it reaches the wallet, coaching both Mum and the guardian, a thief with Mum's unlocked phone paying known payees) [adopted by Wildcard]. |
| R4 | Red flag: crowded category | **PENALIZE (light)** | Wallets: 89 prior builds / 6 winners [V Scout hybrid search]. Mitigated if pitched as a feature for LOBSTR-class wallets, not a new wallet. |

**F1 verdict: NO KILL.** There are three light penalties (backend liveness, prior art with a narrow delta, AI-twin/crowded domain). Provisional ≈ 78.

---

## E2. F2: S2 Loop (DEX/path-payment multilateral debt netting)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Critical integration can't be verified | **PASS** | An A→A `path_payment_strict_send` through [BIOU] cleared a 3-firm cycle atomically (tx fce43284…), and Horizon `strictSendPaths` found the path itself [V spike b]. Untested: 4–6-party loops and the path-length cap [A]. |
| 2 | MVP needs infrastructure built from scratch | **PASS for the MVP / PENALIZE for reality** | The MVP needs only a seeding script, a cycle finder and a graph UI [A]. But a real deployment needs a platform that already holds the invoice graph and onboards a whole cycle at once. That doesn't exist, and we would have to build it [S]. |
| 3 | Stellar interaction is superficial | **PASS (strongest of all)** | Issued IOUs + trustline limits as credit lines + SDEX offers + a self-to-self path payment as the clearing engine. This matches the organizers' "old-school assets, new tricks" prompt almost word for word [V /build]. Track Alignment 5. |
| 4 | Innovation already exists without meaningful differentiation | **PASS (with caveat)** | The *problem* has Stellar prior art (SettleZK, zkNexus, both ZK-based, no awards) [V Scout]. Netting is an old practice: Slovenia's AJPES, Sardex, treasury netting centres [V]. Trustline "rippling" is the Ripple-era credit-network concept [A]. The *mechanism* on Stellar's DEX appears unbuilt [V Scout]. Innovation 5. |
| 5 | User problem unclear | **PENALIZE (heavy), conditional KILL** | The evidenced Portuguese pain is **linear** late-payment chains: 60% of firms delay payments because they are paid late [V DN/Intrum]. Netting does nothing for linear chains. Cycles are evidenced at network scale (Sardex: 1,477 firms; ~25% debt reduction) [V], not in a hand-onboarded 5-firm cluster [S]. Firms won't publish payables, which is why the prior builds went to ZK [V/A]. One firm alone gets zero value until its whole cycle is on-chain (Wildcard conceded). Both the Problem Hunter and the Architect bet against Crux 4. **KILL if the team's SME call finds no closed cycle OR refuses a pseudonymous public graph.** |
| 6 | Core workflow can't be shown end-to-end before submission | **PASS** | Seed 5 firms → invoices → "Clear loops" → edges shrink → explorer shows one self-payment → residual settled. All testnet, no server, no Rust [V spike b; A for UI]. |
| R1 | Red flag: no visible end user / "my mom" test | **PENALIZE** | B2B; a treasurer or SME owner with no consumer touchpoint. Wlad: "not just another DeFi complex product" [V-verbal]. |
| R2 | Red flag: comprehension in ≤3 min | **PENALIZE (light)** | A 3-hop IOU graph needs an excellent animation [A]. |
| R3 | Red flag: legal / accounting of firm IOUs | **PENALIZE (light)** | E-money and assignment-of-receivables treatment is [U]. Present it as out of scope. |

**F2 verdict: NO KILL yet, conditional KILL on the SME call (criterion 5).** Provisional ≈ 74.5. With UV at 2 it cannot beat F1 unless the call finds a real closed cycle that accepts a public graph.

---

## E3. F3: S3 Heirloom standalone (CAP-21 `minSeqAge` pre-signed recovery, two-stage will)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Critical integration can't be verified | **PASS / PENALIZE (wallet)** | The mechanism is verified: early claim → `tx_bad_minseq_age_or_gap`; owner activity resets the clock; accepted after the window via fee-bump (3932dad7); revocation via BumpSequence → `tx_bad_seq`; two-stage will (3eefd5f8, d5b4dd19) [V spikes c/d]. **Freighter signing an XDR with seq S+2³² plus preconditions is [U].** The fallback is in-app keys, but then "use your existing wallet" is not demonstrated. |
| 2 | MVP needs infrastructure built from scratch | **PASS** | No contract and no server; a frontend plus Horizon only [A]. Lowest build risk of the three (~14h with slack). |
| 3 | Stellar interaction is superficial | **PASS** | Pure CAP-21 preconditions + SetOptions + BumpSequence + fee-bump. Track Alignment 5 (Unlocked). |
| 4 | Innovation already exists without meaningful differentiation | **PENALIZE** | **Off-Stellar, the same idea already ships: Liana (Wizardsardine), a Bitcoin wallet with network-enforced timelocked recovery paths that unlock after a period of inactivity, where "refreshing" coins resets the clock** [V https://blog.bitbox.swiss/en/exploring-bitcoin-miniscript-with-liana-and-the-bitbox02/ , https://www.linuxlinks.com/liana-bitcoin-wallet/]. That falsifies the pitch line "impossible elsewhere without a contract + keeper". On Stellar there are 4+ inheritance builds (Obol, Boreal Pulse, Heritaz, Legacy Suite, Heritage Protocol) [V Scout]; their mechanisms differ (contract or check-in). The differentiation that remains: account-level (all assets including USDC), any outgoing tx is the heartbeat (no per-coin refresh), one-op revocation, no contract. That is real but incremental. Innovation 3–3.5. |
| 5 | User problem unclear | **PENALIZE (heavy)** | The evidence is old and generic (Cremation Institute 2019–20: 89% worry, 23% have a plan) [V via PH]. No Stellar-specific loss figure [U]. User count unknown (Architect conceded). The target user contradicts itself: cold holders are inactive by design, so they need a manual BumpSequence heartbeat, i.e. a check-in (conceded). The proposer folded it into F1 rather than defending it standalone. |
| 6 | Core workflow can't be shown end-to-end before submission | **PASS** | A 60-second window demo: claim rejected → owner pays coffee → countdown resets → silence → heir claims via fee-bump [V mechanics]. |
| R1 | Red flag: domain seen before | **PENALIZE** | Inheritance: 2 Scout-indexed builds / 0 winners [V hybrid search]. "Crypto inheritance" pitch familiarity was conceded. |
| R2 | Red flag: "too simple / no contract" perception | **PENALIZE (light)** | Mitigated by the two-stage will and a will-health panel [A]. |

**F3 verdict: NO KILL, but weakest.** Provisional ≈ 71–72, down from 73 because of the Liana prior art.

### Do I challenge the Chairman's F3 choice?
**Mild challenge, no objection to proceeding.** "A distinct concept as backup" is a sound principle, and F3 does hedge a different user problem. But due diligence now shows F3's two weakest criteria are User Value (heavy penalty) and Innovation (Liana is direct prior art). Its realistic role is a floor, not a contender.

If F1 dies, F2 or F3 would replace it. Neither scores above ~74.5. The more valuable due-diligence work is therefore making F1 robust: the hosted end-to-end run and the Architect's server/serverless decision.

---

## E4. Human-validation calls to make TODAY (3 questions each)

Rules: no fabricated testimonials. Record answers verbatim with consent. Personas stay labelled illustrative unless a real quote is approved.

### F1: the scam-targeted relative (tests Crux 1 and adoption)
1. **"Walk me through it: how did they first contact you, how long from the first message to the moment you sent money, how did you send it (bank transfer, card, crypto, app), and when and how did you realise?"**
   - Tests whether the payment went to a NEW recipient within hours (the 24h window bites) and the channel (does a self-custody wallet ever appear?).
2. **"If, within minutes of sending, your son or daughter had got an alert saying 'Mum sent €X to a new recipient — undo?', would they have recognised it as a scam, and would you have accepted them pulling the money back, or argued?"**
   - Tests the guardian-detection assumption and victim re-confirmation.
3. **"Would you accept that payments to new people arrive 24 hours later, if payments to people you already know are instant? Would you and your child set that up, and what would make you switch it off?"**
   - Tests friction tolerance and adoption.

Optional fourth question, for any wallet or LOBSTR contact (Crux 2): "Would you ship a 'new-payee undo window with a guardian who can't spend' as a feature, given LOBSTR Vault already co-signs?"

### F2: the SME cluster (tests Crux 4)
1. **"Right now, roughly who in this group owes whom, and how much? Is there a CIRCLE, where A owes B, B owes C, and C owes A (directly or through one more firm)? Or does money mostly flow one way?"**
   - Tests whether a closed cycle exists. If it is all linear chains, F2 is KILLED.
2. **"If a tool could cancel matching debts around the circle in one step, but a pseudonymous list of 'who owes whom, how much' had to sit on a public ledger, would you join? What if only your accountant or a platform could see the real names?"**
   - Tests acceptance of a public graph. A refusal KILLS F2 in its current design.
3. **"Who would you trust to run this, and would all the firms in the circle sign up together within a month? Today, when one of you pays late, what does it cost you: interest, a delayed supplier, a lost discount?"**
   - Tests cold start, the operator question and the size of the pain.

### F3 (optional; not requested, but cheap)
Ask any team acquaintance who self-custodies crypto:
1. "What happens to it if you lose your keys or die?"
2. "Would you accept that a pre-signed 'will' fires if you don't transact for 6 months?"
3. "How often do you actually send from that wallet?" This tests the heartbeat assumption.

---

## Summary verdicts
| Finalist | Kills | Penalties | Provisional score |
|---|---|---|---|
| F1 Second Thought | none | backend liveness (light), narrow delta vs Coinbase/LOBSTR Vault, AI-twin/crowded (light) | ≈ 78 |
| F2 Loop | **conditional** (user problem; decided by the SME call) | B2B/"mom" test, comprehension, legal | ≈ 74.5 |
| F3 Heirloom | none | user problem (heavy), Liana prior art, domain seen before | ≈ 71–72 |
