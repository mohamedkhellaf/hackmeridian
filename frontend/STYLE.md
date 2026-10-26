# Strata frontend style rules

Strata is a small exchange back office, not a landing page. The app opens on the work (tables of offers and positions), speaks in terms and numbers, and proves things with links to the chain. Anything that reads as marketing, decoration or reassurance is out.

Every PR that touches `frontend/` is checked against this file. Research behind it: practitioner catalogues of AI-generated UI tells (avoid-ai-design, Kostac, 925studios), Linear's redesign notes, GitHub Primer typography, Deribit and Bloomberg conventions.

## 1. Type

- One family: **IBM Plex Sans** for everything, **IBM Plex Mono** only for contract IDs, account IDs and transaction hashes. Nothing else is loaded. No display serif, no second grotesk.
- Headings are plain nouns in sentence case: `Markets`, `Write`, `Positions`, `Collateral`, `Issuer`. Page h1 is 20 to 22px, weight 600. Section headings are 14 to 15px, weight 600. No heading carries a paragraph under it.
- No uppercase tracked labels. Table headers and form labels are sentence case, 12 to 13px, muted colour, normal letter spacing.
- Numbers use `font-variant-numeric: tabular-nums`, right aligned in tables, fixed decimals per asset. The unit goes once in the column header or once after the number, never both.
- Body copy, where it exists at all, is 13 to 14px, left aligned, under 80 characters a line.

## 2. Colour

- Neutral dark ground. Text is near white, secondary text is grey. No warm or tinted ink.
- One interactive accent (desaturated blue) for links, focus and the primary button.
- Semantic colour only for state and only paired with a word or sign: red for loss, shortfall, error and danger; amber for warnings and action needed; green for a profit region on a chart. Never for "connected", "verified", "funded", "fully backed", "locked".
- No tinted panels or backgrounds behind status text. No gradients, glows, blurs or shadows except a flat shadow on dialogs.
- Puts and calls are told apart by the word in a `Kind` column, not by a colour system.

## 3. Layout and components

- Each page starts with an h1 and, at most, one row of actions or a filter row. No hero, no eyebrow, no lede, no stat cards, no illustration panel.
- Tables over cards. Rows 32 to 36px with a hairline divider. A card is used only for one discrete object: an offer detail, an order review, a form.
- Radius 4px everywhere. Borders are one hairline colour. No nested bordered boxes.
- No decorative SVG (Sediment is removed). The only illustration is the payoff chart.
- No status dots. No tags, pills or badges except the lifecycle state column, which uses the exact contract state names: `Offered`, `Active`, `Exercised`, `Expired`, `Cancelled`.
- No icons inside headings or buttons. Icons only where they replace a word in a tight row (copy, external link, close).
- No numbered step lists, no "How it works", no in-app FAQ, no "How to verify this yourself". Explanations live in the README.
- Filters are a `select` or a plain segmented control, not rows of chips.
- Proof is a truncated ID in mono with a copy button and a link to stellar.expert. No "Verified" marks.
- Mobile: same tables, horizontal scroll inside the table only, 16px side gutter, no page level horizontal scroll.

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
| Strata Pro is simulated | Pro pages, one banner at the top of the Pro shell | `Simulated on fixtures. No contract is called.` |

Nothing else repeats them. No disclaimer paragraphs in rails, cards or heroes.

## 6. Checklist for review

Before opening a PR, search the diff for:

- `Fraunces`, `Schibsted`, `font-display`, `ui-display`, `Sediment`, `PageHero`, `StatusDot`, `eyebrow`, `lede`
- `text-transform: uppercase`, `letter-spacing`
- `tone="ok"`, `--ok`, `Fully backed`, `Locked`, `Verified`, `Best price`
- `How settlement works`, `How to verify`, `Why Testnet`
- em dashes, `→`, `↗` in copy
- Any sentence that appears twice in `src/`

Each hit needs a reason or a fix.
