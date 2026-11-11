// The StellSec chart kit: hand-written SVG, no chart library. Components take plain numbers and strings;
// callers do the bigint and payoff maths and pass exact labels. See README.md in this folder.

export { PayoffChart } from './PayoffChart.tsx'
export type { PayoffChartProps, PayoffExtreme, PayoffLabels, PayoffReadoutState, PayoffReference, PriceMark } from './PayoffChart.tsx'

export { WithWithoutChart } from './WithWithoutChart.tsx'
export type { WithWithoutChartProps, WithWithoutReadoutState } from './WithWithoutChart.tsx'
export type { WithWithoutPoint } from './withWithoutLayout.ts'

export { OutcomeCards, ScenarioBar } from './OutcomeCards.tsx'
export type { Outcome, OutcomeCardsProps, ScenarioBarProps } from './OutcomeCards.tsx'

export { HealthBar } from './HealthBar.tsx'
export type { HealthBarProps } from './HealthBar.tsx'
export { healthLayout, healthState } from './healthLayout.ts'
export type { HealthLayout, HealthState } from './healthLayout.ts'

export { Waterfall } from './Waterfall.tsx'
export type { WaterfallProps, WaterfallSegment } from './Waterfall.tsx'
export { waterfallLayout } from './waterfallLayout.ts'
export type { WaterfallLayout } from './waterfallLayout.ts'

export { BulletRow } from './BulletRow.tsx'
export type { BulletRowProps } from './BulletRow.tsx'

export { Bullet } from './Bullet.tsx'
export type { BulletProps } from './Bullet.tsx'
export { bulletGeometry, reserveState } from './bulletGeometry.ts'
export type { BulletGeometry, ReserveState } from './bulletGeometry.ts'

export { Sparkline } from './Sparkline.tsx'
export type { SparklineProps } from './Sparkline.tsx'
export { sparklineGeometry } from './sparklineGeometry.ts'

export { TimelineDots } from './TimelineDots.tsx'
export type { StepState, TimelineDotsProps, TimelineStep } from './TimelineDots.tsx'

export { DataTable, VisuallyHidden } from './parts.tsx'
export type { TableColumn, TableRow } from './parts.tsx'

// Pure helpers, usable outside React (and by the callers that prepare chart data).
export { clamp, extent, linearScale, niceDomain, niceStep, niceTicks, padDomain, priceDomain, stepDecimals } from './scales.ts'
export type { Domain, LinearScale, PriceDomainInput } from './scales.ts'
export { bandsBetween, clipLine, crossingsAt, interpolateAt, levelLine, linePath, magnet, polygonPath, samplePiecewise, snapToStep, sortPoints } from './geometry.ts'
export type { Band, Point } from './geometry.ts'
export { boxIsFree, estimateTextWidth, pickBox, placeLane, rectsOverlap, segmentHitsRect, spreadLane } from './labels.ts'
export type { LaneItem, LanePlacement, Rect } from './labels.ts'
export { direction, payoffValueText, seriesSummary, sliderKeyValue } from './a11y.ts'
export type { Direction } from './a11y.ts'
export { autoDecimals, formatAxis, formatNumber, formatPercent, formatSigned, MINUS } from './format.ts'
export { extremeAnchor, payoffLayout } from './payoffLayout.ts'
export type { PayoffLayout, PayoffLayoutInput } from './payoffLayout.ts'
export { withWithoutLayout } from './withWithoutLayout.ts'
export type { WithWithoutLayout, WithWithoutLayoutInput } from './withWithoutLayout.ts'
export { useChartWidth } from './useChartWidth.ts'
export { usePriceSlider } from './usePriceSlider.ts'
