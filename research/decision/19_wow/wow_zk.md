# WOW lane: ZK, natively, made delightful

Researched 2026-10-25 ~15:50. Sources: stellar-raven skill `zk-proofs`, developers.stellar.org/docs/build/apps/zk, Scout hackathon-build search, one web search.

## Reality check first: the ZK space on Stellar is crowded

There have already been **two dedicated Stellar ZK hackathons**, "Stellar Hacks: ZK Gaming" and "Stellar Hacks: Real-World ZK". Scout lists dozens of builds that already cover the obvious ideas:
- **Treasure hunts:** SUBAN Treasure Hunt, Dead Drop, Treasure Recovery.
- **Sealed predictions and bids:** PrismX, SealedStellar, Segel, Sotto, Cypher Markets.
- **Prove-you-were-there and personhood:** EventStellar, zkSybil, ZK-Tix, Meet.xlm.
- **Anonymous speech:** ZKonfess, DeadDrop, Dr. T.
- **Battleship, poker and UNO:** several of each.
- **Guessing games:** ZK Pass, Zkgram, AlphaDuel.
- **KYC and age checks:** about ten.

The judges have seen all of these, so the four "ideas to beat" in the brief are already taken on Stellar.

Searches that came back empty on Scout: **crush**, **dating**, **riddle**, **semaphore**. Stamp rally returned only Sorostamp, a DKIM project, so the space is effectively empty.

Nearest off-Stellar prior art:
- zkLove (ETHGlobal New Delhi) and zkRizz (ETHIndia 2023): ZK dating apps that verify identity.
- ZK Secret Santa: an Ethereum research protocol that uses relayers and nullifiers.

None of these uses the "both must choose, otherwise nothing leaks" mechanism below.

## Verified building blocks (Protocol 25 / 26)

- **BN254:**
  - `crypto::bn254` gives `g1_add`, `g1_mul` and `pairing_check` from Protocol 25 (CAP-74).
  - G1 MSM and Fr arithmetic arrived in Protocol 26 (CAP-80).
  - That is enough for a **Groth16 verifier over BN254**, i.e. Circom/snarkjs `bn128` output.
- **Poseidon:**
  - The host functions expose only the **permutation** (CAP-75), behind the SDK's `hazmat-crypto` feature.
  - The ready-made hash is `stellar/rs-soroban-poseidon` (crate `soroban-poseidon` 27.0.0, audited). Its README says the sponge matches circomlib.
- **Noir:**
  - Noir/UltraHonk verification needs `NethermindEth/rs-soroban-ultrahonk` and Protocol 26.
  - It is young and heavier to integrate. **I'd avoid it for a 20-hour build.**
- **Reference repos:**
  - `stellar/soroban-examples/groth16_verifier`: the canonical Groth16 verifier, written for BLS12-381. Porting it to `bn254` means swapping the types.
  - `FredericRezeau/xray-games`: MIT, Circom 2.1.9 plus BN254 Groth16 verified on Soroban, with contracts **live on mainnet**. This is the best working reference for converting snarkjs JSON into Soroban bytes.
  - `NethermindEth/stellar-private-payments`: Circom BN254, a Poseidon Merkle tree, nullifiers, and browser WASM proving. Use it as a reference for the tree and nullifier pattern.

---

## Hook 1 — **MUTUAL** 💘 "You only find out if they like you back. If they don't, nobody ever knows you asked, not even us."

**What it is:** a secret-crush button for the people at an event: the hackathon, a wedding, an office, a class.
- Pick up to 3 people.
- If someone you picked also picks you, both phones light up: *"It's mutual."*
- If not, nothing leaks. They never find out, onlookers never find out, and the app operator never finds out.

**Why it's delightful:** everyone understands the feeling instantly ("my mom can understand it"), and the privacy guarantee is the whole product. Without the cryptography the app is impossible: the guarantee is "no one, including us, can see your choices." The same mechanism generalises to "both open to co-founding?", "both thinking of quitting?" and "both want to split this lunch?". It is private set intersection with a romantic face.

**Who uses it and why:** event communities, Lisbon hackathon attendees (live tonight), university classes, and offices ("mutual interest in a transfer"). It's fun and it's flirty, and it matters most for the cases where people really do want mutual consent before anything is revealed.

**Mechanism:**

1. **Join.** Each user creates a Semaphore v4 identity: a Baby Jubjub keypair derived from a Freighter `signMessage`, so the same wallet always gives the same key.
   - The public key and a display name go into a Soroban **registry**.
   - The leaf `Poseidon(pk)` is inserted into an on-chain LeanIMT Merkle root, computed with `soroban-poseidon` so it matches circomlib.
2. **Crush on B.** The browser computes a shared secret `S = ECDH(sk_A, pk_B)`. B computes the same `S` from `ECDH(sk_B, pk_A)`. The tag is `Poseidon(S.x, eventId)`.
   - Only A and B can ever compute this tag.
   - For anyone else it is a random field element.
3. **Post anonymously.** A posts the tag with a **Groth16/BN254 proof** containing:
   - "I'm a member of the registry root" (Merkle membership);
   - the nullifier `Poseidon(scope, secret)`, where scope is one of 3 per-event slots (crush #1–#3). This gives anonymous-but-unique participation: at most 3 crushes, no Sybil fishing;
   - the tag bound as the proof's message.

   The tx goes through a tiny **relayer** (a fee-paying testnet key, or a fee-bump), so the poster's account never appears.
4. **Contract `crush(proof, root, nullifier, tag, scope)`:**
   - verifies the proof with `crypto::bn254().pairing_check`;
   - checks the root is current and the scope is one of the 3 allowed;
   - stores the nullifier;
   - if `tag` is already stored, it emits `Match(tag)`.

   Each phone watches for `Match` events whose tag it can compute itself, and celebrates. Nobody else can link a tag to names.

**Why only on Stellar, or newly possible:**
- A BN254 pairing check is a native host function since Protocol 25 (X-Ray), and Poseidon since CAP-75. Before that, Groth16-on-Soroban meant BLS12-381 only, so it didn't fit the snarkjs/Semaphore ecosystem.
- Now the **off-the-shelf Semaphore stack** (circuits, trusted-setup artifacts, browser prover) verifies natively and cheaply.
- Sub-cent fees plus fee-bump/relayer make anonymous posting cheap.
- Honest caveat: this is "newly possible", not "only possible".

**90-second demo:**
1. Three phones: Ana, Bruno, Carla. All join with Freighter, one tap each.
2. Ana picks Bruno. Bruno picks Carla. On stellar.expert two opaque tags appear and the poster is the relayer. "Who liked whom? Even we can't tell."
3. **Jaw-drop:** Bruno picks Ana. Both phones burst into confetti: *"It's mutual 💘"*. Carla's phone shows nothing. On the explorer: one `Match` event between two random numbers.
4. Close with "Carla will never know Bruno picked her." Then the next slide: "same primitive: co-founder matching, mutual-consent intros."

**Hard by tomorrow (honest):**
- **Proof encoding.** Converting snarkjs proofs and the verifying key to Soroban `bn254::G1Affine/G2Affine` bytes. The G2 coordinate order (c0/c1) is the classic bug. Mitigation: copy xray-games' converter, and test against snarkjs `verify` first.
- **On-chain LeanIMT.** It must match `@zk-kit/lean-imt` exactly. **Fallback:** the admin computes the root off-chain and posts it, which is acceptable for a hackathon and should be stated in the README.
- **Proving time.** Semaphore proving in the browser takes about 1–3 s at depth ≤ 16, which is fine.
- **Relayer.** About 40 lines of Node.
- **Semaphore v4 details.** The public-signal order and the keccak-to-field hashing of message/scope must be mirrored in the contract. Read the `@semaphore-protocol/proof` source.
- **Cost.** The Groth16 verifier is roughly 4 pairings plus 4 scalar multiplications, comfortably within budget (xray-games runs a similar verifier on mainnet).

**Template to start from:**
- **Circuit and prover:** Semaphore v4, unchanged (`@semaphore-protocol/identity`, `@semaphore-protocol/proof`, and its published snark artifacts). **No custom circuit and no ceremony.**
- **Verifier:** `soroban-examples/groth16_verifier` ported to `crypto::bn254`, using `FredericRezeau/xray-games` as the reference for BN254 encoding.
- **Poseidon:** `rs-soroban-poseidon`.
- **ECDH:** `@zk-kit/baby-jubjub`.
- **Frontend:** our existing Vite/React plus Freighter.

Wow 9 · feasibility 7.

---

## Hook 2 — **UNSTEALABLE ANSWER** 🧩 "A riddle with real money on it. Prove you know the answer without saying it, so nobody can copy you."

**What it is:**
- A riddle goes up on the big screen with an XLM pot.
- Solvers type the answer on their phone. The phone produces a proof of "I know x with Poseidon(x) = H", **bound to my address**.
- The contract pays the first N solvers and puts them on a leaderboard. The answer is **never revealed**, so the riddle stays live for the next solver and the next city.

**Why it's surprising:** the old-vs-new story is perfect for "Stellar Unlocked".
- Stellar has had `hash(x)` signers since 2015, but using one **publishes x**, so the first claim spoils the riddle and the answer can be copied.
- BN254 + Poseidon fix that: knowledge stays private and the proof can't be front-run, because it is bound to the claimant's address.

**Who uses it:** pub quizzes, escape rooms, creators' puzzle drops, conference booths, and ARGs.

**Mechanism:** a ~300-constraint Circom circuit, `Poseidon(answer_normalized, salt) == H`, with public inputs `H` and the claimant's address as a field. A Soroban `claim()` verifies it with the BN254 Groth16 verifier, records a nullifier `Poseidon(answer, address)` so each person claims once, and pays out from the pot.

**Demo:** the riddle appears in the video and the presenter solves it. The explorer shows the payout and **no answer anywhere on the chain**. Then a second phone tries to replay the first proof from the explorer and is rejected (the address binding).

**Hard by tomorrow:** very little. This is a single-statement circuit with a one-person snarkjs setup (disclosed as dev-only).

**Risk:** adjacent to ZK Pass and Zkgram (guessing games), and less "dinner-table" than Mutual.

Wow 6 · feasibility 9.

---

## Hook 3 — **MIRADOURO PASS** 🌅 "Prove you climbed 5 of Lisbon's 7 viewpoints without revealing which ones or when."

**What it is:**
- Each viewpoint has a QR sticker that holds a secret.
- Collect them, then prove **≥5 of 7** to mint a "Lisbon conquered" badge or claim a pastel de nata voucher token.
- Unlike a POAP, your route and timeline stay private, and a nullifier stops one set of photographed QRs from being farmed by many accounts.

**Mechanism:**
- Circuit: 7 optional Poseidon preimage checks against public hashes, a count ≥ k (range check), and a nullifier `Poseidon(identity_secret, campaignId)`.
- Contract: BN254 Groth16 verify, then mint a Stellar asset to the claimant. A classic asset with `AUTH_REQUIRED` makes the badge non-transferable.

**Demo:** scan three QRs on the table, fail the claim; scan two more, pass, and the badge lands in Freighter.

**Hard by tomorrow:**
- The circuit is custom (~1–2 hours).
- QR secrets photographed and shared defeat "presence". Be honest that this is presence-lite; rotating QRs would fix it later.
- "Prove you were there" is close to EventStellar and ZK-Tix.

Wow 6 · feasibility 7.

---

## Ranking (wow × feasibility)

1. **MUTUAL**: the best pick. It is the only one that makes a non-crypto person gasp. There is no Stellar prior art on Scout, and it needs **zero custom circuit work** because Semaphore v4 is used unchanged.
2. **Unstealable Answer**: the safest. It is also the ideal **fallback inside Mutual's codebase**: the same BN254 verifier contract and a tiny circuit. If the Semaphore integration stalls by about 02:00, pivot to this.
3. **Miradouro Pass**: charming and Lisbon-local, but closest to existing proof-of-attendance builds.

**Build order for Mutual:**
1. BN254 Groth16 verifier contract plus a test against one real snarkjs proof. This is the riskiest piece, so do it first, about 2–3 hours.
2. Registry with an admin-posted root.
3. Browser ECDH tag plus Semaphore proof.
4. Relayer.
5. `Match` event listener plus confetti.
6. If there's time, compute the root on-chain with `soroban-poseidon`.

## Links
- https://developers.stellar.org/docs/build/apps/zk
- https://github.com/stellar/soroban-examples/tree/main/groth16_verifier
- https://github.com/FredericRezeau/xray-games (BN254 Groth16 on Soroban, Circom 2.1.9, mainnet)
- https://github.com/stellar/rs-soroban-poseidon
- https://github.com/NethermindEth/stellar-private-payments (Circom/BN254 Merkle tree and nullifier reference)
- https://github.com/NethermindEth/rs-soroban-ultrahonk (Noir path; avoid for now)
- Prior art off-Stellar: [zkLove](https://ethglobal.com/showcase/zklove-92z9q), [zkRizz](https://ethglobal.com/showcase/zkrizz-gzmjx), [ZK Secret Santa](https://coin360.com/news/ethereum-zk-secret-santa-privacy-protocol-testing)
