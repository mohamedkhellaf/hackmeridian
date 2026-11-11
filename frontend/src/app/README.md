# `src/app`: the application spine

The entry, the providers and the route manifest. Features never edit this folder, and import nothing from it
except the types of `search.ts`.

| File | What it is |
|---|---|
| `main.tsx` | The entry of `index.html`: stylesheet, legacy hash redirect, providers, router. |
| `providers.tsx` | `AppProviders`: wallet, data (query cache, Covered client, settings), tooltips, the toast region and the two live regions. Mounted once, around every route. |
| `router.tsx` | **The only route manifest.** Code-based TanStack Router, path URLs, lazy pages. |
| `search.ts` | The search-param types (the contract with the features), their valibot schemas, and the plain `key=value` URL form. |
| `navigation.ts` | Document title, focus on the page heading, scroll keys. |
| `RootLayout.tsx` | `/` renders bare; every other route renders inside `AppShell`, which stays mounted between app routes. |
| `RouteError.tsx`, `routeErrors.ts`, `NotFoundPage.tsx`, `RoutePending.tsx`, `StatusPage.tsx` | The pages the router shows itself: a page that failed, an unknown address, slow code. |
| `MarginRoute.tsx` | The component of `/margin`: one `MarginPage` for the five screens. |
| `shellChunk.ts` | The one dynamic import of the app shell, and its warm-up. |
| `DesignPage.tsx` | `/design`: the ui gallery, then the chart kit. |
| `legacyHash.ts`, `legacyRedirect.ts` | Old `#/…` links to the new paths, before the router starts. |
| `CrashPage.tsx` | Test builds only: a page that throws, for the error-boundary test. |
| `boundaries.test.ts` | The layer rules of the brief, checked on the source text. |

## Routes

The router lazy-loads a **named export** of `src/features/<name>/index.tsx`. The route id is the path as written
here; that is the string to give `getRouteApi`.

| Path (route id) | Feature | Export | Title | Search type |
|---|---|---|---|---|
| `/` | `landing` | `LandingPage` | the site title | none |
| `/markets` | `markets` | `MarketsIndexPage` | Markets | `MarketsSearch` |
| `/markets/$asset` | `markets` | `AssetPage` | `BOND · Markets` | `AssetSearch` |
| `/portfolio` | `portfolio` | `PortfolioPage` | Portfolio | `PortfolioSearch` |
| `/portfolio/$id` | `portfolio` | `PositionPage` | `Position 12 · Portfolio` | `PositionSearch` |
| `/requests` | `requests` | `RequestsPage` | Requests | `RequestsSearch` |
| `/reserves` | `reserves` | `ReservesPage` | Reserves | none |
| `/activity` | `activity` | `ActivityPage` | Activity | none |
| `/issuer` | `issuer` | `IssuerPage` | Issuer | none |
| `/learn` | `learn` | `LearnPage` | How it works | none |
| `/design` | `gallery`, `viz` | (mounted by `DesignPage`) | Design system | none |
| `/margin`, `/margin/trade`, `/margin/positions`, `/margin/liquidations`, `/margin/vault` | `margin` | `MarginPage` with `screen` | `Trade · Margin` | none |

- `/` is the only route without the app shell. It brings its own layout, its own `main` landmark and skip link.
- Every other route is a child of the shell's `main`. A page renders its content only: one `h1` (the ui kit's
  `PageHeader`), no `main`, no skip link, no live region, no toast region, no `TooltipProvider`.
- `/margin/*` exists only in a build with `VITE_ENABLE_PRO=1`. One `MarginPage` stays mounted across the five
  screens (so the entry warning, the simulation and the acting account survive a change of screen); the route
  only changes its `screen` prop. Link to the screens with the router's `Link` (`to="/margin/trade"`).
- An address that matches no route shows "Page not found" inside the shell. A page that cannot find its own
  object (an unknown asset, a position id that does not exist) renders its own fixed "no such" state and never
  echoes the segment; `throw notFound()` from `@tanstack/react-router` shows the router's page instead.

## Reading the URL in a feature

```tsx
import { getRouteApi, Link as RouterLink, useNavigate } from '@tanstack/react-router'
import { ButtonLink, Link } from '../../ui'

const route = getRouteApi('/markets/$asset')

export function AssetPage() {
  const { asset } = route.useParams()          // the slug, CODE-ISSUER or contract id: resolve with core/assets
  const search = route.useSearch()             // AssetSearch: every field optional, already validated
  const navigate = useNavigate({ from: '/markets/$asset' })

  const pickStrike = (strike: string) => navigate({ search: (prev) => ({ ...prev, strike }), replace: true })
  return <Link render={<RouterLink to="/markets/$asset" params={{ asset }} search={{ mode: 'chain' }} />}>Chain</Link>
}
```

- Internal links are the ui kit's `Link`, `ButtonLink`, `NavTab` or `MenuLinkItem` with the router's `Link` in the
  `render` prop. Hovering or focusing one preloads the page's code.
- `navigate({ search })` with `replace: true` for a value that changes while typing or dragging; a push (the
  default) for a step the back button should undo, such as opening the ticket.

## Search params

- **Strings only.** The URL is plain `key=value` (`?mode=chain&strike=10.00&offer=12`), never JSON, so a decimal
  keeps its trailing zeros and an id never passes through a float. Parse amounts with `core/units`, ids with
  `BigInt`.
- **Validated, never thrown.** A field that fails its check is dropped and the rest of the link still works. On
  the first load the address bar is rewritten to the valid part. Fields that are not in the route's type are
  dropped too, so add a field to `search.ts` (ask the owner of `src/app`) before using it.
- Decimals: digits, at most one point, at most 7 decimals. Ids: a u64 in decimal. `expiry`: a real UTC day,
  `YYYY-MM-DD`. Flags: `1` or absent.
- An empty string, `undefined` and `null` all remove the param.

## What the router does around a navigation

- **Title.** `document.title` is set from the manifest on every navigation (`Markets · StellSec`). A page does
  not set it.
- **Focus.** After a navigation that changes the path, focus moves to the page's first `h1` (inside `main`).
  Render the heading at once, also in the loading, empty and error states, so there is something to focus. A
  change of search params or of the hash does not move focus: the feature moves it where the change happened
  (the ticket, the receipt).
- **Scroll.** A new page starts at the top. Back and forward restore the position. A navigation that changes
  only the search params leaves the page where it is: no `resetScroll: false` needed. A link with a hash scrolls
  to that id.
- **Errors.** Each route has an error boundary. A page that throws while rendering is replaced by "This page
  could not be shown" with a retry; the shell, the wallet and the other pages keep working. A failed fetch of a
  page's code (a new version was published) offers a reload.
- **Slow code.** After 300 ms without the page's code, a skeleton is shown in its place. Before the shell's own
  code has arrived, the same skeleton is drawn in a frame with the shell's measures, so nothing moves when the
  chrome appears.

## Providers

`AppProviders` wraps every route, the landing included, with `WalletProvider`, `DataProvider`,
`TooltipProvider`, `ToastRegion` and `LiveRegions`. Any page may call a data hook, `toast()` or `announce()`.
The heavy parts are not in that path: the wallet kit, the chain clients, the mock market and the Stellar SDK are
dynamic imports inside `src/wallet` and `src/core` and load on first use. The app shell is a chunk of its own
and is not fetched on `/` until a link to an app route is hovered or followed.

Settings are applied twice: by an inline script in `index.html` before the first paint (no flash of the wrong
theme), then by `src/data/settings` when the app starts. The `theme-color` of the browser chrome follows a
forced theme.

## Build

`vite.config.ts` pins four variables so that branches written against `import.meta.env.<NAME>` are folded:
`VITE_ENABLE_PRO`, `VITE_OPTIONS_CONTRACT_ID`, `VITE_PRO_CONTRACT_ID`, `VITE_E2E`. A default build has no Margin
code, no Soroban client and no test wallet; a build with contract ids has no mock market and no fixture file.
`VITE_SITE_URL` (optional) is the public origin used for the social card address in `index.html`.

Two rules of the build that the rest of the code must respect:

- **No import for a side effect outside `src/app`.** Every module under `src/` except this folder is declared
  free of import-time side effects, so that a chunk gets only the bindings it uses from a barrel (`from '../ui'`,
  the ticket's index). `import './x'` with nothing imported is dropped there. Stylesheets are not affected.
- **Icons have two weights.** A build keeps the Regular and Light drawings of each Phosphor icon and drops the
  other four. `ICON_WEIGHTS` in `vite.config.ts` is the list.

What a cold load of `/` fetches before its `h1` is on screen (production build, measured 11 Nov 2026): 22 scripts,
626 kB minified, of which 516 kB (167 kB gzip) is the entry every route shares: React, the router and query
libraries, the icons and the providers. No shell, no chain client, no wallet kit, no Stellar SDK.

## Old links

`#/markets`, `#/portfolio`, `#/reserves`, `#/issuer` and `#/pro/<screen>` are rewritten to the new paths before
the router reads the location (`#/pro/…` goes to Markets in a build without Margin). A hash that does not start
with `#/` is an in-page anchor and is left alone.

## Tests

- `npx vitest run src/app` covers the search schemas, the URL form, the old-link map, titles, scroll keys, the
  files nothing compiles (`index.html`, `vercel.json`, `public/llms.txt`) and the layer rules.
- `e2e/shell-router.spec.ts` covers the spine in a browser: every route and title, search validation, old links,
  focus and scroll around a navigation, the error boundary, the not-found page, the pre-paint theme script, and
  the helpers themselves.
- `e2e/helpers.ts` is the base of the end-to-end suite: `openApp`, `connect`, `disconnect`, `switchAccount`,
  `goTo`, `setTheme`, `expectNoAxeViolations` (both themes), `expectNoHorizontalOverflow`, `expectToast`,
  `expectAnnounced`, `quietDevOverlay`. A test runs at 1440 x 900 unless its title carries `@phone` (390 x 844
  only) or `@both`. `PW_PORT=5199 npx playwright test e2e/<area>.spec.ts` runs against a server that is already up.
- A test build (`VITE_E2E=1`) puts `window.__stellsec = { router, setAccount(address) }` on the page and adds the
  route `/e2e/crash`. The test wallet's `?as=G...` param is validated by the root route and kept from page to
  page. None of this exists in any other build.
- TypeScript projects: `tsconfig.app.json` (browser code, no tests), `tsconfig.test.json` (unit tests, with the
  Node types), `tsconfig.node.json` (configs and `e2e/`). `npm run typecheck` runs all three.

## The E2E hook (test builds only)

`main.tsx` exposes `window.__stellsec` when `VITE_E2E=1`: `router`, `queryClient`, `activityStore`, `setAccount`,
`mock()` (the session's mock client), `failNext(kind)`, `failNextRead(method?, times)` and `clawBack(token, units)`.
`e2e/helpers.ts` wraps them (`routeTo`, `failNextTx`, `failNextRead`, `clawBack`); specs use the helpers.

