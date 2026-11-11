// Standalone page for the chart kit (http://localhost:5199/viz.html in dev). It loads the tokens and fonts only,
// so the charts are seen exactly as they are without the app shell or the base styles.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../ui/tokens/fonts.css'
import '../ui/tokens/tokens.css'
import StandalonePage from './StandalonePage.tsx'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <StandalonePage />
    </StrictMode>,
  )
}
