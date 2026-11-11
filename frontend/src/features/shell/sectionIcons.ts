import { IconActivity, IconDesign, IconIssuer, IconLearn, IconMargin, IconMarkets, IconPortfolio, IconRequests, IconReserves } from '../../ui'
import type { SectionId } from './nav'

/** The icon of each section, wherever the chrome shows one (the phone tab bar, the More sheet, the overflow menu). */
export const SECTION_ICON: Record<SectionId, typeof IconMarkets> = {
  markets: IconMarkets,
  portfolio: IconPortfolio,
  requests: IconRequests,
  reserves: IconReserves,
  learn: IconLearn,
  margin: IconMargin,
  issuer: IconIssuer,
  activity: IconActivity,
  design: IconDesign,
}
