# 05: Independent ranking, Wildcard Inventor (A3)

Lens: originality, and whether a judge who sees about 100 submissions will still remember it next day. Scored against the rubric and kill checklist in `04_judging_framework.md`: K = kill, F = flag, three flags count as a kill. I've disclosed my bias: three of the 11 are mine, and I tried to correct for that. FOOTNOTE is incomplete and not ranked.

## Ranked list (all 11)

| # | Concept | One-line reasoning | Kill/flag check |
|---|---|---|---|
| 1 | **Tripwire** (A3) | Nothing like it is on Stellar, as far as I could find (prior art is HoneyPause on EVM Sepolia only). The demo moment of "paid + paused + funds untouched in one ledger" is the most memorable of the 11. The weak point is that "Unlocked" in 04 means core protocol features, and atomic sub-call rollback is a Soroban host property rather than a classic feature, so the deck has to make that explicit. | K3 (rollback semantics) needs a 1 h spike; the sandbox-deploy fallback avoids the kill. User is protocol teams, which is concrete but niche (Market ~3). No other flags. |
| 2 | **ReliefRail** (A2) | Strongest Track Alignment of the 11: auth flags, clawback, claimable-balance expiry and sponsorship are exactly the "native features" judges look for. Originality is medium because humanitarian vouchers are a known Stellar story (Aid Assist/SDP, WFP Building Blocks). Its memorable moment is the blocked payment at the alcohol merchant. | F1 (many moving parts, classic + Soroban), F6 (needs a clear answer to "why not SDP?"). Two flags: survivable. |
| 3 | **Quorum** (A3) | The hook ("backing a failed project still earns you money") is the most surprising sentence in the pool, and it comes from real economics (Tabarrok, lab evidence). But crowdfunding is K2-saturated and the twist is an *economic* mechanism, not a *protocol* one, so Track Alignment is at risk unless it gets the twist below. Easiest of the 11 to build well. | K2 borderline; F7 (needs organisers + backers). Fixable with the claimable-balance twist. |
| 4 | **Roda** (A1) | Real, large, documented demand (MoneyFellows) and a visceral slash-the-defaulter demo. But on-chain ROSCAs are an old crypto idea: WeTrust (Ethereum, 2017) and several "chama/esusu" hackathon builds, recalled from memory and **UNVERIFIED** in this session. That makes it familiar to judges. Collateral economics are weak. | F8 (rounds need a fast-forward mode), F7 (group cold start). Two flags. |
| 5 | **Earmark** (A1) | Best evidence in the pool (the J-PAL labelling RCT, more than 15%) and a natural Composed story (anchors, MoneyGram). But it sits in the most saturated Stellar category (remittances), and the payee off-ramp can't be shown honestly. Judges will lump it with the ~10 remittance entries. | K2 borderline (purpose-binding is the twist), K7 risk if we imply real school off-ramps. F3-ish (anchor flows on testnet). |
| 6 | **LeashPay** (A2) | Best technical fit and mostly TypeScript, so likely the highest Technical Execution score. But originality is the lowest of the top tier: see the last section. It's in the top 6 only because it is very likely to *work*. | K2 (x402/agent payments, predicted #1 saturated category); F2 (the "wow" is the agent, Stellar is policy/settlement); F6 (overlaps REAPP and OZ's own spending-limit policy). |
| 7 | **QuietPay** (A2) | The confidential-amounts explorer view would be very memorable, and few people will have used the Confidential Token preview. But payroll is saturated (PayZoll won before), ZK demos were just judged at a dedicated hackathon, and the preview has no API docs. | K3 (likely kill unless a 1 h JS spike passes); K2 on payroll. |
| 8 | **KeyHold** (A1) | A relatable Lisbon pain, and "silence returns the deposit to the tenant" is a good default rule. Mechanically it is generic escrow and fails the Postgres test except for its neutral-custody argument. | K1 borderline; F7 (landlords must opt in, two-sided). |
| 9 | **Volta** (A3) | Clear IRL value and a visual demo, but it's a deposit app at heart: Postgres plus Stripe could run a multi-café ledger if one operator were trusted. Network effects are needed from day one. | K1 borderline; F7; low Innovation. |
| 10 | **Silence Is Consent** (A1) | Real pain, but its own author ranks it as the most crowded: Trustless Work's demos and many hackathon escrow apps. Judges will have seen it. | K2 (escrow / freelance payments); F6 (Trustless Work). |
| 11 | **DepositBox** (A2) | A near-duplicate of KeyHold with a weaker default rule. Its author concedes it is the weakest "only on Stellar" case. If the committee wants rental deposits, KeyHold supersedes it. | K1; duplicate. |

## My top 6

1. Tripwire
2. ReliefRail
3. Quorum
4. Roda
5. Earmark
6. LeashPay

## Merges and disruptive twists

1. **Quorum with native settlement (strongest twist).** On a failed campaign, settle refunds plus bonus as **claimable balances**, with sponsored reserves so backers never need XLM, rather than as plain contract transfers. Backers then hold a claimable "refund + bonus" in their wallet. This turns an economics idea into an Unlocked story built on native features, and it answers the Judge's K2 concern. Cost: about 2–3 h of classic-op work on the frontend.
2. **Tripwire, framed for Composed as well as Unlocked.** Target contracts implement OpenZeppelin Stellar's `Pausable`, and the bounty is SAC USDC. The judged pitch becomes "any OZ-pausable Soroban protocol gets a self-paying bounty in 5 lines". That addresses the Market score and gives two named ecosystem tools.
3. **ReliefRail plus the Quorum mechanism ("aid that activates when matched").** This is only worth a slide, not a build. NGO donors pledge to a program that only launches if a matching threshold is met, otherwise refund with bonus. Too much scope for 24 h; mention it as a Continuation story.
4. **KeyHold + DepositBox + Silence Is Consent.** They are one primitive: a two-party escrow with a timeout default. If the committee wants this family, build KeyHold only, with the "silence pays the weaker party" rule as the headline, and drop the other two.
5. **If the committee insists on LeashPay, it needs a twist neither REAPP nor OZ already ships.**
   - (a) Build agent authority on **CAP-71 auth delegation**. The Judge flags it as the least-saturated surface, but it is K3-risky.
   - (b) **The Tripwire inversion:** anyone who can prove an agent's transaction broke its policy invariant claims a bounty from the agent operator's bond. That makes agent safety publicly auditable rather than only enforced.
   - Without one of these, LeashPay is the OZ policy docs plus Stellar's x402 page glued together.

## The idea most likely to be wrongly overrated: LeashPay

The Architect ranks it #1 for good reasons: it is timely, the tooling is official, and the demo is sharp. I think it will be overrated for four reasons.

1. **Prior art is direct, not adjacent.**
   - REAPP, a Stellar Community Fund submission, already describes a Soroban contract enforcing per-agent budget caps, period limits and merchant restrictions with x402 settlement.
   - OpenZeppelin ships a spending-limit policy for Stellar smart accounts as a documented feature.
   - Stellar's own x402 page markets "spending limits … scoped permissions" for agents.
   - Chain-agnostic x402-policy and tx402 exist too.

   Our build would be a configuration of other people's products, and the people judging may be the people who wrote that marketing page.
2. **Saturation is predicted by our own Judge.** 04 calls AI agent + x402 the #1 saturated category, fed by pre-event Builder HQ workshops. In a pool of about 100, expect several "prompt-injection blocked on-chain" demos. The demo is good, but it is good for everyone, so it won't stand out.
3. **Innovation (15%) and Track Alignment (20%) both sag.** Composed requires that "the combination creates something neither offers alone". OZ policies plus the x402 facilitator are *designed* to be combined this way. Judges would score this about a 3 on Innovation, which caps the weighted total near 3.6–3.8, under the 4.0 winning bar from 04.
4. **The one real technical risk is in the critical path.** That risk is x402 facilitator interop with an OZ policy-governed C-account. If the Rust allowance-vault fallback is needed, the product becomes "a vault with a daily cap", which is even less novel.

Runner-up for overrating: **ReliefRail**. Its native-feature depth is real, but SDF's own Aid Assist/SDP sits in exactly this lane, and the many moving parts make a polished 24 h demo hard. I still rank it #2 because its Track Alignment is the best in the pool.

## One-line answer

Top 6: Tripwire, ReliefRail, Quorum (with claimable-balance settlement), Roda, Earmark, LeashPay. LeashPay is in mainly because it will probably work. It is also the idea I think is most likely to be overrated, because nearly the same thing already exists.
