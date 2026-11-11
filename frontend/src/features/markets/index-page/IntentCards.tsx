// "What do you want to do?": the three main intents as cards, and the fourth as a line under them.
// A card is a link: to the asset when one asset is the obvious choice, otherwise to the asset choice.
import { Link as RouterLink } from '@tanstack/react-router'
import { cloneElement } from 'react'
import type { ReactElement } from 'react'
import type { Intent } from '../../../app/search'
import { assetParam } from '../../../core/assets'
import { GUIDED_INTENTS } from '../../../core/payoff/strategies'
import type { TokenBalance } from '../../../core/stellar/tokens'
import type { MarketIndexRow } from '../../../data'
import { Glyph, Link } from '../../../ui'
import { INTENT_COPY, LOCK_BUY_LEAD, LOCK_BUY_REST } from '../copy'
import { choosingSearch, guidedSearch, obviousAsset } from '../model'
import { ASSET_ROUTE, EXACT, MARKETS_ROUTE } from '../routing'
import styles from './IntentCards.module.css'

export interface IntentCardsProps {
  /** The intent waiting for its asset, if any. */
  current: Intent | undefined
  showAll: boolean
  /** The assets on screen; null while they load (the cards then lead to the choice). */
  rows: readonly MarketIndexRow[] | null
  balances: Readonly<Record<string, TokenBalance>> | null
  quoteCode: string
}

/**
 * The router link of an intent: straight to the asset when there is one obvious asset, else to the choice.
 * The router marks the link whose address is the current one (`aria-current="page"`); matching is exact so only
 * the intent being chosen is marked.
 */
function intentLink(intent: Intent, target: MarketIndexRow | null, showAll: boolean, current: boolean): ReactElement<Record<string, unknown>> {
  if (target) return <RouterLink to={ASSET_ROUTE} params={{ asset: assetParam(target.asset) }} search={guidedSearch(intent)} />
  return <RouterLink to={MARKETS_ROUTE} search={choosingSearch(intent, showAll)} activeOptions={EXACT} data-current={current || undefined} resetScroll={false} />
}

export function IntentCards({ current, showAll, rows, balances, quoteCode }: IntentCardsProps) {
  const main = GUIDED_INTENTS.filter((i) => i.main)
  const secondary = GUIDED_INTENTS.filter((i) => !i.main)
  const targetOf = (intent: Intent) => (rows ? obviousAsset(intent, rows, balances) : null)
  return (
    <div className={styles.root}>
      <ul className={styles.cards} role="list">
        {main.map((info) => {
          const copy = INTENT_COPY[info.id]
          const link = intentLink(info.id, targetOf(info.id), showAll, current === info.id)
          return (
            <li key={info.id} className={styles.item}>
              {cloneElement(
                link,
                { className: styles.card },
                <Glyph name={copy.glyph} size={18} className={styles.glyph} />,
                <h3 className={styles.name}>{info.name}</h3>,
                <p className={styles.consequence}>{copy.consequence(quoteCode)}</p>,
                <p className={styles.premium}>
                  <span className={styles.premiumLabel}>{copy.premiumLabel}</span>
                  <span className={styles.premiumText}>{copy.premiumText}</span>
                </p>,
              )}
            </li>
          )
        })}
      </ul>
      {secondary.map((info) => {
        return (
          <p key={info.id} className={styles.secondary}>
            <Glyph name={INTENT_COPY[info.id].glyph} size={10} className={styles.secondaryGlyph} />
            <span>
              {LOCK_BUY_LEAD} <Link render={intentLink(info.id, targetOf(info.id), showAll, current === info.id)}>{info.name}</Link>
              {LOCK_BUY_REST}
            </span>
          </p>
        )
      })}
    </div>
  )
}
