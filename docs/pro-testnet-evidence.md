# StellSec Pro (experimental): testnet evidence

Stellar **TESTNET ONLY**. Fictional assets (`USDx` quote token, fictional `EQTY` underlying label; cash-settled, no
underlying token exists). The risk publisher and the settlement price are **team-operated** (`strata-pro-publisher`),
not a market oracle; the vault is seeded with **team USDx**, not third-party liquidity. Nothing here is a production
or Mainnet claim. Rows are appended by `scripts/deploy/deploy-pro.sh` and `scripts/deploy/pro-demo.sh`; check any hash at
`https://stellar.expert/explorer/testnet/tx/<hash>`.


## Deployment 2026-10-26T08:08:33Z

| item | value |
|---|---|
| pro contract id | `CBZNS63L23N3Y3GHU6H57AU6OVZ3FOAPM7Z54ATDRC472Q5DWV6UVKCN` |
| deploy tx | `69d331680b3994d0f42b765a46bb9ae333cca638f717fbff3efc431dfd255c51` |
| wasm sha256 | `074a4ed4d7eb3e52011edaad8297f2cd95083decad2a9d37aa74c1e9a8837071` |
| admin (strata-pro-admin) | `GBMOPIHIXTPORA3HFGBKQKTZLJWTUYALVSN3QXH647UQFJIOQ3KSZO44` |
| publisher (strata-pro-publisher) | `GDY257DGQREP4NLM2DF2YUS5M2VHRW3JNDK2YYHZP55SMW3FMAUHZUVN` |
| quote (USDx SAC) | `CAKXMQVKSW2AEKF5DSMDPHJAYGNVOQANHXLI64QJS2H3GOCXRW2GCICU` |
| deployer (strata-deployer) | `GBVPEL6MT4IZ4XL5J7TTMB3GND7TPRS54KOJTUFCUOVFVFPZKE5HDA73` |
| MarketConfig | `{"psr_bps":1500,"ext_mult":2,"short_min_bps":500,"im_bps":12500,"max_age":3600,"max_series_oi":"50000","max_writer_oi":"20000","bonus_bps":500,"reserve_fee_bps":1000,"settle_window":86400,"exercise_max_age":120}` |

## Evidence run 2026-10-26T08:25:03Z (contract `CBZNS63L23N3Y3GHU6H57AU6OVZ3FOAPM7Z54ATDRC472Q5DWV6UVKCN`, series 0, expiry 1793003064)

Roles: admin `GBMOPIHIXTPORA3HFGBKQKTZLJWTUYALVSN3QXH647UQFJIOQ3KSZO44`, publisher `GDY257DGQREP4NLM2DF2YUS5M2VHRW3JNDK2YYHZP55SMW3FMAUHZUVN`, keeper `GBSSG6NHV3DCGYYHPUYWVVZSHADIAU2BXQ6YYRXKAAUXXGVWTZXLC646`, maker `GAJ2RZUNJM6VEZWBZJRZWQ5ZG5OCN7LKN2CJMKE2MJRER52IF2UAVC7G`, holder `GC7ZMEB7HIPST7PWNQLIG6I5N3VZD3UG7VFOOPCZBJ7JWKCENCEK5NAY`, lp `GB4DQXEYIHCDLOU7AAVC42LWYVGOC5QFN3X43UJ4AOWUVV5M36UUUUCF` (team-operated testnet identities).

| op | tx hash |
|---|---|
| change_trust USDx (strata-pro-maker) | `758942fc84d3c358fe2f3147e266478743a8b6e0b84f48d4a01c57c56d406642` |
| USDx payment to strata-pro-maker | `b7105e0b763084dff4b001994ca4b4292bc424202c83d721d27fc9dedb1741c1` |
| change_trust USDx (strata-pro-holder) | `ec521d707a800d89e33ca5348aab64d29ca968ff66d37120116516b2af1b6573` |
| USDx payment to strata-pro-holder | `cb1898378d48892522af79bbc9b9b6b52bdb8bdb1bfec111e1e11d931ce84a0a` |
| change_trust USDx (strata-pro-lp) | `fd4fcac927652c3493ed77b4c371f26bca83b5fe3e784cf9842c209f3d8f9b9b` |
| USDx payment to strata-pro-lp | `139959a3f2cefe8f5a9b97070f54b0ed1ef9d5f83249163e96fb6427764ff9d8` |
| PRO_LP_DEPOSIT | `2fe77ec251acba34220fbf40be80f78091caed16c6cef39acdc3d43a8dfcd460` |
| PRO_LIST_SERIES | `2d5113afc0b0d3543f75971bb352761179fbc9c15f75d0bcbe51e0864b19a1f3` |
| PRO_PUBLISH_RISK_1 | `e4bde3ff3d08e5ffffbc07b9bb762dadbee19ef0aa6ff10de09226480373e552` |
| PRO_DEPOSIT | `438a8c871213a420d6be56932ebe68ab044ae462b3b45b034406b12d4760cdf1` |
| PRO_CREATE_OFFER_A | `9f432de0ef7843e626e9e9a336522c3c8f38a688f366848864b30c6d10d94b1b` |
| PRO_CREATE_OFFER_B | `3fce3ccbc45e00e95be080d54fbff443694d43b982c78d2f73c3b0f0021dfc03` |
| PRO_BUY_A | `3af75122179bb76f427c975f2a3331146e03cf9f777004fe1f19685c5a897725` |
| PRO_BUY_B | `32345bea91598c9fc5eb8beb94518425cd5af15aa41791dc4f24730a51c57b92` |
| PRO_PUBLISH_RISK_2 | `443f8d19c4eb29ddd17193260334c061fb6a15d4170248be34b60ecb1f093dfd` |
| PRO_EXERCISE_A | `4182542709938855c40f65a7ff77ba14bea9d1c5aacd68573ca16cc727bfa145` |
| PRO_PUBLISH_RISK_3 | `a074c1735efd5db6770187a9c8e6800b723e8c35aee3006f65e09abe4d33e527` |
| PRO_LIQUIDATE | `83d65527ba83c7f34bc3a110e1ccf603ed04d57c01906a7ad64c28dfbaebd77e` |
| PRO_PUBLISH_SETTLEMENT | `b2aee2779394eb1a1d05e8e7b99257095736592d32da8df806e68733cf6d005c` |
| PRO_SETTLE | `9ca2a5faca80883a0e419cc35784c0d92109f586556b8642052992aa8341fa13` |
| PRO_SETTLE_VAULT | `debc98d7e02a66418b6632ae50a8fdbe9b44c46b26217de6bb5a278bbe24b388` |
| PRO_CLAIM_B | `a4cbd965c7b062050029a9922579bf505df2e1ee692011e05032c7255905c33c` |

### Outcome of the evidence run (read from the contract after each step; all amounts USDx, 7 decimals)

Deployment also uploaded the wasm in tx `8e1d379448e9a9753ed9b21f35f530bd2ace0aa078e7ecba173f657786d3ca46`.
`stellar contract fetch --id CBZNS63L…VKCN` returns a wasm whose sha256 is `074a4ed4…37071`, identical to the local
`stellar contract build --package pro` output; contract meta carries `source_repo=github:mohamedkhellaf/hackmeridian`.
Every hash in this file (plus the series-1 rows below) was checked with RPC `getTransaction`: 29/29 `SUCCESS`.

| step | on-chain result | expected (runbook §2) |
|---|---|---|
| lp_deposit 2000 (team seed capital) | vault value 2000 | 2000 |
| deposit 850, buy A + B (10 lots each, premium 10 each) | maker IM 500, MM 400, NLV 868 | IM ≈ 500 ≤ NLV ≈ 868 |
| publish_risk spot 112 → exercise A | due 20 paid by the maker; maker NLV 828 ≥ MM 703.2 | due 20, NLV ≈ 828 ≥ MM ≈ 703 |
| publish_risk spot 160 → liquidate(maker, vault) | maker NLV 348 < MM 502.3; book B owned by Vault with reserve 525 | x = 525 to the vault's reserve |
| publish_settlement 175 → settle(book B) | due 650, 525 from the reserve, shortfall 125 | due 650, 525 + 125 |
| settle_vault | vault paid 125, deficit 0; series closed | 125 paid by the vault |
| claim(B) | holder paid 650, deficit 0 | 650 |
| final state | vault cash 1877, reserved 0; maker cash 323, owed 0 | |

Nothing failed in this run; no script or runbook change was needed for steps 0–8.

## Live demo series (for the UI), 2026-10-26 ~08:15Z

Series 0 above is expired and settled. A second series is left open for the Pro UI demo (refresh its snapshot with
`scripts/deploy/pro-refresh-risk.sh`, runbook §6):

| op | detail | tx hash |
|---|---|---|
| list_series (admin) | series 1, strike 110, expiry 1793188800 (2026-10-28T12:00:00Z) | `cbc4a798a11975ea2948b59762b2e3a624c96ef302bf2504f40c060b6025b963` |
| publish_risk (publisher) | series 1, spot 100 | `e105235ebda0f502c9c56a8525fbd7d96803d4bb410692d8dbfbde5c3b6714b5` |
| publish_risk (publisher) | series 1, spot 110, mark ≈ 1.18 per lot | `a419607b0c71fe7656da2a4bbbc126c09749a116be2b306387e1870f414e8930` |
| create_offer (maker) | offer 2: qty 2, premium 3 | `c2ebb4b03e1309d35b41ece7894e517ca486f7d2659b4854e47c072b0db06fe3` |
| create_offer (maker) | offer 3: qty 5, premium 7 | `67f282668cd5ef7027b8485a47b9b37d50b2bfd72aa9d2c1058c1e67e6de802a` |

A `buy` of offer 3 by strata-pro-holder simulates successfully (`--send=no`, not submitted). Offers 2 and 3 are still open.
