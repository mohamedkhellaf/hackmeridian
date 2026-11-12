// Who pays a holder, for the payout waterfall of the Buy dialog. A hypothetical at a price the user assumes:
// the split comes from `proHolderPayout` and `fullCoverPrice` (packages/payoff), fed with the writer's cash and
// the vault value as the model has them now. Numbers here are for a drawing and its labels, never for signing.
//
// Single-writer simplification (packages/payoff/src/pro.ts): the whole vault is assumed to back this writer.
// With several writers short in one series each holder's share of the vault is smaller. The caption says so.
//
// This is the core adapter to packages/payoff for Margin: features import it, never the package itself.
import { fullCoverPrice, proHolderPayout } from '../../../../packages/payoff/src/index.ts'
import { USDX_DECIMALS } from './types'
import type { AccountView, OfferView, ProModel, SeriesView } from './types'

/** A USDx amount as a `number`. For drawings only (health bar, waterfall): never for a figure that is printed or signed. */
export function toChartNumber(v: bigint): number {
  const base = 10n ** BigInt(USDX_DECIMALS)
  const negative = v < 0n
  const abs = negative ? -v : v
  const n = Number(abs / base) + Number(abs % base) / Number(base)
  return negative ? -n : n
}

/** An amount cut to whole cents, so a label drawn from it reads like the truncated figure printed elsewhere. */
const cents = (v: bigint): number => Number(v / 100_000n) / 100

export interface CoverageInputs {
  qty: number
  strike: number
  /** Cash the writer has in the contract now. */
  writerMargin: number
  /** Vault value now (its cash when the value is not available). */
  vault: number
  /** Latest publisher price for the series, if any. */
  price: number | null
}

export function coverageInputs(model: ProModel, offer: OfferView, series: SeriesView): CoverageInputs {
  const writer: AccountView | undefined = model.accounts.find((a) => a.id === offer.writer)
  return {
    qty: Number(offer.qty),
    strike: toChartNumber(series.strike),
    writerMargin: Math.max(0, cents(writer?.cash ?? 0n)),
    vault: Math.max(0, cents(model.vault.value ?? model.vault.cash)),
    price: series.snapshot ? toChartNumber(series.snapshot.spot) : null,
  }
}

export interface CoverageSplit {
  due: number
  fromWriter: number
  fromVault: number
  deficit: number
  paid: number
}

/** The payout at an assumed settlement price, split by source in payment order. */
export function coverageAt(c: CoverageInputs, settlementPrice: number): CoverageSplit {
  const all = proHolderPayout(c.qty, c.strike, settlementPrice, c.writerMargin, c.vault)
  const writerOnly = proHolderPayout(c.qty, c.strike, settlementPrice, c.writerMargin, 0)
  return { due: all.due, fromWriter: writerOnly.paid, fromVault: all.paid - writerOnly.paid, deficit: all.deficit, paid: all.paid }
}

/** The highest settlement price still paid in full under the same assumptions, rounded down to the cent. */
export function coveredUpTo(c: CoverageInputs): number {
  return Math.floor(fullCoverPrice(c.qty, c.strike, c.writerMargin, c.vault) * 100) / 100
}

export interface PriceRange {
  min: number
  max: number
  step: number
  start: number
}

/**
 * The range of the assumed-price slider: from the strike up to a price that shows the vault running out when
 * that happens within ten times the strike. The start is the publisher price when it is in the money, else a
 * quarter above the strike, so the drawing opens on a payout and not on an empty bar.
 */
export function priceRange(c: CoverageInputs): PriceRange {
  const step = 10 ** Math.max(-2, Math.floor(Math.log10(Math.max(c.strike, 0.01))) - 2)
  const snap = (v: number) => Math.round(v / step) * step
  const min = snap(c.strike)
  const reach = Math.max(c.strike * 1.5, (c.price ?? 0) * 1.25, Math.min(coveredUpTo(c) * 1.15, c.strike * 10))
  const max = Math.max(min + step * 10, snap(reach))
  const wanted = c.price !== null && c.price > c.strike ? c.price : c.strike * 1.25
  return { min, max, step, start: Math.min(max, Math.max(min, snap(wanted))) }
}

/**
 * The split read out in payment order, for the accessible name of the drawing: "Owed 277,000.00 USDx: writer
 * margin 26,499.93, vault 200,000.00, deficit 50,500.07 not paid".
 */
export function splitSentence(owed: string, writer: string, vault: string, deficit: string | null, unit: string): string {
  return `Owed ${owed} ${unit}: writer margin ${writer}, vault ${vault}, ${deficit === null ? 'no deficit' : `deficit ${deficit} not paid`}.`
}
