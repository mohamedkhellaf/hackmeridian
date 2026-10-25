# Wow-round reality check: Stellar Architect

Written 2026-10-25, 14:56–15:10 WET. Spikes `n_council.cjs` and `o_check.cjs` ran on testnet (P29) in the scratchpad.
Labels: [V] verified, [A] assumption, [S] speculation, [U] unknown dependency.

## 1. Council core spike (n) [V]
Vault: master 0, 5 agent ed25519 signers at weight 1, a `sha256Hash` (hash(x)) signer at weight 3, a `preAuthTx` "refund" signer at weight 3. Thresholds low/med/high = 3/3/3.

| Check | Result | tx |
|---|---|---|
| Setup | OK | c5453745… |
| **2 agents** sign the payout | **`tx_bad_auth`**; vault seq **not consumed** | — |
| **3 agents** sign the payout | **OK** | 744b3436… |
| Pre-auth "refund" (same next seq) after the payout | **`tx_bad_seq`** (dead forever). Note: its pre-auth signer is **not** removed, because the tx was never applied; it is just unusable | — |
| **Preimage x alone** signs a payout (`tx.signHashX(x)`) | **OK** | 84349cf8… |
| x visible on Horizon `signatures[]` | **true** (base64 of the 32-byte preimage) | — |
| **Thief reuses the now-public x** (pays self, removes the hashX signer) | **OK**: **the hash(x) signer is NOT auto-removed after use** | 20bd18c2… |

**Design consequences for The Council:**
- **The hash(x) "backdoor" payout must, in the same tx, remove the hashX signer (and the stale preAuth signer) or merge the vault.** Otherwise anyone can drain later deposits with the public x [V, the thief tx above].
  - With high = 5 (the author's proposal), a weight-3 hashX signer **cannot** `setOptions` or merge, so the leak stays open.
  - Use **high = 3**, accepting that hashX/3 agents can also rewrite signers, or end the game by draining everything and letting the operator rotate. **Recommendation: the payout tx = `accountMerge` to the winner (high op) with high = 3**, so the game ends atomically.
- **Front-running the preimage is real in principle** [A]. x is only revealed inside the submitted tx. Stellar has no public mempool API, but txs flood across validators and peers before ledger close (~5s), so anyone running a watcher node could copy x and submit a competing tx. Apply order within a ledger is shuffled [A, from tx-lifecycle docs], so it's a coin flip.
  - Mitigation, pick one:
    (a) hashX weight 2 + **one** agent signature required (the agent co-signs only payouts to the player who chatted). A sniper with x alone fails `tx_bad_auth`.
    (b) Use the CAP-40 `signedPayload` signer instead: the ed25519 signed-payload signer binds the secret to a payload [A, not spiked].
  - (a) is simplest. On testnet the risk is negligible; disclose it in the README.
- **Agent signing architecture judges can trust:**
  - Each agent is a server-side process with its own key (env secret or KMS). The vault's on-chain signer list proves the operator holds **no master** (master 0).
  - Each agent signs only a tx whose XDR passes a deterministic check (destination = current claimant, amount = pot, memo_hash = transcript hash).
  - Publish each agent's verdict, and the transcript hash in `memo_hash`. Judges can see which 3 agent keys signed (signature hints) on stellar.expert.
  - Honest caveat: the operator runs the agents and *could* run code that signs anything. "Trust" = public signer config + published transcripts. It is not trustless. Option: put the agent prompts and code hash in the README.

## 2. Sardinha na Brasa: does a missing-signature tx consume the pot's seq? [V, spikes n/o]
- **`tx_bad_auth` (tx-level signature weight not met): rejected at validation.** Not included, **seq not consumed, no fee** (vault seq …44865 unchanged; separate pot …17825 unchanged).
- **`op_bad_auth` (tx-level OK but op-level weight not met): ALSO rejected at validation.** Seq unchanged, XLM unchanged, and **no failed tx on Horizon** (spike o).
- So a grab missing the player's signature **cannot burn the pot's sequence number**. Only *applied* failures (e.g. `op_underfunded`, `op_no_trust`) consume seq.
- Sardinha's key risk is **cleared** for signature-missing griefing. The remaining griefing vector is anyone able to submit a *validly signed* ending that fails at apply time.

### ⚠ CORRECTION to my earlier claims (spike l #4 and Round A)
- Because `op_bad_auth` is rejected **at validation**, in C1 (cheque) a payer who **rotates its main-account key** makes faces fail with `op_bad_auth` **without** consuming the cheque seq and **without** a failed tx on-chain.
- The void is still public: the key-rotation `SetOptions` is on-chain, and the app can show "drawer changed keys". But it is **not** recorded as a failed face. The **`op_underfunded` bounce IS on-chain** [V, d8bf727f…, successful=false].
- Likewise, my Round A remark that a guardian's failed attempts "burn the parent's fees" is **wrong**: no fee is charged for `op_bad_auth` [V spike o].

## 3. MUTUAL (Semaphore v4 Groth16 on Soroban BN254 + relayer)
- **Building blocks [V docs/skill]:** BN254 pairing (CAP-74, P25), Poseidon permutation (CAP-75), and MSM/Fr (CAP-80, P26) are live on P29. `xray-games` (Circom + BN254 Groth16 on Soroban, live on mainnet) is a working reference for converting snarkjs output into Soroban bytes [V per wow_zk.md].
- **Is the encoding risk real? YES:**
  - G2 coordinate order (Fp2 c0/c1 swap between snarkjs JSON and serialized forms).
  - Big-endian vs little-endian field encoding.
  - Uncompressed point layout.
  - Negating A or the α/β convention in the pairing equation.
  - Public-input ordering for Semaphore v4 (merkleRoot, nullifier, message, scope).
  - Any mismatch gives a silent `false`, with no error message. A copy of xray-games' conversion code cuts this to about 2–4h, but only if their snarkjs version matches [A].
- **Extra traps:**
  - Group-root management: an on-chain Lean-IMT insert needs circomlib-compatible Poseidon (CAP-75 is a permutation, so the parameters must match), so keep the root **admin-posted** for the MVP.
  - Browser proving time for Semaphore (~1–3s, fine).
  - Mutual-match logic design: how do two picks become a common tag without revealing the asker? This needs a careful nullifier/scope scheme [S].
  - The relayer is one more service.
- **Estimate:** ≈18–24 dev-h, high variance. Most of the risk sits in one opaque step (the verifier returns false).

## 4. SEALED (drand quicknet BLS12-381 verification on Soroban + tlock-js)
- **Building blocks [V]:** BLS12-381 hash_to_curve + pairing (CAP-59, P22) and the official `bls_signature` example contract. `tlock-js` exists for browser encryption [A, npm].
- **Risks:**
  1. **DST/hash-to-curve match:** quicknet uses `BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_` on G1, with message = sha256(round_be_u64) [A per wow_new]. Soroban's `hash_to_g1(msg, dst)` must produce the same point.
  2. **Point encoding:** drand gives compressed G1 (48B), Soroban wants uncompressed (96B) → decompress in the browser with @noble/curves.
  3. **Pairing equation sign convention.**
  4. CPU budget: one pairing plus hash_to_g1 fits, judging by the bls example [A].
- **De-risking:** all of these can be checked **offline in `cargo test`** against a real quicknet beacon (public test vectors, `drand-verify` crate) **before** any frontend work. A deterministic, single-contract, pass/fail risk is much better than ZK proving.
- **Estimate:** ≈14–18 dev-h. The verifier is about 4–6h including the test-vector loop; then tlock-js UI, countdown and payout.

## 5. Ranking: "works end to end on a hosted URL by 06:00", with Claude writing most code
| # | Candidate | Contract? | Core verified today? | Dev-h | Biggest risk | Verdict |
|---|---|---|---|---|---|---|
| **1** | **The Council** | **none** (classic multisig) | **YES** (spike n): 3-of-5, hash(x), pre-auth death, preimage visible | ≈16–20 (agents backend + chat UI + LLM API key + signing service) | LLM API cost/uptime during async judging; preimage reuse (fix: merge in the payout tx); agent-key trust story | **Most likely to work** |
| 2 | Sardinha na Brasa | none | Key griefing risk cleared (spike n/o); the sequence-exclusivity mechanics match C1 [V] | ≈14–16 | Game design and balance; multiplayer timing on 5s ledgers | Very likely |
| 3 | SEALED | 1 Soroban contract (BLS) | primitives [V]; drand-specific path not spiked | ≈14–18 | DST/encoding mismatch (offline-testable) | Likely, if the verifier passes `cargo test` by ~20:00 |
| 4 | MUTUAL | 1 Soroban contract (Groth16 BN254) + relayer | primitives [V]; Semaphore path not spiked | ≈18–24 | snarkjs→Soroban encoding, match-logic design, Poseidon params | Riskiest |

**Bottom line:**
- The Council is the safest "wow". Every on-chain claim is verified on testnet, with no contract. Its risk is the LLM/agent backend, not Stellar.
- SEALED is the best "newly possible on Stellar" story (first drand verifier on Soroban, 0 builds) but needs one cryptographic go/no-go: **a `cargo test` verifying a real quicknet beacon by about 20:00 tonight, or drop it.**
- Avoid MUTUAL for this deadline.

## Addendum 15:05: Sardinha same-ledger race (spike p) [V]
- Two different players' grabs, at the **same pot seq**, were submitted concurrently to Horizon testnet.
- **Exactly one landed:** B, tx 6bc297f2…, ledger 5383369.
- **A's submission returned HTTP 504** (Horizon timeout). A was **never included**: the pot's tx list shows only setup + B, and no failed tx.
- Implication: the loser gets no clean `tx_bad_seq`; it gets a timeout or rejection. **The client must resolve the outcome by polling the pot's sequence or the winner's tx hash, not by trusting the submit response.**
- Use RPC `sendTransaction` + `getTransaction` polling (async) instead of Horizon's synchronous submit to avoid 504s [A].
- Exclusivity holds: the race can't double-pay.
