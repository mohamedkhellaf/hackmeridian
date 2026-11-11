# `src/ui`: the StellSec design system

Import everything from `src/ui` (the `index.ts` barrel). It loads the fonts, tokens and base styles first, so the
cascade layers (`tokens, base, ui, features`) are always declared before any component style. Never import
`@base-ui/react` or `@phosphor-icons/react` outside this folder. `ui/` takes plain props: no `core/`, `data/` or
feature imports. Rules and rationale: `frontend/DESIGN.md`. Live specimens: `/design`.

Feature CSS goes in `@layer features { … }` and uses the semantic variables of `tokens/tokens.css` only.

## Shell contract (the app shell mounts these once)

```tsx
<SkipLink href="#main" />            // first focusable element
<TooltipProvider> … </TooltipProvider> // around the app
<LiveRegions />                      // the two permanent live regions (polite, assertive)
<ToastRegion />                      // transient notices; text is announced through LiveRegions
```
`#root` gets `isolation: isolate` from `base.css` so portalled popups stack above the app.

```ts
applyTheme('system' | 'light' | 'dark')       // data-theme on <html>
applyDensity('comfortable' | 'compact')       // data-density on <html>
applyPnlScheme('default' | 'classic' | 'mono') // data-pnl on <html>
announce(message, 'polite' | 'assertive')     // screen-reader announcement
toast({ title, description?, tone?: 'neutral' | 'success' | 'warning' | 'danger', duration?, action? })
```
No storage in `ui/`: the data layer persists the choices and calls the three `apply*` functions.

## Components

| Component | Props that matter |
|---|---|
| `Button` | `variant: 'primary' \| 'secondary' \| 'quiet' \| 'danger'`, `size: 'md' \| 'sm'`, `loading`, `iconStart`, `iconEnd`, `fullWidth`, `disabledReason` (shown as a tooltip, button stays focusable). `type="submit"` must be said |
| `ButtonLink` | a link that looks like a button: same look props, `href` or `render` (for router links) |
| `IconButton` | `label` (required: accessible name and tooltip), `icon`, `size`, `variant` |
| `Link` | `href`, `external` (new tab, icon, announced), `tone: 'accent' \| 'ink' \| 'quiet'`, `standalone` (a link on its own line: 44 px hit area on touch), `render` |
| `Field` | `label`, `hint`, `error`, `aside`, `optional`, `hideLabel`; children is any Base UI control (the wiring is automatic) |
| `TextField` | `label`, `value`, `onValueChange`, `hint`, `error`, `aside`, `mono`, `prefix`, `suffix`, `hideLabel`, input props |
| `AmountField` | decimal **strings** only: `value`, `onValueChange`, `unit`, `decimals`, `error`, `validate(value)` (shown after the first blur), `onMax`, `maxLabel`, `aside` (the balance). Never `type=number`; typing is kept to digits and one point by `sanitizeDecimalInput` |
| `Select` | `label`, `hideLabel`, `value`, `onValueChange`, `options: { value, label, detail?, disabled? }[]`, `placeholder`, `size`, `hint`, `error` |
| `Combobox` | `label`, `value`, `onValueChange`, `items: { value, label, detail? }[]`, `placeholder`, `emptyText` |
| `Checkbox` | `checked`, `onCheckedChange`, children = label, `description` |
| `RadioGroup` | `label`, `value`, `onValueChange`, `options: { value, label, description? }[]`, `orientation` |
| `Segmented` | a real radio group: `label`, `value`, `onValueChange`, `options: { value, label, icon? }[]`, `size`, `fullWidth`, `showLabel` |
| `Switch` | `checked`, `onCheckedChange`, children = label |
| `Slider` | `label`, `value`, `onValueChange`, `min`, `max`, `step`, `largeStep`, `valueText(value)`, `marks` |
| `Tabs`, `TabList`, `Tab`, `TabPanel` | panels swap; `Tabs value onValueChange`, `TabList label`, `Tab value count?`, `TabPanel value` |
| `NavTabs`, `NavTab` | links; `current` sets `aria-current="page"`; `render` for router links; `count` |
| `Tooltip` | `content`, one focusable child. Never essential information. `stable` keeps the same element tree while the content comes and goes (Button uses it, so a focused button keeps focus when its disabled reason appears) |
| `Popover` | `trigger`, `title`, children, `side`, `align`, `open`, `onOpenChange`, `openOnHover` |
| `Coachmark` | a note beside a control it did not create (the welcome guide): `open`, `target` (gets the ruled mark and the note as its description), `anchor?` (where the note sits, default `target`), `title`, children, `counter?`, `foot?`, `actions`, `side`, `align`, `closeLabel`, `onClose('escape' \| 'close' \| 'outside')`, `initialFocus` (ref or `false`), `finalFocus`, `stepKey`. Not modal: no scrim, no scroll lock; a press outside closes it and still lands |
| `Menu`, `MenuItem`, `MenuLinkItem`, `MenuSeparator`, `MenuGroup`, `MenuRadioGroup`, `MenuRadioItem` | `trigger` on `Menu`; `onSelect`, `icon`, `detail`, `tone="danger"` on items; `MenuLinkItem href` or `render` |
| `Dialog` | `open`, `onOpenChange`, `title`, `description`, `footer`, `size: 'sm' \| 'md' \| 'lg'`, `role: 'dialog' \| 'alertdialog'`, `initialFocus: 'title' (default) \| 'first-control' \| ref`, `finalFocus`, `dismissible`; a bottom sheet under 768 px |
| `Drawer` | same as `Dialog`, slides from the right (420 px), swipe to dismiss |
| `Sheet` | same as `Dialog`, bottom sheet for phones, short confirmations only |
| `Callout` | `variant: 'info' \| 'warning' \| 'danger'`, `title`, `label` (shown as the heading only when there is no `title`; the variant word is read out, never shown), `alert` (true alerts only), `actions` |
| `Tag` | contract state names only: `<Tag state="Active" />`; one shape, two tones |
| `Badge` | `count`, `label` (accessible sentence, for example "2 actions waiting"), `tone: 'solid' \| 'quiet'` (a plain muted numeral after a tab label) |
| `TableWrap`, `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td`, `RowHeader` | native table; `TableWrap label maxHeight?` (the `.ui-table-wrap`; the header is sticky inside it); `Table density on caption fixed`; `Tr selected interactive`; cells take `numeric`, `align`, `pinned`, `strike`, `sunken`, `muted`; `Th sort onSort` |
| `FactTable` | a short table of facts with a one-word answer and a sentence each (the issuer powers on `/issuer` and the About tab): `caption`, `columns {label, state, effect}`, `rows {key, label, state, on?, effect}`; a plain table from 768 px, a ruled list under it |
| `KeyValue`, `KeyValueItem` | `dl > div > dt + dd`; `variant: 'ruled' \| 'plain'`, `figures: 'serif' \| 'sans'`, `layout: 'row' \| 'stacked'`; item `label`, `marked`, `hint` |
| `Stat` | `label`, `value`, `unit`, `hint`, `size: 'md' \| 'lg'` |
| `Card` | `title`, `headingLevel`, `actions`, `tone: 'surface' \| 'sunken' \| 'plain'`, `padding: 'none' \| 'sm' \| 'md'`, `as` |
| `ContractNote` | `serial`, `ledger`, `serialLabel`, `glyph`, `kind`, `terms: { label, value, marked?, hint? }[]`, `state`, `aside`, children, `footer`, `printing`, `plain` (a form or an example: no perforation, no serial line), `headingLevel` |
| `EmptyNote` | `title` (one serif sentence), `hint` (one short line), `action`; plain by default, `slip` for the blank contract note where the missing thing is itself a contract note |
| `Skeleton` | `variant: 'text' \| 'block' \| 'rows'`, `lines`, `width`, `height` |
| `Address` | `value`, `length: 'short' \| 'medium' \| 'full'`, `explorerUrl`, `copyLabel`, `you`, `name` |
| `TxLink` | `hash`, `explorerUrl`, `copy` |
| `Term` | `definition` (one glossary sentence), children (the word): the word is the button, a press opens the sentence |
| `ClockProvider` | `offsetMs` (ledger close time minus device clock): every `Countdown` without `now` follows the ledger |
| `TxStateWord` | `state` (a `TxState`), `word` (overrides the state's own word): glyph and word of a transaction state |
| `UnsettledNotice` | `children` (the sentence of `useUnsettledTx` in `src/data`), `onCheck`, `checkLabel`: the warning above a confirmation while an earlier transaction of the wallet has an unknown outcome; the action itself takes the same sentence as its `disabledReason` |
| `CopyButton` | `value`, `label` ("Copy address"), `copiedMessage` |
| `DateTime` | `value` (Date, ms or ISO), `local: 'below' \| 'inline' \| 'none'`, `format: 'full' \| 'table'` |
| `Countdown` | `to` (ms), `now` (ms, pass the ledger close time; without it the device clock ticks), `warnBelowMs`, `expiredLabel`, `label` |
| `Amount` | pre-formatted strings: `value` (the magnitude), `exact`, `unit`, `direction: 'gain' \| 'loss'` (adds the sign, the colour and the spoken word), `figure: 'sans' \| 'serif'`, `size`, `srLabel`. It owns the unit's style (sans 500, muted; UI size beside a serif figure, label size beside a sans one) and never breaks between figure and unit: features render figure and unit through it and keep no `.unit` rule of their own |
| `Glyph` | `name`: `long-call`, `long-put`, `short-call`, `short-put`, `quote`, `reserve`, `margin`, `issuer`, `expiry` |
| `Mark`, `Wordmark`, `Logo` | `Mark cut: 'two-ink' \| 'hollow' \| 'display'`, `size`, `label`; `Logo size` |
| `Marker` | highlighter, one figure per surface: a term the user set or the breakeven on their own term sheet; `flash` for a changed figure |
| `Stepper`, `TxStepper` | `TxStepper state: 'checking' \| 'signing' \| 'submitting' \| 'pending' \| 'confirmed' \| 'failed' \| 'unknown' \| 'expired' \| 'declined'`, `failedAt: 'check' \| 'submit' \| 'confirm'`, `hash` slot, `children` = what it means and what to do. `TX_STATES`, `TX_STATE_LABEL` |
| `Timeline` | `items: { title, time?, description?, status: 'done' \| 'current' \| 'upcoming', actor? }[]` |
| `PageHeader` | `title`, `description`, `actions`, `meta`, `back`, `headingRef` (focus target on route change) |
| `VisuallyHidden`, `SkipLink`, `Spinner` | |

Icons: `import { IconCopy, … } from 'src/ui'` (Phosphor behind domain names, Regular at 16, Light at 20 and up).

Global helper classes from `base.css`: `ui-display`, `ui-h1`, `ui-h2`, `ui-h3`, `ui-body`, `ui-text`, `ui-label`,
`ui-caption`, `ui-mono`, `ui-figure`, `ui-figure-lg`, `ui-muted`, `ui-secondary`, `ui-measure`, `ui-vh`,
`ui-table-wrap`.

Pure helpers exported for tests and features: `formatUtcDateTime`, `formatLocalTime`, `formatCountdown`,
`formatCountdownWords`, `shortenAddress`, `shortenHash`, `groupAddress`, `sanitizeDecimalInput`, `toIsoUtc`,
`contrastRatio`, `formatRatio`, `parseColor`.

Decisions worth knowing:

- **Toasts are our own, not Base UI's.** Base UI's toast viewport is itself a live region; the brief allows only
  the two permanent regions. `toast()` shows the notice and sends its text through `announce()`.
- **Links are never `Button`.** Base UI's Button enforces button semantics; `ButtonLink` and `Link` stay anchors.
- **A marked figure sets `--amount-unit`** so the unit of an `Amount` inside a `Marker` keeps its contrast.
- **`--toast-bottom`** on a parent lifts the toast region above the phone tab bar.
- **axe with a menu or a select open** reports `aria-hidden-focus` on Base UI's focus sentinels
  (`[data-base-ui-focus-guard]`). They are hidden on purpose and hand focus on at once. Exclude that selector in
  the scan (`new AxeBuilder({ page }).exclude('[data-base-ui-focus-guard]')`); everything else scans clean.
- **Tree-shaking.** Each Phosphor icon module carries six weights and only two are used. Icons are marked pure so
  unused ones drop out; if the size budget still bites, replace `icons.ts` with a two-weight sprite.

## Added during integration (11 Nov 2026)

| Piece | What it is |
|---|---|
| `ChoiceChips` | A wrapping radio group of chips with an optional second line. `appearance="control"` (forms) or `"note"` (serif figures on a contract note); in both the chosen chip takes the selection tint and an accent edge, and `marked` adds a tick (funded). `columns` is the most a row holds: fewer when the widest chip would not fit, balanced across rows; pass the chip count to fill one row edge to edge. `width` is ignored. `value: null` means none is chosen. Used by the ticket and by guided mode. |
| `useMediaQuery(query)`, `useIsPhone()`, `useIsWide()`, `PHONE_QUERY`, `WIDE_QUERY` | The two breakpoints as hooks, for the few places where the markup itself differs by width (a table that becomes a list, the ticket's container). Layout alone stays in CSS. |
| `Drawer presentation="page"` | On phones the drawer is a full page and its footer is the 64 px action bar, outside the scroller. |
| `Drawer holdDismissal` | While true, Escape, the system Back and a press outside leave the drawer open; its close button still closes it. The ticket sets it while a transaction is between signature and ledger. |
| `SwipeIgnore` | An area inside a `Drawer` or `Sheet` where a drag belongs to the content (a chart handle), not to the swipe that dismisses the panel. |
| `Dialog` / `Drawer` / `Sheet` `finalFocus={false}` | Leaves focus alone on close: the caller moves it (to a result region that holds a button). |
| `Select onOpenChange`, `onOpenChangeComplete`, `finalFocus` | For a select that sends focus elsewhere after a choice (a heading the choice scrolls to). Clear the target in `onOpenChange(true)`, so Escape still returns to the trigger. |
| `Menu size="tall"`, `popupClassName`, `MenuStatic` | A menu with many 44 px rows may use more of the viewport; `MenuStatic` holds plain rows (balances) that are not items and are hidden from assistive technology: repeat them in the group label. |
| `Segmented` | 44 px segments on touch screens at every size (the strip draws its line as an inset outline there). `SegmentedOption.count` / `countLabel` add a count after the label. |
| `Table prose` | Cells that hold sentences: wrapping, top-aligned, body size, a serif row header. `Table` and `Tr` take a `ref`. |
| `KeyValueItem size="lg"` | The closing figure of a term sheet ("You pay 1.80 USDx"). |
| `EmptyNote size="sm"` | A compact form for a desk screen that stacks several empty tables. (`children` is deprecated: no blank form lines.) |
| `Timeline` | `status` is optional (a walk-through that is nobody's history draws plain ink points); the actor sits beside the time, behind a short rule. |
| `PageHeader headingLevel` | 1 on a page; a specimen or an embedded header takes the level of its place. |
| `Button tone="danger"` on `variant="quiet"` | A destructive action in a dense row: danger ink, no border. |
| `TxStepper failedAt` | Now `'check' \| 'sign' \| 'submit' \| 'confirm'`; pass `stoppedStage(state)` from `core/tx/machine`. |
| `Countdown` | Reads the clock again when the page becomes visible or takes focus (a sleeping tab no longer shows a stale figure). |

Known limits: the copy button and the explorer link inside `Address` are 28 px wide (44 px high on touch screens).
A menu or a select list is portalled outside every landmark, so axe's best-practice rule `region` reports it while
it is open: `e2e/helpers.ts` switches that rule off for such a scan.

