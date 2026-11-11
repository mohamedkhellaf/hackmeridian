// The page around the gallery at /viz.html: a title and two switches (theme, gain and loss scheme) for checking
// the charts. Not part of the app.
import { useEffect, useState } from 'react'
import Gallery from './Gallery.tsx'
import css from './standalone.module.css'

type Theme = 'system' | 'light' | 'dark'
type Scheme = 'default' | 'classic' | 'mono'

const THEMES: Theme[] = ['system', 'light', 'dark']
const SCHEMES: Scheme[] = ['default', 'classic', 'mono']

function initial<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const value = new URLSearchParams(window.location.search).get(key)
  return allowed.includes(value as T) ? (value as T) : fallback
}

function Choice<T extends string>({ legend, name, options, value, onChange }: { legend: string; name: string; options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset className={css.choice}>
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option}>
          <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
          <span>{option}</span>
        </label>
      ))}
    </fieldset>
  )
}

export default function StandalonePage() {
  const [theme, setTheme] = useState<Theme>(() => initial('theme', THEMES, 'system'))
  const [scheme, setScheme] = useState<Scheme>(() => initial('pnl', SCHEMES, 'default'))

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    if (scheme === 'default') root.removeAttribute('data-pnl')
    else root.setAttribute('data-pnl', scheme)
  }, [theme, scheme])

  return (
    <div className={css.page}>
      <header className={css.header}>
        <div>
          <h1 className={css.title}>Chart kit</h1>
          <p className={css.subtitle}>Hand-written SVG figures for StellSec. Testnet only; every figure below uses made-up demo numbers.</p>
        </div>
        <div className={css.controls}>
          <Choice legend="Theme" name="theme" options={THEMES} value={theme} onChange={setTheme} />
          <Choice legend="Gain and loss" name="pnl" options={SCHEMES} value={scheme} onChange={setScheme} />
        </div>
      </header>
      <main>
        <Gallery />
      </main>
    </div>
  )
}
