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
}: OverlayFrameProps) {
  const { Title, Description, Close } = parts
  return (
    <div className={styles.frame}>
      {handle ? <span className={styles.handle} aria-hidden="true" /> : null}
      <header className={styles.header}>
        <Title className={styles.title} id={titleId} tabIndex={-1}>
          {title}
        </Title>
        <Close className={styles.close} aria-label={closeLabel}>
          <IconClose />
        </Close>
      </header>
      <div className={styles.body} id={bodyId}>
        {description ? <Description className={styles.description}>{description}</Description> : null}
        {children}
      </div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </div>
  )
}
