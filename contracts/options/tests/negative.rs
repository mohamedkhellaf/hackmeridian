//! Negative-path (misuse) tests for the `options` contract v1.2 (ABI: `docs/contract-abi.md`).
//!
//! Every test drives a misuse path from the attacker's side and asserts BOTH that the contract
//! rejects it (typed `Error` by name, or a host/SAC error identified by its root cause) AND that
//! nothing observable changed (all balances of every tracked party, reserved totals, the open
//! list, `option_count`, every stored `OptionData`) and that no contract event was emitted.
//!
//! Contract errors are `options::Error`, codes 101–115 (renumbered in v1.1, unchanged in v1.2),
//! and are matched by variant name, never by number. v1.2 adds `transfer(holder, to, id)`,
//! `get_options(from, limit)` and the `OptionTransferred` event: sections 16 and 17 cover them,
//! and sections 1, 2, 3, 12 and 15 include `transfer` in their existing checks.
//!
//! Conventions (soroban-sdk 28 / soroban-env-host 28):
//! - `Address::generate` returns CONTRACT addresses. Classic `G` accounts are built explicitly
//!   (`T::g_account`): an account ledger entry is inserted and trustlines are created through the
//!   SAC's own `trust` function, so the SAC trustline semantics (missing trustline = SAC #13,
//!   i64 amounts, AUTHORIZED flag) are exercised for real.
//! - The host flattens every non-contract failure of a top-level call into
//!   `Error(Context, InvalidAction)`. The granular root cause (for example
//!   `Error(Auth, InvalidAction)`) is only observable in the diagnostic events, so
//!   `T::root_error` reads the first `error` diagnostic event of the last invocation.
//! - `env.mock_auths` is used to build auth trees shaped exactly like real signed entries (root
//!   invocation plus SAC `transfer` sub-invocations); it switches the host to ENFORCING mode.
//! - `env.events().all()` and the diagnostic events describe only the most recent top-level
//!   invocation, so they are read immediately after the call under test (before `snap()`).
//! - Tests whose name starts with `finding_` are `#[ignore]`d on purpose: they assert the
//!   secure behaviour and FAIL against v1.2. Run them with `-- --ignored`.
#![allow(clippy::too_many_arguments, clippy::type_complexity)]

use options::{Error, OptionData, OptionType, OptionsContract, OptionsContractClient, State};
use soroban_sdk::{
    contract, contractimpl,
    testutils::{
        storage::{Instance as _, Persistent as _},
        Address as _, Events as _, IssuerFlags, Ledger as _, MockAuth, MockAuthInvoke,
        MuxedAddress as _, StellarAssetIssuer,
    },
    token::{StellarAssetClient, TokenClient},
    vec, xdr, Address, Env, IntoVal, InvokeError, MuxedAddress, Symbol, TryFromVal, Val, Vec,
};
use std::{
    cell::{Cell, RefCell},
    fmt::Debug,
    rc::Rc,
};

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------

const UNIT: i128 = 10_000_000; // 1 token, 7 decimals
const QTY: i128 = 50_000_000; // 5 RWA
const STRIKE: i128 = 500_000_000; // 50 USDx total strike
const PREMIUM: i128 = 10_000_000; // 1 USDx total premium

const USDX_START: i128 = 1_000 * UNIT;
const UNDERLYING_START: i128 = 100 * UNIT;

const START: u64 = 1_793_000_000;
const EXPIRY: u64 = START + 7 * 86_400;

const DAY: u32 = 17_280; // ledgers per day (ABI §8)

/// ABI §10: `create_offer` fails with `OpenListFull` at this many `Offered` ids.
const MAX_OPEN: u32 = 1000;
/// soroban-sdk 28 default (mainnet snapshot) limit on footprint ledger entries per invocation.
const FOOTPRINT_LIMIT: u32 = 400;
/// ABI §3 (v1.2): one `get_options` call returns at most this many options.
const MAX_PAGE: u32 = 50;

// SAC ContractError codes (soroban-env-host builtin_contracts/contract_error.rs).
const SAC_BALANCE: u32 = 10;
const SAC_DEAUTHORIZED: u32 = 11;
const SAC_OVERFLOW: u32 = 12;
const SAC_NO_TRUSTLINE: u32 = 13;

const AUTH_INVALID: xdr::ScError = xdr::ScError::Auth(xdr::ScErrorCode::InvalidAction);

// ---------------------------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------------------------

struct T {
    env: Env,
    contract: Address,
    c: OptionsContractClient<'static>,
    usdx: Address,
    rwa: Address,
    bond: Address,
    /// Classic issuer behind the USDx SAC (to change its flags in a test).
    usdx_flags: StellarAssetIssuer,
    writer: Address,
    holder: Address,
    maker2: Address,
    holder2: Address,
    /// Has USDx but is NOT authorized on RWA/BOND.
    outsider: Address,
    /// Extra parties created by a test (G accounts, fresh contract actors); part of every snap.
    extra: RefCell<std::vec::Vec<Address>>,
    g_seq: Cell<u32>,
}

/// Everything a rejected call must leave untouched.
#[derive(Clone, Debug, Eq, PartialEq)]
struct Snap {
    /// (party, [USDx, RWA, BOND]) — `None` = no trustline (G account).
    balances: std::vec::Vec<(Address, [Option<i128>; 3])>,
    open_collateral: [i128; 3],
    count: u32,
    open: std::vec::Vec<u32>,
    options: std::vec::Vec<OptionData>,
}

fn setup() -> T {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(START);

    let usdx_admin = Address::generate(&env);
    let rwa_admin = Address::generate(&env);
    let usdx_sac = env.register_stellar_asset_contract_v2(usdx_admin);
    let rwa_sac = env.register_stellar_asset_contract_v2(rwa_admin.clone());
    let bond_sac = env.register_stellar_asset_contract_v2(rwa_admin);
    // Regulated underlyings, flags set before any balance exists.
    for sac in [&rwa_sac, &bond_sac] {
        let issuer = sac.issuer();
        issuer.set_flag(IssuerFlags::RequiredFlag);
        issuer.set_flag(IssuerFlags::RevocableFlag);
        issuer.set_flag(IssuerFlags::ClawbackEnabledFlag);
    }
    let usdx = usdx_sac.address();
    let rwa = rwa_sac.address();
    let bond = bond_sac.address();

    let contract = env.register(
        OptionsContract,
        (usdx.clone(), vec![&env, rwa.clone(), bond.clone()]),
    );
    let c = OptionsContractClient::new(&env, &contract);
    for u in [&rwa, &bond] {
        StellarAssetClient::new(&env, u).set_authorized(&contract, &true);
    }

    let actor = |authorized: bool| {
        let a = Address::generate(&env);
        StellarAssetClient::new(&env, &usdx).mint(&a, &USDX_START);
        if authorized {
            for u in [&rwa, &bond] {
                let s = StellarAssetClient::new(&env, u);
                s.set_authorized(&a, &true);
                s.mint(&a, &UNDERLYING_START);
            }
        }
        a
    };
    let writer = actor(true);
    let holder = actor(true);
    let maker2 = actor(true);
    let holder2 = actor(true);
    let outsider = actor(false);

    T {
        env,
        contract,
        c,
        usdx,
        rwa,
        bond,
        usdx_flags: usdx_sac.issuer(),
        writer,
        holder,
        maker2,
        holder2,
        outsider,
        extra: RefCell::new(std::vec::Vec::new()),
        g_seq: Cell::new(0),
    }
}

impl T {
    fn tokens(&self) -> [Address; 3] {
        [self.usdx.clone(), self.rwa.clone(), self.bond.clone()]
    }

    fn sac(&self, token: &Address) -> StellarAssetClient<'static> {
        StellarAssetClient::new(&self.env, token)
    }

    fn tracked(&self) -> std::vec::Vec<Address> {
        let mut v = std::vec![
            self.writer.clone(),
            self.holder.clone(),
            self.maker2.clone(),
            self.holder2.clone(),
            self.outsider.clone(),
            self.contract.clone(),
        ];
        v.extend(self.extra.borrow().iter().cloned());
        v
    }

    fn bal(&self, token: &Address, who: &Address) -> i128 {
        TokenClient::new(&self.env, token).balance(who)
    }

    fn bal_opt(&self, token: &Address, who: &Address) -> Option<i128> {
        match TokenClient::new(&self.env, token).try_balance(who) {
            Ok(Ok(v)) => Some(v),
            _ => None,
        }
    }

    fn snap(&self) -> Snap {
        let tokens = self.tokens();
        let count = self.c.option_count();
        Snap {
            balances: self
                .tracked()
                .into_iter()
                .map(|a| {
                    let b = [
                        self.bal_opt(&tokens[0], &a),
                        self.bal_opt(&tokens[1], &a),
                        self.bal_opt(&tokens[2], &a),
                    ];
                    (a, b)
                })
                .collect(),
            open_collateral: [
                self.c.open_collateral(&tokens[0]),
                self.c.open_collateral(&tokens[1]),
                self.c.open_collateral(&tokens[2]),
            ],
            count,
            open: self.c.list_open().iter().collect(),
            options: (0..count)
                .filter_map(|id| self.c.try_get_option(&id).ok().map(|r| r.unwrap()))
                .collect(),
        }
    }

    /// Sum of every tracked party's balance (incl. the contract), per token.
    fn totals(&self) -> [i128; 3] {
        let tokens = self.tokens();
        let mut t = [0i128; 3];
        for a in self.tracked() {
            for (i, tok) in tokens.iter().enumerate() {
                t[i] += self.bal_opt(tok, &a).unwrap_or(0);
            }
        }
        t
    }

    fn offer_x(
        &self,
        w: &Address,
        u: &Address,
        ty: OptionType,
        qty: i128,
        strike: i128,
        premium: i128,
        expiry: u64,
    ) -> u32 {
        self.c
            .create_offer(w, u, &ty, &qty, &strike, &premium, &expiry)
    }

    fn offer(&self, w: &Address, u: &Address, ty: OptionType) -> u32 {
        self.offer_x(w, u, ty, QTY, STRIKE, PREMIUM, EXPIRY)
    }

    fn put(&self, w: &Address) -> u32 {
        self.offer(w, &self.rwa, OptionType::Put)
    }

    fn call(&self, w: &Address) -> u32 {
        self.offer(w, &self.rwa, OptionType::Call)
    }

    fn state(&self, id: u32) -> State {
        self.c.get_option(&id).state
    }

    fn at(&self, ts: u64) {
        self.env.ledger().set_timestamp(ts);
    }

    /// (event name, id topic, number of topics) of every options-contract event of the last
    /// invocation.
    fn opt_events(&self) -> std::vec::Vec<(std::string::String, u32, usize)> {
        self.env
            .events()
            .all()
            .filter_by_contract(&self.contract)
            .events()
            .iter()
            .map(|e| {
                let xdr::ContractEventBody::V0(v0) = &e.body;
                let name = match &v0.topics[0] {
                    xdr::ScVal::Symbol(s) => s.0.to_utf8_string_lossy(),
                    o => panic!("unexpected topic {o:?}"),
                };
                let id = match &v0.topics[1] {
                    xdr::ScVal::U32(i) => *i,
                    o => panic!("unexpected topic {o:?}"),
                };
                (name, id, v0.topics.len())
            })
            .collect()
    }

    /// No contract event at all (options or SAC) in the last invocation.
    fn no_events(&self) -> bool {
        self.env.events().all().events().is_empty()
    }

    #[track_caller]
    fn assert_one_event(&self, name: &str, id: u32) {
        assert_eq!(
            self.opt_events(),
            std::vec![(std::string::String::from(name), id, 2usize)],
            "exactly one `{name}` event for id {id}"
        );
    }

    /// First `error` diagnostic event of the last invocation (the root cause of a failure).
    fn root_error(&self) -> Option<xdr::ScError> {
        let evs = self.env.host().get_diagnostic_events().unwrap();
        evs.0.iter().find_map(|he| {
            let xdr::ContractEventBody::V0(v0) = &he.event.body;
            match (v0.topics.first(), v0.topics.get(1)) {
                (Some(xdr::ScVal::Symbol(s)), Some(xdr::ScVal::Error(e)))
                    if s.0.to_utf8_string_lossy() == "error" =>
                {
                    Some(e.clone())
                }
                _ => None,
            }
        })
    }

    /// Raw invocation that keeps the host error value.
    fn raw(&self, func: &str, args: Vec<Val>) -> Result<(), soroban_sdk::Error> {
        match self.env.try_invoke_contract::<Val, soroban_sdk::Error>(
            &self.contract,
            &Symbol::new(&self.env, func),
            args,
        ) {
            Ok(_) => Ok(()),
            Err(Ok(e)) => Err(e),
            Err(Err(e)) => panic!("unconvertible error {e:?}"),
        }
    }

    /// The last call failed with a host error whose root cause is `want`, emitted no event, and
    /// left everything as in `before`.
    #[track_caller]
    fn assert_rejected_root(
        &self,
        label: &str,
        r: Result<(), soroban_sdk::Error>,
        want: xdr::ScError,
        before: &Snap,
    ) {
        assert!(r.is_err(), "{label}: expected a failure, got Ok");
        let root = self.root_error();
        let quiet = self.no_events();
        assert_eq!(root, Some(want), "{label}: root cause");
        assert!(quiet, "{label}: a failed call must not emit events");
        assert_eq!(&self.snap(), before, "{label}: state changed");
    }

    /// Creates a classic G account (account entry with an XLM balance, no trustlines).
    fn g_account(&self) -> Address {
        let n = self.g_seq.get();
        self.g_seq.set(n + 1);
        let mut pk = [0xA5u8; 32];
        pk[..4].copy_from_slice(&n.to_be_bytes());
        let account_id = xdr::AccountId(xdr::PublicKey::PublicKeyTypeEd25519(xdr::Uint256(pk)));
        let key = Rc::new(xdr::LedgerKey::Account(xdr::LedgerKeyAccount {
            account_id: account_id.clone(),
        }));
        let entry = Rc::new(xdr::LedgerEntry {
            data: xdr::LedgerEntryData::Account(xdr::AccountEntry {
                account_id: account_id.clone(),
                balance: 1_000_000_000,
                flags: 0,
                home_domain: Default::default(),
                inflation_dest: None,
                num_sub_entries: 0,
                seq_num: xdr::SequenceNumber(0),
                thresholds: xdr::Thresholds([1; 4]),
                signers: Default::default(),
                ext: xdr::AccountEntryExt::V0,
            }),
            last_modified_ledger_seq: 0,
            ext: xdr::LedgerEntryExt::V0,
        });
        self.env
            .host()
            .add_ledger_entry(&key, &entry, None)
            .unwrap();
        let a = Address::try_from_val(&self.env, &xdr::ScAddress::Account(account_id)).unwrap();
        self.extra.borrow_mut().push(a.clone());
        a
    }

    /// G account with the given trustlines; underlying trustlines authorized iff `authorize`;
    /// `mint` amounts per [USDx, RWA, BOND] (only where a trustline exists).
    fn g_actor(&self, trust: [bool; 3], authorize: bool, mint: [i128; 3]) -> Address {
        let g = self.g_account();
        for (i, tok) in self.tokens().iter().enumerate() {
            if !trust[i] {
                continue;
            }
            let s = self.sac(tok);
            s.trust(&g);
            if i > 0 && authorize {
                s.set_authorized(&g, &true);
            }
            if mint[i] > 0 {
                s.mint(&g, &mint[i]);
            }
        }
        g
    }

    /// Fresh contract-address actor funded and authorized like `g_actor(.., true, ..)`.
    fn c_actor(&self, mint: [i128; 3]) -> Address {
        let a = Address::generate(&self.env);
        for (i, tok) in self.tokens().iter().enumerate() {
            let s = self.sac(tok);
            if i > 0 {
                s.set_authorized(&a, &true);
            }
            if mint[i] > 0 {
                s.mint(&a, &mint[i]);
            }
        }
        self.extra.borrow_mut().push(a.clone());
        a
    }

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

    /// ABI §2 derived reserve per token [USDx, RWA, BOND], summed over every stored option.
    fn abi_reserves(&self) -> [i128; 3] {
        let tokens = self.tokens();
        let idx = |a: &Address| tokens.iter().position(|t| t == a).unwrap();
        let mut r = [0i128; 3];
        for id in 0..self.c.option_count() {
            let o = self.c.get_option(&id);
            let leg = match (o.state, o.option_type) {
                (State::Offered | State::Active, OptionType::Put) => {
                    Some((&o.quote, o.strike_total))
                }
                (State::Offered | State::Active, OptionType::Call) => Some((&o.underlying, o.qty)),
                (State::Exercised, OptionType::Put) => Some((&o.underlying, o.qty)),
                (State::Exercised, OptionType::Call) => Some((&o.quote, o.strike_total)),
                _ => None,
            };
            if let Some((tok, amt)) = leg {
                r[idx(tok)] += amt;
            }
        }
        r
    }
}

#[track_caller]
fn assert_err<T: Debug>(res: Result<T, Result<Error, InvokeError>>, expected: Error) {
    match res {
        Err(Ok(e)) => assert_eq!(e, expected),
        other => panic!("expected Err(Ok({expected:?})), got {other:?}"),
    }
}

#[track_caller]
fn assert_sac_err<T: Debug>(res: Result<T, Result<Error, InvokeError>>, code: u32) {
    match res {
        Err(Err(InvokeError::Contract(c))) => assert_eq!(c, code, "SAC error code"),
        other => panic!("expected SAC error #{code}, got {other:?}"),
    }
}

/// Typed rejection + no event + nothing changed.
#[track_caller]
fn rejected<R: Debug>(t: &T, res: Result<R, Result<Error, InvokeError>>, e: Error, before: &Snap) {
    let quiet = t.no_events();
    assert_err(res, e);
    assert!(quiet, "a failed call ({e:?}) must not emit events");
    assert_eq!(&t.snap(), before, "state changed after {e:?}");
}

/// SAC rejection + no event + nothing changed.
#[track_caller]
fn sac_rejected<R: Debug>(
    t: &T,
    res: Result<R, Result<Error, InvokeError>>,
    code: u32,
    before: &Snap,
) {
    let quiet = t.no_events();
    assert_sac_err(res, code);
    assert!(quiet, "a failed call (SAC #{code}) must not emit events");
    assert_eq!(&t.snap(), before, "state changed after SAC #{code}");
}

fn transfer<'a>(t: &'a T, token: &'a Address, args: Vec<Val>) -> MockAuthInvoke<'a> {
    let _ = t;
    MockAuthInvoke {
        contract: token,
        fn_name: "transfer",
        args,
        sub_invokes: &[],
    }
}

/// Auth tree of the options contract's `transfer(from, to, id)` (v1.2): a root with no
/// sub-invocation, since no token moves.
fn xfer<'a>(t: &'a T, from: &Address, to: &Address, id: u32) -> MockAuthInvoke<'a> {
    MockAuthInvoke {
        contract: &t.contract,
        fn_name: "transfer",
        args: (from, to, id).into_val(&t.env),
        sub_invokes: &[],
    }
}

/// Runs `func(args)` once per auth-tree case and asserts each is rejected by the host's auth
/// check (root cause `Error(Auth, InvalidAction)`), with no event and no state change.
fn assert_auth_cases(
    t: &T,
    func: &str,
    args: &Vec<Val>,
    cases: &[(&str, std::vec::Vec<MockAuth>)],
) {
    let before = t.snap();
    for (label, auths) in cases {
        t.env.mock_auths(auths);
        let r = t.raw(func, args.clone());
        t.assert_rejected_root(&std::format!("{func}: {label}"), r, AUTH_INVALID, &before);
    }
}

// =============================================================================================
// 1. Third-party calls with someone else's address (no middleware replay)
// =============================================================================================

#[test]
fn auth1_buy_rejects_third_party_and_replayed_premium_transfer() {
    let t = setup();
    let env = &t.env;
    let id = t.put(&t.writer);
    let other = t.put(&t.maker2);
    let foreign = Address::generate(env);

    let fee = transfer(&t, &t.usdx, (&t.holder, &t.writer, PREMIUM).into_val(env));
    let buy = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "buy",
        args: (&t.holder, id).into_val(env),
        sub_invokes: std::slice::from_ref(&fee),
    };
    let fee_other = transfer(&t, &t.usdx, (&t.holder, &t.maker2, PREMIUM).into_val(env));
    let buy_other = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "buy",
        args: (&t.holder, other).into_val(env),
        sub_invokes: std::slice::from_ref(&fee_other),
    };
    let via_foreign = MockAuthInvoke {
        contract: &foreign,
        fn_name: "settle",
        args: (&t.holder, id).into_val(env),
        sub_invokes: std::slice::from_ref(&fee),
    };
    let buy_root_only = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "buy",
        args: (&t.holder, id).into_val(env),
        sub_invokes: &[],
    };

    let args: Vec<Val> = (&t.holder, id).into_val(env);
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![
        (
            "maker2 signs the holder-shaped tree",
            std::vec![MockAuth {
                address: &t.maker2,
                invoke: &buy
            }]
        ),
        (
            "writer signs the holder-shaped tree",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &buy
            }]
        ),
        (
            "holder's pre-signed premium transfer alone (middleware replay)",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &fee
            }]
        ),
        (
            "holder's premium transfer under a foreign root",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &via_foreign
            }]
        ),
        (
            "holder's signed tree for a different offer",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &buy_other
            }]
        ),
        (
            "maker2 signs the root, holder's inner transfer replayed",
            std::vec![
                MockAuth {
                    address: &t.maker2,
                    invoke: &buy
                },
                MockAuth {
                    address: &t.holder,
                    invoke: &fee
                },
            ]
        ),
        ("no signature at all", std::vec![]),
    ];
    assert_auth_cases(&t, "buy", &args, &cases);

    // The holder signed the root but not the premium transfer: the SAC refuses (still Auth).
    let before = t.snap();
    env.mock_auths(&[MockAuth {
        address: &t.holder,
        invoke: &buy_root_only,
    }]);
    let r = t.raw("buy", args.clone());
    t.assert_rejected_root(
        "buy: holder root without premium sub-invocation",
        r,
        AUTH_INVALID,
        &before,
    );

    // Positive control: the holder's real tree is accepted, so the rejections above are about
    // the auth shape and nothing else.
    env.mock_auths(&[MockAuth {
        address: &t.holder,
        invoke: &buy,
    }]);
    t.c.buy(&t.holder, &id);
    assert_eq!(t.state(id), State::Active);
    assert_eq!(t.bal(&t.usdx, &t.holder), USDX_START - PREMIUM);
    assert_eq!(t.bal(&t.usdx, &t.writer), USDX_START - STRIKE + PREMIUM);
}

#[test]
fn auth1_exercise_rejects_third_party_and_replayed_delivery_transfer() {
    let t = setup();
    let env = &t.env;
    let put = t.put(&t.writer);
    let call = t.call(&t.writer);
    t.c.buy(&t.holder, &put);
    t.c.buy(&t.holder, &call);

    // PUT: the holder's auth covers delivering `qty` RWA into the contract.
    let deliver = transfer(&t, &t.rwa, (&t.holder, &t.contract, QTY).into_val(env));
    let ex_put = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "exercise",
        args: (&t.holder, put).into_val(env),
        sub_invokes: std::slice::from_ref(&deliver),
    };
    // CALL: the holder's auth covers paying `strike_total` USDx into the contract.
    let pay = transfer(&t, &t.usdx, (&t.holder, &t.contract, STRIKE).into_val(env));
    let ex_call = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "exercise",
        args: (&t.holder, call).into_val(env),
        sub_invokes: std::slice::from_ref(&pay),
    };
    let buy_tree = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "buy",
        args: (&t.holder, put).into_val(env),
        sub_invokes: std::slice::from_ref(&deliver),
    };
    let ex_put_root_only = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "exercise",
        args: (&t.holder, put).into_val(env),
        sub_invokes: &[],
    };
    let short = transfer(&t, &t.rwa, (&t.holder, &t.contract, QTY - 1).into_val(env));
    let ex_put_wrong_amount = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "exercise",
        args: (&t.holder, put).into_val(env),
        sub_invokes: std::slice::from_ref(&short),
    };

    let put_args: Vec<Val> = (&t.holder, put).into_val(env);
    let put_cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![
        (
            "writer forces the holder's exercise",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &ex_put
            }]
        ),
        (
            "maker2 forces the holder's exercise",
            std::vec![MockAuth {
                address: &t.maker2,
                invoke: &ex_put
            }]
        ),
        (
            "holder's pre-signed RWA delivery alone (middleware replay)",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &deliver
            }]
        ),
        (
            "holder's tree for the other option",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &ex_call
            }]
        ),
        (
            "holder's tree for another function",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &buy_tree
            }]
        ),
        (
            "holder root without the delivery sub-invocation",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &ex_put_root_only
            }]
        ),
        (
            "holder signed a different delivery amount",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &ex_put_wrong_amount
            }]
        ),
        ("no signature at all", std::vec![]),
    ];
    assert_auth_cases(&t, "exercise", &put_args, &put_cases);

    let call_args: Vec<Val> = (&t.holder, call).into_val(env);
    let call_cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![
        (
            "writer forces the holder's exercise",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &ex_call
            }]
        ),
        (
            "holder's pre-signed strike payment alone (middleware replay)",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &pay
            }]
        ),
        (
            "holder's tree for the other option",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &ex_put
            }]
        ),
        ("no signature at all", std::vec![]),
    ];
    assert_auth_cases(&t, "exercise", &call_args, &call_cases);

    // Positive controls.
    env.mock_auths(&[MockAuth {
        address: &t.holder,
        invoke: &ex_put,
    }]);
    t.c.exercise(&t.holder, &put);
    env.mock_auths(&[MockAuth {
        address: &t.holder,
        invoke: &ex_call,
    }]);
    t.c.exercise(&t.holder, &call);
    assert_eq!(t.state(put), State::Exercised);
    assert_eq!(t.state(call), State::Exercised);
}

#[test]
fn auth1_writer_functions_reject_third_party_and_cross_function_replay() {
    let t = setup();
    let env = &t.env;
    let to_cancel = t.put(&t.writer);
    let to_reclaim = t.call(&t.writer);
    let to_claim = t.put(&t.writer);
    t.c.buy(&t.holder, &to_reclaim);
    t.c.buy(&t.holder, &to_claim);
    t.c.exercise(&t.holder, &to_claim);

    let root = |f: &'static str, id: u32| MockAuthInvoke {
        contract: &t.contract,
        fn_name: f,
        args: (&t.writer, id).into_val(env),
        sub_invokes: &[],
    };
    let cancel = root("cancel_offer", to_cancel);
    let cancel_other = root("cancel_offer", to_reclaim);
    let reclaim = root("reclaim", to_reclaim);
    let reclaim_of_cancel = root("reclaim", to_cancel);
    let claim = root("claim_delivery", to_claim);
    let claim_of_cancel = root("claim_delivery", to_cancel);
    let lock = transfer(&t, &t.usdx, (&t.writer, &t.contract, STRIKE).into_val(env));
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
            .into_val(env),
        sub_invokes: std::slice::from_ref(&lock),
    };

    // cancel_offer
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![
        (
            "holder signs the writer-shaped tree",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &cancel
            }]
        ),
        (
            "maker2 signs the writer-shaped tree",
            std::vec![MockAuth {
                address: &t.maker2,
                invoke: &cancel
            }]
        ),
        (
            "writer's tree for another id",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &cancel_other
            }]
        ),
        (
            "writer's reclaim tree for the same id",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &reclaim_of_cancel
            }]
        ),
        (
            "writer's create_offer tree (with collateral transfer)",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &create
            }]
        ),
        ("no signature at all", std::vec![]),
    ];
    assert_auth_cases(
        &t,
        "cancel_offer",
        &(&t.writer, to_cancel).into_val(env),
        &cases,
    );

    // claim_delivery
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![
        (
            "holder signs the writer-shaped tree",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &claim
            }]
        ),
        (
            "writer's claim tree for another id",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &claim_of_cancel
            }]
        ),
        (
            "writer's cancel tree",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &cancel
            }]
        ),
        ("no signature at all", std::vec![]),
    ];
    assert_auth_cases(
        &t,
        "claim_delivery",
        &(&t.writer, to_claim).into_val(env),
        &cases,
    );

    // reclaim (after expiry, so only auth stands in the way)
    t.at(EXPIRY);
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![
        (
            "holder signs the writer-shaped tree",
            std::vec![MockAuth {
                address: &t.holder,
                invoke: &reclaim
            }]
        ),
        (
            "maker2 signs the writer-shaped tree",
            std::vec![MockAuth {
                address: &t.maker2,
                invoke: &reclaim
            }]
        ),
        (
            "writer's cancel tree for another id",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &cancel
            }]
        ),
        ("no signature at all", std::vec![]),
    ];
    assert_auth_cases(
        &t,
        "reclaim",
        &(&t.writer, to_reclaim).into_val(env),
        &cases,
    );

    // Positive controls.
    env.mock_auths(&[MockAuth {
        address: &t.writer,
        invoke: &cancel,
    }]);
    t.c.cancel_offer(&t.writer, &to_cancel);
    env.mock_auths(&[MockAuth {
        address: &t.writer,
        invoke: &claim,
    }]);
    t.c.claim_delivery(&t.writer, &to_claim);
    env.mock_auths(&[MockAuth {
        address: &t.writer,
        invoke: &reclaim,
    }]);
    t.c.reclaim(&t.writer, &to_reclaim);
    assert_eq!(t.state(to_cancel), State::Cancelled);
    assert_eq!(t.state(to_claim), State::Settled);
    assert_eq!(t.state(to_reclaim), State::Expired);
}

#[test]
fn auth1_create_offer_cannot_lock_someone_elses_funds() {
    // Middleware-replay shape on the entry point that PULLS funds: if `create_offer` trusted
    // the inner transfer auth, anyone could lock the writer's USDx into an offer with
    // attacker-chosen terms.
    let t = setup();
    let env = &t.env;
    let lock = transfer(&t, &t.usdx, (&t.writer, &t.contract, STRIKE).into_val(env));
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
            .into_val(env),
        sub_invokes: std::slice::from_ref(&lock),
    };
    let create_other_terms = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "create_offer",
        args: (
            &t.writer,
            &t.rwa,
            OptionType::Put,
            QTY,
            STRIKE,
            PREMIUM * 50,
            EXPIRY,
        )
            .into_val(env),
        sub_invokes: std::slice::from_ref(&lock),
    };
    let args: Vec<Val> = (
        &t.writer,
        &t.rwa,
        OptionType::Put,
        QTY,
        STRIKE,
        PREMIUM,
        EXPIRY,
    )
        .into_val(env);
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![
        (
            "maker2 signs the writer-shaped tree",
            std::vec![MockAuth {
                address: &t.maker2,
                invoke: &create
            }]
        ),
        (
            "writer's pre-signed collateral transfer alone (middleware replay)",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &lock
            }]
        ),
        (
            "writer signed different terms (premium x50)",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &create_other_terms
            }]
        ),
        ("no signature at all", std::vec![]),
    ];
    assert_auth_cases(&t, "create_offer", &args, &cases);

    env.mock_auths(&[MockAuth {
        address: &t.writer,
        invoke: &create,
    }]);
    assert_eq!(
        t.c.create_offer(
            &t.writer,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY
        ),
        0
    );
}

#[test]
fn auth1_transfer_rejects_third_party_and_replayed_signed_trees() {
    let t = setup();
    let env = &t.env;
    let (h, h2) = (&t.holder, &t.holder2);
    let id = t.put(&t.writer);
    let other = t.call(&t.maker2);
    t.c.buy(h, &id);
    t.c.buy(h, &other);
    let foreign = Address::generate(env);

    let give = xfer(&t, h, h2, id);
    let give_other = xfer(&t, h, h2, other);
    let give_to_maker2 = xfer(&t, h, &t.maker2, id);
    let via_foreign = MockAuthInvoke {
        contract: &foreign,
        fn_name: "settle",
        args: (h, h2, id).into_val(env),
        sub_invokes: std::slice::from_ref(&give),
    };
    let deliver = transfer(&t, &t.rwa, (h, &t.contract, QTY).into_val(env));
    let exercise = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "exercise",
        args: (h, id).into_val(env),
        sub_invokes: std::slice::from_ref(&deliver),
    };

    let args: Vec<Val> = (h, h2, id).into_val(env);
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![
        (
            "writer signs the holder-shaped tree",
            std::vec![MockAuth {
                address: &t.writer,
                invoke: &give
            }]
        ),
        (
            "maker2 signs the holder-shaped tree",
            std::vec![MockAuth {
                address: &t.maker2,
                invoke: &give
            }]
        ),
        (
            "the recipient signs the holder-shaped tree",
            std::vec![MockAuth {
                address: h2,
                invoke: &give
            }]
        ),
        (
            "holder's signed tree for another id (replay)",
            std::vec![MockAuth {
                address: h,
                invoke: &give_other
            }]
        ),
        (
            "holder's signed tree for another recipient",
            std::vec![MockAuth {
                address: h,
                invoke: &give_to_maker2
            }]
        ),
        (
            "holder's transfer tree under a foreign root",
            std::vec![MockAuth {
                address: h,
                invoke: &via_foreign
            }]
        ),
        (
            "holder's exercise tree for the same id",
            std::vec![MockAuth {
                address: h,
                invoke: &exercise
            }]
        ),
        ("no signature at all", std::vec![]),
    ];
    assert_auth_cases(&t, "transfer", &args, &cases);

    // The holder's transfer signature authorizes nothing else: not the same transfer of the
    // other option, and not an exercise of the same option.
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![(
        "holder's tree for `id` replayed on `other`",
        std::vec![MockAuth {
            address: h,
            invoke: &give
        }]
    ),];
    assert_auth_cases(&t, "transfer", &(h, h2, other).into_val(env), &cases);
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![(
        "holder's transfer tree used for exercise",
        std::vec![MockAuth {
            address: h,
            invoke: &give
        }]
    ),];
    assert_auth_cases(&t, "exercise", &(h, id).into_val(env), &cases);

    // Positive control with a real signed entry, then the identical entry replayed: the host
    // nonce refuses it before the contract runs (the root cause is not the contract's NotHolder).
    let ma = MockAuth {
        address: h,
        invoke: &give,
    };
    let entry: xdr::SorobanAuthorizationEntry = (&ma).into();
    env.mock_auths(std::slice::from_ref(&ma)); // registers the holder's mock account contract
    env.set_auths(std::slice::from_ref(&entry));
    t.c.transfer(h, h2, &id);
    t.assert_one_event("option_transferred", id);
    assert_eq!(t.c.get_option(&id).holder, Some(h2.clone()));
    assert_eq!(t.state(id), State::Active);
    let before = t.snap();
    env.set_auths(&[entry]);
    let r = t.raw("transfer", args.clone());
    assert!(r.is_err());
    let root = t.root_error();
    assert!(t.no_events());
    assert_eq!(t.snap(), before);
    assert!(
        matches!(
            root,
            Some(xdr::ScError::Auth(_)) | Some(xdr::ScError::Storage(_))
        ),
        "{root:?}"
    );
    std::println!("auth1 transfer nonce replay root cause: {root:?}");
    env.mock_all_auths();
}

// =============================================================================================
// 2. Contract addresses and the options contract's own address as parties
// =============================================================================================

/// Same lifecycle for a given (writer, holder) pair; returns every observable after each step.
fn party_flow(
    t: &T,
    w: &Address,
    h: &Address,
) -> std::vec::Vec<(&'static str, std::string::String)> {
    let mut out = std::vec::Vec::new();
    let mut rec = |label: &'static str, extra: std::string::String| {
        let row = std::format!(
            "w=[{},{}] h=[{},{}] c=[{},{}] open=[{},{}] {}",
            t.bal(&t.usdx, w),
            t.bal(&t.rwa, w),
            t.bal(&t.usdx, h),
            t.bal(&t.rwa, h),
            t.bal(&t.usdx, &t.contract),
            t.bal(&t.rwa, &t.contract),
            t.c.open_collateral(&t.usdx),
            t.c.open_collateral(&t.rwa),
            extra
        );
        out.push((label, row));
    };
    rec("start", std::string::String::new());
    let p = t.put(w);
    rec("put created", std::string::String::new());
    let r = std::format!("{:?}", t.c.try_buy(w, &p));
    rec("writer self-buy", r);
    t.c.buy(h, &p);
    rec("put bought", std::string::String::new());
    let r = std::format!("{:?}", t.c.try_cancel_offer(h, &p));
    rec("holder cancels", r);
    t.c.exercise(h, &p);
    rec("put exercised", std::string::String::new());
    t.c.claim_delivery(w, &p);
    rec("put claimed", std::string::String::new());
    let c = t.call(w);
    t.c.buy(h, &c);
    t.c.exercise(h, &c);
    t.c.claim_delivery(w, &c);
    rec("call settled", std::string::String::new());
    let x = t.put(w);
    t.c.cancel_offer(w, &x);
    rec("put cancelled", std::string::String::new());
    let z = t.call(w);
    t.c.buy(h, &z);
    t.sac(&t.rwa).set_authorized(h, &false);
    let r = std::format!("{:?}", t.c.try_exercise(h, &z));
    rec("deauthorized holder exercises", r);
    let y = t.put(w);
    t.at(EXPIRY);
    t.c.reclaim(w, &z);
    t.c.reclaim(w, &y);
    rec(
        "reclaimed",
        std::format!("{:?} {:?}", t.state(z), t.state(y)),
    );
    out
}

#[test]
fn addr2_g_accounts_and_contract_addresses_behave_identically() {
    let funds = [USDX_START, UNDERLYING_START, UNDERLYING_START];
    let a = setup();
    let (cw, ch) = (a.c_actor(funds), a.c_actor(funds));
    let with_contracts = party_flow(&a, &cw, &ch);

    let b = setup();
    let (gw, gh) = (
        b.g_actor([true; 3], true, funds),
        b.g_actor([true; 3], true, funds),
    );
    let with_accounts = party_flow(&b, &gw, &gh);

    assert_eq!(with_contracts, with_accounts);
    // sanity: the flow really exercised the rejections it records
    let rows: std::collections::BTreeMap<_, _> = with_accounts.into_iter().collect();
    assert!(rows["writer self-buy"].contains("SelfTrade"));
    assert!(rows["holder cancels"].contains("NotWriter"));
    assert!(rows["deauthorized holder exercises"].contains("Contract(11)"));
}

/// Minimal relay contract: shows that no third contract can make the options contract
/// authorize itself through the invoker-contract rule.
#[contract]
pub struct Relay;

#[contractimpl]
impl Relay {
    pub fn buy_for(env: Env, options: Address, buyer: Address, id: u32) {
        OptionsContractClient::new(&env, &options).buy(&buyer, &id);
    }
}

#[test]
fn addr2_options_contract_cannot_act_as_writer_buyer_or_holder() {
    let t = setup();
    let env = &t.env;
    // pooled funds the contract would spend if it could authorize itself
    let offered = t.put(&t.writer);
    let active = t.call(&t.maker2);
    t.c.buy(&t.holder, &active);
    let me = &t.contract;
    assert!(t.bal(&t.usdx, me) > 0 && t.bal(&t.rwa, me) > 0);

    let calls: std::vec::Vec<(&str, Vec<Val>)> = std::vec![
        (
            "create_offer",
            (me, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM, EXPIRY).into_val(env)
        ),
        (
            "create_offer",
            (me, &t.rwa, OptionType::Call, QTY, STRIKE, PREMIUM, EXPIRY).into_val(env)
        ),
        ("buy", (me, offered).into_val(env)),
        ("exercise", (me, active).into_val(env)),
        ("cancel_offer", (me, offered).into_val(env)),
        ("reclaim", (me, offered).into_val(env)),
        ("claim_delivery", (me, active).into_val(env)),
        ("transfer", (me, &t.holder2, active).into_val(env)),
    ];
    let before = t.snap();

    // (a) real (enforcing) auth with no entries
    for (f, args) in &calls {
        env.set_auths(&[]);
        let r = t.raw(f, args.clone());
        t.assert_rejected_root(
            &std::format!("{f} as the contract, unsigned"),
            r,
            AUTH_INVALID,
            &before,
        );
    }

    // (b) a submitted auth entry whose credentials name the contract address: the host must call
    // the options contract's `__check_auth`, which does not exist.
    for (f, args) in &calls {
        let inv = MockAuthInvoke {
            contract: me,
            fn_name: f,
            args: args.clone(),
            sub_invokes: &[],
        };
        let entry: xdr::SorobanAuthorizationEntry = (&MockAuth {
            address: me,
            invoke: &inv,
        })
            .into();
        env.set_auths(&[entry]);
        let r = t.raw(f, args.clone());
        assert!(
            r.is_err(),
            "{f} with a forged contract-credential entry succeeded"
        );
        let root = t.root_error();
        assert!(t.no_events());
        assert_eq!(
            t.snap(),
            before,
            "{f}: forged contract credentials changed state"
        );
        std::println!("addr2 forged contract credentials, {f}: root cause {root:?}");
    }

    // (c) through an intermediary contract (invoker-contract auth only covers the relay itself)
    let relay = env.register(Relay, ());
    env.set_auths(&[]);
    let r = env.try_invoke_contract::<Val, soroban_sdk::Error>(
        &relay,
        &Symbol::new(env, "buy_for"),
        (me, me, offered).into_val(env),
    );
    assert!(r.is_err());
    assert_eq!(t.root_error(), Some(AUTH_INVALID));
    assert!(t.no_events());
    assert_eq!(t.snap(), before);
    env.mock_all_auths();
}

#[test]
fn addr2_option_handed_to_the_contract_is_inert_until_reclaim() {
    // The options contract is issuer-authorized on every underlying, so it passes the recipient
    // eligibility check of `transfer` (ABI §3). Handing it an option only throws the sender's own
    // right away: the contract can never authorize an exercise or a further transfer for itself,
    // the former holder is out, and the writer reclaims the full collateral after expiry.
    let t = setup();
    let env = &t.env;
    let me = &t.contract;
    let put = t.put(&t.writer);
    let call = t.call(&t.writer);
    t.c.buy(&t.holder, &put);
    t.c.buy(&t.holder, &call);
    assert!(t.c.is_eligible(&t.rwa, me));
    t.c.transfer(&t.holder, me, &put);
    t.c.transfer(&t.holder, me, &call);
    assert_eq!(t.c.get_option(&put).holder, Some(me.clone()));
    let before = t.snap();

    for id in [put, call] {
        let calls: std::vec::Vec<(&str, Vec<Val>)> = std::vec![
            ("exercise", (me, id).into_val(env)),
            ("transfer", (me, &t.holder2, id).into_val(env)),
        ];
        for (f, args) in calls {
            env.set_auths(&[]);
            let r = t.raw(f, args);
            t.assert_rejected_root(
                &std::format!("{f} of {id} by the contract"),
                r,
                AUTH_INVALID,
                &before,
            );
        }
    }
    env.mock_all_auths();
    rejected(
        &t,
        t.c.try_exercise(&t.holder, &put),
        Error::NotHolder,
        &before,
    );
    rejected(
        &t,
        t.c.try_transfer(&t.holder, &t.holder2, &call),
        Error::NotHolder,
        &before,
    );

    t.at(EXPIRY);
    let (w_usdx, w_rwa) = (t.bal(&t.usdx, &t.writer), t.bal(&t.rwa, &t.writer));
    t.c.reclaim(&t.writer, &put);
    t.c.reclaim(&t.writer, &call);
    assert_eq!(t.bal(&t.usdx, &t.writer), w_usdx + STRIKE);
    assert_eq!(t.bal(&t.rwa, &t.writer), w_rwa + QTY);
    for tok in t.tokens() {
        assert_eq!(t.c.open_collateral(&tok), 0);
        assert_eq!(t.bal(&tok, &t.contract), 0);
    }
}

// =============================================================================================
// 3. Accounting over a scripted mixed sequence
// =============================================================================================

#[test]
fn accounting3_scripted_sequence_reserves_equal_abi_sum_and_contract_balance() {
    let t = setup();
    let totals0 = t.totals();
    let (w, m, h, h2) = (&t.writer, &t.maker2, &t.holder, &t.holder2);
    let (rwa, bond) = (&t.rwa, &t.bond);
    let (e1, e2, e3) = (EXPIRY, START + 2 * 86_400, EXPIRY + 86_400);
    let mut step = 0u32;
    let check = |step: &mut u32, label: &str| {
        *step += 1;
        let expect = t.abi_reserves();
        for (i, tok) in t.tokens().iter().enumerate() {
            assert_eq!(
                t.c.open_collateral(tok),
                expect[i],
                "step {step} ({label}) open_collateral[{i}]"
            );
            assert_eq!(
                t.bal(tok, &t.contract),
                expect[i],
                "step {step} ({label}) contract balance[{i}]"
            );
        }
        assert_eq!(t.totals(), totals0, "step {step} ({label}) conservation");
        let offered: std::vec::Vec<u32> = (0..t.c.option_count())
            .filter(|id| t.state(*id) == State::Offered)
            .collect();
        let open: std::vec::Vec<u32> = t.c.list_open().iter().collect();
        assert_eq!(open, offered, "step {step} ({label}) list_open");
    };
    use OptionType::{Call, Put};

    let o0 = t.offer_x(w, rwa, Put, 5 * UNIT, 50 * UNIT, UNIT, e1);
    check(&mut step, "o0 put rwa");
    let o1 = t.offer_x(m, rwa, Call, 7 * UNIT, 60 * UNIT, 2 * UNIT, e1);
    check(&mut step, "o1 call rwa");
    let o2 = t.offer_x(w, bond, Put, 3 * UNIT, 33 * UNIT, UNIT, e1);
    check(&mut step, "o2 put bond");
    let o3 = t.offer_x(m, bond, Call, 4 * UNIT, 44 * UNIT, 3 * UNIT, e1);
    check(&mut step, "o3 call bond");
    t.c.buy(h, &o0);
    check(&mut step, "buy o0");
    t.c.buy(h2, &o1);
    check(&mut step, "buy o1");
    t.c.exercise(h, &o0);
    check(&mut step, "exercise o0");
    let o4 = t.offer_x(w, rwa, Call, 2 * UNIT, 21 * UNIT, UNIT, e1);
    check(&mut step, "o4 call rwa");
    t.c.cancel_offer(w, &o2);
    check(&mut step, "cancel o2");
    t.c.buy(h, &o3);
    check(&mut step, "buy o3");
    t.c.exercise(h, &o3);
    check(&mut step, "exercise o3");
    t.c.claim_delivery(w, &o0);
    check(&mut step, "claim o0");
    let o5 = t.offer_x(m, rwa, Put, 6 * UNIT, 66 * UNIT, 2 * UNIT, e2);
    check(&mut step, "o5 put rwa");
    let o6 = t.offer_x(w, bond, Put, UNIT, 11 * UNIT, UNIT, e2);
    check(&mut step, "o6 put bond");
    t.c.buy(h2, &o5);
    check(&mut step, "buy o5");
    t.c.buy(h, &o4);
    check(&mut step, "buy o4");
    let o7 = t.offer_x(m, bond, Call, 9 * UNIT, 90 * UNIT, UNIT, e1);
    check(&mut step, "o7 call bond");
    t.c.cancel_offer(m, &o7);
    check(&mut step, "cancel o7");
    t.c.transfer(h2, h, &o1);
    check(&mut step, "transfer o1 h2 -> h");
    t.c.exercise(h, &o1);
    check(&mut step, "exercise o1 (new holder)");
    t.c.claim_delivery(m, &o3);
    check(&mut step, "claim o3");
    t.at(e2);
    t.c.reclaim(m, &o5);
    check(&mut step, "reclaim o5 (active)");
    t.c.reclaim(w, &o6);
    check(&mut step, "reclaim o6 (offered)");
    t.c.exercise(h, &o4);
    check(&mut step, "exercise o4");
    let o8 = t.offer_x(w, bond, Call, 2 * UNIT, 25 * UNIT, UNIT, e3);
    check(&mut step, "o8 call bond");
    t.c.claim_delivery(m, &o1);
    check(&mut step, "claim o1");
    t.c.buy(h2, &o8);
    check(&mut step, "buy o8");
    t.c.exercise(h2, &o8);
    check(&mut step, "exercise o8");
    t.c.claim_delivery(w, &o4);
    check(&mut step, "claim o4");
    let o9 = t.offer_x(m, rwa, Put, UNIT, 10 * UNIT, UNIT, e3);
    check(&mut step, "o9 put rwa");
    let o10 = t.offer_x(w, rwa, Put, 3 * UNIT, 30 * UNIT, 2 * UNIT, e3);
    check(&mut step, "o10 put rwa");
    t.c.buy(h, &o10);
    check(&mut step, "buy o10");
    // a few rejected calls inside the sequence must not disturb the accounting
    assert!(t.c.try_exercise(h2, &o10).is_err());
    check(&mut step, "foreign exercise rejected");
    assert!(t.c.try_claim_delivery(w, &o10).is_err());
    check(&mut step, "early claim rejected");
    t.at(e3);
    t.c.reclaim(m, &o9);
    check(&mut step, "reclaim o9 (offered)");
    t.c.reclaim(w, &o10);
    check(&mut step, "reclaim o10 (active)");
    t.c.claim_delivery(w, &o8);
    check(&mut step, "claim o8");

    assert_eq!(step, 37, "accounting trace length");
    for id in 0..t.c.option_count() {
        assert!(
            matches!(
                t.state(id),
                State::Settled | State::Expired | State::Cancelled
            ),
            "option {id} not terminal"
        );
    }
    for tok in t.tokens() {
        assert_eq!(t.c.open_collateral(&tok), 0);
        assert_eq!(t.bal(&tok, &t.contract), 0);
    }
}

// =============================================================================================
// 4. Reserved underflow: repeated and out-of-order releases
// =============================================================================================

#[test]
fn underflow4_repeated_and_out_of_order_releases_rejected() {
    let t = setup();
    let (w, m, h) = (&t.writer, &t.maker2, &t.holder);
    let cancelled = t.put(w);
    t.c.cancel_offer(w, &cancelled);
    let active = t.call(w);
    t.c.buy(h, &active);
    let exercised = t.put(w);
    t.c.buy(h, &exercised);
    t.c.exercise(h, &exercised);
    let settled = t.call(m);
    t.c.buy(h, &settled);
    t.c.exercise(h, &settled);
    t.c.claim_delivery(m, &settled);
    let reclaimed_offered = t.put(m);
    let reclaimed_active = t.call(m);
    t.c.buy(h, &reclaimed_active);
    // fillers keep every reserve non-zero, so an extra release would not just hit zero
    t.put(m);
    t.offer(w, &t.bond, OptionType::Call);
    t.offer(m, &t.rwa, OptionType::Call);
    t.at(EXPIRY);
    t.c.reclaim(m, &reclaimed_offered);
    t.c.reclaim(m, &reclaimed_active);
    let before = t.snap();
    let reserves = before.open_collateral;

    let ws = Error::WrongState;
    rejected(&t, t.c.try_cancel_offer(w, &cancelled), ws, &before); // cancel twice
    rejected(&t, t.c.try_reclaim(m, &reclaimed_offered), ws, &before); // reclaim twice (Offered)
    rejected(&t, t.c.try_reclaim(m, &reclaimed_active), ws, &before); // reclaim twice (Active)
    rejected(&t, t.c.try_claim_delivery(m, &settled), ws, &before); // claim twice
    rejected(&t, t.c.try_reclaim(w, &exercised), ws, &before); // reclaim of Exercised
    rejected(&t, t.c.try_cancel_offer(w, &exercised), ws, &before);
    rejected(&t, t.c.try_cancel_offer(w, &active), ws, &before); // cancel of Active
    rejected(&t, t.c.try_claim_delivery(w, &active), ws, &before); // claim of Active
    rejected(&t, t.c.try_claim_delivery(w, &cancelled), ws, &before);
    rejected(
        &t,
        t.c.try_claim_delivery(m, &reclaimed_offered),
        ws,
        &before,
    );
    rejected(&t, t.c.try_cancel_offer(m, &reclaimed_active), ws, &before);
    rejected(&t, t.c.try_reclaim(m, &settled), ws, &before);
    rejected(&t, t.c.try_cancel_offer(m, &settled), ws, &before);
    assert_eq!(t.snap().open_collateral, reserves);

    // each legitimate release works exactly once
    t.c.claim_delivery(w, &exercised);
    rejected(&t, t.c.try_claim_delivery(w, &exercised), ws, &t.snap());
    t.c.reclaim(w, &active);
    rejected(&t, t.c.try_reclaim(w, &active), ws, &t.snap());
    let expect = t.abi_reserves();
    for (i, tok) in t.tokens().iter().enumerate() {
        assert_eq!(t.c.open_collateral(tok), expect[i]);
        assert_eq!(t.bal(tok, &t.contract), expect[i]);
        assert!(expect[i] > 0, "filler reserve {i} must still be locked");
    }
}

// =============================================================================================
// 5. Ids: never reused, never wrap
// =============================================================================================

#[test]
fn ids5_strictly_increase_and_count_never_decreases() {
    let t = setup();
    let (w, m, h) = (&t.writer, &t.maker2, &t.holder);
    let mut ids = std::vec::Vec::new();
    let mut last_count = t.c.option_count();
    assert_eq!(last_count, 0);
    let mut observe = |ids: &mut std::vec::Vec<u32>, new_id: Option<u32>| {
        if let Some(id) = new_id {
            if let Some(prev) = ids.last() {
                assert!(id > *prev, "id {id} after {prev}");
            }
            ids.push(id);
        }
        let n = t.c.option_count();
        assert!(
            n >= last_count,
            "option_count decreased {last_count} -> {n}"
        );
        assert_eq!(n as usize, ids.len(), "option_count == successful creates");
        last_count = n;
    };
    let a = t.put(w);
    observe(&mut ids, Some(a));
    let b = t.call(m);
    observe(&mut ids, Some(b));
    t.c.cancel_offer(w, &a);
    observe(&mut ids, None);
    // failed creates consume no id
    assert!(t
        .c
        .try_create_offer(w, &t.rwa, &OptionType::Put, &0, &STRIKE, &PREMIUM, &EXPIRY)
        .is_err());
    observe(&mut ids, None);
    assert!(t
        .c
        .try_create_offer(
            &t.outsider,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY
        )
        .is_err());
    observe(&mut ids, None);
    let c = t.put(w);
    observe(&mut ids, Some(c));
    t.c.buy(h, &b);
    observe(&mut ids, None);
    let d = t.offer(m, &t.bond, OptionType::Put);
    observe(&mut ids, Some(d));
    t.at(EXPIRY);
    t.c.reclaim(m, &b);
    observe(&mut ids, None);
    t.c.reclaim(w, &c);
    observe(&mut ids, None);
    t.c.cancel_offer(m, &d);
    observe(&mut ids, None);
    let e = t.offer_x(
        w,
        &t.rwa,
        OptionType::Call,
        QTY,
        STRIKE,
        PREMIUM,
        EXPIRY + 1,
    );
    observe(&mut ids, Some(e));
    assert_eq!(ids, std::vec![0, 1, 2, 3, 4]);
    // terminal options keep their record: no overwrite through id reuse
    assert_eq!(t.state(a), State::Cancelled);
    assert_eq!(t.c.get_option(&a).writer, *w);
    assert_eq!(t.state(b), State::Expired);
    assert_eq!(t.c.get_option(&b).holder, Some(h.clone()));
}

#[test]
fn ids5_next_id_exhaustion_returns_overflow_without_wrap() {
    // Unreachable in practice (4.29e9 creates); the stored counter is moved next to u32::MAX to
    // prove that ids never wrap back onto existing options.
    let t = setup();
    let first = t.put(&t.writer);
    let next_key: Vec<Val> = vec![&t.env, Symbol::new(&t.env, "Next").into_val(&t.env)];
    t.env.as_contract(&t.contract, || {
        t.env.storage().instance().set(&next_key, &(u32::MAX - 1));
    });
    assert_eq!(t.c.option_count(), u32::MAX - 1);

    let last = t.put(&t.maker2);
    assert_eq!(last, u32::MAX - 1);
    assert_eq!(t.c.option_count(), u32::MAX);
    let before = t.snap_ids(&[first, last]);
    let usdx_writer = t.bal(&t.usdx, &t.writer);

    let r = t.c.try_create_offer(
        &t.writer,
        &t.rwa,
        &OptionType::Put,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &EXPIRY,
    );
    assert!(t.no_events());
    assert_err(r, Error::Overflow);
    assert_eq!(t.snap_ids(&[first, last]), before);
    assert_eq!(
        t.bal(&t.usdx, &t.writer),
        usdx_writer,
        "no collateral pulled"
    );
    assert_err(t.c.try_get_option(&u32::MAX), Error::NotFound);
    assert_eq!(t.c.get_option(&first).id, 0);
    assert_eq!(t.c.get_option(&first).writer, t.writer);
}

impl T {
    /// Snapshot variant for sparse ids (the full `snap` walks 0..option_count).
    fn snap_ids(
        &self,
        ids: &[u32],
    ) -> (
        std::vec::Vec<OptionData>,
        [i128; 3],
        std::vec::Vec<u32>,
        u32,
        [i128; 3],
    ) {
        let tokens = self.tokens();
        (
            ids.iter().map(|id| self.c.get_option(id)).collect(),
            [
                self.c.open_collateral(&tokens[0]),
                self.c.open_collateral(&tokens[1]),
                self.c.open_collateral(&tokens[2]),
            ],
            self.c.list_open().iter().collect(),
            self.c.option_count(),
            [
                self.bal(&tokens[0], &self.contract),
                self.bal(&tokens[1], &self.contract),
                self.bal(&tokens[2], &self.contract),
            ],
        )
    }
}

// =============================================================================================
// 6. Timing boundaries
// =============================================================================================

#[test]
fn timing6_expiry_boundary_is_exclusive_and_gapless() {
    let t = setup();
    let (w, m, h) = (&t.writer, &t.maker2, &t.holder);
    let probes = [EXPIRY - 1, EXPIRY, EXPIRY + 1];
    let active: std::vec::Vec<u32> = probes
        .iter()
        .map(|_| {
            let id = t.put(w);
            t.c.buy(h, &id);
            id
        })
        .collect();
    let offered: std::vec::Vec<u32> = probes.iter().map(|_| t.call(m)).collect();
    let cancellable = t.put(m);

    // creation boundary: expiry must be strictly in the future
    let before = t.snap();
    for exp in [START - 1, START] {
        rejected(
            &t,
            t.c.try_create_offer(w, &t.rwa, &OptionType::Put, &QTY, &STRIKE, &PREMIUM, &exp),
            Error::InvalidArgs,
            &before,
        );
    }
    let short = t.offer_x(w, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM, START + 1);
    t.c.buy(&t.holder2, &short); // now = START < START + 1: still purchasable
    t.at(START + 1);
    let before = t.snap();
    rejected(
        &t,
        t.c.try_exercise(&t.holder2, &short),
        Error::Expired,
        &before,
    );

    for (i, ts) in probes.iter().enumerate() {
        t.at(*ts);
        let (a, o) = (active[i], offered[i]);
        let live = *ts < EXPIRY;
        // Active: exactly one of exercise / reclaim is possible at any timestamp.
        let before = t.snap();
        if live {
            rejected(&t, t.c.try_reclaim(w, &a), Error::NotExpired, &before);
            t.c.exercise(h, &a);
            assert_eq!(t.state(a), State::Exercised);
        } else {
            rejected(&t, t.c.try_exercise(h, &a), Error::Expired, &before);
            t.c.reclaim(w, &a);
            assert_eq!(t.state(a), State::Expired);
        }
        // Offered: exactly one of buy / reclaim is possible at any timestamp.
        let before = t.snap();
        if live {
            rejected(&t, t.c.try_reclaim(m, &o), Error::NotExpired, &before);
            t.c.buy(h, &o);
            assert_eq!(t.state(o), State::Active);
        } else {
            rejected(&t, t.c.try_buy(h, &o), Error::Expired, &before);
            t.c.reclaim(m, &o);
            assert_eq!(t.state(o), State::Expired);
        }
    }
    // the option bought at EXPIRY - 1 can no longer be exercised at EXPIRY + 1 but is reclaimable
    let before = t.snap();
    rejected(
        &t,
        t.c.try_exercise(h, &offered[0]),
        Error::Expired,
        &before,
    );
    t.c.reclaim(m, &offered[0]);
    // cancel_offer of an Offered option is allowed on both sides of the boundary (ABI §3/§7.5)
    t.c.cancel_offer(m, &cancellable);
    assert_eq!(t.state(cancellable), State::Cancelled);
}

// =============================================================================================
// 7. Terminal states
// =============================================================================================

#[test]
fn terminal7_every_mutation_on_terminal_options_fails_without_events() {
    let t = setup();
    let (w, h) = (&t.writer, &t.holder);
    let settled_put = t.put(w);
    t.c.buy(h, &settled_put);
    t.c.exercise(h, &settled_put);
    t.c.claim_delivery(w, &settled_put);
    let settled_call = t.call(w);
    t.c.buy(h, &settled_call);
    t.c.exercise(h, &settled_call);
    t.c.claim_delivery(w, &settled_call);
    let cancelled = t.put(w);
    t.c.cancel_offer(w, &cancelled);
    let expired_offered = t.call(w);
    let expired_active = t.put(w);
    t.c.buy(h, &expired_active);
    t.at(EXPIRY);
    t.c.reclaim(w, &expired_offered);
    t.c.reclaim(w, &expired_active);
    let terminal = [
        settled_put,
        settled_call,
        cancelled,
        expired_offered,
        expired_active,
    ];

    // after expiry AND (test-only) before it: terminality must come from the state, not time
    for ts in [EXPIRY + 1, START + 1] {
        t.at(ts);
        for id in terminal {
            let opt = t.c.get_option(&id);
            for p in [&t.writer, &t.holder, &t.maker2] {
                let before = t.snap();
                let is_writer = *p == opt.writer;
                let is_holder = opt.holder.as_ref() == Some(p);
                let own = |mine: bool, other: Error| if mine { Error::WrongState } else { other };
                rejected(&t, t.c.try_buy(p, &id), Error::WrongState, &before);
                rejected(
                    &t,
                    t.c.try_exercise(p, &id),
                    own(is_holder, Error::NotHolder),
                    &before,
                );
                rejected(
                    &t,
                    t.c.try_cancel_offer(p, &id),
                    own(is_writer, Error::NotWriter),
                    &before,
                );
                rejected(
                    &t,
                    t.c.try_reclaim(p, &id),
                    own(is_writer, Error::NotWriter),
                    &before,
                );
                rejected(
                    &t,
                    t.c.try_claim_delivery(p, &id),
                    own(is_writer, Error::NotWriter),
                    &before,
                );
            }
        }
    }
}

// =============================================================================================
// 8. Griefing bounds
// =============================================================================================

#[test]
fn griefing8_extend_ttl_unknown_id_extends_nothing() {
    let t = setup();
    let a = t.put(&t.writer);
    let b = t.call(&t.maker2);
    let seq = t.env.ledger().sequence();
    t.env.ledger().set_sequence_number(seq + 24 * DAY);
    let ttls = |t: &T| (t.option_ttl(a), t.option_ttl(b), t.instance_ttl());
    let aged = ttls(&t);
    assert!(
        aged.0 < 7 * DAY && aged.1 < 7 * DAY && aged.2 < 7 * DAY,
        "{aged:?}"
    );

    for ids in [
        vec![&t.env, a, 999],
        vec![&t.env, 999],
        vec![&t.env, a, b, u32::MAX],
        vec![&t.env, 2],
    ] {
        let r = t.c.try_extend_ttl(&ids);
        assert!(t.no_events());
        assert_err(r, Error::NotFound);
        assert_eq!(
            ttls(&t),
            aged,
            "a failed extend_ttl({ids:?}) extended something"
        );
    }
    t.c.extend_ttl(&vec![&t.env, a, b]);
    let fresh = ttls(&t);
    assert_eq!(fresh, (30 * DAY, 30 * DAY, 30 * DAY));
}

#[test]
fn griefing8_extend_ttl_batch_size_fits_footprint_limit() {
    let t = setup();
    let n = FOOTPRINT_LIMIT; // 400 options
    for _ in 0..n {
        t.offer_x(&t.writer, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY);
    }
    // Largest batch under the default (mainnet snapshot) limits, which the test env ENFORCES:
    // footprint = ids + instance + code.
    let fit = FOOTPRINT_LIMIT - 2;
    t.c.extend_ttl(&Vec::from_iter(&t.env, 0..fit));
    let r = t.env.cost_estimate().resources();
    assert_eq!(r.memory_read_entries + r.disk_read_entries, fit + 2);
    std::println!("griefing8: extend_ttl({fit} ids) ok: {r:?}");
    // One more id exceeds the per-transaction footprint (measured with enforcement disabled,
    // since the test env panics instead of returning an error when a limit is exceeded).
    t.env.cost_estimate().disable_resource_limits();
    t.c.extend_ttl(&Vec::from_iter(&t.env, 0..fit + 1));
    let r = t.env.cost_estimate().resources();
    assert_eq!(
        r.memory_read_entries + r.disk_read_entries,
        FOOTPRINT_LIMIT + 1
    );
}

#[test]
fn griefing8_open_list_cap_and_full_list_operations_fit_limits() {
    let t = setup();
    for i in 0..MAX_OPEN {
        assert_eq!(
            t.offer_x(&t.writer, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY),
            i
        );
    }
    let before = t.snap();
    for (u, ty) in [(&t.rwa, OptionType::Put), (&t.bond, OptionType::Call)] {
        rejected(
            &t,
            t.c.try_create_offer(&t.maker2, u, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
            Error::OpenListFull,
            &before,
        );
    }
    // operations on a full list stay within the enforced mainnet limits (no panic):
    // buy the newest (open_remove scans the whole list), cancel the oldest
    t.c.buy(&t.holder, &(MAX_OPEN - 1));
    let r = t.env.cost_estimate().resources();
    std::println!("griefing8: buy on a full open list: {r:?}");
    t.c.cancel_offer(&t.writer, &0);
    t.c.extend_ttl(&vec![&t.env]);
    assert_eq!(t.c.list_open().len(), MAX_OPEN - 2);
    t.offer(&t.maker2, &t.rwa, OptionType::Put);
    t.offer(&t.maker2, &t.bond, OptionType::Call);
    let before = t.snap();
    rejected(
        &t,
        t.c.try_create_offer(
            &t.maker2,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::OpenListFull,
        &before,
    );
}

/// FINDING F-1 (availability): one eligible writer can occupy every `MAX_OPEN` slot with dust
/// offers (qty = strike = premium = 1 unit, expiry = u64::MAX) for 1000 units of USDx
/// (0.0001 USDx) of locked collateral, which blocks `create_offer` for every other writer.
/// Slots never free by themselves (expired offers stay in the list until their writer acts).
/// A third party can free a slot only by buying a dust offer (1 unit each), and the squatter
/// can re-list immediately. Documented in `docs/contract-abi.md` §6 (availability limitation of
/// the demo deployment, not a fund-safety issue); fix planned as v1.3.
#[test]
#[ignore = "finding F-1: one eligible writer can fill MAX_OPEN with dust offers; documented limitation, fix planned as v1.3"]
fn finding_f1_dust_offers_must_not_block_other_writers() {
    let t = setup();
    let squatter = &t.holder2; // any issuer-authorized account
    let usdx_before = t.bal(&t.usdx, squatter);
    for _ in 0..MAX_OPEN {
        t.offer_x(squatter, &t.rwa, OptionType::Put, 1, 1, 1, u64::MAX);
    }
    assert_eq!(usdx_before - t.bal(&t.usdx, squatter), MAX_OPEN as i128); // 0.0001 USDx
    t.at(EXPIRY + 365 * 86_400);
    assert_eq!(t.c.list_open().len(), MAX_OPEN, "dust offers never age out");
    // expected (secure): an honest maker can still list an offer
    assert_eq!(
        t.c.try_create_offer(
            &t.maker2,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &(EXPIRY + 400 * 86_400)
        ),
        Ok(Ok(MAX_OPEN)),
        "an honest maker is locked out by dust offers"
    );
}

// =============================================================================================
// 9. Amount edges
// =============================================================================================

#[test]
fn amounts9_one_unit_options_settle_end_to_end() {
    let t = setup();
    let (w, h) = (&t.writer, &t.holder);
    let b0 = t.snap();
    let p = t.offer_x(w, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY);
    t.c.buy(h, &p);
    t.c.exercise(h, &p);
    t.c.claim_delivery(w, &p);
    let c = t.offer_x(w, &t.rwa, OptionType::Call, 1, 1, 1, EXPIRY);
    t.c.buy(h, &c);
    t.c.exercise(h, &c);
    t.c.claim_delivery(w, &c);
    assert_eq!(t.state(p), State::Settled);
    assert_eq!(t.state(c), State::Settled);
    // PUT: writer -1 USDx +1 premium +1 RWA; holder -1 premium +1 USDx -1 RWA
    // CALL: writer -1 RWA +1 premium +1 USDx; holder -1 premium -1 USDx +1 RWA
    assert_eq!(t.bal(&t.usdx, w), USDX_START + 2);
    assert_eq!(t.bal(&t.rwa, w), UNDERLYING_START);
    assert_eq!(t.bal(&t.usdx, h), USDX_START - 2);
    assert_eq!(t.bal(&t.rwa, h), UNDERLYING_START);
    for tok in t.tokens() {
        assert_eq!(t.c.open_collateral(&tok), 0);
        assert_eq!(t.bal(&tok, &t.contract), 0);
    }
    assert_eq!(t.snap().open_collateral, b0.open_collateral);
}

#[test]
fn amounts9_zero_and_negative_amounts_rejected_invalid_args() {
    let t = setup();
    let before = t.snap();
    for ty in [OptionType::Put, OptionType::Call] {
        for bad in [0, -1, -STRIKE, i128::MIN] {
            for (q, s, p) in [
                (bad, STRIKE, PREMIUM),
                (QTY, bad, PREMIUM),
                (QTY, STRIKE, bad),
            ] {
                rejected(
                    &t,
                    t.c.try_create_offer(&t.writer, &t.rwa, &ty, &q, &s, &p, &EXPIRY),
                    Error::InvalidArgs,
                    &before,
                );
            }
        }
        rejected(
            &t,
            t.c.try_create_offer(&t.writer, &t.rwa, &ty, &QTY, &STRIKE, &PREMIUM, &0),
            Error::InvalidArgs,
            &before,
        );
    }
}

#[test]
fn amounts9_i128_max_amounts_fail_in_the_sac_atomically() {
    let t = setup();
    let (w, h, m) = (&t.writer, &t.holder, &t.maker2);
    let max = i128::MAX;
    let before = t.snap();
    // collateral legs larger than any balance
    sac_rejected(
        &t,
        t.c.try_create_offer(w, &t.rwa, &OptionType::Put, &QTY, &max, &PREMIUM, &EXPIRY),
        SAC_BALANCE,
        &before,
    );
    sac_rejected(
        &t,
        t.c.try_create_offer(
            w,
            &t.rwa,
            &OptionType::Call,
            &max,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        SAC_BALANCE,
        &before,
    );

    // legs that are only paid later: creatable, but the later payment fails atomically
    let huge_premium = t.offer_x(w, &t.rwa, OptionType::Put, QTY, STRIKE, max, EXPIRY);
    let huge_qty_put = t.offer_x(w, &t.rwa, OptionType::Put, max, STRIKE, PREMIUM, EXPIRY);
    let huge_strike_call = t.offer_x(m, &t.rwa, OptionType::Call, QTY, max, PREMIUM, EXPIRY);
    let before = t.snap();
    sac_rejected(&t, t.c.try_buy(h, &huge_premium), SAC_BALANCE, &before);
    t.c.buy(h, &huge_qty_put);
    t.c.buy(h, &huge_strike_call);
    let before = t.snap();
    sac_rejected(&t, t.c.try_exercise(h, &huge_qty_put), SAC_BALANCE, &before);
    sac_rejected(
        &t,
        t.c.try_exercise(h, &huge_strike_call),
        SAC_BALANCE,
        &before,
    );
    // writers get their real collateral back
    t.c.cancel_offer(w, &huge_premium);
    t.at(EXPIRY);
    t.c.reclaim(w, &huge_qty_put);
    t.c.reclaim(m, &huge_strike_call);
    for tok in t.tokens() {
        assert_eq!(t.c.open_collateral(&tok), 0);
        assert_eq!(t.bal(&tok, &t.contract), 0);
    }

    // contract-side balance overflow: two CALLs of 2^126 BOND each (issuer minted)
    let half = 1i128 << 126;
    t.at(START);
    t.sac(&t.bond).mint(w, &half);
    t.sac(&t.bond).mint(m, &half);
    t.offer_x(w, &t.bond, OptionType::Call, half, STRIKE, PREMIUM, EXPIRY);
    let before = t.snap();
    sac_rejected(
        &t,
        t.c.try_create_offer(
            m,
            &t.bond,
            &OptionType::Call,
            &half,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        SAC_OVERFLOW,
        &before,
    );
}

#[test]
fn amounts9_reserved_overflow_on_call_exercise_returns_overflow_atomically() {
    // The contract's own checked add (not the SAC) on the CALL exercise path: quote reserve +
    // strike_total overflows after a USDx clawback left the balance far below the reserve.
    let t = setup();
    t.usdx_flags.set_flag(IssuerFlags::RevocableFlag);
    t.usdx_flags.set_flag(IssuerFlags::ClawbackEnabledFlag);
    let call = t.call(&t.maker2);
    t.c.buy(&t.holder, &call);
    let s_put = i128::MAX - STRIKE + 1;
    t.sac(&t.usdx).mint(&t.writer, &(i128::MAX - USDX_START));
    t.offer_x(
        &t.writer,
        &t.rwa,
        OptionType::Put,
        QTY,
        s_put,
        PREMIUM,
        EXPIRY,
    );
    t.sac(&t.usdx).clawback(&t.contract, &s_put);
    assert_eq!(t.bal(&t.usdx, &t.contract), 0);
    let before = t.snap();
    rejected(
        &t,
        t.c.try_exercise(&t.holder, &call),
        Error::Overflow,
        &before,
    );
    assert_eq!(t.state(call), State::Active);
}

#[test]
fn amounts9_g_account_amounts_above_i64_fail_in_the_sac() {
    let t = setup();
    let g = t.g_actor(
        [true; 3],
        true,
        [USDX_START, UNDERLYING_START, UNDERLYING_START],
    );
    let big = i64::MAX as i128 + 1;
    let before = t.snap();
    sac_rejected(
        &t,
        t.c.try_create_offer(&g, &t.rwa, &OptionType::Put, &QTY, &big, &PREMIUM, &EXPIRY),
        SAC_OVERFLOW,
        &before,
    );
    sac_rejected(
        &t,
        t.c.try_create_offer(
            &g,
            &t.rwa,
            &OptionType::Call,
            &big,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        SAC_OVERFLOW,
        &before,
    );
    // premium above i64 from a G buyer
    let id = t.offer_x(&t.writer, &t.rwa, OptionType::Put, QTY, STRIKE, big, EXPIRY);
    let before = t.snap();
    sac_rejected(&t, t.c.try_buy(&g, &id), SAC_OVERFLOW, &before);
}

// =============================================================================================
// 10. Token edges (classic G accounts and trustlines)
// =============================================================================================

#[test]
fn tokens10_buyer_without_underlying_trustline_is_not_eligible() {
    let t = setup();
    let put = t.put(&t.writer);
    let call = t.call(&t.maker2);
    // USDx trustline (funded), no RWA trustline at all
    let g = t.g_actor([true, false, false], false, [USDX_START, 0, 0]);
    assert!(!t.c.is_eligible(&t.rwa, &g));
    let before = t.snap();
    rejected(&t, t.c.try_buy(&g, &put), Error::NotEligible, &before);
    rejected(&t, t.c.try_buy(&g, &call), Error::NotEligible, &before);
    // RWA trustline present but not authorized by the issuer
    t.sac(&t.rwa).trust(&g);
    assert!(!t.c.is_eligible(&t.rwa, &g));
    let before = t.snap();
    rejected(&t, t.c.try_buy(&g, &put), Error::NotEligible, &before);
    // positive control once the issuer authorizes it
    t.sac(&t.rwa).set_authorized(&g, &true);
    t.c.buy(&g, &put);
    assert_eq!(t.bal(&t.usdx, &g), USDX_START - PREMIUM);
}

#[test]
fn tokens10_writer_without_quote_trustline_or_funds_is_rejected() {
    let t = setup();
    // authorized and funded on RWA, no USDx trustline
    let g = t.g_actor([false, true, false], true, [0, UNDERLYING_START, 0]);
    assert!(t.c.is_eligible(&t.rwa, &g));
    assert!(!t.c.is_eligible(&t.usdx, &g));
    let before = t.snap();
    for ty in [OptionType::Put, OptionType::Call] {
        rejected(
            &t,
            t.c.try_create_offer(&g, &t.rwa, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
            Error::NotEligible,
            &before,
        );
    }
    // USDx trustline but zero balance: the PUT collateral pull fails in the SAC
    t.sac(&t.usdx).trust(&g);
    let before = t.snap();
    sac_rejected(
        &t,
        t.c.try_create_offer(
            &g,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        SAC_BALANCE,
        &before,
    );
    // not authorized on the underlying (BOND trustline exists, issuer never authorized it)
    t.sac(&t.bond).trust(&g);
    let before = t.snap();
    rejected(
        &t,
        t.c.try_create_offer(
            &g,
            &t.bond,
            &OptionType::Call,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::NotEligible,
        &before,
    );
    // positive control: a CALL (RWA collateral) works and the premium lands on the new trustline
    let id = t.call(&g);
    t.c.buy(&t.holder, &id);
    assert_eq!(t.bal(&t.usdx, &g), PREMIUM);
}

#[test]
fn tokens10_deauthorized_holder_cannot_exercise_and_writer_reclaims() {
    let t = setup();
    let funds = [USDX_START, UNDERLYING_START, UNDERLYING_START];
    let g = t.g_actor([true; 3], true, funds);
    let holders = [t.holder.clone(), g];
    let mut pairs = std::vec::Vec::new();
    for h in &holders {
        let put = t.put(&t.writer);
        let call = t.call(&t.writer);
        t.c.buy(h, &put);
        t.c.buy(h, &call);
        pairs.push((h.clone(), put, call));
    }
    for (h, _, _) in &pairs {
        t.sac(&t.rwa).set_authorized(h, &false);
    }
    let before = t.snap();
    for (h, put, call) in &pairs {
        // PUT: the holder cannot deliver; CALL: the holder cannot receive
        sac_rejected(&t, t.c.try_exercise(h, put), SAC_DEAUTHORIZED, &before);
        sac_rejected(&t, t.c.try_exercise(h, call), SAC_DEAUTHORIZED, &before);
    }
    t.at(EXPIRY);
    let w_usdx = t.bal(&t.usdx, &t.writer);
    let w_rwa = t.bal(&t.rwa, &t.writer);
    for (_, put, call) in &pairs {
        t.c.reclaim(&t.writer, put);
        t.c.reclaim(&t.writer, call);
    }
    assert_eq!(t.bal(&t.usdx, &t.writer), w_usdx + 2 * STRIKE);
    assert_eq!(t.bal(&t.rwa, &t.writer), w_rwa + 2 * QTY);
    for tok in t.tokens() {
        assert_eq!(t.c.open_collateral(&tok), 0);
        assert_eq!(t.bal(&tok, &t.contract), 0);
    }
}

// =============================================================================================
// 11. Allowlist
// =============================================================================================

#[test]
fn allowlist11_unlisted_underlyings_rejected_before_any_transfer() {
    let t = setup();
    let env = &t.env;
    let rogue = env
        .register_stellar_asset_contract_v2(Address::generate(env))
        .address();
    StellarAssetClient::new(env, &rogue).mint(&t.writer, &UNDERLYING_START);
    let random = Address::generate(env);
    let cases = [
        ("the quote token", t.usdx.clone()),
        ("an unlisted SAC the writer holds", rogue.clone()),
        ("a random contract address", random),
        ("the options contract itself", t.contract.clone()),
    ];
    let before = t.snap();
    let rogue_bal = t.bal(&rogue, &t.writer);
    for (label, u) in &cases {
        for ty in [OptionType::Put, OptionType::Call] {
            // The writer signs ONLY the create_offer root: any SAC transfer attempted before the
            // allowlist check would fail with an Auth error instead of AssetNotAllowed.
            let root = MockAuthInvoke {
                contract: &t.contract,
                fn_name: "create_offer",
                args: (&t.writer, u, ty, QTY, STRIKE, PREMIUM, EXPIRY).into_val(env),
                sub_invokes: &[],
            };
            env.mock_auths(&[MockAuth {
                address: &t.writer,
                invoke: &root,
            }]);
            let r =
                t.c.try_create_offer(&t.writer, u, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY);
            assert!(t.no_events(), "{label}");
            assert_err(r, Error::AssetNotAllowed);
            assert_eq!(t.snap(), before, "{label}");
            assert_eq!(t.bal(&rogue, &t.writer), rogue_bal, "{label}");
        }
    }
    // control: with an allowlisted underlying the same root-only signature fails in the SAC's
    // auth check, i.e. the harness above would have caught a transfer.
    let root = MockAuthInvoke {
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
            .into_val(env),
        sub_invokes: &[],
    };
    env.mock_auths(&[MockAuth {
        address: &t.writer,
        invoke: &root,
    }]);
    let r = t.raw(
        "create_offer",
        (
            &t.writer,
            &t.rwa,
            OptionType::Put,
            QTY,
            STRIKE,
            PREMIUM,
            EXPIRY,
        )
            .into_val(env),
    );
    t.assert_rejected_root("allowlisted, root-only signature", r, AUTH_INVALID, &before);
}

// =============================================================================================
// 12. Events
// =============================================================================================

#[test]
fn events12_one_event_per_success_none_per_failure() {
    let t = setup();
    let (w, m, h) = (&t.writer, &t.maker2, &t.holder);
    let quiet = |t: &T, label: &str| {
        assert!(t.no_events(), "{label}: failed call emitted events");
    };

    let p = t.put(w);
    t.assert_one_event("offer_created", p);
    let c = t.call(m);
    t.assert_one_event("offer_created", c);
    assert!(t.c.try_buy(w, &p).is_err());
    quiet(&t, "self trade");
    assert!(t.c.try_buy(&t.outsider, &p).is_err());
    quiet(&t, "ineligible buyer");
    t.c.buy(h, &p);
    t.assert_one_event("option_bought", p);
    assert!(t.c.try_buy(&t.holder2, &p).is_err());
    quiet(&t, "double buy");
    t.c.buy(h, &c);
    t.assert_one_event("option_bought", c);
    assert!(t.c.try_exercise(m, &p).is_err());
    quiet(&t, "non-holder exercise");
    t.c.exercise(h, &p);
    t.assert_one_event("option_exercised", p);
    assert!(t.c.try_exercise(h, &p).is_err());
    quiet(&t, "double exercise");
    t.c.exercise(h, &c);
    t.assert_one_event("option_exercised", c);
    assert!(t.c.try_claim_delivery(m, &p).is_err());
    quiet(&t, "foreign claim");
    t.c.claim_delivery(w, &p);
    t.assert_one_event("delivery_claimed", p);
    t.c.claim_delivery(m, &c);
    t.assert_one_event("delivery_claimed", c);
    assert!(t.c.try_claim_delivery(w, &p).is_err());
    quiet(&t, "double claim");
    let x = t.put(w);
    t.assert_one_event("offer_created", x);
    assert!(t.c.try_cancel_offer(m, &x).is_err());
    quiet(&t, "foreign cancel");
    t.c.cancel_offer(w, &x);
    t.assert_one_event("offer_cancelled", x);
    let v = t.put(m);
    t.assert_one_event("offer_created", v);
    assert!(t.c.try_transfer(h, &t.holder2, &v).is_err());
    quiet(&t, "transfer of an Offered option");
    t.c.buy(h, &v);
    t.assert_one_event("option_bought", v);
    assert!(t.c.try_transfer(h, h, &v).is_err());
    quiet(&t, "transfer to self");
    assert!(t.c.try_transfer(h, m, &v).is_err());
    quiet(&t, "transfer to the writer");
    assert!(t.c.try_transfer(h, &t.outsider, &v).is_err());
    quiet(&t, "transfer to an ineligible recipient");
    assert!(t.c.try_transfer(m, &t.holder2, &v).is_err());
    quiet(&t, "transfer by the writer");
    t.c.transfer(h, &t.holder2, &v);
    t.assert_one_event("option_transferred", v);
    assert!(t.c.try_transfer(h, &t.holder2, &v).is_err());
    quiet(&t, "transfer by the previous holder");
    let y = t.offer(m, &t.bond, OptionType::Put);
    let z = t.offer(w, &t.bond, OptionType::Call);
    t.c.buy(&t.holder2, &z);
    assert!(t.c.try_reclaim(m, &y).is_err());
    quiet(&t, "early reclaim");
    assert!(t
        .c
        .try_create_offer(w, &t.rwa, &OptionType::Put, &0, &1, &1, &EXPIRY)
        .is_err());
    quiet(&t, "invalid args");
    assert!(t
        .c
        .try_create_offer(
            w,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &(USDX_START * 10),
            &PREMIUM,
            &EXPIRY
        )
        .is_err());
    quiet(&t, "SAC failure after checks");
    assert!(t.c.try_extend_ttl(&vec![&t.env, 77]).is_err());
    quiet(&t, "extend_ttl unknown id");
    t.c.extend_ttl(&vec![&t.env, y, z]);
    assert!(
        t.opt_events().is_empty(),
        "extend_ttl is not a state change"
    );
    t.at(EXPIRY);
    t.c.reclaim(m, &y);
    t.assert_one_event("option_reclaimed", y);
    t.c.reclaim(w, &z);
    t.assert_one_event("option_reclaimed", z);
    assert!(t.c.try_reclaim(w, &z).is_err());
    quiet(&t, "double reclaim");
    assert!(t.c.try_transfer(&t.holder2, h, &v).is_err());
    quiet(&t, "transfer at expiry");
    t.c.reclaim(m, &v);
    t.assert_one_event("option_reclaimed", v);
}

// =============================================================================================
// 13. Front-running shape
// =============================================================================================

#[test]
fn frontrun13_offer_terms_are_immutable_and_signed_premium_binds() {
    let t = setup();
    let env = &t.env;
    let (w, m, h, h2) = (&t.writer, &t.maker2, &t.holder, &t.holder2);
    let x = t.put(w);
    let terms = t.c.get_option(&x);

    // unrelated activity by everyone, including the writer, while the offer is open
    let a = t.call(m);
    let b = t.put(w);
    t.c.buy(h2, &a);
    t.c.exercise(h2, &a);
    t.c.claim_delivery(m, &a);
    t.c.cancel_offer(w, &b);
    let c = t.offer_x(w, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM * 9, EXPIRY);
    t.c.extend_ttl(&vec![env, x, a, b, c]);
    t.at(EXPIRY - 1);
    assert!(t.c.try_buy(w, &x).is_err());
    assert!(t.c.try_cancel_offer(m, &x).is_err());
    assert!(t.c.try_reclaim(w, &x).is_err());
    assert_eq!(
        t.c.get_option(&x),
        terms,
        "offer terms changed before purchase"
    );
    assert!(t.c.list_open().contains(x));

    // The buyer's signed tree binds id AND premium amount. The writer front-runs it by
    // cancelling x and re-listing the same option at a higher premium.
    let fee = transfer(&t, &t.usdx, (h, w, PREMIUM).into_val(env));
    let buy_x = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "buy",
        args: (h, x).into_val(env),
        sub_invokes: std::slice::from_ref(&fee),
    };
    t.c.cancel_offer(w, &x);
    let y = t.offer_x(w, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM * 2, EXPIRY);
    let buy_y_old_fee = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "buy",
        args: (h, y).into_val(env),
        sub_invokes: std::slice::from_ref(&fee),
    };
    let before = t.snap();
    // the relayed signature for x now hits a cancelled offer: no premium is taken
    env.mock_auths(&[MockAuth {
        address: h,
        invoke: &buy_x,
    }]);
    rejected(&t, t.c.try_buy(h, &x), Error::WrongState, &before);
    // and cannot be redirected to the re-listed offer
    env.mock_auths(&[MockAuth {
        address: h,
        invoke: &buy_x,
    }]);
    let r = t.raw("buy", (h, y).into_val(env));
    t.assert_rejected_root("buy x-signature used for y", r, AUTH_INVALID, &before);
    // even a signed root for y does not authorize a premium other than the one signed
    env.mock_auths(&[MockAuth {
        address: h,
        invoke: &buy_y_old_fee,
    }]);
    let r = t.raw("buy", (h, y).into_val(env));
    t.assert_rejected_root(
        "buy y with the old premium signed",
        r,
        AUTH_INVALID,
        &before,
    );
    env.mock_all_auths();
}

// =============================================================================================
// 14. Double-spend of collateral
// =============================================================================================

#[test]
fn doublespend14_collateral_is_released_at_most_once() {
    let t = setup();
    let (w, m, h) = (&t.writer, &t.maker2, &t.holder);
    // exercised: the writer cannot also take the collateral back
    let ex_put = t.put(w);
    let ex_call = t.call(w);
    for id in [ex_put, ex_call] {
        t.c.buy(h, &id);
        t.c.exercise(h, &id);
    }
    // reclaimed: the holder cannot exercise any more
    let rc = t.put(m);
    t.c.buy(h, &rc);
    // cancelled: nobody can buy
    let cx = t.call(m);
    t.c.cancel_offer(m, &cx);

    let before = t.snap();
    for id in [ex_put, ex_call] {
        rejected(&t, t.c.try_cancel_offer(w, &id), Error::WrongState, &before);
    }
    for buyer in [h, &t.holder2, w, &t.outsider] {
        rejected(&t, t.c.try_buy(buyer, &cx), Error::WrongState, &before);
    }
    t.at(EXPIRY);
    for id in [ex_put, ex_call] {
        rejected(&t, t.c.try_reclaim(w, &id), Error::WrongState, &before);
    }
    t.c.reclaim(m, &rc);
    let before = t.snap();
    rejected(&t, t.c.try_exercise(h, &rc), Error::WrongState, &before);
    // even if the clock were before expiry (test-only), the state forbids it
    t.at(START + 1);
    rejected(&t, t.c.try_exercise(h, &rc), Error::WrongState, &before);
    rejected(&t, t.c.try_cancel_offer(m, &rc), Error::WrongState, &before);
    rejected(&t, t.c.try_buy(&t.holder2, &rc), Error::WrongState, &before);
    // proceeds are claimable exactly once
    t.c.claim_delivery(w, &ex_put);
    t.c.claim_delivery(w, &ex_call);
    let before = t.snap();
    for id in [ex_put, ex_call] {
        rejected(
            &t,
            t.c.try_claim_delivery(w, &id),
            Error::WrongState,
            &before,
        );
    }
    for tok in t.tokens() {
        assert_eq!(t.c.open_collateral(&tok), 0);
        assert_eq!(t.bal(&tok, &t.contract), 0);
    }
}

// =============================================================================================
// 15. Other security.md classes
// =============================================================================================

#[test]
fn extra15_signed_auth_entry_cannot_be_replayed() {
    // Host-managed nonces: the very same signed entry submitted twice creates one offer only.
    let t = setup();
    let env = &t.env;
    let lock = transfer(&t, &t.usdx, (&t.writer, &t.contract, STRIKE).into_val(env));
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
            .into_val(env),
        sub_invokes: std::slice::from_ref(&lock),
    };
    let ma = MockAuth {
        address: &t.writer,
        invoke: &create,
    };
    let entry: xdr::SorobanAuthorizationEntry = (&ma).into();
    env.mock_auths(std::slice::from_ref(&ma)); // registers the writer's mock account contract
    env.set_auths(std::slice::from_ref(&entry));
    assert_eq!(
        t.c.create_offer(
            &t.writer,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY
        ),
        0
    );
    let before = t.snap();
    env.set_auths(&[entry]);
    let r = t.raw(
        "create_offer",
        (
            &t.writer,
            &t.rwa,
            OptionType::Put,
            QTY,
            STRIKE,
            PREMIUM,
            EXPIRY,
        )
            .into_val(env),
    );
    assert!(r.is_err());
    let root = t.root_error();
    assert!(t.no_events());
    assert_eq!(t.snap(), before);
    assert!(
        matches!(
            root,
            Some(xdr::ScError::Auth(_)) | Some(xdr::ScError::Storage(_))
        ),
        "{root:?}"
    );
    std::println!("extra15 nonce replay root cause: {root:?}");
    env.mock_all_auths();
}

#[test]
fn extra15_constructor_cannot_be_reinvoked() {
    let t = setup();
    let env = &t.env;
    let cfg = t.c.config();
    let before = t.snap();
    let attacker_quote = t.rwa.clone();
    let r = t.raw(
        "__constructor",
        (&attacker_quote, vec![env, t.usdx.clone()]).into_val(env),
    );
    assert!(r.is_err());
    let root = t.root_error();
    assert!(t.no_events());
    assert_eq!(t.c.config(), cfg);
    assert_eq!(t.snap(), before);
    std::println!("extra15 constructor re-invocation root cause: {root:?}");
}

#[test]
fn extra15_muxed_address_rejected_as_party() {
    let t = setup();
    let env = &t.env;
    let id = t.put(&t.writer);
    let active = t.call(&t.maker2);
    t.c.buy(&t.holder, &active);
    let m = MuxedAddress::generate(env);
    let mv = Val::try_from_val(env, &m).unwrap();
    let before = t.snap();
    let calls: std::vec::Vec<(&str, Vec<Val>)> = std::vec![
        ("buy", vec![env, mv, id.into_val(env)]),
        ("exercise", vec![env, mv, id.into_val(env)]),
        ("cancel_offer", vec![env, mv, id.into_val(env)]),
        (
            "transfer",
            vec![env, mv, t.holder2.into_val(env), active.into_val(env)]
        ),
        (
            "transfer",
            vec![env, t.holder.into_val(env), mv, active.into_val(env)]
        ),
        (
            "create_offer",
            vec![
                env,
                mv,
                t.rwa.into_val(env),
                OptionType::Put.into_val(env),
                QTY.into_val(env),
                STRIKE.into_val(env),
                PREMIUM.into_val(env),
                EXPIRY.into_val(env),
            ],
        ),
    ];
    for (f, args) in calls {
        let r = t.raw(f, args);
        assert!(r.is_err(), "{f} accepted a muxed address");
        let root = t.root_error();
        assert!(t.no_events());
        assert_eq!(t.snap(), before);
        std::println!("extra15 muxed address as party, {f}: root cause {root:?}");
    }
}

#[test]
fn extra15_standing_allowance_to_the_contract_is_never_spent() {
    // The contract pulls funds only with `transfer` authorized by `from`; an allowance the
    // holder granted to the contract (e.g. by a careless UI) cannot be used by a third party.
    let t = setup();
    let env = &t.env;
    let id = t.put(&t.writer);
    let exp_ledger = env.ledger().sequence() + 1000;
    TokenClient::new(env, &t.usdx).approve(&t.holder, &t.contract, &USDX_START, &exp_ledger);
    let buy = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "buy",
        args: (&t.holder, id).into_val(env),
        sub_invokes: &[],
    };
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![
        (
            "maker2 signs buy(holder) with an allowance in place",
            std::vec![MockAuth {
                address: &t.maker2,
                invoke: &buy
            }]
        ),
        ("no signature, allowance in place", std::vec![]),
    ];
    assert_auth_cases(&t, "buy", &(&t.holder, id).into_val(env), &cases);
    assert_eq!(
        TokenClient::new(env, &t.usdx).allowance(&t.holder, &t.contract),
        USDX_START
    );
    env.mock_all_auths();
}

#[test]
fn extra15_ttl_is_not_a_security_boundary() {
    // Anyone can extend any entry's TTL; the lifecycle must depend on `expiry` (a stored
    // timestamp) only, never on TTL.
    let t = setup();
    let env = &t.env;
    let a = t.put(&t.writer);
    let done = t.call(&t.writer);
    t.c.buy(&t.holder, &a);
    t.c.cancel_offer(&t.writer, &done);
    let before = t.snap();
    env.set_auths(&[]); // a stranger without any signature
    t.c.extend_ttl(&vec![env, a, done]);
    assert!(t.opt_events().is_empty());
    env.mock_all_auths();
    assert_eq!(t.snap(), before);
    // 25 days of ledgers pass without the clock reaching expiry: still exercisable
    let seq = env.ledger().sequence();
    env.ledger().set_sequence_number(seq + 25 * DAY);
    t.c.extend_ttl(&vec![env, a, done]);
    assert_eq!(t.state(done), State::Cancelled);
    t.at(EXPIRY);
    let before = t.snap();
    rejected(&t, t.c.try_exercise(&t.holder, &a), Error::Expired, &before);
    t.c.extend_ttl(&vec![env, a]);
    rejected(&t, t.c.try_exercise(&t.holder, &a), Error::Expired, &before);
    t.c.reclaim(&t.writer, &a);
    assert_eq!(t.state(a), State::Expired);
}

// =============================================================================================
// 16. Holder transfer (v1.2)
// =============================================================================================

#[test]
fn transfer16_rejects_non_holder_callers_and_ineligible_recipients() {
    let t = setup();
    let (w, m, h, h2) = (&t.writer, &t.maker2, &t.holder, &t.holder2);
    let funds = [USDX_START, UNDERLYING_START, UNDERLYING_START];
    let put = t.put(w);
    let bond_call = t.offer(w, &t.bond, OptionType::Call);
    t.c.buy(h, &put);
    t.c.buy(h, &bond_call);

    // recipients that cannot settle on either underlying
    let no_trustline = t.g_actor([true, false, false], false, [USDX_START, 0, 0]);
    let unauthorized_trustline = t.g_actor([true; 3], false, [USDX_START, 0, 0]);
    let revoked_g = t.g_actor([true; 3], true, funds);
    let revoked_c = t.c_actor(funds);
    for a in [&revoked_g, &revoked_c] {
        for u in [&t.rwa, &t.bond] {
            t.sac(u).set_authorized(a, &false);
        }
    }
    let unknown = Address::generate(&t.env);
    t.extra.borrow_mut().push(unknown.clone());
    // eligible on RWA only
    let rwa_only = t.c_actor(funds);
    t.sac(&t.bond).set_authorized(&rwa_only, &false);
    let before = t.snap();

    // Callers other than the holder: NotHolder whatever the recipient (ownership comes before the
    // recipient checks, so not even the writer learns anything else).
    for caller in [w, m, h2, &t.outsider, &no_trustline] {
        for id in [put, bond_call] {
            for to in [h, h2, m, w, caller, &t.outsider] {
                rejected(
                    &t,
                    t.c.try_transfer(caller, to, &id),
                    Error::NotHolder,
                    &before,
                );
            }
        }
    }
    rejected(&t, t.c.try_transfer(h, h2, &99), Error::NotFound, &before);

    // The holder: to itself -> InvalidArgs, to the writer -> SelfTrade.
    for id in [put, bond_call] {
        rejected(&t, t.c.try_transfer(h, h, &id), Error::InvalidArgs, &before);
        rejected(&t, t.c.try_transfer(h, w, &id), Error::SelfTrade, &before);
    }
    // Recipients not authorized on the option's underlying: NotEligible.
    let bad = [
        &t.outsider,
        &no_trustline,
        &unauthorized_trustline,
        &revoked_g,
        &revoked_c,
        &unknown,
    ];
    for to in bad {
        assert!(
            !t.c.is_eligible(&t.rwa, to) && !t.c.is_eligible(&t.bond, to),
            "{to:?}"
        );
        for id in [put, bond_call] {
            rejected(
                &t,
                t.c.try_transfer(h, to, &id),
                Error::NotEligible,
                &before,
            );
        }
    }
    // eligibility is per underlying
    assert!(t.c.is_eligible(&t.rwa, &rwa_only) && !t.c.is_eligible(&t.bond, &rwa_only));
    rejected(
        &t,
        t.c.try_transfer(h, &rwa_only, &bond_call),
        Error::NotEligible,
        &before,
    );
    assert_eq!(t.c.get_option(&put).holder, Some(h.clone()));

    // positive controls: the same holder, eligible recipients
    t.c.transfer(h, &rwa_only, &put);
    t.c.transfer(h, h2, &bond_call);
    assert_eq!(t.c.get_option(&put).holder, Some(rwa_only.clone()));
    assert_eq!(t.c.get_option(&bond_call).holder, Some(h2.clone()));

    // Only the underlying is checked (ABI §3): a recipient authorized on RWA without a USDx
    // trustline is accepted, but cannot be paid the PUT strike until it adds one. The failed
    // exercise is atomic (its RWA delivery is undone).
    let no_quote = t.g_actor([false, true, false], true, [0, UNDERLYING_START, 0]);
    let put2 = t.put(w);
    t.c.buy(h, &put2);
    t.c.transfer(h, &no_quote, &put2);
    let before = t.snap();
    sac_rejected(
        &t,
        t.c.try_exercise(&no_quote, &put2),
        SAC_NO_TRUSTLINE,
        &before,
    );
    t.sac(&t.usdx).trust(&no_quote);
    t.c.exercise(&no_quote, &put2);
    assert_eq!(t.bal(&t.usdx, &no_quote), STRIKE);
    assert_eq!(t.bal(&t.rwa, &no_quote), UNDERLYING_START - QTY);
}

#[test]
fn transfer16_rejected_in_every_state_except_active() {
    let t = setup();
    let (w, m, h, h2) = (&t.writer, &t.maker2, &t.holder, &t.holder2);
    let offered = t.put(w);
    let exercised = t.put(w);
    t.c.buy(h, &exercised);
    t.c.exercise(h, &exercised);
    let settled = t.call(w);
    t.c.buy(h, &settled);
    t.c.exercise(h, &settled);
    t.c.claim_delivery(w, &settled);
    let cancelled = t.put(w);
    t.c.cancel_offer(w, &cancelled);
    let expired_offered = t.call(w);
    let expired_active = t.put(w);
    t.c.buy(h, &expired_active);
    t.at(EXPIRY);
    t.c.reclaim(w, &expired_offered);
    t.c.reclaim(w, &expired_active);

    // ABI §3 order: NotHolder unless `Some(caller) == holder`, then WrongState unless Active.
    // Offered, Cancelled and Expired-from-Offered have no holder; the others keep the buyer.
    let cases: [(u32, State, Option<&Address>); 6] = [
        (offered, State::Offered, None),
        (exercised, State::Exercised, Some(h)),
        (settled, State::Settled, Some(h)),
        (cancelled, State::Cancelled, None),
        (expired_offered, State::Expired, None),
        (expired_active, State::Expired, Some(h)),
    ];
    let mut n = 0u32;
    // after expiry AND (test-only) before it: the rejection comes from the state, not the clock
    for ts in [EXPIRY + 1, START + 1] {
        t.at(ts);
        for (id, state, recorded) in cases {
            let opt = t.c.get_option(&id);
            assert_eq!(opt.state, state);
            assert_eq!(opt.holder.as_ref(), recorded);
            for p in [w, m, h, h2, &t.outsider] {
                let want = if recorded == Some(p) {
                    Error::WrongState
                } else {
                    Error::NotHolder
                };
                for to in [h2, m, &t.outsider] {
                    let before = t.snap();
                    rejected(&t, t.c.try_transfer(p, to, &id), want, &before);
                    n += 1;
                }
            }
        }
    }
    assert_eq!(n, 180);
}

#[test]
fn transfer16_expiry_boundary_is_exclusive_and_checked_before_recipient() {
    let t = setup();
    let (w, h, h2) = (&t.writer, &t.holder, &t.holder2);
    let a = t.put(w);
    let b = t.call(w);
    t.c.buy(h, &a);
    t.c.buy(h, &b);

    t.at(EXPIRY - 1); // now < expiry: still transferable
    t.c.transfer(h, h2, &a);
    t.assert_one_event("option_transferred", a);

    for ts in [EXPIRY, EXPIRY + 1] {
        t.at(ts);
        let before = t.snap();
        rejected(&t, t.c.try_transfer(h2, h, &a), Error::Expired, &before);
        rejected(&t, t.c.try_transfer(h, h2, &b), Error::Expired, &before);
        // time is checked before the recipient: self, writer and ineligible all read Expired
        for to in [h, w, &t.outsider] {
            rejected(&t, t.c.try_transfer(h, to, &b), Error::Expired, &before);
        }
        // exercise closes at the same instant
        rejected(&t, t.c.try_exercise(h2, &a), Error::Expired, &before);
        rejected(&t, t.c.try_exercise(h, &b), Error::Expired, &before);
    }

    // the writer reclaims both in full; the transferred option keeps its last holder on record
    t.at(EXPIRY);
    let (w_usdx, w_rwa) = (t.bal(&t.usdx, w), t.bal(&t.rwa, w));
    t.c.reclaim(w, &a);
    t.c.reclaim(w, &b);
    assert_eq!(t.bal(&t.usdx, w), w_usdx + STRIKE);
    assert_eq!(t.bal(&t.rwa, w), w_rwa + QTY);
    assert_eq!(t.c.get_option(&a).holder, Some(h2.clone()));
    assert_eq!(t.state(a), State::Expired);
}

#[test]
fn transfer16_moves_no_tokens_and_changes_no_reserves() {
    let t = setup();
    let (w, m, h, h2) = (&t.writer, &t.maker2, &t.holder, &t.holder2);
    let g = t.g_actor(
        [true; 3],
        true,
        [USDX_START, UNDERLYING_START, UNDERLYING_START],
    );
    let put = t.put(w);
    let call = t.call(m);
    let bput = t.offer(m, &t.bond, OptionType::Put);
    let bcall = t.offer(w, &t.bond, OptionType::Call);
    let _still_offered = t.put(m); // keeps list_open and the USDx reserve non-trivial
    for id in [put, call, bput, bcall] {
        t.c.buy(h, &id);
    }
    let totals0 = t.totals();

    // two hops on `put`, a G-account recipient, and a writer of OTHER options as recipient
    let hops: [(u32, &Address, &Address); 5] = [
        (put, h, h2),
        (put, h2, m),
        (call, h, &g),
        (bput, h, w),
        (bcall, h, h2),
    ];
    for (id, from, to) in hops {
        let before = t.snap();
        t.c.transfer(from, to, &id);
        // exactly one event in the whole invocation: no SAC transfer happened
        assert_eq!(
            t.env.events().all().events().len(),
            1,
            "transfer of {id}: extra events"
        );
        t.assert_one_event("option_transferred", id);
        let mut expected = before.clone();
        expected
            .options
            .iter_mut()
            .find(|o| o.id == id)
            .unwrap()
            .holder = Some(to.clone());
        assert_eq!(
            t.snap(),
            expected,
            "transfer of {id} changed more than the holder"
        );
        assert_eq!(t.state(id), State::Active);
        assert_eq!(t.totals(), totals0);
        let expect = t.abi_reserves();
        for (i, tok) in t.tokens().iter().enumerate() {
            assert_eq!(t.bal(tok, &t.contract), expect[i]);
        }
        // the sender is out
        let after = t.snap();
        rejected(&t, t.c.try_exercise(from, &id), Error::NotHolder, &after);
        rejected(
            &t,
            t.c.try_transfer(from, to, &id),
            Error::NotHolder,
            &after,
        );
    }

    // The new holders settle with their own tokens; the original buyer only ever paid premiums.
    let h_bals = [t.bal(&t.usdx, h), t.bal(&t.rwa, h), t.bal(&t.bond, h)];
    t.c.exercise(m, &put);
    t.c.exercise(&g, &call);
    t.c.exercise(w, &bput);
    t.c.exercise(h2, &bcall);
    assert_eq!(
        [t.bal(&t.usdx, h), t.bal(&t.rwa, h), t.bal(&t.bond, h)],
        h_bals
    );
    t.c.claim_delivery(w, &put);
    t.c.claim_delivery(m, &call);
    t.c.claim_delivery(m, &bput);
    t.c.claim_delivery(w, &bcall);
    assert_eq!(t.totals(), totals0);
    let expect = t.abi_reserves();
    assert_eq!(
        expect,
        [STRIKE, 0, 0],
        "only the untouched offer stays reserved"
    );
    for (i, tok) in t.tokens().iter().enumerate() {
        assert_eq!(t.c.open_collateral(tok), expect[i]);
        assert_eq!(t.bal(tok, &t.contract), expect[i]);
    }
}

/// Pins the ABI §3 rule that `transfer` checks only the RECIPIENT's eligibility. An issuer freeze
/// of the holder blocks its own `exercise` (SAC #11) but not a hand-over to an issuer-authorized
/// account; the frozen account's tokens never move, and the new holder settles with its own
/// authorized balance. No regulated token moves without issuer authorization.
#[test]
fn transfer16_frozen_holder_can_hand_over_but_its_tokens_never_move() {
    let t = setup();
    let (w, h, h2) = (&t.writer, &t.holder, &t.holder2);
    let put = t.put(w);
    let call = t.call(w);
    t.c.buy(h, &put);
    t.c.buy(h, &call);
    t.sac(&t.rwa).set_authorized(h, &false);
    let before = t.snap();
    sac_rejected(&t, t.c.try_exercise(h, &put), SAC_DEAUTHORIZED, &before);
    sac_rejected(&t, t.c.try_exercise(h, &call), SAC_DEAUTHORIZED, &before);

    let frozen = [t.bal(&t.usdx, h), t.bal(&t.rwa, h), t.bal(&t.bond, h)];
    t.c.transfer(h, h2, &put);
    t.c.transfer(h, h2, &call);
    t.c.exercise(h2, &put);
    t.c.exercise(h2, &call);
    assert_eq!(
        [t.bal(&t.usdx, h), t.bal(&t.rwa, h), t.bal(&t.bond, h)],
        frozen
    );
    // h2: PUT delivers QTY RWA for STRIKE USDx, CALL pays STRIKE USDx for QTY RWA
    assert_eq!(t.bal(&t.usdx, h2), USDX_START);
    assert_eq!(t.bal(&t.rwa, h2), UNDERLYING_START);
}

// =============================================================================================
// 17. Paged reads (v1.2)
// =============================================================================================

#[test]
fn paging17_get_options_never_panics_and_never_reveals_ids_at_or_past_count() {
    let t = setup();
    let (w, m, h, h2) = (&t.writer, &t.maker2, &t.holder, &t.holder2);
    let limits = [0u32, 1, 2, 49, 50, 51, 1000, u32::MAX - 1, u32::MAX];
    // `dense`: every id below option_count has a stored entry (always true on a deployment).
    let check = |label: &str, dense: bool| {
        let count = t.c.option_count();
        let froms = [
            0u32,
            1,
            count / 2,
            count.saturating_sub(1),
            count,
            count.saturating_add(1),
            49,
            50,
            51,
            u32::MAX / 2,
            u32::MAX - 50,
            u32::MAX - 1,
            u32::MAX,
        ];
        let mut known = std::collections::BTreeMap::new();
        for from in froms {
            for limit in limits {
                let page = match t.c.try_get_options(&from, &limit) {
                    Ok(Ok(p)) => p,
                    other => panic!("{label}: get_options({from}, {limit}) failed: {other:?}"),
                };
                assert!(t.no_events(), "{label}: get_options emitted events");
                let cap = limit.min(MAX_PAGE);
                assert!(
                    page.len() <= cap,
                    "{label}: get_options({from}, {limit}) exceeds the cap"
                );
                for (i, o) in page.iter().enumerate() {
                    assert_eq!(
                        from.checked_add(i as u32),
                        Some(o.id),
                        "{label}: not contiguous"
                    );
                    assert!(
                        o.id < count,
                        "{label}: get_options({from}, {limit}) revealed id {}",
                        o.id
                    );
                    let stored = known.entry(o.id).or_insert_with(|| t.c.get_option(&o.id));
                    assert_eq!(&o, stored, "{label}: page differs from get_option");
                }
                if dense {
                    let want = if from >= count {
                        0
                    } else {
                        (count - from).min(cap)
                    };
                    assert_eq!(
                        page.len(),
                        want,
                        "{label}: get_options({from}, {limit}) length"
                    );
                }
            }
        }
    };

    check("no options", true);

    // mixed states, then dust offers past one page
    let a = t.put(w);
    t.c.buy(h, &a);
    t.c.transfer(h, h2, &a);
    let b = t.call(m);
    t.c.buy(h, &b);
    t.c.exercise(h, &b);
    t.c.claim_delivery(m, &b);
    let c = t.offer(w, &t.bond, OptionType::Put);
    t.c.cancel_offer(w, &c);
    t.offer(m, &t.bond, OptionType::Call);
    for _ in 0..58 {
        t.offer_x(w, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY);
    }
    assert_eq!(t.c.option_count(), 62);
    let before = t.snap();
    check("62 options", true);
    assert_eq!(t.snap(), before, "get_options changed state");
    assert_eq!(t.c.get_options(&0, &u32::MAX).len(), MAX_PAGE);
    assert_eq!(
        t.c.get_options(&a, &1).get(0).unwrap().holder,
        Some(h2.clone())
    );

    // Test-only state: the counter is lowered below stored ids, so the `id < option_count` guard
    // itself is observable (on a deployment no entry exists at or past the counter).
    let next_key: Vec<Val> = vec![&t.env, Symbol::new(&t.env, "Next").into_val(&t.env)];
    let set_next = |n: u32| {
        t.env.as_contract(&t.contract, || {
            t.env.storage().instance().set(&next_key, &n)
        });
    };
    set_next(3);
    assert!(t.c.try_get_option(&10).is_ok(), "id 10 is stored");
    check("counter below stored ids", true);
    let ids = |from: u32, limit: u32| -> std::vec::Vec<u32> {
        t.c.get_options(&from, &limit)
            .iter()
            .map(|o| o.id)
            .collect()
    };
    assert_eq!(ids(0, u32::MAX), [0, 1, 2]);
    assert!(ids(3, MAX_PAGE).is_empty() && ids(10, MAX_PAGE).is_empty());

    // counter exhausted: option_count == u32::MAX
    set_next(u32::MAX - 1);
    let last = t.offer_x(m, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY);
    assert_eq!(last, u32::MAX - 1);
    assert_eq!(t.c.option_count(), u32::MAX);
    check("counter exhausted", false);
    assert_eq!(ids(u32::MAX - 1, u32::MAX), [u32::MAX - 1]);
    assert!(ids(u32::MAX, u32::MAX).is_empty());
    assert!(ids(u32::MAX, 0).is_empty());
}
