# `options` contract ABI (locked)

**Status: LOCKED by Dev 2 on 2026-10-25 18:30 Lisbon; §6, §8 and §10 clarified 19:25 after static analysis; v1.1 hardening (error renumber 101+, two appended codes, three extra preconditions) decided 19:26, see §10; v1.2 additions (transfer, get_options, OptionTransferred, SEP-55 meta) decided 20:05, see §11; v1.3 (permissionless listing, per-writer cap, prune_expired, tenor cap, backstop) decided 22:10, see §12; v1.3.1 corrections (pruner argument, transfer guards, per-asset open books, keeper coverage) decided 2026-10-26 00:20, see §13.** This file is the data and function contract between the
Soroban contract (`contracts/options/`), the frontend (Dev 3) and the financial packages (Dev 1).
Workers must not rename, add, remove or reorder anything in sections 2–5 without asking Dev 2.
The compiled contract spec (`stellar contract bindings typescript`) is authoritative once deployed; any
difference between it and this file is a bug in one of them and must be fixed, not worked around.

Crate: `contracts/options` (package `options`, wasm `target/wasm32v1-none/release/options.wasm`).
Contract struct: `OptionsContract`. `#![no_std]`, `soroban-sdk = 28` (workspace), protocol 29 testnet.

## 1. Units, decimals, time

- Every amount is an exact `i128` in the token's smallest unit. All tokens here are Stellar Asset Contracts (SAC)
  wrapping classic assets, so **1 token = 10_000_000 units (7 decimals)**. Clients that need decimals read the
  SAC's `decimals()`; the contract never scales or divides.
- `qty` is the **total** underlying quantity of the option. `strike_total` is the **total** strike for the whole
  `qty`, in quote units. `premium_total` is the **total** premium, in quote units. There is no per-unit price
  on-chain; clients derive `strike_total / qty` only for display.
- `expiry` is a unix timestamp in seconds (`u64`), compared with `env.ledger().timestamp()`.
  "Before expiry" means `now < expiry`; "expired" means `now >= expiry`.
- No floating point, no oracle, no partial exercise, one position per funded offer, American style.

## 2. Types

```rust
#[contracttype] #[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OptionType { Put, Call }

#[contracttype] #[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum State {
    Offered,    // writer funded collateral, no holder yet; purchasable while now < expiry
    Active,     // bought; holder set; exercisable while now < expiry
    Exercised,  // holder exercised; writer's proceeds sit in the contract until claim_delivery
    Settled,    // writer claimed the proceeds (terminal)
    Expired,    // writer reclaimed collateral after expiry (terminal)
    Cancelled,  // writer withdrew the unsold offer (terminal)
}

#[contracttype] #[derive(Clone, Debug, Eq, PartialEq)]
pub struct OptionData {
    pub id: u32,
    pub underlying: Address,      // SAC of the tokenized asset (in the asset registry: constructor seed + list_asset since v1.3)
    pub quote: Address,           // SAC of the quote token (USDx), same for every option
    pub option_type: OptionType,
    pub qty: i128,                // total underlying quantity (> 0)
    pub strike_total: i128,       // total strike in quote units (> 0)
    pub premium_total: i128,      // total premium in quote units (> 0)
    pub expiry: u64,              // unix seconds
    pub writer: Address,          // market maker; receives premium, owes delivery
    pub holder: Option<Address>,  // None while Offered; Some(buyer) from Active on
    pub state: State,
}

#[contracttype] #[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub quote: Address,
    pub underlyings: Vec<Address>,   // immutable allowlist, 1..=8 entries
}

#[contracterror] #[derive(Copy, Clone, Debug, Eq, PartialEq)] #[repr(u32)]
pub enum Error {
    NotFound = 101,               // unknown option id
    InvalidArgs = 102,            // qty/strike_total/premium_total <= 0, or expiry <= now; v1.2: transfer to self (to == holder); v1.3: a party argument is the contract itself (backstop), or list_asset got a bad code or a non-account issuer
    AssetNotAllowed = 103,        // underlying not in the asset registry (constructor seed + list_asset since v1.3)
    NotEligible = 104,            // writer/buyer not authorized on the underlying SAC, or writer has no quote trustline (§6); v1.2: transfer recipient not authorized on the underlying
    ContractNotAuthorized = 105,  // the contract itself is not authorized to hold the underlying (checked at create_offer, buy and, v1.3.1, transfer)
    WrongState = 106,             // action not valid in the option's current State
    NotWriter = 107,              // caller is not the option's writer
    NotHolder = 108,              // caller is not the option's holder
    Expired = 109,                // buy/exercise after expiry; v1.2: transfer at or after expiry
    NotExpired = 110,             // reclaim before expiry
    SelfTrade = 111,              // writer tried to buy their own offer; v1.2: transfer to the writer
    Overflow = 112,               // checked i128 math failed
    InvalidConfig = 113,          // constructor: empty/duplicate/too many underlyings, or quote in underlyings
    OpenListFull = 114,           // create_offer: this underlying's open book already holds MAX_OPEN_PER_ASSET (500) Offered ids (v1.3.1; v1.1-v1.3: global MAX_OPEN = 1000)
    CollateralShortfall = 115,    // create_offer/buy and (v1.3.1) transfer: SAC balance(contract) < open_collateral(token) for a token of this option
    WriterOpenLimit = 116,        // v1.3 create_offer: this writer already has MAX_OPEN_PER_WRITER (50) offers in state Offered
    AlreadyListed = 117,          // v1.3 list_asset: the derived SAC is already listed (or is the quote token)
    AssetNotDeployed = 118,       // v1.3 list_asset: the canonical SAC for (code, issuer) is not deployed on this network
    TenorOutOfRange = 119,        // v1.3 create_offer: expiry > now + MAX_TENOR (2 years)
}
```

Codes start at 101 so they can never be confused with Stellar Asset Contract errors (SAC #1–#13, e.g. #10 insufficient
balance, #11 balance deauthorized, #13 trustline missing), which surface to clients through this contract unchanged.
**v1 (deployed 2026-10-25 19:06 UTC, `CDRS3BBF…L673`) used codes 1–13 with the same names and order; v1.1
(deployed 2026-10-25 19:38 UTC, `CBRTUM4NF5P5ENYSPPOTT3NMRCPT65QSKMD2BB3AJPLU2C4YCFOCMSQC`) renumbered once,
before any production use, and added 114/115.** Error codes are public ABI: never renumber. New codes append at the end.

Derived values (clients compute, contract does not store):

| | PUT | CALL |
|---|---|---|
| Collateral locked at `create_offer` | `strike_total` of `quote` | `qty` of `underlying` |
| Holder pays at `exercise` | `qty` of `underlying` → contract | `strike_total` of `quote` → contract |
| Holder receives at `exercise` | `strike_total` of `quote` | `qty` of `underlying` |
| Writer receives at `claim_delivery` | `qty` of `underlying` | `strike_total` of `quote` |

## 3. Functions

Rust signatures as compiled. Every state-changing function returns `Result<_, Error>`; views that cannot fail
return plain values. All token movements are SAC `transfer` calls; the contract is `env.current_contract_address()`.

```rust
pub fn __constructor(env: Env, quote: Address, underlyings: Vec<Address>);
pub fn config(env: Env) -> Config;
pub fn create_offer(env: Env, writer: Address, underlying: Address, option_type: OptionType,
                    qty: i128, strike_total: i128, premium_total: i128, expiry: u64) -> Result<u32, Error>;
pub fn buy(env: Env, buyer: Address, id: u32) -> Result<(), Error>;
pub fn exercise(env: Env, holder: Address, id: u32) -> Result<(), Error>;
pub fn cancel_offer(env: Env, writer: Address, id: u32) -> Result<(), Error>;
pub fn reclaim(env: Env, writer: Address, id: u32) -> Result<(), Error>;
pub fn claim_delivery(env: Env, writer: Address, id: u32) -> Result<(), Error>;
pub fn get_option(env: Env, id: u32) -> Result<OptionData, Error>;
pub fn list_open(env: Env) -> Vec<u32>;
pub fn option_count(env: Env) -> u32;
pub fn open_collateral(env: Env, token: Address) -> i128;
pub fn is_eligible(env: Env, token: Address, who: Address) -> bool;
pub fn extend_ttl(env: Env, ids: Vec<u32>) -> Result<(), Error>;
// v1.2 additions (see §11)
pub fn transfer(env: Env, holder: Address, to: Address, id: u32) -> Result<(), Error>;
pub fn get_options(env: Env, from: u32, limit: u32) -> Vec<OptionData>;
// v1.3 additions (see §12)
pub fn list_asset(env: Env, lister: Address, code: String, issuer: Address) -> Result<Address, Error>;
pub fn is_listed(env: Env, token: Address) -> bool;
pub fn list_assets(env: Env, from: u32, limit: u32) -> Vec<Address>;
pub fn asset_count(env: Env) -> u32;
pub fn prune_expired(env: Env, pruner: Address, ids: Vec<u32>) -> Result<u32, Error>;   // v1.3.1: pruner added
pub fn writer_open_count(env: Env, writer: Address) -> u32;
// v1.3.1 additions (see §13)
pub fn list_open_for(env: Env, asset: Address, from: u32, limit: u32) -> Vec<u32>;
```

Check order inside every state-changing function is fixed: **auth → NotFound → ownership (NotWriter/NotHolder)
→ state (WrongState) → time (Expired/NotExpired) → eligibility → transfers → storage → event.**
A failure anywhere reverts everything (transaction is the atomicity boundary).

### `__constructor(quote, underlyings)`
Runs once at deploy. Stores the quote SAC and the underlying allowlist. `InvalidConfig` (deploy fails) if
`underlyings` is empty, has more than 8 entries, contains duplicates, or contains `quote`.
**No admin, no upgrade.** The constructor seeds the asset registry; since v1.3 `list_asset` extends it permissionlessly (§12).

### `create_offer(writer, underlying, option_type, qty, strike_total, premium_total, expiry) -> id`
- `writer.require_auth()`.
- `InvalidArgs` if `writer == current_contract_address()` (v1.3 backstop; the same check applies to `buyer` in `buy`,
  `holder` in `exercise`/`transfer` and `to` in `transfer`).
- `AssetNotAllowed` unless `is_listed(underlying)` (v1.3: the registry seeded by the constructor and extended by `list_asset`;
  before v1.3 this was the constructor vector).
- `InvalidArgs` unless `qty > 0 && strike_total > 0 && premium_total > 0 && expiry > now`.
- `NotEligible` unless `is_eligible(underlying, writer)` **and** `is_eligible(quote, writer)` (a writer with no quote
  trustline could neither receive the premium nor claim CALL proceeds); `ContractNotAuthorized` unless
  `is_eligible(underlying, contract)` (an unauthorized contract could not receive the PUT delivery later).
- `TenorOutOfRange` if `expiry > now + MAX_TENOR` (v1.3; `MAX_TENOR = 63_072_000` seconds, 2 years). Checked right after
  `InvalidArgs`.
- `OpenListFull` if this underlying's open book already holds `MAX_OPEN_PER_ASSET = 500` ids (v1.3.1; before that, a single
  global list of `MAX_OPEN = 1000`).
- `WriterOpenLimit` if `writer_open_count(writer) >= MAX_OPEN_PER_WRITER = 50` (v1.3; checked right after `OpenListFull`).
- `CollateralShortfall` if, for the option's quote or underlying token, `balance(contract) < open_collateral(token)`
  (an earlier issuer clawback left a pooled deficit; no new exposure is accepted on that token, see §6).
- Pulls collateral from the writer: PUT `quote.transfer(writer, contract, strike_total)`;
  CALL `underlying.transfer(writer, contract, qty)`.
- Assigns `id = option_count()` (ids start at 0 and increase by 1), stores `OptionData { holder: None, state: Offered }`,
  adds `id` to the open list, adds the collateral to the reserved total of its token.
- Emits `OfferCreated`. Returns `id`.

### `buy(buyer, id)`
- `buyer.require_auth()`.
- `NotFound`, then `WrongState` unless `Offered`, then `Expired` unless `now < expiry`,
  then `SelfTrade` if `buyer == writer`, then `NotEligible` unless `is_eligible(underlying, buyer)`,
  then `ContractNotAuthorized` unless `is_eligible(underlying, contract)` (the issuer may have de-authorized the
  contract since the offer was created; the premium is non-refundable, so the buyer must not pay for an option that
  cannot settle), then `CollateralShortfall` if `balance(contract) < open_collateral(token)` for the option's quote
  or underlying token.
- **PROVISIONAL premium policy (Dev 1 has not specified premium timing/refund):**
  `quote.transfer(buyer, writer, premium_total)` inside `buy`. The premium is earned by the writer at purchase
  and is never refunded by the contract, including if the option expires worthless or settlement later fails
  because of issuer action. Marked `PROVISIONAL` in code; see §7.
- Sets `holder = Some(buyer)`, `state = Active`, removes `id` from the open list. Emits `OptionBought`.

### `exercise(holder, id)`
- `holder.require_auth()`.
- `NotFound`, then `NotHolder` unless `Some(holder) == option.holder`, then `WrongState` unless `Active`,
  then `Expired` unless `now < expiry`.
- PUT: `underlying.transfer(holder, contract, qty)` then `quote.transfer(contract, holder, strike_total)`.
  CALL: `quote.transfer(holder, contract, strike_total)` then `underlying.transfer(contract, holder, qty)`.
  The holder's payment always lands in the **contract**, never directly in the writer's account, so a frozen
  writer cannot block the holder from being paid.
- Reserved totals: PUT `quote -= strike_total; underlying += qty`. CALL `underlying -= qty; quote += strike_total`.
- `state = Exercised`. Emits `OptionExercised`. Double exercise fails with `WrongState`.

### `cancel_offer(writer, id)`
- `writer.require_auth()`; `NotFound`; `NotWriter`; `WrongState` unless `Offered` (allowed before or after expiry).
- Returns the collateral to the writer, subtracts it from the reserved total, removes `id` from the open list,
  `state = Cancelled`. Emits `OfferCancelled`.

### `reclaim(writer, id)`
- `writer.require_auth()`; `NotFound`; `NotWriter`; `WrongState` unless `Offered` or `Active`;
  `NotExpired` unless `now >= expiry`.
- Returns the collateral to the writer, subtracts it from the reserved total, removes `id` from the open list if it
  was `Offered`, `state = Expired`. Emits `OptionReclaimed`.

### `claim_delivery(writer, id)`
- `writer.require_auth()`; `NotFound`; `NotWriter`; `WrongState` unless `Exercised`.
- PUT `underlying.transfer(contract, writer, qty)`; CALL `quote.transfer(contract, writer, strike_total)`.
  Subtracts it from the reserved total, `state = Settled`. Emits `DeliveryClaimed`.
- If the writer is frozen on the underlying the SAC transfer fails and the whole call reverts; the proceeds stay in
  the contract and the writer retries once re-authorized. Nothing else can move them.

### `transfer(holder, to, id)` (v1.2)
- `holder.require_auth()`; `NotFound`; `NotHolder` unless `Some(holder) == option.holder`; `WrongState` unless `Active`;
  `Expired` unless `now < expiry`; `InvalidArgs` if `to == holder`; `SelfTrade` if `to == writer`;
  `NotEligible` unless `is_eligible(underlying, to)` (the new holder must be able to settle: deliver the underlying
  for a PUT, receive it for a CALL); then (v1.3.1) `ContractNotAuthorized` unless `is_eligible(underlying, contract)` and
  `CollateralShortfall` if `balance(contract) < open_collateral(token)` for the option's quote or underlying, so a
  position cannot be handed to a new participant while the escrow cannot settle it (§6).
- Sets `holder = Some(to)`. State stays `Active`; collateral, reserved totals and `list_open` are untouched.
  **No tokens move**: any payment for the position is settled outside this call (a separate quote-token payment, or a
  future on-chain position market). Emits `OptionTransferred`. The previous holder can no longer exercise.

### `list_asset(lister, code, issuer)` (v1.3)
Permissionless listing of a classic Stellar asset as an underlying. No admin anywhere.
- `lister.require_auth()` (accountability only; anyone may list).
- `InvalidArgs` unless `code` is 1–12 characters of `[A-Za-z0-9]` and `issuer` is an account (`G…`) address.
- Derives the **canonical SAC address** of the classic asset `(code, issuer)` with the SDK deployer
  (`env.deployer().with_stellar_asset(asset_xdr).deployed_address()`), so only a genuine Stellar asset can ever be listed;
  a custom or malicious token contract cannot be, because the address is computed, not supplied.
- `AlreadyListed` if the SAC is already in the registry, or if it is the quote token (checked before the deployment probe).
- `AssetNotDeployed` unless that SAC is deployed (probe with `token::Client::try_decimals`); anyone can deploy a SAC with
  `stellar contract asset deploy`, so this is a one-time prerequisite, not a permission.
- Stores `Key::Listed(sac) = true`, appends `Key::AssetAt(asset_count) = sac`, increments `asset_count`. Emits `AssetListed`.
  Returns the SAC address. Listing does **not** authorize anything: a regulated asset's issuer must still authorize the
  escrow contract (`ContractNotAuthorized` otherwise) and each counterparty (`NotEligible`).
- The quote token stays the constructor's `USDx`; per-offer quote tokens are not in v1.3.

### `prune_expired(pruner, ids)` (v1.3, signature corrected in v1.3.1)
Anyone may finish the bookkeeping of expired unsold offers; nobody can gain from it.
- `pruner.require_auth()` (accountability for the `OfferPruned` event only; any account may prune); backstop applies. For each id in order: `NotFound` if unknown; otherwise skipped (not an error) unless state is `Offered` and
  `now >= expiry`. For each eligible id: returns the collateral to the **writer** with `try_transfer`; if that transfer
  fails (writer frozen on a CALL's underlying) the id is skipped and nothing about it changes; otherwise reserved total −=
  collateral, `list_open` −= id, `writer_open_count(writer) −= 1`, `state = Expired`, event `OfferPruned { id, pruner }` with the authenticated `pruner`.
- Returns the number of options pruned. Live offers (`now < expiry`) are never touched; only the writer can `cancel_offer`.

### Views
- `is_listed(token)` (v1.3): `true` iff `token` is in the registry (constructor underlyings plus `list_asset`).
- `list_assets(from, limit)` (v1.3): registry addresses in listing order, same paging rule as `get_options`
  (`MAX_PAGE = 50`). `asset_count()`: number of listed assets. Clients should build their asset list from this, not
  from `config().underlyings`, which stays the constructor-time list for compatibility.
- `writer_open_count(writer)` (v1.3): number of this writer's options currently in state `Offered`.
- `get_options(from, limit)` (v1.2): the stored `OptionData` for ids `from, from+1, …` in id order, stopping at
  `option_count()` and after at most `min(limit, MAX_PAGE = 50)` entries. Returns an empty `Vec` when
  `from >= option_count()` or `limit == 0`. Never fails. Clients page with `from += returned.len()`.
- `get_option(id)`: the stored `OptionData` or `NotFound`. Pure read.
- `list_open_for(asset, from, limit)` (v1.3.1): ids in state `Offered` for one underlying, oldest first, paged (`MAX_PAGE`).
- `list_open()`: ids whose state is `Offered`, oldest first (v1.3.1: concatenation of the per-asset books of the **first
  `MAX_PAGE` (50) registry assets** in registry order, truncated to 200 ids, so its reads stay bounded under permissionless
  listing; books of later-listed assets are reachable only through `list_assets` + `list_open_for`, which clients must use
  for a complete view). May include offers past `expiry`; clients filter by
  `expiry` before showing them as purchasable. Since v1.3.1 the books are persistent per-asset lists capped at
  `MAX_OPEN_PER_ASSET` (§13); before that a single instance-storage list capped at 1000 (§10).
- `option_count()`: number of options ever created (next id).
- `open_collateral(token)`: total units of `token` the contract must currently hold for non-terminal options:
  locked collateral of `Offered`/`Active` options plus unclaimed proceeds of `Exercised` options. Clients compare
  it with the SAC `balance(contract)`; `balance < open_collateral` means an issuer clawback hit the contract.
  Returns 0 for unknown tokens.
- `is_eligible(token, who)`: `true` iff the SAC reports `authorized(who) == true`. Implemented with
  `StellarAssetClient::try_authorized`; a SAC error (for example a `G` account with no trustline, SAC error #13)
  returns `false`. What the SAC reports: the asset's **issuer** account is always authorized (it holds no trustline),
  so `is_eligible(token, issuer)` is `true`; any other `G` account needs an authorized trustline. A contract address
  reads its balance's `authorized` flag, or, with no balance yet, `true` unless the asset is AUTH_REQUIRED. So for an
  unflagged asset (`USDx`) every trustline holder, the issuer and every contract address read `true`, and only a
  non-issuer `G` account with no trustline reads `false`; on an AUTH_REVOCABLE asset a revoked trustline or contract
  balance reads `false`.
- `extend_ttl(ids)`: anyone may call. Extends the contract instance and code TTL and the persistent entry of every
  id in `ids` (`NotFound` for an unknown id); since v1.3.1 also each listed option's `Listed(underlying)`,
  `WriterOpen(writer)`, `OpenFor(underlying)`, `Reserved(quote)` and `Reserved(underlying)` entries, plus the first
  `MAX_PAGE` registry index entries (§13.5, §13.8). See §8.

## 4. Lifecycle

```
                     create_offer (writer locks collateral)
                                  │
                                  ▼
            cancel_offer ◄──── Offered ────► reclaim (now >= expiry) / prune_expired by anyone (v1.3)
             (Cancelled)          │                (Expired)
                                  │ buy (premium buyer → writer, PROVISIONAL)
                                  ▼
                               Active ──────► reclaim (now >= expiry)
                                  │   ↻ transfer (holder → new eligible holder, state stays Active, v1.2)
                                  │                (Expired)
                                  │ exercise (now < expiry; holder pays into contract,
                                  │           contract pays holder)
                                  ▼
                              Exercised
                                  │ claim_delivery (writer pulls proceeds)
                                  ▼
                               Settled
```

No other transition exists. In particular: no partial exercise, no `Impaired` state, no admin path, no upgrade.
Holder transfer (v1.2) changes `holder` without changing `state`.

## 5. Events (`#[contractevent]`, default topic = snake_case name, `#[topic]` fields follow)

```rust
pub struct OfferCreated   { #[topic] pub id: u32, pub writer: Address, pub underlying: Address, pub option_type: OptionType,
                            pub qty: i128, pub strike_total: i128, pub premium_total: i128, pub expiry: u64 }
pub struct OptionBought   { #[topic] pub id: u32, pub holder: Address, pub premium_total: i128 }
pub struct OptionExercised{ #[topic] pub id: u32, pub holder: Address }
pub struct OfferCancelled { #[topic] pub id: u32 }
pub struct OptionReclaimed{ #[topic] pub id: u32 }
pub struct DeliveryClaimed{ #[topic] pub id: u32 }
pub struct OptionTransferred { #[topic] pub id: u32, pub from: Address, pub to: Address }   // v1.2
pub struct AssetListed      { #[topic] pub sac: Address, pub code: String, pub issuer: Address, pub lister: Address }  // v1.3
pub struct OfferPruned      { #[topic] pub id: u32, pub pruner: Address }   // v1.3
```

## 6. Eligibility and issuer actions (what the contract does and does not promise)

- The demo underlyings (RWA, BOND, EQTY) are classic assets with `AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED`,
  exposed through their SAC. Since v1.3 anyone can list any classic asset; an unflagged asset needs no issuer action at
  all (everyone with a trustline is eligible, and the escrow is authorized by default). The quote token `USDx` has a
  separate issuer with no flags.
- **For an AUTH_REQUIRED underlying, the issuer must authorize the contract address on its SAC before any offer can be created**
  (`set_authorized(contract, true)`; verified in the spike, SAC error #11 otherwise). `scripts/setup-testnet` does it.
- Eligibility is the asset's own rule: `is_eligible` reads the SAC trustline authorization. The contract adds no
  KYC list of its own.
- Issuer freeze of the **holder** blocks that holder's `exercise` (SAC #11); after expiry the writer reclaims.
  Issuer freeze of the **writer** does not block `exercise` (payment lands in the contract); it blocks
  `claim_delivery`/`reclaim` of the underlying until re-authorized.
- Issuer clawback from the **contract** hits a **pooled** balance: the contract holds one SAC balance per token for
  every option on that token, and payouts (`exercise`, `reclaim`, `claim_delivery`) are not checked against a
  per-option backing. After a clawback, payouts keep succeeding first-come-first-served until the pooled balance
  runs out; the shortfall lands on whoever claims last, not on the option whose collateral was clawed. Nothing
  partial happens inside one call (a failing SAC transfer, #10, reverts the whole call). The deficit is visible as
  `open_collateral(token) > balance(contract)` and the UI must show it as a warning for **every** option on that
  token. While a deficit exists on a token, `create_offer` and `buy` involving that token fail with
  `CollateralShortfall`, so the hole cannot spread to new participants; existing positions keep settling
  first-come-first-served. There is **no** `Impaired` state, refund or pro-rata logic (AGENTS.md). `USDx` is
  unflagged, so PUT strike collateral is not exposed to clawback.
- Issuer de-authorization of the **contract address** itself blocks every SAC transfer into or out of the contract
  for that asset: PUT `exercise` and PUT `claim_delivery`, CALL `exercise` and CALL `reclaim` all fail until the
  issuer re-authorizes the contract. Writers can still `reclaim` PUT collateral (quote token) after expiry.
- The contract never claims to override issuer control. README and UI disclose this.
- **Open-list capacity.** `MAX_OPEN = 1000` bounded the single instance-storage open list in v1.1–v1.3 (removed in
  v1.3.1, see the end of this bullet). Since v1.3 each writer is also capped at
  `MAX_OPEN_PER_WRITER = 50` open offers, offers cannot expire more than `MAX_TENOR` (2 years) out, and anyone can
  `prune_expired` unsold expired offers (collateral always returns to the writer). Before v1.3 one issuer-authorized
  writer could fill the book with dust offers (finding F-1). v1.3 alone does **not** close it: with permissionless
  listing, sybil writers on a self-listed unflagged asset can fill the global list for free (F-1R). v1.3.1 (§13) moves
  the book to per-asset lists capped at `MAX_OPEN_PER_ASSET = 500`, so dust can only crowd out its own asset's book.

## 7. PROVISIONAL decisions and blocker questions for Dev 1 (`PRODUCT_SPEC.md` absent at lock time)

Implemented as follows until Dev 1 specifies otherwise. Changing any of them is an ABI/economics change that
goes through Dev 2.

1. **Premium timing/refund:** paid buyer → writer inside `buy`, non-refundable. (Code comment `PROVISIONAL`.)
2. **Self-trade:** the writer cannot buy their own offer (`SelfTrade`).
3. **Zero premium / zero strike:** rejected (`InvalidArgs`); all three amounts must be `> 0`.
4. **Expiry bounds:** `expiry > now` and, since v1.3, `expiry <= now + MAX_TENOR` (2 years); no minimum tenor.
5. **Unsold expired offers:** writer may use either `cancel_offer` or `reclaim`; both return the collateral.
6. **Impaired/refund logic:** not implemented (AGENTS.md: not approved until specified and proven).
7. **Holder transfer:** implemented in v1.2 as a free transfer to an eligible address (no payment leg). **Position token:** not implemented.

## 8. Storage and TTL

```rust
enum Key {
    Quote,              // instance: Address
    Underlyings,        // instance: Vec<Address>
    Next,               // instance: u32 (next id)
    Reserved(Address),  // persistent: i128 per token, v1.3.1 (was instance until v1.3); TTL extended on every state-changing path that touches it and by extend_ttl
    Opt(u32),           // persistent: OptionData
    OpenFor(Address),   // persistent: Vec<u32>, v1.3.1 per-asset open book (replaces instance Key::Open)
    Listed(Address),    // persistent: bool, v1.3 asset registry membership (seeded by the constructor)
    AssetAt(u32),       // persistent: Address, v1.3 registry index for paging
    AssetCount,         // instance: u32, v1.3
    WriterOpen(Address),// persistent: u32, v1.3 count of this writer's Offered options
}
const MAX_OPEN_PER_ASSET: u32 = 500;   // v1.3.1 cap per underlying's open book (v1.3 and before: global MAX_OPEN = 1000)
const MAX_PAGE: u32 = 50;          // get_options page cap (v1.2)
const MAX_OPEN_PER_WRITER: u32 = 50;   // v1.3
const MAX_TENOR: u64 = 63_072_000;     // v1.3, 2 years in seconds
const DAY_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * DAY_LEDGERS;
const TTL_EXTEND_TO: u32 = 30 * DAY_LEDGERS;
```

Instance storage holds only `Quote`, `Underlyings`, `Next` and `AssetCount` (v1.3.1); every other key is persistent.
Registry and per-writer entries get their TTL extended whenever they are read on a state-changing path (v1.3), and
`Reserved` entries whenever a state-changing path touches them (v1.3.1).
Every state-changing function extends the contract instance **and code** TTL (`instance().extend_ttl` does both
in soroban-sdk 28) and the touched option's persistent TTL with `(TTL_THRESHOLD, TTL_EXTEND_TO)`. `extend_ttl(ids)`
does the same for the instance/code and for every listed option, so a keeper can keep idle options alive.
Judging ends 2026-10-28; 30 days covers it. Testnet `max_entry_ttl` is 3,110,400 ledgers, so the values are legal.
TTL is never used as a security mechanism; `expiry` lives in the value.

## 9. Deployment and client notes

```sh
stellar contract build --package options --meta source_repo=github:mohamedkhellaf/hackmeridian   # SEP-55 metadata (v1.2+)
stellar contract deploy --wasm target/wasm32v1-none/release/options.wasm \
  --source-account <deployer> --network testnet --alias options \
  -- --quote <USDx SAC id> --underlyings '["<RWA SAC id>","<BOND SAC id>"]'
# then, from each regulated issuer, on each underlying SAC:
stellar contract invoke --id <RWA SAC id> --source-account <rwa-issuer> --network testnet \
  -- set_authorized --id <options contract id> --authorize true
stellar contract bindings typescript --network testnet --id options --output-dir <dir>
```

Generated TypeScript types: `i128`/`u64` → `bigint`, `u32` → `number`, `Address` → `string`,
`Option<Address>` → `Option<string>` in the bindings' types, but the SDK's spec decoder returns **`null`** for `None` at runtime (verified with stellar-sdk 17.3), so treat it as `string | null | undefined`; unit enums → `{ tag: "Put" | "Call", values: void }`
and `{ tag: State-name, values: void }`, `Result` → `Ok | Err` wrappers with the `Error` codes above.
Auth: every mutating call is signed by its first `Address` argument; SAC sub-invocations are added to the auth
tree by simulation (Freighter signs them with the transaction).

Demo asset plan (fictional, Testnet only): `USDx` (quote, unflagged issuer), `RWA` and `BOND` (underlyings,
one regulated issuer with `AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED`). The deployed IDs are recorded
in the **Deployed contracts** table of `AGENTS.md` (and in §2, §10 and `docs/contract-testnet-evidence.md`).

## 10. v1 → v1.1 hardening (decided 2026-10-25 19:26 Lisbon, which is UTC on that date, by Dev 2 after the P0 audit; deployed 19:38 UTC as `CBRTUM4NF5P5ENYSPPOTT3NMRCPT65QSKMD2BB3AJPLU2C4YCFOCMSQC`)

The deployed v1 (`CDRS3BBFHUTB66OBP6Z3744QM7C7XDXLV5ZJ5URSFTAQMBJQCMZTL673`, codes 1–13) passed the P0/P0+ testnet
smoke run and the 53-test suite. v1.1 changes, all reflected in §2, §3, §6 and §8 above:

1. **Error codes renumbered to 101–113** (same names/order) so SAC errors #10/#11/#13 can no longer be mistaken for
   `NotExpired`/`SelfTrade`/`InvalidConfig` by clients. Two codes appended: `OpenListFull = 114`,
   `CollateralShortfall = 115`.
2. **`MAX_OPEN = 1000`** open offers; `create_offer` returns `OpenListFull` beyond that. Closes the instance-storage
   bloat / fee-griefing path (audit finding, 64 KB entry limit at roughly 8,000 ids).
3. **Writer must be eligible on the quote token** at `create_offer` (`NotEligible`), so an offer cannot be listed by
   a writer who cannot receive the premium at creation time. The check is not repeated later: a writer can lose quote
   eligibility afterwards (for example by deleting a zero-balance `USDx` trustline), and the offer then stays in
   `list_open` while every `buy` fails in the premium transfer with a SAC error. `list_open` is not proof of
   executability; clients must simulate `buy` immediately before showing an offer as executable (RFQ truth rule).
4. **`buy` re-checks `is_eligible(underlying, contract)`** (`ContractNotAuthorized`): no non-refundable premium for an
   option the contract can no longer settle.
5. **`CollateralShortfall` guard on new exposure**: `create_offer` and `buy` fail while `balance(contract) <
   open_collateral(token)` for the option's quote or underlying token. Existing positions are unaffected (a full
   fail-closed guard on every payout remains a product decision for Dev 1, §6).

Not changed: function names, argument order, types, events, lifecycle (verified by diffing `stellar contract info
interface` of both wasms: only the Error enum differs). Frontend action: switch the contract id to the v1.1 id above and
key the error map by name (codes 101–115); everything else is unchanged. The v1 contract remains on testnet.

## 11. v1.2 additions (decided 2026-10-25 20:05 by Dev 2 with GO on P1 scope; deployed 2026-10-25 20:32 UTC as `CAJ2WJP4CUM2GGRB2A5P2M2H5GI45CTZSECV7SL3RTQMGYEKZ7ZDGBAX`)

Additive only: two functions, one event, one constant. No error code, type or existing signature changes.

1. **`transfer(holder, to, id)`** — P1 "transfer of option ownership" (§3, §4). Free transfer to an eligible new holder;
   no payment leg on-chain.
2. **`get_options(from, limit)`** — paged read (§3) so clients fetch the book in one or two simulations instead of 1+N.
3. **`OptionTransferred { id, from, to }`** event (§5).
4. **SEP-55 build metadata** `source_repo=github:mohamedkhellaf/hackmeridian` stamped into the wasm at build time (§9),
   readable with `stellar contract info meta --wasm …`.
5. **Operational scripts** (no contract change): `scripts/deploy/issuer-demo-testnet.sh` records the issuer-action
   failure modes of §6 on chain (freeze holder → exercise fails with SAC #11; de-authorize the contract → `buy` fails
   with #105; clawback from a throwaway deployment → `create_offer`/`buy` fail with #115 and `open_collateral >
   balance`, then issuer repair), and `scripts/deploy/extend-ttl.sh` calls `extend_ttl` over every non-terminal id
   (keeper).

Not in v1.2, deliberately: position token (second token system, untestable before freeze), impairment/refund logic
(economics unspecified, AGENTS.md precondition), partial exercise, multi-leg.

## 12. v1.3: open-book hardening and permissionless asset listing (decided 2026-10-25 22:10 by Dev 2; deployed 2026-10-25 23:06 UTC as `CAMY4ZKY7JLKZMONDOTVHDSXWLMDSLERFS7YJEH5JYZDIKV5HOAT2KRJ`)

Additive: six functions, two events, four error codes (116–119), one lifecycle edge, four storage keys. No existing
signature, type or event changes; `Config` keeps its constructor-time meaning.

1. **Permissionless listing** (`list_asset`, `is_listed`, `list_assets`, `asset_count`, event `AssetListed`): any classic
   Stellar asset becomes an eligible underlying by deriving its canonical SAC address on chain. The only permission that
   matters stays the issuer's (for flagged assets): it must authorize the escrow and the counterparties on its asset.
   Custom token contracts can never be listed. The frontend should read the asset list from `list_assets`.
2. **Per-writer open cap** (`WriterOpenLimit`, `writer_open_count`), **tenor cap** (`TenorOutOfRange`) and
   **`prune_expired`** (event `OfferPruned`): addresses finding F-1 for issuer-gated assets; the sybil variant F-1R
   remains until v1.3.1 (§6, §13).
3. **Backstop**: the contract's own address is rejected as any party (`InvalidArgs`); the host already rejects it, the
   contract now says so itself.
4. **Testnet demo**: a third fictional asset `EQTY` (tokenized equity label, same regulated issuer) is NOT in the
   constructor; the smoke run lists it with `list_asset`, the issuer authorizes the escrow, and a PUT on `EQTY` settles.

Deliberately not in v1.3: per-offer quote tokens (needs a `create_offer` signature change), delisting (no admin),
position token, impairment/refund, margin.

## 13. v1.3.1 corrections (decided 2026-10-26 00:20 by Dev 2 from the v1.3 gate; one redeploy; deployed 2026-10-26 00:50 UTC as `CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE`)

1. **`prune_expired(pruner, ids)`**: caller argument with `require_auth`, so `OfferPruned.pruner` is a real identity (v1.3
   emitted the contract's own address). Backstop applies to `pruner`.
2. **`transfer` gains the incoming-participant guards** `ContractNotAuthorized` and `CollateralShortfall` after
   `NotEligible` (§3). A frozen holder may still transfer (its own tokens never move).
3. **Per-asset open books** (fix for F-1R): `Key::OpenFor(asset)` persistent, capped at `MAX_OPEN_PER_ASSET = 500`;
   `OpenListFull` is per asset; new view `list_open_for(asset, from, limit)`; `list_open()` keeps its signature and returns
   the per-asset books of the first `MAX_PAGE` registry assets concatenated in registry order, truncated to 200 ids (bounded
   reads; complete views go through `list_assets` + `list_open_for`). Instance `Key::Open` and `MAX_OPEN` are removed.
4. **`list_asset` check order**: `AlreadyListed` before `AssetNotDeployed`.
5. **`extend_ttl(ids)`** also extends `Listed(option.underlying)`, `WriterOpen(option.writer)` and `OpenFor(option.underlying)`
   for each id, plus `AssetAt(0..min(asset_count, MAX_PAGE))` and their `Listed` entries (keeper coverage of the registry).
6. **`list_assets` order**: constructor underlyings in constructor order, then listings in `list_asset` order.
7. Doc corrections applied in the same change: §2 `AssetNotAllowed` comment, §3 constructor sentence, §6 regulated-only
   wording and F-1/F-1R status, §7.4 tenor bounds, §12 frontend wording. Completed after the v1.3.1 gate review (doc
   only, code unchanged): §2 `OptionData.underlying`, `InvalidArgs` (v1.3 backstop and `list_asset` input),
   `ContractNotAuthorized` and `CollateralShortfall` (also `transfer`), `OpenListFull` (per-asset 500) comments, the v1.2
   `transfer` meanings of `InvalidArgs`, `NotEligible`, `Expired` and `SelfTrade` restored, and the §6 open-list
   capacity sentence put in the past tense.
8. **`Reserved(token)` moves to persistent storage** (one entry per token, TTL extended on touch and by `extend_ttl` for
   the option's quote and underlying). Found by the v1.3 gate: with permissionless listing, per-token instance keys let
   anyone grow the single instance entry without bound.

No new error codes. Signature changes: `prune_expired` (new first argument), `list_open_for` added. Everything else is
unchanged. Deployment of v1.3.1 replaces the v1.3 id in the Deployed contracts table.
