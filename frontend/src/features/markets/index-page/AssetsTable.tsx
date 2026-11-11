// The assets of the Markets index: a ruled table from 768 px, one card per asset below. Both are rendered and
// CSS shows one, so nothing jumps when the viewport crosses the breakpoint.
import { Link as RouterLink } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { assetParam } from '../../../core/assets'
import { formatCountdown, formatUtcDate } from '../../../core/format'
import type { TokenInfo } from '../../../core/options/types'
import type { MarketIndexRow } from '../../../data'
import { Address, ButtonLink, DateTime, Glyph, Link, RowHeader, Table, TableWrap, TBody, Td, Th, THead, Tr } from '../../../ui'
import { ASSETS_HEADING, COL, NONE, NO_REFERENCE_VALUE, POST_REQUEST, TRADE, WRITE_FIRST, noOffersOn, similarCodeNote, tradeLabel, typeLine } from '../copy'
import { Money } from '../parts'
import { assetGlyph } from '../values'
import { ASSET_ROUTE } from '../routing'
import styles from './AssetsTable.module.css'

export interface AssetsTableProps {
  rows: readonly MarketIndexRow[]
  quote: TokenInfo
  nowSec: number
}

const paramOf = (row: MarketIndexRow) => ({ asset: assetParam(row.asset) })

/**
 * The asset code as a link to its page. It is not a tab stop: the "Trade" link of the same row goes to the same
 * place, and one stop per row is enough for the keyboard.
 */
function AssetLink({ row, children, className }: { row: MarketIndexRow; children: ReactNode; className?: string }) {
  return (
    <RouterLink className={className} to={ASSET_ROUTE} params={paramOf(row)} tabIndex={-1}>
      {children}
    </RouterLink>
  )
}

/** "No open offers on BOND. Post a request, or write the first offer.", with the two ways out as links. */
function ThinMarket({ row }: { row: MarketIndexRow }) {
  return (
    <span className={styles.thin}>
      {noOffersOn(row.asset.code)}{' '}
      <Link render={<RouterLink to={ASSET_ROUTE} params={paramOf(row)} search={{ tab: 'requests', side: 'bid', kind: 'put' }} />}>{POST_REQUEST}</Link>
      {', or '}
      <Link render={<RouterLink to={ASSET_ROUTE} params={paramOf(row)} search={{ mode: 'chain', side: 'write', kind: 'put' }} />}>{WRITE_FIRST}</Link>.
    </span>
  )
}

function Identity({ row }: { row: MarketIndexRow }) {
  const glyph = assetGlyph(row.asset.contractId)
  return (
    <span className={styles.identity}>
      {glyph ? <Glyph name={glyph} size={24} className={styles.glyph} /> : <span className={styles.glyph} data-empty />}
      <span className={styles.idText}>
        <span className={styles.idLine}>
          <AssetLink row={row} className={styles.code}>
            {row.asset.code}
          </AssetLink>
          <span className={styles.type}>{typeLine(row.typeLabel)}</span>
        </span>
        {row.asset.issuer ? (
          <span className={styles.issuer}>
            <span>{COL.issuer}</span>
            <Address value={row.asset.issuer} copyLabel={null} />
          </span>
        ) : null}
        {row.similar ? <span className={styles.similar}>{similarCodeNote(row.similar.reference)}</span> : null}
      </span>
    </span>
  )
}

function Reference({ row, quote }: { row: MarketIndexRow; quote: TokenInfo }) {
  return (
    <span className={styles.stack}>
      {row.reference.perUnit !== null ? (
        <>
          <Money units={row.reference.perUnit} token={quote} />
          <span className={styles.sub}>{row.reference.label}</span>
        </>
      ) : (
        <span className={styles.none}>{NO_REFERENCE_VALUE}</span>
      )}
    </span>
  )
}

const Lowest = ({ units, quote }: { units: bigint | null; quote: TokenInfo }) => (units === null ? <span className={styles.none}>{NONE}</span> : <Money units={units} token={quote} />)

export function AssetsTable({ rows, quote, nowSec }: AssetsTableProps) {
  return (
    <>
      <TableWrap label={ASSETS_HEADING} className={styles.table}>
        <Table caption={ASSETS_HEADING}>
          <THead>
            <Tr>
              <Th>{COL.asset}</Th>
              <Th>{COL.tier}</Th>
              <Th numeric>{COL.reference}</Th>
              <Th numeric>{COL.offers}</Th>
              <Th numeric>{COL.expiry}</Th>
              <Th numeric>{COL.put}</Th>
              <Th numeric>{COL.call}</Th>
              <Th pinned>{COL.action}</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((row) => {
              const s = row.summary
              return (
                <Tr key={row.asset.contractId} interactive>
                  <RowHeader className={styles.assetCell}>
                    <Identity row={row} />
                  </RowHeader>
                  <Td>{row.tier}</Td>
                  <Td numeric>
                    <Reference row={row} quote={quote} />
                  </Td>
                  {s.offers === 0 ? (
                    <Td colSpan={4} className={styles.thinCell}>
                      <ThinMarket row={row} />
                    </Td>
                  ) : (
                    <>
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
                      <Td numeric>
                        <Lowest units={s.lowestPutPerUnit} quote={quote} />
                      </Td>
                      <Td numeric>
                        <Lowest units={s.lowestCallPerUnit} quote={quote} />
                      </Td>
                    </>
                  )}
                  <Td pinned>
                    <ButtonLink size="sm" aria-label={tradeLabel(row.asset.code)} render={<RouterLink to={ASSET_ROUTE} params={paramOf(row)} />}>
                      {TRADE}
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
          const glyph = assetGlyph(row.asset.contractId)
          return (
            <li key={row.asset.contractId} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardIdentity}>
                  {glyph ? <Glyph name={glyph} size={24} className={styles.glyph} /> : null}
                  <span className={styles.idText}>
                    <AssetLink row={row} className={styles.code}>
                      {row.asset.code}
                    </AssetLink>
                    <span className={styles.type}>{typeLine(row.typeLabel)}</span>
                  </span>
                </span>
                <span className={styles.cardPrice}>
                  {row.reference.perUnit !== null ? <Money units={row.reference.perUnit} token={quote} figure="serif" /> : null}
                  <span className={styles.sub}>{row.reference.label}</span>
                </span>
              </div>
              {row.similar ? <p className={styles.similar}>{similarCodeNote(row.similar.reference)}</p> : null}
              {s.offers === 0 ? (
                <p className={styles.cardThin}>
                  <ThinMarket row={row} />
                </p>
              ) : (
                <dl className={styles.cardFacts}>
                  <div>
                    <dt>{COL.offers}</dt>
                    <dd>{s.offers}</dd>
                  </div>
                  <div>
                    <dt>{COL.tier}</dt>
                    <dd>{row.tier}</dd>
                  </div>
                  <div>
                    <dt>{COL.put}</dt>
                    <dd>
                      <Lowest units={s.lowestPutPerUnit} quote={quote} />
                    </dd>
                  </div>
                  <div>
                    <dt>{COL.call}</dt>
                    <dd>
                      <Lowest units={s.lowestCallPerUnit} quote={quote} />
                    </dd>
                  </div>
                </dl>
              )}
              <div className={styles.cardFoot}>
                <span className={styles.cardExpiry}>
                  {s.nearestExpiry !== null ? `${COL.expiry} ${formatUtcDate(s.nearestExpiry)}, in ${formatCountdown(s.nearestExpiry - nowSec)}` : row.tier}
                </span>
                <ButtonLink aria-label={tradeLabel(row.asset.code)} render={<RouterLink to={ASSET_ROUTE} params={paramOf(row)} />}>
                  {TRADE}
                </ButtonLink>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
