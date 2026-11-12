/**
 * WCAG 2.x contrast maths on sRGB colours. Used by the token contract test (on the values parsed from
 * tokens.css) and by the gallery (on the computed values of the page).
 */

export interface Rgb {
  r: number
  g: number
  b: number
  /** 0 to 1. */
  a: number
}

/** Parses `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(r g b / a)` and `rgb(r, g, b)`. Returns null for anything else. */
export function parseColor(input: string): Rgb | null {
  const value = input.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3,8})$/.exec(value)
  if (hex) {
    const h = hex[1]
    if (h.length === 3 || h.length === 4) {
      const [r, g, b, a] = [...h].map((c) => parseInt(c + c, 16))
      return { r, g, b, a: a === undefined ? 1 : a / 255 }
    }
    if (h.length === 6 || h.length === 8) {
      const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
      return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 }
    }
    return null
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(value)
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) return null
    const channel = (p: string) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p))
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])
    const rgb = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha }
    return [rgb.r, rgb.g, rgb.b, rgb.a].some(Number.isNaN) ? null : rgb
  }
  return null
}

/** Paints `top` over an opaque `ground`. */
export function composite(top: Rgb, ground: Rgb): Rgb {
  return {
    r: top.r * top.a + ground.r * (1 - top.a),
    g: top.g * top.a + ground.g * (1 - top.a),
    b: top.b * top.a + ground.b * (1 - top.a),
    a: 1,
  }
}

function linear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(color: Rgb): number {
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b)
}

/** The contrast ratio between two colours, from 1 to 21. A translucent foreground is painted over the ground first. */
export function contrastRatio(foreground: string | Rgb, ground: string | Rgb): number {
  const fg = typeof foreground === 'string' ? parseColor(foreground) : foreground
  const bg = typeof ground === 'string' ? parseColor(ground) : ground
  if (!fg || !bg) return Number.NaN
  const solid = fg.a < 1 ? composite(fg, bg) : fg
  const a = relativeLuminance(solid)
  const b = relativeLuminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Truncated to two decimals, so a pair is never reported as better than it is. */
export function formatRatio(ratio: number): string {
  if (Number.isNaN(ratio)) return 'n/a'
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`
}
