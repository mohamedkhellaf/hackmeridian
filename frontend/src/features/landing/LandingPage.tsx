// The public landing page at `/`. It has its own layout (navigation, footer) and does not use the app shell.
// First paint needs no chain client and no wallet code: the hero shows a recorded option, and the book is read by
// a lazy chunk once the browser is idle.
import { Link as RouterLink, useRouter } from '@tanstack/react-router'
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { IS_MOCK, config } from '../../core/config'
import { COPYRIGHT_NOTICE, TRADEMARK_NOTICE, legalNotice } from '../../core/disclosures'
import { explorerContract } from '../../core/explorer'
import { groupDigits } from '../../core/format'
import { Address, ButtonLink, Link, Logo, SkipLink, shortenAddress } from '../../ui'
import { CLOSING, DOC_LINKS, FOOTER, HERO, NAV, SECTION, STATUS } from './copy'
import { HeroWidget } from './hero/HeroWidget'
import { LiveBoundary } from './live/LiveBoundary'
import type { LivePick, LiveState } from './live/types'
import { useIdle } from './live/useIdle'
import { COVERED_CONTRACT } from './recorded'
import { Different } from './sections/Different'
import { Intents } from './sections/Intents'
import { Lifecycle } from './sections/Lifecycle'
import { Limits } from './sections/Limits'
import { MarginBlock } from './sections/MarginBlock'
import { Proof } from './sections/Proof'
import css from './LandingPage.module.css'

const LiveBook = lazy(() => import('./live/LiveBook'))

const MAIN_ID = 'landing-main'
const contractId = config.optionsContractId ?? COVERED_CONTRACT

/**
 * The thin line above the navigation, on a build that reads the chain: the network as a state, the ledger last
 * read and the contract. A mock build has none: its one "Mock data" label is on the example it describes.
 */
function StatusLine({ ledger }: { ledger: number | null }) {
  if (IS_MOCK) return null
  return (
    <section className={css.status} aria-label={STATUS.label}>
      <div className={css.statusInner}>
        <p className={css.statusState} data-testid="status-network">
          {STATUS.testnet}
        </p>
        <p className={css.statusRight}>
          {ledger === null ? null : (
            <span data-testid="status-ledger">
              {STATUS.ledger} {groupDigits(String(ledger))}
            </span>
          )}
          <a className={css.statusLink} href={explorerContract(contractId)} target="_blank" rel="noopener noreferrer">
            {STATUS.contract} {shortenAddress(contractId, 'short')}
            <span className="ui-vh"> ({STATUS.contractLink}, opens in a new tab)</span>
          </a>
        </p>
      </div>
    </section>
  )
}

/** The three anchors of the page, in page order. */
function SectionLinks({ className }: { className: string }) {
  return (
    <nav className={className} aria-label={NAV.label}>
      <Link tone="quiet" className={css.navLink} href={`#${SECTION.lifecycle}`}>
        {NAV.lifecycle}
      </Link>
      <Link tone="quiet" className={css.navLink} href={`#${SECTION.proof}`}>
        {NAV.proof}
      </Link>
      <Link tone="quiet" className={css.navLink} href={`#${SECTION.limits}`}>
        {NAV.limits}
      </Link>
    </nav>
  )
}

/**
 * The bar stays on the page ground while the page scrolls, so the way into the app and to the sections is never
 * more than a glance away. On a phone it holds the mark and "Open app" only; the section links sit in a row
 * under it and scroll away with the page.
 */
function TopNav() {
  return (
    <>
      <header className={css.top}>
        <div className={css.topInner}>
          <RouterLink to="/" className={css.brand} aria-label={NAV.home}>
            <Logo size={24} />
          </RouterLink>
          <SectionLinks className={css.nav} />
          <ButtonLink render={<RouterLink to="/markets" />}>{NAV.openApp}</ButtonLink>
        </div>
      </header>
      <SectionLinks className={css.phoneNav} />
    </>
  )
}

function Closing() {
  return (
    <section className={css.closing} aria-labelledby="closing-heading">
      <div className={css.closingInner}>
        <h2 id="closing-heading" className={css.closingHeading}>
          {CLOSING.heading}
        </h2>
        <p className={css.closingBody}>
          {CLOSING.bodyBefore}
          <Link render={<RouterLink to="/markets" search={{ funds: '1' }} />}>{CLOSING.bodyLink}</Link>
          {CLOSING.bodyAfter}
        </p>
        <ButtonLink variant="primary" className={css.cta} render={<RouterLink to="/markets" />}>
          {CLOSING.primary}
        </ButtonLink>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className={css.footer} data-testid="landing-footer">
      <div className={css.footerInner}>
        <div className={css.footerBrand}>
          <Logo size={22} />
          {/* As in the app's footer: a mock build reads no contract, so it names none. */}
          {config.optionsContractId ? (
            <p className={css.footerContract}>
              <span className={css.footerLabel}>{FOOTER.contract}</span>
              <Address value={contractId} length="medium" explorerUrl={explorerContract(contractId)} explorerLabel={FOOTER.contractExplorer} copyLabel={FOOTER.contractCopy} />
            </p>
          ) : null}
        </div>
        <nav className={css.footerNav} aria-label={FOOTER.navLabel}>
          <div className={css.footerGroup}>
            <p className={css.footerLabel} id="footer-app">
              {FOOTER.groups.app}
            </p>
            <ul role="list" aria-labelledby="footer-app">
              <li>
                <Link tone="quiet" render={<RouterLink to="/markets" />}>
                  {FOOTER.app.markets}
                </Link>
              </li>
              <li>
                <Link tone="quiet" render={<RouterLink to="/portfolio" />}>
                  {FOOTER.app.portfolio}
                </Link>
              </li>
              <li>
                <Link tone="quiet" render={<RouterLink to="/requests" />}>
                  {FOOTER.app.requests}
                </Link>
              </li>
              <li>
                <Link tone="quiet" render={<RouterLink to="/reserves" />}>
                  {FOOTER.app.reserves}
                </Link>
              </li>
              <li>
                <Link tone="quiet" render={<RouterLink to="/learn" />}>
                  {FOOTER.app.learn}
                </Link>
              </li>
              <li>
                <Link tone="quiet" render={<RouterLink to="/issuer" />}>
                  {FOOTER.app.issuer}
                </Link>
              </li>
            </ul>
          </div>
          <div className={css.footerGroup}>
            <p className={css.footerLabel} id="footer-read">
              {FOOTER.groups.read}
            </p>
            <ul role="list" aria-labelledby="footer-read">
              <li>
                <Link tone="quiet" external href={DOC_LINKS.spec}>
                  {FOOTER.read.spec}
                </Link>
              </li>
              <li>
                <Link tone="quiet" external href={DOC_LINKS.abi}>
                  {FOOTER.read.abi}
                </Link>
              </li>
              <li>
                <Link tone="quiet" external href={DOC_LINKS.evidence}>
                  {FOOTER.read.evidence}
                </Link>
              </li>
              <li>
                <Link tone="quiet" external href={DOC_LINKS.repo}>
                  {FOOTER.read.source}
                </Link>
              </li>
            </ul>
          </div>
        </nav>
        <div className={css.legal}>
          <p>{COPYRIGHT_NOTICE}</p>
          <p>{legalNotice(IS_MOCK)}</p>
          <p>{TRADEMARK_NOTICE}</p>
        </div>
      </div>
    </footer>
  )
}

export function LandingPage() {
  const idle = useIdle()
  const [live, setLive] = useState<LiveState | null>(null)
  const [pick, setPick] = useState<LivePick>({})

  // The lazy chunk did not load, or threw: keep the recorded example and offer to try again. A chunk that failed
  // to load stays failed for the life of the document, so trying again means loading the page again.
  const onLiveFailure = useCallback(() => {
    setLive({ status: 'error', mock: IS_MOCK, ledger: null, retry: () => window.location.reload() })
  }, [])

  const offer = live?.status === 'open' ? live.offer : null

  // Once the book has been read (or failed), the browser is idle: fetch the app shell and the Markets chunk then,
  // so the calls to action open the app without a blank frame. No data is read; only code is loaded.
  const router = useRouter()
  const warmed = useRef(false)
  const reported = live !== null
  useEffect(() => {
    if (!reported || warmed.current) return
    warmed.current = true
    router.preloadRoute({ to: '/markets' }).catch(() => {})
  }, [reported, router])

  return (
    <div className={css.page}>
      <SkipLink href={`#${MAIN_ID}`} />
      <StatusLine ledger={live?.ledger ?? null} />
      <TopNav />
      <main id={MAIN_ID} tabIndex={-1} className={css.main}>
        <section className={css.hero} aria-labelledby="hero-heading">
          <div className={css.heroInner}>
            <div className={css.heroText}>
              <p className={css.heroLabel}>{HERO.label}</p>
              <h1 id="hero-heading" className={css.h1}>
                {HERO.h1}
              </h1>
              <p className={css.lede}>{HERO.lede}</p>
              <div className={css.actions}>
                <ButtonLink
                  variant="primary"
                  className={css.cta}
                  render={
                    offer ? (
                      <RouterLink to="/markets/$asset" params={{ asset: offer.assetParam }} search={offer.guidedSearch} />
                    ) : (
                      <RouterLink to="/markets" search={{ intent: 'floor' }} />
                    )
                  }
                >
                  {HERO.primary}
                </ButtonLink>
                <Link external href={DOC_LINKS.source} className={css.secondary}>
                  {HERO.secondary}
                </Link>
              </div>
            </div>
            <div className={css.heroWidget}>
              <HeroWidget live={live} onPick={setPick} />
            </div>
          </div>
        </section>
        <Intents />
        <Different />
        <Lifecycle />
        <Proof />
        <MarginBlock />
        <Limits />
        <Closing />
      </main>
      <Footer />
      {idle ? (
        <LiveBoundary onError={onLiveFailure}>
          <Suspense fallback={null}>
            <LiveBook pick={pick} onChange={setLive} />
          </Suspense>
        </LiveBoundary>
      ) : null}
    </div>
  )
}
