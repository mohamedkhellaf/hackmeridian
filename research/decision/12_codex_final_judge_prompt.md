# Final independent judge: instructions

You are the **final, independent judge** for a hackathon team's project decision. Your judgment decides what a 3-person team builds in the next ~20 hours.

- **Your value is your independence.** Every earlier participant in this decision was an AI system from one vendor, so they may share blind spots. You are not on their team and owe them nothing.
- **Agreement is not evidence.** The number of earlier participants who agreed on something tells you nothing about whether it's right.
- **Judge only on evidence** you can read or verify yourself.

This review has **two stages**, and the order matters. Complete and save Stage 1 **before** you open any file it lists as off-limits. Stage 1 exists so your own judgment is recorded before you see anyone else's conclusions.

---

## Facts you can rely on

### Event

- **Hackathon:** HackMeridian 2026, Lisbon, built on the Stellar blockchain.
- **Category:** Genesis (new idea → working MVP).
- **Submission deadline:** **Monday 2026-10-26, 12:00 Lisbon time (UTC+0)**. No late submissions. It is currently Sunday 2026-10-25, early afternoon.
- **Judging** is asynchronous, based on a demo video, pitch deck, source repository and written submission answers.

### Official sources (verify the rubric yourself)

- https://www.hackmeridian.com/build
- https://developers.stellar.org/
- https://github.com/stellar/ecosystem-resources

### Tracks (as stated to the team; verify)

- **"Stellar Unlocked":** novel, meaningful use of Stellar's underlying protocol capabilities.
- **"Stellar Composed":** an innovative combination of at least two Stellar ecosystem projects or tools.

### Judging weights (as stated to the team; verify)

| Criterion | Weight |
|---|---|
| Track Alignment | 20 |
| User Value & Problem | 20 |
| Technical Execution | 15 |
| Innovation | 15 |
| Hackathon Progress | 10 |
| Market & Ecosystem Potential | 10 |
| Product Design & UX | 10 |

Each criterion is scored 1–5. The weighted score out of 100 is Σ(weight × score / 5).

### Team

- 3 capable software engineers, new to Stellar/Soroban.
- An AI coding assistant will write much of the code, so raw coding hours are less of a constraint than human review, testnet reliability, and producing the video and deck.
- About 20 hours of wall-clock time remain, including sleep.

### Repository

- Rust Soroban workspace (`contracts/`).
- Vite + React + TypeScript frontend (`frontend/`) with `@stellar/stellar-sdk` and `@stellar/freighter-api`.

---

## STAGE 1: blind assessment

### You MAY read

- `research/decision/01_problem_hunter.md`, `research/decision/02_stellar_architect.md`, `research/decision/03_wildcard_inventor.md`. These hold the **12 original project proposals** (PH-1..4, SA-1..4, WI-1..4), each written by a different researcher before any discussion. Each author ranked only their own ideas, so treat those rankings as self-promotion.
- `research/decision/16_sprint/gen_*.md`. **About 20 further proposals** from a second round of independent generators (`brief.md` there explains their constraints). Treat them the same way. Together with the files above, this is the full candidate pool.
- `research/decision/04_judging_framework.md`. Research on the rubric, past winners, oversaturated categories and technical traps. **It was written by a participant**, so treat its opinions with the same skepticism, and verify anything decision-critical against the official sources.
- The official sources above, Stellar docs, and the open web.
- The repository's code and config, but not the files below.

### You MUST NOT open (until Stage 1 is saved)

- `WINNING_IDEAS.md`
- `research/decision/00_*`
- `research/decision/05_*` through `research/decision/11_*`, `research/decision/15_*`, `research/decision/17_*`
- `research/decision/spikes/`
- Any other file in `research/decision/` not listed above
- Any git history or uncommitted diffs that would reveal them

### Task

1. **Verify the rubric, tracks and deliverables** against the official sources. Note any differences from what's stated above.
2. **Assess all proposals** (the 12 original plus the second-round ones; group near-duplicates). For each, give a one-line verdict and mark any that should be killed outright, with the reason. Check for:
   - a weak or unclear user problem;
   - blockchain that is decorative rather than necessary;
   - a dependency that can't work on testnet or within the deadline;
   - an oversaturated category with no twist;
   - existing products that already do it.
3. **Pick your top 3.** Score each on the official rubric, 1–5 per criterion with one sentence per score, and compute the weighted score.
4. **Make a pick.** Choose **one project to build and one backup**. You may combine proposals or modify one, if you can justify it. You may also say none of the 12 should be built and propose an alternative, but only if it beats them on the rubric *and* is buildable by the deadline.
5. **Verify the mechanics yourself.** For your pick, list the 3 technical assumptions that must hold for it to work. Verify each against official Stellar docs, with links, or mark it Could-not-verify.

Write all of this to **`research/decision/13_codex_stage1_blind.md`** and save it. Do not edit that file after Stage 2 begins; it is your pre-registered judgment.

---

## STAGE 2: reveal and final verdict

Only after Stage 1 is saved, read:

- `WINNING_IDEAS.md`: the decision another group reached, with the full specification.
- `research/decision/11_fable_review.md`: a previous review.
- `research/decision/00_chairman_log.md`: the process timeline.
- `research/decision/05_shortlist.md`, `research/decision/09_score_*.md`, `research/decision/10_final_argument_responses.md`.
- `research/decision/spikes/`: testnet test scripts (`.cjs`) and their raw outputs (`.out`) with transaction hashes. They need Node and the SDK at `frontend/node_modules`, create throwaway testnet accounts, and contain no secrets. You may re-run them if you have network access.
- As needed: `research/decision/06_*` and `research/decision/07_*` (debate logs) and `research/decision/08_dd_*` (due diligence).

### Then answer, in order

1. **Verdict.** Exactly one of:
   - **CONFIRM** the other group's choice;
   - **CONFIRM WITH REQUIRED CHANGES** (list them);
   - **OVERTURN**, naming what to build instead.

   If your Stage 1 pick differs from theirs, say which is better **now that you have seen the evidence**, and why. Don't defer to them because they spent longer; don't defend your blind pick out of pride. Say what evidence, if any, changed your mind.
2. **Your scores** for their choice and for your Stage 1 pick, on the official rubric (out of 100), side by side.
3. **Technical and security check of their choice.** Independently verify every claim in `WINNING_IDEAS.md` about what the Stellar network enforces against official docs, and confirm the spike scripts actually test what is claimed. Look for:
   - any way a single compromised or malicious party can move or freeze funds that is not disclosed;
   - operation-source vs transaction-source tricks;
   - claimable-balance edge cases.
4. **Overclaims.** List every statement in `WINNING_IDEAS.md` that a skeptical Stellar judge could catch as false, unverified or exaggerated. Quote it and give the correction.
5. **Fatal risks to submission.** Anything in the plan, scope, hosting, judge reproducibility, secrets handling or demo that could make the submission fail or score badly, with a fix.
6. **Process integrity (brief).** Do the logs support a real adversarial process, where ideas changed because of evidence? Or do they look like convergence presented as debate? This affects how much weight their conclusions deserve.

Write Stage 2 to **`research/decision/14_codex_final_verdict.md`**.

---

## Rules

- **Evidence labels.** Mark every factual claim Verified (with a link or command output) / Assumption / Speculation / Could-not-verify. Never invent products, numbers, quotes or features.
- **Don't change the project.** Do not modify any existing file. Do not write application code. Your only outputs are the two files above.
- **Be decisive.** Don't give probabilities of winning. Do give a clear recommendation the team can act on in the next hour.
- **Finish** with a short final message (max 12 lines): your Stage 1 pick, your final verdict, and the top 3 reasons.
