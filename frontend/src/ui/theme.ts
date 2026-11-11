/**
 * Theme, density and gain/loss scheme are attributes on <html>, read by `tokens/tokens.css`.
 * There is no storage here on purpose: the data layer owns persistence and calls these.
 */

export type ThemeChoice = 'system' | 'light' | 'dark'
export type DensityChoice = 'comfortable' | 'compact'
export type PnlScheme = 'default' | 'classic' | 'mono'

export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark']
export const DENSITY_CHOICES: readonly DensityChoice[] = ['comfortable', 'compact']
export const PNL_SCHEMES: readonly PnlScheme[] = ['default', 'classic', 'mono']

function root(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement
}

/** `system` removes the attribute so `prefers-color-scheme` decides. */
export function applyTheme(theme: ThemeChoice): void {
  const el = root()
  if (!el) return
  if (theme === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', theme)
}

/** `comfortable` is the default and removes the attribute. */
export function applyDensity(density: DensityChoice): void {
  const el = root()
  if (!el) return
  if (density === 'comfortable') el.removeAttribute('data-density')
  else el.setAttribute('data-density', density)
}

/** `default` is teal and orange; `classic` is green and red; `mono` is ink only (sign and glyph carry the meaning). */
export function applyPnlScheme(scheme: PnlScheme): void {
  const el = root()
  if (!el) return
  if (scheme === 'default') el.removeAttribute('data-pnl')
  else el.setAttribute('data-pnl', scheme)
}

/** The theme actually painted, for the rare caller that needs it (for example a canvas). */
export function resolvedTheme(): 'light' | 'dark' {
  const el = root()
  const forced = el?.getAttribute('data-theme')
  if (forced === 'light' || forced === 'dark') return forced
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}
