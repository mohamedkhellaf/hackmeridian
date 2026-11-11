/**
 * Standalone entry for `design.html`: the gallery without the app shell, so the design system can be reviewed
 * before (and independently of) the app. The shell mounts the same `Gallery` at `/design`.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LiveRegions, SkipLink, ToastRegion, TooltipProvider } from '../../ui'
import Gallery from './Gallery'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <TooltipProvider>
        <SkipLink href="#gallery-main" />
        <main id="gallery-main" tabIndex={-1}>
          <Gallery />
        </main>
        <ToastRegion />
        <LiveRegions />
      </TooltipProvider>
    </StrictMode>,
  )
}
