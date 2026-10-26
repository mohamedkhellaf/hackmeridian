#![cfg(test)]
//! Test suite for the `options` contract, written against the locked ABI in
//! `docs/contract-abi.md` (sections 2–8).
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
    vec, Address, Env, Event as _, IntoVal, InvokeError, Symbol, Val, Vec,
};
use std::fmt::Debug;

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
fn open_list_cap_returns_open_list_full() {
    let t = setup();
    assert_eq!(MAX_OPEN, 1000);
    // 1-unit PUTs: 1000 offers lock 1000 USDx units of the writer's USDX_START.
    let tiny_put = |writer: &Address| {
        t.c.try_create_offer(writer, &t.rwa, &OptionType::Put, &1, &1, &1, &EXPIRY)
    };
    for i in 0..MAX_OPEN {
        assert_eq!(tiny_put(&t.writer), Ok(Ok(i)));
    }
    assert_eq!(t.c.list_open().len(), MAX_OPEN);
    assert_eq!(t.c.open_collateral(&t.usdx), MAX_OPEN as i128);
    let before = t.snap();

    // the cap is global: any writer, any underlying, PUT or CALL
    assert_err(tiny_put(&t.writer), Error::OpenListFull);
    assert_err(tiny_put(&t.maker2), Error::OpenListFull);
    assert_err(
        t.c.try_create_offer(&t.maker2, &t.bond, &OptionType::Call, &1, &1, &1, &EXPIRY),
        Error::OpenListFull,
    );
    // check order: InvalidArgs and NotEligible come before OpenListFull
    assert_err(
        t.c.try_create_offer(&t.writer, &t.rwa, &OptionType::Put, &0, &1, &1, &EXPIRY),
        Error::InvalidArgs,
    );
    assert_err(tiny_put(&t.outsider), Error::NotEligible);
    assert_eq!(t.snap(), before);

    // a cancelled or bought offer frees exactly one slot
    t.c.cancel_offer(&t.writer, &0);
    assert_eq!(tiny_put(&t.maker2), Ok(Ok(MAX_OPEN)));
    assert_err(tiny_put(&t.maker2), Error::OpenListFull);
    t.c.buy(&t.holder, &1);
    assert_eq!(tiny_put(&t.maker2), Ok(Ok(MAX_OPEN + 1)));
    assert_err(tiny_put(&t.maker2), Error::OpenListFull);
    assert_eq!(t.c.list_open().len(), MAX_OPEN);
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

    // 60 options: one call returns at most MAX_PAGE = 50
    for _ in 7..60 {
        t.c.create_offer(&t.writer, &t.rwa, &OptionType::Put, &1, &1, &1, &EXPIRY);
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
#[test]
fn sub_reserved_rejects_negative_result_on_corrupted_reserve() {
    let t = setup();
    let id = t.put(&t.writer);
    t.env.as_contract(&t.contract, || {
        t.env
            .storage()
            .instance()
            .set(&Key::Reserved(t.usdx.clone()), &0i128)
    });
    let before = t.snap();
    assert_err(t.c.try_cancel_offer(&t.writer, &id), Error::Overflow);
    assert_eq!(t.snap(), before);
}
