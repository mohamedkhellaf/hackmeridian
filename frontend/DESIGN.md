# StellSec design system

StellSec is a clearing desk that has nothing to hide. The interface reads like a broker's paperwork: term sheet,
contract note, reconciliation. Numbers come before adjectives; every sentence says who acts and by when. This file
replaces `STYLE.md`. Every change under `frontend/` is checked against it. The living specimens are at `/design`
(components, then charts); the API of each component is in `src/ui/README.md`.

## 1. Principles

1. **The contract is the visual unit.** An option is shown as a contract note with every term on it. Honesty is the look.
2. **Paper and ink.** Two themes of equal rank: Paper (light) and Carbon (dark). Separation in the page is a tone
   step plus a hairline. Only what floats (popover, dialog) casts a shadow.
3. **Figures have rank.** Titles and key figures are serif; the interface is sans; addresses, hashes and the
   contract note's serial line are mono. Dense tables stay sans, except the strike column (`Td strike`, serif on
   every page).
4. **One loud thing.** The highlighter marks one figure per surface: a term the user set (their floor, their price)
   or, on the term sheet of their own order or position, the breakeven. Everything around it is quiet.
5. **Never colour alone.** Every colour-coded meaning also has a word, a sign or a glyph.
6. **Motion answers an action.** Ink settles; numbers never roll. Nothing moves by itself to get attention.

## 2. Tokens

Semantic CSS variables in `src/ui/tokens/tokens.css`, the only file where raw colours and theme selectors may appear.
Cascade layers: `tokens, base, ui, features`. Components are in `@layer ui`, feature CSS in `@layer features`. The
order is declared inline in `index.html` before any stylesheet (and again at the top of `src/ui/index.css`): the
build splits CSS into chunks, and whichever chunk loaded first would otherwise fix the order.

| Token | Paper | Carbon | Use |
|---|---|---|---|
| `--bg` / `--surface` / `--raised` / `--sunken` | `#f4f2ec` `#fbfaf6` `#ffffff` `#ece9e1` | `#121210` `#1a1a17` `#22221f` `#0c0c0b` | page; sheets and dialogs; popovers; wells and the strike column |
| `--hairline` / `--rule` / `--control` | `#e0dbd0` `#c8c1b3` `#8c8577` | `#2c2b27` `#3a3934` `#77736a` | row rules; header and section rules; control borders (3:1) |
| `--text` / `--text-2` / `--muted` | `#1a1915` `#46433c` `#68645b` | `#efece4` `#bdb8ac` `#948f84` | ink; secondary; labels and captions |
| `--accent` / `--accent-tint` | `#2442b8` `#e4e9fa` | `#93a6ff` `#1f2540` | links, focus, selection; selected row |
| `--primary` / `--primary-fg` | `#1a1915` `#fbfaf6` | `#efece4` `#121210` | the one primary button |
| `--marker` | `#ffe98a` | `#52471e` | highlighter: one stroke of wash in both themes (`--marker-rule` is transparent) |
| `--gain` / `--loss` | `#00707a` `#b5451b` | `#4cc3d0` `#f0884f` | always with a sign; a word where it sits in a sentence |
| `--cell-tone` | ink at 7 % | ink at 7 % | the strike column and in-the-money cells: moves away from the page in both themes |
| `--warn` / `--danger` (+ tints) | `#855600` `#a3341a` | `#e8b45a` `#ff8f70` | action needed; errors and destructive actions |

- **Contrast gate.** `src/ui/tokens/contrast.test.ts` parses tokens.css and requires text, text-2, muted, accent,
  gain, loss, warn and danger at 4.5:1 on `--bg`, `--surface` and `--sunken`; `--control` at 3:1; ink on the
  marker and the tints; in both themes and all three gain and loss schemes. Text, text-2, muted and accent also hold
  4.5:1 on `--cell-tone` over `--bg` and `--surface`; gain and loss do not (4.26:1 in Paper), so no signed figure
  sits in a toned cell. Muted text never sits on the marker.
- **Recorded adjustments.** The brief's values all pass untouched. The "classic" scheme did not: green `#1a7f37`
  and red `#c0392b` fell under 4.5:1 on `--sunken` and had no Carbon pair. They are now `#177832` / `#bb3526`
  on Paper and `#4ac26b` / `#ff7b72` on Carbon. Phones and every touch screen keep 44 px rows, compact tables included.
- **Space** (px): 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 56, 72 as `--s-N`. Layout rhythm on 8.
- **Shape**: 0 tables, 2 px tags, 3 px controls, 4 px cards and dialogs. Nothing pill-shaped except the switch.
- **Motion**: hover 120 ms, changed figure 160 ms, popover 180 ms, dialog and drawer 240 ms, note prints 360 ms.
  Enter `cubic-bezier(0.2, 0, 0, 1)`, exit `cubic-bezier(0.3, 0, 1, 1)`. With reduced motion nothing travels.
- **Breakpoints**: 768 px and 1200 px. Container queries inside components.
- **Settings** are attributes on `<html>`: `data-theme` (absent means system) and `data-pnl="classic" | "mono"`.
  `applyTheme` and `applyPnlScheme` set them; the data layer stores them, and `index.html` applies them before the
  first paint. Density is not a setting: a dense table says so itself (`Table density="compact"`, the chain and
  Margin's desk tables); `/design` can preview the whole page compact.
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
| Mono | IBM Plex Mono, 12/16, slashed zero: addresses, hashes, the contract note's serial line only | `ui-mono` |

- Tabular lining figures everywhere (set on `body`). Right-align numeric columns; fixed decimals per asset.
- The unit appears once: in the column header or as a suffix, never both. The true minus sign `−`.
- A figure never breaks from its unit, and a short date, time or duration never breaks inside (`13 Nov`,
  `08:00 UTC`, `2 min`): core/format joins them with no-break spaces, and `Amount`, `DateTime` and `Countdown` do
  not wrap. `<Amount unit=…>` draws the unit (sans, muted, its own size); features keep no `.unit` rule and build no
  figure-and-unit template strings.
- Sentence case everywhere. No uppercase or tracked labels. Lines of prose stay under about 70 characters:
  `--measure` is 32rem (a `ch` is the wide tabular zero, so 68ch ran to about 100 characters).
- Fonts are self-hosted through Fontsource. No font link to a third party.

## 4. Components and when to use each

Import from `src/ui` only. `@base-ui/react` and `@phosphor-icons/react` are imported nowhere else.

| Need | Use | Not |
|---|---|---|
| The one main action of a view | `Button variant="primary"` (ink) | two primary buttons; a gradient |
| Other actions | `secondary` (outline), `quiet`, `danger` (destructive) | icon-only where a word fits |
| An action on a row (Portfolio, chain orders, Requests) | `secondary size="sm"`, right-aligned in the action column; one action looks the same on every row and page; Cancel is plain `secondary` | a quiet link on one page and a button on another |
| A disabled action | `disabled` + `disabledReason` (read out, still focusable; shown under the button on hover, focus and on a tap on touch screens). A disabled primary is transparent with a hairline border and disabled text | a dead button with no reason; the field fill (`--sunken`) on a button |
| Navigation that looks like a button | `ButtonLink`, `Link` (`external` says "opens in a new tab"; `standalone` for a link on its own line, 44 px on touch) | `Button` with `onClick` to navigate |
| An amount to type | `AmountField`: decimal strings, `inputmode=decimal`, unit suffix, Max, 16 px; a comma groups thousands ("1,000"), an exponent is refused. Its label names the quantity: "Quantity" ("Quantity to lock" on the two selling intents), "Asset" on the landing widget | `type="number"`, a float, a library number field; "I hold", "I want", "I would buy" |
| A short known list / a long list | `Select` / `Combobox` | rows of chips (one exception: strike and deadline in the guided note, `ChoiceChips`, where each choice shows whether it is funded) |
| A few options with a sentence each | `RadioGroup` | |
| Modes of one view (Guided or Chain, Put or Call, a deadline) | `Segmented`: a real radio group, one tab stop, arrow keys. A selected option of `Segmented` or `ChoiceChips` uses the selection tokens (`--accent-tint`, a 1 px border in text or accent colour, text colour); the weight does not change | tabs; the primary button's fill on a selected option |
| Panels inside a page | `Tabs` + `TabPanel` | links styled as tabs |
| Links between sub-pages | `NavTabs` + `NavTab` (`aria-current="page"`) | `Tabs` |
| An immediate setting | `Switch` | a checkbox |
| Consent where the product asks for it (the Margin entry warning; exercising an option out of the money) | `Checkbox` carrying the full sentence; it gates the action. An order review has none: the wallet signature is the consent | a pre-ticked box; a tick box on every order |
| An assumed price in a hypothetical figure | `Slider` with `valueText` | a slider bound to a signed amount |
| A label for an icon | `Tooltip` (never essential: touch has none) | `title` attributes, anywhere |
| An explanation or an exact value on request | `Popover` | a tooltip |
| A term of the trade where it is met (Premium, Collateral, Breakeven, Deadline) | `Term`: the word is the button, a press opens its one glossary sentence | a caption that defines its label |
| Saying what a control does, on request, at the control | `Coachmark` (through the welcome guide, `features/tour`) | a tooltip; a tour library; a dimmed page |
| The first-visit welcome | `GuideSlip`: one, on Markets, a plain ruled block in the page flow | a dialog, a banner, a toast, an illustration |
| Actions on one object, settings | `Menu` | a select |
| A decision that interrupts | `Dialog` (one per flow, never stacked; a bottom sheet on phones) | nested dialogs |
| The ticket from 768 to 1199 px | `Drawer` (right, 420 px) | |
| A short confirmation on phones | `Sheet` | a sheet for a flow with inputs: that is a page |
| A message set apart | `Callout` info, warning or danger: the icon, then the sentence; a heading only when it names the event ("Price changed"); the variant word is read out, not shown; `alert` only for a true alert | a category word as or beside a heading ("Blocked", "Warning", "Reserves", "Deadline", "Exercise", "Check terms"); tinted reassurance panels |
| A lifecycle state | `Tag`, with the contract's own state name: one shape, two tones (open and live in ink, done and ended muted) | any other tag, pill, "New", "Beta", "Verified"; fills, dashes |
| A count | `Badge`: solid for the one count that asks for action (Portfolio in the navigation); `quiet`, a plain muted numeral after a tab label (on phones the chain's deadline count leaves the tab for the caption under the bar: ", 12 orders") | a box around every count; a status dot |
| Rows of things | `TableWrap` + `Table`: native, ruled, a header that sticks to the page, pinned action column. One object, one table: an open request has the same columns on `/requests` and the asset Requests tab (Kind, Strike, Quantity, Deadline, Premium per unit with the total as hint, Buyer, action) and one card on phones; the issuer powers are one component, `FactTable`, on `/issuer` and the About tab (a list under 768 px) | grids of cards; div tables; two layouts of one object |
| Terms and summaries | `KeyValue` + `KeyValueItem` (`dl > div > dt + dd`). A `hint` holds only a required sentence, a second figure of the same quantity (per unit against total, local time, time left) or where the money sits; never a definition of its label or a description of the page | ad hoc two-column divs; a grey line under every value |
| A key figure | `Stat` (real, exact figures; four at most in a row) | vanity counters |
| One discrete object | `Card` (no shadow, never nested) | a card around a table |
| An option, an offer, a request, a receipt (a number in the contract) | `ContractNote`, one per screen | the slip on a form or an example |
| A form or an example on a card | `ContractNote plain`: no perforation, no serial line | |
| Any empty state | `EmptyNote`: one serif sentence, at most one short line and one action, no frame. `slip` only where the missing thing is itself a contract note (Portfolio with no positions or no wallet, an unknown position number) | an illustration, a blank screen, blank form lines |
| The user's own figure | `Marker`, one per surface | a headline word, a price somebody else set, an example, emphasis, promotion, state |
| An amount on screen | `Amount`: exact value in a popover on press; `unit` draws the unit; `direction` adds the sign, the colour and the spoken word | rounding up; `title`; triangles; a figure and its unit in one template string |
| An address / a transaction | `Address` (4+4 in tables, 6+6 on decisions, full where checked) / `TxLink` | "Verified" marks |
| A deadline | `DateTime` (UTC canonical in `<time>`, local time secondary) and `Countdown` (ledger time through `ClockProvider`; `2 d 4 h`, `3 h`, `12 min`, `<1 min`) | local time alone; relative time alone |
| Transaction progress | `TxStepper` with the nine states (the action button carries the only spinner) | a spinner with no words |
| An earlier transaction of the wallet whose outcome is unknown | `UnsettledNotice` above the review, with "Check again"; the action waits, with the sentence of `useUnsettledTx` as its reason. On the position it touched (its row, its To do card, its page) "Outcome unknown" and "Check again" stand in place of the action | letting the press meet the refusal |
| What happens and by when | `Timeline`: each title says who acts (`actor` is deprecated) | numbered marketing steps; an eyebrow split by a pipe |
| A transaction's state in a list | `TxStateWord`: glyph and word | a bare phase word |
| First load of a view | `Skeleton` (hidden from assistive technology; container `aria-busy`) | skeletons on refresh |
| Screen-reader announcements | `announce()` through `LiveRegions`; `toast()` only to repeat what is recorded elsewhere | `role="status"` or `role="alert"` in features |

**Signature pieces.** `ContractNote`: perforated left edge, mono serial line (`No. 184 · L 58,331,204`: the id,
unpadded, and the ledger), payoff glyph plus kind in serif, ruled terms with at most one term under the marker, the
state tag, a footer for proof and actions; it "prints" on a confirmed trade. The slip dress is for a contract
object with a number in the contract (an offer, a position, a request, a receipt), one per screen. `Glyph`: long
call, long put, short call, short put (a short is the long mirrored), always next to a kind or an intent name, never
before a sentence; plus quote, reserve, margin, issuer and the deadline (`expiry`). Assets carry no glyph: their
code and type are words. `Mark`: the Counterpart mark, a sheet cut in two along the payoff line, in two-ink, hollow
and display cuts. `Wordmark`: "StellSec" in Source Serif 4 at 620, −0.012 em, set as text.

**The chain and the guided page.** Each half of a two-sided chain cell is its own target: the offer figure opens Buy
on the best offer, the request figure opens Fill on the best request, each with its own accessible name and hover
tone; a request shows its size like an offer (`0.13 ×5.00`). An empty half shows no text at rest; on hover and
focus it shows "Post a request" (accent, underlined), the action a press performs, and its accessible name says so
("No offer at 102.00, call, 13 Nov. Post a request."). Under the chain, a deadline with no orders reads "No orders
on this deadline yet. Press a call or put cell to post a request, or write the first offer."; otherwise "Select a
premium to see its offers and requests." until a series is selected. Guided mode has one side switch, the intent picker: the
ticket opened from it shows no Buy, Write or Request tabs and is seeded from the terms the guided card resolved
(kind, strike, deadline, quantity), so the two halves of the asset page never describe different orders.

**Icons.** Phosphor through `src/ui` only, under domain names. Regular at 16 px, Light at 20 px. Icons sit in
navigation and where they replace a word in a tight row. Status icons always sit next to their word.

## 5. Copy

- Buttons name the contract action: `Buy`, `Write put`, `Exercise`, `Claim delivery`, `Reclaim`, `Cancel offer`,
  `Connect wallet`. An action keeps its name through the flow. Confirmations are two or three words.
- One word per thing, everywhere a user reads it, chain mode included. Code identifiers and contract function
  names are not renamed.
  - **request**, never "bid": the side of the book is "Requests", the buttons "Post a request" and "Fill
    request"; an empty half of a chain cell offers "Post a request" on hover and focus. The Learn entry for
    Request says once that the contract calls it a bid.
  - **deadline** for the instant, never "expiry" as a noun ("Nearest deadline", "Deadline (UTC)"); the state name
    "Expired" and the verb "expires" stay. The Learn entry may say once that it is also called the expiry.
  - **maker** for whoever wrote the option and for whoever fills a request; never "writer" or "counterparty" as
    a noun in Covered. Rows are labelled by role with the address alone as the value: Maker, Buyer, Seller.
    **seller** means only a holder reselling. The verbs write, wrote, written and the tab "Written" stay. Margin
    keeps "writer": it is its contract's own term (Learn has one Writer entry, as Margin's term).
  - the instrument's own terms: put, call, strike, premium, holder, collateral, reserves, exercise, claim
    delivery, reclaim, resale listing.
  - the issuer's powers, on About, Issuer and Reserves alike: "Approval required", "Can freeze", "Can claw
    back", "Can change these", answered Yes or No (`FLAG_LABELS` in `core/assetfacts`). Stellar's flag names
    appear only in the Reserves footnote that maps them.
  - the four intents: "Set a floor", "Get paid to sell higher", "Get paid to buy lower", "Lock a buy price". A
    selling intent's name states the obligation, not income, and its sentence says what is locked and that you
    sell or buy at your price if the holder asks before the deadline. Code ids (`earn-hold`, `earn-buy`) stay.
  - one asset, one code: the mock market uses the Testnet codes (RWA, BOND, EQTY), so no screen maps one code to
    another. The type label ("Fund share", "Bond", "Equity") goes beside the code.
  - **clawback shortfall** (not "collateral shortfall"); **Covered contract** (not "options contract");
    **declined** for a refusal in the wallet (not "rejected"). Page names keep their capital: "Go to Markets".
  "Covered" and "Margin" name the two regimes and stay visually and structurally separate.
- A reference price always carries its two-word source label ("Demo price 99.40"); the sentence that explains the
  label appears once, in the asset header ("Demo price. A fixed figure chosen by the team.").
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
- An offer, option or request number is the contract's own, never padded: `No. 0`, `Offer No. 26`, `Option No. 58`,
  in sentences, tables and the note's serial line alike (`serialOf` in core/format is the only formatter).
- Empty states are one sentence, at most one short line and one action. Proof is a shortened id with an explorer
  link; an id printed in full also has a copy button.
- A disclosure is stated once per page, at the step or decision it belongs to. A line that exists to sound careful,
  impressive or reassuring is deleted, not reworded. Prefer deletion to rewording.
- A shortfall is stated once in a review: at the balance row, with "How to get test funds" beside it or in the
  reason under the action.

### No disclaimer taglines

The interface does not carry tagline-style disclaimers: no "Testnet only", "Fictional assets", "No real funds" or
"Unaudited" as slogans, status rules, chips or banners (`BANNED_TAGLINES` in `src/core/disclosures.ts`). The footer
carries a conventional legal notice; the network name appears once, as a state indicator in the top bar; limits are
explained in sentences where they matter to a decision (the ticket review, the asset About tab, Learn).

### Required sentences (verbatim, one home each; the strings live in `src/core/disclosures.ts`)

| Sentence | Home |
|---|---|
| The legal notice of the build, `legalNotice(isMock)` (`LEGAL_NOTICE` on a contract build, `LEGAL_NOTICE_MOCK` on mock data), after `COPYRIGHT_NOTICE`; one paragraph | Footer of every route, the landing included |
| `The issuer controls this asset and can freeze or claw it back, which can block settlement. Collateral does not cover that.` | Ticket review of every mode except list (buy, write, request, fill, resale buy), as a plain paragraph; asset About tab |
| `Paid to the maker now. Not refundable.` (resale: `Set by the seller. Paid to the seller now.`) | Next to the premium in the buy review |
| `PAYOFF_CAPTION`: `Hypothetical payoff at the deadline. Not a quote.` | Caption of a payoff figure; a row of several figures carries it once, under the row |
| `Clawback shortfall on X: payouts are first come, first served until the balance runs out, with no refund, and new trades are refused.` | Reserves, and any ticket for that token |
| `bidEscrowDisclosure(X)` | Request ticket |
| `Set the wallet to Testnet. StellSec never asks for your secret key or recovery phrase.` | Connect dialog |
| The Margin sentences (`marginBanner`: partial margin and the publisher's prices; on a fixture build the simulation sentence) | One plain paragraph under the title of every Margin screen, loading and error states included |
| The Margin entry warning (`MARGIN_WARNING_*`) | A dialog before Margin opens on a contract build, once per tab |

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
- The exact value of a figure, and every explanation, is one press away (click, tap, Enter or Space); focus alone
  opens nothing, so Tab never stops inside a popup. Nothing lives in `title`.
- Reduced motion, forced colours and more-contrast preferences are honoured in `base.css` and `tokens.css`.
- Structural contracts kept for tests: `.ui-table-wrap`, `dl > div > dt + dd`, `footer.shell-footer`,
  `figure > figcaption` with `data-testid="payoff-chart"`.

## 7. Banned

Gradients, glows and blurs. Purple anywhere. Shadows in the page. Pills (except the switch). Status dots. A dashed
border on any box: a dashed line is a line in a drawing only (the "Without" line of a chart, the reference-price
rule of the chain). Triangles beside gain and loss figures. Category words ("Note", "Notice", "Warning", "Blocked")
as or beside a heading. The primary fill on a selected option or a disabled button. Uppercase tracked labels and
eyebrows. Hero panels inside the app. Stat cards for vanity numbers. Decorative illustration, 3D, photos, video.
Icons inside headings. Middle-dot meta strings where columns would do (the serial line of a contract note is the one
exception). Tags other than contract states. `title` attributes. `type="number"`. Optimistic confirmation of chain
state. Toasts as the only record of an outcome. Any claim not backed by a test or a Testnet transaction.

## 8. Review checklist

Search the diff for: `#` colours and `rgb(` outside `ui/tokens/`; `text-transform`; `letter-spacing` outside the
type tokens; `title=`; `type="number"`; `role="status"`, `role="alert"`; imports of `@base-ui/react` or
`@phosphor-icons/react` outside `src/ui`; em dashes and arrows in strings; `padStart` on an id; a `.unit` rule in
feature CSS; the banned words of section 5; any
required sentence that appears outside its home. Then look at the page at 1440 by 900 and 390 by 844, in Paper
and Carbon, and tab through it.
