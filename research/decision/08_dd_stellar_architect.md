# 08 — Due diligence, Sections B (Stellar integration) and C (feasibility): Stellar Architect

Written 2026-10-25 ~13:35 WET.
- **Labels:** [V] verified (doc link or our testnet spike + tx hash), [A] assumption, [S] speculation, [U] unknown dependency.
- **Spikes:** scripts live in the session scratchpad. Results and hashes are in `06_debateA_stellar_architect.md` (a–f) and `07_debateB_stellar_architect.md` (g).

**Network facts [V, live probe 12:59 UTC]**
- Testnet and mainnet both run protocol 29. Testnet RPC 30.0.0, Horizon testnet P29.
- Repo: `@stellar/stellar-sdk` ^17.3 (contains every builder used below) and `soroban-sdk` 28 / `stellar-cli` 28.1.0.
- Every operation used by F1–F3 is a **classic** operation, available on testnet **and** mainnet unchanged. Only friendbot (account funding) is testnet-only.

**Soroban verdict for all three finalists:** no contract. Every guarantee F1–F3 claim is enforced by classic validator rules: thresholds, claimable-balance predicates, CAP-21 preconditions, DEX matching. A tiny contract would add Rust, deploy and TTL risk (Judge T9/T10) and **no judge-visible guarantee** we don't already have.
- One acceptable exception (not recommended): none of the three needs on-chain storage that classic `ManageData` can't provide.
- Leave `contracts/hello-world` in place, since CI already builds it, but don't mention it in the pitch. Optionally delete it in a PR so the repo doesn't look half-used.

---

## F1 — Second Thought (+ flagged Heirloom hatch)

### B. Stellar integration

**Account setup** (one tx, source = Mum; Mum, Policy and Guardian all sign in the demo-scenario builder):

| Op | Purpose | Threshold | Status |
|---|---|---|---|
| `Operation.setOptions({ signer: { ed25519PublicKey: POLICY, weight: 1 } })` | Policy co-signer | high | [V spike f, tx 7a8fbe48…] |
| `Operation.setOptions({ signer: { ed25519PublicKey: GUARDIAN, weight: 1 } })` | Guardian | high | [V spike f] |
| `Operation.setOptions({ masterWeight: 2, lowThreshold: 1, medThreshold: 3, highThreshold: 3 })` | Mum 2 / P 1 / G 1; 1/3/3 | high | [V spike f] |
| `Operation.manageData({ name: 'al:'+G…, value: '<unix ts>' })` | On-chain allowlist entry; active 24h after ts (see the policy function below) | medium | [V threshold per list-of-operations; not spiked] |

**Flows**

| Flow | Operations | Signers | Result we proved |
|---|---|---|---|
| Pay known payee | `payment` (or `pathPaymentStrictReceive` later) | Mum + Policy (3) | [V spike f, 85aeea3b…] |
| Pay new payee (protected) | `createClaimableBalance({ asset, amount, claimants: [ new Claimant(R, Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(T))), new Claimant(MUM, Claimant.predicateUnconditional()) ] })` | Mum + Policy | [V spike f, 167349e9…] |
| Stranger claims early | `claimClaimableBalance({ balanceId })` | Recipient | **`op_cannot_claim`** [V spike a] |
| Guardian **Undo** | tx **source = Guardian**, `claimClaimableBalance({ balanceId, source: MUM })` | Guardian only | Funds go back to Mum; Mum's seq and seqTime unchanged; fee paid by the guardian [V spikes e/f, 02e300ef…, e4066132…] |
| Mum reclaims herself | `claimClaimableBalance` (low) | Mum | [V by threshold; spike a variant] |
| Recipient claims after the window | `claimClaimableBalance` | Recipient (needs a trustline for non-native assets) | [V spike a, 9dc6c354…] |
| "Mum's key in another wallet" | any `payment` signed by Mum alone | Mum (2 < 3) | **`op_bad_auth`** [V spike f] |
| Guardian tries to pay herself, even with the server | `payment` signed by G + P (2 < 3) | — | **`op_bad_auth`** [V spike f]; changing signers is also `op_bad_auth` |
| Family override (server dead) | `setOptions({ signer: { POLICY, weight: 0 } })` | Mum + Guardian (3) | [V spike f, de4ecad5…] |
| Family sponsors CB reserve (optional) | `beginSponsoringFutureReserves` / `endSponsoringFutureReserves` sandwich | + family | [V spike f, 0f7b18bd…] |
| Heirloom hatch (flag) | pre-signed tx: `new Account(MUM, S+2^32−1)`, `.setMinAccountSequence(S)`, `.setMinAccountSequenceAge(180d)`, `.setTimeout(0)`, op `setOptions({ signer: { GUARDIAN, weight: 2 } })`. Guardian submits via `TransactionBuilder.buildFeeBumpTransaction(guardianKp, fee, inner, NP)` | signed now by Mum + Policy (high 3) | Rejected early (`tx_bad_minseq_age_or_gap`), accepted after the window, revoked by `bumpSequence` (`tx_bad_seq`) [V spikes c/d]. **Heartbeat on app open:** `bumpSequence({ bumpTo: '0' })`, low, Mum alone [V spike g, aa6f1a49…; inbound payments do NOT reset it, 5dc794fa…] |

**Reads (Horizon)**
- `server.claimableBalances().claimant(MUM).call()`: the pending list for both Mum and the guardian. The guardian's "alert" is this query polled every ~3s in the guardian tab [A: polling is simpler than streaming].
- `loadAccount(MUM)`: `signers`, `thresholds`, `data_attr` (allowlist), `sequence_time` (hatch health) [V field present, probe].

**Asset**
- Use a **self-issued demo dollar** (`USDx` or `TUSD`, issuer created by the scenario builder), or plain XLM.
- Circle testnet USDC needs the captcha faucet [V skill], which can't be scripted for judges.
- Mainnet would use Circle USDC (issuer `GA5Z…KZVN`) unchanged.

**Why Stellar is necessary or materially advantageous**
1. The post-send, recipient-gated, sender-reclaimable **pending payment** is a native ledger object (claimable balance with predicates). On EVM it needs a custom escrow contract or a Safe module, and the funds must move into it first [A].
2. Per-op-type weighted multisig on a plain account, plus **op-source ≠ tx-source** authorization, lets the guardian reverse but never spend. We proved this rather than assumed it [V spikes e/f].
3. Fees of fractions of a cent make a guardian-paid undo and a per-open heartbeat free in practice.

**Honest prior art to cite:** LOBSTR Vault (multisig co-signer app on Stellar) [V https://github.com/Lobstrco/Vault-iOS] and Coinbase Transfer Protection (custodial delay + cancel) [V https://help.coinbase.com/en-au/coinbase/getting-started/other/vaults-faq]. Claim only the delta.

**Docs:** claimable balances https://developers.stellar.org/docs/build/guides/transactions/claimable-balances · multisig and thresholds https://developers.stellar.org/docs/learn/fundamentals/transactions/signatures-multisig · operation thresholds https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations · preconditions https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions · fee-bump https://developers.stellar.org/docs/build/guides/transactions/fee-sponsorship · sponsored reserves https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves · CAP-21 https://github.com/stellar/stellar-protocol/blob/master/core/cap-0021.md

### Decision: server vs serverless

| | **S1-Lite (serverless)**: Mum 2 / Guardian 1, thresholds 1/2/2 | **S1-Full (policy co-signer)**: Mum 2 / Policy 1 / Guardian 1, thresholds 1/3/3 |
|---|---|---|
| Protocol-enforced claims | Stranger can't claim before T; guardian can undo; guardian can never spend; family-sponsored reserves | **All of Lite, plus:** Mum's key alone can't move money from any wallet; a phished or stolen key alone is useless; guardian + compromised server still can't spend; the family can remove our server |
| App-level only | The window itself. Mum (weight 2 = medium) can pay anyone from LOBSTR or Freighter and bypass it | Which payees count as "known" (allowlist + 24h cool-off) |
| Judge objection it invites | "Wallet default, not protection. Coached Mum opens another wallet." (Judge S1 W1: TA/Innovation hit) | "A key-holding server": answered by the family override and "the server alone can never spend" |
| Extra build | — | Policy function about 4h + allowlist about 1h + deploy and health about 1h, so **≈6 dev-h** |
| Async-judging risk | None (static site) | The function must be up Mon–Wed. Mitigated by a serverless function with no state and a README fallback |

**Recommendation: HYBRID, with S1-Full as the shipped target.**
- **Stage 1 (hours 0–6): build every flow against S1-Lite thresholds.** The tx builders for send, CB, undo, claim and reclaim are *identical* in both modes; Full only adds one extra signature, fetched from the server. This de-risks the demo early.
- **Stage 2 (from about hour 6): add the policy function and switch setup to 1/3/3.** That's one change in the scenario builder plus a `cosign(xdr)` call before submit.
- **Fallback:** if Stage 2 isn't green by Monday 06:00, ship Lite and **downgrade the claims** in the README and video: drop "Mum's key alone can't move money" and "a phished key is useless". Keep "can undo, never spend" and "can't claim early".
- **Why Full is worth about 6h:** its extra claims are exactly what answers the Judge's strongest S1 objection (window bypass from another wallet) and the Judge's TA/Innovation scoring. Without them S1 looks like "a wallet with a default delay".

**Policy function design: stateless, about 150 LOC, a Vercel/Netlify/Cloudflare function**
- **Input:** a tx XDR from the frontend.
- **Checks:**
  - tx source = a registered Mum account (in a demo the scenario builder registers any account whose signer list includes POLICY_PUBKEY, so no DB is needed);
  - every op is one of the following:
    - `payment` to a destination whose `data_attr['al:'+dest]` timestamp is ≥ 24h old (**allowlist and cool-off live on-chain in Mum's ManageData, so the server has no state** and judges can audit it on the explorer);
    - `createClaimableBalance` whose claimants are exactly [recipient with NOT(BEFORE_ABS(T ≥ now + window)), Mum unconditional];
    - `manageData` adding an allowlist entry whose value is ≈ now (the cool-off starts);
    - `bumpSequence`;
  - fee ≤ cap, timebounds sane;
  - reject `setOptions`, merges and everything else.
- **Output:** the XDR with the policy signature added.
- **Secret:** `POLICY_SECRET` as an environment variable.
- **Health:** `/health` returns the policy public key.
- **Demo window:** 2 minutes, configurable; 24h in "real mode".

### C. Implementation feasibility (F1)

**Architecture**
- **Frontend:** the existing Vite + React + TS app. Pages: Setup ("Create demo family" button), **Mum**, **Daughter (guardian)**, **Stranger**, **Son (known payee)**, with a role switcher in the header.
- **Keys:** in-app `Keypair.random()` per role, friendbot-funded, stored in `localStorage` (testnet only, labelled). Freighter optional, not in the critical path.
- **Backend:** one stateless serverless function `/api/cosign` (S1-Full only).
- **Contracts:** none.
- **Explorer links:** every tx shows a stellar.expert testnet link, and every rejection shows the result code translated to plain language (`op_cannot_claim` → "The network refused: this money can't be collected until 14:32").
- **Hosting:** Vercel or Netlify (static + function) [A: either free tier works]. CI builds the frontend; the existing workflow already runs lint and build.

**External dependencies in the critical path:** Horizon testnet + friendbot (SDF), plus our own function. That is 1 third-party provider, within the Judge's ≤2 rule. No relayer, indexer, anchor or oracle.

**Hour estimates (dev-hours; 3 devs; about 36 dev-h of build capacity after sleep, video and deck)**

| Work item | Can do now / Risk | Est. |
|---|---|---|
| `stellar.ts`: submit + result-code mapping, Horizon reads, tx builders (send, CB, undo with op-source, claim, reclaim) | Now (spike code exists) | 3 |
| Scenario builder: 5 keypairs, friendbot, demo asset issuer + trustlines, signers/thresholds, seed allowlist (son, exchange) | Now | 3 |
| Mum view: balances, send form (known → payment; new → protected CB), pending list with countdown, reclaim | Now | 4 |
| Guardian view: pending poller, alert banner, Undo, "try to pay myself" beat | Now | 3 |
| Stranger view: claim → refused (countdown), claim after window → success | Now | 2 |
| "Mum's key in another wallet" beat: sign alone → `op_bad_auth` explainer | Now | 1 |
| Policy function + allowlist cool-off + deploy + `/health` | **Medium risk** (first backend; env secret; CORS) | 6 |
| Heirloom hatch (flag): pre-sign at setup, guardian claim screen, heartbeat on open, health panel | **Medium risk** (far-ahead seq, preconditions UI) | 3 |
| UI polish, "Only on Stellar" callouts, plain-language errors | Now | 3 |
| Hosting, README (contract-free architecture, what's mocked, prior art), CI green | Now | 2 |
| **Total** | | **≈30 dev-h** (Lite alone ≈24) |

**Serious risks and their mitigation**
1. **Async demo uptime** of the function. Mitigation: a stateless serverless function, a README fallback ("Mum + Daughter remove the server"), and a recorded video as backup.
2. **Friendbot rate limits or outage** while judges click "Create demo family" [A]. Mitigation: pre-create one shared demo family listed in the README, so "new family" is optional.
3. **Testnet reset** [V docs]. None is announced in the window [A]. Keep the scenario builder idempotent.
4. **Claimant needs a trustline for a non-native asset.** The stranger and son accounts get a trustline at setup. A "fresh recipient" flow (ChangeTrust + Claim) is a stretch.
5. **Exchanges don't claim CBs** [A]. The allowlist pre-seeds them.
6. **Scope creep:** one hero flow only (stranger refused → daughter undoes → money back).

---

## F2 — Loop

### B. Stellar integration

| Step | Operations | Status |
|---|---|---|
| Firm onboarding | Each firm = G-account (in-app key). Optional "closed club": `setOptions({ setFlags: AuthRequiredFlag \| AuthRevocableFlag })`, then `setTrustLineFlags({ trustor, asset, flags: { authorized: true } })` per real creditor (N² ops) | Flags [V docs control-asset-access]; club mode [U, not spiked] |
| Credit line | Creditor `changeTrust({ asset: DEBTOR_IOU, limit })` | [V spike b] |
| Invoice accepted | Debtor `payment` of its own IOU to the creditor (mint); the creditor updates its netting offer in the same tx (co-signed) | Payment [V spike b]; co-signed bundle [A] |
| Netting consent | Creditor `createPassiveSellOffer({ selling: DEBTOR_IOU, buying: OWN_IOU, price: '1', amount })` or `manageSellOffer` to resize | [V spike b, 4d6b8f0f…, 405b7dad…] |
| Find cycles | `server.strictSendPaths(sourceAsset, amount, [destAsset])` found [BIOU] for C→A; plus a client-side DFS to choose the max amount | [V spike b] |
| Clear | `pathPaymentStrictSend({ sendAsset: X, sendAmount, destination: SELF, destAsset: OWN_IOU, destMin: sendAmount, path })` | **[V spike b, fce43284…]: all edges 100→40, atomic** |
| Residual | `payment` in the demo dollar or `pathPaymentStrictReceive` | standard [V] |

**Limits:**
- Path length is capped at 5 intermediate assets, so cycles of at most about 6 firms [A, recalled, not re-verified].
- Every offer owner needs an *authorized* trustline to the asset it sells (unless it is the issuer) [V protocol semantics].
- The IOU graph is public [V].

**Why Stellar:** issued assets plus trustlines (credit limits) plus a native order book plus multi-hop path payment to self give a **contract-free clearing engine run by validators**. No other L1 has native order-book path payments [A, high confidence], so elsewhere this needs a custom netting contract or a central operator.

**Docs:** path payments https://developers.stellar.org/docs/build/guides/transactions/path-payments · assets/trustlines/flags https://developers.stellar.org/docs/tokens/control-asset-access · liquidity on SDEX https://developers.stellar.org/docs/learn/fundamentals/liquidity-on-stellar-sdex-liquidity-pools

### C. Feasibility (F2)

**Architecture**
- **Frontend only:** a "Spawn 4–5 firm scenario" button (in-app keys, friendbot, issuance, invoices, offers), a live graph (SVG or `react-force-graph`), a "Clear loops" button, and an explorer link to the single clearing tx.
- **Backend and contracts:** none.
- **External dependencies:** Horizon + friendbot only.

| Work item | Now / Risk | Est. |
|---|---|---|
| Scenario seeding (5 firms × trustlines, invoices, offers) | Now | 3 |
| Cycle finder + max-flow amount; Horizon path check | Now | 2 |
| Clearing tx + result handling; residual settlement | Now | 2 |
| Graph UI with animated edge shrink, Horizon polling | **Medium** (visual quality is the demo) | 5 |
| Invoice flow (co-signed IOU + offer update) | **Medium** (multi-signer tx in a browser) | 3 |
| AUTH_REQUIRED club mode | **Risk** (N² authorizations, unspiked) | 2 (stretch) |
| Polish, README, hosting | Now | 4 |
| **Total** | | **≈19–21 dev-h** |

**Serious risks:**
- Not technical: user value and a public debt graph (Judge Crux 4).
- Technical: cycles of 4–6 firms and offers that run out of liabilities when invoices change [U, not spiked], plus explaining a 3-hop IOU graph in under 3 minutes.

---

## F3 — Heirloom (standalone)

### B. Stellar integration

| Step | Operations / SDK | Status |
|---|---|---|
| Initialise seqTime (dormant accounts lack it) | `bumpSequence({ bumpTo: '0' })` by the owner | [V probe + spike c] |
| Create will | `new Account(OWNER, (S + 2n**32n − 1n).toString())` → `TransactionBuilder(...).addOperation(setOptions({ signer: { HEIR, weight } })).setMinAccountSequence(S).setMinAccountSequenceAge(window).setTimeout(0).build()`, owner signs, export XDR (download/QR; **non-secret**: it only ever benefits the named heir) | [V spike c] |
| Two-stage will | Stage 1 at seq S+2^32 (heir LOW weight, minSeqAge T1); stage 2 at seq S+2^33, minSeqNum S+2^32, minSeqAge grace (heir HIGH). The grace clock auto-starts when stage 1 lands | [V spike d, 3eefd5f8…, d5b4dd19…] |
| Heartbeat | Any owner-sourced tx, or a no-op `bumpSequence`. **Inbound payments don't count** | [V spike g] |
| Heir claims | `TransactionBuilder.buildFeeBumpTransaction(heirKp, fee, inner, NP)` → submit | [V spike c, 3932dad7…]; early → `tx_fee_bump_inner_failed`/`tx_bad_minseq_age_or_gap` |
| Revoke | `bumpSequence({ bumpTo: willSeq })` → will dead (`tx_bad_seq`) | [V spike c] |
| Will health | Horizon `sequence`, `sequence_time`, `signers`, `thresholds` vs the will's parameters | [V fields] |
| Multi-heir | Distinct seqNums; fallback or exclusive ordering chosen at signing | [A, derived from verified semantics] |

**Why Stellar:** CAP-21 `minSeqAge` makes "valid only after N seconds of account inactivity" a **validator-enforced precondition on a pre-signed tx**, with no contract, no keeper and no funds moved. CAP-21 names "time-delayed key recovery" as a goal [V]. Closest analogue: Bitcoin miniscript timelocks (Liana) with per-coin refresh [V, Wildcard's link]. Pitch "Liana-class recovery without the refresh chore", not "impossible elsewhere".

### C. Feasibility (F3)
**Architecture:** frontend only. Owner view (create will, heartbeat, revoke, health), Heir view (paste or scan XDR, live countdown from `sequence_time`, claim via fee-bump). In-app keys; Freighter optional for the owner. No backend and no contract.

| Work item | Now / Risk | Est. |
|---|---|---|
| Will builder + two-stage + export (QR) | Now (spike code) | 3 |
| Heir view: countdown, claim, error mapping | Now | 3 |
| Heartbeat, revoke, health panel | Now | 2 |
| Freighter signing of a far-ahead seq | **[U] risk**: test in the first 30 min; fallback in-app key | 1 |
| Post-claim "move funds" helper for the heir | Now | 1.5 |
| Polish, README, hosting | Now | 3 |
| **Total** | | **≈13–14 dev-h** |

**Serious risk:** product, not tech. "Crypto inheritance" is a familiar category (4+ Stellar builds), and the user count is unknown. Technically it is the lowest-risk of the three.

---

## Summary comparison

| | F1 Second Thought (Full) | F2 Loop | F3 Heirloom |
|---|---|---|---|
| Verified mechanics | All (spikes a, e, f, g; hatch c, d) | Core 3-cycle (b) | All (c, d, g) |
| Contract / backend | none / 1 stateless function | none / none | none / none |
| Dev-hours | ≈30 (Lite ≈24) | ≈20 | ≈14 |
| Biggest technical risk | Function uptime during async judging | Graph UI plus longer cycles | Freighter far-ahead seq (avoidable) |
| Fits 3 devs / ~36 dev-h | Yes, about 6h buffer | Yes | Yes (room for polish) |

**My build recommendation:** F1, hybrid. All flows on Lite thresholds by about hour 6, then the stateless policy function with an on-chain ManageData allowlist, then the flagged Heirloom hatch if more than 3h of buffer remains at about 04:00.
