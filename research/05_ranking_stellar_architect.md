# 05 — Phase 2 ranking (Stellar Architect lens)

My lens: (a) Is the Stellar usage *load-bearing*, meaning it uses a core protocol feature or a real composition, not "a contract anyone could deploy anywhere"? (b) Can 3 Soroban newcomers get it working on testnet in about 20h? I score with the rubric in 04 (T20/U20/Te15/I15/P10/M10/UX10) and apply its kill/flag checklist (K1–K7, F1–F8). Scores are my estimates and FOOTNOTE is excluded.

## Tripwire rollback question (critical for #1)

**Partly verified.**
- Stellar's errors doc says: "If an error is returned from a function anything the function has done is rolled back… If ledger entries have been altered, or contract data stored, all those changes are reverted and will not be persisted." ([errors example](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/errors))
- Soroban advisory GHSA-pm4j-7r4q-ccg8 describes contract A calling B via `try_call`, B failing, and A continuing. It says "the contract call is simply rolled back, there is no risk of state corruption." It is fixed in P26, and testnet and mainnet are on P29. ([advisory](https://www.wiz.io/vulnerability-database/cve/ghsa-pm4j-7r4q-ccg8))
- **Still UNVERIFIED in docs:** whether *nested* writes (grandchild calls, including SAC balance changes) are explicitly rolled back. The host design (rollback per frame) strongly suggests yes. A `cargo test` with a SAC (`register_stellar_asset_contract_v2`) settles it in under 1h, so do that spike first.

**Design issues I found in Tripwire (from my lens):**
1. **Soroban forbids re-entrancy**, so a contract cannot call itself. The "fail on purpose" frame must be a **separate harness contract**: `Tripwire.claim → try_invoke(Harness.run) → Exploit.execute(target) → Verifier.holds(target) → panic(EXPLOIT_PROVEN)`.
2. **Forged error code.** Contract errors are only `(Contract, u32)` and don't say which contract raised them. A malicious exploit could panic with the `EXPLOIT_PROVEN` code itself. The harness must call the exploit and the verifier via `try_invoke` and map any error from them to `EXPLOIT_FAILED` or `INCONCLUSIVE`, and only the harness raises `PROVEN`.
3. **The exploit is published before the claim.** Uploading the exploit Wasm is its own transaction (one host-function op per Soroban tx), so the code is on-chain at least one ledger (~5s) before the claim that pauses the target. Better MVP: a pre-deployed generic **call-script executor**. The exploit is passed as a `Vec<(contract, fn, args)>` inside the claim tx, so it is revealed and paused in the same ledger. This handles multi-call exploits but not callback or flash-loan style ones; those still need the Wasm route.
4. **Bounty front-running.** If `payout_addr` is an argument, a copycat can resubmit the claim with their own address. Fix: bind the payout to the whitehat's auth or a prior commit.

These are fixable and make a good "threat model" section in the README (it helps Technical Execution). Contracts: Tripwire, Harness, Executor, demo Vault and Verifier. That's 5 tiny ones and trips F1 on count, but they're each 30–100 lines with no frontend wallet complexity.

## Ranked list (all 11)

| # | Idea | Est. score | One-line reasoning (my lens + 04 rubric) |
|---|---|---|---|
| 1 | **Tripwire** | ~4.0 | The most load-bearing Soroban use here (atomic sub-call rollback + typed errors + in-contract deploy). No Soroban equivalent found. CLI-friendly, so no passkey or wallet risk. The rollback spike is ~1h and mostly backed by docs already. Weaker on User Value (niche) and Market. Needs fixes 1–4 above. |
| 2 | **Quorum** | ~3.8 | Easiest to build reliably (1 contract + SAC) and the dominant-assurance mechanism passes K2 as a real mechanism twist. But it's a generic contract on any chain (Track ~3), and "Unlocked" is weak. Should target Composed (passkeys + USDC) or use claimable balances for refunds to look Stellar-native. |
| 3 | **ReliefRail** | ~3.7 | Deepest use of *core protocol features* (AUTH_REQUIRED, clawback, claimable-balance expiry, sponsored reserves) and the enforcement is native, not app code. Hurt by F6 overlap with SDF Aid Assist/SDP, F1 (classic + Soroban + anchor), and F8 (expiry needs a short-predicate fast-forward). |
| 4 | **KeyHold** | ~3.5 | Relatable Lisbon pain with evidence. The "silence pays the tenant" timeout is a clean on-chain rule and the contract is trivially feasible. But it's generic escrow (Track ~2.5), F7 two-sided adoption, and Trustless Work already exists. It only reaches Composed if built *on* Trustless Work. |
| 5 | **LeashPay** (mine) | ~3.5 | Real composition (OZ smart-account policies + x402 facilitator + passkeys) and on-chain enforcement is a genuine twist. But 04 predicts x402/agents is *the* most saturated category, 03 found prior art (REAPP, x402-policy), and facilitator-to-C-account interop is unproven (K3 spike). Honestly I'd downgrade it from my blind #1. |
| 6 | **Earmark** | ~3.4 | Best evidence (labelling RCT +15%) and a natural Composed story (anchors/MoneyGram). But remittance is very saturated (K2 risk) and payee off-ramps are unverified. Enforcing payee restriction *natively* (AUTH_REQUIRED asset where only verified payees get authorized trustlines) would make it Unlocked-grade. That's why I suggest merging it with ReliefRail. |
| 7 | **Volta** | ~3.3 | A neutral multi-vendor pool passes K1 fairly well, the contract is simple, and the demo is visual. But Innovation is low, F7 network effects, and it doesn't use anything Stellar-specific beyond SAC and cheap fees. |
| 8 | **Silence Is Consent** | ~3.2 | Same engine as KeyHold in the most crowded escrow vertical. Composes with Trustless Work (Composed) but Innovation ~2. Only worth it as KeyHold's engine. |
| 9 | **Roda** | ~3.2 | Feasible single contract, but ROSCA dapps are a long-running crypto-hackathon trope (e.g. Celo "Esusu"-style projects, UNVERIFIED count). Partial collateral doesn't solve the default problem (its own doc admits this). Stellar usage is generic. |
| 10 | **DepositBox** (mine) | ~3.0 | A weaker duplicate of KeyHold, and the path-payment FX leg needs testnet liquidity we'd have to fake (F3). Merge into KeyHold. |
| 11 | **QuietPay** (mine) | ~2.6 | **Kill.** K2 (payroll already won with PayZoll), K3 (Confidential Token preview has no API docs I could find, plus browser proving), and judges just saw a ZK hackathon. High Unlocked potential, but too risky for 20h. |

## My top 6

1. Tripwire
2. Quorum
3. ReliefRail
4. KeyHold
5. LeashPay
6. Earmark

## Suggested merges

- **ReliefRail + Earmark → "purpose-bound money".** An issuer asset with AUTH_REQUIRED where only verified payees (schools, pharmacies, merchants) get authorized trustlines, so restriction is enforced *by the protocol*, not a contract. Add claimable balances with time predicates for expiry and refund, sponsored reserves so recipients need no XLM, and clawback for fraud. Pick one vertical: diaspora-to-school (Earmark's RCT evidence, avoids SDF Aid Assist overlap) or NGO vouchers. This is the strongest *Unlocked* case on the list after Tripwire, with fewer Soroban unknowns (mostly classic ops plus a small contract).
- **KeyHold + Silence Is Consent + DepositBox → one timeout-default escrow** with the KeyHold vertical. Build on Trustless Work to qualify for Composed.
- **Tripwire + call-script executor**, which fixes the exploit-leak problem (see above). It also makes the demo simpler because no exploit Wasm upload is needed.
- **Quorum + claimable balances / passkeys** to give it a Stellar-native or Composed angle. Refunds and bonuses can be issued as claimable balances so backers can claim later without the contract iterating payouts.

## The idea most likely to be wrongly overrated

**Roda.** It reads as the perfect "blockchain replaces the untrustworthy treasurer" story and is Agent 1's #1, but:
1. The mechanism doesn't solve the problem it names. A member who receives the pot early can still walk away unless collateral is close to the remaining obligation, which removes the credit benefit that is the point of a ROSCA.
2. Savings-circle dapps are a well-worn hackathon category (UNVERIFIED count), so Innovation will score lower than the committee expects.
3. Nothing in it is Stellar-specific beyond SAC USDC and cheap fees, so Track Alignment sits around 2.5–3 for both tracks.

**Runner-up warning:** **Tripwire** is likely to be overrated on *safety* if the committee skips the exploit-publication and forged-error issues. Fixed, it's my #1. Unfixed, a security-literate judge would spot it.
