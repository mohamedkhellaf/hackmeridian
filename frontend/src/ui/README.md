# `src/ui`: the StellSec design system

Import everything from `src/ui` (the `index.ts` barrel). It loads the fonts, tokens and base styles first, so the
cascade layers (`tokens, base, ui, features`) are always declared before any component style. Never import
`@base-ui/react` or `@phosphor-icons/react` outside this folder. `ui/` takes plain props: no `core/`, `data/` or
feature imports. Rules and rationale: `frontend/DESIGN.md`. Live specimens: `/design` (or `/design.html` in dev).

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
| `Link` | `href`, `external` (new tab, icon, announced), `tone: 'accent' \| 'ink' \| 'quiet'`, `render` |
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
| `Tooltip` | `content`, one focusable child. Never essential information |
| `Popover` | `trigger`, `title`, children, `side`, `align`, `open`, `onOpenChange`, `openOnHover` |
| `Menu`, `MenuItem`, `MenuLinkItem`, `MenuSeparator`, `MenuGroup`, `MenuRadioGroup`, `MenuRadioItem` | `trigger` on `Menu`; `onSelect`, `icon`, `detail`, `tone="danger"` on items; `MenuLinkItem href` or `render` |
| `Dialog` | `open`, `onOpenChange`, `title`, `description`, `footer`, `size: 'sm' \| 'md' \| 'lg'`, `role: 'dialog' \| 'alertdialog'`, `initialFocus: 'title' (default) \| 'first-control' \| ref`, `finalFocus`, `dismissible` |
| `Drawer` | same as `Dialog`, slides from the right (420 px), swipe to dismiss |
| `Sheet` | same as `Dialog`, bottom sheet for phones, short confirmations only |
| `Callout` | `variant: 'info' \| 'warning' \| 'danger'`, `title`, `label` (the word next to the icon), `alert` (true alerts only), `actions` |
| `Tag` | contract state names only: `<Tag state="Active" />` |
| `Badge` | `count`, `label` (accessible sentence, for example "2 actions waiting") |
| `TableWrap`, `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td`, `RowHeader` | native table; `TableWrap label maxHeight?` (the `.ui-table-wrap`; the header is sticky inside it); `Table density on caption fixed`; `Tr selected interactive`; cells take `numeric`, `align`, `pinned`, `strike`, `sunken`, `muted`; `Th sort onSort` |
| `KeyValue`, `KeyValueItem` | `dl > div > dt + dd`; `variant: 'ruled' \| 'plain'`, `figures: 'serif' \| 'sans'`, `layout: 'row' \| 'stacked'`; item `label`, `marked`, `hint` |
| `Stat` | `label`, `value`, `unit`, `hint`, `size: 'md' \| 'lg'` |
| `Card` | `title`, `headingLevel`, `actions`, `tone: 'surface' \| 'sunken' \| 'plain'`, `padding: 'none' \| 'sm' \| 'md'`, `as` |
| `ContractNote` | `serial`, `ledger`, `serialLabel`, `glyph`, `kind`, `terms: { label, value, marked?, hint? }[]`, `state`, `aside`, children, `footer`, `printing`, `headingLevel` |
| `EmptyNote` | `title` (one serif sentence), `hint`, `action` |
| `Skeleton` | `variant: 'text' \| 'block' \| 'rows'`, `lines`, `width`, `height` |
| `Address` | `value`, `length: 'short' \| 'medium' \| 'full'`, `explorerUrl`, `copyLabel`, `you`, `name` |
| `TxLink` | `hash`, `explorerUrl`, `copy` |
| `CopyButton` | `value`, `label` ("Copy address"), `copiedMessage` |
| `DateTime` | `value` (Date, ms or ISO), `local: 'below' \| 'inline' \| 'none'`, `format: 'full' \| 'table'` |
| `Countdown` | `to` (ms), `now` (ms, pass the ledger close time; without it the device clock ticks), `warnBelowMs`, `expiredLabel`, `label` |
| `Amount` | pre-formatted strings: `value` (the magnitude), `exact`, `unit`, `direction: 'gain' \| 'loss'` (adds sign, triangle and word), `figure: 'sans' \| 'serif'`, `size`, `srLabel` |
| `Glyph` | `name`: `long-call`, `long-put`, `short-call`, `short-put`, `fund`, `bond`, `equity`, `quote`, `reserve`, `margin`, `issuer`, `expiry` |
| `Mark`, `Wordmark`, `Logo` | `Mark cut: 'two-ink' \| 'hollow' \| 'display'`, `size`, `label`; `Logo size` |
| `Marker` | highlighter behind the user's own figures only; `band` at display sizes, `flash` for a changed figure |
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
