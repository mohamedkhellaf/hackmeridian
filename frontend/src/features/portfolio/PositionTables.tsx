// The tables of the three portfolio tabs. Where the list has the room, each list is a ruled table: one row per
// position, the whole row opens the position page, and the row carries its contract call (and, for a held
// option, listing it for resale). Where it does not (a container query on the list's own width, not the
// viewport), the same rows are a list of three-line items that open the position page, with no figure left out.
import { useNavigate } from '@tanstack/react-router'
import type { MouseEvent, ReactNode } from 'react'
import { formatCountdown, formatExact, formatUnits, formatUtc } from '../../core/format'
import type { OptionOffer, TokenInfo } from '../../core/options/types'
import { requiredCollateral } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import { premiumUnits } from '../../core/units'
import { optionSubject, bidSubject, useSubjectBusy, useTxBusy } from '../../data'
import type { PositionView } from '../../data'
import { Amount, Button, Countdown, DateTime, Glyph, IconChevronRight, Marker, RowHeader, TBody, THead, Table, TableWrap, Td, Th, Tr } from '../../ui'
import { BID_STATUS, BUSY_REASON, SHORT_LINE, VIEW_POSITION, YOU_LOCK, phonePremium, statusLine, strikeAgainst } from './copy'
import { isShort } from './hooks'
import { PositionButtonLink, PositionLink, ReservesLink } from './links'
import { ACTION_NAME, ACTION_OF_KIND, KIND_WORD, MONEYNESS_WORD, glyphOf, money, qtyOf, sellLabel, strikeExact, strikeText } from './model'
import type { PositionAction } from './model'
import css from './PositionTables.module.css'

const HOUR_MS = 3_600_000

export type RowActionHandler = (p: PositionView, action: PositionAction) => void

export interface PositionTableProps {
  rows: readonly PositionView[]
  onAction: RowActionHandler
  /** Tokens the contract holds less of than it owes. */
  short?: readonly TokenInfo[]
  /** Whether the wallet can list this held option for resale now. */
  canSell?: (p: PositionView) => boolean
  /** One more line under where the row stands: an open offer's place in its series, a sale since the last visit. */
  noteOf?: (p: PositionView) => string | null
}

/** The token the contract pays this row out in: an exercise, a claim, a reclaim or a cancellation. */
function payoutOf(p: PositionView): TokenInfo | null {
  if (p.role === 'holder') return p.option.state === 'active' ? requiredCollateral(p.option).token : null
  if (p.claim) return p.claim.token
  if (p.option.state === 'expired' || p.option.state === 'offered') return requiredCollateral(p.option).token
  return null
}

// ------------------------------------------------------------------------------------------- cells

/** Kind with its payoff glyph; the word is the link to the position and its name carries the terms. */
function OptionCell({ p }: { p: PositionView }) {
  const o = p.option
  return (
    <RowHeader>
      <span className={css.option}>
        <Glyph name={glyphOf(o.kind, p.role)} size={12} />
        <PositionLink id={o.id} tone="ink" className={css.optionLink} aria-label={`${KIND_WORD[o.kind]} on ${money(qtyOf(o))} at ${strikeText(o)} ${o.quote.code}, number ${o.id}`}>
          {KIND_WORD[o.kind]}
          <IconChevronRight size={12} />
        </PositionLink>
      </span>
    </RowHeader>
  )
}

const Figure = ({ units, decimals }: { units: bigint; decimals: number }) => <Amount value={formatUnits(units, decimals)} exact={formatExact(units, decimals)} />

/** The premium as the total, with the premium per unit under it, as the Requests board prints it. */
function PremiumCell({ o }: { o: Pick<OptionOffer, 'underlying' | 'quote' | 'underlyingQty' | 'totalPremium'> }) {
  const unit = premiumUnits(o)
  return (
    <Td numeric>
      <span className={css.stackEnd}>
        <Figure units={o.totalPremium} decimals={o.quote.decimals} />
        {unit !== null ? (
          <span className={css.sub}>
            {formatUnits(unit, o.quote.decimals)} per {o.underlying.code}
          </span>
        ) : null}
      </span>
    </Td>
  )
}

function TermsCells({ o }: { o: Pick<OptionOffer, 'underlying' | 'quote' | 'underlyingQty' | 'totalStrike' | 'totalPremium'> }) {
  return (
    <>
      <Td>{o.underlying.code}</Td>
      <Td numeric>
        <Figure units={o.underlyingQty} decimals={o.underlying.decimals} />
      </Td>
      <Td numeric>
        <Amount value={strikeText(o)} exact={strikeExact(o)} />
      </Td>
      <PremiumCell o={o} />
    </>
  )
}

/** The deadline in UTC with the time left while it still runs. A holder's in-the-money option warns from 48 hours, the rest from 2. */
function DeadlineCell({ expiry, live, warnHours }: { expiry: number; live: boolean; warnHours: number }) {
  return (
    <Td>
      <span className={css.stack}>
        <DateTime value={expiry * 1000} format="table" />
        {live ? (
          <span className={css.sub}>
            <Countdown to={expiry * 1000} warnBelowMs={warnHours * HOUR_MS} />
          </span>
        ) : null}
      </span>
    </Td>
  )
}

const warnHoursOf = (p: PositionView): number => (p.role === 'holder' && p.moneyness === 'in' ? 48 : 2)

function ShortNote({ token }: { token: TokenInfo }) {
  return (
    <span className={css.short}>
      <ReservesLink tone="quiet">{SHORT_LINE(token.code)}</ReservesLink>
    </span>
  )
}

/** Where the position stands: moneyness in words with the price it was measured at while active, else what is pending. */
function StandingCell({ p, short, note }: { p: PositionView; short: readonly TokenInfo[]; note?: string | null }) {
  const o = p.option
  const payout = payoutOf(p)
  const shortNote = payout && isShort(payout, short) ? <ShortNote token={payout} /> : null
  if (o.state === 'offered') {
    // An open offer: what it locks (a cancel returns it) and where its premium ranks in the series.
    return (
      <Td muted>
        <span className={css.stack}>
          <span className={css.wrap}>{statusLine(p)}</span>
          <span className={css.sub}>{YOU_LOCK(money(p.collateral))}</span>
          {note ? <span className={css.sub}>{note}</span> : null}
          {shortNote}
        </span>
      </Td>
    )
  }
  if (o.state === 'active' && p.moneyness) {
    return (
      <Td>
        <span className={css.stack}>
          <span>{MONEYNESS_WORD[p.moneyness]}</span>
          <span className={css.sub}>{strikeAgainst(p) ?? 'Set an assumed price on the position page'}</span>
          {p.listing ? <span className={css.sub}>Listed for resale at {money({ token: o.quote, amount: p.listing.askTotal })}</span> : null}
          {note ? <span className={css.news}>{note}</span> : null}
          {shortNote}
        </span>
      </Td>
    )
  }
  return (
    <Td muted>
      <span className={css.stack}>
        <span className={css.wrap}>{statusLine(p)}</span>
        {shortNote}
      </span>
    </Td>
  )
}

function RowAction({ p, action, onAction, variant = 'secondary' }: { p: PositionView; action: PositionAction; onAction: RowActionHandler; variant?: 'secondary' | 'quiet' }) {
  const working = useSubjectBusy(optionSubject(p.option.id))
  const busy = useTxBusy()
  const label = action === 'sell' ? sellLabel(p.listing) : ACTION_NAME[action]
  return (
    <Button
      size="sm"
      variant={variant}
      loading={working && variant === 'secondary'}
      disabled={busy && !working}
      disabledReason={BUSY_REASON}
      onClick={() => onAction(p, action)}
      aria-label={`${label}: ${KIND_WORD[p.option.kind].toLowerCase()} on ${money(qtyOf(p.option))}, number ${p.option.id}`}
    >
      {label}
    </Button>
  )
}

const NoAction = () => (
  <span className={css.none}>
    <span aria-hidden="true">–</span>
    <span className="ui-vh">No action</span>
  </span>
)

/**
 * The contract call the row allows, and listing for resale for a held option. An exercise that the reference
 * says is out of the money is left to the position page, where its warning and consent are: the row leads with
 * the listing instead.
 */
function ActionCell({ p, onAction, canSell }: { p: PositionView; onAction: RowActionHandler; canSell?: (p: PositionView) => boolean }) {
  // Past its deadline an option still reads active for a few seconds, until the next read: nothing to exercise.
  const lapsed = p.action === 'exercise' && p.secondsLeft !== null && p.secondsLeft <= 0
  const call = p.action && !lapsed ? ACTION_OF_KIND[p.action] : null
  const showCall = call !== null && !(call === 'exercise' && (p.moneyness === 'out' || p.moneyness === 'at'))
  const sell = p.role === 'holder' && !lapsed && (canSell?.(p) ?? false)
  return (
    <Td pinned>
      {showCall || sell ? (
        <span className={css.actions}>
          {showCall && call ? <RowAction p={p} action={call} onAction={onAction} /> : null}
          {sell ? <RowAction p={p} action="sell" onAction={onAction} variant={showCall ? 'quiet' : 'secondary'} /> : null}
        </span>
      ) : (
        <NoAction />
      )}
    </Td>
  )
}

// ------------------------------------------------------------------------------------------- phone rows

/** What the emphasised corner of a phone row says: what waits for the wallet, else the time left, else the date. */
function phoneCorner(p: PositionView): string {
  const o = p.option
  if (p.role === 'writer' && p.claim) return `Claim ${money(p.claim)}`
  if (p.role === 'writer' && o.state === 'expired') return `Reclaim ${money(p.collateral)}`
  if (p.secondsLeft !== null && p.secondsLeft > 0) return `${formatCountdown(p.secondsLeft)} left`
  return ''
}

/** Three lines and a chevron; the whole row is the link to the position. */
function PhoneRow({ p, short, note }: { p: PositionView; short: readonly TokenInfo[]; note?: string | null }) {
  const o = p.option
  const standing =
    o.state === 'active' && p.moneyness
      ? [MONEYNESS_WORD[p.moneyness], strikeAgainst(p), note].filter(Boolean).join('. ')
      : o.state === 'offered'
        ? [statusLine(p), YOU_LOCK(money(p.collateral)), note].filter(Boolean).join('. ')
        : [statusLine(p), note].filter(Boolean).join('. ')
  const listing = o.state === 'active' && p.listing ? `Listed for resale at ${money({ token: o.quote, amount: p.listing.askTotal })}` : null
  const payout = payoutOf(p)
  return (
    <li className={css.phoneItem} data-closed={p.closed || undefined}>
      <PositionLink id={o.id} tone="ink" className={css.phoneRow}>
        <span className={css.phoneLine}>
          <span className={css.phoneTitle}>
            <Glyph name={glyphOf(o.kind, p.role)} size={12} />
            <span>
              {KIND_WORD[o.kind]} on {money(qtyOf(o))} at {strikeText(o)}
            </span>
          </span>
          <span className={css.phoneWhen}>{phoneCorner(p)}</span>
        </span>
        <span className={css.phoneWhere}>{listing ? `${standing}. ${listing}` : standing}</span>
        <span className={css.phoneLine}>
          <span className={css.phoneMeta}>{phonePremium(p)}</span>
          <span className={css.phoneMeta}>{formatUtc(o.expiry)}</span>
        </span>
        {payout && isShort(payout, short) ? <span className={css.short}>{SHORT_LINE(payout.code)}</span> : null}
        <IconChevronRight size={16} className={css.chevron} />
      </PositionLink>
    </li>
  )
}

// ------------------------------------------------------------------------------------------- tables

/** The table where the list is wide enough for it, the list where it is not. Both carry every row. */
function Responsive({ label, children, phone }: { label: string; children: ReactNode; phone: ReactNode }) {
  return (
    <div className={css.root}>
      <div className={css.desktop}>
        <TableWrap label={label}>{children}</TableWrap>
      </div>
      <ul className={css.phone} aria-label={label}>
        {phone}
      </ul>
    </div>
  )
}

/** One set of column widths for every eight-column table, so the tabs and the order lists line up. */
const COLUMNS = ['9%', '7%', '7%', '9%', '13%', '12%', '22%', '21%'] as const
const LISTING_COLUMNS = ['9%', '7%', '7%', '9%', '13%', '12%', '43%'] as const

const Columns = ({ widths }: { widths: readonly string[] }) => (
  <colgroup>
    {widths.map((width, i) => (
      <col key={i} style={{ width }} />
    ))}
  </colgroup>
)

function Head({ strike, premium, last = 'Where it stands', action = 'Actions' }: { strike: string; premium: ReactNode; last?: string; action?: string }) {
  return (
    <THead>
      <Tr>
        <Th>Option</Th>
        <Th>Asset</Th>
        <Th numeric>Quantity</Th>
        <Th numeric>{strike}</Th>
        <Th numeric>{premium}</Th>
        <Th>Deadline (UTC)</Th>
        <Th>{last}</Th>
        <Th pinned>
          <span className="ui-vh">{action}</span>
        </Th>
      </Tr>
    </THead>
  )
}

/** A long header on two lines, so the column keeps the width of its figures. */
const TwoLines = ({ first, second }: { first: string; second: string }) => (
  <>
    {first}
    <br />
    {second}
  </>
)

const unitOf = (rows: readonly { option: OptionOffer }[]): string => rows[0]?.option.quote.code ?? ''

/** A click anywhere on a row that is not on its link or a button opens the position. */
function useRowOpen() {
  const navigate = useNavigate()
  return (id: bigint) => (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest('a, button')) return
    if (window.getSelection()?.toString()) return
    void navigate({ to: '/portfolio/$id', params: { id: id.toString() } })
  }
}

function PositionTable({ label, premium, rows, onAction, short = [], canSell, noteOf }: PositionTableProps & { label: string; premium: string }) {
  const unit = unitOf(rows)
  const open = useRowOpen()
  return (
    <Responsive label={label} phone={rows.map((p) => <PhoneRow key={p.option.id.toString()} p={p} short={short} note={noteOf?.(p)} />)}>
      <Table fixed className={css.table} caption={`${label}. Strike per unit and premium in ${unit}.`}>
        <Columns widths={COLUMNS} />
        <Head strike={`Strike (${unit})`} premium={<TwoLines first={premium} second={`(${unit})`} />} />
        <TBody>
          {rows.map((p) => (
            <Tr key={p.option.id.toString()} data-testid={`row-${p.option.id}`} interactive className={css.row} data-closed={p.closed || undefined} onClick={open(p.option.id)}>
              <OptionCell p={p} />
              <TermsCells o={p.option} />
              <DeadlineCell expiry={p.option.expiry} live={p.secondsLeft !== null && p.secondsLeft > 0} warnHours={warnHoursOf(p)} />
              <StandingCell p={p} short={short} note={noteOf?.(p)} />
              <ActionCell p={p} onAction={onAction} canSell={canSell} />
            </Tr>
          ))}
        </TBody>
      </Table>
    </Responsive>
  )
}

/** Options the wallet holds or held. */
export const HoldingTable = (props: PositionTableProps) => <PositionTable {...props} label="Options you hold" premium="Original premium" />

/** Options the wallet wrote that found a buyer. */
export const WrittenTable = (props: PositionTableProps) => <PositionTable {...props} label="Options you wrote" premium="Premium earned" />

/** Offers the wallet wrote that have no buyer. */
export const OffersTable = (props: PositionTableProps) => <PositionTable {...props} label="Your offers without a buyer" premium="Premium asked" />

export interface ListingsTableProps {
  rows: readonly PositionView[]
  onAction: RowActionHandler
}

/** The wallet's live resale listings: its price under the highlighter, re-price and withdraw. */
export function ListingsTable({ rows, onAction }: ListingsTableProps) {
  const label = 'Your resale listings'
  const unit = unitOf(rows)
  const open = useRowOpen()
  return (
    <Responsive label={label} phone={rows.map((p) => <PhoneRow key={p.option.id.toString()} p={p} short={[]} />)}>
      <Table fixed className={css.table} caption={`${label}. Strike per unit and your price in ${unit}.`}>
        <Columns widths={LISTING_COLUMNS} />
        <THead>
          <Tr>
            <Th>Option</Th>
            <Th>Asset</Th>
            <Th numeric>Quantity</Th>
            <Th numeric>Strike ({unit})</Th>
            <Th numeric>Your price ({unit})</Th>
            <Th>Deadline (UTC)</Th>
            <Th pinned>
              <span className="ui-vh">Actions</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((p) => {
            const o = p.option
            const ask = p.listing?.askTotal ?? 0n
            return (
              <Tr key={o.id.toString()} data-testid={`listing-${o.id}`} interactive className={css.row} onClick={open(o.id)}>
                <OptionCell p={p} />
                <Td>{o.underlying.code}</Td>
                <Td numeric>
                  <Figure units={o.underlyingQty} decimals={o.underlying.decimals} />
                </Td>
                <Td numeric>
                  <Amount value={strikeText(o)} exact={strikeExact(o)} />
                </Td>
                <Td numeric>
                  <Marker>
                    <Figure units={ask} decimals={o.quote.decimals} />
                  </Marker>
                </Td>
                <DeadlineCell expiry={o.expiry} live={p.secondsLeft !== null && p.secondsLeft > 0} warnHours={2} />
                <Td pinned>
                  <span className={css.actions}>
                    <RowAction p={p} action="sell" onAction={onAction} />
                    <RowAction p={p} action="unlist" onAction={onAction} variant="quiet" />
                  </span>
                </Td>
              </Tr>
            )
          })}
        </TBody>
      </Table>
    </Responsive>
  )
}

// ------------------------------------------------------------------------------------------- requests

export interface RequestsTableProps {
  rows: readonly Bid[]
  nowSec: number
  onCancel: (bid: Bid) => void
  short?: readonly TokenInfo[]
}

const cancellable = (b: Bid): boolean => b.state === 'open' || b.state === 'expired'

function CancelRequestButton({ b, onCancel, wide = false }: { b: Bid; onCancel: (bid: Bid) => void; wide?: boolean }) {
  const working = useSubjectBusy(bidSubject(b.id))
  const busy = useTxBusy()
  return (
    <Button
      size={wide ? 'md' : 'sm'}
      loading={working}
      disabled={busy && !working}
      disabledReason={BUSY_REASON}
      onClick={() => onCancel(b)}
      aria-label={`Cancel request: ${b.kind} on ${money({ token: b.underlying, amount: b.underlyingQty })}, number ${b.id}`}
    >
      Cancel request
    </Button>
  )
}

function RequestAction({ b, onCancel, wide }: { b: Bid; onCancel: (bid: Bid) => void; wide?: boolean }) {
  if (cancellable(b)) return <CancelRequestButton b={b} onCancel={onCancel} wide={wide} />
  if (b.state === 'filled' && b.optionId !== null) {
    return (
      <PositionButtonLink id={b.optionId} size={wide ? 'md' : 'sm'}>
        {VIEW_POSITION}
      </PositionButtonLink>
    )
  }
  return <NoAction />
}

/** The wallet's requests: premiums it escrowed, each cancellable for a refund while open or expired. */
export function RequestsTable({ rows, nowSec, onCancel, short = [] }: RequestsTableProps) {
  const label = 'Your requests'
  const unit = rows[0]?.quote.code ?? ''
  const status = (b: Bid): string => (b.state === 'open' && b.expiry <= nowSec ? BID_STATUS.expired : BID_STATUS[b.state])
  const closed = (b: Bid): boolean => !cancellable(b)
  return (
    <div className={css.root}>
      <div className={css.desktop}>
        <TableWrap label={label}>
          <Table fixed className={css.table} caption={`${label}. Strike per unit and escrowed premium in ${unit}.`}>
            <Columns widths={COLUMNS} />
            <Head strike={`Strike (${unit})`} premium={<TwoLines first="Premium escrowed" second={`(${unit})`} />} />
            <TBody>
              {rows.map((b) => (
                <Tr key={b.id.toString()} data-testid={`request-${b.id}`} data-closed={closed(b) || undefined}>
                  <RowHeader>
                    <span className={css.option}>
                      <Glyph name={glyphOf(b.kind, 'holder')} size={12} />
                      <span>{KIND_WORD[b.kind]}</span>
                    </span>
                  </RowHeader>
                  <TermsCells o={b} />
                  <DeadlineCell expiry={b.expiry} live={b.state === 'open' && b.expiry > nowSec} warnHours={2} />
                  <Td muted>
                    <span className={css.stack}>
                      <span className={css.wrap}>{status(b)}</span>
                      {cancellable(b) && isShort(b.quote, short) ? <ShortNote token={b.quote} /> : null}
                    </span>
                  </Td>
                  <Td pinned>
                    <RequestAction b={b} onCancel={onCancel} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </div>
      <ul className={css.phone} aria-label={label}>
        {rows.map((b) => (
          <li key={b.id.toString()} className={css.phoneItem} data-closed={closed(b) || undefined}>
            <div className={css.phoneRow} data-plain>
              <span className={css.phoneLine}>
                <span className={css.phoneTitle}>
                  <Glyph name={glyphOf(b.kind, 'holder')} size={12} />
                  <span>
                    {KIND_WORD[b.kind]} on {money({ token: b.underlying, amount: b.underlyingQty })} at {strikeText(b)}
                  </span>
                </span>
                <span className={css.phoneWhen}>{b.state === 'open' && b.expiry > nowSec ? `${formatCountdown(b.expiry - nowSec)} left` : ''}</span>
              </span>
              <span className={css.phoneWhere}>{status(b)}</span>
              <span className={css.phoneLine}>
                <span className={css.phoneMeta}>Escrowed {money({ token: b.quote, amount: b.totalPremium })}</span>
                <span className={css.phoneMeta}>{formatUtc(b.expiry)}</span>
              </span>
              {cancellable(b) && isShort(b.quote, short) ? <ShortNote token={b.quote} /> : null}
              <span className={css.phoneAction}>
                <RequestAction b={b} onCancel={onCancel} wide />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
