import { Button, IconSelect, Menu, MenuRadioGroup, MenuRadioItem, Segmented, Select } from '../../ui'
import type { SelectOption } from '../../ui'
import type { KindFilter, RequestSort } from './board'
import { FILTERS_LABEL, FILTER_ASSET, FILTER_KIND, KIND_OPTIONS, SORT_LABEL, SORT_OPTIONS, SORT_SHORT, sortMenuLabel } from './copy'
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
  /**
   * Where the order is set. `headers`: by the table's Deadline and Premium headers, so the toolbar has no control
   * for it. `select`: a labelled select at the end. `menu`: phones, one line of controls with a short menu button.
   */
  sortControl: 'headers' | 'select' | 'menu'
}

/** The filters and the order of the board. Every control writes the URL, so a filtered board can be linked. */
export function Toolbar({ assetOptions, asset, onAssetChange, kind, onKindChange, sort, onSortChange, sortControl }: ToolbarProps) {
  const compact = sortControl === 'menu'
  const current = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? SORT_OPTIONS[0].label
  return (
    <div className={styles.root} role="group" aria-label={FILTERS_LABEL} data-compact={compact || undefined}>
      <Select className={styles.asset} label={FILTER_ASSET} hideLabel={compact} value={asset} onValueChange={onAssetChange} options={assetOptions} />
      <Segmented
        className={styles.kind}
        label={FILTER_KIND}
        showLabel={!compact}
        value={kind ?? ALL}
        onValueChange={(next) => onKindChange(next === ALL ? null : next)}
        options={KIND_OPTIONS}
      />
      {sortControl === 'select' ? <Select className={styles.sort} label={SORT_LABEL} value={sort} onValueChange={onSortChange} options={SORT_OPTIONS} /> : null}
      {sortControl === 'menu' ? (
        <Menu
          trigger={
            <Button className={styles.sortButton} iconEnd={<IconSelect />} aria-label={sortMenuLabel(current)}>
              {SORT_SHORT}
            </Button>
          }
        >
          <MenuRadioGroup<RequestSort> label={SORT_LABEL} value={sort} onValueChange={onSortChange}>
            {SORT_OPTIONS.map((o) => (
              <MenuRadioItem key={o.value} value={o.value}>
                {o.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </Menu>
      ) : null}
    </div>
  )
}
