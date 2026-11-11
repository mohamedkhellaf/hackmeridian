import { Segmented, Select } from '../../ui'
import type { SelectOption } from '../../ui'
import type { KindFilter, RequestSort } from './board'
import { FILTER_ASSET, FILTER_KIND, KIND_OPTIONS, SORT_LABEL, SORT_OPTIONS } from './copy'
import styles from './Toolbar.module.css'

export const ALL = 'all'

export interface ToolbarProps {
  /** `all` first, then one option per listed asset (value: the asset's URL segment). */
  assetOptions: ReadonlyArray<SelectOption>
  asset: string
  onAssetChange: (value: string) => void
  kind: KindFilter | null
  onKindChange: (kind: KindFilter | null) => void
  sort: RequestSort
  onSortChange: (sort: RequestSort) => void
}

/** The filters and the order of the board. Every control writes the URL, so a filtered board can be linked. */
export function Toolbar({ assetOptions, asset, onAssetChange, kind, onKindChange, sort, onSortChange }: ToolbarProps) {
  return (
    <div className={styles.root} role="group" aria-label="Filter and sort the requests">
      <Select className={styles.asset} label={FILTER_ASSET} value={asset} onValueChange={onAssetChange} options={assetOptions} />
      <Segmented
        className={styles.kind}
        label={FILTER_KIND}
        showLabel
        value={kind ?? ALL}
        onValueChange={(next) => onKindChange(next === ALL ? null : next)}
        options={KIND_OPTIONS}
      />
      <Select className={styles.sort} label={SORT_LABEL} value={sort} onValueChange={onSortChange} options={SORT_OPTIONS} />
    </div>
  )
}
