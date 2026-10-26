import { useId } from 'react'

export type SedimentSize = 'thumb' | 'hero' | 'fill'
export type SedimentTone = 'amber' | 'blue' | 'mixed'

/** FNV-1a hash -> uint32. */
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Strata in the product palette: ground greys, amber and brown (puts), slate blue (calls).
const AMBER = ['#1a1b1f', '#2a2018', '#4a331d', '#6b4723', '#8a5e2e', '#b27c3f', '#d9a05b', '#26282d', '#33363c']
const BLUE = ['#15181c', '#1a2633', '#25384b', '#35506b', '#4d6c8e', '#8fb4e3', '#26282d', '#33363c', '#1a1b1f']

const W = 800
const H = 520

/**
 * Procedural sediment cross-section: wavy horizontal bands in the product palette, deterministic from `seed`
 * (e.g. the asset code). No image files, so it works offline. `size`: `thumb` (112x72), `hero` (fills width, min 320px
 * tall) or `fill` (absolutely positioned: put it inside a `position: relative; overflow: hidden` box). Decorative
 * (`aria-hidden`) unless you pass `label`.
 */
export function Sediment({
  seed,
  size = 'thumb',
  tone,
  label,
  className,
}: {
  seed: string
  size?: SedimentSize
  /** Palette; default derives from the seed (mostly amber, some blue). */
  tone?: SedimentTone
  /** Accessible name; omit for decorative use. */
  label?: string
  className?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const h = hash(seed || 'strata')
  const rand = rng(h)
  const t: SedimentTone = tone ?? (h % 5 === 0 ? 'blue' : h % 7 === 0 ? 'mixed' : 'amber')

  const bandCount = size === 'thumb' ? 7 : 11
  const bands: { d: string; fill: string; opacity: number }[] = []
  let y = -10
  for (let i = 0; i < bandCount; i++) {
    y += (H / bandCount) * (0.55 + rand() * 0.9)
    if (y > H + 20) break
    const pal = t === 'blue' ? BLUE : t === 'amber' ? AMBER : i % 3 === 2 ? BLUE : AMBER
    const fill = pal[Math.floor(rand() * pal.length)]
    const a1 = 6 + rand() * 18
    const a2 = 2 + rand() * 7
    const f1 = 0.004 + rand() * 0.006
    const f2 = 0.014 + rand() * 0.02
    const p1 = rand() * Math.PI * 2
    const p2 = rand() * Math.PI * 2
    const tilt = (rand() - 0.5) * 50
    let d = ''
    for (let x = 0; x <= W; x += 16) {
      const yy = y + Math.sin(x * f1 + p1) * a1 + Math.sin(x * f2 + p2) * a2 + (x / W - 0.5) * tilt
      d += `${x === 0 ? 'M' : 'L'}${x} ${yy.toFixed(1)}`
    }
    d += `L${W} ${H + 10}L0 ${H + 10}Z`
    bands.push({ d, fill, opacity: 0.85 + rand() * 0.15 })
  }
  const grain = 0.75 + rand() * 0.5

  return (
    <span
      className={['ui-sediment', `ui-sediment--${size}`, className].filter(Boolean).join(' ')}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <filter id={`${uid}g`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency={grain} numOctaves="2" seed={h % 997} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.93  0 0 0 0 0.91  0 0 0 0 0.88  0 0 0 0.55 -0.12" />
          </filter>
          <linearGradient id={`${uid}v`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d0e10" stopOpacity="0.55" />
            <stop offset="0.45" stopColor="#0d0e10" stopOpacity="0" />
            <stop offset="1" stopColor="#0d0e10" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="#0d0e10" />
        {bands.map((b, i) => (
          <path key={i} d={b.d} fill={b.fill} opacity={b.opacity} />
        ))}
        <rect width={W} height={H} filter={`url(#${uid}g)`} opacity="0.16" />
        <rect width={W} height={H} fill={`url(#${uid}v)`} />
      </svg>
    </span>
  )
}
