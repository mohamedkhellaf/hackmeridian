# Strata product specification (Covered regime)

**Owner:** Dev 1 (what the instrument promises). **Date:** 2026-10-26. **Scope:** the `contracts/options` contract as specified in ABI v1.3.1 (`docs/contract-abi.md` §12–§13 on branch `feat/contract-v1-3`). The latest deployment recorded in `docs/contract-testnet-evidence.md` is v1.3; behaviors marked v1.3.1 (transfer guards, per-asset open books, `prune_expired` caller) apply once v1.3.1 is deployed and merged. `main` currently carries v1.2. **Network:** Stellar Testnet only, fictional assets only. This document states what Strata promises. If code and this document disagree, that is a stop-ship blocker (AGENTS.md).

## Open questions for Dev 1

No decision below changes the behavior already coded. The review found no contradiction with the seven provisional decisions of ABI §7. It found four gaps and clarifications to confirm or act on:

1. **Disclosure gap (action, not an economics change).** Decision 6 requires the first-come-first-served clawback rule to be declared in the UI and the README. The README does not mention it, and a keyword search of `frontend/src` (deficit, shortfall, first-come) finds no deficit warning copy, only a demo scene titled "clawback warning". Dev 3 should confirm what the collateral panel actually shows. Dev 3 owns the UI text, Dev 1 owns the README text (Task 3). Until both ship, the claim in §8 is not yet publicly disclosed.
2. **The code adds a rule beyond decision 6.** While `open_collateral(token) > balance(contract)`, `create_offer`, `buy` and `transfer` involving that token fail with `CollateralShortfall` (#115). This limits the damage to existing participants, so it only strengthens decision 6. Confirm it is accepted as part of the promise (this spec assumes yes).
3. **Premium after a failed settlement.** Decision 1 means a buyer can lose the premium and still be unable to exercise when the issuer freezes the holder, de-authorizes the escrow or claws back collateral after `buy`. The contract never refunds. This follows from "no Impaired state", but it is the most visible economic consequence of that choice. Confirm the wording in §8 and in the UI.
4. **`transfer` also rejects the writer as new holder (`SelfTrade`) and the escrow address.** Decision 7 does not mention these guards. They are harmless and kept as coded.

## 1. What Strata Covered is

A fully collateralized options layer for eligible Stellar assets. The writer (market maker) locks the **entire** worst-case obligation in the escrow contract before anyone can buy. There is no margin, no leverage, no oracle and no admin. Exercise is **physical**: tokens change hands at the strike. Style is **American**: exercisable at any time before expiry.

*Honest claim:* any asset that is **supported** (listed in the contract registry) and **eligible** (the issuer's own authorization rules allow the escrow and each counterparty to hold it). Not every token automatically. The MVP runs on fictional Testnet assets (RWA, BOND, EQTY labels) and a test quote token USDx; the names are labels, not claims of ownership of any real asset.

## 2. The instrument

| | CALL | PUT |
|---|---|---|
| Holder's right | buy `qty` of the underlying for `strike_total` | sell `qty` of the underlying for `strike_total` |
| Writer locks at `create_offer` | `qty` of the underlying | `strike_total` of the quote token |
| Holder pays at `exercise` | `strike_total` of quote | `qty` of underlying |
| Holder receives at `exercise` | `qty` of underlying | `strike_total` of quote |
| Writer receives at `claim_delivery` | `strike_total` of quote | `qty` of underlying |

Fixed properties:

- **One position per funded offer.** An offer is a single lot with one writer and, once bought, one holder. No pooling of offers.
- **No partial exercise.** Exercise takes the whole `qty` or nothing.
- **Exact integers.** `qty`, `strike_total` and `premium_total` are `i128` token units (7 decimals; 1 token = 10,000,000 units). There is no per-unit price on-chain. Display strike per unit is `strike_total / qty`.
- **Time.** `now < expiry` means live; `now >= expiry` means expired. Buying and exercising need `now < expiry`; reclaiming needs `now >= expiry`.
- **Atomic.** Every call either completes fully or reverts fully. A token transfer failing inside `exercise` reverts the exercise.

## 3. Lifecycle

```
create_offer ─► Offered ─buy─► Active ─exercise─► Exercised ─claim_delivery─► Settled
                  │              │  ↻ transfer
                  │              └─ reclaim (now ≥ expiry) ─► Expired
                  ├─ cancel_offer ─► Cancelled
                  └─ reclaim / prune_expired (now ≥ expiry) ─► Expired
```

No other transition exists. There is no `Impaired` state, no pro-rata logic, no upgrade path.

## 4. Decisions of Dev 1 (ABI §7)

Each item adopts the behavior already coded, with its justification.

**D1. Premium: paid in `buy`, buyer → writer, never refunded.** Collateral is 100% locked before the sale, so the writer carries the full obligation from the moment the offer exists, and the premium is the price for carrying it. Paying at purchase needs no escrow of premiums, no refund accounting and no trust in either side. The writer earns the premium at `buy`, whether the option is exercised, expires worthless or fails to settle because of issuer action (see §8). The buyer's risk is limited to the premium plus the issuer risk disclosed in §8.

**D2. A writer cannot buy their own offer (`SelfTrade`, #111).** A self-purchase would produce a fake "active" position and a fake premium, which would inflate volume and mislead anyone reading the book. It also gives no economic benefit.

**D3. `qty`, `strike_total` and `premium_total` must all be > 0 (`InvalidArgs`, #102).** A zero quantity is an empty contract, a zero strike makes a put worthless and a call a free asset, and a zero premium is a free option that invites spam. Strictly positive amounts keep every example and payoff formula well defined.

**D4. Expiry must satisfy `now < expiry ≤ now + 2 years` (`InvalidArgs` #102, `TenorOutOfRange` #119). No minimum duration.** The upper bound (63,072,000 s) stops dust offers from sitting in storage for decades and keeps storage TTL maintenance finite. No minimum is imposed: a short-dated option is a legitimate product, and the demo needs minutes-long expiries. The risk of a very short option is carried knowingly by both parties.

**D5. An unsold expired offer can be recovered by `cancel_offer` or `reclaim`, and by anyone through `prune_expired`.** `cancel_offer` works at any time while the state is Offered. `reclaim` works once `now >= expiry`. `prune_expired` lets any account finish bookkeeping for expired unsold offers; the collateral always goes back to the writer, and no one can gain from calling it. A live offer is never touched except by its writer.

**D6. No Impaired state and no refund.** The contract promises the economics of the option, not protection against the issuer. If an issuer claws back tokens from the escrow, the escrow holds one pooled balance per token, so payouts are served **first come, first served** until the pool runs out. The shortfall falls on whoever claims last, not on the option whose collateral was clawed. While such a deficit exists, new offers, purchases and transfers on that token are refused (`CollateralShortfall`, #115), so the hole cannot spread to new participants. **This rule must be shown in the UI as a warning on every option of the affected token, and in the README** (see Open question 1). A pro-rata or refund mechanism is out of scope until its economics are specified and its detection and settlement are proven.

**D7. `transfer` is free and goes to an eligible address only.** The holder can hand an Active option to another address that is authorized on the underlying, with no payment leg on-chain; any payment is settled outside the call. State, collateral and the writer's rights are untouched, and the previous holder can no longer exercise. A paid resale (on-chain price discovery, or a position token) is **roadmap**, not part of this release.

## 5. Premium and who gains what

The writer earns the premium at `buy` (D1). It is the writer's maximum gain, and the holder's maximum loss on a call or a put that is never exercised.

Numbers use per-unit prices for readability. On-chain every figure is a 7-decimal integer: 10 RWA and a 1,000 USDx strike are `100_000_000` and `10_000_000_000` units.

**Cash-secured PUT.** `qty = 10 RWA`, `strike_total = 1,000 USDx` (K = 100), `premium_total = 40 USDx`. The writer locks 1,000 USDx. The holder pays 40 USDx.

| Spot at exercise | Holder action | Holder P&L | Writer P&L |
|---|---|---|---|
| S = 120 | does not exercise, expires | −40 | +40 |
| S = 100 | indifferent | −40 | +40 |
| S = 70 | exercises: delivers 10 RWA (worth 700), receives 1,000 | +300 − 40 = **+260** | 40 − 300 = **−260** (holds 10 RWA worth 700 instead of 1,000 cash) |

Holder breakeven: S = K − premium/qty = 96. Writer's maximum loss: 960 (if the asset goes to zero).

**Covered CALL.** `qty = 10 RWA`, `strike_total = 1,000 USDx`, `premium_total = 40 USDx`. The writer locks 10 RWA.

| Spot at exercise | Holder action | Holder P&L | Writer P&L (vs. keeping the asset) |
|---|---|---|---|
| S = 80 | does not exercise, expires | −40 | +40 |
| S = 100 | indifferent | −40 | +40 |
| S = 130 | exercises: pays 1,000, receives 10 RWA (worth 1,300) | +300 − 40 = **+260** | 40 − 300 = **−260** |

Holder breakeven: S = K + premium/qty = 104. The writer gives up all upside above the strike but keeps the premium.

These payoffs are at expiry, before any costs; they are hypothetical, not executable quotes. The written offer sets the price: there is no order book, and no live market-maker liquidity is implied.

## 6. Expiry, exercise and settlement

- **Exercise before expiry.** Only the current holder, only while `now < expiry` and the state is Active. The holder's payment lands in the escrow, never directly with the writer, so a frozen writer cannot block the holder from being paid. A second exercise fails with `WrongState` (#106).
- **At expiry.** The contract has no oracle and runs no automatic action. The holder who wants the intrinsic value must exercise before `expiry`. After `expiry`, `exercise` fails with `Expired` (#109), and the writer calls `reclaim` to take the collateral back (State: Expired). Rational holders exercise only in the money; the contract does not judge this.
- **Writer proceeds.** After an exercise (State: Exercised) the writer's side of the swap sits in the escrow until the writer calls `claim_delivery` (CALL: strike in quote; PUT: the underlying), which sets the state to Settled. If the writer is frozen on the asset, `claim_delivery` reverts and the proceeds stay in the escrow until the writer is re-authorized; nothing else can move them.
- **Cancellation.** Only the writer, only while the option is Offered (State: Cancelled), at any time including after expiry. An Active option cannot be cancelled by anyone; the holder's right is a purchased right.

## 7. Ownership and transfer

- The holder is `None` while Offered, the buyer from `buy` onward. Only the holder can exercise or transfer.
- `transfer(holder, to, id)` works only while Active and `now < expiry`. The target must be a different address from the holder, must not be the writer, and must be eligible on the underlying (so the new holder can deliver for a PUT or receive for a CALL). Since v1.3.1 it also requires the escrow to be authorized and fully backed on the token, so a position cannot be handed to a new participant while the escrow cannot settle it.
- A frozen holder can still transfer, because the transfer moves no tokens. It cannot exercise.
- There is no paid secondary market and no position token in this release.

## 8. Issuer powers and what Strata does not guarantee

Strata promises the **economics of the option** under the issuer's own rules. It does not override issuer control and it is **not** an unconditional guarantee against issuer action.

| Issuer action | Effect |
|---|---|
| Freeze the **holder** | holder's `exercise` fails (SAC #11); the writer reclaims after expiry; the premium is not refunded |
| Freeze the **writer** | `exercise` still works (the holder is paid from the escrow); the writer's `claim_delivery`/`reclaim` of the frozen asset fails until re-authorized |
| De-authorize the **escrow contract** | transfers into or out of the escrow for that asset fail (PUT exercise and claim; CALL exercise and reclaim); `buy` is refused (`ContractNotAuthorized`, #105); the PUT writer can still reclaim quote collateral after expiry |
| **Claw back** from the escrow | the pooled balance falls below `open_collateral`; payouts are first come, first served (D6); new offers, buys and transfers on that token are refused |

Not guaranteed: any production-grade security (the contract is not audited), the real-world value or redeemability of any asset, availability of a counterparty or of liquidity, or protection when an issuer acts after you have paid the premium. USDx, the quote token, has an unflagged issuer, so PUT strike collateral is not exposed to clawback.

## 9. Acceptance criteria

Each criterion must be demonstrable by an automated test or a recorded Testnet transaction. IDs reference the evidence file; none is invented here.

1. **PUT happy path:** writer locks `strike_total` quote; holder buys, paying the premium to the writer; holder exercises, delivers `qty` and receives `strike_total` in the same call; writer claims `qty`; state reaches Settled; `open_collateral` returns to 0.
2. **CALL happy path:** mirror of 1, with writer locking `qty` and the holder paying `strike_total`.
3. **Premium:** the writer's quote balance rises by exactly `premium_total` at `buy`, and no flow ever returns it, including after expiry or `reclaim`.
4. **Rejections:** self-purchase (#111), zero `qty`/`strike_total`/`premium_total` (#102), `expiry <= now` (#102), `expiry > now + 2 years` (#119), buy or exercise after expiry (#109), reclaim before expiry (#110), double exercise (#106), exercise by a non-holder (#108), cancel or reclaim by a non-writer (#107).
5. **Expiry:** after `expiry`, a live Active option cannot be exercised and the writer reclaims the full collateral.
6. **Unsold offers:** `cancel_offer` before and after expiry returns the collateral; `prune_expired` by a third party returns it to the writer.
7. **Transfer:** the new holder can exercise and the previous holder cannot; transfer to an ineligible address, to the writer or to the holder is refused; no tokens move.
8. **Issuer cases:** each row of §8 reproduces on Testnet with the stated error; after a clawback, `open_collateral > balance(escrow)` and `create_offer`/`buy` fail with #115.
9. **Collateral accounting:** each option's collateral is counted once; `open_collateral(token)` equals locked collateral of Offered and Active options plus unclaimed proceeds of Exercised ones.
10. **Disclosure:** the README and the UI show the §8 limitations, including the first-come-first-served rule, before this spec is called satisfied.

## 10. Strata Pro (experimental)

Strata Pro is a separate, experimental contract for **naked American calls, cash-settled in USDx**. The holder may exercise early at the spot of a price snapshot at most 120 s old, against a healthy writer; positions the vault has taken over, or against a writer that is liquidatable or has unpriced expired debt, are settled at the expiry price instead. It uses **partial margin** and a **backstop vault** that takes over positions of makers that fall below maintenance margin. It is **not** the Covered regime and its guarantees are weaker: the holder is paid from the writer's margin (after a vault takeover, from the writer's takeover payment reserved for that position), then from the vault pro rata within a series, and a **residual default deficit is possible and shown**, not hidden. LP capital in the vault cannot be withdrawn in v0. It is specified and simulated; do not describe it as on-chain until `contracts/pro/` is merged with a recorded Testnet transaction (Dev 2's review of PR #30 set the hackathon go/no-go to no-go). Parameters are uncalibrated, and the price snapshots and the settlement price in the demo are set by the team; they decide every liquidation, exercise and payout.

Details live in PR #30 (`feat/pro-v0-spec`): `docs/pro-architecture.md`, `docs/pro-v0-brief-dev2.md` and `packages/risk/` (`pro_v0_model.py` is the executable spec). This document does not restate them.
