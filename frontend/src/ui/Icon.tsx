import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'markets'
  | 'write'
  | 'portfolio'
  | 'reserves'
  | 'issuer'
  | 'search'
  | 'close'
  | 'check'
  | 'alert'
  | 'external'
  | 'refresh'
  | 'copy'
  | 'chevron'

// 16x16 stroke paths taken from the approved mockups.
const PATHS: Record<IconName, ReactNode> = {
  markets: <path d="M2 13l4-5 3 3 5-7" />,
  write: <path d="M3 13h10M4 10l6.5-6.5 2 2L6 12H4z" />,
  portfolio: (
    <>
      <rect x="2.5" y="4" width="11" height="9" rx="1.5" />
      <path d="M5.5 4V2.5h5V4" />
    </>
  ),
  reserves: (
    <>
      <path d="M8 1.8l5 2v4c0 3.2-2.2 5.3-5 6.4-2.8-1.1-5-3.2-5-6.4v-4z" />
      <path d="M5.8 8l1.6 1.6L10.4 6.6" />
    </>
  ),
  issuer: (
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 14c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </>
  ),
  close: <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />,
  check: <path d="M3.5 8.5l3 3 6-7" />,
  alert: (
    <>
      <path d="M8 2.2l6 10.6H2z" />
      <path d="M8 6.5v3M8 11.2v.1" />
    </>
  ),
  external: <path d="M6 3.5H3.5v9h9V10M9 3h4v4M13 3L7.5 8.5" />,
  refresh: (
    <>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13 2.5v3h-3" />
    </>
  ),
  chevron: <path d="M4.5 6.5L8 10l3.5-3.5" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
    </>
  ),
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  strokeWidth?: number
}

/** Inline stroke icon, decorative (aria-hidden). Colour comes from `currentColor`. */
export function Icon({ name, size = 16, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
