# Agent 1 — Problem Hunter: four candidate concepts

Prepared Sun 2026-10-25, ~13:00 Lisbon (blind phase). Domains: **gaming/competitions**, **housing**, **community events**, **education/migration**.

Prior-art checks were run with the Stellar Raven MCP (Scout directory and DoraHacks hackathon-build search, observed 2026-10-25T12:55–12:57Z). A "no hit" result shows the space is open, but it doesn't prove nobody has built it.

Crowded lanes I checked and **deliberately avoided**:
- **x402 / agent pay-per-call:** at least 6 builds from "Stellar Hacks: Agents", plus Rail402, TollPay and an x402 MCP template, all live.
- **ROSCA / savings circles:** Chancha+, Sharibo.
- **Crowdfunding:** KindFi, Juntta, Bimex, NovaFund and others.
- **Generic remittance / bill-pay:** Smilepay, PayQin.

My personal ranking (to be debated): **PH-1 > PH-2 > PH-3 > PH-4**.

---

## PH-1: PrizeLock: verifiable, pre-funded prize pools for esports & online competitions

- **Target user**
  - Primary: tier-2/tier-3 esports players and teams in emerging scenes (CS2, Dota, mobile titles; Kenya, Brazil, Mongolia, MENA). They compete for prizes they cannot verify exist and often wait months to be paid.
  - Secondary (the payer): small and mid-size tournament organizers (TOs) and hackathon/competition organizers. They want to prove credibility to attract teams and sponsors.
- **Problem**
  - Organizers announce prize pools they often don't hold yet. These depend on sponsor money arriving later. When the sponsor pays late, or the organizer goes bust, winners don't get paid. This keeps happening:
    - **YaLLa Esports** (CS2) filed for bankruptcy in Aug 2025. HLTV estimates about **$700k of prize money unpaid** across 8 YaLLa Compass events. The MongolZ were reported still waiting on **$200k**. ~$160k in staff salaries and >$35k to casters/talent were also reported unpaid. *(Verified as reported by esports.gg / esports.net; the outlets give different figures.)*
    - **Galaxy Racer's $100K HER Apex Legends Open:** winners were unpaid ~9 months later. GXR missed the **180-day payout deadline** in the player contracts. *(Verified, Substack report.)*
    - **Valve sued GESC** (Dota 2 Minors) in 2019 over missing prize and talent payments. *(Verified, TheGamer.)*
    - **Kenyan players** demanded unpaid winnings; the organizer blamed sponsorship issues. *(Verified, citizen.digital.)*
    - Further reported cases: Gamers First, WSVG (owed $32k), MESA (~$200k claimed).
  - Even when the money exists, cross-border payout to players in many countries is slow and costly. Wires, PayPal availability and FX are the usual obstacles. *(Assumption; common knowledge, not quantified here.)*
  - Why existing infrastructure fails: a bank escrow per tournament is too heavy for a $5k online cup. Players can't see a TO's bank balance. And a contract clause like "180-day payout" means nothing once the TO is insolvent.
- **Proposed solution (MVP)**
  - A TO creates a tournament and deposits the prize pool (USDC) into a Soroban contract **before registration opens**.
  - Sponsors can top up the pool directly into the contract.
  - The public tournament page shows a "✅ Prize pool locked: $X" badge that links to the on-chain contract. The badge is the product: teams pick the tournaments that carry it.
  - The payout split (1st 50%, 2nd 30%, 3rd 20%) is fixed in the contract at creation.
  - After the final, the TO and an independent referee/admin (2-of-2 or 2-of-3 signers) submit the standings. The contract then pays winners immediately.
  - Safety valve: if results aren't posted by a deadline, registered teams can trigger a pro-rata refund/split. The TO cannot reclaim the money unilaterally, ever.
  - Winners receive USDC to a wallet and can cash out locally through an anchor. This is a stretch goal and only shown in the demo.
- **Stellar integration**
  - Soroban escrow contract holding a SAC-wrapped USDC.
  - Multi-party result attestation. Use Soroban `require_auth` for several signers; native Stellar multisig on the TO account is an alternative.
  - Low fees make per-player payouts of a few dollars viable.
  - Stretch: path payments or SEP-24 anchor off-ramp so winners get local currency. The Scout directory lists Kenyan, Philippine and LATAM anchors (e.g., HoneyCoin, Coins PH), but I haven't checked their testnet availability.
  - **Why blockchain is necessary:** the whole value is a **credible commitment that the organizer can't revoke and anyone can audit**. That is exactly what a public ledger plus a contract gives. A bank account can't do it publicly, cheaply and for every small tournament.
- **Track fit:** **Unlocked**, because the core is protocol-level escrow and multi-signer settlement. It becomes **Composed** if we add an anchor off-ramp or a passkey wallet for players.
- **Differentiation**
  - Players are effectively being asked to trust sponsor-dependent promises today. Some publishers back official circuits (Valve's own rules), but grassroots events have nothing comparable.
  - Prior-art search on Stellar ("esports tournament prize pool", "prize payout escrow winners") found **no direct match**. Generic escrow exists (Trustless Work), but nothing is positioned around verifiable prize pools.
  - On other chains: Web3 gaming platforms run on-chain tournaments. *(UNVERIFIED: I didn't find a specific competitor to cite in the time-box.)*
- **Demo (90 s)**
  1. A TO creates "Lisbon CS2 Open, $3,000" and deposits USDC from Freighter.
  2. The tournament page flips to the "Prize pool locked" badge, with a Stellar Expert link.
  3. A sponsor tops up $500 and the badge updates.
  4. Teams register.
  5. The referee and TO sign the final standings.
  6. Three winners' balances update within seconds.
  7. Cut to the alternate path: the deadline passes with no results, and teams trigger an automatic refund.
  8. Close on a headline: "$700k unpaid at YaLLa. This can't happen with PrizeLock."
- **Willingness to pay / adoption path**
  - TOs pay a small fee (e.g., 1–2% of the pool) for the badge. The badge is a credibility signal that helps a newer TO attract teams and sponsors.
  - Sponsors benefit from transparent proof that funds reached players.
  - Adoption could start with the hackathon world itself, since hackathon prize payouts face the same problem (note for the deck).
  - Go-to-market: Discord-based community TOs and start.gg-style bracket ecosystems. A start.gg integration is speculative.
- **15-hour feasibility**
  - High. The contract is small: create, fund, attest, distribute, refund-after-deadline. Use the token interface plus tests.
  - The frontend has three screens: create/fund, public page, admin results.
  - The anchor off-ramp is a stretch goal and can be mocked or shown as a link.
- **Biggest uncertainty:** whether TOs will *voluntarily* lock cash up front. Many depend on sponsor money arriving later. Mitigation: support partial locking ("$2k of $3k locked") so the badge shows honest coverage.
- **Evidence labels**
  - Verified: YaLLa ~$700k prize debt and bankruptcy (esports.gg, esports.net); GXR 180-day missed payout (Substack); Valve v. GESC (TheGamer); Kenyan unpaid winnings (citizen.digital); no matching Stellar prior art in Scout (search observed 2026-10-25).
  - Assumption: cross-border payout friction for players; TOs would pay a fee for the badge.
  - Speculation: start.gg integration; size of tier-2/3 TO market.

---

## PH-2: Caução: a neutral, yield-bearing rental deposit vault for countries with no deposit protection (starting with Portugal)

- **Target user:** international students, young professionals and expats renting in Lisbon/Porto. Many pay 1–2 months' deposit (often €1,500–€3,000) to a landlord they've never met, sometimes before even seeing the flat. Secondary user: small landlords who want to look trustworthy in a scam-heavy market.
- **Problem**
  - **Deposit rules.** Portugal caps deposits at **2 months' rent** (Civil Code art. 1076, amended by Law 24-D/2022 and reinforced by Mais Habitação, Law 56/2023). That much is verified from secondary legal summaries. What's missing is any **third-party custody**: the landlord simply holds the money.
  - **No return deadline.** Portuguese law sets **no fixed statutory deadline** for returning the deposit; 30 days is only market practice. *(Verified, Landager.)*
  - **Contrast with England & Wales.** Deposits there must be protected in government-approved schemes (TDS custodial/insured), with free adjudication: 31,276 adjudications in 2021–22, and in 75% of disputes it was the tenant who raised it. *(Verified, PropertyReporter/TDS.)*
  - **Scams.** Pre-move-in deposit scams are a documented pattern in Portugal. Flatio reported ~30 cases of a fake-lease/fake-invoice deposit scam "mainly in Portugal". Students in Lisbon have been victims, and scammers clone Idealista listings. *(Verified, Flatio blog, IE Uncover, Idealista guidance.)*
  - Why existing infrastructure fails: a bank transfer to a stranger is irreversible and unprotected. Portugal has no custodial scheme, and building one needs a trusted neutral party that nobody has set up.
- **Proposed solution (MVP)**
  - **Locking the deposit.** The tenant locks the deposit (EURC or USDC) into a per-lease Soroban vault. The landlord can see it's fully funded, but **neither side can withdraw alone**.
  - **Interest.** The idle deposit is supplied to a **Blend** lending pool, and the interest accrues **to the tenant**. Today a deposit earns nothing for 1–3 years.
  - **Move-out rules modeled on UK schemes:**
    - Tenant and landlord co-sign a split, and it pays out instantly.
    - If the landlord doesn't claim deductions within N days of the lease end, the full deposit **auto-returns** to the tenant.
    - If they disagree, a pre-agreed mediator (a 3rd key) decides.
  - **Scam protection.** Before move-in, the deposit only "arms" when the tenant confirms key handover. Until then the tenant can cancel, so paying a fake landlord in advance doesn't lose the money.
- **Stellar integration**
  - Soroban vault contract with 2-of-3 decision logic (tenant / landlord / mediator) and time-based auto-release.
  - **Blend** integration for yield. Blend is a live Soroban money market per Scout; I haven't confirmed a testnet pool.
  - EURC is listed as a live asset in the Scout directory; testnet availability for EURC is unverified, and USDC is the fallback.
  - Optional: SEP-24 anchor for euro on-ramp.
  - **Why blockchain is necessary:** a neutral custodian is the missing institution in Portugal. Here a contract plays that role, and neither landlord nor platform can run off with the money. Building a regulated custodial scheme in TradFi takes legislation; this needs none to start.
- **Track fit:** **Composed** (Soroban escrow + Blend + EURC/USDC and optionally an anchor). There is an Unlocked element in the time-locked release.
- **Differentiation**
  - On Stellar there is prior art. **SafeTrust** (Stellar Hacks: Real-World ZK) does P2P escrow for hotel and vacation-rental deposits. **BeTrustless** (BeTrusty × Trustless Work, PULSO hackathon) handles security deposits. **Mica** does real-estate escrow.
  - Our sharp angle against those:
    - the tenant earns interest via Blend;
    - auto-return rules mirror UK statutory protection;
    - the anti-scam "arm on key handover" step;
    - a specific market: Portugal/Southern Europe, where custody doesn't exist.
  - Outside crypto: deposit-replacement insurance products (e.g., Flatio-style platforms) exist. *(UNVERIFIED for Portugal-specific providers.)*
- **Demo (90 s):** set up with the hook: Maria, an Erasmus student, is renting in Lisbon.
  1. She opens a link the landlord sent, sees the lease terms, and locks €1,800 with a passkey or Freighter.
  2. The landlord dashboard shows "Deposit secured, cannot be withdrawn by either party".
  3. A "12 months later" fast-forward shows the yield accrued to Maria.
  4. Move-out: the landlord proposes a €150 cleaning deduction, Maria accepts, and both get paid instantly.
  5. Alternate path: the landlord goes silent and the auto-refund fires after N days.
- **Willingness to pay / adoption path**
  - Revenue could come from a tenant fee (a few euros) or a share of the yield.
  - Better distribution goes through **student housing platforms and universities' international offices** (B2B2C). They suffer reputationally from scams.
  - Landlords adopt because a "Deposit protected" badge fills rooms faster. *(Assumption.)*
- **15-hour feasibility**
  - Medium–high. The escrow and timer logic are simple.
  - **Blend integration is the risk.** It needs a testnet pool and the right token, so mock the yield if needed.
  - The dispute and mediator flow is just one extra signature path.
- **Biggest uncertainty:** whether the landlord side will accept a deposit they can't hold themselves. Landlords like holding cash. There's also legal standing: does a smart-contract escrow satisfy art. 1076 "caução"? *(UNVERIFIED; needs a Portuguese lawyer.)*
- **Evidence labels**
  - Verified: 2-month cap and no statutory return deadline (secondary legal sources, flagged by them as needing primary confirmation); UK scheme statistics; Portugal deposit scam reports; SafeTrust, BeTrustless and Mica prior art (Scout).
  - Assumption: landlords value the badge; universities would distribute it.
  - Speculation: deposit market size in Portugal; yield levels in Blend pools for EURC/USDC.

---

## PH-3: ShowUp: refundable commitment deposits that kill no-shows at free events

- **Target user:** organizers of free community events, including meetups, hackathons, workshops, free conferences and university events. They plan catering, venue capacity and sponsor promises around RSVPs that don't show up. HackMeridian judges *are* this user.
- **Problem**
  - Free events have a **median no-show rate of ~28% vs ~17% for paid events**. Small events (10–49 people) hit **~32%**. *(Verified, Pheedloop Event Data Lab: check-in data from 1,070+ events.)*
  - The gap tracks whether money is at stake, not how hard registration is. *(Verified, Pheedloop report #06.)*
  - Basecamp case: a free event drew 84 registrations and 38 attendees. A $100 fee brought 55 registrations and **50 attendees**. *(Verified, Skift Meetings.)*
  - Why existing infrastructure fails:
    - Charging a refundable deposit by card is lossy and clunky. **Stripe keeps its processing fees when you refund**, so a €10 refundable deposit costs the organizer ~€0.4–0.6 per honest attendee. *(Fee-retention verified, Stripe support; exact € amount is an Assumption.)*
    - Card holds expire, and international attendees face FX.
    - Refunding hundreds of people is manual work.
- **Proposed solution (MVP)**
  - On RSVP, the attendee stakes a small deposit (e.g., 5 USDC) into the event's Soroban contract.
  - At the door, the organizer scans the attendee's QR code. Check-in is signed by the organizer key, and the deposit is **instantly refunded**.
  - After the event, unclaimed deposits go to a configurable pot. Options: split among attendees (Kickback-style "flakes pay the faithful"), donated to a charity, or covering pizza.
  - Onboarding needs no crypto knowledge: passkey smart wallet plus fee sponsorship, so the attendee never needs XLM.
- **Stellar integration**
  - Soroban event contract: stake, check-in, refund, settle-forfeits.
  - **Passkey smart wallets** (passkey-kit or OpenZeppelin smart accounts), plus **fee-bump / sponsored transactions** so attendees pay no gas. Stellar docs compare fee-bump, sponsored reserves and relayers for exactly this.
  - Sub-cent fees make a €5 deposit economical. Card rails don't.
  - **Why blockchain:** refunding instantly and permissionlessly at near-zero cost is where blockchain really helps. Settling forfeits transparently also matters, since attendees must trust that the organizer can't just keep everything. *Honest note:* a pure TradFi version is possible, just costlier, so the necessity case is moderate.
- **Track fit:** **Composed** (Soroban + passkey wallet kit + relayer/fee sponsorship, optionally Stellar Passport-style identity).
- **Differentiation**
  - Kickback did this on Ethereum (~2018–2020). *(UNVERIFIED current status; I believe it's inactive.)* Gas made it impractical there, and that's exactly what Stellar fixes.
  - On Stellar, **no commitment-deposit prior art** turned up. Adjacent projects: EventStellar (proof-of-attendance tokens), Fewticket (ticketing) and **Stellar Passport** (a passkey participation layer with QR scan, SCF-funded). Passport is potentially composable, not competing.
- **Demo (90 s)**
  1. Open on the stat: "28% of free-event RSVPs don't show."
  2. An attendee RSVPs to "HackMeridian Afterparty" with Face ID. 5 USDC is staked, no wallet install, no XLM.
  3. The organizer dashboard shows the stakes accumulating.
  4. At the door, a phone scans the QR code and the attendee's 5 USDC refund lands instantly, shown on screen.
  5. After the event, the organizer clicks "settle". No-show deposits split among attendees, and every attendee sees a bonus.
- **Willingness to pay / adoption path**
  - Organizers pay per event or take a small cut of forfeits.
  - Start with crypto and tech meetups (Stellar ambassador events, hackathons) where wallets aren't scary, then expand via a Luma/Eventbrite integration. *(Speculation.)*
  - Network effect: attendees build a "reliability score". This needs care around privacy.
- **15-hour feasibility:** high for the core contract and QR flow. Passkey wallet plus fee sponsorship is the riskiest piece for a team new to Stellar. Fallback: Freighter for the demo, with passkeys shown on one screen if they work.
- **Biggest uncertainty:** whether a deposit kills sign-ups more than it cuts no-shows. In the Basecamp case registrations fell 35%, though attendance rose. And would mainstream attendees accept a crypto wallet, even passkey-based?
- **Evidence labels**
  - Verified: Pheedloop no-show medians; Basecamp experiment (Skift); Stripe fee retention on refunds; Stellar Passport, EventStellar and Fewticket exist (Scout).
  - Assumption: per-attendee card refund cost; organizers will pay.
  - Speculation: Luma integration; reliability-score network effect.

---

## PH-4: AllowanceVault: sponsor-funded, time-released living funds for international students

- **Target user:** families in FX-constrained countries (Nigeria, Ghana, Pakistan, Egypt) funding a child studying in Germany, the UK or Portugal. Also the student, who needs predictable monthly money.
- **Problem**
  - Germany requires non-EU students to prove living funds, typically via a **blocked account (Sperrkonto)**. That's ~€11,208/year (€934/month, released monthly), per secondary guides. *(Verified as reported; the 2025/26 figure may be higher, UNVERIFIED.)*
  - Providers charge setup and monthly fees: Fintiba ~€89 + €4.90/month, Expatrio €49 + €5/month. *(Verified, SimpleGermany / Expatrio.)*
  - Nigeria-specific friction:
    - Official FX for school fees has faced **delays of up to several months**, and restrictions on international card use left students unable to pay living expenses with Nigerian cards. *(Verified, Risk Advisory.)*
    - Parents report 90-day bank FX request waits. *(Verified, as reported via Kola King Substack.)*
    - Students have historically been suspended for unpaid fees. *(Verified, ICEF 2016 / ThisDay 2017; older.)*
  - Why existing infrastructure fails: blocked accounts are a fixed bank product per country, and getting money into them from FX-controlled countries is the bottleneck. Outside the visa context, nothing lets a parent pre-commit funds that release monthly and can't be spent all at once.
- **Proposed solution (MVP)**
  - The parent funds a vault in USDC (on-ramped locally via an anchor). The vault releases a fixed amount on the 1st of each month to the student's wallet.
  - The student cashes out to EUR via an anchor or card.
  - The parent can direct a lump sum straight to the university's wallet or invoice. That part is a stretch goal.
  - A public **"proof of funds" page** shows the locked amount and release schedule.
- **Stellar integration**
  - **Native Claimable Balances with time predicates** (Stellar "Unlocked"). Deposit creates 12 claimable balances, each claimable by the student "not before" month N. The parent can reclaim only after an expiry window, as a fallback if the student never claims. No custom contract is needed for the core, which is elegant and genuinely protocol-native.
  - The Stellar docs/CLI cookbook covers claimable balances with predicates. *(Verified via Stellar docs search.)*
  - Optional Soroban contract for early termination (visa refused leads to refund), where a custom predicate is needed.
  - Anchors provide the on/off-ramps (NGN in, EUR out).
- **Track fit:** **Unlocked**, strongly (claimable balances + predicates + anchors). Composed if anchors are integrated.
- **Differentiation:** Scout searches found **no Stellar project or build** doing a student allowance vault or blocked account. Blockroll (a Nigerian stablecoin wealth platform) and remittance wallets are adjacent. TradFi blocked-account providers (Fintiba, Expatrio) are regulated German-bank products.
- **Demo (90 s)**
  1. Parent in Lagos deposits 11,208 USDC and picks "monthly × 12".
  2. 12 time-locked claimable balances appear on-chain.
  3. Fast-forward on testnet with short intervals, e.g. 1 minute = 1 month: the student wallet claims "October" and "November" allowances. Trying to claim December early fails.
  4. Proof-of-funds page renders with a verifiable link.
- **Willingness to pay / adoption path**
  - Families already pay €50–90 setup plus ~€5/month to blocked-account providers, and FX spreads on top. *(Verified fees.)*
  - Distribution via study-abroad agents. *(Assumption.)*
- **15-hour feasibility:** high for the core. Claimable balances are a few SDK calls; a timeline UI is the main work. Anchors would only appear as screens/mocks.
- **Biggest uncertainty (likely fatal for the visa angle):** embassies only accept blocked accounts at approved regulated institutions. A stablecoin vault **will not count as visa proof-of-funds** without regulatory acceptance. *(Assumption, very likely true.)* So the product must stand on "allowance discipline + FX access" alone, which is a weaker, crowded remittance-adjacent pitch.
- **Evidence labels**
  - Verified: blocked-account amount and fees (secondary guides); Nigerian FX friction (Risk Advisory, ICEF, PIE News); claimable-balance predicates in Stellar docs.
  - Assumption: regulators won't accept it as proof-of-funds; agents as distribution.
  - Speculation: market size.

---

## Cross-cutting notes for debate

- PH-1 and PH-2 have the clearest **"why a public, neutral contract"** story. Both rest on a trust gap between strangers, with documented losses.
- PH-1 has **no Stellar prior art** and a viral, judge-friendly hook (real dollar losses, real names).
- PH-3 is the most fun to demo and the easiest to build, but blockchain is the least *necessary* there.
- PH-4 is the most protocol-native (claimable balances) but faces a regulatory wall on its best use case.
- Possible merge: PH-1's "locked pool with result attestation and auto-refund" is the same contract pattern as PH-3's "stake, check-in, settle". A generic "commitment escrow" engine could demo two verticals, but I'd advise against splitting the focus.

## Sources

- YaLLa Esports debt: https://esports.gg/news/cs-go/yalla-esports-debt/ ; https://www.esports.net/news/counter-strike/yalla-compass-exits-cs2-after-payment-controversy ; https://www.dust2.us/news/64464/media-yalla-esports-file-for-bankruptcy
- GXR HER Apex Open unpaid: https://jamesfudge.substack.com/p/still-waiting-100k-her-galaxy-apex
- Valve v. GESC: https://www.thegamer.com/valve-sues-esports-tournament-organizer-failing-pay-players-talent/
- Kenyan unpaid winnings: https://citizen.digital/sports/kenyan-esports-players-demand-unpaid-winnings-from-gaming-impact-series-n359433
- WSVG: https://mcvuk.com/?p=63631 ; MESA: https://www.dust2.us/news/65801/media-multiple-teams-talent-claim-mesa-owe-200000-in-outstanding-payments
- Portugal deposits: https://landager.com/en/property-compliance/portugal/national/security-deposits ; https://belzuz.com/en/?p=3763 ; https://www.uniplaces.com/city-explorer/renting-laws-in-portugal-2026/
- Portugal deposit scams: https://flatio.com/blog/an-announcement-from-flatio-s-ceo ; https://www.ie.edu/uncover-ie/?p=44272 ; https://www.idealista.com/en/news/legal-advice-spain/2019/02/20/6418-advice-avoid-scams-and-attempted-fraud-idealista
- UK deposit disputes: https://www.propertyreporter.co.uk/landlords/number-of-rental-deposit-disputes-show-annual-decline.html ; https://www.landlordtoday.co.uk/breaking-news/2018/11/less-than-1-of-tenancies-end-in-a-deposit-dispute/
- No-show data: https://pheedloop.com/blog/event-data-lab-report-5 ; https://pheedloop.com/blog/event-data-lab-report-06 ; https://meetings.skift.com/2026/09/02/the-100-experiment-that-slashed-no-show-rates-to-just-10/
- Stripe refund fees: https://support.stripe.com/questions/understanding-fees-for-refunded-payments
- Blocked account: https://www.simplegermany.com/best-blocked-account-germany/ ; https://www.expatrio.com/blocked-account
- Nigeria FX & students: https://riskadvisory.com/news/the-high-cost-of-foreign-exchange-how-nigerias-fx-shortage-has-impacted-both-businesses-and-everyday-life/ ; https://kolaking.substack.com/p/forex-crisis-puts-parents-of-students ; https://monitor.icef.com/2016/03/nigeria-tightens-foreign-exchange-controls-to-limit-use-for-study-abroad/
- Stellar prior-art & directory (Stellar Raven MCP → Scout `searchHackathonBuilds` / `searchProjects`, observed 2026-10-25): SafeTrust, BeTrustless, Mica, Trustless Work, Blend, EURC, DeFindex, Stellar Passport, EventStellar, Fewticket, Rail402, TollPay, Chancha+, Sharibo, HoneyCoin, Coins PH, Blockroll.
- Stellar docs: claimable balances with predicates (CLI cookbook) and fee-bump / sponsored reserves / relayers comparison: https://developers.stellar.org/docs/build/guides/transactions/submit-transaction-wait-js
