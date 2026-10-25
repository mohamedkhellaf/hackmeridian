#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, Env};

const SCALE: i128 = 10_000_000; // 7 decimals: strike is USDx-stroops per 1 FUND
const TTL_MIN: u32 = 100_000;
const TTL_MAX: u32 = 500_000;

#[contracttype]
#[derive(Clone)]
pub struct Opt {
    pub writer: Address,
    pub is_call: bool,
    pub strike: i128,
    pub qty: i128,
    pub collateral: i128,
    pub expiry: u64,
    pub done: bool,
}

#[contracttype]
enum Key {
    Fund,
    Usd,
    Next,
    Opt(u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    Expired = 2,
    NotExpired = 3,
    Settled = 4,
    NotWriter = 5,
    BadArgs = 6,
}

#[contract]
pub struct Options;

fn fund(e: &Env) -> token::Client<'_> {
    token::Client::new(e, &e.storage().instance().get::<Key, Address>(&Key::Fund).unwrap())
}
fn usd(e: &Env) -> token::Client<'_> {
    token::Client::new(e, &e.storage().instance().get::<Key, Address>(&Key::Usd).unwrap())
}
fn load(e: &Env, id: u32) -> Opt {
    let k = Key::Opt(id);
    let o: Opt = e.storage().persistent().get(&k).unwrap_or_else(|| panic_with_error!(e, Error::NotFound));
    e.storage().persistent().extend_ttl(&k, TTL_MIN, TTL_MAX);
    o
}
fn save(e: &Env, id: u32, o: &Opt) {
    let k = Key::Opt(id);
    e.storage().persistent().set(&k, o);
    e.storage().persistent().extend_ttl(&k, TTL_MIN, TTL_MAX);
}

#[contractimpl]
impl Options {
    pub fn __constructor(e: Env, fund: Address, usd: Address) {
        e.storage().instance().set(&Key::Fund, &fund);
        e.storage().instance().set(&Key::Usd, &usd);
        e.storage().instance().set(&Key::Next, &0u32);
    }

    fn write(e: &Env, writer: Address, is_call: bool, strike: i128, qty: i128, expiry: u64) -> u32 {
        writer.require_auth();
        if strike <= 0 || qty <= 0 || expiry <= e.ledger().timestamp() {
            panic_with_error!(e, Error::BadArgs);
        }
        let collateral = strike.checked_mul(qty).unwrap() / SCALE;
        let me = e.current_contract_address();
        if is_call {
            fund(e).transfer(&writer, &me, &qty);
        } else {
            usd(e).transfer(&writer, &me, &collateral);
        }
        let id: u32 = e.storage().instance().get(&Key::Next).unwrap();
        e.storage().instance().set(&Key::Next, &(id + 1));
        e.storage().instance().extend_ttl(TTL_MIN, TTL_MAX);
        save(e, id, &Opt { writer, is_call, strike, qty, collateral, expiry, done: false });
        id
    }

    pub fn write_put(e: Env, writer: Address, strike: i128, qty: i128, expiry: u64) -> u32 {
        Self::write(&e, writer, false, strike, qty, expiry)
    }

    pub fn write_call(e: Env, writer: Address, strike: i128, qty: i128, expiry: u64) -> u32 {
        Self::write(&e, writer, true, strike, qty, expiry)
    }

    pub fn exercise(e: Env, holder: Address, id: u32) {
        holder.require_auth();
        let mut o = load(&e, id);
        if o.done {
            panic_with_error!(&e, Error::Settled);
        }
        if e.ledger().timestamp() >= o.expiry {
            panic_with_error!(&e, Error::Expired);
        }
        let me = e.current_contract_address();
        if o.is_call {
            usd(&e).transfer(&holder, &o.writer, &o.collateral);
            fund(&e).transfer(&me, &holder, &o.qty);
        } else {
            fund(&e).transfer(&holder, &o.writer, &o.qty);
            usd(&e).transfer(&me, &holder, &o.collateral);
        }
        o.done = true;
        save(&e, id, &o);
    }

    pub fn reclaim(e: Env, writer: Address, id: u32) {
        writer.require_auth();
        let mut o = load(&e, id);
        if o.writer != writer {
            panic_with_error!(&e, Error::NotWriter);
        }
        if o.done {
            panic_with_error!(&e, Error::Settled);
        }
        if e.ledger().timestamp() < o.expiry {
            panic_with_error!(&e, Error::NotExpired);
        }
        let me = e.current_contract_address();
        if o.is_call {
            fund(&e).transfer(&me, &writer, &o.qty);
        } else {
            usd(&e).transfer(&me, &writer, &o.collateral);
        }
        o.done = true;
        save(&e, id, &o);
    }

    pub fn get(e: Env, id: u32) -> Opt {
        load(&e, id)
    }

    /// (h) can a contract read SAC authorization? Calls StellarAssetClient::authorized on FUND.
    pub fn fund_authorized(e: Env, id: Address) -> bool {
        let a: Address = e.storage().instance().get(&Key::Fund).unwrap();
        token::StellarAssetClient::new(&e, &a).authorized(&id)
    }
}
