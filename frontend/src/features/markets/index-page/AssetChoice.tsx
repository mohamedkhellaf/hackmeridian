// The second step after an intent card: which asset. One row per asset on screen, each a link to that asset's
// page in guided mode with the intent in the URL. The row shows what the choice depends on: the reference price
// and, for a connected wallet, what it holds of the token the intent starts from.
import { Link as RouterLink } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import type { Intent } from '../../../app/search'
import { assetParam } from '../../../core/assets'
import { intentInfo } from '../../../core/payoff/strategies'
import type { TokenInfo } from '../../../core/options/types'
import type { TokenBalance } from '../../../core/stellar/tokens'
import type { MarketIndexRow } from '../../../data'
import { Glyph, IconChevronRight, Link, Skeleton } from '../../../ui'
import { CHOICE_CANCEL, CHOICE_GUEST_HINT, INTENT_COPY, NO_REFERENCE_VALUE, typeLine } from '../copy'
import { guidedSearch } from '../model'
import { assetGlyph, moneyText } from '../values'
import { ASSET_ROUTE, EXACT, MARKETS_ROUTE } from '../routing'
import styles from './AssetChoice.module.css'

export interface AssetChoiceProps {
  intent: Intent
  showAll: boolean
  rows: readonly MarketIndexRow[] | null
  quote: TokenInfo | null
  balances: Readonly<Record<string, TokenBalance>> | null
  connected: boolean
}

function holdingLine(balance: TokenBalance | undefined, token: TokenInfo): string | null {
  if (!balance || balance.balance === null) return null
  return balance.balance === 0n ? `You hold no ${token.code}` : `You hold ${moneyText(balance.balance, token)}`
}

export function AssetChoice({ intent, showAll, rows, quote, balances, connected }: AssetChoiceProps) {
  const copy = INTENT_COPY[intent]
  const info = intentInfo(intent)
  const heading = useRef<HTMLHeadingElement | null>(null)
  // A card was chosen on this page: move to the question it opened. Not on a fresh load or a history move,
  // where nothing on the page holds focus and the document should stay where it is.
  useEffect(() => {
    const active = document.activeElement
    if (active === null || active === document.body) return
    heading.current?.focus()
  }, [intent])

  // An intent that starts from cash is limited by the quote token, the same for every asset: say it once.
  const cashLine = info.starts === 'cash' && quote ? holdingLine(balances?.[quote.contractId], quote) : null

  return (
    <section className={styles.root} aria-labelledby="asset-choice-title">
      <header className={styles.head}>
        <div className={styles.headMain}>
          <h3 id="asset-choice-title" className={styles.title} ref={heading} tabIndex={-1}>
            {copy.question}
          </h3>
          {connected ? cashLine ? <p className={styles.sub}>{cashLine}</p> : null : <p className={styles.sub}>{CHOICE_GUEST_HINT}</p>}
        </div>
        <Link tone="quiet" render={<RouterLink to={MARKETS_ROUTE} search={showAll ? { all: '1' } : {}} activeOptions={EXACT} resetScroll={false} />}>
          {CHOICE_CANCEL}
        </Link>
      </header>
      {rows === null ? (
        <Skeleton variant="rows" lines={3} />
      ) : (
        <ul className={styles.list} role="list">
          {rows.map((row) => {
            const glyph = assetGlyph(row.asset.contractId)
            const held = info.starts === 'asset' ? holdingLine(balances?.[row.asset.contractId], row.asset) : null
            const price = row.reference.perUnit !== null && quote ? moneyText(row.reference.perUnit, quote) : NO_REFERENCE_VALUE
            return (
              <li key={row.asset.contractId}>
                <RouterLink className={styles.row} to={ASSET_ROUTE} params={{ asset: assetParam(row.asset) }} search={guidedSearch(intent)}>
                  <span className={styles.identity}>
                    {glyph ? <Glyph name={glyph} size={20} className={styles.glyph} /> : null}
                    <span className={styles.idText}>
                      <span className={styles.code}>{row.asset.code}</span>
                      <span className={styles.type}>{typeLine(row.typeLabel)}</span>
                    </span>
                  </span>
                  <span className={styles.fact}>
                    <span className={styles.factLabel}>{row.reference.label}</span>
                    <span className={styles.factValue}>{price}</span>
                  </span>
                  {held ? <span className={styles.held}>{held}</span> : <span className={styles.held} />}
                  <span className={styles.go}>
                    <span className="ui-vh">{copy.choose(row.asset.code)}</span>
                    <IconChevronRight size={16} />
                  </span>
                </RouterLink>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
