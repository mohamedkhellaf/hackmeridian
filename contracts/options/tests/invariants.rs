//! Property-based invariant tests for the `options` contract (ABI: `docs/contract-abi.md`, v1.2:
//! error codes 101–115, `CollateralShortfall`, contract re-authorization check in `buy` (ABI §10),
//! holder `transfer` and paged `get_options` (ABI §11)). See "Coverage limits" below for the two
//! v1.1 checks the random model cannot reach.
//!
//! A random sequence of operations (offers, buys, exercises, holder transfers, cancellations,
//! reclaims, delivery claims, time warps, issuer freeze/unfreeze of accounts and of the contract
//! address, and clawback from the contract on RWA) is applied through the `try_` client methods;
//! failures are allowed and expected. After every successful `transfer` the previous holder's
//! `exercise` is run as a probe and must fail with `NotHolder` (model and chain). After EVERY
//! operation the on-chain state is read back and checked against:
//!
//! * an executable reference model of the ABI (`Model`) that predicts the outcome of each call
//!   (Ok / options `Error` by name / SAC error) from the check order in ABI §3 and the SAC
//!   semantics of soroban-env-host, and the exact state afterwards;
//! * the invariants in `World::check_state` and `check_transition`:
//!   1. `open_collateral(T)` equals the sum of the ABI §2 derived reserves of every option;
//!   2. SAC `balance(contract, T) == open_collateral(T)`, except RWA where the deficit equals the
//!      total clawed back from the contract (the deficit only ever changes through clawback);
//!   3. per-token conservation: actors + contract == total minted (minus clawback);
//!   4. lifecycle: only ABI §4 edges, terminal states frozen, holder rules (set by `buy`, changed
//!      only by a successful `transfer` of that `Active` option), immutable terms;
//!   5. `list_open()` == ids in `Offered`, creation order; `option_count()` == successful creates;
//!   6. a successful `exercise` moves the holder's pay-leg and receive-leg by exactly the ABI
//!      amounts (and every balance delta of every call equals the ABI transfers; `transfer` moves
//!      no tokens);
//!   7. `get_options` pages of 7 (each exactly `min(7, count - from)` long), concatenated, equal
//!      `get_option(i)` for every `i < option_count()`, and `get_options(option_count(), 7)` is
//!      empty;
//!
//!   plus atomicity: a failed call changes nothing observable.
//!
//! Any violation panics with the full, readable operation history (after proptest shrinking).
//!
//! Coverage limits (the model implements every check; these paths are out of reach of the random
//! operations and are covered elsewhere):
//!
//! * Writer quote eligibility (`create_offer` -> `NotEligible` for a writer that may not hold USDx,
//!   ABI §10.3): every actor is a contract address (soroban-sdk 28 `Address::generate`), which is
//!   always authorized on USDx unless the issuer revokes it, and the random operations never touch
//!   USDx authorization. The fixture gives USDx `AUTH_REVOCABLE` (no `AUTH_REQUIRED`, so balances
//!   start authorized) so the deterministic regression
//!   `writer_deauthorized_on_quote_cannot_create_offer` can revoke a writer; `src/test.rs`
//!   `create_offer_rejects_writer_deauthorized_on_quote` covers it too.
//! * `OpenListFull` (ABI §10.2) is unreachable here: a case has at most 40 operations and
//!   `MAX_OPEN` is 1000. Covered by `src/test.rs` `open_list_cap_returns_open_list_full`.
//! * Settlement of existing positions under a pooled RWA deficit (ABI §6, §10.5: unaffected while
//!   the pool covers them, SAC #10 once it is drained) needs large clawbacks that random runs
//!   rarely produce; the regression `clawback_deficit_falls_on_the_last_rwa_settlement` pins
//!   `exercise`, `claim_delivery`, `reclaim` and `cancel_offer` under a deficit.
//!
//! Running: `cargo test -p options --test invariants` (default 200 cases, under a minute).
//! `PROPTEST_CASES=<n>` changes the number of cases. `PROPTEST_RNG_SEED=<u64>` fixes the RNG so a
//! run, and any failure it finds, is reproducible; without it every run draws a fresh seed (no
//! regression files are written). `INVARIANTS_TRACE=1 ... -- --nocapture` prints every passing
//! sequence.

// Token/holder indices address several parallel tables (balances, names, reserves) at once.
#![allow(clippy::needless_range_loop)]

use options::{Error, OptionData, OptionType, OptionsContract, OptionsContractClient, State};
use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, EnvTestConfig, IssuerFlags, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    xdr::ScErrorType,
    Address, Env, InvokeError,
};
use std::fmt::{self, Debug, Write as _};

// ---------------------------------------------------------------------------------------------
// Fixed universe
// ---------------------------------------------------------------------------------------------

const T0: u64 = 1_000_000;
const UNIT: i128 = 10_000_000; // 7 decimals
const FUND: i128 = 4_000_000_000; // initial balance per actor and token (400 tokens)

const USDX: usize = 0;
const RWA: usize = 1;
const BOND: usize = 2;
const N_TOKENS: usize = 3;
const TOKEN_NAMES: [&str; N_TOKENS] = ["USDx", "RWA", "BOND"];

const WRITER1: usize = 0;
const WRITER2: usize = 1;
const HOLDER1: usize = 2;
const HOLDER2: usize = 3;
const OUTSIDER: usize = 4; // never authorized on RWA/BOND
const CONTRACT: usize = 5;
const N_ACTORS: usize = 5;
const N_HOLDERS: usize = 6; // actors + contract
const NAMES: [&str; N_HOLDERS] = [
    "writer1", "writer2", "holder1", "holder2", "outsider", "contract",
];

/// Accounts the RWA issuer may freeze/unfreeze in the random model (outsider excluded: unfreezing
/// it would authorize it, which contradicts its role). The contract address has its own operation
/// (`Op::ContractAuth`).
const FREEZE_TARGETS: [usize; 4] = [WRITER1, WRITER2, HOLDER1, HOLDER2];

/// ABI §10 `MAX_OPEN`: `create_offer` fails with `OpenListFull` at this many `Offered` ids.
/// Mirrored in the model but unreachable with at most 40 operations per case (see the header).
const MAX_OPEN: usize = 1000;

/// SAC `ContractError` codes (soroban-env-host `builtin_contracts/contract_error.rs`).
const SAC_BALANCE: u32 = 10; // BalanceError: insufficient balance
const SAC_DEAUTHORIZED: u32 = 11; // BalanceDeauthorizedError: frozen / not authorized

type Balances = [[i128; N_HOLDERS]; N_TOKENS];

// ---------------------------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------------------------

/// A concrete operation (ids and actors resolved), as shown in the history.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Act {
    Create {
        writer: usize,
        underlying: usize,
        ty: OptionType,
        qty: i128,
        strike: i128,
        premium: i128,
        expiry: u64,
    },
    Buy {
        id: u32,
        who: usize,
    },
    Exercise {
        id: u32,
        who: usize,
    },
    /// v1.2 `transfer(from, to, id)`.
    Transfer {
        id: u32,
        from: usize,
        to: usize,
    },
    Cancel {
        id: u32,
        who: usize,
    },
    Reclaim {
        id: u32,
        who: usize,
    },
    Claim {
        id: u32,
        who: usize,
    },
    SetTime {
        t: u64,
    },
    SetAuthRwa {
        target: usize,
        authorized: bool,
    },
    /// USDx issuer `set_authorized(target, bool)`; used by deterministic regressions only (the
    /// fixture gives USDx `AUTH_REVOCABLE` for this).
    SetAuthUsdx {
        target: usize,
        authorized: bool,
    },
    ClawbackRwa {
        amount: i128,
    },
}

impl fmt::Display for Act {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            Act::Create {
                writer,
                underlying,
                ty,
                qty,
                strike,
                premium,
                expiry,
            } => write!(
                f,
                "create_offer({}, {}, {:?}, qty={}, strike_total={}, premium_total={}, expiry={})",
                NAMES[writer], TOKEN_NAMES[underlying], ty, qty, strike, premium, expiry
            ),
            Act::Buy { id, who } => write!(f, "buy({}, id={})", NAMES[who], id),
            Act::Exercise { id, who } => write!(f, "exercise({}, id={})", NAMES[who], id),
            Act::Transfer { id, from, to } => {
                write!(f, "transfer({}, to={}, id={})", NAMES[from], NAMES[to], id)
            }
            Act::Cancel { id, who } => write!(f, "cancel_offer({}, id={})", NAMES[who], id),
            Act::Reclaim { id, who } => write!(f, "reclaim({}, id={})", NAMES[who], id),
            Act::Claim { id, who } => write!(f, "claim_delivery({}, id={})", NAMES[who], id),
            Act::SetTime { t } => write!(f, "advance_time(to {t})"),
            Act::SetAuthRwa {
                target: CONTRACT,
                authorized,
            } => {
                let verb = if authorized {
                    "reauthorize"
                } else {
                    "deauthorize"
                };
                write!(f, "issuer_{verb}_contract(RWA)")
            }
            Act::SetAuthRwa {
                target,
                authorized: false,
            } => write!(f, "issuer_freeze(RWA, {})", NAMES[target]),
            Act::SetAuthRwa {
                target,
                authorized: true,
            } => write!(f, "issuer_unfreeze(RWA, {})", NAMES[target]),
            Act::SetAuthUsdx { target, authorized } => {
                let verb = if authorized { "unfreeze" } else { "freeze" };
                write!(f, "issuer_{verb}(USDx, {})", NAMES[target])
            }
            Act::ClawbackRwa { amount } => {
                write!(f, "issuer_clawback(RWA, from contract, {amount})")
            }
        }
    }
}

/// Actor selector for id-based operations, resolved against the current state so that a useful
/// fraction of random calls come from the option's own writer/holder.
#[derive(Clone, Copy, Debug)]
enum Who {
    Actor(usize),
    Writer,
    Holder,
}

/// Recipient selector for `transfer`: a fixed actor, or (resolved against the model) an actor that
/// can receive the option (neither its holder nor its writer, authorized on its underlying), so
/// that a useful fraction of random transfers succeed.
#[derive(Clone, Copy, Debug)]
enum To {
    Actor(usize),
    Eligible,
}

/// `u8` id selector value that resolves to the first unknown id (`option_count`).
const UNKNOWN_ID: u8 = u8::MAX;

/// A generated operation. A `u8` id selector resolves to `sel % option_count` (an existing id),
/// or to `option_count` (unknown id) for `UNKNOWN_ID` or when no option exists yet.
#[derive(Clone, Copy, Debug)]
enum Op {
    Create {
        writer: usize,
        underlying: usize,
        ty: OptionType,
        qty: i128,
        strike: i128,
        premium: i128,
        expiry_in: u64,
    },
    Buy(u8, Who),
    Exercise(u8, Who),
    /// id selector, caller (`from`), recipient (`to`).
    Transfer(u8, Who, To),
    Cancel(u8, Who),
    Reclaim(u8, Who),
    Claim(u8, Who),
    Advance(u64),
    WarpToExpiry(u8, i8),
    Freeze(usize),
    Unfreeze(usize),
    /// RWA issuer `set_authorized(contract, bool)` (ABI §6 "contract de-authorized").
    ContractAuth(bool),
    Clawback(i128),
}

// ---------------------------------------------------------------------------------------------
// Reference model of the ABI
// ---------------------------------------------------------------------------------------------

/// Option as seen by the tests: addresses mapped to indices.
#[derive(Clone, Debug, PartialEq, Eq)]
struct Opt {
    id: u32,
    underlying: usize,
    ty: OptionType,
    qty: i128,
    strike: i128,
    premium: i128,
    expiry: u64,
    writer: usize,
    holder: Option<usize>,
    state: State,
}

impl fmt::Display for Opt {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "#{} {:?} {} qty={} strike_total={} premium_total={} expiry={} writer={} holder={} state={:?}",
            self.id,
            self.ty,
            TOKEN_NAMES[self.underlying],
            self.qty,
            self.strike,
            self.premium,
            self.expiry,
            NAMES[self.writer],
            self.holder.map(|h| NAMES[h]).unwrap_or("-"),
            self.state
        )
    }
}

/// ABI §2: what the writer locks at `create_offer` (= what the holder receives at `exercise`).
fn collateral(o: &Opt) -> (usize, i128) {
    match o.ty {
        OptionType::Put => (USDX, o.strike),
        OptionType::Call => (o.underlying, o.qty),
    }
}

/// ABI §2: what the holder pays at `exercise` (= what the writer receives at `claim_delivery`).
fn proceeds(o: &Opt) -> (usize, i128) {
    match o.ty {
        OptionType::Put => (o.underlying, o.qty),
        OptionType::Call => (USDX, o.strike),
    }
}

/// ABI §2 derived values + §3 `open_collateral`: units of `token` the contract must hold for `o`.
/// Offered/Active: PUT -> strike_total quote, CALL -> qty underlying. Exercised: PUT -> qty
/// underlying, CALL -> strike_total quote. Settled/Expired/Cancelled: 0.
fn expected_reserved(o: &Opt, token: usize) -> i128 {
    let (t, a) = match o.state {
        State::Offered | State::Active => collateral(o),
        State::Exercised => proceeds(o),
        State::Settled | State::Expired | State::Cancelled => return 0,
    };
    if t == token {
        a
    } else {
        0
    }
}

fn is_terminal(s: State) -> bool {
    matches!(s, State::Settled | State::Expired | State::Cancelled)
}

/// ABI §4: the only lifecycle edges.
fn allowed_edge(from: State, to: State) -> bool {
    matches!(
        (from, to),
        (State::Offered, State::Active)
            | (State::Offered, State::Cancelled)
            | (State::Offered, State::Expired)
            | (State::Active, State::Expired)
            | (State::Active, State::Exercised)
            | (State::Exercised, State::Settled)
    )
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Expect {
    Ok,
    Contract(Error),
    Sac(u32),
}

/// (token, from, to, amount): one SAC `transfer`.
type Transfer = (usize, usize, usize, i128);

#[derive(Clone, Debug)]
struct Model {
    now: u64,
    bal: Balances,
    minted: [i128; N_TOKENS],
    /// SAC `authorized(who)`. USDx is `AUTH_REVOCABLE` only: its row starts all `true` and changes
    /// only through `Act::SetAuthUsdx` (deterministic regressions).
    auth: [[bool; N_HOLDERS]; N_TOKENS],
    clawed_rwa: i128,
    opts: Vec<Opt>,
    creates_ok: u32,
}

impl Model {
    fn opt(&self, id: u32) -> Option<&Opt> {
        self.opts.get(id as usize)
    }

    /// Model of `open_collateral(token)`: the ABI-derived reserves of every option.
    fn reserved(&self, token: usize) -> i128 {
        self.opts.iter().map(|o| expected_reserved(o, token)).sum()
    }

    /// ABI §3 `CollateralShortfall`: `balance(contract) < open_collateral(token)` for the quote or
    /// the underlying of the option.
    fn shortfall(&self, underlying: usize) -> bool {
        [USDX, underlying]
            .iter()
            .any(|&t| self.bal[t][CONTRACT] < self.reserved(t))
    }

    /// Contract-level checks in the fixed ABI §3 order, then the SAC transfers the call performs.
    fn plan(&self, act: &Act) -> Result<Vec<Transfer>, Error> {
        let now = self.now;
        match *act {
            Act::Create {
                writer,
                underlying,
                ty,
                qty,
                strike,
                premium,
                expiry,
            } => {
                // Allowlist = [RWA, BOND]; the quote token is never an allowed underlying.
                if underlying == USDX {
                    return Err(Error::AssetNotAllowed);
                }
                if qty <= 0 || strike <= 0 || premium <= 0 || expiry <= now {
                    return Err(Error::InvalidArgs);
                }
                // Writer eligible on the underlying, then on the quote (USDx has no AUTH_REQUIRED,
                // so the second check fails only after the issuer revoked the writer on USDx).
                if !self.auth[underlying][writer] || !self.auth[USDX][writer] {
                    return Err(Error::NotEligible);
                }
                if !self.auth[underlying][CONTRACT] {
                    return Err(Error::ContractNotAuthorized);
                }
                let open = self
                    .opts
                    .iter()
                    .filter(|o| o.state == State::Offered)
                    .count();
                if open >= MAX_OPEN {
                    return Err(Error::OpenListFull);
                }
                if self.shortfall(underlying) {
                    return Err(Error::CollateralShortfall);
                }
                Ok(match ty {
                    OptionType::Put => vec![(USDX, writer, CONTRACT, strike)],
                    OptionType::Call => vec![(underlying, writer, CONTRACT, qty)],
                })
            }
            Act::Buy { id, who } => {
                let o = self.opt(id).ok_or(Error::NotFound)?;
                if o.state != State::Offered {
                    return Err(Error::WrongState);
                }
                if now >= o.expiry {
                    return Err(Error::Expired);
                }
                if who == o.writer {
                    return Err(Error::SelfTrade);
                }
                if !self.auth[o.underlying][who] {
                    return Err(Error::NotEligible);
                }
                // v1.1: the issuer may have de-authorized the contract since the offer was created.
                if !self.auth[o.underlying][CONTRACT] {
                    return Err(Error::ContractNotAuthorized);
                }
                if self.shortfall(o.underlying) {
                    return Err(Error::CollateralShortfall);
                }
                // PROVISIONAL premium policy: buyer -> writer inside `buy`.
                Ok(vec![(USDX, who, o.writer, o.premium)])
            }
            Act::Exercise { id, who } => {
                let o = self.opt(id).ok_or(Error::NotFound)?;
                if o.holder != Some(who) {
                    return Err(Error::NotHolder);
                }
                if o.state != State::Active {
                    return Err(Error::WrongState);
                }
                if now >= o.expiry {
                    return Err(Error::Expired);
                }
                let (pt, pa) = proceeds(o);
                let (ct, ca) = collateral(o);
                Ok(vec![(pt, who, CONTRACT, pa), (ct, CONTRACT, who, ca)])
            }
            // v1.2 ABI §3 `transfer`: NotFound -> NotHolder -> WrongState -> Expired ->
            // InvalidArgs (to == holder) -> SelfTrade (to == writer) -> NotEligible (to on the
            // underlying). No token moves.
            Act::Transfer { id, from, to } => {
                let o = self.opt(id).ok_or(Error::NotFound)?;
                if o.holder != Some(from) {
                    return Err(Error::NotHolder);
                }
                if o.state != State::Active {
                    return Err(Error::WrongState);
                }
                if now >= o.expiry {
                    return Err(Error::Expired);
                }
                if to == from {
                    return Err(Error::InvalidArgs);
                }
                if to == o.writer {
                    return Err(Error::SelfTrade);
                }
                if !self.auth[o.underlying][to] {
                    return Err(Error::NotEligible);
                }
                Ok(vec![])
            }
            Act::Cancel { id, who } => {
                let o = self.opt(id).ok_or(Error::NotFound)?;
                if o.writer != who {
                    return Err(Error::NotWriter);
                }
                if o.state != State::Offered {
                    return Err(Error::WrongState);
                }
                let (ct, ca) = collateral(o);
                Ok(vec![(ct, CONTRACT, who, ca)])
            }
            Act::Reclaim { id, who } => {
                let o = self.opt(id).ok_or(Error::NotFound)?;
                if o.writer != who {
                    return Err(Error::NotWriter);
                }
                if !matches!(o.state, State::Offered | State::Active) {
                    return Err(Error::WrongState);
                }
                if now < o.expiry {
                    return Err(Error::NotExpired);
                }
                let (ct, ca) = collateral(o);
                Ok(vec![(ct, CONTRACT, who, ca)])
            }
            Act::Claim { id, who } => {
                let o = self.opt(id).ok_or(Error::NotFound)?;
                if o.writer != who {
                    return Err(Error::NotWriter);
                }
                if o.state != State::Exercised {
                    return Err(Error::WrongState);
                }
                let (pt, pa) = proceeds(o);
                Ok(vec![(pt, CONTRACT, who, pa)])
            }
            Act::SetTime { .. }
            | Act::SetAuthRwa { .. }
            | Act::SetAuthUsdx { .. }
            | Act::ClawbackRwa { .. } => Ok(vec![]),
        }
    }

    /// SAC transfer semantics (soroban-env-host `balance.rs`): `spend_balance(from)` checks the
    /// authorization of `from`, then its balance; `receive_balance(to)` checks the authorization
    /// of `to`. Returns the balances after all transfers or the first SAC error code.
    fn simulate(&self, transfers: &[Transfer]) -> Result<Balances, u32> {
        let mut bal = self.bal;
        for &(t, from, to, amount) in transfers {
            if !self.auth[t][from] {
                return Err(SAC_DEAUTHORIZED);
            }
            if bal[t][from] < amount {
                return Err(SAC_BALANCE);
            }
            bal[t][from] -= amount;
            if !self.auth[t][to] {
                return Err(SAC_DEAUTHORIZED);
            }
            bal[t][to] += amount;
        }
        Ok(bal)
    }

    fn predict(&self, act: &Act) -> Expect {
        match *act {
            Act::SetTime { .. } | Act::SetAuthRwa { .. } | Act::SetAuthUsdx { .. } => Expect::Ok,
            // Clawback skips the authorization check; the contract's RWA balance entry was created
            // with the clawback flag (issuer had AUTH_CLAWBACK_ENABLED before authorizing it).
            Act::ClawbackRwa { amount } => {
                if self.bal[RWA][CONTRACT] < amount {
                    Expect::Sac(SAC_BALANCE)
                } else {
                    Expect::Ok
                }
            }
            _ => match self.plan(act) {
                Err(e) => Expect::Contract(e),
                Ok(transfers) => match self.simulate(&transfers) {
                    Err(code) => Expect::Sac(code),
                    Ok(_) => Expect::Ok,
                },
            },
        }
    }

    /// Applies an act that succeeded on chain.
    fn apply(&mut self, act: &Act) {
        let transfers = self
            .plan(act)
            .expect("apply: plan must succeed for a successful act");
        self.bal = self
            .simulate(&transfers)
            .expect("apply: transfers must succeed");
        match *act {
            Act::Create {
                writer,
                underlying,
                ty,
                qty,
                strike,
                premium,
                expiry,
            } => {
                self.opts.push(Opt {
                    id: self.opts.len() as u32,
                    underlying,
                    ty,
                    qty,
                    strike,
                    premium,
                    expiry,
                    writer,
                    holder: None,
                    state: State::Offered,
                });
                self.creates_ok += 1;
            }
            Act::Buy { id, who } => {
                let o = &mut self.opts[id as usize];
                o.holder = Some(who);
                o.state = State::Active;
            }
            Act::Exercise { id, .. } => self.opts[id as usize].state = State::Exercised,
            // Only the holder changes; the state stays Active.
            Act::Transfer { id, to, .. } => self.opts[id as usize].holder = Some(to),
            Act::Cancel { id, .. } => self.opts[id as usize].state = State::Cancelled,
            Act::Reclaim { id, .. } => self.opts[id as usize].state = State::Expired,
            Act::Claim { id, .. } => self.opts[id as usize].state = State::Settled,
            Act::SetTime { t } => self.now = t,
            Act::SetAuthRwa { target, authorized } => self.auth[RWA][target] = authorized,
            Act::SetAuthUsdx { target, authorized } => self.auth[USDX][target] = authorized,
            Act::ClawbackRwa { amount } => {
                self.bal[RWA][CONTRACT] -= amount;
                self.minted[RWA] -= amount;
                self.clawed_rwa += amount;
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Observed on-chain state
// ---------------------------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq)]
struct Snap {
    now: u64,
    bal: Balances,
    open_collateral: [i128; N_TOKENS],
    opts: Vec<Opt>,
    open: Vec<u32>,
    count: u32,
}

/// Classified result of a `try_` call. `Typed` = `Err(Ok(code))`, `Raw` = `Err(Err(Contract(code)))`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Outcome {
    Ok,
    Typed(u32),
    Raw(u32),
    Abort,
    Conversion,
}

impl fmt::Display for Outcome {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            Outcome::Ok => write!(f, "Ok"),
            Outcome::Typed(c) => write!(f, "Err(Ok(#{c}))"),
            Outcome::Raw(c) => write!(f, "Err(Err(Contract(#{c})))"),
            Outcome::Abort => write!(f, "Err(Err(Abort))"),
            Outcome::Conversion => write!(f, "Ok(Err(conversion))"),
        }
    }
}

trait ErrCode: Debug {
    fn code(&self) -> Option<u32>;
}

impl ErrCode for Error {
    fn code(&self) -> Option<u32> {
        Some(*self as u32)
    }
}

impl ErrCode for soroban_sdk::Error {
    fn code(&self) -> Option<u32> {
        self.is_type(ScErrorType::Contract).then(|| self.get_code())
    }
}

fn classify<T, C: Debug, E: ErrCode>(
    r: Result<Result<T, C>, Result<E, InvokeError>>,
) -> (Outcome, String) {
    match r {
        Ok(Ok(_)) => (Outcome::Ok, String::new()),
        Ok(Err(c)) => (Outcome::Conversion, format!(" {c:?}")),
        Err(Ok(e)) => match e.code() {
            Some(code) => (Outcome::Typed(code), format!(" {e:?}")),
            None => (Outcome::Abort, format!(" {e:?}")),
        },
        Err(Err(InvokeError::Contract(code))) => (Outcome::Raw(code), String::new()),
        Err(Err(InvokeError::Abort)) => (Outcome::Abort, String::new()),
    }
}

fn outcome_matches(expect: Expect, outcome: Outcome, direct_sac: bool) -> bool {
    match (expect, outcome) {
        (Expect::Ok, Outcome::Ok) => true,
        (Expect::Contract(e), Outcome::Typed(c)) => e as u32 == c,
        // A SAC error inside a cross-contract call propagates with its own contract error code.
        // Since v1.1 (codes 101+) no options `Error` has a SAC code, so the typed options client
        // must report it as `Err(Err(Contract(code)))`, never as an options error.
        (Expect::Sac(s), Outcome::Raw(c)) => !direct_sac && s == c,
        // Direct SAC client calls (issuer actions) decode any contract code as `soroban_sdk::Error`.
        (Expect::Sac(s), Outcome::Typed(c)) => direct_sac && s == c,
        _ => false,
    }
}

// ---------------------------------------------------------------------------------------------
// World: environment + model + invariant checks
// ---------------------------------------------------------------------------------------------

struct World {
    env: Env,
    client: OptionsContractClient<'static>,
    tokens: [Address; N_TOKENS],
    holders: [Address; N_HOLDERS],
    model: Model,
    snap: Snap,
    history: Vec<String>,
}

impl World {
    fn new() -> World {
        // No JSON test snapshots: hundreds of proptest cases would each write one.
        let env = Env::new_with_config(EnvTestConfig {
            capture_snapshot_at_drop: false,
        });
        env.mock_all_auths();
        env.ledger().set_timestamp(T0);

        // USDx: quote, AUTH_REVOCABLE only (no AUTH_REQUIRED, so every balance starts authorized;
        // the issuer can revoke a writer in the quote-eligibility regression).
        // RWA, BOND: AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED.
        let usdx = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let rwa = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let bond = env.register_stellar_asset_contract_v2(Address::generate(&env));
        usdx.issuer().set_flag(IssuerFlags::RevocableFlag);
        for sac in [&rwa, &bond] {
            let issuer = sac.issuer();
            issuer.set_flag(IssuerFlags::RequiredFlag);
            issuer.set_flag(IssuerFlags::RevocableFlag);
            issuer.set_flag(IssuerFlags::ClawbackEnabledFlag);
        }
        let tokens = [usdx.address(), rwa.address(), bond.address()];

        let contract = env.register(
            OptionsContract,
            (
                tokens[USDX].clone(),
                soroban_sdk::vec![&env, tokens[RWA].clone(), tokens[BOND].clone()],
            ),
        );
        let client = OptionsContractClient::new(&env, &contract);

        let actors: [Address; N_ACTORS] = std::array::from_fn(|_| Address::generate(&env));
        let holders: [Address; N_HOLDERS] = std::array::from_fn(|i| {
            if i == CONTRACT {
                contract.clone()
            } else {
                actors[i].clone()
            }
        });

        let mut auth = [[true; N_HOLDERS]; N_TOKENS];
        let mut bal = [[0i128; N_HOLDERS]; N_TOKENS];
        let mut minted = [0i128; N_TOKENS];
        for t in [RWA, BOND] {
            let admin = StellarAssetClient::new(&env, &tokens[t]);
            for h in [WRITER1, WRITER2, HOLDER1, HOLDER2, CONTRACT] {
                admin.set_authorized(&holders[h], &true);
            }
            auth[t][OUTSIDER] = false;
            for a in [WRITER1, WRITER2, HOLDER1, HOLDER2] {
                admin.mint(&holders[a], &FUND);
                bal[t][a] = FUND;
                minted[t] += FUND;
            }
        }
        let usdx_admin = StellarAssetClient::new(&env, &tokens[USDX]);
        for (a, holder) in holders.iter().enumerate().take(N_ACTORS) {
            usdx_admin.mint(holder, &FUND);
            bal[USDX][a] = FUND;
            minted[USDX] += FUND;
        }

        let model = Model {
            now: T0,
            bal,
            minted,
            auth,
            clawed_rwa: 0,
            opts: Vec::new(),
            creates_ok: 0,
        };
        let mut w = World {
            env,
            client,
            tokens,
            holders,
            model,
            snap: Snap {
                now: 0,
                bal: [[0; N_HOLDERS]; N_TOKENS],
                open_collateral: [0; N_TOKENS],
                opts: Vec::new(),
                open: Vec::new(),
                count: 0,
            },
            history: Vec::new(),
        };
        let snap = w.observe().unwrap_or_else(|e| w.fail(e));
        if let Err(e) = w.check_state(&snap) {
            w.fail(format!("initial state: {e}"));
        }
        w.snap = snap;
        w
    }

    // ----- driving -----

    fn resolve(&self, op: &Op) -> Act {
        let m = &self.model;
        let n = m.opts.len() as u32;
        // Selector < 128: an option in one of the `useful` states if any (keeps deep paths such
        // as buy -> exercise -> claim frequent); otherwise any existing id; UNKNOWN_ID: unknown id.
        let pick = |sel: u8, useful: &[State]| -> u32 {
            if sel == UNKNOWN_ID || n == 0 {
                return n;
            }
            if sel < 128 {
                let ids: Vec<u32> = m
                    .opts
                    .iter()
                    .filter(|o| useful.contains(&o.state))
                    .map(|o| o.id)
                    .collect();
                if !ids.is_empty() {
                    return ids[sel as usize % ids.len()];
                }
            }
            sel as u32 % n
        };
        let who_of = |id: u32, who: Who| match who {
            Who::Actor(a) => a,
            Who::Writer => m.opt(id).map(|o| o.writer).unwrap_or(WRITER1),
            Who::Holder => m.opt(id).and_then(|o| o.holder).unwrap_or(HOLDER1),
        };
        match *op {
            Op::Create {
                writer,
                underlying,
                ty,
                qty,
                strike,
                premium,
                expiry_in,
            } => Act::Create {
                writer,
                underlying,
                ty,
                qty,
                strike,
                premium,
                expiry: m.now + expiry_in,
            },
            Op::Buy(s, w) => {
                let id = pick(s, &[State::Offered]);
                Act::Buy {
                    id,
                    who: who_of(id, w),
                }
            }
            Op::Exercise(s, w) => {
                let id = pick(s, &[State::Active]);
                Act::Exercise {
                    id,
                    who: who_of(id, w),
                }
            }
            Op::Transfer(s, w, to) => {
                let id = pick(s, &[State::Active]);
                let to = match to {
                    To::Actor(a) => a,
                    To::Eligible => m
                        .opt(id)
                        .and_then(|o| {
                            [HOLDER1, HOLDER2, WRITER1, WRITER2].into_iter().find(|&a| {
                                Some(a) != o.holder && a != o.writer && m.auth[o.underlying][a]
                            })
                        })
                        .unwrap_or(HOLDER2),
                };
                Act::Transfer {
                    id,
                    from: who_of(id, w),
                    to,
                }
            }
            Op::Cancel(s, w) => {
                let id = pick(s, &[State::Offered]);
                Act::Cancel {
                    id,
                    who: who_of(id, w),
                }
            }
            Op::Reclaim(s, w) => {
                let id = pick(s, &[State::Offered, State::Active]);
                Act::Reclaim {
                    id,
                    who: who_of(id, w),
                }
            }
            Op::Claim(s, w) => {
                let id = pick(s, &[State::Exercised]);
                Act::Claim {
                    id,
                    who: who_of(id, w),
                }
            }
            Op::Advance(secs) => Act::SetTime { t: m.now + secs },
            // Land exactly on expiry-1 / expiry / expiry+1 of an option (time never goes back).
            Op::WarpToExpiry(s, d) => {
                let t = m
                    .opt(pick(s, &[State::Offered, State::Active]))
                    .map(|o| (o.expiry as i128 + d as i128) as u64)
                    .filter(|&t| t > m.now)
                    .unwrap_or(m.now);
                Act::SetTime { t }
            }
            Op::Freeze(i) => Act::SetAuthRwa {
                target: FREEZE_TARGETS[i],
                authorized: false,
            },
            Op::Unfreeze(i) => Act::SetAuthRwa {
                target: FREEZE_TARGETS[i],
                authorized: true,
            },
            Op::ContractAuth(authorized) => Act::SetAuthRwa {
                target: CONTRACT,
                authorized,
            },
            Op::Clawback(amount) => Act::ClawbackRwa { amount },
        }
    }

    fn step(&mut self, op: &Op) -> Outcome {
        let act = self.resolve(op);
        self.run(act)
    }

    /// Executes one act, checks the oracle and every invariant, returns the observed outcome.
    fn run(&mut self, act: Act) -> Outcome {
        let before = self.snap.clone();
        let expect = self.model.predict(&act);
        let planned = if expect == Expect::Ok {
            self.model.plan(&act).unwrap_or_default()
        } else {
            Vec::new()
        };
        let (outcome, detail) = self.execute(&act);
        self.history.push(format!(
            "{:>3}. [now={}] {} -> {}{} (model: {:?})",
            self.history.len() + 1,
            before.now,
            act,
            outcome,
            detail,
            expect
        ));
        let direct_sac = matches!(
            act,
            Act::SetAuthRwa { .. } | Act::SetAuthUsdx { .. } | Act::ClawbackRwa { .. }
        );
        if !outcome_matches(expect, outcome, direct_sac) {
            self.fail(format!(
                "ORACLE MISMATCH on `{act}`: the ABI reference model predicted {expect:?}, the \
                 contract returned {outcome}{detail}"
            ));
        }
        if outcome == Outcome::Ok {
            self.model.apply(&act);
        }
        let after = self.observe().unwrap_or_else(|e| self.fail(e));
        if let Err(e) = self.check_state(&after) {
            self.fail(e);
        }
        if let Err(e) = check_transition(&before, &after, &act, outcome, &planned) {
            self.fail(e);
        }
        self.snap = after;

        // After a holder transfer the previous holder is out: the model must predict `NotHolder`
        // for its exercise, and the chain must agree (the probe runs through the full oracle,
        // atomicity and invariant checks like any other step).
        if let (Outcome::Ok, Act::Transfer { id, from, .. }) = (outcome, act) {
            let probe = Act::Exercise { id, who: from };
            let predicted = self.model.predict(&probe);
            if predicted != Expect::Contract(Error::NotHolder) {
                self.fail(format!(
                    "TRANSFER: after `{act}` the model predicts {predicted:?} for `{probe}`, \
                     expected NotHolder"
                ));
            }
            let probed = self.run(probe);
            if probed != Outcome::Typed(Error::NotHolder as u32) {
                self.fail(format!(
                    "TRANSFER: after `{act}` the previous holder's `{probe}` returned {probed}, \
                     expected NotHolder"
                ));
            }
        }
        outcome
    }

    fn rwa_admin(&self) -> StellarAssetClient<'static> {
        StellarAssetClient::new(&self.env, &self.tokens[RWA])
    }

    fn execute(&self, act: &Act) -> (Outcome, String) {
        let c = &self.client;
        let h = &self.holders;
        match *act {
            Act::Create {
                writer,
                underlying,
                ty,
                qty,
                strike,
                premium,
                expiry,
            } => classify(c.try_create_offer(
                &h[writer],
                &self.tokens[underlying],
                &ty,
                &qty,
                &strike,
                &premium,
                &expiry,
            )),
            Act::Buy { id, who } => classify(c.try_buy(&h[who], &id)),
            Act::Exercise { id, who } => classify(c.try_exercise(&h[who], &id)),
            Act::Transfer { id, from, to } => classify(c.try_transfer(&h[from], &h[to], &id)),
            Act::Cancel { id, who } => classify(c.try_cancel_offer(&h[who], &id)),
            Act::Reclaim { id, who } => classify(c.try_reclaim(&h[who], &id)),
            Act::Claim { id, who } => classify(c.try_claim_delivery(&h[who], &id)),
            Act::SetTime { t } => {
                self.env.ledger().set_timestamp(t);
                (Outcome::Ok, String::new())
            }
            Act::SetAuthRwa { target, authorized } => {
                classify(self.rwa_admin().try_set_authorized(&h[target], &authorized))
            }
            Act::SetAuthUsdx { target, authorized } => classify(
                StellarAssetClient::new(&self.env, &self.tokens[USDX])
                    .try_set_authorized(&h[target], &authorized),
            ),
            Act::ClawbackRwa { amount } => {
                classify(self.rwa_admin().try_clawback(&h[CONTRACT], &amount))
            }
        }
    }

    // ----- observation -----

    fn to_opt(&self, d: &OptionData) -> Result<Opt, String> {
        let holder_idx = |a: &Address| self.holders.iter().position(|h| h == a);
        let token_idx = |a: &Address| self.tokens.iter().position(|t| t == a);
        if d.quote != self.tokens[USDX] {
            return Err(format!("option {}: quote is not USDx", d.id));
        }
        let underlying = token_idx(&d.underlying)
            .filter(|&t| t != USDX)
            .ok_or_else(|| format!("option {}: unknown underlying", d.id))?;
        let writer = holder_idx(&d.writer)
            .filter(|&w| w < N_ACTORS)
            .ok_or_else(|| format!("option {}: unknown writer", d.id))?;
        let holder = match &d.holder {
            None => None,
            Some(a) => Some(
                holder_idx(a)
                    .filter(|&x| x < N_ACTORS)
                    .ok_or_else(|| format!("option {}: unknown holder", d.id))?,
            ),
        };
        Ok(Opt {
            id: d.id,
            underlying,
            ty: d.option_type,
            qty: d.qty,
            strike: d.strike_total,
            premium: d.premium_total,
            expiry: d.expiry,
            writer,
            holder,
            state: d.state,
        })
    }

    fn observe(&self) -> Result<Snap, String> {
        let c = &self.client;
        let count = c.option_count();
        let mut raw: Vec<OptionData> = Vec::with_capacity(count as usize);
        let mut opts = Vec::with_capacity(count as usize);
        for id in 0..count {
            match c.try_get_option(&id) {
                Ok(Ok(d)) => {
                    opts.push(self.to_opt(&d)?);
                    raw.push(d);
                }
                other => return Err(format!("get_option({id}) < option_count failed: {other:?}")),
            }
        }
        check_paging(c, count, &raw)?;
        match c.try_get_option(&count) {
            Err(Ok(Error::NotFound)) => {}
            other => {
                return Err(format!(
                    "get_option({count}) (= option_count) must be NotFound, got {other:?}"
                ))
            }
        }
        let mut bal = [[0i128; N_HOLDERS]; N_TOKENS];
        for (t, row) in bal.iter_mut().enumerate() {
            let tc = TokenClient::new(&self.env, &self.tokens[t]);
            for (h, b) in row.iter_mut().enumerate() {
                *b = tc.balance(&self.holders[h]);
            }
        }
        let open_collateral = std::array::from_fn(|t| c.open_collateral(&self.tokens[t]));
        let open: Vec<u32> = c.list_open().iter().collect();
        Ok(Snap {
            now: self.env.ledger().timestamp(),
            bal,
            open_collateral,
            opts,
            open,
            count,
        })
    }

    // ----- invariants on a single state -----

    fn check_state(&self, s: &Snap) -> Result<(), String> {
        let m = &self.model;

        // Reference model == chain.
        if s.now != m.now {
            return Err(format!("MODEL: ledger time {} != model {}", s.now, m.now));
        }
        if s.opts != m.opts {
            let n = s.opts.len().max(m.opts.len());
            for i in 0..n {
                if s.opts.get(i) != m.opts.get(i) {
                    return Err(format!(
                        "MODEL: option {i} differs\n  chain: {}\n  model: {}",
                        s.opts
                            .get(i)
                            .map(|o| o.to_string())
                            .unwrap_or("<none>".into()),
                        m.opts
                            .get(i)
                            .map(|o| o.to_string())
                            .unwrap_or("<none>".into())
                    ));
                }
            }
        }
        for t in 0..N_TOKENS {
            for h in 0..N_HOLDERS {
                if s.bal[t][h] != m.bal[t][h] {
                    return Err(format!(
                        "MODEL: balance {} of {}: chain {} != model {}",
                        TOKEN_NAMES[t], NAMES[h], s.bal[t][h], m.bal[t][h]
                    ));
                }
            }
        }

        for t in 0..N_TOKENS {
            // INV1: open_collateral(T) == sum of ABI-derived reserves.
            let expected: i128 = s.opts.iter().map(|o| expected_reserved(o, t)).sum();
            if s.open_collateral[t] != expected {
                return Err(format!(
                    "INV1 (reserves): open_collateral({}) = {} but the sum of ABI-derived \
                     reserves over all options is {}",
                    TOKEN_NAMES[t], s.open_collateral[t], expected
                ));
            }
            // INV2: balance(contract) == open_collateral, minus exactly the clawed total on RWA.
            let deficit = s.open_collateral[t] - s.bal[t][CONTRACT];
            let allowed = if t == RWA { m.clawed_rwa } else { 0 };
            if deficit != allowed {
                return Err(format!(
                    "INV2 (solvency): {}: open_collateral {} - balance(contract) {} = deficit \
                     {}, expected exactly {} (total clawed back from the contract)",
                    TOKEN_NAMES[t], s.open_collateral[t], s.bal[t][CONTRACT], deficit, allowed
                ));
            }
            // INV3: conservation.
            let total: i128 = s.bal[t].iter().sum();
            if total != m.minted[t] {
                return Err(format!(
                    "INV3 (conservation): {}: sum of balances {} != minted - clawed {}",
                    TOKEN_NAMES[t], total, m.minted[t]
                ));
            }
        }

        // INV4 (static part): holder rules per state.
        for o in &s.opts {
            let ok = match o.state {
                State::Offered | State::Cancelled => o.holder.is_none(),
                State::Active | State::Exercised | State::Settled => o.holder.is_some(),
                State::Expired => true, // None iff it expired unsold (checked on the transition)
            };
            if !ok {
                return Err(format!("INV4 (holder): bad holder for state: {o}"));
            }
            if o.holder == Some(o.writer) {
                return Err(format!("INV4 (holder): writer holds its own option: {o}"));
            }
        }

        // INV5: open list and count.
        let expected_open: Vec<u32> = s
            .opts
            .iter()
            .filter(|o| o.state == State::Offered)
            .map(|o| o.id)
            .collect();
        if s.open != expected_open {
            return Err(format!(
                "INV5 (open list): list_open() = {:?}, expected ids in Offered state {:?}",
                s.open, expected_open
            ));
        }
        if s.count != m.creates_ok || s.opts.len() != s.count as usize {
            return Err(format!(
                "INV5 (count): option_count() = {} but {} create_offer calls succeeded",
                s.count, m.creates_ok
            ));
        }
        for (i, o) in s.opts.iter().enumerate() {
            if o.id != i as u32 {
                return Err(format!("INV5 (ids): option at index {i} has id {}", o.id));
            }
        }
        Ok(())
    }

    fn fail(&self, msg: String) -> ! {
        let mut s = String::new();
        let _ = writeln!(s, "\n=== INVARIANT VIOLATION ===\n{msg}\n");
        let _ = writeln!(s, "--- operation history ({} ops) ---", self.history.len());
        for l in &self.history {
            let _ = writeln!(s, "{l}");
        }
        let m = &self.model;
        let _ = writeln!(
            s,
            "\n--- reference model (now={}, clawed_rwa={}) ---",
            m.now, m.clawed_rwa
        );
        for o in &m.opts {
            let _ = writeln!(s, "  {o}");
        }
        for t in 0..N_TOKENS {
            let row: Vec<String> = (0..N_HOLDERS)
                .map(|h| format!("{}={}", NAMES[h], m.bal[t][h]))
                .collect();
            let _ = writeln!(s, "  {}: {}", TOKEN_NAMES[t], row.join(" "));
        }
        panic!("{s}");
    }
}

/// INV7 (v1.2 `get_options`): pages of `PAGE` read from id 0 with `from += returned.len()` are
/// each exactly `min(PAGE, count - from)` long and, concatenated, equal `get_option(i)` for every
/// `i < count`; the page at `from == count` is empty.
fn check_paging(
    c: &OptionsContractClient<'static>,
    count: u32,
    raw: &[OptionData],
) -> Result<(), String> {
    const PAGE: u32 = 7;
    let mut paged: Vec<OptionData> = Vec::with_capacity(raw.len());
    let mut from = 0u32;
    while from < count {
        let page = c.get_options(&from, &PAGE);
        let want = PAGE.min(count - from);
        if page.len() != want {
            return Err(format!(
                "INV7 (get_options): get_options({from}, {PAGE}) returned {} entries, expected \
                 {want} (option_count = {count})",
                page.len()
            ));
        }
        paged.extend(page.iter());
        from += page.len();
    }
    let tail = c.get_options(&count, &PAGE);
    if !tail.is_empty() {
        return Err(format!(
            "INV7 (get_options): get_options({count}, {PAGE}) at option_count returned {} entries",
            tail.len()
        ));
    }
    if paged != raw {
        let i = paged
            .iter()
            .zip(raw)
            .position(|(p, r)| p != r)
            .unwrap_or(paged.len().min(raw.len()));
        return Err(format!(
            "INV7 (get_options): paged copy differs from get_option at index {i}\n  paged: \
             {:?}\n  get_option: {:?}",
            paged.get(i),
            raw.get(i)
        ));
    }
    Ok(())
}

// ----- invariants on a transition -----

fn check_transition(
    before: &Snap,
    after: &Snap,
    act: &Act,
    outcome: Outcome,
    planned: &[Transfer],
) -> Result<(), String> {
    let ok = outcome == Outcome::Ok;

    // Atomicity: a failed call changes nothing observable.
    if !ok && after != before {
        return Err(format!(
            "ATOMICITY: `{act}` failed ({outcome}) but the observable state changed"
        ));
    }

    // INV4: lifecycle edges, terminal states, holder immutability, immutable terms.
    for a in &after.opts {
        let Some(b) = before.opts.get(a.id as usize) else {
            continue;
        };
        if b.state != a.state && !allowed_edge(b.state, a.state) {
            return Err(format!(
                "INV4 (lifecycle): illegal edge {:?} -> {:?} for {a}",
                b.state, a.state
            ));
        }
        if is_terminal(b.state) && a != b {
            return Err(format!(
                "INV4 (lifecycle): terminal option changed\n  before: {b}\n  after:  {a}"
            ));
        }
        // The holder is set once by `buy` and afterwards changes only through a successful
        // `transfer` of this very option, from its holder to another actor, while `Active`.
        let transferred = |x: usize, y: Option<usize>| {
            ok && b.state == State::Active
                && a.state == State::Active
                && matches!(*act, Act::Transfer { id, from, to }
                    if id == a.id && from == x && y == Some(to) && to != x)
        };
        match (b.holder, a.holder) {
            (Some(x), y) if y != Some(x) && !transferred(x, y) => {
                return Err(format!(
                    "INV4 (holder): holder changed outside a transfer\n  before: {b}\n  after:  {a}"
                ))
            }
            (None, Some(_)) if !(b.state == State::Offered && a.state == State::Active) => {
                return Err(format!(
                    "INV4 (holder): holder set outside buy\n  before: {b}\n  after:  {a}"
                ))
            }
            _ => {}
        }
        let terms = |o: &Opt| Opt {
            holder: None,
            state: State::Offered,
            ..o.clone()
        };
        if terms(a) != terms(b) {
            return Err(format!(
                "INV4 (terms): immutable terms changed\n  before: {b}\n  after:  {a}"
            ));
        }
    }

    // Exactly which options may change, and how.
    let changed: Vec<u32> = after
        .opts
        .iter()
        .filter(|a| before.opts.get(a.id as usize) != Some(*a))
        .map(|a| a.id)
        .collect();
    let target = match (ok, *act) {
        (true, Act::Create { .. }) => Some(before.count),
        (true, Act::Buy { id, .. })
        | (true, Act::Exercise { id, .. })
        | (true, Act::Transfer { id, .. })
        | (true, Act::Cancel { id, .. })
        | (true, Act::Reclaim { id, .. })
        | (true, Act::Claim { id, .. }) => Some(id),
        _ => None,
    };
    if changed != target.into_iter().collect::<Vec<_>>() {
        return Err(format!(
            "INV4 (scope): `{act}` ({outcome}) changed options {changed:?}, expected {target:?}"
        ));
    }
    if ok {
        let b = target.and_then(|id| before.opts.get(id as usize));
        let a = target.and_then(|id| after.opts.get(id as usize));
        let edge_ok = match (*act, b, a) {
            (
                Act::Create {
                    writer,
                    underlying,
                    ty,
                    qty,
                    strike,
                    premium,
                    expiry,
                },
                None,
                Some(a),
            ) => {
                after.count == before.count + 1
                    && *a
                        == Opt {
                            id: before.count,
                            underlying,
                            ty,
                            qty,
                            strike,
                            premium,
                            expiry,
                            writer,
                            holder: None,
                            state: State::Offered,
                        }
            }
            (Act::Buy { who, .. }, Some(b), Some(a)) => {
                b.state == State::Offered && a.state == State::Active && a.holder == Some(who)
            }
            (Act::Exercise { who, .. }, Some(b), Some(a)) => {
                b.state == State::Active && a.state == State::Exercised && a.holder == Some(who)
            }
            // Only the holder changes (immutable terms are checked above); state stays Active.
            (Act::Transfer { from, to, .. }, Some(b), Some(a)) => {
                b.state == State::Active
                    && a.state == State::Active
                    && b.holder == Some(from)
                    && a.holder == Some(to)
                    && to != from
            }
            (Act::Cancel { .. }, Some(b), Some(a)) => {
                b.state == State::Offered && a.state == State::Cancelled
            }
            (Act::Reclaim { .. }, Some(b), Some(a)) => {
                matches!(b.state, State::Offered | State::Active) && a.state == State::Expired
            }
            (Act::Claim { .. }, Some(b), Some(a)) => {
                b.state == State::Exercised && a.state == State::Settled
            }
            (
                Act::SetTime { .. }
                | Act::SetAuthRwa { .. }
                | Act::SetAuthUsdx { .. }
                | Act::ClawbackRwa { .. },
                None,
                None,
            ) => true,
            _ => false,
        };
        if !edge_ok {
            return Err(format!(
                "INV4 (edge): `{act}` succeeded with an unexpected transition\n  before: {}\n  \
                 after:  {}",
                b.map(|o| o.to_string()).unwrap_or("<none>".into()),
                a.map(|o| o.to_string()).unwrap_or("<none>".into())
            ));
        }
    }

    // INV6 (general): every balance delta equals the ABI transfers of the call, nothing else moves.
    let mut expected = [[0i128; N_HOLDERS]; N_TOKENS];
    if ok {
        for &(t, from, to, amount) in planned {
            expected[t][from] -= amount;
            expected[t][to] += amount;
        }
        if let Act::ClawbackRwa { amount } = *act {
            expected[RWA][CONTRACT] -= amount;
        }
    }
    for t in 0..N_TOKENS {
        for h in 0..N_HOLDERS {
            let d = after.bal[t][h] - before.bal[t][h];
            if d != expected[t][h] {
                return Err(format!(
                    "INV6 (legs): `{act}` moved {} of {} by {d}, the ABI says {}",
                    TOKEN_NAMES[t], NAMES[h], expected[t][h]
                ));
            }
        }
    }

    // INV6 (exercise, independent of the model): pay-leg and receive-leg from the ABI §2 table,
    // computed from the option terms read on chain before the call.
    if let (true, Act::Exercise { id, who }) = (ok, *act) {
        let o = &before.opts[id as usize];
        let (pay_t, pay_a, recv_t, recv_a) = match o.ty {
            OptionType::Put => (o.underlying, o.qty, USDX, o.strike),
            OptionType::Call => (USDX, o.strike, o.underlying, o.qty),
        };
        let d = |t: usize, h: usize| after.bal[t][h] - before.bal[t][h];
        let legs = [
            ("holder pay-leg", d(pay_t, who), -pay_a),
            ("holder receive-leg", d(recv_t, who), recv_a),
            ("contract receives pay-leg", d(pay_t, CONTRACT), pay_a),
            ("contract pays receive-leg", d(recv_t, CONTRACT), -recv_a),
            ("writer untouched (pay token)", d(pay_t, o.writer), 0),
            ("writer untouched (receive token)", d(recv_t, o.writer), 0),
        ];
        for (name, got, want) in legs {
            if got != want {
                return Err(format!(
                    "INV6 (exercise): {name}: moved {got}, expected {want} for {o}"
                ));
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------------------------

/// Mostly valid amounts (tiny and large); a small weight of 0 and negative values keeps
/// `InvalidArgs` reachable through each of qty, strike_total and premium_total, not only through
/// expiry == now.
fn amount() -> impl Strategy<Value = i128> {
    prop_oneof![
        15 => 1i128..=1_000,
        15 => 1i128..=1_000_000_000,
        1 => Just(0i128),
        1 => -1_000i128..=-1,
    ]
}

/// Id selector: mostly an existing id, sometimes the first unknown id (`UNKNOWN_ID`).
fn id_sel() -> impl Strategy<Value = u8> {
    prop_oneof![9 => 0u8..UNKNOWN_ID, 1 => Just(UNKNOWN_ID)]
}

fn any_actor() -> impl Strategy<Value = Who> {
    (0..N_ACTORS).prop_map(Who::Actor)
}

/// Caller biased towards `preferred` (the role that can succeed), any actor otherwise.
fn who(preferred: Who) -> impl Strategy<Value = Who> {
    prop_oneof![3 => Just(preferred), 2 => any_actor()]
}

fn op() -> impl Strategy<Value = Op> {
    let create = (
        prop_oneof![3 => WRITER1..=WRITER2, 2 => 0..N_ACTORS],
        prop_oneof![10 => Just(RWA), 10 => Just(BOND), 1 => Just(USDX)],
        prop_oneof![Just(OptionType::Put), Just(OptionType::Call)],
        amount(),
        amount(),
        amount(),
        prop_oneof![1 => Just(0u64), 9 => 1u64..=30_000],
    )
        .prop_map(
            |(writer, underlying, ty, qty, strike, premium, expiry_in)| Op::Create {
                writer,
                underlying,
                ty,
                qty,
                strike,
                premium,
                expiry_in,
            },
        );
    prop_oneof![
        6 => create,
        4 => (id_sel(), any_actor()).prop_map(|(i, w)| Op::Buy(i, w)),
        4 => (id_sel(), who(Who::Holder)).prop_map(|(i, w)| Op::Exercise(i, w)),
        3 => (
            id_sel(),
            prop_oneof![4 => Just(Who::Holder), 1 => any_actor()],
            prop_oneof![3 => Just(To::Eligible), 2 => (0..N_ACTORS).prop_map(To::Actor)],
        )
            .prop_map(|(i, w, to)| Op::Transfer(i, w, to)),
        1 => (id_sel(), who(Who::Writer)).prop_map(|(i, w)| Op::Cancel(i, w)),
        2 => (id_sel(), who(Who::Writer)).prop_map(|(i, w)| Op::Reclaim(i, w)),
        3 => (id_sel(), who(Who::Writer)).prop_map(|(i, w)| Op::Claim(i, w)),
        2 => prop_oneof![3 => 0u64..=1_000, 1 => 0u64..=20_000].prop_map(Op::Advance),
        1 => (id_sel(), -1i8..=1).prop_map(|(i, d)| Op::WarpToExpiry(i, d)),
        1 => (0..FREEZE_TARGETS.len()).prop_map(Op::Freeze),
        1 => (0..FREEZE_TARGETS.len()).prop_map(Op::Unfreeze),
        1 => any::<bool>().prop_map(Op::ContractAuth),
        1 => (1i128..=1_000).prop_map(Op::Clawback),
    ]
}

fn config() -> ProptestConfig {
    let cases = std::env::var("PROPTEST_CASES")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(200); // keeps the default run under a minute
    ProptestConfig {
        cases,
        // Failures are reported with the full trace; no regression files are written.
        // `..default()` also honours `PROPTEST_RNG_SEED` for reproducible runs.
        failure_persistence: None,
        ..ProptestConfig::default()
    }
}

proptest! {
    #![proptest_config(config())]

    #[test]
    fn invariants_hold_for_random_operation_sequences(ops in prop::collection::vec(op(), 1..=40)) {
        let mut w = World::new();
        for op in &ops {
            w.step(op);
        }
        // `INVARIANTS_TRACE=1 cargo test ... -- --nocapture` prints every passing sequence too.
        if std::env::var_os("INVARIANTS_TRACE").is_some() {
            eprintln!("--- case ---\n{}", w.history.join("\n"));
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Deterministic regressions (every step is also checked against the oracle and all invariants)
// ---------------------------------------------------------------------------------------------

impl World {
    fn ok(&mut self, act: Act) {
        let o = self.run(act);
        assert_eq!(o, Outcome::Ok, "`{act}` should succeed");
    }

    fn err(&mut self, act: Act, e: Error) {
        let o = self.run(act);
        assert_eq!(
            o,
            Outcome::Typed(e as u32),
            "`{act}` should fail with {e:?}"
        );
    }

    /// The SAC rejected a token movement (frozen account or insufficient balance). The SAC error
    /// code reaches the caller unchanged; since v1.1 it matches no options `Error` (101+), so the
    /// typed client reports `Err(Err(InvokeError::Contract(code)))`.
    fn sac_err(&mut self, act: Act, code: u32) {
        let o = self.run(act);
        assert_eq!(
            o,
            Outcome::Raw(code),
            "`{act}` should fail inside the SAC with #{code}"
        );
    }

    fn state(&self, id: u32) -> State {
        self.snap.opts[id as usize].state
    }

    fn bal(&self, token: usize, who: usize) -> i128 {
        self.snap.bal[token][who]
    }

    fn oc(&self, token: usize) -> i128 {
        self.snap.open_collateral[token]
    }
}

fn create(
    writer: usize,
    underlying: usize,
    ty: OptionType,
    qty: i128,
    strike: i128,
    premium: i128,
    expiry: u64,
) -> Act {
    Act::Create {
        writer,
        underlying,
        ty,
        qty,
        strike,
        premium,
        expiry,
    }
}

#[test]
fn buy_after_reclaim_of_expired_unsold_offer() {
    let mut w = World::new();
    let expiry = T0 + 100;
    // id 0: unsold PUT on RWA; id 1: unsold CALL on BOND, same expiry.
    w.ok(create(
        WRITER1,
        RWA,
        OptionType::Put,
        5 * UNIT,
        50 * UNIT,
        2 * UNIT,
        expiry,
    ));
    w.ok(create(
        WRITER2,
        BOND,
        OptionType::Call,
        3 * UNIT,
        30 * UNIT,
        UNIT,
        expiry,
    ));
    assert_eq!(w.snap.open, [0, 1]);

    // One second before expiry it is still purchasable but not reclaimable.
    w.ok(Act::SetTime { t: expiry - 1 });
    w.err(
        Act::Reclaim {
            id: 0,
            who: WRITER1,
        },
        Error::NotExpired,
    );

    // At expiry (now >= expiry): no buy, reclaim allowed only for the writer.
    w.ok(Act::SetTime { t: expiry });
    w.err(
        Act::Buy {
            id: 0,
            who: HOLDER1,
        },
        Error::Expired,
    );
    w.err(
        Act::Exercise {
            id: 0,
            who: HOLDER1,
        },
        Error::NotHolder,
    );
    w.err(
        Act::Reclaim {
            id: 0,
            who: WRITER2,
        },
        Error::NotWriter,
    );
    w.ok(Act::Reclaim {
        id: 0,
        who: WRITER1,
    });
    w.ok(Act::Reclaim {
        id: 1,
        who: WRITER2,
    });
    assert_eq!(w.state(0), State::Expired);
    assert_eq!(w.state(1), State::Expired);
    assert_eq!(w.snap.opts[0].holder, None);
    assert!(w.snap.open.is_empty());
    assert_eq!([w.oc(USDX), w.oc(RWA), w.oc(BOND)], [0, 0, 0]);
    assert_eq!(w.bal(USDX, WRITER1), FUND);
    assert_eq!(w.bal(BOND, WRITER2), FUND);

    // After reclaim: the state check comes before the time check, so buy is WrongState.
    w.err(
        Act::Buy {
            id: 0,
            who: HOLDER1,
        },
        Error::WrongState,
    );
    w.err(
        Act::Buy {
            id: 1,
            who: HOLDER2,
        },
        Error::WrongState,
    );
    w.err(
        Act::Cancel {
            id: 0,
            who: WRITER1,
        },
        Error::WrongState,
    );
    w.err(
        Act::Reclaim {
            id: 0,
            who: WRITER1,
        },
        Error::WrongState,
    );
    w.err(
        Act::Claim {
            id: 0,
            who: WRITER1,
        },
        Error::WrongState,
    );
    w.err(
        Act::Exercise {
            id: 1,
            who: HOLDER2,
        },
        Error::NotHolder,
    );
    // Nobody paid a premium and nothing is left in the contract.
    assert_eq!(w.bal(USDX, HOLDER1), FUND);
    assert_eq!(w.bal(USDX, CONTRACT), 0);
    assert_eq!(w.bal(BOND, CONTRACT), 0);
}

#[test]
fn claim_delivery_while_writer_frozen_then_after_unfreeze() {
    let mut w = World::new();
    let (qty, strike, premium, expiry) = (5 * UNIT, 50 * UNIT, 2 * UNIT, T0 + 1_000);

    // id 0: PUT on RWA (proceeds = RWA, blocked by a writer freeze).
    w.ok(create(
        WRITER1,
        RWA,
        OptionType::Put,
        qty,
        strike,
        premium,
        expiry,
    ));
    w.ok(Act::Buy {
        id: 0,
        who: HOLDER1,
    });
    // id 1: CALL on RWA by the same writer (proceeds = USDx, unaffected by an RWA freeze).
    w.ok(create(
        WRITER1,
        RWA,
        OptionType::Call,
        qty,
        strike,
        premium,
        expiry,
    ));
    w.ok(Act::Buy {
        id: 1,
        who: HOLDER2,
    });

    w.ok(Act::SetAuthRwa {
        target: WRITER1,
        authorized: false,
    });
    // A frozen writer does not block the holders (ABI §6): both exercises settle.
    w.ok(Act::Exercise {
        id: 0,
        who: HOLDER1,
    });
    w.ok(Act::Exercise {
        id: 1,
        who: HOLDER2,
    });
    assert_eq!(w.bal(USDX, HOLDER1), FUND - premium + strike);
    assert_eq!(w.bal(RWA, HOLDER1), FUND - qty);
    assert_eq!(w.bal(RWA, HOLDER2), FUND + qty);

    // The PUT proceeds (RWA) cannot reach the frozen writer; nothing moves, nothing changes.
    w.sac_err(
        Act::Claim {
            id: 0,
            who: WRITER1,
        },
        SAC_DEAUTHORIZED,
    );
    // What a client sees: SAC BalanceDeauthorizedError (#11) as a raw contract error. In v1 it
    // decoded as options `SelfTrade` (#11); the v1.1 renumbering (101+) removed the collision.
    assert_eq!(
        w.client.try_claim_delivery(&w.holders[WRITER1], &0),
        Err(Err(InvokeError::Contract(SAC_DEAUTHORIZED)))
    );
    assert_eq!(w.state(0), State::Exercised);
    assert_eq!(w.oc(RWA), qty);
    assert_eq!(w.bal(RWA, CONTRACT), qty);
    // The CALL proceeds are USDx, so the frozen writer can claim them.
    w.ok(Act::Claim {
        id: 1,
        who: WRITER1,
    });
    assert_eq!(w.state(1), State::Settled);
    assert_eq!(w.oc(USDX), 0);

    // Claiming has no deadline: still blocked after expiry, still nobody else can take it.
    w.ok(Act::SetTime { t: expiry + 10 });
    w.sac_err(
        Act::Claim {
            id: 0,
            who: WRITER1,
        },
        SAC_DEAUTHORIZED,
    );
    w.err(
        Act::Claim {
            id: 0,
            who: WRITER2,
        },
        Error::NotWriter,
    );
    w.err(
        Act::Reclaim {
            id: 0,
            who: WRITER1,
        },
        Error::WrongState,
    );

    w.ok(Act::SetAuthRwa {
        target: WRITER1,
        authorized: true,
    });
    w.ok(Act::Claim {
        id: 0,
        who: WRITER1,
    });
    assert_eq!(w.state(0), State::Settled);
    // writer1: RWA -qty (CALL collateral) +qty (PUT delivery); USDx -strike (PUT collateral)
    // +2 premiums +strike (CALL proceeds).
    assert_eq!(w.bal(RWA, WRITER1), FUND);
    assert_eq!(w.bal(USDX, WRITER1), FUND + 2 * premium);
    assert_eq!([w.oc(USDX), w.oc(RWA), w.oc(BOND)], [0, 0, 0]);
    w.err(
        Act::Claim {
            id: 0,
            who: WRITER1,
        },
        Error::WrongState,
    );
}

#[test]
fn interleaved_offers_from_two_writers_on_two_underlyings() {
    let mut w = World::new();
    // id 0: writer1 CALL on RWA; id 1: writer2 PUT on BOND.
    w.ok(create(
        WRITER1,
        RWA,
        OptionType::Call,
        3 * UNIT,
        30 * UNIT,
        UNIT,
        T0 + 500,
    ));
    w.ok(create(
        WRITER2,
        BOND,
        OptionType::Put,
        4 * UNIT,
        40 * UNIT,
        2 * UNIT,
        T0 + 1_000,
    ));
    assert_eq!(w.snap.open, [0, 1]);
    assert_eq!(
        [w.oc(USDX), w.oc(RWA), w.oc(BOND)],
        [40 * UNIT, 3 * UNIT, 0]
    );

    w.err(
        Act::Buy {
            id: 1,
            who: WRITER2,
        },
        Error::SelfTrade,
    );
    w.err(
        Act::Buy {
            id: 0,
            who: OUTSIDER,
        },
        Error::NotEligible,
    );
    w.ok(Act::Buy {
        id: 1,
        who: HOLDER2,
    });
    assert_eq!(w.snap.open, [0]);
    // writer2 may buy writer1's offer.
    w.ok(Act::Buy {
        id: 0,
        who: WRITER2,
    });
    assert!(w.snap.open.is_empty());

    // Cross-wired callers are rejected.
    w.err(
        Act::Claim {
            id: 1,
            who: WRITER1,
        },
        Error::NotWriter,
    );
    w.err(
        Act::Exercise {
            id: 1,
            who: HOLDER1,
        },
        Error::NotHolder,
    );
    w.err(
        Act::Exercise {
            id: 0,
            who: HOLDER2,
        },
        Error::NotHolder,
    );
    w.err(
        Act::Claim {
            id: 1,
            who: WRITER2,
        },
        Error::WrongState,
    );

    // PUT on BOND exercised: USDx reserve -> BOND proceeds.
    w.ok(Act::Exercise {
        id: 1,
        who: HOLDER2,
    });
    assert_eq!([w.oc(USDX), w.oc(RWA), w.oc(BOND)], [0, 3 * UNIT, 4 * UNIT]);

    // A third offer appended after the others keeps creation order in the open list.
    w.ok(create(
        WRITER1,
        BOND,
        OptionType::Put,
        UNIT,
        10 * UNIT,
        UNIT,
        T0 + 2_000,
    ));
    assert_eq!(w.snap.open, [2]);

    // id 0 expires unexercised while Active: the writer reclaims, the holder stays recorded.
    w.ok(Act::SetTime { t: T0 + 500 });
    w.err(
        Act::Exercise {
            id: 0,
            who: WRITER2,
        },
        Error::Expired,
    );
    w.err(
        Act::Reclaim {
            id: 0,
            who: WRITER2,
        },
        Error::NotWriter,
    );
    w.err(
        Act::Reclaim {
            id: 1,
            who: WRITER2,
        },
        Error::WrongState,
    );
    w.ok(Act::Reclaim {
        id: 0,
        who: WRITER1,
    });
    assert_eq!(w.snap.opts[0].holder, Some(WRITER2));
    assert_eq!(w.state(0), State::Expired);

    w.ok(Act::Claim {
        id: 1,
        who: WRITER2,
    });
    w.ok(Act::Cancel {
        id: 2,
        who: WRITER1,
    });
    assert_eq!([w.oc(USDX), w.oc(RWA), w.oc(BOND)], [0, 0, 0]);
    assert!(w.snap.open.is_empty());
    assert_eq!(w.snap.count, 3);
    // writer1 earned id 0's premium; writer2 earned id 1's premium, paid id 0's premium and
    // swapped 40 USDx of PUT collateral for 4 BOND.
    assert_eq!(w.bal(USDX, WRITER1), FUND + UNIT);
    assert_eq!(w.bal(RWA, WRITER1), FUND);
    assert_eq!(w.bal(USDX, WRITER2), FUND + 2 * UNIT - UNIT - 40 * UNIT);
    assert_eq!(w.bal(BOND, WRITER2), FUND + 4 * UNIT);
}

/// Documents (does not endorse) how a clawback from the contract is absorbed: the SAC balance is
/// pooled across all RWA options, so the deficit hits whichever RWA transfer out of the contract
/// would overdraw it, not necessarily the option whose collateral the issuer meant to claw.
/// Existing positions are NOT blocked by the deficit (ABI §6, §10.5): `exercise` and
/// `claim_delivery` succeed while the pool covers them and fail with SAC #10 only once it is
/// drained; only new exposure (`create_offer`, `buy`) fails with `CollateralShortfall`.
#[test]
fn clawback_deficit_falls_on_the_last_rwa_settlement() {
    let mut w = World::new();
    let expiry = T0 + 100;
    let call = |writer| create(writer, RWA, OptionType::Call, 100, 1_000, 10, expiry);
    let put = |writer| create(writer, RWA, OptionType::Put, 100, 1_000, 10, expiry);
    // id 0, 1: unsold CALLs on RWA (100 RWA collateral each).
    w.ok(call(WRITER1));
    w.ok(call(WRITER2));
    // id 2, 3: PUTs on RWA, bought and exercised before the clawback; each delivered 100 RWA,
    // which waits in the contract for the writer's claim_delivery.
    w.ok(put(WRITER1));
    w.ok(Act::Buy {
        id: 2,
        who: HOLDER1,
    });
    w.ok(Act::Exercise {
        id: 2,
        who: HOLDER1,
    });
    w.ok(put(WRITER2));
    w.ok(Act::Buy {
        id: 3,
        who: HOLDER2,
    });
    w.ok(Act::Exercise {
        id: 3,
        who: HOLDER2,
    });
    // id 4: CALL on RWA, bought, exercised only after the clawback.
    w.ok(call(WRITER1));
    w.ok(Act::Buy {
        id: 4,
        who: HOLDER2,
    });
    assert_eq!(w.state(2), State::Exercised);
    assert_eq!(w.state(3), State::Exercised);
    assert_eq!(w.oc(RWA), 500);
    assert_eq!(w.bal(RWA, CONTRACT), 500);

    w.ok(Act::ClawbackRwa { amount: 150 });
    assert_eq!(w.oc(RWA), 500);
    assert_eq!(w.bal(RWA, CONTRACT), 350);

    // v1.1: no new exposure on RWA while the deficit exists (a PUT on RWA too: its underlying is
    // RWA), but other tokens are unaffected.
    w.err(
        create(WRITER1, RWA, OptionType::Put, 1, 1, 1, expiry),
        Error::CollateralShortfall,
    );
    w.err(
        Act::Buy {
            id: 0,
            who: HOLDER1,
        },
        Error::CollateralShortfall,
    );
    w.ok(create(WRITER1, BOND, OptionType::Put, 1, 1, 1, expiry)); // id 5
    w.ok(Act::Buy {
        id: 5,
        who: HOLDER1,
    });

    // Existing positions settle while the pool covers them: the CALL holder exercises during the
    // deficit (100 RWA out)...
    w.ok(Act::Exercise {
        id: 4,
        who: HOLDER2,
    });
    assert_eq!(w.state(4), State::Exercised);
    assert_eq!(w.bal(RWA, CONTRACT), 250);
    // ...and the first PUT writer claims its delivery during the deficit (100 RWA out).
    w.ok(Act::Claim {
        id: 2,
        who: WRITER1,
    });
    assert_eq!(w.state(2), State::Settled);
    assert_eq!(w.bal(RWA, CONTRACT), 150);
    assert_eq!(w.oc(RWA), 300); // ids 0 and 1 (collateral) + id 3 (unclaimed delivery)

    w.ok(Act::SetTime { t: expiry });
    // The next writer out is made whole too...
    w.ok(Act::Reclaim {
        id: 1,
        who: WRITER2,
    });
    assert_eq!(w.bal(RWA, WRITER2), FUND); // id 1's collateral is back; id 3's delivery is not
    assert_eq!(w.bal(RWA, CONTRACT), 50);
    // ...but the pool (50) is now below every remaining payout (100 each): the last claimants get
    // SAC #10 and their options stay where they are.
    w.sac_err(
        Act::Claim {
            id: 3,
            who: WRITER2,
        },
        SAC_BALANCE,
    );
    w.sac_err(
        Act::Reclaim {
            id: 0,
            who: WRITER1,
        },
        SAC_BALANCE,
    );
    w.sac_err(
        Act::Cancel {
            id: 0,
            who: WRITER1,
        },
        SAC_BALANCE,
    );
    assert_eq!(w.state(3), State::Exercised);
    assert_eq!(w.state(0), State::Offered);
    assert_eq!(w.oc(RWA), 200);
    assert_eq!(w.bal(RWA, CONTRACT), 50);
    // The deficit (= clawed amount) never closes, so RWA stays closed to new exposure.
    w.err(
        create(WRITER2, RWA, OptionType::Call, 1, 1, 1, expiry + 100),
        Error::CollateralShortfall,
    );
}

/// ABI §10.3: a writer must be able to hold the quote token. The USDx issuer revokes writer1, so
/// `create_offer` fails with `NotEligible` (for a CALL too, whose collateral is RWA), before the
/// contract-authorization check; after re-authorization it works. Also pins what the create-time
/// check does not cover: a writer revoked on USDx after listing makes its offer unbuyable (SAC
/// #11 on the premium) and blocks its own CALL proceeds, but never the holder's exercise.
#[test]
fn writer_deauthorized_on_quote_cannot_create_offer() {
    let mut w = World::new();
    let (qty, strike, premium, expiry) = (5 * UNIT, 50 * UNIT, 2 * UNIT, T0 + 1_000);
    w.ok(Act::SetAuthUsdx {
        target: WRITER1,
        authorized: false,
    });
    for (underlying, ty) in [
        (RWA, OptionType::Put),
        (RWA, OptionType::Call),
        (BOND, OptionType::Call),
    ] {
        w.err(
            create(WRITER1, underlying, ty, qty, strike, premium, expiry),
            Error::NotEligible,
        );
    }
    // Check order: writer eligibility (both tokens) before ContractNotAuthorized.
    w.ok(Act::SetAuthRwa {
        target: CONTRACT,
        authorized: false,
    });
    w.err(
        create(WRITER1, RWA, OptionType::Call, qty, strike, premium, expiry),
        Error::NotEligible,
    );
    w.ok(Act::SetAuthRwa {
        target: CONTRACT,
        authorized: true,
    });
    // Other writers are unaffected; the revoked account cannot pay a premium (SAC #11).
    w.ok(create(
        WRITER2,
        RWA,
        OptionType::Call,
        qty,
        strike,
        premium,
        expiry,
    )); // id 0
    w.sac_err(
        Act::Buy {
            id: 0,
            who: WRITER1,
        },
        SAC_DEAUTHORIZED,
    );
    assert_eq!(w.snap.count, 1);

    // Re-authorized, writer1 can write again and earns the premium.
    w.ok(Act::SetAuthUsdx {
        target: WRITER1,
        authorized: true,
    });
    w.ok(create(
        WRITER1,
        RWA,
        OptionType::Call,
        qty,
        strike,
        premium,
        expiry,
    )); // id 1
    w.ok(create(
        WRITER1,
        RWA,
        OptionType::Put,
        qty,
        strike,
        premium,
        expiry,
    )); // id 2
    w.ok(Act::Buy {
        id: 1,
        who: HOLDER1,
    });
    assert_eq!(w.bal(USDX, WRITER1), FUND + premium - strike);

    // Revoked after listing: id 2 stays listed but the premium cannot reach the writer.
    w.ok(Act::SetAuthUsdx {
        target: WRITER1,
        authorized: false,
    });
    w.sac_err(
        Act::Buy {
            id: 2,
            who: HOLDER2,
        },
        SAC_DEAUTHORIZED,
    );
    assert_eq!(w.snap.open, [0, 2]);
    // The holder of id 1 still exercises (the strike lands in the contract, not with the writer)...
    w.ok(Act::Exercise {
        id: 1,
        who: HOLDER1,
    });
    // ...the writer's USDx proceeds wait until the issuer re-authorizes it.
    w.sac_err(
        Act::Claim {
            id: 1,
            who: WRITER1,
        },
        SAC_DEAUTHORIZED,
    );
    w.ok(Act::SetAuthUsdx {
        target: WRITER1,
        authorized: true,
    });
    w.ok(Act::Claim {
        id: 1,
        who: WRITER1,
    });
    w.ok(Act::Buy {
        id: 2,
        who: HOLDER2,
    });
    assert_eq!(w.state(1), State::Settled);
    assert_eq!(w.state(2), State::Active);
    // writer1 USDx: -strike (id 2 PUT collateral) +strike (id 1 CALL proceeds) +2 premiums.
    assert_eq!(w.bal(USDX, WRITER1), FUND + 2 * premium);
}

/// ABI §6/§10: the RWA issuer de-authorizes the contract address itself.
#[test]
fn contract_deauthorized_on_rwa_blocks_buy_and_rwa_settlement() {
    let mut w = World::new();
    let (qty, strike, premium, expiry) = (5 * UNIT, 50 * UNIT, 2 * UNIT, T0 + 1_000);
    // id 0: PUT on RWA (quote collateral); id 1: CALL on RWA (RWA collateral); id 2: PUT on RWA.
    w.ok(create(
        WRITER1,
        RWA,
        OptionType::Put,
        qty,
        strike,
        premium,
        expiry,
    ));
    w.ok(create(
        WRITER2,
        RWA,
        OptionType::Call,
        qty,
        strike,
        premium,
        expiry,
    ));
    w.ok(create(
        WRITER1,
        RWA,
        OptionType::Put,
        qty,
        strike,
        premium,
        expiry,
    ));
    w.ok(Act::Buy {
        id: 1,
        who: HOLDER2,
    });

    w.ok(Act::SetAuthRwa {
        target: CONTRACT,
        authorized: false,
    });
    // No new offers and no sales on RWA: the premium is non-refundable.
    w.err(
        create(WRITER2, RWA, OptionType::Put, qty, strike, premium, expiry),
        Error::ContractNotAuthorized,
    );
    w.err(
        Act::Buy {
            id: 0,
            who: HOLDER1,
        },
        Error::ContractNotAuthorized,
    );
    // Eligibility of the buyer is checked first.
    w.err(
        Act::Buy {
            id: 0,
            who: OUTSIDER,
        },
        Error::NotEligible,
    );
    // CALL exercise needs RWA out of the contract: SAC #11, nothing moves.
    w.sac_err(
        Act::Exercise {
            id: 1,
            who: HOLDER2,
        },
        SAC_DEAUTHORIZED,
    );
    // Cancelling a PUT returns quote collateral (USDx): unaffected.
    w.ok(Act::Cancel {
        id: 2,
        who: WRITER1,
    });

    w.ok(Act::SetAuthRwa {
        target: CONTRACT,
        authorized: true,
    });
    w.ok(Act::Buy {
        id: 0,
        who: HOLDER1,
    });
    w.ok(Act::Exercise {
        id: 1,
        who: HOLDER2,
    });

    // De-authorized again: PUT exercise (RWA into the contract) fails; the CALL writer's claim
    // (USDx out of the contract) still works.
    w.ok(Act::SetAuthRwa {
        target: CONTRACT,
        authorized: false,
    });
    w.sac_err(
        Act::Exercise {
            id: 0,
            who: HOLDER1,
        },
        SAC_DEAUTHORIZED,
    );
    w.ok(Act::Claim {
        id: 1,
        who: WRITER2,
    });
    // After expiry the PUT writer reclaims its USDx collateral even while the contract is
    // de-authorized on RWA.
    w.ok(Act::SetTime { t: expiry });
    w.ok(Act::Reclaim {
        id: 0,
        who: WRITER1,
    });
    assert_eq!([w.oc(USDX), w.oc(RWA), w.oc(BOND)], [0, 0, 0]);
    assert_eq!(w.bal(USDX, WRITER1), FUND + premium);
}
