# Strata Pro v0 — build brief for Dev 2

Owner: Dev 2 (contract). Spec owner: Dev 1. Status: **experimental track**, GO from Dev 1 on 2026-10-25 (see AGENTS.md "Strata Pro"). Dev 2 keeps the veto on unsafe behavior: if anything below is unsafe or unbuildable by 04:00, cut it (§9) and tell Dev 1.

**The executable spec is `packages/risk/pro_v0_model.py`.** Every function below exists there with the same checks, in the same order, with the same errors. When this brief and the model disagree, the model wins and the brief is a bug. Background and calibration: `docs/pro-architecture.md`.

**Done means:** `contracts/pro` replays every scenario in `packages/risk/fixtures/pro_v0.json` (7 scenarios, 120 steps) with identical results, error codes and state, plus a Testnet run of fill → price move → vault liquidation → settlement, with the transaction hashes recorded in `docs/contract-testnet-evidence.md`.

## 1. Product in one paragraph

Naked **European calls, cash-settled in USDx**, one underlying market per deployment. Makers deposit USDx margin and sell calls without holding the underlying. Margin is computed from risk snapshots signed by a publisher role. An account with NLV < MM is taken over, either by a solvent maker or by the **backstop vault** (LP-funded, a pseudo-account inside the contract). At expiry, the payoff `qty × max(S_T − K, 0)` is paid from the writer's margin, then from the vault; any remainder is a recorded deficit, shared pro rata between that writer's holders. Nothing is shared with `contracts/options`.

## 2. Crate and units

- `contracts/pro/` with the same `Cargo.toml` shape as `contracts/options` (the workspace already globs `contracts/*`). Dev-dependencies for the fixture test: `serde`, `serde_json` (std, test only).
- Amounts: `i128` in USDx units (7 decimals). Quantities: `i128` **whole lots** (1 lot = 1 underlying unit; nothing in the underlying ever moves). Time: `u64` ledger timestamp. Basis points: `BPS = 10_000`.
- All math checked (`checked_mul/add/sub`, `Overflow = 219`). Rounding rules, exactly as in the model:
  - `ceil_div(a, b) = -((-a).div_euclid(b))` for IM;
  - takeover price per series `q * mark * (BPS + bonus_bps) / BPS` truncates (floor);
  - reserve fee `premium * reserve_fee_bps / BPS` truncates;
  - LP shares and LP withdrawal amounts truncate;
  - pro-rata settlement: `floor(due_i * paid / due_total)`, then leftover units handed one at a time in increasing position id.

## 3. Constructor, config, roles

```rust
__constructor(admin: Address, publisher: Address, quote: Address /* USDx SAC */, cfg: MarketConfig)

#[contracttype] pub struct MarketConfig {
    psr_bps: u32,          // 1500  price scan range U
    ext_mult: u32,         // 2     extreme scenarios at ±ext_mult·U
    short_min_bps: u32,    // 500   per-lot short floor, fraction of spot
    im_bps: u32,           // 12500 IM = ceil(MM·im_bps/BPS)
    max_age: u64,          // 3600  snapshot freshness, seconds
    max_series_oi: i128,   // 50_000 lots
    max_writer_oi: i128,   // 20_000 lots (all series of one writer)
    bonus_bps: u32,        // 500   takeover bonus over mark (constructor rejects > 1000, InvalidArgs; contract-only check)
    reserve_fee_bps: u32,  // 1000  share of each premium paid to the vault
    lp_notice: u64,        // 604800 (7 days)
    settle_window: u64,    // 86400
}
```

Config is immutable in v0, and so is the publisher role. Fixture scenario `limits_and_staleness` uses `max_writer_oi = 1500`, so each scenario deploys with its own `config`. `admin` may only call `list_series`. `publisher` may only call `publish_risk` and `publish_settlement`. Neither can move balances.

## 4. Storage

| Key | Storage | Value |
|---|---|---|
| `Admin`, `Publisher`, `Quote`, `Cfg`, `NextSeries`, `NextOffer`, `NextPos`, `TotalShares` | instance | scalars |
| `Series(u32)` | persistent | `{ strike: i128, expiry: u64, settlement_price: Option<i128>, oi: i128 }` |
| `Snap(u32)` | persistent | `{ seq: u64, ts: u64, spot, mark, ra: Vec<i128> /*16*/, smin, liq }` |
| `Acct(Address)` | persistent | `{ cash: i128, shorts: Map<u32, i128> }` (≤ 8 series) |
| `VaultAcct` | persistent | same shape; the vault is not an `Address` |
| `Offer(u32)` | persistent | `{ writer, series_id, qty, premium, quote_expiry, open }` (no reservation) |
| `Pos(u32)` | persistent | `{ series_id, holder, writer: Writer, qty, settled, paid, deficit }`, where `Writer = Account(Address) \| Vault` |
| `WriterPos(Writer, u32 series)` | persistent | `Vec<u32>` open position ids. Bound: **50 per (writer, series)**; the vault gets 200. Beyond that, `TooManyPositions = 220` |
| `Lp(Address)`, `LpReq(Address)` | persistent | shares; `(shares, unlock_at)` |

The model scans all positions. The contract must use `WriterPos` instead: `liquidate` moves every `WriterPos(writer, s)` list onto the taker, and `settle` reads one list. Extend the TTL on every write, as `contracts/options` does.

## 5. Risk arithmetic (the part to get exactly right)

Snapshot vector `ra[16]`: the **loss of one short lot** per scenario, rounded up (negative = gain). Index order is fixed:

- 0–13: price `{0, +⅓, −⅓, +⅔, −⅔, +1, −1}·U` × vol `{×1.25, ×0.75}`;
- 14: `+ext_mult·U`;
- 15: `−ext_mult·U`.

```
requirement(acct):            // StaleSnapshot if any short series has now − snap.ts > max_age
  liability = Σ q·mark
  pnl[w]    = Σ q·ra[w]                for w in 0..16
  scan      = max(0, max_w pnl[w])
  mm        = max(scan, Σ q·smin) + Σ q·liq
  im        = ceil_div(mm·im_bps, BPS)
  nlv       = cash − liability
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
9. **the publisher-independent floor**: with `s_up = spot·(BPS + ext_mult·psr_bps) / BPS` (floor), require `ra[14] ≥ max(s_up − K, 0) − mark`.

Failures 5 to 9 return `BadSnapshot`. Check 9 is what stops a lazy or captured publisher from under-margining naked calls.

## 6. Functions (signatures, auth, behavior)

Names and order follow `pro_v0_model.py`. `require_auth` is on the first `Address` argument unless stated otherwise.

```rust
list_series(admin, strike: i128, expiry: u64) -> u32
publish_risk(publisher, series_id: u32, snap: Snapshot)
deposit(who, amount)                     // always allowed (top-up), even with stale snapshots
withdraw(who, amount)                    // shorts? -> requirement fresh and nlv − amount ≥ im
create_offer(writer, series_id, qty, premium_total, quote_expiry) -> u32   // no funds move
cancel_offer(writer, offer_id)
buy(buyer, offer_id) -> u32              // pos id; checks: open, not expired, SelfTrade, OI caps, ≤8 series;
                                         // premium buyer→contract; fee→vault; rest→writer cash;
                                         // writer shorts += qty; THEN requirement(writer): nlv ≥ im else revert
liquidate(caller, writer, taker: Option<Address>)   // None = vault, callable by anyone (no auth)
                                         // Some(t): t.require_auth(), t == caller
                                         // checks: has shorts, all its series before expiry, fresh, nlv < mm
                                         // x = Σ floor(q·mark·(BPS+bonus)/BPS); pay = min(x, cash); deficit = x − pay
                                         // private taker and deficit > 0 -> InsolventTakeover
                                         // move cash, shorts, WriterPos, Pos.writer; then
                                         // private taker: nlv ≥ im (InsufficientMargin); vault: nlv ≥ mm (VaultCapacity)
publish_settlement(publisher, series_id, price)      // expiry ≤ now ≤ expiry + settle_window; once
settle(writer: Writer, series_id)        // permissionless; pays all positions of (writer, series) pro rata:
                                         // from writer cash, then (writer ≠ vault) vault cash; transfers to holders
lp_deposit(lp, amount) -> shares         // shares = amount if total = 0 else amount·total/vault_value
lp_request_withdraw(lp, shares)          // one request per LP; unlock_at = now + lp_notice
lp_withdraw(lp) -> amount                // after unlock; amount = max(value,0)·shares/total;
                                         // vault with shorts: nlv − amount ≥ im, else VaultCapacity
// views
get_requirement(who: Writer) -> Requirement { nlv, liability, scan, smin, liq, mm, im, worst }
get_account(who: Writer), get_position(id), get_series(id), get_snapshot(id), vault_value()
```

`vault_value` is the vault cash when it has no shorts, otherwise its NLV. NLV needs fresh snapshots, so `lp_deposit` and `lp_withdraw` fail `StaleSnapshot` while the vault holds a stale short.

Events: `SeriesListed`, `RiskPublished`, `Deposited`, `Withdrawn`, `OfferCreated`, `OfferCancelled`, `Bought{pos, holder, writer, qty, premium, fee}`, `TakenOver{writer, taker, x, paid, deficit}`, `SettlementPublished`, `Settled{writer, series, due, from_writer, from_vault, deficit}`, `LpDeposited`, `LpWithdrawRequested`, `LpWithdrawn`.

Errors (`#[contracterror]`, codes from `ERRORS` in the model): `InvalidArgs 201, NotFound 202, Unauthorized 203, WrongState 204, SeriesExpired 205, NotExpired 206, StaleSnapshot 207, BadSnapshot 208, InsufficientMargin 209, OiCapExceeded 210, NotLiquidable 211, VaultCapacity 212, NoSettlementPrice 213, SettlementWindowClosed 214, WithdrawLocked 215, TooManySeries 216, SelfTrade 217, InsolventTakeover 218, Overflow 219, TooManyPositions 220`.

**Note on `Unauthorized`.** The model returns it where Soroban would panic on missing auth (wrong publisher, wrong admin, liquidator ≠ taker). In Rust:
- check the role explicitly with `if caller != stored_role { Err(Unauthorized) }` and also call `caller.require_auth()`;
- in the fixture test, sign with `mock_all_auths` and assert the error code.

## 7. Fixture replay test (`contracts/pro/tests/fixtures.rs`)

For each scenario:
1. Create a fresh `Env` and a USDx SAC.
2. Map each actor name to `Address::generate`. `ADMIN`, `PUBLISHER`, `KEEPER` and `MAKER_C` have no wallet; `VAULT` maps to `None` or `Writer::Vault`.
3. Mint `initial_wallets`.
4. Set the ledger timestamp to `t0`, then deploy with the scenario's `config`.
5. Replay each `step`:
   - `set_time` sets the ledger timestamp;
   - `get_requirement` compares the view with `result`;
   - any other `op` calls `try_<op>` and compares `expect` (`"ok"` or `{error, code}`) and `result`.
6. After each step that has a `state` field, compare it:
   - every listed account's `cash` and `shorts`;
   - every `wallets[x]` against the SAC balance;
   - `contract_balance` against the SAC balance of the contract;
   - series `oi` and `settlement_price`;
   - every position;
   - `lp_shares` and `total_shares`.

Snapshots in `publish_risk.args[1]` are already integers: pass them through unchanged. `settle` and `liquidate` refer to the vault as the string `"VAULT"`.

Regenerate the fixtures with `cd packages/risk && python gen_pro_fixtures.py`. The output is deterministic, and the script fails if the reference model breaks one of its own expectations.

## 8. Testnet and scripts (with Dev 3)

- `scripts/deploy/deploy-pro.sh`: deploy with the existing USDx SAC from AGENTS.md, a team `strata-pro-admin` and a `strata-pro-publisher` identity, and the default config.
- Seed the vault with team USDx via `lp_deposit`. It is labelled as team seed capital, not third-party liquidity.
- Publisher loop (Dev 3, using `packages/risk`):
  1. read a demo price;
  2. `make_snapshot()` in `gen_pro_fixtures.py`;
  3. `stellar contract invoke … publish_risk`.

  The keeper calls `liquidate(…, None)` whenever `get_requirement` shows `nlv < mm`.
- Evidence to record: list_series, publish_risk, deposit, buy, publish_risk at the higher price, liquidate to the vault, publish_settlement, settle.

## 9. Cut order if 04:00 is at risk

1. LP withdrawal (keep `lp_deposit` only, and say withdrawals are not implemented).
2. Private takers (keep vault-only `liquidate`).
3. Multi-series accounts (one series per account).
4. Offers (writer and buyer co-sign a single `sell(writer, buyer, series, qty, premium)`).

Never cut:
- the margin check after `buy`;
- the snapshot bounds in §5;
- the rollback on failure;
- pro-rata settlement.

## 10. Known limits to disclose (README)

- The publisher is trusted within the bounds of §5. The demo price feed is run by the team.
- The vault draws on its cash for an insolvent writer even if that leaves its own shorts below margin. The deficit is recorded, not hidden.
- Settlement uses the price at expiry, not a TWAP (v1). If the window closes with no price, funds stay locked (v1: fallback oracle).
- The payoff is not guaranteed beyond writer margin plus vault cash. Holders can take a haircut.
