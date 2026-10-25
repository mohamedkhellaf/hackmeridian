# 05 — Ranking (Agent 1, Problem Hunter, independent)

Lens: will a named user *want* this and adopt it (User Value, Market, Adoption, the event's first priority), scored against the 04 rubric and kill checklist. Rough weighted scores are on the 1–5 scale. K = hard kill, F = flag.

## Ranked list (all 11)

1. **ReliefRail (~4.1).** Proven buyer: UNHCR already disburses on Stellar, and restricted-use is the missing piece. Deepest *native* Unlocked story (AUTH_REQUIRED, clawback, claimable-balance expiry, sponsorship) and passes K1 cleanly. Flags: F1 (classic plus Soroban split) and F6 (must be framed as an SDP complement). K7 risk: never imply an NGO partner.
2. **Roda (~3.9).** Strongest organic demand of the 11: MoneyFellows has over 8.5M users, the treasurer-default problem is well studied, and groups self-onboard with no institution and no cold start. K1 pass, since custody is the product. Weaker Track score (Soroban + SAC only) unless we add passkeys or claimable-balance payouts. F8: needs a fast-forward mode.
3. **Tripwire (~3.8).** Highest Innovation and Ecosystem fit ("insurance for every Soroban TVL"), and the Stellar use is load-bearing. From my lens the users are few, and protocols writing correct invariant verifiers is a real adoption barrier. Only viable if the rollback spike (K3) passes in the first hour.
4. **Quorum (~3.6).** Elegant mechanism with real lab evidence, the simplest build, and a great demo. But organiser demand for *paying* a failure bonus is unproven, and it sits in the saturated crowdfunding category (K2 is survived only through the mechanism twist).
5. **KeyHold (~3.4).** Very relatable Lisbon pain with evidence, and the "silence returns the deposit" default is the right rule. Two-sided adoption (F7: landlords hold the power) and a middling Track fit hold it back.
6. **LeashPay (~3.4).** Real and timely developer pain, a mostly TypeScript build, and a clean Composed story. But it is in the predicted #1 saturated category (K2 risk), and OZ policies, REAPP and x402-policy already exist, so "why not just use the OZ policy?" (F6) has a thin answer.
7. **DepositBox (~3.2).** Same idea as KeyHold. Its default rule is worse (tenant silence means the landlord's split is accepted, which favours the powerful side), but its EUR path-payment refund is a good addition.
8. **Earmark (~3.1).** Best evidence (RCT: labelling raises sends by more than 15%), but remittance is very saturated (K2) and payee off-ramps are unverified. It is better absorbed into ReliefRail.
9. **Silence Is Consent (~2.9).** Documented pain, but a crowded escrow space overlapping Trustless Work (F6), and clients won't pre-fund.
10. **Volta (~2.8).** Charming demo, but demand is unproven, it needs a café network (F7) and physical operations, and Innovation is low.
11. **QuietPay (~2.6).** Payroll has already won (PayZoll), and it depends on an unaudited testnet preview with no API docs (K3). The privacy need is real but the build risk is extreme for newcomers.

## Top 6
ReliefRail, Roda, Tripwire, Quorum, KeyHold (merged with DepositBox), LeashPay.

## Suggested merges
- **KeyHold + DepositBox:** KeyHold's default-to-tenant rule and evidence, plus DepositBox's EUR path-payment refund and passkey onboarding.
- **ReliefRail + Earmark: "restricted-use value".** One engine (an auth-required asset, payee allowlist, claimable-balance expiry and clawback) serving two buyers: NGOs (B2B wedge) and diaspora senders paying schools or pharmacies. Demo the NGO flow and pitch diaspora as the next market. This also gives Earmark's RCT evidence to ReliefRail's User Value slide.
- **Silence Is Consent → KeyHold:** keep only its timeout-default pattern. Drop it as a standalone concept.
- **Roda + passkeys / claimable balances:** this lifts Roda's Track score from "a Soroban contract" to native features (sponsored onboarding, payout via claimable balance). The concept stays the same with a stronger Unlocked story.

## Most likely to be wrongly overrated: LeashPay
It is the Architect's #1, it looks feasible, and it is on SDF's current marketing theme, so it will feel "aligned". But the Judge predicts x402/agent payments as the most saturated category at this event, and the Wildcard found REAPP, OZ smart-account policies and x402-policy already covering "agent spending caps". The blocked prompt-injection demo is exactly what dozens of teams will show, and the user (an agent developer) doesn't need a new product when an OZ policy plus a 10-line config does it. Feasibility is not differentiation. (Runner-up: Tripwire on User Value. Judges will love the trick, but very few people would actually use it this year.)
