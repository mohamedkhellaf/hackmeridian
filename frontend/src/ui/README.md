# StellSec UI primitives

Rules: `frontend/STYLE.md`. Tokens: `src/index.css` (`--bg --surface --surface-hover --border --border-strong --row-line --text --text-2 --muted --accent --accent-fg --danger --warn --profit --loss --font-sans --font-mono --r --gutter --control-h`). Public Sans everywhere, IBM Plex Mono only for ids and hashes. Import from `src/ui`.

| Export | Use |
|---|---|
| `Button` | `variant="primary\|secondary\|ghost\|danger"`, `size="sm\|md\|lg"`, `fullWidth`, `loading`, `reason`. Label names the contract action. One primary per view. A disabled button keeps its shape; pass `reason` (shown as a tooltip) when the cause is not obvious, e.g. `Connect wallet to buy`. |
| `PageHeader` | `<PageHeader title="Markets" actions={...} />`. The page h1. No subtitle. |
| `Card` | `<Card title actions flush>`. One discrete object: a form, an order review. `flush` for a full-bleed table. |
| `Banner` | `<Banner tone="warn\|danger\|neutral">One line.</Banner>`. `danger` is `role="alert"`. |
| `Tag` | `<Tag tone="neutral\|warn\|danger">Active</Tag>`. Lifecycle state and `Check terms` only. |
| `Stat`, `StatGrid` | Label above value, one hairline under the row. `Stat` is a `role="group"` named by its label. Use sparingly. |
| `Segmented` | Put / Call style switch, radio-group semantics. |
| `Dialog` | `{open && <Dialog title onClose footer>}`. Bottom sheet at <= 768px. Focus trap; the body opens scrolled to the top. |
| `NoticeToast` | One-line tx result, mounted once in `App`. |
| `Mono`, `Amount`, `Icon`, `shortContractId` | Ids in mono; pre-formatted amounts with a muted unit; close/copy/external icons only. |

Classes: `.ui-table-wrap > .ui-table` (38px rows, `th.num`/`td.num` right aligned tabular), `.ui-kv` (`<dl class="ui-kv"><div><dt>Strike</dt><dd>50.00 USDx</dd></div></dl>`), `.ui-input` / `.ui-select` (36px, 6px radius; 44px and 16px type on phones), `.ui-label` (12.5px muted), `.ui-sub` (muted second line in a cell), `.ui-mono`.

Shell (`src/layout`): `AppShell` renders a 240px left sidebar (wordmark with gradient mark, icon + label nav rows, the active row tinted with a gradient edge, an action counter pill on Positions, wallet control at the bottom), the content (max 1280px, 24px gutters) and the footer line (`DEMO_TEXT`, then the contract link or `MOCK_TEXT`). At 769-1023px the sidebar is a 72px icon rail. At <= 768px it becomes a top bar and the nav becomes a floating bottom tab bar with four tabs and `More`, which opens a sheet with the remaining routes. `useHashRoute()` is the router.
