# 09: Independent final scoring (Problem Hunter)

Written Sun 2026-10-25, ~13:45 WET. Scored without messaging other agents.

I read all four due-diligence files: `08_dd_problem_hunter`, `08_dd_ruthless_judge`, `08_dd_stellar_architect` and `08_dd_wildcard_inventor`.

Lens: user value, demand and adoption first, then the full rubric. Weighted score = Σ(weight × score / 5).

## Score table

| Finalist | Track 20 | User Value 20 | Tech Exec 15 | Innovation 15 | Progress 10 | Market/Eco 10 | UX 10 | **Weighted** |
|---|---|---|---|---|---|---|---|---|
| **F1 Second Thought** (hybrid Lite → Full, hatch flagged) | 4 | 4 | 4 | 3 | 4 | 3 | 4 | **75** |
| **F2 Loop** | 5 | 2 | 4 | 4 | 4 | 2 | 3 | **70** |
| **F3 Heirloom** (standalone) | 4 | 2 | 4 | 3 | 4 | 3 | 3 | **65** |

## F1 Second Thought: 75

- **Track Alignment 4.**
  - It's a clear Unlocked fit: claimable-balance predicates plus threshold weights used for consumer protection. That matches the organizers' "old-school assets, new tricks" prompt, and every guarantee is enforced by validators.
  - Not a 5: the primitives are old and well documented (Stellar CLI "co-signed vault" pattern). A judge won't call it "impossible before".
- **User Value 4.**
  - The scoped problem is family-impersonation ("Hi Mum") scams. Per the ACCC, 82% of reports come from people aged 55+, accounting for 95% of losses [V]. Crypto impersonation scams rose ~1,400% in 2025 [V].
  - The mechanism genuinely resolves it, because the impersonated child IS the guardian.
  - Not a 5: the number of at-risk Stellar G-account holders is Unknown, and groomed investment scams are explicitly not solved.
- **Technical Execution 4.**
  - Every claimed guarantee is spike-verified on testnet: spikes e/f/g, and op_bad_auth for Mum alone and for guardian + policy.
  - Effort is ~30 dev-h against ~36 available. The hybrid plan de-risks the build: Lite works by hour 6.
  - Risk: the first backend (a stateless function) and its uptime during async judging.
- **Innovation 3.**
  - Coinbase Vault (48h cancellable withdrawals since 2014), Argent (guardians + trusted contacts), bank new-payee holds and LOBSTR Vault already cover the concept [V].
  - Our delta is real but narrow: self-custody, undo-by-default enforced by validators, a guardian who can't spend, no contract. Zero Stellar builds do this [V Scout].
- **Hackathon Progress 4.** One hero flow, three features, deliberate cuts (SEP-1, sponsored reserves, push), clean history. Its spikes were run during the event.
- **Market & Ecosystem 3.**
  - Channel class: G-account wallets. LOBSTR Vault proves the co-signer pattern ships on Stellar [V], and ~719k funded USDC accounts exist [V].
  - Wallet adoption is Speculation, and the standalone-wallet category is crowded (89 builds).
- **UX 4.**
  - The refusal moments explain themselves ("network refuses early claim", "guardian can't pay herself"). A role switcher lets judges test without Freighter.
  - "My mom can understand it" holds. Polish risk sits on one flow only.

## F2 Loop: 70

- **Track Alignment 5.** Native credit-network rippling: a debt cycle cleared by one self path payment through SDEX offers, with no contract. It's the purest "old-school assets, new tricks" entry, and the mechanism is spiked (fce43284).
- **User Value 2.**
  - The problem is strongly real: ~1 in 4 EU bankruptcies stem from late payment, and 60% of Portuguese firms delay payments because they're paid late [V].
  - But the evidenced pain is linear chains, which netting doesn't clear. Cycles show up at network scale (Sardex: 1,477 firms, ~25%), not in a 5-firm onboarded cluster.
  - One firm alone gets zero value.
- **Technical Execution 4.** ~20 dev-h, mechanics proven. The risks are graph UI quality and longer cycles.
- **Innovation 4.** New on Stellar [V Scout]. Conceptually it is Ripple-era rippling, and Trustlines Network did this on Ethereum [V, status UNVERIFIED], so not a 5.
- **Hackathon Progress 4.** Feasible, a clean scope, and a demo that can be shown.
- **Market & Ecosystem 2.** No first cluster is named, and payables are public: prior builds went to ZK to avoid exactly that [V]. AJPES and Sardex show that a central operator can do the same job.
- **UX 3.** "€38k of debt cancelled, €0 moved" is a strong image, but the B2B 3-hop graph needs an excellent animation for a non-crypto judge to follow it.

## F3 Heirloom: 65

- **Track Alignment 4.** CAP-21 `minSeqAge` pre-signed SetOptions is native and spiked, but CAP-21 itself names time-delayed recovery as its motivation, so this is the intended use rather than a new trick.
- **User Value 2.**
  - The evidence is old and generic: 23% have a plan, 89% worry (2019–20).
  - The user count is Unknown.
  - Cold holders need a manual heartbeat, which contradicts the "you never check in" pitch.
  - Its own proposer folded it into F1.
- **Technical Execution 4.** Lowest build risk (~14h, no server). The one Unknown is Freighter signing a far-ahead seq; in-app keys are the fallback.
- **Innovation 3.** Liana already ships network-enforced inactivity recovery on Bitcoin [V]. Stellar has 4+ inheritance builds. Our delta (account-level, all assets, no fund movement, leak-safe artifact) is incremental.
- **Hackathon Progress 4.** Easy to deliver cleanly.
- **Market & Ecosystem 3.** A plausible wallet-feature channel (LOBSTR-class) and SCF continuation, but in a crowded category.
- **UX 3.** "Coffee resets the countdown" is a nice beat, but the emotional payoff is abstract ("the sister becomes a signer"), and death framing can feel morbid.

## Decision factors (not official criteria)

| Factor | F1 | F2 | F3 |
|---|---|---|---|
| MVP completion risk | **Med**: ~30 of ~36 dev-h; first backend; Lite fallback at hour 6 caps the downside. | **Low–Med**: ~20 dev-h; the graph UI is the main unknown. | **Low**: ~14 dev-h, frontend only. |
| Demo failure risk | **Med**: policy-function uptime during async judging; mitigated by undo needing no server, Family override, and a recorded video. | **Low–Med**: seeded testnet state; testnet reset risk (reseed script). | **Low**: only Freighter far-ahead seq [U]; in-app key fallback. |
| Critical dependency risk | **Med**: one owned stateless function; no third-party APIs; Circle captcha faucet avoided with self-issued test USDC. | **Low**: Horizon only. | **Low**: Horizon only. |
| Competitive differentiation confidence | **Med**: the concept exists (Coinbase Vault, Argent, banks), but self-custody + validator-enforced undo + guardian-can't-spend on Stellar classic is unique [V Scout]. | **Med–High** for judges (mechanism unique on Stellar); **Low** for users (a database does it). | **Low–Med**: Liana and 4+ Stellar inheritance builds. |
| Potential for compelling future development | **High**: a wallet SDK for LOBSTR-class wallets, anchors and remittance apps; SCF path; regulators trending toward hold periods. | **Med**: needs an invoice-platform partner and privacy (ZK) before real use. | **Med**: a wallet feature; most valuable folded into F1 as a recovery hatch. |

## Pick

- **Winner: F1 Second Thought** (hybrid build; Heirloom hatch as a flagged stretch).
- **Backup: F2 Loop.** It's the best Track/Innovation story if F1's build stalls before hour 6, though its User Value is weak. F3 is the safest build but the weakest problem.
- **Single strongest reason:** F1 is the only finalist whose MVP, on day one, actually stops an evidenced harm for one specific user with her family. In the family-impersonation scam, the person being impersonated is the guardian who sees the alert and taps Undo, and Stellar validators enforce that no single key (and not guardian + server) can move the money.
