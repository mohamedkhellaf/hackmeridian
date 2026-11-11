import { findReferenceAsset } from '../../core/assets'
import type { SupportedAssets, TokenInfo } from '../../core/options/types'
import { Button, Callout, Dialog, IconChevronRight, Skeleton, VisuallyHidden, shortenAddress } from '../../ui'
import { CHOOSER_ERROR, CHOOSER_LEAD, CHOOSER_LOADING, CHOOSER_TITLE, RETRY } from './copy'
import styles from './AssetChooser.module.css'

export interface AssetChooserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The contract's assets; undefined while they are read. */
  assets: SupportedAssets | undefined
  /** The read of the assets failed: the dialog says so and offers a retry. */
  failed: boolean
  onRetry: () => void
  onChoose: (asset: TokenInfo) => void
}

/**
 * The first step of "Post a request" when the board is not filtered to one asset: which asset the option is on.
 * It opens at once, and says so while the assets are read or when they cannot be.
 */
export function AssetChooser({ open, onOpenChange, assets, failed, onRetry, onChoose }: AssetChooserProps) {
  const body = assets ? (
    <ul className={styles.list}>
      {assets.underlyings.map((asset) => {
        const typeLabel = findReferenceAsset(asset.contractId)?.typeLabel ?? null
        return (
          <li key={asset.contractId}>
            <button type="button" className={styles.option} onClick={() => onChoose(asset)}>
              <span className={styles.name}>
                <span className={styles.code}>{asset.code}</span>
                {typeLabel ? <span className={styles.type}>{typeLabel}</span> : asset.issuer ? <span className={styles.issuer}>{shortenAddress(asset.issuer, 'short')}</span> : null}
              </span>
              <IconChevronRight className={styles.chevron} />
            </button>
          </li>
        )
      })}
    </ul>
  ) : failed ? (
    <Callout
      variant="danger"
      title={CHOOSER_ERROR}
      actions={
        <Button size="sm" onClick={onRetry}>
          {RETRY}
        </Button>
      }
    />
  ) : (
    <div aria-busy="true">
      <VisuallyHidden>{CHOOSER_LOADING}</VisuallyHidden>
      <Skeleton variant="rows" lines={3} />
    </div>
  )
  // A dialog, which the kit sets as a bottom sheet on phones.
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={CHOOSER_TITLE} description={CHOOSER_LEAD} initialFocus={assets ? 'first-control' : undefined}>
      {body}
    </Dialog>
  )
}
