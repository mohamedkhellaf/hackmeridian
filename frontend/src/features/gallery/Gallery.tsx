import { useEffect, useState } from 'react'
import { Segmented, applyDensity, applyPnlScheme, applyTheme } from '../../ui'
import type { DensityChoice, PnlScheme, ThemeChoice } from '../../ui'
import { BrandSection } from './sections/Brand'
import { ControlsSection } from './sections/Controls'
import { DataSection } from './sections/DataDisplay'
import { FeedbackSection } from './sections/Feedback'
import { FoundationsSection } from './sections/Foundations'
import { NavigationSection } from './sections/Navigation'
import { OverlaysSection } from './sections/Overlays'
import { SignatureSection } from './sections/Signature'
import styles from './Gallery.module.css'

export interface GallerySettings {
  theme: ThemeChoice
  density: DensityChoice
  pnl: PnlScheme
}

export interface GalleryProps {
  /**
   * The app's display settings. When the shell passes them (with `onSettingsChange`), the switcher at the top
   * edits the real settings. Standalone, the gallery keeps its own and applies them to the page.
   */
  settings?: GallerySettings
  onSettingsChange?: (next: GallerySettings) => void
  /** Set by the shell when the gallery sits inside the app's own page container: drops the outer width and padding. */
  embedded?: boolean
}

const CHAPTERS = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'brand', label: 'Brand' },
  { id: 'signature', label: 'Signature pieces' },
  { id: 'controls', label: 'Actions and forms' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'data', label: 'Data display' },
] as const

function readPageSettings(): GallerySettings {
  if (typeof document === 'undefined') return { theme: 'system', density: 'comfortable', pnl: 'default' }
  const el = document.documentElement
  const theme = el.getAttribute('data-theme')
  const pnl = el.getAttribute('data-pnl')
  return {
    theme: theme === 'light' || theme === 'dark' ? theme : 'system',
    density: el.getAttribute('data-density') === 'compact' ? 'compact' : 'comfortable',
    pnl: pnl === 'classic' || pnl === 'mono' ? pnl : 'default',
  }
}

/**
 * The component gallery: every token and every component of `src/ui`, in all states, with the theme, density and
 * gain/loss scheme switchers. It is part of the product (served at /design), so it is held to the same rules as
 * any other page.
 */
export default function Gallery({ settings, onSettingsChange, embedded = false }: GalleryProps) {
  const [own, setOwn] = useState<GallerySettings>(readPageSettings)
  const controlled = settings !== undefined && onSettingsChange !== undefined
  const current = controlled ? settings : own

  useEffect(() => {
    if (controlled) return
    applyTheme(own.theme)
    applyDensity(own.density)
    applyPnlScheme(own.pnl)
  }, [controlled, own])

  const change = (patch: Partial<GallerySettings>) => {
    const next = { ...current, ...patch }
    if (controlled) onSettingsChange(next)
    else setOwn(next)
  }

  /* A key that changes whenever colours can change, so swatches re-read the computed values. */
  const paintKey = `${current.theme}/${current.pnl}`

  return (
    <div className={styles.root} data-embedded={embedded || undefined}>
      <header className={styles.masthead}>
        <div className={styles.mastheadMain}>
          <h1 className={styles.title} tabIndex={-1}>
            Design system
          </h1>
          <p className={styles.lead}>
            Every token and every component of the app, in every state, in both themes.
          </p>
        </div>
        <div className={styles.switches} role="group" aria-label="Display settings">
          <Segmented<ThemeChoice>
            label="Theme"
            showLabel
            size="sm"
            value={current.theme}
            onValueChange={(theme) => change({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <Segmented<DensityChoice>
            label="Density"
            showLabel
            size="sm"
            value={current.density}
            onValueChange={(density) => change({ density })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
          <Segmented<PnlScheme>
            label="Gain and loss"
            showLabel
            size="sm"
            value={current.pnl}
            onValueChange={(pnl) => change({ pnl })}
            options={[
              { value: 'default', label: 'Teal and orange' },
              { value: 'classic', label: 'Green and red' },
              { value: 'mono', label: 'Ink only' },
            ]}
          />
        </div>
      </header>

      <div className={styles.layout}>
        <nav className={styles.contents} aria-label="Gallery chapters">
          <ul role="list">
            {CHAPTERS.map((chapter) => (
              <li key={chapter.id}>
                <a href={`#${chapter.id}`}>{chapter.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.main}>
          <FoundationsSection paintKey={paintKey} />
          <BrandSection />
          <SignatureSection />
          <ControlsSection />
          <NavigationSection />
          <OverlaysSection />
          <FeedbackSection />
          <DataSection />
        </div>
      </div>
    </div>
  )
}
