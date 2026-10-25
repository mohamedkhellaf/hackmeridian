# 07: Round B, replacement Wildcard Inventor (A3b)

Written Sun 25 Oct, about 14:45–15:15. Tags: [VERIFIED+link] / [ASSUMPTION] / [SPECULATION] / [UNKNOWN DEPENDENCY].
Inputs: the Round A logs, the Architect's v3 message ("the compliance officer is a contract") and the Problem Hunter's Round B message. Both are logged verbatim in the message log below.

---

## 1. Quorum: **ABANDON** (as a standalone build)

I'm deciding this honestly. My Round A supplement to the Judge did close the mechanism holes:
- A fixed-rate, time-decayed bonus `bonus_i = r·p_i·w(t_i)`. It is solvent by construction, since failure means Σp < G and so Σbonus < r·G = B [VERIFIED as arithmetic].
- Irrevocable pledges, which close the free-option exploit.
- Lab evidence that bonuses are "financially self-sustainable" [VERIFIED https://researchportal.bath.ac.uk/en/publications/early-refund-bonuses-increase-successful-crowdfunding/].

None of that fixes the two things that decide the score:
1. **Track Alignment (20%) stays at 2.5–3.** No core protocol feature is load-bearing.
   - Claimable-balance refunds are impossible from a contract [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract].
   - The only Composed route (passkeys) is K3-gated [UNKNOWN DEPENDENCY].
   - Crowdfunding on Soroban already exists (StellarFund) [VERIFIED https://dev.to/berkebey01/building-milestone-escrow-crowdfunding-on-soroban-5hc]. Prior art also exists on EVM (ether-on-a-stick, 2016) [VERIFIED per 06_debate_wildcard_inventor.md].
2. **Organiser demand has only anecdotes.** Panickssery paid out once, Make Sunsets ran a $1,000 campaign, and there is no field RCT [VERIFIED https://arjunpanickssery.substack.com/p/dominant-assurance-contract-experiment, https://www.lesswrong.com/posts/7koSvinoHSy6KBLqy/update-2-to-dominant-assurance-contract-platform-ensuredone].

My best estimate is ~3.3–3.5 weighted, which is below purpose-bound money at ~3.85 [ASSUMPTION: the Judge's scale].

The Soroswap "assurance-contract liquidity launch" pivot I floated in Round A is withdrawn. It is a new concept, which the Chairman ruled out, and the router interface is unchecked [UNKNOWN DEPENDENCY].

**What I salvage:** Quorum's one transferable piece is the *permissionless settle*, where anyone can trigger the state transition after a deadline and no keeper or operator is needed. It goes into the combination in §2.

---

## 2. Contrarian proposal: **"Keyless aid"**, an improvement on purpose-bound money v3

### Where v3 stands

The Architect's v3 already moved the SEP-8 rules into a Soroban Program contract that is the SAC admin. My predecessor didn't see that idea, and I reached it independently while drafting, so credit goes to the Architect.

v3 still has **one off-chain key with power**: the issuer/NGO G-account that co-signs the claimable-balance cascade claims (a claim needs an AUTHORIZED trustline, so it goes in an issuer-co-signed sandwich) [VERIFIED per the Architect's CAP-23 read https://github.com/stellar/stellar-protocol/blob/master/core/cap-0023.md].

As long as that key exists:
- the NGO, or anyone who compromises or coerces it, can still move AID with classic ops, bypassing the contract [ASSUMPTION: the issuer retains SetTrustLineFlags power];
- "rules as public code" is a promise, not a guarantee;
- Innovation sits at the Architect's honest ~3.5.

### The combination

Three pieces already on the table:
1. **v3's Program-as-SAC-admin** (ReliefRail).
2. **Quorum's permissionless settle**, applied to reallocation.
3. **KeyHold's "silence pays the weaker party" timeout default**, applied to unspent aid.

**Design changes to v3:**

1. **Lock the issuer.** After `set_admin(Program)`, set the classic issuer's master weight to 0, with no other signers.
   - From then on, the only thing that can mint, authorize, deauthorize or claw back AID is the Program contract.
   - The SAC admin role is transferable by `set_admin`, and a contract address can hold it, "programmatically minting and taking other administrative actions" [VERIFIED https://developers.stellar.org/docs/build/guides/tokens/custom-sac-admin, https://developers.stellar.org/docs/tokens/stellar-asset-contract].
   - That the admin powers keep working after the classic issuer is locked is [ASSUMPTION, strong: the admin is now the contract's Address and the issuer signs nothing].
   - The auth flags set at issuance persist [ASSUMPTION].
2. **Replace the claimable-balance cascade with an on-chain cascade inside Program.**
   - `reallocate(family_A)` is callable by **anyone** after T1 (Quorum's settle pattern).
   - It claws back A's unspent balance and mints the same amount to waitlisted Family B in one invocation.
   - KeyHold's default supplies the rule: unspent aid flows to the next person in need, not back to the NGO.
   - This removes the last off-chain co-signer.
   - Clawback burns the amount [VERIFIED https://developers.stellar.org/docs/tokens/stellar-asset-contract, "amount is burned in the clawback process"], so the reallocation is a burn plus a mint, and it is visible as such on-chain.
3. **No function sends AID to the NGO.** Fraud clawback burns. The worst the operator can do is destroy value, visibly. It can never redirect value.
   - Residual centralisation stays and is stated openly (K7): the NGO controls enrolment and the merchant allowlist through Program's own admin role.
   - Stretch goal: a 24 h timelock on allowlist additions, emitted as events [ASSUMPTION: cheap to add].

### Why it raises Innovation and memorability

- **One-line pitch:** "Aid that even the aid agency can't divert." The NGO throws away its keys on camera, and stellar.expert shows the issuer's signer weight at 0 [ASSUMPTION about how the explorer displays it].
- **The donor-side pain is real.** WFP estimated at least 10% of its $175M/month in Yemen food aid was diverted in Houthi areas in 2019, and suspended aid to about 850,000 people [VERIFIED https://www.newarab.com/news/un-suspends-food-aid-houthi-controlled-areas-yemen].
  - Caveat: that diversion was by local authorities at distribution, not by the NGO. Our design covers resale and post-delivery diversion, not physical seizure [ASSUMPTION about relevance; say so on the deck].
- **Demo: "three refusals and a waterfall".**
  1. The beneficiary tries a plain classic payment to a friend, and the protocol rejects it because the trustline is deauthorized [ASSUMPTION about the exact result code].
  2. The beneficiary tries `spend` at a non-allowlisted bar, and the contract rejects it.
  3. The NGO tries to pull funds, and there is no key and no function to do it.
  4. Waterfall: after T1, *a stranger* calls `reallocate`, and Family B's balance ticks up.

  All four steps are on-chain and fit in under 45 s [ASSUMPTION].
- **Innovation:** an issuer-less regulated asset whose SEP-8 role is fully on-chain. I found no deployed example, but I did not search for one specifically [ASSUMPTION]. My estimate is Innovation 4 vs v3's 3.5 [SPECULATION].
- **Track stays Unlocked-grade** through native features: AUTH_REQUIRED/REVOCABLE/CLAWBACK, SAC admin delegation, a locked issuer and sponsored reserves.
  - Composed bonus: OZ ships a SAC Admin Wrapper pattern we could build on [VERIFIED https://docs.openzeppelin.com/stellar-contracts/tokens/fungible/sac-admin-wrapper].

### Cost (20 h budget)

- **Still 1 contract** (F1 is fine). The scope is roughly flat: about +40 lines for `reallocate`, while the off-chain claim co-signer and the claimable-balance scripts are removed [ASSUMPTION].
- **What we lose:** claimable balances as a showcased primitive. That is a real trade (see §3).
- **Spike, shared with v3's K3:** one `cargo test` with `register_stellar_asset_contract_v2`, by **17:00 Sun**, checking:
  - (a) set_authorized(true) → transfer → set_authorized(false) inside one Program invocation;
  - (b) mint into a deauthorized trustline (likely needs the same sandwich);
  - (c) clawback on a deauthorized trustline balance.
  - [UNKNOWN DEPENDENCY for all three. Note the SAC test env may model trustlines differently from testnet, so finish with one testnet run.]
- **Kill rule:** if (a) fails, both v3 and this variant fall back to an off-chain SEP-8 server. If only (b) or (c) fails, keep v3's claimable-balance cascade and drop just the issuer lock.

### Ruled out

- I am not arguing for a different lead concept. ReliefRail-family purpose-bound money is the right lead. Quorum and the others don't reach its Track score.
- The Problem Hunter's final-offer arbitration for merchant disputes is good, but it is scope creep. It belongs on a "next" slide [ASSUMPTION].

---

## 3. Named disagreements (the assumption behind each)

- **With the Architect (keep the claimable-balance cascade).**
  - Underlying assumption: judges reward a *visible classic primitive* (claimable balances) more than *the absence of any privileged off-chain key*.
  - I assume the reverse for memorability. "Nobody can divert it" is a sentence a judge repeats, while "predicate waterfall" isn't [SPECULATION].
  - It is testable cheaply: show both lines to someone outside the team.
- **With the Judge (Quorum ~3.2).** I put it at 3.3–3.5.
  - The gap rests on whether W2 (sniping) still counts. With the fixed-rate design it shouldn't.
  - It doesn't change the decision, which is ABANDON either way.
- **With the Problem Hunter (diaspora as Continuation).** Agreed.
  - Keyless aid strengthens Earmark's slide: a diaspora sender can verify the school-only rule is *code the remitter can't change* [ASSUMPTION].

---

## Message log

See 06_debate_wildcard_inventor_b.md for Round A. Round B messages are appended below.
