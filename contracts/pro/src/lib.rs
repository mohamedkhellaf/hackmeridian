//! Strata Pro v0.3.2: naked American calls, cash-settled in one SAC quote token (USDx), with partial
//! margin, takeover liquidation and an LP-funded backstop vault.
//!
//! EXPERIMENTAL, TESTNET ONLY. Isolated from `contracts/options` (no shared storage, balance or call).
//!
//! The executable spec is `packages/risk/pro_v0_model.py` (v0.3.2). Every public function below exists
//! there with the same checks, in the same order, with the same errors; the build brief is
//! `docs/pro-v0-brief-dev2.md`. `contracts/pro/tests/fixtures.rs` replays every scenario of
//! `packages/risk/fixtures/pro_v0.json` and must reproduce results, error codes and state exactly.
//!
//! Conventions shared with the model:
//! - Amounts are exact `i128` USDx units (7 decimals). Every product and sum is checked; an overflow
//!   returns `Error::Overflow` (the model's `chk`). Divisions only ever see non-negative operands, so
//!   Rust `/` equals Python `//`; `ceil_div(a, b) = (a + b - 1) / b` for `a >= 0`.
//! - Any failure reverts the whole invocation (the model's `_tx`).
//! - `Unauthorized`: where the model compares a caller against a stored role or a holder, the contract
//!   calls `caller.require_auth()` AND returns `Error::Unauthorized` when the caller is not that party.
//! - Transfers: the contract pulls with `transfer(who, contract, amount)` after checking
//!   `balance(who) >= amount` (else `InvalidArgs`, as the model's `_pull`), and pushes with
//!   `transfer(contract, who, amount)`. Internal `cash`, `reserved`, `pool` are bookkeeping over the one
//!   SAC balance the contract holds.
//! - `latest_snap()` is the max over the CURRENT snapshot of every series ever listed, ordered by
//!   `(ts, spot)`, exactly as the model (`_latest_snap`). Iterate `0..NextSeries`.
//! - `LiveSeries` holds the ids of series not yet closed (removed in `settle_vault`);
//!   `settlement_pending()` and the `MAX_LIVE_SERIES` check iterate it.
//! - TTL: extend persistent entries on every write and expose a permissionless `extend_ttl`, as
//!   `contracts/options` does (`TTL_THRESHOLD`, `TTL_EXTEND_TO`).
//! - No admin powers beyond `list_series`; no upgrade; config and roles immutable after the constructor.
#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env, Map, Vec};

// ---------------------------------------------------------------------------------------------
// Constants (model header)
// ---------------------------------------------------------------------------------------------

pub const BPS: i128 = 10_000;
pub const N_SCEN: u32 = 16;
/// Index of the extreme up scenario (+ext_mult·U) in `Snapshot.ra`.
pub const EXT_UP: u32 = 14;
pub const MAX_SERIES_PER_ACCOUNT: u32 = 8;
pub const MAX_BOOKS_PER_ACCOUNT: u32 = 16;
pub const MAX_LIVE_SERIES: u32 = 16;
/// Minimum first LP deposit, 100 USDx.
pub const MIN_FIRST_LP: i128 = 100 * 10_000_000;

const DAY_LEDGERS: u32 = 17_280;
pub const TTL_THRESHOLD: u32 = 7 * DAY_LEDGERS;
pub const TTL_EXTEND_TO: u32 = 30 * DAY_LEDGERS;

// ---------------------------------------------------------------------------------------------
// Errors (codes from `ERRORS` in the model; 215 reserved, unused in v0)
// ---------------------------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidArgs = 201,
    NotFound = 202,
    Unauthorized = 203,
    WrongState = 204,
    SeriesExpired = 205,
    NotExpired = 206,
    StaleSnapshot = 207,
    BadSnapshot = 208,
    InsufficientMargin = 209,
    OiCapExceeded = 210,
    NotLiquidable = 211,
    VaultCapacity = 212,
    NoSettlementPrice = 213,
    SettlementWindowClosed = 214,
    WithdrawLocked = 215,
    TooManySeries = 216,
    SelfTrade = 217,
    InsolventTakeover = 218,
    Overflow = 219,
    TooManyPositions = 220,
    RoleNotAllowed = 221,
    PremiumBelowMark = 222,
    OutOfTheMoney = 223,
    LiquidateFirst = 224,
    SettlementPending = 225,
    NoEarlyExercise = 226,
}

// ---------------------------------------------------------------------------------------------
// Types (brief §3, §4, §6; field names match the model and the fixture JSON)
// ---------------------------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarketConfig {
    pub psr_bps: u32,
    pub ext_mult: u32,
    pub short_min_bps: u32,
    pub im_bps: u32,
    pub max_age: u64,
    pub max_series_oi: i128,
    pub max_writer_oi: i128,
    pub bonus_bps: u32,
    pub reserve_fee_bps: u32,
    pub settle_window: u64,
    pub exercise_max_age: u64,
}

/// Owner of a book or subject of `get_requirement`: a private account or the backstop vault.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Writer {
    Account(Address),
    Vault,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Series {
    pub strike: i128,
    pub expiry: u64,
    pub settlement_price: Option<i128>,
    pub oi: i128,
    pub open_books: u32,
    pub shortfall: i128,
    pub vault_paid: i128,
    pub pool: i128,
    pub claimed: i128,
    pub closed: bool,
}

/// Risk snapshot published per series. `ra` has exactly `N_SCEN` entries: the loss of one short lot per
/// scenario (negative = gain), index order fixed by brief §5.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Snapshot {
    pub series_id: u32,
    pub seq: u64,
    pub ts: u64,
    pub spot: i128,
    pub mark: i128,
    pub ra: Vec<i128>,
    pub smin: i128,
    pub liq: i128,
}

/// Private account. `shorts`: series id -> open lots (≤ MAX_SERIES_PER_ACCOUNT entries);
/// `books`: ids of this account's open books (≤ MAX_BOOKS_PER_ACCOUNT); `owed`: debt to the vault.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Account {
    pub cash: i128,
    pub shorts: Map<u32, i128>,
    pub books: Vec<u32>,
    pub owed: i128,
}

/// The vault keeps no book list; `reserved` is the sum of `Book.reserve` over its open books.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultAccount {
    pub cash: i128,
    pub shorts: Map<u32, i128>,
    pub reserved: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Book {
    pub series_id: u32,
    pub owner: Writer,
    pub qty: i128,
    pub settled: bool,
    pub due: i128,
    pub from_owner: i128,
    pub shortfall: i128,
    pub reserve: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Offer {
    pub writer: Address,
    pub series_id: u32,
    pub qty: i128,
    pub premium: i128,
    pub quote_expiry: u64,
    pub open: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub series_id: u32,
    pub holder: Address,
    pub book: u32,
    pub qty: i128,
    pub settled: bool,
    pub exercised: bool,
    pub paid: i128,
    pub deficit: i128,
}

/// `requirement()` of the model. `worst` is the index of the first maximum of the scenario pnl vector
/// (0 when every entry is 0).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Requirement {
    pub nlv: i128,
    pub liability: i128,
    pub expired: i128,
    pub scan: i128,
    pub smin: i128,
    pub liq: i128,
    pub mm: i128,
    pub im: i128,
    pub worst: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExerciseResult {
    pub due: i128,
    pub spot: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TakeoverResult {
    pub x: i128,
    pub paid: i128,
    pub deficit: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SettleResult {
    pub due: i128,
    pub from_owner: i128,
    pub shortfall: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultSettleResult {
    pub shortfall: i128,
    pub vault_paid: i128,
    pub deficit: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimResult {
    pub due: i128,
    pub paid: i128,
    pub deficit: i128,
}

/// Storage keys (brief §4). Scalars live in instance storage; everything else is persistent.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Publisher,
    Quote,
    Cfg,
    NextSeries,
    NextOffer,
    NextPos,
    NextBook,
    TotalShares,
    LiveSeries,
    Vault,
    Series(u32),
    Snap(u32),
    Acct(Address),
    Book(u32),
    Offer(u32),
    Pos(u32),
    Lp(Address),
}

// ---------------------------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------------------------

#[contract]
pub struct ProContract;

#[contractimpl]
impl ProContract {
    /// `admin != publisher`, `cfg.validate()` (model `MarketConfig.validate`), else `InvalidArgs`.
    /// Initializes counters at 0, an empty `LiveSeries`, an empty vault.
    pub fn __constructor(env: Env, admin: Address, publisher: Address, quote: Address, cfg: MarketConfig) {
        let _ = (env, admin, publisher, quote, cfg);
        todo!()
    }

    // ----------------------------------------------------------------- admin / publisher

    /// Model `list_series`. Returns the new series id.
    pub fn list_series(env: Env, admin: Address, strike: i128, expiry: u64) -> Result<u32, Error> {
        let _ = (env, admin, strike, expiry);
        todo!()
    }

    /// Model `publish_risk` (checks 1–9 of brief §5, in order).
    pub fn publish_risk(env: Env, publisher: Address, snap: Snapshot) -> Result<(), Error> {
        let _ = (env, publisher, snap);
        todo!()
    }

    /// Model `publish_settlement`: `expiry <= now <= expiry + settle_window`, once, `price >= 0`.
    pub fn publish_settlement(env: Env, publisher: Address, series_id: u32, price: i128) -> Result<(), Error> {
        let _ = (env, publisher, series_id, price);
        todo!()
    }

    // ----------------------------------------------------------------- margin

    /// Model `deposit`.
    pub fn deposit(env: Env, who: Address, amount: i128) -> Result<(), Error> {
        let _ = (env, who, amount);
        todo!()
    }

    /// Model `withdraw`.
    pub fn withdraw(env: Env, who: Address, amount: i128) -> Result<(), Error> {
        let _ = (env, who, amount);
        todo!()
    }

    // ----------------------------------------------------------------- quotes and purchase

    /// Model `create_offer`. Returns the offer id. No funds move.
    pub fn create_offer(
        env: Env,
        writer: Address,
        series_id: u32,
        qty: i128,
        premium: i128,
        quote_expiry: u64,
    ) -> Result<u32, Error> {
        let _ = (env, writer, series_id, qty, premium, quote_expiry);
        todo!()
    }

    /// Model `cancel_offer`.
    pub fn cancel_offer(env: Env, writer: Address, offer_id: u32) -> Result<(), Error> {
        let _ = (env, writer, offer_id);
        todo!()
    }

    /// Model `buy`. Returns the position id.
    pub fn buy(env: Env, buyer: Address, offer_id: u32) -> Result<u32, Error> {
        let _ = (env, buyer, offer_id);
        todo!()
    }

    // ----------------------------------------------------------------- American exercise

    /// Model `exercise`: whole position, at the latest snapshot (≤ `exercise_max_age` old).
    pub fn exercise(env: Env, holder: Address, pos_id: u32) -> Result<ExerciseResult, Error> {
        let _ = (env, holder, pos_id);
        todo!()
    }

    // ----------------------------------------------------------------- liquidation

    /// Model `liquidate`. `taker = None` is the vault (anyone may call); `Some(t)` requires `t == caller`
    /// (else `Unauthorized`). Writer passed as an `Address` (the vault is never liquidated).
    pub fn liquidate(env: Env, caller: Address, writer: Address, taker: Option<Address>) -> Result<TakeoverResult, Error> {
        let _ = (env, caller, writer, taker);
        todo!()
    }

    // ----------------------------------------------------------------- settlement

    /// Model `settle` (permissionless).
    pub fn settle(env: Env, book_id: u32) -> Result<SettleResult, Error> {
        let _ = (env, book_id);
        todo!()
    }

    /// Model `settle_vault` (permissionless).
    pub fn settle_vault(env: Env, series_id: u32) -> Result<VaultSettleResult, Error> {
        let _ = (env, series_id);
        todo!()
    }

    /// Model `claim` (holder only; pays the caller only).
    pub fn claim(env: Env, holder: Address, pos_id: u32) -> Result<ClaimResult, Error> {
        let _ = (env, holder, pos_id);
        todo!()
    }

    // ----------------------------------------------------------------- vault LP

    /// Model `lp_deposit`. Returns the shares minted. No LP withdrawal in v0.
    pub fn lp_deposit(env: Env, lp: Address, amount: i128) -> Result<i128, Error> {
        let _ = (env, lp, amount);
        todo!()
    }

    // ----------------------------------------------------------------- maintenance

    /// Permissionless TTL extension of the instance and the listed entries (not in the model).
    pub fn extend_ttl(env: Env, series_ids: Vec<u32>, book_ids: Vec<u32>, pos_ids: Vec<u32>) {
        let _ = (env, series_ids, book_ids, pos_ids);
        todo!()
    }

    // ----------------------------------------------------------------- views

    /// Model `requirement(who)`; `Writer::Vault` for the vault. Fails with `StaleSnapshot` like the model.
    pub fn get_requirement(env: Env, who: Writer) -> Result<Requirement, Error> {
        let _ = (env, who);
        todo!()
    }

    /// Model `vault_value()`: vault cash when it has no shorts, else its NLV.
    pub fn vault_value(env: Env) -> Result<i128, Error> {
        let _ = env;
        todo!()
    }

    /// Account view; an account that never interacted reads as all-zero (empty maps and vectors).
    pub fn get_account(env: Env, who: Address) -> Account {
        let _ = (env, who);
        todo!()
    }

    pub fn get_vault(env: Env) -> VaultAccount {
        let _ = env;
        todo!()
    }

    pub fn get_series(env: Env, series_id: u32) -> Result<Series, Error> {
        let _ = (env, series_id);
        todo!()
    }

    pub fn get_snapshot(env: Env, series_id: u32) -> Result<Snapshot, Error> {
        let _ = (env, series_id);
        todo!()
    }

    pub fn get_book(env: Env, book_id: u32) -> Result<Book, Error> {
        let _ = (env, book_id);
        todo!()
    }

    pub fn get_offer(env: Env, offer_id: u32) -> Result<Offer, Error> {
        let _ = (env, offer_id);
        todo!()
    }

    pub fn get_position(env: Env, pos_id: u32) -> Result<Position, Error> {
        let _ = (env, pos_id);
        todo!()
    }

    /// LP shares of `lp` (0 if none).
    pub fn lp_shares(env: Env, lp: Address) -> i128 {
        let _ = (env, lp);
        todo!()
    }

    pub fn total_shares(env: Env) -> i128 {
        let _ = env;
        todo!()
    }

    /// Number of series listed so far (ids are `0..series_count`).
    pub fn series_count(env: Env) -> u32 {
        let _ = env;
        todo!()
    }

    pub fn config(env: Env) -> MarketConfig {
        let _ = env;
        todo!()
    }

    pub fn admin(env: Env) -> Address {
        let _ = env;
        todo!()
    }

    pub fn publisher(env: Env) -> Address {
        let _ = env;
        todo!()
    }

    pub fn quote(env: Env) -> Address {
        let _ = env;
        todo!()
    }
}

#[allow(dead_code)]
fn _token_client(env: &Env, quote: &Address) -> token::TokenClient<'static> {
    // Keeps the `token` import used until the implementation lands.
    let _ = (env, quote);
    todo!()
}
