# StellSec demo script (3 minutes)

Owner: Dev 1 (narrative), Dev 3 (capture). Current as of options v1.5 (`CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6`) and the hosted app. The voice-over text, timings and claims table in `docs/pitch-speech.md` §2–§3 are the reference; this file is the shot list. Amounts match `scripts/deploy/seed-demo-offers.sh` (PUT on 5 RWA, total strike 50 USDx, premiums 1.0 and 0.8 USDx).

Presentation mode: open the app with `?present=1`. It enlarges type slightly and shows a caption bar with the scene title. Keys: Right / Left arrow = next / previous scene, `h` = hide or show the bar. Scene titles and start times live in `frontend/src/demo/scenes.ts` (nine scenes; the optional resale scene 4b has no caption, hide the bar for it). The bar never hides the mock-data banner.

## Roles and accounts

All accounts are disposable Testnet-only accounts, imported into Freighter. Assets are fictional: `RWA`, `BOND`, `EQTY` (auth required, revocable, clawback enabled) and the quote token `USDx` (no flags).

| Role | Account | Used in scenes |
|---|---|---|
| RWA issuer | `strata-rwa-issuer` (also issues BOND and EQTY) | 7 |
| USDx issuer | `strata-usdx-issuer` | none on camera |
| Maker A | writer, USDx funded | 2 |
| Maker B | writer, USDx funded; writes the cheaper offer, so it is Maker B who claims in scene 6 | 3, 6 |
| Investor | authorized on RWA, holds RWA and USDx | 4, 4b, 5, 7 |
| Investor 2 | authorized on RWA, holds USDx for the resale price; not the writer of the resold option | 4b |

Setup (issuers, flags, trustlines, authorizing the contract on each SAC, deployment, seeding) is `scripts/setup-testnet/` then `scripts/deploy/` (`deploy.sh`, `seed-demo-offers.sh`, `seed-demo-bids.sh`). Public keys are in `docs/contract-testnet-evidence.md`, "Roles".

Pre-staged state before recording:
- Maker A's and Maker B's offers (scenes 2 and 3) are created on camera.
- One extra option bought by the Investor and still `Active` for scene 7 (the freeze scene), because scene 5 exercises the one bought in scene 4.
- For the optional scene 4b, one more `Active` option held by the Investor with no ask on it. Do not resell the scene 4 option.
- Expiry at least 2 hours after the recording time. The seeded book uses 72 hours.

## Pre-recording checklist

- [ ] Freighter: Maker A, Maker B, Investor, Investor 2, RWA issuer imported; network Testnet (the app shows a red banner otherwise).
- [ ] The app points at v1.5 (`VITE_OPTIONS_CONTRACT_ID`); no "Mock data" banner; Markets shows offers, requests and resale.
- [ ] Balances: makers hold USDx for the strike; the Investor holds USDx for premiums and RWA for the put delivery; all hold XLM for fees.
- [ ] The issuer has authorized the contract on RWA (otherwise `create_offer` fails with `ContractNotAuthorized` 105); Investor, Investor 2 and both makers are authorized on RWA.
- [ ] The Investor is not frozen at the start; the issuer wallet is ready to freeze them in scene 7.
- [ ] Browser zoom 110 to 125 percent, 1920x1080, clean profile, other tabs closed, notifications off.
- [ ] Open tabs: app with `?present=1`; stellar.expert Testnet ready for a transaction link.
- [ ] One full dry run on throwaway options; note the tx hashes of the real run (see fallback).
- [ ] Record at 1080p; voice-over as a separate take if live narration is shaky.

## Scene list

Timings are targets; the spoken lines are in `docs/pitch-speech.md` §2. One claim per sentence.

| # | Time | Screen and exact actions | Beat |
|---|---|---|---|
| 1 | 0:00-0:20 | App, **Markets**. No wallet yet. | Tokenized assets on Stellar have no risk tools. StellSec: fully collateralized options for eligible assets, Testnet. |
| 2 | 0:20-0:45 | Wallet: Maker A. Connect. **Markets → Sell → Post an offer**: RWA, PUT, qty 5, total strike 50 USDx, premium 1 USDx, expiry. Keep **Full collateral**. Sign. Then **Locked reserves**: Held rises by 50 USDx. | The full strike is locked now. No margin, no leverage. |
| 3 | 0:45-1:00 | Wallet: Maker B. Same series, premium 0.8 USDx. Sign. **Markets**: two funded offers on one series, best on top. | A second maker undercuts with a funded on-chain offer. Not an order book we invented. |
| 4 | 1:00-1:20 | Wallet: Investor. **Markets → Buy** on the 0.8 offer. Buy dialog: premium, eligibility, hypothetical payoff. Sign. **Positions**: `Active`. | Premium to the maker at purchase. The investor may sell 5 RWA for 50 USDx any time before expiry. |
| 4b | optional, 1:20-1:30 | Wallet: Investor. **Positions → Sell** on the pre-staged second put, ask 2 USDx, sign. Wallet: Investor 2. **Markets**, resale ask → **Buy**, sign. **Positions** (Investor 2): holder. | Holders are not locked in. The price goes to the holder; strike, expiry and collateral do not change. |
| 5 | 1:30-1:53 | Wallet: Investor. **Positions → Exercise**, sign. Click the tx link: on stellar.expert, RWA investor → contract and USDx contract → investor in one transaction. | Atomic delivery-versus-payment. If any leg fails, nothing moves. |
| 6 | 1:53-2:02 | Wallet: **Maker B**. **Positions**: `Exercised` → **Claim delivery**, sign → `Settled`. | The writer claims the delivered RWA. Settled. |
| 7 | 2:02-2:33 | **Locked reserves** page first: Owed vs Held per token, read at a ledger. Then wallet: RWA issuer. **Issuer**: RWA, target = Investor, **Revoke / freeze**, sign. Wallet: Investor. **Positions → Exercise** on the pre-staged option: failure banner (SAC error 11, balance deauthorized). | Anyone can check the backing. The issuer keeps its powers; a frozen holder cannot exercise and nothing moves. Not a guarantee against issuer action. |
| 8 | 2:33-2:43 | stellar.expert: EQTY `list_asset` tx `9e83e587…bf69`, then the EQTY exercise `f2ad8d0e…10a5`. | Anyone can list a classic asset with one call; the issuer still decides who may hold it. |
| 9 | 2:43-3:00 | Closing card: app URL, repo URL, the disclosure line. If Margin is mentioned, show its warning banner. | Testnet, fictional assets, unaudited. Real assets need their issuer. Protection for any eligible Stellar asset. |

After the take: unfreeze the Investor (Issuer → Authorize) so the demo account stays usable.

## Fallback plan

- **Testnet or RPC slow (a transaction pending more than about 15 seconds):** cut, wait, retry. Do not narrate over a spinner. Edit out waits; never alter what a result shows.
- **No live chain during recording:** use the hashes from the dry run on stellar.expert and say so: "This is the transaction from our earlier run."
- **Mock mode** (no `VITE_OPTIONS_CONTRACT_ID`): the app shows an orange "Mock data" banner and "(mock)" next to hashes. Use it only for a labelled UI walkthrough, spoken and on screen: "mock mode, no blockchain". Never mix mock and live in one scene.
- Keep the real tx hashes of create A, create B, buy, (list_for_sale, buy_resale,) exercise, claim_delivery, freeze for the submission notes.

## Claims checklist

Hashes are from `docs/contract-testnet-evidence.md`; a version tag means the hash was recorded on that earlier deployment of the same code path, which is on v1.5 unchanged. Replace with the recording's own hashes once captured.

| Spoken claim | Evidence | Status |
|---|---|---|
| Collateral is locked when an offer is created | `create_offer` pulls the full strike or quantity before the offer exists (ABI §3); seeded offer tx `5dc15250…2531` (v1.5); `open_collateral` on the Locked reserves page | Verified on chain |
| Covered options carry no margin or leverage | no margin path in `contracts/options/src/lib.rs`; ABI §2 derived values | True by construction |
| Two makers compete with funded on-chain offers | `seed-demo-offers.sh` creates the 1.0 / 0.8 USDx pair; competition txs `2275ee06…0404` / `9f7dce74…bd97` (v1.2) | Verified; recording tx to add |
| Premium goes to the maker at purchase, never refunded | `buy` (ABI §3), PRODUCT_SPEC D1; buy tx `03ce25be…` (v1.4) | Verified; policy decided |
| Resale: holder-set price, buyer pays the holder, option unchanged | `list_for_sale` / `buy_resale`, PRODUCT_SPEC D8; tx `a5c5a3d2…6949` (v1.4) | Verified on chain |
| Buyer requests: funded bid filled by a maker into an Active option | `create_bid` / `fill_bid`, PRODUCT_SPEC D9; tx `ce841e7e…5cb3`, exercise `088f1066…276c`, claim `80196949…506e` (v1.5) | Verified on chain |
| Exercise is atomic delivery-versus-payment | `exercise` in one invocation (ABI §3); forced failure left balances identical, tx `a005ab41…` (`research/decision/20_rwa_options_spike.md`); EQTY exercise `f2ad8d0e…10a5` | Verified on chain |
| Writer claims after exercise | `claim_delivery`; `80196949…506e` (v1.5) | Verified on chain |
| Frozen holder cannot exercise; nothing moves | freeze `3f0d711d…f462` then exercise rejected with SAC error 11 (v1.3.1 run); the rejection happens in simulation, so no fee is spent | Verified on chain |
| Locked reserves page shows owed vs held and a clawback shortfall | `open_collateral` vs SAC balance; clawback run `f45330be…` / `c6ef0692…` (RWA short, BOND unaffected, issuer repays) | Verified on chain |
| Anyone can list a classic asset; the issuer decides eligibility | `list_asset` derives the canonical SAC on chain; `9e83e587…bf69` (v1.5) | Verified on chain |
| Testnet, fictional assets, unaudited | Deployed contracts table; asset labels | True by construction |

## Do not say

- Mainnet, production, "live", or any launch date.
- "Real" RWAs or funds, or that RWA, BOND or EQTY represent anything. They are fictional.
- "Works with every token." Say "any supported, eligible Stellar asset".
- That an option is a guarantee against issuer action, or that settlement is unconditional.
- That the contract is audited, secure for production, or "trustless" without qualification.
- That premiums are refundable, or that an `Impaired` state, a position token, multi-leg products, an RFQ service, an oracle or a pricing model exist for covered options. Payoff charts are hypothetical, not quotes.
- "Market price", "liquidity" or "order book" for resale: one ask per option, set by its holder, no matching.
- For Margin: "guaranteed", "insured", "safe", "fully backed" or "fully collateralized". Say partial margin, payouts can be reduced, any deficit is shown, prices come from the team's publisher.
- Any statement about liquidity, volume or users. Demo makers are our own funded Testnet accounts.
