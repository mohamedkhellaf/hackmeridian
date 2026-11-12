import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import type { AnchorHTMLAttributes, ReactElement } from 'react'
import { IconExternal } from './icons'
import { cx } from './internal/cx'
import styles from './Link.module.css'

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> {
  /** Opens in a new tab, shows the outbound icon and says so to screen readers. */
  external?: boolean
  /** `accent` is the default link ink. `ink` is body-coloured and underlined. `quiet` is muted until hovered. */
  tone?: 'accent' | 'ink' | 'quiet'
  /**
   * A link that stands on its own line or in a row of actions, not inside a sentence ("Open Activity", "Back to
   * your portfolio"). On touch screens its hit area grows to 44 px high without changing its look. Leave it off
   * for a link inside running text, where a taller hit area would reach into the lines around it.
   */
  standalone?: boolean
  /** Replace the anchor, for example with a router link: `render={<RouterLink to="/learn" />}`. */
  render?: ReactElement<Record<string, unknown>>
  className?: string
}

export function Link({ external = false, tone = 'accent', standalone = false, render, className, children, ...rest }: LinkProps) {
  const externalProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {}
  return useRender({
    defaultTagName: 'a',
    render,
    props: mergeProps<'a'>(
      {
        className: cx(styles.root, className),
        children: (
          <>
            {children}
            {external ? (
              <>
                <IconExternal className={styles.icon} size={14} />
                <span className="ui-vh"> (opens in a new tab)</span>
              </>
            ) : null}
          </>
        ),
      },
      { 'data-tone': tone, 'data-standalone': standalone || undefined } as Record<string, unknown>,
      externalProps,
      rest,
    ),
  })
}
