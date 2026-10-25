# 04 — Judging Framework (Agent 4, Ruthless Judge)

Compiled Sun 2026-10-25 ~13:00 Lisbon. Labels: **[V]** Verified (source linked), **[V-verbal]** verified from the official "Judging Insights" video transcript (auto-captions, so wording may be slightly off), **[A]** Assumption, **[S]** Speculation, **[UNVERIFIED]**.

---

## 1. Verified rules & rubric

### Tracks (Genesis only) [V] https://www.hackmeridian.com/build
- **Stellar Unlocked**: "Your project gets something new out of Stellar's core protocol features." Long form: "built-in asset-issuance capabilities and a DEX, ZK-ready host functions, and powerful contract features … Take Stellar fundamentals further than they've gone before."
  - Official idea prompts: *ZK, natively* (Poseidon + BN254 host functions: verifiers, private voting, membership proofs); *The underrated toolbox* ("Create trustlines through SACs, or put externally managed contract executables and sparse contract type mappings to work"); *Old-school assets, new tricks* (issuance, DEX, path payments "for something they weren't obviously designed for"); *Protocol-powered games* ("real onchain stakes and outcomes on core protocol features").
- **Stellar Composed**: "Your project combines two or more ecosystem tools or projects into something new." "Pick two or more and build what none of them could do alone, on real infrastructure that keeps running long after demo day."
  - Official idea prompts: *Agents that spend* (Stellar CLI wallet + OpenZeppelin policy library + USDC/USDT0 over x402 or MPP); *Private payments, two ways* (OZ Confidential Tokens or Nethermind Stellar Private Payments; "SPP is testnet only"); *Wallets people want to use* (no seed phrases, no gas, no jargon); *From onchain to the bank* (pay people who cash out through an anchor); *Bring users and liquidity* (Near Intents, Axelar, CCTP, LayerZero OFT).
- "Genesis builders can be part of both tracks." [V]

**How judges described the tracks** (Judging Insights video, Stellar Developers Meeting 10/22/2026, https://www.youtube.com/watch?v=oR-7PZwBevo, linked from /build as "Judging Insights") [V-verbal]:
- Unlocked = "building something that used to not be possible building on Stellar": ZK primitives, confidential tokens, Stellar private payments, USDT0, LayerZero OFT, MPP/x402. "It's about what you didn't have the ability to do in the last hackathon … that you can do now … Bring your craziest ideas."
- Composed = "the whole Stellar ecosystem like a box of Lego blocks … not about who writes the best code … who is best at using these Lego blocks … we don't want you reinventing the wheel … less code, more thinking ahead." Examples they gave: XOXNO lending SDK, USDT0, Spectra, LayerZero, tokenized stocks (the captions say "Robinhood stocks via 'Sodexo'"; the project name is garbled and **[UNVERIFIED]**).

### Rubric [V] (/build and /faq agree): each criterion scored 1–5
| Criterion | Weight |
|---|---|
| Track Alignment (Genesis: "fit with Stellar Unlocked and/or Stellar Composed") | 20% |
| User Value & Problem | 20% |
| Technical Execution | 15% |
| Innovation | 15% |
| Hackathon Progress | 10% |
| Market & Ecosystem Potential | 10% |
| Product Design & UX | 10% |

**The stated weights are CORRECT.** Additional verified items the brief left out:
- "Genesis is judged as Idea → MVP" on four focus areas: **Problem clarity, MVP quality, Stellar integration, Continued development potential.** [V]
- "Judging priority order: **Adoption → Discovery → Continuation**." [V] The site **does not define** these terms anywhere (checked /build, /faq, /schedule, /terms). My reading [A]: *Adoption* = would real users use it, and does it bring users or volume to Stellar; *Discovery* = does it show a new use of Stellar or a new primitive; *Continuation* = will the team keep building after the event (SCF, Drips Wave, post-hack pathways). Support for this reading: the judges said the program is about "retaining developers", and "most of our hackathon winners are … builders that are ready to take the next step" [V-verbal]. The schedule has a "Pathways Post Hackathon" talk (Drips, GrantFox) at 12:05 Mon [V].
- Official submission checklist [V], quoted verbatim:
  - "Does your project use Stellar meaningfully, and can you demonstrate it?"
  - "Does your core feature work, and **can judges test it**?"
  - "What makes your approach different from existing solutions?"
  - "Can you clearly demonstrate what you built or improved during the event?"
  - "Build a focused solution that works, make its value clear, and show judges why it matters."

### Prizes [V] / [V-verbal]
- "$30,000 in prizes across the Genesis and Scale paths. The final breakdown is announced before the event." [V /faq]. No breakdown is published on the site. **[UNVERIFIED]**: check the portal or Discord.
- Kaan (SDF): "$30,000 worth of Stellar [XLM] across **six winners**." [V-verbal]. That is roughly 3 Genesis and 3 Scale winners [S]; it could also be split per track. HackMeridian 2025 gave 1st–3rd in each of two tracks [V, Scout].
- **Genesis competes for about 3 slots.** We cannot dilute the entry: there is no honourable-mention economics.

### Eligibility (critical) [V-verbal]
- Judge (Wlad, SDF): "If you have prior work on your project, if your project [is] already participating in another hackathon, if you have worked a few days before on this project, you should go for **Scale**." Genesis = built from scratch during the event.
- Scale advice: "Don't build it ahead of time. That's not fair."
- Our repo's commits all fall on 2026-10-25 after 10:00 Lisbon (scaffold only) → OK. **Do not import pre-existing personal code**; the judges read the repo history.
- In person only; teams of up to 5; 18+ [V /faq, /terms].
- AI use: "Yes. Tools like Claude Code, Cursor, and other AI copilots and agents are welcome." [V /faq]. But the judges added: "There's a huge difference between a person that says 'build this project, make no mistakes' and a person that knows how to leverage AI … we want to look at your repository." [V-verbal]

### Judges [V] https://www.hackmeridian.com/build/mentors
The page lists "Mentors & judges" together and does not say who judges. It includes SDF: Nicole Adair (Head of DevRel), Alex Cordeiro (VP Eng), Justin (VP Ecosystem), Nick Gilbert (VP Product), Tori Samples (Dir. Product), **Tyler van der Hoeven (Director, Frontier Lab)**, **Garand Tyson (Protocol eng)**, Jane Wang (RWA product lead), Kelly Hendricks (Enterprise PM), Kaan Kaçar, ElliotFriend, Wlad Mendes, Bri (DevRel). Partners: The Aha Company (Scaffold Stellar), Drips, GrantFox, 57Blocks, Etherfuse, XOXNO, Altana, ROZO, Lumen Loop, Stellarlight. Kaan, Wlad and Elliot said on the 10/22 call that they are judges [V-verbal]. Implication [A]: a protocol-literate panel will spot shallow "Stellar-washing" and will reward real use of primitives.

### Timeline [V] /build, /schedule, /faq
- Hacking 09:00 Sun → **12:00 Mon 26 Oct, "No late submissions."** Judging 13:00–14:45; deliberation 14:45–15:30; closing 15:30. Finalists pitch live Wed 28 Oct 13:50 at Meridian ("VC finale").
- ⚠ **DST trap [V-fact]:** Portugal leaves summer time on Sun 25 Oct 2026, so Lisbon is now WET (UTC+0). The 12:00 deadline is 12:00 UTC. This dev machine's git timestamps show +0100, so local clocks may be on CET. **Set all deadline alarms in Lisbon time.**

## 2. Deliverables & constraints
| Item | Status |
|---|---|
| Demo video | Required [V]. **Length limit: not published** [UNVERIFIED]. Stellar Hacks precedent: "two-to-three-minute demo video (talking heads optional)" [V-summary, Lumenloop AV: Real-World ZK Q&A]. **Target ≤3 min.** |
| Pitch deck | Required [V]. No format or length published [UNVERIFIED]. |
| GitHub repo | Required [V]. "A clear README that shows how your project works, including its specs, does most of the work for judges." [V]. Must be public (Stellar Hacks precedent: "repository set to public (not private), demo videos unlisted or public (not private)" and "READMEs that accurately reflect your actual code, with clear callouts of any mock data") [V-summary, Lumenloop AV "Submission Day Prep: ZK Hackathon", 2026-07-02]. |
| Submission answers | Required [V]. Questions are in the portal (app.hackmeridian.com), not public [UNVERIFIED]. **Someone must open the portal today** to read the questions and any prize breakdown. |
| Deployed contract / testnet vs mainnet | **Not specified** [V: absent]. Testnet appears acceptable [A]. Mainnet is not required, but the Composed copy praises "real infrastructure that keeps running long after demo day." |
| Testability | "Can judges test it?" [V]. Judges "literally just use the product" [V-verbal]. ⇒ a **hosted frontend URL + testnet contract IDs** in the README is close to mandatory [A]. |
| IP | "You own what you build." Licence granted to organisers for promotion [V /terms]. |

## 3. Competitive landscape & oversaturated categories

**Data:** Scout dataset (via Raven) of **1,356 indexed DoraHacks Stellar hackathon builds** plus curated events. Counts come from hybrid lexical search: they are indicative, not exact, and themed hackathons (ZK ×2, Agents) inflate some categories. Format: `matches / prize winners`.

| Category | Builds / winners | Verdict |
|---|---|---|
| AI agents / x402 / MPP | agent 258/8, x402 133/3 | **Most saturated.** A dedicated 591-hacker "Stellar Hacks: Agents" event already crowned Cards402, RenderGate, x402-MCP template and TollPay ("Stripe for MCP"). Judge Kaan *wants* agents but "rather than a similar project over and over again." The bar is very high. |
| ZK / privacy | zero-knowledge 218/4, privacy 102/1 | Saturated by 2 ZK hackathons (678 hackers). Winners: Wraith (ZK privacy), AnchorShield (ZK KYC), Umbra (confidential wallet), zkProofOfReserve, Tukar (private remittance), Olio (confidential USDC, APAC 1st). "Private payroll/remittance" is **taken**. |
| Lending / microfinance / credit | 79/9 | Crowded. Note XOXNO and Blend exist, so compose with them rather than rebuild. |
| Stablecoin payments / remittance / payroll | stablecoin 126/9, payroll 24/2, remittance 17/2 | The "default Stellar idea." Needs a sharp, narrow user. |
| Escrow / freelance marketplace | escrow 34/**0**, freelance 18/1 | Trap: zero escrow winners, and Trustless Work (a listed HackMeridian **Partner**) already sells escrow infra. Rebuilding escrow = "reinventing the wheel." |
| NFT marketplace | 35/1 | Dead category unless off-the-wall. |
| DAO / voting | DAO 14/0, voting 10/0 | Zero winners. |
| Carbon / ReFi | 9/0 | Zero winners. |
| Crowdfunding / donation / charity | ~14/0 | Zero winners. |
| Credentials / identity (non-ZK) | credential 19/0 | Zero winners outside ZK. |
| Savings / ROSCA / tandas | 12/1 | Common LATAM idea. |
| Prediction markets | 17/2 | Moderate. |
| Games | 80/3 | Many entries. Winners are ones that use a protocol primitive (verifiable randomness, ZK). |
| Anchors / SEP cash-out | 27/**5** (~18% win rate) | **Under-built and over-rewarded** relative to volume [S on causality]. |
| Passkey / smart wallet | 15/2 | Moderate; real dependency surface. |
| DEX / path payments | 69/9 | Many winners are DeFi-tooling projects (Blend Pool Creator etc.) in sponsor-themed hacks. |
| Multisig/shared accounts, loyalty, SMS, agriculture, gig/refugee, inheritance | 0–4 each | Whitespace, but low volume can also mean low judge interest [S]. |

**AI-convergence risk (most important for this committee) [V-verbal]:** Elliot (SDF judge): "Take the ideas that Raven or Claude or any agent puts out there with a grain of salt because **everybody else in the room is also asking the same question to the same agents. And we often see many very similar entries.**" Wlad: "Don't ask Raven what should I build … bring your own seed." Kaan: "When you want to have something that has a human component in it, it shows." **Every idea this committee generates via Raven/Claude should be assumed to have 2–5 twins in the room** unless it rests on a specific human insight, domain or user.

## 4. Past winners / what wins (evidence)
- **HackMeridian 2025** (curated; winners only on record) [V Scout]: Composability: 1 Lance (dispute resolution), 2 Star Lends, 3 Panorama Block. Open Innovation: 1 The Simple Fund (receivables fund liquidity), 2 4Bridge, 3 Stellar Forge. The two 1st-place winners were real-finance projects with continuation: both later reappeared at Stellar Hack+ Buenos Aires 2025 (Lance as a *Scale* entry). **Continuation is rewarded.**
- **Stellar Hack+ Buenos Aires 2025** used the same Genesis/Scale split [V Scout]. Its Genesis criteria were "Technical implementation … System design … Use of Stellar tools: effective and meaningful application … Relevance: alignment with real user needs … Scalability potential." Judges "value clean architecture, thoughtful engineering, and clear documentation."
- **Stellar Hacks: Agents (Mar–Apr 2026)**: 1 Cards402 (agent wallets + real Visa card issuance), 2 CleverCon, 3 RenderGate, 4 x402-MCP template, 5 TollPay. Pattern: **a real-world rail at the end** (Visa card, paid API).
- **Stellar Hacks: Real-World ZK (Jun 2026)**: 1 Wraith, 2 AnchorShield, 3 Umbra, 4 zkProofOfReserve, 5 Tukar. Pattern: ZK applied to a **regulated-finance pain point** (KYC, solvency, compliance), not ZK for its own sake.
- **Scaffold Stellar hackathon (Oct 2025)**: 1 Splicers (NFT battles from verifiable randomness, a weird but protocol-native game). Elliot cited "this NFT generator … bonkers off-the-wall … implemented really well" as the most memorable kind of entry [V-verbal].
- **Build Better (Mar 2025)**: 1 PayZoll (payroll), 3 Soroban→MCP server.
- **APAC 2026**: Payments & Consumer track 1st = Olio (confidential USDC payments).
- **Mexico (Alebrije, Mar 2026)** winners: GIBBOR (hardware evidence proofs), MañanaSeguro (retirement savings for informal workers). This is the event where Kaan saw "10-plus features … only one worked."

**What judges said they reward** [V-verbal, 10/22 call]:
1. "Prioritize delivering a great proof of concept or demo instead of creating a whole product … We don't want to see a bunch of pages where you can register, recover your password … **We want to see a real novelty.**"
2. "Delete all of the things that are not working 100% … build something that you can justify as if you were an attorney in a courtroom."
3. UX "almost as important as its technical execution … think of judges as just beta testers … they like to see a project that just works and looks adequate."
4. Narrative and thesis: "Why you are building this product and who it helps … who asked for this product … builders that are ready to take the next step."
5. Wlad: "a project that **my mom can understand and use** … not just another DeFi complex product … made for the next billion users."
6. Elliot: "the off-the-wall kind of weird ones … human creativity … something you've put your fingerprints on."
7. Kaan: "creative things with AI agents … rather than a similar project over and over again."

## 5. Technical traps (team new to Soroban, ~15 build hours)
Live network check (13:00 today) [V via RPC `getVersionInfo` and Horizon]: **testnet and mainnet both run protocol 29**; testnet RPC/core build is 30.0.0. Repo: `soroban-sdk = "28"`, stellar CLI 28.1.0, `@stellar/stellar-sdk ^17.3.0` (17.4.0 latest), `freighter-api 6.0.1`. Older-SDK contracts run fine on P29 [A, standard backward compatibility], but anything P29-specific is not available with SDK 28. A Protocol 30 testnet vote is set for Nov 3 [V-summary, Lumenloop weekly roundup 2026-10-24], after the deadline, so there is no upgrade risk during judging.

| # | Trap | Evidence | Severity |
|---|---|---|---|
| T1 | **USDT0 has no testnet deployment; NEAR Intents can't be rehearsed on testnet** (real market makers). Any Composed idea that needs these is mainnet-with-real-money or nothing. | [V] Raven skill `stellar-dev.cross-chain` pitfalls: "USDT0 publishes no testnet deployment … NEAR Intents is filled by real market makers" | **Kill-level for a 15h build** |
| T2 | Cross-chain (CCTP/Axelar/LayerZero) is async (CCTP attestation "seconds to ~15 minutes"), has decimal mismatches (USDC 7 on Stellar vs 6 elsewhere; OFT silently drops dust), needs trustlines, and "mistakes are frequently unrecoverable." It needs two chains' tooling. | [V] same skill | High |
| T3 | **Confidential Tokens maturity conflict.** The judges said on 10/22 they were "released today on mainnet." The official docs page says "developer preview", the demo is "Testnet only", and "The current verifier accepts only non-zero-knowledge UltraHonk proofs" so OZ does not guarantee privacy. Claiming "private" balances on stage is a credibility risk. | [V] https://developers.stellar.org/docs/build/apps/privacy vs [V-verbal] | High (claims) |
| T4 | **Stellar Private Payments is testnet-only, unaudited**, and its JS SDK is alpha. | [V] privacy docs; /build page | Medium (fine for a demo; say so in the README) |
| T5 | ZK toolchains: the circuit/verifier curve mismatch (snarkjs default bn128 vs a BLS12-381 verifier) fails silently. Noir/UltraHonk needs P26+ and Nethermind's verifier. Teams forget to bind public inputs to the action (replay) or skip the nullifier set. Trusted setup takes time. Circuit work for a Soroban newcomer can easily eat 8+ hours. | [V] Raven skill `stellar-dev.zk-proofs` pitfalls | High for newcomers |
| T6 | Passkey smart wallets depend on **an OZ Channels relayer** (API key from channels.openzeppelin.com) **plus Mercury's hosted indexer**. Troubleshooting docs list 401/403 relayer keys, an indexer lag of "a few ledgers", and wallets lost across browser profiles. Two third-party dependencies sit inside the demo path. | [V] https://developers.stellar.org/docs/build/apps/guestbook/passkeys-prerequisites | Medium–High |
| T7 | x402/MPP: Circle's testnet USDC faucet is captcha-only (cannot be scripted). Both payer and recipient need USDC trustlines. Two USDC addresses (G… issuer vs C… SAC) are "a common stumble." Facilitator auth varies. | [V] Raven skill `stellar-dev.agentic-payments` | Medium |
| T8 | **Testnet resets** wipe accounts and contracts; they are announced on the status page. None is known to fall inside the judging window [A]. Keep a one-command redeploy + seed script anyway. | [V] https://developers.stellar.org/docs/tools/developer-tools/network-status | Low now / must script |
| T9 | **State archival / TTL**: temporary entries are deleted on TTL expiry and persistent/instance entries archive. A demo that works Monday can fail Wednesday (finalist pitch), or later when judges test async, if TTLs are short. | [V] https://developers.stellar.org/docs/build/guides/storage/choosing-the-right-storage | Medium; extend TTLs |
| T10 | Platform limits: `#![no_std]`, 128KB wasm, `Symbol` ≤32 chars, no floats, no I/O or clock beyond the ledger. Newcomers lose hours fighting no_std and float math. | [V] Raven skill `stellar-dev.smart-contracts` | Medium |
| T11 | Freighter UX: must handle not-installed, user-rejected, wrong network, unfunded account and insufficient XLM. Judges may not have Freighter on testnet, so **ship a "demo mode" keypair path or passkeys**. Otherwise "can judges test it?" fails. | [V] Raven skill `stellar-dev.dapp` UX checklist; [A] judge setup | High for the UX score |
| T12 | Anchors: real SEP-24 cash-out depends on a third-party anchor's KYC/web UI. Only the SDF test anchor (testanchor.stellar.org) is realistic for a demo, and it is mock money [A from prior knowledge, not re-verified today]. "To the bank" will be simulated, so it must be labelled. | [A] | Medium |
| T13 | Oracles (Reflector, Pyth on Stellar launched Sep 2026 [V-summary]): testnet feed coverage and staleness are unknown [UNVERIFIED]. | — | Medium |
| T14 | AI over-scoping: "AI agents … over code … create scopes you haven't even thought of." | [V-verbal] Kaan | High (process) |
| T15 | Repo hygiene: judges read the repo and the README "before running anything." Secrets in the repo, mock data presented as real, or a README that doesn't match the code will hurt. | [V-verbal] + [V-summary] | Medium |

**Rule of thumb [A]:** each external dependency in the critical demo path (relayer, indexer, facilitator, anchor, oracle, bridge, second chain) costs about 2–4 hours of unknown-unknowns for a Soroban-new team. **Allow at most 2 in the critical path.**

## 6. Scoring guide (1 / 3 / 5 per criterion, this event)
Weighted total = Σ(weight × score) / 5 × 100. Moving one 20% criterion from 3 to 5 is worth +8 points, the same as moving **two** 10% criteria from 3 to 5.

| Criterion (wt) | 1 = | 3 = | 5 = |
|---|---|---|---|
| **Track Alignment (20%)** | Stellar is a database or a payment rail any chain could provide. No named protocol primitive (Unlocked) or no second real ecosystem project (Composed). | One real primitive or integration, but the idea would mostly work without it. Composed "integration" is a mocked API call. | Unlocked: the product **only exists because of** a specific Stellar capability (named host fn, SAC/trustline/DEX/path-payment trick, new primitive) and the demo visibly exercises it. Composed: ≥2 live ecosystem projects, called for real, doing something neither does alone. A judge could say "this used to not be possible." |
| **User Value & Problem (20%)** | Generic persona ("the unbanked", "creators"), invented pain. | Plausible user with a real pain, but the "why blockchain/why Stellar" is weak or the problem is broad. | A specific person with a specific, costly, verifiable pain ("my mom can understand and use"). The thesis states "who asked for this." Ideally backed by one data point or a quote from a real user. |
| **Technical Execution (15%)** | Doesn't run, mostly mocked, contract not deployed. | Core flow works on testnet with rough edges. Some mocks, clearly labelled. Basic tests. | Core feature works end to end on testnet from a hosted URL. Contract tests pass in CI. The README has contract IDs, architecture and a run-locally guide. Judges can reproduce it in under 5 minutes. |
| **Innovation (15%)** | One of the oversaturated categories in §3 with no twist. An obvious AI-generated idea. | Known category with a real twist (new user, new primitive, new composition). | Judges haven't seen it before at a Stellar hackathon (Scout prior-art check is clean), or it's an "off-the-wall" idea executed well. A human fingerprint. |
| **Hackathon Progress (10%)** | Can't tell what was built at the event, or there is pre-existing code. | Commits show steady progress; scope partly delivered. | Clean commit history inside the window. The demo states exactly what was built in 27 hours vs what is next. Scope was cut deliberately, not abandoned. |
| **Market & Ecosystem Potential (10%)** | No path beyond the demo. | Plausible market; vague next steps. | A named first customer segment, a credible go-to-market, and a clear Stellar ecosystem benefit (volume, users, new asset/anchor demand). Next steps: SCF/Drips/partner integration. Team intent to continue (Continuation!). |
| **Product Design & UX (10%)** | Wallet errors, jargon, raw XDR, no loading states. | Usable, but a judge needs instructions or Freighter setup. | A non-crypto judge completes the core flow unaided: no seed phrase, fees handled, clear states. "Looks adequate" and is polished on one flow only. |

**Genesis "focus areas" cross-check [V]:** Problem clarity → UV&P; MVP quality → TE + UX; Stellar integration → TA; Continued development potential → MEP + priority "Continuation."

## 7. Kill criteria / red flags
**KILL (reject the idea outright):**
1. The critical demo path needs **USDT0, NEAR Intents, or real mainnet funds** to show the core value (T1).
2. Needs **>2 external third-party services** in the critical path, or a second chain's toolchain, with no mock fallback (T2, T6, T12).
3. The core value depends on **writing a novel ZK circuit from scratch** with no team member who has shipped a circuit before (T5). Using a ready verifier or SPP is acceptable.
4. **Unlocked-track idea whose Stellar usage is just "store data in a contract"** or "send XLM." That scores TA ≤2, which caps the total at roughly 70%.
5. Squarely inside a **zero-winner saturated category** (escrow marketplace, DAO voting, NFT marketplace, carbon credits, donation/crowdfunding, generic credentials) with no protocol-native twist.
6. **Rebuilds a partner's product** (escrow ⇒ Trustless Work; lending ⇒ Blend/XOXNO; vaults ⇒ DeFindex) instead of composing with it. Judges literally said "don't reinvent the wheel."
7. Requires prior code, or would be "a few days of work before," which breaks Genesis eligibility.

**HEAVY PENALTY:**
- Idea is the first thing Claude/Raven suggests for "Stellar hackathon idea" (AI twin risk). Test: if two of our four agents independently proposed something similar, others in the room have too.
- "Private"/"confidential" claims on Confidential Tokens without disclosing the non-ZK verifier caveat (T3).
- Feature list longer than 3, or more than one "hero flow."
- Needs a judge to install Freighter, switch to testnet, friendbot and add trustlines before seeing value.
- Generic AI-agent-pays-for-API (x402) without a twist. A 591-hacker event already mined it.
- "For the unbanked / LATAM / Africa" with no specific user or channel.
- B2B infrastructure with no visible end user (fails "my mom" and is hard to demo in 3 minutes), unless it is a developer tool with an obvious "wow".

## 8. What a winning demo video must show (≤3 min target)
1. **0:00–0:20 — The person and the pain.** One named user, one sentence, one number. No crypto words.
2. **0:20–1:50 — Live product, one hero flow, end to end**, on a hosted URL, in a real browser. Show the testnet transaction landing (an explorer link flash). No slides during this part.
3. **The "only on Stellar" moment** explicitly called out on screen (e.g. "this is a path payment through the SDEX converting X→Y atomically", "this proof is verified by the BN254 host function", "this calls Blend + DeFindex in one tx"). This is worth 20% of the score.
4. **What we built in 27 hours** (architecture diagram, 10 seconds) vs what's mocked, stated honestly.
5. **Why it continues:** first customers, next milestone, ecosystem fit (SCF/partner).
6. Audio is clear, a captioned voice-over is fine, and there's no dead air. The video is unlisted/public, not private, and the repo is public.

Supporting artifacts: README (problem, demo URL, video link, contract IDs, architecture, run steps, what's mocked, team), a 6–8 slide deck mirroring the video, and submission answers that reuse the same words. Submit a full draft by **~09:00 Mon** and iterate (Stellar Hacks judges' advice: "submit early and iterate") [V-summary].

## 9. Sources
- HackMeridian Build: https://www.hackmeridian.com/build (fetched 2026-10-25)
- FAQ: https://www.hackmeridian.com/faq
- Schedule: https://www.hackmeridian.com/schedule
- Terms (eligibility, IP): https://www.hackmeridian.com/terms.html
- Mentors & judges: https://www.hackmeridian.com/build/mentors
- **Judging Insights video** (Stellar Developers Meeting 10/22/2026; transcript pulled from YouTube auto-captions): https://www.youtube.com/watch?v=oR-7PZwBevo
- Privacy on Stellar (Confidential Tokens / SPP status): https://developers.stellar.org/docs/build/apps/privacy
- Passkeys prerequisites (relayer + indexer): https://developers.stellar.org/docs/build/apps/guestbook/passkeys-prerequisites
- Storage/TTL: https://developers.stellar.org/docs/build/guides/storage/choosing-the-right-storage
- Network status (testnet resets): https://developers.stellar.org/docs/tools/developer-tools/network-status
- Raven skills: `stellar-dev.cross-chain`, `stellar-dev.agentic-payments`, `stellar-dev.zk-proofs`, `stellar-dev.smart-contracts`, `stellar-dev.dapp` (via raven.stellar.org MCP)
- Scout hackathon dataset (stellarlight.xyz/hackathons): slugs hackmeridian-2025, stellarhack, stellar-hacks-zk, stellar-agents-x402-stripe-mpp, scaffoldstellar, build-on-stellar, apac-stellar-hackathon-2026, stellar-hacks-zk-gaming, alebrije2026, stellar-hacks-kale-reflector, stellar-hacks-blend. Build counts from scout.searchHackathonBuilds (1,356 indexed builds, hybrid match).
- Lumenloop AV summaries: "Submission Day Prep: ZK Hackathon" https://x.com/i/spaces/1nxnRRvWbkwxO ; "Stellar Hacks: Real-World ZK Q&A" https://x.com/i/spaces/1AGRnnLddNyGl ; "Builder's Journey: Ash Francis" https://x.com/i/spaces/1mxPaLzPqODKN
- Live network: soroban-testnet.stellar.org / horizon-testnet.stellar.org `getVersionInfo` (protocol 29), queried 2026-10-25 ~13:00.
- UNVERIFIED: video length limit, deck format, submission questions, per-place prize breakdown (check the portal app.hackmeridian.com and Discord).
