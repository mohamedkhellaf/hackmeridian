import type { GuidedAlternative, GuidedMatch } from '../../../data'
import { explorerAccount, isMockId } from '../../../core/explorer'
import { formatExact, formatList, formatUnits, formatUtcDay } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import type { TokenInfo } from '../../../core/options/types'
import type { GuidedIntent } from '../../../core/payoff/strategies'
import { perUnit, premiumUnits } from '../../../core/units'
import { Address, Amount, AmountField, Button, KeyValue, KeyValueItem } from '../../../ui'
import {
  AVAILABLE_HEADING,
  FALLBACK,
  FIELD,
  FOUND,
  FOUND_RESALE,
  IN_CONTRACT_WORDS,
  LOCKED_IN_CONTRACT,
  LOCK_UNTIL,
  LOWEST_OFFER,
  NOTHING_HEADING,
  NO_QTY_HEADING,
  NOT_FOUND,
  NOT_FOUND_NO_QTY,
  PAID_AT_SIGN,
  PAID_ONCE,
  SUGGESTIONS_HEADING,
  USE_TERMS,
  perUnitHint,
  matchPrice,
} from './copy'
import type { Words } from './copy'
import { parsePositive, premiumAt } from './terms'
import styles from './Available.module.css'

export interface AvailableProps {
  intent: GuidedIntent
  match: GuidedMatch
  asset: TokenInfo
  quote: TokenInfo
  /** The chosen terms as text. `premium` is the matched order's premium, or the user's own, or null. */
  words: Words & { deadline: string }
  /** The chosen quantity in exact units, or null while the field does not hold a usable quantity. */
  qty: bigint | null
  /** The cheapest open offer of the chosen series, whoever posted it: the reference for a price of one's own. */
  lowestOffer: BookRow | null
  /** The premium field of the fallback. */
  premiumText: string
  onPremiumChange: (text: string) => void
  /** Adopts the terms of a suggestion. */
  onUse: (terms: { qty: bigint; strike: bigint; expiry: number }) => void
}

const serial = (id: bigint) => id.toString().padStart(6, '0')

/** What the writer of an order has locked in the contract: the strike in quote for a put, the asset for a call. */
function collateralOf(row: Pick<BookRow, 'kind' | 'underlyingQty' | 'totalStrike'>, asset: TokenInfo, quote: TokenInfo): string {
  return row.kind === 'put' ? `${formatUnits(row.totalStrike, quote.decimals)} ${quote.code}` : `${formatUnits(row.underlyingQty, asset.decimals)} ${asset.code}`
}

function Party({ value }: { value: string }) {
  return <Address value={value} length="medium" explorerUrl={isMockId(value) ? undefined : explorerAccount(value)} />
}

function Found({ intent, row, asset, quote, words }: { intent: GuidedIntent; row: BookRow; asset: TokenInfo; quote: TokenInfo; words: Words }) {
  const perUnit = premiumUnits(row)
  const collateral = collateralOf(row, asset, quote)
  const total = (
    <Amount value={formatUnits(row.totalPremium, quote.decimals)} exact={formatExact(row.totalPremium, quote.decimals)} unit={quote.code} figure="serif" />
  )
  const w = { ...words, premium: formatUnits(row.totalPremium, quote.decimals), collateral }
  const buying = row.source !== 'bid'
  return (
    <>
      <p className={styles.sentence} data-testid="guided-found">
        {row.source === 'resale' ? FOUND_RESALE(w) : FOUND[intent](w)}
      </p>
      <KeyValue className={styles.terms}>
        <KeyValueItem label={row.source === 'resale' ? FIELD.resalePerUnit : FIELD.perUnit}>{perUnit === null ? '–' : `${formatUnits(perUnit, quote.decimals)} ${quote.code}`}</KeyValueItem>
        <KeyValueItem label={buying ? FIELD.pay : FIELD.paid} marked hint={buying ? PAID_ONCE : PAID_AT_SIGN}>
          {total}
        </KeyValueItem>
        {buying ? (
          <KeyValueItem label={FIELD.collateral}>
            {collateral} {LOCKED_IN_CONTRACT}
          </KeyValueItem>
        ) : (
          <KeyValueItem label={FIELD.lock} hint={LOCK_UNTIL}>
            {collateral}
          </KeyValueItem>
        )}
        {row.source === 'resale' && row.offer ? (
          <KeyValueItem label={FIELD.maker}>
            <Party value={row.offer.writer} />
          </KeyValueItem>
        ) : null}
        <KeyValueItem label={row.source === 'bid' ? FIELD.buyer : row.source === 'resale' ? FIELD.seller : FIELD.maker}>
          <Party value={row.counterparty} />
        </KeyValueItem>
        <KeyValueItem label={row.source === 'bid' ? FIELD.request : row.source === 'resale' ? FIELD.listing : FIELD.offer}>
          <span className="ui-mono">No. {serial(row.bid?.id ?? row.offer?.id ?? 0n)}</span>
        </KeyValueItem>
      </KeyValue>
      <p className={styles.contractWords}>{IN_CONTRACT_WORDS[intent](w)}</p>
    </>
  )
}

function Suggestion({ alt, asset, quote, words, onUse }: { alt: GuidedAlternative; asset: TokenInfo; quote: TokenInfo; words: Words; onUse: AvailableProps['onUse'] }) {
  const qty = formatUnits(alt.row.underlyingQty, asset.decimals)
  const strike = formatUnits(alt.ref.strikePerUnit, quote.decimals)
  const terms = `${qty} ${asset.code} at ${strike} ${quote.code}, until ${formatUtcDay(alt.ref.expiry)}`
  const differs = [alt.differs.qty ? 'quantity' : null, alt.differs.strike ? 'price' : null, alt.differs.expiry ? 'date' : null].filter((x): x is string => x !== null)
  const price = `${alt.perUnit === null ? '–' : formatUnits(alt.perUnit, quote.decimals)} ${quote.code} per unit, ${formatUnits(alt.row.totalPremium, quote.decimals)} ${words.q} in total.`
  return (
    <li className={styles.suggestion}>
      <div className={styles.suggestionText}>
        <p className={styles.suggestionTerms}>{terms}</p>
        <p className={styles.suggestionDetail}>
          {differs.length > 0 ? `Differs from yours in ${formatList(differs)}. ` : null}
          {price}
        </p>
      </div>
      <Button
        size="sm"
        aria-label={`${USE_TERMS}: ${terms}`}
        onClick={() => onUse({ qty: alt.row.underlyingQty, strike: alt.ref.strikePerUnit, expiry: alt.ref.expiry })}
      >
        {USE_TERMS}
      </Button>
    </li>
  )
}

/**
 * Block 3 of the guided flow: what the contract holds for the chosen terms. The best funded order when there is
 * one; otherwise the nearest funded terms as one-tap suggestions (never swapped in silently) and the way to post
 * terms of one's own.
 */
export function Available({ intent, match, asset, quote, words, qty, lowestOffer, premiumText, onPremiumChange, onUse }: AvailableProps) {
  const side = match.side
  if (match.exact) {
    return (
      <section className={styles.root} aria-labelledby="guided-available">
        <h3 id="guided-available" className={styles.heading}>
          {AVAILABLE_HEADING}
        </h3>
        <Found intent={intent} row={match.exact} asset={asset} quote={quote} words={words} />
      </section>
    )
  }

  const suggestions = [...match.sameSeries, ...match.nearby]
  const fallback = FALLBACK[side]
  const collateral = qty === null ? '' : match.kind === 'put' ? `${words.strikeTotal} ${words.q}` : `${words.qty} ${words.a}`
  const lowestPerUnit = lowestOffer ? premiumUnits(lowestOffer) : null
  const premium = parsePositive(premiumText, quote.decimals)
  const ownPerUnit = premium !== null && qty !== null ? perUnit(premium, { underlyingQty: qty, underlying: asset }) : null
  const suggested = lowestPerUnit !== null && qty !== null ? premiumAt(lowestPerUnit, qty, asset.decimals, quote.decimals) : null

  return (
    <section className={styles.root} aria-labelledby="guided-available">
      <h3 id="guided-available" className={styles.heading}>
        {qty === null ? NO_QTY_HEADING[side] : NOTHING_HEADING}
      </h3>
      <p className={styles.sentence} data-testid="guided-not-found">
        {qty === null ? NOT_FOUND_NO_QTY[side] : NOT_FOUND[side](words)}
      </p>

      {suggestions.length > 0 ? (
        <div className={styles.block}>
          <h4 className={styles.subheading}>{SUGGESTIONS_HEADING}</h4>
          <ul className={styles.suggestions} role="list">
            {suggestions.map((alt) => (
              <Suggestion key={alt.row.key} alt={alt} asset={asset} quote={quote} words={words} onUse={onUse} />
            ))}
          </ul>
        </div>
      ) : null}

      {qty !== null ? (
        <div className={styles.block} data-testid="guided-fallback">
          <h4 className={styles.subheading}>{fallback.heading}</h4>
          <p className={styles.body}>{fallback.body(collateral)}</p>
          <div className={styles.own}>
            <AmountField
              className={styles.premium}
              label={fallback.field}
              value={premiumText}
              onValueChange={onPremiumChange}
              unit={quote.code}
              decimals={2}
              hint={ownPerUnit !== null ? perUnitHint(formatUnits(ownPerUnit, quote.decimals), quote.code, asset.code) : undefined}
            />
            <div className={styles.reference}>
              {lowestOffer && lowestPerUnit !== null ? (
                <>
                  <p>{LOWEST_OFFER(formatUnits(lowestPerUnit, quote.decimals), quote.code, formatUnits(lowestOffer.underlyingQty, asset.decimals), asset.code)}</p>
                  {suggested !== null && suggested > 0n ? (
                    <Button size="sm" variant="quiet" onClick={() => onPremiumChange(formatUnits(suggested, quote.decimals, { group: false }))}>
                      {matchPrice(formatUnits(lowestPerUnit, quote.decimals))}
                    </Button>
                  ) : null}
                </>
              ) : (
                <p>{fallback.first}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
