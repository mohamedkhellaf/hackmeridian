# Strata UI foundation

Dark-only editorial look (visual identity v2: Fraunces display, Schibsted Grotesk UI, IBM Plex Mono numbers; sediment imagery, never photos). Tokens are CSS custom properties on `:root` in `src/index.css`
(`--bg`, `--surface`, `--border`, `--text`, `--muted`, `--link`, `--ok`, `--warn`, `--danger`, `--put`, `--call`,
`--font-display`, `--font-sans`, `--font-mono`, `--raised`, `--raised-2`, `--row-line`, `--ink`, collateral layers `--layer-offered|active|awaiting|reclaim` and `--layer-call-*`, `--held-line`, `--r-sm..--r-2xl`). Never hard-code colours; use a token. All numbers are tabular
(set `font-variant-numeric: tabular-nums` on numeric elements; it is NOT global because it widens punctuation in the UI face). Utilities: `.ui-display` (Fraunces 300, opsz 144), `.ui-num` (Fraunces numbers, opsz 72).

Import everything from `src/ui` (`import { Button, Tag } from '../ui'`). Primitive styles are in `ui.css` (classes
prefixed `ui-`), shell styles in `src/layout/layout.css`. `src/App.css` holds LEGACY styles for components that have not
been migrated yet (`.card`, `.form`, `.table-wrap`, `.modal`, `.banner`...). When you migrate a component, delete the
legacy rules it no longer uses.

## Primitives

| Component | Usage |
|---|---|
| `Button` | `<Button variant="primary\|secondary\|danger\|ghost" size="sm\|md\|lg" fullWidth loading>Buy</Button>`. One primary (white) per view. `loading` shows a spinner, sets `aria-busy`, disables. `type` defaults to `button`. |
| `Tag` | `<Tag tone="put\|call\|ok\|warn\|neutral">PUT</Tag>`. Uppercased small label. |
| `StatusDot` | `<StatusDot tone="ok\|warn\|danger\|neutral" />`. Decorative; always pair with text. |
| `StatGrid` + `Stat` | `<StatGrid columns={3}><Stat label="Open offers">4</Stat>...</StatGrid>`. Each `Stat` is `role="group"` named by its label (e2e: `getByRole('group', { name: 'Open offers' })`). Optional `hint`. One column on phones. |
| `Card` | `<Card title subtitle actions flush>...</Card>`. Header row with title left and `actions` right. `flush` removes body padding for full-bleed tables. |
| `PageHeader` | `<PageHeader title subtitle actions />`. Every view starts with it (renders the `h1`). |
| Table | `<div className="ui-table-wrap"><table className="ui-table">`. First column left, others right-aligned. Two-line cell: `<td>5 FUND<span className="ui-sub">0.36 / unit</span></td>`. Row highlight: `className="is-best"`. `.ui-left` left-aligns a cell, `.ui-strong` bolds. Wrap in `Card flush` for the bordered look. |
| `Segmented` | `<Segmented label="Option type" value options={[{value:'put',label:'Put'}]} onChange />`. Radio-group semantics. |
| `Chip` | `<Chip selected={on} onClick>FUND</Chip>`. Filter pill, `aria-pressed`. |
| `Dialog` | `{open && <Dialog title="Review purchase" onClose footer={<Button>..</Button>}>...</Dialog>}`. Centered modal; at <= 640px a bottom sheet with grabber and full-width stacked footer buttons. Escape and backdrop close, focus moves in (close button, or `initialFocusRef`), Tab is trapped, focus is restored. `role="dialog"`, `aria-modal`, `aria-labelledby` set. |
| `Banner` | `<Banner tone="warn\|ok\|danger\|info" title?>text</Banner>`. `danger` is `role="alert"`. |
| `NoticeToast` + `Notice` | Transaction result toast, mounted once in `App`. `Notice = { kind:'ok', text, hash, mock } \| { kind:'err', text }`. Success shows the tx hash (stellar.expert link, or "(mock)"); `role="status"`. Errors `role="alert"`, stay until dismissed. |
| `AssetBadge` | `<AssetBadge code="FUND" size={34} />` round initials badge (FUND -> FD), stable colour per code. |
| `Mono` | `<Mono>GMAK…BBBB</Mono>` for addresses, hashes, contract ids. |
| `Amount` | `<Amount value="1,250.00" unit="USDx" />`; pass already formatted strings (use `formatAmount`). |
| `Icon` | `<Icon name="markets\|write\|portfolio\|reserves\|issuer\|search\|close\|check\|alert\|external" size strokeWidth />`. Decorative, uses `currentColor`. |

## v2 primitives

| Component | Usage |
|---|---|
| `Sediment` | `<Sediment seed="FUND" size="thumb\|hero\|fill" tone? label? />`. Procedural SVG strata, deterministic from `seed`. `thumb` 112x72 (series header), `hero` full width min 320px, `fill` absolutely fills a `position: relative; overflow: hidden` parent. `aria-hidden` unless `label` is given. |
| `StrataBar` | `<StrataBar code="USDx" unit="USDx" kind="put\|call" owed held layers={{offered, active, awaiting, reclaim}} format? legend? />`. Amounts are number or bigint in one unit. Ink outline = held; hatched part + text note = shortfall (held < owed). `role="img"` with a full text summary. `StrataLegend` is exported separately. |
| `PayoffSketch` | `<PayoffSketch kind="put\|call" strikeLabel="100.00" asset="FUND" compact? />`. Schematic long payoff with strike marker and caption "Hypothetical payoff". No pricing. |
| `PageHero` | `<PageHero eyebrow title lede stats={[{label, value}]} actions sediment={{seed, captionLabel, caption}} media? />`. Renders the `h1` (64px Fraunces), a stat row (each stat is `role="group"` named by its label, like `Stat`) and a Sediment panel on the right that sits above the text on phones. Bleeds to the content edges: use it as the first child of a view. |
| `.ui-bar` | In a table's first cell: `<span className="ui-bar" />` before the maker; shows a 3px bar on `tr.is-best` (`ui-bar--call` for blue). |

## Layout (`src/layout`)

- `AppShell` renders demo banner, sidebar, top bar, content slot, footer disclaimer and the mobile tab bar.
  Props: `route`, `portfolioBadge`, `mock`, `contractId`, `backing` (`{ok, ledger}`, shows "Backing verified · ledger N" in the contract card), `balances` (slot), `wallet` (slot), `children`.
- `WalletChip` is the default `wallet` slot: a Connect wallet button, or a pill (dot + short address) that opens the wallet menu (`Dialog`: wallet name, full address + copy, balances in real mode only, Refresh, Disconnect). Balances (`BalancesBar`, `variant="inline"|"list"`) are hidden in mock mode; on phones the top bar is one row and balances live in the menu.
- `BuyDialog` takes `onOutcomeShown`: on phones the confirmed sheet calls it so `App` drops the duplicate success toast.
- Routing: `useHashRoute()` returns `[route, navigate]`; routes `markets | write | portfolio | reserves | issuer`
  (`#/markets`, default). Unknown hashes fall back to markets. No router dependency.
- Breakpoints: <= 768px sidebar hidden and bottom tab bar (Markets, Write, Portfolio, Reserves; Issuer is the person icon
  in the top bar); <= 640px dialogs become bottom sheets and stat grids go single column. Touch targets are >= 44px on
  the tab bar and sheet buttons.

## State and views

- `src/state/useStrata.ts` owns wallet, options client (mock singleton or Soroban client rebuilt on signer change),
  listings, collateral and health, balances, the `run()` transaction runner, `notice`, `buying` / `confirmBuy`,
  `writeOffer`, `actionFor(o)` and `actionsWaiting`.
- `src/views/*View.tsx` are thin: page title, subtitle, and the feature components. Each takes explicit props (see the
  `*ViewProps` interfaces). Restyle internals freely; keep prop shapes unless you also update `App.tsx`.

## Honesty rules

The demo banner (and "Mock data: no contract connected." in mock mode) and the issuer-risk footer are always visible;
do not hide or shorten them. Status must never be colour-only: keep the text label next to every dot or tag.

## Testing hooks (e2e)

Use roles and text: sidebar links (`getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Portfolio' })`),
`getByRole('group', { name: 'Open offers' })`, toasts via `getByRole('status')`, dialogs via `getByRole('dialog')`.
Shared helpers are in `frontend/e2e/helpers.ts`.
