# Options contract: testnet evidence

Stellar **testnet** only (protocol 29). Every hash below was confirmed `successful: true` on Horizon
(`https://horizon-testnet.stellar.org/transactions/<hash>`). Amounts are 7-decimal units. Roles are disposable
testnet identities created by `scripts/setup-testnet/`; their public keys are listed below (also in the git-ignored
`scripts/out/testnet.env`). Re-run everything with `scripts/deploy/smoke-testnet.sh`.

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
branch `feat/testnet-issuer-demo`. These are the issuer-action limits of `docs/contract-abi.md` §6 recorded on chain:
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

## Off-chain assurance

On the merged v1.2 tree, whose `lib.rs` builds to the deployed v1.2 wasm (sha256 `8778dc77…422f`, section above):

- 81 unit tests in `contracts/options/src/test.rs`: the 80-test v1.2 suite, which includes the 10 TTL and
  transfer-order tests added after mutation testing, plus `is_eligible_false_for_g_account_without_trustline` (the
  SAC #13 branch of `is_eligible`).
- 7 tests in `contracts/options/tests/invariants.rs`: 1 property test (an executable reference model of the ABI plus
  invariants, checked after every step of random sequences of 1–40 operations, holder transfers and paged reads
  included; 200 cases by default, and a 1,000-case run is also clean) and 6 deterministic regression tests.
- 41 negative security tests in `contracts/options/tests/negative.rs` (40 run; the 41st is the `#[ignore]`d F-1
  test): auth replay and forged auth trees, contract-as-party, 37-operation accounting trace, repeated/out-of-order
  releases, id monotonicity and u32 exhaustion, expiry boundaries, terminal states (150 rejections), TTL griefing
  bounds (≤398 ids per `extend_ttl`), amount edges (1 unit, 0/negative, i128::MAX, i64 cap for G accounts),
  token/trustline edges, allowlist, one event per success and none per failure, immutable offer terms, nonce
  replay, constructor re-entry, and the v1.2 surface: `transfer` (third-party and replayed auth trees, non-holder
  callers, ineligible and no-trustline recipients, every non-`Active` state with 180 rejections, the expiry
  boundary, no token or reserved-total movement) and `get_options` at `from`/`limit` edges (0, u32::MAX) never
  failing or returning an id ≥ `option_count`. All misuse paths are rejected with no state change. One documented
  availability finding (F-1, `docs/contract-abi.md` §6).
- Mutation testing of `lib.rs` (cargo-mutants 27.1.0 plus hand-written mutants; logs are not committed):
  - First run, on the v1.1 `lib.rs` with the suite of the time (59 unit and 6 invariant tests): cargo-mutants
    97 mutants → 79 caught, 0 survived, 18 unviable. 34 hand-written mutants (per-call TTL extension, guards,
    transfer order and other changes cargo-mutants does not generate) → 23 caught, 11 survived: 8 real test gaps
    (dropping the instance and code TTL extension from `__constructor`, `create_offer`, `buy`, `exercise`,
    `cancel_offer`, `reclaim` or `claim_delivery`, and `exercise` paying the holder before collecting), 1 unreachable
    guard (the negative-result check in `sub_reserved`) and 2 equivalent mutants (dropping the redundant
    `deployer().extend_ttl`; `reclaim` calling `open_remove` unconditionally).
  - The 10 TTL and transfer-order tests close the 9 non-equivalent survivors: re-applied to the v1.2 `lib.rs`, each
    one is caught by the merged suite, and the 2 equivalent mutants still pass, as expected.
  - Re-run of cargo-mutants on the merged v1.2 tree (81 unit and 7 invariant tests): 111 mutants → 89 caught,
    20 unviable, 2 missed. Both missed mutants weaken the `id < count` guard in `get_options` (to `true` and to
    `<=`) and are equivalent: an id at or past `option_count()` has no stored entry, so `load_opt` fails and the
    loop stops at the same place.

On v1 only (53-test suite, PRs #16 and #18), not re-run since:

- 4-lens audit with adversarial refutation, CoinFabrik Scout, clippy pedantic, cargo audit: no authorization, arithmetic
  or state-machine defect. Its two confirmed findings (pooled clawback exposure, unbounded open-offer list) are
  handled in `docs/contract-abi.md` §6 and the v1.1 hardening in §10.

## What this does not show

Issuer freeze, contract de-authorization and clawback ran on chain against v1.1 only (section above; clawback only
on a throwaway instance), not against v1.2 (the spike on 2026-10-25 also exercised them, see
`research/decision/20_rwa_options_spike.md`). v1.2 adds code without changing the existing settlement paths: the
`lib.rs` diff from `afda0da` ("Redeploy options v1.1 to testnet") to `627bac3` adds `transfer`, `get_options`,
`MAX_PAGE` and the event, and removes only two comment lines. Testnet resets quarterly;
nothing here is durable, and none of it involves real assets.
