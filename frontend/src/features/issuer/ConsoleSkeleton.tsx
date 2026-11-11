import { Skeleton } from '../../ui'
import { COPY } from './copy'
import styles from './ConsoleSkeleton.module.css'

/** The first load: the shape of the console while the listed assets are read. */
export function ConsoleSkeleton() {
  return (
    <div className={styles.root} aria-busy="true">
      <span className="ui-vh">{COPY.page.loading}</span>
      <div className={styles.main}>
        <Skeleton width="9rem" />
        <Skeleton variant="rows" lines={4} />
      </div>
      <div className={styles.side}>
        <Skeleton variant="block" height="18rem" />
      </div>
    </div>
  )
}
