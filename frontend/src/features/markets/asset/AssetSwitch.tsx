// Beside the asset code: the other listed assets, to move between them without going back to the index. The
// choice keeps the tab, the mode and the intent; the selection and the ticket belong to the asset left behind.
import { Link as RouterLink } from '@tanstack/react-router'
import { assetParam } from '../../../core/assets'
import type { TokenInfo } from '../../../core/options/types'
import { useMarketsIndex } from '../../../data'
import { IconButton, IconChevronDown, Menu, MenuLinkItem } from '../../../ui'
import { SWITCH_LABEL, typeLine } from '../copy'
import { indexList } from '../model'
import { ASSET_ROUTE, compactSearch, useAssetSearch } from '../routing'
import { moneyText } from '../values'
import styles from './AssetSwitch.module.css'

export function AssetSwitch({ current, quote }: { current: string; quote: TokenInfo }) {
  const index = useMarketsIndex()
  const search = useAssetSearch()
  const rows = index.data ? indexList(index.data, false).rows.filter((r) => r.asset.contractId !== current) : []
  if (rows.length === 0) return null
  const keep = compactSearch({ mode: search.mode, tab: search.tab, intent: search.intent })
  return (
    <Menu align="start" trigger={<IconButton label={SWITCH_LABEL} icon={<IconChevronDown size={16} />} size="sm" tooltip={false} />}>
      {rows.map((r) => (
        <MenuLinkItem key={r.asset.contractId} render={<RouterLink to={ASSET_ROUTE} params={{ asset: assetParam(r.asset) }} search={keep} />}>
          <span className={styles.code}>{r.asset.code}</span> <span className={styles.meta}>{typeLine(r.typeLabel)}</span>
          {r.reference.perUnit !== null ? <span className={styles.price}>{`${r.reference.label} ${moneyText(r.reference.perUnit, quote)}`}</span> : null}
        </MenuLinkItem>
      ))}
    </Menu>
  )
}
