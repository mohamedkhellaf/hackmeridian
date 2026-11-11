// The tables of the three portfolio tabs. From 768 px up each list is a ruled table with one action per row;
// on phones the same rows are a two-line list in which every row opens the position page, where all of its
// terms and actions are. Nothing is hidden at either width: it is one tap away.
import type { ReactNode } from 'react'
import { formatCountdown, formatExact, formatUnits, formatUtc } from '../../core/format'
import type { OptionOffer } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import { optionSubject, bidSubject, useSubjectBusy, useTxBusy } from '../../data'
import type { PositionView } from '../../data'
import { Amount, Button, Countdown, DateTime, Glyph, Marker, RowHeader, TBody, THead, Table, TableWrap, Tag, Td, Th, Tr } from '../../ui'
import { BID_STATE_WORD, BID_STATUS, BUSY_REASON, VIEW_POSITION, statusLine } from './copy'
import { PositionButtonLink, PositionLink } from './links'
import { ACTION_NAME, ACTION_OF_KIND, KIND_WORD, MONEYNESS_WORD, glyphOf, money, qtyOf, referencePhrase, sellLabel, stateName, strikeExact, strikeText } from './model'
import type { PositionAction } from './model'
import css from './PositionTables.module.css'

const HOUR_MS = 3_600_000

export type RowActionHandler = (p: PositionView, action: PositionAction) => void

// ------------------------------------------------------------------------------------------- cells

/** Kind with its payoff glyph; the word is the link to the position and its name carries the terms. */
function OptionCell({ p }: { p: PositionView }) {
  const o = p.option
  return (
    <RowHeader>
      <span className={css.option}>
        <Glyph name={glyphOf(o.kind, p.role)} size={12} />
        <PositionLink id={o.id} tone="ink" aria-label={`${KIND_WORD[o.kind]} on ${money(qtyOf(o))} at ${strikeText(o)} ${o.quote.code}, number ${o.id}`}>
          {KIND_WORD[o.kind]}
        </PositionLink>
      </span>
    </RowHeader>
  )
}

const Figure = ({ units, decimals }: { units: bigint; decimals: number }) => <Amount value={formatUnits(units, decimals)} exact={formatExact(units, decimals)} />

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
      <Td numeric>
        <Figure units={o.totalPremium} decimals={o.quote.decimals} />
      </Td>
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

/** Where the position stands: moneyness in words with the source of the price while it is active, else what is pending. */
function StandingCell({ p }: { p: PositionView }) {
  const o = p.option
  if (o.state === 'active' && p.moneyness) {
    const source = referencePhrase(p.reference, o.quote)
    return (
      <Td>
        <span className={css.stack}>
          <span>{MONEYNESS_WORD[p.moneyness]}</span>
          <span className={css.sub}>{source ?? 'Set an assumed price on the position page'}</span>
        </span>
      </Td>
    )
  }
  return (
    <Td muted>
      <span className={css.wrap}>{statusLine(p)}</span>
    </Td>
  )
}

function RowAction({ p, action, onAction }: { p: PositionView; action: PositionAction; onAction: RowActionHandler }) {
  const working = useSubjectBusy(optionSubject(p.option.id))
  const busy = useTxBusy()
  const label = action === 'sell' ? sellLabel(p.listing) : ACTION_NAME[action]
  return (
    <Button
      size="sm"
      loading={working}
      disabled={busy && !working}
      disabledReason={BUSY_REASON}
      onClick={() => onAction(p, action)}
      aria-label={`${label}: ${KIND_WORD[p.option.kind].toLowerCase()} on ${money(qtyOf(p.option))}, number ${p.option.id}`}
    >
      {label}
    </Button>
  )
}

/** The one contract call the row allows, or a dash that says there is none. */
function PrimaryActionCell({ p, onAction }: { p: PositionView; onAction: RowActionHandler }) {
  // Past its deadline an option still reads active for a few seconds, until the next read: nothing to exercise.
  const lapsed = p.action === 'exercise' && p.secondsLeft !== null && p.secondsLeft <= 0
  return (
    <Td pinned>
      {p.action && !lapsed ? (
        <RowAction p={p} action={ACTION_OF_KIND[p.action]} onAction={onAction} />
      ) : (
        <span className={css.none}>
          <span aria-hidden="true">–</span>
          <span className="ui-vh">No action</span>
        </span>
      )}
    </Td>
  )
}

// ------------------------------------------------------------------------------------------- phone rows

/** Two lines and a tag; the whole row is the link to the position. */
function PhoneRow({ p, second }: { p: PositionView; second?: string }) {
  const o = p.option
  const left = p.secondsLeft !== null && p.secondsLeft > 0 ? `${formatCountdown(p.secondsLeft)} left` : formatUtc(o.expiry)
  const where = second ?? (o.state === 'active' && p.moneyness && !p.listing ? [MONEYNESS_WORD[p.moneyness], referencePhrase(p.reference, o.quote)].filter(Boolean).join(' ') : statusLine(p))
  return (
    <li className={css.phoneItem}>
      <PositionLink id={o.id} tone="ink" className={css.phoneRow}>
        <span className={css.phoneLine}>
          <span className={css.phoneTitle}>
            <Glyph name={glyphOf(o.kind, p.role)} size={12} />
            <span>
              {KIND_WORD[o.kind]} on {money(qtyOf(o))} at {strikeText(o)}
            </span>
          </span>
          <Tag state={stateName(o)} />
        </span>
        <span className={css.phoneLine}>
          <span className={css.phoneWhere}>{where}</span>
          <span className={css.phoneWhen}>{left}</span>
        </span>
      </PositionLink>
    </li>
  )
}

// ------------------------------------------------------------------------------------------- tables

interface PositionTableProps {
  rows: readonly PositionView[]
  onAction: RowActionHandler
}

interface ShellProps {
  label: string
  children: ReactNode
  phone: ReactNode
}

/** The table from 768 px up, the list below. Both carry every row. */
function Responsive({ label, children, phone }: ShellProps) {
  return (
    <>
      <div className={css.desktop}>
        <TableWrap label={label}>{children}</TableWrap>
      </div>
      <ul className={css.phone} aria-label={label}>
        {phone}
      </ul>
    </>
  )
}

/** One set of column widths for every nine-column table, so the tabs and the three order lists line up. */
const COLUMNS = ['8%', '7%', '9%', '10%', '14%', '12%', '9%', '18%', '13%'] as const
const LISTING_COLUMNS = ['8%', '7%', '9%', '10%', '14%', '12%', '40%'] as const

const Columns = ({ widths }: { widths: readonly string[] }) => (
  <colgroup>
    {widths.map((width, i) => (
      <col key={i} style={{ width }} />
    ))}
  </colgroup>
)

function Head({ strike, premium, last = 'Where it stands', action = 'Action' }: { strike: string; premium: string; last?: string; action?: string }) {
  return (
    <THead>
      <Tr>
        <Th>Option</Th>
        <Th>Asset</Th>
        <Th numeric>Quantity</Th>
        <Th numeric>{strike}</Th>
        <Th numeric>{premium}</Th>
        <Th>Deadline (UTC)</Th>
        <Th>State</Th>
        <Th>{last}</Th>
        <Th pinned>{action}</Th>
      </Tr>
    </THead>
  )
}

const unitOf = (rows: readonly { option: OptionOffer }[]): string => rows[0]?.option.quote.code ?? ''

function PositionTable({ label, premium, rows, onAction }: PositionTableProps & { label: string; premium: string }) {
  const unit = unitOf(rows)
  return (
    <Responsive label={label} phone={rows.map((p) => <PhoneRow key={p.option.id.toString()} p={p} />)}>
      <Table fixed className={css.table} caption={`${label}. Strike per unit and premium in ${unit}.`}>
        <Columns widths={COLUMNS} />
        <Head strike={`Strike (${unit})`} premium={`${premium} (${unit})`} />
        <TBody>
          {rows.map((p) => (
            <Tr key={p.option.id.toString()} data-testid={`row-${p.option.id}`}>
              <OptionCell p={p} />
              <TermsCells o={p.option} />
              <DeadlineCell expiry={p.option.expiry} live={p.secondsLeft !== null && p.secondsLeft > 0} warnHours={warnHoursOf(p)} />
              <Td>
                <span className={css.stack}>
                  <Tag state={stateName(p.option)} />
                  {p.listing ? <span className={css.sub}>Listed for resale</span> : null}
                </span>
              </Td>
              <StandingCell p={p} />
              <PrimaryActionCell p={p} onAction={onAction} />
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
  return (
    <Responsive label={label} phone={rows.map((p) => <PhoneRow key={p.option.id.toString()} p={p} />)}>
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
            <Th pinned>Actions</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((p) => {
            const o = p.option
            const ask = p.listing?.askTotal ?? 0n
            return (
              <Tr key={o.id.toString()} data-testid={`listing-${o.id}`}>
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
                    <RowAction p={p} action="unlist" onAction={onAction} />
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
  return (
    <span className={css.none}>
      <span aria-hidden="true">–</span>
      <span className="ui-vh">No action</span>
    </span>
  )
}

/** The wallet's requests: premiums it escrowed, each cancellable for a refund while open or expired. */
export function RequestsTable({ rows, nowSec, onCancel }: RequestsTableProps) {
  const label = 'Your requests'
  const unit = rows[0]?.quote.code ?? ''
  return (
    <>
      <div className={css.desktop}>
        <TableWrap label={label}>
          <Table fixed className={css.table} caption={`${label}. Strike per unit and escrowed premium in ${unit}.`}>
            <Columns widths={COLUMNS} />
            <Head strike={`Strike (${unit})`} premium={`Premium escrowed (${unit})`} />
            <TBody>
              {rows.map((b) => (
                <Tr key={b.id.toString()} data-testid={`request-${b.id}`}>
                  <RowHeader>
                    <span className={css.option}>
                      <Glyph name={glyphOf(b.kind, 'holder')} size={12} />
                      <span>{KIND_WORD[b.kind]}</span>
                    </span>
                  </RowHeader>
                  <TermsCells o={b} />
                  <DeadlineCell expiry={b.expiry} live={b.state === 'open' && b.expiry > nowSec} warnHours={2} />
                  <Td>
                    <Tag state={BID_STATE_WORD[b.state]} />
                  </Td>
                  <Td muted>
                    <span className={css.wrap}>{BID_STATUS[b.state]}</span>
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
          <li key={b.id.toString()} className={css.phoneItem}>
            <div className={css.phoneRow} data-plain>
              <span className={css.phoneLine}>
                <span className={css.phoneTitle}>
                  <Glyph name={glyphOf(b.kind, 'holder')} size={12} />
                  <span>
                    {KIND_WORD[b.kind]} on {money({ token: b.underlying, amount: b.underlyingQty })} at {strikeText(b)}
                  </span>
                </span>
                <Tag state={BID_STATE_WORD[b.state]} />
              </span>
              <span className={css.phoneLine}>
                <span className={css.phoneWhere}>
                  {money({ token: b.quote, amount: b.totalPremium })} escrowed. {BID_STATUS[b.state]}.
                </span>
                <span className={css.phoneWhen}>{b.state === 'open' && b.expiry > nowSec ? `${formatCountdown(b.expiry - nowSec)} left` : formatUtc(b.expiry)}</span>
              </span>
              <span className={css.phoneAction}>
                <RequestAction b={b} onCancel={onCancel} wide />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
