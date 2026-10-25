# 15: AI-twin test: how easily would other teams' AIs land on our ideas?

Run Sun 2026-10-25 14:05–14:13 WET by the Chairman, after the committee decision, at the human team's request ("is this easily gettable from an AI?").

## Method

- **8 fresh AI sessions** with **no access to our research**:
  - Claude Sonnet ×2, Opus ×2, Fable ×1, Haiku ×1: subagents told to use no tools and read no files;
  - OpenAI Codex ×2, run from an empty folder.
- **Two prompts, each used 4 times:**
  - **Typical:** "give us your 10 best project ideas that could win" (with the event, tracks and rubric).
  - **Unique:** "we want something UNIQUE judges haven't seen 50 times… that really uses Stellar's native features (asset issuance, DEX, path payments, claimable balances, multisig, Soroban…)".
- Raw answers are in `15_twin_test_raw.md`, `15_twin_codex_A.txt` and `15_twin_codex_B.txt`.
- **Caveat:** 8 runs is a small sample, not a statistic. Treat it as a signal.

## Results

| Idea (ours) | Typical prompt (4 runs) | Unique prompt (4 runs) | Total | Notes |
|---|---|---|---|---|
| **Undo payment via claimable balance (Second Thought's core)** | 0/4 | **2/4, both ranked #1** (Opus "Undo Pay", Fable "Undo-Send") | **2/8** | Opus even framed it as protecting elderly people from scams |
| **Guardian who can undo but never spend; impersonated child as guardian** | 0/4 | 0/4 | **0/8** | Closest: a parent co-signer above a spending cap (Fable), agent spend limits (several) |
| **Circular debt netting (Loop's problem)** | **1/4, ranked #1** (Codex "LoopClear") | 0/4 | **1/8** | Different mechanism: compute net amounts, then one atomic multi-payment |
| **Netting via trustlines + DEX offers + a path payment from a firm to itself (Loop's mechanism)** | 0/4 | 0/4 | **0/8** | |
| Inheritance / dead man's switch / time-delayed recovery (Heirloom) | 1/4 | 2/4 adjacent | 3/8 | Common |
| Event tickets with auth flags (FairSeat, eliminated) | 2/4 | 2/4 | 4/8 | Most twinned idea of all; the elimination was right |
| Rent deposit escrow with yield (Caução, eliminated) | 1/4 | 0/4 | 1/8 | Matches our own AI-twin finding |

## Conclusions

1. **Second Thought's headline, "undo a payment for 24 hours", is easy for an AI to reach.** Two of the four teams that ask an AI for unique, Stellar-native ideas would get it as the #1 suggestion. Expect at least one "undo send" entry in the room.
2. **Second Thought's distinctive part is the guardian twist, which 0/8 runs found.** That's the impersonated child as the guardian, who can undo but never spend, plus a server that can be switched off on camera. The pitch must lead with that, not with "undo".
3. **Loop's problem is easy to reach, but its mechanism isn't.** GPT's top answer to the plain prompt was circular debt settlement. But nobody found the Stellar-native mechanism (IOUs as assets, trustlines as credit lines, one circular path payment). Loop is more unique in *how*, Second Thought in *who*.
4. **The eliminations hold up.** FairSeat (4/8) and Caução were the most AI-predictable ideas.
5. **No idea from an AI brainstorm will be unique at the category level.** What judges can't get from an AI is the specific twist plus a real human story. For us, that's the Portuguese "Olá mãe" scams, the team's relative, and the guardian design.
