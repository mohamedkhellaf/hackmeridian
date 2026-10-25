# 09 — Independent final scoring (Wildcard Inventor)

Written Sun 2026-10-25, ~14:05 WET.
- **Inputs:** `08_dd_problem_hunter.md`, `08_dd_ruthless_judge.md`, `08_dd_stellar_architect.md`, `08_dd_wildcard_inventor.md`, plus the Round A/B logs.
- **Independence:** no peer messages during scoring.
- **Lens:** originality and memorability first, then the full rubric.
- **Conflict of interest:** I authored F1 and F2. I tried to mark both down where the evidence demands it.

## Scores (1–5 per criterion; weighted = Σ weight × score / 5)

| Finalist | TA (20) | UV (20) | TE (15) | Inn (15) | HP (10) | MEP (10) | UX (10) | **Weighted /100** |
|---|---|---|---|---|---|---|---|---|
| **F1 Second Thought** (hybrid: Lite 1/2/2, then Full 1/3/3 with a stateless co-signer; hatch flagged) | 4 | 4 | 4 | 3 | 4 | 3 | 4 | **75** |
| **F2 Loop** | 5 | 2 | 4 | 5 | 4 | 2 | 3 | **73** |
| **F3 Heirloom** (standalone) | 5 | 2 | 4 | 3 | 4 | 3 | 3 | **69** |

Arithmetic:
- F1 = 16+16+12+9+8+6+8 = **75**
- F2 = 20+8+12+15+8+4+6 = **73**
- F3 = 20+8+12+9+8+6+6 = **69**

---

### F1 Second Thought: per-criterion reasoning
- **Track Alignment: 4.**
  - The value rests on native claimable-balance predicates, per-op-type threshold weights and op-source ≠ tx-source authorization, with no contract. All are verified on testnet (spikes e and f).
  - Not a 5: claimable balances are used close to their designed purpose (conditional delivery), and multisig is textbook. In Lite mode the window itself is app-level, not protocol-level.
- **User Value & Problem: 4.**
  - A sharply scoped, evidenced harm: in "Hi Mum" family-impersonation scams, people 55+ make 82% of reports and bear 95% of losses (ACCC [V]).
  - The impersonated child is structurally the best possible guardian.
  - Docked one point: Stellar-specific incidence and the number of at-risk older people holding USDC in G-accounts are unknown [U], and it does not stop the biggest-dollar scam types (pig butchering, money lost before it reaches the wallet).
- **Technical Execution: 4.**
  - Every guarantee is verified on testnet. The plan is ≈30 dev-h with ~6h buffer, and the hybrid build (Lite first) has a safe fallback.
  - Docked: there is a first-time backend (the policy function), plus async-uptime risk.
- **Innovation: 3** (my lens, and honest).
  - The pattern already ships elsewhere: Coinbase Vault (48h cancel), Argent (guardians + trusted contacts), bank new-payee holds, LOBSTR Vault (co-signer on G-accounts) [V].
  - The real delta is narrow: undo-by-default after sending, a guardian who can never spend even with our server compromised, on classic accounts, with no contract.
  - Scout shows no such Stellar build [V], but a judge who knows Argent or Coinbase will feel "known idea, new chain".
- **Hackathon Progress: 4.** A clean, staged scope (Lite → Full → flagged hatch) with deliberate cuts makes "what we built in 27h" easy to show.
- **Market & Ecosystem Potential: 3.**
  - ~719k funded USDC G-accounts [V], and LOBSTR Vault proves co-signing infrastructure exists. It could ship as an SDK/feature for G-account wallets.
  - But no wallet partner has signalled interest [S], and wallets are a crowded category (89 builds).
- **Product Design & UX: 4.**
  - It passes the "my mom" test. The refusal cards explain themselves, there is no Freighter and a role switcher.
  - Not 5: four roles and a server badge add some cognitive load for an async judge.

### F2 Loop: per-criterion reasoning
- **Track Alignment: 5.** It matches the organizers' "old-school assets, new tricks" prompt almost word for word: issuance + trustline credit limits + SDEX offers + a self-to-self path payment as the clearing engine. Verified (spike b, fce43284).
- **User Value & Problem: 2.**
  - The problem is real (EU late payments; 60% of Portuguese firms delay because they are paid late [V]).
  - But netting only cancels *closed cycles*. Those are evidenced at ~1,500-firm network scale (Sardex), not in a 5-firm cluster [V/S]. The Portuguese pain is mostly linear chains.
  - One firm gets zero value alone, and firms won't publish payables (which is why the prior builds went to ZK).
- **Technical Execution: 4.** No server and no contract. The core is verified, and it is ≈20 dev-h. Docked: 4–6-firm cycles, path-length cap and offer-liability maintenance are untested, and the graph UI carries the demo.
- **Innovation: 5.** From my lens, this is the most original thing the committee produced. Nobody, including four Stellar-literate models, had seen DEX-as-clearing-house until the spike, and Scout is clean on the mechanism. The concept descends from Ripple-era rippling and Trustlines Network (Ethereum), which the pitch must acknowledge. Still, the native, contract-free form on Stellar is new.
- **Hackathon Progress: 4.** A small, demonstrable scope with a clean commit story.
- **Market & Ecosystem Potential: 2.** No named first cluster or platform [V absence]. The intercompany reframe is weaker on "why blockchain" (SAP/Kyriba already do it) and on privacy (the ledger is public). Ecosystem upside is mostly a showcase of the DEX.
- **Product Design & UX: 3.** "€1,800 cancelled, €0 moved" is a beautiful image, but a non-crypto judge must follow a 3-hop IOU graph. B2B, and it fails "my mom".

### F3 Heirloom: per-criterion reasoning
- **Track Alignment: 5.** Pure CAP-21 preconditions (`minSeqAge`) + SetOptions + BumpSequence + fee-bump. The validators enforce "valid only after N seconds of inactivity" [V spikes c/d].
- **User Value & Problem: 2.**
  - Lost-key and inheritance access is a real self-custody pain. But the evidence is old and generic (2019–20 survey) [V], and the user count is unknown [U].
  - It contradicts itself for cold holders: inbound payments don't reset the timer, so a manual heartbeat is needed [V spike g].
- **Technical Execution: 4.** The lowest technical risk (≈14 dev-h, no backend). Freighter signing of a far-ahead seq is [U], and the in-app fallback is fine.
- **Innovation: 3.** Liana (Bitcoin) ships the same idea [V]. CAP-21 itself names "time-delayed key recovery" [V]. 4+ inheritance builds exist on Stellar [V]. The delta (account-level, any tx is a heartbeat, no fund movement, one-op revoke) is real but incremental.
- **Hackathon Progress: 4.** Small, clean scope.
- **Market & Ecosystem Potential: 3.** Any G-account wallet could add it, and inheritance demand exists broadly [A]. Crowded framing.
- **Product Design & UX: 3.** The core feature is "wait for silence". The demo needs a labelled time skip, and the payoff ("sister becomes a signer") is abstract (see `08_dd_wildcard_inventor.md`).

---

## Decision factors (not official criteria)

| Factor | F1 Second Thought | F2 Loop | F3 Heirloom |
|---|---|---|---|
| **MVP completion risk** | **Med.** ≈30 dev-h with ~6h buffer, but the Lite-first hybrid guarantees a shippable floor by about hour 6. | **Low–Med.** ≈20 dev-h; the risk is concentrated in the graph UI and untested longer cycles. | **Low.** ≈14 dev-h; spike code already exists. |
| **Demo failure risk** | **Low.** The hero beat (refused claim → undo) needs no server; Family mode and a health badge cover outages. | **Low technically / Med for comprehension.** No server, but judges may not follow the graph. | **Med.** It depends on a waiting window and a time skip, plus the seqTime-initialisation trap. |
| **Critical dependency risk** | **Med.** Our own stateless policy function, plus Horizon and friendbot. | **Low.** Horizon and friendbot only. | **Low.** Horizon and friendbot only. |
| **Competitive differentiation confidence** | **Med.** Scout is clean, but Coinbase Vault, Argent and LOBSTR Vault make the delta narrow. | **High.** The mechanism is unbuilt on Stellar; the concept is Ripple-era. | **Low.** Liana plus 4+ Stellar inheritance builds. |
| **Potential for compelling future development** | **High.** An SDK/feature for G-account wallets, a LOBSTR-class integration, SCF fit, and natural extensions (per-day caps, merchant verification via SEP-1, the recovery hatch). | **Low–Med.** It needs a platform or cluster partner and a privacy solution (ZK) before real use. | **Med.** It folds naturally into any wallet's recovery feature; little standalone. |

---

## Pick
- **Winner: F1 Second Thought** (75).
- **Backup: F2 Loop** (73).
- F3 (69) is best used as F1's flagged recovery hatch, not as a standalone entry.

**Single strongest reason:** F1 is the only finalist where the MVP itself changes the outcome for one specific, evidenced user on day one. The daughter being impersonated in a "Hi Mum" scam pulls the money back, and the network refuses both the stranger's claim and any attempt by the guardian to spend. Every guarantee is already verified on testnet.

**Where my own lens disagrees with my pick:** F2 is the more original and more "off-the-wall" idea. If the judges weight Discovery over Adoption, F2 wins. I don't make that bet, because the official priority order is Adoption → Discovery, and F2's user value is ~2 on the evidence.
