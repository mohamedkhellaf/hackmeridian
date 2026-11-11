import { useSettings } from '../data'
import UiGallery from '../features/gallery/Gallery'
import VizGallery from '../viz/Gallery'
import styles from './DesignPage.module.css'

/**
 * `/design`: the component gallery of `src/ui` followed by the chart kit of `src/viz`, inside the app shell.
 * The switchers at the top edit the real display settings, so the page doubles as their preview.
 */
export function DesignPage() {
  const { theme, density, pnl, set } = useSettings()
  return (
    <div className={styles.root}>
      <UiGallery embedded settings={{ theme, density, pnl }} onSettingsChange={set} />
      <section className={styles.charts} aria-labelledby="design-charts">
        <h2 id="design-charts" className={styles.chapter}>
          Charts
        </h2>
        <VizGallery />
      </section>
    </div>
  )
}
