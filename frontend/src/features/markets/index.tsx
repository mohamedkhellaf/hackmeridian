// Route components of the markets feature. The router lazy-loads each page from its own module (index-page/ and
// asset/), so the index never waits for the asset page, the ticket and the charts; these re-exports are for others.
export { AssetPage } from './asset/AssetPage'
export { MarketsIndexPage } from './index-page/MarketsIndexPage'
