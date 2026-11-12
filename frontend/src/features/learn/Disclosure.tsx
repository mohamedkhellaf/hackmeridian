import type { ReactNode } from 'react'
import { IconChevronDown } from '../../ui'
import css from './Disclosure.module.css'

export interface DisclosureProps {
  /**
   * What the row says while closed: phrasing content, and a heading if it names a part of the page (the content
   * model of `summary`). It sits directly in the row, beside the chevron, so the caller's class can lay it out.
   */
  summary: ReactNode
  children: ReactNode
  /** Open on first render. The reader decides after that. */
  defaultOpen?: boolean
  className?: string
  /** Styles the summary row of one use (a question, an example). */
  summaryClassName?: string
  bodyClassName?: string
  'data-intent'?: string
}

/**
 * A native `details`: it opens with Enter or Space, the browser's find-in-page opens it on a match, and it needs no
 * script. The chevron turns ink on hover, and the focus ring is drawn clear of the words.
 */
export function Disclosure({ summary, children, defaultOpen = false, className, summaryClassName, bodyClassName, ...data }: DisclosureProps) {
  return (
    <details className={[css.root, className].filter(Boolean).join(' ')} open={defaultOpen || undefined} {...data}>
      <summary className={[css.summary, summaryClassName].filter(Boolean).join(' ')}>
        {summary}
        <IconChevronDown className={css.chevron} size={16} />
      </summary>
      <div className={bodyClassName}>{children}</div>
    </details>
  )
}
