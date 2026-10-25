# 18 — BNPL / agentic payments on Stellar: Stellar Architect

Written 2026-10-25, 14:47–14:55 WET. The spikes ran on testnet (P29) in the scratchpad (`spikes/m_bnpl.cjs`, `m2_bnpl.cjs`).
Labels: [V] verified, [A] assumption, [S] speculation, [U] unknown dependency.

## 1. BNPL core: C1's cheque mechanics turned into instalments

**Design (the "plan account"):**
- A dedicated plan account, 2-of-2 (shopper + merchant or lender), master 0, thresholds 2/2/2, holding only its reserve (~3 XLM, sponsorable).
- Instalment k is a pre-signed tx with source = plan account, **seq S+k**, `minTime = due_k`. Its op is `payment` with **op source = the shopper's main account** to the merchant or lender.
- The shopper signs all faces once at checkout. The merchant co-signs and fee-bumps each face when it is due.
- No funds are locked; the shopper keeps full liquidity.
- Optionally, each instalment has two **same-seq faces**: on-time (`minTime = due_k`, `maxTime = due_k + grace`) and late (`minTime = due_k + grace`, amount + late fee).

**Spike (m2), 3 instalments [V]:**

| Step | Result | tx |
|---|---|---|
| Plan account 2-of-2, master 0 | OK | 8fb3eb19… |
| Instalment 3 submitted first | `tx_too_early` (and by construction it also needs seq S+2 consumed first) | — |
| Instalment 2 before its due date | `tx_too_early` | — |
| **Instalment 1 paid** (merchant co-sign + fee-bump) | **OK** | c3f819eb… |
| Shopper empties wallet | — | — |
| Instalment 2 on-time face after its grace window | `tx_too_late` | — |
| **Instalment 2 LATE face (+5 fee) while broke → bounce** | `tx_failed` / `op_underfunded`; recorded on-chain (Horizon `successful=false`) | 35070806… |
| Shopper tops up; **instalment 3 after instalment 2 bounced** | **OK**: a bounce consumes seq S+2, so later instalments still work | 6f65b704… |
| Retry instalment 2 afterwards | dead (`tx_too_late`, and its seq is consumed) | — |

(An earlier run, m, returned `tx_bad_auth_extra` for instalment 3. That was my script's fault: it added the merchant's signature twice. Fixed in m2.)

**Answers to the sequencing questions:**
- **Strict order:** instalment k is valid only after k−1 has been *applied*, whether paid or bounced. Its seq S+k needs the account at S+k−1 [V protocol semantics; spike shows the time gates].
- **A missed (failed) instalment** consumes its seq and **does not break later ones**: instalment 3 paid after 2 bounced [V]. But the missed amount **cannot be retried on-chain** with that face, because its seq is gone. The bounce is public evidence; collecting it becomes an off-chain debt [V].
- **Retry or grace:** the same-seq on-time/late-fee pair works [V]. The collector must **pre-check the shopper's balance** before submitting, because a premature bounce burns the face (the same lesson as C1).
- **Catch-up faces** ("instalment k+1 plus missed k") could be pre-signed at the same seq. But the merchant could submit a catch-up face even when nothing was missed. Over-collection is visible but **not prevented**, because preconditions can't see payment history. **Not recommended.**
- **Shopper can still void:** rotating the key or emptying the account → the face bounces (`op_bad_auth` / `op_underfunded`), which is a public missed payment [V, spike l].

**Correct alternative if catch-up and arrears matter:** a small Soroban schedule contract that pulls via SAC **`approve`/`transfer_from` allowances** (SEP-41).
- The shopper approves the contract as spender up to the plan total, with an `expiration_ledger`. The contract enforces due dates and pulls arrears properly.
- It is still "no funds locked", but it's a contract (Rust, deploy, TTL) and the pattern is known from EVM (ERC-20 allowances).
- Allowance expiry is bounded by max entry TTL [A: about 6 months on mainnet, check `stellar network settings`].

## 2. Who pays the merchant upfront?

| Option | How | Extra build | Risk for tomorrow | Story |
|---|---|---|---|---|
| (a) Merchant waits | Instalment destination = merchant | 0 | lowest | Plain "pay in 3"; merchant carries credit risk |
| **(b) Lender pool (recommended)** | A pool G-account pays the merchant at checkout, minus a merchant discount; instalment faces pay the **pool**; the pool is the 2-of-2 co-signer and submitter | **+2–3 dev-h** | low (classic payments) | Real BNPL economics; pool balance and default rate are public |
| (c) Blend / DeFindex as liquidity | Pool borrows from or supplies to Blend, or LPs deposit via a DeFindex vault | **+8–12 dev-h** | **high**: Soroban invocations, testnet pool availability for our asset [U], cosmetic yield | Composed track and "brings liquidity", but for tomorrow it's a roadmap slide, not a build |

## 3. Agentic layer
- **Saturated:** x402/MPP + OZ smart-account spending policies has 8+ prior builds and is the organizers' own prompt [V Scout, earlier].
- **Unsaturated angle, honest version:** a **merchant/lender "collector agent"**, a keeper that watches due dates plus the shopper's Horizon balance, submits a face only when it will clear, and picks on-time vs late face. When a bounce is likely it proposes a reschedule: a new plan the shopper re-signs, with the old plan account voided by mutual 2-of-2 bump.
  - This is about 3–4 dev-h as a Node script or edge cron. It is useful, but it is a bot, not an LLM wow.
  - An LLM that "negotiates" plan terms or merchant discounts is UI fluff with no Stellar depth [S]. I don't recommend it as a headline.
- **C-address limitation [V protocol / A tooling]:**
  - Classic pre-signed faces and claimable balances need **G-accounts** as op sources or claimants. An OZ smart-account (C-address) agent wallet can't be the payer in this design.
  - Soroban auth entries carry `signature_expiration_ledger` (a max) but **no "not before"**, so time-gating must live in a contract (the allowance design in §1).
  - So an "agent wallet BNPL" means the Soroban allowance-contract version: more Rust, and less of the "no contract, ledger-enforced" story.
- **Prior art:** Scout search for "BNPL installments" and "installment payments pre-signed" → **0 builds**; "buy now pay later" → only adjacent rows [V Scout, 14:49]. BNPL is whitespace on Stellar.

## 4. Estimate (3 devs new to Stellar) and traps

| Work item | Dev-h |
|---|---|
| Plan builder: plan account, N faces (on-time + late), shopper sign-once, in-app keys | 4 |
| Lender pool: upfront payment to merchant, faces pay the pool | 2.5 |
| Collector dashboard: due list, balance pre-check, co-sign + fee-bump, bounce ledger from Horizon | 4 |
| Shopper view: schedule, countdowns, public record, "pay early" (optional extra face) | 3 |
| Collector bot (cron/edge function) | 3 |
| Polish, README, hosting | 3 |
| **Total classic version** | **≈19–20** |
| + Soroban allowance-contract version (arrears, C-address agents) | +8–10, high risk |
| + Blend/DeFindex liquidity | +8–12, high risk |

**Traps:**
1. **Regulation:** BNPL is consumer credit. The EU's revised Consumer Credit Directive brings BNPL into scope from late 2026 [A, recalled; verify]. Say "pilot or B2B" in the pitch.
2. **Public missed-payment record is personal credit data** under GDPR [A]. Pseudonymous accounts don't fully solve it.
3. **Premature bounce burns the face.** The collector must pre-check balances [V].
4. **No on-chain arrears recovery** in the classic design [V]. Missed amounts become off-chain collections.
5. **The shopper can void any face** by rotating keys or draining funds. That's a visible bounce, not prevented, the same as card BNPL defaults.
6. **Each plan account locks a reserve** of about 3 XLM, sponsorable by the lender.
7. **Testnet USDC/EURC faucets:** use a self-issued demo euro.
8. **Max entry TTL** limits allowance expiry in the Soroban variant [A].

**Verdict:**
- The classic plan-account BNPL is a **natural, verified extension of C1** with no prior Stellar builds. Credible scope is about 20 dev-h with a lender pool.
- Its protocol story is the same as C1's: seq-ordered, time-gated, ledger-enforced faces, no funds locked, public bounce record.
- The agent layer and Blend are add-ons, not the core.
- The main risks are regulatory/privacy and "no arrears recovery", not technical.
