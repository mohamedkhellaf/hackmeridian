# `options` contract ABI (locked)

**Status: LOCKED by Dev 2 on 2026-10-25 18:30 Lisbon; §6, §8 and §10 clarified 19:25 after static analysis; v1.1 hardening (error renumber 101+, two appended codes, three extra preconditions) decided 19:40, see §10.** This file is the data and function contract between the
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
    pub underlying: Address,      // SAC of the tokenized asset (allowlisted in the constructor)
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
    InvalidArgs = 102,            // qty/strike_total/premium_total <= 0, or expiry <= now
    AssetNotAllowed = 103,        // underlying not in the constructor allowlist
    NotEligible = 104,            // writer/buyer not authorized on the underlying SAC, or writer has no quote trustline (§6)
    ContractNotAuthorized = 105,  // the contract itself is not authorized to hold the underlying (checked at create_offer AND buy)
    WrongState = 106,             // action not valid in the option's current State
    NotWriter = 107,              // caller is not the option's writer
    NotHolder = 108,              // caller is not the option's holder
    Expired = 109,                // buy/exercise after expiry
    NotExpired = 110,             // reclaim before expiry
    SelfTrade = 111,              // writer tried to buy their own offer
    Overflow = 112,               // checked i128 math failed
    InvalidConfig = 113,          // constructor: empty/duplicate/too many underlyings, or quote in underlyings
    OpenListFull = 114,           // create_offer: MAX_OPEN (1000) offers are already in state Offered
    CollateralShortfall = 115,    // create_offer/buy: SAC balance(contract) < open_collateral(token) for a token of this option
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
```

Check order inside every state-changing function is fixed: **auth → NotFound → ownership (NotWriter/NotHolder)
→ state (WrongState) → time (Expired/NotExpired) → eligibility → transfers → storage → event.**
A failure anywhere reverts everything (transaction is the atomicity boundary).

### `__constructor(quote, underlyings)`
Runs once at deploy. Stores the quote SAC and the underlying allowlist. `InvalidConfig` (deploy fails) if
`underlyings` is empty, has more than 8 entries, contains duplicates, or contains `quote`.
**No admin, no upgrade, no way to change the allowlist after deploy.**

### `create_offer(writer, underlying, option_type, qty, strike_total, premium_total, expiry) -> id`
- `writer.require_auth()`.
- `AssetNotAllowed` unless `underlying` is in the allowlist.
- `InvalidArgs` unless `qty > 0 && strike_total > 0 && premium_total > 0 && expiry > now`.
- `NotEligible` unless `is_eligible(underlying, writer)` **and** `is_eligible(quote, writer)` (a writer with no quote
  trustline could neither receive the premium nor claim CALL proceeds); `ContractNotAuthorized` unless
  `is_eligible(underlying, contract)` (an unauthorized contract could not receive the PUT delivery later).
- `OpenListFull` if `list_open()` already holds `MAX_OPEN = 1000` ids.
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

### Views
- `get_option(id)`: the stored `OptionData` or `NotFound`. Pure read.
- `list_open()`: ids whose state is `Offered`, oldest first. May include offers past `expiry`; clients filter by
  `expiry` before showing them as purchasable. The list lives in instance storage, so it is bounded (see §10).
- `option_count()`: number of options ever created (next id).
- `open_collateral(token)`: total units of `token` the contract must currently hold for non-terminal options:
  locked collateral of `Offered`/`Active` options plus unclaimed proceeds of `Exercised` options. Clients compare
  it with the SAC `balance(contract)`; `balance < open_collateral` means an issuer clawback hit the contract.
  Returns 0 for unknown tokens.
- `is_eligible(token, who)`: `true` iff the SAC reports `authorized(who) == true`. Implemented with
  `StellarAssetClient::try_authorized`; a SAC error (for example a `G` account with no trustline, SAC error #13)
  returns `false`. For a non-AUTH_REQUIRED asset this is `true` for every account that holds a trustline and for
  every contract address; a `G` account with no trustline is still `false`.
- `extend_ttl(ids)`: anyone may call. Extends the contract instance and code TTL and the persistent entry of every
  id in `ids` (`NotFound` for an unknown id). See §8.

## 4. Lifecycle

```
                     create_offer (writer locks collateral)
                                  │
                                  ▼
            cancel_offer ◄──── Offered ────► reclaim (now >= expiry)
             (Cancelled)          │                (Expired)
                                  │ buy (premium buyer → writer, PROVISIONAL)
                                  ▼
                               Active ──────► reclaim (now >= expiry)
                                  │                (Expired)
                                  │ exercise (now < expiry; holder pays into contract,
                                  │           contract pays holder)
                                  ▼
                              Exercised
                                  │ claim_delivery (writer pulls proceeds)
                                  ▼
                               Settled
```

No other transition exists. In particular: no transfer of the holder position (P1), no partial exercise, no
`Impaired` state, no admin path, no upgrade.

## 5. Events (`#[contractevent]`, default topic = snake_case name, `#[topic]` fields follow)

```rust
pub struct OfferCreated   { #[topic] pub id: u32, pub writer: Address, pub underlying: Address, pub option_type: OptionType,
                            pub qty: i128, pub strike_total: i128, pub premium_total: i128, pub expiry: u64 }
pub struct OptionBought   { #[topic] pub id: u32, pub holder: Address, pub premium_total: i128 }
pub struct OptionExercised{ #[topic] pub id: u32, pub holder: Address }
pub struct OfferCancelled { #[topic] pub id: u32 }
pub struct OptionReclaimed{ #[topic] pub id: u32 }
pub struct DeliveryClaimed{ #[topic] pub id: u32 }
```

## 6. Eligibility and issuer actions (what the contract does and does not promise)

- Underlyings are classic assets with `AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED`, exposed through
  their SAC. The quote token `USDx` has a separate issuer with no flags.
- **The issuer must authorize the contract address on every underlying SAC before any offer can be created**
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

## 7. PROVISIONAL decisions and blocker questions for Dev 1 (`PRODUCT_SPEC.md` absent at lock time)

Implemented as follows until Dev 1 specifies otherwise. Changing any of them is an ABI/economics change that
goes through Dev 2.

1. **Premium timing/refund:** paid buyer → writer inside `buy`, non-refundable. (Code comment `PROVISIONAL`.)
2. **Self-trade:** the writer cannot buy their own offer (`SelfTrade`).
3. **Zero premium / zero strike:** rejected (`InvalidArgs`); all three amounts must be `> 0`.
4. **Expiry bounds:** only `expiry > now` is enforced; no minimum or maximum tenor.
5. **Unsold expired offers:** writer may use either `cancel_offer` or `reclaim`; both return the collateral.
6. **Impaired/refund logic:** not implemented (AGENTS.md: not approved until specified and proven).
7. **Holder transfer / position token:** not implemented (P1).

## 8. Storage and TTL

```rust
enum Key {
    Quote,              // instance: Address
    Underlyings,        // instance: Vec<Address>
    Next,               // instance: u32 (next id)
    Open,               // instance: Vec<u32> (ids in state Offered)
    Reserved(Address),  // instance: i128 per token (see open_collateral)
    Opt(u32),           // persistent: OptionData
}
const MAX_OPEN: u32 = 1000;        // cap on ids in Key::Open (instance storage is one 64 KB entry)
const DAY_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * DAY_LEDGERS;
const TTL_EXTEND_TO: u32 = 30 * DAY_LEDGERS;
```

Every state-changing function extends the contract instance **and code** TTL (`instance().extend_ttl` does both
in soroban-sdk 28) and the touched option's persistent TTL with `(TTL_THRESHOLD, TTL_EXTEND_TO)`. `extend_ttl(ids)`
does the same for the instance/code and for every listed option, so a keeper can keep idle options alive.
Judging ends 2026-10-28; 30 days covers it. Testnet `max_entry_ttl` is 3,110,400 ledgers, so the values are legal.
TTL is never used as a security mechanism; `expiry` lives in the value.

## 9. Deployment and client notes

```sh
stellar contract build --package options
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
one regulated issuer with `AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED`). The deployed IDs live only
in the **Deployed contracts** table of `AGENTS.md`.

## 10. v1 → v1.1 hardening (decided 2026-10-25 19:40 by Dev 2 after the P0 audit; deployed 19:38 UTC as `CBRTUM4NF5P5ENYSPPOTT3NMRCPT65QSKMD2BB3AJPLU2C4YCFOCMSQC`)

The deployed v1 (`CDRS3BBFHUTB66OBP6Z3744QM7C7XDXLV5ZJ5URSFTAQMBJQCMZTL673`, codes 1–13) passed the P0/P0+ testnet
smoke run and the 53-test suite. v1.1 changes, all reflected in §2, §3, §6 and §8 above:

1. **Error codes renumbered to 101–113** (same names/order) so SAC errors #10/#11/#13 can no longer be mistaken for
   `NotExpired`/`SelfTrade`/`InvalidConfig` by clients. Two codes appended: `OpenListFull = 114`,
   `CollateralShortfall = 115`.
2. **`MAX_OPEN = 1000`** open offers; `create_offer` returns `OpenListFull` beyond that. Closes the instance-storage
   bloat / fee-griefing path (audit finding, 64 KB entry limit at roughly 8,000 ids).
3. **Writer must be eligible on the quote token** at `create_offer` (`NotEligible`), so no unbuyable offers appear in
   `list_open` (RFQ truth rule).
4. **`buy` re-checks `is_eligible(underlying, contract)`** (`ContractNotAuthorized`): no non-refundable premium for an
   option the contract can no longer settle.
5. **`CollateralShortfall` guard on new exposure**: `create_offer` and `buy` fail while `balance(contract) <
   open_collateral(token)` for the option's quote or underlying token. Existing positions are unaffected (a full
   fail-closed guard on every payout remains a product decision for Dev 1, §6).

Not changed: function names, argument order, types, events, lifecycle (verified by diffing `stellar contract info
interface` of both wasms: only the Error enum differs). Frontend action: switch the contract id to the v1.1 id above and
key the error map by name (codes 101–115); everything else is unchanged. The v1 contract remains on testnet.
