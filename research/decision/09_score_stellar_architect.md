# 09 — Independent final score: Stellar Architect

Written 2026-10-25 ~13:45 WET. I read all four 08_dd files first. I scored from my lens (protocol depth, technical feasibility, dependency risk, whether Stellar is necessary), without messaging anyone. Half points are used where a criterion falls between two anchors. Weighted = Σ(weight × score / 5).

## F1 Second Thought (hybrid: Lite 1/2/2 → Full 1/3/3 with a stateless co-signer; Heirloom hatch flagged)

| Criterion (wt) | Score | Why |
|---|---|---|
| Track Alignment (20) | 4 | The demo visibly exercises named classic primitives: CB predicates, weighted thresholds, and op-source ≠ tx-source authorization. "Guardian can undo but never spend" is validator-enforced and verified [spikes e/f]. It isn't 5 because CBs and multisig are used close to their designed purpose, so it is a clever combination, not "used to not be possible". |
| User Value & Problem (20) | 4 | Hi-Mum/impostor scams are an evidenced, costly pain (FTC $2.95B; ACCC 82%/95% from people 55+), and the impersonated child *is* the guardian, so the MVP resolves the scenario for one family on day one. It loses a point because the overlap between "older scam victims" and "Stellar G-account USDC holders" is unproven [U]. |
| Technical Execution (15) | 4 | Every guarantee is verified on testnet with the final table (spike f), there's no contract, and it's about 30 dev-h against about 36 available. The risks are a live co-signer during async judging and a tight buffer. |
| Innovation (15) | 3 | Coinbase Vault, Argent, LOBSTR Vault and bank new-payee holds already cover the pattern. Our real delta, post-send undo plus a non-spending guardian on a plain account with no contract, is narrow but Scout-clean. |
| Hackathon Progress (10) | 4 | The scope is deliberately cut to one hero flow, with a hybrid plan that ships Lite even if Full slips. All of it can be built inside the window. |
| Market & Ecosystem (10) | 3.5 | 718,599 funded USDC G-accounts [V]. LOBSTR Vault proves the co-signer channel class exists on Stellar [V]. No partner yet [S]. |
| Product Design & UX (10) | 4 | It passes "my mom", has self-explanatory refusal moments, and judges can test it with a role switcher and in-app keys. Not 5, because three roles and a pending-payment concept need a short explainer. |
| **Weighted** | **76.0** | 16 + 16 + 12 + 9 + 8 + 7 + 8 |

## F2 Loop

| Criterion (wt) | Score | Why |
|---|---|---|
| Track Alignment (20) | 5 | It answers "old-school assets, new tricks" near-verbatim: issuance, trustlines as credit, DEX consent, and a self path payment as the clearing engine. The atomic cycle clear is verified (fce43284…). No other chain has this natively [A]. |
| User Value & Problem (20) | 2 | The evidenced pain is mostly *linear* late-payment chains, which netting doesn't touch. Firms won't publish payables, and one firm alone gets zero value until its whole cycle is on-chain. |
| Technical Execution (15) | 4 | Frontend only, the core is verified, and it's about 20 dev-h. Cycles of 4–6 firms, offer-liability churn and AUTH_REQUIRED club mode are unspiked. |
| Innovation (15) | 5 | The mechanism is unbuilt on Stellar (prior netting builds used ZK) and is genuinely surprising to protocol people. |
| Hackathon Progress (10) | 4 | It's comfortably buildable, with time for an excellent graph. |
| Market & Ecosystem (10) | 2 | No named cluster, legal/accounting status of firm IOUs is [U], and the cold start is a whole cycle. |
| Product Design & UX (10) | 3 | The animated graph can be striking, but a 3-hop IOU graph needs explaining and fails "my mom". |
| **Weighted** | **73.0** | 20 + 8 + 12 + 15 + 8 + 4 + 6 |

## F3 Heirloom (standalone)

| Criterion (wt) | Score | Why |
|---|---|---|
| Track Alignment (20) | 4.5 | It is the purest single-primitive story: a CAP-21 `minSeqAge` pre-signed tx with no contract and no keeper, verified (c/d/g). It isn't 5 because CAP-21 itself names time-delayed key recovery, so it's the intended use, productised. |
| User Value & Problem (20) | 2.5 | The problem is real but weakly evidenced (2019–20 survey). Stellar's user count is unknown, and the category is familiar. |
| Technical Execution (15) | 4.5 | It's the lowest-risk build (about 14 dev-h, frontend only, every path verified). The only unknown, Freighter signing a far-ahead seq, is avoidable with in-app keys. |
| Innovation (15) | 3 | Liana (Bitcoin miniscript) ships network-enforced inactivity recovery, and there are 4+ Stellar inheritance builds. The delta is account-level, there's no refresh chore, and the artifact is leak-safe. |
| Hackathon Progress (10) | 4 | Easily completed and polished. |
| Market & Ecosystem (10) | 2.5 | It's a wallet feature with no partner. Lost-key recovery is broader than inheritance but unquantified. |
| Product Design & UX (10) | 3 | The countdown reset is a nice moment, but the payoff ("sister becomes a signer") is abstract and the death framing is morbid. |
| **Weighted** | **69.5** | 18 + 10 + 13.5 + 9 + 8 + 5 + 6 |

## Decision factors (not official criteria)

| Factor | F1 | F2 | F3 |
|---|---|---|---|
| MVP completion risk | **Med**: about 30 of ~36 dev-h; the hybrid guarantees a Lite ship | **Low**: about 20 dev-h, frontend only | **Low**: about 14 dev-h |
| Demo failure risk | **Med**: a live co-signer during async judging (mitigated: stateless function, family override, pre-made demo family) | **Low–Med**: friendbot seeding of 5 firms; longer cycles unspiked | **Low**: Horizon + friendbot only |
| Critical dependency risk | **Med**: Horizon/friendbot plus our own function | **Low**: Horizon/friendbot | **Low**: Horizon/friendbot |
| Competitive differentiation confidence | **Med**: narrow but clean delta vs Coinbase/Argent/LOBSTR Vault; twin risk in the domain | **High**: the mechanism is unbuilt | **Low–Med**: Liana plus 4+ Stellar inheritance builds |
| Potential for compelling future development | **High**: a LOBSTR-class wallet feature, a SCF path, Heirloom hatch, anchor cash-out | **Med**: needs ZK privacy and a real cluster; possibly a Sardex-style network | **Med**: a wallet SDK feature; best as F1's hatch |

## Pick
- **Winner: F1 Second Thought** (hybrid build, Heirloom hatch flagged).
- **Backup: F2 Loop.** It scores higher than F3, and its risks are product risks, not build risks.
- **Single strongest reason:** F1 is the only finalist whose MVP changes the outcome for one real user acting alone with her family on day one. Every security promise in its pitch is enforced by Stellar validators and was proven on testnet with the exact final configuration (spike f), with no contract and only one small backend we control.
