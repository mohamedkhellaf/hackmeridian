//! Negative and footprint tests for the StellSec Pro contract (brief `docs/pro-v0-brief-dev2.md` §4, §7).
//!
//! Every expected value below was produced by driving the executable spec
//! `packages/risk/pro_v0_model.py` (v0.3.2) through the same sequence; nothing is derived from the Rust
//! implementation. Snapshot constants come from `gen_pro_fixtures.make_snapshot` at spot 100 / 105 / 130
//! for a series with strike 110 USDx expiring 21 days after T0, published at `ts = T0`.
//!
//! Conventions: amounts are 7-decimal USDx units; typed errors come back from `try_*` as `Err(Ok(Error::X))`;
//! all auth is mocked; actors are contract-style addresses so SAC balances are plain i128.

use pro::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::StellarAssetClient,
    Address, Env, Vec,
};
use std::fmt::Debug;

// ---------------------------------------------------------------------------------------------
// Constants (mirroring the Python probe)
// ---------------------------------------------------------------------------------------------

const SCALE: i128 = 10_000_000;
const T0: u64 = 1_800_000_000;
const DAY: u64 = 86_400;
const EXPIRY: u64 = T0 + 21 * DAY;
const K: i128 = 110 * SCALE;

/// Premium per lot at spot 100 (mark 0.5628819 USDx): 0.6 USDx.
const PREM: i128 = 6_000_000;
/// Margin per lot: passes IM at spot 100, liquidable at spot 105.
const THIN: i128 = 25 * SCALE;
/// Margin per lot: healthy at 105 (can take over 8 thin lots), liquidable at 130 with no deficit.
const RICH: i128 = 70 * SCALE;
/// Margin per lot: healthy at 130 with 16 lots.
const SAFE: i128 = 150 * SCALE;
/// Margin per lot for the writers the vault takes over at 130 (liquidable, no deficit).
const VLT: i128 = 40 * SCALE;
/// Wallet funding for every actor.
const FUND: i128 = 1_000_000_000 * SCALE;

const CAP_READS: u32 = 400;
const CAP_WRITES: u32 = 200;

// make_snapshot(m, sid, seq, 100.0)
const S100_SPOT: i128 = 1_000_000_000;
const S100_MARK: i128 = 5_628_819;
const S100_SMIN: i128 = 50_000_000;
const S100_LIQ: i128 = 708_083;
const S100_RA: [i128; 16] = [
    5249763, -3753884, 18699597, 3416907, -1673198, -5412102, 40401735, 21997654, -4511958, -5616658,
    70604552, 54384485, -5396884, -5628534, 195246392, -5628817,
];
// make_snapshot(m, sid, seq, 105.0)
const S105_SPOT: i128 = 1_050_000_000;
const S105_MARK: i128 = 16_377_828;
const S105_SMIN: i128 = 52_500_000;
const S105_LIQ: i128 = 2_457_436;
const S105_RA: [i128; 16] = [
    7950588, -7332101, 30965792, 12547952, -5981220, -14669258, 63307072, 47534869, -12849285, -16209572,
    103515723, 93342517, -15476799, -16370479, 248787102, -16377815,
];
// make_snapshot(m, sid, seq, 130.0)
const S130_SPOT: i128 = 1_300_000_000;
const S130_MARK: i128 = 200_875_211;
const S130_SMIN: i128 = 65_000_000;
const S130_LIQ: i128 = 17_557_355;
const S130_RA: [i128; 16] = [
    2094611, -782326, 65060123, 64130773, -57541280, -64925279, 129388121, 129125055, -110411507, -124693720,
    194191837, 194124799, -152197065, -170614308, 389124794, -200528601,
];

#[derive(Clone, Copy)]
enum Spot {
    S100,
    S105,
    S130,
}

// ---------------------------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------------------------

struct T {
    env: Env,
    c: ProContractClient<'static>,
    usdx: Address,
    admin: Address,
    publisher: Address,
}

fn default_cfg() -> MarketConfig {
    MarketConfig {
        psr_bps: 1_500,
        ext_mult: 2,
        short_min_bps: 500,
        im_bps: 12_500,
        max_age: 3_600,
        max_series_oi: 50_000,
        max_writer_oi: 20_000,
        bonus_bps: 500,
        reserve_fee_bps: 1_000,
        settle_window: 86_400,
        exercise_max_age: 120,
    }
}

fn setup() -> T {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(T0);
    let usdx_issuer = Address::generate(&env);
    let usdx = env.register_stellar_asset_contract_v2(usdx_issuer).address();
    let admin = Address::generate(&env);
    let publisher = Address::generate(&env);
    let contract = env.register(ProContract, (&admin, &publisher, &usdx, &default_cfg()));
    let c = ProContractClient::new(&env, &contract);
    let t = T { env, c, usdx, admin, publisher };
    // Roles hold USDx too, so role rejections are not balance rejections.
    mint(&t, &t.admin.clone());
    mint(&t, &t.publisher.clone());
    t
}

fn mint(t: &T, who: &Address) {
    StellarAssetClient::new(&t.env, &t.usdx).mint(who, &FUND);
}

/// A funded private actor.
fn actor(t: &T) -> Address {
    let a = Address::generate(&t.env);
    mint(t, &a);
    a
}

fn assert_err<V: Debug, E: Debug>(res: Result<V, Result<Error, E>>, expected: Error) {
    match res {
        Err(Ok(e)) => assert_eq!(e, expected),
        other => panic!("expected Err(Ok({expected:?})), got {other:?}"),
    }
}

fn snapshot(env: &Env, sid: u32, seq: u64, spot: Spot) -> Snapshot {
    let (s, mark, ra, smin, liq) = match spot {
        Spot::S100 => (S100_SPOT, S100_MARK, &S100_RA, S100_SMIN, S100_LIQ),
        Spot::S105 => (S105_SPOT, S105_MARK, &S105_RA, S105_SMIN, S105_LIQ),
        Spot::S130 => (S130_SPOT, S130_MARK, &S130_RA, S130_SMIN, S130_LIQ),
    };
    let mut v: Vec<i128> = Vec::new(env);
    for x in ra.iter() {
        v.push_back(*x);
    }
    Snapshot { series_id: sid, seq, ts: T0, spot: s, mark, ra: v, smin, liq }
}

/// Lists `n` series (ids 0..n), all strike K expiring at EXPIRY.
fn list_n(t: &T, n: u32) {
    for i in 0..n {
        assert_eq!(t.c.list_series(&t.admin, &K, &EXPIRY), i);
    }
}

fn publish_all(t: &T, n: u32, seq: u64, spot: Spot) {
    for sid in 0..n {
        t.c.publish_risk(&t.publisher, &snapshot(&t.env, sid, seq, spot));
    }
}

/// Writer deposits `deposit` (if > 0), posts an offer of `qty` lots at `premium_per_lot`, holder fills it.
/// Returns the position id.
fn sell_at(t: &T, writer: &Address, holder: &Address, sid: u32, qty: i128, deposit: i128, premium_per_lot: i128) -> u32 {
    if deposit > 0 {
        t.c.deposit(writer, &deposit);
    }
    let oid = t.c.create_offer(writer, &sid, &qty, &(qty * premium_per_lot), &EXPIRY);
    t.c.buy(holder, &oid)
}

fn sell(t: &T, writer: &Address, holder: &Address, sid: u32, qty: i128, deposit: i128) -> u32 {
    sell_at(t, writer, holder, sid, qty, deposit, PREM)
}

/// Reads the footprint of the last invocation and asserts the brief §4 caps.
fn footprint(t: &T, label: &str) -> (u32, u32) {
    let r = t.env.cost_estimate().resources();
    let reads = r.memory_read_entries + r.disk_read_entries;
    let writes = r.write_entries;
    println!(
        "FOOTPRINT {label}: reads={reads} (mem {} / disk {}) writes={writes} events_bytes={} instructions={}",
        r.memory_read_entries, r.disk_read_entries, r.contract_events_size_bytes, r.instructions
    );
    assert!(reads <= CAP_READS, "{label}: {reads} ledger keys read > {CAP_READS}");
    assert!(writes <= CAP_WRITES, "{label}: {writes} ledger keys written > {CAP_WRITES}");
    (reads, writes)
}

// ---------------------------------------------------------------------------------------------
// Cap state: 16 live series; W has 8 series and 16 books (8 own + 8 taken over from W2); the vault is
// short in all 16 series (took over WA on 0..7 and WB on 8..15 at spot 130); current snapshot is S130.
// ---------------------------------------------------------------------------------------------

struct Cap {
    w: Address,
    h: Address,
    /// Holder's positions on W's own books, by series 0..7 (pos ids 0..7).
    pos_w: std::vec::Vec<u32>,
    /// Holder's positions on the books W took over from W2 (pos ids 8..15).
    pos_w2: std::vec::Vec<u32>,
    /// Holder's positions on WA's books, now vault-owned (pos ids 16..23).
    pos_wa: std::vec::Vec<u32>,
}

/// Model probe (cap_state in the Python probe), `w_dep` = RICH or SAFE:
/// - W takes over W2 at 105: x = paid = 137_573_752, deficit 0; W then has 16 books, 8 series.
/// - vault takes over WA and WB at 130: x = paid = 1_687_351_768 each, deficit 0; vault short in 16 series,
///   vault cash 19_200_000, reserved 3_374_703_536, vault_value 179_900_160.
/// - RICH: W at 130 has nlv 2_566_770_376 < mm 6_506_914_384 (liquidable, x = 3_374_703_544, no deficit).
/// - SAFE: W at 130 has nlv 8_966_770_376 >= mm (healthy), im 8_133_642_980.
fn cap_state(t: &T, w_dep: i128) -> Cap {
    let w = actor(t);
    let w2 = actor(t);
    let wa = actor(t);
    let wb = actor(t);
    let h = actor(t);
    list_n(t, 16);
    publish_all(t, 16, 1, Spot::S100);
    let pos_w: std::vec::Vec<u32> = (0..8).map(|s| sell(t, &w, &h, s, 1, w_dep)).collect();
    let pos_w2: std::vec::Vec<u32> = (0..8).map(|s| sell(t, &w2, &h, s, 1, THIN)).collect();
    let pos_wa: std::vec::Vec<u32> = (0..8).map(|s| sell(t, &wa, &h, s, 1, VLT)).collect();
    for s in 8..16 {
        sell(t, &wb, &h, s, 1, VLT);
    }
    publish_all(t, 16, 2, Spot::S105);
    let r = t.c.liquidate(&w, &w2, &Some(w.clone()));
    assert_eq!(r, TakeoverResult { x: 137_573_752, paid: 137_573_752, deficit: 0 });
    let acct = t.c.get_account(&w);
    assert_eq!(acct.books.len(), 16);
    assert_eq!(acct.shorts.len(), 8);
    publish_all(t, 16, 3, Spot::S130);
    let anyone = actor(t);
    let expect = TakeoverResult { x: 1_687_351_768, paid: 1_687_351_768, deficit: 0 };
    assert_eq!(t.c.liquidate(&anyone, &wa, &None), expect);
    assert_eq!(t.c.liquidate(&anyone, &wb, &None), expect);
    let v = t.c.get_vault();
    assert_eq!(v.shorts.len(), 16);
    assert_eq!(v.cash, 19_200_000);
    assert_eq!(v.reserved, 3_374_703_536);
    assert_eq!(t.c.vault_value(), 179_900_160);
    Cap { w, h, pos_w, pos_w2, pos_wa }
}

// ---------------------------------------------------------------------------------------------
// Constructor and roles
// ---------------------------------------------------------------------------------------------

#[test]
#[should_panic(expected = "Error(Contract, #201)")]
fn constructor_rejects_admin_equals_publisher() {
    let env = Env::default();
    env.mock_all_auths();
    let usdx = env.register_stellar_asset_contract_v2(Address::generate(&env)).address();
    let a = Address::generate(&env);
    env.register(ProContract, (&a, &a, &usdx, &default_cfg()));
}

#[test]
#[should_panic(expected = "Error(Contract, #201)")]
fn constructor_rejects_invalid_config() {
    let env = Env::default();
    env.mock_all_auths();
    let usdx = env.register_stellar_asset_contract_v2(Address::generate(&env)).address();
    let mut cfg = default_cfg();
    cfg.psr_bps = 0; // model: 0 < psr_bps <= BPS
    env.register(ProContract, (&Address::generate(&env), &Address::generate(&env), &usdx, &cfg));
}

#[test]
fn roles_get_role_not_allowed_on_market_entrypoints() {
    let t = setup();
    list_n(&t, 1);
    publish_all(&t, 1, 1, Spot::S100);
    let w2 = actor(&t);
    let h = actor(&t);
    sell(&t, &w2, &h, 0, 1, THIN);
    let oid = t.c.create_offer(&w2, &0, &1, &PREM, &EXPIRY);
    for role in [t.admin.clone(), t.publisher.clone()] {
        assert_err(t.c.try_deposit(&role, &SCALE), Error::RoleNotAllowed);
        assert_err(t.c.try_create_offer(&role, &0, &1, &PREM, &EXPIRY), Error::RoleNotAllowed);
        assert_err(t.c.try_buy(&role, &oid), Error::RoleNotAllowed);
        assert_err(t.c.try_lp_deposit(&role, &MIN_FIRST_LP), Error::RoleNotAllowed);
    }
    // W2 becomes liquidable at 105; a role may not be the private taker.
    publish_all(&t, 1, 2, Spot::S105);
    for role in [t.admin.clone(), t.publisher.clone()] {
        assert_err(t.c.try_liquidate(&role, &w2, &Some(role.clone())), Error::RoleNotAllowed);
    }
}

#[test]
fn publish_risk_from_non_publisher_is_unauthorized() {
    let t = setup();
    list_n(&t, 1);
    let x = actor(&t);
    assert_err(t.c.try_publish_risk(&x, &snapshot(&t.env, 0, 1, Spot::S100)), Error::Unauthorized);
    assert_err(t.c.try_publish_risk(&t.admin, &snapshot(&t.env, 0, 1, Spot::S100)), Error::Unauthorized);
}

#[test]
fn list_series_from_non_admin_is_unauthorized() {
    let t = setup();
    let x = actor(&t);
    assert_err(t.c.try_list_series(&x, &K, &EXPIRY), Error::Unauthorized);
    assert_err(t.c.try_list_series(&t.publisher, &K, &EXPIRY), Error::Unauthorized);
}

#[test]
fn liquidate_caller_not_taker_is_unauthorized() {
    let t = setup();
    list_n(&t, 1);
    publish_all(&t, 1, 1, Spot::S100);
    let w2 = actor(&t);
    let h = actor(&t);
    sell(&t, &w2, &h, 0, 1, THIN);
    publish_all(&t, 1, 2, Spot::S105);
    let x = actor(&t);
    let y = actor(&t);
    assert_err(t.c.try_liquidate(&x, &w2, &Some(y)), Error::Unauthorized);
}

#[test]
fn first_lp_deposit_below_min_is_invalid_args() {
    let t = setup();
    let lp = actor(&t);
    assert_err(t.c.try_lp_deposit(&lp, &(MIN_FIRST_LP - 1)), Error::InvalidArgs);
    assert_eq!(t.c.lp_deposit(&lp, &MIN_FIRST_LP), MIN_FIRST_LP);
}

// ---------------------------------------------------------------------------------------------
// NotFound on every id-taking call
// ---------------------------------------------------------------------------------------------

#[test]
fn not_found_on_every_id_taking_call() {
    let t = setup();
    list_n(&t, 1);
    publish_all(&t, 1, 1, Spot::S100);
    let w = actor(&t);
    let h = actor(&t);
    let missing = 99u32;
    // series
    assert_err(t.c.try_publish_risk(&t.publisher, &snapshot(&t.env, missing, 1, Spot::S100)), Error::NotFound);
    assert_err(t.c.try_publish_settlement(&t.publisher, &missing, &1), Error::NotFound);
    assert_err(t.c.try_create_offer(&w, &missing, &1, &PREM, &EXPIRY), Error::NotFound);
    assert_err(t.c.try_settle_vault(&missing), Error::NotFound);
    assert_err(t.c.try_get_series(&missing), Error::NotFound);
    assert_err(t.c.try_get_snapshot(&missing), Error::NotFound);
    // offer
    assert_err(t.c.try_cancel_offer(&w, &missing), Error::NotFound);
    assert_err(t.c.try_buy(&h, &missing), Error::NotFound);
    assert_err(t.c.try_get_offer(&missing), Error::NotFound);
    // position
    assert_err(t.c.try_exercise(&h, &missing), Error::NotFound);
    assert_err(t.c.try_claim(&h, &missing), Error::NotFound);
    assert_err(t.c.try_get_position(&missing), Error::NotFound);
    // book
    assert_err(t.c.try_settle(&missing), Error::NotFound);
    assert_err(t.c.try_get_book(&missing), Error::NotFound);
}

// ---------------------------------------------------------------------------------------------
// Overflow
// ---------------------------------------------------------------------------------------------

/// publish_settlement accepts 2^120 (only `price >= 0` is checked); `settle` then overflows
/// in `qty * (price - K)` (200 lots) and in `due * cash` (1 lot).
#[test]
fn overflow_on_settlement_price_2_pow_120() {
    for qty in [200i128, 1i128] {
        let t = setup();
        list_n(&t, 1);
        publish_all(&t, 1, 1, Spot::S100);
        let w = actor(&t);
        let h = actor(&t);
        let pid = sell(&t, &w, &h, 0, qty, 30 * SCALE * qty);
        let book = t.c.get_position(&pid).book;
        t.env.ledger().set_timestamp(EXPIRY);
        t.c.publish_settlement(&t.publisher, &0, &(1i128 << 120));
        assert_eq!(t.c.get_series(&0).settlement_price, Some(1i128 << 120));
        assert_err(t.c.try_settle(&book), Error::Overflow);
        // Nothing settled: the series still has its open book.
        assert_err(t.c.try_settle_vault(&0), Error::WrongState);
        assert!(!t.c.get_book(&book).settled);
        if qty == 200 {
            // expired liability q * (price - K) overflows in the requirement too
            assert_err(t.c.try_get_requirement(&Writer::Account(w.clone())), Error::Overflow);
            // withdraw fails earlier: expired unsettled short
            assert_err(t.c.try_withdraw(&w, &SCALE), Error::SeriesExpired);
        }
    }
}

/// Other checked product: `q * ra[w]` in the requirement. A snapshot with ra[0] = 2^113 passes the §5
/// bounds (only ra[14] is bounded); a 19_999-lot writer then overflows every requirement computation.
#[test]
fn overflow_on_risk_array_product_in_requirement() {
    let t = setup();
    list_n(&t, 1);
    publish_all(&t, 1, 1, Spot::S100);
    let w = actor(&t);
    let h = actor(&t);
    let y = actor(&t);
    let pid = sell(&t, &w, &h, 0, 19_999, 30 * SCALE * 19_999);
    let mut s = snapshot(&t.env, 0, 2, Spot::S100);
    s.ra.set(0, 1i128 << 113);
    t.c.publish_risk(&t.publisher, &s);
    assert_err(t.c.try_get_requirement(&Writer::Account(w.clone())), Error::Overflow);
    assert_err(t.c.try_withdraw(&w, &SCALE), Error::Overflow);
    let anyone = actor(&t);
    assert_err(t.c.try_liquidate(&anyone, &w, &None), Error::Overflow);
    t.c.deposit(&w, &(30 * SCALE));
    let oid = t.c.create_offer(&w, &0, &1, &PREM, &EXPIRY);
    assert_err(t.c.try_buy(&y, &oid), Error::Overflow);
    // The failed buy reverted everything: offer still open, writer still short 19_999.
    assert!(t.c.get_offer(&oid).open);
    assert_eq!(t.c.get_account(&w).shorts.get(0), Some(19_999));
    // Exercise is blocked before the requirement: spot 100 <= K.
    assert_err(t.c.try_exercise(&h, &pid), Error::OutOfTheMoney);
}

// ---------------------------------------------------------------------------------------------
// Caps: TooManySeries / TooManyPositions
// ---------------------------------------------------------------------------------------------

#[test]
fn too_many_series_at_16_live_series() {
    let t = setup();
    list_n(&t, 16);
    assert_err(t.c.try_list_series(&t.admin, &K, &EXPIRY), Error::TooManySeries);
    assert_eq!(t.c.series_count(), 16);
}

#[test]
fn too_many_series_at_8_series_per_account_on_buy() {
    let t = setup();
    list_n(&t, 9);
    publish_all(&t, 9, 1, Spot::S100);
    let w = actor(&t);
    let h = actor(&t);
    for s in 0..8 {
        sell(&t, &w, &h, s, 1, SAFE);
    }
    t.c.deposit(&w, &SAFE);
    let oid = t.c.create_offer(&w, &8, &1, &PREM, &EXPIRY);
    assert_err(t.c.try_buy(&h, &oid), Error::TooManySeries);
    assert!(t.c.get_offer(&oid).open);
    assert_eq!(t.c.get_account(&w).shorts.len(), 8);
}

#[test]
fn too_many_series_on_takeover_adding_a_9th_series() {
    let t = setup();
    list_n(&t, 16);
    publish_all(&t, 16, 1, Spot::S100);
    let taker = actor(&t);
    let w3 = actor(&t);
    let h = actor(&t);
    for s in 0..8 {
        sell(&t, &taker, &h, s, 1, SAFE);
    }
    sell(&t, &w3, &h, 8, 1, THIN);
    publish_all(&t, 16, 2, Spot::S105);
    assert_err(t.c.try_liquidate(&taker, &w3, &Some(taker.clone())), Error::TooManySeries);
    assert_eq!(t.c.get_account(&w3).shorts.get(8), Some(1));
}

/// 16 books on 7 series (7 own + 7 from W2 + 2 from W3), then a buy opening a book on an 8th series.
#[test]
fn too_many_positions_at_16_books_on_buy() {
    let t = setup();
    list_n(&t, 16);
    publish_all(&t, 16, 1, Spot::S100);
    let w = actor(&t);
    let w2 = actor(&t);
    let w3 = actor(&t);
    let h = actor(&t);
    for s in 0..7 {
        sell(&t, &w, &h, s, 1, SAFE);
    }
    for s in 0..7 {
        sell(&t, &w2, &h, s, 1, THIN);
    }
    for s in 0..2 {
        sell(&t, &w3, &h, s, 1, THIN);
    }
    publish_all(&t, 16, 2, Spot::S105);
    assert_eq!(
        t.c.liquidate(&w, &w2, &Some(w.clone())),
        TakeoverResult { x: 120_377_033, paid: 120_377_033, deficit: 0 }
    );
    assert_eq!(
        t.c.liquidate(&w, &w3, &Some(w.clone())),
        TakeoverResult { x: 34_393_438, paid: 34_393_438, deficit: 0 }
    );
    let a = t.c.get_account(&w);
    assert_eq!(a.books.len(), 16);
    assert_eq!(a.shorts.len(), 7);
    t.c.deposit(&w, &SAFE);
    // premium 2 USDx >= mark at 105 (1.6377828)
    let oid = t.c.create_offer(&w, &7, &1, &(2 * SCALE), &EXPIRY);
    assert_err(t.c.try_buy(&h, &oid), Error::TooManyPositions);
    assert!(t.c.get_offer(&oid).open);
    // adding to an existing series reuses its oldest open book: still 16 books
    let oid2 = t.c.create_offer(&w, &0, &1, &(2 * SCALE), &EXPIRY);
    t.c.buy(&h, &oid2);
    assert_eq!(t.c.get_account(&w).books.len(), 16);
}

#[test]
fn too_many_positions_on_takeover_exceeding_16_books() {
    let t = setup();
    list_n(&t, 16);
    publish_all(&t, 16, 1, Spot::S100);
    let taker = actor(&t);
    let w2 = actor(&t);
    let w3 = actor(&t);
    let h = actor(&t);
    for s in 0..8 {
        sell(&t, &taker, &h, s, 1, SAFE);
    }
    for s in 0..8 {
        sell(&t, &w2, &h, s, 1, THIN);
    }
    sell(&t, &w3, &h, 0, 1, THIN);
    publish_all(&t, 16, 2, Spot::S105);
    t.c.liquidate(&taker, &w2, &Some(taker.clone()));
    assert_eq!(t.c.get_account(&taker).books.len(), 16);
    assert_err(t.c.try_liquidate(&taker, &w3, &Some(taker.clone())), Error::TooManyPositions);
    assert_eq!(t.c.get_account(&w3).books.len(), 1);
    assert_eq!(t.c.get_account(&taker).books.len(), 16);
}

// ---------------------------------------------------------------------------------------------
// Double claim, holder takeover
// ---------------------------------------------------------------------------------------------

#[test]
fn double_claim_is_wrong_state() {
    let t = setup();
    list_n(&t, 1);
    publish_all(&t, 1, 1, Spot::S100);
    let w = actor(&t);
    let h = actor(&t);
    let pid = sell(&t, &w, &h, 0, 1, SAFE);
    let book = t.c.get_position(&pid).book;
    t.env.ledger().set_timestamp(EXPIRY);
    t.c.publish_settlement(&t.publisher, &0, &(130 * SCALE));
    assert_eq!(t.c.settle(&book), SettleResult { due: 200_000_000, from_owner: 200_000_000, shortfall: 0 });
    assert_eq!(t.c.settle_vault(&0), VaultSettleResult { shortfall: 0, vault_paid: 0, deficit: 0 });
    assert_eq!(t.c.claim(&h, &pid), ClaimResult { due: 200_000_000, paid: 200_000_000, deficit: 0 });
    assert_err(t.c.try_claim(&h, &pid), Error::WrongState);
    assert_eq!(t.c.get_series(&0).claimed, 200_000_000);
}

/// The model allows the holder of a book's positions to take the book over: the holder then owns the
/// short side of its own long (the book owner becomes the holder), and can still exercise against itself.
#[test]
fn takeover_by_holder_of_the_same_book_is_allowed() {
    let t = setup();
    list_n(&t, 1);
    publish_all(&t, 1, 1, Spot::S100);
    let w2 = actor(&t);
    let h = actor(&t);
    let pid = sell(&t, &w2, &h, 0, 1, THIN);
    publish_all(&t, 1, 2, Spot::S105);
    t.c.deposit(&h, &SAFE);
    let r = t.c.get_requirement(&Writer::Account(w2.clone()));
    assert_eq!((r.nlv, r.mm), (239_022_172, 251_244_538));
    assert_eq!(
        t.c.liquidate(&h, &w2, &Some(h.clone())),
        TakeoverResult { x: 17_196_719, paid: 17_196_719, deficit: 0 }
    );
    let book = t.c.get_position(&pid).book;
    assert_eq!(t.c.get_book(&book).owner, Writer::Account(h.clone()));
    assert_eq!(t.c.get_account(&h).cash, 1_517_196_719);
    assert_eq!(t.c.get_account(&w2).cash, 238_203_281);
    assert_eq!(t.c.get_account(&h).shorts.get(0), Some(1));
    assert_eq!(t.c.get_account(&w2).shorts.len(), 0);
    // OTM at 105; ITM at 130: the holder pays itself.
    assert_err(t.c.try_exercise(&h, &pid), Error::OutOfTheMoney);
    publish_all(&t, 1, 3, Spot::S130);
    assert_eq!(t.c.exercise(&h, &pid), ExerciseResult { due: 200_000_000, spot: S130_SPOT });
    assert_eq!(t.c.get_account(&h).cash, 1_317_196_719);
    assert_eq!(t.c.get_account(&h).shorts.len(), 0);
    assert_eq!(t.c.get_series(&0).oi, 0);
}

// ---------------------------------------------------------------------------------------------
// Footprint at the caps (brief §4: <= 400 keys read, <= 200 written)
// ---------------------------------------------------------------------------------------------

#[test]
fn footprint_liquidate_to_vault_at_cap() {
    let t = setup();
    let cap = cap_state(&t, RICH);
    let anyone = actor(&t);
    assert_eq!(
        t.c.liquidate(&anyone, &cap.w, &None),
        TakeoverResult { x: 3_374_703_544, paid: 3_374_703_544, deficit: 0 }
    );
    footprint(&t, "liquidate -> vault (writer 8 series / 16 books, vault short in 16)");
    assert_eq!(t.c.get_account(&cap.w).books.len(), 0);
    assert_eq!(t.c.get_account(&cap.w).shorts.len(), 0);
}

#[test]
fn footprint_liquidate_to_private_taker_at_cap() {
    let t = setup();
    let cap = cap_state(&t, RICH);
    let taker = actor(&t);
    t.c.deposit(&taker, &(2_000 * SCALE));
    assert_eq!(
        t.c.liquidate(&taker, &cap.w, &Some(taker.clone())),
        TakeoverResult { x: 3_374_703_544, paid: 3_374_703_544, deficit: 0 }
    );
    footprint(&t, "liquidate -> private taker (writer 8 series / 16 books)");
    let a = t.c.get_account(&taker);
    assert_eq!(a.books.len(), 16);
    assert_eq!(a.shorts.len(), 8);
}

#[test]
fn footprint_buy_adding_to_writer_with_16_books() {
    let t = setup();
    let cap = cap_state(&t, SAFE);
    // premium 21 USDx >= mark at 130 (20.0875211)
    let oid = t.c.create_offer(&cap.w, &0, &1, &(21 * SCALE), &EXPIRY);
    let pid = t.c.buy(&cap.h, &oid);
    footprint(&t, "buy (writer with 16 books, 8 series)");
    assert_eq!(pid, 32);
    let a = t.c.get_account(&cap.w);
    assert_eq!(a.books.len(), 16);
    assert_eq!(a.shorts.get(0), Some(3));
}

#[test]
fn footprint_exercise_against_owner_at_cap() {
    let t = setup();
    let cap = cap_state(&t, SAFE);
    assert_eq!(t.c.exercise(&cap.h, &cap.pos_w[0]), ExerciseResult { due: 200_000_000, spot: S130_SPOT });
    footprint(&t, "exercise (owner with 8 series / 16 books, 16 live series)");
}

#[test]
fn footprint_withdraw_at_8_series() {
    let t = setup();
    let cap = cap_state(&t, SAFE);
    t.c.withdraw(&cap.w, &SCALE);
    footprint(&t, "withdraw (8 series / 16 books)");
}

#[test]
fn footprint_lp_deposit_with_vault_short_in_16_series() {
    let t = setup();
    cap_state(&t, SAFE);
    let lp = actor(&t);
    assert_eq!(t.c.lp_deposit(&lp, &(100 * SCALE)), 1_000_000_000);
    footprint(&t, "lp_deposit first (vault short in 16 series)");
    assert_eq!(t.c.lp_deposit(&lp, &(100 * SCALE)), 847_529_336);
    footprint(&t, "lp_deposit second (vault short in 16 series)");
}

#[test]
fn footprint_settle_settle_vault_claim_at_cap() {
    let t = setup();
    let cap = cap_state(&t, SAFE);
    t.env.ledger().set_timestamp(EXPIRY);
    for sid in 0..16 {
        t.c.publish_settlement(&t.publisher, &sid, &(130 * SCALE));
    }
    // Books on series 0: W's own (0), the one W took from W2 (8), WA's now vault-owned (16).
    let b_w = t.c.get_position(&cap.pos_w[0]).book;
    let b_w2 = t.c.get_position(&cap.pos_w2[0]).book;
    let b_wa = t.c.get_position(&cap.pos_wa[0]).book;
    assert_eq!((b_w, b_w2, b_wa), (0, 8, 16));
    assert_eq!(t.c.get_book(&b_wa).owner, Writer::Vault);
    let expect = SettleResult { due: 200_000_000, from_owner: 200_000_000, shortfall: 0 };
    assert_eq!(t.c.settle(&b_w), expect.clone());
    footprint(&t, "settle (private owner, 8 expired series / 16 books)");
    assert_eq!(t.c.settle(&b_w2), expect.clone());
    footprint(&t, "settle (private owner, second book on the series)");
    assert_eq!(t.c.settle(&b_wa), expect);
    footprint(&t, "settle (vault-owned book)");
    assert_eq!(t.c.settle_vault(&0), VaultSettleResult { shortfall: 0, vault_paid: 0, deficit: 0 });
    footprint(&t, "settle_vault");
    let paid = ClaimResult { due: 200_000_000, paid: 200_000_000, deficit: 0 };
    assert_eq!(t.c.claim(&cap.h, &cap.pos_w[0]), paid.clone());
    footprint(&t, "claim (private book)");
    assert_eq!(t.c.claim(&cap.h, &cap.pos_w2[0]), paid.clone());
    assert_eq!(t.c.claim(&cap.h, &cap.pos_wa[0]), paid);
    footprint(&t, "claim (vault book)");
    assert_err(t.c.try_claim(&cap.h, &cap.pos_w[0]), Error::WrongState);
    assert!(t.c.get_series(&0).closed);
}
