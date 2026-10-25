# Agent 2 — Stellar Architect: capability map + 4 concepts

Author: Stellar Architect (blind phase). Written Sun 2026-10-25 ~13:20 Lisbon.
Labels: **[V]** = verified (link or live probe given), **[A]** = reasonable assumption, **[S]** = speculation, **[U]** = unverified/unknown dependency.

---

## (a) Verified capability map

**Network state (live probe 2026-10-25 12:59 UTC):** testnet RPC `getVersionInfo` → `protocolVersion: 29`, rpc 30.0.0; Horizon testnet `current_protocol_version: 29`. Mainnet also P29 (Oct 1 2026). P28 = CAP-83/85/86; P27 = CAP-71 (auth delegation). Matching toolchain: `soroban-sdk 28.0.0`, `stellar-cli 28.1.0` — exactly what the repo pins and what is installed (`stellar 28.1.0`, rustc 1.99, node 24). [V] https://developers.stellar.org/docs/networks/software-versions

### Mature & safe for a 15-hour build

| Primitive / tool | What it gives us | Status | Source |
|---|---|---|---|
| **Classic tx preconditions (CAP-21)**: `minSeqNum`, `minSeqAge`, `minSeqLedgerGap`, timebounds, ledgerbounds, extra signers | Time-delayed, inactivity-triggered pre-signed transactions **with no contract**. CAP-21 motivation explicitly lists "time-delayed key recovery". `seqTime` updates for the source of *every executed tx* and every successful `BumpSequence` (even a no-op bump). | Final, since P19; testnet+mainnet. JS SDK has `setMinAccountSequence/Age/LedgerGap`, `setExtraSigners` (checked in repo's installed `@stellar/stellar-sdk` 17.x). Horizon exposes `sequence_time`/`sequence_ledger` on accounts (live probe). | [V] [ops & txs](https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions#minimum-sequence-age), [CAP-21](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0021.md) |
| **Fee-bump tx (CAP-15)** | A third party (heir, relayer, venue) pays fees for someone else's signed tx | Mainnet+testnet | [V] [fee sponsorship](https://developers.stellar.org/docs/build/guides/transactions/fee-sponsorship) |
| **Asset auth flags**: AUTH_REQUIRED, AUTH_REVOCABLE, AUTH_CLAWBACK_ENABLED; `SetTrustLineFlags`; "authorization sandwich" | Issuer-approved transfers only; one-tx atomic approve→pay→de-authorize; clawback (requires revocable; only for trustlines created after the flag) | Mainnet+testnet | [V] [control asset access](https://developers.stellar.org/docs/tokens/control-asset-access) |
| **SEP-8 regulated assets** (approval-server pattern) | Standard pattern: issuer server inspects + co-signs each transfer | Standard documented; we'd write our own server (no off-the-shelf JS server) [A] | [V] [anatomy of an asset](https://developers.stellar.org/docs/tokens/anatomy-of-an-asset#compliance) |
| **Claimable balances + predicates**, **sponsored reserves** (`Begin/EndSponsoringFutureReserves`, 0-XLM account creation) | Pay someone who has no account yet; time-boxed claim/reclaim; onboarding with zero XLM | Mainnet+testnet | [V] [sponsored reserves](https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves), [wallet: sponsoring account creation](https://developers.stellar.org/docs/build/apps/wallet/stellar#sponsoring-account-creation) |
| **Built-in DEX + path payments**, **SAC** (classic asset ↔ SEP-41 contract token) | Atomic FX; classic assets usable from Soroban | Mainnet+testnet | [V] skill `stellar-dev.assets` |
| **Soroban + OpenZeppelin Stellar Contracts v0.8.0** (fungible, NFT, RWA/ERC-3643, SEP-56 vault, smart accounts w/ context rules + policies (multisig, spending limits), access control, pausable/upgradeable, Merkle distributor, fee-abstraction) | Audited building blocks; **OZ v0.8.0 pins `soroban-sdk = 28.0.0` = our workspace** | Audited (per docs) | [V] [OZ contracts docs](https://developers.stellar.org/docs/tools/openzeppelin-contracts), [Cargo.toml](https://github.com/OpenZeppelin/stellar-contracts/blob/main/Cargo.toml) |
| **Passkey smart accounts — Smart Account Kit** (drives OZ Smart Account) | Seed-phrase-free wallets; the official "guestbook" tutorial uses it | Live tutorial; npm `smart-account-kit` 0.8.0 [V version; publisher U] | [V] [smart wallets](https://developers.stellar.org/docs/build/guides/contract-accounts/smart-wallets), [guestbook](https://developers.stellar.org/docs/build/apps/guestbook) |
| **OpenZeppelin Relayer / Stellar Channels** | Fee sponsorship + submission (Launchtube replacement). Testnet API key generator needs no auth: `channels.openzeppelin.com/testnet/gen` | Testnet + mainnet | [V] [OZ relayer](https://developers.stellar.org/docs/tools/openzeppelin-relayer), [x402 built-on-stellar](https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar) |
| **x402** (`@x402/stellar` 2.28.0) via OZ Channels facilitator or x402.org facilitator (testnet, no key) | Paid HTTP APIs, zero-XLM clients | Testnet+mainnet | [V] [x402 docs](https://developers.stellar.org/docs/build/agentic-payments/x402), skill `agentic-payments` |
| **SDF test anchor** `testanchor.stellar.org` — SEP-10, **SEP-45 (contract-account auth)**, SEP-6/12/24/31/38 | Real anchor flows on testnet; SEP-24 deposit/withdraw **USDC, SRT, XLM, min 1 / max 10** | Live (probed `stellar.toml` + `/sep24/info`) | [V] live probe; `@stellar/typescript-wallet-sdk` 5.1.0 on npm |
| **Testnet USDC** issuer `GBBD47…FLA5`, SAC `CBIELTK6…DAMA` | Realistic stablecoin demo | Circle faucet (captcha, manual) | [V] skill `agentic-payments` |
| **ZK host fns**: BLS12-381 (P22), BN254 + Poseidon/Poseidon2 *permutation* (P25), BN254 MSM/Fr (P26) | On-chain Groth16 verify (Circom, RISC Zero wrap); UltraHonk via Nethermind verifier | Live on P29 networks | [V] skill `zk-proofs`, [privacy page](https://developers.stellar.org/docs/build/apps/privacy) |
| **Ecosystem**: Blend (lending, mainnet), Reflector (oracle, mainnet), DeFindex (vaults over Blend, mainnet; has testnet + SDK needing API key), Trustless Work (escrow-as-a-service; HackMeridian partner) | Composable DeFi/escrow | Mainnet live; testnet details partially [U] | Scout directory; [DeFindex testnet tutorial](https://dev.to/paltalabs/test-defindex-dapp-on-testnet-1n65) |

### TRAPS (sound available, but will burn hours)

1. **Launchtube is retired** (repo archived, service shut down). Any tutorial using it is dead → OZ Relayer/Channels. [V]
2. **OZ Confidential Token** = *developer preview*; verifier currently accepts **non-ZK UltraHonk proofs** → OZ does not guarantee amounts stay private. Don't pitch it as privacy. [V]
3. **Stellar Private Payments (Nethermind)**: testnet-only, unaudited, SDK alpha. [V]
4. **Poseidon host fn is a permutation, not a hash** — must match circomlib params yourself; Noir/UltraHonk needs P26 + a heavy verifier. ZK is a 15-hour trap for Soroban newcomers unless the circuit is trivial. [V]
5. **CAP-71 auth delegation** (P27) is Final but has no ergonomic SDK/tutorial layer — skip. [V CAP status; ergonomics A]
6. **`@stellar/mpp` 0.7.x pins `@stellar/stellar-sdk@^15`** and `mppx@^0.6.x`; our frontend is on SDK 17 → isolate in a separate Node package or ERESOLVE. [V skill]
7. **Passkey Kit ≠ Smart Account Kit** (different on-chain auth models, not drop-in compatible; Passkey Kit unaudited). WebAuthn needs HTTPS/localhost + stable RP ID — recording a demo on a deployed URL needs care. [V/A]
8. **Claimable-balance claimants are G-accounts** (XDR `Claimant.destination` is an `AccountID`) — they don't compose directly with passkey C-addresses. [A, high confidence]
9. **Testnet DEX liquidity and testnet "yield" are fake/thin** — you must seed your own offers/pools; Blend/DeFindex testnet APY is cosmetic. [A]
10. **Testnet resets** periodically — keep a one-command redeploy script; check status page. [V] [networks](https://developers.stellar.org/docs/networks#testnet-and-futurenet-data-reset)
11. **Accounts that never transacted since P19 have no `seqTime` extension** (Horizon omits `sequence_time`; CAP-21 treats it as 0) → a `minSeqAge` check passes immediately. Any CAP-21 design must "initialize" with one tx first. [V probe: field absent on dormant account, present on active one]
12. **Stellar Wallets Kit v2 is on JSR, not npm** (`npx jsr add @creit-tech/stellar-wallets-kit`). SDK v16+ requires Node 22+. [V skill]
13. **Agentic spend-limit wallets are saturated**: ≥8 prior Stellar hackathon builds (SpendGuard ×2, StellarGuard, SentinelShield, x402 Autopilot, Agent-Vault…). Paywall-for-agents also saturated (PayWall.ai, AgentSense, SearchPay…). ZK private payments/voting saturated from "Real-World ZK" hackathon. [V Scout hackathon index]

---

## (b) Four concepts

### SA-1 — **Heirloom**: a protocol-native dead man's switch for self-custody (no smart contract, no keeper, no oracle)

- **Target user:** Self-custodying Stellar holders (individuals, small treasuries, family offices, crypto-native freelancers in LatAm/Africa holding USDC on Stellar) who have no recovery plan if they die or lose keys; secondarily wallets (LOBSTR/Freighter-style) wanting a "recovery contact" feature.
- **Problem:** Self-custody fails at death/incapacity/lost keys. Existing fixes are custodial (exchange), legal-only, or a smart contract that needs the owner to "check in" and a keeper/oracle to trigger — plus funds must be moved into the contract.
- **Solution (MVP):** Owner picks an heir address and an inactivity window. App builds **one pre-signed transaction** from the owner's account:
  - `seqNum = S + 2^32` (far ahead), precondition `minSeqNum = S`, precondition **`minSeqAge = window`**, no maxTime;
  - op: `SetOptions` adding heir as signer with weight ≥ high threshold (optionally `masterWeight` unchanged).
  The owner signs once in Freighter; the heir keeps the XDR (download/QR/email). **Any** normal transaction by the owner resets `seqTime`, so the will silently re-arms; the owner never re-signs. "I'm alive" = no-op `BumpSequence` (CAP-21: updates `seqTime` even if seq unchanged). **Revoke** = `BumpSequence(bumpTo ≥ willSeq)` → the will becomes permanently invalid. Heir claims by wrapping the XDR in a **fee-bump** (heir pays fee) and submitting; the network itself rejects it until the owner has been inactive for the window. Funds never leave the owner's account; works for XLM, every classic asset and SAC/SEP-41 balances held by the G-account.
  - Stretch: staggered heirs (spouse at 90 days, lawyer at 180 days — ordered seqNums), per-heir partial payouts, off-chain email reminder before expiry, a tiny Soroban "will registry" storing hash + encrypted pointer.
- **Stellar primitives & why Stellar:** CAP-21 `minSeqNum` + `minSeqAge` (+ optional `minSeqLedgerGap`), `SetOptions` signer/thresholds (native multisig), `BumpSequence` (revocation/heartbeat), CAP-15 fee-bump, Horizon `sequence_time`. **On EVM this is impossible without a contract wallet + keeper**: an EOA's pre-signed tx cannot be made "valid only after N seconds of account inactivity." Here the validator set enforces it. CAP-21 literally names "time-delayed key recovery" as a motivation — no one appears to have productized it.
- **Track fit:** **Stellar Unlocked** (core protocol features, zero contracts). Could add Composed via Smart Account Kit recovery-contact UX, but unnecessary.
- **Differentiation:** Prior hackathon builds — *Boreal Pulse* (Soroban check-in vault), *Obol* (ZK dead man's switch), *Heritaz* (ideathon); directory project *Legacy Suite* (estate planning). All require moving funds into a contract and/or active check-ins. Heirloom: funds stay put, any normal activity is the heartbeat, revocation is one op, no backend required for safety. Scout repo search for `minSeqAge` returned no matching app. [V Scout; absence ≠ proof]
- **Demo (90 s):** (1) Owner connects Freighter, has 500 USDC + XLM. (2) Creates will: heir = second wallet, window = 60 s for demo; signs once; heir gets QR. (3) Heir dashboard tries to claim → network rejects (`txBAD_MIN_SEQ_AGE_OR_GAP`) with live countdown from `sequence_time`. (4) Owner pays a coffee → countdown resets on screen (the "aha"). (5) Owner goes silent; countdown hits 0; heir claims via fee-bump; Stellar Expert shows heir now signer; heir moves USDC. (6) Bonus: show revocation via one BumpSequence making the old will dead forever.
- **Architecture & feasibility:** React (existing Vite app) + `@stellar/stellar-sdk` + Freighter; Horizon testnet. Optional tiny Node/edge function for email reminders. No Soroban required (keep `contracts/` for an optional registry). Est.: tx builder + signing 3h, heir claim/fee-bump 2h, status/countdown UI 3h, multi-heir + revoke 2h, polish/README/video 4h → **~14h, low risk**. Team learns only classic tx building.
- **Biggest uncertainty:** (a) **Freighter signing a tx whose seqNum is far ahead / has preconditions** — expect fine (it signs arbitrary XDR) but must test in hour 1; fallback: Stellar Wallets Kit or local keypair for demo [A]. (b) "No contract" may look *too simple* to judges — mitigate by framing as a protocol-level primitive + polished heir UX + staggered heirs. (c) Heir-key compromise = heir gets control after the window; owner education needed (two-stage design possible).
- **Evidence:** CAP-21 semantics & key-recovery motivation [V CAP-21]; JS SDK precondition setters [V installed SDK]; Horizon `sequence_time` [V live probe]; uninitialized-seqTime trap [V probe + CAP-21 A]; Freighter behavior [A]; market size of lost-crypto-at-death [S, needs Problem Hunter data].

---

### SA-2 — **FairSeat**: scalper-proof event tickets enforced by asset authorization, not by an app

- **Target user:** Independent venues/promoters and festivals (e.g., Lisbon's mid-size concert venues, conference organizers like HackMeridian itself) and fans who resell tickets they can't use.
- **Problem:** Secondary-market scalping (bots buy, resell at 3–10×), fraudulent duplicate tickets, and organizers earning nothing on resale. Platform-enforced caps work only inside one app; NFT tickets on most chains are freely transferable so caps are unenforceable.
- **Solution (MVP):** Each event tier is a **classic Stellar asset** issued with `AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED`. Holders' trustlines sit at *authorized-to-maintain-liabilities* (they hold, can't move). Every transfer must go through the organizer's **SEP-8-style approval server**, which only co-signs an atomic **authorization sandwich**: `[authorize seller, authorize buyer, buyer→seller USDC ≤ face value, buyer→organizer royalty, seller→buyer 1 TICKET, deauthorize both]`. Primary sale = same shape with the issuer. Door check-in = ticket sent back to issuer (burn) in a fee-sponsored tx; fraud/refund = clawback + USDC refund. Resale listing: seller escrows the ticket into a server-controlled account (one approved tx); buyer then signs a single tx; settlement is DvP-atomic.
- **Stellar primitives & why Stellar:** trustline authorization flags + `SetTrustLineFlags` sandwich, clawback, SEP-8 approval pattern, SAC-less classic `Payment` for USDC + ticket in one atomic tx, sponsored reserves so fans need no XLM for the ticket trustline, fee-bump for check-in. Tickets show up in **any Stellar wallet** (they're real assets) yet remain non-transferable without issuer approval — issuer-controlled transferability is a **protocol-level** property, not a contract convention that marketplaces can bypass. Atomic multi-party DvP + royalty without writing a contract.
- **Track fit:** **Stellar Unlocked** (asset issuance + auth flags + clawback). Composed optional (USDC + Smart Account Kit buyers — but C-addresses complicate classic trustlines; keep G-accounts).
- **Differentiation:** Prior Stellar entries *TicketReal* (Chile ideathon winner — concept), *TokenTicket*, *Twin Ticket*, *ZK-Tix*, *BlockFest*, *KaizenX* — generally NFT/contract tickets. None found using auth-required classic assets + approval server [V Scout; absence ≠ proof]. Outside Stellar: GET Protocol, YellowHeart (contract-enforced).
- **Demo (90 s):** Organizer creates "Lisbon Jazz Night — GA, face €30" (asset issued with flags shown in Stellar Lab/Expert). Fan A buys (USDC). Fan A tries to send ticket to Fan B directly from Freighter → **network rejects** (`op_not_authorized`). Fan A lists at €90 → approval server refuses (cap). Lists at €30 → Fan B buys; one tx shows payment + 10% royalty + ticket + flags in/out. Door scanner: QR → burn tx → "admitted". Organizer revokes a fraudulent ticket via clawback.
- **Architecture & feasibility:** Node/Express approval server (issuer + escrow keys, policy checks, builds sandwich XDR) + React frontend (Freighter) + Horizon. No Soroban needed. ~3h asset/flags/issuance scripts, ~5h approval server + tx assembly, ~4h UI (organizer / fan / door), ~3h polish → **~15h, medium risk** (multi-signer XDR handling is fiddly for newcomers).
- **Biggest uncertainty:** Judges may ask "why not a Soroban NFT with a transfer hook?" — answer: universal wallet visibility, DEX-free but auth-gated assets, no contract audit surface; but it's a nuanced argument. Also centralization: organizer server is a gatekeeper (acceptable — organizer is the issuer anyway). Each ticket tier is fungible (seat-level uniqueness needs one asset per seat or a memo map) [A].
- **Evidence:** sandwich flow & flag semantics [V docs]; SEP-8 standard [V docs mention]; sponsored trustline reserves [V]; "no prior auth-flag ticketing" [V Scout search, absence not proof]; fan/venue demand for capped resale [S — Problem Hunter to validate; EU/UK price-cap regulation debates A].

---

### SA-3 — **Caução**: rental security deposits that earn yield for the tenant and release by mutual sign-off

- **Target user:** Tenants and small landlords in high-mobility rental markets — Lisbon/Porto expats, Erasmus students, digital nomads; property managers. (Portugal: deposits commonly 1–3 months' rent held by landlord [A].)
- **Problem:** Deposits are dead money held by the landlord, often returned late or with arbitrary deductions; international tenants have no leverage; no neutral, cheap escrow exists for small amounts.
- **Solution (MVP):** Tenant signs up with a **passkey** (no seed phrase, no XLM), deposits EURC/USDC into a per-lease **escrow** that parks funds in a **yield vault**; at move-out both parties sign a release split (e.g., 100%/0% or deductions with a note); interest goes to the tenant; disagreement → named arbiter role. Contract: our own small Soroban escrow (lease params, roles, `deposit`, `propose_release`, `approve_release`, `arbitrate`) that calls a DeFindex vault (or Blend pool) `deposit/withdraw`; alternatively use Trustless Work escrow API for the escrow part.
- **Stellar primitives & why Stellar:** Soroban escrow + SAC (USDC/EURC), cross-contract call into **DeFindex vault / Blend** (yield), **Smart Account Kit** passkey accounts (OZ Smart Account) for both parties, **OZ Relayer/Channels** for fee sponsorship, optionally SEP-24 anchor on-ramp (testanchor supports USDC deposit). Stellar advantage: native EURC/USDC rails + sub-cent fees make a €900 escrow economical; partners-in-the-room (Trustless Work, DeFindex are HackMeridian partners).
- **Track fit:** **Stellar Composed** (Smart Account Kit + OZ Relayer + DeFindex/Blend [+ Trustless Work]) — strong; weak Unlocked.
- **Differentiation:** *BeTrusty × Trustless Work* (security deposits, PULSO hackathon), *Safetrust* (P2P deposits for hotels/rentals) — escrow without yield; many yield-vault builds (YieldPilot, YieldZap…) without the lease use case. Combination "deposit escrow + yield to tenant + passkey onboarding" not found [V Scout; absence ≠ proof].
- **Demo (90 s):** Landlord creates lease (€900). Tenant opens link → Face ID → passkey wallet → deposits (USDC from faucet/anchor). Dashboard shows vault position accruing. Fast-forward: move-out; landlord proposes €850/€50 deduction with note; tenant approves with passkey; contract withdraws from vault and splits principal + yield; both see balances.
- **Architecture & feasibility:** Soroban escrow contract (Rust, ~250 LOC) + React with Smart Account Kit + OZ Channels API key + DeFindex vault (testnet) or Blend testnet pool. Integration-heavy: passkey setup 3–4h (WebAuthn quirks), escrow contract + tests 4h, vault integration 3–4h [U], UI 3h, polish 2h → **~16–18h, medium-high risk**. Cut-line: drop yield (mock interest) → but then Composed weakens to passkey+relayer.
- **Biggest uncertainty:** Testnet availability/usability of a DeFindex vault or Blend pool for our USDC asset and API-key friction [U]; passkeys + relayer setup time for novices; testnet "yield" is cosmetic. Legal reality of deposit custody in PT [S].
- **Evidence:** OZ smart accounts/relayer [V docs]; DeFindex mainnet live, testnet SDK w/ API key [V directory + web search, details U]; Trustless Work API/testnet/key [U]; Blend mainnet live [V directory], testnet pool [U].

---

### SA-4 — **Envelope**: send cash to anyone by link; they open it with Face ID and cash out at an anchor

- **Target user:** Senders in Europe (e.g., Brazilian/Cape Verdean/Angolan diaspora in Portugal) paying family or freelancers who **don't have a crypto wallet**, and recipients who need local cash/bank payout.
- **Problem:** Crypto remittance requires the recipient to install a wallet, write down a seed, buy XLM for reserves, and add a trustline before they can even receive — and then find an off-ramp. Each step loses users.
- **Solution (MVP):** Sender locks USDC in a tiny Soroban **link-escrow** contract keyed to an ephemeral public key embedded in a shareable URL, with an expiry after which the sender can reclaim. Recipient opens the link → creates a **passkey smart account** (Smart Account Kit; fees sponsored via **OZ Channels**) → claim signed by the ephemeral key sends USDC to their C-address → "Cash out" runs **SEP-45** (web auth for contract accounts) + **SEP-24** interactive withdrawal at `testanchor.stellar.org`. Classic alternative path for G-account recipients: claimable balance with `claimant(ephemeral)` + sender reclaim predicate `not(before_relative_time(7d))`, with reserves **sponsored**.
- **Stellar primitives & why Stellar:** Soroban escrow + USDC SAC, OZ Smart Account (passkey secp256r1), OZ Relayer fee sponsorship, **SEP-45 + SEP-24 anchors** (Stellar's anchor network is the unique piece — testanchor advertises SEP-45 `WEB_AUTH_FOR_CONTRACTS_ENDPOINT` and USDC SEP-24 withdraw [V probe]); claimable balances/sponsored reserves for the classic path. The end-to-end "link → passkey → bank cash-out" exists on Stellar because anchors are a standard, not bespoke integrations.
- **Track fit:** **Stellar Composed** (Smart Account Kit + OZ Relayer + Anchor/SEP-45/24) — matches the HackMeridian idea list ("wallets without seed phrases, cash-outs to bank accounts through anchors") almost verbatim; partial Unlocked (claimable balances).
- **Differentiation:** Remittance is the most crowded Stellar vertical (*PayByLink* ideathon; *Tukar*, *ShieldPass* ZK corridors; many wallets). Our edge = recipient needs nothing pre-installed + passkey + SEP-45 contract-account anchor auth (new; few apps use it [A]). Weakest novelty of the four, strongest market narrative.
- **Demo (90 s):** Sender (Freighter) creates €5 envelope, shares link via WhatsApp mock. Recipient phone: opens link → Face ID → wallet created, 5 USDC claimed, 0 XLM ever held. Taps "Cash out" → testanchor SEP-24 popup → withdrawal completes. Sender view: second envelope expired → reclaimed.
- **Architecture & feasibility:** Soroban link-escrow (~150 LOC) + React (Smart Account Kit) + OZ Channels + `@stellar/typescript-wallet-sdk` for SEP-24. Risky integrations: SEP-45 with smart accounts (new) [U], passkey ceremony [A], testanchor min/max 1–10 USDC [V]. **~15–17h, medium-high risk.** Cut-line: recipients as G-accounts via claimable balance + SEP-10 (much safer, ~11h) but loses the passkey story.
- **Biggest uncertainty:** SEP-45 + Smart Account Kit interop on testanchor actually working end-to-end [U]; differentiation vs crowded remittance field.
- **Evidence:** testanchor SEP-24 USDC & SEP-45 endpoint [V live probe]; sponsored 0-XLM account creation [V docs]; Smart Account Kit/relayer [V docs]; claimable-balance G-only claimant [A].

---

### Architect's ranking (for later debate)

1. **SA-1 Heirloom** — highest "only-on-Stellar" score, lowest build risk, uncrowded; risk is perceived simplicity → invest in UX & story.
2. **SA-2 FairSeat** — clear Unlocked fit, crowd-pleasing demo moment (wallet transfer rejected by the network); medium risk.
3. **SA-4 Envelope** — best market/ecosystem narrative, matches organizers' idea list; crowded; integration risk.
4. **SA-3 Caução** — good user value and partner appeal, but most integration risk and "yield on testnet" is cosmetic.

Possible fusion: **Heirloom + Smart Account recovery** (time-delayed guardian on OZ Smart Account context rules) only if the team wants Composed too — not recommended within 15h.

---

## Sources

- Software versions / protocol status: https://developers.stellar.org/docs/networks/software-versions
- Tx preconditions: https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions#minimum-sequence-age
- CAP-21: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0021.md ; CAP-71: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0071.md
- Fee sponsorship: https://developers.stellar.org/docs/build/guides/transactions/fee-sponsorship
- Sponsored reserves: https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves ; https://developers.stellar.org/docs/build/apps/wallet/stellar#sponsoring-account-creation
- Asset access control / sandwich: https://developers.stellar.org/docs/tokens/control-asset-access ; SEP-8 mention: https://developers.stellar.org/docs/tokens/anatomy-of-an-asset#compliance
- Smart wallets, Smart Account Kit, Passkey Kit, Launchtube retired: https://developers.stellar.org/docs/build/guides/contract-accounts/smart-wallets ; guestbook: https://developers.stellar.org/docs/build/apps/guestbook
- OZ Relayer: https://developers.stellar.org/docs/tools/openzeppelin-relayer ; OZ contracts: https://developers.stellar.org/docs/tools/openzeppelin-contracts ; https://github.com/OpenZeppelin/stellar-contracts
- Privacy / ZK: https://developers.stellar.org/docs/build/apps/privacy ; skill `stellar-dev.zk-proofs` (Raven)
- x402: https://developers.stellar.org/docs/build/agentic-payments/x402 ; skill `stellar-dev.agentic-payments` (x402.md, mpp.md)
- Oracles: https://developers.stellar.org/docs/data/oracles/oracle-providers#reflector-network
- Testnet resets: https://developers.stellar.org/docs/networks#testnet-and-futurenet-data-reset
- HackMeridian build page (tracks, weights, partners): https://www.hackmeridian.com/build
- DeFindex: https://dev.to/paltalabs/test-defindex-dapp-on-testnet-1n65 ; https://github.com/paltalabs/defindex ; Trustless Work: https://docs.trustlesswork.com/
- Live probes (2026-10-25 ~12:59 UTC): `https://soroban-testnet.stellar.org` getVersionInfo; `https://horizon-testnet.stellar.org/`; `https://testanchor.stellar.org/.well-known/stellar.toml` and `/sep24/info`; npm registry (`@x402/stellar` 2.28.0, `smart-account-kit` 0.8.0, `@stellar/typescript-wallet-sdk` 5.1.0); crates.io `stellar-tokens` 0.8.0.
- Prior art: Raven/Scout `searchHackathonBuilds` + `searchProjects` (Boreal Pulse, Obol, Heritaz, Legacy Suite, TicketReal, TokenTicket, ZK-Tix, BeTrusty×Trustless Work, Safetrust, SpendGuard, StellarGuard, x402 Autopilot, PayWall.ai, AgentSense, PayByLink, Tukar, ShieldPass), observed 2026-10-25.
