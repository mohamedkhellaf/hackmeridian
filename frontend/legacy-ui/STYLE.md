# StellSec frontend style rules

StellSec is a clearing desk. Holders of tokenized assets buy protection, makers lock collateral, and the app reads like a broker's paperwork: term sheet, contract note, reconciliation. It opens on the work (tables of offers and positions), speaks in terms and numbers, and proves things with links to the chain. Anything that reads as marketing, decoration or reassurance is out. The tone is professional, ergonomic and quiet.

Every PR that touches `frontend/` is checked against this file. Research behind it: practitioner catalogues of AI-generated UI tells (avoid-ai-design, Kostac, 925studios), Linear's redesign notes, GitHub Primer typography, Deribit and Bloomberg conventions.

## 1. Type

- **Public Sans** (400, 500, 600, 700) for everything. **IBM Plex Mono** (400, 500) only for addresses, contract IDs and transaction hashes. Nothing else is loaded.
- Scale, rem-based in spirit: h1 22px/600, section heading 15px/600, body 14px, table 13.5px, small and captions 12.5px. Sentence case everywhere.
- Headings are plain nouns: `Markets`, `Positions`, `Locked reserves`, `Issuer`, `Margin`. No heading carries a paragraph under it.
- No uppercase or tracked labels. Table headers and form labels are 12.5px, weight 500, muted, normal letter spacing.
- Tabular figures on every number (`font-variant-numeric: tabular-nums` is set on the root), right aligned in tables, fixed decimals per asset. The unit goes once in the column header or once after the number, never both.
- Body copy, where it exists at all, is left aligned and under 80 characters a line.

## 2. Colour

Dark navy-graphite with one brand gradient. Tokens live in `src/index.css`; keep these names.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0c0e14` | Ground |
| `--surface` | `#141722` | Sidebar, cards, dialogs, table containers |
| `--raised` | `#1b1f2d` | Toasts, inputs on surface, disabled buttons, row hover |
| `--surface-hover` | `#222739` | Hover on controls and nav rows |
| `--border`, `--row-line` | `#262b3b` | Hairlines |
| `--border-strong` | `#343a4f` | Control borders, dialog edge |
| `--text` / `--text-2` / `--muted` | `#eef0f6` / `#a5abbd` / `#8d93a8` | Text. Muted is 6.3:1 on ground and 5.4:1 on raised; do not go darker for text |
| `--accent` | `#7f8cff` | Links, focus ring, active nav icon |
| `--grad-brand` | `linear-gradient(135deg, #6e8bff, #9b6bff)` | The five gradient places below |
| `--accent-fg` | `#0c0e14` | Ink on the gradient (6.2:1 and 5.4:1; white would be 3.1:1) |
| `--danger` | `#f07178` | Loss, shortfall, error |
| `--warn` | `#f2b55b` | Action needed, degraded |
| `--r`, `--r-lg`, `--r-pill` | `10px`, `12px`, `999px` | Buttons and inputs, cards and dialogs and table containers, pills and counters |

- One accent only. It marks things you can act on. Asset codes and other plain text are never styled as links unless they are links.
- Semantic colour only for state and always paired with a word or sign. Never for "connected", "verified", "funded", "fully backed", "locked". No green UI chrome; green exists only as the profit region of the payoff chart.
- No tinted panels behind status text.
- **Gradients are allowed in exactly five places:** (1) the faint fixed ambient glow at the top of the page background; (2) the logo mark in the sidebar; (3) primary buttons (disabled primary is flat `--raised`); (4) the active sidebar item (soft tint plus a 2px gradient edge); (5) notification counters. Cards, tables and panels are flat surfaces with a 1px border and `--shadow-card`. No other gradients, glows or blurs. A heavier shadow only on dialogs, sheets and the phone tab bar.
- Puts and calls are told apart by the word in a `Kind` column, not by colour.

## 3. Layout and components

- **Shell (1024px and up).** A fixed 240px left sidebar on `--surface`: the `StellSec` wordmark with the gradient mark, then `Markets`, `Positions`, `Locked reserves`, `Issuer` (and `Margin` when the flag is on) as 40px rows with a stroke icon and label, and the wallet button at the bottom. The active row has a soft gradient tint and a 2px gradient edge. The `Positions` row carries the action counter on its right. Content is at most 1280px wide with 24px gutters (16px on phones). A one-line footer under the content carries the testnet and mock disclosure.
- **Icon rail (769 to 1023px).** The sidebar collapses to 72px: icons only, label as tooltip and accessible name, counter over the icon.
- **Phones (768px and below).** The sidebar becomes a top bar with wordmark and wallet. A floating rounded bottom tab bar has three tabs (`Markets`, `Positions`, `Locked reserves`) and `More`, which opens a sheet with `Issuer` and `Margin`. The counter is a small pill over the icon. Touch targets are at least 44px.
- **Counter.** Pill, 20px high, 11.5px/600 tabular, gradient with `--accent-fg` ink, `aria-label` such as `1 position needs action`. It counts what the existing logic counts and nothing else.
- Each page starts with an h1 and, at most, one row of actions or a filter row. No hero, no eyebrow, no lede, no stat cards, no illustration panel.
- Tables over cards, and every table sits in a rounded 12px surface container. Rows 36 to 38px with a hairline divider. A card is used only for one discrete object: an offer detail, an order review, a form. No nested bordered boxes.
- Radius 10px on buttons, inputs and segmented controls, 12px on cards, dialogs, banners, toasts and table containers, 999px on tags and counters. Buttons and inputs are 36px tall (30px for small buttons in table rows).
- Primary button: brand gradient, dark text, one per view. Secondary: strong border, no fill. Danger: danger-coloured text. A disabled button keeps its shape and quiets its ink on `--raised`, and where the reason is not obvious it carries it as a tooltip (`reason` on `Button`), for example `Connect wallet to buy`.
- Toasts and banners: 12px radius on a raised surface. A left stripe appears only for warn and danger, never for success.
- No decorative SVG. The only illustration is the payoff chart. Nav icons are plain 16px strokes.
- No status dots. No tags, pills or badges except the lifecycle state column, which uses the exact contract state names: `Offered`, `Active`, `Exercised`, `Expired`, `Cancelled`, and the nav counter.
- No icons inside headings or buttons. Icons appear in the nav and where they replace a word in a tight row (copy, external link, close).
- No numbered step lists, no "How it works", no in-app FAQ, no "How to verify this yourself". Explanations live in the README.
- Filters are a `select` or a plain segmented control, not rows of chips.
- Meta that belongs in columns goes in columns, not in a middle-dot string.
- Proof is a truncated ID in mono with a copy button and a link to stellar.expert. No "Verified" marks.
- Mobile tables: same tables, horizontal scroll inside the table only, no page level horizontal scroll.

## 4. Copy

- Buttons name the contract action: `Buy`, `Write put`, `Write call`, `Exercise`, `Cancel offer`, `Reclaim`, `Claim delivery`, `Connect wallet`. No arrows, no "Get started", no "Full proof".
- Column headers are one or two words: `Asset`, `Kind`, `Qty`, `Strike`, `Premium`, `Expiry`, `Maker`, `State`.
- No sentence headlines ("Owed equals held."), no rhetorical fragments, no tricolons, no "not X, it's Y", no sentence that ends by reassuring the reader.
- No em dashes. No "seamless", "unlock", "empower", "effortless", "right now", "transparent", "trustless".
- Errors say the exact number and the exact reason: `Need 1,250.00 USDx, wallet has 980.00`.
- Confirmations are two or three words: `Offer written`, `Bought`, `Exercised`.
- Empty states are one short line: `No open offers.`

## 5. Required disclosures, each said once

These are required by `AGENTS.md` and must remain, but each appears in exactly one place, in one short sentence.

| Disclosure | Where | Text |
|---|---|---|
| Testnet, fictional assets, no real funds | Persistent footer, every page | `Stellar Testnet. Fictional assets and makers. No real funds.` |
| Mock data when no contract id is set | Same footer line, appended | `Mock data, not read from a chain.` |
| Issuer can freeze or claw back, which can block settlement | Buy dialog, review step, one muted line | `The issuer controls this asset and can freeze or claw it back, which can block settlement. Collateral does not cover that.` |
| Premium is paid to the maker at purchase and is not refunded | Buy dialog, review step, next to the premium row | `Paid to the maker now. Not refundable.` |
| Payoff chart is hypothetical | Chart caption | `Hypothetical payoff at expiry. Not a quote.` |
| StellSec Pro is simulated | Pro pages, one banner at the top of the Pro shell | `Simulated on fixtures. No contract is called.` |

Nothing else repeats them. No disclaimer paragraphs in rails, cards or heroes.

## 6. Checklist for review

Before opening a PR, search the diff for:

- `Fraunces`, `Schibsted`, `IBM Plex Sans`, `font-display`, `ui-display`, `Sediment`, `PageHero`, `StatusDot`, `eyebrow`, `lede`
- `text-transform: uppercase`, `letter-spacing`
- `tone="ok"`, `--ok`, `Fully backed`, `Locked`, `Verified`, `Best price`
- `How settlement works`, `How to verify`, `Why Testnet`
- em dashes, `→`, `↗` in copy
- Any sentence that appears twice in `src/`

Each hit needs a reason or a fix.
