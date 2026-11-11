/**
 * The wrapper every icon module of `src/ui/iconset` goes through. Weight follows size: Regular at 16 px, Light from
 * 20 px up. Icons are decorative by default (`aria-hidden`); pass `label` only when no text sits next to the icon.
 */
import { createElement } from 'react'
import type { ReactElement, SVGAttributes } from 'react'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children'> {
  /** 16 (Regular weight) in rows and buttons, 20 or more (Light weight) in navigation and callouts. */
  size?: number
  /** Accessible name. Leave out when the icon sits next to its word. */
  label?: string
}

export type IconComponent = (props: IconProps) => ReactElement

export function icon(source: PhosphorIcon, name: string): IconComponent {
  function Icon({ size = 16, label, ...rest }: IconProps): ReactElement {
    return createElement(source, {
      size,
      weight: size >= 20 ? 'light' : 'regular',
      focusable: false,
      'aria-hidden': label ? undefined : true,
      'aria-label': label,
      role: label ? 'img' : undefined,
      ...rest,
    })
  }
  Icon.displayName = name
  return Icon
}
