#![cfg(test)]
//! Minimal smoke test: one PUT happy path on an AUTH_REQUIRED underlying.
//! The full suite is owned by the test writer and replaces this file.

use super::*;
use soroban_sdk::{
    testutils::{Address as _, IssuerFlags, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env,
};

const UNIT: i128 = 10_000_000; // 7 decimals

#[test]
fn put_create_buy_exercise_claim() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);

    // USDx: unflagged quote token. RWA: AUTH_REQUIRED underlying from a separate issuer.
    let usdx = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let rwa = env.register_stellar_asset_contract_v2(Address::generate(&env));
    rwa.issuer().set_flag(IssuerFlags::RequiredFlag);
    let usdx_admin = StellarAssetClient::new(&env, &usdx.address());
    let rwa_admin = StellarAssetClient::new(&env, &rwa.address());
    let usdx_tok = TokenClient::new(&env, &usdx.address());
    let rwa_tok = TokenClient::new(&env, &rwa.address());

    let contract = env.register(OptionsContract, (usdx.address(), vec![&env, rwa.address()]));
    let client = OptionsContractClient::new(&env, &contract);

    let writer = Address::generate(&env);
    let holder = Address::generate(&env);
    rwa_admin.set_authorized(&writer, &true);
    rwa_admin.set_authorized(&holder, &true);

    let qty = 5 * UNIT;
    let strike_total = 50 * UNIT;
    let premium_total = 2 * UNIT;
    let expiry = 2_000u64;
    usdx_admin.mint(&writer, &strike_total);
    usdx_admin.mint(&holder, &premium_total);
    rwa_admin.mint(&holder, &qty);

    // The issuer has not authorized the contract on RWA yet.
    assert!(!client.is_eligible(&rwa.address(), &contract));
    assert_eq!(
        client.try_create_offer(
            &writer,
            &rwa.address(),
            &OptionType::Put,
            &qty,
            &strike_total,
            &premium_total,
            &expiry
        ),
        Err(Ok(Error::ContractNotAuthorized))
    );
    rwa_admin.set_authorized(&contract, &true);
    assert!(client.is_eligible(&rwa.address(), &contract));

    // create_offer: writer locks strike_total USDx in the contract.
    let id = client.create_offer(
        &writer,
        &rwa.address(),
        &OptionType::Put,
        &qty,
        &strike_total,
        &premium_total,
        &expiry,
    );
    assert_eq!(id, 0);
    assert_eq!(client.option_count(), 1);
    assert_eq!(client.list_open(), vec![&env, 0u32]);
    assert_eq!(client.get_option(&id).state, State::Offered);
    assert_eq!(usdx_tok.balance(&contract), strike_total);
    assert_eq!(usdx_tok.balance(&writer), 0);
    assert_eq!(client.open_collateral(&usdx.address()), strike_total);

    // buy: premium goes buyer -> writer (PROVISIONAL policy); option becomes Active.
    client.buy(&holder, &id);
    let opt = client.get_option(&id);
    assert_eq!(opt.state, State::Active);
    assert_eq!(opt.holder, Some(holder.clone()));
    assert_eq!(client.list_open(), vec![&env]);
    assert_eq!(usdx_tok.balance(&writer), premium_total);
    assert_eq!(usdx_tok.balance(&holder), 0);
    assert_eq!(client.open_collateral(&usdx.address()), strike_total);

    // exercise: holder delivers RWA to the contract, receives strike_total USDx.
    client.exercise(&holder, &id);
    assert_eq!(client.get_option(&id).state, State::Exercised);
    assert_eq!(rwa_tok.balance(&holder), 0);
    assert_eq!(usdx_tok.balance(&holder), strike_total);
    assert_eq!(rwa_tok.balance(&contract), qty);
    assert_eq!(usdx_tok.balance(&contract), 0);
    assert_eq!(client.open_collateral(&usdx.address()), 0);
    assert_eq!(client.open_collateral(&rwa.address()), qty);
    assert_eq!(
        client.try_exercise(&holder, &id),
        Err(Ok(Error::WrongState))
    );

    // claim_delivery: writer pulls the delivered RWA; option is Settled.
    client.claim_delivery(&writer, &id);
    assert_eq!(client.get_option(&id).state, State::Settled);
    assert_eq!(rwa_tok.balance(&writer), qty);
    assert_eq!(rwa_tok.balance(&contract), 0);
    assert_eq!(client.open_collateral(&rwa.address()), 0);
}
