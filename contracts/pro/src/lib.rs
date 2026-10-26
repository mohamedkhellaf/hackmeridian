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

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token, Address,
    Env, IntoVal, Map, TryFromVal, Val, Vec,
};

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
// Events (fixed-size; brief §6)
// ---------------------------------------------------------------------------------------------

#[contractevent]
pub struct SeriesListed {
    #[topic]
    pub series_id: u32,
    pub strike: i128,
    pub expiry: u64,
}

#[contractevent]
pub struct RiskPublished {
    #[topic]
    pub series_id: u32,
    pub seq: u64,
    pub spot: i128,
    pub mark: i128,
}

#[contractevent]
pub struct Deposited {
    #[topic]
    pub who: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Withdrawn {
    #[topic]
    pub who: Address,
    pub amount: i128,
}

#[contractevent]
pub struct OfferCreated {
    #[topic]
    pub offer_id: u32,
    pub writer: Address,
    pub series_id: u32,
    pub qty: i128,
    pub premium: i128,
    pub quote_expiry: u64,
}

#[contractevent]
pub struct OfferCancelled {
    #[topic]
    pub offer_id: u32,
}

#[contractevent]
pub struct Bought {
    #[topic]
    pub pos_id: u32,
    pub holder: Address,
    pub writer: Address,
    pub qty: i128,
    pub premium: i128,
    pub fee: i128,
}

#[contractevent]
pub struct Exercised {
    #[topic]
    pub pos_id: u32,
    pub holder: Address,
    pub owner: Address,
    pub qty: i128,
    pub spot: i128,
    pub due: i128,
}

#[contractevent]
pub struct DebtRepaid {
    #[topic]
    pub who: Address,
    pub amount: i128,
}

#[contractevent]
pub struct TakenOver {
    #[topic]
    pub writer: Address,
    pub taker: Writer,
    pub x: i128,
    pub paid: i128,
    pub deficit: i128,
}

#[contractevent]
pub struct SettlementPublished {
    #[topic]
    pub series_id: u32,
    pub price: i128,
}

#[contractevent]
pub struct BookSettled {
    #[topic]
    pub book_id: u32,
    pub owner: Writer,
    pub due: i128,
    pub from_owner: i128,
    pub shortfall: i128,
}

#[contractevent]
pub struct VaultSettled {
    #[topic]
    pub series_id: u32,
    pub shortfall: i128,
    pub vault_paid: i128,
    pub deficit: i128,
}

#[contractevent]
pub struct Claimed {
    #[topic]
    pub pos_id: u32,
    pub holder: Address,
    pub due: i128,
    pub paid: i128,
    pub deficit: i128,
}

#[contractevent]
pub struct LpDeposited {
    #[topic]
    pub lp: Address,
    pub amount: i128,
    pub shares: i128,
}

// ---------------------------------------------------------------------------------------------
// Private helpers: arithmetic (the model's `chk`)
// ---------------------------------------------------------------------------------------------

fn add(a: i128, b: i128) -> Result<i128, Error> {
    a.checked_add(b).ok_or(Error::Overflow)
}

fn sub(a: i128, b: i128) -> Result<i128, Error> {
    a.checked_sub(b).ok_or(Error::Overflow)
}

fn mul(a: i128, b: i128) -> Result<i128, Error> {
    a.checked_mul(b).ok_or(Error::Overflow)
}

/// `ceil_div(a, b)` for `a >= 0`, `b > 0`.
fn ceil_div(a: i128, b: i128) -> Result<i128, Error> {
    Ok(add(add(a, b)?, -1)? / b)
}

fn max0(x: i128) -> i128 {
    if x > 0 {
        x
    } else {
        0
    }
}

fn min(a: i128, b: i128) -> i128 {
    if a < b {
        a
    } else {
        b
    }
}

// ---------------------------------------------------------------------------------------------
// Private helpers: storage (TTL extended on every write, as `contracts/options`)
// ---------------------------------------------------------------------------------------------

fn bump_instance(e: &Env) {
    e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn pget<V: TryFromVal<Env, Val>>(e: &Env, key: &DataKey) -> Option<V> {
    e.storage().persistent().get(key)
}

fn pset<V: IntoVal<Env, Val>>(e: &Env, key: &DataKey, v: &V) {
    e.storage().persistent().set(key, v);
    e.storage().persistent().extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn pbump(e: &Env, key: &DataKey) {
    if e.storage().persistent().has(key) {
        e.storage().persistent().extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

fn iget_u32(e: &Env, key: DataKey) -> u32 {
    e.storage().instance().get(&key).unwrap_or(0)
}

fn iset_u32(e: &Env, key: DataKey, v: u32) {
    e.storage().instance().set(&key, &v);
}

fn now(e: &Env) -> u64 {
    e.ledger().timestamp()
}

fn cfg(e: &Env) -> MarketConfig {
    e.storage().instance().get(&DataKey::Cfg).unwrap()
}

fn admin_addr(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Admin).unwrap()
}

fn publisher_addr(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Publisher).unwrap()
}

fn quote_addr(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Quote).unwrap()
}

fn total_shares_of(e: &Env) -> i128 {
    e.storage().instance().get(&DataKey::TotalShares).unwrap_or(0)
}

fn live_series(e: &Env) -> Vec<u32> {
    e.storage().instance().get(&DataKey::LiveSeries).unwrap_or_else(|| Vec::new(e))
}

fn load_series(e: &Env, sid: u32) -> Result<Series, Error> {
    pget(e, &DataKey::Series(sid)).ok_or(Error::NotFound)
}

fn save_series(e: &Env, sid: u32, s: &Series) {
    pset(e, &DataKey::Series(sid), s);
}

fn load_snap(e: &Env, sid: u32) -> Option<Snapshot> {
    pget(e, &DataKey::Snap(sid))
}

fn default_acct(e: &Env) -> Account {
    Account { cash: 0, shorts: Map::new(e), books: Vec::new(e), owed: 0 }
}

fn load_acct(e: &Env, who: &Address) -> Account {
    pget(e, &DataKey::Acct(who.clone())).unwrap_or_else(|| default_acct(e))
}

fn save_acct(e: &Env, who: &Address, a: &Account) {
    pset(e, &DataKey::Acct(who.clone()), a);
}

fn load_vault(e: &Env) -> VaultAccount {
    pget(e, &DataKey::Vault).unwrap_or_else(|| VaultAccount { cash: 0, shorts: Map::new(e), reserved: 0 })
}

fn save_vault(e: &Env, v: &VaultAccount) {
    pset(e, &DataKey::Vault, v);
}

fn load_book(e: &Env, id: u32) -> Result<Book, Error> {
    pget(e, &DataKey::Book(id)).ok_or(Error::NotFound)
}

fn save_book(e: &Env, id: u32, b: &Book) {
    pset(e, &DataKey::Book(id), b);
}

fn load_offer(e: &Env, id: u32) -> Result<Offer, Error> {
    pget(e, &DataKey::Offer(id)).ok_or(Error::NotFound)
}

fn save_offer(e: &Env, id: u32, o: &Offer) {
    pset(e, &DataKey::Offer(id), o);
}

fn load_pos(e: &Env, id: u32) -> Result<Position, Error> {
    pget(e, &DataKey::Pos(id)).ok_or(Error::NotFound)
}

fn save_pos(e: &Env, id: u32, p: &Position) {
    pset(e, &DataKey::Pos(id), p);
}

// ---------------------------------------------------------------------------------------------
// Private helpers: tokens, roles, collections
// ---------------------------------------------------------------------------------------------

/// Model `_pull`: `InvalidArgs` when the wallet balance is short, else wallet -> contract.
fn pull(e: &Env, who: &Address, amount: i128) -> Result<(), Error> {
    let c = token::TokenClient::new(e, &quote_addr(e));
    if c.balance(who) < amount {
        return Err(Error::InvalidArgs);
    }
    c.transfer(who, &e.current_contract_address(), &amount);
    Ok(())
}

/// Model `_push`: contract -> wallet (always the caller).
fn push(e: &Env, who: &Address, amount: i128) {
    token::TokenClient::new(e, &quote_addr(e)).transfer(&e.current_contract_address(), who, &amount);
}

fn not_role(e: &Env, who: &Address) -> Result<(), Error> {
    if *who == admin_addr(e) || *who == publisher_addr(e) {
        return Err(Error::RoleNotAllowed);
    }
    Ok(())
}

fn inc_short(m: &mut Map<u32, i128>, sid: u32, q: i128) -> Result<(), Error> {
    let v = add(m.get(sid).unwrap_or(0), q)?;
    m.set(sid, v);
    Ok(())
}

/// `shorts[sid] -= q; if shorts[sid] == 0: del shorts[sid]`.
fn dec_short(m: &mut Map<u32, i128>, sid: u32, q: i128) -> Result<(), Error> {
    let v = sub(m.get(sid).unwrap_or(0), q)?;
    if v == 0 {
        m.remove(sid);
    } else {
        m.set(sid, v);
    }
    Ok(())
}

fn sum_shorts(m: &Map<u32, i128>) -> Result<i128, Error> {
    let mut s = 0i128;
    for (_, q) in m.iter() {
        s = add(s, q)?;
    }
    Ok(s)
}

fn any_short(m: &Map<u32, i128>) -> bool {
    for (_, q) in m.iter() {
        if q != 0 {
            return true;
        }
    }
    false
}

fn vec_remove(v: &mut Vec<u32>, x: u32) {
    if let Some(i) = v.first_index_of(x) {
        v.remove(i);
    }
}

/// `any(q and not live(sid))`.
fn has_expired_short(e: &Env, m: &Map<u32, i128>) -> Result<bool, Error> {
    let t = now(e);
    for (sid, q) in m.iter() {
        if q != 0 && t >= load_series(e, sid)?.expiry {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Model `_expired_unpriced`.
fn expired_unpriced(e: &Env, m: &Map<u32, i128>) -> Result<bool, Error> {
    let t = now(e);
    for (sid, q) in m.iter() {
        if q != 0 {
            let s = load_series(e, sid)?;
            if t >= s.expiry && s.settlement_price.is_none() {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

/// Model `_settlement_pending` over `LiveSeries`.
fn settlement_pending(e: &Env) -> Result<bool, Error> {
    let t = now(e);
    for sid in live_series(e).iter() {
        let s = load_series(e, sid)?;
        if !s.closed && t >= s.expiry && (s.oi != 0 || s.open_books != 0 || s.shortfall != 0) {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Model `_repay`: `min(cash (capped), owed)` from `a` to the vault. Caller saves both.
fn repay(
    e: &Env,
    who: &Address,
    a: &mut Account,
    vault: &mut VaultAccount,
    cap: Option<i128>,
) -> Result<(), Error> {
    let avail = match cap {
        None => a.cash,
        Some(c) => min(a.cash, c),
    };
    let paid = min(avail, a.owed);
    if paid != 0 {
        a.cash = sub(a.cash, paid)?;
        a.owed = sub(a.owed, paid)?;
        vault.cash = add(vault.cash, paid)?;
        DebtRepaid { who: who.clone(), amount: paid }.publish(e);
    }
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Private helpers: risk (model `_fresh`, `_latest_snap`, `_expired_liability`, `requirement`)
// ---------------------------------------------------------------------------------------------

/// Common view of a private account or the vault for `requirement()`.
struct Risk {
    cash: i128,
    reserved: i128,
    owed: i128,
    shorts: Map<u32, i128>,
}

fn risk_of_acct(a: &Account) -> Risk {
    Risk { cash: a.cash, reserved: 0, owed: a.owed, shorts: a.shorts.clone() }
}

fn risk_of_vault(v: &VaultAccount) -> Risk {
    Risk { cash: v.cash, reserved: v.reserved, owed: 0, shorts: v.shorts.clone() }
}

fn age(e: &Env, ts: u64) -> i128 {
    (now(e) as i128) - (ts as i128)
}

fn fresh(e: &Env, c: &MarketConfig, sid: u32) -> Result<Snapshot, Error> {
    let s = load_snap(e, sid).ok_or(Error::StaleSnapshot)?;
    if age(e, s.ts) > c.max_age as i128 {
        return Err(Error::StaleSnapshot);
    }
    Ok(s)
}

fn latest_snap(e: &Env) -> Option<Snapshot> {
    let n = iget_u32(e, DataKey::NextSeries);
    let mut best: Option<Snapshot> = None;
    for sid in 0..n {
        if let Some(s) = load_snap(e, sid) {
            let better = match &best {
                None => true,
                Some(b) => s.ts > b.ts || (s.ts == b.ts && s.spot > b.spot),
            };
            if better {
                best = Some(s);
            }
        }
    }
    best
}

fn s_up(c: &MarketConfig, spot: i128) -> Result<i128, Error> {
    Ok(mul(spot, BPS + (c.ext_mult as i128) * (c.psr_bps as i128))? / BPS)
}

fn expired_liability(e: &Env, c: &MarketConfig, ser: &Series, q: i128) -> Result<i128, Error> {
    if let Some(sp) = ser.settlement_price {
        return mul(q, max0(sub(sp, ser.strike)?));
    }
    match latest_snap(e) {
        None => Ok(0),
        Some(s) => mul(q, max0(sub(s_up(c, s.spot)?, ser.strike)?)),
    }
}

fn requirement(e: &Env, c: &MarketConfig, r: &Risk) -> Result<Requirement, Error> {
    let t = now(e);
    let mut liability = 0i128;
    let mut expired = 0i128;
    let mut pnl = [0i128; N_SCEN as usize];
    let mut smin = 0i128;
    let mut liq = 0i128;
    for (sid, q) in r.shorts.iter() {
        if q == 0 {
            continue;
        }
        let ser = load_series(e, sid)?;
        if t >= ser.expiry {
            expired = add(expired, expired_liability(e, c, &ser, q)?)?;
            continue;
        }
        let s = fresh(e, c, sid)?;
        liability = add(liability, mul(q, s.mark)?)?;
        for (w, slot) in pnl.iter_mut().enumerate() {
            let ra = s.ra.get(w as u32).ok_or(Error::BadSnapshot)?;
            *slot = add(*slot, mul(q, ra)?)?;
        }
        smin = add(smin, mul(q, s.smin)?)?;
        liq = add(liq, mul(q, s.liq)?)?;
    }
    let mut maxp = pnl[0];
    let mut worst = 0u32;
    let mut any = false;
    for (w, v) in pnl.iter().enumerate() {
        if *v != 0 {
            any = true;
        }
        if *v > maxp {
            maxp = *v;
            worst = w as u32;
        }
    }
    if !any {
        worst = 0;
    }
    let scan = max0(maxp);
    let mm = add(if scan > smin { scan } else { smin }, liq)?;
    let im = ceil_div(mul(mm, c.im_bps as i128)?, BPS)?;
    let nlv = sub(sub(sub(add(r.cash, r.reserved)?, r.owed)?, liability)?, expired)?;
    Ok(Requirement { nlv, liability, expired, scan, smin, liq, mm, im, worst })
}

fn vault_value_of(e: &Env, c: &MarketConfig, v: &VaultAccount) -> Result<i128, Error> {
    if !any_short(&v.shorts) {
        Ok(v.cash)
    } else {
        Ok(requirement(e, c, &risk_of_vault(v))?.nlv)
    }
}

fn validate(c: &MarketConfig) -> bool {
    let psr = c.psr_bps as i128;
    let smin = c.short_min_bps as i128;
    let im = c.im_bps as i128;
    psr > 0
        && psr <= BPS
        && (1..=4).contains(&c.ext_mult)
        && smin > 0
        && smin <= BPS
        && im >= BPS
        && im <= 3 * BPS
        && c.max_age > 0
        && c.max_series_oi > 0
        && c.max_writer_oi > 0
        && c.max_writer_oi <= c.max_series_oi
        && c.bonus_bps <= 1_000
        && (c.reserve_fee_bps as i128) <= BPS
        && c.settle_window > 0
        && c.exercise_max_age > 0
        && c.exercise_max_age <= c.max_age
}

/// Model `_book_for`: the owner's oldest open book on the series, else a new one.
fn book_for(e: &Env, owner: &Address, a: &mut Account, sid: u32, ser: &mut Series) -> Result<(u32, Book), Error> {
    for bid in a.books.iter() {
        let b = load_book(e, bid)?;
        if b.series_id == sid && !b.settled {
            return Ok((bid, b));
        }
    }
    if a.books.len() >= MAX_BOOKS_PER_ACCOUNT {
        return Err(Error::TooManyPositions);
    }
    let bid = iget_u32(e, DataKey::NextBook);
    let b = Book {
        series_id: sid,
        owner: Writer::Account(owner.clone()),
        qty: 0,
        settled: false,
        due: 0,
        from_owner: 0,
        shortfall: 0,
        reserve: 0,
    };
    a.books.push_back(bid);
    ser.open_books = ser.open_books.checked_add(1).ok_or(Error::Overflow)?;
    iset_u32(e, DataKey::NextBook, bid.checked_add(1).ok_or(Error::Overflow)?);
    Ok((bid, b))
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
        if admin == publisher || !validate(&cfg) {
            panic_with_error!(&env, Error::InvalidArgs);
        }
        let st = env.storage().instance();
        st.set(&DataKey::Admin, &admin);
        st.set(&DataKey::Publisher, &publisher);
        st.set(&DataKey::Quote, &quote);
        st.set(&DataKey::Cfg, &cfg);
        st.set(&DataKey::NextSeries, &0u32);
        st.set(&DataKey::NextOffer, &0u32);
        st.set(&DataKey::NextPos, &0u32);
        st.set(&DataKey::NextBook, &0u32);
        st.set(&DataKey::TotalShares, &0i128);
        st.set(&DataKey::LiveSeries, &Vec::<u32>::new(&env));
        save_vault(&env, &VaultAccount { cash: 0, shorts: Map::new(&env), reserved: 0 });
        bump_instance(&env);
    }

    // ----------------------------------------------------------------- admin / publisher

    /// Model `list_series`. Returns the new series id.
    pub fn list_series(env: Env, admin: Address, strike: i128, expiry: u64) -> Result<u32, Error> {
        admin.require_auth();
        if admin != admin_addr(&env) {
            return Err(Error::Unauthorized);
        }
        if strike <= 0 || expiry <= now(&env) {
            return Err(Error::InvalidArgs);
        }
        let mut live = live_series(&env);
        if live.len() >= MAX_LIVE_SERIES {
            return Err(Error::TooManySeries);
        }
        let sid = iget_u32(&env, DataKey::NextSeries);
        save_series(
            &env,
            sid,
            &Series {
                strike,
                expiry,
                settlement_price: None,
                oi: 0,
                open_books: 0,
                shortfall: 0,
                vault_paid: 0,
                pool: 0,
                claimed: 0,
                closed: false,
            },
        );
        live.push_back(sid);
        env.storage().instance().set(&DataKey::LiveSeries, &live);
        iset_u32(&env, DataKey::NextSeries, sid.checked_add(1).ok_or(Error::Overflow)?);
        bump_instance(&env);
        SeriesListed { series_id: sid, strike, expiry }.publish(&env);
        Ok(sid)
    }

    /// Model `publish_risk` (checks 1–9 of brief §5, in order).
    pub fn publish_risk(env: Env, publisher: Address, snap: Snapshot) -> Result<(), Error> {
        publisher.require_auth();
        if publisher != publisher_addr(&env) {
            return Err(Error::Unauthorized);
        }
        let c = cfg(&env);
        let t = now(&env);
        let ser = load_series(&env, snap.series_id)?;
        if t >= ser.expiry {
            return Err(Error::SeriesExpired);
        }
        let prev = load_snap(&env, snap.series_id);
        if snap.ts > t || age(&env, snap.ts) > c.max_age as i128 {
            return Err(Error::StaleSnapshot);
        }
        if let Some(p) = prev {
            if snap.seq <= p.seq || snap.ts < p.ts {
                return Err(Error::BadSnapshot);
            }
        }
        if snap.ra.len() != N_SCEN || snap.spot <= 0 || snap.liq < 0 {
            return Err(Error::BadSnapshot);
        }
        let intrinsic = max0(sub(snap.spot, ser.strike)?);
        if !(intrinsic <= snap.mark && snap.mark <= snap.spot) {
            return Err(Error::BadSnapshot);
        }
        if snap.smin < ceil_div(mul(snap.spot, c.short_min_bps as i128)?, BPS)? {
            return Err(Error::BadSnapshot);
        }
        let up = s_up(&c, snap.spot)?;
        let floor = sub(max0(sub(up, ser.strike)?), snap.mark)?;
        if snap.ra.get(EXT_UP).ok_or(Error::BadSnapshot)? < floor {
            return Err(Error::BadSnapshot);
        }
        pset(&env, &DataKey::Snap(snap.series_id), &snap);
        pbump(&env, &DataKey::Series(snap.series_id));
        bump_instance(&env);
        RiskPublished { series_id: snap.series_id, seq: snap.seq, spot: snap.spot, mark: snap.mark }.publish(&env);
        Ok(())
    }

    /// Model `publish_settlement`: `expiry <= now <= expiry + settle_window`, once, `price >= 0`.
    pub fn publish_settlement(env: Env, publisher: Address, series_id: u32, price: i128) -> Result<(), Error> {
        publisher.require_auth();
        if publisher != publisher_addr(&env) {
            return Err(Error::Unauthorized);
        }
        let mut ser = load_series(&env, series_id)?;
        let t = now(&env);
        if t < ser.expiry {
            return Err(Error::NotExpired);
        }
        let c = cfg(&env);
        if (t as i128) > (ser.expiry as i128) + (c.settle_window as i128) {
            return Err(Error::SettlementWindowClosed);
        }
        if ser.settlement_price.is_some() {
            return Err(Error::WrongState);
        }
        if price < 0 {
            return Err(Error::InvalidArgs);
        }
        ser.settlement_price = Some(price);
        save_series(&env, series_id, &ser);
        bump_instance(&env);
        SettlementPublished { series_id, price }.publish(&env);
        Ok(())
    }

    // ----------------------------------------------------------------- margin

    /// Model `deposit`.
    pub fn deposit(env: Env, who: Address, amount: i128) -> Result<(), Error> {
        who.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidArgs);
        }
        not_role(&env, &who)?;
        pull(&env, &who, amount)?;
        let mut a = load_acct(&env, &who);
        a.cash = add(a.cash, amount)?;
        save_acct(&env, &who, &a);
        bump_instance(&env);
        Deposited { who, amount }.publish(&env);
        Ok(())
    }

    /// Model `withdraw`.
    pub fn withdraw(env: Env, who: Address, amount: i128) -> Result<(), Error> {
        who.require_auth();
        let mut a = load_acct(&env, &who);
        if amount <= 0 || amount > a.cash {
            return Err(Error::InvalidArgs);
        }
        if has_expired_short(&env, &a.shorts)? {
            return Err(Error::SeriesExpired);
        }
        if a.owed != 0 {
            let mut vault = load_vault(&env);
            repay(&env, &who, &mut a, &mut vault, None)?;
            save_vault(&env, &vault);
            if amount > a.cash {
                return Err(Error::InvalidArgs);
            }
        }
        if any_short(&a.shorts) {
            let r = requirement(&env, &cfg(&env), &risk_of_acct(&a))?;
            if sub(r.nlv, amount)? < r.im {
                return Err(Error::InsufficientMargin);
            }
        }
        a.cash = sub(a.cash, amount)?;
        save_acct(&env, &who, &a);
        push(&env, &who, amount);
        bump_instance(&env);
        Withdrawn { who, amount }.publish(&env);
        Ok(())
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
        writer.require_auth();
        let ser = load_series(&env, series_id)?;
        if qty <= 0 || premium <= 0 || quote_expiry <= now(&env) || quote_expiry > ser.expiry {
            return Err(Error::InvalidArgs);
        }
        not_role(&env, &writer)?;
        let oid = iget_u32(&env, DataKey::NextOffer);
        save_offer(
            &env,
            oid,
            &Offer { writer: writer.clone(), series_id, qty, premium, quote_expiry, open: true },
        );
        iset_u32(&env, DataKey::NextOffer, oid.checked_add(1).ok_or(Error::Overflow)?);
        bump_instance(&env);
        OfferCreated { offer_id: oid, writer, series_id, qty, premium, quote_expiry }.publish(&env);
        Ok(oid)
    }

    /// Model `cancel_offer`.
    pub fn cancel_offer(env: Env, writer: Address, offer_id: u32) -> Result<(), Error> {
        writer.require_auth();
        let mut o = load_offer(&env, offer_id)?;
        if o.writer != writer {
            return Err(Error::Unauthorized);
        }
        if !o.open {
            return Err(Error::WrongState);
        }
        o.open = false;
        save_offer(&env, offer_id, &o);
        bump_instance(&env);
        OfferCancelled { offer_id }.publish(&env);
        Ok(())
    }

    /// Model `buy`. Returns the position id.
    pub fn buy(env: Env, buyer: Address, offer_id: u32) -> Result<u32, Error> {
        buyer.require_auth();
        let c = cfg(&env);
        let t = now(&env);
        let mut o = load_offer(&env, offer_id)?;
        if !o.open {
            return Err(Error::WrongState);
        }
        let sid = o.series_id;
        let mut ser = load_series(&env, sid)?;
        if t >= o.quote_expiry || t >= ser.expiry {
            return Err(Error::SeriesExpired);
        }
        if buyer == o.writer {
            return Err(Error::SelfTrade);
        }
        not_role(&env, &buyer)?;
        let writer = o.writer.clone();
        let mut w = load_acct(&env, &writer);
        if add(ser.oi, o.qty)? > c.max_series_oi || add(sum_shorts(&w.shorts)?, o.qty)? > c.max_writer_oi {
            return Err(Error::OiCapExceeded);
        }
        if !w.shorts.contains_key(sid) && w.shorts.len() >= MAX_SERIES_PER_ACCOUNT {
            return Err(Error::TooManySeries);
        }
        let s = fresh(&env, &c, sid)?;
        if o.premium < mul(o.qty, s.mark)? {
            return Err(Error::PremiumBelowMark);
        }
        // transfers: premium -> contract; reserve share -> vault; rest -> writer margin
        pull(&env, &buyer, o.premium)?;
        let fee = mul(o.premium, c.reserve_fee_bps as i128)? / BPS;
        w.cash = add(w.cash, sub(o.premium, fee)?)?;
        let mut vault = load_vault(&env);
        vault.cash = add(vault.cash, fee)?;
        let (bid, mut book) = book_for(&env, &writer, &mut w, sid, &mut ser)?;
        book.qty = add(book.qty, o.qty)?;
        inc_short(&mut w.shorts, sid, o.qty)?;
        ser.oi = add(ser.oi, o.qty)?;
        o.open = false;
        let pid = iget_u32(&env, DataKey::NextPos);
        let p = Position {
            series_id: sid,
            holder: buyer.clone(),
            book: bid,
            qty: o.qty,
            settled: false,
            exercised: false,
            paid: 0,
            deficit: 0,
        };
        iset_u32(&env, DataKey::NextPos, pid.checked_add(1).ok_or(Error::Overflow)?);
        save_offer(&env, offer_id, &o);
        save_series(&env, sid, &ser);
        save_book(&env, bid, &book);
        save_acct(&env, &writer, &w);
        save_vault(&env, &vault);
        save_pos(&env, pid, &p);
        // margin AFTER the trade
        let r = requirement(&env, &c, &risk_of_acct(&w))?;
        if r.nlv < r.im {
            return Err(Error::InsufficientMargin);
        }
        bump_instance(&env);
        Bought { pos_id: pid, holder: buyer, writer, qty: o.qty, premium: o.premium, fee }.publish(&env);
        Ok(pid)
    }

    // ----------------------------------------------------------------- American exercise

    /// Model `exercise`: whole position, at the latest snapshot (≤ `exercise_max_age` old).
    pub fn exercise(env: Env, holder: Address, pos_id: u32) -> Result<ExerciseResult, Error> {
        holder.require_auth();
        let c = cfg(&env);
        let t = now(&env);
        let mut p = load_pos(&env, pos_id)?;
        if p.holder != holder {
            return Err(Error::Unauthorized);
        }
        let mut book = load_book(&env, p.book)?;
        if p.settled || book.settled {
            return Err(Error::WrongState);
        }
        let sid = p.series_id;
        let mut ser = load_series(&env, sid)?;
        if t >= ser.expiry {
            return Err(Error::SeriesExpired);
        }
        let owner = match &book.owner {
            Writer::Vault => return Err(Error::NoEarlyExercise),
            Writer::Account(a) => a.clone(),
        };
        let snap = load_snap(&env, sid).ok_or(Error::StaleSnapshot)?;
        if age(&env, snap.ts) > c.exercise_max_age as i128 {
            return Err(Error::StaleSnapshot);
        }
        let per_lot = max0(sub(snap.spot, ser.strike)?);
        if per_lot == 0 {
            return Err(Error::OutOfTheMoney);
        }
        let mut a = load_acct(&env, &owner);
        if expired_unpriced(&env, &a.shorts)? {
            return Err(Error::SettlementPending);
        }
        let r = requirement(&env, &c, &risk_of_acct(&a))?;
        if r.nlv < r.mm {
            return Err(Error::LiquidateFirst);
        }
        let due = mul(p.qty, per_lot)?;
        a.cash = sub(a.cash, due)?;
        dec_short(&mut a.shorts, sid, p.qty)?;
        book.qty = sub(book.qty, p.qty)?;
        ser.oi = sub(ser.oi, p.qty)?;
        if book.qty == 0 {
            book.settled = true;
            ser.open_books = ser.open_books.checked_sub(1).ok_or(Error::Overflow)?;
            vec_remove(&mut a.books, p.book);
        }
        p.settled = true;
        p.exercised = true;
        p.paid = due;
        save_acct(&env, &owner, &a);
        save_book(&env, p.book, &book);
        save_series(&env, sid, &ser);
        save_pos(&env, pos_id, &p);
        push(&env, &holder, due);
        bump_instance(&env);
        Exercised { pos_id, holder, owner, qty: p.qty, spot: snap.spot, due }.publish(&env);
        Ok(ExerciseResult { due, spot: snap.spot })
    }

    // ----------------------------------------------------------------- liquidation

    /// Model `liquidate`. `taker = None` is the vault (anyone may call); `Some(t)` requires `t == caller`
    /// (else `Unauthorized`). Writer passed as an `Address` (the vault is never liquidated).
    pub fn liquidate(env: Env, caller: Address, writer: Address, taker: Option<Address>) -> Result<TakeoverResult, Error> {
        caller.require_auth();
        if let Some(t) = &taker {
            if *t != caller {
                return Err(Error::Unauthorized);
            }
        }
        if taker.as_ref() == Some(&writer) {
            return Err(Error::InvalidArgs);
        }
        if let Some(t) = &taker {
            not_role(&env, t)?;
        }
        let c = cfg(&env);
        let t_now = now(&env);
        let mut w = load_acct(&env, &writer);
        // live shorts of the writer (sorted by series id, as the model's dict insertion order)
        let mut live: Map<u32, i128> = Map::new(&env);
        for (sid, q) in w.shorts.iter() {
            if q != 0 && t_now < load_series(&env, sid)?.expiry {
                live.set(sid, q);
            }
        }
        if live.is_empty() {
            return Err(Error::NotLiquidable);
        }
        let r = requirement(&env, &c, &risk_of_acct(&w))?;
        if r.nlv >= r.mm {
            return Err(Error::NotLiquidable);
        }
        // takeover price: mark + bonus, rounded down
        let bonus = BPS + c.bonus_bps as i128;
        let mut x = 0i128;
        for (sid, q) in live.iter() {
            let s = load_snap(&env, sid).ok_or(Error::StaleSnapshot)?;
            x = add(x, mul(mul(q, s.mark)?, bonus)? / BPS)?;
        }
        let pay = min(x, max0(sub(sub(w.cash, r.expired)?, w.owed)?));
        let deficit = sub(x, pay)?;
        if taker.is_some() && deficit > 0 {
            return Err(Error::InsolventTakeover);
        }
        let mut vault = load_vault(&env);
        let mut t_acct: Option<Account> = taker.as_ref().map(|t| load_acct(&env, t));
        // books of the writer on live series move with the shorts; expired books stay
        let mut moved_ids: Vec<u32> = Vec::new(&env);
        let mut moved_books: Vec<Book> = Vec::new(&env);
        for bid in w.books.iter() {
            let b = load_book(&env, bid)?;
            if t_now < load_series(&env, b.series_id)?.expiry {
                moved_ids.push_back(bid);
                moved_books.push_back(b);
            }
        }
        if let Some(t) = &t_acct {
            let mut new_series = 0u32;
            for (sid, _) in live.iter() {
                if !t.shorts.contains_key(sid) {
                    new_series += 1;
                }
            }
            if t.shorts.len() + new_series > MAX_SERIES_PER_ACCOUNT {
                return Err(Error::TooManySeries);
            }
            if add(sum_shorts(&t.shorts)?, sum_shorts(&live)?)? > c.max_writer_oi {
                return Err(Error::OiCapExceeded);
            }
            if t.books.len() + moved_ids.len() > MAX_BOOKS_PER_ACCOUNT {
                return Err(Error::TooManyPositions);
            }
        }
        w.cash = sub(w.cash, pay)?;
        match &mut t_acct {
            None => {
                // the payment stays attached to the moved books, pro rata to their takeover value; rounding
                // dust goes to the vault cash; the deficit becomes the writer's debt
                let mut vals: Vec<i128> = Vec::new(&env);
                let mut total_v = 0i128;
                for b in moved_books.iter() {
                    let s = load_snap(&env, b.series_id).ok_or(Error::StaleSnapshot)?;
                    let v = mul(mul(b.qty, s.mark)?, bonus)? / BPS;
                    vals.push_back(v);
                    total_v = add(total_v, v)?;
                }
                let mut shares = 0i128;
                for i in 0..moved_books.len() {
                    let v = vals.get(i).ok_or(Error::NotFound)?;
                    let share = if total_v != 0 { mul(pay, v)? / total_v } else { 0 };
                    let mut b = moved_books.get(i).ok_or(Error::NotFound)?;
                    b.reserve = add(b.reserve, share)?;
                    moved_books.set(i, b);
                    vault.reserved = add(vault.reserved, share)?;
                    shares = add(shares, share)?;
                }
                vault.cash = add(vault.cash, sub(pay, shares)?)?;
                w.owed = add(w.owed, deficit)?;
            }
            Some(t) => {
                t.cash = add(t.cash, pay)?;
            }
        }
        // any takeover collects the vault's claim at once, from the cash not reserved for expired debt
        let cap = max0(sub(w.cash, r.expired)?);
        repay(&env, &writer, &mut w, &mut vault, Some(cap))?;
        for (sid, q) in live.iter() {
            match &mut t_acct {
                None => inc_short(&mut vault.shorts, sid, q)?,
                Some(t) => inc_short(&mut t.shorts, sid, q)?,
            }
            w.shorts.remove(sid);
        }
        let taker_w = match &taker {
            None => Writer::Vault,
            Some(t) => Writer::Account(t.clone()),
        };
        for i in 0..moved_ids.len() {
            let bid = moved_ids.get(i).ok_or(Error::NotFound)?;
            let mut b = moved_books.get(i).ok_or(Error::NotFound)?;
            b.owner = taker_w.clone();
            save_book(&env, bid, &b);
            vec_remove(&mut w.books, bid);
            if let Some(t) = &mut t_acct {
                t.books.push_back(bid);
            }
        }
        save_acct(&env, &writer, &w);
        save_vault(&env, &vault);
        if let (Some(t), Some(ta)) = (&taker, &t_acct) {
            save_acct(&env, t, ta);
            let rt = requirement(&env, &c, &risk_of_acct(ta))?;
            if rt.nlv < rt.im {
                return Err(Error::InsufficientMargin);
            }
        }
        bump_instance(&env);
        TakenOver { writer, taker: taker_w, x, paid: pay, deficit }.publish(&env);
        Ok(TakeoverResult { x, paid: pay, deficit })
    }

    // ----------------------------------------------------------------- settlement

    /// Model `settle` (permissionless).
    pub fn settle(env: Env, book_id: u32) -> Result<SettleResult, Error> {
        let c = cfg(&env);
        let t = now(&env);
        let mut b = load_book(&env, book_id)?;
        let sid = b.series_id;
        let mut ser = load_series(&env, sid)?;
        let sp = ser.settlement_price.ok_or(Error::NoSettlementPrice)?;
        if b.settled {
            return Err(Error::WrongState);
        }
        let due = mul(b.qty, max0(sub(sp, ser.strike)?))?;
        let mut vault = load_vault(&env);
        let mut priv_acct: Option<(Address, Account)> = None;
        let from_owner;
        match b.owner.clone() {
            Writer::Vault => {
                // the taken-over book first pays its reserve; the excess returns to the vault, the rest of
                // the debt becomes a pooled shortfall for settle_vault
                from_owner = min(due, b.reserve);
                vault.reserved = sub(vault.reserved, b.reserve)?;
                vault.cash = add(vault.cash, sub(b.reserve, from_owner)?)?;
                b.reserve = 0;
                dec_short(&mut vault.shorts, sid, b.qty)?;
            }
            Writer::Account(owner) => {
                let mut a = load_acct(&env, &owner);
                // wait until every expired series of the owner has a price (or a closed window)
                for (xsid, q) in a.shorts.iter() {
                    if q != 0 {
                        let s = load_series(&env, xsid)?;
                        if t >= s.expiry
                            && s.settlement_price.is_none()
                            && (t as i128) <= (s.expiry as i128) + (c.settle_window as i128)
                        {
                            return Err(Error::NoSettlementPrice);
                        }
                    }
                }
                let mut total = 0i128;
                for xbid in a.books.iter() {
                    let xb = load_book(&env, xbid)?;
                    let xs = load_series(&env, xb.series_id)?;
                    if t >= xs.expiry {
                        if let Some(px) = xs.settlement_price {
                            total = add(total, mul(xb.qty, max0(sub(px, xs.strike)?))?)?;
                        }
                    }
                }
                from_owner = if a.cash >= total {
                    due
                } else if total != 0 {
                    mul(due, a.cash)? / total
                } else {
                    0
                };
                a.cash = sub(a.cash, from_owner)?;
                dec_short(&mut a.shorts, sid, b.qty)?;
                vec_remove(&mut a.books, book_id);
                priv_acct = Some((owner, a));
            }
        }
        let shortfall = sub(due, from_owner)?;
        ser.oi = sub(ser.oi, b.qty)?;
        ser.open_books = ser.open_books.checked_sub(1).ok_or(Error::Overflow)?;
        ser.shortfall = add(ser.shortfall, shortfall)?;
        ser.pool = add(ser.pool, from_owner)?;
        b.settled = true;
        b.due = due;
        b.from_owner = from_owner;
        b.shortfall = shortfall;
        save_series(&env, sid, &ser);
        save_book(&env, book_id, &b);
        BookSettled { book_id, owner: b.owner.clone(), due, from_owner, shortfall }.publish(&env);
        if let Some((owner, mut a)) = priv_acct {
            if a.owed != 0 && !has_expired_short(&env, &a.shorts)? {
                // last expired book settled: the takeover debt is collected
                repay(&env, &owner, &mut a, &mut vault, None)?;
            }
            save_acct(&env, &owner, &a);
        }
        save_vault(&env, &vault);
        bump_instance(&env);
        Ok(SettleResult { due, from_owner, shortfall })
    }

    /// Model `settle_vault` (permissionless).
    pub fn settle_vault(env: Env, series_id: u32) -> Result<VaultSettleResult, Error> {
        let mut ser = load_series(&env, series_id)?;
        if ser.settlement_price.is_none() {
            return Err(Error::NoSettlementPrice);
        }
        if ser.closed || ser.open_books != 0 {
            return Err(Error::WrongState);
        }
        let mut vault = load_vault(&env);
        let paid = min(ser.shortfall, vault.cash);
        vault.cash = sub(vault.cash, paid)?;
        ser.vault_paid = paid;
        ser.pool = add(ser.pool, paid)?;
        ser.closed = true;
        let mut live = live_series(&env);
        vec_remove(&mut live, series_id);
        env.storage().instance().set(&DataKey::LiveSeries, &live);
        save_series(&env, series_id, &ser);
        save_vault(&env, &vault);
        bump_instance(&env);
        let deficit = sub(ser.shortfall, paid)?;
        VaultSettled { series_id, shortfall: ser.shortfall, vault_paid: paid, deficit }.publish(&env);
        Ok(VaultSettleResult { shortfall: ser.shortfall, vault_paid: paid, deficit })
    }

    /// Model `claim` (holder only; pays the caller only).
    pub fn claim(env: Env, holder: Address, pos_id: u32) -> Result<ClaimResult, Error> {
        holder.require_auth();
        let mut p = load_pos(&env, pos_id)?;
        if p.holder != holder {
            return Err(Error::Unauthorized);
        }
        if p.settled {
            return Err(Error::WrongState);
        }
        let mut ser = load_series(&env, p.series_id)?;
        if !ser.closed {
            return Err(if ser.settlement_price.is_none() { Error::NoSettlementPrice } else { Error::WrongState });
        }
        let sp = ser.settlement_price.ok_or(Error::NoSettlementPrice)?;
        let b = load_book(&env, p.book)?;
        let per_lot = max0(sub(sp, ser.strike)?);
        let due = mul(p.qty, per_lot)?;
        // book share = owner + pro rata vault share; position share = pro rata of its debt in the book
        let vault_share = if ser.shortfall != 0 { mul(b.shortfall, ser.vault_paid)? / ser.shortfall } else { 0 };
        let book_paid = add(b.from_owner, vault_share)?;
        let paid = if b.due != 0 { mul(due, book_paid)? / b.due } else { 0 };
        let deficit = sub(due, paid)?;
        p.settled = true;
        p.paid = paid;
        p.deficit = deficit;
        ser.claimed = add(ser.claimed, paid)?;
        save_pos(&env, pos_id, &p);
        save_series(&env, p.series_id, &ser);
        pbump(&env, &DataKey::Book(p.book));
        if paid != 0 {
            push(&env, &holder, paid);
        }
        bump_instance(&env);
        Claimed { pos_id, holder, due, paid, deficit }.publish(&env);
        Ok(ClaimResult { due, paid, deficit })
    }

    // ----------------------------------------------------------------- vault LP

    /// Model `lp_deposit`. Returns the shares minted. No LP withdrawal in v0.
    pub fn lp_deposit(env: Env, lp: Address, amount: i128) -> Result<i128, Error> {
        lp.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidArgs);
        }
        not_role(&env, &lp)?;
        if settlement_pending(&env)? {
            return Err(Error::SettlementPending);
        }
        let c = cfg(&env);
        let mut vault = load_vault(&env);
        let value = vault_value_of(&env, &c, &vault)?;
        let total = total_shares_of(&env);
        if value < 0 || (value <= 0 && (total != 0 || any_short(&vault.shorts))) {
            return Err(Error::VaultCapacity);
        }
        let shares = if total == 0 {
            if amount < MIN_FIRST_LP {
                return Err(Error::InvalidArgs);
            }
            amount
        } else {
            mul(amount, total)? / value
        };
        if shares <= 0 {
            return Err(Error::InvalidArgs);
        }
        pull(&env, &lp, amount)?;
        vault.cash = add(vault.cash, amount)?;
        let key = DataKey::Lp(lp.clone());
        let prev: i128 = pget(&env, &key).unwrap_or(0);
        pset(&env, &key, &add(prev, shares)?);
        env.storage().instance().set(&DataKey::TotalShares, &add(total, shares)?);
        save_vault(&env, &vault);
        bump_instance(&env);
        LpDeposited { lp, amount, shares }.publish(&env);
        Ok(shares)
    }

    // ----------------------------------------------------------------- maintenance

    /// Permissionless TTL extension of the instance and the listed entries (not in the model).
    pub fn extend_ttl(env: Env, series_ids: Vec<u32>, book_ids: Vec<u32>, pos_ids: Vec<u32>) {
        bump_instance(&env);
        env.deployer().extend_ttl(env.current_contract_address(), TTL_THRESHOLD, TTL_EXTEND_TO);
        pbump(&env, &DataKey::Vault);
        for sid in series_ids.iter() {
            pbump(&env, &DataKey::Series(sid));
            pbump(&env, &DataKey::Snap(sid));
        }
        for bid in book_ids.iter() {
            pbump(&env, &DataKey::Book(bid));
        }
        for pid in pos_ids.iter() {
            pbump(&env, &DataKey::Pos(pid));
        }
    }

    // ----------------------------------------------------------------- views

    /// Model `requirement(who)`; `Writer::Vault` for the vault. Fails with `StaleSnapshot` like the model.
    pub fn get_requirement(env: Env, who: Writer) -> Result<Requirement, Error> {
        let c = cfg(&env);
        match who {
            Writer::Vault => requirement(&env, &c, &risk_of_vault(&load_vault(&env))),
            Writer::Account(a) => requirement(&env, &c, &risk_of_acct(&load_acct(&env, &a))),
        }
    }

    /// Model `vault_value()`: vault cash when it has no shorts, else its NLV.
    pub fn vault_value(env: Env) -> Result<i128, Error> {
        vault_value_of(&env, &cfg(&env), &load_vault(&env))
    }

    /// Account view; an account that never interacted reads as all-zero (empty maps and vectors).
    pub fn get_account(env: Env, who: Address) -> Account {
        load_acct(&env, &who)
    }

    pub fn get_vault(env: Env) -> VaultAccount {
        load_vault(&env)
    }

    pub fn get_series(env: Env, series_id: u32) -> Result<Series, Error> {
        load_series(&env, series_id)
    }

    pub fn get_snapshot(env: Env, series_id: u32) -> Result<Snapshot, Error> {
        load_snap(&env, series_id).ok_or(Error::NotFound)
    }

    pub fn get_book(env: Env, book_id: u32) -> Result<Book, Error> {
        load_book(&env, book_id)
    }

    pub fn get_offer(env: Env, offer_id: u32) -> Result<Offer, Error> {
        load_offer(&env, offer_id)
    }

    pub fn get_position(env: Env, pos_id: u32) -> Result<Position, Error> {
        load_pos(&env, pos_id)
    }

    /// LP shares of `lp` (0 if none).
    pub fn lp_shares(env: Env, lp: Address) -> i128 {
        pget(&env, &DataKey::Lp(lp)).unwrap_or(0)
    }

    pub fn total_shares(env: Env) -> i128 {
        total_shares_of(&env)
    }

    /// Number of series listed so far (ids are `0..series_count`).
    pub fn series_count(env: Env) -> u32 {
        iget_u32(&env, DataKey::NextSeries)
    }

    pub fn config(env: Env) -> MarketConfig {
        cfg(&env)
    }

    pub fn admin(env: Env) -> Address {
        admin_addr(&env)
    }

    pub fn publisher(env: Env) -> Address {
        publisher_addr(&env)
    }

    pub fn quote(env: Env) -> Address {
        quote_addr(&env)
    }
}
