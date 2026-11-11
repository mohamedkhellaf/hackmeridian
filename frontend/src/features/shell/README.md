# `src/features/shell`: the app shell

The chrome around every app route. `src/app/RootLayout.tsx` loads this chunk for every route except the landing
page and renders `<AppShell><Outlet /></AppShell>`. One export:

```tsx
export function AppShell(props: { children: ReactNode }): JSX.Element
```

It needs the providers of `src/app/providers.tsx` above it (wallet, data, tooltips; the toast region and the two
live regions are mounted there, once per document, not here) and the router (it reads the location and renders
router links).

## What it renders, in document order (this is the tab order)

1. `SkipLink` to `#main`, first in the DOM.
2. `header`: the top bar.
   - From 1200 px: the logo (link to `/`), `nav[aria-label="Main"]` with Markets, Portfolio, Requests, Reserves,
     then `nav[aria-label="Secondary"]` with Learn and Margin (Margin only when `VITE_ENABLE_PRO` is `1`), the
     network chip, the settings menu, the wallet button.
   - From 768 to 1199 px: Learn, Margin, Issuer and Activity fold into a "More" menu; the chip drops the ledger
     number (it is in its popover). Below 900 px the wordmark and the word "wallet" of "Connect wallet" are hidden
     from view (both stay in the accessible names).
   - Below 768 px: the mark, the name of the section (plain text, not a heading), the short chip, the wallet.
3. Phones only: `nav[aria-label="Main"]`, the tab bar, fixed to the bottom: Markets, Portfolio, Requests,
   Reserves, More. It comes right after the top bar in the DOM, so navigation is reached before the page.
4. The wallet banners (wrong network with the fix, wallet error), only when there is one.
5. `main#main`: the page. At most `--page-max` wide, with the gutter. The router moves focus to the page `h1`
   after a navigation; the shell has no `h1` of its own.
6. `footer.shell-footer`: `COPYRIGHT_NOTICE`, `LEGAL_NOTICE` (both from `core/disclosures`), the links (Learn,
   Reserves, Issuer, Design system, GitHub) and, in a build with a contract, the contract id with copy and a link
   to the explorer.
7. Portalled: the More sheet (phones), the connect dialog (rendered from `useWalletDialog()`).

The current section is marked with `aria-current="page"` on its link (set by the router's link; a section stays
current on its sub-pages). "More" carries `aria-current="true"` while a page it holds is open.

## Names that tests and the e2e helpers rely on

| What | Name |
|---|---|
| Guest wallet button | button "Connect wallet" (the visible text is "Connect" below 900 px) |
| Connected wallet button | button "Wallet menu, GBE6…3ZEG" (opens a menu) |
| Wallet menu items | menuitems "Copy address", "Refresh balances", "Activity", "View account on the explorer" (Testnet builds), "Disconnect" |
| Section links | links by their one-word label inside a `navigation` landmark; Portfolio reads "Portfolio 2 actions waiting" |
| More | button "More"; its pages are menuitems (a menu from 768 px, a menu inside the sheet "More" on phones) |
| Settings | button "Settings" opening a menu whose `menuitemradio` items are grouped as "Theme" (System, Light, Dark), "Table density" (Comfortable, Compact) and "Gain and loss colours" (Teal and orange, Green and red, Ink only). On phones the same three are `radiogroup`s under "Settings" in the More sheet |
| Network chip | button "Network: Testnet, ledger 58,331,204, RPC ok", or "Data source: Mock data" in a build without a contract |
| Footer | `footer.shell-footer`, with `navigation` "Footer" |

## What the shell publishes for pages (CSS custom properties on `:root` while it is mounted)

| Property | Meaning |
|---|---|
| `--shell-tabbar-h` | Height the phone tab bar takes at the bottom of the viewport, safe area included; `0px` from 768 px. A page that pins something to the bottom on phones uses `bottom: var(--shell-tabbar-h, 0px)` |
| `--toast-bottom` | Lifts the ui kit's toast region above the tab bar on phones |

From 768 px the root also gets `scrollbar-gutter: stable`, so the centred text block does not move between a
short page and a long one. The top bar is not sticky: it scrolls away with the page, so a page may stick its
own rail to the top of the viewport.

## Files

| File | What |
|---|---|
| `AppShell.tsx` | The frame and the order above |
| `TopBar.tsx`, `TabBar.tsx`, `MoreSheet.tsx`, `Footer.tsx` | The bars, the phone sheet, the footer |
| `NetworkChip.tsx` | The chip and the facts behind it (`NetworkChipView` and `NetworkSummary` take plain props) |
| `Settings.tsx` | `SettingsMenu` (bar) and `SettingsControls` (More sheet), both on `useSettings()` |
| `WalletButton.tsx`, `WalletMenu.tsx`, `ConnectDialog.tsx`, `WalletBanners.tsx` | The wallet: button, menu, picker, banners |
| `RouteLink.tsx` | The router's link for the shell's destinations; also what `Link`, `ButtonLink` and `MenuLinkItem` take in `render` |
| `nav.ts`, `wallet.ts`, `useTier.ts`, `copy.ts` | Pure model, helpers, the three-tier breakpoint hook, the shell's words. Tested in `*.test.ts` |
| `specimens/` | Dev-only page with the states a mock build never reaches: `/src/features/shell/specimens/specimens.html` on the dev server. Not in the production build |

## Decisions

- **No disclaimer taglines** (brief 0.1): the footer is the copyright line and the legal notice; Margin carries no
  "experimental" tag; the network name appears once, in the chip, and a mock build reads "Mock data" there.
  Because that chip is now the only place a mock build says what it is, phones show it in the top bar too.
- **The wallet menu and "More" are menus** (`role="menu"`, items are `menuitem`), on every width. Balances are
  plain rows inside the "Balances" group; the group's name carries the figures for screen readers.
- **Focus follows the wallet control.** Connecting from the top bar and disconnecting each replace one button
  with the other; focus is put on the replacement when it would otherwise be lost, and both are announced
  ("Wallet connected: GBE6…3ZEG.", "Wallet disconnected."). A connect started from a page keeps its own focus.
- **Three tiers, two breakpoints** (768 and 1200 px) through `useTier()`, so each width renders one set of
  controls and nothing hidden stays in the accessibility tree.
- **Hairlines span the text block** from 768 px (as in the specimen), not the window: with the reserved
  scrollbar gutter a full-width rule would stop short of the edge on a page that does not scroll.
- **The dot in the chip** is asked for by the brief. Its shape follows the state (filled when a ledger was read,
  hollow when there is none) and a word always sits beside it or in the chip's name.
