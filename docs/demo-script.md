# StellSec demo script (3 minutes)

**Draft by Dev 3 for Dev 1 review.** Dev 1 owns the final narrative; Dev 3 owns capture. Nothing here changes the product promise. All amounts below are placeholders: replace them with the values Dev 2's setup script actually creates.

Presentation mode: open the app with `?present=1` (for example `http://localhost:5173/?present=1`). It enlarges type slightly and shows a caption bar with the scene title. Keys: Right / Left arrow = next / previous scene, `h` = hide or show the bar. Hide it (`h`) for the final cut if you add titles in editing. It never hides the mock-data banner. Scene titles live in `frontend/src/demo/scenes.ts` and must match the table below.

## Roles and accounts

All accounts are disposable Testnet-only accounts, imported into Freighter. Assets are fictional.

| Role | Account | Used in scenes |
|---|---|---|
| Issuer FUND | Issuer of fictional `FUND` (flags AUTH_REQUIRED, AUTH_REVOCABLE, AUTH_CLAWBACK_ENABLED) | 7 |
| Issuer USDx | Separate issuer of the quote token `USDx` (no flags) | none on camera |
| Maker A | Writer with USDx funded | 2, 6, 8 |
| Maker B | Second writer with USDx funded | 3 |
| Investor | Holds FUND (authorized by the FUND issuer) and USDx for the premium | 4, 4b, 5, 7 |
| Investor 2 | Second buyer: authorized on FUND, holds USDx for the resale price. Must not be the writer of the resold option | 4b |

Setup (assets, trustlines, funding, authorizing the options contract on the FUND SAC, deployment) belongs to Dev 2 in `scripts/setup-testnet/`. This document does not define it.

Pre-staged state needed before recording (ask Dev 2 to produce it, or do it off camera):
- Maker A's and Maker B's offers (scenes 2 and 3) are created on camera. One extra option, bought by the Investor and still `active`, must exist off camera for scene 7 (the freeze scene), because scene 5 consumes the first one. Simplest: a third funded offer from Maker B, bought by the Investor before recording.
- Scene 4b (resale, contract v1.4 `CC6AI7AKKEVSXH3QQF7HBXZNIBS4ACFP2UQLXG3WOAZ5VDFCTXVFPWNK`) needs one more option, bought by the Investor off camera and still `active`, with no ask on it. Do not resell the option bought in scene 4: scene 5 exercises it.
- Short expiry is risky: use an expiry at least 2 hours after the recording time.

## Pre-recording checklist

- [ ] Freighter: Maker A, Maker B, Investor, Investor 2, FUND issuer imported; network set to Testnet (the app shows a red banner otherwise).
- [ ] `VITE_OPTIONS_CONTRACT_ID` set to the deployed contract (see Deployed contracts in AGENTS.md). Confirm there is NO "Mock data" banner on screen.
- [ ] Balances funded: Makers have enough USDx for strike collateral; Investor has USDx for premiums and FUND for the put delivery; all have XLM for fees.
- [ ] FUND issuer has authorized the options contract on the FUND SAC (otherwise `create_offer` fails with ContractNotAuthorized). Investor and makers are authorized on FUND.
- [ ] Investor 2 is authorized on FUND and holds enough USDx for the ask in scene 4b.
- [ ] Investor is NOT frozen at the start; the FUND issuer is ready to freeze them in scene 7.
- [ ] Browser zoom 110 to 125 percent, window 1920x1080, one clean browser profile, all other tabs closed, notifications off, bookmarks bar hidden.
- [ ] Open tabs: app with `?present=1`; stellar.expert Testnet page ready for a transaction link.
- [ ] Do one full dry run on a throwaway option; note the tx hashes of the real run (see fallback).
- [ ] Record screen at 1080p with a separate voice-over take if live narration is shaky.

## Scene list

Timestamps are targets. Voice-over lines are English, calm, one claim per sentence.

| # | Time | Screen and exact actions | Voice-over |
|---|---|---|---|
| 1 | 0:00-0:20 | Title card or the app, Market tab, "How it works" strip expanded (click "How it works"). Freighter not yet needed. | "Stellar already has tokenized funds, bonds and stocks. What they lack is risk management: a holder cannot hedge, and nobody can earn a premium on what they hold. StellSec is a fully collateralized options layer for eligible tokenized assets on Stellar, running on Testnet." |
| 2 | 0:20-0:45 | Freighter: Maker A. Click Connect Freighter. Open the **Write** tab. Choose underlying FUND, type PUT, fill quantity, total strike, premium, expiry. Click the publish button, approve in Freighter. Wait for the green banner "Offer published". | "A market maker writes a cash-secured put on a fictional fund token. The strike is locked in the contract right now. No margin, no leverage, no promise without collateral." |
| 2b | (in 2) | Stay on Write tab: show the collateral panel line for USDx. | "The contract holds exactly the strike amount. Anyone can verify it." |
| 3 | 0:45-1:00 | Freighter: switch to Maker B (reconnect in the app). **Write** tab, same underlying and strike, lower premium. Publish and approve. | "A second maker competes with a cheaper funded offer. These are on-chain offers, not an order book we invented." |
| 4 | 1:00-1:20 | Freighter: Investor. **Market** tab: both offers visible, compare premium. Click buy on the cheaper one, review the BuyDialog (eligibility hint, premium), confirm and approve. Open **My positions**: option is `active`. | "The investor holds FUND and wants downside protection. They buy the cheaper put. The premium goes to the maker at purchase. The investor now owns the right to sell FUND at the strike until expiry." |
| 4b | 1:20-1:40 | Freighter: Investor. **Portfolio**: on the pre-staged second put (not the one just bought), click **Sell**, enter the ask total (for example 2 USDx), approve. Freighter: Investor 2. **Markets**, Resale section: the ask is listed; click **Buy**, approve. **Portfolio** (Investor 2): the option is `active` with Investor 2 as holder. On-screen text: "Resale: the holder sets the price. Strike, expiry and collateral unchanged." | "Holders are not locked in. The investor lists a second put for resale at a price they set. Another eligible account buys it: the price goes to the investor, and the buyer becomes the holder. Strike, expiry and the maker's collateral do not change." |
| 5 | 1:40-2:05 | **My positions**, click Exercise on the active option, approve. Banner shows the tx hash: click it to open stellar.expert, show the transfers: FUND from investor into the contract, USDx from the contract to the investor, one transaction. Return to the app. | "Exercising is atomic delivery-versus-payment. The investor's FUND and the maker's locked USDx move in the same transaction. If any part fails, nothing moves." |
| 6 | 2:05-2:15 | Freighter: Maker A (writer of that option). **My positions**: state `exercised`. Click Claim delivery, approve. State becomes `settled`. | "The maker then claims the delivered FUND. Settlement is complete." |
| 7 | 2:15-2:40 | Freighter: FUND issuer. **Issuer** tab: asset code FUND, target = Investor's G address, click **Revoke / freeze**, approve. Switch to Investor, **My positions**, click Exercise on the pre-staged active option. Show the failure banner. | "Now the part we want to be honest about. The issuer of a regulated asset keeps its powers. If the issuer freezes the holder, exercise fails, with a clear message, and nothing moves. StellSec does not override issuer control and it is not a guarantee against issuer action." |
| 8 | 2:40-2:50 | **Write** tab, collateral panel: contract holds collateral for every open position. If a clawback warning is visible (only if the issuer used Clawback against the contract in rehearsal), point to it; otherwise do not stage one on the final take. | "The collateral panel compares what the contract must hold with what it actually holds. Full backing is visible." (Cut the clawback sentence to fit 10 seconds.) |
| 9 | 2:50-3:00 | Back to Market tab or closing card; the footer disclaimer visible. | "Everything you saw is Testnet with fictional assets. Real tokenized funds need issuer cooperation. StellSec supports any eligible Stellar asset the issuer allows, not every token automatically." |

After the take: unfreeze the Investor (Issuer tab, Authorize) so the demo account stays usable.

## Fallback plan

- **Testnet or RPC slow, transaction pending more than about 15 seconds:** cut the recording, wait, retry. Do not narrate over a long spinner. Edit out waits but never alter the content of results.
- **Recording must happen without live chain:** use hashes recorded during the dry run. Show each real tx on stellar.expert Testnet (the pages remain available) and say so: "This is the transaction from our earlier run."
- **Mock mode** (no `VITE_OPTIONS_CONTRACT_ID`): the app shows an orange "Mock data" banner and "(mock)" next to hashes. Use it only for a clearly labelled walkthrough of the UI, with a spoken and on-screen label "mock mode, no blockchain". Never present mock data or mock hashes as on-chain. Do not mix mock and live in one scene.
- Keep a list of the real tx hashes for: create_offer A, create_offer B, buy, list_for_sale, buy_resale, exercise, claim_delivery, freeze. Put it in the submission notes.

## Claims checklist

Fill the evidence column before recording. "Test" = automated test name, "tx" = Testnet hash on stellar.expert, "code" = path in repo.

| Spoken claim | Evidence | Status |
|---|---|---|
| Collateral is locked in the contract when an offer is created | Contract: `create_offer` pulls collateral (ABI section 3); tx of scene 2; `open_collateral` shown in the collateral panel (`frontend/src/maker/CollateralPanel.tsx`) | TODO tx hash, Dev 2 contract test name |
| Fully collateralized, no leverage or margin | ABI section 2 derived values table; AGENTS.md "Never in this hackathon" | contract tests TBD by Dev 2 |
| Two makers compete with on-chain funded offers | txs of scenes 2 and 3; Market tab reads `list_open` | TODO tx hashes |
| Investor buys, premium goes to the maker at purchase | `buy` transfers premium buyer to writer (ABI section 3). Policy is PROVISIONAL (ABI section 7): Dev 1 must confirm or change before we say more than this | needs Dev 1 decision |
| A holder resells at a price they set; the buyer pays the holder and becomes holder; strike, expiry and collateral unchanged | `list_for_sale` and `buy_resale` (v1.4, `CC6AI7AKKEVSXH3QQF7HBXZNIBS4ACFP2UQLXG3WOAZ5VDFCTXVFPWNK`); PRODUCT_SPEC D8; tx `a5c5a3d2d80e510bfcebe9f9781b82bdc3313121feffaf30fa642d8556e69949`; `open_collateral` the same before and after | TODO scene 4b recording |
| Exercise is atomic delivery-versus-payment | `exercise` in one transaction (ABI section 3); spike on-chain revert proof tx `a005ab41...` (`research/decision/20_rwa_options_spike.md`); tx of scene 5 | TODO scene 5 tx hash |
| Writer claims delivery after exercise | `claim_delivery` (ABI section 3); scene 6 tx | TODO tx hash |
| Frozen holder cannot exercise, clear message, nothing moves | ABI section 6; spike results (e) and (d+); error text for SAC #11 in `frontend/src/stellar/errors.ts` ("Token balance is deauthorized...") | TODO scene 7 recording; Dev 2 contract test |
| Collateral page shows owed vs held per token and flags a clawback shortfall | `open_collateral` vs SAC balance, ABI section 3 and 6; `frontend/src/views/ReservesView.tsx` | warning only if staged; say so |
| Works on any eligible asset the issuer allows | Constructor allowlist (AGENTS.md architecture); claim must stay "eligible, supported" | wording check by Dev 1 |
| Testnet, fictional assets | Deployed contracts table; asset labels | true by construction |

## Do NOT say

- Mainnet, production, "live", or any launch date.
- "Real" RWAs, real funds, or implying the FUND token represents a real fund. It is fictional.
- "Works with every token." Say "any supported, eligible Stellar asset".
- That options are a guarantee against issuer action, or that settlement is unconditional. Freeze and clawback can block settlement.
- That the contract is audited, secure for production, or "trustless" without qualification.
- That premium handling is final (it is PROVISIONAL until Dev 1 decides), or that premiums are refundable.
- That there is an `Impaired` state, refunds, a position token, multi-leg or strategy products, an RFQ service, an oracle, or pricing models: none exist in the MVP. Do not show payoff charts as market quotes.
- "Market price", "liquidity" or "order book" for resale. A resale price is an ask set by one holder, not a market quote; there is one ask per option and no matching.
- Any statement about liquidity, volume, or users. Demo makers are our own funded Testnet accounts.

## Open questions

For Dev 1: is the provisional premium policy acceptable to state aloud? Is the clawback warning in scene 8 part of the take, or only mentioned? Final wording of the closing line?
For Dev 3: add scene 4b to `frontend/src/demo/scenes.ts` and shift the later start times to match the table.
For Dev 2: exact account names, asset codes, amounts, and the pre-staged third and fourth options (scene 7, scene 4b), the Investor 2 account; contract test names for the claims table; will setup scripts print the tx hashes?
