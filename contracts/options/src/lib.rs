//! Strata `options` contract: fully collateralized, physically settled calls and puts on
//! listed Stellar Asset Contract (SAC) underlyings, quoted in one SAC quote token (USDx).
//!
//! The ABI in `docs/contract-abi.md` is LOCKED; this file implements it exactly.
//!
//! Design summary (see the ABI for the full rules):
//! - The contract holds all collateral itself and tracks, per token, how much it must hold
//!   (`Key::Reserved`). PUT collateral = `strike_total` of quote; CALL collateral = `qty` of underlying.
//! - Lifecycle: Offered -> Active -> Exercised -> Settled, or Offered -> Cancelled,
//!   or Offered/Active -> Expired (reclaim after expiry; v1.3: anyone may `prune_expired` an
//!   unsold expired offer, and the collateral always goes back to the writer). No other
//!   transition exists. `transfer` (v1.2) hands an `Active` option to a new eligible holder; the
//!   state stays `Active` and no tokens, reserved totals or open-list entries change.
//! - Asset registry (v1.3): seeded with the constructor's underlyings; `list_asset` lets anyone add
//!   a classic Stellar asset by deriving its canonical SAC address on chain, so a custom token
//!   contract can never be listed. Listing authorizes nothing: the issuer's authorization rules
//!   still apply to the escrow and to every counterparty.
//! - Functions: `create_offer`, `buy`, `exercise`, `cancel_offer`, `reclaim`, `claim_delivery`,
//!   `transfer` (v1.2), `extend_ttl`, `list_asset` (v1.3), `prune_expired` (v1.3); views `config`,
//!   `get_option`, `get_options` (v1.2, paged, at most `MAX_PAGE` entries), `list_open`,
//!   `option_count`, `open_collateral`, `is_eligible`, and (v1.3) `is_listed`, `list_assets`
//!   (paged like `get_options`), `asset_count`, `writer_open_count`.
//! - No admin, no upgrade, no delisting; the quote token is fixed by the constructor.
//! - Check order in every state-changing function:
//!   auth -> NotFound -> ownership -> state -> time -> eligibility -> transfers -> storage -> event.
//!   Right after auth, the contract's own address is rejected as a party (`InvalidArgs`, v1.3).
//!   `create_offer` and `buy` add guards between eligibility and transfers: the open-list cap and
//!   the per-writer cap (`create_offer` only, `OpenListFull`, `WriterOpenLimit`) and the
//!   pooled-collateral check (`CollateralShortfall`).
//!   Any failure reverts the whole invocation (the transaction is the atomicity boundary).
//! - All amounts are exact `i128` token units; every addition/subtraction is checked.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    token::{StellarAssetClient, TokenClient},
    xdr::ToXdr,
    Address, Bytes, Env, String, Vec,
};

// ---------------------------------------------------------------------------------------------
// TTL constants (ABI §8). ~5 s ledgers => 17_280 ledgers per day.
// ---------------------------------------------------------------------------------------------

const DAY_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * DAY_LEDGERS;
const TTL_EXTEND_TO: u32 = 30 * DAY_LEDGERS;

/// Maximum number of allowlisted underlyings accepted by the constructor (ABI §2 `Config`).
const MAX_UNDERLYINGS: u32 = 8;

/// Maximum number of ids in the open list (`Key::Open`, ABI §8). The list lives in the single
/// instance-storage entry (64 KB limit), so `create_offer` refuses new offers with `OpenListFull`
/// once this many offers are in state `Offered`.
const MAX_OPEN: u32 = 1000;

/// Maximum number of options returned by one `get_options` call (ABI §3 Views, §8; v1.2).
/// Keeps a page well inside the read limits of a single simulation.
const MAX_PAGE: u32 = 50;

/// Maximum number of offers one writer may have in state `Offered` (ABI §8; v1.3). With
/// `MAX_TENOR` and `prune_expired` this stops one writer from filling the open list (finding F-1).
const MAX_OPEN_PER_WRITER: u32 = 50;

/// Maximum tenor of a new offer in seconds (ABI §8; v1.3): `create_offer` requires
/// `expiry <= now + MAX_TENOR` (2 years).
const MAX_TENOR: u64 = 63_072_000;

/// Longest classic asset code (`AlphaNum12`, v1.3 `list_asset`); codes of 1..=4 characters are
/// `AlphaNum4`, codes of 5..=12 characters are `AlphaNum12`.
const MAX_CODE_LEN: u32 = 12;

// ---------------------------------------------------------------------------------------------
// Types (ABI §2)
// ---------------------------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OptionType {
    Put,
    Call,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum State {
    /// Writer funded collateral, no holder yet; purchasable while now < expiry.
    Offered,
    /// Bought; holder set; exercisable while now < expiry.
    Active,
    /// Holder exercised; writer's proceeds sit in the contract until claim_delivery.
    Exercised,
    /// Writer claimed the proceeds (terminal).
    Settled,
    /// Writer reclaimed collateral after expiry (terminal).
    Expired,
    /// Writer withdrew the unsold offer (terminal).
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OptionData {
    pub id: u32,
    /// SAC of the tokenized asset (allowlisted in the constructor).
    pub underlying: Address,
    /// SAC of the quote token (USDx), same for every option.
    pub quote: Address,
    pub option_type: OptionType,
    /// Total underlying quantity (> 0).
    pub qty: i128,
    /// Total strike in quote units (> 0).
    pub strike_total: i128,
    /// Total premium in quote units (> 0).
    pub premium_total: i128,
    /// Unix seconds.
    pub expiry: u64,
    /// Market maker; receives premium, owes delivery.
    pub writer: Address,
    /// None while Offered; Some(buyer) from Active on.
    pub holder: Option<Address>,
    pub state: State,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub quote: Address,
    /// Constructor-time underlyings, 1..=8 entries. Immutable; since v1.3 the full registry
    /// (these plus every `list_asset`) is read with `list_assets`.
    pub underlyings: Vec<Address>,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// Unknown option id.
    NotFound = 101,
    /// qty/strike_total/premium_total <= 0, or expiry <= now; v1.3: a party argument is the
    /// contract itself, or `list_asset` got a bad code or a non-account issuer.
    InvalidArgs = 102,
    /// Underlying not in the asset registry (constructor underlyings plus `list_asset`, v1.3).
    AssetNotAllowed = 103,
    /// Writer/buyer not authorized on the underlying SAC, or writer not authorized on the quote SAC.
    NotEligible = 104,
    /// The contract itself is not authorized to hold the underlying (create_offer and buy).
    ContractNotAuthorized = 105,
    /// Action not valid in the option's current State.
    WrongState = 106,
    /// Caller is not the option's writer.
    NotWriter = 107,
    /// Caller is not the option's holder.
    NotHolder = 108,
    /// buy/exercise after expiry.
    Expired = 109,
    /// reclaim before expiry.
    NotExpired = 110,
    /// Writer tried to buy their own offer.
    SelfTrade = 111,
    /// Checked i128 math failed.
    Overflow = 112,
    /// Constructor: empty/duplicate/too many underlyings, or quote in underlyings.
    InvalidConfig = 113,
    /// create_offer: `MAX_OPEN` offers are already in state Offered.
    OpenListFull = 114,
    /// create_offer/buy: SAC balance(contract) < open_collateral(token) for the option's quote or
    /// underlying token (an issuer clawback left a pooled deficit; no new exposure on that token).
    CollateralShortfall = 115,
    /// v1.3 create_offer: this writer already has `MAX_OPEN_PER_WRITER` offers in state Offered.
    WriterOpenLimit = 116,
    /// v1.3 list_asset: the derived SAC is already listed (or is the quote token).
    AlreadyListed = 117,
    /// v1.3 list_asset: the canonical SAC for (code, issuer) is not deployed on this network.
    AssetNotDeployed = 118,
    /// v1.3 create_offer: expiry > now + `MAX_TENOR` (2 years).
    TenorOutOfRange = 119,
}

// ---------------------------------------------------------------------------------------------
// Events (ABI §5). Default topic = snake_case struct name, then the `#[topic]` fields.
// ---------------------------------------------------------------------------------------------

#[contractevent]
pub struct OfferCreated {
    #[topic]
    pub id: u32,
    pub writer: Address,
    pub underlying: Address,
    pub option_type: OptionType,
    pub qty: i128,
    pub strike_total: i128,
    pub premium_total: i128,
    pub expiry: u64,
}

#[contractevent]
pub struct OptionBought {
    #[topic]
    pub id: u32,
    pub holder: Address,
    pub premium_total: i128,
}

#[contractevent]
pub struct OptionExercised {
    #[topic]
    pub id: u32,
    pub holder: Address,
}

#[contractevent]
pub struct OfferCancelled {
    #[topic]
    pub id: u32,
}

#[contractevent]
pub struct OptionReclaimed {
    #[topic]
    pub id: u32,
}

#[contractevent]
pub struct DeliveryClaimed {
    #[topic]
    pub id: u32,
}

/// v1.2: the holder of an `Active` option handed it to `to` (`transfer`). No tokens moved.
#[contractevent]
pub struct OptionTransferred {
    #[topic]
    pub id: u32,
    pub from: Address,
    pub to: Address,
}

/// v1.3: `lister` added the classic asset `code`:`issuer`, whose canonical SAC is `sac`, to the
/// asset registry (`list_asset`).
#[contractevent]
pub struct AssetListed {
    #[topic]
    pub sac: Address,
    pub code: String,
    pub issuer: Address,
    pub lister: Address,
}

/// v1.3: `prune_expired` closed an expired unsold offer and returned its collateral to the writer.
/// `prune_expired` takes no caller argument (no auth), so `pruner` is the contract's own address.
#[contractevent]
pub struct OfferPruned {
    #[topic]
    pub id: u32,
    pub pruner: Address,
}

// ---------------------------------------------------------------------------------------------
// Storage keys (ABI §8)
// ---------------------------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
enum Key {
    /// instance: Address of the quote SAC.
    Quote,
    /// instance: Vec<Address>, constructor-time underlyings (returned by `config`).
    Underlyings,
    /// instance: u32, next option id (= option_count; `get_options` pages over `0..Next`).
    Next,
    /// instance: Vec<u32>, ids in state Offered, oldest first.
    Open,
    /// instance: i128 per token, units the contract must hold for non-terminal options.
    Reserved(Address),
    /// persistent: OptionData. Never deleted; `holder` changes on `buy` and `transfer` (v1.2).
    Opt(u32),
    /// persistent: bool, v1.3 asset registry membership (seeded by the constructor).
    Listed(Address),
    /// persistent: Address, v1.3 registry index for paging (`list_assets` pages over
    /// `0..AssetCount`).
    AssetAt(u32),
    /// instance: u32, v1.3 number of listed assets.
    AssetCount,
    /// persistent: u32, v1.3 count of this writer's options in state Offered.
    WriterOpen(Address),
}

// ---------------------------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------------------------

/// Quote SAC address. Set by the constructor, so the unwrap cannot fail on a deployed instance.
fn quote_addr(e: &Env) -> Address {
    e.storage().instance().get(&Key::Quote).unwrap()
}

/// Constructor-time underlyings (`config`). Set by the constructor, so the unwrap cannot fail.
fn underlyings(e: &Env) -> Vec<Address> {
    e.storage().instance().get(&Key::Underlyings).unwrap()
}

/// Extends the contract instance TTL (all instance keys live in one entry).
fn bump_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Loads an option or returns `NotFound`. Does not touch TTL (callers that mutate re-save).
fn load_opt(e: &Env, id: u32) -> Result<OptionData, Error> {
    e.storage()
        .persistent()
        .get(&Key::Opt(id))
        .ok_or(Error::NotFound)
}

/// Stores an option and extends its persistent TTL.
fn save_opt(e: &Env, opt: &OptionData) {
    let key = Key::Opt(opt.id);
    e.storage().persistent().set(&key, opt);
    e.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Token and amount the writer locks at `create_offer` (ABI §2 table):
/// PUT -> `strike_total` of quote, CALL -> `qty` of underlying.
fn collateral_of(opt: &OptionData) -> (Address, i128) {
    match opt.option_type {
        OptionType::Put => (opt.quote.clone(), opt.strike_total),
        OptionType::Call => (opt.underlying.clone(), opt.qty),
    }
}

/// Token and amount the writer receives at `claim_delivery` (ABI §2 table):
/// PUT -> `qty` of underlying, CALL -> `strike_total` of quote.
fn proceeds_of(opt: &OptionData) -> (Address, i128) {
    match opt.option_type {
        OptionType::Put => (opt.underlying.clone(), opt.qty),
        OptionType::Call => (opt.quote.clone(), opt.strike_total),
    }
}

/// Current reserved total for `token` (0 if never used).
fn reserved(e: &Env, token: &Address) -> i128 {
    e.storage()
        .instance()
        .get(&Key::Reserved(token.clone()))
        .unwrap_or(0)
}

/// Adds `amount` to the reserved total of `token` with checked math.
fn add_reserved(e: &Env, token: &Address, amount: i128) -> Result<(), Error> {
    let next = reserved(e, token)
        .checked_add(amount)
        .ok_or(Error::Overflow)?;
    e.storage()
        .instance()
        .set(&Key::Reserved(token.clone()), &next);
    Ok(())
}

/// Subtracts `amount` from the reserved total of `token` with checked math. A result below zero
/// would mean broken accounting, so it is rejected as `Overflow` rather than stored.
fn sub_reserved(e: &Env, token: &Address, amount: i128) -> Result<(), Error> {
    let next = reserved(e, token)
        .checked_sub(amount)
        .ok_or(Error::Overflow)?;
    if next < 0 {
        return Err(Error::Overflow);
    }
    e.storage()
        .instance()
        .set(&Key::Reserved(token.clone()), &next);
    Ok(())
}

/// Open list (ids in state Offered, oldest first).
fn open_list(e: &Env) -> Vec<u32> {
    e.storage()
        .instance()
        .get(&Key::Open)
        .unwrap_or_else(|| Vec::new(e))
}

/// Appends `id` to the open list.
fn open_push(e: &Env, id: u32) {
    let mut open = open_list(e);
    open.push_back(id);
    e.storage().instance().set(&Key::Open, &open);
}

/// Removes `id` from the open list if present.
fn open_remove(e: &Env, id: u32) {
    let mut open = open_list(e);
    if let Some(i) = open.first_index_of(id) {
        open.remove(i);
        e.storage().instance().set(&Key::Open, &open);
    }
}

/// `CollateralShortfall` if the contract's SAC balance of `quote` or `underlying` is below the
/// reserved total of that token (an issuer clawback hit the pooled balance). Used by
/// `create_offer` and `buy` so a deficit cannot spread to new participants (ABI §6).
fn check_collateral(e: &Env, quote: &Address, underlying: &Address) -> Result<(), Error> {
    let me = e.current_contract_address();
    for token in [quote, underlying] {
        if TokenClient::new(e, token).balance(&me) < reserved(e, token) {
            return Err(Error::CollateralShortfall);
        }
    }
    Ok(())
}

/// `true` iff the SAC at `token` reports `authorized(who) == true`. Any SAC error (for example
/// SAC #13, a `G` account without a trustline) or a non-bool result is treated as `false`.
fn eligible(e: &Env, token: &Address, who: &Address) -> bool {
    matches!(
        StellarAssetClient::new(e, token).try_authorized(who),
        Ok(Ok(true))
    )
}

/// Extends the persistent TTL of `key` with the ABI §8 values.
fn bump_persistent(e: &Env, key: &Key) {
    e.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// `true` iff `token` is in the asset registry (v1.3). With `bump`, the TTL of a listed entry is
/// extended (state-changing paths read it this way; views do not touch TTL).
fn listed(e: &Env, token: &Address, bump: bool) -> bool {
    let key = Key::Listed(token.clone());
    let is_listed = e.storage().persistent().get(&key).unwrap_or(false);
    if is_listed && bump {
        bump_persistent(e, &key);
    }
    is_listed
}

/// Number of listed assets (v1.3; = next registry index).
fn listed_count(e: &Env) -> u32 {
    e.storage().instance().get(&Key::AssetCount).unwrap_or(0)
}

/// Appends `token` to the asset registry (v1.3): `Listed(token) = true`,
/// `AssetAt(listed_count) = token`, `AssetCount += 1`. Callers have checked that `token` is not
/// listed yet.
fn registry_push(e: &Env, token: &Address) -> Result<(), Error> {
    let index = listed_count(e);
    let next = index.checked_add(1).ok_or(Error::Overflow)?;
    let listed_key = Key::Listed(token.clone());
    e.storage().persistent().set(&listed_key, &true);
    bump_persistent(e, &listed_key);
    let at_key = Key::AssetAt(index);
    e.storage().persistent().set(&at_key, token);
    bump_persistent(e, &at_key);
    e.storage().instance().set(&Key::AssetCount, &next);
    Ok(())
}

/// Number of `writer`'s options in state `Offered` (v1.3; 0 if none). Pure read.
fn writer_open(e: &Env, writer: &Address) -> u32 {
    e.storage()
        .persistent()
        .get(&Key::WriterOpen(writer.clone()))
        .unwrap_or(0)
}

/// Stores `writer`'s open count and extends the entry's TTL.
fn set_writer_open(e: &Env, writer: &Address, count: u32) {
    let key = Key::WriterOpen(writer.clone());
    e.storage().persistent().set(&key, &count);
    bump_persistent(e, &key);
}

/// `writer` created an offer (`create_offer`): open count + 1.
fn writer_open_inc(e: &Env, writer: &Address) -> Result<(), Error> {
    let next = writer_open(e, writer)
        .checked_add(1)
        .ok_or(Error::Overflow)?;
    set_writer_open(e, writer, next);
    Ok(())
}

/// One of `writer`'s options left state `Offered` (`buy`, `cancel_offer`, `reclaim`,
/// `prune_expired`): open count - 1. Going below zero would mean broken accounting, so it is
/// rejected as `Overflow` rather than stored.
fn writer_open_dec(e: &Env, writer: &Address) -> Result<(), Error> {
    let next = writer_open(e, writer)
        .checked_sub(1)
        .ok_or(Error::Overflow)?;
    set_writer_open(e, writer, next);
    Ok(())
}

/// Stellar `Asset` XDR of the classic asset `code`:`issuer` (v1.3 `list_asset`), or `InvalidArgs`
/// unless `code` is 1..=12 characters of `[A-Za-z0-9]` and `issuer` is an account (`G...`) address.
///
/// Built by hand because the XDR writer behind `soroban_sdk::xdr` is not available in a `no_std`
/// Wasm build: `AssetType` (1 = CREDIT_ALPHANUM4 for 1..=4 characters, 2 = CREDIT_ALPHANUM12 for
/// 5..=12), the code zero-padded to 4 or 12 bytes, then the issuer `AccountID` (a `PublicKey`
/// union: type 0 = ED25519, then the 32-byte key). The `AccountID` bytes are copied from the
/// issuer's own `ScVal` XDR, which for an account address is `ScVal::Address` (18),
/// `ScAddress::Account` (0), then that same `PublicKey`; a contract address (`ScAddress::Contract`
/// = 1, 40 bytes) is rejected.
fn asset_xdr(e: &Env, code: &String, issuer: &Address) -> Result<Bytes, Error> {
    let len = code.len();
    if len == 0 || len > MAX_CODE_LEN {
        return Err(Error::InvalidArgs);
    }
    let mut buf = [0u8; MAX_CODE_LEN as usize];
    code.copy_into_slice(&mut buf[..len as usize]);
    if !buf[..len as usize].iter().all(u8::is_ascii_alphanumeric) {
        return Err(Error::InvalidArgs);
    }
    let addr = issuer.clone().to_xdr(e);
    if addr.len() != 44
        || addr.slice(0..12) != Bytes::from_array(e, &[0, 0, 0, 18, 0, 0, 0, 0, 0, 0, 0, 0])
    {
        return Err(Error::InvalidArgs);
    }
    let (asset_type, code_bytes) = if len <= 4 { (1u8, 4) } else { (2u8, 12) };
    let mut asset = Bytes::from_array(e, &[0, 0, 0, asset_type]);
    asset.extend_from_slice(&buf[..code_bytes]);
    asset.append(&addr.slice(8..44));
    Ok(asset)
}

// ---------------------------------------------------------------------------------------------
// Contract (ABI §3)
// ---------------------------------------------------------------------------------------------

#[contract]
pub struct OptionsContract;

#[contractimpl]
impl OptionsContract {
    /// Runs once at deploy. Stores the quote SAC and the immutable underlying allowlist.
    /// Fails the deployment with `InvalidConfig` if `underlyings` is empty, has more than 8
    /// entries, contains duplicates, or contains `quote`. No admin, no upgrade path.
    pub fn __constructor(env: Env, quote: Address, underlyings: Vec<Address>) {
        let n = underlyings.len();
        if n == 0 || n > MAX_UNDERLYINGS || underlyings.contains(&quote) {
            panic_with_error!(&env, Error::InvalidConfig);
        }
        // Duplicate check: n <= 8, so the quadratic scan is bounded.
        for i in 0..n {
            for j in (i + 1)..n {
                if underlyings.get_unchecked(i) == underlyings.get_unchecked(j) {
                    panic_with_error!(&env, Error::InvalidConfig);
                }
            }
        }
        let storage = env.storage().instance();
        storage.set(&Key::Quote, &quote);
        storage.set(&Key::Underlyings, &underlyings);
        storage.set(&Key::Next, &0u32);
        storage.set(&Key::Open, &Vec::<u32>::new(&env));
        // v1.3: the asset registry starts with the constructor's underlyings, in order
        storage.set(&Key::AssetCount, &0u32);
        for underlying in underlyings.iter() {
            if let Err(err) = registry_push(&env, &underlying) {
                panic_with_error!(&env, err);
            }
        }
        bump_instance(&env);
    }

    /// Returns the immutable deployment configuration (quote SAC and the constructor-time
    /// underlyings; v1.3 clients read the full asset registry with `list_assets`).
    pub fn config(env: Env) -> Config {
        Config {
            quote: quote_addr(&env),
            underlyings: underlyings(&env),
        }
    }

    /// Writer funds a new offer. Pulls the collateral (PUT: `strike_total` quote; CALL: `qty`
    /// underlying) from the writer into the contract, stores the option as `Offered`, appends it to
    /// the open list and adds the collateral to the reserved total. Returns the new id.
    /// Check order: auth -> InvalidArgs (writer is the contract, v1.3) -> AssetNotAllowed (not in
    /// the registry) -> InvalidArgs -> TenorOutOfRange (v1.3) -> NotEligible (writer on underlying,
    /// then on quote) -> ContractNotAuthorized -> OpenListFull -> WriterOpenLimit (v1.3) ->
    /// CollateralShortfall -> transfers.
    #[allow(clippy::too_many_arguments)]
    pub fn create_offer(
        env: Env,
        writer: Address,
        underlying: Address,
        option_type: OptionType,
        qty: i128,
        strike_total: i128,
        premium_total: i128,
        expiry: u64,
    ) -> Result<u32, Error> {
        // auth
        writer.require_auth();
        // backstop: the contract is never a party (v1.3)
        let me = env.current_contract_address();
        if writer == me {
            return Err(Error::InvalidArgs);
        }
        // registry and arguments (the registry entry's TTL is extended on this path, v1.3)
        if !listed(&env, &underlying, true) {
            return Err(Error::AssetNotAllowed);
        }
        let now = env.ledger().timestamp();
        if qty <= 0 || strike_total <= 0 || premium_total <= 0 || expiry <= now {
            return Err(Error::InvalidArgs);
        }
        // tenor cap (v1.3)
        if expiry > now.checked_add(MAX_TENOR).ok_or(Error::Overflow)? {
            return Err(Error::TenorOutOfRange);
        }
        // eligibility: the writer on the underlying and on the quote token (it receives the
        // premium and CALL proceeds in quote), and the contract itself (it must be able to receive
        // the underlying: CALL collateral now, PUT delivery at exercise).
        let quote = quote_addr(&env);
        if !eligible(&env, &underlying, &writer) || !eligible(&env, &quote, &writer) {
            return Err(Error::NotEligible);
        }
        if !eligible(&env, &underlying, &me) {
            return Err(Error::ContractNotAuthorized);
        }
        // capacity: the open list lives in instance storage and is bounded
        if open_list(&env).len() >= MAX_OPEN {
            return Err(Error::OpenListFull);
        }
        // per-writer cap (v1.3)
        if writer_open(&env, &writer) >= MAX_OPEN_PER_WRITER {
            return Err(Error::WriterOpenLimit);
        }
        // solvency: no new exposure on a token whose pooled balance is below its reserved total
        check_collateral(&env, &quote, &underlying)?;

        let id: u32 = env.storage().instance().get(&Key::Next).unwrap_or(0);
        let next_id = id.checked_add(1).ok_or(Error::Overflow)?;
        let opt = OptionData {
            id,
            underlying: underlying.clone(),
            quote,
            option_type,
            qty,
            strike_total,
            premium_total,
            expiry,
            writer: writer.clone(),
            holder: None,
            state: State::Offered,
        };

        // transfers: lock the collateral in the contract
        let (c_token, c_amount) = collateral_of(&opt);
        TokenClient::new(&env, &c_token).transfer(&writer, &me, &c_amount);

        // storage
        add_reserved(&env, &c_token, c_amount)?;
        env.storage().instance().set(&Key::Next, &next_id);
        open_push(&env, id);
        writer_open_inc(&env, &writer)?;
        save_opt(&env, &opt);
        bump_instance(&env);

        // event
        OfferCreated {
            id,
            writer,
            underlying,
            option_type,
            qty,
            strike_total,
            premium_total,
            expiry,
        }
        .publish(&env);
        Ok(id)
    }

    /// Buyer purchases an `Offered` option before expiry. Pays the premium to the writer
    /// (PROVISIONAL policy), becomes the holder, and the option becomes `Active`. Reserved totals
    /// do not change (the collateral stays locked).
    /// Check order: auth -> InvalidArgs (buyer is the contract, v1.3) -> NotFound -> WrongState ->
    /// Expired -> SelfTrade -> NotEligible -> ContractNotAuthorized -> CollateralShortfall ->
    /// premium transfer.
    pub fn buy(env: Env, buyer: Address, id: u32) -> Result<(), Error> {
        // auth
        buyer.require_auth();
        // backstop: the contract is never a party (v1.3)
        if buyer == env.current_contract_address() {
            return Err(Error::InvalidArgs);
        }
        // NotFound -> state -> time -> self-trade -> eligibility -> solvency (ABI §3 `buy`)
        let mut opt = load_opt(&env, id)?;
        if opt.state != State::Offered {
            return Err(Error::WrongState);
        }
        if env.ledger().timestamp() >= opt.expiry {
            return Err(Error::Expired);
        }
        if buyer == opt.writer {
            return Err(Error::SelfTrade);
        }
        if !eligible(&env, &opt.underlying, &buyer) {
            return Err(Error::NotEligible);
        }
        // the issuer may have de-authorized the contract since the offer was created; the premium
        // is non-refundable, so do not sell an option the contract can no longer settle
        if !eligible(&env, &opt.underlying, &env.current_contract_address()) {
            return Err(Error::ContractNotAuthorized);
        }
        check_collateral(&env, &opt.quote, &opt.underlying)?;

        // transfers
        // PROVISIONAL: premium policy not yet specified by Dev 1 (ABI §3, §7.1). The premium is paid
        // buyer -> writer inside `buy`, is earned by the writer at purchase, and is never refunded by
        // the contract (not on worthless expiry, not if settlement later fails due to issuer action).
        TokenClient::new(&env, &opt.quote).transfer(&buyer, &opt.writer, &opt.premium_total);

        // storage
        opt.holder = Some(buyer.clone());
        opt.state = State::Active;
        open_remove(&env, id);
        writer_open_dec(&env, &opt.writer)?;
        save_opt(&env, &opt);
        bump_instance(&env);

        // event
        OptionBought {
            id,
            holder: buyer,
            premium_total: opt.premium_total,
        }
        .publish(&env);
        Ok(())
    }

    /// Holder exercises an `Active` option before expiry, atomically:
    /// PUT: holder delivers `qty` underlying to the contract, contract pays `strike_total` quote.
    /// CALL: holder pays `strike_total` quote to the contract, contract delivers `qty` underlying.
    /// The holder's payment always lands in the contract (never the writer), so a frozen writer
    /// cannot block the holder from being paid. The writer collects it later via `claim_delivery`.
    pub fn exercise(env: Env, holder: Address, id: u32) -> Result<(), Error> {
        // auth
        holder.require_auth();
        // backstop: the contract is never a party (v1.3)
        if holder == env.current_contract_address() {
            return Err(Error::InvalidArgs);
        }
        // NotFound -> ownership -> state -> time
        let mut opt = load_opt(&env, id)?;
        if opt.holder != Some(holder.clone()) {
            return Err(Error::NotHolder);
        }
        if opt.state != State::Active {
            return Err(Error::WrongState);
        }
        if env.ledger().timestamp() >= opt.expiry {
            return Err(Error::Expired);
        }

        // transfers: holder pays into the contract first, then the contract pays the holder
        let me = env.current_contract_address();
        let (c_token, c_amount) = collateral_of(&opt); // what the contract pays out
        let (p_token, p_amount) = proceeds_of(&opt); // what the holder pays in
        TokenClient::new(&env, &p_token).transfer(&holder, &me, &p_amount);
        TokenClient::new(&env, &c_token).transfer(&me, &holder, &c_amount);

        // storage: collateral leaves the reserve, the holder's payment becomes writer proceeds
        // PUT: quote -= strike_total; underlying += qty. CALL: underlying -= qty; quote += strike_total.
        sub_reserved(&env, &c_token, c_amount)?;
        add_reserved(&env, &p_token, p_amount)?;
        opt.state = State::Exercised;
        save_opt(&env, &opt);
        bump_instance(&env);

        // event
        OptionExercised { id, holder }.publish(&env);
        Ok(())
    }

    /// Writer withdraws an unsold (`Offered`) offer, before or after expiry. Returns the collateral,
    /// releases it from the reserve, removes the id from the open list; state becomes `Cancelled`.
    pub fn cancel_offer(env: Env, writer: Address, id: u32) -> Result<(), Error> {
        // auth
        writer.require_auth();
        // NotFound -> ownership -> state
        let mut opt = load_opt(&env, id)?;
        if opt.writer != writer {
            return Err(Error::NotWriter);
        }
        if opt.state != State::Offered {
            return Err(Error::WrongState);
        }

        // transfers
        let (c_token, c_amount) = collateral_of(&opt);
        TokenClient::new(&env, &c_token).transfer(
            &env.current_contract_address(),
            &writer,
            &c_amount,
        );

        // storage
        sub_reserved(&env, &c_token, c_amount)?;
        open_remove(&env, id);
        writer_open_dec(&env, &writer)?;
        opt.state = State::Cancelled;
        save_opt(&env, &opt);
        bump_instance(&env);

        // event
        OfferCancelled { id }.publish(&env);
        Ok(())
    }

    /// Writer reclaims the collateral of an `Offered` or `Active` option once `now >= expiry`.
    /// Releases it from the reserve, removes the id from the open list if it was `Offered`;
    /// state becomes `Expired`.
    pub fn reclaim(env: Env, writer: Address, id: u32) -> Result<(), Error> {
        // auth
        writer.require_auth();
        // NotFound -> ownership -> state -> time
        let mut opt = load_opt(&env, id)?;
        if opt.writer != writer {
            return Err(Error::NotWriter);
        }
        let was_offered = match opt.state {
            State::Offered => true,
            State::Active => false,
            _ => return Err(Error::WrongState),
        };
        if env.ledger().timestamp() < opt.expiry {
            return Err(Error::NotExpired);
        }

        // transfers
        let (c_token, c_amount) = collateral_of(&opt);
        TokenClient::new(&env, &c_token).transfer(
            &env.current_contract_address(),
            &writer,
            &c_amount,
        );

        // storage
        sub_reserved(&env, &c_token, c_amount)?;
        if was_offered {
            open_remove(&env, id);
            writer_open_dec(&env, &writer)?;
        }
        opt.state = State::Expired;
        save_opt(&env, &opt);
        bump_instance(&env);

        // event
        OptionReclaimed { id }.publish(&env);
        Ok(())
    }

    /// Writer collects the proceeds of an `Exercised` option (PUT: `qty` underlying; CALL:
    /// `strike_total` quote) from the contract; state becomes `Settled`. If the writer is frozen on
    /// the underlying the SAC transfer fails and the call reverts; the proceeds stay in the contract
    /// until the writer is re-authorized. Nothing else can move them.
    pub fn claim_delivery(env: Env, writer: Address, id: u32) -> Result<(), Error> {
        // auth
        writer.require_auth();
        // NotFound -> ownership -> state
        let mut opt = load_opt(&env, id)?;
        if opt.writer != writer {
            return Err(Error::NotWriter);
        }
        if opt.state != State::Exercised {
            return Err(Error::WrongState);
        }

        // transfers
        let (p_token, p_amount) = proceeds_of(&opt);
        TokenClient::new(&env, &p_token).transfer(
            &env.current_contract_address(),
            &writer,
            &p_amount,
        );

        // storage
        sub_reserved(&env, &p_token, p_amount)?;
        opt.state = State::Settled;
        save_opt(&env, &opt);
        bump_instance(&env);

        // event
        DeliveryClaimed { id }.publish(&env);
        Ok(())
    }

    /// v1.2. Holder hands an `Active` option to `to` before expiry. Only `holder` changes: the
    /// state stays `Active`, no tokens move (any payment for the position is settled outside this
    /// call), and collateral, reserved totals and the open list are untouched. The previous holder
    /// can no longer exercise.
    /// Check order: auth -> InvalidArgs (holder or to is the contract, v1.3) -> NotFound ->
    /// NotHolder -> WrongState -> Expired -> InvalidArgs (to == holder) -> SelfTrade (to == writer)
    /// -> NotEligible (to on the underlying).
    pub fn transfer(env: Env, holder: Address, to: Address, id: u32) -> Result<(), Error> {
        // auth
        holder.require_auth();
        // backstop: the contract is never a party (v1.3)
        let me = env.current_contract_address();
        if holder == me || to == me {
            return Err(Error::InvalidArgs);
        }
        // NotFound -> ownership -> state -> time
        let mut opt = load_opt(&env, id)?;
        if opt.holder != Some(holder.clone()) {
            return Err(Error::NotHolder);
        }
        if opt.state != State::Active {
            return Err(Error::WrongState);
        }
        if env.ledger().timestamp() >= opt.expiry {
            return Err(Error::Expired);
        }
        // recipient: not the holder itself, not the writer, and able to settle (deliver the
        // underlying for a PUT, receive it for a CALL)
        if to == holder {
            return Err(Error::InvalidArgs);
        }
        if to == opt.writer {
            return Err(Error::SelfTrade);
        }
        if !eligible(&env, &opt.underlying, &to) {
            return Err(Error::NotEligible);
        }

        // storage (no transfers)
        opt.holder = Some(to.clone());
        save_opt(&env, &opt);
        bump_instance(&env);

        // event
        OptionTransferred {
            id,
            from: holder,
            to,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns the stored option or `NotFound`. Pure read (no TTL change).
    pub fn get_option(env: Env, id: u32) -> Result<OptionData, Error> {
        load_opt(&env, id)
    }

    /// v1.2. The stored options with ids `from, from + 1, ...` in id order, stopping at
    /// `option_count()` and after at most `min(limit, MAX_PAGE)` entries. Empty when
    /// `from >= option_count()` or `limit == 0`. Pure read (no TTL change), never fails.
    /// Clients page with `from += returned.len()`.
    pub fn get_options(env: Env, from: u32, limit: u32) -> Vec<OptionData> {
        let count: u32 = env.storage().instance().get(&Key::Next).unwrap_or(0);
        let mut page = Vec::new(&env);
        for i in 0..limit.min(MAX_PAGE) {
            let id = match from.checked_add(i) {
                Some(id) if id < count => id,
                _ => break,
            };
            // Every id below `option_count` has a stored entry (options are never deleted), so
            // the `Err` arm is unreachable; stopping keeps the page a contiguous run of ids.
            match load_opt(&env, id) {
                Ok(opt) => page.push_back(opt),
                Err(_) => break,
            }
        }
        page
    }

    /// Ids in state `Offered`, oldest first. May include offers past expiry; clients filter by
    /// `expiry` before showing them as purchasable.
    pub fn list_open(env: Env) -> Vec<u32> {
        open_list(&env)
    }

    /// Number of options ever created (= next id).
    pub fn option_count(env: Env) -> u32 {
        env.storage().instance().get(&Key::Next).unwrap_or(0)
    }

    /// Units of `token` the contract must currently hold for non-terminal options: locked
    /// collateral of `Offered`/`Active` options plus unclaimed proceeds of `Exercised` options.
    /// Compare with the SAC `balance(contract)`: a lower balance means an issuer clawback hit the
    /// contract. Returns 0 for unknown tokens.
    pub fn open_collateral(env: Env, token: Address) -> i128 {
        reserved(&env, &token)
    }

    /// `true` iff the SAC at `token` reports `authorized(who) == true`; any SAC error is `false`.
    /// For a non-AUTH_REQUIRED asset this is `true` for every contract address and every `G`
    /// account with a trustline; a `G` account without a trustline is `false` (SAC #13).
    pub fn is_eligible(env: Env, token: Address, who: Address) -> bool {
        eligible(&env, &token, &who)
    }

    /// Anyone may call. Extends the contract instance and code TTL, and the persistent entry of
    /// every id in `ids` (`NotFound` for an unknown id, which reverts the whole call).
    pub fn extend_ttl(env: Env, ids: Vec<u32>) -> Result<(), Error> {
        for id in ids.iter() {
            let key = Key::Opt(id);
            if !env.storage().persistent().has(&key) {
                return Err(Error::NotFound);
            }
            env.storage()
                .persistent()
                .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        }
        bump_instance(&env);
        env.deployer()
            .extend_ttl(env.current_contract_address(), TTL_THRESHOLD, TTL_EXTEND_TO);
        Ok(())
    }

    /// v1.3. Permissionless listing of the classic Stellar asset `code`:`issuer` as an underlying.
    /// The address is derived, not supplied: the canonical SAC of `(code, issuer)` is computed with
    /// the deployer (`with_stellar_asset(..).deployed_address()`), so only a genuine Stellar asset
    /// can be listed and a custom token contract never can. Listing authorizes nothing: a regulated
    /// issuer must still authorize the escrow (`ContractNotAuthorized`) and each counterparty
    /// (`NotEligible`). Returns the SAC address.
    /// Check order: auth (accountability only; anyone may list) -> InvalidArgs (lister is the
    /// contract; code not 1..=12 of `[A-Za-z0-9]`; issuer not a `G...` account) ->
    /// AssetNotDeployed -> AlreadyListed (listed, or the quote token) -> storage -> event.
    pub fn list_asset(
        env: Env,
        lister: Address,
        code: String,
        issuer: Address,
    ) -> Result<Address, Error> {
        // auth
        lister.require_auth();
        // backstop: the contract is never a party
        if lister == env.current_contract_address() {
            return Err(Error::InvalidArgs);
        }
        // derive the canonical SAC address of (code, issuer)
        let sac = env
            .deployer()
            .with_stellar_asset(asset_xdr(&env, &code, &issuer)?)
            .deployed_address();
        // it must be deployed (anyone can deploy it once with `stellar contract asset deploy`)
        if !matches!(TokenClient::new(&env, &sac).try_decimals(), Ok(Ok(_))) {
            return Err(Error::AssetNotDeployed);
        }
        if listed(&env, &sac, false) || sac == quote_addr(&env) {
            return Err(Error::AlreadyListed);
        }

        // storage
        registry_push(&env, &sac)?;
        bump_instance(&env);

        // event
        AssetListed {
            sac: sac.clone(),
            code,
            issuer,
            lister,
        }
        .publish(&env);
        Ok(sac)
    }

    /// v1.3. Anyone may finish the bookkeeping of expired unsold offers; nobody can gain from it.
    /// No auth. For each id in order: `NotFound` (reverts the whole call) if unknown; skipped unless
    /// the option is `Offered` and `now >= expiry`. For each eligible id the collateral goes back to
    /// the **writer** with `try_transfer`; if that transfer fails (for example a writer frozen on a
    /// CALL's underlying) the id is skipped and nothing about it changes. Otherwise the collateral
    /// leaves the reserve, the id leaves the open list and the writer's open count, the state
    /// becomes `Expired`, and `OfferPruned` is published. Returns the number of options pruned.
    /// Live offers (`now < expiry`) are never touched; only the writer can `cancel_offer`.
    pub fn prune_expired(env: Env, ids: Vec<u32>) -> Result<u32, Error> {
        let me = env.current_contract_address();
        let now = env.ledger().timestamp();
        let mut pruned: u32 = 0;
        for id in ids.iter() {
            // NotFound -> state -> time (skips are not errors)
            let mut opt = load_opt(&env, id)?;
            if opt.state != State::Offered || now < opt.expiry {
                continue;
            }

            // transfers: collateral back to the writer; a failing transfer only skips this id
            let (c_token, c_amount) = collateral_of(&opt);
            if !matches!(
                TokenClient::new(&env, &c_token).try_transfer(&me, &opt.writer, &c_amount),
                Ok(Ok(()))
            ) {
                continue;
            }

            // storage
            sub_reserved(&env, &c_token, c_amount)?;
            open_remove(&env, id);
            writer_open_dec(&env, &opt.writer)?;
            opt.state = State::Expired;
            save_opt(&env, &opt);

            // event
            OfferPruned {
                id,
                pruner: me.clone(),
            }
            .publish(&env);
            pruned = pruned.checked_add(1).ok_or(Error::Overflow)?;
        }
        bump_instance(&env);
        Ok(pruned)
    }

    /// v1.3. `true` iff `token` is in the asset registry (constructor underlyings plus
    /// `list_asset`). Pure read (no TTL change).
    pub fn is_listed(env: Env, token: Address) -> bool {
        listed(&env, &token, false)
    }

    /// v1.3. Listed SAC addresses in listing order (constructor underlyings first), same paging
    /// rule as `get_options`: indices `from, from + 1, ...`, stopping at `asset_count()` and after
    /// at most `min(limit, MAX_PAGE)` entries. Empty when `from >= asset_count()` or `limit == 0`.
    /// Pure read (no TTL change), never fails.
    pub fn list_assets(env: Env, from: u32, limit: u32) -> Vec<Address> {
        let count = listed_count(&env);
        let mut page = Vec::new(&env);
        for i in 0..limit.min(MAX_PAGE) {
            let index = match from.checked_add(i) {
                Some(index) if index < count => index,
                _ => break,
            };
            // Every index below `asset_count` has a stored entry (the registry only grows), so the
            // `None` arm is unreachable; stopping keeps the page a contiguous run of indices.
            match env.storage().persistent().get(&Key::AssetAt(index)) {
                Some(token) => page.push_back(token),
                None => break,
            }
        }
        page
    }

    /// v1.3. Number of listed assets (constructor underlyings plus `list_asset`).
    pub fn asset_count(env: Env) -> u32 {
        listed_count(&env)
    }

    /// v1.3. Number of `writer`'s options currently in state `Offered` (0 if none).
    pub fn writer_open_count(env: Env, writer: Address) -> u32 {
        writer_open(&env, &writer)
    }
}

mod test;
