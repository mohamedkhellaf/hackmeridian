# StellSec frontend style rules

StellSec is a clearing desk. Holders of tokenized assets buy protection, makers lock collateral, and the app reads like a broker's paperwork: term sheet, contract note, reconciliation. It opens on the work (tables of offers and positions), speaks in terms and numbers, and proves things with links to the chain. Anything that reads as marketing, decoration or reassurance is out. The tone is professional, ergonomic and quiet.

Every PR that touches `frontend/` is checked against this file. Research behind it: practitioner catalogues of AI-generated UI tells (avoid-ai-design, Kostac, 925studios), Linear's redesign notes, GitHub Primer typography, Deribit and Bloomberg conventions.

## 1. Type

- **Public Sans** (400, 500, 600, 700) for everything. **IBM Plex Mono** (400, 500) only for addresses, contract IDs and transaction hashes. Nothing else is loaded.
- Scale, rem-based in spirit: h1 22px/600, section heading 15px/600, body 14px, table 13.5px, small and captions 12.5px. Sentence case everywhere.
- Headings are plain nouns: `Markets`, `Write`, `Positions`, `Collateral`, `Issuer`. No heading carries a paragraph under it.
- No uppercase or tracked labels. Table headers and form labels are 12.5px, weight 500, muted, normal letter spacing.
- Tabular figures on every number (`font-variant-numeric: tabular-nums` is set on the root), right aligned in tables, fixed decimals per asset. The unit goes once in the column header or once after the number, never both.
- Body copy, where it exists at all, is left aligned and under 80 characters a line.

## 2. Colour

Neutral dark, not tinted. Tokens live in `src/index.css`; keep these names.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#18181a` | Ground |
| `--surface` | `#1f1f22` | Raised: cards, dialogs, hover rows |
| `--surface-hover` | `#262629` | Hover on controls |
| `--border`, `--row-line` | `#2c2c30` | Hairlines |
| `--border-strong` | `#3a3a40` | Control borders, dialog edge |
| `--text` / `--text-2` / `--muted` | `#ededed` / `#a1a1a6` / `#8a8a92` | Text. Muted is 5.2:1 on ground and 4.8:1 on raised; do not go darker for text |
| `--accent` | `#7c93f0` | Links, focus ring, active nav underline, primary button (`--accent-fg` `#111114` on it) |
| `--danger` | `#e5736a` | Loss, shortfall, error |
| `--warn` | `#d9a85b` | Action needed, degraded |

- One accent only. It marks things you can act on. Asset codes and other plain text are never styled as links unless they are links.
- Semantic colour only for state and always paired with a word or sign. Never for "connected", "verified", "funded", "fully backed", "locked". No green UI chrome; green exists only as the profit region of the payoff chart.
- No tinted panels behind status text. No gradients, glows or blurs. A flat shadow only on dialogs and sheets.
- Puts and calls are told apart by the word in a `Kind` column, not by colour.

## 3. Layout and components

- **Shell.** A horizontal top bar: the `StellSec` wordmark (Public Sans 700, no logo mark), then `Markets`, `Protect`, `Write`, `Positions`, `Collateral`, `Issuer` (and `Pro` when the flag is on) as plain text links, the active one with an accent underline, and the wallet button on the right. No sidebar. Content is at most 1280px wide with 24px gutters (16px on phones). A one-line footer carries the testnet and mock disclosure.
- **Phones (768px and below).** The top bar shrinks to wordmark and wallet. A bottom tab bar has four tabs (`Markets`, `Protect`, `Positions`, `Collateral`) and `More`, which opens a sheet with `Write`, `Issuer` and `Pro`. Touch targets are at least 44px.
- Each page starts with an h1 and, at most, one row of actions or a filter row. No hero, no eyebrow, no lede, no stat cards, no illustration panel.
- Tables over cards. Rows 36 to 38px with a hairline divider. A card is used only for one discrete object: an offer detail, an order review, a form. No nested bordered boxes.
- Radius 6px on buttons, inputs, cards and dialogs. Buttons and inputs are 36px tall (30px for small buttons in table rows).
- Primary button: accent background, dark text, one per view. Secondary: strong border, no fill. Danger: danger-coloured text. A disabled button keeps its shape and border and only quiets its ink, and where the reason is not obvious it carries it as a tooltip (`reason` on `Button`), for example `Connect wallet to buy`. Disabled is never a ghosted grey slab.
- No decorative SVG. The only illustration is the payoff chart.
- No status dots. No tags, pills or badges except the lifecycle state column, which uses the exact contract state names: `Offered`, `Active`, `Exercised`, `Expired`, `Cancelled`.
- No icons inside headings or buttons. Icons only where they replace a word in a tight row (copy, external link, close).
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
