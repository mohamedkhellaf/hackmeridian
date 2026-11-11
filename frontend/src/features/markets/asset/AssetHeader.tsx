// The head of an asset page, set on the page's own two columns: what the asset is, its reference price with the
// one sentence that explains the label (its only home), the issuer, and in the rail column what the connected
// wallet holds. On a phone: code and price on one line, the sentence under them, the holdings on one line; the
// issuer is on the About tab there. A guest sees only what is known: no holdings slot.
import { Link as RouterLink } from '@tanstack/react-router'
import { similarCodeFlag, tierOf } from '../../../core/assets'
import { findReferenceAsset } from '../../../core/assets'
import { formatCountdown, formatUtcTime } from '../../../core/format'
import type { TokenInfo } from '../../../core/options/types'
import { intentInfo } from '../../../core/payoff/strategies'
import type { TokenBalance } from '../../../core/stellar/tokens'
import { referenceMode, useBalancesById, useMe, useNowSec, useReference } from '../../../data'
import { IconWarning, Link, Skeleton } from '../../../ui'
import { BALANCE_WORD, FACT, FUNDS_LINK, NO_REFERENCE_VALUE, similarCodeNote, typeLine } from '../copy'
import { BackToMarkets, ChainId, Money } from '../parts'
import { MARKETS_ROUTE, useAssetSearch } from '../routing'
import { AssetSwitch } from './AssetSwitch'
import styles from './AssetHeader.module.css'

export interface AssetHeaderProps {
  token: TokenInfo
  quote: TokenInfo
}

const ERROR_BALANCE = (contractId: string): TokenBalance => ({ contractId, status: 'error', balance: null })
const isEmpty = (b: TokenBalance | undefined): boolean => b !== undefined && b.status !== 'error' && (b.balance === null || b.balance === 0n)

/** One holding: the figure right-aligned in its column, the code beside it, so two figures align on the decimal. */
function Holding({ balance, token }: { balance: TokenBalance | undefined; token: TokenInfo }) {
  if (!balance)
    return (
      <span className={styles.holding}>
        <Skeleton width="6rem" />
      </span>
    )
  if (balance.balance !== null)
    return (
      <span className={styles.holding}>
        <Money units={balance.balance} token={token} figure="serif" bare />
        <span className={styles.unit}>{token.code}</span>
      </span>
    )
  const word = balance.status === 'ok' || balance.status === 'mock' ? BALANCE_WORD.error : BALANCE_WORD[balance.status]
  return (
    <span className={styles.word}>
      {token.code}: {word}
    </span>
  )
}

export function AssetHeader({ token, quote }: AssetHeaderProps) {
  const me = useMe()
  const search = useAssetSearch()
  const reference = useReference(token)
  const balances = useBalancesById(me)
  const nowSec = useNowSec(30)
  const listed = findReferenceAsset(token.contractId)
  const tier = tierOf(token)
  const similar = similarCodeFlag(token, referenceMode())

  const assetBalance = balances.isError ? ERROR_BALANCE(token.contractId) : balances.data?.[token.contractId]
  const quoteBalance = balances.isError ? ERROR_BALANCE(quote.contractId) : balances.data?.[quote.contractId]
  // The way to test tokens, when the wallet cannot pay: no quote token, or none of the asset an intent starts from.
  const startsFromAsset = search.intent !== undefined && intentInfo(search.intent).starts === 'asset'
  const cannotPay = isEmpty(quoteBalance) || (startsFromAsset && isEmpty(assetBalance))

  return (
    <header className={styles.root}>
      <p className={styles.back}>
        <BackToMarkets />
      </p>
      <div className={styles.main}>
        <div className={styles.title}>
          <h1 className={styles.code} data-unlisted={listed ? undefined : ''} tabIndex={-1}>
            {token.code}
          </h1>
          <p className={styles.type}>{typeLine(listed?.typeLabel ?? null)}</p>
          <AssetSwitch current={token.contractId} quote={quote} />
        </div>
        <p className={styles.figure}>
          {reference.perUnit !== null ? <Money units={reference.perUnit} token={quote} figure="serif" size="lg" /> : <span className={styles.noPrice}>{NO_REFERENCE_VALUE}</span>}
        </p>
        <p className={styles.source}>
          {reference.perUnit !== null ? `${reference.label}. ` : null}
          {reference.note}
          {reference.asOf !== null ? ` Observed ${formatCountdown(Math.max(1, nowSec - reference.asOf))} ago, at ${formatUtcTime(reference.asOf)}.` : null}
        </p>
        {token.issuer ? (
          <p className={styles.issuer}>
            <span className={styles.label}>{FACT.issuer}</span>
            <ChainId value={token.issuer} length="medium" copyLabel="Copy the issuer address" explorerLabel="View the issuer on the explorer" />
          </p>
        ) : null}
        {similar ? (
          <p className={styles.similar}>
            <IconWarning size={16} />
            {similarCodeNote(similar.reference)}
          </p>
        ) : null}
        {/* Every asset of the app's list is "Reference": the word is only worth showing when it is not that. */}
        {tier !== 'Reference' ? (
          <p className={styles.tier}>
            <span className={styles.label}>{FACT.tier}</span> {tier}
          </p>
        ) : null}
      </div>
      {me ? (
        <div className={styles.hold}>
          <p className={styles.label}>{FACT.balances}</p>
          <p className={styles.holdings}>
            <Holding balance={assetBalance} token={token} />
            <Holding balance={quoteBalance} token={quote} />
          </p>
          {cannotPay ? (
            <p className={styles.funds}>
              <Link render={<RouterLink to={MARKETS_ROUTE} search={{ funds: '1' }} />}>{FUNDS_LINK}</Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </header>
  )
}
