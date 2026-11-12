import { useCallback, useEffect, useRef } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { IconClose } from '../icons'
import styles from './OverlayFrame.module.css'

interface PartProps {
  className?: string
  children?: ReactNode
}

export interface OverlayFrameProps {
  /** The Title, Description and Close parts of the primitive in use (Dialog or Drawer). */
  parts: {
    Title: ComponentType<PartProps & { id?: string; tabIndex?: number }>
    Description: ComponentType<PartProps>
    Close: ComponentType<PartProps & { 'aria-label'?: string }>
  }
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  closeLabel: string
  /** Ids used to find the title and the body when focus is placed. */
  titleId: string
  bodyId: string
  /** A short rule above the header that reads as a grab handle on bottom sheets. */
  handle?: boolean
  /** On phones the footer is the 64 px action bar of a full page, not a stack of full-width buttons. */
  bar?: boolean
  /** The frame starts at the top edge of the screen (a side drawer, a page): the header clears the status bar. */
  atTop?: boolean
}

/** Header (title, close), scrolling body and a footer that stays in view. Shared by Dialog, Drawer and Sheet. */
export function OverlayFrame({
  parts,
  title,
  description,
  children,
  footer,
  closeLabel,
  titleId,
  bodyId,
  handle = false,
  bar = false,
  atTop = false,
}: OverlayFrameProps) {
  const { Title, Description, Close } = parts
  const bodyRef = useRef<HTMLDivElement | null>(null)
  // `data-scrolled` once the body has scrolled (the header draws its hairline); `data-more` while more of it is
  // below the fold (a frame without a footer draws a hairline at the fold).
  const mark = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    el.toggleAttribute('data-scrolled', el.scrollTop > 0)
    el.toggleAttribute('data-more', el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    mark()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(mark)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => observer.disconnect()
  }, [mark, children])
  return (
    <div className={styles.frame} data-at-top={atTop || undefined}>
      {handle ? <span className={styles.handle} aria-hidden="true" /> : null}
      <header className={styles.header}>
        <Title className={styles.title} id={titleId} tabIndex={-1}>
          {title}
        </Title>
        <Close className={styles.close} aria-label={closeLabel}>
          <IconClose />
        </Close>
      </header>
      <div className={styles.body} id={bodyId} ref={bodyRef} onScroll={mark}>
        {description ? <Description className={styles.description}>{description}</Description> : null}
        {children}
      </div>
      {footer ? (
        <footer className={styles.footer} data-bar={bar || undefined}>
          {footer}
        </footer>
      ) : null}
    </div>
  )
}
