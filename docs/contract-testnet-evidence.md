# Options contract: testnet evidence

Stellar **testnet** only (protocol 29). Every hash below was confirmed `successful: true` on Horizon
(`https://horizon-testnet.stellar.org/transactions/<hash>`). Amounts are 7-decimal units. Roles are disposable
testnet identities created by `scripts/setup-testnet/`; their public keys are listed below (also in the git-ignored
`scripts/out/testnet.env`). Re-run everything with `scripts/deploy/smoke-testnet.sh`.

Strata Pro (EXPERIMENTAL, separate contract `CBZNS63L23N3Y3GHU6H57AU6OVZ3FOAPM7Z54ATDRC472Q5DWV6UVKCN`): its deployment and
full Testnet evidence run (list_series → … → claim, every tx hash) are in `docs/pro-testnet-evidence.md`.

## Roles (testnet public keys, no secrets)

| Role (CLI identity) | Public key |
|---|---|
| deployer (`strata-deployer`) | `GBVPEL6MT4IZ4XL5J7TTMB3GND7TPRS54KOJTUFCUOVFVFPZKE5HDA73` |
| rwa-issuer (`strata-rwa-issuer`), issues RWA and BOND | `GCNWQR5OA24X7LPTCXUEL4V4ZLSIFKUNIEZEO3UVCVXECPPGX7ERFDGM` |
| usdx-issuer (`strata-usdx-issuer`), issues USDx | `GAE6ONGU5S3JHDBR5Z3BUVXCL4WLEHQVLBDNTCKHKOYFBYBPBW4IARFS` |
| maker1 (`strata-maker1`) | `GDNPA7N3WIUJLR6TJ2Z2EO3MXFWWZPN4D6P2L4YHSX3M4PZVTKMWDJCI` |
| maker2 (`strata-maker2`) | `GC27F4643RPJT6WCZUD5AFC3PCXRZNE3FGNOBCBOSTGFC37IVVSD55ZE` |
| investor (`strata-investor`) | `GAXXQZK5RJRZZH3QDMVWFBRWL45CWHZZZXI4PQSAVPAWKILQJYHBJAR5` |
| outsider (`strata-outsider`), not authorized on RWA/BOND | `GAP7GDJ372IX2VTGCBIYAS3H3YIGGKH623FGLWCFPSD6INFBFQUB4VPA` |

Each flow transaction's Horizon `source_account` is the role named in its row.

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

## v1.1 deployment (2026-10-25 19:38 UTC): hardening redeploy

Same functions, types and events as v1; `Error` codes 101–113 (same names and order) plus `OpenListFull = 114` and
`CollateralShortfall = 115`; three extra preconditions (`docs/contract-abi.md` §10).

| Item | Value |
|---|---|
| Options contract v1.1 | `CBRTUM4NF5P5ENYSPPOTT3NMRCPT65QSKMD2BB3AJPLU2C4YCFOCMSQC` |
| Wasm upload / deploy tx | `a06877d96b18bc2805e72148fbcc85a755c575fb7af3128d9c6295b0f0976da1` / `a7ed7420db6be3d6a88ceebf7f54cdd4f44300df3c9ce7bcf744f6ed75911c08` (ledger 5386703) |
| Wasm sha256 (fetched back from chain, matches) | `cd2ddf0cecd12cbd70bffbee3f7a1e061a8bd6a432693e0c4d0cccae55d45659` |
| Issuer authorizes the contract on RWA / BOND | `b5e81ad95611e45aeaf39e631cafef4609ee922f78c6e12ad96c3fbd757271a7` / `7e1030432773012fd670de07cec9176fc8526a020f94f56da81f6bb78e1976ac` |

Smoke run against v1.1 (`scripts/deploy/smoke-testnet.sh`, log `smoke-20261025T193854Z`): PRE 6/6, P0 36/36, P0+ 24/24.

| Flow | create / buy / exercise / claim_delivery |
|---|---|
| P0 PUT on RWA (#0) | `261a96fd943a116be96211b63af3827a2ef7b8b87f6df82fdfd70e0a36c29e38` / `1e6b03406331f4dccf4d23a7f6cc8346a4a65fa62b61018f892ace1569552b40` / `45141e2cf008c292c73811f0e458fcab3a394a070b2c4b856201f51879c0d5b8` / `65ffc1fdf8e99acf204bee6f040fbbf4b9e510a04e9e8cb690e9b33dedce12aa` |
| P0+ CALL on RWA (#4) | `6e0b113a9e1d36e097891a3f4ea23fcdfea10c0fd5e0c6c20f9aeb369563674c` / `8329023a32a72000eaed3b525fa5c7fb55c12b9bf4c04cd0a297497420ac3769` / `79fec39db0e8786b97b74c301adcbf22f279feed5ba38ce8397437674e070be4` / `89f48a0a6668094d7fe229ba3430e48d4ea6952c13d5f67489c3ab0e39a23e70` |
| P0+ PUT on BOND (#5) | `88954ba2deec4e59146a00336d308364919bf5d7bc53cf357a6557f003caf657` / `f73444dfa471a8c61f513bc990f959675db05192ec248917f651e5a6ce437bd9` / `6f3c32827f0a2938da5e9ff267c8a09606ddbd1bba8d2927b7a4ff77cad2ad03` / `ad82ea44f1aee456fee41f5a28f657fb0919e2fabac97263c641884aa7eeb085` |

| Step | Tx |
|---|---|
| Expiry path (#1): create; buy after expiry → `Expired` #109 (simulation); reclaim | `3f447fc5da6e98f8b64cc82446bd6e509fa2bdf6109af8f9dca97959ebbb67d6`; `cbc47a635e40ae8fd78e41a606019fc094a3eb1539e5fbae5f921493c6956bc0` |
| Competition (#2 maker1, #3 maker2), then both cancelled | `a4944fcf7c4cd414de1d77501a5bb92bb0e7b92e6c04c96802693cb0f71aec97`, `9aa2bc734a8eaec66b5edef086e1ed8397fb238df41e6d5f715bb417c35050e0`; `112f4fd1b1dfca14727a57411576ad30b7d0b01a4c930a2fa6ba2d16f6b804fd`, `43d70339b66598ba65235d9dca69b40a43111429f1f0ab9a737118557328b55f` |
| Extra: maker1 creates #6, then tries to buy it → `SelfTrade` #111 (simulation); cancels #6 | `b31f7da1857d54834cdbfe7f18a308966a2096cc8823e08e9e55496397375f48`; `b79efdd7db82d0e467284f7520f65179e09f12c213058f61f819a20b1b423fb5` |

Expected failures, all rejected in simulation with the v1.1 code: `SelfTrade` #111, `NotHolder` #108, `NotExpired` #110,
`WrongState` #106, `AssetNotAllowed` #103, `InvalidArgs` #102, `NotWriter` #107, `NotEligible` #104, `Expired` #109.
`is_eligible`: contract true on RWA and BOND; investor true; outsider false; USDx: maker1 true, an account with no
USDx trustline false. `get_option(999)` → `NotFound` #101. State after the run: `option_count` 7, `list_open` [].

## Issuer actions on chain (v1.1, 2026-10-25 20:23 UTC)

Run 2 of `scripts/deploy/issuer-demo-testnet.sh` against v1.1 `CBRTUM4NF5P5ENYSPPOTT3NMRCPT65QSKMD2BB3AJPLU2C4YCFOCMSQC`:
PRE 6/6, A1 12/12, A2 9/9, A3 12/12, B 14/14, CLEANUP 5/5. The script (and `scripts/deploy/extend-ttl.sh`) land with
PR #29. These are the issuer-action limits of `docs/contract-abi.md` §6 recorded on chain:
the issuer of a regulated underlying can block settlement, and the contract does not promise otherwise.

**A1: holder frozen on RWA (option #10).**

| Step | Tx |
|---|---|
| `create_offer` (maker1) / `buy` (investor) | `236705cfd6bce3f9d99ad5ea9ce4c30eedcc3fd94f4d2cc812e99f27d1c47610` / `a2454e92d17850553e1dcfa5ef124d372c92735774efe28066702d563866bf8b` |
| Issuer `set_authorized(investor, false)` on RWA | `b102fb5ce9692a2ea639ab12c952bb1683430f06147f3f0adc8c6b0a07b7f109` |
| `exercise` (investor) → SAC `Error(Contract, #11)` "balance is deauthorized" (simulation) | — |
| Issuer re-authorizes the investor | `2913a99b5591d6e853795b15678b18d447d423a3b6719dfe60e36ffc8a5993e2` |
| `exercise` (investor) / `claim_delivery` (maker1) | `eda08cfc379c8a4d905e4b84cd2c017c52f445a2520e9d90402bc2438813171f` / `5ddce495e5c9a4673bb84f5e385a574a14a9e5c78db7ac03def71b792f15f4cc` |

**A2: contract de-authorized on RWA (option #11).**

| Step | Tx |
|---|---|
| `create_offer` (maker1) | `e5a1469b767bfe3506af6c8677f7cd7b8bb496ee87c874da235a44688ece0bf1` |
| Issuer `set_authorized(contract, false)` on RWA; `is_eligible(RWA, contract)` = false | `3625e2c6ba941d412c5332c94fcc20b473b4e62848c9982680e5e430f7b3ae0c` |
| `buy` (investor) → `ContractNotAuthorized` #105 (simulation): no premium paid for an unsettleable option | — |
| `cancel_offer` (maker1): the writer's USDx comes back in full | `b59cdfde9297e61f2dc77d6fbe7625e2df007e2127d097acd917d433ff29dddc` |
| Issuer re-authorizes the contract | `c24eb6b53e6218c7dce4178fde43472edac653372008e8995e507d715ad5414f` |

**A3: writer frozen on RWA (option #12, written by maker2).**

| Step | Tx |
|---|---|
| `create_offer` (maker2) / `buy` (investor) | `75717b947d28b9e347dcb96e91c1a6aa9ac030e5c291a8fd72b1171d94bc422c` / `b78534fdb92abf4e98f913c6083c47babbe7a919386ab0a4f3dda76bca666935` |
| Issuer freezes maker2 on RWA | `106f4cba163c59538abd986b709006368f9e298fb35c0428ab9448ed9e26a3b7` |
| `exercise` (investor) **succeeds** while the writer is frozen: investor +20 USDx, −2 RWA | `f4081a18e1147ae490a18563569c94ef1625fcec1ff7d4fec2f520cd1440ef0c` |
| `claim_delivery` (maker2) → SAC #11 (simulation); the delivered RWA stays in the contract | — |
| Issuer unfreezes maker2 / `claim_delivery` (maker2) | `7fdfc101114c460bacd9114be523ca3c2d348f7437199d72c49b019873523746` / `003f8b7c55e4e618822a25ec34c5fe8ff39afe3e2e1562915b3dee5accd90443` |

A frozen writer does not block payment to the holder (AGENTS.md requirement).

**B: clawback from the contract, on a throwaway instance** `CCLESNOFSQRXIURARMBB35F6DVOQHW2LX5OUABQTWWJWLPY2D5UUAAIW`
(never the main contract).

| Step | Tx |
|---|---|
| Deploy the throwaway instance (strata-deployer) | `47c0f6aeb39dfc7a537e2e811878aecb03d1ee6b6d2de62459a037b0c8a8fa3e` |
| Issuer authorizes it on RWA / BOND | `3149b9345d6882a95b698110489a1809e6816e4c7a977cc7eedc616399fce3fd` / `1c5fc7a9738071ff9a37c72f4dda1a860f9c7bd72487a1e2412718314a0c751e` |
| CALL `create_offer` (maker1), 3 RWA locked | `0d09943f18ac181ee78edde9c58d989cbd6e9c7a0ecf5fd52aac9e66f0ed9929` |
| Issuer claws back 1 RWA from the contract: `open_collateral(RWA)` 30000000 vs balance 20000000 | `bb50cb292b9c8e232cad662150ad6b4f880431141cd1dea169af97a9ee5dcb32` |
| `buy` (investor) and a maker2 CALL `create_offer` → `CollateralShortfall` #115 (simulation) | — |
| BOND PUT `create_offer` (maker1) still succeeds (other tokens unaffected) | `6c014e01bf911312c4f6f80fec5b4af348e7a463089884f492ab13e1cde81dc8` |
| Issuer repairs with a SAC transfer of 1 RWA to the contract (balance = `open_collateral` again) | `6b9cb686e7e95fe4a7a921f2a8f6c33c3a3a308abda530a89e69fefd01a703ba` |
| `buy` (investor) then succeeds | `5b3c19dde1f2f19b15d38ef15b064c4ae0addcbbe785629b45c6fe3d972ac379` |

Keeper: `extend_ttl([])` on the v1.1 main contract (strata-deployer):
`7b56bb6eea75ea3f11d9e3f011f8749c5cd42a0b82f27ce65c9ac75bd71d77fd`.

## v1.2 deployment (2026-10-25 20:32 UTC): holder transfer and paged reads

Additive over v1.1 (`docs/contract-abi.md` §11): `transfer(holder, to, id)`, `get_options(from, limit)` and the
`OptionTransferred` event. Diffing `stellar contract info interface` of the v1.1 and v1.2 wasms, both fetched from
chain, shows only those two functions and the event; no error code, type or existing signature changed.

| Item | Value |
|---|---|
| Options contract v1.2 | `CAJ2WJP4CUM2GGRB2A5P2M2H5GI45CTZSECV7SL3RTQMGYEKZ7ZDGBAX` |
| Wasm upload / deploy tx | `d33c758499d296688c6afa6fe35bf382f0ffde6475756d67cd341ab4d12ee849` / `b111b2e00a55a88eefb9cb8f08be9e3971f63d308f76f149962c85a3cee7911b` (ledger 5387355) |
| Wasm sha256, 20,051 bytes (fetched back from chain, byte-identical to the local build) | `8778dc772bcde8e5727d58d4db0e02c73cded318af8a599dec47e68ba1de422f` |
| Issuer authorizes the contract on RWA / BOND | `3e9d8d578e2ffb2627d9a3d9e234054f7248a81641897bff4674e7cb3f3029e3` / `948b79d9b613f809040ea7b6bd1fb4dd72126a467d9a08ddcd6090a64cbc435c` |
| Keeper `extend_ttl([])` (strata-deployer) | `25af83bfe2e3e56ff54211f5189445b8dc4debf2614db0d01cbf3668e05a14df` |

Built with `stellar contract build --package options --meta source_repo=github:mohamedkhellaf/hackmeridian`
(stellar-cli 28.1.0). `stellar contract info meta --wasm` on the wasm fetched from chain:

```
 • rsver: 1.99.1 (Rust version)
 • rssdkver: 28.0.0#48d506712f964094d14176e2f0b02afcd1054567 (Soroban SDK version and its commit hash)
 • rssdk_spec_shaking: 2
 • cliver: 28.1.0#c0f4d0da891bbf214c08b8c5035ae6db80e9a3bd
 • source_repo: github:mohamedkhellaf/hackmeridian
```

Smoke run against v1.2 (`scripts/deploy/smoke-testnet.sh`, log `smoke-20261025T204030Z`): PRE 6/6, P0 36/36,
P0+ 24/24, V1.2 26/26.

**Holder transfer (option #6).** maker1 writes a PUT on 5 RWA, total strike 50 USDx, premium 1 USDx, expiry +1 h.

| Step | Effect | Tx |
|---|---|---|
| `create_offer` (maker1) | maker1 −50 USDx; contract +50 USDx; `open_collateral(USDx)` 0 → 50 | `1b53d4b7d002a1e1a69a0506952d5a2ddce26bcaf848227563c1ab233ad2eb6a` |
| `buy` (investor) | investor −1 USDx → maker1 +1 USDx; state `Active`, holder investor | `d195fb7e332552d6e9037bab665716fbc277e6f36f030bdf29cb3cd5371a85d9` |
| `transfer` investor → maker2 (investor) | holder maker2, state `Active`; no balance and no `open_collateral` change; event `OptionTransferred { id: 6, from: investor, to: maker2 }` | `f010361da30a286e44d4ee6b57c75ebe4e37fc7e8f585f0075ff7d0e76f3ca07` |
| `exercise` (maker2) | maker2 −5 RWA, +50 USDx; contract +5 RWA, −50 USDx | `fca3afe3497ded4827267ca85629cc762498d5def5bcfd230d5e61814efcebc1` |
| `claim_delivery` (maker1) | maker1 +5 RWA; contract 0 / 0; state `Settled`, holder still maker2 | `781741997bf5939c86c48b2e9ccea37dd23290975d06ef7402f425cc87eda834` |

Rejected in simulation, each with the expected code: transfer of the `Offered` option → `NotHolder` #108 · transfer by
maker1 (the writer, not the holder) → `NotHolder` #108 · investor to itself → `InvalidArgs` #102 · investor to maker1
(the writer) → `SelfTrade` #111 · investor to outsider (not authorized on RWA) → `NotEligible` #104 · investor
exercising after the transfer → `NotHolder` #108 · maker2 transferring after exercise → `WrongState` #106.

**Paged reads** after the run (`option_count` 7): `get_options(0, 3)` → 3 entries, ids [0, 1, 2];
`get_options(7, 5)` → `[]`; `get_options(0, 1000)` → 7 entries (at most `MAX_PAGE` = 50).

**Earlier flows, re-run on v1.2:**

| Flow | create / buy / exercise / claim_delivery |
|---|---|
| P0 PUT on RWA (#0) | `9223699da99cdf5974d6cfd4d693c2149570544c34e4a63cdf8418fa450208bf` / `a6294a6595ff4b77448f1b57b546e160ab2b7c0fac89aca01c476be0cd4673cc` / `df44d1ef987a676e7a4ec0aa660fff1308b25c2b062954395fa4105e133fed2e` / `e487b120560ca4a65adab5b780c7cb6e5c5e6de08c7ff0e89867581a8c8c22bf` |
| P0+ CALL on RWA (#4) | `0f1aa879b4dba93127407383bc6e701e95bc9e4fce71e90c5b1235ec67ab24cb` / `18738e9fb74d8a9b0234deb38d37de4d0722d49dcdbd69b9a09ecc9b1d80e7a3` / `6df4269cd9d346f0ddee7de55901a720ccc4705da2c7ffcffe06b70c0778a653` / `d89f56a606af86f27e573af346ff2f205038e0184137c5dd181bbfeb81fa3a5f` |
| P0+ PUT on BOND (#5) | `fb88e709f897e9f44c47cf4b9a8115c74717df7bd751b37e862ae1c2c9a433bc` / `9457d775f79c4a457edea1f5109dae6ed1e9dde79dfa822fa5d814300f1006d7` / `6ae6df670be64b7061f96e79250bf265375a7df05afcdd0b03379c7798d5f61f` / `18070ad60659ee5cfef95d35e6a74a544ad37ebe5333a1b1490764c17d133967` |

| Step | Tx |
|---|---|
| Expiry path (#1): create; buy after expiry → `Expired` #109 (simulation); reclaim | `562fce16dfdc3dd83e4964552aaa75c7edca62e8db695c0fad7d029ef6d342fd`; `5f2f4b7882e4df8a72909059908458a522d3af4da4f28aabea91a21f7559377a` |
| Competition (#2 maker1, #3 maker2), then both cancelled | `2275ee06cf3816c36c501c921dc0bc82a494a4564f079571239204a38a5d0404`, `9f7dce74c1d8fcf6b352d896bceb7d82d76a3dc2a2dc86e97f4cafceba13bd97`; `ba9240728422ac0056606db0f78b33fd9047cb67d632730b356dbf683cd40121`, `f2cbd5e3059829972a5763e1a4870d7b1f18bdaa07ece61a4ad473477c1fc759` |

Expected failures of the P0 sections, all rejected in simulation with the same codes as on v1.1: `SelfTrade` #111,
`NotHolder` #108, `NotExpired` #110, `WrongState` #106, `AssetNotAllowed` #103, `InvalidArgs` #102, `NotWriter` #107,
`NotEligible` #104, `Expired` #109. State after the run: `option_count` 7, `list_open` [], contract balance 0 and
`open_collateral` 0 for USDx, RWA and BOND.

## v1.3 deployment (2026-10-25 23:06 UTC): permissionless listing, per-writer cap, prune_expired, tenor cap

Additive over v1.2 (`docs/contract-abi.md` §12). Diffing `stellar contract info interface` of the v1.2 and v1.3
wasms, both fetched from chain, only adds lines; nothing is removed or changed. The added lines are six functions
(`list_asset`, `is_listed`, `list_assets`, `asset_count`, `prune_expired`, `writer_open_count`), the error codes
`WriterOpenLimit` 116, `AlreadyListed` 117, `AssetNotDeployed` 118 and `TenorOutOfRange` 119, and two events:
`AssetListed { sac, code, issuer, lister }` and `OfferPruned { id, pruner }`.

| Item | Value |
|---|---|
| Options contract v1.3 | `CAMY4ZKY7JLKZMONDOTVHDSXWLMDSLERFS7YJEH5JYZDIKV5HOAT2KRJ` |
| Constructor | `quote` = USDx SAC, `underlyings` = [RWA SAC, BOND SAC]. EQTY is left out on purpose |
| Wasm upload / deploy tx | `7ab77c564edfd0d93cbb6dd932b9ea7a1c40e246729157272dd91e0089ce232e` / `d3a267f92b1c48f166ef4904ee6f7ee281b7c3d5d8a6fd02889495f323eea350` (ledgers 5389203 / 5389204) |
| Wasm sha256, 26,966 bytes (fetched back from chain; identical to the local build of `c3db0a6`) | `fdd6fc161533586d07779b4455dfd4f33cd17b21ecff282e63236a84f59697e6` |
| Issuer authorizes the contract on RWA / BOND (`deploy.sh`) | `d625ef80af95fbf22eff796cab64c059ef5877f2f667bbf437241f06df71a629` / `7c59c5a8947508b34222ea32845773913a78985ae049dcd6226d475f4a189b70` |
| EQTY SAC (`EQTY:GCNW…FDGM`, fictional tokenized-equity label; same issuer and flags as RWA and BOND) | `CDBHRGVHB2NVKJCM5ZKBTUQ3RQHZUZJSSEZLATIUROWXNIEFZ7T7NIFU` |

Built with `stellar contract build --package options --meta source_repo=github:mohamedkhellaf/hackmeridian`
(stellar-cli 28.1.0). Output of `stellar contract info meta --wasm` on the wasm fetched from chain:

```
 • rsver: 1.99.1 (Rust version)
 • rssdkver: 28.0.0#48d506712f964094d14176e2f0b02afcd1054567 (Soroban SDK version and its commit hash)
 • rssdk_spec_shaking: 2
 • cliver: 28.1.0#c0f4d0da891bbf214c08b8c5035ae6db80e9a3bd
 • source_repo: github:mohamedkhellaf/hackmeridian
```

Smoke runs against v1.3 (`scripts/deploy/smoke-testnet.sh`):

- Run 1, log `smoke-20261025T230723Z`: PRE 6/6, P0 36/36, P0+ 24/24, V1.2 26/26, V1.3 53/53. One check was
  skipped: the writer cap only runs with `--full`. Horizon confirms all 34 transactions of the run as successful.
- Run 2, `--full`, log `smoke-20261025T231908Z`: PRE 6/6, P0 36/36, V1.2 26/26, V1.3 53/53 including the four writer-cap checks. Two checks were
  skipped: `V13_LIST` and `V13_FAIL_CONTRACT_NOT_AUTHORIZED` are one-time steps that run 1 already did. P0+ passed
  17 of 21. The CALL path stopped after `buy` of option #14, because the snapshot could not read balances: the host
  disk was full (`tr: write error: No space left on device` in the script's temp files). This was a local read
  failure, not a contract result, and it left #14 `Active`. The investor then exercised #14 and maker1 claimed it by
  hand (`105e501e41e4d1384ec69e499037fff16beb5c94a3fb2407b2607e370a56c378`,
  `d05dcd3a3f885a331b336156a999c6ee7e66d95ab208d3d5dab419431664a9b7`). Horizon confirms all 132 transactions as
  successful: 130 from the run and the 2 sent by hand.

**Permissionless listing of EQTY.** EQTY is not in the constructor. Before listing, `is_listed(EQTY)` was `false` and
`asset_count` was 2.

| Step | Effect | Tx |
|---|---|---|
| `list_asset(maker1, "EQTY", rwa-issuer)`, sent by maker1 (no admin) | Returns `CDBHRG…NIFU`, the canonical SAC address of `EQTY:GCNW…FDGM` derived on chain. Event `AssetListed { sac: CDBHRG…NIFU, code: "EQTY", issuer: GCNW…FDGM, lister: maker1 }`. `asset_count` goes from 2 to 3 | `5b90b69e71a78640c4603621b8f3dfcd86aaac2d724277db3c759c391bdc2899` |
| `create_offer` PUT on EQTY before the issuer authorizes the escrow | `ContractNotAuthorized` #105 (simulation): listing authorizes nothing | — |
| Issuer `set_authorized(contract, true)` on the EQTY SAC (strata-rwa-issuer) | `is_eligible(EQTY, ·)`: contract `true`, maker1 `true`, investor `true`, outsider `false` | `d1563c4cca55d81d159445ef09781979fb5494e5010df70597b2f8bc2b764850` |
| EQTY PUT (#8): `create_offer` (maker1), `buy` (investor), `exercise` (investor), `claim_delivery` (maker1); same amounts as P0 (5 EQTY, total strike 50 USDx, premium 1 USDx) | Same balance and `open_collateral` deltas as the RWA PUT, checked at every step | `10ac795670485ddb93497cb0882590ccc08cd1940965343e7762a0ab1fd3857a` / `b070407a4c1ffa92d16d61d4b91df8f2d99087b1083832072f2013f7e6f324c8` / `b6f047042127767f47d9a49dae6014b710f9881b83b1b67f481cc2456d2ac645` / `993cd4ad4ea78abcd29371e5529eb1fd53f01a15d287b62278a5af55ac102849` |

State after listing:
- `list_assets(0, 50)` = [RWA `CCVY…LR7U`, BOND `CADC…QGHP`, EQTY `CDBH…NIFU`], in that order.
- `list_assets(2, 50)` = [EQTY] and `list_assets(3, 5)` = [].
- `is_listed(EQTY)` = `true` and `is_listed(USDx)` = `false`.
- `config().underlyings` is still [RWA, BOND].

**`prune_expired` (option #7).** maker1 writes a PUT on 5 RWA (total strike 50 USDx) with expiry +45 s, and nobody
buys it. `writer_open_count(maker1)` goes from 0 to 1.

| Step | Effect | Tx |
|---|---|---|
| `create_offer` (maker1), expiry +45 s | maker1 −50 USDx, contract +50 USDx | `963395e6008a80a57170fcb1b91ba031f4259f4b729a4ac3a1f96d313b4b052a` |
| After expiry, `prune_expired([7])` sent by **maker2** (not the writer) | Returns 1. maker1 +50 USDx, contract −50 USDx, `open_collateral(USDx)` −50. State `Expired`; #7 leaves `list_open`; `writer_open_count(maker1)` goes from 1 to 0. Event `OfferPruned { id: 7, pruner: CAMY…2KRJ }` | `e970a1203fa31a5f5c96d2ab4a5c4c5c389e0dc96ca372093d5f563228208631` |
| Live offer #9 (expiry +1 h): `create_offer` (maker1), then `prune_expired([9])` (maker2), then `cancel_offer` (maker1) | The prune returns 0, moves nothing and leaves #9 `Offered` in `list_open`. Only the writer can withdraw it | `d64f4df479924fa19b679ff8012b89e9725fa20d4c0b730de954d8e5fef09885`, `8b9a67e8a1b0c43fa37bcc58d68294b6b2e0179d8ee9254e415c0310dd4a9eca`, `4d3a4de8b8f4b3f4c78cb978b32d498911e006b37fe371468fb4bb7d3bddd663` |

`prune_expired` takes no caller argument and needs no auth, so the event's `pruner` field is always the contract's
own address, as the comment on `OfferPruned` in `lib.rs` says. The account that pruned is the transaction's source
account on Horizon (maker2 here). Calling `prune_expired([7])` again returns 0 in simulation, and an unknown id fails
with `NotFound` #101.

**Tenor cap.** In simulation, `create_offer` with `expiry` = now + 3 years fails with `TenorOutOfRange` #119, and
`expiry` = now + 2 years − 1 h succeeds (it would return id 9). Nothing was sent for either check.

**Per-writer open cap (run 2, `--full`).** maker2 creates 50 dust PUT offers on RWA, each with qty = strike_total =
premium_total = 1 unit (ids 20–69, ledgers 5389420–5389495; first `1dbb1970e0bbc35cbca7060521662bf8edeea94911cad6759f6b54d946f3d70f`,
last `1f16f763db45c7cdf0473e8d2017a8d99064025c458497b8b87c3b7ac26a33cf`). `writer_open_count(maker2)` is then 50. A 51st
`create_offer` by maker2 fails in simulation with `WriterOpenLimit` #116. The same offer from maker1 still succeeds in
simulation (it would return id 70), so the cap applies per writer, not to the whole book. maker2 then cancels all 50
(ledgers 5389497–5389563; first `272c702a2e3a245f1d5f803b2a083369fe4d99ccba2fd911c095f5cb3d11008c`, last
`547573330cf7d48cd2f4d6da5fed0d2c5bf7366093b16b248466800440a76af8`), and `writer_open_count(maker2)` returns to 0.

**Expected failures, all rejected in simulation with the code in `docs/contract-abi.md` §2:**

| Call | Error |
|---|---|
| `list_asset` EQTY a second time (maker2) | `AlreadyListed` #117 |
| `list_asset` USDx, the quote token | `AlreadyListed` #117 |
| `list_asset` `ZZZZ:<usdx-issuer>`, whose SAC `CCTNHAXK…QWPJN` is not deployed | `AssetNotDeployed` #118 |
| `list_asset` with code `bad code!` | `InvalidArgs` #102 |
| `list_asset` with a contract address (the USDx SAC) as `issuer` | `InvalidArgs` #102 |
| `create_offer` on EQTY before the issuer authorizes the escrow | `ContractNotAuthorized` #105 |
| `create_offer` with `expiry` = now + 3 years | `TenorOutOfRange` #119 |
| `prune_expired([1010])`, an unknown id | `NotFound` #101 |
| `create_offer` by maker2 while it already has 50 open offers (run 2) | `WriterOpenLimit` #116 |

**Earlier flows, re-run on v1.3 (run 1):**

| Flow | create / buy / exercise / claim_delivery |
|---|---|
| P0 PUT on RWA (#0) | `cc2d55b7073d151e7fae02681f8bc039af758fd26c50c456c1c2710d2661954a` / `9bacca67c7fcabd37d216c85b9a77b33a26b162967dd040cc6f0e50bd754d22d` / `579047248806bad74dd899d3159e8fd582224a16c98941740909d828d8c58334` / `9d2729f4b03e95f578748cdb50f8a4281825a7c6bc6be6f7d99661bc355e2a94` |
| P0+ CALL on RWA (#4) | `6d99e76bcd325978a5b6dcf26a1af3f28fd9c0ccba7e16c54ab6a3b1b8ace299` / `9ab951238b5a2727742009d99826c7f3c452f8413c8a2b2cb9ff735daaf6b2e5` / `86c2c204815845c1cfa70a5eec4d651f901b8bad06f5ff9828cdae5e90b21084` / `5a2bae60f840007ecc1c4c7ef17c38bbc837476cc77b76cb24fc9283f5a65521` |
| P0+ PUT on BOND (#5) | `880c008d8be26738f80943541d824c9c5dfdafd634643486a4f2668cf7523d7f` / `04caca5a73e1d818a93c3fff7945cb2d065f1ab7ad0eadba0deaba9babbab6eb` / `518bade3e4406fdac58807fc4e8d0ac68347c91f211e588e95d189105c317421` / `9e05e1002b596e0fca184c66136595d1bc52e354e129e025af3609a7fbc91175` |
| V1.2 transfer (#6): create / buy / transfer investor → maker2 / exercise (maker2) / claim_delivery | `8a1aad0070a0f316dfa1c6a52a83db9c190b7eb9e9f0514a927f74b90abee33b` / `be17c9238cb086de1863124c3598e6628bea22c87b83ebfc7aaaa3ebcf30cefa` / `b6ba95b491162dc96e61342f7584ebb821132f92c6518cfbb03a5eb3a5954cec` / `251629c4c47733022b5330fbc32c13526ac522f4372f5f697d70d7fe45e7c1de` / `9a5d1ff6ae1febbe2c1505ca209e68eaabcc30f771e2b21a0663f4263aa56bcf` |

| Step | Tx |
|---|---|
| Expiry path (#1): create; `buy` after expiry → `Expired` #109 (simulation); reclaim | `d667d89821d32e0867058ebda4245609f9501870d07bbd84e900c39162d83a37`; `0f3087b4d779895f11d58f82b8a9fbd94e1829066e53d5fa4f7c0549d99400f5` |
| Competition (#2 maker1, #3 maker2), then both cancelled | `16a03cec988bb15d40b88845e8d64ff7f10410c3ae98dbf200323208ac5372e9`, `815944cea9dd884620141665c002baf9c37a9abe00236c700489aabcc953e84e`; `ed64724a6b3d2d196c51d682c503842a6c57df4825e9d76fc26e6707b63cc3d7`, `19a534281ee1e584f27f75286506043a098fbc96bf5c68cadd982576ad27e423` |

The expected failures of the P0 and V1.2 sections were rejected in simulation with the same codes as on v1.2:
`SelfTrade` #111, `NotHolder` #108, `NotExpired` #110, `WrongState` #106, `AssetNotAllowed` #103, `InvalidArgs` #102,
`NotWriter` #107, `NotEligible` #104 and `Expired` #109.

State after run 1:
- `option_count` 10, `list_open` [].
- `writer_open_count` is 0 for maker1 and for maker2.
- The contract's balance and `open_collateral` are both 0 for USDx, RWA, BOND and EQTY.

State after run 2 and the hand completion of #14 (CALL create `caabba6bdda08128820272c747e16be549afebc41ae3d11802b865fd1ccfce7b`,
buy `389d1b6617bf9b67b690d824920d1ec06bc64a0c25e5073a22d242ae0bd9265c`):
- `option_count` 70, `list_open` [], `asset_count` 3.
- `writer_open_count` is 0 for maker1 and for maker2.
- The contract's balance and `open_collateral` are both 0 for USDx, RWA, BOND and EQTY.

The unit, invariant and negative suites were run after this deployment, on the merged v1.3 tree. The results are in
"Off-chain assurance" below.

## v1.3.1 deployment (2026-10-26 00:50 UTC): pruner argument, transfer guards, per-asset open books

The corrections in `docs/contract-abi.md` §13, in one redeploy. Diffing `stellar contract info interface --output rust`
of the v1.3 and v1.3.1 wasms, both fetched from chain, shows exactly two changes: `list_open_for(asset, from, limit)`
is added, and `prune_expired` gains its first argument `pruner: Address`. No error code, type or event changes.
v1.3 already declared `OfferPruned { id, pruner }`; on v1.3.1 `pruner` is the authenticated caller instead of the
contract's own address. The storage changes (`OpenFor(asset)` books, persistent `Reserved(token)`) do not show in the
interface.

| Item | Value |
|---|---|
| Options contract v1.3.1 | `CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE` |
| Source | `feat/v131-verify`: implementation `3d386eb` (only `lib.rs` changed from `92424c1`) plus the v1.3.1 scripts |
| Constructor | `quote` = USDx SAC, `underlyings` = [RWA SAC, BOND SAC]. EQTY is left out on purpose and listed with `list_asset` (below) |
| Wasm upload / deploy tx | `7533b4676cff381c0a84c286a3f61cf0b965a1a3e40b2ac118438d503d2ce36c` / `21ac14af7a16be02e9e1e87922b47a78f3593ad4a96f564f43d81ce22a53c9ec` (ledgers 5390442 / 5390443) |
| Wasm sha256, 29,957 bytes (fetched back from chain; identical to the local build) | `acecb2f278e27d7366c47d73e35d2bcbe923185cd0669765f1f594d7499a354b` |
| Issuer authorizes the contract on RWA / BOND (`deploy.sh`) | `b76424bd918423e0f024adb1f2cc8674504d1304126f3c8800e33689a35eb922` / `58b0f2b9ff0a7318c7627016f98bd1edc7cf75571c1c8b13b1d54810f8298e48` |

Built with `stellar contract build --package options --meta source_repo=github:mohamedkhellaf/hackmeridian`
(stellar-cli 28.1.0). Part B of the issuer demo rebuilt the same tree and got the same sha256. Output of
`stellar contract info meta` on the deployed contract:

```
 • rsver: 1.99.1 (Rust version)
 • rssdkver: 28.0.0#48d506712f964094d14176e2f0b02afcd1054567 (Soroban SDK version and its commit hash)
 • rssdk_spec_shaking: 2
 • cliver: 28.1.0#c0f4d0da891bbf214c08b8c5035ae6db80e9a3bd
 • source_repo: github:mohamedkhellaf/hackmeridian
```

Smoke runs against v1.3.1 (`scripts/deploy/smoke-testnet.sh --full`; logs in the git-ignored `scripts/out/`):

- Run 1, log `smoke-20261026T005144Z`: PRE 6/6, P0 36/36, P0+ 24/24, V1.2 26/26, V1.3 54/57, V1.3.1 15/18. All
  6 failures come from one dropped transaction. The 50th dust `create_offer` of the writer-cap fill got
  `transaction submission timeout` from testnet RPC. Its hash `ccb04cc7e0b30371887521e0faba68a013ead1d32acc7005fc4bce73eadd53fa`
  is unknown to Horizon, so it never landed. maker2 stopped at 49 open offers. As a result `CAP_FILL` failed, and
  `CAP_FAIL_WRITER_LIMIT`, `CAP_OTHER_WRITER_SIM`, `V131_CAP_BOOK`, `V131_BOOKS_CAP` and `V131_LIST_OPEN_CONCAT_CAP`
  never ran. The 49 dust offers were cancelled in the same run, and `writer_open_count(maker2)` went back to 0. Every
  other check passed, including the one-time EQTY listing. Horizon confirms all 132 transactions of the run as successful.
- Fix, `Fix v1.3.1 scripts after the first testnet run`: the bulk dust creates and cancels of `--full` now check whether
  a failed submission landed (`writer_open_count`, `get_option`) and resend up to 3 times. A resend is built on the
  same account sequence while the first attempt is pending, so at most one of them can land.
- Run 2, log `smoke-20261026T011146Z`: **PRE 6/6, P0 36/36, P0+ 24/24, V1.2 26/26, V1.3 53/53, V1.3.1 18/18, exit 0.**
  Two checks were skipped: `V13_LIST` and `V13_FAIL_CONTRACT_NOT_AUTHORIZED` are one-time steps that run 1 already
  did. No resend was needed. Horizon confirms all 132 transactions of the run as successful.

**`prune_expired(pruner, ids)` names the real pruner.** maker1 writes a PUT on 5 RWA (total strike 50 USDx) with
expiry +45 s, and nobody buys it. After expiry, maker2 (not the writer) signs `prune_expired(maker2, [id])`.

| Step | Effect | Tx |
|---|---|---|
| Run 1, option #7: `create_offer` (maker1) | `writer_open_count(maker1)` 0 → 1. Before the prune, the contract holds 50 USDx and `open_collateral(USDx)` is 50. #7 is in RWA's open book and not in BOND's | `810b674c704d790671782b80697f66694e298a7f4d076af9b697d55c7d099391` |
| Run 1: `prune_expired(maker2, [7])`, signed by maker2 (ledger 5390535) | Returns 1. maker1 +50 USDx, contract −50 USDx, `open_collateral(USDx)` −50. State `Expired`; #7 leaves RWA's book; `writer_open_count(maker1)` 1 → 0. Event `OfferPruned { id: 7, pruner: GC27…55ZE }`, i.e. maker2 | `120988d0cf545cf9b2c7a392f990765f5b134664d7436e92a4e27d7bae1e9e00` |
| Run 2, option #66: the same path | Same deltas. Event `OfferPruned { id: 66, pruner: GC27…55ZE }` | `da477e8cc5d490bdfb8f88f90c65e3ae0121073668a9ce53908a31fc7622ac7d`, `5a4991bd8156b2639da7878b5ed654c41d6f3ff4365d74957ea4c6d8cdbff55d` |
| Run 1, live offer #9 (expiry +1 h): `create_offer` (maker1), `prune_expired(maker2, [9])`, `cancel_offer` (maker1) | The prune returns 0, moves nothing and leaves #9 `Offered` in RWA's book. After the writer's cancel, #9 is no longer in RWA's book | `355f678acbb468b44651e9fbe78538f6e86951916f5e2ac6fa66616d303c3124`, `043077ef443eb40a894ace49ebbced4f126df75b011c2f868677f7a4399bb24b`, `896b3efa46b1eadd7f39d29d15db1f98b1e6a04b1eb70095376f82a17a5a85ac` |

The event as read back from chain with `stellar events --network testnet --start-ledger 5390535 --id CBASUA3L…MJUEE --count 1 --output json`:

```
{"id":"0023152171533021184-0000000001","ledger":5390535,"ledger_closed_at":"2026-10-26T00:57:42Z","type":"contract","contract_id":"CBASUA3LJEZ6G66V2JTB4OHQCHUIH5EK2ZPMLY73GTIBBDZ6JLRMJUEE","event_name":"OfferPruned","prefix_topics":["offer_pruned"],"params":{"id":7,"pruner":"GC27F4643RPJT6WCZUD5AFC3PCXRZNE3FGNOBCBOSTGFC37IVVSD55ZE"}}
```

Horizon shows `120988d0…9e00` in ledger 5390535 with `source_account` maker2. Calling `prune_expired(maker2, [7])`
again returns 0 in simulation, and the unknown id 1010 fails with `NotFound` #101.

**Per-asset open books (`list_open_for`, `list_open`).** These are read-only checks, run while the prune-path
offer was open (`OPEN`), after the prune (`PRUNED`), and at the writer cap (`CAP`, run 2 only):

- `list_open_for(RWA, 0, 50)` returns at most 50 ids in strictly ascending order. `list_open()` starts with that
  page, because RWA is registry entry 0.
- A page that starts at the book length returns []. `limit` 1000 returns min(length, 50) ids.
  `list_open_for(USDx, …)` returns [], because the quote token is never an underlying.
- Every listed asset's book, read page by page, equals the ids of that asset's `Offered` options according to
  `get_options` over every id. `list_open()` equals those books joined in `list_assets` order, first 200 ids. This
  holds at all three points: `OPEN` RWA=1 BOND=0 EQTY=0, `PRUNED` all 0, `CAP` RWA=50 BOND=0 EQTY=0.
- At the cap (run 2), RWA's book holds exactly maker2's 50 dust ids (69–118). The first page holds all 50 and
  the next page (`from` 50) is []. No book on chain grew past one 50-id page, so a second page with ids in it was
  never observed on testnet. That case, and the 500-id per-asset cap (`OpenListFull` #114), are left to the
  contract unit tests.

**Per-writer cap (run 2, `--full`).** maker2 creates 50 dust PUT offers on RWA (qty = strike_total = premium_total =
1 unit; ids 69–118, ledgers 5390784–5390862; first `7ec00c6ad6100f1b8491a8eed1e154c7d915a9cdccd63eaa0f7f3bd55b189eb5`,
last `7e87a91ea99374737239f79df24c7cb23fea2df61b516fefdfebad79d300a8cc`). A 51st `create_offer` by maker2 fails in
simulation with `WriterOpenLimit` #116. The same offer from maker1 succeeds in simulation (it would return id 119).
maker2 then cancels all 50 (ledgers 5390867–5390933; first `e2bea0fd7a412a237039c0b9e8fcf62cf0580a7d27ec2cc60a45dfc509c6e32d`,
last `fa4e4b604f2383f97435778e05c4354c5d2cd51ff597478f8af01cf354dc4606`), and `writer_open_count(maker2)` returns to 0.

**Permissionless listing of EQTY on the new instance (run 1).** Before listing, `is_listed(EQTY)` was `false` and
`asset_count` was 2.

| Step | Effect | Tx |
|---|---|---|
| `list_asset(maker1, "EQTY", rwa-issuer)`, sent by maker1 | Returns `CDBHRG…NIFU`. Event `AssetListed { sac: CDBHRG…NIFU, code: "EQTY", issuer: GCNW…FDGM, lister: maker1 }`. `asset_count` 2 → 3; `list_assets(0, 50)` = [RWA, BOND, EQTY] | `94f1f28cbef1ec1e6318782976b58605d0b41f6ff74396753b294906148675b4` |
| `create_offer` PUT on EQTY before the issuer authorizes the escrow | `ContractNotAuthorized` #105 (simulation) | — |
| Issuer `set_authorized(contract, true)` on the EQTY SAC | `is_eligible(EQTY, ·)`: contract `true`, maker1 `true`, investor `true`, outsider `false` | `891473865d9330d7881b9208e02388166afe8e7cf13344853180ae5547de0512` |
| EQTY PUT (#8): create / buy / exercise / claim_delivery | Same balance and `open_collateral` deltas as the RWA PUT | `261583446ee575fd29dc2b1a9b43eb08da0701fff78996f74e025a19c5714147` / `ac3ce920f7cc3558d0327df7850390f2107c40c57c81aa7f1d81c7c58b23d718` / `f2ad8d0e70ba15e5b487bd41b9d888a27fc8ba0d5551debe1fd4581560a210a5` / `d7f84cdfba2d61a896e86fcd645c9d7b76b8dd4bdb54f2a0303f9642c568d1fe` |

**Earlier flows, re-run on v1.3.1 (run 1):**

| Flow | create / buy / exercise / claim_delivery |
|---|---|
| P0 PUT on RWA (#0) | `a7650a408db840fd485196543417b39d7763726fa174359d6165e0af8dfa850a` / `74cebad827fbbe0e6ec566a448b55a64db39e184ecae4174642a2acb046e9697` / `1d0a2ccd1b980cfddd7450f220a38f7c6a970dd08939ff6c4027ac2d565edf55` / `67e64525865cc97a48e8514a0873175dc9d1e79ae3b37ae0eb493d5b20bc6bdc` |
| P0+ CALL on RWA (#4) | `dc65433d82c4490e8580955dc07f6e161f948b0a221ffd695d92a9df2ac7b122` / `465318452e7805aa70e6c15caf2d683c17f249a328d7c89a1fbe233956886879` / `594f92802bc43dae91463bff462d38719e7f1e8aeb624e834685a8499cc75364` / `bfad94da33c79f9474a2e6857338f5e0c5c195eb4b6499cf6bbe63c106f75079` |
| P0+ PUT on BOND (#5) | `7967a75c7c01dca1112109f6d20b23ac637ab6eaff9b518c010d5b111999bdde` / `fe2e2df8e19cc61255565b264c3b2dacceaf22b68b0a9c80fd688f79d29f643b` / `d4398ef242c43a34d75618a0869ef23fbdc5c3803fddb7248cb8d9749d21b007` / `3db733087c06a5b2c856eccb1e6ee794185bedf78d61e440f89fd3125cddb2eb` |
| V1.2 transfer (#6): create / buy / transfer investor → maker2 / exercise (maker2) / claim_delivery | `311a385819f1b5db78fb80f879dd26bf5ab5e87f07ee68bdbabd3003f3eb69a4` / `341174f2f2e0b0228b2e85617e263b2b007cf8d03bbeee45759e9936b4a5c560` / `de7916112abeddb49c738e38432bbaae630bdaf9015e4d56e665f03cb3361970` / `3a6aed872479780a5a4e33137d6ec551f20d8d32f22c9e55877684ec9626f8a1` / `fc5e3da0feeeb727ae3f56907b79d6a9cea8ff3cd4a583e4f1e575e5913995bb` |
| Expiry path (#1): create; `buy` after expiry → `Expired` #109 (simulation); reclaim | `28e91bf7bbfdb58013329e8d4c438cd63b031438df1aa2e7eecc4c45165e6e48`; `dcc8b4bd07fc18720e76baaa44a14709216abe08bf34d0525aab549879e4e98a` |
| Competition (#2 maker1, #3 maker2), then both cancelled | `9939d4b94507a491bf7c6cb1595f4ee8dc6ac1444d6dac3681a29232ec169562`, `ca17ef26f22986c78297172f9fddc308dc6574e29c79f97358c5b4640b6fde35`; `23c7da6cdf6ed0549cfb4513b0b3300be06a4d24a0ce8d5cdd65b7cb4f563d6e`, `56780a2433b1ef9ba859a886aca33953fb7ae23c0bdf1c2d594e7aa3429bb864` |

**Issuer demo against v1.3.1** (`scripts/deploy/issuer-demo-testnet.sh`, log `issuer-demo-20261026T013121Z`):
**PRE 6/6, A1 12/12, A2 9/9, A3 12/12, B 20/20, CLEANUP 5/5, exit 0.** Horizon confirms all 28 transactions as
successful. Parts A1–A3 ran on the main contract and undid every issuer action within the run (options #119–#121):

- A1, holder frozen: `exercise` fails with the SAC's `Error(Contract, #11)` until the holder is unfrozen; then
  exercise and claim succeed. Txs: create `6512981daad86e3a5ea4ee0d58eeae5efd162f13bffb19041336817a121d0a20`, buy
  `6e0664a7d9f9a29c85c814fa20e25fd8a8a468d19eeec2732e9b79e30c9e3d69`, freeze
  `3f0d711d18457d627f00f6136c3b35cc272a8c7856467959ea014ab86611f462`, unfreeze
  `f7521f5ce373341e63cdbb69f3cb70e70c29a0b1d75934b6bd78a9735da11b39`, exercise
  `2dc53c3fc49205f758a7d3344dbaee8ab5c8f45aa0f519ea5c006b7d66d013a4`, claim
  `78198aca9c23092c23032460c7e0c102df8d8d2d4c41e9416981c3106e208a96`.
- A2, contract de-authorized: `buy` fails with `ContractNotAuthorized` #105, and `cancel_offer` (USDx collateral)
  still works. Txs: create `3f24c5e263c411671d3979360da45a6ca15f0659c107f9294e6bcc69995ba3e8`, deauthorize
  `d4121cb2388a5c394cb467a991804ff15d5a9162d980441df51cd81425830e1e`, cancel
  `a7cd28fb63103f4c19ce301f37bf4d0906858bfabd6e5f59ac4310f6dd93a3aa`, re-authorize
  `b92dc2ba0eb4ba332a27e905821850eb74c818c3c19546e7ea5d19bfe2872d7a`.
- A3, writer frozen: the holder still exercises and is paid
  (`9cd646942c3f969c3407ad492d63c14400fcc7a6c969dc96b89203cfeaf0a15a`). `claim_delivery` fails with SAC #11
  until the writer is unfrozen, then claim `e666ab61e1554528527bbab47ef9cae014ca5e8a657b413f6f8f1f045aa4d2db` succeeds.

Part B ran on a throwaway v1.3.1 instance, never the main id. Throwaway
`CDFMHZYILFD7O7G2JWVHR222WWFVA5DSSZDOJY7RIXX674WKQV2NSDKT`, deploy tx
`4075274e7ebcf8916800589078f77ccca71d313adbd54bfb900b1f66eb403cef`, same wasm sha256:

| Step | Effect | Tx |
|---|---|---|
| Throwaway #0: Offered covered CALL on 3 RWA. #1: covered CALL on 1 RWA, bought by the investor | `open_collateral(RWA)` = balance = 4 RWA | `3fddebf1ec3b234859bbada09fcc538171f950a1a77ad23714d2149bd341f629`, `d7d34fa63d6ad3bb889384beacc9756931c9c0baf4510b4bea959d6d9dce5a9e`, `c535670f45c21c0af2c9b75c036b9a01ea7dca6343af3fffc3abebce2bcefa66` |
| Issuer `clawback(throwaway, 1 RWA)` | `open_collateral(RWA)` 4 RWA > balance 3 RWA | `f45330bed06985a957993ab49a8e81d1a276dc7e8444498fa5a57eaf5b5dcbeb` |
| During the deficit (simulation) | `buy` #0, a new RWA `create_offer`, and **(v1.3.1) the investor's `transfer` of #1 to maker2** all fail with `CollateralShortfall` #115 | — |
| BOND PUT `create_offer` during the RWA deficit | Succeeds: the deficit is per token | `42e6ca12a7fd55d0fcd8de29e12509a9f41370d03c18def96a86791692e75108` |
| Issuer repays 1 RWA (SAC `transfer` from the issuer) | balance = `open_collateral` = 4 RWA | `c6ef06926cb5d47366ac16a89da0e9b87151c61e85aafe80a62ca4feae66432a` |
| `transfer` #1 investor → maker2, then `buy` #0 | Both succeed. #1 is `Active` with holder maker2 | `c4a60668b296e7c643d9aca1cee7e54d1b3e864de2604caef9a880ccd73c0c67`, `4dde08219d857397b0fc46a6d27f0e028b5454b321170724ec702d97dda07950` |

**Expected failures on v1.3.1, all rejected in simulation with the code in `docs/contract-abi.md` §2:**

| Call | Error |
|---|---|
| `transfer` of an Active RWA CALL to maker2 while the throwaway's RWA balance < `open_collateral` | `CollateralShortfall` #115 (new in v1.3.1) |
| `buy` / RWA `create_offer` during that deficit | `CollateralShortfall` #115 |
| `buy` while the issuer has de-authorized the contract on RWA | `ContractNotAuthorized` #105 |
| `exercise` by a frozen holder, `claim_delivery` by a frozen writer | SAC `Error(Contract, #11)` (balance deauthorized) |
| `list_asset` EQTY a second time; `list_asset` USDx (the quote token) | `AlreadyListed` #117 |
| `list_asset` `ZZZZ:<usdx-issuer>`, whose SAC `CCTNHAXK…WPJN` is not deployed | `AssetNotDeployed` #118 |
| `list_asset` with code `bad code!`; with the USDx SAC as `issuer` | `InvalidArgs` #102 |
| `create_offer` on EQTY before the issuer authorizes the escrow | `ContractNotAuthorized` #105 |
| `create_offer` with `expiry` = now + 3 years | `TenorOutOfRange` #119 |
| `prune_expired(maker2, [1010])`, an unknown id | `NotFound` #101 |
| `create_offer` by maker2 with 50 open offers (run 2) | `WriterOpenLimit` #116 |
| P0 / V1.2 checks | `SelfTrade` #111, `NotHolder` #108, `NotExpired` #110, `WrongState` #106, `AssetNotAllowed` #103, `InvalidArgs` #102, `NotWriter` #107, `NotEligible` #104, `Expired` #109 |

**State after both smoke runs and the issuer demo** (read-only simulation, 2026-10-26 01:37 UTC):
- `asset_count` 3. `list_assets(0, 50)` = [RWA `CCVY…LR7U`, BOND `CADC…QGHP`, EQTY `CDBH…NIFU`].
  `config().underlyings` is still [RWA, BOND]. `is_listed` is `true` for RWA, BOND and EQTY and `false` for USDx.
- `option_count` 122.
- `list_open_for(asset, 0, 50)` = [] for RWA, BOND, EQTY and USDx. `list_open()` = [].
- `writer_open_count` is 0 for maker1 and for maker2.
- The contract's balance and `open_collateral` are both 0 for USDx, RWA, BOND and EQTY.

The v1.3.1 unit, invariant and negative suites were not run in this deployment step. Their results on the merged
tree are under "Off-chain assurance" below.

## Off-chain assurance

On the merged v1.3.1 tree (branch `feat/contract-v1-3-1`: `feat/v131-impl`, `feat/v131-tests`,
`feat/v131-invariants`, `feat/v131-negative` and `feat/v131-verify` merged in that order, no conflicts). Its `lib.rs`
is the `3d386eb` file. `stellar contract build --package options --meta source_repo=github:mohamedkhellaf/hackmeridian`
on this tree gives sha256 `acecb2f2…354b`, 29,957 bytes, byte-identical to the v1.3.1 wasm fetched back from chain
with `stellar contract fetch` (section above). `cargo test -p options`: **202 passed, 0 failed, 0 ignored** (unit
120, invariants 17, negative 65), after the gate-review test fixes below; `lib.rs` is unchanged by them, so the wasm and
the deployed contract are the same. The merged tree before those fixes had 199 passed, 2 ignored; the merged v1.3 tree
had 171 passed, 1 ignored.

- 120 unit tests in `contracts/options/src/test.rs`, all run, none ignored. They are the 105 v1.3 tests, minus 2 that
  v1.3.1 retires, plus 17 new ones.
  - Retired: `open_list_cap_returns_open_list_full` (the single `MAX_OPEN` list is gone; see `per_asset_open_cap`)
    and `prune_expired_needs_no_auth` (see `prune_requires_pruner_auth`).
  - New tests for §13.1, `prune_expired(pruner, ids)`: `prune_requires_pruner_auth` and `prune_event_carries_pruner`.
  - §13.2, the `transfer` guards: `transfer_rejects_when_contract_deauthorized`, `transfer_rejects_during_shortfall`,
    `transfer_rejects_during_quote_shortfall` and `frozen_holder_can_still_transfer`.
  - §13.3, per-asset books: `per_asset_open_cap`, `list_open_for_pages`,
    `list_open_concatenates_registry_order_and_truncates_at_200` and
    `list_open_visits_only_the_first_max_page_registry_assets` (offers on registry indexes 49, 50 and 51: `list_open()`
    shows only index 49, `list_open_for` shows each).
  - §13.4: `list_asset_already_listed_before_undeployed_probe`.
  - §13.5, keeper coverage: `extend_ttl_extends_registry_writer_and_book_entries` and
    `extend_ttl_registry_coverage_is_the_first_max_page_assets`.
  - §13.8, persistent `Reserved`: `reserved_is_persistent_and_extended_on_touch`,
    `reserved_and_open_book_ttls_extended_on_every_touching_path` and
    `instance_storage_stays_four_keys_as_assets_and_tokens_grow`.
  - §8, found by v1.3.1 mutation testing (dropping the `AssetAt` TTL extension in `registry_push` survived):
    `registry_entries_get_full_ttl_on_creation`. The `open_book` test helper also bounds a book at
    `MAX_OPEN_PER_ASSET` ids, so a `list_open_for` regression that never returns an empty page fails instead of
    hanging.
- 17 tests in `contracts/options/tests/invariants.rs`, all run, none ignored.
  - 1 property test, `invariants_hold_for_random_operation_sequences`. Its reference model now includes
    `prune_expired(pruner, ids)` with pruner auth and the backstop, and the `transfer` guards. A composite stress
    operation de-authorizes the escrow, or claws RWA back from it, right before a holder transfer that would otherwise
    succeed. The model also covers the per-asset books (invariant 5 reads every book page by page), `list_open()` as
    their concatenation, and `AlreadyListed` before `AssetNotDeployed`.
  - Invariants 1–10 are checked after every step of random sequences of 1–40 operations, 200 cases by default. Any
    run of 100 or more cases fails unless each of 14 required (call, outcome) pairs happens, including `transfer`
    `ContractNotAuthorized` and `CollateralShortfall`. On this tree the default run is clean (59.45 s), and so is a
    1,000-case run (`PROPTEST_CASES=1000`, 272.44 s).
  - `create_offer` → `OpenListFull` cannot happen in random runs: 500 offers on one asset need at least 10 writers,
    and the fixture has 5 actors and at most 40 operations per case. The `list_open()` truncation at 200 ids is
    also out of reach. The deterministic `open_book_cap_is_per_asset_at_five_hundred` covers both.
  - 16 deterministic regression tests: the 11 from v1.3 plus `open_books_concatenate_in_registry_order`,
    `open_book_cap_is_per_asset_at_five_hundred`, `transfer_refuses_new_holders_while_the_escrow_cannot_settle`,
    `list_asset_checks_already_listed_before_deployment` and `list_open_window_is_the_first_max_page_registry_assets`
    (52 assets: `list_open()` holds the offers on indexes 0 and 49, not those on 50 and 51).
- 65 negative security tests in `contracts/options/tests/negative.rs`, all run, none ignored. They are the 55 v1.3
  tests, minus 2 retired, plus 12 new ones.
  - Retired: `griefing8_open_list_cap_and_full_list_operations_fit_limits` (the single list is gone) and the
    ignored `finding_f1r_sybil_writers_on_a_self_listed_asset_must_not_block_other_writers`. The per-asset books fix
    F-1R: the passing `griefing8_f1r_sybil_dust_on_a_self_listed_asset_fills_only_its_own_book` shows that sybil dust
    on a self-listed asset fills only that asset's book.
  - New tests for the pruner: `prune24_forged_pruner_signatures_are_rejected`.
  - The `transfer` guards: `transfer16_deauthorized_escrow_blocks_hand_over` and
    `transfer16_deficit_blocks_hand_over_with_no_state_change`.
  - Per-asset books: `griefing8_open_book_cap_is_per_asset_and_full_book_operations_fit_limits`,
    `griefing8_f1r_sybil_dust_on_a_self_listed_asset_fills_only_its_own_book`,
    `books24_per_asset_cap_cannot_be_bypassed_by_alternating_assets`,
    `books24_list_open_truncation_never_hides_the_first_registry_assets` and
    `books24_list_open_stays_within_limits_whatever_the_registry_size` (250 listings after the constructor assets;
    an offer on registry index 251 is in its own book and outside the `list_open()` window).
  - The suite's open-book oracle requires `list_open()` to be the concatenation of the first `MAX_PAGE` registry
    assets' books (ABI §3/§13.3), checked on every snapshot.
  - Listing order: `listing18_relisting_is_rejected_before_the_deployment_probe`.
  - Footprint and storage griefing: `griefing8_extend_ttl_spanning_many_assets_and_writers_fits_footprint_limit`,
    `griefing8_listing_and_collateral_spam_never_grows_the_instance_entry` and
    `griefing8_reserved_entries_are_kept_alive_by_every_path_that_touches_them`.
- `cargo clippy -p options --all-targets -- -D warnings`: 0 warnings. `cargo fmt --all -- --check`: clean.
  `bash -n` on every `*.sh` in the repository: clean.

Formerly ignored tests (resolved). The merged tree had two `#[ignore]`d tests, the unit test
`list_open_includes_books_past_the_first_max_page_assets` and the invariant test `list_open_spans_the_whole_registry`.
Both asserted the first wording of ABI §3 and §13.3, in which `list_open()` joins the books of every registry asset.
Commit `438195d` specifies the implemented window instead: the first `MAX_PAGE` (50) registry assets, which keeps the
view within the per-transaction limits however many assets are listed. Both tests are now active checks of that window
(`list_open_visits_only_the_first_max_page_registry_assets` and
`list_open_window_is_the_first_max_page_registry_assets`), and the negative suite's oracle accepts only it. In a scratch
copy, each of three `lib.rs` mutants of the window (unbounded, 49 assets, 51 assets) fails both new tests.

Earlier assurance, not re-run on the v1.3 or v1.3.1 `lib.rs`:

- Mutation testing of `lib.rs` (cargo-mutants 27.1.0 plus hand-written mutants). No mutant list or log is
  committed, so these counts cannot be reproduced from the repository. The exception is the last run below, whose
  tree is v1.2 as merged to `main` (`35017e2`, PR #29) and whose command is given; for the hand-written mutants only
  the 11 named survivors can be checked:
  - First run, on the v1.1 `lib.rs` with the suite of the time (59 unit and 6 invariant tests): cargo-mutants
    97 mutants → 79 caught, 0 survived, 18 unviable. 34 hand-written mutants (per-call TTL extension, guards,
    transfer order and other changes cargo-mutants does not generate) → 23 caught, 11 survived: 8 real test gaps
    (dropping the instance and code TTL extension from `__constructor`, `create_offer`, `buy`, `exercise`,
    `cancel_offer`, `reclaim` or `claim_delivery`, and `exercise` paying the holder before collecting), 1 unreachable
    guard (the negative-result check in `sub_reserved`) and 2 equivalent mutants (dropping the redundant
    `deployer().extend_ttl`; `reclaim` calling `open_remove` unconditionally).
  - The 10 TTL and transfer-order tests close the 9 non-equivalent survivors: re-applied to the v1.2 `lib.rs`, each
    one is caught by the merged suite, and the 2 equivalent mutants still pass, as expected.
  - cargo-mutants on the v1.2 `lib.rs` with the unit and invariant suites only (81 unit and 7 invariant tests,
    before `tests/negative.rs`): 111 mutants → 89 caught, 20 unviable, 2 missed. Both missed mutants weaken the
    `id < count` guard in `get_options` (to `true` and to `<=`). They are equivalent for every state a deployment
    can reach: an id at or past `option_count()` has no stored entry, so `load_opt` fails and the loop stops at the
    same place.
  - cargo-mutants on the full merged v1.2 suite (`cargo mutants -p options --file contracts/options/src/lib.rs`,
    unit, invariant and negative tests): 111 mutants → 91 caught, 20 unviable, 0 missed. The 2 guard mutants are
    killed by `negative.rs` `paging17_get_options_never_panics_and_never_reveals_ids_at_or_past_count`, which
    lowers `Key::Next` below stored ids so the guard becomes observable.

On v1 only (53-test suite, PRs #16 and #18), not re-run since:

- 4-lens audit with adversarial refutation, CoinFabrik Scout, clippy pedantic, cargo audit: no authorization, arithmetic
  or state-machine defect. Its two confirmed findings (pooled clawback exposure, unbounded open-offer list) are
  handled in `docs/contract-abi.md` §6 and the v1.1 hardening in §10.

## What this does not show

Issuer freeze, contract de-authorization and clawback ran on chain against v1.1 and v1.3.1 (sections above; clawback
only on throwaway instances), not against v1.2 or v1.3 (the spike on 2026-10-25 also exercised them, see
`research/decision/20_rwa_options_spike.md`). v1.2 adds code without changing the existing settlement paths:
`git diff 784f280 35017e2 -- contracts/options/src/lib.rs` (v1.1 on `main` to v1.2 as merged in PR #29) adds
`transfer`, `get_options`, `MAX_PAGE` and the event, and changes only comment lines otherwise (three removed). The
build of that `lib.rs` is still the deployed v1.2 wasm `8778dc77…422f`: comments on private items are not embedded
in the contract spec. Testnet resets quarterly; nothing here is durable, and none of it involves real assets.
