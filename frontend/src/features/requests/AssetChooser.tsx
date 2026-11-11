import { findReferenceAsset } from '../../core/assets'
import { formatUnits } from '../../core/format'
import type { SupportedAssets, TokenInfo } from '../../core/options/types'
import { referenceFor } from '../../core/reference'
import { referenceMode } from '../../data'
import { Dialog, IconChevronRight, Sheet, shortenAddress } from '../../ui'
import { CHOOSER_LEAD, CHOOSER_TITLE, NO_REFERENCE, chooserOpenCount } from './copy'
import styles from './AssetChooser.module.css'

export interface AssetChooserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assets: SupportedAssets
  /** Open requests per underlying contract id. */
  openCounts: ReadonlyMap<string, number>
  onChoose: (asset: TokenInfo) => void
  /** Phones get a bottom sheet. */
  sheet: boolean
}

/** The first step of "Post a request" when the board is not filtered to one asset: which asset the option is on. */
export function AssetChooser({ open, onOpenChange, assets, openCounts, onChoose, sheet }: AssetChooserProps) {
  const mode = referenceMode()
  const list = (
      <ul className={styles.list}>
        {assets.underlyings.map((asset) => {
          const reference = referenceFor(asset, mode, assets.quote.decimals)
          const listed = findReferenceAsset(asset.contractId)
          const typeLabel = listed?.typeLabel ?? null
          const count = openCounts.get(asset.contractId) ?? 0
          return (
            <li key={asset.contractId}>
              <button type="button" className={styles.option} onClick={() => onChoose(asset)}>
                <span className={styles.main}>
                  <span className={styles.name}>
                    <span className={styles.code}>{asset.code}</span>
                    {typeLabel ? <span className={styles.type}>{typeLabel}</span> : asset.issuer ? <span className={styles.issuer}>{shortenAddress(asset.issuer, 'short')}</span> : null}
                  </span>
                  <span className={styles.count}>{chooserOpenCount(count)}</span>
                </span>
                <span className={styles.reference}>
                  {reference.perUnit === null ? (
                    <span className={styles.label}>{NO_REFERENCE}</span>
                  ) : (
                    <>
                      <span className={styles.price}>
                        {formatUnits(reference.perUnit, assets.quote.decimals)} <span className={styles.unit}>{assets.quote.code}</span>
                      </span>
                      <span className={styles.label}>{reference.label}</span>
                    </>
                  )}
                </span>
                <IconChevronRight className={styles.chevron} />
              </button>
            </li>
          )
        })}
      </ul>
  )
  const common = { open, onOpenChange, title: CHOOSER_TITLE, description: CHOOSER_LEAD, initialFocus: 'first-control' as const }
  return sheet ? <Sheet {...common}>{list}</Sheet> : <Dialog {...common}>{list}</Dialog>
}
