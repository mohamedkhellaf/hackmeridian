//! Strata `options` contract: fully collateralized, physically settled calls and puts on
//! allowlisted Stellar Asset Contract (SAC) underlyings, quoted in one SAC quote token (USDx).
//!
//! The ABI in `docs/contract-abi.md` is LOCKED; this file implements it exactly.
//!
//! Design summary (see the ABI for the full rules):
//! - The contract holds all collateral itself and tracks, per token, how much it must hold
//!   (`Key::Reserved`). PUT collateral = `strike_total` of quote; CALL collateral = `qty` of underlying.
//! - Lifecycle: Offered -> Active -> Exercised -> Settled, or Offered -> Cancelled,
//!   or Offered/Active -> Expired (reclaim after expiry). No other transition exists.
//! - No admin, no upgrade, immutable allowlist set in the constructor.
//! - Check order in every state-changing function:
//!   auth -> NotFound -> ownership -> state -> time -> eligibility -> transfers -> storage -> event.
//!   `create_offer` and `buy` add two guards between eligibility and transfers: the open-list cap
//!   (`create_offer` only, `OpenListFull`) and the pooled-collateral check (`CollateralShortfall`).
//!   Any failure reverts the whole invocation (the transaction is the atomicity boundary).
//! - All amounts are exact `i128` token units; every addition/subtraction is checked.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    token::{StellarAssetClient, TokenClient},
    Address, Env, Vec,
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
    /// Immutable allowlist, 1..=8 entries.
    pub underlyings: Vec<Address>,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// Unknown option id.
    NotFound = 101,
    /// qty/strike_total/premium_total <= 0, or expiry <= now.
    InvalidArgs = 102,
    /// Underlying not in the constructor allowlist.
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

// ---------------------------------------------------------------------------------------------
// Storage keys (ABI §8)
// ---------------------------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
enum Key {
    /// instance: Address of the quote SAC.
    Quote,
    /// instance: Vec<Address> underlying allowlist.
    Underlyings,
    /// instance: u32, next option id (= option_count).
    Next,
    /// instance: Vec<u32>, ids in state Offered, oldest first.
    Open,
    /// instance: i128 per token, units the contract must hold for non-terminal options.
    Reserved(Address),
    /// persistent: OptionData.
    Opt(u32),
}

// ---------------------------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------------------------

/// Quote SAC address. Set by the constructor, so the unwrap cannot fail on a deployed instance.
fn quote_addr(e: &Env) -> Address {
    e.storage().instance().get(&Key::Quote).unwrap()
}

/// Underlying allowlist. Set by the constructor, so the unwrap cannot fail on a deployed instance.
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
        bump_instance(&env);
    }

    /// Returns the immutable deployment configuration (quote SAC and underlying allowlist).
    pub fn config(env: Env) -> Config {
        Config {
            quote: quote_addr(&env),
            underlyings: underlyings(&env),
        }
    }

    /// Writer funds a new offer. Pulls the collateral (PUT: `strike_total` quote; CALL: `qty`
    /// underlying) from the writer into the contract, stores the option as `Offered`, appends it to
    /// the open list and adds the collateral to the reserved total. Returns the new id.
    /// Check order: auth -> AssetNotAllowed -> InvalidArgs -> NotEligible (writer on underlying,
    /// then on quote) -> ContractNotAuthorized -> OpenListFull -> CollateralShortfall -> transfers.
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
        // allowlist and arguments
        if !underlyings(&env).contains(&underlying) {
            return Err(Error::AssetNotAllowed);
        }
        if qty <= 0 || strike_total <= 0 || premium_total <= 0 || expiry <= env.ledger().timestamp()
        {
            return Err(Error::InvalidArgs);
        }
        // eligibility: the writer on the underlying and on the quote token (it receives the
        // premium and CALL proceeds in quote), and the contract itself (it must be able to receive
        // the underlying: CALL collateral now, PUT delivery at exercise).
        let me = env.current_contract_address();
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
    /// Check order: auth -> NotFound -> WrongState -> Expired -> SelfTrade -> NotEligible ->
    /// ContractNotAuthorized -> CollateralShortfall -> premium transfer.
    pub fn buy(env: Env, buyer: Address, id: u32) -> Result<(), Error> {
        // auth
        buyer.require_auth();
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

    /// Returns the stored option or `NotFound`. Pure read (no TTL change).
    pub fn get_option(env: Env, id: u32) -> Result<OptionData, Error> {
        load_opt(&env, id)
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
}

mod test;
