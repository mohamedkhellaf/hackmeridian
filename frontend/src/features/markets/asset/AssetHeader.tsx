// The head of an asset page: what the asset is, who issues it, where its reference price comes from and what
// the connected wallet holds. Facts are columns of a ruled strip, never a dotted meta line.
import { findReferenceAsset, similarCodeFlag, tierOf } from '../../../core/assets'
import { formatCountdown, formatUtcTime } from '../../../core/format'
import type { TokenInfo } from '../../../core/options/types'
import type { TokenBalance } from '../../../core/stellar/tokens'
import { referenceMode, useBalancesById, useMe, useNowSec, useReference } from '../../../data'
import { Glyph, IconWarning, Skeleton } from '../../../ui'
import { BALANCES_GUEST, BALANCE_WORD, FACT, NO_REFERENCE_VALUE, similarCodeNote, typeLine } from '../copy'
import { BackToMarkets, ChainId, Money } from '../parts'
import { assetGlyph } from '../values'
import styles from './AssetHeader.module.css'

export interface AssetHeaderProps {
  token: TokenInfo
  quote: TokenInfo
}

function Holding({ balance, token }: { balance: TokenBalance | undefined; token: TokenInfo }) {
  if (!balance) return <Skeleton width="6rem" />
  if (balance.balance !== null) return <Money units={balance.balance} token={token} figure="serif" />
  const word = balance.status === 'ok' || balance.status === 'mock' ? BALANCE_WORD.error : BALANCE_WORD[balance.status]
  return (
    <span className={styles.word}>
      {token.code}: {word}
    </span>
  )
}

export function AssetHeader({ token, quote }: AssetHeaderProps) {
  const me = useMe()
  const reference = useReference(token)
  const balances = useBalancesById(me)
  const nowSec = useNowSec(30)
  const listed = findReferenceAsset(token.contractId)
  const glyph = assetGlyph(token.contractId)
  const tier = tierOf(token)
  const similar = similarCodeFlag(token, referenceMode())

  return (
    <header className={styles.root}>
      <p className={styles.back}>
        <BackToMarkets />
      </p>
      <div className={styles.identity}>
        {glyph ? <Glyph name={glyph} size={32} className={styles.glyph} /> : null}
        <h1 className={styles.code} tabIndex={-1}>
          {token.code}
        </h1>
        <p className={styles.type}>{typeLine(listed?.typeLabel ?? null)}</p>
      </div>
      {similar ? (
        <p className={styles.similar}>
          <IconWarning size={16} />
          {similarCodeNote(similar.reference)}
        </p>
      ) : null}
      <dl className={styles.facts}>
        <div className={styles.fact} data-wide>
          <dt>{FACT.reference}</dt>
          <dd>
            <span className={styles.price}>
              {reference.perUnit !== null ? <Money units={reference.perUnit} token={quote} figure="serif" size="lg" /> : <span className={styles.noPrice}>{NO_REFERENCE_VALUE}</span>}
            </span>
            <span className={styles.source}>
              {reference.perUnit !== null ? `${reference.label}. ` : null}
              {reference.note}
              {reference.asOf !== null ? ` Observed ${formatCountdown(Math.max(1, nowSec - reference.asOf))} ago, at ${formatUtcTime(reference.asOf)}.` : null}
            </span>
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{FACT.issuer}</dt>
          <dd>{token.issuer ? <ChainId value={token.issuer} length="medium" copyLabel="Copy the issuer address" explorerLabel="View the issuer on the explorer" /> : <span className={styles.word}>{NO_REFERENCE_VALUE}</span>}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{FACT.tier}</dt>
          <dd>
            <span className={styles.word}>{tier}</span>
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{FACT.balances}</dt>
          <dd>
            {me ? (
              <span className={styles.holdings}>
                <Holding balance={balances.isError ? { contractId: token.contractId, status: 'error', balance: null } : balances.data?.[token.contractId]} token={token} />
                <Holding balance={balances.isError ? { contractId: quote.contractId, status: 'error', balance: null } : balances.data?.[quote.contractId]} token={quote} />
              </span>
            ) : (
              <span className={styles.guest}>{BALANCES_GUEST}</span>
            )}
          </dd>
        </div>
      </dl>
    </header>
  )
}
