// The first-run strip for a connected wallet that holds none of the tokens traded here. It explains the three
// real steps (README "Try it"): they happen in the wallet, so the strip reads how far the wallet is from its
// balances and never claims a step it did not see. The one-click version is later work.
import { QUOTE_ASSETS, referenceAssets } from '../../../core/assets'
import { explorerAsset } from '../../../core/explorer'
import { formatList } from '../../../core/format'
import { FAUCET_SOURCE } from '../../../core/reference'
import type { TokenBalance } from '../../../core/stellar/tokens'
import { Address, Card, IconCheck, Link } from '../../../ui'
import { FUNDS_LEAD, FUNDS_MOCK_NOTE, FUNDS_STEPS, FUNDS_TITLE, STEP_DONE, STEP_NEXT } from '../copy'
import { fundingProgress } from '../model'
import type { FundingStep, StepState } from '../model'
import type { ReactNode } from 'react'
import styles from './GetFunds.module.css'

export interface GetFundsProps {
  /** The connected wallet. */
  address: string
  balances: readonly TokenBalance[]
  /** The contract id of the quote token in this build. */
  quoteId: string
  /** The build runs on mock data: the steps are shown as the Testnet steps and cannot change what is on screen. */
  mock: boolean
}

const friendbotUrl = (address: string): string => `https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`

function Step({ state, title, children }: { state: StepState; title: string; children: ReactNode }) {
  return (
    <li className={styles.step} data-state={state} aria-current={state === 'next' ? 'step' : undefined}>
      <div className={styles.stepHead}>
        <h3 className={styles.stepTitle}>{title}</h3>
        {state === 'done' ? (
          <span className={styles.state}>
            <IconCheck size={14} />
            {STEP_DONE}
          </span>
        ) : state === 'next' ? (
          <span className={styles.state}>{STEP_NEXT}</span>
        ) : null}
      </div>
      <div className={styles.stepBody}>{children}</div>
    </li>
  )
}

export function GetFunds({ address, balances, quoteId, mock }: GetFundsProps) {
  const quote = QUOTE_ASSETS.testnet
  const assets = referenceAssets('testnet')
  // Mock balances cannot move with these steps, so no step is marked done or next there.
  const progress: Record<FundingStep, StepState> = mock ? { fund: 'later', trust: 'later', swap: 'later' } : fundingProgress(balances, quoteId)
  const codes = formatList(
    assets.map((a) => a.code),
    'disjunction',
  )
  return (
    <Card as="section" title={FUNDS_TITLE} headingLevel={2} aria-label={FUNDS_TITLE} className={styles.root}>
      <p className={styles.lead}>{FUNDS_LEAD}</p>
      {mock ? <p className={styles.lead}>{FUNDS_MOCK_NOTE}</p> : null}
      <ol className={styles.steps}>
        <Step state={progress.fund} title={FUNDS_STEPS.fund.title}>
          <p>{FUNDS_STEPS.fund.body}</p>
          {progress.fund === 'next' ? (
            <p>
              <Link external href={friendbotUrl(address)}>
                {FUNDS_STEPS.fund.link}
              </Link>
            </p>
          ) : null}
        </Step>
        <Step state={progress.trust} title={FUNDS_STEPS.trust.title}>
          <p>{FUNDS_STEPS.trust.body(quote.code)}</p>
          <dl className={styles.issuers}>
            <div>
              <dt>
                <Link external tone="ink" href={explorerAsset(quote.code, quote.issuer)}>
                  {quote.code}
                </Link>
              </dt>
              <dd>
                <Address value={quote.issuer} length="medium" copyLabel={`Copy the ${quote.code} issuer`} />
              </dd>
            </div>
            <div>
              <dt>{codes}</dt>
              <dd>
                <Address value={assets[0].issuer} length="medium" copyLabel="Copy the asset issuer" />
              </dd>
            </div>
          </dl>
        </Step>
        <Step state={progress.swap} title={FUNDS_STEPS.swap.title}>
          <p>{FUNDS_STEPS.swap.body}</p>
          <p className={styles.source}>{FAUCET_SOURCE}</p>
        </Step>
      </ol>
    </Card>
  )
}
