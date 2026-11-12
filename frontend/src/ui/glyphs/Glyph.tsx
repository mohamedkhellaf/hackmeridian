import type { ReactElement, SVGAttributes } from 'react'
import type { DomainGlyph, GlyphName, PayoffGlyph } from './names'

export type { DomainGlyph, GlyphName, PayoffGlyph } from './names'

/* 14 by 10 box, 1.6 px stroke, round caps. A short position is the long one mirrored top to bottom. */
const PAYOFF: Record<PayoffGlyph, string> = {
  'long-call': 'M1 8H7L13 2',
  'long-put': 'M1 2L7 8H13',
  'short-call': 'M1 2H7L13 8',
  'short-put': 'M1 8L7 2H13',
}

/* 24 grid, 1.5 px stroke, butt caps, mitred joins: drawn like the rules of a form, not like app icons. */
const DOMAIN: Record<DomainGlyph, ReactElement> = {
  /* The quote token: a coin with two rules. */
  quote: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M8 10.25H16M8 13.75H16" />
    </>
  ),
  /* Reserves: what sits in the contract. */
  reserve: (
    <>
      <path d="M4.75 7V18.25H19.25V7" />
      <rect x="8" y="10.5" width="8" height="4.75" fill="currentColor" stroke="none" />
    </>
  ),
  /* Margin: a load line. */
  margin: (
    <>
      <circle cx="12" cy="12" r="7.25" />
      <path d="M1.5 12H22.5" />
      <path d="M19 15.5H22.5M19 8.5H22.5" strokeWidth="1" />
    </>
  ),
  /* The issuer: a seal. */
  issuer: (
    <>
      <circle cx="12" cy="9.5" r="5.75" />
      <path d="M9 14.5L7.5 21L12 18.5L16.5 21L15 14.5" />
    </>
  ),
  /* Expiry: a date with one mark. */
  expiry: (
    <>
      <rect x="4.75" y="5.75" width="14.5" height="13.5" />
      <path d="M4.75 9.75H19.25M8.5 3.5V7M15.5 3.5V7" />
      <path d="M12 12.25V16.75" strokeWidth="2" />
    </>
  ),
}

function isPayoff(name: GlyphName): name is PayoffGlyph {
  return name in PAYOFF
}

export interface GlyphProps extends Omit<SVGAttributes<SVGSVGElement>, 'children' | 'name'> {
  name: GlyphName
  /** Height in px. Payoff glyphs are 1.4 times as wide as tall; domain glyphs are square. Defaults: 10 and 16. */
  size?: number
  /** Accessible name. Leave out when the word is printed next to the glyph, which is the rule for payoff glyphs. */
  label?: string
}

/** StellSec's own drawings: the payoff shapes and the domain icons. They take the current text colour. */
export function Glyph({ name, size, label, ...rest }: GlyphProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  if (isPayoff(name)) {
    const h = size ?? 10
    return (
      <svg
        viewBox="0 0 14 10"
        width={h * 1.4}
        height={h}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        data-glyph={name}
        {...a11y}
        {...rest}
      >
        <path d={PAYOFF[name]} vectorEffect="non-scaling-stroke" />
      </svg>
    )
  }
  const s = size ?? 16
  return (
    <svg
      viewBox="0 0 24 24"
      width={s}
      height={s}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      focusable="false"
      data-glyph={name}
      {...a11y}
      {...rest}
    >
      {DOMAIN[name]}
    </svg>
  )
}
