import type { Ref } from 'react'
import type { GuidedAlternative } from '../../../data'
import { explorerAccount, isMockId } from '../../../core/explorer'
import { formatExact, formatUnits, formatUtc, formatUtcDay, serialOf } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import { perUnit, premiumUnits } from '../../../core/units'
import { Address, Amount, AmountField, Button, KeyValue, KeyValueItem, Skeleton } from '../../../ui'
import { OwnLink } from './Closing'
import {
  AVAILABLE_HEADING,
  COVER,
  DIFFERS,
  FALLBACK,
  FIELD,
  IN_TOTAL,
  LOCKED_IN_CONTRACT,
  LOCK_UNTIL,
  LOWEST_OFFER,
  NO_BUYER,
  NO_OFFER_HEADING,
  NO_QTY_HEADING,
  NO_SINGLE_OFFER,
  NOT_FOUND,
  NOT_FOUND_NO_QTY,
  OWN,
  PAID_AT_SIGN,
  PER_UNIT,
  READ_AT,
  RETRY,
  SERIAL_LABEL,
  START_WITH,
  SUGGESTIONS_HEADING,
  USE_TERMS,
  WRITE_HEADING,
  matchPrice,
  perUnitHint,
} from './copy'
import { premiumAt } from './terms'
import type { GuidedModel } from './useGuidedModel'
import styles from './Available.module.css'

export interface AvailableProps {
  model: GuidedModel
  /** The block's heading takes focus after "Use these terms": the button that had it is gone. */
  headingRef: Ref<HTMLHeadingElement>
  /** Adopts the terms of a suggestion, then moves focus to the heading. */
  onUse: (terms: { qty: bigint; strike: bigint; expiry: number }) => void
}

const clock = (ms: number) => `${new Date(ms).toISOString().slice(11, 19)} UTC`

function Party({ value }: { value: string }) {
  return <Address value={value} length="medium" explorerUrl={isMockId(value) ? undefined : explorerAccount(value)} />
}

/**
 * Block 3 of the guided flow: what the contract holds for the chosen terms. The wallet's own order or position at
 * these terms first; then the best funded order when there is one, else the nearest funded terms as one-tap
 * suggestions (never swapped in silently) and the way to post terms of one's own.
 */
export function Available({ model, headingRef, onUse }: AvailableProps) {
  const { match, side, qty, exact, mine, words } = model
  if (!match) return <Skeleton variant="rows" lines={4} />

  const heading = exact
    ? AVAILABLE_HEADING
    : qty === null
      ? NO_QTY_HEADING[side]
      : side === 'write'
        ? WRITE_HEADING
        : model.lots.length > 0
          ? NO_SINGLE_OFFER(words.qty, words.a)
          : NO_OFFER_HEADING
  const number = exact ? `${SERIAL_LABEL[exact.source]} ${serialOf(exact.bid?.id ?? exact.offer?.id ?? 0n)}` : null

  return (
    <section className={styles.root} aria-labelledby="guided-available">
      {mine ? <OwnLine model={model} /> : null}
      <div className={styles.head}>
        <h3 id="guided-available" className={styles.heading} tabIndex={-1} ref={headingRef}>
          {heading}
        </h3>
        {model.refreshFailed ? (
          <p className={styles.aside}>
            {model.updatedAt !== null ? READ_AT(clock(model.updatedAt)) : null}{' '}
            <Button size="sm" variant="quiet" onClick={model.retry}>
              {RETRY}
            </Button>
          </p>
        ) : number ? (
          <p className={styles.aside} data-testid="guided-number">
            {number}
          </p>
        ) : null}
      </div>
      {exact ? <Found model={model} row={exact} /> : <NotFound model={model} onUse={onUse} />}
    </section>
  )
}

function OwnLine({ model }: { model: GuidedModel }) {
  const { mine, words, asset, quote, deadline } = model
  if (!mine) return null
  const units = (n: bigint) => formatUnits(n, asset.decimals)
  const money = (n: bigint) => formatUnits(n, quote.decimals)
  let text: string
  if (mine.kind === 'holding') text = OWN.holding({ ...words, qty: units(mine.qty), deadline })
  else if (mine.kind === 'written') text = OWN.written({ ...words, qty: units(mine.qty), deadline })
  else if (mine.kind === 'offer') text = OWN.offer(serialOf(mine.id), units(mine.qty), asset.code, money(mine.premium), quote.code)
  else text = OWN.request(serialOf(mine.id), units(mine.qty), asset.code, money(mine.premium), quote.code)
  return (
    <p className={styles.mine} data-testid="guided-own">
      {text} <OwnLink item={mine} />
    </p>
  )
}

function Found({ model, row }: { model: GuidedModel; row: BookRow }) {
  const { asset, quote } = model
  const unitPrice = premiumUnits(row)
  const buying = row.source !== 'bid'
  const collateral =
    row.kind === 'put' ? (
      <Amount value={formatUnits(row.totalStrike, quote.decimals)} exact={formatExact(row.totalStrike, quote.decimals)} unit={quote.code} figure="serif" />
    ) : (
      <Amount value={formatUnits(row.underlyingQty, asset.decimals)} exact={formatExact(row.underlyingQty, asset.decimals)} unit={asset.code} figure="serif" />
    )
  return (
    <div data-testid="guided-found">
      <KeyValue className={styles.terms}>
        <KeyValueItem label={row.source === 'resale' ? FIELD.resalePerUnit : FIELD.perUnit}>
          {unitPrice === null ? '–' : <Amount value={formatUnits(unitPrice, quote.decimals)} exact={formatExact(unitPrice, quote.decimals)} unit={quote.code} figure="serif" />}
        </KeyValueItem>
        {buying ? (
          <KeyValueItem label={FIELD.collateral} hint={LOCKED_IN_CONTRACT}>
            {collateral}
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
        <KeyValueItem label={buying ? FIELD.pay : FIELD.paid} size="lg" hint={buying ? undefined : PAID_AT_SIGN}>
          <span data-testid="guided-total">
            <Amount value={formatUnits(row.totalPremium, quote.decimals)} exact={formatExact(row.totalPremium, quote.decimals)} unit={quote.code} figure="serif" size="lg" />
          </span>
        </KeyValueItem>
      </KeyValue>
    </div>
  )
}

const sameTerms = (a: GuidedAlternative, b: GuidedAlternative) =>
  a.row.underlyingQty === b.row.underlyingQty && a.ref.strikePerUnit === b.ref.strikePerUnit && a.ref.expiry === b.ref.expiry

/**
 * The suggestions in the order a reader needs them: the same quantity at other terms first, then smaller lots of
 * the same terms, then the rest; two orders with identical terms become one line with the better price.
 */
function ordered(model: GuidedModel): GuidedAlternative[] {
  const { match, qty, side } = model
  if (!match) return []
  const all = [...match.sameSeries, ...match.nearby]
  const better = (a: GuidedAlternative, b: GuidedAlternative) => {
    if (a.perUnit === null || b.perUnit === null) return false
    return side === 'buy' ? a.perUnit < b.perUnit : a.perUnit > b.perUnit
  }
  const merged: GuidedAlternative[] = []
  for (const alt of all) {
    const at = merged.findIndex((m) => sameTerms(m, alt))
    if (at === -1) merged.push(alt)
    else if (better(alt, merged[at])) merged[at] = alt
  }
  const rank = (alt: GuidedAlternative) => (qty !== null && alt.row.underlyingQty === qty ? 0 : !alt.differs.strike && !alt.differs.expiry ? 1 : 2)
  return merged.map((alt, i) => ({ alt, i })).sort((a, b) => rank(a.alt) - rank(b.alt) || a.i - b.i).map((x) => x.alt)
}

function NotFound({ model, onUse }: { model: GuidedModel; onUse: AvailableProps['onUse'] }) {
  const { side, qty, words, deadline, asset, quote, cover } = model
  const units = (n: bigint) => formatUnits(n, asset.decimals)
  const money = (n: bigint) => formatUnits(n, quote.decimals)
  const suggestions = ordered(model)
  const firstCover = cover.rows[0]
  const firstCoverPerUnit = firstCover ? premiumUnits(firstCover) : null

  const suggestionList =
    suggestions.length > 0 ? (
      <div className={styles.block}>
        <h4 className={styles.subheading}>{SUGGESTIONS_HEADING[side]}</h4>
        <ul className={styles.suggestions} role="list">
          {suggestions.map((alt) => (
            <Suggestion key={alt.row.key} alt={alt} model={model} onUse={onUse} />
          ))}
        </ul>
      </div>
    ) : null

  if (qty === null) {
    return (
      <>
        <p className={styles.sentence} data-testid="guided-not-found">
          {NOT_FOUND_NO_QTY[side]}
        </p>
        {suggestionList}
      </>
    )
  }

  const fallback = <Fallback model={model} />
  if (side === 'write') {
    // The seller side opens on posting an offer, the normal way to earn here; a waiting buyer elsewhere follows.
    return (
      <>
        <p className={styles.sentence} data-testid="guided-not-found">
          {NO_BUYER}
        </p>
        {fallback}
        {suggestionList}
      </>
    )
  }

  return (
    <>
      <p className={styles.sentence} data-testid="guided-not-found">
        {cover.rows.length > 0 ? COVER(cover.rows.length, units(cover.total), words.qty, words.a) : NOT_FOUND({ ...words, deadline })}
      </p>
      {firstCover && firstCoverPerUnit !== null && model.match?.ref ? (
        <div>
          <Button size="sm" variant="secondary" onClick={() => onUse({ qty: firstCover.underlyingQty, strike: model.strike, expiry: model.expiry })}>
            {START_WITH(units(firstCover.underlyingQty), asset.code, money(firstCoverPerUnit))}
          </Button>
        </div>
      ) : null}
      {suggestionList}
      {fallback}
    </>
  )
}

function Suggestion({ alt, model, onUse }: { alt: GuidedAlternative; model: GuidedModel; onUse: AvailableProps['onUse'] }) {
  const { asset, quote, qty, copy, words } = model
  const theirQty = formatUnits(alt.row.underlyingQty, asset.decimals)
  const theirStrike = formatUnits(alt.ref.strikePerUnit, quote.decimals)
  const parts: string[] = []
  if (qty === null) parts.push(`${theirQty}\u00a0${asset.code}`)
  else if (alt.differs.qty) parts.push(DIFFERS.qty(theirQty, words.qty, asset.code))
  if (alt.differs.strike) parts.push(DIFFERS.strike(copy.level(theirStrike), words.strike))
  if (alt.differs.expiry) parts.push(DIFFERS.expiry(formatUtcDay(alt.ref.expiry), formatUtcDay(model.expiry)))
  const lead = parts.map((p, i) => (i === 0 ? p : p.charAt(0).toLowerCase() + p.slice(1))).join(', ')
  const full = `${theirQty}\u00a0${asset.code} at ${theirStrike}\u00a0${quote.code}, until ${formatUtc(alt.ref.expiry)}`
  return (
    <li className={styles.suggestion}>
      <p className={styles.suggestionTerms}>{lead || full}</p>
      <p className={styles.suggestionPrice}>
        <span>{alt.perUnit === null ? '–' : PER_UNIT(formatUnits(alt.perUnit, quote.decimals), quote.code)}</span>
        <span className={styles.suggestionTotal}>{IN_TOTAL(formatUnits(alt.row.totalPremium, quote.decimals), quote.code)}</span>
      </p>
      <Button
        size="sm"
        variant="secondary"
        className={styles.use}
        aria-label={`${USE_TERMS}: ${full}`}
        onClick={() => onUse({ qty: alt.row.underlyingQty, strike: alt.ref.strikePerUnit, expiry: alt.ref.expiry })}
      >
        {USE_TERMS}
      </Button>
    </li>
  )
}

/** Terms of one's own: a request for a buyer, an offer for a seller, at a premium the user names. */
function Fallback({ model }: { model: GuidedModel }) {
  const { side, qty, words, asset, quote, lowestOffer, ownPremium, kind } = { ...model, kind: model.info.optionKind }
  const fallback = FALLBACK[side]
  const collateral = qty === null ? '' : kind === 'put' ? `${words.strikeTotal}\u00a0${words.q}` : `${words.qty}\u00a0${words.a}`
  const lowestPerUnit = lowestOffer ? premiumUnits(lowestOffer) : null
  const ownPerUnit = ownPremium !== null && qty !== null ? perUnit(ownPremium, { underlyingQty: qty, underlying: asset }) : null
  const suggested = lowestPerUnit !== null && qty !== null ? premiumAt(lowestPerUnit, qty, asset.decimals, quote.decimals) : null
  return (
    <div className={styles.block} data-testid="guided-fallback">
      {side === 'buy' ? <h4 className={styles.subheading}>{fallback.heading}</h4> : null}
      <p className={styles.body}>{fallback.body(collateral)}</p>
      <div className={styles.priceRow}>
        <AmountField
          className={styles.premium}
          label={fallback.field}
          value={model.premiumDraft.text}
          onValueChange={model.typePremium}
          unit={quote.code}
          decimals={2}
          hint={ownPerUnit !== null ? perUnitHint(formatUnits(ownPerUnit, quote.decimals), quote.code) : undefined}
        />
        {lowestPerUnit !== null && suggested !== null && suggested > 0n ? (
          <Button size="sm" variant="secondary" className={styles.match} onClick={() => model.typePremium(formatUnits(suggested, quote.decimals, { group: false }))}>
            {matchPrice(formatUnits(lowestPerUnit, quote.decimals))}
          </Button>
        ) : null}
      </div>
      <p className={styles.reference}>
        {lowestOffer && lowestPerUnit !== null
          ? LOWEST_OFFER(formatUnits(lowestPerUnit, quote.decimals), quote.code, formatUnits(lowestOffer.underlyingQty, asset.decimals), asset.code)
          : fallback.first}
      </p>
    </div>
  )
}
