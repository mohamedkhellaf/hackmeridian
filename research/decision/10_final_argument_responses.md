# 10 — Responses to the Judge's final argument against F1

## Stellar Architect

_Sent 13:36 WET to the Ruthless Judge (ac72ecdbce496fda1), cc Chairman (main). Verbatim:_

STELLAR ARCHITECT: response to the Judge's final argument against F1, points 3 and 4, plus the proposed changes. cc Chairman.

POINT 3 (the protocol-native story is thinner than pitched): PARTLY CONCEDED.
- CONCEDED [V]: the primitives aren't new.
  - The CLI agent guide already documents a low-threshold delegate claiming a claimable balance ("co-signed vault", https://developers.stellar.org/docs/tools/cli/agent-cli/guides/delegate-spending#pattern-1-a-co-signed-vault).
  - Claimable balances were designed for conditional delivery.
  - Op-source ≠ tx-source is standard Stellar.
  - The classification rule ("which payments get delayed") is evaluated OFF-chain, by our function (Full) or our app (Lite).
  - I'm lowering my own F1 Track Alignment score from 4 to 3.5. Protocol judges could give 3.
- REBUTTED, with evidence: what IS validator-enforced is exactly the set of guarantees a security-minded judge cares about, and it doesn't depend on our server being honest. All are [V] on testnet with the final table, spike f:
  (1) The stranger can't claim before T: op_cannot_claim.
  (2) The guardian can undo but can never spend, even together with our server: G+P = 2 < 3 → op_bad_auth on Payment AND SetOptions.
  (3) Mum's key alone, e.g. phished, moves nothing: op_bad_auth.
  (4) The family can remove our server: de4ecad5.
- The honest one-line framing for the pitch: "our server can only ever make a payment slower, never move money." Its worst case if compromised: it co-signs a direct payment Mum also signed, which degrades to an ordinary wallet. It never steals.
- The rule's DATA is on-chain and auditable: the allowlist lives in Mum's ManageData (medium threshold, so it needs Mum plus a co-signer to change). Only the evaluation is off-chain.
- So the claim is "the rules are ours, but the vault is the protocol's". That's honest, and it's defensible in front of Garand or Tyler.
- What I would NOT claim: "enforced by the Stellar protocol" for the 24h delay itself in Lite mode. In Lite, Mum bypasses it from any wallet [V by threshold arithmetic].

POINT 4 (complexity sits where judges test): CONCEDED. Here is the concrete scope cut.
It keeps all four protocol-enforced claims above at the lowest complexity:
- THREE roles only: Mum, Daughter, Stranger. "Known payee" isn't a role; it's one pre-seeded allowlisted address (the son).
- Heirloom hatch: CUT from the MVP and the video. It moves to the README "roadmap" with its spike evidence (c/d/g).
- Allowlist 24h cool-off: CUT. The allowlist is fixed at setup (ManageData written by the setup tx).
- The policy function shrinks to two rules:
  (i) payment to a destination present in Mum's data entries;
  (ii) createClaimableBalance whose claimants are exactly [recipient NOT_BEFORE ≥ now+window, Mum unconditional].
  Everything else is rejected. That's about 80 LOC and about 3 dev-h, down from 6. It is stateless, with POLICY_SECRET as an environment variable.
- Family override: not a UI mode. One "Advanced: remove our server" button in the Daughter tab, and documented in the README.
- Setup: one "Create demo family" button, plus a PRE-MADE shared demo family linked in the README, so judges need zero setup.
- Mum can't set it up alone: CONCEDED, by design. The child installs it for the parent, the same adoption model as family-safety apps [A]. The pitch says "set up by family, used by Mum".
- New estimate: about 22–24 dev-h, down from ~30, so about 12 dev-h of buffer out of ~36. The policy function is the only new-tech item, and it is gated by your checkpoint (c).
- The cut-line if checkpoint (c) slips: Lite (1/2/2). We lose claim (3) and say so; claims (1), (2) and (4) survive in modified form.

JUDGE'S PROPOSED CHANGES:
(a) Gate on the relative call: ACCEPT as the gate for the PITCH framing (user/persona), not for starting code. The shared foundation (tx lib, error mapping, scenario funding, hosting) is needed anyway and is largely reusable for Loop. Hard decision gate: call results by ~17:00. If they undermine F1, switch before anything F1-specific is built.
(b) Shrink to a wallet-feature reference integration plus SDK with three roles: ACCEPT. The code structure is a `second-thought-core` TS module (tx builders + policy rules) used by the demo app. The README positions it for LOBSTR-class wallets and names Coinbase Vault, Argent, LOBSTR Vault and Volta Circuit. We claim only "undo-by-default after sending, on a plain classic account, no contract; the guardian can never spend". No npm publish.
(c) Checkpoints: ACCEPT, tightened. Lite flows green on the HOSTED URL by ~21:00. Simplified co-signer green by ~01:00 rather than 06:00, so the video can be recorded on Full in the morning. Hard stop 06:00: otherwise ship Lite with downgraded claims.
(d) Switch to Loop only on evidence: ACCEPT, on both conditions: the SME call finds a real closed cycle that accepts a pseudonymous public graph, AND the relative call undermines F1.

RANKING: UNCHANGED (F1 > F2 > F3), with a smaller margin.
- My F1 drops to 74.0: Track Alignment 3.5. Everything else is unchanged.
- That is still above Loop at 73.0, but now a near-tie that turns on the User Value evidence (your point 1), not on protocol depth.
- With the scope cut, F1's Technical Execution and UX risks fall, which offsets most of the Track Alignment concession.

## Wildcard Inventor

_Sent 13:36 WET to Ruthless Judge (ac72ecdbce496fda1), cc Chairman (main)._

```
WILDCARD INVENTOR responds to the Judge's final argument against F1, POINT 2 (familiar product) and POINT 6 (opportunity cost). Summary: I partly concede point 2, propose two zero-build-risk ways to make F1 distinct, accept (a)–(d) with one amendment, and keep F1 > Loop with an explicit, numeric flip condition.

Labels: [V] = verified (link or testnet tx), [A] = assumption, [S] = speculation, [U] = unknown dependency.

POINT 2: "LOBSTR Vault + Argent trusted contacts, a UX inversion, twins likely". PARTLY CONCEDED.
- Conceded:
  - Innovation stays at 3. The pattern ships elsewhere (Coinbase Vault, Argent, bank cooling periods, LOBSTR Vault, Volta Circuit [V, 08_dd_problem_hunter]).
  - A "guardian / scam-safe wallet" twin in the room is likely [S], and ScamGuardAI and TrustGenome AI exist [V].
- Rebutted: "undo after sending" vs "approve before sending" is not only UX. It changes WHO must act and WHEN, and that is a capability difference.
  - Approve-before (LOBSTR Vault approves every tx [V]; Argent needs a guardian co-sign above the limit [V secondary]) needs the guardian to be live for EVERY protected payment. Legitimate payments STOP when the guardian is asleep, so families switch it off. Your own point 5 makes the same argument.
  - Undo-after needs the guardian ONLY when something is wrong. Legitimate new-payee payments complete by themselves after the window with nobody acting [V spike a, 9dc6c354: recipient claim after window OK].
  - That is opt-out protection versus opt-in approval. None of the four named products has it on a self-custody classic account with no contract [V Scout + 08_dd_problem_hunter table].
  - Volta Circuit is enterprise and contract-based, with no guardian or undo on its site [V Scout/site]. Argent is an EVM contract wallet [V secondary].
- The twins problem is a FRAMING problem, solved below.

HOW TO MAKE F1 DISTINCT WITH ZERO ADDED BUILD RISK. Both are already supported by the verified design.
(1) "Pull the plug" demo moment, borrowing Loop's "the network does the work" theatre.
  - Mid-video we switch OUR server OFF on camera (the /health badge turns red).
  - Then the stranger's claim is still refused, the daughter's Undo still works, and the daughter's attempt to spend is still refused.
  - Every one of those beats is server-independent [V spikes e/f: undo is guardian-only at low threshold; op_cannot_claim and op_bad_auth come from validators].
  - No AI-scam-detection twin, Coinbase or Argent can do this: their protection IS the company or the contract.
  - It also answers your point 3 head-on: "what's left with our server dead is exactly what Stellar enforces."
  - Cost: a toggle that already exists (Family mode / health badge).
(2) Make the protocol rule VISIBLE.
  - Open the claimable balance on stellar.expert and show the predicate printed in the ledger ("claimable by recipient NOT before 14:32"), next to Mum's signer table (Mum 2 / Daughter 1 / Server 1, thresholds 1/3/3).
  - The judge sees the rule lives on Stellar, not in our UI. Cost: two explorer links.
(3) Framing no twin will have: "The scammer impersonated the one person who can undo it."
  - In the demo the scam text claims to be from the daughter, and the alert lands on the real daughter's screen.
  - Twins frame scams as AI detection. We frame them as a family/network property. [V ACCC 82%/95% for the typology; the mechanism is A]
- Name all four prior arts on one slide and claim only the delta: "undo-by-default after sending, on the plain Stellar account you already have; the guardian can never spend; it still works with our server switched off."

POINT 6: OPPORTUNITY COST / "should Loop win now?"
- Conceded: by my own scores Loop beats F1 by +10 on TA + Innovation (TA 5 vs 4, Inn 5 vs 3), and it is the only true off-the-wall entry [V-verbal Elliot].
- F1 wins back +12 on UV (4 vs 2), MEP and UX, for a net F1 75 vs Loop 73 (09_score_wildcard_inventor.md).
- The margin is entirely F1's User Value. Explicit flip condition:
  - If the relative call and the holder search fail and F1's UV drops 4 → 3, F1 falls to 71 < Loop 73. On my numbers Loop then becomes the winner even if the SME call is inconclusive.
  - Loop's UV is 2 under every scenario we've seen, so only F1's UV moves.
- So: Loop should NOT be the winner now. It should be the winner if point 1 holds.

ACCEPT YOUR PROPOSED CHANGES?
(a) Gate on the relative call: ACCEPT, time-boxed so it doesn't idle the team.
  - Build the shared skeleton for hours 0–2 regardless: hosted Vite app, "Seed demo" funder, in-app keys, role switcher, tx-link and rejection cards. It serves F1 AND Loop.
  - Decide at a fixed checkpoint, ~2h in, on what the calls returned.
(b) Shrink F1 to a reference integration / SDK with three roles: ACCEPT.
  - Mum / Daughter / Stranger. The known payee is a one-click pre-allowlisted contact, not a fourth tab.
  - The Heirloom hatch is out of the video; README-only stretch.
  - The co-signer is shown as the hardening stage. The "pull the plug" beat makes the server's limited role explicit.
(c) Go/no-go checkpoints: ACCEPT as written. Lite flows green on the hosted URL by ~21:00; Full by 06:00 Monday, else ship Lite with downgraded claims.
(d) Switch to Loop only on evidence: ACCEPT, with one amendment.
  - Switch if F1's user premise fails (UV → 3), even if the SME call is merely inconclusive, because on my scores that is already Loop 73 > F1 71.
  - If the SME call actively refutes Loop (no closed cycle / public graph refused), stay with F1 regardless.

DOES MY RANKING CHANGE? No in order, yes in confidence.
- F1 75 > F2 73 > F3 69 still.
- But I now hold F1's lead as conditional on point 1 (the evidence gate), not as settled.
```
## Problem Hunter

Problem Hunter's response to the Judge's final argument against F1 (Points 1 and 5, plus your proposed changes). cc Chairman.

### POINT 1: "the user may barely exist on Stellar". PARTIALLY CONCEDED; re-scoped below.

1. I CONCEDE the ACCC point. Hi-Mum losses are bank transfers [V, source context]. They prove the scam PATTERN and who gets targeted (55+: 82% of reports, 95% of losses). They do NOT prove anyone was scammed from a Stellar wallet [U]. The pitch must use them that way, never as "Stellar users lose $X".
2. I searched for evidence of non-crypto-native or older stablecoin holders in classic Stellar wallets.
   - **Non-crypto-native savers holding USDC on Stellar exist.** [V] Vibrant, an SDF/Sunship wallet, lets Argentines facing inflation buy and hold USDC on Stellar to "protect their savings". MAU grew 282% between Q2 2023 and Q2 2024, and Argentina is ~93% of users (https://stellar.org/case-studies/vibrant ; https://thefintechtimes.com/usdc-digital-wallet-vibrant-reports-282-growth-driven-by-high-inflation-in-argentina/).
   - [UNVERIFIED, press] Vibrant rebranded as Vesseo, with ~300k active users across 16 LatAm countries (La Voz).
   - [U] Whether Vibrant/Vesseo accounts are classic G-accounts the user controls; I didn't verify the custody model.
   - **Older people are going digital in that market.** [V, secondary, citing Argentina's Central Bank and Fintech Chamber] 3.3M Argentines over 60 (42% of that age group) use a virtual wallet, with use up 29.7% YoY to June 2025. That covers general wallets, NOT stablecoins.
   - **No age data exists for LOBSTR, Vibrant or Bitso stablecoin users** [V absence: LOBSTR publishes no demographics, and Bitso's 2025 report, ~10M users, gives none].
   - Bottom line: I found NO direct evidence of 55+ users holding stablecoins in classic Stellar wallets. Saying so plainly.
3. HONEST RE-SCOPED USER (I adopt your wording): "**a non-crypto-native family that saves in digital dollars in a self-custody Stellar wallet, plus one trusted family member**".
   - The evidenced example class is Argentine inflation savers (Vibrant-class [V]). The older-parent case is an illustrative persona, not a claim.
   - Hi-Mum is cited as "the attack pattern this stops", with bank data labelled as such.
4. User Value impact: I move my F1 UV from 4 to **3**, which takes F1 from 75 to **71** on my sheet.

### POINT 5: "24h friction on legitimate urgent payments". Mostly REBUTTED by design; two items CONCEDED.

1. Urgent legitimate first payment (new landlord, hospital). The 24h window is the DEFAULT, not the only path.
   - Mum + guardian (2 + 1 = 3) can sign a normal instant payment to any new payee [V threshold arithmetic; Family override verified in spike f, de4ecad5].
   - So the product rule is "a new payee needs 24h OR your daughter's tap". That is exactly the check a Hi-Mum victim skips, and it turns friction into the protection.
   - Bank precedent: DBS imposes a 12h delay on adding new recipients, and Singapore banks hold large transfers 24h [V]. They accept this friction at national scale.
2. Exchanges and wallets that never claim claimable balances: CONCEDED [A, likely true]. Mitigations:
   - (a) The first send to an exchange deposit address goes via guardian-approve-instant.
   - (b) After one successful approved payment, the address becomes a known payee.
   - It's a UX cost, not a loss: unclaimed CBs stay reclaimable by Mum (claimant: unconditional).
   - Reserve: 0.5 XLM per pending CB, returned on claim or reclaim [V protocol, trivial].
3. "Users will switch it off": CONCEDED as a risk, no data [U]. Design fact: switching it off is a high-threshold op (3), so Mum can't do it alone. It needs the daughter (or our server), which means a scammer would have to coach both [V threshold arithmetic].
   - That's a feature, but I can't evidence retention. Say so.
4. Net on Point 5: friction is real but bounded to first payments to new people, with an instant family path. It doesn't change my scores, beyond a UX 4 that rests on the guardian-approve path being in the demo.

### YOUR PROPOSED CHANGES

**(a) Gate on the relative call: ACCEPT, with a precise gate.**
- The gate is NOT "was it a crypto wallet?" (we already concede it wasn't).
- The gate IS: "was it a single urgent payment to a new recipient, where a 24h pending period plus the real child seeing an alert would have stopped it?"
- If the call reveals a groomed multi-week investment scam instead, re-scope the pitch away from Hi-Mum. It's a pitch gate more than a build gate: the mechanism is unchanged either way.

**(b) Shrink F1 to "wallet-feature reference integration / SDK" with three roles: ACCEPT FULLY.**
- It matches the only channel evidence we have (LOBSTR Vault shows co-signers on G-accounts ship [V]). It removes the "yet another wallet" read (89 builds), and it lifts Market & Ecosystem from 3 to 4.
- Policy co-signer as one stage-2 beat, the Heirloom hatch out of the video, and one slide naming Coinbase Vault, Argent, LOBSTR Vault and Volta Circuit: all agreed.
- Claim only: "undo-by-default after sending, on a plain classic account, guardian can't spend, no contract".

**(c) Go/no-go checkpoints: ACCEPT.** Lite flows green on the hosted URL by ~21:00; Full co-signer by 06:00 Mon, or ship Lite with downgraded claims.

**(d) Switch to Loop only on evidence: ACCEPT.** Both conditions are required (a real closed cycle that accepts a pseudonymous graph, AND the relative call undermining F1). Build one, not both.

### DOES MY RANKING CHANGE? NO, but the margin shrinks to almost nothing.
- F1 recalculated with UV 3 and Market & Ecosystem 4 (after (b)) = **73**, vs Loop **70** and Heirloom **65**.
- F1 is still ahead because it is the only finalist whose mechanism resolves a specific harm for one user acting with her family on day one. Loop's evidenced pain (linear late-payment chains) is one its MVP cannot touch.
- But F1's lead now rests on the re-scoped user plus the guardian-approve path. If the team can't show either in the demo, I'd score them level.

### Stellar Architect: follow-up (~13:40 WET)
The Judge replied, accepting the rebuttal framing and the scope cut (Judge's F1 score unchanged at 75), with two notes. **Both are accepted, and both are correct:**
1. **Security claim, corrected:** "No SINGLE compromise moves money: not Mum's key, not our server, not the guardian, and not guardian + server. Two independent compromises (Mum's key + our server: 2+1 = 3) can." [V by threshold arithmetic]. This goes in the README security note, replacing "our server can only ever make a payment slower".
2. **Simplified policy is stronger, so we pitch it:** the policy function rejects ManageData. The allowlist can therefore only change with Mum + Daughter (2+1 = 3), so a coached Mum plus our server cannot add the scammer as a "known payee". This answers the "add me as a contact" attack better than the 24h cool-off did.

### Problem Hunter: Judge's reply received (~13:50 WET), logged verbatim

Judge reply to the Problem Hunter on points 1 and 5: I accept your re-scope and your rebuttals, with one caveat.

ACCEPTED
- **User re-scope:** "a non-crypto-native family saving digital dollars in a self-custody Stellar wallet + one trusted member". The Vibrant-class Argentine savers are the evidenced class [V], and the older parent is an illustrative persona. The ACCC figures are used only as "the attack pattern", never as Stellar losses. F1 UV goes to 3.
- **Point 5 rebuttal: "a new payee needs 24h OR your daughter's tap".**
  - Mum + guardian = 3 gives an instant path [V by threshold arithmetic; spike f].
  - It turns friction into the protection itself, and DBS/Singapore show the friction is accepted at scale [V].
  - Put the guardian-approve path in the demo. UX stays at 4 only with it.
- **The four switch-off/claim concessions:** noted for the "does not stop" slide.

CAVEAT: Vibrant/Vesseo as a channel is unverified.
- We don't know whether Vibrant/Vesseo accounts are user-controlled classic G-accounts [U, your own label]. If they are custodial or smart-wallet accounts, they are the same dead end as MoneyGram/Crossmint.
- So cite Vibrant only as evidence that the USER CLASS exists, not as a distribution channel. The channel claim stays "LOBSTR-class classic wallets" [V that LOBSTR Vault exists; S that LOBSTR wants this].

My sheet now:
- F1 = 73: TA 4, UV 3, TE 4, Inn 3, HP 4, MEP 4, UX 4.
- Loop = 70.
- Heirloom = 67.
F1 holds, conditional on the 17:00 call gate.

(PH note: caveat accepted. Vibrant is cited as evidence that the user class exists, not as a channel. No further reply needed; positions converged.)

### Wildcard Inventor — follow-up exchange with the Judge

Received from the Judge (ac72ecdbce496fda1):

```
Judge reply to the Wildcard on points 2 and 6: I accept "pull the plug" and the visible predicate, and I reject your amendment to (d).

ACCEPTED
- "Pull the plug" is the best answer to my point 3 anyone has given.
  - With the server OFF on camera, the early claim is still refused, the undo still works, and the guardian still can't spend [V spikes e/f].
  - It makes the "protocol vs our rules" boundary visible instead of something we have to explain. Make it the hero beat.
- Showing the predicate on stellar.expert next to the signer table: yes.
- "Undo-after vs approve-before" is a partial capability difference. You're right that it changes who must act and when. But Argent's daily limit also lets small payments through with no guardian [V secondary], so call it "opt-out protection", not "first ever".

REJECTED: your amendment to (d), "switch to Loop if F1's User Value drops to 3, even when the SME call is inconclusive".
- On my sheet, F1 re-scoped scores 73, with:
  - UV 3, using the Problem Hunter's honest user: a non-crypto-native family saving digital dollars in a self-custody Stellar wallet, with Vibrant-class Argentine savers as the evidenced class [V];
  - MEP 4 for the wallet-feature/SDK framing.
- Loop stays at 70 while its User Value is 2. An inconclusive SME call doesn't raise it.
- So F1 at UV 3 still beats Loop. Only a POSITIVE SME result (a closed cycle AND acceptance of a public graph) moves Loop's User Value, and only that justifies a switch.
- Keep (d) as originally written: both conditions.

cc: forwarding a one-line summary to the Chairman.
```

Sent by the Wildcard to the Judge, cc Chairman:

```
WILDCARD INVENTOR accepts the Judge's rejection of my (d) amendment. Rule (d) stays as originally written: switch to Loop only if BOTH conditions hold.

- Why our sheets disagree, made explicit: my amendment rested on my own scores, where Loop's Innovation is 5 and F1's Market Potential is 3. Yours have Loop's Innovation at 4 and, with the SDK framing, F1's Market Potential at 4. With your numbers, F1 at User Value 3 (73) still beats Loop (70).
- Which assumption decides it: whether judges will see Loop as new (5) or as "Ripple-era rippling, now native" (4). Given Trustlines Network and RipplePay as prior art [V/UNVERIFIED in 08_dd_problem_hunter], your 4 is defensible, and a switch rule shouldn't hinge on one scorer's Innovation point.
- Also accepted: "opt-out protection", never "first ever". Argent's daily limit lets small payments through too [V secondary].
- Agreed: "pull the plug" is the hero beat, with the claimable balance's time condition shown on stellar.expert.
- Final position: F1 (re-scoped to a self-custody digital-dollar family, as a wallet feature/SDK, with three roles) is the winner. Loop is the backup, switched to only on a positive SME call AND a failed F1 premise.
```
