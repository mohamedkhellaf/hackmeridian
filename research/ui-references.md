# UI/UX references: comparable options and structured-product interfaces

**Purpose.** A reference sheet of how other products present options, collateral, payoffs and issuer controls, so Dev 3 (and Dev 1 for financial wording) can make informed choices for Strata's five tabs: **Markets**, **Write**, **Portfolio**, **Reserves**, **Issuer**. This is for orientation and vocabulary, not for copying. Nothing here changes the product promise in `PRODUCT_SPEC.md`.

**How this was compiled (October 26, 2026).** Compiled from web search results plus product knowledge from memory. The build sandbox could not open any product site directly (network policy), so there are **no screenshots in the repo**. Items marked *(source)* come from a page a search returned; items marked *(recall)* are from memory of the product and should be checked against the live app before being quoted anywhere public. Links are at the end so a team member can open them on a normal machine and take their own screenshots if wanted.

---

## 1. Where Strata sits versus the field

| Axis | Most crypto venues (Deribit, Derive, Aevo) | DeFi vault / AMM products (Ribbon-era DOVs, Thetanuts, Cega, Stryke, Panoptic, Hegic, Moby) | TradFi retail (Robinhood, tastytrade, Fidelity, IBKR, Sensibull, OptionStrat) | **Strata** |
|---|---|---|---|---|
| Underlying | BTC/ETH, a few alts | BTC/ETH/alts, LP positions | Listed stocks, ETFs, indices | Eligible **tokenized RWA** on Stellar (fictional Testnet assets in the MVP) |
| Settlement | Cash, mostly European, margined | Mostly cash or token-settled vaults; some American (Stryke, Panoptic) | Physical for stocks, American | **Physical, American, fully collateralized**, no margin |
| Price discovery | Central limit order book + RFQ for blocks | Pool pricing / AMM / weekly auction | Exchange order book | **Funded on-chain offers** from competing makers, no backend |
| Risk framing in UI | Margin, liquidation, Greeks | APY, "no liquidation", epochs | Max loss, breakeven, probability of profit | Collateral held vs owed, issuer powers, exact token units |
| Issuer / compliance | Not applicable | Not applicable | Hidden inside the broker | **Visible**: authorization, freeze, clawback are first-class |

The gap we fill in UI terms: nobody above shows *proof of full collateral per position* and *issuer control over the underlying* as primary screens. That is our differentiator and it should stay visually central (Reserves rail on Markets, collateral panel on Write, Issuer tab).

---

## 2. Reference cards

### 2.1 Crypto options venues (order book + RFQ)

**Deribit** (CEX, the reference UI most crypto options traders know)
- Option chain: strikes run down the **centre column**, calls on the **left**, puts on the **right**; bid and ask columns per side; the chain can show all expiries or one expiry chosen at the top. Clicking a row opens the order form for that strike. *(source: Deribit insights guides)*
- Modular "UI Pro": resizable, movable modules; the order form and order book update when a different option is clicked in the chain; the positions table shows futures and options together with Greek columns. *(source)*
- **Position Builder**: combine legs and see the portfolio P&L curve; works without login for theoretical positions. *(source)*
- Take-away for Strata: the "pick in a table, ticket updates beside it" pattern is familiar. Our Markets table + BuyDialog already does this; keeping strike/premium/expiry column order consistent with the chain convention helps crypto-native judges read it fast.
- Avoid: Greeks-heavy density. Our buyers are hedgers, not vol traders.

**Derive (formerly Lyra)** (on-chain order book on its own rollup)
- Five screen components in their own onboarding: options chain (strikes, expiries, premiums, Greeks, IV), **trade ticket** (quantity, price, limit/market, margin required, total exposure, **payoff curve preview before submitting**), subaccounts, portfolio view (positions, margin, balances, PnL), Greeks dashboard. *(source: Derive "Day 2: Navigating Derive")*
- Described by reviewers as a "modular CEX-like interface" with an RFQ tab for large or multi-leg trades. *(source)*
- Take-away: payoff preview *inside the ticket* before signing is the single most reused pattern across good products. Our BuyDialog has the payoff chart; keep it there, not on a separate tab.

**Aevo** (off-chain matching, on-chain settlement; options + perps + structured products in one margin account)
- Options, perps and structured products in one account; European options. Order ticket is the standard chain-then-ticket pattern. *(source, thin)*
- Take-away: mostly a warning. The "one margin account for everything" framing is exactly what we do **not** do; our copy should say "no margin, collateral locked per position" wherever a crypto-native user might assume otherwise.

**Paradigm (RFQ for crypto blocks, settles on Deribit/Bybit/BIT)**
- Taker builds an RFQ (legs, direction, size), picks counterparties, makers return tradable bids/offers, **makers cannot see each other's prices**, only the taker sees the stack and crosses one; settlement is an atomic block trade that fully clears or is rejected. Quotes valid about 120 s by default in one integration; inquiry expires after 300 s. *(source: Paradigm docs and partner help pages)*
- Take-away: this is the closest mental model to our maker competition. Our version is simpler and more transparent (offers are public and funded on-chain). Useful vocabulary: "indicative" vs "executable", quote expiry countdown, "best offer" highlighted, "funded" badge. Our RFQ truth rule (indicative off-chain, executable only when the chain confirms a funded offer) should be visible as a status chip, not only in docs.

### 2.2 DeFi options protocols (AMM, vaults, pools)

**Stryke (ex Dopex, CLAMM on Uniswap-style liquidity)**
- Options are written out of concentrated-liquidity ticks; buyer pays a premium, liquidity at the strike tick is moved into the option contract until exercise or expiry; **American exercise**; purchased options are ERC-1155 receipt tokens. *(source: Dopex V2 litepaper summaries)*
- UI *(recall)*: strike ladder with available liquidity per strike shown as a bar, expiry tabs (short tenors), a side ticket with premium and "max cost" lines.
- Take-away: "available size at this strike" is a nice pattern. Our equivalent is "how many funded offers exist at these terms"; the Markets table can group by series (we already have `MarketSeries`).

**Panoptic (perpetual options on Uniswap v4 LP positions)**
- Options never expire; premium accrues like a streaming fee; strategy templates (strangles, straddles). *(source)*
- Take-away: mostly a contrast. Our fixed expiry and American exercise are simpler to explain. Nothing to borrow for P0.

**Premia Blue** (AMM + order book, European, range orders) *(source, thin)*
- Take-away: dual-mode trading complicates the UI; we have one mode (funded offers). Skip.

**Hegic** (peer-to-pool, "simpler UX" positioning) *(source + recall)*
- *(recall)* One-screen flow: choose asset, call/put, strike (a few presets), period, size; shows cost and breakeven; no order book. Later versions wrapped common strategies as one-click.
- Take-away: for a hedger, a **guided form** beats a chain. Our BuyDialog is already form-shaped; the Write form could show 3 or 4 preset strikes relative to the reference price (e.g. "5% below", "10% below") as a convenience, while still writing exact integer units on-chain.

**Moby** (Arbitrum, pool-based, "no liquidation" marketing) *(source: press releases only)*
- Take-away: an example of marketing claims to avoid ("~1000x leverage", "no liquidation risk"). Our copy must not resemble this.

**Ribbon / Aevo theta vaults, Thetanuts, Cega (DeFi option vaults, "structured products")**
- Mechanics: deposit, vault sells covered calls or puts each epoch via auction; APY headline; receipt token. Cega: "option pool", "bond option pool", "leverage option pool", principal protected within a drawdown range. *(source)*
- UI *(recall)*: product **cards** with APY, strategy name, underlying icon, epoch countdown, capacity bar, and a "Risk" accordion. Third-party risk reviews scored these medium-to-high risk; much of the risk was composability (Ribbon settled through Opyn). *(source)*
- Take-away: the card layout is good for strategy presets (P1: protective put, covered call, collar) but we must **never headline APY**. If we show a yield figure for a covered call it is "premium / collateral over tenor, hypothetical", labelled as such.

**Rysk (now on Hyperliquid HyperEVM; covered calls and cash-secured puts, sell-side first)** *(source: press and DefiLlama)*
- Closest DeFi cousin in *economics* (fully on-chain covered calls and cash-secured puts). UI details not retrievable from here; the team may want to open `app.rysk.finance` on a normal machine as the one DeFi comparison most worth 10 minutes.

**Solana: PsyOptions (American, fully collateralized, physically settled, options as SPL tokens), Zeta (European, margined), Dual Finance** *(source)*
- PsyOptions is the historic precedent for "fully collateralized and asset-settled" on-chain options with transferable option tokens. Useful as a one-line precedent in the deck ("done on Solana for crypto; not yet for regulated RWA").

**Stellar** *(source)*
- No live options protocol found on Stellar/Soroban. Perps (Stellars Finance, planned) and interest rate swaps (XCCY, SCF submission) exist as plans. Nothing to compare UI against; note this as a gap in the pitch.

### 2.3 TradFi retail options UIs

**Robinhood: Options Strategy Builder**
- Pick a strategy, adjust strikes/expirations, place the order. Chart: P&L on the vertical axis, underlying price on the horizontal, **dotted breakeven line**, green/red dots mark buy/sell legs. Single-leg view shows breakeven on the chain; after choosing a strategy the chain shows max gain, max loss, Greeks. *(source: Robinhood help pages)*
- Earlier redesign split one "Trade" button into Buy / Sell / Options with live prices on the buttons. *(source: design critique, Feb 2025)*
- Take-away: breakeven as a dotted vertical line and max loss / max gain as two numbers above the chart is the retail standard. Our `PayoffChart` should keep exactly those three annotations and nothing else for P0.

**tastytrade** (options-first, probability-driven)
- Trade page shows expected move visually and numerically; IV Rank, probability of profit, probability of OTM are decision inputs placed where the order is built. *(source)*
- Take-away: we do not have IV data and must not fabricate it. The transferable idea is **putting the decision metric next to the button**: for a protective put that metric is "protected floor per token" and "cost as % of holding", both computable from exact integers.

**Interactive Brokers: OptionTrader / Strategy Builder / Performance Profile**
- Strategy Builder toggles on at the bottom of the chain; legs fill a right-hand panel with a combo name; Performance Profile button sits at the bottom of that panel; profile layout has quote details top-left, option quote below, chart below that, a "Max move" dropdown. *(source: IBKR Campus)*
- Take-away: an example of the *power* end. Good for vocabulary ("Performance Profile", "Scenario Analysis"), bad as a layout model for a 3-minute demo.

**Fidelity Active Trader Pro: Profit/Loss Calculator**
- Model a strategy, change assumptions (underlying price, days to expiry), trade directly from the calculator. Strategy guide shows max profit, max risk, P&L diagram per strategy. *(source)*
- Take-away: "trade from the chart" is the direction our BuyDialog already takes.

**Sensibull (India, broker-embedded strategy builder)**
- Multi-leg builder with payoff, breakevens, Greeks, max P&L, margin; **ready-made strategies grouped by view** (Bullish / Bearish / Neutral); payoff **table** (P&L on target day and expiry day) as an alternative to the chart; wizard for beginners. A competitor's review notes a clean payoff diagram can hide a historically losing strategy. *(source)*
- Take-away: grouping presets by *intent* ("protect what I hold", "earn on what I hold") rather than by Greek is the right framing for P1 strategy presets. A small P&L table under the chart (5 price points) is cheap and helps non-chart readers.

**OptionStrat** (standalone builder)
- Hover a template for a mini payoff; main view is a **P&L heat table** (price × date) with the chart; summary stats: net debit/credit, max loss, max profit, breakeven; "chance of profit" behind a paywall; optimizer ranks trades by return or chance. *(source)*
- Take-away: summary stat row (cost, max loss, max gain, breakeven) above the chart is the convention. We can fill all four from exact integers without any model.

**Market Chameleon** (chain-to-chart overlay)
- Clicking a bid/ask in the chain overlays the payoff diagram on the chain; clicking more adds legs to a selection table. *(source)*
- Take-away: confirms "chart appears where you clicked" beats "go to another tab".

**TradingView strategy builder**: edit expiry, strike, size in the same view as the chart. *(source)* Same lesson.

### 2.4 Transparency and issuer-control UIs (relevant to Reserves and Issuer tabs)

**Proof-of-reserves / transparency pages** (OpenEden USDO, Chronicle VAO dashboard, Aegis YUSD, Arbitrum Prime Vaults, Octav guidance) *(source)*
- Common pattern: headline collateral ratio or "Health Index", per-asset breakdown, liabilities vs holdings side by side, **"last updated" timestamp**, links to on-chain verification. Octav's guidance: a headline number is only a claim until the breakdown backs it up.
- Take-away: our Reserves view already does "owed vs held per token". Add a visible "read at ledger N / time" stamp and a one-click link to the contract on stellar.expert; that matches the convention and supports the honesty claim.

**Tokeny T-REX (ERC-3643) issuer tooling**
- Servicing App: no-code issuer/agent console to deploy tokens, set compliance rules, **mint, burn, freeze**, see holders and transfers. Investor Portal: holdings, history, transfers to another compliant investor; a blocked transfer tells the receiver *why* it failed. *(source: Tokeny docs)*
- Take-away: our Issuer tab is the Stellar-native equivalent (authorize / revoke / clawback on an auth-required asset). The borrowable idea is **the failure message names the rule**: "Token balance is deauthorized by issuer" is already surfaced in `frontend/src/stellar/errors.ts`; keep it verbatim and visible in the demo's freeze scene.

---

## 3. Pattern checklist mapped to Strata screens

| Pattern | Seen in | Strata screen | Status / suggestion |
|---|---|---|---|
| Table of instruments, ticket beside it | Deribit, Derive, IBKR | Markets + BuyDialog | In place. Keep column order Option, Size, Total strike, Premium, Expiry. |
| Payoff chart inside the ticket before signing | Derive, Robinhood, Fidelity, Market Chameleon | BuyDialog | In place (`PayoffChart`). Keep it labelled "hypothetical". |
| Summary stats above chart: cost, max loss, max gain, breakeven | OptionStrat, Robinhood, Sensibull | BuyDialog, Write form | Ensure all four are shown; all computable from exact integers. |
| Breakeven as dotted vertical; buy/sell legs as dots | Robinhood | PayoffChart | Cheap, add if missing. |
| Small P&L table (5 price points) | Sensibull, OptionStrat | BuyDialog | Optional P1, helps non-chart readers and voice-over. |
| Indicative vs executable status, quote expiry countdown, best offer highlight | Paradigm, RFQ integrations | Markets | Show a "funded on-chain" chip per offer and a "re-checked at purchase" line in BuyDialog. |
| Available size per strike / grouped series | Stryke, Deribit | Markets (`MarketSeries`) | In place as series grouping. |
| Intent-grouped presets (protect / earn / both) | Sensibull, Robinhood, vault cards | P1 strategy presets | Group by intent, never by Greek; never headline APY. |
| Collateral ratio, per-asset owed vs held, last-updated, chain link | PoR dashboards | Reserves, Markets rail | In place; add ledger/time stamp and explorer link if missing. |
| Issuer console: authorize / freeze / clawback with holder lookup | Tokeny Servicing App | Issuer | In place; keep the failure reason verbatim on the holder side. |
| Decision metric next to the button | tastytrade | BuyDialog | Show "floor per token" (put) or "cap per token" (call) and "cost as % of position". |
| Progressive disclosure: few numbers first, details on tap | Robinhood mobile, Hegic | All | Keep Greeks, IV and model prices out of P0 entirely. |

## 4. Things we deliberately do differently

- **No margin, no leverage, no liquidation vocabulary.** Many crypto UIs centre these; ours centres "collateral locked" and "held vs owed".
- **No APY headline.** Vault UIs lead with APY; we lead with the instrument's terms and show premium as an amount, with any percentage labelled hypothetical and tenor-bounded.
- **No fabricated depth.** Order-book UIs imply liquidity; we show only funded offers that exist on-chain, with maker address and offer ID.
- **Issuer powers on screen.** No competitor shows the issuer's ability to freeze or claw back as part of the product surface. We do, because the asset class demands it and the demo makes it a scene.
- **Exact units.** Chains show prices in floats; our tables show exact token units with decimals from the asset record, and the chart is the only place `number` is allowed.

## 5. Links for the team to open on a normal machine

Product and docs pages that the search returned (not reachable from the build sandbox):

- Derive onboarding: https://insights.derive.xyz/day-2-navigating-derive-your-first-look-at-the-options-platform/
- Deribit new UI and 7-step guide: https://insights.deribit.com/exchange-updates/introducing-new-user-interface/ and https://insights.deribit.com/education/7-step-guide-to-getting-started-with-deribit-options
- Paradigm RFQ docs and builder post: https://docs.paradigm.co/unified-markets/rfq-request-for-quotes and https://paradigm.co/blog/launching-our-rfq-builder
- Robinhood Options Strategy Builder: https://robinhood.com/us/en/support/articles/about-the-options-strategy-builder
- IBKR Performance Profile lesson: https://www.interactivebrokers.com/campus/trading-lessons/performance-profile-for-options-2/
- Fidelity ATP P&L calculator: https://fidelity.com/learning-center/tools-demos/active-trader-pro-platforms/profit-and-loss-calculator-atp-video
- OptionStrat builder tutorial: https://optionstrat.com/tutorials/options-builder
- Sensibull review (2026) and builder announcement: https://algotest.in/blog/sensibull-review-2026-features-pricing-and-who-its-for/ and https://blog.sensibull.com/2018/08/17/announcing-custom-strategy-builder
- Market Chameleon chain overlay: https://marketchameleon.com/Learn/OptionStrategyPayoutDiagram
- TradingView strategy builder: https://www.tradingview.com/support/solutions/43000707214-options-strategy-builder-design-your-trades-with-precision/
- Panoptic docs: https://panoptic.xyz/docs/faq
- Stryke deep dive: https://alearesearch.io/deep-dives/stryke
- Rysk on Hyperliquid (press): https://www.barchart.com/story/news/18533/hyperion-defi-announces-institutional-volatility-income-vault-built-on-rysk-protocol
- Cega overview: https://www.gate.com/it/learn/articles/understanding-cega/2557
- Ribbon DOV FAQ: https://docs.ribbon.finance/faq/dov-trading-and-options
- Solana options landscape: https://madeonsol.com/blog/solana-options-trading-defi
- Proof-of-reserves pages: https://docs.openeden.com/usdo/transparency , https://docs.chroniclelabs.org/Resources/FAQ/VaoDash , https://octav.fi/blog/defi-treasury-transparency-dashboards
- Tokeny Servicing App: https://docs.tokeny.com/docs/servicing-app
- DeFi options rankings: https://defillama.com/protocols/options

Apps worth a direct look (wallet not required to view the layout): app.derive.xyz, app.aevo.xyz, app.rysk.finance, app.stryke.xyz, app.panoptic.xyz, deribit.com/options/BTC, optionstrat.com/build/covered-call/AAPL.
