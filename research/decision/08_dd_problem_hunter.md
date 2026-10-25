# 08: Due diligence, Section A: Competitive landscape (Problem Hunter)

Written Sun 2026-10-25, ~13:35 WET.

Labels:
- **[V]**: verified, link given
- **[A]**: assumption
- **[S]**: speculation
- **[UNVERIFIED]**: recalled, not checked this session

Scout queries were run via Stellar Raven at 13:30 UTC (`scout.searchHackathonBuilds` / `searchProjects`). A Scout miss is a whitespace signal, not proof of absence.

---

## F1: Second Thought

24h undo window for new payees, guardian who can undo but never spend, 2-of-3 weights (Mum 2 / policy 1 / guardian 1, thresholds 1/3/3), Family override, flagged Heirloom hatch.

### What already exists

| Product / pattern | What it does | Custody / chain | Status |
|---|---|---|---|
| **Coinbase Vault** | **48h waiting period on withdrawals, cancellable at any time during the wait; multiple approvers for joint accounts.** | Custodial (Coinbase) | [V] launched 2014 (https://finovate.com/coinbase-launches-vault-to-better-secure-your-bitcoins/). Coinbase's Vault page still describes the 48h window and multiple approvers (https://www.coinbase.com/vault); current status [UNVERIFIED, page undated]. |
| **Argent** (Ethereum/Starknet smart wallet) | Guardians; **daily transfer limit**; **Trusted Contacts allowlist** that bypasses the limit; over-limit transfers need guardian co-sign; guardians can lock the wallet; recovery with a 36h-to-several-day window. | Self-custody smart-contract wallet | [V, secondary] (https://eco.com/support/en/articles/15254043-argent-wallet-deep-dive-2026-starknet-and-account-abstraction ; https://techcrunch.com/2020/05/18/buzzy-ethereum-wallet-app-argent-comes-out-of-stealth) |
| **Safe + recovery modules** (e.g. Candide) | Social or guardian recovery with a delay; one source cites a 14-day default for Candide's module. | Self-custody, EVM | [V, secondary only; delay figure UNVERIFIED against Safe docs] (https://iptf.ethereum.org/patterns/pattern-social-recovery/) |
| **LOBSTR Vault** (Stellar) | Separate signer app; adds a co-signer to a **G-account**; push-notification approval of **every** tx; N-of-M. | Self-custody, Stellar classic multisig | [V] (https://github.com/Lobstrco/Vault-iOS) |
| **Volta Circuit** (Stellar, SCF-funded) | Smart-contract multisig wallet with **spending limits, time locks, whitelisted addresses**; ThresholdV signing app. Targets businesses and treasuries ("Enterprise Vault"). | Self-custody, contract-based | [V] Scout (Live, SCF); website (https://voltacircuit.com/). No guardian/undo/consumer features on the site. |
| **Smart Treasury** (Stellar, SCF) | Policy-driven Soroban treasury: approvals, scheduled ops, recovery workflows for organisations. | Contract | [V] Scout (Live, SCF), https://smarttreasury.io/ |
| **Banks: new-payee and anti-scam holds** | Singapore: 12h cooling period after token activation (no new payees during it). DBS: 12h delay to add new recipients. From 15 Oct 2025, banks may hold digital transfers for 24h when they would move >50% of a balance ≥S$50k. UK: PSPs may delay suspicious payments up to 4 business days. Australia: Scam-Safe Accord (CoP, warnings, payment delays). | Custodial banks | [V] (https://fintechnews.sg/126691/security/dbs-cooling-period/ ; https://abs.org.sg/docs/library/banks-to-launch-enhanced-safeguards-from-15-oct-2025-to-better-protect-accounts_.pdf ; FCA FG24/6 via the Wildcard ; https://www.ausbanking.org.au/new-data-shows-further-inroads-in-the-war-against-scammers/) |
| **Kraken** | 24h withdrawal hold to new addresses after a credential change. | Custodial | [V via the Wildcard] (https://support.kraken.com/hc/en-us/articles/360000672863) |
| **Stellar docs pattern** | Stellar CLI agent guide "Pattern 1: a co-signed vault": low-threshold delegates can claim claimable balances. | Docs | [V via the Wildcard] (https://developers.stellar.org/docs/tools/cli/agent-cli/guides/delegate-spending#pattern-1-a-co-signed-vault) |
| **Stellar hackathon builds** | ScamGuardAI, TrustGenome AI (AI scam detection); Safe.xlm (multisig smart wallets ideathon); Veil (biometrics). **No build found** using claimable-balance predicates as an undo window, or a guardian who can undo but not spend. | — | [V Scout: "reversible payment undo claimable balance" → 0 builds; "scam protection wallet elderly" → AI-detection builds only] |

### What we do differently
1. **Self-custody + validator-enforced undo window.** Coinbase Vault and the banks offer cancellable holds, but they are **custodial**: the company enforces the hold and can also freeze you. Our 24h window is a claimable-balance predicate that validators enforce. Neither Mum's key alone nor guardian + our server can move funds (verified, spike f).
2. **Exception-only friction.**
   - LOBSTR Vault makes the co-signer approve every tx.
   - Argent's closest analogue is daily limit + trusted contacts, but over-limit transfers *block* until a guardian co-signs.
   - Ours lets known payees through instantly and lets new-payee payments *proceed by default* after 24h unless someone undoes them. That's opt-out friction, not opt-in approval.
3. **Guardian can undo but never spend.** Enforced by threshold arithmetic on a classic account, with no contract (spike e/f [V]). In Argent, guardians can't spend either, but that's contract logic on EVM smart wallets.
4. **On Stellar classic accounts**, the account type held by ~719k funded USDC holders [V, Stellar Expert via the Architect] and used by LOBSTR. That's a drop-in feature, not a migration to a contract wallet.

### Is the difference meaningful?
- **To a user: partially.** The *concept* (hold + cancel + trusted contact) is a known, regulator-endorsed pattern. That is a strength for the "who asked for this" question: banks and Coinbase already sell it. What the user gets new is having it **in self-custody stablecoins on Stellar**, where today they have nothing [A: no Stellar wallet offers it; LOBSTR Vault is approve-every-tx].
- **To a judge: yes, if framed honestly.** The framing should be *"bank-grade scam holds, brought to self-custody, enforced by Stellar validators, no smart contract"*, not *"we invented reversible payments"*.
  - The Unlocked hook is claimable-balance predicates + thresholds used for consumer protection. That exactly fits the organizers' "old-school assets, new tricks" prompt [V hackmeridian.com/build].
- **Risk:** a judge who knows Argent will say "Argent did guardians in 2020". Answer: Argent = EVM contract wallet with approve-to-exceed, ours = classic-account, validator-enforced undo-by-default, zero contract.

### Are we reproducing a starter or example?
- **No starter app** does this [V Scout].
- **But** the building block "low-threshold delegate claims a claimable balance" is a documented Stellar pattern (the CLI delegate-spending guide). We are composing documented primitives into a new consumer flow. Disclose it in the README; don't claim the primitive as ours.

---

## F2: Loop

SME debt-cycle clearing via issuer IOUs, trustlines as credit lines, SDEX offers, and one self path payment.

### What already exists

| Product / pattern | What it does | Status |
|---|---|---|
| **AJPES ePOBOT** (Slovenia) | State-run, **compulsory** multilateral set-off of business obligations; centralised database. | [V via the Wildcard] (https://www.gzs.si/zbornica_racunovodskih_servisov/Novice/ArticleId/47813/ ; https://mondaq.co.uk/eu-law/127460/) |
| **Sardex** (Sardinia) | B2B mutual-credit network: ~1,477 firms, 48,170 txs. Cycles are "prevalent". Obligation clearing alone cut net internal debt ~25% (~50% with mutual credit). | [V] (https://link.springer.com/article/10.1038/s41562-018-0450-0 ; Fleischman, Dini & Littera, JRFM 2020, https://library.uniteddiversity.coop/Community_Currencies/Liquidity-Saving_through_Obligation-Clearing_and_Mutual_Credit-An_Effective_Monetary_Innovation_for_SMEs_in_Times_of_Crisis.pdf) |
| **WIR Bank** (Switzerland) | B2B complementary currency since 1934; demand declining. | [V] (https://www.finews.ch/news/banken/55750-bank-wir-ergebnis-2022) |
| **Trustlines Network** (Ethereum) | **Exactly the Ripple-style model:** bilateral credit lines, payments routed through chains of trust with fees to intermediaries, netting of debts. | [V, P2P Foundation wiki] (https://wiki.p2pfoundation.net/Trustlines_Network). Current activity [UNVERIFIED]. |
| **RipplePay** (Ryan Fugger, 2004) | Original credit-network "rippling" concept that Stellar's trustline model descends from. | [UNVERIFIED this session; widely cited in the Trustlines wiki] |
| **SettleZK, zkNexus** (Stellar Hacks: Real-World ZK) | Private multilateral netting on Stellar with ZK. No awards in Scout. | [V Scout] (https://dorahacks.io/buidl/46011 ; https://dorahacks.io/buidl/46452) |
| **Indentura** (Stellar) | "On-chain credit infrastructure on Stellar, rebuilding trade credit and receivables financing." Adjacent (financing, not netting). | [V Scout, Live] |
| **Corporate multilateral netting** (treasury systems for intra-group netting) | Mature off-chain product category for multinationals. | [A, not checked this session] |

### What we do differently
- No contract, no ZK, no central operator. The clearing *is* a native path payment, and consent is a standing SDEX offer. That mechanism is **not** found in prior Stellar builds [V Scout: "mutual credit trustline IOU" returned only credit-scoring/ZK builds].
- Versus Trustlines Network: they rebuilt rippling in Ethereum contracts; Stellar has it natively in the protocol. That's a real Unlocked point.

### Is the difference meaningful?
- **To a judge: yes.** "Stellar was designed as a credit network, and here's the debt-cancelling path payment" is a strong Discovery/Innovation story.
- **To a user: weak.**
  - The user-visible value (debt reduced) is the same as AJPES or Sardex clearing, which a database delivers.
  - Our extra (no operator, cross-platform) matters only when no trusted operator exists [A], with no named cluster.
  - The evidenced Portuguese pain is linear late-payment chains, which netting doesn't touch (see 07).
  - Trustlines Network shows the decentralised-credit-network idea has been tried; whether it reached adoption is [UNVERIFIED].

### Are we reproducing a starter or example?
- No starter does issuer-offer self-path-payment clearing [V Scout]. The path-payment guide is generic.
- Conceptually it reproduces Ripple-era rippling, which the pitch should acknowledge, not hide.

---

## F3: Heirloom (standalone)

CAP-21 `minSeqAge` pre-signed SetOptions; funds never move; any activity is a heartbeat; two-stage will.

### What already exists

| Product / pattern | What it does | Status |
|---|---|---|
| **Liana** (Bitcoin) | **Closest analogue.** Open-source wallet with a primary path plus timelocked recovery paths that become spendable after inactivity. Enforced by Bitcoin script. Owner must "refresh" (on-chain tx) to reset the timer; heirs need the recovery key + descriptor. | [V] (https://www.linuxlinks.com/liana-bitcoin-wallet/ ; https://d-central.tech/bitcoin-inheritance-planner/) |
| **Casa, Bitkey** | Off-chain, procedure-based inheritance with ~6-month claim windows. | [V secondary characterization only, d-central.tech; details UNVERIFIED against vendor docs] |
| **OP_VAULT proposals** (Bitcoin) | Covenant-based vault and recovery designs. | [V discussion] (https://delvingbitcoin.org/t/using-op-vault-for-recovery/150) |
| **Argent / Safe social recovery** | Guardian-initiated key recovery with a delay window. | [V secondary, see F1] |
| **Boreal Pulse** (Stellar PULSO) | Soroban inheritance vault with periodic check-ins. Funds move into the contract. | [V Scout] (https://dorahacks.io/buidl/45593) |
| **Obol** (Stellar Real-World ZK) | ZK dead man's switch for private inheritance. | [V Scout] (https://dorahacks.io/buidl/46408) |
| **Heritaz** (Chile ideathon) | Inheritance concept ("what happens to your bitcoin when you pass away"). | [V Scout] (https://dorahacks.io/buidl/39637) |
| **Legacy Suite** (Stellar directory) | Estate planning. | [V per the Architect's 02 file; not re-checked] |

### What we do differently
- Versus Stellar builds (Boreal Pulse, Obol): **funds never move into a contract**, there's no keeper or oracle, and any normal tx is the heartbeat. The pre-signed artifact is **non-secret and leak-safe** [V spike, Architect].
- Versus Liana: it's the same idea, done with account-level preconditions instead of UTXO timelocks.
  - Liana's refresh means moving coins. Ours is any tx or a no-op BumpSequence.
  - Ours needs no descriptor backup.
  - Ours covers every asset in the account at once (USDC, XLM, any trustline).

### Is the difference meaningful?
- **To a judge: yes for mechanism.** "The network refuses your heir until you've been silent N days, and your money never moves" is clear and verified on testnet.
- **To a user: modest.**
  - Liana proves the pattern is valued in Bitcoin self-custody. [A: Liana's user numbers unknown.]
  - The demand evidence is old: 23% have a plan, 2019–20 [V].
  - "Crypto inheritance" is a crowded, AI-suggested category with **3 prior Stellar builds** [V].
  - **A judge who knows Liana will see it as a port.** The honest pitch is "Liana-style recovery for Stellar accounts, natively, without moving funds".
- **Design catch (from Round B, verified):** a receive-mostly user looks silent, because inbound payments don't reset seqTime [V spike g]. That needs an app-open heartbeat.

### Are we reproducing a starter or example?
- No starter app [V Scout].
- **But CAP-21 itself lists "time-delayed key recovery" as a motivation** [V, the Architect's citation of CAP-21]. The mechanism is the protocol authors' intended use. Novelty sits in the productisation, not the idea.

---

## Bottom line (competitive)

| | Closest existing | Our real delta | Meaningful to users? | Meaningful to judges? | Starter-copy risk |
|---|---|---|---|---|---|
| **F1** | Coinbase Vault (48h cancel), Argent (guardians + trusted contacts), bank new-payee holds, LOBSTR Vault | Self-custody + validator-enforced undo-by-default + guardian-can't-spend, on classic accounts, no contract | Yes: a proven, regulator-endorsed pattern that self-custody stablecoins lack | Yes, framed as "old-school primitives, new trick" | Low; documented building block |
| **F2** | AJPES, Sardex, Trustlines Network, SettleZK/zkNexus | Native protocol rippling, no contract or ZK | Weak (a database does it; linear chains dominate) | High (Discovery) | Low; concept is Ripple-era |
| **F3** | Liana (BTC), Casa/Bitkey, Boreal Pulse/Obol/Heritaz | No fund movement, leak-safe artifact, activity = heartbeat | Modest; crowded category | Medium (a port of Liana; CAP-21 names the use case) | Low code-wise; idea is CAP-21's own |

**Competitive verdict:** F1 has the best competitive position. Its pattern is validated by incumbents (Coinbase, banks, Argent), and its delta is exactly the gap in Stellar self-custody. F2 is the most novel to judges but the weakest for users. F3 is the most "already exists elsewhere" (Liana).
