# Strata UI primitives

Rules: `frontend/STYLE.md`. Tokens: `src/index.css` (`--bg --surface --surface-hover --border --row-line --text --text-2 --muted --accent --accent-fg --danger --warn --profit --loss --font-sans --font-mono --r`). IBM Plex Sans everywhere, IBM Plex Mono only for ids and hashes. Import from `src/ui`.

| Export | Use |
|---|---|
| `Button` | `variant="primary\|secondary\|ghost\|danger"`, `size="sm\|md\|lg"`, `fullWidth`, `loading`. Label names the contract action. One primary per view. |
| `PageHeader` | `<PageHeader title="Markets" actions={...} />`. The page h1. No subtitle. |
| `Card` | `<Card title actions flush>`. One discrete object: a form, an order review. `flush` for a full-bleed table. |
| `Banner` | `<Banner tone="warn\|danger\|neutral">One line.</Banner>`. `danger` is `role="alert"`. |
| `Tag` | `<Tag tone="neutral\|warn\|danger">Active</Tag>`. Lifecycle state and `Check terms` only. |
| `Stat`, `StatGrid` | Label above value, one hairline under the row. `Stat` is a `role="group"` named by its label. Use sparingly. |
| `Segmented` | Put / Call style switch, radio-group semantics. |
| `Dialog` | `{open && <Dialog title onClose footer>}`. Bottom sheet at <= 640px. Focus trap; the body opens scrolled to the top. |
| `NoticeToast` | One-line tx result, mounted once in `App`. |
| `Mono`, `Amount`, `Icon`, `shortContractId` | Ids in mono; pre-formatted amounts with a muted unit; close/copy/external icons only. |

Classes: `.ui-table-wrap > .ui-table` (34px rows, `th.num`/`td.num` right aligned tabular), `.ui-kv` (`<dl class="ui-kv"><div><dt>Strike</dt><dd>50.00 USDx</dd></div></dl>`), `.ui-label` (12px muted), `.ui-sub` (muted second line in a cell), `.ui-mono`.

Shell (`src/layout`): `AppShell` renders the sidebar, the top bar with the wallet control, the content and the footer line (`DEMO_TEXT`, then the contract link or `MOCK_TEXT`), and the phone tab bar. `useHashRoute()` is the router.
