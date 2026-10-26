//! Fixture replay for the Strata Pro contract (brief §7).
//!
//! Replays every scenario of `packages/risk/fixtures/pro_v0.json` (generated from the executable spec
//! `packages/risk/pro_v0_model.py`) against the compiled contract and requires identical results, error
//! codes and state after every step.
//!
//! Conventions:
//! - One fresh `Env` + one USDx SAC per scenario; every actor name maps to a generated `Address` on first
//!   use (`VAULT` is never an address: it is `Writer::Vault` / `taker = None`).
//! - `env.mock_all_auths()` is on, so every `require_auth` passes; an expected `Unauthorized` must come
//!   from the contract's explicit comparison of the caller against the stored role or holder.
//! - Typed errors come back from `try_*` as `Err(Ok(Error::X))` and are compared by numeric code.
//! - Every panic message names the scenario, the step index, the op, its args and the first differing
//!   field with expected vs actual.

extern crate std;

use std::collections::HashMap;
use std::fmt::Debug;
use std::string::String;
use std::vec::Vec as StdVec;

use serde_json::Value;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env, InvokeError, Map, Vec,
};

use pro::{
    Account, Book, ClaimResult, Error, ExerciseResult, MarketConfig, Position, ProContract,
    ProContractClient, Requirement, Series, SettleResult, Snapshot, TakeoverResult, VaultAccount,
    VaultSettleResult, Writer, N_SCEN,
};

const FIXTURES: &str = include_str!("../../../packages/risk/fixtures/pro_v0.json");

/// Every scenario in the fixture file, by name. `scenario_count_is_16` and
/// `every_scenario_has_a_test` fail if this list and the JSON drift apart.
macro_rules! scenario_tests {
    ($($name:ident),* $(,)?) => {
        const SCENARIO_NAMES: &[&str] = &[$(stringify!($name)),*];
        $(
            #[test]
            fn $name() {
                run_scenario(stringify!($name));
            }
        )*
    };
}

scenario_tests! {
    happy_path_otm,
    insufficient_margin_reverts,
    snapshot_bounds,
    liquidation_to_private_taker,
    gap_to_vault,
    settlement_pro_rata_deficit,
    limits_and_staleness,
    american_exercise,
    review_regressions,
    writer_cash_pro_rata,
    negative_paths,
    takeover_debt,
    takeover_debt_cash_short,
    private_takeover_debt,
    margin_boundaries,
    taker_oi_cap,
}

/// Name -> variant for every `Error` of the pinned ABI.
const ERROR_TABLE: &[(&str, Error)] = &[
    ("InvalidArgs", Error::InvalidArgs),
    ("NotFound", Error::NotFound),
    ("Unauthorized", Error::Unauthorized),
    ("WrongState", Error::WrongState),
    ("SeriesExpired", Error::SeriesExpired),
    ("NotExpired", Error::NotExpired),
    ("StaleSnapshot", Error::StaleSnapshot),
    ("BadSnapshot", Error::BadSnapshot),
    ("InsufficientMargin", Error::InsufficientMargin),
    ("OiCapExceeded", Error::OiCapExceeded),
    ("NotLiquidable", Error::NotLiquidable),
    ("VaultCapacity", Error::VaultCapacity),
    ("NoSettlementPrice", Error::NoSettlementPrice),
    ("SettlementWindowClosed", Error::SettlementWindowClosed),
    ("WithdrawLocked", Error::WithdrawLocked),
    ("TooManySeries", Error::TooManySeries),
    ("SelfTrade", Error::SelfTrade),
    ("InsolventTakeover", Error::InsolventTakeover),
    ("Overflow", Error::Overflow),
    ("TooManyPositions", Error::TooManyPositions),
    ("RoleNotAllowed", Error::RoleNotAllowed),
    ("PremiumBelowMark", Error::PremiumBelowMark),
    ("OutOfTheMoney", Error::OutOfTheMoney),
    ("LiquidateFirst", Error::LiquidateFirst),
    ("SettlementPending", Error::SettlementPending),
    ("NoEarlyExercise", Error::NoEarlyExercise),
];

// ---------------------------------------------------------------------------------------------
// Meta tests: the fixture file itself
// ---------------------------------------------------------------------------------------------

fn fixtures() -> Value {
    serde_json::from_str::<Value>(FIXTURES).expect("pro_v0.json must parse")
}

fn scenarios(doc: &Value) -> &StdVec<Value> {
    doc["scenarios"].as_array().expect("`scenarios` must be an array")
}

#[test]
fn scenario_count_is_16() {
    let doc = fixtures();
    let n = scenarios(&doc).len();
    assert_eq!(n, 16, "pro_v0.json holds {n} scenarios, the harness expects exactly 16");
    let steps: usize = scenarios(&doc).iter().map(|s| s["steps"].as_array().expect("steps").len()).sum();
    assert_eq!(steps, 691, "pro_v0.json holds {steps} steps, the harness was written against 691");
}

#[test]
fn every_scenario_has_a_test() {
    let doc = fixtures();
    let mut names: StdVec<&str> =
        scenarios(&doc).iter().map(|s| s["name"].as_str().expect("scenario name")).collect();
    let mut listed: StdVec<&str> = SCENARIO_NAMES.to_vec();
    names.sort_unstable();
    listed.sort_unstable();
    assert_eq!(
        names, listed,
        "scenario names in pro_v0.json differ from the `scenario_tests!` list in fixtures.rs"
    );
}

#[test]
fn error_codes_match_contract() {
    let doc = fixtures();
    let errors = doc["errors"].as_object().expect("`errors` must be an object");
    // Every name used anywhere in a step's `expect` must be in `errors`.
    for sc in scenarios(&doc) {
        for st in sc["steps"].as_array().expect("steps") {
            if let Some(name) = st["expect"]["error"].as_str() {
                assert!(
                    errors.contains_key(name),
                    "scenario {} uses error {name} which is missing from `errors`",
                    sc["name"]
                );
                let code = st["expect"]["code"].as_u64().expect("expect.code");
                assert_eq!(
                    Some(code),
                    errors[name].as_u64(),
                    "scenario {} expects {name} with code {code}, `errors` says {}",
                    sc["name"],
                    errors[name]
                );
            }
        }
    }
    // Every name in `errors` must exist in the ABI with the same code, and vice versa.
    for (name, code) in errors {
        let code = code.as_u64().expect("error code") as u32;
        let (_, e) = ERROR_TABLE
            .iter()
            .find(|(n, _)| *n == name)
            .unwrap_or_else(|| panic!("fixture error `{name}` ({code}) has no `Error` variant in the ABI"));
        assert_eq!(*e as u32, code, "Error::{name}: ABI code {} vs fixture code {code}", *e as u32);
    }
    for (name, e) in ERROR_TABLE {
        assert!(errors.contains_key(*name), "ABI Error::{name} ({}) is missing from fixture `errors`", *e as u32);
    }
}

// ---------------------------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------------------------

fn j_i128(v: &Value, what: &str) -> i128 {
    v.as_i64()
        .map(|x| x as i128)
        .unwrap_or_else(|| panic!("fixture field {what} is not an i64 integer: {v}"))
}

fn j_u64(v: &Value, what: &str) -> u64 {
    v.as_u64().unwrap_or_else(|| panic!("fixture field {what} is not a u64 integer: {v}"))
}

fn j_u32(v: &Value, what: &str) -> u32 {
    let x = j_u64(v, what);
    u32::try_from(x).unwrap_or_else(|_| panic!("fixture field {what} does not fit u32: {v}"))
}

fn j_str<'a>(v: &'a Value, what: &str) -> &'a str {
    v.as_str().unwrap_or_else(|| panic!("fixture field {what} is not a string: {v}"))
}

fn j_bool(v: &Value, what: &str) -> bool {
    v.as_bool().unwrap_or_else(|| panic!("fixture field {what} is not a bool: {v}"))
}

fn j_opt_i128(v: &Value, what: &str) -> Option<i128> {
    if v.is_null() {
        None
    } else {
        Some(j_i128(v, what))
    }
}

fn market_config(cfg: &Value) -> MarketConfig {
    MarketConfig {
        psr_bps: j_u32(&cfg["psr_bps"], "config.psr_bps"),
        ext_mult: j_u32(&cfg["ext_mult"], "config.ext_mult"),
        short_min_bps: j_u32(&cfg["short_min_bps"], "config.short_min_bps"),
        im_bps: j_u32(&cfg["im_bps"], "config.im_bps"),
        max_age: j_u64(&cfg["max_age"], "config.max_age"),
        max_series_oi: j_i128(&cfg["max_series_oi"], "config.max_series_oi"),
        max_writer_oi: j_i128(&cfg["max_writer_oi"], "config.max_writer_oi"),
        bonus_bps: j_u32(&cfg["bonus_bps"], "config.bonus_bps"),
        reserve_fee_bps: j_u32(&cfg["reserve_fee_bps"], "config.reserve_fee_bps"),
        settle_window: j_u64(&cfg["settle_window"], "config.settle_window"),
        exercise_max_age: j_u64(&cfg["exercise_max_age"], "config.exercise_max_age"),
    }
}

fn snapshot(env: &Env, s: &Value) -> Snapshot {
    let ra_json = s["ra"].as_array().expect("snapshot.ra must be an array");
    assert_eq!(ra_json.len(), N_SCEN as usize, "snapshot.ra must have {N_SCEN} entries: {s}");
    let mut ra: Vec<i128> = Vec::new(env);
    for (i, x) in ra_json.iter().enumerate() {
        ra.push_back(j_i128(x, &std::format!("snapshot.ra[{i}]")));
    }
    Snapshot {
        series_id: j_u32(&s["series_id"], "snapshot.series_id"),
        seq: j_u64(&s["seq"], "snapshot.seq"),
        ts: j_u64(&s["ts"], "snapshot.ts"),
        spot: j_i128(&s["spot"], "snapshot.spot"),
        mark: j_i128(&s["mark"], "snapshot.mark"),
        ra,
        smin: j_i128(&s["smin"], "snapshot.smin"),
        liq: j_i128(&s["liq"], "snapshot.liq"),
    }
}

// ---------------------------------------------------------------------------------------------
// Result structs as named integer fields (for `result` dict comparison)
// ---------------------------------------------------------------------------------------------

trait Fields {
    fn fields(&self) -> StdVec<(&'static str, i128)>;
}

impl Fields for Requirement {
    fn fields(&self) -> StdVec<(&'static str, i128)> {
        std::vec![
            ("nlv", self.nlv),
            ("liability", self.liability),
            ("expired", self.expired),
            ("scan", self.scan),
            ("smin", self.smin),
            ("liq", self.liq),
            ("mm", self.mm),
            ("im", self.im),
            ("worst", self.worst as i128),
        ]
    }
}

impl Fields for ExerciseResult {
    fn fields(&self) -> StdVec<(&'static str, i128)> {
        std::vec![("due", self.due), ("spot", self.spot)]
    }
}

impl Fields for TakeoverResult {
    fn fields(&self) -> StdVec<(&'static str, i128)> {
        std::vec![("x", self.x), ("paid", self.paid), ("deficit", self.deficit)]
    }
}

impl Fields for SettleResult {
    fn fields(&self) -> StdVec<(&'static str, i128)> {
        std::vec![("due", self.due), ("from_owner", self.from_owner), ("shortfall", self.shortfall)]
    }
}

impl Fields for VaultSettleResult {
    fn fields(&self) -> StdVec<(&'static str, i128)> {
        std::vec![("shortfall", self.shortfall), ("vault_paid", self.vault_paid), ("deficit", self.deficit)]
    }
}

impl Fields for ClaimResult {
    fn fields(&self) -> StdVec<(&'static str, i128)> {
        std::vec![("due", self.due), ("paid", self.paid), ("deficit", self.deficit)]
    }
}

// ---------------------------------------------------------------------------------------------
// Replay harness
// ---------------------------------------------------------------------------------------------

struct Ctx {
    scenario: String,
    step: usize,
    op: String,
    args: String,
}

impl Ctx {
    fn where_(&self) -> String {
        std::format!("[{}] step {} op={} args={}", self.scenario, self.step, self.op, self.args)
    }

    fn fail<E: Debug, A: Debug>(&self, field: &str, expected: E, actual: A) -> ! {
        panic!("{}: {field}: expected {expected:?}, actual {actual:?}", self.where_())
    }

    fn eq<T: PartialEq + Debug>(&self, field: &str, expected: T, actual: T) {
        if expected != actual {
            self.fail(field, expected, actual);
        }
    }
}

struct Harness<'a> {
    env: Env,
    contract: Address,
    client: ProContractClient<'a>,
    token: TokenClient<'a>,
    actors: HashMap<String, Address>,
}

impl Harness<'_> {
    /// Address of a named actor, generated on first use. `VAULT` is never an address.
    fn addr(&mut self, name: &str) -> Address {
        assert_ne!(name, "VAULT", "VAULT is not an address");
        if let Some(a) = self.actors.get(name) {
            return a.clone();
        }
        let a = Address::generate(&self.env);
        self.actors.insert(String::from(name), a.clone());
        a
    }

    fn writer(&mut self, name: &str) -> Writer {
        if name == "VAULT" {
            Writer::Vault
        } else {
            Writer::Account(self.addr(name))
        }
    }

    /// Checks the `expect` of a step against a `try_*` result; returns the value on an expected `ok`.
    fn outcome<T: Debug, C: Debug>(
        &self,
        ctx: &Ctx,
        r: Result<Result<T, C>, Result<Error, InvokeError>>,
        expect: &Value,
    ) -> Option<T> {
        let expect_ok = expect.as_str() == Some("ok");
        match r {
            Ok(Ok(v)) => {
                if expect_ok {
                    Some(v)
                } else {
                    ctx.fail("expect", std::format!("error {expect}"), std::format!("Ok({v:?})"))
                }
            }
            Ok(Err(c)) => panic!("{}: return value failed to convert: {c:?}", ctx.where_()),
            Err(Ok(e)) => {
                let code = e as u32;
                if expect_ok {
                    ctx.fail("expect", "ok", std::format!("Error::{e:?} ({code})"))
                }
                let want = j_u32(&expect["code"], "expect.code");
                let want_name = j_str(&expect["error"], "expect.error");
                if code != want {
                    ctx.fail(
                        "error code",
                        std::format!("{want_name} ({want})"),
                        std::format!("Error::{e:?} ({code})"),
                    )
                }
                None
            }
            Err(Err(ie)) => ctx.fail("expect", std::format!("{expect}"), std::format!("untyped invoke error {ie:?}")),
        }
    }

    fn check_int<T: Into<i128> + Debug + Copy>(&self, ctx: &Ctx, step: &Value, actual: Option<T>) {
        if let (Some(a), Some(r)) = (actual, step.get("result")) {
            ctx.eq("result", j_i128(r, "result"), a.into());
        }
    }

    fn check_fields<T: Fields + Debug>(&self, ctx: &Ctx, step: &Value, actual: Option<T>) {
        if let (Some(a), Some(r)) = (actual, step.get("result")) {
            let obj = r.as_object().unwrap_or_else(|| panic!("{}: result must be an object: {r}", ctx.where_()));
            let got = a.fields();
            for (k, v) in obj {
                let (_, actual_v) = got
                    .iter()
                    .find(|(n, _)| n == k)
                    .unwrap_or_else(|| panic!("{}: result field `{k}` is not in {a:?}", ctx.where_()));
                ctx.eq(&std::format!("result.{k}"), j_i128(v, k), *actual_v);
            }
            for (k, _) in &got {
                assert!(obj.contains_key(*k), "{}: contract result has field `{k}` that the fixture omits", ctx.where_());
            }
        }
    }

    fn replay_step(&mut self, ctx: &Ctx, step: &Value) {
        let args = step["args"].as_array().expect("step.args");
        let a = |i: usize| -> &Value {
            args.get(i).unwrap_or_else(|| panic!("{}: missing arg {i}", ctx.where_()))
        };
        let expect = &step["expect"];
        match ctx.op.as_str() {
            "set_time" => {
                let ts = j_u64(a(0), "set_time.ts");
                self.env.ledger().set_timestamp(ts);
            }
            "get_requirement" => {
                let who = self.writer(j_str(a(0), "who"));
                let r = self.client.try_get_requirement(&who);
                let v = self.outcome(ctx, r, expect);
                self.check_fields(ctx, step, v);
            }
            "list_series" => {
                let admin = self.addr(j_str(a(0), "admin"));
                let r = self.client.try_list_series(&admin, &j_i128(a(1), "strike"), &j_u64(a(2), "expiry"));
                let v = self.outcome(ctx, r, expect);
                self.check_int(ctx, step, v);
            }
            "publish_risk" => {
                let publisher = self.addr(j_str(a(0), "publisher"));
                let snap = snapshot(&self.env, a(1));
                let r = self.client.try_publish_risk(&publisher, &snap);
                self.outcome(ctx, r, expect);
            }
            "publish_settlement" => {
                let publisher = self.addr(j_str(a(0), "publisher"));
                let r = self.client.try_publish_settlement(
                    &publisher,
                    &j_u32(a(1), "series_id"),
                    &j_i128(a(2), "price"),
                );
                self.outcome(ctx, r, expect);
            }
            "deposit" => {
                let who = self.addr(j_str(a(0), "who"));
                let r = self.client.try_deposit(&who, &j_i128(a(1), "amount"));
                self.outcome(ctx, r, expect);
            }
            "withdraw" => {
                let who = self.addr(j_str(a(0), "who"));
                let r = self.client.try_withdraw(&who, &j_i128(a(1), "amount"));
                self.outcome(ctx, r, expect);
            }
            "create_offer" => {
                let writer = self.addr(j_str(a(0), "writer"));
                let r = self.client.try_create_offer(
                    &writer,
                    &j_u32(a(1), "series_id"),
                    &j_i128(a(2), "qty"),
                    &j_i128(a(3), "premium"),
                    &j_u64(a(4), "quote_expiry"),
                );
                let v = self.outcome(ctx, r, expect);
                self.check_int(ctx, step, v);
            }
            "cancel_offer" => {
                let writer = self.addr(j_str(a(0), "writer"));
                let r = self.client.try_cancel_offer(&writer, &j_u32(a(1), "offer_id"));
                self.outcome(ctx, r, expect);
            }
            "buy" => {
                let buyer = self.addr(j_str(a(0), "buyer"));
                let r = self.client.try_buy(&buyer, &j_u32(a(1), "offer_id"));
                let v = self.outcome(ctx, r, expect);
                self.check_int(ctx, step, v);
            }
            "exercise" => {
                let holder = self.addr(j_str(a(0), "holder"));
                let r = self.client.try_exercise(&holder, &j_u32(a(1), "pos_id"));
                let v = self.outcome(ctx, r, expect);
                self.check_fields(ctx, step, v);
            }
            "liquidate" => {
                let caller = self.addr(j_str(a(0), "caller"));
                let writer = self.addr(j_str(a(1), "writer"));
                let taker_name = j_str(a(2), "taker");
                let taker: Option<Address> =
                    if taker_name == "VAULT" { None } else { Some(self.addr(taker_name)) };
                let r = self.client.try_liquidate(&caller, &writer, &taker);
                let v = self.outcome(ctx, r, expect);
                self.check_fields(ctx, step, v);
            }
            "settle" => {
                let r = self.client.try_settle(&j_u32(a(0), "book_id"));
                let v = self.outcome(ctx, r, expect);
                self.check_fields(ctx, step, v);
            }
            "settle_vault" => {
                let r = self.client.try_settle_vault(&j_u32(a(0), "series_id"));
                let v = self.outcome(ctx, r, expect);
                self.check_fields(ctx, step, v);
            }
            "claim" => {
                let holder = self.addr(j_str(a(0), "holder"));
                let r = self.client.try_claim(&holder, &j_u32(a(1), "pos_id"));
                let v = self.outcome(ctx, r, expect);
                self.check_fields(ctx, step, v);
            }
            "lp_deposit" => {
                let lp = self.addr(j_str(a(0), "lp"));
                let r = self.client.try_lp_deposit(&lp, &j_i128(a(1), "amount"));
                let v = self.outcome(ctx, r, expect);
                self.check_int(ctx, step, v);
            }
            other => panic!("{}: unknown op `{other}`", ctx.where_()),
        }
    }

    // ------------------------------------------------------------------------------- state

    fn check_state(&mut self, ctx: &Ctx, state: &Value) {
        let f = |name: &str| std::format!("state.{name}");

        // now
        ctx.eq(&f("now"), j_u64(&state["now"], "state.now"), self.env.ledger().timestamp());

        // contract SAC balance
        ctx.eq(
            &f("contract_balance"),
            j_i128(&state["contract_balance"], "state.contract_balance"),
            self.token.balance(&self.contract),
        );

        // wallets: every actor with an address; absent = 0
        let wallets = state["wallets"].as_object().expect("state.wallets");
        for name in wallets.keys() {
            assert!(
                self.actors.contains_key(name),
                "{}: state.wallets names `{name}` which never appeared in the scenario",
                ctx.where_()
            );
        }
        let mut names: StdVec<String> = self.actors.keys().cloned().collect();
        names.sort();
        for name in &names {
            let want = wallets.get(name).map(|v| j_i128(v, "wallet")).unwrap_or(0);
            ctx.eq(&f(&std::format!("wallets.{name}")), want, self.token.balance(&self.actors[name]));
        }

        // accounts (private): every actor seen so far; absent = all-zero
        let accounts = state["accounts"].as_object().expect("state.accounts");
        for name in accounts.keys() {
            assert!(
                name == "VAULT" || self.actors.contains_key(name),
                "{}: state.accounts names `{name}` which never appeared in the scenario",
                ctx.where_()
            );
        }
        for name in &names {
            let acct: Account = self.client.get_account(&self.actors[name]);
            let p = std::format!("accounts.{name}");
            match accounts.get(name) {
                Some(exp) => self.check_account(ctx, &p, exp, &acct),
                None => {
                    ctx.eq(&f(&std::format!("{p}.cash")), 0, acct.cash);
                    ctx.eq(&f(&std::format!("{p}.shorts")), StdVec::<(u32, i128)>::new(), map_pairs(&acct.shorts));
                    ctx.eq(&f(&std::format!("{p}.books")), StdVec::<u32>::new(), vec_sorted(&acct.books));
                    ctx.eq(&f(&std::format!("{p}.owed")), 0, acct.owed);
                }
            }
        }

        // vault
        let vault: VaultAccount = self.client.get_vault();
        match accounts.get("VAULT") {
            Some(exp) => {
                ctx.eq(&f("accounts.VAULT.cash"), j_i128(&exp["cash"], "VAULT.cash"), vault.cash);
                ctx.eq(&f("accounts.VAULT.shorts"), shorts_pairs(&exp["shorts"]), map_pairs(&vault.shorts));
                ctx.eq(&f("accounts.VAULT.reserved"), j_i128(&exp["reserved"], "VAULT.reserved"), vault.reserved);
                // The vault has no book list and no debt; the model still emits them as empty/zero.
                if let Some(b) = exp.get("books") {
                    assert!(b.as_array().map(|a| a.is_empty()).unwrap_or(true), "{}: fixture VAULT.books non-empty: {b}", ctx.where_());
                }
                if let Some(o) = exp.get("owed") {
                    assert_eq!(j_i128(o, "VAULT.owed"), 0, "{}: fixture VAULT.owed non-zero", ctx.where_());
                }
            }
            None => {
                ctx.eq(&f("accounts.VAULT.cash"), 0, vault.cash);
                ctx.eq(&f("accounts.VAULT.shorts"), StdVec::<(u32, i128)>::new(), map_pairs(&vault.shorts));
                ctx.eq(&f("accounts.VAULT.reserved"), 0, vault.reserved);
            }
        }

        // series: ids are 0..series_count and the fixture must list exactly those
        let series = state["series"].as_object().expect("state.series");
        let count = self.client.series_count();
        ctx.eq(&f("series.len"), series.len() as u32, count);
        for id in 0..count {
            let key = id.to_string();
            let exp = series
                .get(&key)
                .unwrap_or_else(|| ctx.fail(&f(&std::format!("series.{key}")), "present", "missing in fixture"));
            let s: Series = match self.client.try_get_series(&id) {
                Ok(Ok(s)) => s,
                other => ctx.fail(&f(&std::format!("series.{key}")), "Ok(Series)", std::format!("{other:?}")),
            };
            let p = |fld: &str| f(&std::format!("series.{key}.{fld}"));
            ctx.eq(&p("oi"), j_i128(&exp["oi"], "oi"), s.oi);
            ctx.eq(&p("settlement_price"), j_opt_i128(&exp["settlement_price"], "settlement_price"), s.settlement_price);
            ctx.eq(&p("open_books"), j_u32(&exp["open_books"], "open_books"), s.open_books);
            ctx.eq(&p("shortfall"), j_i128(&exp["shortfall"], "shortfall"), s.shortfall);
            ctx.eq(&p("vault_paid"), j_i128(&exp["vault_paid"], "vault_paid"), s.vault_paid);
            ctx.eq(&p("pool"), j_i128(&exp["pool"], "pool"), s.pool);
            ctx.eq(&p("claimed"), j_i128(&exp["claimed"], "claimed"), s.claimed);
            ctx.eq(&p("closed"), j_bool(&exp["closed"], "closed"), s.closed);
        }

        // books: every listed id, and no book beyond them
        let books = state["books"].as_object().expect("state.books");
        for (key, exp) in books {
            let id: u32 = key.parse().expect("book id");
            let b: Book = match self.client.try_get_book(&id) {
                Ok(Ok(b)) => b,
                other => ctx.fail(&f(&std::format!("books.{key}")), "Ok(Book)", std::format!("{other:?}")),
            };
            let p = |fld: &str| f(&std::format!("books.{key}.{fld}"));
            ctx.eq(&p("series_id"), j_u32(&exp["series_id"], "series_id"), b.series_id);
            let owner = self.writer(j_str(&exp["owner"], "owner"));
            ctx.eq(&p("owner"), owner, b.owner);
            ctx.eq(&p("qty"), j_i128(&exp["qty"], "qty"), b.qty);
            ctx.eq(&p("settled"), j_bool(&exp["settled"], "settled"), b.settled);
            ctx.eq(&p("due"), j_i128(&exp["due"], "due"), b.due);
            ctx.eq(&p("from_owner"), j_i128(&exp["from_owner"], "from_owner"), b.from_owner);
            ctx.eq(&p("shortfall"), j_i128(&exp["shortfall"], "shortfall"), b.shortfall);
            ctx.eq(&p("reserve"), j_i128(&exp["reserve"], "reserve"), b.reserve);
        }
        let next_book = books.len() as u32;
        if let Ok(Ok(b)) = self.client.try_get_book(&next_book) {
            ctx.fail(&f(&std::format!("books.{next_book}")), "NotFound (fixture has no such book)", b);
        }

        // positions
        let positions = state["positions"].as_object().expect("state.positions");
        for (key, exp) in positions {
            let id: u32 = key.parse().expect("position id");
            let pos: Position = match self.client.try_get_position(&id) {
                Ok(Ok(p)) => p,
                other => ctx.fail(&f(&std::format!("positions.{key}")), "Ok(Position)", std::format!("{other:?}")),
            };
            let p = |fld: &str| f(&std::format!("positions.{key}.{fld}"));
            let holder = self.addr(j_str(&exp["holder"], "holder"));
            ctx.eq(&p("holder"), holder, pos.holder);
            ctx.eq(&p("book"), j_u32(&exp["book"], "book"), pos.book);
            ctx.eq(&p("qty"), j_i128(&exp["qty"], "qty"), pos.qty);
            ctx.eq(&p("settled"), j_bool(&exp["settled"], "settled"), pos.settled);
            ctx.eq(&p("exercised"), j_bool(&exp["exercised"], "exercised"), pos.exercised);
            ctx.eq(&p("paid"), j_i128(&exp["paid"], "paid"), pos.paid);
            ctx.eq(&p("deficit"), j_i128(&exp["deficit"], "deficit"), pos.deficit);
            // Consistency with the book the fixture points at.
            if let Some(bk) = books.get(&pos.book.to_string()) {
                ctx.eq(&p("series_id (via book)"), j_u32(&bk["series_id"], "series_id"), pos.series_id);
            }
        }
        let next_pos = positions.len() as u32;
        if let Ok(Ok(p)) = self.client.try_get_position(&next_pos) {
            ctx.fail(&f(&std::format!("positions.{next_pos}")), "NotFound (fixture has no such position)", p);
        }

        // LP shares: every actor; absent = 0
        let lp = state["lp_shares"].as_object().expect("state.lp_shares");
        for name in lp.keys() {
            assert!(self.actors.contains_key(name), "{}: state.lp_shares names unknown actor `{name}`", ctx.where_());
        }
        for name in &names {
            let want = lp.get(name).map(|v| j_i128(v, "lp_shares")).unwrap_or(0);
            ctx.eq(&f(&std::format!("lp_shares.{name}")), want, self.client.lp_shares(&self.actors[name]));
        }
        ctx.eq(&f("total_shares"), j_i128(&state["total_shares"], "total_shares"), self.client.total_shares());
    }

    fn check_account(&self, ctx: &Ctx, p: &str, exp: &Value, acct: &Account) {
        let f = |fld: &str| std::format!("state.{p}.{fld}");
        ctx.eq(&f("cash"), j_i128(&exp["cash"], "cash"), acct.cash);
        ctx.eq(&f("shorts"), shorts_pairs(&exp["shorts"]), map_pairs(&acct.shorts));
        let mut want_books: StdVec<u32> = exp["books"]
            .as_array()
            .expect("account.books")
            .iter()
            .map(|v| j_u32(v, "book id"))
            .collect();
        want_books.sort_unstable();
        ctx.eq(&f("books (sorted)"), want_books, vec_sorted(&acct.books));
        ctx.eq(&f("owed"), j_i128(&exp["owed"], "owed"), acct.owed);
        // The ABI `Account` has no `reserved`; the model emits 0 for private accounts.
        if let Some(r) = exp.get("reserved") {
            assert_eq!(j_i128(r, "reserved"), 0, "{}: fixture {p}.reserved non-zero for a private account", ctx.where_());
        }
    }
}

fn map_pairs(m: &Map<u32, i128>) -> StdVec<(u32, i128)> {
    let mut v: StdVec<(u32, i128)> = m.iter().collect();
    v.sort_unstable();
    v
}

fn shorts_pairs(v: &Value) -> StdVec<(u32, i128)> {
    let mut out: StdVec<(u32, i128)> = v
        .as_object()
        .expect("shorts must be an object")
        .iter()
        .map(|(k, q)| (k.parse::<u32>().expect("series id key"), j_i128(q, "short qty")))
        .collect();
    out.sort_unstable();
    out
}

fn vec_sorted(v: &Vec<u32>) -> StdVec<u32> {
    let mut out: StdVec<u32> = v.iter().collect();
    out.sort_unstable();
    out
}

// ---------------------------------------------------------------------------------------------
// Scenario runner
// ---------------------------------------------------------------------------------------------

fn run_scenario(name: &str) {
    let doc = fixtures();
    let sc = scenarios(&doc)
        .iter()
        .find(|s| s["name"].as_str() == Some(name))
        .unwrap_or_else(|| panic!("scenario `{name}` not found in pro_v0.json"));

    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(j_u64(&sc["t0"], "t0"));

    // USDx SAC with a generated issuer.
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer.clone());
    let quote = sac.address();
    let mint = StellarAssetClient::new(&env, &quote);
    let token = TokenClient::new(&env, &quote);

    let mut actors: HashMap<String, Address> = HashMap::new();
    let mut gen = |n: &str| -> Address {
        actors.entry(String::from(n)).or_insert_with(|| Address::generate(&env)).clone()
    };
    let admin = gen("ADMIN");
    let publisher = gen("PUBLISHER");
    let wallets = sc["initial_wallets"].as_object().expect("initial_wallets");
    let mut wallet_names: StdVec<&String> = wallets.keys().collect();
    wallet_names.sort();
    for w in wallet_names {
        let a = gen(w);
        mint.mint(&a, &j_i128(&wallets[w], "initial wallet"));
    }

    let cfg = market_config(&sc["config"]);
    let contract = env.register(ProContract, (&admin, &publisher, &quote, &cfg));
    let client = ProContractClient::new(&env, &contract);

    let mut h = Harness { env: env.clone(), contract, client, token, actors };

    let steps = sc["steps"].as_array().expect("steps");
    for (i, step) in steps.iter().enumerate() {
        let ctx = Ctx {
            scenario: String::from(name),
            step: i,
            op: String::from(j_str(&step["op"], "op")),
            args: step["args"].to_string(),
        };
        h.replay_step(&ctx, step);
        if let Some(state) = step.get("state") {
            h.check_state(&ctx, state);
        }
    }
}
