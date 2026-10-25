# WOW lane: "What used to not be possible on Stellar"

Researched 2026-10-25 using stellar-raven (stellarDocs, Scout hackathon builds) and the web.

## 0. Key finding first: ZK alone is no longer novel

Scout shows that two whole SDF hackathons already happened on the P25/26 ZK primitives: **"Stellar Hacks: ZK Gaming"** and **"Stellar Hacks: Real-World ZK"**. Between them they produced:
- 5+ ZK Battleship builds;
- ZKHiderSeeker (hide and seek), ZK Mastermind ×2, ZK Wordle Duel, ZK Scotland Yard and ZK poker;
- treasure hunts, a ZK Dungeon, and Gift Pool ZK (an anonymous wedding registry);
- around 15 private-payment, privacy-pool and confidential-token apps (Nebula, Olio [WIN], Poof, Veil, Stella…);
- sealed-bid auctions (Segel, Noir Market, Zk Sealed) and ZK passport/KYC apps.

**So "a ZK game" or "private payments" will read as a repeat to SDF judges.** The open space is the capabilities nobody has built on yet.

Scout returned **0 builds** for drand, BLS, time capsule and aggregate-signature crowd unlocks. Freysa-style "persuade the AI" games also returned 0. A web check found **no published Soroban drand verifier**; one exists for Ethereum through EIP-2537.

## 1. New capabilities: what shipped and whether it works on testnet

| Capability | Shipped | Testnet today? | Notes |
|---|---|---|---|
| BLS12-381 host fns (CAP-59): pairing check, hash_to_g1/g2, g1/g2 add/mul | P22 (Dec 2024) | ✅ live | Official `bls_signature` example contract does aggregate-sig custom-account auth. **Nobody has used it for drand or crowds.** |
| BN254 (CAP-74) + Poseidon/Poseidon2 (CAP-75) | P25 "X-Ray": testnet 7 Jan 2026, mainnet 22 Jan 2026 | ✅ live | Groth16 (Circom), RISC Zero and UltraHonk (Noir) verifiers exist. Heavily used already (see above). |
| CAP-80 efficient BN254 ZK, CAP-73 SAC can create G-account balances, CAP-78 limited TTL ext, CAP-79 muxed strkey, CAP-82 checked u256 | P26 "Yardstick": testnet 16 Apr, mainnet 6 May 2026 | ✅ live | CAP-73 lets a contract pay a G-address that doesn't exist yet. |
| **CAP-71 auth delegation for custom accounts** (`delegate_account_auth`, `get_delegated_signers_for_current_auth_check`), plus CAP-71-02 replay fix | P27 "Zipper": testnet 18 Jun, mainnet 8 Jul 2026 | ✅ live | Official `delegate-auth` example exists. Reportedly client/simulation tooling is still catching up. Modular accounts: one account forwards `__check_auth` to the signer contracts attached to the tx. |
| CAP-83 tx-set drop vote, CAP-85 externally managed executables, CAP-86 sparse map host fns | P28 "Adapter": testnet 27 Aug, mainnet 16 Sep 2026 | ✅ live | Infrastructure only; no consumer hook. |
| P29 | 29 Sep (testnet), 1 Oct 2026 (mainnet) | ✅ | Security fixes only; no CAPs. |
| OZ stellar-contracts **v0.8.0**: Confidential Token (Confidential Token Association: SDF, Nethermind, OZ, Zama) | Library and audit v0.8.0; dev preview blog 29 Jun 2026 | ⚠️ testnet demo targets the *earlier* preview | Hides amounts; parties stay public. **The verifier currently accepts only non-ZK UltraHonk proofs, so OZ does not guarantee privacy yet.** Client-side proving makes it heavy to build on in 20h. |
| OZ Smart Account (context rules, signers, policies) + Smart Account Kit (passkeys) + OZ Relayer | 2025–26 | ✅ testnet | Launchtube is retired; use the OZ Relayer. Passkeys rely on secp256r1 (P21). |
| Stellar Private Payments (Nethermind, Circom/Groth16 privacy pool with ASPs) | 2026 dev preview | ⚠️ testnet only, unaudited | Hides counterparties. Many hackathon clones already exist. |
| x402 | live | ✅ testnet: OZ "Built on Stellar" facilitator (testnet + mainnet, fee-sponsored, ~5s settle) and Coinbase facilitator (testnet) | `@x402/stellar` `ExactStellarScheme`. |
| MPP | live | ✅ testnet | `@stellar/mpp/charge/client`. |
| CCTP (native USDC) | Circle-maintained | ✅ per brief (Circle docs) | Infrastructure; not a consumer hook. |

---

## 2. Three products

### #1 (BEST PICK) **SEALED: "a message the future opens, not you"**

**Hook.** Seal a prediction, a confession or a dare with real money attached. It is encrypted *to a moment in time*: nobody can open it early, not you, not us, not a court. At the deadline it opens itself, and Stellar pays out whoever was right.

**Why it's surprising.** People know "commit-reveal", and its flaw is that the loser just never reveals. Timelock encryption (drand `tlock`) removes the reveal step. The decryption key is the drand quicknet beacon for round R, which doesn't exist until that second; the League of Entropy's 3-second beacon publishes it. The Soroban contract **verifies that beacon on-chain with the BLS12-381 pairing** (quicknet: signatures on G1, public key on G2). So the chain itself, not an oracle, attests that time R has arrived and what the key is. That has never been built on Stellar.

**Who uses it and why.**
- Friends betting on Benfica–Porto ("Called it 2-1, sealed before kickoff, 10 XLM says I'm right").
- Group chats running "open on New Year's Eve" capsules.
- Streamers sealing predictions on stream.
- A "time-locked dare jar": everyone seals a dare plus a stake, and it opens Friday 23:00.

Mom version: "a sealed envelope that the internet opens by itself at 9pm, and the money goes to whoever guessed right."

**Mechanism.**
1. Browser: `tlock-js` encrypts `{prediction, salt}` to drand quicknet round R = time→round(deadline).
2. `seal(R, ciphertext, commit = sha256(prediction‖salt), stake)` stores the ciphertext on-chain and moves the stake into the contract (XLM SAC).
3. Friends `counter(seal_id, side, stake)` blind, without seeing the prediction.
4. After R, *anyone* calls `open(seal_id, beacon_sig_R, prediction, salt)`.
   - The contract checks `bls12_381.hash_to_g1(sha256(R as u64 BE), DST="BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_")`.
   - It checks `pairing_check([sig, H(m)], [-g2, PK_quicknet])` with the drand public key hard-coded.
   - It checks the commit and settles.
5. Since anyone can decrypt after R, the loser can't block the reveal. An undecryptable ciphertext means the sealer forfeits. Resolution: the sealer *also* seals the "outcome-oracle question", and for the MVP the counterparties vote. Alternatively, keep the hero flow to "capsule opens itself, everyone sees it was sealed at T", which needs no oracle.

Classic twist: payout through a **claimable balance with a time-bound predicate** (`not_before` = deadline) as the "envelope", so even the payout can't move early.

**Why only on Stellar / newly possible.** Native BLS12-381 hash-to-curve plus pairing host functions make drand verification one cheap contract call. On EVM it needed EIP-2537, which arrived only in Pectra 2025. Nobody on Stellar has a drand verifier, and Scout shows 0 builds.

**90-second demo.** Seal "Our pitch will get a judge to say 'wait, what?'" + 10 XLM, deadline = 60s from now. Show the ciphertext on stellar.expert. A teammate tries "Open now" and gets the contract error `RoundNotReached`, and drand has no such signature yet. A countdown runs; at 0, the drand beacon appears, anyone clicks Open, and the contract verifies the BLS pairing on-chain (show the tx). The message decrypts on screen and the payout lands. **Jaw-drop:** "we couldn't have opened it either; we encrypted it to a second in the future."

**Hard parts (honest).**
- Getting the exact quicknet hash-to-curve DST, message format and point encoding right in Soroban. Budget 3–5h and test against a known beacon in `cargo test` first.
- Point encoding: Soroban wants uncompressed points; drand ships compressed G1 (48B), so decompress client-side with `@noble/curves` and pass 96B.
- CPU budget of `hash_to_g1` plus a 2-pair check (should be fine).
- Outcome resolution for bets. Keep the MVP to timelock reveal plus a stake for the sealer and blind counter-stakes, with simple manual/vote resolution.

**Prior art.**
- Scout: 0 builds for "drand", "timelock", "time capsule", "BLS". The nearest are PrismX (ZK sealed range predictions, Real-World ZK) and Splicers (verifiable-random NFT battles, Scaffold Stellar WIN).
- Web: drand verified on Ethereum (drand blog, Aug 2025), CosmWasm and a Bittensor pallet. **No Soroban drand verifier is published.**

**Bonus.** The same verifier gives Stellar its first **unbiasable public randomness** (Soroban's PRNG is validator-influenceable), which is the judges' favourite "verifiable randomness" theme. Add a "drand raffle" button for free.

---

### #2 **CROWD KEY: a vault that opens only when the whole room taps**

**Hook.** A prize pot (or a band's encore fund, or a streamer's giveaway) that unlocks only when **N strangers in the same room sign within 60 seconds**. Hundreds of signatures collapse into one BLS signature verified in a single Soroban call, and then drand picks one signer at random to win.

**Why it's delightful.** It's a flash mob with money, a live, physical, social moment: scan the QR, tap, watch the bar fill, 187/200… UNLOCKED. Classic Stellar multisig caps at 20 signers. BLS aggregation makes "the crowd is the key" possible.

**Users.** Event hosts and meetups ("audience unlocks the prize"), streamers ("chat unlocks the drop when 500 of you sign"), bars ("table unlocks a round"), and DJs.

**Mechanism.**
1. Each phone makes a BLS12-381 key in-browser (`@noble/curves`) and registers its pk along with a **proof-of-possession**, which defeats rogue-key attacks.
2. A collector (websocket) sums the G2 signatures over `(vault_id, epoch)` and builds a signer bitmap.
3. The contract sums the registered G1 pks for the bitmap (`g1_add` ×N) and runs one `pairing_check`, adapted from the official `bls_signature` example.
4. On reaching the threshold, it releases the pot. The winner index comes from the drand beacon (reusing #1's verifier), or the pot is split.
5. The vault can be an OZ Smart Account using **CAP-71 `delegate_account_auth`** to a "crowd-signer" contract, so the crowd literally *is* a signer of a real account.

**Newly possible.** On-chain BLS aggregation plus P27 auth delegation (Jul 2026) let a smart account take "a crowd of 300" as one signer.

**Demo.** Film the HackMeridian room scanning the QR; the progress bar hits the threshold; one tx on the explorer; a random attendee's phone buzzes "you won 50 XLM". **Jaw-drop:** "300 people just signed one Stellar transaction."

**Hard parts.**
- Collecting signatures live (websocket server).
- Storing the pk list (pack it into one persistent `Vec<BytesN<96>>`, about 600 keys per 64KB entry).
- Getting a real crowd for the video. A fallback script can simulate 200 phones.
- CAP-71 tooling is reportedly immature, so make it optional and use a plain `__check_auth` custom account (exact example) first.

**Prior art.** Scout: 0 for "aggregate signatures" and "BLS". The nearest are ordinary multisig apps (Stratum, KALE WIN; Cluster; Safe.xlm). No crowd-unlock found.

---

### #3 **BRIBE THE BOUNCER: talk an AI into opening a real vault**

**Hook.** An AI bouncer guards a Stellar vault of real (testnet) money. Each message you send costs a few cents through MPP/x402 and grows the pot. Convince it to let you in and the whole pot is yours.

**Why it's delightful.** It's a social-engineering game anyone understands. The new part is that the bouncer's authority is enforced by an **OZ Smart Account policy**: the AI's key is a signer that can *only* call `release(pot → winner_of_this_conversation)` and cannot drain to the operator. The judges' brief asked for "creative things with AI agents", and this is that.

**Mechanism.**
- OZ Smart Account with a context rule: the AI signer is limited to the vault contract's `release` function, recipient = the address that paid the last message, max once.
- The operator key has no spend rights. A CAP-71 delegated signer could hold the AI key in a separate contract.
- Pay-per-message through `@stellar/mpp` charge, or the x402 OZ facilitator, on testnet.
- Every message hash goes on-chain as an event, so the transcript is auditable.

**Newly possible.** x402/MPP on Stellar plus OZ policy-scoped smart-account signers (2025–26).

**Demo.** Three failed attempts (the pot visibly ticks up per message), then a clever prompt; the AI calls `release` and the explorer shows a payout that only the policy permitted.

**Hard parts.** It's the easiest to build, but the trust story is weak (the operator still runs the model). It also brushes against the "agent wallets / x402" theme other teams will have, and Freysa (Base, Nov 2024) is famous prior art, so it's less novel. Scout: 0 Freysa-style builds on Stellar.

---

## 3. Ranking (wow × feasibility)

| # | Idea | Wow | Feasible by Mon 12:00 | New capability | Testnet |
|---|---|---|---|---|---|
| 1 | **SEALED** (drand timelock, verified on-chain) | 9 | 6–7 (verifier is the one risky piece; test it first) | BLS12-381 hash_to_g1 + pairing (CAP-59), first drand verifier on Stellar | ✅ |
| 2 | CROWD KEY (BLS-aggregated room unlock + drand raffle) | 8 | 7 (example contract exists; live crowd is a demo risk) | BLS aggregation + CAP-71 delegation (P27) | ✅ |
| 3 | BRIBE THE BOUNCER | 7 | 8 | x402/MPP + OZ smart-account policies | ✅ |

**Synergy.** #1 and #2 share the same Soroban BLS/drand module. Build the drand verifier first (cargo test against a real quicknet beacon), then SEALED is the hero flow and "drand raffle" / CROWD KEY are stretch goals.

**Avoid.** Pure ZK games or private payments: SDF has already run two ZK hackathons full of them. Confidential tokens: OZ v0.8 verifier isn't zero-knowledge yet, and the testnet demo targets the old preview.

## Sources
- developers.stellar.org: /docs/networks/software-versions, /docs/build/apps/privacy, /docs/build/guides/contract-accounts/smart-wallets, /docs/build/smart-contracts/example-contracts/bls-signature, /docs/build/smart-contracts/example-contracts/delegate-auth, /docs/build/agentic-payments/x402, /docs/tokens/cross-chain-transfers, /meetings/2026/04/30
- Scout `searchHackathonBuilds` (observed 2026-10-25)
- Web: [drand quicknet on Ethereum](https://docs.drand.love/blog/2025/08/26/verifying-bls12-on-ethereum), [drand-verify crate](https://docs.rs/crate/drand-verify/latest), [CosmWasm BLS12-381](https://cosmwasm.cosmos.network/core/standard-library/cryptography/bls12-381), [P27 upgrade guide](https://stellar.org/blog/foundation-news/stellar-zipper-protocol-27-upgrade-guide)
