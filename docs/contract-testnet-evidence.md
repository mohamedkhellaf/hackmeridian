# Options contract: testnet evidence

Stellar **testnet** only (protocol 29). Every hash below was confirmed `successful: true` on Horizon
(`https://horizon-testnet.stellar.org/transactions/<hash>`). Amounts are 7-decimal units. Roles are disposable
testnet identities created by `scripts/setup-testnet/`; their public keys are in the Deployed contracts table of
`AGENTS.md` and in the git-ignored `scripts/out/testnet.env`. Re-run everything with `scripts/deploy/smoke-testnet.sh`.

## v1 deployment (2026-10-25 19:06 UTC)

| Item | Value |
|---|---|
| Options contract | `CDRS3BBFHUTB66OBP6Z3744QM7C7XDXLV5ZJ5URSFTAQMBJQCMZTL673` |
| Deploy (constructor) tx | `99b73e89e0877b3b5bbb5ff00e241d2fba65353a698f448a8cb9de5250a3afbb` (ledger 5386325) |
| Wasm upload tx / sha256 | `318ca322ad0b59985e176f31e12f7ba94520dad6cfe0612110eb3d4f8df78df2` / `365d694fec8d38314a49a8a6912fd39e91149574ad8a20e2376c32def8fef08d` |
| RWA SAC (`AUTH_REQUIRED, AUTH_REVOCABLE, AUTH_CLAWBACK_ENABLED`) | `CCVYWYG56YL7VA7A3EKVJKAKZC4O2B6YXV6UJMERG2NYC7HJHELJLR7U` |
| BOND SAC (same flags, same issuer) | `CADCBCQ7TU5XCGPYDD32HANAVEWWDARGKIKXWF5YK7NTFOLAWGQYQGHP` |
| USDx SAC (quote, unflagged issuer) | `CAKXMQVKSW2AEKF5DSMDPHJAYGNVOQANHXLI64QJS2H3GOCXRW2GCICU` |
| Issuer authorizes the contract on RWA / BOND | `0ca32b636a77eb80272b0efa6264be0fd3c62f8018cd97b06ea688babda11c9d` / `6b28b50360db9168f6fe00c109368987c51bb06aca9c2d016bffe1ddd94cad57` |

## P0: cash-secured PUT on RWA (option #0)

maker1 writes a PUT on 5 RWA, total strike 50 USDx, premium 1 USDx, expiry +1 h. investor buys and exercises.

| Step | Effect | Tx |
|---|---|---|
| `create_offer` (maker1) | maker1 −50 USDx; contract +50 USDx; `open_collateral(USDx)` 0 → 50 | `d370b8d4e38112920e25bb07b36e4a8d2dc32ef49441adeba7521e5c49aaa4bc` |
| `buy` (investor) | investor −1 USDx → maker1 +1 USDx (premium, PROVISIONAL policy); state `Active` | `de90b8943bf2e2d5ea196cca5c4965c44e423b862161571127cce5742abd7326` |
| `exercise` (investor) | investor −5 RWA, +50 USDx; contract +5 RWA, −50 USDx, in one transaction | `51a62995e43dd898d718f7761683ccb06035fb00411e5ec39b39eba785b9a39c` |
| `claim_delivery` (maker1) | maker1 +5 RWA; contract 0 / 0; state `Settled` | `68223be68ad9f7bc07f9c1c51e5892411cae02194b5e00fe81ff8da989867f41` |

Rejected in simulation (no fee spent, nothing moved), each with the expected contract error (v1 codes):
maker2 exercising investor's option → `NotHolder` #8 · second exercise → `WrongState` #6 · reclaim before expiry →
`NotExpired` #10 · maker2 cancelling maker1's offer → `NotWriter` #7 · unauthorized account buying → `NotEligible` #4 ·
USDx as underlying → `AssetNotAllowed` #3 · qty 0 → `InvalidArgs` #2 · writer buying own offer → `SelfTrade` #11.

## Expiry and competition

| Step | Tx |
|---|---|
| PUT #1 with expiry +45 s: `create_offer` | `e4c19632c6c8830d3f4e1452d1a6533066d44ff4fc6bbbae104ee7c7709e592e` |
| `buy` after expiry → `Expired` #9 (simulation) | — |
| `reclaim` (maker1): +50 USDx back, state `Expired` | `a67c645e12a34fd630cf493d3511f612f8a1aaf6fc2e57961b260ab94eb90e2d` |
| Competing offers: maker1 #2 (premium 1 USDx), maker2 #3 (premium 0.8 USDx); `list_open` = [1, 2, 3] | `31abfb469b89afebc629069c08de5cafad3acb44e640f3c1bd9c953b894a45fe`, `19d96bae5796a3311e97133cfde160ad3f7f29f74cb69f68c946984b9c6ec6bc` |
| `cancel_offer` by maker1 (#2), then maker2 (#3) | `9c1df84978a0b74723b2a02698d25d17a4639a190a338cb70162357de7235e6d`, `f5e34a08c665b6ed6595ff335ee9ea4cef12b7e4f7b86556b5a8ca71ea888895` |

## P0+: covered CALL on RWA (option #4) and PUT on BOND (option #5), same contract

| Flow | create / buy / exercise / claim_delivery |
|---|---|
| CALL, 3 RWA, strike 30 USDx, premium 0.5 USDx. Exercise: investor −30 USDx +3 RWA; claim: maker1 +30 USDx | `8ffa710f0b06465deebe69ea2e7dce774a02939848076cd6351d1ccb345fe56a` / `7eec0329955a1cacfb0c06c17fc6e6d0c7ce3870c7f73cc3dc12fc8dde5aae6d` / `de2c1dd25e082d04213ed31446220f0ffc4409e2081a7df385efcf5db30d5739` / `c0fff233d50ad0cefd3184ba5cae5d38738ede1f73ff96323e9ad1e82eaa678a` |
| BOND PUT, same amounts as #0 | `f234615a52dcd68ddeb6260c95f63d2f47431b953a7826e6a6786abe0c9fabc0` / `34dbb72a58b8d8ab71c77a8dc523a36125c9657f90bf9e03d5afed53b2db8914` / `8f4375bede5e142b34b136e6b22c4ba04e6c964e760ab8b40a7204209adb4f7d` / `ded6fccbbc757722a2fe76b174fb1cd76089e530c6ab3d592f256bef528553ab` |

The full run (`scripts/deploy/smoke-testnet.sh`) passed twice: P0 36/36 checks, P0+ 24/24, including balance deltas
and `open_collateral` at every step; the contract ended at balance 0 and `open_collateral` 0 for all three tokens.

## Off-chain assurance on the same code

- 53 unit tests (`contracts/options/src/test.rs`), 5 property tests over 256 random operation sequences with a
  reference model of the ABI (`contracts/options/tests/invariants.rs`; 2,000-case run also clean).
- Mutation sweep: 21 of 22 mutants killed; the survivor is an equivalent mutant (redundant code-TTL extension).
- 4-lens audit with adversarial refutation, CoinFabrik Scout, clippy pedantic, cargo audit: no authorization, arithmetic
  or state-machine defect. Confirmed limitations and the v1.1 hardening are in `docs/contract-abi.md` §6 and §10.

## What this does not show

Issuer freeze and clawback were exercised in unit and property tests, not in these on-chain runs (the spike on
2026-10-25 did exercise them on testnet, see `research/decision/20_rwa_options_spike.md`). Testnet resets quarterly;
nothing here is durable, and none of it involves real assets.
