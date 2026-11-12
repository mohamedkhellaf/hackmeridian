/**
 * Entry of `brand.html`, the render source for the brand files in `public/`. See `render.mjs`.
 *
 *   ?asset=og                     the 1200 by 630 social card (light paper ground)
 *   ?asset=icon&ground=paper      the mark on the paper ground, for touch and install icons
 *   ?asset=icon&ground=none       the mark alone, for the PNG favicon
 */
import { createRoot } from 'react-dom/client'
import { BrandIcon, OgCard } from './BrandAssets'

const params = new URLSearchParams(window.location.search)
const asset = params.get('asset') ?? 'og'
const ground = params.get('ground') === 'none' ? 'none' : 'paper'

// The favicon has no ground: the page behind the mark must be clear for the screenshot to keep its alpha.
if (asset === 'icon' && ground === 'none') {
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

const root = document.getElementById('root')
if (root) createRoot(root).render(asset === 'icon' ? <BrandIcon ground={ground} /> : <OgCard />)
