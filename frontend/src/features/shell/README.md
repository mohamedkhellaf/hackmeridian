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
   - From 900 px: the logo (link to `/`), `nav[aria-label="Main"]` with Markets, Portfolio, Requests, Reserves,
     then `nav[aria-label="Secondary"]` with Learn and Margin (Margin only when `VITE_ENABLE_PRO` is `1`), the
     network indicator, the settings menu, the wallet button. Issuer is in the footer, Activity in the wallet menu.
   - The network indicator is plain text, no box and no dot: "Testnet, ledger 58,331,204" from 1200 px,
     "Testnet" below; "Mock data" in a build without a contract; "Testnet, reads are late" (or "Reads are late")
     in the warning ink while the ledger reads are late, "no connection" when none could be read.
   - From 768 to 899 px: Learn, Margin, Issuer and Activity fold into a "More" menu. The wordmark and the word
     "wallet" of "Connect wallet" are hidden from view (both stay in the accessible names).
   - Below 768 px: the logo (mark and wordmark; the mark alone below 360 px), the indicator, the wallet. The tab
     bar names the section, so the top bar does not.
   - On touch screens from 768 px the bar is 64 px tall, so its 44 px controls keep air above and below.
3. Phones only: `nav[aria-label="Main"]`, the tab bar, fixed to the bottom: Markets, Portfolio, Requests,
   Reserves, More. It comes right after the top bar in the DOM, so navigation is reached before the page.
4. The banners, only when there is one: the wrong network with the fix, and "Figures may be out of date" when the
   ledger reads stay late through one more poll (30 s) while the page is visible, or none could be read at all
   (`lateRead.ts`). A late read that the next poll answers changes the indicator's words in place and never moves
   the page.
5. `main#main`: the page. At most `--page-max` wide, with the gutter. The router moves focus to the page `h1`
   after a navigation; the shell has no `h1` of its own.
6. `footer.shell-footer`: `COPYRIGHT_NOTICE`, the legal notice (both from `core/disclosures`), the links (Learn,
   Reserves, Issuer, GitHub) and, in a build with a contract, each contract id with copy and a link to the explorer,
   in a two-column list so the ids share an edge. The component gallery keeps its route (/design) but no link.
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
| Settings | button "Settings" opening a menu whose `menuitemradio` items are grouped as "Theme" (System, Light, Dark) and "Gain and loss colours" (Teal and orange, Green and red, Ink only), then the group "Guide". On phones the same two are horizontal `radiogroup`s under "Settings" in the More sheet; their options wrap rather than scroll |
| Network indicator | a `p` in the header, plain text, not a control |
| Footer | `footer.shell-footer`, with `navigation` "Footer" |

## What the shell publishes for pages (CSS custom properties on `:root` while it is mounted)

| Property | Meaning |
|---|---|
| `--shell-topbar-h` | Height of the top bar, safe area included (56 px, 57 on phones with the hairline, 64 on touch screens from 768 px). The page area is at least the viewport minus both bars tall, so the footer never shows above the fold while a page loads |
| `--shell-tabbar-h` | Height the phone tab bar takes at the bottom of the viewport, safe area included; `0px` from 768 px. A page that pins something to the bottom on phones uses `bottom: var(--shell-tabbar-h, 0px)` |
| `--toast-bottom` | Lifts the ui kit's toast region above the tab bar on phones |

The root's `scroll-padding-bottom` clears the tab bar and a page's own sticky bar while it publishes
`--page-bar-h`, so keyboard focus never lands under either (WCAG 2.4.11). From 768 px the root also gets
`scrollbar-gutter: stable`, so the centred text block does not move between a
short page and a long one. The top bar is not sticky: it scrolls away with the page, so a page may stick its
own rail to the top of the viewport. On phones a tap on the tab of the open page goes back to its top and focuses
its heading.

## When something fails

Each piece of chrome (the bar, the tab bar, the banners, the footer, the More sheet, the connect dialog) sits in
its own `ChromeBoundary`: a piece that throws is left out and the page keeps working; the bar is replaced by the
logo and the four main sections as plain links (`TopBarFallback`). A failure of the frame itself reaches the root
route's own error page (`src/app/RootError.tsx`): its own `main`, the logo, "Reload the page". Test builds can
make either happen with `window.__stellsecCrashChrome = 'part' | 'shell'` (`E2eChromeCrash`).

## Files

| File | What |
|---|---|
| `AppShell.tsx` | The frame and the order above |
| `TopBar.tsx`, `TabBar.tsx`, `MoreSheet.tsx`, `Footer.tsx` | The bars, the phone sheet, the footer |
| `NetworkIndicator.tsx` | The network as plain text (`NetworkIndicatorView` takes plain props) |
| `Banners.tsx`, `lateRead.ts` | The wrong-network and late-read banners (`BannersView` takes plain props); when a late read deserves one |
| `ChromeBoundary.tsx` | The boundary around each piece of chrome, and the test-build crash switch |
| `Settings.tsx` | `SettingsMenu` (bar) and `SettingsControls` (More sheet), both on `useSettings()` |
| `GuideEntry.tsx` | "Show me around", the one way to start the welcome guide again: `GuideMenuGroup` (last group of the Settings menu) and `GuideSheetRow` (last row of the pages in the More sheet). They call `useGuide().start('tour', 'replay')`; the tour is `features/tour`, mounted by `src/app`. The bars and the wallet control carry its anchors: `guideAnchor('nav')` on the `nav` of `TopBar` and of `TabBar`, `guideAnchor('wallet')` on the button of `WalletButton` and the trigger of `WalletMenu` |
| `WalletButton.tsx`, `WalletMenu.tsx`, `ConnectDialog.tsx` | The wallet: button, menu, picker. On a touch screen the picker lists only the wallets that open there, with no store links; a list that failed to load offers "Try again" |
| `RouteLink.tsx` | The router's link for the shell's destinations; also what `Link`, `ButtonLink` and `MenuLinkItem` take in `render` |
| `nav.ts`, `wallet.ts`, `useTier.ts`, `copy.ts` | Pure model, helpers, the tier hook (768 and 900 px) and `useWide` (1200 px), the shell's words. Tested in `*.test.ts` |
| `specimens/` | Dev-only page with the states a mock build never reaches: `/src/features/shell/specimens/specimens.html` on the dev server. Not in the production build |

## Decisions

- **No disclaimer taglines** (brief 0.1): the footer is the copyright line and the legal notice; Margin carries no
  "experimental" tag; the network name appears once, as plain text in the top bar (ruling E23), and a mock build
  reads "Mock data" there, on phones too. The table density setting is gone from the menu and the sheet (E23).
- **The wallet menu and "More" are menus** (`role="menu"`, items are `menuitem`), on every width. Balances are
  plain rows inside the "Balances" group; the group's name carries the figures for screen readers.
- **Focus follows the wallet control.** Connecting from the top bar and disconnecting each replace one button
  with the other; focus is put on the replacement when it would otherwise be lost, and both are announced
  ("Wallet connected: GBE6…3ZEG.", "Wallet disconnected."). A connect started from a page keeps its own focus.
- **Three tiers** through `useTier()` (768 and 900 px: the bar holds every section in one line from 900 px), and
  `useWide()` (1200 px) for the ledger number, so each width renders one set of controls and nothing hidden stays
  in the accessibility tree.
- **Hairlines span the text block** from 768 px (as in the specimen), not the window: with the reserved
  scrollbar gutter a full-width rule would stop short of the edge on a page that does not scroll.
- **No chip, no dot** (DESIGN.md section 7 bans status dots; ruling E23): the words are the state.
