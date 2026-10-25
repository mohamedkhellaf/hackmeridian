# 20 — Spike: fully collateralized, physically settled options on a permissioned RWA (testnet)

Stellar Architect, 2026-10-25, 16:37–16:55 WET. Testnet, protocol 29. soroban-sdk 28.0.0 / stellar-cli 28.1.0, same as the repo. Code is in the scratchpad (`spikes/rwa_options/`: `contracts/options/src/lib.rs`, `setup.cjs`, `env.sh`, `onchain_revert.cjs`), **not** in the repo.
Labels: [V] verified on testnet (tx hash), [A] assumption.

## Setup [V]
| Item | Value / tx |
|---|---|
| FUND issuer `GCURKUQ5…5YXC`, flags AUTH_REQUIRED \| AUTH_REVOCABLE \| AUTH_CLAWBACK_ENABLED | 105519ad… |
| USDx issuer `GAKLMWGZ…YNNZ` (no flags; a separate issuer, because issuer flags are account-wide) | — |
| Writer W `GDXYLPMV…DQP5`, holder H `GB7IJT22…EA63`, holder H2 `GAH7AUSP…VRX4` (FUND authorized, 0 FUND) | trustlines + auth 30a0daff…, issue b577ea9f… / 93ce4c3e… |
| FUND SAC | `CCB76MKCLXNNDM3WWUYAIUUBDEQTNT4IXJ5C6MQWPRZ4QWJKR7DXCXK3` |
| USDx SAC | `CAKZULE2LYV4YDHAWXS5W4MQTTAM7DJ2R66RCZ2GFGWUW7NMQA2YHIKS` |
| Options contract (constructor pins both SACs), 5.8 KB wasm | `CC2UWWGG2SAMMQZ535XO4ACINKPTWRQLCY6RWT27K374KO3PTTCTKKKL` (deploy tx 255cf91f…) |

**Contract:**
- `write_put` / `write_call(writer, strike, qty, expiry) -> id`, `exercise(holder, id)`, `reclaim(writer, id)`, `get(id)`, `fund_authorized(id)`.
- Collateral = strike × qty / 1e7 (7-decimal units).
- Errors: 1 NotFound, 2 Expired, 3 NotExpired, 4 Settled, 5 NotWriter, 6 BadArgs.
- SAC errors seen: #10 = insufficient balance, #11 = balance deauthorized.

## Results (amounts in stroops; 1 FUND = 10,000,000)
| Check | Result | tx / code |
|---|---|---|
| **(a) write_put** strike 10 USDx, qty 5 FUND | ✅ id 0; **contract USDx 0 → 500,000,000 (50 USDx)**; W USDx −50 | b53db00d… |
| **(b) write_call BEFORE issuer authorizes the contract** | ❌ simulation fails: SAC `Error(Contract,#11)` **"balance is deauthorized"** (the contract address's FUND balance) | not sent |
| (b) issuer `set_authorized(OPT, true)` on the FUND SAC | ✅ | 1d44fee3… |
| **(b) write_call AFTER** (qty 3 FUND) | ✅ id 1; contract FUND 0 → 3 | 1066361a… |
| **(c) put exercise by H** | ✅ atomic: **H FUND −5 → W FUND +5; contract USDx −50 → H USDx +50**; `get(0).done = true` | a079f18b… |
| **(d1) exercise by H2** (authorized, 0 FUND) | ❌ `#10` "resulting balance is not within the allowed range"; nothing moved | not sent (simulation) |
| **(d2) issuer deauthorizes WRITER, then H exercises** | ❌ `#11` "balance is deauthorized" (FUND → writer leg); balances unchanged (checked) | deauth 08b7b05a…; re-auth e4463446… |
| **(d+) forced ON-CHAIN failure:** simulate H.exercise(#3) OK → issuer revokes H classically (13e0ba5d…) → submit the prepared tx | **On-chain status FAILED** (ledger 5384604). **H, W and contract balances identical before and after; option #3 still `done:false`**, so there was **no partial transfer** | **a005ab41…** |
| **(e) issuer revokes HOLDER, then H exercises put #3** | ❌ `#11` "balance is deauthorized" | revoke 1a19bcbe…; re-auth c9965dc2… |
| **(f) issuer claws back 3 FUND from the CONTRACT** (call #1 collateral) | ✅ **clawback of a contract balance works** (contract FUND 3 → 0) | abcfb343… |
| (f) option state afterwards | `get(1)` = `{is_call:true, qty:3 FUND, collateral:30 USDx, done:false}`. **Orphaned:** H's exercise of #1 → `#10` "balance is not sufficient", SAC reports `{amount:0, authorized:true, clawback:true}`; writer's reclaim after expiry would also fail | not sent |
| **(g) reclaim BEFORE expiry** | ❌ contract error `#3` NotExpired | not sent |
| **(g) reclaim AFTER expiry** (put #2, +45s) | ✅ contract USDx −10 → W | 26b8b80a… |
| (g) exercise after reclaim | ❌ `#4` Settled | not sent |
| **(h) can a contract call the SAC's `authorized(id)`?** | ✅ **yes**: `token::StellarAssetClient::authorized(&id)` from inside our contract returns **false** for the fresh contract address and **true** for H (and true for the contract after set_authorized) | read-only simulation |

## Gotchas found
1. **The contract address must be explicitly authorized by the issuer** (`set_authorized(contract, true)` on the SAC) before it can *hold* an AUTH_REQUIRED asset. Calls fail with `#11` until then [V]. Puts don't need it (the contract only holds USDx, and FUND moves holder → writer directly).
2. **Use separate issuers for the RWA and the cash token.** AUTH_REQUIRED/REVOCABLE/CLAWBACK are issuer-account flags, so they would apply to USDx too.
3. **The issuer has unilateral power over every leg** [V]:
   - **Freezing the writer** blocks put exercise (d2). A writer frozen until expiry then **reclaims** the USDx collateral, so the holder loses the option. This is a legal and design issue: "who wins if the issuer freezes a counterparty?" Mitigation idea: on exercise failure due to auth, let the holder claim a cash-settled fallback, or forbid reclaim while the writer is frozen (use `authorized()` from (h)).
   - **Clawback from the contract** silently de-collateralizes calls, leaving an orphaned option (f). The contract should check its own SAC balance at exercise/reclaim, expose an `impaired` state, and possibly settle pro rata.
4. **Simulation catches most failures before sending** (no tx, no fee). Only if state changes between simulation and apply (issuer action, balance move) does the tx fail on-chain, and then **everything reverts atomically** [V, a005ab41…].
5. **TTL:** options use persistent storage with `extend_ttl` on every touch, and the instance is extended on write. **Long-dated options also need the contract instance and wasm code TTL extended** (by a keeper or a user `stellar contract extend`). Expiry beyond max entry TTL (about months on mainnet [A]) needs a keeper.
6. **Auth:** the CLI auto-signs the source account's `require_auth` entries. For contract-to-SAC transfers *from the contract*, no auth is needed (the contract is the invoker). A frontend with Freighter will use `signAuthEntry`/full-tx signing as usual [A].
7. **Spike gaps (not product-ready):**
   - Anyone can exercise any option: no holder binding, no premium, no transferability. Next step: a permissioned option position token (e.g. an AUTH_REQUIRED classic "OPT-n" asset, or an OZ token with an allowlist) whose holder exercises.
   - No partial exercise. No oracle (physical settlement doesn't need one).

## Verdict
The core of fully collateralized, physically settled, capped options on a permissioned RWA **works end to end on testnet** with a ~150-line Soroban contract over two SACs:
- Collateral lock, atomic delivery-vs-payment exercise, expiry/reclaim.
- Permissioning enforced by the asset itself (auth flags propagate through the SAC into contract transfers).
- The issuer controls (freeze, clawback) behave as the protocol defines.

The open design work is **issuer-intervention semantics** (freeze and clawback mid-life), the **option position token**, and **TTL upkeep**. None of it blocks a demo.

Estimate to a hosted demo:
- Contract hardening (impaired state, holder binding via an option token, events, tests): about 6–8 dev-h.
- Frontend (issuer / writer / holder roles, in-app keys, SAC balances): about 8–10 dev-h.
- Deploy scripts: about 2 dev-h.
- **Total about 16–20 dev-h.**
