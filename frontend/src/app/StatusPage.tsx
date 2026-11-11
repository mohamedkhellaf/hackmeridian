import type { ReactNode } from 'react'
import { PageHeader, Skeleton } from '../ui'
import styles from './StatusPage.module.css'

export interface StatusPageProps {
  /** The page `h1`. Left out while `busy`. */
  title?: string
  /** One or two plain sentences under the title. */
  description?: ReactNode
  /** More below the description, for example a technical detail. */
  children?: ReactNode
  /** One row of actions: at most one button and one link. */
  actions?: ReactNode
  /** A loading placeholder in place of the text. */
  busy?: boolean
  /**
   * What surrounds the page. `none`: it sits inside the app shell's `main` (the usual case). `bare`: outside the
   * shell, on the landing route, with its own `main` and gutters. `shell`: the moment before the shell's code
   * arrives, drawn with the shell's own measures (an empty top bar, the same gutters) so nothing jumps when it does.
   */
  frame?: 'none' | 'bare' | 'shell'
}

/** The frame of the pages the router itself shows: loading, not found, and a page that failed. */
export function StatusPage({ title, description, children, actions, busy = false, frame = 'none' }: StatusPageProps) {
  const body = busy ? (
    <div className={styles.root} aria-busy="true">
      <Skeleton variant="block" width="min(14rem, 60%)" height="2.25rem" />
      <Skeleton variant="text" lines={2} width="min(28rem, 100%)" />
      <Skeleton variant="rows" lines={6} />
    </div>
  ) : (
    <div className={styles.root}>
      <PageHeader title={title} description={description} />
      {children}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  )
  if (frame === 'none') return body
  if (frame === 'bare') return <main className={styles.bare}>{body}</main>
  return (
    <div className={styles.shell}>
      <div className={styles.bar} />
      <main className={styles.page}>{body}</main>
    </div>
  )
}
