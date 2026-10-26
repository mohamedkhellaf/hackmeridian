//! Negative-path (misuse) tests for the `options` contract v1.3.1 (ABI: `docs/contract-abi.md`).
//!
//! Every test drives a misuse path from the attacker's side and asserts BOTH that the contract
//! rejects it (typed `Error` by name, or a host/SAC error identified by its root cause) AND that
//! nothing observable changed (all balances of every tracked party, reserved totals, the open
//! list, every per-asset open book, `option_count`, every stored `OptionData`, every tracked
//! party's `writer_open_count` and the asset registry) and that no contract event was emitted.
//!
//! Contract errors are `options::Error`, codes 101–121 (120 `NoAsk`, 121 `PriceMoved` appended in v1.4) (renumbered in v1.1, 116–119 appended in
//! v1.3), and are matched by variant name, never by number. v1.2 adds `transfer(holder, to, id)`,
//! `get_options(from, limit)` and the `OptionTransferred` event: sections 16 and 17 cover them,
//! and sections 1, 2, 3, 12 and 15 include `transfer` in their existing checks.
//!
//! v1.3 (ABI §12) adds permissionless `list_asset` (+ `is_listed`, `list_assets`, `asset_count`,
//! event `AssetListed`), the per-writer open cap (`WriterOpenLimit`, `writer_open_count`), the
//! tenor cap (`TenorOutOfRange`), anyone-may-call `prune_expired` (event `OfferPruned`) and the
//! backstop that rejects the contract's own address as any party. Sections 18–23 cover them;
//! section 2 (`transfer` to the contract), section 8 (open-list griefing, finding F-1, which v1.3
//! fixes for a single writer) and section 17 (more than 50 offers from one writer) are adapted.
//!
//! v1.3.1 (ABI §13): `prune_expired(pruner, ids)` takes an authenticated caller (every prune here
//! is signed by exactly its pruner, and section 24 forges that signature); `transfer` gains the
//! `ContractNotAuthorized` and `CollateralShortfall` guards (section 16); the single global open
//! list (`MAX_OPEN = 1000`) is replaced by per-asset books capped at `MAX_OPEN_PER_ASSET = 500`
//! with `list_open_for(asset, from, limit)`, and `list_open()` returns the books concatenated in
//! registry order truncated to 200 ids; `extend_ttl` also extends the registry, writer and book
//! entries. The former F-1R finding (20 sybil writers on a self-listed unflagged asset fill the
//! global list) is now the passing regression `griefing8_f1r_*`; section 24 covers the rest,
//! including the cost of the `list_open()` window with a large registry. Section 8 also pins
//! the persistent `Reserved(token)` entries (§13.8: the instance entry never grows with listings,
//! and every path that touches a reserve keeps it alive) and section 18 the `list_asset` check
//! order (§13.4: `AlreadyListed` without probing the SAC).
//!
//! v1.4 (ABI §14) adds the on-chain secondary market: `list_for_sale(holder, id, ask_total)`,
//! `cancel_sale(holder, id)`, `buy_resale(buyer, id, max_total)`, views `get_ask`/`list_asks`,
//! events `AskListed`/`AskCancelled`/`ResaleBought` and errors `NoAsk` (120), `PriceMoved`
//! (121). Every snapshot also holds every open ask and checks that an ask exists only on an
//! `Active` option and names its current holder; section 25 covers the misuse paths.
//! Every snapshot also checks the open-book invariant: each asset's book is exactly its
//! `Offered` ids in id order, and `list_open()` is the registry-order concatenation, truncated.
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
//!   secure behaviour and FAIL against the current contract. Run them with `-- --ignored`.
//!   None remains open against v1.3.1.
//! - Classic assets with a chosen code and issuer (for `list_asset`) are deployed with the same
//!   host function the SDK uses for `register_stellar_asset_contract_v2` (whose assets are all
//!   coded `aaa` with a random issuer), and their canonical SAC address is computed with
//!   `env.deployer().with_stellar_asset(..).deployed_address()`, independently of the contract.
#![allow(clippy::too_many_arguments, clippy::type_complexity)]

use options::{Error, OptionData, OptionType, OptionsContract, OptionsContractClient, State};
use soroban_sdk::{
    contract, contractimpl,
    testutils::{
        cost_estimate::NetworkInvocationResourceLimits,
        storage::{Instance as _, Persistent as _},
        Address as _, Events as _, IssuerFlags, Ledger as _, MockAuth, MockAuthInvoke,
        MuxedAddress as _, StellarAssetIssuer,
    },
    token::{StellarAssetClient, TokenClient},
    vec,
    xdr::{self, WriteXdr as _},
    Address, Bytes, Env, IntoVal, InvokeError, MuxedAddress, String, Symbol, TryFromVal, Val, Vec,
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

/// ABI §8 (v1.3.1): `create_offer` fails with `OpenListFull` once the underlying's own open book
/// holds this many ids (v1.3 and before: one global list of 1000).
const MAX_OPEN_PER_ASSET: u32 = 500;
/// ABI §3 (v1.3.1): `list_open()` returns at most this many ids.
const LIST_OPEN_MAX: u32 = 200;
/// soroban-sdk 28 default (mainnet snapshot) limit on footprint ledger entries per invocation.
const FOOTPRINT_LIMIT: u32 = 400;
/// ABI §3 (v1.2): one `get_options` call returns at most this many options.
const MAX_PAGE: u32 = 50;
/// ABI §8 (v1.3): `create_offer` fails with `WriterOpenLimit` at this many `Offered` ids per writer.
const MAX_OPEN_PER_WRITER: u32 = 50;
/// ABI §8 (v1.3): `create_offer` fails with `TenorOutOfRange` if `expiry > now + MAX_TENOR`.
const MAX_TENOR: u64 = 63_072_000;
/// Number of underlyings the fixture's constructor seeds into the v1.3 registry (RWA, BOND).
const SEEDED: u32 = 2;

// soroban-sdk 28 `InvocationResourceLimits::mainnet()` (the limits the test env enforces by
// default; the type itself is not re-exported, so the values are restated here).
const WRITE_LIMIT: u32 = 200;
const DISK_READ_LIMIT: u32 = 200;
const WRITE_BYTES_LIMIT: u32 = 132_096;
const EVENTS_LIMIT: u32 = 16_384;
const INSTRUCTIONS_LIMIT: i64 = 400_000_000;
const MEM_LIMIT: i64 = 41_943_040;

// Classic account flags (stellar-xdr `AccountFlags`): the demo regulated issuer profile.
const REGULATED: u32 = 0x1 | 0x2 | 0x8; // AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED

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
    /// Classic issuer accounts behind the fixture SACs (all fixture assets are coded `aaa`).
    usdx_issuer: xdr::AccountId,
    rwa_issuer: xdr::AccountId,
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
    /// v1.3.1: every registry asset's complete open book (`list_open_for`, all pages), in
    /// registry order.
    open_for: std::vec::Vec<(Address, std::vec::Vec<u32>)>,
    options: std::vec::Vec<OptionData>,
    /// v1.3: `writer_open_count` of every tracked party, in `tracked()` order.
    writer_open: std::vec::Vec<u32>,
    /// v1.3: the asset registry in listing order (`list_assets`, all pages).
    assets: std::vec::Vec<Address>,
    /// v1.4: every open resale ask `(id, holder, ask_total)` (`list_asks`, all scan windows).
    asks: std::vec::Vec<(u32, Address, i128)>,
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
        usdx_issuer: issuer_of(&usdx_sac.asset()),
        rwa_issuer: issuer_of(&rwa_sac.asset()),
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
        let snap = Snap {
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
            open_for: self
                .assets()
                .into_iter()
                .map(|a| {
                    let book = self.open_book(&a);
                    (a, book)
                })
                .collect(),
            options: (0..count)
                .filter_map(|id| self.c.try_get_option(&id).ok().map(|r| r.unwrap()))
                .collect(),
            writer_open: self
                .tracked()
                .iter()
                .map(|a| self.c.writer_open_count(a))
                .collect(),
            assets: self.assets(),
            asks: self.asks(count),
        };
        snap.assert_open_books();
        snap.assert_asks();
        snap
    }

    /// v1.4: every open ask, scanning `list_asks` in windows of `MAX_PAGE` ids up to `count`.
    fn asks(&self, count: u32) -> std::vec::Vec<(u32, Address, i128)> {
        let mut out = std::vec::Vec::new();
        let mut from = 0u32;
        while from < count {
            for a in self.c.list_asks(&from, &u32::MAX).iter() {
                assert!(a.id >= from && a.id < from + MAX_PAGE, "list_asks window");
                assert_eq!(self.c.get_ask(&a.id), Some(a.ask_total), "get_ask");
                out.push((a.id, a.holder, a.ask_total));
            }
            from += MAX_PAGE;
        }
        out
    }

    /// v1.3.1: one asset's complete open book, paged through `list_open_for` with
    /// `from += returned.len()` (`from` is a position in the book; every page is asked with
    /// `limit = u32::MAX` and must hold at most `MAX_PAGE` ids).
    fn open_book(&self, asset: &Address) -> std::vec::Vec<u32> {
        let mut out = std::vec::Vec::new();
        loop {
            let page = self.c.list_open_for(asset, &(out.len() as u32), &u32::MAX);
            assert!(
                page.len() <= MAX_PAGE,
                "list_open_for page size {}",
                page.len()
            );
            if page.is_empty() {
                break;
            }
            let full = page.len() == MAX_PAGE;
            out.extend(page.iter());
            assert!(
                out.len() as u32 <= MAX_OPEN_PER_ASSET,
                "open book of {asset:?} exceeds MAX_OPEN_PER_ASSET"
            );
            if !full {
                break;
            }
        }
        out
    }

    /// v1.3 registry in listing order, read through the paged view (at most `MAX_PAGE` a call).
    fn assets(&self) -> std::vec::Vec<Address> {
        let count = self.c.asset_count();
        let mut out = std::vec::Vec::new();
        while (out.len() as u32) < count {
            let page = self.c.list_assets(&(out.len() as u32), &MAX_PAGE);
            assert!(
                !page.is_empty() && page.len() <= MAX_PAGE,
                "list_assets page size {}",
                page.len()
            );
            out.extend(page.iter());
        }
        assert_eq!(out.len() as u32, count, "list_assets overran asset_count");
        out
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
        let (a, _) = self.new_account(0xA5, 0);
        self.extra.borrow_mut().push(a.clone());
        a
    }

    /// Creates a classic account entry with the given account `flags` (e.g. `REGULATED` for an
    /// issuer) and returns it as an `Address` and as its XDR `AccountId`. Not tracked by `snap`.
    fn new_account(&self, fill: u8, flags: u32) -> (Address, xdr::AccountId) {
        let n = self.g_seq.get();
        self.g_seq.set(n + 1);
        let mut pk = [fill; 32];
        pk[..4].copy_from_slice(&n.to_be_bytes());
        let account_id = xdr::AccountId(xdr::PublicKey::PublicKeyTypeEd25519(xdr::Uint256(pk)));
        let key = Rc::new(xdr::LedgerKey::Account(xdr::LedgerKeyAccount {
            account_id: account_id.clone(),
        }));
        let entry = Rc::new(xdr::LedgerEntry {
            data: xdr::LedgerEntryData::Account(xdr::AccountEntry {
                account_id: account_id.clone(),
                balance: 1_000_000_000,
                flags,
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
        let a =
            Address::try_from_val(&self.env, &xdr::ScAddress::Account(account_id.clone())).unwrap();
        (a, account_id)
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

    /// TTL of the persistent entry `Key::<name>(arg)` (a `contracttype` enum key serializes as
    /// `[Symbol(name), arg]`; the names are the ABI §8 `Key` variants).
    fn entry_ttl(&self, name: &str, arg: Val) -> u32 {
        let key: Vec<Val> = vec![
            &self.env,
            Symbol::new(&self.env, name).into_val(&self.env),
            arg,
        ];
        self.env.as_contract(&self.contract, || {
            self.env.storage().persistent().get_ttl(&key)
        })
    }

    fn instance_ttl(&self) -> u32 {
        self.env
            .as_contract(&self.contract, || self.env.storage().instance().get_ttl())
    }

    /// Names of the `Key` variants stored in the contract's instance entry, sorted.
    fn instance_keys(&self) -> std::vec::Vec<std::string::String> {
        let all = self
            .env
            .as_contract(&self.contract, || self.env.storage().instance().all());
        let mut names: std::vec::Vec<std::string::String> = all
            .keys()
            .iter()
            .map(|k| match xdr::ScVal::try_from_val(&self.env, &k).unwrap() {
                xdr::ScVal::Vec(Some(v)) => match v.first() {
                    Some(xdr::ScVal::Symbol(s)) => s.0.to_utf8_string_lossy(),
                    other => panic!("unexpected instance key head {other:?}"),
                },
                other => panic!("unexpected instance key {other:?}"),
            })
            .collect();
        names.sort();
        names
    }

    /// The persistent `Key::Reserved(token)` entry (ABI §8, v1.3.1), `None` if absent.
    fn reserved_entry(&self, token: &Address) -> Option<i128> {
        let key: Vec<Val> = vec![
            &self.env,
            Symbol::new(&self.env, "Reserved").into_val(&self.env),
            token.into_val(&self.env),
        ];
        self.env
            .as_contract(&self.contract, || self.env.storage().persistent().get(&key))
    }

    /// (contract, function) of every contract call the last top-level invocation made, the
    /// invocation itself first (read from the host's `fn_call` diagnostic events).
    fn calls(&self) -> std::vec::Vec<(Address, std::string::String)> {
        let evs = self.env.host().get_diagnostic_events().unwrap();
        evs.0
            .iter()
            .filter_map(|he| {
                let xdr::ContractEventBody::V0(v0) = &he.event.body;
                match (v0.topics.first(), v0.topics.get(1), v0.topics.get(2)) {
                    (
                        Some(xdr::ScVal::Symbol(s)),
                        Some(xdr::ScVal::Bytes(id)),
                        Some(xdr::ScVal::Symbol(f)),
                    ) if s.0.to_utf8_string_lossy() == "fn_call" => {
                        let hash: [u8; 32] = id.0.as_slice().try_into().unwrap();
                        let a = xdr::ScAddress::Contract(xdr::ContractId(xdr::Hash(hash)));
                        Some((
                            Address::try_from_val(&self.env, &a).unwrap(),
                            f.0.to_utf8_string_lossy(),
                        ))
                    }
                    _ => None,
                }
            })
            .collect()
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

/// Issuer `AccountId` of a classic credit asset.
fn issuer_of(asset: &xdr::Asset) -> xdr::AccountId {
    match asset {
        xdr::Asset::CreditAlphanum4(a) => a.issuer.clone(),
        xdr::Asset::CreditAlphanum12(a) => a.issuer.clone(),
        xdr::Asset::Native => panic!("native asset has no issuer"),
    }
}

/// The classic asset `(code, issuer)` as Stellar defines it: 1–4 byte codes are AlphaNum4,
/// 5–12 byte codes AlphaNum12, both zero-padded.
fn classic_asset(code: &[u8], issuer: &xdr::AccountId) -> xdr::Asset {
    assert!(!code.is_empty() && code.len() <= 12);
    if code.len() <= 4 {
        let mut c = [0u8; 4];
        c[..code.len()].copy_from_slice(code);
        xdr::Asset::CreditAlphanum4(xdr::AlphaNum4 {
            asset_code: xdr::AssetCode4(c),
            issuer: issuer.clone(),
        })
    } else {
        let mut c = [0u8; 12];
        c[..code.len()].copy_from_slice(code);
        xdr::Asset::CreditAlphanum12(xdr::AlphaNum12 {
            asset_code: xdr::AssetCode12(c),
            issuer: issuer.clone(),
        })
    }
}

impl T {
    // ----- v1.3 helpers -------------------------------------------------------------------------

    /// Canonical SAC address of a classic asset, computed by the host (not by the contract).
    fn canonical_sac(&self, asset: &xdr::Asset) -> Address {
        let raw = asset.to_xdr(xdr::Limits::none()).unwrap();
        self.env
            .deployer()
            .with_stellar_asset(Bytes::from_slice(&self.env, &raw))
            .deployed_address()
    }

    /// Deploys the SAC of a classic asset (what `stellar contract asset deploy` does); returns
    /// its address, which is the canonical one.
    fn deploy_sac(&self, asset: &xdr::Asset) -> Address {
        let sc = self
            .env
            .host()
            .invoke_function(xdr::HostFunction::CreateContract(xdr::CreateContractArgs {
                contract_id_preimage: xdr::ContractIdPreimage::Asset(asset.clone()),
                executable: xdr::ContractExecutable::StellarAsset,
            }))
            .unwrap();
        let sac = Address::try_from_val(&self.env, &sc).unwrap();
        assert_eq!(sac, self.canonical_sac(asset));
        sac
    }

    /// A fresh classic issuer account with `flags`, as (address, account id).
    fn issuer(&self, flags: u32) -> (Address, xdr::AccountId) {
        self.new_account(0x1D, flags)
    }

    fn s(&self, code: &str) -> String {
        String::from_str(&self.env, code)
    }

    /// Funded contract-address writer authorized on RWA and BOND, like the fixture's actors.
    /// Tracked by `snap` iff `track`.
    fn fresh_writer(&self, track: bool) -> Address {
        let a = Address::generate(&self.env);
        self.sac(&self.usdx).mint(&a, &USDX_START);
        for u in [&self.rwa, &self.bond] {
            let s = self.sac(u);
            s.set_authorized(&a, &true);
            s.mint(&a, &UNDERLYING_START);
        }
        if track {
            self.extra.borrow_mut().push(a.clone());
        }
        a
    }

    /// `writer_open_count(w)` must equal the number of `w`'s options in state `Offered` (ABI §3).
    #[track_caller]
    fn assert_writer_count(&self, w: &Address) {
        let offered = (0..self.c.option_count())
            .filter(|id| {
                let o = self.c.get_option(id);
                o.writer == *w && o.state == State::Offered
            })
            .count() as u32;
        assert_eq!(
            self.c.writer_open_count(w),
            offered,
            "writer_open_count disagrees with the stored Offered options"
        );
    }

    /// Topic-0 names of every options-contract event of the last invocation.
    fn opt_event_names(&self) -> std::vec::Vec<std::string::String> {
        self.env
            .events()
            .all()
            .filter_by_contract(&self.contract)
            .events()
            .iter()
            .map(|e| {
                let xdr::ContractEventBody::V0(v0) = &e.body;
                match &v0.topics[0] {
                    xdr::ScVal::Symbol(s) => s.0.to_utf8_string_lossy(),
                    o => panic!("unexpected topic {o:?}"),
                }
            })
            .collect()
    }

    /// Ids of the `offer_pruned` events of the last invocation, in emission order.
    fn pruned_ids(&self) -> std::vec::Vec<u32> {
        self.opt_events()
            .into_iter()
            .filter(|(n, _, _)| n == "offer_pruned")
            .map(|(_, id, topics)| {
                assert_eq!(topics, 2, "offer_pruned topics: name, id");
                id
            })
            .collect()
    }

    /// (id topic, `pruner` data field) of the `offer_pruned` events of the last invocation, in
    /// emission order (v1.3.1: the pruner is the authenticated caller).
    fn pruned_by(&self) -> std::vec::Vec<(u32, Address)> {
        self.env
            .events()
            .all()
            .filter_by_contract(&self.contract)
            .events()
            .iter()
            .filter_map(|e| {
                let xdr::ContractEventBody::V0(v0) = &e.body;
                let (xdr::ScVal::Symbol(name), Some(xdr::ScVal::U32(id))) =
                    (&v0.topics[0], v0.topics.get(1))
                else {
                    return None;
                };
                if name.0.to_utf8_string_lossy() != "offer_pruned" {
                    return None;
                }
                let pruner = match &v0.data {
                    xdr::ScVal::Map(Some(m)) => m
                        .0
                        .iter()
                        .find(|kv| {
                            matches!(&kv.key, xdr::ScVal::Symbol(k) if k.0.to_utf8_string_lossy() == "pruner")
                        })
                        .map(|kv| kv.val.clone())
                        .expect("offer_pruned data has a `pruner` field"),
                    xdr::ScVal::Vec(Some(v)) => v.0[0].clone(),
                    other => other.clone(),
                };
                let xdr::ScVal::Address(a) = pruner else {
                    panic!("offer_pruned pruner is not an address: {pruner:?}");
                };
                Some((*id, Address::try_from_val(&self.env, &a).unwrap()))
            })
            .collect()
    }

    /// v1.3.1 `prune_expired(pruner, ids)` signed by exactly `pruner`: one root invocation with no
    /// sub-invocation (the collateral leaves the contract under the contract's own authority), so
    /// every prune in this suite also proves that the pruner's signature is all it takes and that
    /// the pruner authorizes no token movement. `pruner` must be a contract-address actor
    /// (`Address::generate`), which is what `mock_auths` can sign for. Restores `mock_all_auths`.
    fn try_prune(
        &self,
        pruner: &Address,
        ids: &Vec<u32>,
    ) -> Result<u32, Result<Error, InvokeError>> {
        let root = MockAuthInvoke {
            contract: &self.contract,
            fn_name: "prune_expired",
            args: (pruner, ids.clone()).into_val(&self.env),
            sub_invokes: &[],
        };
        self.env.mock_auths(&[MockAuth {
            address: pruner,
            invoke: &root,
        }]);
        let r = self.c.try_prune_expired(pruner, ids);
        self.env.mock_all_auths();
        match r {
            Ok(Ok(n)) => Ok(n),
            Ok(Err(e)) => panic!("prune_expired returned an unconvertible value: {e:?}"),
            Err(e) => Err(e),
        }
    }

    /// `try_prune` that must succeed; returns the number of options pruned and checks that every
    /// `offer_pruned` event names `pruner`.
    #[track_caller]
    fn prune(&self, pruner: &Address, ids: &Vec<u32>) -> u32 {
        let n = match self.try_prune(pruner, ids) {
            Ok(n) => n,
            Err(e) => panic!("prune_expired({ids:?}) by {pruner:?}: {e:?}"),
        };
        let by = self.pruned_by();
        assert_eq!(by.len() as u32, n, "one offer_pruned event per pruned id");
        assert!(
            by.iter().all(|(_, p)| p == pruner),
            "offer_pruned must name the authenticated pruner: {by:?}"
        );
        n
    }

    /// (sac topic, number of topics) of the `asset_listed` events of the last invocation.
    fn listed_events(&self) -> std::vec::Vec<(Address, usize)> {
        self.env
            .events()
            .all()
            .filter_by_contract(&self.contract)
            .events()
            .iter()
            .filter_map(|e| {
                let xdr::ContractEventBody::V0(v0) = &e.body;
                match (&v0.topics[0], v0.topics.get(1)) {
                    (xdr::ScVal::Symbol(s), Some(xdr::ScVal::Address(a)))
                        if s.0.to_utf8_string_lossy() == "asset_listed" =>
                    {
                        Some((
                            Address::try_from_val(&self.env, a).unwrap(),
                            v0.topics.len(),
                        ))
                    }
                    _ => None,
                }
            })
            .collect()
    }

    /// Names of the `InvocationResourceLimits::mainnet()` limits the last invocation exceeded
    /// (empty = it fits a transaction).
    fn exceeded(&self) -> std::vec::Vec<&'static str> {
        let r = self.env.cost_estimate().resources();
        let mut out = std::vec::Vec::new();
        let entries = r.disk_read_entries + r.memory_read_entries + r.write_entries;
        if entries > FOOTPRINT_LIMIT {
            out.push("footprint entries");
        }
        if r.disk_read_entries > DISK_READ_LIMIT {
            out.push("disk read entries");
        }
        if r.write_entries > WRITE_LIMIT {
            out.push("write entries");
        }
        if r.write_bytes > WRITE_BYTES_LIMIT {
            out.push("write bytes");
        }
        if r.contract_events_size_bytes > EVENTS_LIMIT {
            out.push("contract events bytes");
        }
        if r.instructions > INSTRUCTIONS_LIMIT {
            out.push("instructions");
        }
        if r.mem_bytes > MEM_LIMIT {
            out.push("memory bytes");
        }
        out
    }

    /// `exceeded` restricted to the exact ledger limits (footprint, disk reads, write entries,
    /// write bytes, event bytes), which do not depend on how big the test env's ledger is.
    fn exceeded_ledger(&self) -> std::vec::Vec<&'static str> {
        self.exceeded()
            .into_iter()
            .filter(|n| !matches!(*n, "instructions" | "memory bytes"))
            .collect()
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

/// `rejected` with a label for loops.
#[track_caller]
fn rejected_as<R: Debug>(
    t: &T,
    label: &str,
    res: Result<R, Result<Error, InvokeError>>,
    e: Error,
    before: &Snap,
) {
    let quiet = t.no_events();
    match res {
        Err(Ok(got)) => assert_eq!(got, e, "{label}"),
        other => panic!("{label}: expected Err(Ok({e:?})), got {other:?}"),
    }
    assert!(quiet, "{label}: a failed call ({e:?}) must not emit events");
    assert_eq!(&t.snap(), before, "{label}: state changed after {e:?}");
}

impl Snap {
    /// v1.4 ask invariant, checked on every snapshot: an ask exists only on an `Active` option,
    /// names its current holder and is positive.
    #[track_caller]
    fn assert_asks(&self) {
        for (id, holder, ask) in &self.asks {
            let o = self
                .options
                .iter()
                .find(|o| o.id == *id)
                .expect("ask on a stored option");
            assert_eq!(o.state, State::Active, "ask on non-Active option {id}");
            assert_eq!(o.holder.as_ref(), Some(holder), "ask holder of {id}");
            assert!(*ask > 0, "ask_total of {id}");
        }
    }

    /// Expected-state helper: `who`'s balance of token index `tok` ([USDx, RWA, BOND]) += delta.
    fn add(&mut self, who: &Address, tok: usize, delta: i128) {
        let row = self
            .balances
            .iter_mut()
            .find(|(a, _)| a == who)
            .expect("tracked party");
        *row.1[tok].as_mut().expect("trustline") += delta;
    }

    /// Expected-state helper: `who`'s `writer_open_count` += delta.
    fn add_open(&mut self, who: &Address, delta: i64) {
        let i = self
            .balances
            .iter()
            .position(|(a, _)| a == who)
            .expect("tracked party");
        self.writer_open[i] = (self.writer_open[i] as i64 + delta) as u32;
    }

    fn set_state(&mut self, id: u32, state: State) {
        self.options.iter_mut().find(|o| o.id == id).unwrap().state = state;
        if state != State::Offered {
            for (_, book) in self.open_for.iter_mut() {
                book.retain(|&i| i != id);
            }
            self.open = list_open_of(&self.open_for, MAX_PAGE as usize);
        }
    }

    /// Open-book invariant (ABI §3/§8, v1.3.1), checked on every snapshot: each registry asset's
    /// book is exactly its `Offered` ids in id order (oldest first), no option is open on an
    /// unlisted asset, and `list_open()` is the books concatenated in registry order, truncated
    /// to `LIST_OPEN_MAX`.
    #[track_caller]
    fn assert_open_books(&self) {
        let mut seen = 0usize;
        for (asset, book) in &self.open_for {
            let offered: std::vec::Vec<u32> = self
                .options
                .iter()
                .filter(|o| o.state == State::Offered && o.underlying == *asset)
                .map(|o| o.id)
                .collect();
            assert_eq!(book, &offered, "open book of {asset:?}");
            seen += offered.len();
        }
        let all_offered = self
            .options
            .iter()
            .filter(|o| o.state == State::Offered)
            .count();
        assert_eq!(
            seen, all_offered,
            "an Offered option is missing from every book"
        );
        assert!(
            self.open == list_open_of(&self.open_for, MAX_PAGE as usize),
            "list_open() {:?} is not the registry-order concatenation of the books",
            self.open
        );
    }
}

/// `list_open()` per ABI §3/§13.3 (v1.3.1): the per-asset books of the first `max_assets` registry
/// assets concatenated in registry order, truncated to `LIST_OPEN_MAX`. The ABI window is
/// `max_assets = MAX_PAGE` (50), which keeps the view bounded however many assets are listed
/// (`books24_list_open_stays_within_limits_*`).
fn list_open_of(books: &[(Address, std::vec::Vec<u32>)], max_assets: usize) -> std::vec::Vec<u32> {
    books
        .iter()
        .take(max_assets)
        .flat_map(|(_, b)| b.iter().copied())
        .take(LIST_OPEN_MAX as usize)
        .collect()
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
fn addr2_option_cannot_be_handed_to_the_contract() {
    // v1.2 accepted `transfer(holder, contract, id)` (the contract is issuer-authorized on every
    // underlying, so it passed the recipient eligibility check) and the option became inert.
    // v1.3 backstop (ABI §3, §12.3): the contract's own address is rejected as `to` with
    // InvalidArgs, before any state change, even with every signature mocked; the holder keeps
    // the option and can still exercise it.
    let t = setup();
    let me = &t.contract;
    let put = t.put(&t.writer);
    let call = t.call(&t.writer);
    t.c.buy(&t.holder, &put);
    t.c.buy(&t.holder, &call);
    assert!(t.c.is_eligible(&t.rwa, me));
    let before = t.snap();
    for id in [put, call] {
        rejected(
            &t,
            t.c.try_transfer(&t.holder, me, &id),
            Error::InvalidArgs,
            &before,
        );
    }
    assert_eq!(t.c.get_option(&put).holder, Some(t.holder.clone()));
    // positive control: the holder still owns and settles both options
    t.c.exercise(&t.holder, &put);
    t.c.exercise(&t.holder, &call);
    t.c.claim_delivery(&t.writer, &put);
    t.c.claim_delivery(&t.writer, &call);
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
        // v1.3.1: list_open() is the per-asset books in registry order (RWA, then BOND)
        let mut offered = std::vec::Vec::new();
        for u in [rwa, bond] {
            offered.extend((0..t.c.option_count()).filter(|id| {
                let o = t.c.get_option(id);
                o.state == State::Offered && o.underlying == *u
            }));
        }
        let open: std::vec::Vec<u32> = t.c.list_open().iter().collect();
        assert_eq!(open, offered, "step {step} ({label}) list_open");
        t.snap(); // asserts the per-asset open-book invariant
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
    let env = &t.env;
    let a = t.put(&t.writer);
    let b = t.call(&t.maker2);
    let seq = t.env.ledger().sequence();
    t.env.ledger().set_sequence_number(seq + 24 * DAY);
    // v1.3.1 keeper coverage (ABI §13.5, §13.8): besides the options and the instance,
    // `extend_ttl` extends each id's Listed / WriterOpen / OpenFor / Reserved(quote) /
    // Reserved(underlying) entries and the first MAX_PAGE registry slots (AssetAt and their
    // Listed entries: here RWA and BOND, although no id is on BOND).
    let ttls = |t: &T| {
        std::vec![
            t.option_ttl(a),
            t.option_ttl(b),
            t.instance_ttl(),
            t.entry_ttl("Listed", t.rwa.into_val(env)),
            t.entry_ttl("Listed", t.bond.into_val(env)),
            t.entry_ttl("AssetAt", 0u32.into_val(env)),
            t.entry_ttl("AssetAt", 1u32.into_val(env)),
            t.entry_ttl("WriterOpen", t.writer.into_val(env)),
            t.entry_ttl("WriterOpen", t.maker2.into_val(env)),
            t.entry_ttl("OpenFor", t.rwa.into_val(env)),
            t.entry_ttl("Reserved", t.usdx.into_val(env)),
            t.entry_ttl("Reserved", t.rwa.into_val(env)),
        ]
    };
    let aged = ttls(&t);
    assert!(aged.iter().all(|&ttl| ttl < 7 * DAY), "{aged:?}");

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
    assert!(fresh.iter().all(|&ttl| ttl == 30 * DAY), "{fresh:?}");
}

#[test]
fn griefing8_extend_ttl_batch_size_fits_footprint_limit() {
    let t = setup();
    let env = &t.env;
    let n = FOOTPRINT_LIMIT; // 400 options on RWA from 8 writers (at most 50 open offers each)
    let writers: std::vec::Vec<Address> = (0..n / MAX_OPEN_PER_WRITER)
        .map(|_| t.fresh_writer(false))
        .collect();
    for i in 0..n {
        let w = &writers[(i / MAX_OPEN_PER_WRITER) as usize];
        t.offer_x(w, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY);
    }
    let fp = |t: &T| {
        let r = t.env.cost_estimate().resources();
        r.memory_read_entries + r.disk_read_entries + r.write_entries
    };
    // Largest batch, searched with enforcement disabled (the test env panics instead of
    // returning an error when a limit is exceeded); extend_ttl only moves TTLs, so probes repeat.
    env.cost_estimate().disable_resource_limits();
    let fits = |k: u32| -> bool {
        t.c.extend_ttl(&Vec::from_iter(env, 0..k));
        t.exceeded_ledger().is_empty()
    };
    let (mut lo, mut hi) = (1u32, n);
    assert!(fits(lo) && !fits(hi), "400 ids must exceed the footprint");
    while hi - lo > 1 {
        let mid = (lo + hi) / 2;
        if fits(mid) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    let fit = lo;
    fits(fit + 1);
    assert_eq!(t.exceeded_ledger(), ["footprint entries"]);
    assert_eq!(fp(&t), FOOTPRINT_LIMIT + 1);
    // ABI §13.5, §13.8: one more id on an asset and writer already in the batch costs exactly one
    // entry (its Opt); the rest is per call: instance + code, the SEEDED registry slots (AssetAt
    // and Listed each), one WriterOpen per writer, and three entries for the asset and the quote
    // token: OpenFor(RWA), Reserved(USDx) and Reserved(RWA) (in the footprint even while absent:
    // these PUTs lock no RWA).
    t.c.extend_ttl(&Vec::from_iter(env, 0..10));
    let fp10 = fp(&t);
    t.c.extend_ttl(&Vec::from_iter(env, 0..11));
    assert_eq!(
        fp(&t) - fp10,
        1,
        "marginal footprint of an id on a shared asset and writer"
    );
    let overhead = FOOTPRINT_LIMIT - fit;
    assert_eq!(
        overhead,
        2 + 2 * SEEDED + writers.len() as u32 + 3,
        "per-call extend_ttl footprint on a single asset"
    );
    // the mainnet limits, enforced again, accept exactly that batch
    env.cost_estimate()
        .enforce_resource_limits(NetworkInvocationResourceLimits::mainnet());
    t.c.extend_ttl(&Vec::from_iter(env, 0..fit));
    let r = env.cost_estimate().resources();
    std::println!(
        "griefing8: max extend_ttl batch, one asset, 8 writers = {fit} ids (per-call entries {overhead}): {r:?}"
    );
}

#[test]
fn griefing8_extend_ttl_spanning_many_assets_and_writers_fits_footprint_limit() {
    // Worst case for a keeper (ABI §13.5, §13.8): every id on its own listed asset beyond the
    // first MAX_PAGE registry slots and written by its own writer, so each id adds five entries
    // (Opt, Listed(asset), OpenFor(asset), WriterOpen(writer), Reserved(asset)) on top of the
    // per-call part (instance, code, AssetAt(0..MAX_PAGE) and their Listed entries, plus the
    // shared Reserved(USDx)), which must stay bounded however many assets are listed.
    let t = setup();
    let env = &t.env;
    env.cost_estimate().budget().reset_unlimited();
    let fp = |t: &T| {
        let r = t.env.cost_estimate().resources();
        r.memory_read_entries + r.disk_read_entries + r.write_entries
    };
    let lister = Address::generate(env);
    let list_junk = |code: &str| -> Address {
        let (iss, iss_id) = t.issuer(0); // unflagged: no issuer action needed for anyone
        let sac = t.deploy_sac(&classic_asset(code.as_bytes(), &iss_id));
        assert_eq!(t.c.list_asset(&lister, &t.s(code), &iss), sac);
        sac
    };
    t.c.extend_ttl(&vec![env]);
    assert_eq!(
        fp(&t),
        2 + 2 * SEEDED,
        "per-call part with the seeded registry"
    );
    for i in 0..MAX_PAGE - SEEDED {
        list_junk(&std::format!("F{i}"));
    }
    t.c.extend_ttl(&vec![env]);
    let per_call = fp(&t);
    assert_eq!(
        per_call,
        2 + 2 * MAX_PAGE,
        "per-call part with a full first page"
    );
    let k_assets = 90u32;
    let mut ids = std::vec::Vec::new();
    for i in 0..k_assets {
        let asset = list_junk(&std::format!("W{i}"));
        let w = Address::generate(env);
        t.sac(&asset).mint(&w, &1);
        ids.push(t.c.create_offer(&w, &asset, &OptionType::Call, &1, &1, &1, &EXPIRY));
    }
    assert_eq!(t.c.asset_count(), MAX_PAGE + k_assets);
    t.c.extend_ttl(&vec![env]);
    assert_eq!(
        fp(&t),
        per_call,
        "the registry part grew past MAX_PAGE slots with the registry"
    );

    env.cost_estimate().disable_resource_limits();
    let batch = |k: usize| Vec::from_iter(env, ids[..k].iter().copied());
    let fits = |k: usize| -> bool {
        t.c.extend_ttl(&batch(k));
        t.exceeded_ledger().is_empty()
    };
    let (mut lo, mut hi) = (1usize, ids.len());
    assert!(
        fits(lo) && !fits(hi),
        "{} spread ids must exceed the footprint",
        ids.len()
    );
    while hi - lo > 1 {
        let mid = (lo + hi) / 2;
        if fits(mid) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    let max_spread = lo as u32;
    fits(lo + 1);
    assert_eq!(t.exceeded_ledger(), ["footprint entries"]);
    // the cost is linear in the ids: ABI §13.5 and §13.8 need Opt, Listed(asset), OpenFor(asset),
    // WriterOpen(writer) and Reserved(asset) for each such id (5), and once per call the quote's
    // Reserved(USDx) (in the footprint even while absent: these CALLs lock no USDx); the measured
    // line predicts the maximum exactly
    t.c.extend_ttl(&batch(1));
    let fp1 = fp(&t);
    t.c.extend_ttl(&batch(2));
    let per_id = fp(&t) - fp1;
    t.c.extend_ttl(&batch(3));
    assert_eq!(
        fp(&t) - fp1,
        2 * per_id,
        "extend_ttl footprint is not linear"
    );
    assert_eq!(per_id, 5, "footprint per id on its own asset and writer");
    assert_eq!(
        fp1 - per_id,
        per_call + 1,
        "per-call footprint: the registry part plus Reserved(USDx)"
    );
    assert_eq!(
        max_spread,
        (FOOTPRINT_LIMIT - (fp1 - per_id)) / per_id,
        "the linear footprint model does not predict the largest batch"
    );
    assert!(
        max_spread >= MAX_PAGE,
        "a keeper must be able to extend one full get_options page per call, got {max_spread}"
    );
    env.cost_estimate()
        .enforce_resource_limits(NetworkInvocationResourceLimits::mainnet());
    t.c.extend_ttl(&batch(lo));
    let r = env.cost_estimate().resources();
    std::println!(
        "griefing8: max extend_ttl batch, every id on its own asset (registry {}) and writer = {max_spread} ids ({per_id} entries per id): {r:?}",
        MAX_PAGE + k_assets
    );

    // ids whose book or writer count has since been emptied (sold, cancelled) still extend
    t.c.buy(&t.holder, &ids[0]);
    let w1 = t.c.get_option(&ids[1]).writer;
    t.c.cancel_offer(&w1, &ids[1]);
    assert!(t.open_book(&t.c.get_option(&ids[0]).underlying).is_empty());
    assert_eq!(t.c.writer_open_count(&w1), 0);
    t.c.extend_ttl(&vec![env, ids[0], ids[1], ids[2]]);
    assert!(t.opt_events().is_empty());
}

/// v1.3.1 (ABI §8, §13.8): permissionless listing lets anyone create per-token state, so none of
/// it may live in the single instance entry that every call loads (v1.3 kept `Reserved(token)`
/// there, so listing assets and locking one unit on each grew it without bound). However many
/// assets are listed and carry collateral, and whatever lifecycle paths run, instance storage
/// holds exactly `Quote`, `Underlyings`, `Next` and `AssetCount`, and each token's reserved total
/// is its own persistent `Reserved(token)` entry, equal to `open_collateral(token)`.
#[test]
fn griefing8_listing_and_collateral_spam_never_grows_the_instance_entry() {
    let t = setup();
    let env = &t.env;
    env.cost_estimate().budget().reset_unlimited();
    let only = ["AssetCount", "Next", "Quote", "Underlyings"];
    assert_eq!(t.instance_keys(), only, "after the constructor");
    assert_eq!(t.reserved_entry(&t.usdx), None);

    // every lifecycle path on the fixture tokens
    let (w, m, h, h2) = (&t.writer, &t.maker2, &t.holder, &t.holder2);
    let p = t.put(w);
    t.c.buy(h, &p);
    t.c.exercise(h, &p);
    t.c.claim_delivery(w, &p);
    let c = t.call(m);
    t.c.buy(h, &c);
    t.c.transfer(h, h2, &c);
    let x = t.offer(w, &t.bond, OptionType::Call);
    t.c.cancel_offer(w, &x);
    let y = t.offer_x(
        w,
        &t.bond,
        OptionType::Put,
        QTY,
        STRIKE,
        PREMIUM,
        START + 10,
    );
    let z = t.offer_x(m, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM, START + 10);
    t.at(START + 10);
    t.c.reclaim(w, &y);
    assert_eq!(t.prune(&Address::generate(env), &vec![env, z]), 1);
    t.at(START);
    assert_eq!(t.instance_keys(), only, "after every lifecycle path");

    // a spammer lists MAX_PAGE + 10 unflagged assets and locks collateral on each
    let lister = Address::generate(env);
    let n = MAX_PAGE + 10;
    let mut junk = std::vec::Vec::new();
    for i in 0..n {
        let (iss, iss_id) = t.issuer(0);
        let code = std::format!("S{i}");
        let sac = t.deploy_sac(&classic_asset(code.as_bytes(), &iss_id));
        assert_eq!(t.c.list_asset(&lister, &t.s(&code), &iss), sac);
        let sybil = Address::generate(env);
        let amt = i as i128 + 1;
        t.sac(&sac).mint(&sybil, &amt);
        t.c.create_offer(&sybil, &sac, &OptionType::Call, &amt, &1, &1, &EXPIRY);
        junk.push(sac);
    }
    assert_eq!(t.c.asset_count(), SEEDED + n);
    assert_eq!(
        t.instance_keys(),
        only,
        "after {n} listings with collateral"
    );

    // each token's reserve is its own persistent entry, the one `open_collateral` reports
    for (i, sac) in junk.iter().enumerate() {
        assert_eq!(
            t.reserved_entry(sac),
            Some(i as i128 + 1),
            "Reserved(junk {i})"
        );
        assert_eq!(t.c.open_collateral(sac), i as i128 + 1);
    }
    for (label, tok) in [("USDx", &t.usdx), ("RWA", &t.rwa), ("BOND", &t.bond)] {
        let held = t.c.open_collateral(tok);
        assert_eq!(t.reserved_entry(tok), Some(held), "Reserved({label})");
    }
    assert_eq!(
        t.c.open_collateral(&t.usdx),
        0,
        "every PUT exercised and claimed, reclaimed or pruned"
    );
    assert_eq!(t.c.open_collateral(&t.rwa), QTY, "the transferred CALL");
    assert_eq!(t.c.open_collateral(&t.bond), 0);
}

/// v1.3.1 (ABI §8, §13.8): a persistent `Reserved(token)` entry must not archive under live
/// positions (every later path on that token would then fail until someone restores it), so each
/// state-changing path extends the TTL of the reserves it touches: the legs it moves and, for
/// `create_offer`, `buy` and `transfer`, both of the option's tokens, which the
/// `CollateralShortfall` guard reads. Each case starts from aged entries (6 days left).
#[test]
fn griefing8_reserved_entries_are_kept_alive_by_every_path_that_touches_them() {
    type Step = fn(&T, u32, u32);
    let none: Step = |_, _, _| {};
    let cases: [(&str, Step, Step, [bool; 2]); 11] = [
        (
            "create_offer PUT",
            none,
            |t, _, _| {
                t.put(&t.writer);
            },
            [true, true],
        ),
        (
            "create_offer CALL",
            none,
            |t, _, _| {
                t.call(&t.writer);
            },
            [true, true],
        ),
        (
            "buy PUT",
            none,
            |t, p, _| t.c.buy(&t.holder, &p),
            [true, true],
        ),
        (
            "buy CALL",
            none,
            |t, _, c| t.c.buy(&t.holder, &c),
            [true, true],
        ),
        (
            "transfer",
            |t, _, c| t.c.buy(&t.holder, &c),
            |t, _, c| t.c.transfer(&t.holder, &t.holder2, &c),
            [true, true],
        ),
        (
            "exercise PUT",
            |t, p, _| t.c.buy(&t.holder, &p),
            |t, p, _| t.c.exercise(&t.holder, &p),
            [true, true],
        ),
        (
            "exercise CALL",
            |t, _, c| t.c.buy(&t.holder, &c),
            |t, _, c| t.c.exercise(&t.holder, &c),
            [true, true],
        ),
        (
            "claim_delivery PUT",
            |t, p, _| {
                t.c.buy(&t.holder, &p);
                t.c.exercise(&t.holder, &p);
            },
            |t, p, _| t.c.claim_delivery(&t.writer, &p),
            [false, true],
        ),
        (
            "cancel_offer CALL",
            none,
            |t, _, c| t.c.cancel_offer(&t.maker2, &c),
            [false, true],
        ),
        (
            "reclaim PUT",
            |t, p, _| t.c.buy(&t.holder, &p),
            |t, p, _| {
                t.at(EXPIRY);
                t.c.reclaim(&t.writer, &p);
            },
            [true, false],
        ),
        (
            "prune_expired PUT",
            none,
            |t, p, _| {
                t.at(EXPIRY);
                assert_eq!(t.prune(&Address::generate(&t.env), &vec![&t.env, p]), 1);
            },
            [true, false],
        ),
    ];
    for (label, pre, act, touched) in cases {
        let t = setup();
        let p = t.put(&t.writer); // Reserved(USDx)
        let c = t.call(&t.maker2); // Reserved(RWA)
        pre(&t, p, c);
        let ttls = |t: &T| {
            [
                t.entry_ttl("Reserved", t.usdx.into_val(&t.env)),
                t.entry_ttl("Reserved", t.rwa.into_val(&t.env)),
            ]
        };
        let seq = t.env.ledger().sequence();
        t.env.ledger().set_sequence_number(seq + 24 * DAY);
        let aged = ttls(&t);
        assert!(aged.iter().all(|&ttl| ttl < 7 * DAY), "{label}: {aged:?}");
        act(&t, p, c);
        let after = ttls(&t);
        for (i, tok) in ["Reserved(USDx)", "Reserved(RWA)"].iter().enumerate() {
            if touched[i] {
                assert_eq!(after[i], 30 * DAY, "{label}: {tok} not extended");
            }
        }
    }
}

#[test]
fn griefing8_open_book_cap_is_per_asset_and_full_book_operations_fit_limits() {
    let t = setup();
    let env = &t.env;
    // v1.3.1: filling RWA's book takes MAX_OPEN_PER_ASSET / MAX_OPEN_PER_WRITER = 10
    // issuer-authorized writers, and fills RWA's book only
    let writers: std::vec::Vec<Address> = (0..MAX_OPEN_PER_ASSET / MAX_OPEN_PER_WRITER)
        .map(|i| t.fresh_writer(i == 0))
        .collect();
    for i in 0..MAX_OPEN_PER_ASSET {
        let w = &writers[(i / MAX_OPEN_PER_WRITER) as usize];
        assert_eq!(t.offer_x(w, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY), i);
    }
    for w in &writers {
        assert_eq!(t.c.writer_open_count(w), MAX_OPEN_PER_WRITER);
    }
    let before = t.snap();
    assert_eq!(before.open_for[0].1.len() as u32, MAX_OPEN_PER_ASSET);
    assert_eq!(before.open.len() as u32, LIST_OPEN_MAX);
    for ty in [OptionType::Put, OptionType::Call] {
        rejected(
            &t,
            t.c.try_create_offer(&t.maker2, &t.rwa, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
            Error::OpenListFull,
            &before,
        );
        // a writer at its own cap on a full book: OpenListFull is checked first (ABI §3)
        rejected(
            &t,
            t.c.try_create_offer(&writers[0], &t.rwa, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY),
            Error::OpenListFull,
            &before,
        );
    }
    // ... while BOND's book is independent: the same writer at its cap is WriterOpenLimit there,
    // and a writer under its cap lists
    rejected(
        &t,
        t.c.try_create_offer(
            &writers[0],
            &t.bond,
            &OptionType::Call,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY,
        ),
        Error::WriterOpenLimit,
        &before,
    );
    let bond_id = t.offer(&t.maker2, &t.bond, OptionType::Call);
    assert_eq!(t.open_book(&t.bond), [bond_id]);

    // operations on a full book stay within the enforced mainnet limits (no panic):
    // buy the newest (the book scan covers all 500 ids), cancel the oldest, extend over 300 ids
    t.c.buy(&t.holder, &(MAX_OPEN_PER_ASSET - 1));
    let r = env.cost_estimate().resources();
    std::println!("griefing8: buy on a full per-asset book: {r:?}");
    t.c.cancel_offer(&writers[0], &0);
    t.c.extend_ttl(&Vec::from_iter(env, 1..301));
    assert_eq!(t.open_book(&t.rwa).len() as u32, MAX_OPEN_PER_ASSET - 2);
    assert_eq!(t.c.list_open().len(), LIST_OPEN_MAX);
    assert_eq!(t.c.writer_open_count(&writers[0]), MAX_OPEN_PER_WRITER - 1);
    assert_eq!(t.c.writer_open_count(&writers[9]), MAX_OPEN_PER_WRITER - 1);
    t.offer(&t.maker2, &t.rwa, OptionType::Put);
    t.offer(&t.maker2, &t.rwa, OptionType::Call);
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
    // BOND keeps accepting
    t.offer(&t.maker2, &t.bond, OptionType::Put);
}

/// FINDING F-1 (availability), fixed in v1.3 for a single writer. Before v1.3 one eligible writer
/// could occupy every slot of the global open list (v1.1–v1.3 `MAX_OPEN = 1000`) with dust offers
/// (qty = strike = premium = 1 unit,
/// expiry = u64::MAX) for 0.0001 USDx, and the slots never aged out. v1.3 caps each writer at
/// `MAX_OPEN_PER_WRITER` open offers (on every asset together), rejects expiries beyond
/// `MAX_TENOR`, and lets anyone `prune_expired` unsold expired offers (collateral back to the
/// writer). This test is the former `finding_f1_dust_offers_must_not_block_other_writers`,
/// converted into a passing test; `griefing8_f1r_*` below covers the multi-writer variant (F-1R),
/// fixed in v1.3.1 by per-asset books.
#[test]
fn griefing8_f1_writer_cap_blocks_the_squatter_at_50_and_others_still_list() {
    let t = setup();
    let env = &t.env;
    let squatter = &t.holder2; // any issuer-authorized account
    let usdx_before = t.bal(&t.usdx, squatter);
    let far = START + MAX_TENOR; // the longest tenor v1.3 accepts
                                 // 50 dust offers in the SAME ledger (no clock or sequence change), alternating assets
    for i in 0..MAX_OPEN_PER_WRITER {
        let u = if i % 2 == 0 { &t.rwa } else { &t.bond };
        assert_eq!(t.offer_x(squatter, u, OptionType::Put, 1, 1, 1, far), i);
    }
    assert_eq!(
        usdx_before - t.bal(&t.usdx, squatter),
        MAX_OPEN_PER_WRITER as i128
    );
    assert_eq!(t.c.writer_open_count(squatter), MAX_OPEN_PER_WRITER);
    t.assert_writer_count(squatter);

    // the 51st offer fails on either asset, either type, any tenor
    let before = t.snap();
    for (u, ty, exp) in [
        (&t.rwa, OptionType::Put, far),
        (&t.bond, OptionType::Call, far),
        (&t.rwa, OptionType::Call, START + 1),
        (&t.bond, OptionType::Put, EXPIRY),
    ] {
        rejected(
            &t,
            t.c.try_create_offer(squatter, u, &ty, &1, &1, &1, &exp),
            Error::WriterOpenLimit,
            &before,
        );
    }
    // u64::MAX no longer squats: the tenor check comes first
    let r =
        t.c.try_create_offer(squatter, &t.rwa, &OptionType::Put, &1, &1, &1, &u64::MAX);
    assert!(t.no_events());
    match r {
        Err(Ok(Error::TenorOutOfRange)) | Err(Ok(Error::InvalidArgs)) => {}
        other => panic!("expiry u64::MAX: {other:?}"),
    }
    assert_eq!(t.snap(), before);

    // an honest maker can still list an offer
    assert_eq!(
        t.c.try_create_offer(
            &t.maker2,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &EXPIRY
        ),
        Ok(Ok(MAX_OPEN_PER_WRITER)),
        "an honest maker is locked out by dust offers"
    );

    // after the dust expires a stranger (signing only its own prune_expired call) prunes it; the
    // collateral goes back to the squatter, never to the pruner, and the squatter's slots are
    // free again
    t.at(far);
    let stranger = Address::generate(env);
    let mut pruned = 0;
    for chunk in 0..(MAX_OPEN_PER_WRITER / 10) {
        let ids = Vec::from_iter(env, chunk * 10..chunk * 10 + 10);
        pruned += t.prune(&stranger, &ids);
    }
    assert_eq!(pruned, MAX_OPEN_PER_WRITER);
    assert_eq!(t.bal(&t.usdx, squatter), usdx_before);
    assert_eq!(t.bal(&t.usdx, &stranger), 0);
    assert_eq!(t.c.writer_open_count(squatter), 0);
    assert_eq!(
        t.c.list_open().iter().collect::<std::vec::Vec<_>>(),
        [MAX_OPEN_PER_WRITER],
        "only the honest maker's offer is left"
    );
    t.assert_writer_count(squatter);
}

/// FINDING F-1R (availability), fixed in v1.3.1. Under v1.3 `MAX_OPEN` was ONE global list
/// across all assets and listing is permissionless, so an attacker could issue its own UNFLAGGED
/// classic asset (the escrow and every account are eligible on it), list it, and let 20 sybil
/// writers post dust CALLs (1 unit of its own token each) at the maximum tenor until every honest
/// maker on every asset got `OpenListFull` for up to 2 years. v1.3.1 (ABI §13.3) gives each
/// underlying its own book capped at `MAX_OPEN_PER_ASSET`: the same attack (20 writers x 25 dust
/// CALLs, each sybil at half its writer cap) now fills only the junk asset's book; RWA and BOND
/// keep accepting offers, and `list_open()` (registry order) still shows the RWA ids first.
/// This is the former `finding_f1r_sybil_writers_on_a_self_listed_asset_must_not_block_other_writers`,
/// converted into a passing test.
#[test]
fn griefing8_f1r_sybil_dust_on_a_self_listed_asset_fills_only_its_own_book() {
    let t = setup();
    let env = &t.env;
    let (junk_issuer, junk_id) = t.issuer(0); // no AUTH_REQUIRED: nobody needs authorization
    let junk = t.deploy_sac(&classic_asset(b"JUNK", &junk_id));
    let lister = Address::generate(env);
    assert_eq!(t.c.list_asset(&lister, &t.s("JUNK"), &junk_issuer), junk);
    // an honest RWA offer that predates the attack
    let early = t.put(&t.writer);
    let far = START + MAX_TENOR;
    let per_sybil = 25u32;
    let sybils: std::vec::Vec<Address> = (0..MAX_OPEN_PER_ASSET / per_sybil)
        .map(|_| Address::generate(env))
        .collect();
    assert_eq!(sybils.len(), 20);
    let mut junk_ids = std::vec::Vec::new();
    for sybil in &sybils {
        // a contract account: eligible on unflagged USDx and JUNK with no trustline or issuer act
        t.sac(&junk).mint(sybil, &(per_sybil as i128 + 1));
        for _ in 0..per_sybil {
            junk_ids.push(t.c.create_offer(sybil, &junk, &OptionType::Call, &1, &1, &1, &far));
        }
        assert_eq!(t.c.writer_open_count(sybil), per_sybil);
    }
    assert_eq!(junk_ids.len() as u32, MAX_OPEN_PER_ASSET);
    assert_eq!(
        t.c.open_collateral(&t.usdx),
        STRIKE,
        "only the honest PUT locks USDx"
    );
    assert_eq!(t.c.open_collateral(&junk), MAX_OPEN_PER_ASSET as i128);

    // the junk book is full: one more dust offer fails for every sybil (all under their writer
    // cap) and for a fresh one, either type, and changes nothing
    let fresh = Address::generate(env);
    t.sac(&junk).mint(&fresh, &1);
    t.extra.borrow_mut().push(fresh.clone());
    let before = t.snap();
    assert_eq!(before.open_for[2], (junk.clone(), junk_ids.clone()));
    for (label, w) in [
        ("sybil 0", &sybils[0]),
        ("sybil 19", &sybils[19]),
        ("fresh", &fresh),
    ] {
        for ty in [OptionType::Call, OptionType::Put] {
            let r = t.c.try_create_offer(w, &junk, &ty, &1, &1, &1, &far);
            rejected_as(&t, label, r, Error::OpenListFull, &before);
        }
    }

    // honest makers still list on RWA and BOND, at the maximum tenor too
    assert_eq!(
        t.c.try_create_offer(
            &t.maker2,
            &t.rwa,
            &OptionType::Put,
            &QTY,
            &STRIKE,
            &PREMIUM,
            &far
        ),
        Ok(Ok(MAX_OPEN_PER_ASSET + 1)),
        "an honest maker is locked out of RWA by sybil dust on a self-listed asset"
    );
    let rwa_late = MAX_OPEN_PER_ASSET + 1;
    let bond_id = t.offer(&t.writer, &t.bond, OptionType::Call);
    // list_open() follows registry order, so the RWA ids come first whatever their age relative
    // to the dust, then BOND, then the junk book, truncated to LIST_OPEN_MAX
    let open: std::vec::Vec<u32> = t.c.list_open().iter().collect();
    assert_eq!(open.len() as u32, LIST_OPEN_MAX);
    assert_eq!(&open[..3], &[early, rwa_late, bond_id]);
    assert_eq!(&open[3..], &junk_ids[..LIST_OPEN_MAX as usize - 3]);
    assert_eq!(t.open_book(&t.rwa), [early, rwa_late]);
    assert_eq!(t.open_book(&junk), junk_ids);

    // a year and a half later the dust is still live, so nobody can prune it ...
    t.at(START + 3 * MAX_TENOR / 4);
    let keeper = Address::generate(env);
    assert_eq!(
        t.prune(
            &keeper,
            &Vec::from_iter(env, junk_ids[..50].iter().copied())
        ),
        0
    );
    // ... but it only ever occupies the junk book: RWA still accepts new offers
    let rwa_later = t.offer_x(
        &t.maker2,
        &t.rwa,
        OptionType::Call,
        QTY,
        STRIKE,
        PREMIUM,
        START + MAX_TENOR,
    );
    assert_eq!(t.c.list_open().get(2), Some(rwa_later));
    // a freed junk slot goes to whoever takes it, and the book is full again afterwards
    t.c.cancel_offer(&sybils[0], &junk_ids[0]);
    t.c.create_offer(&fresh, &junk, &OptionType::Call, &1, &1, &1, &far);
    let before = t.snap();
    let r =
        t.c.try_create_offer(&sybils[0], &junk, &OptionType::Call, &1, &1, &1, &far);
    rejected_as(&t, "refilled", r, Error::OpenListFull, &before);
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
        // v1.3.1: the pruner
        ("prune_expired", vec![env, mv, vec![env, id].into_val(env)]),
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

/// Pins the ABI §3 rule that `transfer` checks the RECIPIENT's eligibility, not the holder's
/// (v1.3.1 adds only the escrow guards, see the next two tests). An issuer freeze of the holder
/// blocks its own `exercise` (SAC #11) but not a hand-over to an issuer-authorized account; the
/// frozen account's tokens never move, and the new holder settles with its own authorized
/// balance. No regulated token moves without issuer authorization.
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

/// v1.3.1 (ABI §3, §13.2): while the escrow's pooled balance of the option's quote or underlying
/// token is below `open_collateral` (an issuer clawback hit the contract), a position cannot be
/// handed to a new participant: `transfer` fails with `CollateralShortfall`, after every earlier
/// check, with no event and no state change. Options on other tokens are unaffected, and an
/// issuer repair restores transfers.
#[test]
fn transfer16_deficit_blocks_hand_over_with_no_state_change() {
    let t = setup();
    let (w, m, h, h2) = (&t.writer, &t.maker2, &t.holder, &t.holder2);
    // USDx clawback must be enabled before the escrow holds any USDx
    t.usdx_flags.set_flag(IssuerFlags::RevocableFlag);
    t.usdx_flags.set_flag(IssuerFlags::ClawbackEnabledFlag);
    let rput = t.put(w); // USDx collateral, RWA underlying
    let rcall = t.call(m); // RWA collateral
    let bcall = t.offer(m, &t.bond, OptionType::Call); // BOND collateral, USDx quote
    for id in [rput, rcall, bcall] {
        t.c.buy(h, &id);
    }

    // the RWA issuer claws back a single unit from the escrow: pooled deficit on RWA only
    t.sac(&t.rwa).clawback(&t.contract, &1);
    assert_eq!(
        t.c.open_collateral(&t.rwa) - t.bal(&t.rwa, &t.contract),
        1,
        "RWA deficit"
    );
    let before = t.snap();
    for id in [rput, rcall] {
        // the PUT's collateral is USDx, but its underlying (RWA) is short: both are blocked
        rejected(
            &t,
            t.c.try_transfer(h, h2, &id),
            Error::CollateralShortfall,
            &before,
        );
        // every earlier check keeps its precedence (ABI §3 order)
        rejected(&t, t.c.try_transfer(h2, h, &id), Error::NotHolder, &before);
        rejected(&t, t.c.try_transfer(h, h, &id), Error::InvalidArgs, &before);
        let writer = t.c.get_option(&id).writer;
        rejected(
            &t,
            t.c.try_transfer(h, &writer, &id),
            Error::SelfTrade,
            &before,
        );
        rejected(
            &t,
            t.c.try_transfer(h, &t.outsider, &id),
            Error::NotEligible,
            &before,
        );
    }
    rejected(&t, t.c.try_transfer(h, h2, &99), Error::NotFound, &before);
    // an option on untouched tokens (BOND underlying, USDx quote) still changes hands
    t.c.transfer(h, h2, &bcall);
    t.c.transfer(h2, h, &bcall);

    // a USDx deficit blocks every option from the quote side, BOND ones included
    t.sac(&t.usdx).clawback(&t.contract, &1);
    let before = t.snap();
    for id in [rput, rcall, bcall] {
        rejected(
            &t,
            t.c.try_transfer(h, h2, &id),
            Error::CollateralShortfall,
            &before,
        );
    }
    // after expiry, Expired comes first
    t.at(EXPIRY);
    let expired = t.snap();
    for id in [rput, rcall, bcall] {
        rejected(&t, t.c.try_transfer(h, h2, &id), Error::Expired, &expired);
    }
    t.at(EXPIRY - 1);

    // the issuers repair the escrow (mint the missing units back): transfers work again and move
    // only the holder
    t.sac(&t.rwa).mint(&t.contract, &1);
    let before = t.snap();
    rejected(
        &t,
        t.c.try_transfer(h, h2, &rcall),
        Error::CollateralShortfall,
        &before,
    );
    t.sac(&t.usdx).mint(&t.contract, &1);
    for id in [rput, rcall, bcall] {
        let mut expect = t.snap();
        t.c.transfer(h, h2, &id);
        t.assert_one_event("option_transferred", id);
        expect
            .options
            .iter_mut()
            .find(|o| o.id == id)
            .unwrap()
            .holder = Some(h2.clone());
        assert_eq!(t.snap(), expect, "transfer of {id} after the repair");
    }
}

/// v1.3.1 (ABI §3, §13.2): while the underlying's issuer has de-authorized the escrow, the
/// contract cannot settle the option (every SAC transfer into or out of it fails), so `transfer`
/// fails with `ContractNotAuthorized` after the recipient checks and before the deficit check,
/// with no event and no state change. A frozen holder may still hand over once the escrow is
/// re-authorized (its own tokens never move).
#[test]
fn transfer16_deauthorized_escrow_blocks_hand_over() {
    let t = setup();
    let (w, m, h, h2) = (&t.writer, &t.maker2, &t.holder, &t.holder2);
    let put = t.put(w);
    let call = t.call(m);
    let bput = t.offer(m, &t.bond, OptionType::Put);
    for id in [put, call, bput] {
        t.c.buy(h, &id);
    }
    t.sac(&t.rwa).set_authorized(&t.contract, &false);
    assert!(!t.c.is_eligible(&t.rwa, &t.contract));
    let before = t.snap();
    for id in [put, call] {
        rejected(
            &t,
            t.c.try_transfer(h, h2, &id),
            Error::ContractNotAuthorized,
            &before,
        );
        // recipient checks come first (ABI §3 order)
        rejected(
            &t,
            t.c.try_transfer(h, &t.outsider, &id),
            Error::NotEligible,
            &before,
        );
        rejected(&t, t.c.try_transfer(h, h, &id), Error::InvalidArgs, &before);
        rejected(&t, t.c.try_transfer(h2, h, &id), Error::NotHolder, &before);
    }
    // the holder frozen as well: still ContractNotAuthorized (the holder's own authorization is
    // not what blocks it)
    t.sac(&t.rwa).set_authorized(h, &false);
    let frozen = t.snap();
    for id in [put, call] {
        rejected(
            &t,
            t.c.try_transfer(h, h2, &id),
            Error::ContractNotAuthorized,
            &frozen,
        );
    }
    // the BOND option is unaffected
    t.c.transfer(h, h2, &bput);
    assert_eq!(t.c.get_option(&bput).holder, Some(h2.clone()));

    // de-authorized AND short: ContractNotAuthorized comes before CollateralShortfall
    t.sac(&t.rwa).clawback(&t.contract, &1);
    let before = t.snap();
    rejected(
        &t,
        t.c.try_transfer(h, h2, &call),
        Error::ContractNotAuthorized,
        &before,
    );
    t.sac(&t.rwa).set_authorized(&t.contract, &true);
    let before = t.snap();
    rejected(
        &t,
        t.c.try_transfer(h, h2, &call),
        Error::CollateralShortfall,
        &before,
    );
    // repaired: the frozen holder hands both positions over
    t.sac(&t.rwa).mint(&t.contract, &1);
    let frozen_bals = [t.bal(&t.usdx, h), t.bal(&t.rwa, h), t.bal(&t.bond, h)];
    t.c.transfer(h, h2, &put);
    t.c.transfer(h, h2, &call);
    assert_eq!(
        [t.bal(&t.usdx, h), t.bal(&t.rwa, h), t.bal(&t.bond, h)],
        frozen_bals
    );
    assert_eq!(t.c.get_option(&put).holder, Some(h2.clone()));
    assert_eq!(t.c.get_option(&call).holder, Some(h2.clone()));
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
    // v1.3: at most MAX_OPEN_PER_WRITER open offers per writer, so the dust is split
    for i in 0..58 {
        let dust_writer = if i % 2 == 0 { w } else { m };
        t.offer_x(dust_writer, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY);
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

// =============================================================================================
// 18. Permissionless asset listing (v1.3)
// =============================================================================================

#[test]
fn listing18_lookalike_codes_never_alias_a_listed_asset() {
    let t = setup();
    let env = &t.env;
    let lister = &t.maker2;
    assert_eq!(t.c.asset_count(), SEEDED);
    assert_eq!(t.assets(), [t.rwa.clone(), t.bond.clone()]);

    // A genuine regulated asset coded "RWA" (its own issuer), listed by the writer.
    let (iss, iss_id) = t.issuer(REGULATED);
    let real = t.deploy_sac(&classic_asset(b"RWA", &iss_id));
    assert!(!t.c.is_listed(&real));
    assert_eq!(t.c.list_asset(&t.writer, &t.s("RWA"), &iss), real);
    assert_eq!(t.listed_events(), [(real.clone(), 2)]);
    assert!(t.c.is_listed(&real));
    let before = t.snap();
    assert_eq!(before.assets, [t.rwa.clone(), t.bond.clone(), real.clone()]);

    // The derivation is the host's: the constructor-seeded RWA (SDK code `aaa`) and the quote
    // token re-derive to exactly their SACs, and the genuine RWA to itself.
    let g = |id: &xdr::AccountId| {
        Address::try_from_val(env, &xdr::ScAddress::Account(id.clone())).unwrap()
    };
    let (seeded_iss, usdx_iss) = (g(&t.rwa_issuer), g(&t.usdx_issuer));
    for (label, code, issuer) in [
        ("the genuine RWA again", "RWA", &iss),
        ("the seeded RWA (code aaa)", "aaa", &seeded_iss),
        ("the quote token (code aaa)", "aaa", &usdx_iss),
    ] {
        let r = t.c.try_list_asset(lister, &t.s(code), issuer);
        rejected_as(&t, label, r, Error::AlreadyListed, &before);
    }

    // Byte-level lookalikes outside [A-Za-z0-9]{1,12}: InvalidArgs. A NUL-padded "RWA\0" would
    // serialize to the very same zero-padded AlphaNum4 code as "RWA" if the charset were not
    // enforced, so it must never derive the genuine RWA address.
    let bad: [&[u8]; 18] = [
        b"RWA ",
        b" RWA",
        b"RWA\0",
        b"RWA\0\0\0\0\0\0\0\0\0",
        b"\0RWA",
        b"RW A",
        b"RWA\n",
        b"RWA\t",
        b"RW-A",
        b"RW.A",
        b"RWA_",
        "RWÄ".as_bytes(),
        "RWA\u{200B}".as_bytes(), // zero-width space
        "ＲＷＡ".as_bytes(),      // full-width letters
        b"\xff\xfe",
        b"",
        b"RWAAAAAAAAAAA", // 13 characters
        b"RWA0123456789ABCDEF",
    ];
    for code in bad {
        let s = String::from_bytes(env, code);
        let r = t.c.try_list_asset(lister, &s, &iss);
        rejected_as(
            &t,
            &std::format!("{code:?}"),
            r,
            Error::InvalidArgs,
            &before,
        );
    }

    // Valid-charset lookalikes (case, an extra character, AlphaNum12) are DIFFERENT assets with
    // different canonical addresses; while their SAC is not deployed they are AssetNotDeployed.
    let near = [
        "rwa",
        "Rwa",
        "rWA",
        "RWA0",
        "0RWA",
        "RWAA",
        "RWAAA",
        "RWA000000000",
    ];
    for code in near {
        let derived = t.canonical_sac(&classic_asset(code.as_bytes(), &iss_id));
        assert_ne!(derived, real, "{code}");
        let r = t.c.try_list_asset(lister, &t.s(code), &iss);
        rejected_as(&t, code, r, Error::AssetNotDeployed, &before);
    }

    // Once someone deploys a lookalike SAC (anyone can), it lists as a separate asset at its own
    // canonical address; the genuine listing is untouched. Both encodings (AlphaNum4 for 1–4
    // characters, AlphaNum12 for 5–12) land on the host-computed address.
    let mut expect_assets = before.assets.clone();
    for code in ["rwa", "RWAA", "RWAAA"] {
        let sac = t.deploy_sac(&classic_asset(code.as_bytes(), &iss_id));
        assert_eq!(t.c.list_asset(lister, &t.s(code), &iss), sac, "{code}");
        assert_eq!(t.listed_events(), [(sac.clone(), 2)], "{code}");
        assert_ne!(sac, real);
        expect_assets.push(sac);
    }
    assert_eq!(t.assets(), expect_assets);
    assert!(t.c.is_listed(&real));
    assert_eq!(t.c.asset_count(), SEEDED + 4);
    let fake = expect_assets[3].clone();

    // The lookalike carries none of RWA's authorizations: the issuer authorized the writer and
    // the escrow on the genuine RWA only.
    let real_sac = t.sac(&real);
    real_sac.set_authorized(&t.writer, &true);
    real_sac.mint(&t.writer, &UNDERLYING_START);
    real_sac.set_authorized(&t.contract, &true);
    let fake_sac = t.sac(&fake);
    fake_sac.set_authorized(&t.holder, &true);
    fake_sac.mint(&t.holder, &UNDERLYING_START);
    let before = t.snap();
    for ty in [OptionType::Put, OptionType::Call] {
        let r =
            t.c.try_create_offer(&t.writer, &fake, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY);
        rejected_as(
            &t,
            "writer only authorized on RWA",
            r,
            Error::NotEligible,
            &before,
        );
        let r =
            t.c.try_create_offer(&t.holder, &fake, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY);
        rejected_as(
            &t,
            "escrow not authorized on the lookalike",
            r,
            Error::ContractNotAuthorized,
            &before,
        );
    }
    assert_eq!(t.bal(&fake, &t.holder), UNDERLYING_START);
    assert_eq!(t.bal(&fake, &t.contract), 0);
    // positive control: the genuine RWA trades
    let id = t.offer(&t.writer, &real, OptionType::Call);
    assert_eq!(t.c.get_option(&id).underlying, real);
    assert_eq!(t.bal(&real, &t.contract), QTY);
}

/// v1.3.1 (ABI §3 `list_asset`, §13.4): `AlreadyListed` is decided from the contract's own
/// storage before the deployment probe. A re-listing of a self-listed asset, of a
/// constructor-seeded asset or of the quote token makes no call into that asset's SAC, so its
/// answer can never depend on the SAC (v1.3 probed first), while a first listing probes the SAC
/// exactly once (`decimals`) and calls nothing else.
#[test]
fn listing18_relisting_is_rejected_before_the_deployment_probe() {
    let t = setup();
    let env = &t.env;
    let root = (t.contract.clone(), std::string::String::from("list_asset"));
    let (iss, iss_id) = t.issuer(REGULATED);
    let eqty = t.deploy_sac(&classic_asset(b"EQTY", &iss_id));
    assert_eq!(t.c.list_asset(&t.writer, &t.s("EQTY"), &iss), eqty);
    assert_eq!(
        t.calls(),
        [root.clone(), (eqty.clone(), "decimals".into())],
        "a first listing probes the SAC once"
    );
    let g = |id: &xdr::AccountId| {
        Address::try_from_val(env, &xdr::ScAddress::Account(id.clone())).unwrap()
    };
    let before = t.snap();
    for (label, code, issuer) in [
        ("the self-listed EQTY", "EQTY", iss.clone()),
        ("the seeded RWA (code aaa)", "aaa", g(&t.rwa_issuer)),
        ("the quote token (code aaa)", "aaa", g(&t.usdx_issuer)),
    ] {
        let r = t.c.try_list_asset(&t.maker2, &t.s(code), &issuer);
        let calls = t.calls();
        rejected_as(&t, label, r, Error::AlreadyListed, &before);
        assert_eq!(
            calls,
            std::slice::from_ref(&root),
            "{label}: probed the SAC before AlreadyListed"
        );
    }
    // the same code under another issuer is a different, undeployed asset: the probe decides
    let (other, _) = t.issuer(REGULATED);
    let r = t.c.try_list_asset(&t.maker2, &t.s("EQTY"), &other);
    rejected_as(&t, "undeployed", r, Error::AssetNotDeployed, &before);
}

#[test]
fn listing18_issuer_must_be_a_classic_account() {
    let t = setup();
    let env = &t.env;
    let before = t.snap();
    let code = t.s("EQTY");
    let random_contract = Address::generate(env);
    for (label, issuer) in [
        ("a random contract address", &random_contract),
        ("the options contract", &t.contract),
        ("an underlying SAC's own address", &t.rwa),
        ("the quote SAC's own address", &t.usdx),
        ("the lister itself (a contract account)", &t.writer),
    ] {
        let r = t.c.try_list_asset(&t.writer, &code, issuer);
        rejected_as(&t, label, r, Error::InvalidArgs, &before);
    }

    // issuer == lister where the lister is a classic account is an ordinary listing of its own
    // asset: AssetNotDeployed until its SAC exists, then it lists.
    let (g, g_id) = t.issuer(REGULATED);
    let r = t.c.try_list_asset(&g, &code, &g);
    rejected_as(
        &t,
        "own asset, SAC not deployed",
        r,
        Error::AssetNotDeployed,
        &before,
    );
    let sac = t.deploy_sac(&classic_asset(b"EQTY", &g_id));
    assert_eq!(t.c.list_asset(&g, &code, &g), sac);
    assert_eq!(t.listed_events(), [(sac.clone(), 2)]);
    // ... and listing it grants nothing: the issuer has not authorized the escrow
    t.sac(&sac).set_authorized(&t.writer, &true);
    t.sac(&sac).mint(&t.writer, &UNDERLYING_START);
    let before = t.snap();
    let r = t.c.try_create_offer(
        &t.writer,
        &sac,
        &OptionType::Call,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &EXPIRY,
    );
    rejected_as(
        &t,
        "listed, escrow unauthorized",
        r,
        Error::ContractNotAuthorized,
        &before,
    );

    // muxed addresses cannot be passed as lister or issuer (the host rejects the argument)
    let m = MuxedAddress::generate(env);
    let mv = Val::try_from_val(env, &m).unwrap();
    let cases: [(&str, Vec<Val>); 2] = [
        (
            "muxed lister",
            vec![env, mv, code.into_val(env), g.into_val(env)],
        ),
        (
            "muxed issuer",
            vec![env, t.writer.into_val(env), code.into_val(env), mv],
        ),
    ];
    for (label, args) in cases {
        let r = t.raw("list_asset", args);
        assert!(r.is_err(), "{label} accepted");
        assert!(t.no_events(), "{label}");
        assert_eq!(t.snap(), before, "{label}");
    }
}

#[test]
fn listing18_presigned_tree_cannot_list_a_different_code_or_issuer() {
    let t = setup();
    let env = &t.env;
    let (iss, iss_id) = t.issuer(REGULATED);
    let (iss2, iss2_id) = t.issuer(REGULATED);
    let eqty = t.deploy_sac(&classic_asset(b"EQTY", &iss_id));
    t.deploy_sac(&classic_asset(b"JUNK", &iss_id));
    t.deploy_sac(&classic_asset(b"EQTY", &iss2_id));
    let lister = &t.writer;
    let tree = |who: &Address, code: &str, issuer: &Address| MockAuthInvoke {
        contract: &t.contract,
        fn_name: "list_asset",
        args: (who, t.s(code), issuer).into_val(env),
        sub_invokes: &[],
    };
    let signed = tree(lister, "EQTY", &iss);
    let junk_shape = tree(lister, "JUNK", &iss);
    let other_fn = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "prune_expired",
        args: (lister, t.s("JUNK"), &iss).into_val(env),
        sub_invokes: &[],
    };

    // a third party submits list_asset(lister, JUNK, iss) with what the lister signed
    let junk_args: Vec<Val> = (lister, t.s("JUNK"), &iss).into_val(env);
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![
        (
            "lister's EQTY tree replayed for JUNK",
            std::vec![MockAuth {
                address: lister,
                invoke: &signed
            }]
        ),
        (
            "maker2 signs the lister-shaped JUNK tree",
            std::vec![MockAuth {
                address: &t.maker2,
                invoke: &junk_shape
            }]
        ),
        (
            "lister's tree for another function",
            std::vec![MockAuth {
                address: lister,
                invoke: &other_fn
            }]
        ),
        ("no signature at all", std::vec![]),
    ];
    assert_auth_cases(&t, "list_asset", &junk_args, &cases);
    // ... or for the same code under a different issuer
    let iss2_args: Vec<Val> = (lister, t.s("EQTY"), &iss2).into_val(env);
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![(
        "lister's EQTY/iss tree replayed for EQTY/iss2",
        std::vec![MockAuth {
            address: lister,
            invoke: &signed
        }]
    )];
    assert_auth_cases(&t, "list_asset", &iss2_args, &cases);
    assert_eq!(t.c.asset_count(), SEEDED);

    // positive control: the lister's own tree lists exactly what it signed
    env.mock_auths(&[MockAuth {
        address: lister,
        invoke: &signed,
    }]);
    assert_eq!(t.c.list_asset(lister, &t.s("EQTY"), &iss), eqty);
    assert_eq!(t.assets(), [t.rwa.clone(), t.bond.clone(), eqty.clone()]);
    env.mock_all_auths();
}

#[test]
fn listing18_spam_is_linear_and_never_tradable_without_issuer_consent() {
    let t = setup();
    let env = &t.env;
    let n = 50u32;
    let mut seed: u64 = 0x005E_ED0F_1157;
    let mut next = || {
        seed = seed
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        (seed >> 33) as usize
    };
    const ALNUM: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut listed = std::vec::Vec::new();
    let mut costs = std::vec::Vec::new();
    let mut control = std::vec::Vec::new();
    for _ in 0..n {
        let len = 1 + next() % 12;
        let code: std::vec::Vec<u8> = (0..len).map(|_| ALNUM[next() % ALNUM.len()]).collect();
        let (iss, iss_id) = t.issuer(REGULATED);
        let sac = t.deploy_sac(&classic_asset(&code, &iss_id));
        let lister = Address::generate(env);
        assert_eq!(
            t.c.list_asset(&lister, &String::from_bytes(env, &code), &iss),
            sac
        );
        costs.push(env.cost_estimate().resources());
        assert_eq!(t.listed_events(), [(sac.clone(), 2)]);
        // control: an auth-checked call that fails before touching the registry, measured in the
        // same (growing) test ledger
        let r = t.c.try_list_asset(&lister, &t.s("A B"), &iss);
        assert_err(r, Error::InvalidArgs);
        control.push(env.cost_estimate().resources());
        listed.push(sac);
    }
    // Every listing touches the same ledger state (two persistent registry entries plus the
    // instance counter), so the registry grows linearly and no listing's footprint, writes or
    // events grow with it. Modelled instructions do creep up in the test env, but the control
    // call (rejected before any registry access) creeps up too: the test ledger is one growing
    // in-memory map, whereas on chain each transaction only loads its own footprint. They are
    // bounded absolutely instead (1% of the mainnet per-transaction limit).
    let first = &costs[0];
    for (i, r) in costs.iter().enumerate() {
        assert_eq!(r.write_entries, first.write_entries, "listing {i}");
        assert_eq!(
            r.memory_read_entries + r.disk_read_entries + r.write_entries,
            first.memory_read_entries + first.disk_read_entries + first.write_entries,
            "listing {i}"
        );
        assert!(
            r.write_bytes <= first.write_bytes + 64,
            "listing {i}: write bytes grew {} -> {}",
            first.write_bytes,
            r.write_bytes
        );
        // the event carries the 1–12 byte code, so its size varies by at most 12 bytes
        assert!(
            r.contract_events_size_bytes
                .abs_diff(first.contract_events_size_bytes)
                <= 12,
            "listing {i}: event bytes {} vs {}",
            r.contract_events_size_bytes,
            first.contract_events_size_bytes
        );
        assert!(
            r.instructions <= INSTRUCTIONS_LIMIT / 100,
            "listing {i}: {} instructions",
            r.instructions
        );
    }
    std::println!(
        "listing18 spam: listing #1 {:?}\nlisting18 spam: listing #25 {:?}\nlisting18 spam: listing #50 {:?}",
        costs[0],
        costs[24],
        costs[49]
    );
    std::println!(
        "listing18 spam: instructions listing #1 {} -> #50 {}; control #1 {} -> #50 {}",
        costs[0].instructions,
        costs[49].instructions,
        control[0].instructions,
        control[49].instructions
    );
    assert_eq!(t.c.asset_count(), SEEDED + n);
    let all = t.assets();
    assert_eq!(&all[..2], &[t.rwa.clone(), t.bond.clone()]);
    assert_eq!(&all[2..], &listed[..]);
    assert_eq!(t.c.list_assets(&0, &u32::MAX).len(), MAX_PAGE);
    assert_eq!(
        t.c.list_assets(&MAX_PAGE, &MAX_PAGE).len(),
        (SEEDED + n - MAX_PAGE)
    );
    assert!(t.c.list_assets(&(SEEDED + n), &10).is_empty());
    assert!(t.c.list_assets(&u32::MAX, &u32::MAX).is_empty());
    assert!(t.c.list_assets(&0, &0).is_empty());

    // Listing grants nothing: each issuer authorizes and funds the writer but NOT the escrow, so
    // no spam asset is tradable (ContractNotAuthorized, before any transfer).
    let w = &t.writer;
    for sac in &listed {
        let s = t.sac(sac);
        s.set_authorized(w, &true);
        s.mint(w, &UNDERLYING_START);
    }
    let before = t.snap();
    for (i, sac) in listed.iter().enumerate() {
        for ty in [OptionType::Put, OptionType::Call] {
            let r =
                t.c.try_create_offer(w, sac, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY);
            rejected_as(
                &t,
                &std::format!("spam asset {i} {ty:?}"),
                r,
                Error::ContractNotAuthorized,
                &before,
            );
        }
        assert_eq!(t.bal(sac, w), UNDERLYING_START);
        assert_eq!(t.bal(sac, &t.contract), 0);
        assert!(!t.c.is_eligible(sac, &t.contract));
    }
    // a writer the issuer never authorized is NotEligible (eligibility is checked first)
    let r = t.c.try_create_offer(
        &t.maker2,
        &listed[0],
        &OptionType::Call,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &EXPIRY,
    );
    rejected_as(&t, "unauthorized writer", r, Error::NotEligible, &before);
    // positive control: once its issuer authorizes the escrow, the asset trades
    t.sac(&listed[0]).set_authorized(&t.contract, &true);
    let id = t.offer(w, &listed[0], OptionType::Call);
    assert_eq!(t.c.get_option(&id).underlying, listed[0]);
    assert_eq!(t.c.open_collateral(&listed[0]), QTY);
}

// =============================================================================================
// 19. prune_expired (v1.3)
// =============================================================================================

#[test]
fn prune19_skips_live_active_and_terminal_options_and_expiry_boundary_is_inclusive() {
    let t = setup();
    let env = &t.env;
    let (w, m, h) = (&t.writer, &t.maker2, &t.holder);
    let tx = START + 1_000; // "T"
    let at_t = t.offer_x(w, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM, tx);
    let at_t1 = t.offer_x(m, &t.rwa, OptionType::Call, QTY, STRIKE, PREMIUM, tx + 1);
    let active = t.offer_x(w, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM, tx);
    t.c.buy(h, &active);
    let exercised = t.call(m);
    t.c.buy(h, &exercised);
    t.c.exercise(h, &exercised);
    let settled = t.put(m);
    t.c.buy(h, &settled);
    t.c.exercise(h, &settled);
    t.c.claim_delivery(m, &settled);
    let cancelled = t.offer_x(w, &t.bond, OptionType::Call, QTY, STRIKE, PREMIUM, tx);
    t.c.cancel_offer(w, &cancelled);
    let reclaimed = t.offer_x(w, &t.bond, OptionType::Put, QTY, STRIKE, PREMIUM, tx);
    let live = t.offer(m, &t.bond, OptionType::Call); // expiry EXPIRY
    let all = vec![
        env, at_t, at_t1, active, exercised, settled, cancelled, reclaimed, live,
    ];

    // now = T - 1: nothing is prunable; a prune that prunes nothing changes and emits nothing
    t.at(tx - 1);
    let before = t.snap();
    let stranger = Address::generate(env); // signs only its own prune_expired call
    assert_eq!(t.prune(&stranger, &all), 0);
    assert!(t.no_events(), "a prune that pruned nothing emitted events");
    assert_eq!(t.snap(), before);
    assert_eq!(t.prune(&stranger, &vec![env]), 0);
    assert!(t.no_events());

    // now = T: expiry <= now is prunable (`at_t` only); expiry == now + 1 is not; the bought
    // option with the same expiry is Active and stays the writer's to reclaim
    t.at(tx);
    t.c.reclaim(w, &reclaimed);
    let mut expect = t.snap();
    assert_eq!(t.prune(&stranger, &all), 1);
    assert_eq!(t.pruned_ids(), [at_t]);
    expect.set_state(at_t, State::Expired);
    expect.add(w, 0, STRIKE);
    expect.add(&t.contract, 0, -STRIKE);
    expect.open_collateral[0] -= STRIKE;
    expect.add_open(w, -1);
    assert_eq!(t.snap(), expect, "prune at T changed more than `at_t`");
    assert_eq!(t.state(active), State::Active);
    assert_eq!(t.state(at_t1), State::Offered);
    t.assert_writer_count(w);

    // now = T + 1: `at_t1` becomes prunable; `at_t` is Expired and skipped, never paid twice
    t.at(tx + 1);
    let mut expect = t.snap();
    assert_eq!(t.prune(&stranger, &vec![env, at_t, at_t1, at_t, at_t1]), 1);
    assert_eq!(t.pruned_ids(), [at_t1]);
    expect.set_state(at_t1, State::Expired);
    expect.add(m, 1, QTY);
    expect.add(&t.contract, 1, -QTY);
    expect.open_collateral[1] -= QTY;
    expect.add_open(m, -1);
    assert_eq!(t.snap(), expect);

    // the same id many times in one list releases its collateral once
    let dup = t.offer_x(w, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM, tx + 5);
    t.at(tx + 5);
    let w_usdx = t.bal(&t.usdx, w);
    assert_eq!(t.prune(&stranger, &vec![env, dup, dup, dup, dup]), 1);
    assert_eq!(t.pruned_ids(), [dup]);
    assert_eq!(t.bal(&t.usdx, w), w_usdx + STRIKE);

    // an unknown id anywhere in the list fails the whole call, including ids before it
    let late = t.offer_x(w, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM, tx + 6);
    t.at(tx + 6);
    let before = t.snap();
    let count = t.c.option_count();
    for ids in [
        vec![env, late, 999],
        vec![env, late, count],
        vec![env, 999, late],
        vec![env, late, u32::MAX],
    ] {
        let r = t.try_prune(&stranger, &ids);
        rejected_as(&t, &std::format!("{ids:?}"), r, Error::NotFound, &before);
    }
    assert_eq!(t.state(late), State::Offered);

    // past every expiry: Active, Exercised and terminal options are still never touched
    t.at(EXPIRY + 1);
    let mut expect = t.snap();
    assert_eq!(
        t.prune(
            &stranger,
            &vec![env, active, exercised, settled, cancelled, reclaimed, late]
        ),
        1
    );
    assert_eq!(t.pruned_ids(), [late]);
    expect.set_state(late, State::Expired);
    expect.add(w, 0, STRIKE);
    expect.add(&t.contract, 0, -STRIKE);
    expect.open_collateral[0] -= STRIKE;
    expect.add_open(w, -1);
    assert_eq!(t.snap(), expect);
    // and the writer still reclaims its Active option itself
    t.c.reclaim(w, &active);
    assert_eq!(t.state(active), State::Expired);
    assert_eq!(t.c.get_option(&active).holder, Some(h.clone()));
    for p in [w, m, h] {
        t.assert_writer_count(p);
    }
}

#[test]
fn prune19_collateral_returns_to_the_writer_whoever_prunes() {
    let t = setup();
    let env = &t.env;
    let (w, m, h) = (&t.writer, &t.maker2, &t.holder);
    let funds = [USDX_START, UNDERLYING_START, UNDERLYING_START];
    // the pruner is the writer's counterparty: `h` holds an Active option written by `w`
    let bought = t.put(w);
    t.c.buy(h, &bought);
    let put = t.put(w); // USDx collateral
    let call = t.call(w); // RWA collateral
    let bcall = t.offer(m, &t.bond, OptionType::Call); // maker2's BOND collateral
    let g = t.g_actor([true; 3], true, funds); // a classic-account writer
    let gput = t.put(&g);
    t.at(EXPIRY);
    let mut expect = t.snap();
    // The holder of `bought` prunes, signing only its own prune_expired call; the pruner argument
    // names who pruned (the event), never a recipient.
    let n = t.prune(h, &vec![env, bought, put, call, bcall, gput]);
    assert_eq!(n, 4);
    assert_eq!(t.pruned_ids(), [put, call, bcall, gput]);
    for id in [put, call, bcall, gput] {
        expect.set_state(id, State::Expired);
    }
    expect.add(w, 0, STRIKE);
    expect.add(w, 1, QTY);
    expect.add(m, 2, QTY);
    expect.add(&g, 0, STRIKE);
    expect.add(&t.contract, 0, -2 * STRIKE);
    expect.add(&t.contract, 1, -QTY);
    expect.add(&t.contract, 2, -QTY);
    expect.open_collateral = [STRIKE, 0, 0]; // only `bought` stays locked
    expect.add_open(w, -2);
    expect.add_open(m, -1);
    expect.add_open(&g, -1);
    assert_eq!(
        t.snap(),
        expect,
        "only the writers were paid, exactly their collateral"
    );
    // the counterparty's own position is untouched and the writer reclaims it as usual
    assert_eq!(t.state(bought), State::Active);
    assert_eq!(t.c.get_option(&bought).holder, Some(h.clone()));
    t.c.reclaim(w, &bought);
    for tok in t.tokens() {
        assert_eq!(t.c.open_collateral(&tok), 0);
        assert_eq!(t.bal(&tok, &t.contract), 0);
    }
}

#[test]
fn prune19_frozen_writer_or_deauthorized_escrow_is_skipped_never_redirected() {
    let t = setup();
    let env = &t.env;
    let (w, m) = (&t.writer, &t.maker2);
    let call = t.call(w); // RWA collateral, returned to w
    let put = t.put(w); // USDx collateral
    let bcall = t.offer(m, &t.bond, OptionType::Call);
    t.at(EXPIRY);

    // the issuer freezes the writer on RWA: its CALL cannot be paid back, so it is skipped
    // (stays Offered, collateral stays in the contract); its USDx PUT is still pruned
    t.sac(&t.rwa).set_authorized(w, &false);
    let mut expect = t.snap();
    let keeper = Address::generate(env);
    assert_eq!(t.prune(&keeper, &vec![env, call, put]), 1);
    assert_eq!(t.pruned_ids(), [put]);
    expect.set_state(put, State::Expired);
    expect.add(w, 0, STRIKE);
    expect.add(&t.contract, 0, -STRIKE);
    expect.open_collateral[0] -= STRIKE;
    expect.add_open(w, -1);
    assert_eq!(t.snap(), expect);
    assert_eq!(t.state(call), State::Offered);
    // only skipped ids: Ok(0), no event, nothing changes
    let before = t.snap();
    assert_eq!(t.prune(&keeper, &vec![env, call, call]), 0);
    assert!(t.no_events());
    assert_eq!(t.snap(), before);

    // the issuer de-authorizes the escrow on BOND: maker2's CALL cannot leave, skipped too
    t.sac(&t.bond).set_authorized(&t.contract, &false);
    let before = t.snap();
    assert_eq!(t.prune(&keeper, &vec![env, bcall]), 0);
    assert!(t.no_events());
    assert_eq!(t.snap(), before);

    // once re-authorized, the same prune pays the writers, and nobody else
    t.sac(&t.rwa).set_authorized(w, &true);
    t.sac(&t.bond).set_authorized(&t.contract, &true);
    let mut expect = t.snap();
    assert_eq!(t.prune(&keeper, &vec![env, call, bcall]), 2);
    assert_eq!(t.pruned_ids(), [call, bcall]);
    expect.set_state(call, State::Expired);
    expect.set_state(bcall, State::Expired);
    expect.add(w, 1, QTY);
    expect.add(m, 2, QTY);
    expect.add(&t.contract, 1, -QTY);
    expect.add(&t.contract, 2, -QTY);
    expect.open_collateral = [0, 0, 0];
    expect.add_open(w, -1);
    expect.add_open(m, -1);
    assert_eq!(t.snap(), expect);
}

#[test]
fn prune19_huge_id_lists_fit_the_footprint_or_fail_as_a_whole() {
    let t = setup();
    let env = &t.env;
    // footprint size of an `InvocationResources` (the type is not re-exported, hence a macro)
    macro_rules! fp {
        ($r:expr) => {
            $r.memory_read_entries + $r.disk_read_entries + $r.write_entries
        };
    }

    // Phase A, skipped ids: 450 LIVE offers (9 writers x 50), expiring a day after phase B.
    let live_n: u32 = 9 * MAX_OPEN_PER_WRITER;
    let live_writers: std::vec::Vec<Address> = (0..9).map(|_| t.fresh_writer(false)).collect();
    for i in 0..live_n {
        let w = &live_writers[(i / MAX_OPEN_PER_WRITER) as usize];
        t.offer_x(w, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY + 86_400);
    }
    // binary search the largest list of live ids that fits (no state change, so probes repeat)
    t.env.cost_estimate().disable_resource_limits();
    // Measured under `mock_all_auths` (recording mode), which adds no auth entries to the
    // footprint: the model of a keeper that signs as the transaction source account.
    let keeper = Address::generate(env);
    let fits = |k: u32| -> bool {
        assert_eq!(t.c.prune_expired(&keeper, &Vec::from_iter(env, 0..k)), 0);
        t.exceeded().is_empty()
    };
    let (mut lo, mut hi) = (1u32, live_n);
    assert!(fits(lo) && !fits(hi), "450 skipped ids must exceed a limit");
    while hi - lo > 1 {
        let mid = (lo + hi) / 2;
        if fits(mid) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    let max_skip = lo;
    fits(max_skip + 1);
    let over = t.exceeded();
    t.env
        .cost_estimate()
        .enforce_resource_limits(NetworkInvocationResourceLimits::mainnet());
    let before = t.snap();
    assert_eq!(
        t.c.prune_expired(&keeper, &Vec::from_iter(env, 0..max_skip)),
        0
    );
    let r = env.cost_estimate().resources();
    assert!(t.no_events());
    assert_eq!(t.snap(), before);
    std::println!(
        "prune19: max live (skipped) ids per call = {max_skip} ({} footprint entries); {} ids exceed {over:?}; at max: {r:?}",
        fp!(r),
        max_skip + 1
    );
    assert!(
        max_skip >= 300,
        "a keeper must be able to scan hundreds of ids"
    );

    // Phase B, pruned ids, worst case: every id has its own writer (its own WriterOpen entry and
    // USDx balance entry), in a fresh env. The per-id cost of the exact ledger metrics
    // (footprint, writes, write bytes, event bytes) is measured from a 1-id and an 11-id prune;
    // the predicted maximum must fit them and max + 1 must exceed one. Modelled CPU and memory
    // are NOT used: every `try_transfer` snapshots the test env's single in-memory ledger map
    // (all entries of the test), which on chain is only the transaction footprint, so the test
    // env inflates both; they are printed for information.
    let u = setup();
    let env = &u.env;
    env.cost_estimate().budget().reset_unlimited();
    let pool: u32 = 160;
    for _ in 0..pool {
        let w = u.fresh_writer(false);
        u.offer_x(&w, &u.rwa, OptionType::Put, 1, 1, 1, EXPIRY);
    }
    u.at(EXPIRY);
    env.cost_estimate().disable_resource_limits();
    let mut cursor = 0u32;
    let keeper = Address::generate(env);
    let mut prune = |k: u32| {
        let ids = Vec::from_iter(env, cursor..cursor + k);
        cursor += k;
        assert_eq!(
            u.c.prune_expired(&keeper, &ids),
            k,
            "prune of {k} expired offers"
        );
        assert_eq!(u.pruned_ids().len() as u32, k);
        env.cost_estimate().resources()
    };
    let r1 = prune(1);
    let r11 = prune(11);
    let lin = |a: f64, b: f64, limit: f64| -> u32 {
        let per = (b - a) / 10.0;
        if per <= 0.0 {
            u32::MAX
        } else {
            ((limit - (a - per)) / per).floor() as u32
        }
    };
    let caps = [
        (
            "footprint entries",
            lin(fp!(r1) as f64, fp!(r11) as f64, FOOTPRINT_LIMIT as f64),
        ),
        (
            "write entries",
            lin(
                r1.write_entries as f64,
                r11.write_entries as f64,
                WRITE_LIMIT as f64,
            ),
        ),
        (
            "write bytes",
            lin(
                r1.write_bytes as f64,
                r11.write_bytes as f64,
                WRITE_BYTES_LIMIT as f64,
            ),
        ),
        (
            "contract events bytes",
            lin(
                r1.contract_events_size_bytes as f64,
                r11.contract_events_size_bytes as f64,
                EVENTS_LIMIT as f64,
            ),
        ),
    ];
    let (binding, max_prune) = caps.iter().min_by_key(|(_, c)| *c).copied().unwrap();
    std::println!(
        "prune19: predicted max pruned ids per call, distinct writers, per ledger limit: {caps:?}"
    );
    assert!(
        max_prune >= 20,
        "a keeper must be able to prune a useful batch"
    );
    assert!(
        12 + 2 * max_prune < pool,
        "pool too small for max_prune = {max_prune}"
    );
    let at_max = prune(max_prune);
    let over_at_max = u.exceeded_ledger();
    assert!(
        over_at_max.is_empty(),
        "{max_prune} pruned ids exceed {over_at_max:?}"
    );
    std::println!(
        "prune19: max pruned ids per call = {max_prune} (binding: {binding}); at max: {at_max:?} (instructions/mem are test-env inflated)"
    );
    prune(max_prune + 1);
    let over = u.exceeded_ledger();
    assert!(
        !over.is_empty(),
        "{} pruned ids still fit; the prediction is off",
        max_prune + 1
    );
    std::println!(
        "prune19: {} pruned ids exceed {over:?}; such a transaction fails as a whole on chain",
        max_prune + 1
    );
    for id in 0..cursor {
        assert_eq!(u.state(id), State::Expired);
    }
    assert_eq!(u.open_book(&u.rwa).len() as u32, pool - cursor);
    assert_eq!(u.c.list_open().len(), (pool - cursor).min(LIST_OPEN_MAX));
    assert_eq!(u.c.open_collateral(&u.usdx), (pool - cursor) as i128);
}

// =============================================================================================
// 20. Per-writer open cap (v1.3)
// =============================================================================================

#[test]
fn writercap20_cap_is_per_writer_across_assets_types_and_one_ledger() {
    let t = setup();
    let env = &t.env;
    let (w, m) = (&t.writer, &t.maker2);
    let (seq, ts) = (env.ledger().sequence(), env.ledger().timestamp());
    // 50 offers in ONE ledger (same timestamp, same sequence), all on RWA, PUTs and CALLs
    for i in 0..MAX_OPEN_PER_WRITER {
        let ty = if i % 2 == 0 {
            OptionType::Put
        } else {
            OptionType::Call
        };
        t.offer_x(w, &t.rwa, ty, 1, 1, 1, EXPIRY);
    }
    assert_eq!(
        (env.ledger().sequence(), env.ledger().timestamp()),
        (seq, ts)
    );
    assert_eq!(t.c.writer_open_count(w), MAX_OPEN_PER_WRITER);
    t.assert_writer_count(w);

    // the 51st: on RWA or BOND (the cap is per writer, not per asset), PUT or CALL
    let before = t.snap();
    for u in [&t.rwa, &t.bond] {
        for ty in [OptionType::Put, OptionType::Call] {
            let r =
                t.c.try_create_offer(w, u, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY);
            rejected_as(
                &t,
                &std::format!("51st {ty:?}"),
                r,
                Error::WriterOpenLimit,
                &before,
            );
        }
    }
    // the cap is checked before the collateral pull: an unaffordable PUT reads WriterOpenLimit,
    // not SAC #10 ...
    let r = t.c.try_create_offer(
        w,
        &t.rwa,
        &OptionType::Put,
        &QTY,
        &(USDX_START * 10),
        &PREMIUM,
        &EXPIRY,
    );
    rejected_as(&t, "unaffordable 51st", r, Error::WriterOpenLimit, &before);
    // ... and with only the root signed (no SAC sub-invocation) it is still WriterOpenLimit
    let root = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "create_offer",
        args: (w, &t.bond, OptionType::Call, QTY, STRIKE, PREMIUM, EXPIRY).into_val(env),
        sub_invokes: &[],
    };
    env.mock_auths(&[MockAuth {
        address: w,
        invoke: &root,
    }]);
    let r = t.c.try_create_offer(
        w,
        &t.bond,
        &OptionType::Call,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &EXPIRY,
    );
    rejected_as(&t, "root-only 51st", r, Error::WriterOpenLimit, &before);
    env.mock_all_auths();

    // earlier checks keep their precedence over the cap (ABI §3 order)
    let earlier: [(&str, Address, i128, u64, Error); 3] = [
        (
            "unlisted underlying",
            t.usdx.clone(),
            QTY,
            EXPIRY,
            Error::AssetNotAllowed,
        ),
        ("zero qty", t.rwa.clone(), 0, EXPIRY, Error::InvalidArgs),
        (
            "tenor too long",
            t.rwa.clone(),
            QTY,
            START + MAX_TENOR + 1,
            Error::TenorOutOfRange,
        ),
    ];
    for (label, u, q, exp, e) in earlier {
        let r =
            t.c.try_create_offer(w, &u, &OptionType::Call, &q, &STRIKE, &PREMIUM, &exp);
        rejected_as(&t, label, r, e, &before);
    }
    t.sac(&t.bond).set_authorized(w, &false);
    let frozen = t.snap();
    let r = t.c.try_create_offer(
        w,
        &t.bond,
        &OptionType::Put,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &EXPIRY,
    );
    rejected_as(&t, "writer frozen on BOND", r, Error::NotEligible, &frozen);
    t.sac(&t.bond).set_authorized(w, &true);

    // other writers are unaffected, on both assets, in the same ledger
    t.offer(m, &t.rwa, OptionType::Put);
    t.offer(m, &t.bond, OptionType::Call);
    let g = t.g_actor(
        [true; 3],
        true,
        [USDX_START, UNDERLYING_START, UNDERLYING_START],
    );
    t.offer(&g, &t.bond, OptionType::Put);
    assert_eq!(t.c.writer_open_count(m), 2);
    assert_eq!(t.c.writer_open_count(&g), 1);
    assert_eq!(t.c.writer_open_count(w), MAX_OPEN_PER_WRITER);
    for p in t.tracked() {
        t.assert_writer_count(&p);
    }
}

#[test]
fn writercap20_cannot_be_bypassed_by_buy_transfer_cancel_reclaim_or_prune_loops() {
    let t = setup();
    let env = &t.env;
    let (w, h, h2) = (&t.writer, &t.holder, &t.holder2);
    let ids: std::vec::Vec<u32> = (0..MAX_OPEN_PER_WRITER)
        .map(|_| t.offer_x(w, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY))
        .collect();
    let count = |t: &T| t.c.writer_open_count(w);
    let capped = |t: &T, label: &str| {
        let before = t.snap();
        let exp = t.env.ledger().timestamp() + 86_400;
        let r =
            t.c.try_create_offer(w, &t.bond, &OptionType::Call, &1, &1, &1, &exp);
        rejected_as(t, label, r, Error::WriterOpenLimit, &before);
        t.assert_writer_count(w);
    };
    capped(&t, "at the cap");

    // a sale frees exactly one slot (the option leaves the open list) ...
    t.c.buy(h, &ids[0]);
    assert_eq!(count(&t), MAX_OPEN_PER_WRITER - 1);
    // ... the Active option's transfers never touch the writer's count, and it cannot be handed
    // back to the writer or re-offered
    t.c.transfer(h, h2, &ids[0]);
    assert_eq!(count(&t), MAX_OPEN_PER_WRITER - 1);
    let before = t.snap();
    rejected_as(
        &t,
        "hand back",
        t.c.try_transfer(h2, w, &ids[0]),
        Error::SelfTrade,
        &before,
    );
    rejected_as(
        &t,
        "self-buy",
        t.c.try_buy(w, &ids[1]),
        Error::SelfTrade,
        &before,
    );
    rejected_as(
        &t,
        "cancel an Active option",
        t.c.try_cancel_offer(w, &ids[0]),
        Error::WrongState,
        &before,
    );
    t.offer_x(w, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY);
    capped(&t, "refilled after a sale");

    // cancel / re-create loops: a cancel frees one slot, a second cancel of the same id none
    for round in 0..5 {
        let open: std::vec::Vec<u32> = t.c.list_open().iter().collect();
        let victim = open[round];
        t.c.cancel_offer(w, &victim);
        assert_eq!(count(&t), MAX_OPEN_PER_WRITER - 1);
        let before = t.snap();
        rejected_as(
            &t,
            "second cancel",
            t.c.try_cancel_offer(w, &victim),
            Error::WrongState,
            &before,
        );
        assert_eq!(
            count(&t),
            MAX_OPEN_PER_WRITER - 1,
            "double cancel freed two slots"
        );
        t.offer_x(w, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY);
        capped(&t, "cancel/re-create loop");
    }

    // expiry alone frees nothing: expired offers are still Offered until reclaimed or pruned
    t.at(EXPIRY);
    capped(&t, "all offers expired, none pruned");
    // reclaiming the sold (Active) option frees nothing: it was never counted
    t.c.reclaim(w, &ids[0]);
    assert_eq!(count(&t), MAX_OPEN_PER_WRITER);
    // reclaiming an expired Offered offer frees one; a second reclaim frees nothing
    let open: std::vec::Vec<u32> = t.c.list_open().iter().collect();
    t.c.reclaim(w, &open[0]);
    assert_eq!(count(&t), MAX_OPEN_PER_WRITER - 1);
    let before = t.snap();
    rejected_as(
        &t,
        "second reclaim",
        t.c.try_reclaim(w, &open[0]),
        Error::WrongState,
        &before,
    );
    t.offer_x(w, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY + 10);
    capped(&t, "refilled after a reclaim");
    // a stranger's prune frees one slot per pruned offer; the same id twice frees one
    let stranger = Address::generate(env);
    assert_eq!(t.prune(&stranger, &vec![env, open[1], open[1]]), 1);
    assert_eq!(t.prune(&stranger, &vec![env, open[1]]), 0);
    assert_eq!(count(&t), MAX_OPEN_PER_WRITER - 1);
    t.offer_x(w, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY + 10);
    capped(&t, "refilled after a prune");
    for p in t.tracked() {
        t.assert_writer_count(&p);
    }
    assert_eq!(t.c.writer_open_count(h), 0);
    assert_eq!(t.c.writer_open_count(h2), 0);
}

// =============================================================================================
// 21. Tenor cap (v1.3)
// =============================================================================================

#[test]
fn tenor21_expiry_cap_is_inclusive_checked_early_and_overflow_free() {
    let t = setup();
    let env = &t.env;
    let (w, m) = (&t.writer, &t.maker2);
    let before = t.snap();
    for exp in [
        START + MAX_TENOR + 1,
        START + 2 * MAX_TENOR,
        u64::MAX / 2,
        u64::MAX - MAX_TENOR,
        u64::MAX - 1,
    ] {
        for ty in [OptionType::Put, OptionType::Call] {
            let r =
                t.c.try_create_offer(w, &t.rwa, &ty, &QTY, &STRIKE, &PREMIUM, &exp);
            rejected_as(
                &t,
                &std::format!("expiry {exp}"),
                r,
                Error::TenorOutOfRange,
                &before,
            );
        }
    }
    // u64::MAX: TenorOutOfRange (or InvalidArgs), never a panic or a stored offer
    for ty in [OptionType::Put, OptionType::Call] {
        let r =
            t.c.try_create_offer(w, &t.rwa, &ty, &QTY, &STRIKE, &PREMIUM, &u64::MAX);
        assert!(t.no_events());
        assert!(
            matches!(
                r,
                Err(Ok(Error::TenorOutOfRange)) | Err(Ok(Error::InvalidArgs))
            ),
            "expiry u64::MAX: {r:?}"
        );
        assert_eq!(t.snap(), before);
    }
    // checked right after InvalidArgs: before eligibility (an outsider reads TenorOutOfRange)
    // and after it (zero qty with a far expiry reads InvalidArgs)
    let far = START + MAX_TENOR + 1;
    let r = t.c.try_create_offer(
        &t.outsider,
        &t.rwa,
        &OptionType::Put,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &far,
    );
    rejected_as(
        &t,
        "ineligible writer, far expiry",
        r,
        Error::TenorOutOfRange,
        &before,
    );
    let r =
        t.c.try_create_offer(w, &t.rwa, &OptionType::Put, &0, &STRIKE, &PREMIUM, &far);
    rejected_as(&t, "zero qty, far expiry", r, Error::InvalidArgs, &before);
    // before any transfer: only the root signed
    let root = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "create_offer",
        args: (w, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM, far).into_val(env),
        sub_invokes: &[],
    };
    env.mock_auths(&[MockAuth {
        address: w,
        invoke: &root,
    }]);
    let r =
        t.c.try_create_offer(w, &t.rwa, &OptionType::Put, &QTY, &STRIKE, &PREMIUM, &far);
    rejected_as(
        &t,
        "root-only, far expiry",
        r,
        Error::TenorOutOfRange,
        &before,
    );
    env.mock_all_auths();

    // the boundary is inclusive: expiry == now + MAX_TENOR is accepted
    let id = t.offer_x(
        w,
        &t.rwa,
        OptionType::Put,
        QTY,
        STRIKE,
        PREMIUM,
        START + MAX_TENOR,
    );
    assert_eq!(t.c.get_option(&id).expiry, START + MAX_TENOR);
    t.at(START + 1);
    let r = t.c.try_create_offer(
        w,
        &t.rwa,
        &OptionType::Put,
        &QTY,
        &STRIKE,
        &PREMIUM,
        &(START + 2 + MAX_TENOR),
    );
    let b = t.snap();
    assert_err(r, Error::TenorOutOfRange);
    assert_eq!(t.snap(), b);

    // Clock near u64::MAX (test-only): `now + MAX_TENOR` overflows u64. Every expiry here is
    // within MAX_TENOR of now, so an offer may be created; the only unacceptable outcome is a
    // panic / host error, or a stored expiry other than the one requested.
    for now in [u64::MAX - MAX_TENOR, u64::MAX - MAX_TENOR + 1, u64::MAX - 2] {
        t.at(now);
        for exp in [now + 1, u64::MAX - 1, u64::MAX] {
            let r =
                t.c.try_create_offer(m, &t.rwa, &OptionType::Put, &1, &1, &1, &exp);
            match r {
                Ok(Ok(id)) => assert_eq!(t.c.get_option(&id).expiry, exp),
                Err(Ok(e)) => assert!(
                    matches!(
                        e,
                        Error::TenorOutOfRange | Error::InvalidArgs | Error::Overflow
                    ),
                    "now={now} expiry={exp}: {e:?}"
                ),
                other => panic!("now={now} expiry={exp}: host error / panic {other:?}"),
            }
        }
    }
}

// =============================================================================================
// 22. Backstop: the contract's own address as a party (v1.3)
// =============================================================================================

/// Rejection with any of `allowed` + no event + nothing changed (for orders the ABI leaves open).
#[track_caller]
fn rejected_any<R: Debug>(
    t: &T,
    label: &str,
    res: Result<R, Result<Error, InvokeError>>,
    allowed: &[Error],
    before: &Snap,
) {
    let quiet = t.no_events();
    match res {
        Err(Ok(e)) if allowed.contains(&e) => {}
        other => panic!("{label}: expected one of {allowed:?}, got {other:?}"),
    }
    assert!(quiet, "{label}: a failed call must not emit events");
    assert_eq!(&t.snap(), before, "{label}: state changed");
}

#[test]
fn backstop22_contract_address_rejected_as_any_party_even_with_mock_all_auths() {
    // Under `mock_all_auths` the host's recording mode lets `contract.require_auth()` pass, so
    // only the contract's own v1.3 check stands between a caller and, e.g., a self-funded offer
    // (a SAC transfer contract -> contract authorized by the invoker rule). Every rejection must
    // come before any transfer: no event, no balance or state change.
    let t = setup();
    let env = &t.env;
    let me = &t.contract;
    let offered = t.put(&t.writer);
    let active = t.call(&t.maker2);
    t.c.buy(&t.holder, &active);
    let exercised = t.put(&t.maker2);
    t.c.buy(&t.holder, &exercised);
    t.c.exercise(&t.holder, &exercised);
    env.mock_all_auths();
    let before = t.snap();
    assert!(t.bal(&t.usdx, me) > 0 && t.bal(&t.rwa, me) > 0);

    // ABI §3: InvalidArgs for writer (create_offer), buyer (buy), holder (exercise, transfer)
    // and `to` (transfer)
    for u in [&t.rwa, &t.bond] {
        for ty in [OptionType::Put, OptionType::Call] {
            let r =
                t.c.try_create_offer(me, u, &ty, &QTY, &STRIKE, &PREMIUM, &EXPIRY);
            rejected_as(
                &t,
                &std::format!("writer = contract, {ty:?}"),
                r,
                Error::InvalidArgs,
                &before,
            );
        }
    }
    // the backstop is the first check after auth in create_offer: nothing else is evaluated
    let r =
        t.c.try_create_offer(me, &t.usdx, &OptionType::Put, &0, &0, &0, &u64::MAX);
    rejected_as(
        &t,
        "writer = contract, garbage args",
        r,
        Error::InvalidArgs,
        &before,
    );
    rejected_as(
        &t,
        "buyer = contract",
        t.c.try_buy(me, &offered),
        Error::InvalidArgs,
        &before,
    );
    rejected_as(
        &t,
        "holder = contract (exercise)",
        t.c.try_exercise(me, &active),
        Error::InvalidArgs,
        &before,
    );
    rejected_as(
        &t,
        "holder = contract (transfer)",
        t.c.try_transfer(me, &t.holder2, &active),
        Error::InvalidArgs,
        &before,
    );
    rejected_as(
        &t,
        "to = contract",
        t.c.try_transfer(&t.holder, me, &active),
        Error::InvalidArgs,
        &before,
    );
    // writer-side calls: the contract can never be a writer, so NotWriter (or the backstop)
    let allowed = [Error::NotWriter, Error::InvalidArgs];
    let r = t.c.try_cancel_offer(me, &offered);
    rejected_any(&t, "cancel_offer by the contract", r, &allowed, &before);
    let r = t.c.try_reclaim(me, &offered);
    rejected_any(&t, "reclaim by the contract", r, &allowed, &before);
    let r = t.c.try_claim_delivery(me, &exercised);
    rejected_any(&t, "claim_delivery by the contract", r, &allowed, &before);
    // after expiry nothing changes either
    t.at(EXPIRY);
    let after = t.snap();
    let r = t.c.try_buy(me, &offered);
    rejected_as(
        &t,
        "buyer = contract, expired",
        r,
        Error::InvalidArgs,
        &after,
    );
    let r = t.c.try_reclaim(me, &active);
    rejected_any(&t, "reclaim by the contract, expired", r, &allowed, &after);
    let r = t.c.try_reclaim(me, &offered);
    rejected_any(
        &t,
        "reclaim of an Offered by the contract",
        r,
        &allowed,
        &after,
    );
    // the real parties still settle normally
    t.c.reclaim(&t.writer, &offered);
    t.c.reclaim(&t.maker2, &active);
    t.c.claim_delivery(&t.maker2, &exercised);
    for tok in t.tokens() {
        assert_eq!(t.c.open_collateral(&tok), 0);
        assert_eq!(t.bal(&tok, &t.contract), 0);
    }
}

// =============================================================================================
// 23. v1.3 events and views
// =============================================================================================

#[test]
fn events23_v13_calls_emit_one_event_per_effect_and_views_change_nothing() {
    let t = setup();
    let env = &t.env;
    let (w, m) = (&t.writer, &t.maker2);
    let (iss, iss_id) = t.issuer(REGULATED);
    let eqty = t.deploy_sac(&classic_asset(b"EQTY", &iss_id));
    // a listing: exactly one options event, `asset_listed`, whose topic is the SAC
    assert_eq!(t.c.list_asset(w, &t.s("EQTY"), &iss), eqty);
    assert_eq!(t.opt_event_names(), ["asset_listed"]);
    assert_eq!(t.listed_events(), [(eqty.clone(), 2)]);
    // failed listings emit nothing
    let before = t.snap();
    let failures: [(&str, &Address, Error); 4] = [
        ("EQTY", &iss, Error::AlreadyListed),
        ("EQ TY", &iss, Error::InvalidArgs),
        ("NOPE", &iss, Error::AssetNotDeployed),
        ("EQTY", &t.contract, Error::InvalidArgs),
    ];
    for (code, issuer, e) in failures {
        let r = t.c.try_list_asset(m, &t.s(code), issuer);
        rejected_as(&t, code, r, e, &before);
    }

    // a prune: one `offer_pruned` per pruned id, in list order, and nothing else from the options
    // contract; a prune that prunes nothing emits nothing at all (not even SAC events)
    let a = t.offer_x(w, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM, START + 10);
    let b = t.offer_x(
        m,
        &t.bond,
        OptionType::Call,
        QTY,
        STRIKE,
        PREMIUM,
        START + 10,
    );
    let c = t.offer_x(
        w,
        &t.rwa,
        OptionType::Call,
        QTY,
        STRIKE,
        PREMIUM,
        START + 10,
    );
    t.at(START + 10);
    let pruner = Address::generate(env);
    assert_eq!(t.prune(&pruner, &vec![env, c, a, b]), 3);
    assert_eq!(t.pruned_ids(), [c, a, b]);
    assert_eq!(t.opt_event_names(), ["offer_pruned"; 3]);
    // v1.3.1: the event names the authenticated pruner (v1.3 named the contract itself)
    assert_eq!(
        t.pruned_by(),
        [
            (c, pruner.clone()),
            (a, pruner.clone()),
            (b, pruner.clone())
        ]
    );
    assert_eq!(t.prune(&pruner, &vec![env, a, b, c]), 0);
    assert!(t.no_events());

    // views: no events and no state change
    let before = t.snap();
    assert!(t.c.is_listed(&eqty) && t.c.is_listed(&t.rwa) && t.c.is_listed(&t.bond));
    assert!(t.no_events());
    // the quote token and the contract itself are never underlyings; unknown addresses neither
    assert!(!t.c.is_listed(&t.usdx));
    assert!(!t.c.is_listed(&t.contract));
    assert!(!t.c.is_listed(&Address::generate(env)));
    assert_eq!(t.c.list_assets(&0, &10).len(), 3);
    assert!(t.no_events());
    assert_eq!(t.c.asset_count(), SEEDED + 1);
    assert_eq!(t.c.writer_open_count(w), 0);
    assert_eq!(t.c.writer_open_count(&t.contract), 0);
    assert!(t.no_events());
    assert_eq!(t.snap(), before);
    // `config()` keeps its constructor-time meaning (ABI §12)
    assert_eq!(
        t.c.config().underlyings,
        vec![env, t.rwa.clone(), t.bond.clone()]
    );
}

// =============================================================================================
// 24. v1.3.1: authenticated pruner, per-asset open books, list_open window
// =============================================================================================

#[test]
fn prune24_forged_pruner_signatures_are_rejected() {
    let t = setup();
    let env = &t.env;
    let (w, m) = (&t.writer, &t.maker2);
    let exp = START + 10;
    let a = t.offer_x(w, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM, exp);
    let b = t.offer_x(m, &t.bond, OptionType::Call, QTY, STRIKE, PREMIUM, exp);
    let c = t.offer_x(w, &t.rwa, OptionType::Call, QTY, STRIKE, PREMIUM, exp);
    t.at(exp); // all three are prunable
    let pruner = Address::generate(env);
    let mallory = Address::generate(env);
    let ab = vec![env, a, b];
    let abc = vec![env, a, b, c];
    let only_c = vec![env, c];
    let prune_tree = |who: &Address, ids: &Vec<u32>| MockAuthInvoke {
        contract: &t.contract,
        fn_name: "prune_expired",
        args: (who, ids.clone()).into_val(env),
        sub_invokes: &[],
    };
    let pruner_shaped = prune_tree(&pruner, &abc);
    let mallory_own = prune_tree(&mallory, &abc);
    let pruner_ab = prune_tree(&pruner, &ab);
    let pruner_for_mallory = prune_tree(&mallory, &abc);
    let pruner_other_fn = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "cancel_offer",
        args: (&pruner, a).into_val(env),
        sub_invokes: &[],
    };
    let pruner_other_contract = MockAuthInvoke {
        contract: &t.rwa,
        fn_name: "prune_expired",
        args: (&pruner, abc.clone()).into_val(env),
        sub_invokes: &[],
    };

    // A third party submits prune_expired(pruner, [a, b, c]) to have the pruner's identity in
    // the `offer_pruned` events: the host rejects every tree that is not the pruner's own
    // signature over exactly this call.
    let cases: std::vec::Vec<(&str, std::vec::Vec<MockAuth>)> = std::vec![
        ("no signature at all", std::vec![]),
        (
            "mallory signs a pruner-shaped tree",
            std::vec![MockAuth {
                address: &mallory,
                invoke: &pruner_shaped
            }]
        ),
        (
            "mallory's tree for her own prune",
            std::vec![MockAuth {
                address: &mallory,
                invoke: &mallory_own
            }]
        ),
        (
            "the pruner's [a, b] tree replayed for [a, b, c]",
            std::vec![MockAuth {
                address: &pruner,
                invoke: &pruner_ab
            }]
        ),
        (
            "the pruner's signature over a prune naming mallory",
            std::vec![MockAuth {
                address: &pruner,
                invoke: &pruner_for_mallory
            }]
        ),
        (
            "the pruner's tree for another function",
            std::vec![MockAuth {
                address: &pruner,
                invoke: &pruner_other_fn
            }]
        ),
        (
            "the pruner's tree for another contract",
            std::vec![MockAuth {
                address: &pruner,
                invoke: &pruner_other_contract
            }]
        ),
    ];
    assert_auth_cases(
        &t,
        "prune_expired",
        &(&pruner, abc.clone()).into_val(env),
        &cases,
    );

    // The writer's signatures do not cross over either: a signed prune of its own expired offer
    // authorizes neither cancel_offer nor reclaim of it, and a signed cancel_offer is not a prune.
    let w_prune_c = prune_tree(w, &only_c);
    let w_cancel_c = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "cancel_offer",
        args: (w, c).into_val(env),
        sub_invokes: &[],
    };
    let w_c: Vec<Val> = (w, c).into_val(env);
    let prune_as_writer = std::vec![(
        "the writer's prune tree for a cancel/reclaim",
        std::vec![MockAuth {
            address: w,
            invoke: &w_prune_c
        }]
    )];
    assert_auth_cases(&t, "cancel_offer", &w_c, &prune_as_writer);
    assert_auth_cases(&t, "reclaim", &w_c, &prune_as_writer);
    assert_auth_cases(
        &t,
        "prune_expired",
        &(w, only_c.clone()).into_val(env),
        &[(
            "the writer's cancel_offer tree for a prune",
            std::vec![MockAuth {
                address: w,
                invoke: &w_cancel_c,
            }],
        )],
    );
    env.mock_all_auths();
    assert_eq!(t.c.writer_open_count(w), 2);

    // the backstop applies to the pruner (ABI §13.1): even under mock_all_auths, where
    // `contract.require_auth()` passes, the contract cannot be named as the pruner
    let before = t.snap();
    let r = t.c.try_prune_expired(&t.contract, &abc);
    rejected_as(&t, "pruner = contract", r, Error::InvalidArgs, &before);

    // positive controls: the pruner's own [a, b] tree prunes exactly a and b and the events name
    // it; mallory may prune c under her own name (anyone may prune). Collateral only ever goes
    // back to the writers; the pruners receive nothing.
    let mut expect = t.snap();
    assert_eq!(t.prune(&pruner, &ab), 2);
    assert_eq!(t.pruned_by(), [(a, pruner.clone()), (b, pruner.clone())]);
    expect.set_state(a, State::Expired);
    expect.set_state(b, State::Expired);
    expect.add(w, 0, STRIKE);
    expect.add(m, 2, QTY);
    expect.add(&t.contract, 0, -STRIKE);
    expect.add(&t.contract, 2, -QTY);
    expect.open_collateral[0] -= STRIKE;
    expect.open_collateral[2] -= QTY;
    expect.add_open(w, -1);
    expect.add_open(m, -1);
    assert_eq!(t.snap(), expect);
    assert_eq!(t.prune(&mallory, &only_c), 1);
    assert_eq!(t.pruned_by(), [(c, mallory.clone())]);
    // a classic G account prunes too, and the event names it (signed here with
    // `mock_all_auths`, the way a keeper signs as the transaction source account)
    let late = t.offer_x(w, &t.rwa, OptionType::Put, QTY, STRIKE, PREMIUM, exp + 1);
    t.at(exp + 1);
    let g = t.g_account();
    assert_eq!(t.c.prune_expired(&g, &vec![env, late]), 1);
    assert_eq!(t.pruned_by(), [(late, g.clone())]);
    assert_eq!(
        t.bal_opt(&t.usdx, &g),
        None,
        "the G pruner holds no USDx trustline"
    );
    for p in [&pruner, &mallory] {
        for tok in t.tokens() {
            assert_eq!(t.bal(&tok, p), 0);
        }
    }
    assert_eq!(t.bal(&t.rwa, w), UNDERLYING_START);
    assert_eq!(t.c.writer_open_count(w), 0);
}

#[test]
fn books24_per_asset_cap_cannot_be_bypassed_by_alternating_assets() {
    let t = setup();
    let env = &t.env;
    use OptionType::{Call, Put};
    let (iss, iss_id) = t.issuer(0); // unflagged: every contract account is eligible
    let junk = t.deploy_sac(&classic_asset(b"JUNK", &iss_id));
    assert_eq!(t.c.list_asset(&t.maker2, &t.s("JUNK"), &iss), junk);
    // RWA's book filled by 10 issuer-authorized writers, each at its own writer cap
    let fillers: std::vec::Vec<Address> = (0..MAX_OPEN_PER_ASSET / MAX_OPEN_PER_WRITER)
        .map(|_| t.fresh_writer(false))
        .collect();
    for i in 0..MAX_OPEN_PER_ASSET {
        let ty = if i % 2 == 0 { Put } else { Call };
        t.offer_x(
            &fillers[(i / MAX_OPEN_PER_WRITER) as usize],
            &t.rwa,
            ty,
            1,
            1,
            1,
            EXPIRY,
        );
    }
    let rwa_book = t.open_book(&t.rwa);
    assert_eq!(rwa_book.len() as u32, MAX_OPEN_PER_ASSET);

    // A fresh writer cycles RWA -> BOND -> JUNK, alternating PUT and CALL. Every RWA attempt is
    // OpenListFull and changes nothing; BOND and JUNK list until the writer's cap, which counts
    // its offers on every asset together (50 in total, not 50 per asset).
    let x = t.fresh_writer(true);
    t.sac(&junk).mint(&x, &UNDERLYING_START);
    let assets = [t.rwa.clone(), t.bond.clone(), junk.clone()];
    let mut listed = [0u32; 3];
    let mut x_ids: [std::vec::Vec<u32>; 3] = Default::default();
    for round in 0..90u32 {
        let k = (round % 3) as usize;
        let ty = if round % 2 == 0 { Put } else { Call };
        let count = t.c.writer_open_count(&x);
        let x_bals = [t.bal(&t.usdx, &x), t.bal(&t.rwa, &x), t.bal(&t.bond, &x)];
        let r =
            t.c.try_create_offer(&x, &assets[k], &ty, &1, &1, &1, &EXPIRY);
        let quiet = t.no_events();
        let label = std::format!("round {round} on asset {k} {ty:?}");
        if k == 0 || count >= MAX_OPEN_PER_WRITER {
            let want = if k == 0 {
                Error::OpenListFull
            } else {
                Error::WriterOpenLimit
            };
            assert_eq!(r, Err(Ok(want)), "{label}");
            assert!(quiet, "{label}: a failed call emitted events");
            assert_eq!(t.c.writer_open_count(&x), count, "{label}");
            assert_eq!(
                [t.bal(&t.usdx, &x), t.bal(&t.rwa, &x), t.bal(&t.bond, &x)],
                x_bals,
                "{label}"
            );
        } else {
            let Ok(Ok(id)) = r else {
                panic!("{label}: {r:?}")
            };
            listed[k] += 1;
            x_ids[k].push(id);
        }
        assert_eq!(t.open_book(&t.rwa), rwa_book, "{label}: RWA book changed");
    }
    assert_eq!(listed, [0, 25, 25]);
    assert_eq!(t.c.writer_open_count(&x), MAX_OPEN_PER_WRITER);
    assert_eq!(t.open_book(&t.bond), x_ids[1]);
    assert_eq!(t.open_book(&junk), x_ids[2]);
    let before = t.snap();
    for (k, u) in assets.iter().enumerate() {
        for ty in [Put, Call] {
            let want = if k == 0 {
                Error::OpenListFull // the asset cap is checked first (ABI §3)
            } else {
                Error::WriterOpenLimit
            };
            let r = t.c.try_create_offer(&x, u, &ty, &1, &1, &1, &EXPIRY);
            rejected_as(
                &t,
                &std::format!("x capped, asset {k} {ty:?}"),
                r,
                want,
                &before,
            );
        }
    }

    // Books are independent: another writer still lists on BOND and JUNK, never on RWA.
    let m = &t.maker2;
    t.sac(&junk).mint(m, &UNDERLYING_START);
    t.offer_x(m, &t.bond, Call, 1, 1, 1, EXPIRY);
    t.offer_x(m, &junk, Call, 1, 1, 1, EXPIRY);
    let before = t.snap();
    let r = t.c.try_create_offer(m, &t.rwa, &Put, &1, &1, &1, &EXPIRY);
    rejected_as(&t, "maker2 on full RWA", r, Error::OpenListFull, &before);

    // A slot freed on one asset never opens another asset's book: x cancels a BOND offer (one
    // writer slot and one BOND slot free), RWA stays full for it, JUNK takes the writer slot.
    t.c.cancel_offer(&x, &x_ids[1][0]);
    let before = t.snap();
    let r = t.c.try_create_offer(&x, &t.rwa, &Call, &1, &1, &1, &EXPIRY);
    rejected_as(
        &t,
        "x after a BOND cancel, on RWA",
        r,
        Error::OpenListFull,
        &before,
    );
    t.offer_x(&x, &junk, Put, 1, 1, 1, EXPIRY);
    let before = t.snap();
    let r = t.c.try_create_offer(&x, &t.bond, &Put, &1, &1, &1, &EXPIRY);
    rejected_as(&t, "x back at its cap", r, Error::WriterOpenLimit, &before);

    // A slot freed on RWA: x (at its writer cap) cannot take it, a writer under its cap can,
    // and the book is full again afterwards.
    t.c.cancel_offer(&fillers[0], &rwa_book[0]);
    let before = t.snap();
    let r = t.c.try_create_offer(&x, &t.rwa, &Put, &1, &1, &1, &EXPIRY);
    rejected_as(&t, "x on RWA with room", r, Error::WriterOpenLimit, &before);
    t.offer_x(m, &t.rwa, Put, 1, 1, 1, EXPIRY);
    let before = t.snap();
    let r =
        t.c.try_create_offer(&fillers[0], &t.rwa, &Put, &1, &1, &1, &EXPIRY);
    rejected_as(&t, "RWA refilled", r, Error::OpenListFull, &before);

    // BOND fills to its own cap too: RWA and BOND hold MAX_OPEN_PER_ASSET each (the old global
    // cap of 1000 in total) and JUNK still accepts, so no global list remains to be filled.
    let mut bond_len = t.open_book(&t.bond).len() as u32;
    let mut w = t.fresh_writer(false);
    let mut w_open = 0;
    while bond_len < MAX_OPEN_PER_ASSET {
        if w_open == MAX_OPEN_PER_WRITER {
            w = t.fresh_writer(false);
            w_open = 0;
        }
        t.offer_x(&w, &t.bond, Put, 1, 1, 1, EXPIRY);
        w_open += 1;
        bond_len += 1;
    }
    let fresh = t.fresh_writer(true);
    t.sac(&junk).mint(&fresh, &UNDERLYING_START);
    let before = t.snap();
    assert_eq!(before.open_for[0].1.len() as u32, MAX_OPEN_PER_ASSET);
    assert_eq!(before.open_for[1].1.len() as u32, MAX_OPEN_PER_ASSET);
    for u in [&t.rwa, &t.bond] {
        let r = t.c.try_create_offer(&fresh, u, &Call, &1, &1, &1, &EXPIRY);
        rejected_as(
            &t,
            "fresh writer, full book",
            r,
            Error::OpenListFull,
            &before,
        );
    }
    let id = t.offer_x(&fresh, &junk, Call, 1, 1, 1, EXPIRY);
    let after = t.snap();
    let total: usize = after.open_for.iter().map(|(_, b)| b.len()).sum();
    assert_eq!(total as u32, 2 * MAX_OPEN_PER_ASSET + 28);
    assert_eq!(after.open_for[2].1.last(), Some(&id));
    for p in [&x, m, &fresh, &fillers[0]] {
        t.assert_writer_count(p);
    }
    let _ = env;
}

#[test]
fn books24_list_open_truncation_never_hides_the_first_registry_assets() {
    let t = setup();
    let env = &t.env;
    let lister = Address::generate(env);
    let mut junk = std::vec::Vec::new();
    for code in ["JUNK", "JUNKB"] {
        let (iss, iss_id) = t.issuer(0);
        let sac = t.deploy_sac(&classic_asset(code.as_bytes(), &iss_id));
        assert_eq!(t.c.list_asset(&lister, &t.s(code), &iss), sac);
        junk.push(sac);
    }
    assert_eq!(
        t.assets(),
        [
            t.rwa.clone(),
            t.bond.clone(),
            junk[0].clone(),
            junk[1].clone()
        ]
    );
    // the junk books are flooded first (lower ids than any honest offer), by sybil contract
    // accounts at their writer cap
    let flood = |asset: &Address, n: u32| -> std::vec::Vec<u32> {
        let mut ids = std::vec::Vec::new();
        for _ in 0..n / MAX_OPEN_PER_WRITER {
            let sybil = Address::generate(env);
            t.sac(asset).mint(&sybil, &(MAX_OPEN_PER_WRITER as i128));
            for _ in 0..MAX_OPEN_PER_WRITER {
                ids.push(t.c.create_offer(&sybil, asset, &OptionType::Call, &1, &1, &1, &EXPIRY));
            }
        }
        ids
    };
    let j1 = flood(&junk[0], 250);
    let j2 = flood(&junk[1], 100);
    // honest offers arrive later, BOND before RWA
    let b_ids = [
        t.offer(&t.writer, &t.bond, OptionType::Call),
        t.offer(&t.maker2, &t.bond, OptionType::Put),
    ];
    let r_ids = [t.put(&t.writer), t.call(&t.maker2)];

    // the window follows registry order, not age: RWA, then BOND, then the junk books
    let open: std::vec::Vec<u32> = t.c.list_open().iter().collect();
    let mut expect: std::vec::Vec<u32> = r_ids.iter().chain(b_ids.iter()).copied().collect();
    expect.extend(&j1[..LIST_OPEN_MAX as usize - 4]);
    assert_eq!(open, expect);
    // the tail is hidden from the window (all of JUNKB, part of JUNK) but each book is complete
    // through list_open_for
    assert!(j2.iter().all(|id| !open.contains(id)));
    assert_eq!(t.open_book(&junk[0]), j1);
    assert_eq!(t.open_book(&junk[1]), j2);
    assert_eq!(t.open_book(&t.rwa), r_ids);
    assert_eq!(t.open_book(&t.bond), b_ids);
    // list_open_for paging edges never panic and never reveal another asset's ids
    let page = |a: &Address, from: u32, limit: u32| -> std::vec::Vec<u32> {
        t.c.list_open_for(a, &from, &limit).iter().collect()
    };
    assert_eq!(page(&junk[0], 240, 50), &j1[240..]);
    assert_eq!(page(&junk[0], 0, 7), &j1[..7]);
    assert_eq!(
        page(&junk[0], 10, u32::MAX),
        &j1[10..10 + MAX_PAGE as usize]
    );
    for (from, limit) in [(250, 10), (0, 0), (u32::MAX, u32::MAX), (u32::MAX, 1)] {
        assert!(page(&junk[0], from, limit).is_empty(), "({from}, {limit})");
    }
    for unlisted in [&t.usdx, &t.contract, &Address::generate(env)] {
        assert!(page(unlisted, 0, MAX_PAGE).is_empty());
    }
    assert!(t.no_events());

    // sold and cancelled offers leave both the window and their book; nothing is reordered
    t.c.buy(&t.holder, &r_ids[0]);
    t.c.cancel_offer(&t.writer, &b_ids[0]);
    let open: std::vec::Vec<u32> = t.c.list_open().iter().collect();
    let mut expect = std::vec![r_ids[1], b_ids[1]];
    expect.extend(&j1[..LIST_OPEN_MAX as usize - 2]);
    assert_eq!(open, expect);
    t.snap();

    // Only RWA's own writers (all issuer-authorized) can crowd the window from the front: once
    // RWA holds more than LIST_OPEN_MAX open offers, the window is RWA's oldest ids and BOND is
    // visible through list_open_for only. list_open() is a convenience window, not a complete view.
    let mut rwa_ids = std::vec![r_ids[1]];
    for _ in 0..5 {
        let w = t.fresh_writer(false);
        for _ in 0..MAX_OPEN_PER_WRITER {
            rwa_ids.push(t.offer_x(&w, &t.rwa, OptionType::Put, 1, 1, 1, EXPIRY));
        }
    }
    let open: std::vec::Vec<u32> = t.c.list_open().iter().collect();
    assert_eq!(open, &rwa_ids[..LIST_OPEN_MAX as usize]);
    assert_eq!(t.open_book(&t.bond), [b_ids[1]]);
    t.snap();
}

/// `list_open()` must stay within the per-transaction limits however many assets are listed
/// (listing is permissionless and permanent: no delisting). A literal reading of ABI §3 (the
/// books concatenated in registry order, truncated to 200 ids) reads two entries per registry
/// asset (`AssetAt(i)`, `OpenFor(asset)`) while the books in front hold fewer than 200 ids: with
/// such an implementation the 200th registry asset was the first to push the view past the
/// 400-entry footprint (measured), so ~200 junk listings would break it for good.
/// ABI §3/§13.3 (v1.3.1) bound the view to the first `MAX_PAGE` registry assets, which keeps it
/// within the limits; an offer on a later asset is visible through `list_open_for` only, and this
/// test checks both.
#[test]
fn books24_list_open_stays_within_limits_whatever_the_registry_size() {
    let t = setup();
    let env = &t.env;
    env.cost_estimate().budget().reset_unlimited();
    let id = t.put(&t.writer);
    let lister = Address::generate(env);
    env.cost_estimate().disable_resource_limits();
    let mut first_over = None;
    let mut last = None;
    for i in 0..250u32 {
        let code = std::format!("S{i}");
        let (iss, iss_id) = t.issuer(0);
        t.deploy_sac(&classic_asset(code.as_bytes(), &iss_id));
        last = Some(t.c.list_asset(&lister, &t.s(&code), &iss));
        assert_eq!(t.c.list_open(), vec![env, id]);
        let over = t.exceeded_ledger();
        if first_over.is_none() && !over.is_empty() {
            first_over = Some((SEEDED + i + 1, over));
        }
    }
    std::println!("books24 list_open: first registry size over the limits: {first_over:?}");
    assert_eq!(
        first_over, None,
        "list_open() exceeds the per-transaction limits once the registry holds this many assets"
    );
    // an offer on the last listed asset (registry index 251): in its own book, outside the
    // list_open() window, which still holds only RWA's offer and stays within the limits
    let last = last.unwrap();
    let w = Address::generate(env);
    t.sac(&last).mint(&w, &1);
    let tail =
        t.c.create_offer(&w, &last, &OptionType::Call, &1, &1, &1, &EXPIRY);
    assert_eq!(t.open_book(&last), [tail]);
    let open = t.c.list_open();
    assert!(t.exceeded_ledger().is_empty(), "{:?}", t.exceeded_ledger());
    assert_eq!(open, vec![env, id]);
}

// =============================================================================================
// 25. v1.4 secondary market: list_for_sale / cancel_sale / buy_resale
// =============================================================================================

const ASK: i128 = 30_000_000; // 3 USDx

/// A PUT on RWA written by `writer`, bought by `holder` (Active), with `holder`'s ask posted.
fn listed_put(t: &T) -> u32 {
    let id = t.put(&t.writer);
    t.c.buy(&t.holder, &id);
    t.c.list_for_sale(&t.holder, &id, &ASK);
    id
}

/// Auth tree of `buy_resale(buyer, id, ASK)`: the root plus the buyer's quote payment to the seller.
fn resale_tree<'a>(
    t: &'a T,
    buyer: &Address,
    id: u32,
    pay: &'a [MockAuthInvoke<'a>],
) -> MockAuthInvoke<'a> {
    MockAuthInvoke {
        contract: &t.contract,
        fn_name: "buy_resale",
        args: (buyer, id, ASK).into_val(&t.env),
        sub_invokes: pay,
    }
}

/// list_for_sale / cancel_sale / buy_resale signed by anyone but the named party are rejected by
/// the host's auth check, with no event and no state change; a signed tree for another id or
/// another function does not replay.
#[test]
fn resale25_unauthorized_list_cancel_and_buy_are_auth_failures() {
    let t = setup();
    let env = &t.env;
    let (h, m) = (&t.holder, &t.maker2);
    let id = listed_put(&t);
    let other = t.put(&t.writer);
    t.c.buy(h, &other);

    // list_for_sale(holder, id, ask)
    let list = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "list_for_sale",
        args: (h, id, ASK).into_val(env),
        sub_invokes: &[],
    };
    let list_other = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "list_for_sale",
        args: (h, other, ASK).into_val(env),
        sub_invokes: &[],
    };
    let list_cheaper = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "list_for_sale",
        args: (h, id, ASK / 2).into_val(env),
        sub_invokes: &[],
    };
    assert_auth_cases(
        &t,
        "list_for_sale",
        &(h, id, ASK * 2).into_val(env),
        &[
            (
                "writer signs",
                std::vec![MockAuth {
                    address: &t.writer,
                    invoke: &list
                }],
            ),
            (
                "maker2 signs",
                std::vec![MockAuth {
                    address: m,
                    invoke: &list
                }],
            ),
            (
                "holder's tree for another id",
                std::vec![MockAuth {
                    address: h,
                    invoke: &list_other
                }],
            ),
            (
                "holder's tree for another price",
                std::vec![MockAuth {
                    address: h,
                    invoke: &list_cheaper
                }],
            ),
            ("nobody signs", std::vec![]),
        ],
    );

    // cancel_sale(holder, id)
    let cancel = MockAuthInvoke {
        contract: &t.contract,
        fn_name: "cancel_sale",
        args: (h, id).into_val(env),
        sub_invokes: &[],
    };
    assert_auth_cases(
        &t,
        "cancel_sale",
        &(h, id).into_val(env),
        &[
            (
                "writer signs",
                std::vec![MockAuth {
                    address: &t.writer,
                    invoke: &cancel
                }],
            ),
            (
                "maker2 signs",
                std::vec![MockAuth {
                    address: m,
                    invoke: &cancel
                }],
            ),
            (
                "holder's list tree replayed",
                std::vec![MockAuth {
                    address: h,
                    invoke: &list
                }],
            ),
            ("nobody signs", std::vec![]),
        ],
    );

    // buy_resale(buyer, id): only the buyer can spend the buyer's quote
    let pay = [transfer(&t, &t.usdx, (m, h, ASK).into_val(env))];
    let buy = resale_tree(&t, m, id, &pay);
    let buy_other = resale_tree(&t, m, other, &[]);
    assert_auth_cases(
        &t,
        "buy_resale",
        &(m, id, ASK).into_val(env),
        &[
            (
                "seller signs the buyer's tree",
                std::vec![MockAuth {
                    address: h,
                    invoke: &buy
                }],
            ),
            (
                "writer signs the buyer's tree",
                std::vec![MockAuth {
                    address: &t.writer,
                    invoke: &buy
                }],
            ),
            (
                "buyer's tree for another id",
                std::vec![MockAuth {
                    address: m,
                    invoke: &buy_other
                }],
            ),
            (
                "buyer's tree with a different cap",
                std::vec![MockAuth {
                    address: m,
                    invoke: &MockAuthInvoke {
                        contract: &t.contract,
                        fn_name: "buy_resale",
                        args: (m, id, ASK + 1).into_val(env),
                        sub_invokes: &pay,
                    }
                }],
            ),
            (
                "buyer signs the root without the payment",
                std::vec![MockAuth {
                    address: m,
                    invoke: &resale_tree(&t, m, id, &[])
                }],
            ),
            ("nobody signs", std::vec![]),
        ],
    );

    // the correctly signed tree works and moves exactly the ask
    env.mock_auths(&[MockAuth {
        address: m,
        invoke: &buy,
    }]);
    let mut want = t.snap();
    t.c.buy_resale(m, &id, &ASK);
    env.mock_all_auths();
    want.add(m, 0, -ASK);
    want.add(h, 0, ASK);
    want.options.iter_mut().find(|o| o.id == id).unwrap().holder = Some(m.clone());
    want.asks.retain(|a| a.0 != id);
    assert_eq!(t.snap(), want);
}

/// list_for_sale rejects every misuse with its typed error, in the ABI §14 check order.
#[test]
fn resale25_list_for_sale_rejections() {
    let t = setup();
    let (w, h, m) = (&t.writer, &t.holder, &t.maker2);
    let offered = t.put(w);
    let active = t.put(w);
    t.c.buy(h, &active);
    let exercised = t.call(m);
    t.c.buy(h, &exercised);
    t.c.exercise(h, &exercised);
    let before = t.snap();

    rejected(
        &t,
        t.c.try_list_for_sale(h, &99, &ASK),
        Error::NotFound,
        &before,
    );
    // Offered: WrongState comes before ownership (there is no holder yet)
    rejected(
        &t,
        t.c.try_list_for_sale(h, &offered, &ASK),
        Error::WrongState,
        &before,
    );
    rejected(
        &t,
        t.c.try_list_for_sale(w, &offered, &ASK),
        Error::WrongState,
        &before,
    );
    rejected(
        &t,
        t.c.try_list_for_sale(h, &exercised, &ASK),
        Error::WrongState,
        &before,
    );
    // not the holder: the writer, another party
    rejected(
        &t,
        t.c.try_list_for_sale(w, &active, &ASK),
        Error::NotHolder,
        &before,
    );
    rejected(
        &t,
        t.c.try_list_for_sale(m, &active, &ASK),
        Error::NotHolder,
        &before,
    );
    // amounts
    for bad in [0, -1, i128::MIN] {
        rejected(
            &t,
            t.c.try_list_for_sale(h, &active, &bad),
            Error::InvalidArgs,
            &before,
        );
    }
    // the contract is never a party
    rejected(
        &t,
        t.c.try_list_for_sale(&t.contract, &active, &ASK),
        Error::InvalidArgs,
        &before,
    );
    // expiry is exclusive: at `expiry` the option can no longer be listed
    t.at(EXPIRY);
    let expired = t.snap();
    rejected(
        &t,
        t.c.try_list_for_sale(h, &active, &ASK),
        Error::Expired,
        &expired,
    );
    // amount check comes after the time check
    rejected(
        &t,
        t.c.try_list_for_sale(h, &active, &0),
        Error::Expired,
        &expired,
    );
    t.at(EXPIRY - 1);
    t.c.list_for_sale(h, &active, &i128::MAX);
    assert_eq!(t.c.get_ask(&active), Some(i128::MAX));
}

/// cancel_sale: unknown id, non-holder, no ask.
#[test]
fn resale25_cancel_sale_rejections() {
    let t = setup();
    let (w, h, m) = (&t.writer, &t.holder, &t.maker2);
    let id = listed_put(&t);
    let bare = t.put(w);
    t.c.buy(h, &bare);
    let before = t.snap();
    rejected(&t, t.c.try_cancel_sale(h, &99), Error::NotFound, &before);
    rejected(&t, t.c.try_cancel_sale(w, &id), Error::NotHolder, &before);
    rejected(&t, t.c.try_cancel_sale(m, &id), Error::NotHolder, &before);
    rejected(&t, t.c.try_cancel_sale(h, &bare), Error::NoAsk, &before);
    t.c.cancel_sale(h, &id);
    t.assert_one_event("ask_cancelled", id);
    let after = t.snap();
    rejected(&t, t.c.try_cancel_sale(h, &id), Error::NoAsk, &after);
}

/// buy_resale: no ask, expired, self-trade (holder and writer), ineligible buyer, escrow no
/// longer authorized, and the contract as buyer.
#[test]
fn resale25_buy_resale_rejections() {
    let t = setup();
    let (w, h, m) = (&t.writer, &t.holder, &t.maker2);
    let id = listed_put(&t);
    let bare = t.put(w);
    t.c.buy(h, &bare);
    let before = t.snap();
    rejected(&t, t.c.try_buy_resale(m, &99, &ASK), Error::NoAsk, &before);
    rejected(
        &t,
        t.c.try_buy_resale(m, &bare, &ASK),
        Error::NoAsk,
        &before,
    );
    rejected(
        &t,
        t.c.try_buy_resale(h, &id, &ASK),
        Error::SelfTrade,
        &before,
    );
    // writer buy-back is out of scope for v1.4
    rejected(
        &t,
        t.c.try_buy_resale(w, &id, &ASK),
        Error::SelfTrade,
        &before,
    );
    rejected(
        &t,
        t.c.try_buy_resale(&t.outsider, &id, &ASK),
        Error::NotEligible,
        &before,
    );
    rejected(
        &t,
        t.c.try_buy_resale(&t.contract, &id, &ASK),
        Error::InvalidArgs,
        &before,
    );

    // the issuer de-authorizes the escrow on RWA: no new holder can take the position
    t.sac(&t.rwa).set_authorized(&t.contract, &false);
    let deauth = t.snap();
    rejected(
        &t,
        t.c.try_buy_resale(m, &id, &ASK),
        Error::ContractNotAuthorized,
        &deauth,
    );
    t.sac(&t.rwa).set_authorized(&t.contract, &true);

    // expiry is exclusive and comes before self-trade and eligibility
    t.at(EXPIRY);
    let expired = t.snap();
    for buyer in [m, h, w, &t.outsider] {
        rejected(
            &t,
            t.c.try_buy_resale(buyer, &id, &ASK),
            Error::Expired,
            &expired,
        );
    }
    t.at(EXPIRY - 1);
    t.c.buy_resale(m, &id, &ASK);
    t.assert_one_event("resale_bought", id);
}

/// A pooled deficit (issuer clawback from the escrow) blocks resale exactly like `transfer`.
#[test]
fn resale25_buy_resale_blocked_by_collateral_shortfall() {
    let t = setup();
    let (h, m) = (&t.holder, &t.maker2);
    let id = listed_put(&t);
    let call = t.call(m);
    t.c.buy(h, &call);
    t.c.list_for_sale(h, &call, &ASK);
    // the RWA issuer claws back one unit of the CALL collateral from the escrow
    t.sac(&t.rwa).clawback(&t.contract, &1);
    let before = t.snap();
    for x in [id, call] {
        rejected(
            &t,
            t.c.try_buy_resale(&t.holder2, &x, &ASK),
            Error::CollateralShortfall,
            &before,
        );
    }
    // the issuer repairs the escrow: resale works again
    t.sac(&t.rwa).mint(&t.contract, &1);
    t.c.buy_resale(&t.holder2, &id, &ASK);
    assert_eq!(t.c.get_option(&id).holder, Some(t.holder2.clone()));
}

/// The second taker of the same ask gets `NoAsk`; nothing moves.
#[test]
fn resale25_double_buy_resale_second_is_no_ask() {
    let t = setup();
    let id = listed_put(&t);
    t.c.buy_resale(&t.maker2, &id, &ASK);
    let before = t.snap();
    rejected(
        &t,
        t.c.try_buy_resale(&t.holder2, &id, &ASK),
        Error::NoAsk,
        &before,
    );
    rejected(
        &t,
        t.c.try_buy_resale(&t.maker2, &id, &ASK),
        Error::NoAsk,
        &before,
    );
    // the old holder cannot act on the option any more
    rejected(
        &t,
        t.c.try_list_for_sale(&t.holder, &id, &ASK),
        Error::NotHolder,
        &before,
    );
    rejected(
        &t,
        t.c.try_cancel_sale(&t.holder, &id),
        Error::NotHolder,
        &before,
    );
    rejected(
        &t,
        t.c.try_exercise(&t.holder, &id),
        Error::NotHolder,
        &before,
    );
}

/// A buyer who cannot pay the ask fails inside the quote SAC; holder, ask and balances are
/// unchanged.
#[test]
fn resale25_buyer_without_quote_fails_in_the_sac_atomically() {
    let t = setup();
    let id = listed_put(&t);
    // authorized on RWA, but no USDx at all
    let poor = Address::generate(&t.env);
    t.sac(&t.rwa).set_authorized(&poor, &true);
    t.extra.borrow_mut().push(poor.clone());
    let before = t.snap();
    sac_rejected(
        &t,
        t.c.try_buy_resale(&poor, &id, &ASK),
        SAC_BALANCE,
        &before,
    );
    // some USDx, but less than the ask
    t.sac(&t.usdx).mint(&poor, &(ASK - 1));
    let before = t.snap();
    sac_rejected(
        &t,
        t.c.try_buy_resale(&poor, &id, &ASK),
        SAC_BALANCE,
        &before,
    );
    assert_eq!(t.c.get_ask(&id), Some(ASK));
    assert_eq!(t.c.get_option(&id).holder, Some(t.holder.clone()));
}

/// Terminal and hand-over transitions clear the ask; it never survives them.
#[test]
fn resale25_ask_never_survives_exercise_transfer_or_reclaim() {
    let t = setup();
    let (w, h, m) = (&t.writer, &t.holder, &t.maker2);
    let a = listed_put(&t);
    let b = listed_put(&t);
    let c = listed_put(&t);
    t.c.exercise(h, &a);
    t.c.transfer(h, m, &b);
    t.at(EXPIRY);
    t.c.reclaim(w, &c);
    let after = t.snap();
    assert!(after.asks.is_empty(), "{:?}", after.asks);
    for id in [a, b, c] {
        assert_eq!(t.c.get_ask(&id), None);
    }
    t.at(EXPIRY - 1);
    let s = t.snap();
    rejected(
        &t,
        t.c.try_buy_resale(&t.holder2, &b, &ASK),
        Error::NoAsk,
        &s,
    );
    rejected(&t, t.c.try_list_for_sale(h, &b, &ASK), Error::NotHolder, &s);
    rejected(
        &t,
        t.c.try_list_for_sale(h, &a, &ASK),
        Error::WrongState,
        &s,
    );
}

/// v1.4 price cap: the seller raises the ask after the buyer read it; the buyer's capped call
/// fails with `PriceMoved` after every other check, moves nothing and emits nothing. A cap equal
/// to the ask succeeds and moves exactly the ask.
#[test]
fn resale25_price_moved_when_ask_raised_and_cap_equal_to_ask_succeeds() {
    let t = setup();
    let (h, m) = (&t.holder, &t.maker2);
    let id = listed_put(&t);
    // an RWA CALL so that the escrow holds RWA the issuer can claw back below
    t.call(&t.writer);
    let seen = t.c.get_ask(&id).unwrap();
    t.c.list_for_sale(h, &id, &(seen * 2));
    let before = t.snap();
    rejected(
        &t,
        t.c.try_buy_resale(m, &id, &seen),
        Error::PriceMoved,
        &before,
    );
    rejected(
        &t,
        t.c.try_buy_resale(m, &id, &0),
        Error::PriceMoved,
        &before,
    );
    rejected(
        &t,
        t.c.try_buy_resale(m, &id, &-1),
        Error::PriceMoved,
        &before,
    );
    // every earlier check keeps its precedence over PriceMoved
    rejected(
        &t,
        t.c.try_buy_resale(h, &id, &0),
        Error::SelfTrade,
        &before,
    );
    rejected(
        &t,
        t.c.try_buy_resale(&t.outsider, &id, &0),
        Error::NotEligible,
        &before,
    );
    rejected(&t, t.c.try_buy_resale(m, &99, &0), Error::NoAsk, &before);
    t.sac(&t.rwa).clawback(&t.contract, &1);
    let short = t.snap();
    rejected(
        &t,
        t.c.try_buy_resale(m, &id, &0),
        Error::CollateralShortfall,
        &short,
    );
    t.sac(&t.rwa).mint(&t.contract, &1);
    t.at(EXPIRY);
    let expired = t.snap();
    rejected(&t, t.c.try_buy_resale(m, &id, &0), Error::Expired, &expired);
    t.at(EXPIRY - 1);
    // max_total == ask_total succeeds
    let mut want = t.snap();
    t.c.buy_resale(m, &id, &(seen * 2));
    t.assert_one_event("resale_bought", id);
    want.add(m, 0, -(seen * 2));
    want.add(h, 0, seen * 2);
    want.options.iter_mut().find(|o| o.id == id).unwrap().holder = Some(m.clone());
    want.asks.retain(|a| a.0 != id);
    assert_eq!(t.snap(), want);
}

/// v1.4 edge semantics after expiry: `buy_resale` on an expired, unreclaimed option is `Expired`
/// (not `NoAsk`); the holder may still `cancel_sale` (holder + ask only, no time check).
#[test]
fn resale25_after_expiry_buy_is_expired_and_cancel_still_works() {
    let t = setup();
    let (h, m) = (&t.holder, &t.maker2);
    let id = listed_put(&t);
    t.at(EXPIRY);
    let before = t.snap();
    rejected(
        &t,
        t.c.try_buy_resale(m, &id, &ASK),
        Error::Expired,
        &before,
    );
    t.c.cancel_sale(h, &id);
    t.assert_one_event("ask_cancelled", id);
    let after = t.snap();
    assert!(after.asks.is_empty());
    rejected(&t, t.c.try_buy_resale(m, &id, &ASK), Error::NoAsk, &after);
}

/// A seller with no trustline for the quote token cannot be paid: `buy_resale` fails inside the
/// quote SAC (#13) and reverts atomically (holder, ask, balances and events unchanged). The G
/// seller got the option through `transfer` (no tokens move), so it never needed a USDx trustline.
#[test]
fn resale25_seller_without_quote_trustline_reverts_atomically() {
    let t = setup();
    let (h, m) = (&t.holder, &t.maker2);
    let id = t.put(&t.writer);
    t.c.buy(h, &id);
    // G account: authorized RWA trustline, no USDx trustline
    let g = t.g_actor([false, true, false], true, [0, 0, 0]);
    t.c.transfer(h, &g, &id);
    t.c.list_for_sale(&g, &id, &ASK);
    let before = t.snap();
    sac_rejected(
        &t,
        t.c.try_buy_resale(m, &id, &ASK),
        SAC_NO_TRUSTLINE,
        &before,
    );
    assert_eq!(t.c.get_ask(&id), Some(ASK));
    assert_eq!(t.c.get_option(&id).holder, Some(g.clone()));
    // once the seller adds the trustline, the same purchase settles
    t.sac(&t.usdx).trust(&g);
    t.c.buy_resale(m, &id, &ASK);
    assert_eq!(t.bal(&t.usdx, &g), ASK);
    assert_eq!(t.c.get_option(&id).holder, Some(m.clone()));
}
