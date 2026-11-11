# StellSec design system

StellSec is a clearing desk that has nothing to hide. The interface reads like a broker's paperwork: term sheet,
contract note, reconciliation. Numbers come before adjectives; every sentence says who acts and by when. This file
replaces `STYLE.md`. Every change under `frontend/` is checked against it. The living specimens are at `/design`
(components, then charts); the API of each component is in `src/ui/README.md`.

## 1. Principles

1. **The contract is the visual unit.** An option is shown as a contract note with every term on it. Honesty is the look.
2. **Paper and ink.** Two themes of equal rank: Paper (light) and Carbon (dark). Separation in the page is a tone
   step plus a hairline. Only what floats (popover, dialog) casts a shadow.
3. **Figures have rank.** Titles and key figures are serif; the interface is sans; ids are mono. Dense tables stay
   sans, except the strike column.
4. **One loud thing.** The highlighter marks the user's own terms and nothing else. Everything around it is quiet.
5. **Never colour alone.** Every colour-coded meaning also has a word, a sign or a glyph.
6. **Motion answers an action.** Ink settles; numbers never roll. Nothing moves by itself to get attention.

## 2. Tokens

Semantic CSS variables in `src/ui/tokens/tokens.css`, the only file where raw colours and theme selectors may appear.
Cascade layers: `tokens, base, ui, features`. Components are in `@layer ui`, feature CSS in `@layer features`.

| Token | Paper | Carbon | Use |
|---|---|---|---|
| `--bg` / `--surface` / `--raised` / `--sunken` | `#f4f2ec` `#fbfaf6` `#ffffff` `#ece9e1` | `#121210` `#1a1a17` `#22221f` `#0c0c0b` | page; sheets and dialogs; popovers; wells and the strike column |
| `--hairline` / `--rule` / `--control` | `#e0dbd0` `#c8c1b3` `#8c8577` | `#2c2b27` `#3a3934` `#77736a` | row rules; header and section rules; control borders (3:1) |
| `--text` / `--text-2` / `--muted` | `#1a1915` `#46433c` `#68645b` | `#efece4` `#bdb8ac` `#948f84` | ink; secondary; labels and captions |
| `--accent` / `--accent-tint` | `#2442b8` `#e4e9fa` | `#93a6ff` `#1f2540` | links, focus, selection; selected row |
| `--primary` / `--primary-fg` | `#1a1915` `#fbfaf6` | `#efece4` `#121210` | the one primary button |
| `--marker` (+ `--marker-rule`) | `#ffe98a` | `#4a4121` + `#e8c547` underline | highlighter |
| `--gain` / `--loss` | `#00707a` `#b5451b` | `#4cc3d0` `#f0884f` | always with sign and triangle |
| `--warn` / `--danger` (+ tints) | `#855600` `#a3341a` | `#e8b45a` `#ff8f70` | action needed; errors and destructive actions |

- **Contrast gate.** `src/ui/tokens/contrast.test.ts` parses tokens.css and requires text, text-2, muted, accent,
  gain, loss, warn and danger at 4.5:1 on `--bg`, `--surface` and `--sunken`; `--control` at 3:1; ink on the
  marker and the tints; in both themes and all three gain and loss schemes. Muted text never sits on the marker.
- **Recorded adjustments.** The brief's values all pass untouched. The "classic" scheme did not: green `#1a7f37`
  and red `#c0392b` fell under 4.5:1 on `--sunken` and had no Carbon pair. They are now `#177832` / `#bb3526`
  on Paper and `#4ac26b` / `#ff7b72` on Carbon. Phones keep 44 px rows even in compact density.
- **Space** (px): 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 56, 72 as `--s-N`. Layout rhythm on 8.
- **Shape**: 0 tables, 2 px tags, 3 px controls, 4 px cards and dialogs. Nothing pill-shaped except the switch.
- **Motion**: hover 120 ms, changed figure 160 ms, popover 180 ms, dialog and drawer 240 ms, note prints 360 ms.
  Enter `cubic-bezier(0.2, 0, 0, 1)`, exit `cubic-bezier(0.3, 0, 1, 1)`. With reduced motion nothing travels.
- **Breakpoints**: 768 px and 1200 px. Container queries inside components.
- **Settings** are attributes on `<html>`: `data-theme` (absent means system), `data-density="compact"`,
  `data-pnl="classic" | "mono"`. `applyTheme`, `applyDensity`, `applyPnlScheme` set them; the data layer stores them.
- In component CSS: tokens only. No raw colour, no `light-dark()`, no `[data-theme]`, no px except 1 px and 2 px
  rules. State and variants are `data-*` attributes, not class names. The same test enforces this in `src/ui`.

## 3. Type

| Style | Spec | Helper class |
|---|---|---|
| Display | Source Serif 4, 44/48 (32/36 on phones), 560, −0.02 em | `ui-display` |
| H1 / H2 | Source Serif 4, 30/36 (24/30 on phones), 600 / 20/26, 600 | `ui-h1` `ui-h2` |
| Figure | Source Serif 4, 16/22 and 22/28, 500, tabular lining | `ui-figure` `ui-figure-lg` |
| Body | Instrument Sans, 15/23, 420 | `ui-body` |
| UI, table | Instrument Sans, 13.5/20, 500 (buttons 550, an optical correction on ink) | `ui-text` |
| Label, table header | Instrument Sans, 12/16, 500, width 87.5%, muted | `ui-label` |
| Caption | Instrument Sans, 12/16, muted | `ui-caption` |
| Mono | IBM Plex Mono, 12/16, slashed zero: ids, hashes, serial lines only | `ui-mono` |

- Tabular lining figures everywhere (set on `body`). Right-align numeric columns; fixed decimals per asset.
- The unit appears once: in the column header or as a suffix, never both. The true minus sign `−`.
- Sentence case everywhere. No uppercase or tracked labels. Lines of prose stay under about 68 characters.
- Fonts are self-hosted through Fontsource. No font link to a third party.

## 4. Components and when to use each

Import from `src/ui` only. `@base-ui/react` and `@phosphor-icons/react` are imported nowhere else.

| Need | Use | Not |
|---|---|---|
| The one main action of a view | `Button variant="primary"` (ink) | two primary buttons; a gradient |
| Other actions | `secondary` (outline), `quiet`, `danger` (destructive); `size="sm"` in rows | icon-only where a word fits |
| A disabled action | `disabled` + `disabledReason` (tooltip, read out, still focusable) | a dead button with no reason |
| Navigation that looks like a button | `ButtonLink`, `Link` (`external` says "opens in a new tab") | `Button` with `onClick` to navigate |
| An amount to type | `AmountField`: decimal strings, `inputmode=decimal`, unit suffix, Max, 16 px | `type="number"`, a float, a library number field |
| A short known list / a long list | `Select` / `Combobox` | rows of chips |
| A few options with a sentence each | `RadioGroup` | |
| Modes of one view (Guided or Chain, Put or Call, a deadline) | `Segmented`: a real radio group, one tab stop, arrow keys | tabs |
| Panels inside a page | `Tabs` + `TabPanel` | links styled as tabs |
| Links between sub-pages | `NavTabs` + `NavTab` (`aria-current="page"`) | `Tabs` |
| An immediate setting | `Switch` | a checkbox |
| Consent before signing | `Checkbox` carrying the full sentence; it gates the action | a pre-ticked box |
| An assumed price in a hypothetical figure | `Slider` with `valueText` | a slider bound to a signed amount |
| A label for an icon | `Tooltip` (never essential: touch has none) | `title` attributes, anywhere |
| An explanation or an exact value on request | `Popover` | a tooltip |
| Saying what a control does, on request, at the control | `Coachmark` (through the welcome guide, `features/tour`) | a tooltip; a tour library; a dimmed page |
| The first-visit welcome | `GuideSlip`: one, on Markets, a plain ruled block in the page flow | a dialog, a banner, a toast, an illustration |
| Actions on one object, settings | `Menu` | a select |
| A decision that interrupts | `Dialog` (one per flow, never stacked) | nested dialogs |
| The ticket from 768 to 1199 px | `Drawer` (right, 420 px) | |
| A short confirmation on phones | `Sheet` | a sheet for a flow with inputs: that is a page |
| A message set apart | `Callout` info, warning or danger: icon plus word; `alert` only for a true alert | tinted reassurance panels |
| A lifecycle state | `Tag`, with the contract's own state name | any other tag, pill, "New", "Beta", "Verified" |
| A count | `Badge` | a status dot |
| Rows of things | `TableWrap` + `Table`: native, ruled, sticky header, pinned action column | grids of cards; div tables |
| Terms and summaries | `KeyValue` + `KeyValueItem` (`dl > div > dt + dd`) | ad hoc two-column divs |
| A key figure | `Stat` (real, exact figures; four at most in a row) | vanity counters |
| One discrete object | `Card` (no shadow, never nested) | a card around a table |
| An option, an offer, a bid, a receipt | `ContractNote` | |
| Any empty state | `EmptyNote`: one serif sentence, at most one action | an illustration, a blank screen |
| The user's own figure | `Marker` (`band` at display sizes) | emphasis, promotion, state |
| An amount on screen | `Amount`: exact value in a popover on focus or press; `direction` adds sign, triangle, word | rounding up; `title` |
| An address / a transaction | `Address` (4+4 in tables, 6+6 on decisions, full where checked) / `TxLink` | "Verified" marks |
| A deadline | `DateTime` (UTC canonical in `<time>`, local time secondary) and `Countdown` (ledger time) | local time alone; relative time alone |
| Transaction progress | `TxStepper` with the nine states | a spinner with no words |
| Who acts and by when | `Timeline` | numbered marketing steps |
| First load of a view | `Skeleton` (hidden from assistive technology; container `aria-busy`) | skeletons on refresh |
| Screen-reader announcements | `announce()` through `LiveRegions`; `toast()` only to repeat what is recorded elsewhere | `role="status"` or `role="alert"` in features |

**Signature pieces.** `ContractNote`: perforated left edge, mono serial line (`No. 000184 · L 58,331,204`: the id
and the ledger it was read at), payoff glyph plus kind in serif, ruled terms with the key term under the marker,
the state tag, a footer for proof and actions; it "prints" on a confirmed trade. `Glyph`: long call, long put, short
call, short put (a short is the long mirrored), always next to the word; plus fund, bond, equity, quote, reserve,
margin, issuer, expiry. `Mark`: the Counterpart mark, a sheet cut in two along the payoff line, in two-ink, hollow
and display cuts. `Wordmark`: "StellSec" in Source Serif 4 at 620, −0.012 em, set as text.

**Icons.** Phosphor through `src/ui` only, under domain names. Regular at 16 px, Light at 20 px. Icons sit in
navigation and where they replace a word in a tight row. Status icons always sit next to their word.

## 5. Copy

- Buttons name the contract action: `Buy`, `Write put`, `Exercise`, `Claim delivery`, `Reclaim`, `Cancel offer`,
  `Connect wallet`. An action keeps its name through the flow. Confirmations are two or three words.
- One word per thing: offer, request (bid in the book), maker (writer in a position), holder, premium, strike,
  deadline (expiry in the chain), collateral, reserves, exercise, claim delivery, reclaim, resale listing.
  "Covered" and "Margin" name the two regimes and stay visually and structurally separate.
- Never: "guaranteed", "insured", "safe", "secure", "fully backed", "risk-free", "protected" as a promise;
  "insurance", "yield", "APY", "earn interest"; "Verified"; "seamless", "unlock", "empower", "trustless".
  Margin is never called fully collateralized. No reassurance copy: no sentence ends by comforting the reader.
- No fabricated depth, volume, user counts or countdown hype. A reference price always carries its source and is
  never called a market price, an oracle price or live.
- No em dashes, no arrows, no exclamation marks, no emoji. No sentence headlines over tables.
- Errors give cause, consequence and fix with exact figures: `You have 1.20 USDx; this needs 1.80 USDx. Get test
  funds or lower the quantity.` Three stages always read differently: nothing was sent, outcome unknown, fee
  charged. No contract enum names, except in Margin refusals where the code helps (`LiquidateFirst (224)`).
- Amounts are exact integers from chain to screen, truncated, grouped, with fixed decimals; `+` for gains and `−`
  for losses. Time is `13 Nov 2026, 08:00 UTC`, local time secondary, countdown `2 d 4 h`.
- Empty states are one line and at most one action. Proof is a truncated id with copy and an explorer link.

### No disclaimer taglines

The interface does not carry tagline-style disclaimers: no "Testnet only", "Fictional assets", "No real funds" or
"Unaudited" as slogans, status rules, chips or banners (`BANNED_TAGLINES` in `src/core/disclosures.ts`). The footer
carries a conventional legal notice; the network name appears once, as a state indicator in the top bar; limits are
explained in sentences where they matter to a decision (the ticket review, the asset About tab, Learn).

### Required sentences (verbatim, one home each; the strings live in `src/core/disclosures.ts`)

| Sentence | Home |
|---|---|
| The legal notice (`LEGAL_NOTICE`, after `COPYRIGHT_NOTICE`) | App footer, every route |
| `The issuer controls this asset and can freeze or claw it back, which can block settlement. Collateral does not cover that.` | Ticket review (buy, fill, resale buy); asset About tab |
| `Paid to the maker now. Not refundable.` (resale: `Set by the seller. Paid to the seller now.`) | Next to the premium in the buy review |
| `Hypothetical payoff at expiry. Not a quote.` | Caption of every payoff figure |
| `Clawback shortfall on X: payouts are first come, first served until the balance runs out, with no refund, and new trades are refused.` | Reserves, and any ticket for that token |
| `You escrow X now; refunded if you cancel or it expires.` | Bid ticket |
| `Set the wallet to Testnet. StellSec never asks for your secret key or recovery phrase.` | Connect dialog |
| Margin banner (`marginBanner`), warning bullets and collateral cards | Margin screens |

The landing "Limits" section and the asset "Risks" block may restate limits in their own words. The gallery does
not reuse these sentences as specimens.

## 6. Accessibility gate

- WCAG 2.2 AA. axe clean on every route in both themes. Every flow works with the keyboard alone.
- Focus is always visible: a 2 px accent ring with a 2 px gap (`--focus-ring`), drawn inside where it would be clipped.
- Dialog, drawer and sheet trap focus, close on Escape and return focus to the opener. `initialFocus` is a policy:
  `title` (default), `first-control` (forms), or a ref (Cancel in a destructive confirmation).
- Two permanent live regions, mounted once by the shell (`LiveRegions`). Nothing else uses `role="status"` or
  `role="alert"`, except a `Callout` with `alert`.
- Targets are 44 px on touch screens. Inputs are 16 px on phones. Horizontal scroll stays inside `.ui-table-wrap`.
- The exact value of a figure, and every explanation, is reachable by focus or press. Nothing lives in `title`.
- Reduced motion, forced colours and more-contrast preferences are honoured in `base.css` and `tokens.css`.
- Structural contracts kept for tests: `.ui-table-wrap`, `dl > div > dt + dd`, `footer.shell-footer`,
  `figure > figcaption` with `data-testid="payoff-chart"`.

## 7. Banned

Gradients, glows and blurs. Purple anywhere. Shadows in the page. Pills (except the switch). Status dots.
Uppercase tracked labels and eyebrows. Hero panels inside the app. Stat cards for vanity numbers. Decorative
illustration, 3D, photos, video. Icons inside headings. Middle-dot meta strings where columns would do (the
serial line of a contract note is the one exception). Tags other than contract states. `title` attributes.
`type="number"`. Optimistic confirmation of chain state. Toasts as the only record of an outcome. Any claim not
backed by a test or a Testnet transaction.

## 8. Review checklist

Search the diff for: `#` colours and `rgb(` outside `ui/tokens/`; `text-transform`; `letter-spacing` outside the
type tokens; `title=`; `type="number"`; `role="status"`, `role="alert"`; imports of `@base-ui/react` or
`@phosphor-icons/react` outside `src/ui`; em dashes and arrows in strings; the banned words of section 5; any
required sentence that appears outside its home. Then look at the page at 1440 by 900 and 390 by 844, in Paper
and Carbon, and tab through it.
