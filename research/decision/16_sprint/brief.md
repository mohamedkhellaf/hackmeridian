# Uniqueness sprint brief

## Situation

- **Event:** HackMeridian 2026, Lisbon. Stellar blockchain, Genesis category (new idea → working MVP).
- **Deadline:** Mon 2026-10-26 12:00 Lisbon. Now: Sun ~14:20.
- **Team:** 3 developers new to Stellar, plus an AI coding assistant that writes most of the code. Roughly 15 hours of focused build time.
- **Judging** is async, on video, deck, repo and written answers. Weights:

  | Criterion | Weight |
  |---|---|
  | Track Alignment | 20 |
  | User Value & Problem | 20 |
  | Technical Execution | 15 |
  | Innovation | 15 |
  | Progress | 10 |
  | Market & Ecosystem | 10 |
  | UX | 10 |

- **Tracks:**
  - "Stellar Unlocked": novel use of Stellar's protocol capabilities. The organizers' written prompt includes: "old-school assets, new tricks: built-in asset issuance, the DEX, or path payments applied to unexpected uses".
  - "Stellar Composed": combining at least two Stellar ecosystem tools.
- **What judges have said:** they expect many similar AI-generated entries, and they explicitly reward ideas with a real "human seed".

## What the team really has (real human seeds, not fiction)

- **A family member who was targeted by a "Hi Mum / Olá mãe" impersonation scam.** "New phone, send money urgently." In Portugal these scams are typically paid by bank transfer or MB Way; police logged 260 complaints in January 2024 alone.
- **A real connection to a group of small businesses that owe each other money.** Portuguese SMEs suffer chronic late payment: about 60% delay paying suppliers because their own customers pay late.
- **They are in Lisbon.** Possible context: tourism and short-term rentals, Erasmus students, digital nomads, a large Brazilian and PALOP diaspora (Angola, Cape Verde, Mozambique, Guinea-Bissau), MB Way culture, cafés and small shops, festivals, the housing crisis.

## BANNED: do NOT propose these or thin variations of them

Fresh AIs already produce these when asked for Stellar hackathon ideas, so they will have twins:

- **Payments and wallets:**
  - undo/cooling-off payments via claimable balances
  - guardian or scam-safe wallets
  - social recovery
  - inheritance or dead man's switches
  - passkey, gasless or zero-XLM onboarding
  - cash links / pay-by-link
- **AI agents:** agent wallets with spend limits, x402 / pay-per-call APIs
- **Remittances:** routers, anchor cash-out apps, earmarked bill-pay
- **Group money:**
  - savings circles / ROSCAs
  - split-bill or group travel pots
  - local, community or demurrage currencies
  - loyalty-point swaps
- **Wages:** streaming payroll / earned-wage access
- **Escrow of any kind:** freelance milestones, rent or security deposits, reservation no-shows, prize pools, bounties, lost & found, reusable-cup deposits, accessibility bonds
- **Events and funding:**
  - tickets / anti-scalping / threshold tickets
  - crowdfunding, quadratic funding or assurance contracts
  - commitment contracts
- **Invoices and credit:** circular debt netting, invoice factoring/tokenization, income-share tokens, muxed-address invoicing
- **Other:**
  - ZK private payroll or donations
  - aid vouchers / disbursement
  - subscription spending limits
  - RWA tokenization, carbon credits, DAO voting, NFT receipts or warranties

## What we want

**4 ideas** that:

1. Solve a **real, evidence-backed problem** for a **specific user** connected to the seed you were given. Use quick web searches to find real evidence: statistics, news, regulations. Never invent evidence.
2. Make Stellar **essential**, not decorative, ideally by using a protocol feature in an unexpected way. Possibilities include:
   - asset issuance and authorization flags (AUTH_REQUIRED, revocable, clawback)
   - trustlines
   - the built-in DEX, liquidity pools, path payments
   - claimable balances
   - multisig thresholds and weights
   - pre-authorized transaction signers, hash(x) signers
   - transaction preconditions (time bounds, min sequence age)
   - sponsored reserves, fee-bump
   - muxed accounts, SEP-7 payment URIs, memos
   - Soroban contracts

   Check any protocol claim against developers.stellar.org if unsure.
3. Would **NOT** come out of an AI if a team just asked "give us unique Stellar hackathon ideas". Explain why yours wouldn't.
4. Are **buildable** as a working testnet demo by tomorrow morning.
5. Have **one memorable demo moment** a judge will remember.

For each idea give:
- a one-sentence hook
- the specific user
- the problem, with evidence (links)
- the Stellar mechanism, with the exact features used
- why it's not an AI-default idea
- the 90-second demo, including the memorable moment
- buildability risks
- the biggest weakness

Then name **your single best idea** and why.

Be ruthless. Weird is not the same as unique, and a clever mechanism with no real user is worthless. Time-box: 20 minutes.
