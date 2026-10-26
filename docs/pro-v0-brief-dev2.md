# Strata Pro v0.2 — build brief for Dev 2

Owner: Dev 2 (contract). Spec owner: Dev 1. Status: **experimental track, spec + integer model + simulator for the hackathon.** Dev 2's review of PR #30 recommended no-go for on-chain Pro before the 06:00 freeze; Dev 1 accepts. This brief is the build spec for when `contracts/pro/` is built. Dev 2 keeps the veto on unsafe behavior.

**The executable spec is `packages/risk/pro_v0_model.py` (v0.2).** Every function below exists there with the same checks, in the same order, with the same errors. The brief and the model must agree. If Dev 2 finds that a behavior is unsafe or unbuildable on-chain, Dev 2 may deviate. Dev 1 then updates the model and the fixtures to match before the contract merges. The model never overrides on-chain safety. Background and calibration: `docs/pro-architecture.md`.

**Done means:** `contracts/pro` replays every scenario in `packages/risk/fixtures/pro_v0.json` (10 scenarios, 219 steps) with identical results, error codes and state. The fixtures do **not** yet cover every bound or error: contract tests must add `NotFound`, `Overflow`, `TooManyPositions` and `TooManySeries` at their caps (§4). A Testnet run covers fill → early exercise → price move → vault liquidation → settlement → claim, with the transaction hashes recorded in `docs/contract-testnet-evidence.md`. Until then, every public claim says **specified and simulated**.

## 0. What changed

### v0.2 (second review of PR #30, head `e810657`)

| Round-2 item | v0.2 resolution |
|---|---|
| 1. Early exercise against a vault-owned book jumps the pro-rata queue | `exercise` refuses vault-owned books (`NoEarlyExercise = 226`); those holders are paid at expiry through `settle_vault`, pro rata. The vault therefore never pays out except at `settle_vault`. |
| 2. LP run before expiry (vault value ignores insolvent writers not yet taken over; requests never lapse) | **LP withdrawal cut for v0** (`lp_request_withdraw`/`lp_withdraw` removed; `WithdrawLocked = 215` reserved). `liquidate(VAULT)` now always succeeds when the writer is below MM, even if the vault drops below its own MM, so the loss shows in `vault_value` and `lp_deposit` refuses new shares (`VaultCapacity`) while it is ≤ 0. Residual: a deposit made before the keeper's takeover still enters a hidden loss (§10). |
| 3. Exercise at a snapshot up to an hour old | New config `exercise_max_age` (default 120 s, ≤ `max_age`); older snapshot → `StaleSnapshot`. |
| 4. Expired-but-unpriced debt bounded by a stale snapshot | The bound now uses the **most recent snapshot of the deployment's single underlying** (any series). `exercise` against a writer with expired unpriced shorts fails with `SettlementPending`. |
| 6. Writer cash split across same-expiry series by `settle` order | `settle(book)` waits until every expired series of that writer has a price (or its window closed), then pays `due × cash / total expired debt` when cash is short: pro rata across the writer's books, independent of call order. |
| 7. American exercise cannot be cut | §9: "European only" is now cut #1; the exercise guards are in the never-cut list if exercise ships. |
| 5, 8, 9 | Not changed in v0.2; see §10 (5, parts of 9) and the fixture gap in the header (8). |

### v0.1 (first review of PR #30)

| Review finding | v0.1 resolution |
|---|---|
| 1. Storage bounds exceed per-tx limits (Testnet: 200 write entries, 400 footprint entries, 16,384 event bytes per tx) | Positions belong to a **book** (owner, series). `liquidate` reassigns books, O(books ≤ 16). `settle(book)` and `settle_vault(series)` are O(1); each holder `claim`s alone. No call loops over positions. |
| 2. "The publisher cannot move balances" is false | Claim withdrawn everywhere. The publisher's prices decide every liquidation, exercise and payout. Snapshot bounds check internal consistency, not the spot. The settlement price is **team-set and disclosed**, not bounded on-chain (a bound would also block a real gap). |
| 3. Publisher can trade; publisher may equal admin | The constructor rejects `admin == publisher`. Admin and publisher are rejected as depositor, writer, buyer, private taker and LP (`RoleNotAllowed = 221`). |
| 4. LP backstop can be run | v0.1 gated LP flows on expired series only and paid `min(value at request, value now)`. That did **not** stop a run before expiry (round-2 item 2); v0.2 cuts withdrawals. The first LP deposit must be ≥ 100 USDx. |
| 5. Writer withdraws after expiry against a stale snapshot | `withdraw` fails with `SeriesExpired` while the account holds any expired, unsettled short. |
| 6. Push-based `settle` lets one holder block everyone | Pull: `claim(holder, pos)`; the contract only ever pays the caller. |
| 7. 04:00 on-chain go/no-go not realistic | Accepted: no on-chain Pro claim for the hackathon. |
| 8. Vault pays first-come-first-served | Within a series the vault pays **pro rata of the shortfalls** (`settle_vault` after every book is settled). Across series, vault capacity is used in `settle_vault` order (disclosed). |
| 9. One expired series freezes liquidation and LP flows | Expired series no longer need a fresh snapshot: their debt is exact once the settlement price exists, or a conservative bound (intrinsic at the last snapshot's +ext shock) before. `liquidate` takes over live series only; the expired debt stays with the writer and has priority on its cash. |
| 10. Reserve fee follows a writer-set premium | `buy` requires `premium ≥ qty × mark` (`PremiumBelowMark = 222`). |
| 11. Vault position cap easy to exhaust | The vault has no position or book list (it is never taken over), so there is nothing to exhaust. Its series count is bounded by `MAX_LIVE_SERIES = 16`. |
| 12. AGENTS.md amendment weakens repo-wide rules | Rewritten: the "Never" list keeps margin, leverage and uncollateralized promises, with a Pro-only exception conditioned on a recorded on-chain proof. |
| 13. Never-cut list misses the safety items | §9 rewritten. |
| 14. Brief and model disagree; model incomplete | Brief rewritten from the model; config validation added; `TooManyPositions` and `chk` (`Overflow`) added, but some products still lack `chk` and the fixtures do not exercise these errors yet. |
| 15. Underlying unnamed; liquid-equity calibration | Demo underlying: the fictional `EQTY` label. Parameters are illustrative and from the liquid-equity calibration. Thin RWAs stay in Covered (`pro-architecture.md` §5). |
| 16–21 (low) | 16, 17, 19 disclosed in §10 (17 also mitigated by the minimum first deposit); 18 bounded by `MAX_LIVE_SERIES`; 20: `MarketConfig.validate()` plus a permissionless `extend_ttl`; 21: stale timeline marked superseded, stale references fixed in v0.2, Pro offers are unfunded quotes (§1). |

## 1. Product in one paragraph

Naked **American calls, cash-settled in USDx**, on one underlying market per deployment (demo: fictional `EQTY`). Makers deposit USDx margin and sell calls without holding the underlying. Margin is computed from risk snapshots posted by a publisher role run by the team. **The holder may exercise the whole position before expiry** at the spot of a snapshot at most `exercise_max_age` (120 s) old, and is paid `qty × max(spot − K, 0)` from the writer's margin. Exercise is refused when the book belongs to the vault (paid at expiry, pro rata), when the writer is below maintenance margin (taken over first), or while the writer has expired debt without a settlement price. An account with NLV < MM is taken over by a solvent maker or by the **backstop vault** (LP-funded, a pseudo-account inside the contract). Positions left at expiry are paid at the settlement price: first from the owner's margin (pro rata across that writer's expired series), then from the vault pro rata across the series' shortfalls; any remainder is a recorded **deficit** borne by the holders. Pro offers are **unfunded quotes**: the margin check happens at `buy`. The AGENTS.md "funded executable offer" rule applies to Covered only. Nothing is shared with `contracts/options`.

## 2. Crate and units

- `contracts/pro/` with the same `Cargo.toml` shape as `contracts/options`. Dev-dependencies for the fixture test: `serde`, `serde_json` (std, test only).
- Amounts: `i128` in USDx units (7 decimals). Quantities: `i128` **whole lots** (1 lot = 1 underlying unit; nothing in the underlying ever moves). Time: `u64` ledger timestamp. Basis points: `BPS = 10_000`.
- All math checked (`checked_mul/add/sub`, `Overflow = 219`; the model's `chk()` marks the products that must be checked). Rounding, exactly as in the model:
  - `ceil_div(a, b) = -((-a).div_euclid(b))` for IM;
  - takeover price per series `q * mark * (BPS + bonus_bps) / BPS` truncates (floor);
  - reserve fee `premium * reserve_fee_bps / BPS` truncates;
  - LP shares truncate;
  - writer cash per book at settlement `floor(due * cash / total_expired_due)` when cash is short;
  - vault share of a book `floor(book.shortfall * vault_paid / series.shortfall)`; position payout `floor(pos_due * book_paid / book.due)`. Rounding dust (< 1 unit per position) stays in the series pool.

## 3. Constructor, config, roles

```rust
__constructor(admin: Address, publisher: Address, quote: Address /* USDx SAC */, cfg: MarketConfig)
// InvalidArgs if admin == publisher or cfg.validate() fails

#[contracttype] pub struct MarketConfig {
    psr_bps: u32,          // 1500  price scan range U            (0, BPS]
    ext_mult: u32,         // 2     extreme scenarios at ±ext_mult·U  [1, 4]
    short_min_bps: u32,    // 500   per-lot short floor           (0, BPS]
    im_bps: u32,           // 12500 IM = ceil(MM·im_bps/BPS)       [BPS, 3·BPS]
    max_age: u64,          // 3600  snapshot freshness, seconds   > 0
    max_series_oi: i128,   // 50_000 lots                         > 0
    max_writer_oi: i128,   // 20_000 lots (all series of one writer)  (0, max_series_oi]
    bonus_bps: u32,        // 500   takeover bonus over mark       ≤ 1000
    reserve_fee_bps: u32,  // 1000  share of each premium paid to the vault  ≤ BPS
    settle_window: u64,    // 86400                               > 0
    exercise_max_age: u64, // 120   max snapshot age for early exercise  (0, max_age]
}
```

Config and roles are immutable in v0.2. Scenario `limits_and_staleness` uses `max_writer_oi = 1500`, so each scenario deploys with its own `config`.

- `admin` may only call `list_series`.
- `publisher` may only call `publish_risk` and `publish_settlement`.
- Neither may deposit, quote, buy, take over or provide LP capital (`RoleNotAllowed`).
- **Trust:** the publisher's spot and settlement price decide every liquidation, early exercise and settlement. The snapshot bounds of §5 stop an inconsistent snapshot, not a wrong price. The demo feed is operated by the team and disclosed as such.

## 4. Storage and bounds

| Key | Storage | Value |
|---|---|---|
| `Admin`, `Publisher`, `Quote`, `Cfg`, `NextSeries`, `NextOffer`, `NextPos`, `NextBook`, `TotalShares`, `LiveSeries` | instance | scalars |
| `Series(u32)` | persistent | `{ strike, expiry, settlement_price: Option<i128>, oi, open_books: u32, shortfall, vault_paid, pool, claimed, closed }` |
| `Snap(u32)` | persistent | `{ seq: u64, ts: u64, spot, mark, ra: Vec<i128> /*16*/, smin, liq }` |
| `Acct(Address)` | persistent | `{ cash, shorts: Map<u32, i128> (≤ 8 series), books: Vec<u32> (≤ 16) }` |
| `VaultAcct` | persistent | `{ cash, shorts: Map<u32, i128> (≤ MAX_LIVE_SERIES) }`, no book list |
| `Book(u32)` | persistent | `{ series_id, owner: Writer, qty, settled, due, from_owner, shortfall }`, where `Writer = Account(Address) \| Vault` |
| `Offer(u32)` | persistent | `{ writer, series_id, qty, premium, quote_expiry, open }` (no reservation) |
| `Pos(u32)` | persistent | `{ series_id, holder, book: u32, qty, settled, exercised, paid, deficit }` |
| `Lp(Address)` | persistent | shares (no withdrawal in v0) |

Bounds and worst-case footprint per call. Dev 2 measured the v0.1 shape at every bound with a soroban-sdk 28 crate (round-2 review): `liquidate` 18 writes / 69 footprint entries, `exercise` 7 / 49, `buy` 10 / 51, against Testnet limits of 200 writes, 400 footprint entries and 16 KB of events per transaction. Reads for a vault-owned requirement are higher than the table suggests (up to 16 snapshots + 16 series):

| Call | Entries read (worst) | Entries written (worst) |
|---|---|---|
| `buy` | offer, series, writer acct, ≤ 8 snaps (requirement), book, config | offer, series, acct, vault acct, book, pos, 2 SAC balances |
| `exercise` | pos, book, series, owner acct, ≤ 8 snaps + ≤ 8 series | pos, book, series, owner acct, SAC balance ×2 |
| `liquidate` | writer acct, taker acct, ≤ 8 snaps + ≤ 8 series, ≤ 16 books | 2 accts, ≤ 16 books |
| `settle(book)` | book, series, owner acct, ≤ 16 books + their series (pro-rata total) | book, series, owner acct |
| `settle_vault` / `claim` | O(1) | O(1) |

- `MAX_SERIES_PER_ACCOUNT = 8`, `MAX_BOOKS_PER_ACCOUNT = 16` (`TooManyPositions = 220` beyond).
- `MAX_LIVE_SERIES = 16` series not yet closed (`TooManySeries` at `list_series`).
- `buy` adds to the account's oldest open book on the series, or opens one.
- Tests must hit every bound and measure the footprint at it.
- Extend TTL on every write, as `contracts/options` does. A permissionless `extend_ttl(series_ids, book_ids, pos_ids)` keeps idle entries alive through judging.

## 5. Risk arithmetic (the part to get exactly right)

Snapshot vector `ra[16]`: the **loss of one short lot** per scenario, rounded up (negative = gain). Index order is fixed:

- 0–13: price `{0, +⅓, −⅓, +⅔, −⅔, +1, −1}·U` × vol `{×1.25, ×0.75}`;
- 14: `+ext_mult·U`;
- 15: `−ext_mult·U`.

```
requirement(acct):
  for each short series (q > 0):
    live (now < expiry):  StaleSnapshot if now − snap.ts > max_age
                          liability += q·mark; pnl[w] += q·ra[w]; smin += q·smin; liq += q·liq
    expired:              expired += q·max(settlement_price − K, 0)        if published
                          expired += q·max(s_up(latest snap, any series) − K, 0)   otherwise (no freshness needed)
  scan = max(0, max_w pnl[w]);  mm = max(scan, smin) + liq;  im = ceil_div(mm·im_bps, BPS)
  nlv  = cash − liability − expired
```

`publish_risk` validates, in this order:
1. publisher auth;
2. series exists;
3. `now < expiry`, else `SeriesExpired`;
4. `snap.ts ≤ now` and `now − ts ≤ max_age`, else `StaleSnapshot`;
5. `seq` strictly increasing and `ts` non-decreasing;
6. `len(ra) == 16`, `spot > 0`, `liq ≥ 0`;
7. `max(spot − K, 0) ≤ mark ≤ spot`;
8. `smin ≥ ceil_div(spot·short_min_bps, BPS)`;
9. publisher-independent floor: with `s_up = spot·(BPS + ext_mult·psr_bps) / BPS` (floor), require `ra[14] ≥ max(s_up − K, 0) − mark`.

Failures 5 to 9 return `BadSnapshot`. They stop an inconsistent or under-margining snapshot **for the spot it states**; they do not check the spot.

## 6. Functions (signatures, auth, behavior)

Names and order follow `pro_v0_model.py`. `require_auth` is on the first `Address` argument unless stated otherwise.

```rust
list_series(admin, strike: i128, expiry: u64) -> u32      // TooManySeries if MAX_LIVE_SERIES not closed
publish_risk(publisher, series_id: u32, snap: Snapshot)
deposit(who, amount)                     // RoleNotAllowed for admin/publisher; always allowed otherwise (top-up)
withdraw(who, amount)                    // SeriesExpired if any expired unsettled short;
                                         // shorts? -> requirement and nlv − amount ≥ im
create_offer(writer, series_id, qty, premium_total, quote_expiry) -> u32   // no funds move; RoleNotAllowed
cancel_offer(writer, offer_id)
buy(buyer, offer_id) -> u32              // pos id. Order: NotFound, WrongState, SeriesExpired, SelfTrade,
                                         // RoleNotAllowed, OiCapExceeded, TooManySeries,
                                         // PremiumBelowMark (premium < qty·mark, fresh snapshot required),
                                         // premium buyer→contract; fee→vault; rest→writer cash;
                                         // book (TooManyPositions), shorts += qty; THEN nlv ≥ im else revert
exercise(holder, pos_id) -> {due, spot}  // American, whole position. Order: NotFound, Unauthorized (not holder),
                                         // WrongState (settled), SeriesExpired (now ≥ expiry),
                                         // NoEarlyExercise (book owned by the vault),
                                         // StaleSnapshot (now − snap.ts > exercise_max_age), OutOfTheMoney (spot ≤ K),
                                         // SettlementPending (owner has expired unpriced shorts),
                                         // LiquidateFirst (owner nlv < mm);
                                         // pay qty·(spot − K) from owner cash to holder; book/shorts/oi −= qty
liquidate(caller, writer, taker: Option<Address>)   // None = vault, anyone; Some(t): t == caller, auth
                                         // live = writer's shorts on series with now < expiry; none -> NotLiquidable
                                         // nlv < mm required; x = Σ_live floor(q·mark·(BPS+bonus)/BPS)
                                         // pay = min(x, max(cash − expired, 0)); deficit = x − pay
                                         // private taker: RoleNotAllowed, deficit > 0 -> InsolventTakeover,
                                         //   TooManySeries / OiCapExceeded / TooManyPositions (books)
                                         // move live shorts + live books (owner = taker); expired books stay
                                         // then private taker nlv ≥ im (InsufficientMargin); the vault always accepts
publish_settlement(publisher, series_id, price)      // expiry ≤ now ≤ expiry + settle_window; once; team-set
settle(book_id)                          // anyone. NotFound, NoSettlementPrice, WrongState if settled;
                                         // NoSettlementPrice if the owner has another expired series without
                                         // a price whose window is still open.
                                         // due = qty·max(price − K, 0); total = owner's expired priced debt;
                                         // from_owner = due if cash ≥ total else floor(due·cash/total)
                                         // (0 for a vault-owned book); shortfall = due − from_owner
settle_vault(series_id)                  // anyone. needs price, all books settled (open_books == 0), once.
                                         // vault_paid = min(series.shortfall, vault cash); series closed
claim(holder, pos_id) -> {due, paid, deficit}   // holder only; series closed; pays the caller only
lp_deposit(lp, amount) -> shares         // RoleNotAllowed; SettlementPending; first deposit ≥ 100 USDx;
                                         // shares = amount if total = 0 else amount·total/vault_value
// no LP withdrawal in v0 (cut after the second review)
extend_ttl(series_ids, book_ids, pos_ids)   // anyone; contract-only (not in the model or fixtures)
// views
get_requirement(who: Writer) -> Requirement { nlv, liability, expired, scan, smin, liq, mm, im, worst }
get_account(who: Writer), get_book(id), get_position(id), get_series(id), get_snapshot(id), vault_value()
```

`vault_value` is the vault cash when it has no shorts, otherwise its NLV. NLV needs fresh snapshots for live series only, so LP flows fail with `StaleSnapshot` only while the vault holds a stale **live** short.

Events: `SeriesListed`, `RiskPublished`, `Deposited`, `Withdrawn`, `OfferCreated`, `OfferCancelled`, `Bought{pos, holder, writer, qty, premium, fee}`, `Exercised{pos, holder, owner, qty, spot, due}`, `TakenOver{writer, taker, x, paid, deficit}`, `SettlementPublished`, `BookSettled{book, owner, due, from_owner, shortfall}`, `VaultSettled{series, shortfall, vault_paid, deficit}`, `Claimed{pos, holder, due, paid, deficit}`, `LpDeposited`. Every event is fixed-size, so no call comes near the 16 KB event limit.

Errors (`#[contracterror]`, codes from `ERRORS` in the model): `InvalidArgs 201, NotFound 202, Unauthorized 203, WrongState 204, SeriesExpired 205, NotExpired 206, StaleSnapshot 207, BadSnapshot 208, InsufficientMargin 209, OiCapExceeded 210, NotLiquidable 211, VaultCapacity 212, NoSettlementPrice 213, SettlementWindowClosed 214, WithdrawLocked 215 (reserved, unused in v0), TooManySeries 216, SelfTrade 217, InsolventTakeover 218, Overflow 219, TooManyPositions 220, RoleNotAllowed 221, PremiumBelowMark 222, OutOfTheMoney 223, LiquidateFirst 224, SettlementPending 225, NoEarlyExercise 226`.

**Note on `Unauthorized`.** The model returns it where Soroban would panic on missing auth (wrong publisher, wrong admin, liquidator ≠ taker, exercise or claim by a non-holder). In Rust:
- check the role or the holder explicitly with `if caller != stored { Err(Unauthorized) }` and also call `caller.require_auth()`;
- in the fixture test, sign with `mock_all_auths` and assert the error code.

## 7. Fixture replay test (`contracts/pro/tests/fixtures.rs`)

For each scenario:
1. Create a fresh `Env` and a USDx SAC.
2. Map each actor name to `Address::generate`. `ADMIN`, `PUBLISHER`, `KEEPER` and `MAKER_C` may have no wallet; `VAULT` maps to `None` or `Writer::Vault`.
3. Mint `initial_wallets`.
4. Set the ledger timestamp to `t0`, then deploy with the scenario's `config`.
5. Replay each `step`:
   - `set_time` sets the ledger timestamp;
   - `get_requirement` compares the view with `result`;
   - any other `op` calls `try_<op>` and compares `expect` (`"ok"` or `{error, code}`) and `result`.
6. After each step that has a `state` field, compare it:
   - every listed account's `cash`, `shorts` and `books`;
   - every `wallets[x]` against the SAC balance;
   - `contract_balance` against the SAC balance of the contract;
   - every series field, every book, every position;
   - `lp_shares` and `total_shares`.

Snapshots in `publish_risk.args[1]` are already integers: pass them through unchanged. `liquidate` refers to the vault as the string `"VAULT"`; `settle` takes a book id.

Regenerate the fixtures with `cd packages/risk && python gen_pro_fixtures.py`. The output is deterministic, and the script fails if the reference model breaks one of its own expectations or invariants (balance = accounts + pools; shorts = books = open longs = OI per series).

## 8. Testnet and scripts (with Dev 3), only once the contract passes §7

- `scripts/deploy/deploy-pro.sh`: deploy with the existing USDx SAC from AGENTS.md and two distinct team identities `strata-pro-admin` and `strata-pro-publisher`, plus the default config.
- Seed the vault with team USDx via `lp_deposit`. It is labelled as team seed capital, not third-party liquidity.
- Publisher loop (Dev 3, using `packages/risk`):
  1. read a demo price;
  2. `make_snapshot()` in `gen_pro_fixtures.py`;
  3. `stellar contract invoke … publish_risk`.
- The keeper calls `liquidate(…, None)` whenever `get_requirement` shows `nlv < mm`. After expiry it calls `settle` on every book, then `settle_vault`.
- Evidence to record: list_series, publish_risk, deposit, buy, exercise, publish_risk at the higher price, liquidate to the vault, publish_settlement, settle, settle_vault, claim.

## 9. Cut order and never-cut list

Already cut in v0.2: LP withdrawal (deposit only; say withdrawals are not implemented).

Cut, in this order:
1. Early exercise (European only: positions settle at expiry). The newest surface goes first.
2. Private takers (keep vault-only `liquidate`).
3. Multi-series accounts (one series per account).
4. Offers (writer and buyer co-sign a single `sell(writer, buyer, series, qty, premium)`).

Never cut:
- the margin check after `buy`, and `PremiumBelowMark`;
- the snapshot bounds in §5;
- the rollback on failure;
- role separation (`admin ≠ publisher`, both barred from the market);
- pull claims (`claim`), never pushed payouts;
- the post-expiry `withdraw` block and the `SettlementPending` LP freeze;
- book-level `liquidate` and O(1) settlement (the storage bounds of §4, tested at the cap);
- if early exercise ships: `NoEarlyExercise` on vault-owned books, `exercise_max_age`, `SettlementPending` against a writer with expired unpriced debt, and `LiquidateFirst` against an unhealthy writer;
- pro-rata vault coverage within a series, and pro-rata writer cash across its expired series.

## 10. Known limits to disclose (README and UI)

- **The publisher is trusted.** Its spot and settlement price decide liquidations, early exercises and payouts. The §5 bounds only reject inconsistent snapshots. The demo feed and the settlement price are operated by the team.
- **Early exercise is paid at the publisher's spot** (snapshot ≤ 120 s old), not at a live market price. It is refused when the vault owns the position (paid at expiry, pro rata), when the writer is unhealthy (taken over first) or while the writer has expired debt without a price.
- The vault always takes over an account below MM, even when that pushes the vault below its own margin or below zero. Within a series the vault pays pro rata; across series it pays in `settle_vault` order.
- **LP capital cannot be withdrawn in v0.** A deposit is priced at the vault's value, which does not include writers that are insolvent but not yet taken over: a deposit made in that window (before the keeper acts) buys into a hidden loss. New deposits are refused while the vault's value is ≤ 0.
- The payoff is not guaranteed beyond writer margin plus vault cash. Holders can take a haircut, which is shown as `deficit`.
- Settlement uses one price, not a TWAP. If the window closes with no price, the series never closes and keeps one of the 16 live-series slots; margin and claims stay locked. A price ≥ 2^120 would overflow and lock the series. v1 needs a bounded or two-step settlement price, an overflow guard, a fallback oracle, publisher key rotation and a permissionless close for expired zero-OI series. A stale snapshot on any series of a writer blocks early exercise against that writer (publisher liveness).
- The per-lot liquidity add-on is sized at `max_writer_oi`; the vault can exceed that size, so its add-on is understated.
- LP shares round down. The minimum first deposit limits, but does not remove, share-price manipulation by fee donations (a sole LP can still inflate the share price through self-dealt premiums).
- The margin engine (`strata_risk.py`) values the calls as European. For a non-dividend underlying an American call has the same value, so margins are unchanged; early exercise only brings the payment forward. A dividend-paying or yield-bearing underlying would need an early-exercise premium in the mark.
- Parameters are illustrative, taken from the liquid-equity calibration. They do not suit thin RWAs, which stay in the Covered regime.
