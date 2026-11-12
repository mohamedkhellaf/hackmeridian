// The sub-tabs of an asset page as real links, and beside them the mode switch of the Trade tab.
import { Link as RouterLink } from '@tanstack/react-router'
import type { AssetSearch } from '../../../app/search'
import { guideAnchor } from '../../../core/guide'
import { useModeNoteOffer } from '../../../data'
import { NavTab, NavTabs, Segmented } from '../../../ui'
import { MODE_LABEL, MODE_NAMES, MODE_SHORT, TABS_LABEL, TAB_NAMES } from '../copy'
import { ASSET_ROUTE, EXACT, compactSearch } from '../routing'
import type { AssetMode, AssetTab } from '../routing'
import styles from './AssetTabs.module.css'

const TABS: readonly AssetTab[] = ['trade', 'requests', 'about']
const MODES: readonly AssetMode[] = ['guided', 'chain']

/** A mode's name: in full where there is room, short on a phone; the accessible name is always the full one. */
function ModeName({ mode }: { mode: AssetMode }) {
  if (MODE_NAMES[mode] === MODE_SHORT[mode]) return <>{MODE_NAMES[mode]}</>
  return (
    <>
      <span className={styles.long}>{MODE_NAMES[mode]}</span>
      <span className={styles.short} aria-hidden="true">
        {MODE_SHORT[mode]}
      </span>
    </>
  )
}

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
  useModeNoteOffer(tab === 'trade', param)
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
        <div className={styles.mode} {...guideAnchor('mode')}>
          <Segmented<AssetMode> label={MODE_LABEL} size="sm" value={mode} onValueChange={onModeChange} options={MODES.map((m) => ({ value: m, label: <ModeName mode={m} /> }))} />
        </div>
      ) : null}
    </div>
  )
}
