// The public landing page at `/`. It has its own layout (status rule, navigation, footer) and does not use the
// app shell. First paint needs no chain client and no wallet code: the hero shows a recorded option, and the
// book is read by a lazy chunk once the browser is idle.
import { Link as RouterLink } from '@tanstack/react-router'
import { Suspense, lazy, useCallback, useState } from 'react'
import { IS_MOCK, config } from '../../core/config'
import { COPYRIGHT_NOTICE, LEGAL_NOTICE } from '../../core/disclosures'
import { explorerContract, explorerTx } from '../../core/explorer'
import { formatUnits, groupDigits } from '../../core/format'
import { Address, ButtonLink, Link, Logo, Marker, SkipLink, shortenAddress } from '../../ui'
import { CLOSING, DOC_LINKS, FOOTER, HERO, NAV, SECTION, STATUS } from './copy'
import { CurveFamily } from './figures/CurveFamily'
import { HeroWidget } from './hero/HeroWidget'
import { LiveBoundary } from './live/LiveBoundary'
import type { LivePick, LiveState } from './live/types'
import { useIdle } from './live/useIdle'
import { CONTRACT_TESTS, CONTRACT_TEST_TOTAL, COVERED_CONTRACT, RECORDED_PUT_TX } from './recorded'
import { Different } from './sections/Different'
import { Intents } from './sections/Intents'
import { Lifecycle } from './sections/Lifecycle'
import { Limits } from './sections/Limits'
import { MarginBlock } from './sections/MarginBlock'
import { Proof } from './sections/Proof'
import { Questions } from './sections/Questions'
import css from './LandingPage.module.css'

const LiveBook = lazy(() => import('./live/LiveBook'))

const MAIN_ID = 'landing-main'
const contractId = config.optionsContractId ?? COVERED_CONTRACT

/**
 * The thin line above the navigation. It names the network once, as a state (brief 0.1: no disclaimer taglines),
 * and on a build that reads the chain it shows the ledger last read and the contract: the cheapest proof that
 * the page reads something.
 */
function StatusLine({ ledger }: { ledger: number | null }) {
  return (
    <div className={css.status}>
      <div className={css.statusInner}>
        <p className={css.statusState} data-testid="status-network">
          <span className="ui-vh">{STATUS.label}: </span>
          {IS_MOCK ? STATUS.mock : STATUS.testnet}
        </p>
        {IS_MOCK ? null : (
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
        )}
      </div>
    </div>
  )
}

function TopNav() {
  return (
    <div className={css.top}>
      <div className={css.topInner}>
        <RouterLink to="/" className={css.brand} aria-label={NAV.home}>
          <Logo size={24} />
        </RouterLink>
        <nav className={css.nav} aria-label={NAV.label}>
          <Link tone="quiet" className={css.navLink} render={<RouterLink to="/markets" />}>
            {NAV.markets}
          </Link>
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
        <ButtonLink render={<RouterLink to="/markets" />}>
          {NAV.openApp}
        </ButtonLink>
      </div>
    </div>
  )
}

function Facts() {
  const fee = RECORDED_PUT_TX.exercise
  return (
    <dl className={css.facts} aria-label={HERO.factsLabel}>
      <div className={css.fact}>
        <dt>
          {HERO.factTests(CONTRACT_TESTS.unit, CONTRACT_TESTS.invariant, CONTRACT_TESTS.negative)}{' '}
          <Link tone="quiet" external href={DOC_LINKS.tests} className={css.factLink}>
            {HERO.factTestsLink}
          </Link>
        </dt>
        <dd>{CONTRACT_TEST_TOTAL}</dd>
      </div>
      <div className={css.fact}>
        <dt>
          {HERO.factAdmin}{' '}
          <Link tone="quiet" external href={DOC_LINKS.source} className={css.factLink}>
            {HERO.factAdminLink}
          </Link>
        </dt>
        <dd>0</dd>
      </div>
      <div className={css.fact}>
        <dt>
          {HERO.factFee}{' '}
          <Link tone="quiet" external href={explorerTx(fee.hash)} className={css.factLink}>
            {HERO.factFeeLink}
          </Link>
        </dt>
        <dd>
          {formatUnits(fee.feeStroops, 7, { dp: 7 })} <span className={css.factUnit}>XLM</span>
        </dd>
      </div>
    </dl>
  )
}

function Closing() {
  return (
    <section className={css.closing} aria-labelledby="closing-heading">
      <div className={css.closingInner}>
        <div className={css.closingText}>
          <h2 id="closing-heading" className={css.closingHeading}>
            {CLOSING.heading}
          </h2>
          <p className={css.closingBody}>{CLOSING.body}</p>
          <ButtonLink variant="primary" className={css.cta} render={<RouterLink to="/markets" />}>
            {CLOSING.primary}
          </ButtonLink>
        </div>
        <figure className={css.ornament}>
          <CurveFamily width={720} height={280} />
          <figcaption className={css.ornamentCaption}>{CLOSING.ornament}</figcaption>
        </figure>
      </div>
    </section>
  )
}

function Footer() {
  const anchor = (id: string, label: string) => (
    <li>
      <Link tone="quiet" href={`#${id}`}>
        {label}
      </Link>
    </li>
  )
  return (
    <footer className={css.footer} data-testid="landing-footer">
      <div className={css.footerInner}>
        <div className={css.footerBrand}>
          <Logo size={22} />
          <p className={css.footerContract}>
            <span className={css.footerLabel}>{FOOTER.contract}</span>
            <Address value={contractId} length="medium" explorerUrl={explorerContract(contractId)} explorerLabel={FOOTER.contractExplorer} copyLabel={FOOTER.contractCopy} />
          </p>
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
              <li>
                <Link tone="quiet" render={<RouterLink to="/design" />}>
                  {FOOTER.app.design}
                </Link>
              </li>
            </ul>
          </div>
          <div className={css.footerGroup}>
            <p className={css.footerLabel} id="footer-page">
              {FOOTER.groups.page}
            </p>
            <ul role="list" aria-labelledby="footer-page">
              {anchor(SECTION.intents, FOOTER.page.intents)}
              {anchor(SECTION.lifecycle, FOOTER.page.lifecycle)}
              {anchor(SECTION.proof, FOOTER.page.proof)}
              {anchor(SECTION.different, FOOTER.page.different)}
              {anchor(SECTION.limits, FOOTER.page.limits)}
              {anchor(SECTION.questions, FOOTER.page.questions)}
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
              <li>
                <Link tone="quiet" href={DOC_LINKS.llms}>
                  {FOOTER.read.llms}
                </Link>
              </li>
            </ul>
          </div>
        </nav>
        <div className={css.legal}>
          <p>{COPYRIGHT_NOTICE}</p>
          <p>{LEGAL_NOTICE}</p>
          <p>
            {FOOTER.trademark} {FOOTER.independent}
          </p>
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

  return (
    <div className={css.page}>
      <SkipLink href={`#${MAIN_ID}`} />
      <header>
        <StatusLine ledger={live?.ledger ?? null} />
        <TopNav />
      </header>
      <main id={MAIN_ID} tabIndex={-1} className={css.main}>
        <section className={css.hero} aria-labelledby="hero-heading">
          <div className={css.heroInner}>
            <div className={css.heroText}>
              <p className={css.heroLabel}>{HERO.label}</p>
              <h1 id="hero-heading" className={css.h1}>
                {HERO.h1Before}
                <Marker band className={css.marked}>
                  {HERO.h1Marked}
                </Marker>
                {HERO.h1After}
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
                <Link external href={DOC_LINKS.abi} className={css.secondary}>
                  {HERO.secondary}
                </Link>
              </div>
            </div>
            <div className={css.heroWidget}>
              <HeroWidget live={live} onPick={setPick} />
            </div>
            <Facts />
          </div>
        </section>
        <Intents />
        <Lifecycle />
        <Proof />
        <Different />
        <MarginBlock />
        <Limits />
        <Questions />
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
