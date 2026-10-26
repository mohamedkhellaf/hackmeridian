#![cfg(test)]
//! Test suite for the `options` contract, written against the locked ABI in
//! `docs/contract-abi.md` (sections 2–8, v1.3.1 per §13).
//!
//! Conventions:
//! - Every amount is a 7-decimal integer: 1 token = 10_000_000 units.
//! - Typed contract errors come back from `try_*` as `Err(Ok(Error::X))`.
//! - A SAC failure inside an options call (insufficient balance #10, deauthorized
//!   #11, overflow #12) propagates out of the options contract unchanged as
//!   `Error(Contract, #n)`. The options `Error` codes start at 101 (v1.1), so a
//!   SAC code never decodes as an options `Error`: the client returns
//!   `Err(Err(InvokeError::Contract(n)))`, which is all `assert_sac_err` accepts.
//! - `env.auths()` and `env.events().all()` only describe the most recent
//!   invocation, so they are read immediately after the call under test.
extern crate std;

use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{
        storage::{Instance as _, Persistent as _},
        Address as _, AuthorizedFunction, AuthorizedInvocation, Deployer as _, Events as _,
        IssuerFlags, Ledger as _, MockAuth, MockAuthInvoke, StellarAssetIssuer,
    },
    token::{StellarAssetClient, TokenClient},
    vec, Address, Bytes, Env, Event as _, IntoVal, InvokeError, String, Symbol, TryFromVal, Val,
    Vec,
};
use std::fmt::Debug;
use std::string::ToString;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UNIT: i128 = 10_000_000; // 1 token, 7 decimals
const QTY: i128 = 50_000_000; // 5 RWA
const STRIKE: i128 = 500_000_000; // 50 USDx total strike
const PREMIUM: i128 = 10_000_000; // 1 USDx total premium

const USDX_START: i128 = 1_000 * UNIT;
const UNDERLYING_START: i128 = 100 * UNIT;

const START: u64 = 1_793_000_000; // ledger time at setup
const EXPIRY: u64 = START + 7 * 86_400;

const DAY: u32 = 17_280; // ledgers per day (ABI §8 DAY_LEDGERS)

// v1.3 limits (ABI §8), restated so the tests pin the values, not the names.
const WRITER_CAP: u32 = 50; // MAX_OPEN_PER_WRITER
const TENOR_CAP: u64 = 63_072_000; // MAX_TENOR, 2 years in seconds

// v1.3.1 limits (ABI §3, §8, §13).
const ASSET_CAP: u32 = 500; // MAX_OPEN_PER_ASSET, one underlying's open book
const LIST_OPEN_CAP: u32 = 200; // list_open() truncation

// SAC (soroban-env-host ContractError) codes observed in the spike.
const SAC_BALANCE: u32 = 10; // insufficient / zero balance
const SAC_DEAUTHORIZED: u32 = 11; // balance deauthorized (issuer freeze, not authorized)
const SAC_OVERFLOW: u32 = 12; // i128 balance overflow
const SAC_NO_TRUSTLINE: u32 = 13; // classic account has no trustline for the asset

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

#[allow(dead_code)]
struct T {
    env: Env,
    contract: Address,
    c: OptionsContractClient<'static>,
    usdx: Address,
    rwa: Address,
    bond: Address,
    /// SAC admin of USDx (separate issuer, no flags).
    usdx_issuer: Address,
    /// SAC admin of RWA and BOND (regulated issuer).
    rwa_issuer: Address,
    /// Classic issuer account behind the USDx SAC (to change its flags in a test).
    usdx_flags: StellarAssetIssuer,
    writer: Address,
    holder: Address,
    maker2: Address,
    /// Has USDx but is NOT authorized on RWA/BOND.
    outsider: Address,
    /// v1.3.1 `prune_expired` caller: no balances, no role on any option.
    pruner: Address,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct Bal {
    usdx: i128,
    rwa: i128,
    bond: i128,
}

/// Everything a failed call must leave untouched.
#[derive(Clone, Debug, Eq, PartialEq)]
struct Snap {
    writer: Bal,
    holder: Bal,
    maker2: Bal,
    outsider: Bal,
    contract: Bal,
    open_usdx: i128,
    open_rwa: i128,
    open_bond: i128,
    count: u32,
    open: std::vec::Vec<u32>,
    options: std::vec::Vec<OptionData>,
}

fn setup() -> T {
    setup_with(true)
}

/// `authorize_contract = false` leaves the options contract without an
/// authorized balance on RWA/BOND (the state before the issuer runs
/// `set_authorized(contract, true)`).
fn setup_with(authorize_contract: bool) -> T {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(START);

    let usdx_issuer = Address::generate(&env);
    let rwa_issuer = Address::generate(&env);

    let usdx_sac = env.register_stellar_asset_contract_v2(usdx_issuer.clone());
    let rwa_sac = env.register_stellar_asset_contract_v2(rwa_issuer.clone());
    let bond_sac = env.register_stellar_asset_contract_v2(rwa_issuer.clone());
    // Regulated underlyings: AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED.
    // Flags must be set before any balance entry exists so that new balances are
    // created unauthorized and clawback-enabled.
    for sac in [&rwa_sac, &bond_sac] {
        let issuer = sac.issuer();
        issuer.set_flag(IssuerFlags::RequiredFlag);
        issuer.set_flag(IssuerFlags::RevocableFlag);
        issuer.set_flag(IssuerFlags::ClawbackEnabledFlag);
    }
    let usdx = usdx_sac.address();
    let usdx_flags = usdx_sac.issuer();
    let rwa = rwa_sac.address();
    let bond = bond_sac.address();

    let contract = env.register(
        OptionsContract,
        (usdx.clone(), vec![&env, rwa.clone(), bond.clone()]),
    );
    let c = OptionsContractClient::new(&env, &contract);

    let writer = Address::generate(&env);
    let holder = Address::generate(&env);
    let maker2 = Address::generate(&env);
    let outsider = Address::generate(&env);
    let pruner = Address::generate(&env);

    let usdx_admin = StellarAssetClient::new(&env, &usdx);
    for who in [&writer, &holder, &maker2, &outsider] {
        usdx_admin.mint(who, &USDX_START);
    }
    for token in [&rwa, &bond] {
        let admin = StellarAssetClient::new(&env, token);
        for who in [&writer, &holder, &maker2] {
            admin.set_authorized(who, &true);
            admin.mint(who, &UNDERLYING_START);
        }
        if authorize_contract {
            admin.set_authorized(&contract, &true);
        }
    }

    T {
        env,
        contract,
        c,
        usdx,
        rwa,
        bond,
        usdx_issuer,
        rwa_issuer,
        usdx_flags,
        writer,
        holder,
        maker2,
        outsider,
        pruner,
    }
}

impl T {
    fn sac(&self, token: &Address) -> StellarAssetClient<'static> {
        StellarAssetClient::new(&self.env, token)
    }

    fn bal(&self, token: &Address, who: &Address) -> i128 {
        TokenClient::new(&self.env, token).balance(who)
    }

    fn bals(&self, who: &Address) -> Bal {
        Bal {
            usdx: self.bal(&self.usdx, who),
            rwa: self.bal(&self.rwa, who),
            bond: self.bal(&self.bond, who),
        }
    }

    fn offer(&self, writer: &Address, underlying: &Address, ty: OptionType) -> u32 {
        self.c
            .create_offer(writer, underlying, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY)
    }

    fn put(&self, writer: &Address) -> u32 {
        self.offer(writer, &self.rwa, OptionType::Put)
    }

    fn call(&self, writer: &Address) -> u32 {
        self.offer(writer, &self.rwa, OptionType::Call)
    }

    fn open(&self) -> std::vec::Vec<u32> {
        self.c.list_open().iter().collect()
    }

    fn state(&self, id: u32) -> State {
        self.c.get_option(&id).state
    }

    fn holder_of(&self, id: u32) -> Option<Address> {
        self.c.get_option(&id).holder
    }

    fn at(&self, ts: u64) {
        self.env.ledger().set_timestamp(ts);
    }

    fn snap(&self) -> Snap {
        let count = self.c.option_count();
        Snap {
            writer: self.bals(&self.writer),
            holder: self.bals(&self.holder),
            maker2: self.bals(&self.maker2),
            outsider: self.bals(&self.outsider),
            contract: self.bals(&self.contract),
            open_usdx: self.c.open_collateral(&self.usdx),
            open_rwa: self.c.open_collateral(&self.rwa),
            open_bond: self.c.open_collateral(&self.bond),
            count,
            open: self.open(),
            options: (0..count).map(|id| self.c.get_option(&id)).collect(),
        }
    }

    /// Raw persistent TTL of option `id`, read through the ABI §8 key shape
    /// `Key::Opt(id)` = ScVal vec [Symbol("Opt"), U32(id)] (no compile-time
    /// dependency on the private `Key` enum).
    fn option_ttl(&self, id: u32) -> u32 {
        let key: Vec<Val> = vec![
            &self.env,
            Symbol::new(&self.env, "Opt").into_val(&self.env),
            id.into_val(&self.env),
        ];
        self.env.as_contract(&self.contract, || {
            self.env.storage().persistent().get_ttl(&key)
        })
    }

    fn instance_ttl(&self) -> u32 {
        self.env
            .as_contract(&self.contract, || self.env.storage().instance().get_ttl())
    }
}

#[track_caller]
fn assert_err<T: Debug>(res: Result<T, Result<Error, InvokeError>>, expected: Error) {
    match res {
        Err(Ok(e)) => assert_eq!(e, expected),
        other => panic!("expected Err(Ok({expected:?})), got {other:?}"),
    }
}

/// The call failed inside a SAC sub-invocation with SAC error `code`. Since v1.1
/// the options codes (101+) cannot collide with SAC codes, so the error must not
/// decode as an options `Error`.
#[track_caller]
fn assert_sac_err<T: Debug>(res: Result<T, Result<Error, InvokeError>>, code: u32) {
    match res {
        Err(Err(InvokeError::Contract(c))) => assert_eq!(c, code, "SAC error code"),
        other => panic!("expected SAC error #{code}, got {other:?}"),
    }
}

/// Non-contract host failure (for example a missing authorization).
#[track_caller]
fn assert_host_abort<T: Debug>(res: Result<T, Result<Error, InvokeError>>) {
    match res {
        Err(Err(_)) => {}
        other => panic!("expected a host error Err(Err(_)), got {other:?}"),
    }
}

fn expected_option(
    t: &T,
    id: u32,
    underlying: &Address,
    ty: OptionType,
    writer: &Address,
) -> OptionData {
    OptionData {
        id,
        underlying: underlying.clone(),
        quote: t.usdx.clone(),
        option_type: ty,
        qty: QTY,
        strike_total: STRIKE,
        premium_total: PREMIUM,
        expiry: EXPIRY,
        writer: writer.clone(),
        holder: None,
        state: State::Offered,
    }
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

#[test]
fn put_create_buy_exercise_claim() {
    let t = setup();
    assert_eq!(t.c.option_count(), 0);
    assert_eq!(t.open(), std::vec![] as std::vec::Vec<u32>);

    // create: writer locks the total strike in USDx
    let id = t.put(&t.writer);
    assert_eq!(id, 0);
    assert_eq!(
        t.c.get_option(&id),
        expected_option(&t, 0, &t.rwa, OptionType::Put, &t.writer)
    );
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START - STRIKE);
    assert_eq!(t.bal(&t.usdx, &t.contract), STRIKE);
    assert_eq!(t.bal(&t.rwa, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.usdx), STRIKE);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    assert_eq!(t.open(), [0]);
    assert_eq!(t.c.option_count(), 1);

    // buy: premium goes buyer -> writer (PROVISIONAL policy); collateral untouched
    t.c.buy(&t.holder, &id);
    assert_eq!(t.state(id), State::Active);
    assert_eq!(t.holder_of(id), Some(t.holder.clone()));
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START - STRIKE + PREMIUM);
    assert_eq!(t.bal(&t.usdx, &t.contract), STRIKE);
    assert_eq!(t.c.open_collateral(&t.usdx), STRIKE);
    assert_eq!(t.open(), std::vec![] as std::vec::Vec<u32>);

    // exercise one second before expiry (now < expiry is allowed)
    t.at(EXPIRY - 1);
    t.c.exercise(&t.holder, &id);
    assert_eq!(t.state(id), State::Exercised);
    assert_eq!(t.holder_of(id), Some(t.holder.clone()));
    assert_eq!(t.bal(&t.rwa, &t.holder), UNDERLYING_START - QTY);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM + STRIKE);
    assert_eq!(t.bal(&t.usdx, &t.contract), 0);
    assert_eq!(t.bal(&t.rwa, &t.contract), QTY);
    // the delivered RWA waits in the contract, not in the writer's account
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);

    // claim: writer pulls the delivered underlying
    t.c.claim_delivery(&t.writer, &id);
    assert_eq!(t.state(id), State::Settled);
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START + QTY);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START - STRIKE + PREMIUM);
    assert_eq!(t.bal(&t.rwa, &t.contract), 0);
    assert_eq!(t.bal(&t.usdx, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    assert_eq!(t.open(), std::vec![] as std::vec::Vec<u32>);
}

#[test]
fn call_create_buy_exercise_claim() {
    let t = setup();

    // create: writer locks the underlying quantity
    let id = t.call(&t.writer);
    assert_eq!(id, 0);
    assert_eq!(
        t.c.get_option(&id),
        expected_option(&t, 0, &t.rwa, OptionType::Call, &t.writer)
    );
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START - QTY);
    assert_eq!(t.bal(&t.rwa, &t.contract), QTY);
    assert_eq!(t.bal(&t.usdx, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    assert_eq!(t.open(), [0]);

    t.c.buy(&t.holder, &id);
    assert_eq!(t.state(id), State::Active);
    assert_eq!(t.holder_of(id), Some(t.holder.clone()));
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START + PREMIUM);
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);
    assert_eq!(t.open(), std::vec![] as std::vec::Vec<u32>);

    // exercise: holder pays the strike into the contract, receives the underlying
    t.c.exercise(&t.holder, &id);
    assert_eq!(t.state(id), State::Exercised);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM - STRIKE);
    assert_eq!(t.bal(&t.rwa, &t.holder), UNDERLYING_START + QTY);
    assert_eq!(t.bal(&t.rwa, &t.contract), 0);
    assert_eq!(t.bal(&t.usdx, &t.contract), STRIKE);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START + PREMIUM);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    assert_eq!(t.c.open_collateral(&t.usdx), STRIKE);

    // claim: writer pulls the strike
    t.c.claim_delivery(&t.writer, &id);
    assert_eq!(t.state(id), State::Settled);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START + PREMIUM + STRIKE);
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START - QTY);
    assert_eq!(t.bal(&t.usdx, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
}

#[test]
fn put_cancel_offer_returns_collateral() {
    let t = setup();
    let id = t.put(&t.writer);
    assert_eq!(t.c.open_collateral(&t.usdx), STRIKE);

    t.c.cancel_offer(&t.writer, &id);
    assert_eq!(t.state(id), State::Cancelled);
    assert_eq!(t.holder_of(id), None);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START);
    assert_eq!(t.bal(&t.usdx, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    assert_eq!(t.open(), std::vec![] as std::vec::Vec<u32>);
    assert_eq!(t.c.option_count(), 1);

    // Cancelled is terminal
    assert_err(t.c.try_buy(&t.holder, &id), Error::WrongState);
    assert_err(t.c.try_cancel_offer(&t.writer, &id), Error::WrongState);
    t.at(EXPIRY);
    assert_err(t.c.try_reclaim(&t.writer, &id), Error::WrongState);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START);
}

#[test]
fn call_cancel_offer_returns_collateral() {
    let t = setup();
    let id = t.call(&t.writer);
    assert_eq!(t.bal(&t.rwa, &t.contract), QTY);
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);

    t.c.cancel_offer(&t.writer, &id);
    assert_eq!(t.state(id), State::Cancelled);
    assert_eq!(t.holder_of(id), None);
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START);
    assert_eq!(t.bal(&t.rwa, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    assert_eq!(t.open(), std::vec![] as std::vec::Vec<u32>);
}

#[test]
fn put_reclaim_after_expiry_active() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);

    // "expired" means now >= expiry: reclaim works at exactly expiry
    t.at(EXPIRY);
    t.c.reclaim(&t.writer, &id);
    assert_eq!(t.state(id), State::Expired);
    assert_eq!(t.holder_of(id), Some(t.holder.clone()));
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START + PREMIUM);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM);
    assert_eq!(t.bal(&t.rwa, &t.holder), UNDERLYING_START);
    assert_eq!(t.bal(&t.usdx, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    assert_eq!(t.open(), std::vec![] as std::vec::Vec<u32>);

    // nothing left to exercise or reclaim
    assert_err(t.c.try_exercise(&t.holder, &id), Error::WrongState);
    assert_err(t.c.try_reclaim(&t.writer, &id), Error::WrongState);
}

#[test]
fn call_reclaim_after_expiry_active() {
    let t = setup();
    let id = t.call(&t.writer);
    t.c.buy(&t.holder, &id);

    t.at(EXPIRY + 3_600);
    t.c.reclaim(&t.writer, &id);
    assert_eq!(t.state(id), State::Expired);
    assert_eq!(t.holder_of(id), Some(t.holder.clone()));
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START + PREMIUM);
    assert_eq!(t.bal(&t.rwa, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    assert_eq!(t.open(), std::vec![] as std::vec::Vec<u32>);
}

#[test]
fn reclaim_unsold_offer_after_expiry() {
    let t = setup();
    let id = t.put(&t.writer);

    t.at(EXPIRY);
    // list_open may still include expired offers (clients filter by expiry)
    assert_eq!(t.open(), [id]);
    t.c.reclaim(&t.writer, &id);
    assert_eq!(t.state(id), State::Expired);
    assert_eq!(t.holder_of(id), None);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START);
    assert_eq!(t.bal(&t.usdx, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    assert_eq!(t.open(), std::vec![] as std::vec::Vec<u32>);

    assert_err(t.c.try_buy(&t.holder, &id), Error::WrongState);
    assert_err(t.c.try_cancel_offer(&t.writer, &id), Error::WrongState);
}

#[test]
fn cancel_unsold_offer_after_expiry_also_works() {
    let t = setup();
    let id = t.call(&t.writer);

    t.at(EXPIRY + 86_400);
    t.c.cancel_offer(&t.writer, &id);
    assert_eq!(t.state(id), State::Cancelled);
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START);
    assert_eq!(t.bal(&t.rwa, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    assert_eq!(t.open(), std::vec![] as std::vec::Vec<u32>);
    assert_err(t.c.try_reclaim(&t.writer, &id), Error::WrongState);
}

#[test]
fn bond_put_on_same_contract() {
    let t = setup();
    let rwa_id = t.put(&t.writer);
    let bond_id = t.offer(&t.writer, &t.bond, OptionType::Put);
    assert_eq!((rwa_id, bond_id), (0, 1));
    assert_eq!(
        t.c.get_option(&bond_id),
        expected_option(&t, 1, &t.bond, OptionType::Put, &t.writer)
    );
    assert_eq!(t.bal(&t.usdx, &t.contract), 2 * STRIKE);
    assert_eq!(t.c.open_collateral(&t.usdx), 2 * STRIKE);
    assert_eq!(t.open(), [0, 1]);

    t.c.buy(&t.holder, &bond_id);
    t.c.exercise(&t.holder, &bond_id);
    assert_eq!(t.state(bond_id), State::Exercised);
    assert_eq!(t.state(rwa_id), State::Offered);
    assert_eq!(t.bal(&t.bond, &t.holder), UNDERLYING_START - QTY);
    assert_eq!(t.bal(&t.rwa, &t.holder), UNDERLYING_START);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM + STRIKE);
    assert_eq!(t.bal(&t.bond, &t.contract), QTY);
    assert_eq!(t.bal(&t.usdx, &t.contract), STRIKE);
    assert_eq!(t.c.open_collateral(&t.bond), QTY);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    assert_eq!(t.c.open_collateral(&t.usdx), STRIKE);
    assert_eq!(t.open(), [0]);

    t.c.claim_delivery(&t.writer, &bond_id);
    assert_eq!(t.state(bond_id), State::Settled);
    assert_eq!(t.bal(&t.bond, &t.writer), UNDERLYING_START + QTY);
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START);
    assert_eq!(t.c.open_collateral(&t.bond), 0);

    // a BOND call on the same contract locks BOND, not RWA
    let bond_call = t.offer(&t.maker2, &t.bond, OptionType::Call);
    assert_eq!(bond_call, 2);
    assert_eq!(t.c.open_collateral(&t.bond), QTY);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    assert_eq!(t.bal(&t.bond, &t.maker2), UNDERLYING_START - QTY);
}

#[test]
fn two_makers_competing_offers_and_list_open_order() {
    let t = setup();
    let cheap_premium = 8_000_000; // 0.8 USDx

    let a = t.put(&t.writer);
    let b = t.c.create_offer(
        &t.maker2,
        &t.rwa,
        &OptionType::Put,
        &QTY,
        &STRIKE,
        &cheap_premium,
        &EXPIRY,
    );
    assert_eq!((a, b), (0, 1));
    assert_eq!(t.open(), [0, 1]);
    assert_eq!(t.c.open_collateral(&t.usdx), 2 * STRIKE);
    assert_eq!(t.bal(&t.usdx, &t.contract), 2 * STRIKE);

    // same terms, different makers and premiums
    let oa = t.c.get_option(&a);
    let ob = t.c.get_option(&b);
    assert_eq!(oa.writer, t.writer);
    assert_eq!(ob.writer, t.maker2);
    assert_eq!(
        (oa.underlying.clone(), oa.qty, oa.strike_total, oa.expiry),
        (ob.underlying.clone(), ob.qty, ob.strike_total, ob.expiry)
    );
    assert!(ob.premium_total < oa.premium_total);

    // holder takes the cheaper offer
    t.c.buy(&t.holder, &b);
    assert_eq!(t.open(), [0]);
    assert_eq!(
        t.bal(&t.usdx, &t.maker2),
        USDX_START - STRIKE + cheap_premium
    );
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START - STRIKE);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - cheap_premium);
    assert_eq!(t.c.open_collateral(&t.usdx), 2 * STRIKE);

    // new offers append; the open list stays oldest first
    let c = t.put(&t.writer);
    assert_eq!(c, 2);
    assert_eq!(t.open(), [0, 2]);

    // a maker cannot cancel a competitor's offer
    assert_err(t.c.try_cancel_offer(&t.maker2, &a), Error::NotWriter);
    t.c.cancel_offer(&t.writer, &a);
    assert_eq!(t.open(), [2]);
    assert_eq!(t.c.open_collateral(&t.usdx), 2 * STRIKE);
    assert_eq!(t.bal(&t.usdx, &t.contract), 2 * STRIKE);
}

#[test]
fn option_count_and_ids_sequential_from_zero() {
    let t = setup();
    assert_eq!(t.c.option_count(), 0);

    let ids = [
        t.put(&t.writer),
        t.call(&t.maker2),
        t.offer(&t.writer, &t.bond, OptionType::Call),
    ];
    assert_eq!(ids, [0, 1, 2]);
    assert_eq!(t.c.option_count(), 3);
    for id in ids {
        assert_eq!(t.c.get_option(&id).id, id);
    }

    // a failed create does not consume an id
    assert_err(
        t.c.try_create_offer(
            &t.writer,
            &t.rwa,
            &OptionType::Put,
            &0,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::InvalidArgs,
    );
    assert_eq!(t.c.option_count(), 3);
    assert_eq!(t.put(&t.writer), 3);
    assert_eq!(t.c.option_count(), 4);

    // terminal states do not change the counter
    t.c.cancel_offer(&t.writer, &3);
    assert_eq!(t.c.option_count(), 4);
    assert_eq!(t.open(), [0, 1, 2]);
}

#[test]
fn events_emitted_per_transition() {
    let t = setup();

    let id = t.put(&t.writer);
    assert_eq!(
        t.env.events().all().filter_by_contract(&t.contract),
        [OfferCreated {
            id,
            writer: t.writer.clone(),
            underlying: t.rwa.clone(),
            option_type: OptionType::Put,
            qty: QTY,
            strike_total: STRIKE,
            premium_total: PREMIUM,
            expiry: EXPIRY,
        }
        .to_xdr(&t.env, &t.contract)]
    );

    t.c.buy(&t.holder, &id);
    assert_eq!(
        t.env.events().all().filter_by_contract(&t.contract),
        [OptionBought {
            id,
            holder: t.holder.clone(),
            premium_total: PREMIUM,
        }
        .to_xdr(&t.env, &t.contract)]
    );

    t.c.exercise(&t.holder, &id);
    assert_eq!(
        t.env.events().all().filter_by_contract(&t.contract),
        [OptionExercised {
            id,
            holder: t.holder.clone(),
        }
        .to_xdr(&t.env, &t.contract)]
    );

    t.c.claim_delivery(&t.writer, &id);
    assert_eq!(
        t.env.events().all().filter_by_contract(&t.contract),
        [DeliveryClaimed { id }.to_xdr(&t.env, &t.contract)]
    );

    let cancelled = t.call(&t.writer);
    t.c.cancel_offer(&t.writer, &cancelled);
    assert_eq!(
        t.env.events().all().filter_by_contract(&t.contract),
        [OfferCancelled { id: cancelled }.to_xdr(&t.env, &t.contract)]
    );

    let reclaimed = t.put(&t.maker2);
    t.at(EXPIRY);
    t.c.reclaim(&t.maker2, &reclaimed);
    assert_eq!(
        t.env.events().all().filter_by_contract(&t.contract),
        [OptionReclaimed { id: reclaimed }.to_xdr(&t.env, &t.contract)]
    );

    // a failed invocation publishes nothing
    t.at(START);
    let fresh = t.offer(&t.writer, &t.bond, OptionType::Put);
    assert_err(t.c.try_buy(&t.writer, &fresh), Error::SelfTrade);
    assert!(t.env.events().all().events().is_empty());
}

#[test]
fn config_returns_quote_and_allowlist() {
    let t = setup();
    assert_eq!(
        t.c.config(),
        Config {
            quote: t.usdx.clone(),
            underlyings: vec![&t.env, t.rwa.clone(), t.bond.clone()],
        }
    );

    // the maximum allowlist size (8) deploys
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let quote = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let mut many: Vec<Address> = Vec::new(&env);
    for _ in 0..8 {
        many.push_back(
            env.register_stellar_asset_contract_v2(admin.clone())
                .address(),
        );
    }
    let id = env.register(OptionsContract, (quote.clone(), many.clone()));
    let cfg = OptionsContractClient::new(&env, &id).config();
    assert_eq!(cfg.quote, quote);
    assert_eq!(cfg.underlyings, many);
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

/// Registers the contract with the given allowlist; returns the constructor's
/// panic message if deployment failed.
fn deploy_err(build: impl FnOnce(&Env, &Address) -> Vec<Address>) -> Option<std::string::String> {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let quote = env.register_stellar_asset_contract_v2(admin).address();
    let underlyings = build(&env, &quote);
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        env.register(OptionsContract, (quote.clone(), underlyings.clone()));
    }));
    match res {
        Ok(()) => None,
        Err(payload) => Some(
            payload
                .downcast_ref::<std::string::String>()
                .cloned()
                .or_else(|| {
                    payload
                        .downcast_ref::<&str>()
                        .map(|s| std::string::String::from(*s))
                })
                .unwrap_or_default(),
        ),
    }
}

#[test]
fn constructor_rejects_invalid_config() {
    // InvalidConfig = 113. `Env::try_register` does not exist in soroban-sdk 28,
    // so each case deploys in a fresh Env inside catch_unwind.
    let sac = |env: &Env| {
        let a = Address::generate(env);
        env.register_stellar_asset_contract_v2(a).address()
    };
    type Allowlist = std::boxed::Box<dyn Fn(&Env, &Address) -> Vec<Address>>;
    let cases: [(&str, Allowlist); 4] = [
        (
            "empty",
            std::boxed::Box::new(|env: &Env, _q: &Address| Vec::new(env)),
        ),
        (
            "nine entries",
            std::boxed::Box::new(move |env: &Env, _q: &Address| {
                let mut v = Vec::new(env);
                for _ in 0..9 {
                    v.push_back(sac(env));
                }
                v
            }),
        ),
        (
            "duplicate",
            std::boxed::Box::new(move |env: &Env, _q: &Address| {
                let a = sac(env);
                let b = sac(env);
                vec![env, a.clone(), b, a]
            }),
        ),
        (
            "quote in underlyings",
            std::boxed::Box::new(move |env: &Env, q: &Address| vec![env, sac(env), q.clone()]),
        ),
    ];
    for (name, build) in cases {
        let msg = deploy_err(|env, q| build(env, q));
        let msg = msg.unwrap_or_else(|| panic!("constructor accepted invalid config: {name}"));
        assert!(
            msg.contains("Error(Contract, #113)"),
            "{name}: expected InvalidConfig (#113), panic was: {msg}"
        );
    }

    // control: a valid config deploys
    assert_eq!(deploy_err(|env, _q| vec![env, sac(env), sac(env)]), None);
}

// ---------------------------------------------------------------------------
// create_offer failures
// ---------------------------------------------------------------------------

#[test]
fn create_offer_rejects_non_allowlisted_asset() {
    let t = setup();
    let before = t.snap();

    // a real SAC that is not in the allowlist
    let other = t
        .env
        .register_stellar_asset_contract_v2(t.rwa_issuer.clone())
        .address();
    t.sac(&other).mint(&t.writer, &UNDERLYING_START);
    for ty in [OptionType::Put, OptionType::Call] {
        assert_err(
            t.c.try_create_offer(&t.writer, &other, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
            Error::AssetNotAllowed,
        );
    }
    // the quote token is never an underlying
    assert_err(
        t.c.try_create_offer(
            &t.writer,
            &t.usdx,
            &OptionType::Call,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::AssetNotAllowed,
    );
    // an arbitrary address
    let random = Address::generate(&t.env);
    assert_err(
        t.c.try_create_offer(
            &t.writer,
            &random,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::AssetNotAllowed,
    );
    // check order: AssetNotAllowed comes before InvalidArgs
    assert_err(
        t.c.try_create_offer(&t.writer, &other, &OptionType::Put, &0, &0, &0, &START),
        Error::AssetNotAllowed,
    );

    assert_eq!(t.bal(&other, &t.contract), 0);
    assert_eq!(t.snap(), before);
}

#[test]
fn create_offer_rejects_bad_args() {
    let t = setup();
    let before = t.snap();

    let cases: [(i128, i128, i128, u64); 11] = [
        (0, STRIKE, PREMIUM, EXPIRY),
        (QTY, 0, PREMIUM, EXPIRY),
        (QTY, STRIKE, 0, EXPIRY),
        (-1, STRIKE, PREMIUM, EXPIRY),
        (QTY, -1, PREMIUM, EXPIRY),
        (QTY, STRIKE, -1, EXPIRY),
        (i128::MIN, STRIKE, PREMIUM, EXPIRY),
        (QTY, STRIKE, PREMIUM, START),     // expiry == now
        (QTY, STRIKE, PREMIUM, START - 1), // expiry in the past
        (QTY, STRIKE, PREMIUM, 0),
        (0, 0, 0, 0),
    ];
    for (qty, strike, premium, expiry) in cases {
        for ty in [OptionType::Put, OptionType::Call] {
            assert_err(
                t.c.try_create_offer(&t.writer, &t.rwa, &ty, &qty, &strike, &premium, &expiry),
                Error::InvalidArgs,
            );
        }
    }
    // check order: InvalidArgs comes before NotEligible
    assert_err(
        t.c.try_create_offer(
            &t.outsider,
            &t.rwa,
            &OptionType::Put,
            &0,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::InvalidArgs,
    );

    assert_eq!(t.snap(), before);
    assert_eq!(t.c.option_count(), 0);

    // boundary: expiry = now + 1 is accepted
    let id = t.c.create_offer(
        &t.writer,
        &t.rwa,
        &OptionType::Put,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &(START + 1),
    );
    assert_eq!(id, 0);
}

#[test]
fn create_offer_rejects_ineligible_writer() {
    let t = setup();
    // the outsider holds no RWA/BOND (it cannot be authorized to), so even the
    // CALL cases must be stopped by the eligibility check, not by the SAC
    let before = t.snap();

    for (token, ty) in [
        (&t.rwa, OptionType::Put),
        (&t.rwa, OptionType::Call),
        (&t.bond, OptionType::Put),
        (&t.bond, OptionType::Call),
    ] {
        assert_err(
            t.c.try_create_offer(&t.outsider, token, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
            Error::NotEligible,
        );
    }
    assert_eq!(t.snap(), before);

    // an issuer freeze makes an existing writer ineligible on that asset only
    t.sac(&t.rwa).set_authorized(&t.writer, &false);
    assert_err(
        t.c.try_create_offer(
            &t.writer,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::NotEligible,
    );
    assert_eq!(t.c.option_count(), 0);
    assert_eq!(t.offer(&t.writer, &t.bond, OptionType::Put), 0);
}

#[test]
fn create_offer_rejects_unauthorized_contract() {
    let t = setup_with(false);
    let before = t.snap();
    assert!(!t.c.is_eligible(&t.rwa, &t.contract));

    for ty in [OptionType::Put, OptionType::Call] {
        assert_err(
            t.c.try_create_offer(&t.writer, &t.rwa, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
            Error::ContractNotAuthorized,
        );
    }
    // check order: writer eligibility is checked before the contract's
    assert_err(
        t.c.try_create_offer(
            &t.outsider,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::NotEligible,
    );
    assert_eq!(t.snap(), before);

    // once the issuer authorizes the contract on RWA, offers on RWA work;
    // BOND is still blocked
    t.sac(&t.rwa).set_authorized(&t.contract, &true);
    assert_eq!(t.put(&t.writer), 0);
    assert_err(
        t.c.try_create_offer(
            &t.writer,
            &t.bond,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::ContractNotAuthorized,
    );

    // revoking the contract later blocks new offers again
    t.sac(&t.rwa).set_authorized(&t.contract, &false);
    assert_err(
        t.c.try_create_offer(
            &t.writer,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::ContractNotAuthorized,
    );
    assert_eq!(t.c.option_count(), 1);
}

#[test]
fn create_offer_fails_when_writer_lacks_collateral() {
    let t = setup();
    // authorized on the underlyings, but holds no USDx and no RWA
    let poor = Address::generate(&t.env);
    t.sac(&t.rwa).set_authorized(&poor, &true);
    assert!(t.c.is_eligible(&t.rwa, &poor));
    let before = t.snap();

    assert_sac_err(
        t.c.try_create_offer(
            &poor,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        SAC_BALANCE,
    );
    assert_sac_err(
        t.c.try_create_offer(
            &poor,
            &t.rwa,
            &OptionType::Call,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        SAC_BALANCE,
    );
    // the writer has funds, but not enough
    assert_sac_err(
        t.c.try_create_offer(
            &t.writer,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &(USDX_START + 1),
            &PREMIUM,
            &EXPIRY,
        ),
        SAC_BALANCE,
    );
    assert_sac_err(
        t.c.try_create_offer(
            &t.writer,
            &t.rwa,
            &OptionType::Call,
            &(UNDERLYING_START + 1),
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        SAC_BALANCE,
    );

    assert_eq!(t.snap(), before);
    assert_eq!(t.c.option_count(), 0);
    assert_eq!(t.open(), std::vec![] as std::vec::Vec<u32>);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
}

// ---------------------------------------------------------------------------
// buy failures
// ---------------------------------------------------------------------------

#[test]
fn buy_rejects_already_bought() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    let before = t.snap();

    assert_err(t.c.try_buy(&t.maker2, &id), Error::WrongState);
    assert_err(t.c.try_buy(&t.holder, &id), Error::WrongState);
    // check order: WrongState comes before Expired / SelfTrade / NotEligible
    assert_err(t.c.try_buy(&t.writer, &id), Error::WrongState);
    assert_err(t.c.try_buy(&t.outsider, &id), Error::WrongState);
    t.at(EXPIRY);
    assert_err(t.c.try_buy(&t.maker2, &id), Error::WrongState);

    assert_eq!(t.snap(), before);
    assert_eq!(t.holder_of(id), Some(t.holder.clone()));
}

#[test]
fn buy_rejects_after_expiry() {
    let t = setup();
    let id = t.put(&t.writer);
    let before = t.snap();

    t.at(EXPIRY);
    assert_err(t.c.try_buy(&t.holder, &id), Error::Expired);
    t.at(EXPIRY + 1);
    assert_err(t.c.try_buy(&t.holder, &id), Error::Expired);
    // check order: Expired comes before SelfTrade and NotEligible
    assert_err(t.c.try_buy(&t.writer, &id), Error::Expired);
    assert_err(t.c.try_buy(&t.outsider, &id), Error::Expired);

    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Offered);
    assert_eq!(t.holder_of(id), None);

    // one second before expiry still works
    let t2 = setup();
    let id2 = t2.put(&t2.writer);
    t2.at(EXPIRY - 1);
    t2.c.buy(&t2.holder, &id2);
    assert_eq!(t2.state(id2), State::Active);
}

#[test]
fn buy_rejects_self_trade() {
    let t = setup();
    let id = t.put(&t.writer);
    let before = t.snap();

    assert_err(t.c.try_buy(&t.writer, &id), Error::SelfTrade);
    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Offered);
    assert_eq!(t.open(), [id]);
}

#[test]
fn buy_rejects_ineligible_buyer() {
    let t = setup();
    let id = t.put(&t.writer);
    let before = t.snap();

    assert_err(t.c.try_buy(&t.outsider, &id), Error::NotEligible);
    // a frozen holder is not eligible either
    t.sac(&t.rwa).set_authorized(&t.holder, &false);
    assert_err(t.c.try_buy(&t.holder, &id), Error::NotEligible);
    assert_eq!(t.snap(), before);

    // eligibility is per underlying: the frozen holder can still buy a BOND offer
    let bond_id = t.offer(&t.writer, &t.bond, OptionType::Put);
    t.c.buy(&t.holder, &bond_id);
    assert_eq!(t.state(bond_id), State::Active);
    assert_eq!(t.state(id), State::Offered);
}

#[test]
fn buy_fails_when_buyer_cannot_pay_premium() {
    let t = setup();
    let id = t.put(&t.writer);
    // eligible on RWA, but no USDx at all
    let poor = Address::generate(&t.env);
    t.sac(&t.rwa).set_authorized(&poor, &true);
    let before = t.snap();

    assert_sac_err(t.c.try_buy(&poor, &id), SAC_BALANCE);

    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Offered);
    assert_eq!(t.holder_of(id), None);
    assert_eq!(t.open(), [id]);
    assert_eq!(t.bal(&t.usdx, &poor), 0);
}

// ---------------------------------------------------------------------------
// exercise failures
// ---------------------------------------------------------------------------

#[test]
fn exercise_rejects_non_holder() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    let before = t.snap();

    assert_err(t.c.try_exercise(&t.writer, &id), Error::NotHolder);
    assert_err(t.c.try_exercise(&t.maker2, &id), Error::NotHolder);
    assert_err(t.c.try_exercise(&t.outsider, &id), Error::NotHolder);
    // check order: ownership comes before time
    t.at(EXPIRY);
    assert_err(t.c.try_exercise(&t.maker2, &id), Error::NotHolder);

    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Active);
}

#[test]
fn exercise_rejects_offered_not_bought() {
    let t = setup();
    let id = t.put(&t.writer);
    let before = t.snap();

    // holder is None while Offered, so nobody is the holder
    assert_err(t.c.try_exercise(&t.holder, &id), Error::NotHolder);
    assert_err(t.c.try_exercise(&t.writer, &id), Error::NotHolder);
    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Offered);
}

#[test]
fn exercise_rejects_double_exercise() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    t.c.exercise(&t.holder, &id);
    let after_first = t.snap();

    assert_err(t.c.try_exercise(&t.holder, &id), Error::WrongState);
    assert_eq!(t.snap(), after_first);

    // still WrongState after the writer settled
    t.c.claim_delivery(&t.writer, &id);
    assert_err(t.c.try_exercise(&t.holder, &id), Error::WrongState);
    assert_eq!(t.state(id), State::Settled);

    // same for a call
    let cid = t.call(&t.writer);
    t.c.buy(&t.holder, &cid);
    t.c.exercise(&t.holder, &cid);
    let s = t.snap();
    assert_err(t.c.try_exercise(&t.holder, &cid), Error::WrongState);
    assert_eq!(t.snap(), s);
}

#[test]
fn exercise_rejects_after_expiry() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    let before = t.snap();

    t.at(EXPIRY);
    assert_err(t.c.try_exercise(&t.holder, &id), Error::Expired);
    t.at(EXPIRY + 10);
    assert_err(t.c.try_exercise(&t.holder, &id), Error::Expired);
    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Active);

    // the writer gets the collateral back instead
    t.c.reclaim(&t.writer, &id);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START + PREMIUM);
}

// ---------------------------------------------------------------------------
// cancel / reclaim / claim_delivery failures
// ---------------------------------------------------------------------------

#[test]
fn cancel_rejects_non_writer() {
    let t = setup();
    let id = t.put(&t.writer);
    let before = t.snap();

    assert_err(t.c.try_cancel_offer(&t.maker2, &id), Error::NotWriter);
    assert_err(t.c.try_cancel_offer(&t.holder, &id), Error::NotWriter);
    assert_err(t.c.try_cancel_offer(&t.outsider, &id), Error::NotWriter);
    assert_eq!(t.snap(), before);

    // check order: ownership comes before state
    t.c.buy(&t.holder, &id);
    assert_err(t.c.try_cancel_offer(&t.maker2, &id), Error::NotWriter);
    assert_eq!(t.state(id), State::Active);
}

#[test]
fn cancel_rejects_after_bought() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    let before = t.snap();

    assert_err(t.c.try_cancel_offer(&t.writer, &id), Error::WrongState);
    t.at(EXPIRY);
    assert_err(t.c.try_cancel_offer(&t.writer, &id), Error::WrongState);
    assert_eq!(t.snap(), before);

    // and after exercise
    let t2 = setup();
    let id2 = t2.call(&t2.writer);
    t2.c.buy(&t2.holder, &id2);
    t2.c.exercise(&t2.holder, &id2);
    assert_err(t2.c.try_cancel_offer(&t2.writer, &id2), Error::WrongState);
}

#[test]
fn reclaim_rejects_before_expiry() {
    let t = setup();
    let offered = t.put(&t.writer);
    let active = t.call(&t.writer);
    t.c.buy(&t.holder, &active);
    let before = t.snap();

    assert_err(t.c.try_reclaim(&t.writer, &offered), Error::NotExpired);
    assert_err(t.c.try_reclaim(&t.writer, &active), Error::NotExpired);
    t.at(EXPIRY - 1);
    assert_err(t.c.try_reclaim(&t.writer, &offered), Error::NotExpired);
    assert_err(t.c.try_reclaim(&t.writer, &active), Error::NotExpired);
    assert_eq!(t.snap(), before);
}

#[test]
fn reclaim_rejects_non_writer() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    let before = t.snap();

    // check order: ownership comes before time
    assert_err(t.c.try_reclaim(&t.maker2, &id), Error::NotWriter);
    t.at(EXPIRY);
    assert_err(t.c.try_reclaim(&t.maker2, &id), Error::NotWriter);
    assert_err(t.c.try_reclaim(&t.holder, &id), Error::NotWriter);
    assert_err(t.c.try_reclaim(&t.outsider, &id), Error::NotWriter);
    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Active);
}

#[test]
fn reclaim_rejects_exercised() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    t.c.exercise(&t.holder, &id);
    let before = t.snap();

    t.at(EXPIRY);
    assert_err(t.c.try_reclaim(&t.writer, &id), Error::WrongState);
    assert_eq!(t.snap(), before);

    // Settled and Cancelled are terminal too
    t.c.claim_delivery(&t.writer, &id);
    assert_err(t.c.try_reclaim(&t.writer, &id), Error::WrongState);
    t.at(START);
    let cancelled = t.call(&t.writer);
    t.c.cancel_offer(&t.writer, &cancelled);
    t.at(EXPIRY);
    assert_err(t.c.try_reclaim(&t.writer, &cancelled), Error::WrongState);
}

#[test]
fn claim_delivery_rejects_non_writer() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    t.c.exercise(&t.holder, &id);
    let before = t.snap();

    assert_err(t.c.try_claim_delivery(&t.holder, &id), Error::NotWriter);
    assert_err(t.c.try_claim_delivery(&t.maker2, &id), Error::NotWriter);
    assert_err(t.c.try_claim_delivery(&t.outsider, &id), Error::NotWriter);
    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Exercised);

    // check order: ownership comes before state
    let offered = t.call(&t.writer);
    assert_err(
        t.c.try_claim_delivery(&t.maker2, &offered),
        Error::NotWriter,
    );
}

#[test]
fn claim_delivery_rejects_not_exercised() {
    let t = setup();
    let offered = t.put(&t.writer);
    let active = t.put(&t.writer);
    t.c.buy(&t.holder, &active);
    let cancelled = t.call(&t.writer);
    t.c.cancel_offer(&t.writer, &cancelled);
    let reclaimed = t.call(&t.maker2);
    let before = t.snap();

    assert_err(
        t.c.try_claim_delivery(&t.writer, &offered),
        Error::WrongState,
    );
    assert_err(
        t.c.try_claim_delivery(&t.writer, &active),
        Error::WrongState,
    );
    assert_err(
        t.c.try_claim_delivery(&t.writer, &cancelled),
        Error::WrongState,
    );
    assert_eq!(t.snap(), before);

    t.at(EXPIRY);
    t.c.reclaim(&t.maker2, &reclaimed);
    let s = t.snap();
    assert_err(
        t.c.try_claim_delivery(&t.maker2, &reclaimed),
        Error::WrongState,
    );
    assert_eq!(t.snap(), s);
}

#[test]
fn claim_delivery_rejects_double_claim() {
    let t = setup();
    let id = t.call(&t.writer);
    t.c.buy(&t.holder, &id);
    t.c.exercise(&t.holder, &id);
    t.c.claim_delivery(&t.writer, &id);
    let after_first = t.snap();
    assert_eq!(after_first.writer.usdx, USDX_START + PREMIUM + STRIKE);

    assert_err(t.c.try_claim_delivery(&t.writer, &id), Error::WrongState);
    assert_eq!(t.snap(), after_first);
    assert_eq!(t.state(id), State::Settled);
}

// ---------------------------------------------------------------------------
// Issuer actions (ABI §6)
// ---------------------------------------------------------------------------

#[test]
fn frozen_writer_put_exercise_still_pays_holder() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);

    // issuer freezes the writer on RWA
    t.sac(&t.rwa).set_authorized(&t.writer, &false);
    assert!(!t.c.is_eligible(&t.rwa, &t.writer));

    // exercise still succeeds: the RWA lands in the contract, the holder is paid
    t.c.exercise(&t.holder, &id);
    assert_eq!(t.state(id), State::Exercised);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM + STRIKE);
    assert_eq!(t.bal(&t.rwa, &t.holder), UNDERLYING_START - QTY);
    assert_eq!(t.bal(&t.rwa, &t.contract), QTY);
    assert_eq!(t.bal(&t.usdx, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);
    assert_eq!(t.c.open_collateral(&t.usdx), 0); // decreased by STRIKE

    // the frozen writer cannot pull the RWA; everything stays in place
    let before = t.snap();
    assert_sac_err(t.c.try_claim_delivery(&t.writer, &id), SAC_DEAUTHORIZED);
    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Exercised);

    // after re-authorization the claim succeeds
    t.sac(&t.rwa).set_authorized(&t.writer, &true);
    t.c.claim_delivery(&t.writer, &id);
    assert_eq!(t.state(id), State::Settled);
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START + QTY);
    assert_eq!(t.bal(&t.rwa, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
}

#[test]
fn frozen_writer_call_exercise_and_usdx_claim_succeed() {
    let t = setup();
    let id = t.call(&t.writer);
    t.c.buy(&t.holder, &id);
    t.sac(&t.rwa).set_authorized(&t.writer, &false);

    // the writer is not a party to either leg of a call exercise
    t.c.exercise(&t.holder, &id);
    assert_eq!(t.bal(&t.rwa, &t.holder), UNDERLYING_START + QTY);
    assert_eq!(t.bal(&t.usdx, &t.contract), STRIKE);

    // USDx (unregulated issuer) proceeds are not blocked by the RWA freeze
    t.c.claim_delivery(&t.writer, &id);
    assert_eq!(t.state(id), State::Settled);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START + PREMIUM + STRIKE);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
}

#[test]
fn frozen_holder_blocks_exercise() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);

    t.sac(&t.rwa).set_authorized(&t.holder, &false);
    let before = t.snap();
    assert_sac_err(t.c.try_exercise(&t.holder, &id), SAC_DEAUTHORIZED);
    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Active);
    assert_eq!(t.holder_of(id), Some(t.holder.clone()));

    // a frozen holder of a CALL cannot receive the underlying either
    let cid = t.call(&t.maker2);
    t.sac(&t.rwa).set_authorized(&t.holder, &true);
    t.c.buy(&t.holder, &cid);
    t.sac(&t.rwa).set_authorized(&t.holder, &false);
    let before = t.snap();
    assert_sac_err(t.c.try_exercise(&t.holder, &cid), SAC_DEAUTHORIZED);
    assert_eq!(t.snap(), before);

    // after expiry the writer reclaims the PUT collateral (ABI §6)
    t.at(EXPIRY);
    t.c.reclaim(&t.writer, &id);
    assert_eq!(t.state(id), State::Expired);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START + PREMIUM);
}

#[test]
fn clawback_of_call_collateral_makes_exercise_fail_atomically() {
    let t = setup();
    let id = t.call(&t.writer);
    t.c.buy(&t.holder, &id);
    assert_eq!(t.bal(&t.rwa, &t.contract), QTY);

    // issuer claws the locked RWA back from the contract
    t.sac(&t.rwa).clawback(&t.contract, &QTY);
    assert_eq!(t.bal(&t.rwa, &t.contract), 0);
    // the contract still owes QTY: open_collateral exceeds the SAC balance
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);
    assert!(t.c.open_collateral(&t.rwa) > t.bal(&t.rwa, &t.contract));

    let before = t.snap();
    assert_sac_err(t.c.try_exercise(&t.holder, &id), SAC_BALANCE);
    // nothing partial: the holder's strike payment was reverted too
    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Active);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM);
    assert_eq!(t.bal(&t.usdx, &t.contract), 0);

    // reclaim after expiry fails the same way (no Impaired state, no refund)
    t.at(EXPIRY);
    let before = t.snap();
    assert_sac_err(t.c.try_reclaim(&t.writer, &id), SAC_BALANCE);
    assert_eq!(t.snap(), before);
    assert_eq!(t.state(id), State::Active);
}

// ---------------------------------------------------------------------------
// Overflow
// ---------------------------------------------------------------------------

#[test]
fn reserved_total_overflow_returns_overflow_or_sac_rejects() {
    // Two huge PUT offers on USDx. The locked check order puts transfers before
    // storage, so the SAC's own checked add on the contract's USDx balance fails
    // first (SAC OverflowError #12) before the contract updates its reserved
    // total. (A contract that pre-computed the reserved total would return
    // Error::Overflow = 112 instead; since v1.1 the two codes are distinct.)
    let t = setup();
    t.sac(&t.usdx).mint(&t.writer, &(i128::MAX - USDX_START));
    assert_eq!(t.bal(&t.usdx, &t.writer), i128::MAX);

    let id = t.c.create_offer(
        &t.writer,
        &t.rwa,
        &OptionType::Put,
        &QTY,
        &i128::MAX,
        &PREMIUM,
        &EXPIRY,
    );
    assert_eq!(t.c.open_collateral(&t.usdx), i128::MAX);
    assert_eq!(t.bal(&t.usdx, &t.contract), i128::MAX);
    let before = t.snap();

    assert_sac_err(
        t.c.try_create_offer(
            &t.maker2,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        SAC_OVERFLOW,
    );
    assert_eq!(t.snap(), before);
    assert_eq!(t.c.option_count(), 1);
    assert_eq!(t.open(), [id]);
}

#[test]
fn reserved_total_overflow_after_clawback_returns_contract_overflow() {
    // Forces the contract's own checked i128 math: after a clawback the SAC
    // balance is far below the reserved total, so a SAC transfer into the
    // contract succeeds and only `reserved + qty` overflows -> Error::Overflow.
    // Since v1.1, create_offer refuses new exposure on a token in deficit
    // (CollateralShortfall), so the overflow is reached through the exercise of
    // a PUT bought before the clawback (its delivery adds qty to the reserve).
    let t = setup();
    let put = t.offer(&t.maker2, &t.rwa, OptionType::Put);
    t.c.buy(&t.holder, &put);
    t.sac(&t.rwa)
        .mint(&t.writer, &(i128::MAX - UNDERLYING_START));
    let call = t.c.create_offer(
        &t.writer,
        &t.rwa,
        &OptionType::Call,
        &i128::MAX,
        &STRIKE,
        &PREMIUM,
        &EXPIRY,
    );
    t.sac(&t.rwa).clawback(&t.contract, &i128::MAX);
    assert_eq!(t.bal(&t.rwa, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), i128::MAX);
    let before = t.snap();

    // new exposure on RWA is refused before any transfer or reserve update
    assert_err(
        t.c.try_create_offer(
            &t.maker2,
            &t.rwa,
            &OptionType::Call,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::CollateralShortfall,
    );
    assert_eq!(t.snap(), before);

    // the PUT bought before the clawback still settles up to the point where
    // adding its delivery to the RWA reserve overflows; the whole call reverts
    assert_err(t.c.try_exercise(&t.holder, &put), Error::Overflow);
    assert_eq!(t.snap(), before);
    assert_eq!(t.state(put), State::Active);
    assert_eq!(t.bal(&t.rwa, &t.maker2), UNDERLYING_START);
    assert_eq!(t.open(), [call]);
}

// ---------------------------------------------------------------------------
// Views and TTL
// ---------------------------------------------------------------------------

#[test]
fn get_option_unknown_id_not_found() {
    let t = setup();
    assert_err(t.c.try_get_option(&0), Error::NotFound);

    let id = t.put(&t.writer);
    assert_eq!(t.c.get_option(&id).id, 0);
    assert_err(t.c.try_get_option(&1), Error::NotFound);
    assert_err(t.c.try_get_option(&u32::MAX), Error::NotFound);

    // every id-taking mutator reports NotFound for an unknown id
    let before = t.snap();
    assert_err(t.c.try_buy(&t.holder, &7), Error::NotFound);
    assert_err(t.c.try_exercise(&t.holder, &7), Error::NotFound);
    assert_err(t.c.try_cancel_offer(&t.writer, &7), Error::NotFound);
    assert_err(t.c.try_reclaim(&t.writer, &7), Error::NotFound);
    assert_err(t.c.try_claim_delivery(&t.writer, &7), Error::NotFound);
    assert_eq!(t.snap(), before);
}

#[test]
fn extend_ttl_known_ok_unknown_not_found() {
    let t = setup();
    let a = t.put(&t.writer);
    let b = t.call(&t.writer);

    // every state-changing call extends the option entry and the instance
    // to about TTL_EXTEND_TO = 30 days (ABI §8); judging ends 2026-10-28
    assert!(
        t.option_ttl(a) >= 29 * DAY,
        "option TTL {}",
        t.option_ttl(a)
    );
    assert!(
        t.instance_ttl() >= 29 * DAY,
        "instance TTL {}",
        t.instance_ttl()
    );

    assert_eq!(t.c.try_extend_ttl(&vec![&t.env]), Ok(Ok(())));
    assert_eq!(t.c.try_extend_ttl(&vec![&t.env, a, b]), Ok(Ok(())));
    assert_err(t.c.try_extend_ttl(&vec![&t.env, a, 5]), Error::NotFound);
    assert_err(t.c.try_extend_ttl(&vec![&t.env, 9]), Error::NotFound);

    // 25 days later the entries are below the 7-day threshold
    let seq = t.env.ledger().sequence();
    t.env.ledger().set_sequence_number(seq + 25 * DAY);
    assert!(t.option_ttl(a) < 7 * DAY);
    assert!(t.option_ttl(b) < 7 * DAY);

    // anyone can extend; only the listed ids are bumped
    t.c.extend_ttl(&vec![&t.env, a]);
    assert!(
        t.option_ttl(a) >= 29 * DAY,
        "option TTL after extend {}",
        t.option_ttl(a)
    );
    assert!(t.option_ttl(b) < 7 * DAY);
    assert!(t.instance_ttl() >= 29 * DAY);
    assert!(t.env.deployer().get_contract_instance_ttl(&t.contract) >= 29 * DAY);
    // the contract code lives at least as long (ABI §8). Note: instance TTL
    // extension already bumps the code entry, so this does not isolate the
    // `env.deployer().extend_ttl` call.
    assert!(
        t.env.deployer().get_contract_code_ttl(&t.contract) >= 29 * DAY,
        "code TTL {}",
        t.env.deployer().get_contract_code_ttl(&t.contract)
    );
}

#[test]
fn is_eligible_true_for_holder_false_for_outsider_and_contract_before_auth() {
    let t = setup_with(false);
    assert!(t.c.is_eligible(&t.rwa, &t.holder));
    assert!(t.c.is_eligible(&t.rwa, &t.writer));
    assert!(t.c.is_eligible(&t.bond, &t.maker2));
    assert!(!t.c.is_eligible(&t.rwa, &t.outsider));
    assert!(!t.c.is_eligible(&t.bond, &t.outsider));
    assert!(!t.c.is_eligible(&t.rwa, &t.contract));
    assert!(!t.c.is_eligible(&t.bond, &t.contract));
    assert!(!t.c.is_eligible(&t.rwa, &Address::generate(&t.env)));
    // USDx has no AUTH_REQUIRED flag: everyone is eligible
    assert!(t.c.is_eligible(&t.usdx, &t.outsider));
    assert!(t.c.is_eligible(&t.usdx, &Address::generate(&t.env)));

    t.sac(&t.rwa).set_authorized(&t.contract, &true);
    assert!(t.c.is_eligible(&t.rwa, &t.contract));
    assert!(!t.c.is_eligible(&t.bond, &t.contract));

    // freeze and unfreeze follow the SAC
    t.sac(&t.rwa).set_authorized(&t.holder, &false);
    assert!(!t.c.is_eligible(&t.rwa, &t.holder));
    t.sac(&t.rwa).set_authorized(&t.holder, &true);
    assert!(t.c.is_eligible(&t.rwa, &t.holder));
}

#[test]
fn open_collateral_zero_for_unknown_token() {
    let t = setup();
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    assert_eq!(t.c.open_collateral(&t.bond), 0);
    let unknown = Address::generate(&t.env);
    assert_eq!(t.c.open_collateral(&unknown), 0);

    t.put(&t.writer);
    t.call(&t.writer);
    assert_eq!(t.c.open_collateral(&unknown), 0);
    assert_eq!(t.c.open_collateral(&t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.usdx), STRIKE);
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

fn contract_fn(t: &T, contract: &Address, name: &str, args: Vec<Val>) -> AuthorizedFunction {
    AuthorizedFunction::Contract((contract.clone(), Symbol::new(&t.env, name), args))
}

fn leaf(f: AuthorizedFunction) -> AuthorizedInvocation {
    AuthorizedInvocation {
        function: f,
        sub_invocations: std::vec![],
    }
}

#[test]
fn auths_create_offer_is_writer_with_collateral_transfer() {
    let t = setup();

    t.put(&t.writer);
    assert_eq!(
        t.env.auths(),
        std::vec![(
            t.writer.clone(),
            AuthorizedInvocation {
                function: contract_fn(
                    &t,
                    &t.contract,
                    "create_offer",
                    (
                        t.writer.clone(),
                        t.rwa.clone(),
                        OptionType::Put,
                        QTY,
                        STRIKE,
                        PREMIUM,
                        EXPIRY
                    )
                        .into_val(&t.env),
                ),
                sub_invocations: std::vec![leaf(AuthorizedFunction::Contract((
                    t.usdx.clone(),
                    symbol_short!("transfer"),
                    (t.writer.clone(), t.contract.clone(), STRIKE).into_val(&t.env),
                )))],
            }
        )]
    );

    t.call(&t.maker2);
    assert_eq!(
        t.env.auths(),
        std::vec![(
            t.maker2.clone(),
            AuthorizedInvocation {
                function: contract_fn(
                    &t,
                    &t.contract,
                    "create_offer",
                    (
                        t.maker2.clone(),
                        t.rwa.clone(),
                        OptionType::Call,
                        QTY,
                        STRIKE,
                        PREMIUM,
                        EXPIRY
                    )
                        .into_val(&t.env),
                ),
                sub_invocations: std::vec![leaf(contract_fn(
                    &t,
                    &t.rwa,
                    "transfer",
                    (t.maker2.clone(), t.contract.clone(), QTY).into_val(&t.env),
                ))],
            }
        )]
    );
}

#[test]
fn auths_buy_exercise_and_writer_calls() {
    let t = setup();
    let id = t.put(&t.writer);

    t.c.buy(&t.holder, &id);
    assert_eq!(
        t.env.auths(),
        std::vec![(
            t.holder.clone(),
            AuthorizedInvocation {
                function: contract_fn(
                    &t,
                    &t.contract,
                    "buy",
                    (t.holder.clone(), id).into_val(&t.env)
                ),
                sub_invocations: std::vec![leaf(contract_fn(
                    &t,
                    &t.usdx,
                    "transfer",
                    (t.holder.clone(), t.writer.clone(), PREMIUM).into_val(&t.env),
                ))],
            }
        )]
    );

    // PUT exercise: only the holder signs (for the underlying delivery); the
    // contract's payout needs no external signature
    t.c.exercise(&t.holder, &id);
    assert_eq!(
        t.env.auths(),
        std::vec![(
            t.holder.clone(),
            AuthorizedInvocation {
                function: contract_fn(
                    &t,
                    &t.contract,
                    "exercise",
                    (t.holder.clone(), id).into_val(&t.env)
                ),
                sub_invocations: std::vec![leaf(contract_fn(
                    &t,
                    &t.rwa,
                    "transfer",
                    (t.holder.clone(), t.contract.clone(), QTY).into_val(&t.env),
                ))],
            }
        )]
    );

    t.c.claim_delivery(&t.writer, &id);
    assert_eq!(
        t.env.auths(),
        std::vec![(
            t.writer.clone(),
            leaf(contract_fn(
                &t,
                &t.contract,
                "claim_delivery",
                (t.writer.clone(), id).into_val(&t.env)
            ))
        )]
    );

    // CALL exercise: the holder signs the strike payment
    let cid = t.call(&t.writer);
    t.c.buy(&t.holder, &cid);
    t.c.exercise(&t.holder, &cid);
    assert_eq!(
        t.env.auths(),
        std::vec![(
            t.holder.clone(),
            AuthorizedInvocation {
                function: contract_fn(
                    &t,
                    &t.contract,
                    "exercise",
                    (t.holder.clone(), cid).into_val(&t.env)
                ),
                sub_invocations: std::vec![leaf(contract_fn(
                    &t,
                    &t.usdx,
                    "transfer",
                    (t.holder.clone(), t.contract.clone(), STRIKE).into_val(&t.env),
                ))],
            }
        )]
    );

    let x = t.put(&t.writer);
    t.c.cancel_offer(&t.writer, &x);
    assert_eq!(
        t.env.auths(),
        std::vec![(
            t.writer.clone(),
            leaf(contract_fn(
                &t,
                &t.contract,
                "cancel_offer",
                (t.writer.clone(), x).into_val(&t.env)
            ))
        )]
    );

    let y = t.put(&t.writer);
    t.at(EXPIRY);
    t.c.reclaim(&t.writer, &y);
    assert_eq!(
        t.env.auths(),
        std::vec![(
            t.writer.clone(),
            leaf(contract_fn(
                &t,
                &t.contract,
                "reclaim",
                (t.writer.clone(), y).into_val(&t.env)
            ))
        )]
    );
}

#[test]
fn create_offer_requires_writer_signature() {
    let t = setup();
    let collateral = MockAuthInvoke {
        contract: &t.usdx,
        fn_name: "transfer",
        args: (&t.writer, &t.contract, STRIKE).into_val(&t.env),
        sub_invokes: &[],
    };
    let create = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "create_offer",
        args: (
            &t.writer,
            &t.rwa,
            OptionType::Put,
            QTY,
            STRIKE,
            PREMIUM,
            EXPIRY,
        )
            .into_val(&t.env),
        sub_invokes: std::slice::from_ref(&collateral),
    };
    let before = t.snap();

    // maker2 cannot create an offer funded by the writer
    t.env.mock_auths(&[MockAuth {
        address: &t.maker2,
        invoke: &create,
    }]);
    assert_host_abort(t.c.try_create_offer(
        &t.writer,
        &t.rwa,
        &OptionType::Put,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &EXPIRY,
    ));
    assert_eq!(t.snap(), before);

    // the writer's signature over the call and the collateral transfer works
    t.env.mock_auths(&[MockAuth {
        address: &t.writer,
        invoke: &create,
    }]);
    let id = t.c.create_offer(
        &t.writer,
        &t.rwa,
        &OptionType::Put,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &EXPIRY,
    );
    assert_eq!(id, 0);
    assert_eq!(t.bal(&t.usdx, &t.contract), STRIKE);
}

#[test]
fn buy_requires_buyer_signature() {
    let t = setup();
    let id = t.put(&t.writer);
    let premium = MockAuthInvoke {
        contract: &t.usdx,
        fn_name: "transfer",
        args: (&t.holder, &t.writer, PREMIUM).into_val(&t.env),
        sub_invokes: &[],
    };
    let buy = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "buy",
        args: (&t.holder, id).into_val(&t.env),
        sub_invokes: std::slice::from_ref(&premium),
    };
    let before = t.snap();

    // maker2 signs a purchase on behalf of the holder
    t.env.mock_auths(&[MockAuth {
        address: &t.maker2,
        invoke: &buy,
    }]);
    assert_host_abort(t.c.try_buy(&t.holder, &id));
    assert_eq!(t.snap(), before);

    // the writer signs it
    t.env.mock_auths(&[MockAuth {
        address: &t.writer,
        invoke: &buy,
    }]);
    assert_host_abort(t.c.try_buy(&t.holder, &id));
    assert_eq!(t.snap(), before);

    // the holder signs the call but not the premium transfer
    let buy_without_premium = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "buy",
        args: (&t.holder, id).into_val(&t.env),
        sub_invokes: &[],
    };
    t.env.mock_auths(&[MockAuth {
        address: &t.holder,
        invoke: &buy_without_premium,
    }]);
    assert_host_abort(t.c.try_buy(&t.holder, &id));
    assert_eq!(t.snap(), before);

    // the holder signs the call and the premium transfer
    t.env.mock_auths(&[MockAuth {
        address: &t.holder,
        invoke: &buy,
    }]);
    t.c.buy(&t.holder, &id);
    assert_eq!(t.state(id), State::Active);
    assert_eq!(t.holder_of(id), Some(t.holder.clone()));
}

#[test]
fn exercise_requires_holder_signature() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    let delivery = MockAuthInvoke {
        contract: &t.rwa,
        fn_name: "transfer",
        args: (&t.holder, &t.contract, QTY).into_val(&t.env),
        sub_invokes: &[],
    };
    let exercise = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "exercise",
        args: (&t.holder, id).into_val(&t.env),
        sub_invokes: std::slice::from_ref(&delivery),
    };
    let before = t.snap();

    // the writer cannot force an exercise on the holder's behalf
    t.env.mock_auths(&[MockAuth {
        address: &t.writer,
        invoke: &exercise,
    }]);
    assert_host_abort(t.c.try_exercise(&t.holder, &id));
    assert_eq!(t.snap(), before);

    // nor can maker2
    t.env.mock_auths(&[MockAuth {
        address: &t.maker2,
        invoke: &exercise,
    }]);
    assert_host_abort(t.c.try_exercise(&t.holder, &id));
    assert_eq!(t.snap(), before);

    // the holder's signature over the call and the delivery is sufficient
    t.env.mock_auths(&[MockAuth {
        address: &t.holder,
        invoke: &exercise,
    }]);
    t.c.exercise(&t.holder, &id);
    assert_eq!(t.state(id), State::Exercised);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM + STRIKE);
}

#[test]
fn cancel_offer_requires_writer_signature() {
    let t = setup();
    let id = t.put(&t.writer);
    let cancel = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "cancel_offer",
        args: (&t.writer, id).into_val(&t.env),
        sub_invokes: &[],
    };
    let before = t.snap();

    for signer in [&t.maker2, &t.holder] {
        t.env.mock_auths(&[MockAuth {
            address: signer,
            invoke: &cancel,
        }]);
        assert_host_abort(t.c.try_cancel_offer(&t.writer, &id));
        assert_eq!(t.snap(), before);
    }

    t.env.mock_auths(&[MockAuth {
        address: &t.writer,
        invoke: &cancel,
    }]);
    t.c.cancel_offer(&t.writer, &id);
    assert_eq!(t.state(id), State::Cancelled);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START);
}

#[test]
fn reclaim_and_claim_delivery_require_writer_signature() {
    let t = setup();
    let put = t.put(&t.writer);
    let sold = t.call(&t.writer);
    t.c.buy(&t.holder, &sold);
    t.c.exercise(&t.holder, &sold);
    t.at(EXPIRY);

    let reclaim = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "reclaim",
        args: (&t.writer, put).into_val(&t.env),
        sub_invokes: &[],
    };
    let claim = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "claim_delivery",
        args: (&t.writer, sold).into_val(&t.env),
        sub_invokes: &[],
    };
    let before = t.snap();

    t.env.mock_auths(&[MockAuth {
        address: &t.holder,
        invoke: &reclaim,
    }]);
    assert_host_abort(t.c.try_reclaim(&t.writer, &put));
    t.env.mock_auths(&[MockAuth {
        address: &t.holder,
        invoke: &claim,
    }]);
    assert_host_abort(t.c.try_claim_delivery(&t.writer, &sold));
    assert_eq!(t.snap(), before);

    t.env.mock_auths(&[
        MockAuth {
            address: &t.writer,
            invoke: &reclaim,
        },
        MockAuth {
            address: &t.writer,
            invoke: &claim,
        },
    ]);
    t.c.reclaim(&t.writer, &put);
    t.c.claim_delivery(&t.writer, &sold);
    assert_eq!(t.state(put), State::Expired);
    assert_eq!(t.state(sold), State::Settled);
}

// ---------------------------------------------------------------------------
// v1.1 hardening (ABI §10)
// ---------------------------------------------------------------------------

#[test]
fn error_codes_are_101_plus() {
    // Error codes are public ABI (ABI §2): 101.. so they never collide with SAC #1..#13.
    let codes = [
        (Error::NotFound, 101),
        (Error::InvalidArgs, 102),
        (Error::AssetNotAllowed, 103),
        (Error::NotEligible, 104),
        (Error::ContractNotAuthorized, 105),
        (Error::WrongState, 106),
        (Error::NotWriter, 107),
        (Error::NotHolder, 108),
        (Error::Expired, 109),
        (Error::NotExpired, 110),
        (Error::SelfTrade, 111),
        (Error::Overflow, 112),
        (Error::InvalidConfig, 113),
        (Error::OpenListFull, 114),
        (Error::CollateralShortfall, 115),
    ];
    for (e, code) in codes {
        assert_eq!(e as u32, code, "{e:?}");
    }
    assert_eq!(Error::NotFound as u32, 101);
    assert_eq!(Error::CollateralShortfall as u32, 115);
}

#[test]
fn create_offer_rejects_writer_deauthorized_on_quote() {
    let t = setup();
    // authorized and funded on RWA, nothing on USDx
    let w = Address::generate(&t.env);
    t.sac(&t.rwa).set_authorized(&w, &true);
    t.sac(&t.rwa).mint(&w, &UNDERLYING_START);
    assert!(t.c.is_eligible(&t.rwa, &w));
    // USDx has no flags, and a contract address with no USDx balance reads as
    // authorized, so the "cannot hold the quote token" case is built through the
    // issuer: with AUTH_REVOCABLE the SAC admin writes an explicit deauthorized
    // USDx balance for `w`. (A classic G account without a USDx trustline reads
    // the same way, SAC #13 -> false, but this env cannot create the RWA
    // trustline such an account would also need; that SAC-error branch is
    // covered by `is_eligible_false_for_g_account_without_trustline`.)
    assert!(t.c.is_eligible(&t.usdx, &w));
    t.usdx_flags.set_flag(IssuerFlags::RevocableFlag);
    t.sac(&t.usdx).set_authorized(&w, &false);
    assert!(!t.c.is_eligible(&t.usdx, &w));
    let before = t.snap();

    // CALL collateral is RWA, which `w` holds: only the quote check stops it
    for ty in [OptionType::Put, OptionType::Call] {
        assert_err(
            t.c.try_create_offer(&w, &t.rwa, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
            Error::NotEligible,
        );
    }
    // check order: writer eligibility (both tokens) before the contract's
    t.sac(&t.rwa).set_authorized(&t.contract, &false);
    assert_err(
        t.c.try_create_offer(
            &w,
            &t.rwa,
            &OptionType::Call,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::NotEligible,
    );
    t.sac(&t.rwa).set_authorized(&t.contract, &true);
    assert_eq!(t.snap(), before);
    assert_eq!(t.bal(&t.rwa, &w), UNDERLYING_START);
    assert_eq!(t.c.option_count(), 0);

    // once `w` may hold USDx again it can write, and receives the premium
    t.sac(&t.usdx).set_authorized(&w, &true);
    let id = t.c.create_offer(
        &w,
        &t.rwa,
        &OptionType::Call,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &EXPIRY,
    );
    t.c.buy(&t.holder, &id);
    assert_eq!(t.bal(&t.usdx, &w), PREMIUM);
    assert_eq!(t.state(id), State::Active);
}

#[test]
fn is_eligible_false_for_g_account_without_trustline() {
    let t = setup();
    // A classic G account with no trustline: the SAC's `authorized` fails with
    // SAC #13. `is_eligible` must map that error to `false` (ABI §3) instead of
    // trapping, so a writer like this gets `NotEligible` (#104) from
    // `create_offer`, not a raw SAC error.
    let g = Address::from_str(
        &t.env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    );
    assert!(matches!(
        t.sac(&t.usdx).try_authorized(&g),
        Err(Ok(e)) if e == soroban_sdk::Error::from_contract_error(SAC_NO_TRUSTLINE)
    ));
    assert!(!t.c.is_eligible(&t.usdx, &g));
    assert!(!t.c.is_eligible(&t.rwa, &g));
    assert!(!t.c.is_eligible(&t.bond, &g));
    // The asset's issuer account never holds a trustline, yet the SAC reports
    // it as authorized (ABI §3).
    assert!(t.c.is_eligible(&t.usdx, &t.usdx_flags.address()));
}

#[test]
fn buy_rejects_when_contract_deauthorized_after_offer() {
    let t = setup();
    let put = t.put(&t.writer);
    let call = t.call(&t.maker2);
    let bond = t.offer(&t.writer, &t.bond, OptionType::Put);

    // issuer de-authorizes the contract on RWA after the offers exist
    t.sac(&t.rwa).set_authorized(&t.contract, &false);
    assert!(!t.c.is_eligible(&t.rwa, &t.contract));
    let before = t.snap();

    assert_err(t.c.try_buy(&t.holder, &put), Error::ContractNotAuthorized);
    assert_err(t.c.try_buy(&t.holder, &call), Error::ContractNotAuthorized);
    // check order: SelfTrade and buyer NotEligible come first
    assert_err(t.c.try_buy(&t.writer, &put), Error::SelfTrade);
    assert_err(t.c.try_buy(&t.outsider, &put), Error::NotEligible);
    // no premium moved, nothing changed
    assert_eq!(t.snap(), before);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START);
    assert_eq!(t.state(put), State::Offered);
    assert_eq!(t.state(call), State::Offered);
    assert_eq!(t.open(), [put, call, bond]);

    // BOND offers are unaffected
    t.c.buy(&t.holder, &bond);
    assert_eq!(t.state(bond), State::Active);

    // re-authorization makes the RWA offers purchasable again
    t.sac(&t.rwa).set_authorized(&t.contract, &true);
    t.c.buy(&t.holder, &put);
    assert_eq!(t.state(put), State::Active);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - 2 * PREMIUM);
}

#[test]
fn shortfall_blocks_new_exposure_after_clawback() {
    let t = setup();
    let active_call = t.call(&t.writer);
    t.c.buy(&t.holder, &active_call);
    // two more RWA offers still Offered: a PUT (collateral USDx) and a CALL
    let offered_put = t.put(&t.maker2);
    let offered_call = t.call(&t.maker2);
    assert_eq!(t.bal(&t.rwa, &t.contract), 2 * QTY);

    // issuer claws 1 RWA back from the contract's pooled balance
    t.sac(&t.rwa).clawback(&t.contract, &UNIT);
    assert_eq!(t.bal(&t.rwa, &t.contract), 2 * QTY - UNIT);
    assert_eq!(t.c.open_collateral(&t.rwa), 2 * QTY);
    let before = t.snap();

    // no new exposure on RWA: neither new offers (CALL or PUT) nor purchases
    assert_err(
        t.c.try_create_offer(
            &t.maker2,
            &t.rwa,
            &OptionType::Call,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::CollateralShortfall,
    );
    assert_err(
        t.c.try_create_offer(
            &t.writer,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::CollateralShortfall,
    );
    assert_err(
        t.c.try_buy(&t.holder, &offered_put),
        Error::CollateralShortfall,
    );
    assert_err(
        t.c.try_buy(&t.holder, &offered_call),
        Error::CollateralShortfall,
    );
    // check order: every eligibility check comes before CollateralShortfall
    assert_err(
        t.c.try_create_offer(
            &t.outsider,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::NotEligible,
    );
    assert_err(t.c.try_buy(&t.outsider, &offered_put), Error::NotEligible);
    assert_err(t.c.try_buy(&t.maker2, &offered_put), Error::SelfTrade);
    t.sac(&t.rwa).set_authorized(&t.contract, &false);
    assert_err(
        t.c.try_buy(&t.holder, &offered_put),
        Error::ContractNotAuthorized,
    );
    t.sac(&t.rwa).set_authorized(&t.contract, &true);
    // no premium moved, no collateral pulled
    assert_eq!(t.snap(), before);

    // BOND has no deficit: offers and purchases still work
    let bond_call = t.offer(&t.writer, &t.bond, OptionType::Call);
    t.c.buy(&t.holder, &bond_call);
    assert_eq!(t.state(bond_call), State::Active);
    let bond_put = t.offer(&t.maker2, &t.bond, OptionType::Put);
    assert_eq!(t.state(bond_put), State::Offered);

    // existing RWA positions are not blocked by the guard
    t.c.cancel_offer(&t.maker2, &offered_call);
    assert_eq!(t.state(offered_call), State::Cancelled);
    assert_eq!(t.bal(&t.rwa, &t.contract), QTY - UNIT);
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);

    // the guard lifts once the pooled balance covers the reserve again
    t.sac(&t.rwa).mint(&t.contract, &UNIT);
    t.c.buy(&t.holder, &offered_put);
    assert_eq!(t.state(offered_put), State::Active);
    let id = t.call(&t.maker2);
    assert_eq!(t.state(id), State::Offered);
}

#[test]
fn shortfall_on_quote_blocks_every_underlying() {
    let t = setup();
    // USDx is unflagged in the demo; make it clawback-enabled before the
    // contract's USDx balance exists so the quote side of the guard can be hit
    t.usdx_flags.set_flag(IssuerFlags::RevocableFlag);
    t.usdx_flags.set_flag(IssuerFlags::ClawbackEnabledFlag);
    let _put = t.put(&t.writer);
    let bond_call = t.offer(&t.maker2, &t.bond, OptionType::Call);
    t.sac(&t.usdx).clawback(&t.contract, &UNIT);
    assert_eq!(t.bal(&t.usdx, &t.contract), STRIKE - UNIT);
    assert_eq!(t.c.open_collateral(&t.usdx), STRIKE);
    let before = t.snap();

    // every option shares the quote token, so a USDx deficit blocks BOND too
    for (token, ty) in [
        (&t.rwa, OptionType::Call),
        (&t.bond, OptionType::Put),
        (&t.bond, OptionType::Call),
    ] {
        assert_err(
            t.c.try_create_offer(&t.writer, token, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
            Error::CollateralShortfall,
        );
    }
    assert_err(
        t.c.try_buy(&t.holder, &bond_call),
        Error::CollateralShortfall,
    );
    assert_eq!(t.snap(), before);
}

// ---------------------------------------------------------------------------
// v1.2: holder transfer and paged reads (ABI §3, §11)
// ---------------------------------------------------------------------------

#[test]
fn transfer_active_option_changes_holder_and_emits_event() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    // an unrelated open offer, to show list_open is untouched
    let open = t.call(&t.writer);
    let before = t.snap();
    assert_eq!(before.open, [open]);

    t.c.transfer(&t.holder, &t.maker2, &id);
    assert_eq!(
        t.env.events().all().filter_by_contract(&t.contract),
        [OptionTransferred {
            id,
            from: t.holder.clone(),
            to: t.maker2.clone(),
        }
        .to_xdr(&t.env, &t.contract)]
    );

    // only the holder changed: no balance, reserved total, open list or count moved
    let mut expected = before.clone();
    expected.options[id as usize].holder = Some(t.maker2.clone());
    assert_eq!(t.snap(), expected);
    assert_eq!(t.state(id), State::Active);
    assert_eq!(t.holder_of(id), Some(t.maker2.clone()));
    assert_eq!(t.c.open_collateral(&t.usdx), before.open_usdx);
    assert_eq!(t.c.open_collateral(&t.rwa), before.open_rwa);
    assert_eq!(t.open(), before.open);

    // the previous holder can no longer exercise or transfer
    assert_err(t.c.try_exercise(&t.holder, &id), Error::NotHolder);
    assert_err(
        t.c.try_transfer(&t.holder, &t.maker2, &id),
        Error::NotHolder,
    );
    assert_eq!(t.snap(), expected);

    // the new holder exercises and receives the payout
    t.c.exercise(&t.maker2, &id);
    assert_eq!(t.state(id), State::Exercised);
    assert_eq!(t.holder_of(id), Some(t.maker2.clone()));
    assert_eq!(t.bal(&t.rwa, &t.maker2), UNDERLYING_START - QTY);
    assert_eq!(t.bal(&t.usdx, &t.maker2), USDX_START + STRIKE);
    // the original buyer paid the premium and nothing else
    assert_eq!(t.bals(&t.holder), before.holder);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM);
    // the delivered RWA waits in the contract for the writer, next to the open CALL's collateral
    assert_eq!(t.bal(&t.rwa, &t.contract), QTY + QTY);
    assert_eq!(t.c.open_collateral(&t.rwa), QTY + QTY);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    t.c.claim_delivery(&t.writer, &id);
    assert_eq!(t.state(id), State::Settled);
    // writer: -QTY RWA locked in the open CALL, +QTY RWA delivered by the new holder
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START);
}

#[test]
fn transfer_rejects_non_holder() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    let before = t.snap();

    // the writer cannot take or redirect the position
    assert_err(
        t.c.try_transfer(&t.writer, &t.maker2, &id),
        Error::NotHolder,
    );
    // nor can a third party, to anyone (including itself)
    assert_err(
        t.c.try_transfer(&t.maker2, &t.outsider, &id),
        Error::NotHolder,
    );
    assert_err(
        t.c.try_transfer(&t.maker2, &t.maker2, &id),
        Error::NotHolder,
    );
    assert_err(
        t.c.try_transfer(&t.outsider, &t.maker2, &id),
        Error::NotHolder,
    );
    // an unknown id comes first
    assert_err(t.c.try_transfer(&t.holder, &t.maker2, &9), Error::NotFound);
    assert_eq!(t.snap(), before);
    assert_eq!(t.holder_of(id), Some(t.holder.clone()));
}

#[test]
fn transfer_rejects_offered_and_terminal_states() {
    let t = setup();

    // Offered: holder is None, so the ownership check fails first
    let offered = t.put(&t.writer);
    let before = t.snap();
    assert_err(
        t.c.try_transfer(&t.holder, &t.maker2, &offered),
        Error::NotHolder,
    );
    assert_err(
        t.c.try_transfer(&t.writer, &t.maker2, &offered),
        Error::NotHolder,
    );
    assert_eq!(t.snap(), before);

    // Cancelled: holder is None as well
    t.c.cancel_offer(&t.writer, &offered);
    assert_err(
        t.c.try_transfer(&t.holder, &t.maker2, &offered),
        Error::NotHolder,
    );

    // Exercised and Settled: the holder is still recorded, the state check fails
    let exercised = t.put(&t.writer);
    t.c.buy(&t.holder, &exercised);
    t.c.exercise(&t.holder, &exercised);
    let before = t.snap();
    assert_err(
        t.c.try_transfer(&t.holder, &t.maker2, &exercised),
        Error::WrongState,
    );
    assert_eq!(t.snap(), before);
    t.c.claim_delivery(&t.writer, &exercised);
    assert_err(
        t.c.try_transfer(&t.holder, &t.maker2, &exercised),
        Error::WrongState,
    );

    // Expired after reclaim: state is checked before time, so WrongState (not Expired)
    let reclaimed = t.call(&t.writer);
    t.c.buy(&t.holder, &reclaimed);
    t.at(EXPIRY);
    t.c.reclaim(&t.writer, &reclaimed);
    let before = t.snap();
    assert_err(
        t.c.try_transfer(&t.holder, &t.maker2, &reclaimed),
        Error::WrongState,
    );
    assert_eq!(t.snap(), before);
    assert_eq!(t.holder_of(reclaimed), Some(t.holder.clone()));
}

#[test]
fn transfer_rejects_after_expiry() {
    let t = setup();
    let id = t.call(&t.writer);
    t.c.buy(&t.holder, &id);

    // one second before expiry (now < expiry) the transfer works
    t.at(EXPIRY - 1);
    t.c.transfer(&t.holder, &t.maker2, &id);
    assert_eq!(t.holder_of(id), Some(t.maker2.clone()));

    // at and after expiry it does not; time comes before the recipient checks
    for ts in [EXPIRY, EXPIRY + 86_400] {
        t.at(ts);
        let before = t.snap();
        assert_err(t.c.try_transfer(&t.maker2, &t.holder, &id), Error::Expired);
        assert_err(t.c.try_transfer(&t.maker2, &t.maker2, &id), Error::Expired);
        assert_err(t.c.try_transfer(&t.maker2, &t.writer, &id), Error::Expired);
        assert_err(
            t.c.try_transfer(&t.maker2, &t.outsider, &id),
            Error::Expired,
        );
        assert_eq!(t.snap(), before);
    }
    assert_eq!(t.state(id), State::Active);
    assert_eq!(t.holder_of(id), Some(t.maker2.clone()));

    // the writer reclaims as usual
    t.c.reclaim(&t.writer, &id);
    assert_eq!(t.state(id), State::Expired);
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START);
}

#[test]
fn transfer_rejects_to_self() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    let before = t.snap();

    assert_err(
        t.c.try_transfer(&t.holder, &t.holder, &id),
        Error::InvalidArgs,
    );
    assert!(t.env.events().all().events().is_empty());
    // checked before eligibility: a frozen holder still gets InvalidArgs
    t.sac(&t.rwa).set_authorized(&t.holder, &false);
    assert_err(
        t.c.try_transfer(&t.holder, &t.holder, &id),
        Error::InvalidArgs,
    );
    t.sac(&t.rwa).set_authorized(&t.holder, &true);
    assert_eq!(t.snap(), before);
}

#[test]
fn transfer_rejects_to_writer() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    let before = t.snap();

    // the writer may not hold its own option (same rule as buy)
    assert_err(
        t.c.try_transfer(&t.holder, &t.writer, &id),
        Error::SelfTrade,
    );
    // checked before eligibility: a frozen writer still gets SelfTrade
    t.sac(&t.rwa).set_authorized(&t.writer, &false);
    assert_err(
        t.c.try_transfer(&t.holder, &t.writer, &id),
        Error::SelfTrade,
    );
    t.sac(&t.rwa).set_authorized(&t.writer, &true);
    assert_eq!(t.snap(), before);
    assert_eq!(t.holder_of(id), Some(t.holder.clone()));
}

#[test]
fn transfer_rejects_ineligible_recipient() {
    let t = setup();
    let put = t.put(&t.writer);
    let bond_call = t.offer(&t.writer, &t.bond, OptionType::Call);
    t.c.buy(&t.holder, &put);
    t.c.buy(&t.holder, &bond_call);
    let before = t.snap();

    // outsider holds USDx but is not authorized on RWA or BOND
    assert_err(
        t.c.try_transfer(&t.holder, &t.outsider, &put),
        Error::NotEligible,
    );
    assert_err(
        t.c.try_transfer(&t.holder, &t.outsider, &bond_call),
        Error::NotEligible,
    );
    // an unknown account (no balance entry at all) is not eligible either
    let nobody = Address::generate(&t.env);
    assert_err(
        t.c.try_transfer(&t.holder, &nobody, &put),
        Error::NotEligible,
    );
    assert_eq!(t.snap(), before);

    // eligibility is per underlying and follows the issuer: a recipient frozen on RWA is
    // rejected for the RWA option but accepted for the BOND option
    t.sac(&t.rwa).set_authorized(&t.maker2, &false);
    assert_err(
        t.c.try_transfer(&t.holder, &t.maker2, &put),
        Error::NotEligible,
    );
    t.c.transfer(&t.holder, &t.maker2, &bond_call);
    assert_eq!(t.holder_of(bond_call), Some(t.maker2.clone()));
    // once the issuer authorizes the recipient again the RWA transfer goes through
    t.sac(&t.rwa).set_authorized(&t.maker2, &true);
    t.c.transfer(&t.holder, &t.maker2, &put);
    assert_eq!(t.holder_of(put), Some(t.maker2.clone()));
}

#[test]
fn transfer_requires_holder_auth() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    let transfer = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "transfer",
        args: (&t.holder, &t.maker2, id).into_val(&t.env),
        sub_invokes: &[],
    };
    let before = t.snap();

    // neither the recipient, the writer nor a third party can sign for the holder
    for signer in [&t.maker2, &t.writer, &t.outsider] {
        t.env.mock_auths(&[MockAuth {
            address: signer,
            invoke: &transfer,
        }]);
        assert_host_abort(t.c.try_transfer(&t.holder, &t.maker2, &id));
        assert_eq!(t.snap(), before);
    }

    // the holder's signature over (holder, to, id) is sufficient; no token sub-invocation
    t.env.mock_auths(&[MockAuth {
        address: &t.holder,
        invoke: &transfer,
    }]);
    t.c.transfer(&t.holder, &t.maker2, &id);
    assert_eq!(
        t.env.auths(),
        std::vec![(
            t.holder.clone(),
            leaf(contract_fn(
                &t,
                &t.contract,
                "transfer",
                (t.holder.clone(), t.maker2.clone(), id).into_val(&t.env)
            ))
        )]
    );
    assert_eq!(t.holder_of(id), Some(t.maker2.clone()));

    // the signature binds the recipient: maker2's signature for a transfer to the holder does
    // not authorize a transfer to the writer
    let back = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "transfer",
        args: (&t.maker2, &t.holder, id).into_val(&t.env),
        sub_invokes: &[],
    };
    t.env.mock_auths(&[MockAuth {
        address: &t.maker2,
        invoke: &back,
    }]);
    let before = t.snap();
    assert_host_abort(t.c.try_transfer(&t.maker2, &t.writer, &id));
    assert_eq!(t.snap(), before);
}

#[test]
fn transfer_then_frozen_old_holder_does_not_matter() {
    let t = setup();
    let put = t.put(&t.writer);
    let call = t.call(&t.writer);
    t.c.buy(&t.holder, &put);
    t.c.buy(&t.holder, &call);
    t.c.transfer(&t.holder, &t.maker2, &put);
    t.c.transfer(&t.holder, &t.maker2, &call);

    // the issuer freezes the previous holder on RWA after the transfers
    t.sac(&t.rwa).set_authorized(&t.holder, &false);
    assert!(!t.c.is_eligible(&t.rwa, &t.holder));
    let holder_before = t.bals(&t.holder);

    // the old holder is out either way (ownership is checked before any token movement)
    assert_err(t.c.try_exercise(&t.holder, &put), Error::NotHolder);
    assert_err(t.c.try_exercise(&t.holder, &call), Error::NotHolder);

    // the new holder exercises the PUT: delivers RWA, receives the strike
    t.c.exercise(&t.maker2, &put);
    assert_eq!(t.state(put), State::Exercised);
    assert_eq!(t.bal(&t.rwa, &t.maker2), UNDERLYING_START - QTY);
    assert_eq!(t.bal(&t.usdx, &t.maker2), USDX_START + STRIKE);

    // and the CALL: pays the strike, receives RWA
    t.c.exercise(&t.maker2, &call);
    assert_eq!(t.state(call), State::Exercised);
    assert_eq!(t.bal(&t.rwa, &t.maker2), UNDERLYING_START);
    assert_eq!(t.bal(&t.usdx, &t.maker2), USDX_START);

    // the frozen old holder was never touched
    assert_eq!(t.bals(&t.holder), holder_before);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - 2 * PREMIUM);
    // the writer's proceeds wait in the contract: RWA from the PUT, USDx from the CALL
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);
    assert_eq!(t.c.open_collateral(&t.usdx), STRIKE);
    assert_eq!(t.bal(&t.rwa, &t.contract), QTY);
    assert_eq!(t.bal(&t.usdx, &t.contract), STRIKE);
}

#[test]
fn get_options_pages_in_order() {
    let t = setup();
    let page_ids = |from: u32, limit: u32| -> std::vec::Vec<u32> {
        t.c.get_options(&from, &limit)
            .iter()
            .map(|o| o.id)
            .collect()
    };
    assert!(t.c.get_options(&0, &10).is_empty());

    // 7 options across writers, underlyings and types
    t.put(&t.writer);
    t.call(&t.writer);
    t.offer(&t.maker2, &t.bond, OptionType::Put);
    t.offer(&t.maker2, &t.bond, OptionType::Call);
    t.put(&t.maker2);
    t.call(&t.maker2);
    t.offer(&t.writer, &t.bond, OptionType::Put);
    assert_eq!(t.c.option_count(), 7);

    assert_eq!(page_ids(0, 3), [0, 1, 2]);
    assert_eq!(page_ids(3, 50), [3, 4, 5, 6]);
    assert!(page_ids(7, 10).is_empty());
    assert!(page_ids(2, 0).is_empty());
    assert!(page_ids(u32::MAX, 50).is_empty());
    assert_eq!(page_ids(6, u32::MAX), [6]);
    // pages hold exactly what get_option returns
    let all = t.c.get_options(&0, &50);
    assert_eq!(all.len(), 7);
    for (i, o) in all.iter().enumerate() {
        assert_eq!(o, t.c.get_option(&(i as u32)));
    }

    // 60 options: one call returns at most MAX_PAGE = 50 (spread over two
    // writers, each below the v1.3 per-writer cap of 50 open offers)
    for i in 7..60 {
        let w = if i % 2 == 0 { &t.writer } else { &t.maker2 };
        t.c.create_offer(w, &t.rwa, &OptionType::Put, &1, &1, &1, &EXPIRY);
    }
    assert_eq!(t.c.option_count(), 60);
    assert_eq!(MAX_PAGE, 50);
    assert_eq!(page_ids(0, 1000), (0..50).collect::<std::vec::Vec<u32>>());
    assert_eq!(page_ids(50, 1000), (50..60).collect::<std::vec::Vec<u32>>());
    assert_eq!(page_ids(55, 50), [55, 56, 57, 58, 59]);
    assert!(page_ids(60, 1000).is_empty());

    // paging with from += len visits every id exactly once
    let mut seen = std::vec::Vec::new();
    let mut from = 0;
    loop {
        let page = t.c.get_options(&from, &7);
        if page.is_empty() {
            break;
        }
        from += page.len();
        seen.extend(page.iter().map(|o| o.id));
    }
    assert_eq!(seen, (0..60).collect::<std::vec::Vec<u32>>());
}

#[test]
fn get_options_reflects_state_changes() {
    let t = setup();
    let a = t.put(&t.writer);
    let b = t.call(&t.maker2);
    let c = t.offer(&t.writer, &t.bond, OptionType::Put);
    let page = |from: u32| t.c.get_options(&from, &MAX_PAGE);

    assert_eq!(
        page(0),
        vec![
            &t.env,
            expected_option(&t, a, &t.rwa, OptionType::Put, &t.writer),
            expected_option(&t, b, &t.rwa, OptionType::Call, &t.maker2),
            expected_option(&t, c, &t.bond, OptionType::Put, &t.writer),
        ]
    );

    t.c.buy(&t.holder, &a);
    let p = page(0);
    assert_eq!(p.get_unchecked(0).state, State::Active);
    assert_eq!(p.get_unchecked(0).holder, Some(t.holder.clone()));
    assert_eq!(p.get_unchecked(1).state, State::Offered);

    t.c.transfer(&t.holder, &t.maker2, &a);
    assert_eq!(page(0).get_unchecked(0).holder, Some(t.maker2.clone()));

    t.c.exercise(&t.maker2, &a);
    t.c.cancel_offer(&t.maker2, &b);
    let p = page(0);
    assert_eq!(p.get_unchecked(0).state, State::Exercised);
    assert_eq!(p.get_unchecked(0).holder, Some(t.maker2.clone()));
    assert_eq!(p.get_unchecked(1).state, State::Cancelled);
    assert_eq!(p.get_unchecked(1).holder, None);
    assert_eq!(p.get_unchecked(2).state, State::Offered);
    // every paged copy equals get_option
    for (i, o) in p.iter().enumerate() {
        assert_eq!(o, t.c.get_option(&(i as u32)));
    }
    assert_eq!(page(1).get_unchecked(0), t.c.get_option(&b));

    // a pure read: no TTL is extended even when entries are below the threshold
    let seq = t.env.ledger().sequence();
    t.env.ledger().set_sequence_number(seq + 25 * DAY);
    let ttls = |ids: [u32; 3]| ids.map(|id| t.option_ttl(id));
    let before = ttls([a, b, c]);
    let instance = t.instance_ttl();
    assert!(before.iter().all(|&ttl| ttl < 7 * DAY), "{before:?}");
    assert_eq!(page(0).len(), 3);
    assert_eq!(ttls([a, b, c]), before);
    assert_eq!(t.instance_ttl(), instance);
}

// ---------------------------------------------------------------------------
// Per-call TTL extension and exercise transfer order (found by mutation testing)
// ---------------------------------------------------------------------------

/// Ages the ledger 25 days so every entry written at setup is below the 7-day
/// extension threshold (ABI §8), and checks that precondition on the instance.
fn age_below_ttl_threshold(t: &T) {
    let seq = t.env.ledger().sequence();
    t.env.ledger().set_sequence_number(seq + 25 * DAY);
    assert!(
        t.instance_ttl() < 7 * DAY,
        "precondition: instance TTL {}",
        t.instance_ttl()
    );
}

/// The call under test extended the instance, the contract code and option `id`
/// back to about TTL_EXTEND_TO = 30 days (ABI §8).
#[track_caller]
fn assert_ttls_extended(t: &T, id: u32) {
    assert!(
        t.instance_ttl() >= 29 * DAY,
        "instance TTL {}",
        t.instance_ttl()
    );
    assert!(
        t.env.deployer().get_contract_code_ttl(&t.contract) >= 29 * DAY,
        "code TTL {}",
        t.env.deployer().get_contract_code_ttl(&t.contract)
    );
    assert!(
        t.option_ttl(id) >= 29 * DAY,
        "option TTL {}",
        t.option_ttl(id)
    );
}

#[test]
fn constructor_extends_instance_and_code_ttl() {
    let t = setup();
    assert!(
        t.instance_ttl() >= 29 * DAY,
        "instance TTL {}",
        t.instance_ttl()
    );
    assert!(
        t.env.deployer().get_contract_code_ttl(&t.contract) >= 29 * DAY,
        "code TTL {}",
        t.env.deployer().get_contract_code_ttl(&t.contract)
    );
}

#[test]
fn create_offer_extends_ttls() {
    let t = setup();
    age_below_ttl_threshold(&t);
    let id = t.put(&t.writer);
    assert_ttls_extended(&t, id);
}

#[test]
fn buy_extends_ttls() {
    let t = setup();
    let id = t.put(&t.writer);
    age_below_ttl_threshold(&t);
    t.c.buy(&t.holder, &id);
    assert_ttls_extended(&t, id);
}

#[test]
fn exercise_extends_ttls() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    age_below_ttl_threshold(&t);
    t.c.exercise(&t.holder, &id);
    assert_ttls_extended(&t, id);
}

#[test]
fn cancel_offer_extends_ttls() {
    let t = setup();
    let id = t.call(&t.writer);
    age_below_ttl_threshold(&t);
    t.c.cancel_offer(&t.writer, &id);
    assert_ttls_extended(&t, id);
}

#[test]
fn reclaim_extends_ttls() {
    let t = setup();
    let id = t.put(&t.writer);
    t.at(EXPIRY);
    age_below_ttl_threshold(&t);
    t.c.reclaim(&t.writer, &id);
    assert_ttls_extended(&t, id);
}

#[test]
fn claim_delivery_extends_ttls() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    t.c.exercise(&t.holder, &id);
    age_below_ttl_threshold(&t);
    t.c.claim_delivery(&t.writer, &id);
    assert_ttls_extended(&t, id);
}

#[test]
fn transfer_extends_ttls() {
    let t = setup();
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    // ageing moves the ledger sequence only, so the option is still before expiry
    age_below_ttl_threshold(&t);
    t.c.transfer(&t.holder, &t.maker2, &id);
    assert_ttls_extended(&t, id);
}

/// Index, within the most recent invocation's events, of the single event the
/// SAC `sac` emitted.
fn sac_event_pos(t: &T, sac: &Address) -> usize {
    let all = t.env.events().all();
    let mine = all.filter_by_contract(sac);
    assert_eq!(
        mine.events().len(),
        1,
        "expected exactly one transfer event from the SAC"
    );
    let target = mine.events()[0].clone();
    all.events().iter().position(|e| *e == target).unwrap()
}

/// ABI §3 `exercise`: the holder pays into the contract first, then the
/// contract pays the holder.
#[test]
fn exercise_transfer_order_matches_abi() {
    let t = setup();
    let put = t.put(&t.writer);
    t.c.buy(&t.holder, &put);
    t.c.exercise(&t.holder, &put);
    // PUT: underlying holder -> contract, then quote contract -> holder
    assert!(sac_event_pos(&t, &t.rwa) < sac_event_pos(&t, &t.usdx));

    let call = t.call(&t.writer);
    t.c.buy(&t.holder, &call);
    t.c.exercise(&t.holder, &call);
    // CALL: quote holder -> contract, then underlying contract -> holder
    assert!(sac_event_pos(&t, &t.usdx) < sac_event_pos(&t, &t.rwa));
}

/// White-box: the defensive `next < 0` guard in `sub_reserved` (unreachable
/// through the ABI). A corrupted reserve makes the release fail atomically.
/// Since v1.3.1 `Key::Reserved(token)` is a persistent entry (ABI §8, §13.8).
#[test]
fn sub_reserved_rejects_negative_result_on_corrupted_reserve() {
    let t = setup();
    let id = t.put(&t.writer);
    t.env.as_contract(&t.contract, || {
        t.env
            .storage()
            .persistent()
            .set(&Key::Reserved(t.usdx.clone()), &0i128)
    });
    let before = t.snap();
    assert_err(t.c.try_cancel_offer(&t.writer, &id), Error::Overflow);
    assert_eq!(t.snap(), before);
}

// ---------------------------------------------------------------------------
// v1.3: permissionless listing, per-writer cap, tenor cap, prune_expired and
// the contract-address backstop (ABI §2, §3, §5, §8, §12)
// ---------------------------------------------------------------------------

fn s(t: &T, v: &str) -> String {
    String::from_str(&t.env, v)
}

/// `(code, issuer)` of a classic-asset SAC, parsed from its SEP-41 `name()`,
/// which the SAC reports as `CODE:ISSUER`.
fn code_and_issuer(t: &T, sac: &Address) -> (String, Address) {
    let name = TokenClient::new(&t.env, sac).name().to_string();
    let (code, issuer) = name.split_once(':').expect("SAC name is CODE:ISSUER");
    (s(t, code), Address::from_str(&t.env, issuer))
}

/// A classic asset whose SAC is deployed but NOT listed: code "aaa" from a
/// fresh `G…` issuer account (what `register_stellar_asset_contract_v2` issues),
/// SAC admin = the regulated issuer. `regulated` sets AUTH_REQUIRED |
/// AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED before any balance exists, like RWA/BOND.
fn new_asset(t: &T, regulated: bool) -> (Address, String, Address) {
    let sac = t
        .env
        .register_stellar_asset_contract_v2(t.rwa_issuer.clone());
    if regulated {
        let issuer = sac.issuer();
        issuer.set_flag(IssuerFlags::RequiredFlag);
        issuer.set_flag(IssuerFlags::RevocableFlag);
        issuer.set_flag(IssuerFlags::ClawbackEnabledFlag);
    }
    let (code, issuer) = code_and_issuer(t, &sac.address());
    assert_eq!(issuer, sac.issuer().address());
    (sac.address(), code, issuer)
}

/// A classic `G…` account address with the given ed25519 key (no ledger entry).
fn g_account(env: &Env, key: [u8; 32]) -> Address {
    use soroban_sdk::xdr::{AccountId, PublicKey, ScAddress, Uint256};
    Address::try_from_val(
        env,
        &ScAddress::Account(AccountId(PublicKey::PublicKeyTypeEd25519(Uint256(key)))),
    )
    .unwrap()
}

/// Deploys the SAC of the classic asset `(code, G(issuer_key))`, as
/// `stellar contract asset deploy` does, and returns its address.
fn deploy_classic_sac(env: &Env, code: &str, issuer_key: [u8; 32]) -> Address {
    env.deployer()
        .with_stellar_asset(classic_asset_xdr(env, code, issuer_key))
        .deploy()
}

/// The canonical SAC address of the classic asset `(code, G(issuer_key))`
/// WITHOUT deploying it.
fn classic_sac_address(env: &Env, code: &str, issuer_key: [u8; 32]) -> Address {
    env.deployer()
        .with_stellar_asset(classic_asset_xdr(env, code, issuer_key))
        .deployed_address()
}

/// `Asset` XDR of the classic asset `(code, G(issuer_key))`. Codes of 1–4
/// characters are CreditAlphanum4, 5–12 CreditAlphanum12 (zero padded).
fn classic_asset_xdr(env: &Env, code: &str, issuer_key: [u8; 32]) -> Bytes {
    use soroban_sdk::xdr::{
        AccountId, AlphaNum12, AlphaNum4, Asset, AssetCode12, AssetCode4, Limits, PublicKey,
        Uint256, WriteXdr,
    };
    let issuer = AccountId(PublicKey::PublicKeyTypeEd25519(Uint256(issuer_key)));
    let b = code.as_bytes();
    let asset = if b.len() <= 4 {
        let mut c = [0u8; 4];
        c[..b.len()].copy_from_slice(b);
        Asset::CreditAlphanum4(AlphaNum4 {
            asset_code: AssetCode4(c),
            issuer,
        })
    } else {
        let mut c = [0u8; 12];
        c[..b.len()].copy_from_slice(b);
        Asset::CreditAlphanum12(AlphaNum12 {
            asset_code: AssetCode12(c),
            issuer,
        })
    };
    Bytes::from_slice(env, &asset.to_xdr(Limits::none()).unwrap())
}

fn sym(name: &str) -> soroban_sdk::xdr::ScVal {
    soroban_sdk::xdr::ScVal::Symbol(soroban_sdk::xdr::ScSymbol(name.try_into().unwrap()))
}

/// The `OfferPruned` events of the most recent invocation as `(id, pruner)`,
/// in emission order. Each event must be exactly
/// `OfferPruned { id, pruner }.to_xdr(..)` (topics `["offer_pruned", id]`,
/// data `{pruner}`). Since v1.3.1 `pruner` is the authenticated caller of
/// `prune_expired(pruner, ids)` (ABI §3, §13.1); callers assert it.
fn pruned_events(t: &T) -> std::vec::Vec<(u32, Address)> {
    use soroban_sdk::xdr::{ContractEventBody, ScVal};
    let all = t.env.events().all().filter_by_contract(&t.contract);
    all.events()
        .iter()
        .map(|ev| {
            let ContractEventBody::V0(body) = &ev.body;
            assert_eq!(body.topics.len(), 2, "OfferPruned topics: {ev:?}");
            assert_eq!(body.topics[0], sym("offer_pruned"), "{ev:?}");
            let id = match &body.topics[1] {
                ScVal::U32(id) => *id,
                other => panic!("OfferPruned id topic: {other:?}"),
            };
            let pruner = match &body.data {
                ScVal::Map(Some(map)) => map
                    .iter()
                    .find(|e| e.key == sym("pruner"))
                    .map(|e| Address::try_from_val(&t.env, &e.val).unwrap())
                    .expect("OfferPruned has a pruner field"),
                other => panic!("OfferPruned data: {other:?}"),
            };
            assert_eq!(
                *ev,
                OfferPruned {
                    id,
                    pruner: pruner.clone()
                }
                .to_xdr(&t.env, &t.contract)
            );
            (id, pruner)
        })
        .collect()
}

/// The ids pruned by the most recent invocation, which must have been made by
/// the fixture's `t.pruner`: every event carries that address.
fn pruned_ids(t: &T) -> std::vec::Vec<u32> {
    pruned_events(t)
        .into_iter()
        .map(|(id, pruner)| {
            assert_eq!(pruner, t.pruner, "OfferPruned.pruner of id {id}");
            id
        })
        .collect()
}

fn listed_assets(t: &T) -> std::vec::Vec<Address> {
    t.c.list_assets(&0, &MAX_PAGE).iter().collect()
}

/// Raw persistent TTL of a v1.3 storage entry through its ABI §8 key shape
/// `Key::<variant>(arg)` = ScVal vec [Symbol(variant), arg].
fn key_ttl(t: &T, variant: &str, arg: Val) -> u32 {
    let key: Vec<Val> = vec![&t.env, Symbol::new(&t.env, variant).into_val(&t.env), arg];
    t.env
        .as_contract(&t.contract, || t.env.storage().persistent().get_ttl(&key))
}

#[test]
fn error_codes_v13_append_116_to_119() {
    for (e, code) in [
        (Error::WriterOpenLimit, 116),
        (Error::AlreadyListed, 117),
        (Error::AssetNotDeployed, 118),
        (Error::TenorOutOfRange, 119),
    ] {
        assert_eq!(e as u32, code, "{e:?}");
    }
    // the v1.1 codes did not move
    assert_eq!(Error::NotFound as u32, 101);
    assert_eq!(Error::CollateralShortfall as u32, 115);
}

#[test]
fn constructor_seeds_registry() {
    let t = setup();
    assert!(t.c.is_listed(&t.rwa));
    assert!(t.c.is_listed(&t.bond));
    // the quote token, a deployed but unlisted SAC and a random address are not listed
    assert!(!t.c.is_listed(&t.usdx));
    let (unlisted, _, _) = new_asset(&t, true);
    assert!(!t.c.is_listed(&unlisted));
    assert!(!t.c.is_listed(&Address::generate(&t.env)));
    assert_eq!(t.c.asset_count(), 2);
    assert_eq!(listed_assets(&t), [t.rwa.clone(), t.bond.clone()]);
    // config() keeps its constructor-time meaning and matches the seeded registry
    assert_eq!(t.c.config().underlyings, t.c.list_assets(&0, &MAX_PAGE));

    // a maximal allowlist (8) is seeded in constructor order
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let quote = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let mut many: Vec<Address> = Vec::new(&env);
    for _ in 0..8 {
        many.push_back(
            env.register_stellar_asset_contract_v2(admin.clone())
                .address(),
        );
    }
    let id = env.register(OptionsContract, (quote.clone(), many.clone()));
    let c = OptionsContractClient::new(&env, &id);
    assert_eq!(c.asset_count(), 8);
    assert_eq!(c.list_assets(&0, &MAX_PAGE), many);
    for a in many.iter() {
        assert!(c.is_listed(&a));
    }
    assert!(!c.is_listed(&quote));
}

#[test]
fn list_asset_registers_canonical_sac() {
    let t = setup();
    // a 4th SAC in the test env
    let sac = t
        .env
        .register_stellar_asset_contract_v2(t.rwa_issuer.clone());
    let (code, issuer) = code_and_issuer(&t, &sac.address());
    assert_eq!(code, s(&t, "aaa"));
    assert_eq!(issuer, sac.issuer().address());
    assert!(!t.c.is_listed(&sac.address()));
    assert_eq!(t.c.asset_count(), 2);
    let before = t.snap();

    // anyone may list: here a party with no role on the asset
    let listed = t.c.list_asset(&t.outsider, &code, &issuer);
    assert_eq!(
        t.env.events().all().filter_by_contract(&t.contract),
        [AssetListed {
            sac: sac.address(),
            code: code.clone(),
            issuer: issuer.clone(),
            lister: t.outsider.clone(),
        }
        .to_xdr(&t.env, &t.contract)]
    );
    // the address is derived on chain from (code, issuer), not supplied, and
    // is the deployed SAC
    assert_eq!(listed, sac.address());
    assert!(t.c.is_listed(&sac.address()));
    assert_eq!(t.c.asset_count(), 3);
    assert_eq!(
        listed_assets(&t),
        [t.rwa.clone(), t.bond.clone(), sac.address()]
    );
    // config() stays the constructor-time list
    assert_eq!(
        t.c.config().underlyings,
        vec![&t.env, t.rwa.clone(), t.bond.clone()]
    );
    // listing moves no tokens and touches no option, reserve or open list
    assert_eq!(t.snap(), before);
    assert_eq!(t.bal(&sac.address(), &t.contract), 0);
    assert_eq!(t.c.open_collateral(&sac.address()), 0);

    // the next listing is appended last
    let (other, code2, issuer2) = new_asset(&t, false);
    assert_eq!(t.c.list_asset(&t.writer, &code2, &issuer2), other);
    assert_eq!(t.c.asset_count(), 4);
    assert_eq!(listed_assets(&t).last(), Some(&other));
    assert_eq!(
        t.c.list_assets(&2, &MAX_PAGE),
        vec![&t.env, sac.address(), other]
    );
}

#[test]
fn list_asset_derives_alphanum4_and_alphanum12_sacs() {
    let t = setup();
    let key = [7u8; 32];
    let issuer = g_account(&t.env, key);
    // 1–4 characters are CreditAlphanum4, 5–12 CreditAlphanum12; codes are
    // case-sensitive and a shorter code is a different asset
    let codes = [
        "A",
        "Ab9",
        "ABC",
        "ABCD",
        "ABCDE",
        "EQTY2026",
        "abcdefghijk",
        "ABCDEFGHIJKL",
    ];
    let mut expected = listed_assets(&t);
    for code in codes {
        let sac = deploy_classic_sac(&t.env, code, key);
        // the deployed SAC reports exactly this asset
        assert_eq!(
            code_and_issuer(&t, &sac),
            (s(&t, code), issuer.clone()),
            "{code}"
        );
        assert!(!t.c.is_listed(&sac), "{code}");
        assert_eq!(
            t.c.list_asset(&t.maker2, &s(&t, code), &issuer),
            sac,
            "{code}"
        );
        assert!(t.c.is_listed(&sac), "{code}");
        expected.push(sac);
    }
    // the same code from another issuer is another asset
    let other = deploy_classic_sac(&t.env, "ABCD", [8u8; 32]);
    assert_eq!(
        t.c.list_asset(&t.maker2, &s(&t, "ABCD"), &g_account(&t.env, [8u8; 32])),
        other
    );
    expected.push(other);
    assert_eq!(t.c.asset_count(), expected.len() as u32);
    assert_eq!(listed_assets(&t), expected);
}

#[test]
fn list_asset_then_put_on_new_asset_settles() {
    let t = setup();
    let (eqty, code, issuer) = new_asset(&t, true);
    assert_eq!(t.c.list_asset(&t.maker2, &code, &issuer), eqty);

    // the issuer authorizes the escrow and both counterparties on its asset
    let admin = t.sac(&eqty);
    admin.set_authorized(&t.contract, &true);
    admin.set_authorized(&t.writer, &true);
    admin.set_authorized(&t.holder, &true);
    admin.mint(&t.holder, &UNDERLYING_START);
    let rwa_bond_before = (t.bals(&t.writer), t.bals(&t.holder), t.bals(&t.contract));

    // create: the writer locks the total strike in USDx
    let id = t.offer(&t.writer, &eqty, OptionType::Put);
    assert_eq!(
        t.c.get_option(&id),
        expected_option(&t, id, &eqty, OptionType::Put, &t.writer)
    );
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START - STRIKE);
    assert_eq!(t.bal(&t.usdx, &t.contract), STRIKE);
    assert_eq!(t.c.open_collateral(&t.usdx), STRIKE);
    assert_eq!(t.c.open_collateral(&eqty), 0);
    assert_eq!(t.open(), [id]);
    assert_eq!(t.c.writer_open_count(&t.writer), 1);

    // buy: premium buyer -> writer
    t.c.buy(&t.holder, &id);
    assert_eq!(t.state(id), State::Active);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START - STRIKE + PREMIUM);
    assert!(t.open().is_empty());
    assert_eq!(t.c.writer_open_count(&t.writer), 0);

    // exercise: the holder delivers the new asset to the contract and is paid
    t.c.exercise(&t.holder, &id);
    assert_eq!(t.state(id), State::Exercised);
    assert_eq!(t.bal(&eqty, &t.holder), UNDERLYING_START - QTY);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM + STRIKE);
    assert_eq!(t.bal(&eqty, &t.contract), QTY);
    assert_eq!(t.bal(&t.usdx, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&eqty), QTY);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);

    // claim: the writer pulls the delivered asset
    t.c.claim_delivery(&t.writer, &id);
    assert_eq!(t.state(id), State::Settled);
    assert_eq!(t.bal(&eqty, &t.writer), QTY);
    assert_eq!(t.bal(&eqty, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&eqty), 0);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START - STRIKE + PREMIUM);
    // RWA and BOND were never touched
    let (w, h, c) = rwa_bond_before;
    assert_eq!(
        (t.bal(&t.rwa, &t.writer), t.bal(&t.bond, &t.writer)),
        (w.rwa, w.bond)
    );
    assert_eq!(
        (t.bal(&t.rwa, &t.holder), t.bal(&t.bond, &t.holder)),
        (h.rwa, h.bond)
    );
    assert_eq!(
        (t.bal(&t.rwa, &t.contract), t.bal(&t.bond, &t.contract)),
        (c.rwa, c.bond)
    );
}

#[test]
fn list_asset_rejects_bad_code() {
    let t = setup();
    let (sac, code, issuer) = new_asset(&t, true);
    let before = t.snap();

    for bad in [
        "",
        "ABCDEFGHIJKLM", // 13 characters
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "AB-C",
        "A B",
        " aaa",
        "AB_C",
        "aaa:",
        "a.b",
        "aaa\0",    // must not be read as the zero-padded "aaa"
        "\u{c4}BC", // non-ASCII letter
        "\u{20ac}",
    ] {
        assert_err(
            t.c.try_list_asset(&t.writer, &s(&t, bad), &issuer),
            Error::InvalidArgs,
        );
    }
    // the 1- and 12-character boundaries pass validation and reach the
    // deployment probe (no SAC exists for these codes)
    for edge in ["Z", "ABCDEFGHIJKL"] {
        assert_err(
            t.c.try_list_asset(&t.writer, &s(&t, edge), &issuer),
            Error::AssetNotDeployed,
        );
    }
    assert!(!t.c.is_listed(&sac));
    assert_eq!(t.c.asset_count(), 2);
    assert_eq!(t.snap(), before);

    // control: the genuine code lists
    assert_eq!(t.c.list_asset(&t.writer, &code, &issuer), sac);
}

#[test]
fn list_asset_rejects_contract_issuer() {
    let t = setup();
    let (sac, code, _issuer) = new_asset(&t, true);
    let before = t.snap();

    // `C…` addresses (this contract, SACs, an arbitrary contract) are never issuers
    for issuer in [
        t.contract.clone(),
        t.usdx.clone(),
        t.rwa.clone(),
        sac.clone(),
        Address::generate(&t.env),
    ] {
        assert_err(
            t.c.try_list_asset(&t.writer, &code, &issuer),
            Error::InvalidArgs,
        );
    }
    assert!(!t.c.is_listed(&sac));
    assert_eq!(t.c.asset_count(), 2);
    assert_eq!(t.snap(), before);
}

#[test]
fn list_asset_rejects_undeployed() {
    let t = setup();
    let key = [9u8; 32];
    let stranger = g_account(&t.env, key);
    let (_, _, issuer) = new_asset(&t, true);
    let before = t.snap();

    // a random code and issuer
    for code in ["ZZZ", "EQTY", "LONGERCODE12"] {
        assert_err(
            t.c.try_list_asset(&t.writer, &s(&t, code), &stranger),
            Error::AssetNotDeployed,
        );
    }
    // an issuer with a deployed SAC, but not for this code (codes are case-sensitive)
    for code in ["bbb", "AAA", "aaaa"] {
        assert_err(
            t.c.try_list_asset(&t.writer, &s(&t, code), &issuer),
            Error::AssetNotDeployed,
        );
    }
    assert_eq!(t.c.asset_count(), 2);
    assert_eq!(t.snap(), before);

    // deploying the SAC (anyone can) is the only prerequisite
    let zzz = deploy_classic_sac(&t.env, "ZZZ", key);
    assert!(!t.c.is_listed(&zzz));
    assert_eq!(t.c.list_asset(&t.writer, &s(&t, "ZZZ"), &stranger), zzz);
    assert!(t.c.is_listed(&zzz));
    assert_eq!(t.c.asset_count(), 3);
}

#[test]
fn list_asset_rejects_duplicate_and_quote() {
    let t = setup();
    let before = t.snap();

    // the constructor underlyings are already listed
    for token in [&t.rwa, &t.bond] {
        let (code, issuer) = code_and_issuer(&t, token);
        assert_err(
            t.c.try_list_asset(&t.maker2, &code, &issuer),
            Error::AlreadyListed,
        );
    }
    // the quote token can never become an underlying
    let (code, issuer) = code_and_issuer(&t, &t.usdx);
    assert_err(
        t.c.try_list_asset(&t.maker2, &code, &issuer),
        Error::AlreadyListed,
    );
    assert!(!t.c.is_listed(&t.usdx));
    assert_eq!(t.c.asset_count(), 2);
    assert_eq!(listed_assets(&t), [t.rwa.clone(), t.bond.clone()]);
    assert_eq!(t.snap(), before);

    // a listed asset cannot be listed again, by anyone
    let (sac, code, issuer) = new_asset(&t, false);
    assert_eq!(t.c.list_asset(&t.writer, &code, &issuer), sac);
    for lister in [&t.writer, &t.maker2] {
        assert_err(
            t.c.try_list_asset(lister, &code, &issuer),
            Error::AlreadyListed,
        );
    }
    assert_eq!(t.c.asset_count(), 3);
    assert_eq!(
        listed_assets(&t),
        [t.rwa.clone(), t.bond.clone(), sac.clone()]
    );
}

#[test]
fn list_asset_requires_lister_auth() {
    let t = setup();
    let (sac, code, issuer) = new_asset(&t, true);
    let invoke = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "list_asset",
        args: (&t.writer, code.clone(), &issuer).into_val(&t.env),
        sub_invokes: &[],
    };
    let before = t.snap();

    // maker2 cannot list in the writer's name
    t.env.mock_auths(&[MockAuth {
        address: &t.maker2,
        invoke: &invoke,
    }]);
    assert_host_abort(t.c.try_list_asset(&t.writer, &code, &issuer));
    // nor can anyone with no signature at all
    t.env.set_auths(&[]);
    assert_host_abort(t.c.try_list_asset(&t.writer, &code, &issuer));
    assert!(!t.c.is_listed(&sac));
    assert_eq!(t.c.asset_count(), 2);
    assert_eq!(t.snap(), before);

    // the lister's own signature over list_asset, and nothing else, is enough
    t.env.mock_auths(&[MockAuth {
        address: &t.writer,
        invoke: &invoke,
    }]);
    assert_eq!(t.c.list_asset(&t.writer, &code, &issuer), sac);
    assert!(t.c.is_listed(&sac));

    // the recorded auth tree is exactly the lister over list_asset
    t.env.mock_all_auths();
    let (sac2, code2, issuer2) = new_asset(&t, true);
    assert_eq!(t.c.list_asset(&t.maker2, &code2, &issuer2), sac2);
    assert_eq!(
        t.env.auths(),
        std::vec![(
            t.maker2.clone(),
            leaf(contract_fn(
                &t,
                &t.contract,
                "list_asset",
                (t.maker2.clone(), code2.clone(), issuer2.clone()).into_val(&t.env),
            ))
        )]
    );
}

#[test]
fn list_asset_does_not_authorize() {
    let t = setup();
    let (eqty, code, issuer) = new_asset(&t, true);
    t.c.list_asset(&t.writer, &code, &issuer);
    let admin = t.sac(&eqty);
    for who in [&t.writer, &t.holder] {
        admin.set_authorized(who, &true);
        admin.mint(who, &UNDERLYING_START);
    }
    assert!(t.c.is_listed(&eqty));
    assert!(!t.c.is_eligible(&eqty, &t.contract));
    let before = t.snap();

    // listed, but the issuer has not authorized the escrow
    for ty in [OptionType::Put, OptionType::Call] {
        assert_err(
            t.c.try_create_offer(&t.writer, &eqty, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
            Error::ContractNotAuthorized,
        );
    }
    // nor a counterparty: maker2 holds no authorization on the new asset
    assert_err(
        t.c.try_create_offer(
            &t.maker2,
            &eqty,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::NotEligible,
    );
    assert_eq!(t.snap(), before);
    assert_eq!(t.bal(&eqty, &t.contract), 0);
    assert_eq!(t.c.option_count(), 0);

    // only the issuer's authorization of the escrow unlocks the asset
    admin.set_authorized(&t.contract, &true);
    let id = t.offer(&t.writer, &eqty, OptionType::Call);
    assert_eq!(t.bal(&eqty, &t.contract), QTY);
    assert_eq!(t.bal(&eqty, &t.writer), UNDERLYING_START - QTY);
    assert_eq!(t.c.open_collateral(&eqty), QTY);
    assert_eq!(t.open(), [id]);
}

#[test]
fn create_offer_rejects_unlisted_random_sac() {
    let t = setup();
    // a real SAC, fully authorized by its issuer, but never listed
    let (eqty, code, issuer) = new_asset(&t, true);
    let admin = t.sac(&eqty);
    admin.set_authorized(&t.contract, &true);
    admin.set_authorized(&t.writer, &true);
    admin.mint(&t.writer, &UNDERLYING_START);
    // and a deployed SAC of an unrelated classic asset
    let random = deploy_classic_sac(&t.env, "RANDOM12CODE", [3u8; 32]);
    let before = t.snap();

    for token in [&eqty, &random] {
        for ty in [OptionType::Put, OptionType::Call] {
            assert_err(
                t.c.try_create_offer(&t.writer, token, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
                Error::AssetNotAllowed,
            );
        }
        assert!(!t.c.is_listed(token));
    }
    // check order: AssetNotAllowed before InvalidArgs and TenorOutOfRange
    assert_err(
        t.c.try_create_offer(&t.writer, &eqty, &OptionType::Put, &0, &0, &0, &u64::MAX),
        Error::AssetNotAllowed,
    );
    assert_eq!(t.snap(), before);
    assert_eq!(t.bal(&eqty, &t.contract), 0);

    // once listed, the same offer is accepted
    t.c.list_asset(&t.maker2, &code, &issuer);
    assert_eq!(t.offer(&t.writer, &eqty, OptionType::Call), 0);
    assert_eq!(t.bal(&eqty, &t.contract), QTY);
}

#[test]
fn writer_open_cap_blocks_51st_offer() {
    let t = setup();
    let tiny = |w: &Address, expiry: u64| {
        t.c.try_create_offer(w, &t.rwa, &OptionType::Put, &1, &1, &1, &expiry)
    };
    let count = |w: &Address| t.c.writer_open_count(w);
    assert_eq!(count(&t.writer), 0);
    for i in 0..WRITER_CAP {
        assert_eq!(tiny(&t.writer, EXPIRY), Ok(Ok(i)));
        assert_eq!(count(&t.writer), i + 1);
    }
    let before = t.snap();

    // the 51st open offer of the same writer fails, on any underlying, either type
    assert_err(tiny(&t.writer, EXPIRY), Error::WriterOpenLimit);
    assert_err(
        t.c.try_create_offer(&t.writer, &t.bond, &OptionType::Call, &1, &1, &1, &EXPIRY),
        Error::WriterOpenLimit,
    );
    // check order: InvalidArgs, TenorOutOfRange and NotEligible come first
    assert_err(
        t.c.try_create_offer(&t.writer, &t.rwa, &OptionType::Put, &0, &1, &1, &EXPIRY),
        Error::InvalidArgs,
    );
    assert_err(
        tiny(&t.writer, START + TENOR_CAP + 1),
        Error::TenorOutOfRange,
    );
    t.sac(&t.rwa).set_authorized(&t.writer, &false);
    assert_err(tiny(&t.writer, EXPIRY), Error::NotEligible);
    t.sac(&t.rwa).set_authorized(&t.writer, &true);
    assert_eq!(t.snap(), before);
    assert_eq!(count(&t.writer), WRITER_CAP);

    // the cap is per writer
    assert_eq!(tiny(&t.maker2, EXPIRY), Ok(Ok(50)));
    assert_eq!(count(&t.maker2), 1);

    // cancel_offer: -1, frees exactly one slot
    t.c.cancel_offer(&t.writer, &0);
    assert_eq!(count(&t.writer), WRITER_CAP - 1);
    assert_eq!(tiny(&t.writer, EXPIRY), Ok(Ok(51)));
    assert_eq!(count(&t.writer), WRITER_CAP);
    assert_err(tiny(&t.writer, EXPIRY), Error::WriterOpenLimit);

    // buy: -1 (Active is no longer Offered); exercise of that option: unchanged
    t.c.buy(&t.holder, &1);
    assert_eq!(count(&t.writer), WRITER_CAP - 1);
    t.c.exercise(&t.holder, &1);
    assert_eq!(count(&t.writer), WRITER_CAP - 1);
    assert_eq!(tiny(&t.writer, EXPIRY), Ok(Ok(52)));
    t.c.buy(&t.holder, &2); // stays Active until expiry
    assert_eq!(count(&t.writer), WRITER_CAP - 1);
    assert_eq!(tiny(&t.writer, EXPIRY), Ok(Ok(53)));
    assert_eq!(count(&t.writer), WRITER_CAP);

    // expired but unpruned offers are still Offered and still count
    t.at(EXPIRY);
    let later = EXPIRY + 7 * 86_400;
    assert_eq!(count(&t.writer), WRITER_CAP);
    assert_err(tiny(&t.writer, later), Error::WriterOpenLimit);

    // reclaim of an Offered option: -1; reclaim of an Active option: unchanged
    t.c.reclaim(&t.writer, &3);
    assert_eq!(count(&t.writer), WRITER_CAP - 1);
    t.c.reclaim(&t.writer, &2);
    assert_eq!(count(&t.writer), WRITER_CAP - 1);
    assert_eq!(tiny(&t.writer, later), Ok(Ok(54)));
    assert_eq!(count(&t.writer), WRITER_CAP);

    // prune_expired by anyone: -1
    assert_eq!(t.c.prune_expired(&t.pruner, &vec![&t.env, 4u32]), 1);
    assert_eq!(count(&t.writer), WRITER_CAP - 1);
    assert_eq!(tiny(&t.writer, later), Ok(Ok(55)));
    assert_eq!(count(&t.writer), WRITER_CAP);
    assert_err(tiny(&t.writer, later), Error::WriterOpenLimit);

    // maker2 was never affected; an address with no offers reads 0
    assert_eq!(count(&t.maker2), 1);
    assert_eq!(count(&t.outsider), 0);
    // the counter equals the writer's options in state Offered
    let offered = |w: &Address| {
        (0..t.c.option_count())
            .map(|id| t.c.get_option(&id))
            .filter(|o| o.writer == *w && o.state == State::Offered)
            .count() as u32
    };
    assert_eq!(offered(&t.writer), count(&t.writer));
    assert_eq!(offered(&t.maker2), count(&t.maker2));
}

#[test]
fn tenor_cap() {
    let t = setup();
    let max = START + TENOR_CAP;
    let create = |w: &Address, ty: OptionType, expiry: u64| {
        t.c.try_create_offer(w, &t.rwa, &ty, &QTY, &STRIKE, &PREMIUM, &expiry)
    };
    let before = t.snap();

    for ty in [OptionType::Put, OptionType::Call] {
        assert_err(create(&t.writer, ty, max + 1), Error::TenorOutOfRange);
        assert_err(create(&t.writer, ty, u64::MAX), Error::TenorOutOfRange);
    }
    // check order: InvalidArgs first, TenorOutOfRange right after it (before NotEligible)
    assert_err(
        t.c.try_create_offer(
            &t.writer,
            &t.rwa,
            &OptionType::Put,
            &0,
            &STRIKE,
            &PREMIUM,
            &(max + 1),
        ),
        Error::InvalidArgs,
    );
    assert_err(
        create(&t.outsider, OptionType::Put, max + 1),
        Error::TenorOutOfRange,
    );
    assert_eq!(t.snap(), before);
    assert_eq!(t.c.option_count(), 0);

    // expiry == now + MAX_TENOR is accepted
    let id = create(&t.writer, OptionType::Put, max).unwrap().unwrap();
    assert_eq!(t.c.get_option(&id).expiry, max);
    // the window moves with the ledger clock
    t.at(START + 1_000);
    assert_err(
        create(&t.maker2, OptionType::Call, max + 1_001),
        Error::TenorOutOfRange,
    );
    let id2 = create(&t.maker2, OptionType::Call, max + 1_000)
        .unwrap()
        .unwrap();
    assert_eq!(t.c.get_option(&id2).expiry, max + 1_000);

    // a maximum-tenor option settles like any other
    t.c.buy(&t.holder, &id);
    t.at(max - 1);
    t.c.exercise(&t.holder, &id);
    assert_eq!(t.state(id), State::Exercised);
}

#[test]
fn prune_expired_returns_collateral_and_skips_live_and_bought() {
    let t = setup();
    let later = EXPIRY + 7 * 86_400;
    let a = t.put(&t.writer); // expired Offered PUT -> pruned
    let b = t.call(&t.writer); // expired Offered CALL -> pruned
    let live = t.c.create_offer(
        &t.writer,
        &t.bond,
        &OptionType::Put,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &later,
    ); // live Offered -> untouched
    let m = t.offer(&t.maker2, &t.bond, OptionType::Call); // other writer -> pruned
    let act = t.put(&t.maker2); // Active -> untouched
    t.c.buy(&t.holder, &act);
    let settled = t.call(&t.maker2); // Settled -> untouched
    t.c.buy(&t.holder, &settled);
    t.c.exercise(&t.holder, &settled);
    t.c.claim_delivery(&t.maker2, &settled);
    let cancelled = t.put(&t.maker2); // Cancelled -> untouched
    t.c.cancel_offer(&t.maker2, &cancelled);
    let all = vec![&t.env, a, b, live, m, act, settled, cancelled];

    // before expiry nothing is prunable
    let before = t.snap();
    assert_eq!(t.c.prune_expired(&t.pruner, &all), 0);
    assert!(pruned_events(&t).is_empty());
    assert_eq!(t.snap(), before);

    t.at(EXPIRY);
    let before = t.snap();
    assert_eq!(before.open, [a, b, live, m]);
    assert_eq!(t.c.writer_open_count(&t.writer), 3);
    assert_eq!(t.c.writer_open_count(&t.maker2), 1);

    // an unknown id fails the whole call, even after prunable ids
    assert_err(
        t.c.try_prune_expired(&t.pruner, &vec![&t.env, a, b, 999]),
        Error::NotFound,
    );
    assert_err(
        t.c.try_prune_expired(&t.pruner, &vec![&t.env, t.c.option_count()]),
        Error::NotFound,
    );
    assert_eq!(t.snap(), before);
    assert_eq!(t.c.writer_open_count(&t.writer), 3);

    // a mixed batch (with a repeated id) prunes only the expired Offered ids, in order
    let n = t.c.prune_expired(
        &t.pruner,
        &vec![&t.env, live, act, a, settled, cancelled, b, m, a],
    );
    assert_eq!(pruned_ids(&t), [a, b, m]);
    assert_eq!(n, 3);

    // collateral went back to each writer; reserves and list_open follow
    let mut expected = before.clone();
    expected.writer.usdx += STRIKE; // a: PUT, USDx
    expected.writer.rwa += QTY; // b: CALL on RWA
    expected.maker2.bond += QTY; // m: CALL on BOND
    expected.contract.usdx -= STRIKE;
    expected.contract.rwa -= QTY;
    expected.contract.bond -= QTY;
    expected.open_usdx -= STRIKE;
    expected.open_rwa -= QTY;
    expected.open_bond -= QTY;
    expected.open = std::vec![live];
    for id in [a, b, m] {
        expected.options[id as usize].state = State::Expired;
    }
    assert_eq!(t.snap(), expected);
    assert_eq!(t.state(live), State::Offered);
    assert_eq!(t.state(act), State::Active);
    assert_eq!(t.state(settled), State::Settled);
    assert_eq!(t.state(cancelled), State::Cancelled);
    assert_eq!(t.c.writer_open_count(&t.writer), 1);
    assert_eq!(t.c.writer_open_count(&t.maker2), 0);

    // nothing left to prune: no-op, no events
    assert_eq!(t.c.prune_expired(&t.pruner, &all), 0);
    assert!(pruned_events(&t).is_empty());
    assert_eq!(t.c.prune_expired(&t.pruner, &Vec::new(&t.env)), 0);
    assert_eq!(t.snap(), expected);

    // Expired is terminal; the Active option is still the writer's to reclaim
    assert_err(t.c.try_cancel_offer(&t.writer, &a), Error::WrongState);
    assert_err(t.c.try_reclaim(&t.writer, &a), Error::WrongState);
    assert_err(t.c.try_buy(&t.holder, &b), Error::WrongState);
    t.c.reclaim(&t.maker2, &act);
    assert_eq!(t.state(act), State::Expired);
}

#[test]
fn prune_expired_skips_frozen_call_writer() {
    let t = setup();
    let c = t.call(&t.writer);
    let p = t.put(&t.writer);
    t.at(EXPIRY);
    // the issuer freezes the writer on RWA: the CALL collateral cannot go back
    t.sac(&t.rwa).set_authorized(&t.writer, &false);
    let before = t.snap();

    assert_eq!(t.c.prune_expired(&t.pruner, &vec![&t.env, c]), 0);
    assert!(pruned_events(&t).is_empty());
    assert_eq!(t.snap(), before);
    assert_eq!(t.state(c), State::Offered);
    assert_eq!(t.c.writer_open_count(&t.writer), 2);

    // in a batch only the CALL is skipped; the PUT (USDx collateral) is pruned
    assert_eq!(t.c.prune_expired(&t.pruner, &vec![&t.env, c, p]), 1);
    assert_eq!(pruned_ids(&t), [p]);
    assert_eq!(t.state(c), State::Offered);
    assert_eq!(t.state(p), State::Expired);
    assert_eq!(t.open(), [c]);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    assert_eq!(t.bal(&t.rwa, &t.contract), QTY);
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);
    assert_eq!(t.c.writer_open_count(&t.writer), 1);

    // after the issuer unfreezes the writer, the CALL is pruned
    t.sac(&t.rwa).set_authorized(&t.writer, &true);
    assert_eq!(t.c.prune_expired(&t.pruner, &vec![&t.env, c]), 1);
    assert_eq!(pruned_ids(&t), [c]);
    assert_eq!(t.state(c), State::Expired);
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START);
    assert_eq!(t.bal(&t.rwa, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    assert!(t.open().is_empty());
    assert_eq!(t.c.writer_open_count(&t.writer), 0);
}

#[test]
fn backstop_rejects_contract_address_as_party() {
    // Under mock_all_auths the contract's own address passes require_auth (the
    // v1.2 build let it buy its own offer with pooled collateral), so the
    // explicit v1.3 check is the only thing that can fail these calls.
    let t = setup();
    let offered = t.put(&t.writer);
    let active = t.call(&t.writer);
    t.c.buy(&t.holder, &active);
    let (sac, code, issuer) = new_asset(&t, true);
    let me = &t.contract;
    let before = t.snap();

    for token in [&t.rwa, &t.bond] {
        for ty in [OptionType::Put, OptionType::Call] {
            assert_err(
                t.c.try_create_offer(me, token, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
                Error::InvalidArgs,
            );
        }
    }
    // checked right after auth, before AssetNotAllowed
    assert_err(
        t.c.try_create_offer(me, &sac, &OptionType::Put, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
        Error::InvalidArgs,
    );
    assert_err(t.c.try_buy(me, &offered), Error::InvalidArgs);
    assert_err(t.c.try_exercise(me, &active), Error::InvalidArgs);
    assert_err(t.c.try_transfer(&t.holder, me, &active), Error::InvalidArgs);
    assert_err(t.c.try_transfer(me, &t.maker2, &active), Error::InvalidArgs);
    assert_err(t.c.try_list_asset(me, &code, &issuer), Error::InvalidArgs);
    // v1.3.1: the pruner may not be the contract either
    assert_err(
        t.c.try_prune_expired(me, &vec![&t.env, offered]),
        Error::InvalidArgs,
    );

    assert_eq!(t.snap(), before);
    assert!(!t.c.is_listed(&sac));
    assert_eq!(t.c.asset_count(), 2);
    assert_eq!(t.c.writer_open_count(me), 0);

    // control: the same calls by real parties succeed
    t.c.buy(&t.maker2, &offered);
    t.c.transfer(&t.holder, &t.maker2, &active);
    assert_eq!(t.c.list_asset(&t.holder, &code, &issuer), sac);
}

#[test]
fn get_assets_paging() {
    let t = setup();
    let page = |from: u32, limit: u32| -> std::vec::Vec<Address> {
        t.c.list_assets(&from, &limit).iter().collect()
    };
    assert_eq!(page(0, 1), std::slice::from_ref(&t.rwa));
    assert_eq!(page(1, 50), std::slice::from_ref(&t.bond));
    assert!(page(2, 5).is_empty());
    assert!(page(0, 0).is_empty());
    assert!(page(u32::MAX, 50).is_empty());
    assert_eq!(page(0, u32::MAX), [t.rwa.clone(), t.bond.clone()]);

    // 60 listed assets: one call returns at most MAX_PAGE = 50, in listing order
    let mut expected = std::vec![t.rwa.clone(), t.bond.clone()];
    for _ in 2..60 {
        let (sac, code, issuer) = new_asset(&t, false);
        assert_eq!(t.c.list_asset(&t.writer, &code, &issuer), sac);
        expected.push(sac);
    }
    assert_eq!(t.c.asset_count(), 60);
    assert_eq!(MAX_PAGE, 50);
    assert_eq!(page(0, 1000), expected[..50].to_vec());
    assert_eq!(page(50, 1000), expected[50..].to_vec());
    assert_eq!(page(55, 50), expected[55..].to_vec());
    assert!(page(60, 1).is_empty());

    // paging with from += len visits every asset exactly once
    let mut seen = std::vec::Vec::new();
    let mut from = 0u32;
    loop {
        let p = page(from, 7);
        if p.is_empty() {
            break;
        }
        from += p.len() as u32;
        seen.extend(p);
    }
    assert_eq!(seen, expected);
}

#[test]
fn events_for_v13() {
    use soroban_sdk::xdr::ContractEventBody;
    let t = setup();

    // AssetListed: topics ["asset_listed", sac], data {code, issuer, lister}
    let (sac, code, issuer) = new_asset(&t, true);
    t.c.list_asset(&t.maker2, &code, &issuer);
    let evs = t.env.events().all().filter_by_contract(&t.contract);
    assert_eq!(
        evs,
        [AssetListed {
            sac: sac.clone(),
            code: code.clone(),
            issuer: issuer.clone(),
            lister: t.maker2.clone(),
        }
        .to_xdr(&t.env, &t.contract)]
    );
    let ContractEventBody::V0(body) = &evs.events()[0].body;
    assert_eq!(body.topics.len(), 2);
    assert_eq!(body.topics[0], sym("asset_listed"));
    assert_eq!(Address::try_from_val(&t.env, &body.topics[1]).unwrap(), sac);

    // OfferPruned: topics ["offer_pruned", id], data {pruner}, one per pruned id
    let id = t.put(&t.writer);
    t.at(EXPIRY);
    assert_eq!(t.c.prune_expired(&t.pruner, &vec![&t.env, id]), 1);
    assert_eq!(
        t.env
            .events()
            .all()
            .filter_by_contract(&t.contract)
            .events()
            .len(),
        1
    );
    // v1.3.1: the event names the authenticated caller, not the contract
    assert_eq!(pruned_events(&t), [(id, t.pruner.clone())]);

    // failed v1.3 calls publish nothing
    assert_err(
        t.c.try_list_asset(&t.maker2, &code, &issuer),
        Error::AlreadyListed,
    );
    assert!(t.env.events().all().events().is_empty());
    assert_err(
        t.c.try_prune_expired(&t.pruner, &vec![&t.env, 99]),
        Error::NotFound,
    );
    assert!(t.env.events().all().events().is_empty());
}

#[test]
fn prune_expired_extends_ttls() {
    let t = setup();
    let id = t.put(&t.writer);
    t.at(EXPIRY);
    age_below_ttl_threshold(&t);
    assert_eq!(t.c.prune_expired(&t.pruner, &vec![&t.env, id]), 1);
    assert_ttls_extended(&t, id);
}

#[test]
fn list_asset_and_create_offer_extend_registry_ttls() {
    let t = setup();
    let (sac, code, issuer) = new_asset(&t, true);
    t.put(&t.writer);
    age_below_ttl_threshold(&t);

    // list_asset: instance, code and the new registry entry (ABI §8)
    t.c.list_asset(&t.maker2, &code, &issuer);
    assert!(
        t.instance_ttl() >= 29 * DAY,
        "instance TTL {}",
        t.instance_ttl()
    );
    assert!(
        t.env.deployer().get_contract_code_ttl(&t.contract) >= 29 * DAY,
        "code TTL"
    );
    let listed = key_ttl(&t, "Listed", sac.into_val(&t.env));
    assert!(listed >= 29 * DAY, "Listed(sac) TTL {listed}");

    // create_offer reads Listed(underlying) and WriterOpen(writer) on a
    // state-changing path, so both are extended
    let id = t.put(&t.writer);
    assert_ttls_extended(&t, id);
    let rwa = key_ttl(&t, "Listed", t.rwa.clone().into_val(&t.env));
    assert!(rwa >= 29 * DAY, "Listed(rwa) TTL {rwa}");
    let wo = key_ttl(&t, "WriterOpen", t.writer.clone().into_val(&t.env));
    assert!(wo >= 29 * DAY, "WriterOpen(writer) TTL {wo}");
}

#[test]
fn writer_open_limit_check_order() {
    // ABI §3 create_offer: ... NotEligible / ContractNotAuthorized ... OpenListFull,
    // then WriterOpenLimit, then CollateralShortfall.
    let t = setup();
    for i in 0..WRITER_CAP {
        let id =
            t.c.create_offer(&t.writer, &t.rwa, &OptionType::Put, &1, &1, &1, &EXPIRY);
        assert_eq!(id, i);
    }
    // maker2's CALL puts RWA in the pool; a 1-unit clawback leaves a deficit
    t.call(&t.maker2);
    t.sac(&t.rwa).clawback(&t.contract, &UNIT);
    assert!(t.bal(&t.rwa, &t.contract) < t.c.open_collateral(&t.rwa));
    let create = |w: &Address, ty: OptionType| {
        t.c.try_create_offer(w, &t.rwa, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY)
    };
    let before = t.snap();

    // a writer at the cap on a token in deficit: WriterOpenLimit comes first
    for ty in [OptionType::Put, OptionType::Call] {
        assert_err(create(&t.writer, ty), Error::WriterOpenLimit);
    }
    // control: a writer below the cap reaches CollateralShortfall
    assert_err(
        create(&t.maker2, OptionType::Put),
        Error::CollateralShortfall,
    );
    // ContractNotAuthorized comes before WriterOpenLimit
    t.sac(&t.rwa).set_authorized(&t.contract, &false);
    assert_err(
        create(&t.writer, OptionType::Put),
        Error::ContractNotAuthorized,
    );
    t.sac(&t.rwa).set_authorized(&t.contract, &true);
    assert_eq!(t.snap(), before);
    assert_eq!(t.c.writer_open_count(&t.writer), WRITER_CAP);
    assert_eq!(t.c.writer_open_count(&t.maker2), 1);
}

#[test]
fn prune_expired_skips_when_contract_cannot_pay() {
    // ABI §3 prune_expired: a failing collateral transfer skips the id and
    // changes nothing about it; it never fails the call.
    let t = setup();
    let clawed = t.call(&t.writer); // RWA collateral, clawed back below
    let p = t.put(&t.writer); // USDx collateral
    let b = t.offer(&t.maker2, &t.bond, OptionType::Call); // BOND collateral
    t.at(EXPIRY);

    // the issuer claws back the CALL's whole RWA collateral from the contract
    // and de-authorizes the contract on BOND
    t.sac(&t.rwa).clawback(&t.contract, &QTY);
    t.sac(&t.bond).set_authorized(&t.contract, &false);
    assert_eq!(t.bal(&t.rwa, &t.contract), 0);
    let before = t.snap();

    assert_eq!(t.c.prune_expired(&t.pruner, &vec![&t.env, clawed, b]), 0);
    assert!(pruned_events(&t).is_empty());
    assert_eq!(t.snap(), before);

    // in a batch only the USDx-backed PUT is pruned
    assert_eq!(t.c.prune_expired(&t.pruner, &vec![&t.env, clawed, p, b]), 1);
    assert_eq!(pruned_ids(&t), [p]);
    assert_eq!(t.state(clawed), State::Offered);
    assert_eq!(t.state(b), State::Offered);
    assert_eq!(t.state(p), State::Expired);
    assert_eq!(t.open(), [clawed, b]);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    // the deficit stays visible: reserve QTY, balance 0
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START - QTY);
    assert_eq!(t.c.writer_open_count(&t.writer), 1);
    assert_eq!(t.c.writer_open_count(&t.maker2), 1);

    // once the issuer re-authorizes the contract, the BOND offer is pruned
    t.sac(&t.bond).set_authorized(&t.contract, &true);
    assert_eq!(t.c.prune_expired(&t.pruner, &vec![&t.env, clawed, b]), 1);
    assert_eq!(pruned_ids(&t), [b]);
    assert_eq!(t.state(b), State::Expired);
    assert_eq!(t.bal(&t.bond, &t.maker2), UNDERLYING_START);
    assert_eq!(t.bal(&t.bond, &t.contract), 0);
    assert_eq!(t.c.open_collateral(&t.bond), 0);
    assert_eq!(t.c.writer_open_count(&t.maker2), 0);
    assert_eq!(t.open(), [clawed]);
}

// ---------------------------------------------------------------------------
// v1.3.1: pruner argument, transfer guards, per-asset open books, list_asset
// check order and keeper coverage (ABI §3, §6, §8, §13)
// ---------------------------------------------------------------------------

/// The complete open book of `asset`, read through `list_open_for` with the
/// client paging rule `from += returned.len()`.
fn open_book(t: &T, asset: &Address) -> std::vec::Vec<u32> {
    let mut book = std::vec::Vec::new();
    loop {
        let page = t.c.list_open_for(asset, &(book.len() as u32), &MAX_PAGE);
        assert!(page.len() <= MAX_PAGE, "page of {}", page.len());
        if page.is_empty() {
            return book;
        }
        book.extend(page.iter());
    }
}

#[test]
fn per_asset_open_cap() {
    // ABI §3 create_offer, §6, §13.3 (v1.3.1): every underlying has its own open
    // book capped at MAX_OPEN_PER_ASSET = 500, so dust offers can only crowd out
    // their own asset's book (finding F-1R).
    let t = setup();
    // one writer holds at most WRITER_CAP (50) open offers, so 10 writers fill
    // one book; ids 0..50 belong to `t.writer`
    let mut writers = std::vec![t.writer.clone()];
    while writers.len() < (ASSET_CAP / WRITER_CAP) as usize {
        let w = Address::generate(&t.env);
        t.sac(&t.rwa).set_authorized(&w, &true);
        t.sac(&t.usdx).mint(&w, &USDX_START);
        writers.push(w);
    }
    assert_eq!(writers.len(), 10);
    // 1-unit PUTs: each offer locks 1 USDx unit
    let tiny = |writer: &Address, underlying: &Address, expiry: u64| {
        t.c.try_create_offer(writer, underlying, &OptionType::Put, &1, &1, &1, &expiry)
    };
    for i in 0..ASSET_CAP {
        assert_eq!(
            tiny(&writers[(i / WRITER_CAP) as usize], &t.rwa, EXPIRY),
            Ok(Ok(i))
        );
    }
    let all: std::vec::Vec<u32> = (0..ASSET_CAP).collect();
    assert_eq!(open_book(&t, &t.rwa), all);
    assert_eq!(t.c.open_collateral(&t.usdx), ASSET_CAP as i128);
    // list_open() shows only the first 200 ids of the full RWA book
    assert_eq!(t.open(), all[..LIST_OPEN_CAP as usize]);
    let before = t.snap();

    // the 501st RWA offer fails for any writer, either type. `t.writer` is at
    // both caps: OpenListFull is checked before WriterOpenLimit (ABI §3).
    assert_err(tiny(&t.maker2, &t.rwa, EXPIRY), Error::OpenListFull);
    assert_err(tiny(&t.writer, &t.rwa, EXPIRY), Error::OpenListFull);
    assert_err(
        t.c.try_create_offer(&t.maker2, &t.rwa, &OptionType::Call, &1, &1, &1, &EXPIRY),
        Error::OpenListFull,
    );
    // check order: InvalidArgs, TenorOutOfRange, NotEligible and
    // ContractNotAuthorized come before OpenListFull
    assert_err(
        t.c.try_create_offer(&t.maker2, &t.rwa, &OptionType::Put, &0, &1, &1, &EXPIRY),
        Error::InvalidArgs,
    );
    assert_err(
        tiny(&t.maker2, &t.rwa, START + TENOR_CAP + 1),
        Error::TenorOutOfRange,
    );
    assert_err(tiny(&t.outsider, &t.rwa, EXPIRY), Error::NotEligible);
    t.sac(&t.rwa).set_authorized(&t.contract, &false);
    assert_err(
        tiny(&t.maker2, &t.rwa, EXPIRY),
        Error::ContractNotAuthorized,
    );
    t.sac(&t.rwa).set_authorized(&t.contract, &true);
    assert_eq!(t.snap(), before);

    // the cap is per asset: a BOND offer still succeeds
    let bond = ASSET_CAP;
    assert_eq!(tiny(&t.maker2, &t.bond, EXPIRY), Ok(Ok(bond)));
    assert_eq!(open_book(&t, &t.bond), [bond]);
    // ... while the per-writer cap still spans every asset
    assert_err(tiny(&t.writer, &t.bond, EXPIRY), Error::WriterOpenLimit);
    // the RWA book is still full; list_open() is still the first 200 RWA ids
    // (RWA comes before BOND in the registry)
    assert_err(tiny(&t.maker2, &t.rwa, EXPIRY), Error::OpenListFull);
    assert_eq!(t.open(), all[..LIST_OPEN_CAP as usize]);

    // after one RWA cancel a new RWA offer succeeds, and only one
    t.c.cancel_offer(&t.writer, &0);
    assert_eq!(tiny(&t.maker2, &t.rwa, EXPIRY), Ok(Ok(ASSET_CAP + 1)));
    assert_err(tiny(&t.maker2, &t.rwa, EXPIRY), Error::OpenListFull);
    // a bought offer frees one slot as well
    t.c.buy(&t.holder, &1);
    assert_eq!(tiny(&t.maker2, &t.rwa, EXPIRY), Ok(Ok(ASSET_CAP + 2)));
    assert_err(tiny(&t.maker2, &t.rwa, EXPIRY), Error::OpenListFull);

    // expired but unpruned offers are still Offered and still fill the book;
    // pruning one (by anyone) frees one slot
    let later = EXPIRY + 7 * 86_400;
    t.at(EXPIRY);
    assert_err(tiny(&t.maker2, &t.rwa, later), Error::OpenListFull);
    assert_eq!(t.c.prune_expired(&t.pruner, &vec![&t.env, 2u32]), 1);
    assert_eq!(tiny(&t.maker2, &t.rwa, later), Ok(Ok(ASSET_CAP + 3)));
    assert_err(tiny(&t.maker2, &t.rwa, later), Error::OpenListFull);

    let mut rwa: std::vec::Vec<u32> = (3..ASSET_CAP).collect();
    rwa.extend([ASSET_CAP + 1, ASSET_CAP + 2, ASSET_CAP + 3]);
    assert_eq!(rwa.len(), ASSET_CAP as usize);
    assert_eq!(open_book(&t, &t.rwa), rwa);
    assert_eq!(open_book(&t, &t.bond), [bond]);
    assert_eq!(t.open(), rwa[..LIST_OPEN_CAP as usize]);
    assert_eq!(t.c.writer_open_count(&t.writer), WRITER_CAP - 3);
    assert_eq!(t.c.writer_open_count(&t.maker2), 4);
}

#[test]
fn prune_requires_pruner_auth() {
    // ABI §3 prune_expired (v1.3.1): `pruner.require_auth()` for accountability;
    // any account may prune, but nobody can prune in another account's name.
    let t = setup();
    let p = t.put(&t.writer);
    let c = t.call(&t.writer);
    t.at(EXPIRY);
    let ids = vec![&t.env, p, c];
    let before = t.snap();

    // backstop: under mock_all_auths the contract's own address passes
    // require_auth, so only the explicit check rejects it; like every other
    // backstop it comes right after auth, before any id is looked at
    assert_err(t.c.try_prune_expired(&t.contract, &ids), Error::InvalidArgs);
    assert_err(
        t.c.try_prune_expired(&t.contract, &vec![&t.env, 999]),
        Error::InvalidArgs,
    );
    assert_err(
        t.c.try_prune_expired(&t.contract, &Vec::new(&t.env)),
        Error::InvalidArgs,
    );
    assert_eq!(t.snap(), before);

    // another address's signature (the writer's included) is not the pruner's
    let invoke = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "prune_expired",
        args: (&t.pruner, ids.clone()).into_val(&t.env),
        sub_invokes: &[],
    };
    for signer in [&t.maker2, &t.writer, &t.holder] {
        t.env.mock_auths(&[MockAuth {
            address: signer,
            invoke: &invoke,
        }]);
        assert_host_abort(t.c.try_prune_expired(&t.pruner, &ids));
        assert_eq!(t.snap(), before);
    }
    // nor is no signature at all
    t.env.set_auths(&[]);
    assert_host_abort(t.c.try_prune_expired(&t.pruner, &ids));
    assert_eq!(t.snap(), before);

    // the pruner's own signature over (pruner, ids), and nothing else, is
    // enough: the pruner has no balances and no role on either option
    t.env.mock_auths(&[MockAuth {
        address: &t.pruner,
        invoke: &invoke,
    }]);
    assert_eq!(t.c.prune_expired(&t.pruner, &ids), 2);
    assert_eq!(
        t.env.auths(),
        std::vec![(
            t.pruner.clone(),
            leaf(contract_fn(
                &t,
                &t.contract,
                "prune_expired",
                (t.pruner.clone(), ids.clone()).into_val(&t.env),
            ))
        )]
    );
    assert_eq!(pruned_ids(&t), [p, c]);
    assert_eq!(t.state(p), State::Expired);
    assert_eq!(t.state(c), State::Expired);
    // the collateral went to the writer, never to the pruner
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START);
    assert_eq!(t.bal(&t.rwa, &t.writer), UNDERLYING_START);
    assert_eq!(t.bal(&t.usdx, &t.pruner), 0);
    assert_eq!(t.bal(&t.rwa, &t.pruner), 0);
    assert_eq!(t.c.open_collateral(&t.usdx), 0);
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    assert!(t.open().is_empty());
    assert_eq!(t.c.writer_open_count(&t.writer), 0);
}

#[test]
fn list_open_concatenates_registry_order_and_truncates_at_200() {
    // ABI §3 Views (v1.3.1): list_open() is the per-asset books concatenated in
    // registry order, each oldest first, truncated to 200 ids.
    let t = setup();
    // registry: RWA, BOND (constructor), then two listings. The 3rd stays empty;
    // the 4th is EQTY-like: regulated, its issuer authorizes the escrow and the
    // writers.
    let (empty, code3, issuer3) = new_asset(&t, true);
    let (eqty, code4, issuer4) = new_asset(&t, true);
    t.c.list_asset(&t.maker2, &code3, &issuer3);
    t.c.list_asset(&t.maker2, &code4, &issuer4);
    assert_eq!(
        listed_assets(&t),
        [t.rwa.clone(), t.bond.clone(), empty.clone(), eqty.clone()]
    );
    t.sac(&eqty).set_authorized(&t.contract, &true);
    let new_writer = || {
        let w = Address::generate(&t.env);
        for asset in [&t.rwa, &t.bond, &eqty] {
            t.sac(asset).set_authorized(&w, &true);
        }
        t.sac(&t.usdx).mint(&w, &USDX_START);
        w
    };
    // 1-unit PUTs: each offer locks 1 USDx unit
    let tiny = |w: &Address, asset: &Address| {
        t.c.create_offer(w, asset, &OptionType::Put, &1, &1, &1, &EXPIRY)
    };
    let w = new_writer();
    assert!(t.open().is_empty());

    // ids interleave across assets; list_open() groups them by asset in
    // registry order, not by id
    let e0 = tiny(&w, &eqty);
    let b1 = tiny(&w, &t.bond);
    let r2 = tiny(&w, &t.rwa);
    let e3 = tiny(&w, &eqty);
    let r4 = tiny(&w, &t.rwa);
    let b5 = tiny(&w, &t.bond);
    assert_eq!([e0, b1, r2, e3, r4, b5], [0, 1, 2, 3, 4, 5]);
    assert_eq!(t.open(), [r2, r4, b1, b5, e0, e3]);
    assert_eq!(open_book(&t, &t.rwa), [r2, r4]);
    assert_eq!(open_book(&t, &t.bond), [b1, b5]);
    assert!(open_book(&t, &empty).is_empty());
    assert_eq!(open_book(&t, &eqty), [e0, e3]);

    // leaving a book (cancel, buy) keeps the order of the rest
    t.c.cancel_offer(&w, &r2);
    t.c.buy(&t.holder, &b5);
    assert_eq!(t.open(), [r4, b1, e0, e3]);
    // a new offer goes to the end of its own book, not the end of list_open()
    let r6 = tiny(&w, &t.rwa);
    assert_eq!(t.open(), [r4, r6, b1, e0, e3]);

    // more than 200 open offers in total: exactly the first 200 of the
    // concatenation, RWA first, with the cut inside the last non-empty book
    let mut rwa = std::vec![r4, r6];
    let mut bond = std::vec![b1];
    let mut eq = std::vec![e0, e3];
    let writers: std::vec::Vec<Address> = (0..5).map(|_| new_writer()).collect();
    let mut k = 0usize;
    for (asset, n, book) in [
        (&t.rwa, 100, &mut rwa),
        (&t.bond, 50, &mut bond),
        (&eqty, 60, &mut eq),
    ] {
        for _ in 0..n {
            book.push(tiny(&writers[k / WRITER_CAP as usize], asset));
            k += 1;
        }
    }
    let concat = |rwa: &[u32], bond: &[u32], eq: &[u32]| -> std::vec::Vec<u32> {
        rwa.iter().chain(bond).chain(eq).copied().collect()
    };
    let expected = concat(&rwa, &bond, &eq);
    assert_eq!(expected.len(), 102 + 51 + 62);
    assert_eq!(t.c.list_open().len(), LIST_OPEN_CAP);
    assert_eq!(t.open(), expected[..LIST_OPEN_CAP as usize]);
    assert_eq!(t.open()[0], r4);
    // the per-asset views stay complete
    assert_eq!(open_book(&t, &t.rwa), rwa);
    assert_eq!(open_book(&t, &t.bond), bond);
    assert!(open_book(&t, &empty).is_empty());
    assert_eq!(open_book(&t, &eqty), eq);
    // every Offered id is in exactly one book
    let mut offered: std::vec::Vec<u32> = (0..t.c.option_count())
        .filter(|id| t.state(*id) == State::Offered)
        .collect();
    let mut books = expected.clone();
    offered.sort_unstable();
    books.sort_unstable();
    assert_eq!(books, offered);

    // the truncation is recomputed: one RWA offer fewer shows one EQTY id more
    t.c.cancel_offer(&w, &r4);
    rwa.remove(0);
    let expected = concat(&rwa, &bond, &eq);
    assert_eq!(t.open(), expected[..LIST_OPEN_CAP as usize]);
    assert_eq!(t.open().last(), Some(&eq[200 - 101 - 51 - 1]));
}

#[test]
fn list_open_for_pages() {
    // ABI §3 Views (v1.3.1): list_open_for(asset, from, limit) returns the open
    // book of one underlying, oldest first, from book position `from`, at most
    // min(limit, MAX_PAGE) ids; never fails.
    let t = setup();
    let page = |asset: &Address, from: u32, limit: u32| -> std::vec::Vec<u32> {
        t.c.list_open_for(asset, &from, &limit).iter().collect()
    };
    let tiny = |w: &Address, asset: &Address| {
        t.c.create_offer(w, asset, &OptionType::Put, &1, &1, &1, &EXPIRY)
    };
    assert!(page(&t.rwa, 0, 50).is_empty());

    // 60 RWA offers by two writers, with a BOND offer after every 10th, so book
    // positions and ids differ
    let mut rwa = std::vec::Vec::new();
    let mut bond = std::vec::Vec::new();
    for i in 0..60u32 {
        let w = if i < 30 { &t.writer } else { &t.maker2 };
        rwa.push(tiny(w, &t.rwa));
        if i % 10 == 9 {
            bond.push(tiny(w, &t.bond));
        }
    }
    assert_eq!(rwa.len(), 60);
    assert_eq!(bond, [10, 21, 32, 43, 54, 65]);
    assert_eq!(MAX_PAGE, 50);

    // limit edge values: 0 is empty, anything above MAX_PAGE is MAX_PAGE
    assert!(page(&t.rwa, 0, 0).is_empty());
    assert!(page(&t.rwa, 10, 0).is_empty());
    assert_eq!(page(&t.rwa, 0, 1), rwa[..1]);
    assert_eq!(page(&t.rwa, 0, 49), rwa[..49]);
    assert_eq!(page(&t.rwa, 0, 50), rwa[..50]);
    assert_eq!(page(&t.rwa, 0, 51), rwa[..50]);
    assert_eq!(page(&t.rwa, 0, u32::MAX), rwa[..50]);
    // from edge values: positions in the book, not ids
    assert_eq!(page(&t.rwa, 10, 3), rwa[10..13]);
    assert_eq!(page(&t.rwa, 50, 50), rwa[50..]);
    assert_eq!(page(&t.rwa, 55, u32::MAX), rwa[55..]);
    assert_eq!(page(&t.rwa, 59, 1), rwa[59..]);
    assert!(page(&t.rwa, 60, 1).is_empty());
    assert!(page(&t.rwa, 61, 50).is_empty());
    assert!(page(&t.rwa, u32::MAX, 50).is_empty());
    assert!(page(&t.rwa, u32::MAX, u32::MAX).is_empty());
    assert_eq!(page(&t.bond, 0, 50), bond);
    assert_eq!(page(&t.bond, 1, 2), bond[1..3]);
    assert!(page(&t.bond, 6, 1).is_empty());

    // paging with from += len visits every id exactly once, in book order
    let mut seen = std::vec::Vec::new();
    loop {
        let p = page(&t.rwa, seen.len() as u32, 7);
        if p.is_empty() {
            break;
        }
        assert!(p.len() <= 7);
        seen.extend(p);
    }
    assert_eq!(seen, rwa);
    // both books together are list_open() (66 ids, below the 200 truncation)
    let mut all = rwa.clone();
    all.extend(&bond);
    assert_eq!(t.open(), all);

    // leaving the book shifts the later positions
    t.c.cancel_offer(&t.writer, &rwa[0]);
    t.c.buy(&t.holder, &rwa[25]);
    rwa.remove(25);
    rwa.remove(0);
    assert_eq!(page(&t.rwa, 0, 1), rwa[..1]);
    assert_eq!(page(&t.rwa, 0, 50), rwa[..50]);
    assert_eq!(page(&t.rwa, 50, 50), rwa[50..]);
    assert!(page(&t.rwa, 58, 50).is_empty());
    assert_eq!(open_book(&t, &t.rwa), rwa);
    assert_eq!(page(&t.bond, 0, 50), bond);

    // unknown assets read as empty books: a random address, the quote token, a
    // deployed but unlisted SAC, and a listed asset with no offers
    let (unlisted, _, _) = new_asset(&t, true);
    let (listed, code, issuer) = new_asset(&t, false);
    t.c.list_asset(&t.maker2, &code, &issuer);
    let random = Address::generate(&t.env);
    for asset in [&random, &t.usdx, &unlisted, &listed] {
        assert!(page(asset, 0, 50).is_empty());
        assert!(page(asset, 0, u32::MAX).is_empty());
        assert!(page(asset, u32::MAX, u32::MAX).is_empty());
    }
}

#[test]
fn prune_event_carries_pruner() {
    // ABI §5, §13.1: OfferPruned { id, pruner } names the authenticated caller
    // (v1.3 emitted the contract's own address), one event per pruned id.
    let t = setup();
    let a = t.put(&t.writer);
    let b = t.call(&t.maker2);
    let c = t.offer(&t.writer, &t.bond, OptionType::Put);
    t.at(EXPIRY);

    // a third party prunes two offers of two writers
    assert_eq!(t.c.prune_expired(&t.holder, &vec![&t.env, a, b]), 2);
    assert_eq!(
        t.env.events().all().filter_by_contract(&t.contract),
        [
            OfferPruned {
                id: a,
                pruner: t.holder.clone(),
            }
            .to_xdr(&t.env, &t.contract),
            OfferPruned {
                id: b,
                pruner: t.holder.clone(),
            }
            .to_xdr(&t.env, &t.contract),
        ]
    );
    assert_eq!(
        pruned_events(&t),
        [(a, t.holder.clone()), (b, t.holder.clone())]
    );
    // a writer may prune its own offer; the event names the writer
    assert_eq!(t.c.prune_expired(&t.writer, &vec![&t.env, c]), 1);
    assert_eq!(pruned_events(&t), [(c, t.writer.clone())]);
    // nothing left to prune: no events at all
    assert_eq!(t.c.prune_expired(&t.maker2, &vec![&t.env, a, b, c]), 0);
    assert!(t.env.events().all().events().is_empty());
    for id in [a, b, c] {
        assert_eq!(t.state(id), State::Expired);
    }
}

#[test]
fn transfer_rejects_when_contract_deauthorized() {
    // ABI §3 transfer, §13.2 (v1.3.1): ContractNotAuthorized unless
    // is_eligible(underlying, contract), checked after NotEligible: a position
    // is not handed to a new participant while the escrow cannot settle it.
    let t = setup();
    let put = t.put(&t.writer);
    let call = t.call(&t.writer);
    let bond = t.offer(&t.writer, &t.bond, OptionType::Put);
    for id in [put, call, bond] {
        t.c.buy(&t.holder, &id);
    }
    // the issuer de-authorizes the contract on RWA after the purchases
    t.sac(&t.rwa).set_authorized(&t.contract, &false);
    assert!(!t.c.is_eligible(&t.rwa, &t.contract));
    let before = t.snap();

    for id in [put, call] {
        assert_err(
            t.c.try_transfer(&t.holder, &t.maker2, &id),
            Error::ContractNotAuthorized,
        );
        assert!(t.env.events().all().events().is_empty());
        // check order: ownership, to == holder, to == writer and the
        // recipient's eligibility come first
        assert_err(
            t.c.try_transfer(&t.maker2, &t.holder, &id),
            Error::NotHolder,
        );
        assert_err(
            t.c.try_transfer(&t.holder, &t.holder, &id),
            Error::InvalidArgs,
        );
        assert_err(
            t.c.try_transfer(&t.holder, &t.writer, &id),
            Error::SelfTrade,
        );
        assert_err(
            t.c.try_transfer(&t.holder, &t.outsider, &id),
            Error::NotEligible,
        );
    }
    // time comes first as well
    t.at(EXPIRY);
    assert_err(t.c.try_transfer(&t.holder, &t.maker2, &put), Error::Expired);
    t.at(START);
    assert_eq!(t.snap(), before);
    assert_eq!(t.holder_of(put), Some(t.holder.clone()));
    assert_eq!(t.holder_of(call), Some(t.holder.clone()));

    // BOND positions are unaffected
    t.c.transfer(&t.holder, &t.maker2, &bond);
    assert_eq!(t.holder_of(bond), Some(t.maker2.clone()));

    // once the issuer re-authorizes the contract the transfers go through and
    // the new holder settles
    t.sac(&t.rwa).set_authorized(&t.contract, &true);
    t.c.transfer(&t.holder, &t.maker2, &put);
    t.c.transfer(&t.holder, &t.maker2, &call);
    assert_eq!(t.holder_of(put), Some(t.maker2.clone()));
    assert_eq!(t.holder_of(call), Some(t.maker2.clone()));
    t.c.exercise(&t.maker2, &call);
    assert_eq!(t.state(call), State::Exercised);
}

#[test]
fn transfer_rejects_during_shortfall() {
    // ABI §3 transfer, §6, §13.2 (v1.3.1): CollateralShortfall if
    // balance(contract) < open_collateral(token) for the option's quote or
    // underlying, checked after ContractNotAuthorized.
    let t = setup();
    let call = t.call(&t.writer); // RWA collateral in the pool
    let put = t.put(&t.writer); // USDx collateral, same underlying
    let bond_call = t.offer(&t.writer, &t.bond, OptionType::Call);
    for id in [call, put, bond_call] {
        t.c.buy(&t.holder, &id);
    }
    // the issuer claws 1 RWA back from the contract's pooled balance
    t.sac(&t.rwa).clawback(&t.contract, &UNIT);
    assert_eq!(t.bal(&t.rwa, &t.contract), QTY - UNIT);
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);
    let before = t.snap();

    // a deficit on the underlying blocks the transfer of every option on it
    for id in [call, put] {
        assert_err(
            t.c.try_transfer(&t.holder, &t.maker2, &id),
            Error::CollateralShortfall,
        );
        assert!(t.env.events().all().events().is_empty());
        // check order: the recipient's eligibility comes first
        assert_err(
            t.c.try_transfer(&t.holder, &t.outsider, &id),
            Error::NotEligible,
        );
    }
    // ... and so does the contract's own authorization
    t.sac(&t.rwa).set_authorized(&t.contract, &false);
    assert_err(
        t.c.try_transfer(&t.holder, &t.maker2, &call),
        Error::ContractNotAuthorized,
    );
    t.sac(&t.rwa).set_authorized(&t.contract, &true);
    assert_eq!(t.snap(), before);

    // BOND has no deficit
    t.c.transfer(&t.holder, &t.maker2, &bond_call);
    assert_eq!(t.holder_of(bond_call), Some(t.maker2.clone()));

    // after the issuer repairs the pooled balance the transfers succeed
    t.sac(&t.rwa).mint(&t.contract, &UNIT);
    assert_eq!(t.bal(&t.rwa, &t.contract), t.c.open_collateral(&t.rwa));
    t.c.transfer(&t.holder, &t.maker2, &call);
    t.c.transfer(&t.holder, &t.maker2, &put);
    assert_eq!(t.holder_of(call), Some(t.maker2.clone()));
    assert_eq!(t.holder_of(put), Some(t.maker2.clone()));
}

#[test]
fn transfer_rejects_during_quote_shortfall() {
    // the quote side of the same guard: every option shares USDx, so a USDx
    // deficit blocks transfers on every underlying
    let t = setup();
    // make USDx clawback-enabled before the contract's USDx balance exists
    t.usdx_flags.set_flag(IssuerFlags::RevocableFlag);
    t.usdx_flags.set_flag(IssuerFlags::ClawbackEnabledFlag);
    let put = t.put(&t.writer);
    let bond_call = t.offer(&t.writer, &t.bond, OptionType::Call);
    t.c.buy(&t.holder, &put);
    t.c.buy(&t.holder, &bond_call);
    t.sac(&t.usdx).clawback(&t.contract, &UNIT);
    assert_eq!(t.bal(&t.usdx, &t.contract), STRIKE - UNIT);
    assert_eq!(t.c.open_collateral(&t.usdx), STRIKE);
    let before = t.snap();

    for id in [put, bond_call] {
        assert_err(
            t.c.try_transfer(&t.holder, &t.maker2, &id),
            Error::CollateralShortfall,
        );
    }
    assert_eq!(t.snap(), before);

    t.sac(&t.usdx).mint(&t.contract, &UNIT);
    t.c.transfer(&t.holder, &t.maker2, &put);
    t.c.transfer(&t.holder, &t.maker2, &bond_call);
    assert_eq!(t.holder_of(put), Some(t.maker2.clone()));
    assert_eq!(t.holder_of(bond_call), Some(t.maker2.clone()));
}

#[test]
fn frozen_holder_can_still_transfer() {
    // ABI §13.2: the v1.3.1 guards concern the escrow and the incoming holder;
    // a holder frozen on the underlying may still transfer (its own tokens never
    // move), and the new holder settles.
    let t = setup();
    let put = t.put(&t.writer);
    let call = t.call(&t.writer);
    t.c.buy(&t.holder, &put);
    t.c.buy(&t.holder, &call);
    t.sac(&t.rwa).set_authorized(&t.holder, &false);
    assert!(!t.c.is_eligible(&t.rwa, &t.holder));
    // the frozen holder cannot exercise ...
    assert_sac_err(t.c.try_exercise(&t.holder, &put), SAC_DEAUTHORIZED);
    let holder_before = t.bals(&t.holder);

    // ... but can hand both positions to an eligible holder
    t.c.transfer(&t.holder, &t.maker2, &put);
    t.c.transfer(&t.holder, &t.maker2, &call);
    assert_eq!(t.holder_of(put), Some(t.maker2.clone()));
    assert_eq!(t.holder_of(call), Some(t.maker2.clone()));
    assert_eq!(t.bals(&t.holder), holder_before);

    t.c.exercise(&t.maker2, &put);
    t.c.exercise(&t.maker2, &call);
    assert_eq!(t.state(put), State::Exercised);
    assert_eq!(t.state(call), State::Exercised);
    assert_eq!(t.bal(&t.rwa, &t.maker2), UNDERLYING_START);
    assert_eq!(t.bal(&t.usdx, &t.maker2), USDX_START);
}

#[test]
fn list_asset_already_listed_before_undeployed_probe() {
    // ABI §3 list_asset, §13.4 (v1.3.1): AlreadyListed (listed, or the quote
    // token) is checked before the AssetNotDeployed probe.
    let t = setup();
    // the quote token's own code and issuer
    let (code, issuer) = code_and_issuer(&t, &t.usdx);
    assert_err(
        t.c.try_list_asset(&t.maker2, &code, &issuer),
        Error::AlreadyListed,
    );
    assert_eq!(t.c.asset_count(), 2);

    // The constructor does not probe its addresses, so a contract seeded with
    // the canonical SAC addresses of classic assets whose SACs are not deployed
    // tells the two orders apart (v1.3 returned AssetNotDeployed here).
    let (k_under, k_quote, k_other) = ([21u8; 32], [22u8; 32], [23u8; 32]);
    let under = classic_sac_address(&t.env, "UNDEP", k_under);
    let quote = classic_sac_address(&t.env, "QUOTE", k_quote);
    let id = t.env.register(
        OptionsContract,
        (quote.clone(), vec![&t.env, under.clone()]),
    );
    let c2 = OptionsContractClient::new(&t.env, &id);
    assert!(c2.is_listed(&under));
    for sac in [&under, &quote] {
        assert!(TokenClient::new(&t.env, sac).try_decimals().is_err());
    }

    // the seeded underlying and the quote: AlreadyListed, not AssetNotDeployed
    assert_err(
        c2.try_list_asset(&t.maker2, &s(&t, "UNDEP"), &g_account(&t.env, k_under)),
        Error::AlreadyListed,
    );
    assert_err(
        c2.try_list_asset(&t.maker2, &s(&t, "QUOTE"), &g_account(&t.env, k_quote)),
        Error::AlreadyListed,
    );
    // control: an undeployed asset that is not listed reaches the probe
    assert_err(
        c2.try_list_asset(&t.maker2, &s(&t, "OTHER"), &g_account(&t.env, k_other)),
        Error::AssetNotDeployed,
    );
    // InvalidArgs still comes first
    assert_err(
        c2.try_list_asset(&t.maker2, &s(&t, "UN-DEP"), &g_account(&t.env, k_under)),
        Error::InvalidArgs,
    );
    assert_eq!(c2.asset_count(), 1);
    assert_eq!(c2.list_assets(&0, &MAX_PAGE), vec![&t.env, under]);
}

#[test]
fn extend_ttl_extends_registry_writer_and_book_entries() {
    // ABI §3 Views, §8, §13.5, §13.8 (v1.3.1): extend_ttl(ids) also extends
    // Listed(underlying), WriterOpen(writer), OpenFor(underlying),
    // Reserved(quote) and Reserved(underlying) of each id, plus
    // AssetAt(0..min(asset_count, MAX_PAGE)) and their Listed entries.
    let t = setup();
    // a listed 3rd asset with no offers: covered only through the registry
    let (third, code, issuer) = new_asset(&t, false);
    t.c.list_asset(&t.maker2, &code, &issuer);
    // maker2's RWA CALL creates Reserved(RWA); the writer's PUT is the id kept alive
    t.call(&t.maker2);
    let id = t.put(&t.writer);
    age_below_ttl_threshold(&t);

    let keys: [(&str, Val); 10] = [
        ("Listed", t.rwa.clone().into_val(&t.env)),
        ("WriterOpen", t.writer.clone().into_val(&t.env)),
        ("OpenFor", t.rwa.clone().into_val(&t.env)),
        ("AssetAt", 0u32.into_val(&t.env)),
        ("AssetAt", 1u32.into_val(&t.env)),
        ("AssetAt", 2u32.into_val(&t.env)),
        ("Listed", t.bond.clone().into_val(&t.env)),
        ("Listed", third.clone().into_val(&t.env)),
        ("Reserved", t.usdx.clone().into_val(&t.env)),
        ("Reserved", t.rwa.clone().into_val(&t.env)),
    ];
    // precondition: every entry is below the 7-day threshold
    for (variant, arg) in keys.iter() {
        let ttl = key_ttl(&t, variant, *arg);
        assert!(ttl < 7 * DAY, "precondition: {variant} TTL {ttl}");
    }

    t.c.extend_ttl(&vec![&t.env, id]);
    for (variant, arg) in keys.iter() {
        let ttl = key_ttl(&t, variant, *arg);
        assert!(ttl >= 29 * DAY, "{variant} TTL {ttl}");
    }
    assert_ttls_extended(&t, id);
}

#[test]
fn reserved_is_persistent_and_extended_on_touch() {
    // ABI §8, §13.8 (v1.3.1): Reserved(token) is one persistent entry per token
    // (instance storage holds only Quote, Underlyings, Next and AssetCount), and
    // its TTL is extended by every state-changing path that touches it.
    let t = setup();
    let put = t.put(&t.writer);
    let call = t.call(&t.maker2);
    t.env.as_contract(&t.contract, || {
        for token in [&t.usdx, &t.rwa] {
            let key = Key::Reserved(token.clone());
            assert!(!t.env.storage().instance().has(&key));
            assert!(t.env.storage().persistent().has(&key));
        }
    });
    assert_eq!(t.c.open_collateral(&t.usdx), STRIKE);
    assert_eq!(t.c.open_collateral(&t.rwa), QTY);

    // buy moves no collateral; cancel_offer of the CALL touches Reserved(RWA)
    // only, a new PUT touches Reserved(USDx) only
    age_below_ttl_threshold(&t);
    for token in [&t.usdx, &t.rwa] {
        let ttl = key_ttl(&t, "Reserved", token.clone().into_val(&t.env));
        assert!(ttl < 7 * DAY, "precondition: Reserved TTL {ttl}");
    }
    t.c.cancel_offer(&t.maker2, &call);
    let rwa = key_ttl(&t, "Reserved", t.rwa.clone().into_val(&t.env));
    assert!(rwa >= 29 * DAY, "Reserved(RWA) TTL after cancel {rwa}");
    assert_eq!(t.c.open_collateral(&t.rwa), 0);
    t.put(&t.maker2);
    let usdx = key_ttl(&t, "Reserved", t.usdx.clone().into_val(&t.env));
    assert!(
        usdx >= 29 * DAY,
        "Reserved(USDx) TTL after create_offer {usdx}"
    );
    assert_eq!(t.c.open_collateral(&t.usdx), 2 * STRIKE);
    assert_eq!(t.state(put), State::Offered);
}
