// The series the guided page shows, as URL values, for the switch to the chain (pro-9): the chain then opens on
// that deadline with the series selected, also when the guided page chose it by default and the URL never named
// it. The guided page publishes it while it is mounted; the asset page reads it when the mode switch is pressed.
import type { AssetSearch } from '../../../app/search'

export type ShownSeries = Required<Pick<AssetSearch, 'kind' | 'strike' | 'expiry'>>

let shown: { assetId: string; series: ShownSeries } | null = null

/** Records the series on screen; returns the function that takes it back. */
export function publishShownSeries(assetId: string, series: ShownSeries): () => void {
  const entry = { assetId, series }
  shown = entry
  return () => {
    if (shown === entry) shown = null
  }
}

/** The kind, strike and deadline the guided page shows for this asset, or null when it shows none. */
export function shownSeriesOf(assetId: string): ShownSeries | null {
  return shown !== null && shown.assetId === assetId ? shown.series : null
}
