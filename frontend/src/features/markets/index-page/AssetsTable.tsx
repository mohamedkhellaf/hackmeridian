// The assets of the Markets index: a ruled table while it fits its column, one card per asset when it does not.
// Both are rendered and a container query shows one, so nothing jumps and no figure is ever cut by a pinned cell.
//
// A fact that is the same on every row is not a cell: the price source goes in the column header when every row
// shares it, the tier column only appears when tiers differ, and the issuer is shown only for an asset outside
// the app's list (a reference asset is identified by the list and shows its issuer on its own page).
//
// The row and the card are one target: the action link is stretched over them. With an intent chosen above, the
// action names the intent and opens the asset in guided mode with it.
//
// The two premium columns describe the market where it is traded: the best put and call offer at the strike
// nearest the reference price, on the nearest deadline that has offers (`nearReference`). Its terms are under it.
import { Link as RouterLink } from '@tanstack/react-router'
import type { Intent } from '../../../app/search'
import { assetParam } from '../../../core/assets'
import { formatCountdown, formatUnits, formatUtcDate, formatUtcDay } from '../../../core/format'
import type { OptionKind, TokenInfo } from '../../../core/options/types'
import { intentInfo } from '../../../core/payoff/strategies'
import type { ReferenceKind } from '../../../core/reference'
import type { TokenBalance } from '../../../core/stellar/tokens'
import { useMarket } from '../../../data'
import type { MarketIndexRow } from '../../../data'
import { Address, ButtonLink, DateTime, IconWarning, Link, RowHeader, Table, TableWrap, TBody, Td, Th, THead, Tr } from '../../../ui'
import {
  ASSETS_HEADING,
  COL,
  FACT,
  INTENT_COPY,
  NONE,
  NO_REFERENCE_VALUE,
  POST_REQUEST,
  TRADE,
  WRITE_FIRST,
  nearPriceHead,
  nearTerms,
  noOffersOn,
  perUnitOf,
  shortRow,
  similarCodeNote,
  tradeLabel,
  typeLine,
} from '../copy'
import { guidedSearch, nearReference } from '../model'
import type { NearOffer } from '../model'
import { Money } from '../parts'
import { ASSET_ROUTE, RESERVES_ROUTE } from '../routing'
import styles from './AssetsTable.module.css'

export interface AssetsTableProps {
  rows: readonly MarketIndexRow[]
  quote: TokenInfo
  nowSec: number
  /** The intent chosen above: each action then opens the asset in guided mode with it. */
  intent?: Intent
  /** The wallet's balances by contract id, for the "You hold" column of an intent that starts from the asset. */
  holdings?: Readonly<Record<string, TokenBalance>> | null
  /** Tokens the contract is short of after a clawback: their row says so instead of offering trades. */
  short?: ReadonlySet<string>
}

const paramOf = (row: MarketIndexRow) => ({ asset: assetParam(row.asset) })

/** "No open offers on BOND. Post a request, or write the first offer.", with the two ways out as links. */
function ThinMarket({ row }: { row: MarketIndexRow }) {
  return (
    <span className={styles.thin}>
      {noOffersOn(row.asset.code)}{' '}
      <Link className={styles.above} render={<RouterLink to={ASSET_ROUTE} params={paramOf(row)} search={{ tab: 'requests', side: 'bid', kind: 'put' }} />}>
        {POST_REQUEST}
      </Link>
      {', or '}
      <Link className={styles.above} render={<RouterLink to={ASSET_ROUTE} params={paramOf(row)} search={{ mode: 'chain', side: 'write', kind: 'put' }} />}>
        {WRITE_FIRST}
      </Link>
      .
    </span>
  )
}

/** The row of a token the contract is short of: one line, with the warning glyph, linked to Reserves. */
function Short({ row }: { row: MarketIndexRow }) {
  return (
    <span className={styles.short}>
      <IconWarning size={16} />
      <Link className={styles.above} render={<RouterLink to={RESERVES_ROUTE} />}>
        {shortRow(row.asset.code)}
      </Link>
    </span>
  )
}

/** An asset outside the app's list is identified by its issuer; a code that imitates one of the list says so. */
function Identity({ row }: { row: MarketIndexRow }) {
  return (
    <span className={styles.identity}>
      <span className={styles.idLine}>
        <span className={styles.code} data-unlisted={row.isReference ? undefined : ''}>
          {row.asset.code}
        </span>
        <span className={styles.type}>{typeLine(row.typeLabel)}</span>
      </span>
      {!row.isReference && row.asset.issuer ? (
        <span className={styles.issuer}>
          <span>{FACT.issuer}</span>
          <Address value={row.asset.issuer} copyLabel={null} />
        </span>
      ) : null}
      {row.similar ? <span className={styles.similar}>{similarCodeNote(row.similar.reference)}</span> : null}
    </span>
  )
}

/** A header with its unit on a second line: the figures under it are bare. */
function Head({ label, unit }: { label: string; unit: string }) {
  return (
    <span className={styles.head}>
      <span>{label}</span>
      <span className={styles.headUnit}>{unit}</span>
    </span>
  )
}

const KINDS: readonly OptionKind[] = ['put', 'call']

/** The best offer of one kind near the reference price, with the terms it is for: "0.18" over "at 99.00, 13 Nov". */
function Near({ offer, quote }: { offer: NearOffer | null; quote: TokenInfo }) {
  if (offer === null) return <span className={styles.none}>{NONE}</span>
  return (
    <span className={styles.stack}>
      <Money units={offer.perUnit} token={quote} bare />
      <span className={styles.sub}>{nearTerms(formatUnits(offer.strikePerUnit, quote.decimals), formatUtcDay(offer.expiry))}</span>
    </span>
  )
}

/** The asset's market, for the two premium columns. The same reads as the index, so it is there with the row. */
function useNear(row: MarketIndexRow): Record<OptionKind, NearOffer | null> {
  const market = useMarket(row.asset)
  return market.data ? nearReference(market.data) : { put: null, call: null }
}

/** The two premium cells of a table row. */
function NearCells({ row, quote }: { row: MarketIndexRow; quote: TokenInfo }) {
  const near = useNear(row)
  return (
    <>
      {KINDS.map((kind) => (
        <Td key={kind} numeric>
          <Near offer={near[kind]} quote={quote} />
        </Td>
      ))}
    </>
  )
}

/** The two premium facts of a card. */
function NearFacts({ row, quote, source }: { row: MarketIndexRow; quote: TokenInfo; source: ReferenceKind | null }) {
  const near = useNear(row)
  return (
    <>
      {KINDS.map((kind) => (
        <div key={kind}>
          <dt>{nearPriceHead(kind, source)}</dt>
          <dd>
            <Near offer={near[kind]} quote={quote} />
          </dd>
        </div>
      ))}
    </>
  )
}

/** A balance of the row's asset: bare in the table (one asset per row), with its code on a card. */
function Held({ balance, token, bare = true }: { balance: TokenBalance | undefined; token: TokenInfo; bare?: boolean }) {
  if (!balance || balance.balance === null) return <span className={styles.none}>{NONE}</span>
  return <Money units={balance.balance} token={token} bare={bare} />
}

export function AssetsTable({ rows, quote, nowSec, intent, holdings = null, short }: AssetsTableProps) {
  const showTier = new Set(rows.map((r) => r.tier)).size > 1
  // The source of the price, once in the header when every priced row has the same one.
  const labels = new Set(rows.filter((r) => r.reference.perUnit !== null).map((r) => r.reference.label))
  const sharedLabel = labels.size === 1 ? [...labels][0] : null
  const sources = new Set(rows.filter((r) => r.reference.perUnit !== null).map((r) => r.reference.kind))
  const source = sources.size === 1 ? [...sources][0] : null
  const showHeld = intent !== undefined && holdings !== null && intentInfo(intent).starts === 'asset'
  const action = (row: MarketIndexRow) => (intent ? INTENT_COPY[intent].choose(row.asset.code) : tradeLabel(row.asset.code))
  const actionText = intent ? intentInfo(intent).name : TRADE
  const link = (row: MarketIndexRow) => <RouterLink to={ASSET_ROUTE} params={paramOf(row)} search={intent ? guidedSearch(intent) : undefined} />
  const isShort = (row: MarketIndexRow) => short?.has(row.asset.contractId) ?? false
  const marketCols = 4 + (showHeld ? 1 : 0)

  return (
    <div className={styles.root}>
      <TableWrap label={ASSETS_HEADING} className={styles.table}>
        <Table caption={ASSETS_HEADING}>
          <THead>
            <Tr>
              <Th>{COL.asset}</Th>
              {showTier ? <Th>{COL.tier}</Th> : null}
              <Th numeric>
                <Head label={sharedLabel ?? COL.reference} unit={quote.code} />
              </Th>
              {showHeld ? <Th numeric>{COL.hold}</Th> : null}
              <Th numeric>{COL.offers}</Th>
              <Th numeric>{COL.expiry}</Th>
              {KINDS.map((kind) => (
                <Th key={kind} numeric>
                  <Head label={nearPriceHead(kind, source)} unit={perUnitOf(quote.code)} />
                </Th>
              ))}
              <Th>
                <span className="ui-vh">{COL.action}</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((row) => {
              const s = row.summary
              return (
                <Tr key={row.asset.contractId} interactive className={styles.row}>
                  <RowHeader className={styles.assetCell}>
                    <Identity row={row} />
                  </RowHeader>
                  {showTier ? <Td>{row.tier}</Td> : null}
                  <Td numeric>
                    {row.reference.perUnit !== null ? (
                      <span className={styles.stack}>
                        <Money units={row.reference.perUnit} token={quote} bare />
                        {sharedLabel === null ? <span className={styles.sub}>{row.reference.label}</span> : null}
                      </span>
                    ) : (
                      <span className={styles.none}>{NO_REFERENCE_VALUE}</span>
                    )}
                  </Td>
                  {isShort(row) ? (
                    <Td colSpan={marketCols} className={styles.wideCell}>
                      <Short row={row} />
                    </Td>
                  ) : s.offers === 0 ? (
                    <>
                      {showHeld ? (
                        <Td numeric>
                          <Held balance={holdings?.[row.asset.contractId]} token={row.asset} />
                        </Td>
                      ) : null}
                      <Td colSpan={4} className={styles.wideCell}>
                        <ThinMarket row={row} />
                      </Td>
                    </>
                  ) : (
                    <>
                      {showHeld ? (
                        <Td numeric>
                          <Held balance={holdings?.[row.asset.contractId]} token={row.asset} />
                        </Td>
                      ) : null}
                      <Td numeric>{s.offers}</Td>
                      <Td numeric>
                        {s.nearestExpiry !== null ? (
                          <span className={styles.stack}>
                            <DateTime value={s.nearestExpiry * 1000} format="date" />
                            <span className={styles.sub}>{formatCountdown(s.nearestExpiry - nowSec)}</span>
                          </span>
                        ) : (
                          <span className={styles.none}>{NONE}</span>
                        )}
                      </Td>
                      <NearCells row={row} quote={quote} />
                    </>
                  )}
                  <Td align="end" className={styles.actionCell}>
                    <ButtonLink size="sm" className={styles.stretch} aria-label={action(row)} render={link(row)}>
                      {actionText}
                    </ButtonLink>
                  </Td>
                </Tr>
              )
            })}
          </TBody>
        </Table>
      </TableWrap>

      <ul className={styles.cards} role="list" aria-label={ASSETS_HEADING}>
        {rows.map((row) => {
          const s = row.summary
          return (
            <li key={row.asset.contractId} className={styles.card}>
              <div className={styles.cardHead}>
                <Identity row={row} />
                <span className={styles.cardPrice}>
                  {row.reference.perUnit !== null ? <Money units={row.reference.perUnit} token={quote} figure="serif" /> : <span className={styles.none}>{NO_REFERENCE_VALUE}</span>}
                  {row.reference.perUnit !== null ? <span className={styles.sub}>{row.reference.label}</span> : null}
                </span>
              </div>
              {showHeld ? (
                <p className={styles.cardHeld}>
                  {COL.hold} <Held balance={holdings?.[row.asset.contractId]} token={row.asset} bare={false} />
                </p>
              ) : null}
              {isShort(row) ? (
                <p className={styles.cardWide}>
                  <Short row={row} />
                </p>
              ) : s.offers === 0 ? (
                <p className={styles.cardWide}>
                  <ThinMarket row={row} />
                </p>
              ) : (
                <div className={styles.cardFacts}>
                  {/* The unit of both premiums, said once over their two columns. */}
                  <p className={styles.cardUnit}>{perUnitOf(quote.code)}</p>
                  <dl>
                    <div>
                      <dt>{COL.offers}</dt>
                      <dd>{s.offers}</dd>
                    </div>
                    <NearFacts row={row} quote={quote} source={source} />
                  </dl>
                </div>
              )}
              <div className={styles.cardFoot}>
                <span className={styles.cardExpiry}>{s.nearestExpiry !== null && !isShort(row) ? `${COL.expiry} ${formatUtcDate(s.nearestExpiry)}, in ${formatCountdown(s.nearestExpiry - nowSec)}` : null}</span>
                <ButtonLink className={styles.stretch} aria-label={action(row)} render={link(row)}>
                  {actionText}
                </ButtonLink>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
