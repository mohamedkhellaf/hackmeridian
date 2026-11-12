import type { ReactNode } from 'react'
import { Mark, PageHeader, Skeleton, Wordmark } from '../ui'
import styles from './StatusPage.module.css'

export interface StatusPageProps {
  /** The page `h1`. Left out while `busy`. */
  title?: string
  /** One or two plain sentences under the title. */
  description?: ReactNode
  /** More below the description, for example a line about a retry. */
  children?: ReactNode
  /** The text of the error for a closed "Technical detail" block under the description. */
  detail?: string
  /** One row of actions: at most one button and one link. */
  actions?: ReactNode
  /**
   * A loading placeholder in place of the text: `page` (a title, a description and table rows) for the app's
   * pages, `document` (a title and lines of text) for a page that reads as a document.
   */
  busy?: boolean | 'page' | 'document'
  /**
   * What surrounds the page. `none`: it sits inside the app shell's `main` (the usual case). `bare`: outside the
   * shell, with its own `main` and gutters. `shell`: the moment before the shell's code arrives, drawn with the
   * shell's own measures (the bar with the logo, the same gutters) so nothing jumps when it does.
   */
  frame?: 'none' | 'bare' | 'shell'
  /** The logo as a plain link home above the title, for a `bare` page that has no bar around it. */
  brand?: boolean
}

/** The logo as the bar draws it: the mark and the wordmark, a plain link home (it needs no router). */
function Brand({ className }: { className: string }) {
  return (
    <a href="/" className={className} aria-label="StellSec home">
      <Mark size={24} />
      <Wordmark className={styles.wordmark} />
    </a>
  )
}

/** The frame of the pages the router itself shows: loading, not found, and a page that failed. */
export function StatusPage({ title, description, children, detail, actions, busy = false, frame = 'none', brand = false }: StatusPageProps) {
  const body = busy ? (
    <div className={styles.root} aria-busy="true">
      <Skeleton variant="block" width="min(14rem, 60%)" height="2.25rem" />
      {busy === 'document' ? <Skeleton variant="text" lines={4} width="min(40rem, 100%)" /> : <Skeleton variant="text" lines={2} width="min(28rem, 100%)" />}
      {busy === 'document' ? null : <Skeleton variant="rows" lines={6} />}
    </div>
  ) : (
    <div className={styles.root}>
      {brand ? <Brand className={styles.pageBrand} /> : null}
      <PageHeader title={title} description={description} />
      {children}
      {detail !== undefined ? (
        <details className={styles.details}>
          <summary>Technical detail</summary>
          <pre className={styles.message}>{detail}</pre>
        </details>
      ) : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  )
  if (frame === 'none') return body
  if (frame === 'bare') return <main className={styles.bare}>{body}</main>
  return (
    <div className={styles.shell}>
      <div className={styles.bar}>
        <div className={styles.barInner}>
          <Brand className={styles.barBrand} />
        </div>
      </div>
      <main className={styles.page}>{body}</main>
    </div>
  )
}
