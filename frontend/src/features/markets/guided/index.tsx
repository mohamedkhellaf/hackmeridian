// Guided mode of the asset page. The markets feature mounts `GuidedMode` on the Trade tab and, from 1200 px,
// `GuidedClosing` as the order rail's idle content in guided mode (E10); see README.md. `shownSeriesOf` gives
// the series on screen to the mode switch, so the chain opens on it.
export { GuidedMode } from './GuidedMode'
export { GuidedClosing } from './Closing'
export type { GuidedClosingProps } from './Closing'
// A barrel is never edited live, so fast refresh loses nothing.
// oxlint-disable-next-line react/only-export-components
export { shownSeriesOf } from './shownSeries'
