# UI spec: trading screen, payoff and disclosures (Dev 1 → Dev 3)

**Owner of the promise:** Dev 1. **Owner of the code:** Dev 3 (`frontend/`). **Date:** 2026-10-26. **Scope:** the Covered regime (`contracts/options`), as of the morning of 26 October. Since then the Pro gate passed and the Margin section runs on its own contract (`#/pro`); the Write screen was folded into Markets → Sell (PR #79), Protect was removed (PR #87), and Reserves is now called Locked reserves (PR #90). Read the screen names below with those renames in mind.

This is a **delta** on what the frontend already has: Markets (series with competing makers), Buy dialog, Portfolio, Write, Reserves (with a shortfall banner) and Issuer. It follows the patterns retail option apps use (option chain → order ticket with payoff chart → positions with an exercise action). Nothing here changes the contract or its economics. If an item conflicts with `PRODUCT_SPEC.md`, the spec wins.

## Priorities (before the 06:00 freeze)

| # | Item | Where | Why |
|---|---|---|---|
| P0 | Payoff chart and risk lines in the Buy dialog | `market/BuyDialog.tsx` | The core "risk management" visual; `packages/payoff` already computes it |
| P0 | Correct the shortfall banner and show it on every affected option | `reserves/CollateralPanel.tsx`, `market/MarketSeries.tsx` | Disclosure required by `PRODUCT_SPEC.md` D6 |
| P0 | Exercise confirmation states the physical delivery | Portfolio exercise flow | Holders must see what leaves and what arrives |
| P1 | Option chain overview per asset and expiry | `views/MarketsView.tsx` | The standard way to scan strikes |
| P1 | Strategy presets (protective put, covered call, collar) | Markets or a new panel | Turns "risk tools for tokenized assets" into one click |
| P2 | In-the-money badge in Portfolio against the assumed price | `views/PortfolioView.tsx` | Nice to have |

Cut from the bottom if time runs short. Never ship P1/P2 without P0.

## 0. Wiring `packages/payoff`

- Import from `packages/payoff/src/index.ts`. Add a Vite alias `@strata/payoff` → `../packages/payoff/src/index.ts` and the matching `paths` in `tsconfig.app.json` (plus the folder in `include`), or import by relative path. No runtime dependencies.
- Convert on-chain amounts with `toNumber(units, decimals)` only for display and charts. Never sign or send a `number`.
- Map an offer to a leg: `{ qty: toNumber(qty, u.decimals), strikeTotal: toNumber(strike_total, q.decimals), premiumTotal: toNumber(premium_total, q.decimals) }`.
- Every chart and figure from the package carries `label: "hypothetical"`. Show the caption **"Hypothetical P&L at expiry, not a quote"** under every chart.

## 1. The price input (important)

The Covered contract has **no oracle and no market price**. The UI must not show a "current price" as if it came from the chain or a market.

- Add one control per asset: **"Assumed price"** (slider plus number input), defaulting to the strike per unit of the selected offer.
- Everything that depends on a price (chart marker, "P&L at assumed price", in-the-money shading, Portfolio badge) uses this value and says so.
- Optional: a demo reference price, labelled "Demo reference price (team-set)". Never label it "market price" or "oracle".

## 2. Buy dialog: payoff and risk lines (P0)

Add above the existing details in "Review purchase":

1. **Payoff chart** for the buyer: `longCall` or `longPut` sampled over `[0.6 × K, 1.4 × K]` (per-unit `K = strikeTotal / qty`).
   - Profit area tinted success, loss area tinted danger.
   - A dashed vertical line at the assumed price, with a dot on the curve.
   - Axis: price per unit in the quote token; P&L in total quote units.
2. **Risk lines** (all derived, all display-only):

   | Line | Value |
   |---|---|
   | Premium | `premium_total` and per token |
   | Breakeven | CALL `K + premium/qty`, PUT `K − premium/qty` |
   | Max loss | `premium_total` (the buyer can lose only the premium, ignoring issuer action) |
   | Max gain | CALL "Unlimited"; PUT `qty × K − premium` |
   | P&L at assumed price | from the leg payoff, signed and coloured |
   | Collateral in escrow | PUT `strike_total` quote; CALL `qty` underlying |

3. **Issuer notice**, always visible for flagged assets: *"The issuer can freeze accounts or claw back {code}. If that blocks settlement, the premium is not refunded."*

Worked check (from `PRODUCT_SPEC.md` §5): PUT, qty 10, strike 1,000 USDx total, premium 40 → breakeven 96, max loss 40, P&L +260 at an assumed price of 70.

## 3. Shortfall disclosure (P0)

The current banner says *"Affected exercises and claims will fail until the balance is restored."* That is **not accurate**: payouts keep succeeding first come, first served until the pooled balance runs out (ABI §6). Replace it with:

> **The contract holds less {code} than it owes.** The issuer clawed back {code} from the escrow. Payouts on {code} options are served first come, first served until the balance runs out, so the last holders may not be paid. New offers, purchases and transfers on {code} are blocked until the balance is restored. There is no refund.

Show the same warning (short form plus link to Reserves) on **every** option of the affected token in Markets, the Buy dialog and Portfolio. Condition: `open_collateral(token) > balance(contract)` for the option's underlying or quote token.

## 4. Exercise confirmation (P0)

Before signing `exercise`, show:

- PUT: *"You deliver {qty} {underlying}. You receive {strike_total} {quote}. Both happen in one transaction or not at all."*
- CALL: *"You pay {strike_total} {quote}. You receive {qty} {underlying}. Both happen in one transaction or not at all."*
- The expiry countdown, and *"Exercise is possible until {expiry}. After that the writer reclaims the collateral."*
- If the holder's balance of what they must deliver is too low, say so before signing (the transaction would fail with SAC #10).

## 5. Option chain overview (P1)

Per asset and expiry tab ("Nov 21 '26 · 26d"):

- One row per strike per unit, **calls on the left, puts on the right**, strike in the middle.
- Each side shows the **best premium per token among funded, unexpired offers** and the number of makers. Empty cell: "—".
- Shade the in-the-money side against the assumed price (calls when price > strike, puts when price < strike).
- Clicking a cell opens the existing series view or Buy dialog for that offer.
- Data: build from `list_open_for(asset)` + `get_options`, filtered by `expiry > now`. Re-read the offer immediately before purchase (the RFQ truth rule in `AGENTS.md`).
- **Do not show:** bid/ask depth, volume, implied volatility, Greeks, or any model price presented as a market price.

Only strikes that have at least one live offer appear. Strikes with different quantities still group by strike per unit; the cell shows the best per-token premium.

## 6. Strategy presets (P1)

For an asset the connected wallet holds, three buttons. Each selects the matching live offer(s) and shows the combined payoff from `packages/payoff`:

| Preset | Legs | Package call | One-line explanation |
|---|---|---|---|
| Protective put | hold the asset + buy a put | `protectivePut(holding, put)` | "Floor your loss below the strike for the premium." |
| Covered call | hold the asset + write a call | `coveredCall(holding, call)` | "Earn the premium; give up gains above the strike." |
| Collar | hold + buy a put + write a call | `collar(holding, put, call)` | "Floor and cap: cheaper protection, limited upside." |

- `holding.entryPrice` is an input defaulting to the assumed price; label it "Your entry price".
- Show `breakevens`, `maxGain`, `maxLoss` ("Unlimited" for `Infinity`) and `capitalLocked`.
- Each leg is **its own transaction**. Do not call the preset "a structured product", and do not imply the legs settle together (`AGENTS.md`, P2 rule). Text: *"Two separate options. Each settles on its own."*
- Covered call means the user writes an offer (Write view); the preset prefills the Write form instead of buying.

## 7. Portfolio in-the-money badge (P2)

For Active options the user holds: "In the money at assumed price {p}" when intrinsic value > 0, with the intrinsic value. Never "profitable", since the premium is already sunk.

## 8. Copy rules

- Never write "guaranteed", "insured", "safe" or "risk-free". "Fully collateralized" is allowed for Covered, always next to the issuer notice.
- Use "covered up to" for `fullCoverPrice` if Margin numbers are shown next to covered ones; Margin is a separate experimental contract on Testnet, never described as fully collateralized.
- Prices per unit, totals underneath, numbers right-aligned in tabular figures; green and red only for profit and loss.
- Asset names are labels of fictional Testnet assets: keep the existing "Fictional Testnet asset" caption.

## 9. Acceptance

1. The Buy dialog for the PUT in §2's worked check shows breakeven 96, max loss 40, and +260 at an assumed price of 70.
2. With a clawback on Testnet (`scripts/deploy/issuer-demo-testnet.sh` deployment), every option on that token shows the §3 warning, and the Buy button explains why the purchase is blocked.
3. The exercise confirmation shows both legs with exact token amounts.
4. No screen shows a price that is not labelled assumed, team-set or hypothetical.
5. `npm run build`, `npm run lint` and the unit tests pass; e2e covers the Buy dialog chart rendering.

A clickable mockup of the main screen (chain + ticket + payoff) was shared with Dev 1 on 2026-10-26; this document is the reference, not the mockup.
