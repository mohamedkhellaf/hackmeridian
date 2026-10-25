# 17 — Uniqueness-sprint evaluation: Stellar Architect

Written 2026-10-25, 14:27–14:40 WET. All spikes ran on testnet (protocol 29) from the scratchpad (`…/scratchpad/spikes/h,h2,i,j,k,l`) with the repo's `@stellar/stellar-sdk` 17.
Labels: [V] verified (tx hash or doc), [A] assumption, [S] speculation, [U] unknown dependency.

## TL;DR
| | Core mechanism works? | Dev-h (3 devs new to Stellar) | Backend / contract | Testnet | Track Alignment (my lens) | Beats F1 on TA + TE? |
|---|---|---|---|---|---|---|
| **C1 Cheque Pré-Datado** | **YES**, including the bounce and void semantics (spikes h/h2/k/l) | **≈14** | none / none | all classic ops [V] | **4.5** | **YES on both** |
| C2 Balcão + Nomad desk | Path payment YES (spike i). CCTP exists on testnet but is a multi-chain build | ≈14 without CCTP, +8–10 with it | none / CCTP needs Soroban calls + an EVM side | path payment [V]; CCTP testnet [V docs] | 3 (path payments used as designed; crowded) | No |
| C3 Testemunha | YES (same primitives as spike j) | ≈12 | none / none | [V] | 3.5 | TE yes, TA no |
| C4 RASTO | **YES**: freeze + clawback across 3 hops + restitution in ONE tx; the DEX escape offer is pulled (spike j) | ≈14 | none / none | [V] | 4 | TA ≈ F1, TE ≈ F1. Premise issue (below) |

**Strongest "only on Stellar" story: C1.** One sequence number shared by three pre-signed faces, plus two-sided time bounds, plus the op-source = payer's main account (funds stay liquid), plus a supplier fee-bump, plus an un-killable cheque account. The ledger itself enforces the cheque's whole lifecycle, including the public bounce, with no contract and no locked funds.

---

## C1 Cheque Pré-Datado: spike results

### (h) Plain version: the cheque account = the payer's own account, all three faces at seq S+1 [V]
| Check | Result |
|---|---|
| On-time face before its window | `tx_too_early` |
| Late face before its window | `tx_too_early` |
| Early face, payee fee-bump | **OK**, 71a2a1c4… |
| Early face after its window closed (h2) | `tx_too_late` |
| On-time face inside its window (h2) | **OK**, 23216f61… |
| Sibling faces after one is cashed | rejected (`tx_too_late`/`tx_too_early` mask it; with open time bounds it's `tx_bad_seq`, see C/l) |
| **Payer does any other tx first, then the face is cashed (B)** | **`tx_bad_seq`**: plain cheques die whenever the payer transacts. **A dedicated sequence account, or minSeqNum, is REQUIRED** |
| Variant with minSeqNum (seq S+2^32, minSeqNum S): face after 2 payer txs | **OK**, 232891d7…; sibling then `tx_bad_seq` |

The minSeqNum variant survives payer activity, but the payer can still kill it with one `bumpSequence` past the face's seq. So the drawer-tx problem remains.

### (k) Judge's fix: dedicated cheque account locked to 3 pre-auth face hashes, master 0, op source = payer main [V]
| Check | Result |
|---|---|
| Lock setup: 3 `preAuthTx` signers, master 0, thresholds 1 | OK, 3be7619b… |
| Cheque-account master key bumps sequence | `tx_bad_auth` |
| Payer (not a signer) bumps it | `tx_bad_auth` |
| Underfunded face (bounce) | `tx_failed` / `op_underfunded`: **applied as a failed tx**; seq consumed; its pre-auth signer removed (2 of 3 left) |
| Another face after the bounce | `tx_bad_seq`: the whole cheque is dead |

### (l) Chairman's variant: cheque "sequence" account 2-of-2 (payer + supplier, master 0, thresholds 2/2/2), holding only the reserve; op source = payer's MAIN account; payer signs faces at issue; supplier co-signs and fee-bumps at cashing [V]
| # | Question | Result |
|---|---|---|
| 1 | Can the payer alone bump or kill the cheque account? | **No.** bumpSequence → `tx_bad_auth`; accountMerge → `tx_bad_auth` (tx-level, not op-level) |
| 2 | Open face succeeds, siblings die? | **Yes.** Face OK 9659652b…; sibling → `tx_bad_seq` |
| 3 | Bounce: payer empties main account | Face → `tx_failed`/`op_underfunded`; **the cheque-account seq IS consumed** (…473 → …474); sibling → `tx_bad_seq`; **Horizon shows the failed tx (d8bf727f…, successful=false)**. Payer drain tx b69938376… |
| 4 | Can the payer void the cheque by rotating its main key? | **Yes.** Key rotation a45a26b5… (add K, master 0), then face → `tx_failed`/`op_bad_auth`. But it lands on-chain as a failed tx, a visible "bounce", just like emptying the account |

**What the payer CAN and CANNOT do (2-of-2 design):**
- **CANNOT** silently void the cheque. Bump, merge or re-sequence alone are impossible (`tx_bad_auth`).
- **CANNOT** make two faces pay. Sequence exclusivity holds.
- **CAN** make it bounce, by having no funds or by rotating or raising thresholds on its main account. **Every bounce is a public failed tx** with a timestamp, which matches the legal fact of a dishonoured cheque.
- No funds are locked; the payer keeps full liquidity. This is not escrow.
- Payer + supplier together can mutually cancel (bump), which is fine.

**Gotchas:**
- One premature bounce (cashing while the payer is short) **kills all faces**. The UI must check the payer's balance via Horizon before submitting [V spike l (3)].
- The cheque account needs its reserve (~1.5 XLM + signers); the payer funds it at issue.
- Faces must carry the supplier's signature at cashing (2-of-2).

**Why Stellar:** native seq-number exclusivity plus **both-ended** time bounds (minTime and maxTime) on a pre-signed tx, op-source separation and fee-bump.
- EVM nonces give exclusivity but have no minTime validity, so they'd need a contract [A].
- Bitcoin can do mutually exclusive nLockTime txs over the same UTXO, but that locks the UTXO, so the funds aren't liquid, and it has no maxTime [A, recalled].
- Honest pitch: "a post-dated cheque the ledger itself enforces, without locking your cash".

**Feasibility:** frontend only, about 14 dev-h.
- Issue form (3 faces + cheque account) and supplier inbox (XDR via QR or SEP-7 `tx` URI [A: SEP-7 supports a `tx` param]).
- Cash button with a balance pre-check; bounce and history view from Horizon.
- Demo asset is a self-issued `EURt` (EURC faucet friction).
- Risks: SEP-7 multi-tx handoff (use one link per face); Freighter signing 3 faces plus setup (use in-app keys for the demo).

## C2 Balcão + Nomad desk

**Spike (i) [V]:**
- Issuer `BRZ` and `EURC` (self-issued); the market maker posts `manageSellOffer` EURC→BRZ @6.2 (2606acbe…).
- The customer does `pathPaymentStrictReceive` sendAsset BRZ, sendMax 70, destAsset EURC, destAmount 10, path [] → **OK, 52eb099a…**. Café +10.0000000 EURC; customer paid 62 BRZ; market maker +62 BRZ.
- Horizon `strictReceivePaths` returned **[]** when queried in the same second as the offer [V observation, likely ingestion lag]. Retry, or compute a direct path for single-hop pairs.

**CCTP [V docs]:**
- Circle's domain table lists **27 = Stellar**, and the Stellar quickstart uses domain 27 for **Stellar Testnet** (https://developers.circle.com/cctp/concepts/supported-chains-and-domains , https://developers.circle.com/cctp/quickstarts/transfer-usdc-stellar-arc). Circle's docs advise using `CctpForwarder` for inbound transfers; there are decimal differences (7 vs 6).
- Usable from JS in a day by this team? **No, not safely.** It needs an EVM-side wallet and faucet (Base/Arc Sepolia), attestation polling, Soroban contract invocation of the forwarder/transmitter, and hook-data encoding. Estimate 8–10 dev-h with high risk [A].
- **Verdict: drop the bridge from the critical path.** At most, a pre-recorded stretch.

**Mechanism verdict:**
- Path payments here are used exactly as designed ("pay in X, merchant receives Y").
- It's a crowded category (DEX/path payments 69/9 [V, Judge's data]), and "merchants as market makers" carries inventory and FX risk [A].
- TA about 3. The liquidity claim depends on real BRZ holders using Stellar [S].

## C3 Testemunha
- The mechanism (AUTH_REQUIRED + per-witness authorized trustline as quota + clawback cascade) uses the same primitives verified in spike j (flags, authorize, clawback). It works [V primitives; per-Junta multi-issuer indexer A].
- About 12 dev-h, frontend plus a small indexer view. No liquidity, and the issuer is a government body (adoption [S]).
- Blockchain necessity is medium: a shared Junta DB could rate-limit witnesses. The public, cross-Junta auditability is the argument. TA 3.5.

## C4 RASTO
**Spike (j) [V]:**
- Issuer sets `AUTH_REQUIRED|AUTH_REVOCABLE|AUTH_CLAWBACK_ENABLED` (e73b810c…). Victim and 3 mules hold authorized trustlines.
- Scam: victim→m1 900 (312dc4b3…); fan-out m1→m2 400, m1→m3 400 (02abfe4d…). m3 posts a DEX sell offer as an escape attempt (3807778f…).
- **ONE tx** with 3× `setTrustLineFlags(authorized:false)`, 3× `clawback`, and `payment` 900 to the victim → **OK, 1d5edb8f…**.
- Final balances: victim 900; m1/m2/m3 = 0 and unauthorized; **m3's offer removed (0 left)**.

**Mechanism verdict: it works exactly as claimed.** But:
1. The premise requires P2P euros to move on a **clawback-enabled** Stellar asset, while today's Olá mãe money moves over MB Way/SEPA (the author concedes this).
2. Whether major Stellar stablecoins have clawback enabled is unverified for EURC/USDC [U]. It's an issuer choice, and the flag only applies to trustlines created after it's set [V docs].
3. A mule swapping on the DEX before the freeze passes taint to a market maker [A].

TA 4 (clawback used for its intended purpose, composed atomically across N hops). TE about 4.

## Does anything beat F1 on Track Alignment and Technical Execution?
- **C1: yes on both, by my lens.**
  - TA 4.5 vs F1 3.5–4: the whole instrument is protocol-native, and there is no "the rules live on our server" caveat.
  - TE: no backend at all (F1 needs a key-holding co-signer for its strongest claims), all edge semantics verified today (cash, exclusivity, bounce visibility, void-by-rotation, un-killable sequence account), and about 14 vs about 24 dev-h.
- C4 roughly ties F1 on TA/TE but has a premise gap.
- C2 and C3 don't beat F1 on TA.
- User value and market for C1 (Portuguese SME post-dated-cheque practice, euro on-ramp) are for the Problem Hunter and Judge to weigh. I'm not scoring them here.

### Addendum 14:35: the Judge's open assumption (pre-auth success path) is closed [V, spike k2]
In the pre-auth-locked cheque account, the early face cashed successfully (2e9f7f51…). Its pre-auth signer was **removed** (2 of 3 left), and the late sibling then failed with `tx_bad_seq`. So pre-auth signers are consumed on both the success and the failure paths [V, spikes k/k2].

### ⚠ CORRECTION 15:00 (spike o, testnet) [V]
`op_bad_auth` is rejected at **validation**: not included, no seq consumed, no fee. Row (4) above is therefore wrong in one respect. A payer who rotates its main key voids the cheque **without** a failed face on-chain. Only the key-rotation `SetOptions` is public, and the app can show it as "drawer changed keys". The `op_underfunded` bounce **is** recorded on-chain (d8bf727f…, successful=false), as stated.
