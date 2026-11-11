// The sub-tabs of an asset page as real links, and beside them the mode switch of the Trade tab.
import { Link as RouterLink } from '@tanstack/react-router'
import type { AssetSearch } from '../../../app/search'
import { NavTab, NavTabs, Segmented } from '../../../ui'
import { MODE_LABEL, MODE_NAMES, TABS_LABEL, TAB_NAMES } from '../copy'
import { ASSET_ROUTE, EXACT, compactSearch } from '../routing'
import type { AssetMode, AssetTab } from '../routing'
import styles from './AssetTabs.module.css'

const TABS: readonly AssetTab[] = ['trade', 'requests', 'about']
const MODES: readonly AssetMode[] = ['guided', 'chain']

export interface AssetTabsProps {
  /** The `$asset` segment of the current URL. */
  param: string
  tab: AssetTab
  /** The mode shown on the Trade tab. */
  mode: AssetMode
  /** The mode written in the URL, if any: kept on the tab links so a shared link opens the same view. */
  urlMode: AssetSearch['mode']
  onModeChange: (mode: AssetMode) => void
  /** Open requests on the asset, shown as a count on the Requests tab. */
  requests?: number
}

export function AssetTabs({ param, tab, mode, urlMode, onModeChange, requests }: AssetTabsProps) {
  return (
    <div className={styles.root}>
      <NavTabs label={TABS_LABEL}>
        {TABS.map((t) => {
          // A tab link keeps the mode and drops the selection and the ticket: they belong to the tab left behind.
          // `exact` keeps the router from marking Trade as current on every tab (its search is a subset of theirs).
          const search: AssetSearch = compactSearch({ mode: urlMode, tab: t === 'trade' ? undefined : t })
          const count = t === 'requests' && requests !== undefined && requests > 0 ? requests : undefined
          return (
            <NavTab
              key={t}
              current={tab === t}
              count={count}
              countLabel={count !== undefined ? `${count} open` : undefined}
              render={<RouterLink to={ASSET_ROUTE} params={{ asset: param }} search={search} activeOptions={EXACT} resetScroll={false} />}
            >
              {TAB_NAMES[t]}
            </NavTab>
          )
        })}
      </NavTabs>
      {tab === 'trade' ? (
        <div className={styles.mode}>
          <Segmented<AssetMode> label={MODE_LABEL} size="sm" fullWidth value={mode} onValueChange={onModeChange} options={MODES.map((m) => ({ value: m, label: MODE_NAMES[m] }))} />
        </div>
      ) : null}
    </div>
  )
}
