/**
 * The route manifest. This is the ONLY place where a URL is bound to a page: features never edit this file.
 *
 * Contract with the features (also in README.md):
 * - each page is a NAMED export of `src/features/<name>/index.tsx`, loaded lazily here (Markets is the one
 *   feature with two pages, so each is loaded from its own module and the index page never pulls the asset page);
 * - a page reads its params and search with `getRouteApi('<route id>')`, where the id is the path as written
 *   below (`/markets/$asset`, `/portfolio/$id`); the search types are the ones of `./search.ts`;
 * - every route except `/` renders inside the app shell; `/` brings its own layout.
 */
import { createRootRoute, createRoute, createRouter, lazyRouteComponent, retainSearchParams } from '@tanstack/react-router'
import { assetTitle, installNavigationEffects, positionTitle, scrollKeyOf } from './navigation'
import { NotFoundPage } from './NotFoundPage'
import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'
import { RootError } from './RootError'
import { DocumentPending, RoutePending } from './RoutePending'
import { warmShell } from './shellChunk'
import {
  parseSearch,
  stringifySearch,
  validateAssetSearch,
  validateIssuerSearch,
  validateMarketsSearch,
  validatePortfolioSearch,
  validatePositionSearch,
  validateRequestsSearch,
} from './search'

/** What a route says about itself, read by the root layout and by the title, focus and scroll effects. */
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** The page name in `document.title` ("Markets · StellSec"). A function receives the route params. */
    title?: string | ((params: Record<string, string>) => string)
    /** True for the one route that renders without the app shell. */
    bare?: boolean
    /** Which Margin screen a `/margin/*` route shows. */
    screen?: 'account' | 'trade' | 'positions' | 'liquidations' | 'vault'
  }
}

// The test wallet (builds with VITE_E2E=1 only) reads `?as=G...` when it connects. The root keeps that one
// param across navigation so a test stays the same account from page to page. No other build accepts it.
const E2E = import.meta.env.VITE_E2E === '1'
type RootSearch = { as?: string }
const validateRootSearch = (raw: Record<string, unknown>): RootSearch => (E2E && typeof raw.as === 'string' && /^G[A-Z2-7]{55}$/.test(raw.as) ? { as: raw.as } : {})

const rootRoute = createRootRoute({
  component: RootLayout,
  // The frame itself failed (the shell, or the layout around it): a page of its own, with no chrome to rely on.
  errorComponent: RootError,
  notFoundComponent: NotFoundPage,
  validateSearch: validateRootSearch,
  search: { middlewares: [retainSearchParams(['as'])] },
  // Starts fetching the shell with the page, also when a link to an app route is preloaded from the landing.
  beforeLoad: ({ location }) => {
    if (location.pathname !== '/') warmShell()
  },
})

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  staticData: { title: '', bare: true },
  component: lazyRouteComponent(() => import('../features/landing'), 'LandingPage'),
})

const marketsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'markets',
  staticData: { title: 'Markets' },
  validateSearch: validateMarketsSearch,
  // Each markets page is its own lazy module: the index never waits for the asset page, the ticket and the charts.
  component: lazyRouteComponent(() => import('../features/markets/index-page/MarketsIndexPage'), 'MarketsIndexPage'),
})

const assetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'markets/$asset',
  staticData: { title: assetTitle },
  validateSearch: validateAssetSearch,
  component: lazyRouteComponent(() => import('../features/markets/asset/AssetPage'), 'AssetPage'),
})

const portfolioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'portfolio',
  staticData: { title: 'Portfolio' },
  validateSearch: validatePortfolioSearch,
  component: lazyRouteComponent(() => import('../features/portfolio'), 'PortfolioPage'),
})

const positionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'portfolio/$id',
  staticData: { title: positionTitle },
  validateSearch: validatePositionSearch,
  component: lazyRouteComponent(() => import('../features/portfolio'), 'PositionPage'),
})

const requestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'requests',
  staticData: { title: 'Requests' },
  validateSearch: validateRequestsSearch,
  component: lazyRouteComponent(() => import('../features/requests'), 'RequestsPage'),
})

const reservesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'reserves',
  staticData: { title: 'Reserves' },
  component: lazyRouteComponent(() => import('../features/reserves'), 'ReservesPage'),
})

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'activity',
  staticData: { title: 'Activity' },
  component: lazyRouteComponent(() => import('../features/activity'), 'ActivityPage'),
})

const issuerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'issuer',
  staticData: { title: 'Issuer' },
  validateSearch: validateIssuerSearch,
  component: lazyRouteComponent(() => import('../features/issuer'), 'IssuerPage'),
})

const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'learn',
  staticData: { title: 'Learn' },
  pendingComponent: DocumentPending,
  component: lazyRouteComponent(() => import('../features/learn'), 'LearnPage'),
})

const designRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'design',
  staticData: { title: 'Design system' },
  component: lazyRouteComponent(() => import('./DesignPage'), 'DesignPage'),
})

// Margin exists only in a build with VITE_ENABLE_PRO=1. The test is written against `import.meta.env` so the
// bundler folds it (vite.config.ts pins the value) and a default build carries no Margin chunk at all.
//
// `MarginRoute` keeps one page mounted across the five screens; the child routes only say which one is shown.
function marginRoutes() {
  const margin = createRoute({ getParentRoute: () => rootRoute, path: 'margin', component: lazyRouteComponent(() => import('./MarginRoute'), 'MarginRoute') })
  return margin.addChildren([
    createRoute({ getParentRoute: () => margin, path: '/', staticData: { title: 'Account · Margin', screen: 'account' } }),
    createRoute({ getParentRoute: () => margin, path: 'trade', staticData: { title: 'Trade · Margin', screen: 'trade' } }),
    createRoute({ getParentRoute: () => margin, path: 'positions', staticData: { title: 'Positions · Margin', screen: 'positions' } }),
    createRoute({ getParentRoute: () => margin, path: 'liquidations', staticData: { title: 'Liquidations · Margin', screen: 'liquidations' } }),
    createRoute({ getParentRoute: () => margin, path: 'vault', staticData: { title: 'Vault · Margin', screen: 'vault' } }),
  ])
}

// Test builds only: a page that throws, to exercise the error boundary end to end. Loaded lazily, so no other
// build carries it.
const crashRoute = () =>
  createRoute({ getParentRoute: () => rootRoute, path: 'e2e/crash', staticData: { title: 'Crash test' }, component: lazyRouteComponent(() => import('./CrashPage'), 'CrashPage') })

const routeTree = rootRoute.addChildren([
  landingRoute,
  marketsRoute,
  assetRoute,
  portfolioRoute,
  positionRoute,
  requestsRoute,
  reservesRoute,
  activityRoute,
  issuerRoute,
  learnRoute,
  designRoute,
  ...(import.meta.env.VITE_ENABLE_PRO === '1' ? [marginRoutes()] : []),
  ...(E2E ? [crashRoute()] : []),
])

export const router = createRouter({
  routeTree,
  // Plain `key=value` search strings; see search.ts.
  parseSearch,
  stringifySearch,
  // Only validated fields survive into a link built from the current search.
  search: { strict: true },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: NotFoundPage,
  defaultPendingComponent: RoutePending,
  defaultPendingMs: 300,
  defaultPendingMinMs: 300,
  scrollRestoration: true,
  getScrollRestorationKey: scrollKeyOf,
  // A hash link inside a page scrolls its target to the top of the viewport (the top bar scrolls with the page).
  defaultHashScrollIntoView: { block: 'start', behavior: 'instant' },
})

installNavigationEffects(router)

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

