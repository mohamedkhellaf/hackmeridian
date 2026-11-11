// "What do you want to do?": the four intents as one ruled list of equal rows. A row is a link: to the asset when
// one asset is the obvious choice (the row then names it), otherwise to the Assets section below, which asks
// which asset. While the assets cannot be read, or none is listed, the rows are not links: there would be no
// asset to choose.
import { Link as RouterLink } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { Intent } from '../../../app/search'
import { assetParam } from '../../../core/assets'
import { GUIDED_INTENTS } from '../../../core/payoff/strategies'
import type { TokenBalance } from '../../../core/stellar/tokens'
import type { MarketIndexRow } from '../../../data'
import { Glyph, IconChevronRight } from '../../../ui'
import { INTENT_COPY, onAsset } from '../copy'
import { choosingSearch, guidedSearch, obviousAsset } from '../model'
import { ASSET_ROUTE, EXACT, MARKETS_ROUTE } from '../routing'
import styles from './IntentList.module.css'

export interface IntentListProps {
  /** The intent waiting for its asset, if any: its row keeps the sunken ground. */
  current: Intent | undefined
  showAll: boolean
  /** The assets on screen; null while they load (the rows then lead to the question). */
  rows: readonly MarketIndexRow[] | null
  /** False when the assets could not be read or none is listed: the rows are then plain text. */
  available: boolean
  balances: Readonly<Record<string, TokenBalance>> | null
  quoteCode: string
}

export function IntentList({ current, showAll, rows, available, balances, quoteCode }: IntentListProps) {
  return (
    <ul className={styles.list} role="list">
      {GUIDED_INTENTS.map((info) => {
        const copy = INTENT_COPY[info.id]
        const target = rows ? obviousAsset(info.id, rows, balances) : null
        const content: ReactNode = (
          <>
            <Glyph name={copy.glyph} size={18} className={styles.glyph} />
            <span className={styles.name}>
              <span className={styles.nameText}>{info.name}</span>
              {target ? <span className={styles.target}>{onAsset(target.asset.code)}</span> : null}
            </span>
            <span className={styles.consequence}>{copy.consequence(quoteCode)}</span>
            <span className={styles.payer}>{copy.payer}</span>
            {available ? <IconChevronRight size={16} className={styles.go} /> : null}
          </>
        )
        const isCurrent = current === info.id
        return (
          <li key={info.id} className={styles.item}>
            {!available ? (
              <div className={styles.row}>{content}</div>
            ) : target ? (
              <RouterLink className={styles.row} to={ASSET_ROUTE} params={{ asset: assetParam(target.asset) }} search={guidedSearch(info.id)}>
                {content}
              </RouterLink>
            ) : (
              // The router marks the link whose address is the current one (`aria-current="page"`); matching is
              // exact so only the intent being chosen is marked.
              <RouterLink className={styles.row} to={MARKETS_ROUTE} search={choosingSearch(info.id, showAll)} activeOptions={EXACT} data-current={isCurrent || undefined} resetScroll={false}>
                {content}
              </RouterLink>
            )}
          </li>
        )
      })}
    </ul>
  )
}
