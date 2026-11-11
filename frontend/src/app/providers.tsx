/**
 * Everything a page may rely on, mounted once around the router.
 *
 * The wallet and data providers are light: the wallet kit, the chain clients, the mock chain and the Stellar SDK
 * are all behind dynamic imports inside `src/wallet` and `src/core`, and load on first use. That is what keeps
 * them off the landing page's critical path while every route, the landing included, can still call a data hook.
 *
 * Settings (theme, density, gain and loss colours) are applied to <html> when `src/data` is first imported; the
 * inline script in index.html has already applied the stored theme before the first paint.
 */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { DataProvider, useSettings } from '../data'
import { LiveRegions, ToastRegion, TooltipProvider } from '../ui'
import { WalletProvider } from '../wallet'

/**
 * Keeps the browser chrome (`theme-color`) on the page colour when the user forces a theme. The two meta tags
 * of index.html follow the system; a forced theme sets both to the painted `--bg`.
 */
function useThemeColor(): void {
  const { theme } = useSettings()
  useEffect(() => {
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    for (const meta of metas) {
      meta.dataset.system ??= meta.content
      const painted = theme === 'system' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
      meta.content = painted || (meta.dataset.system ?? meta.content)
    }
  }, [theme])
}

export function AppProviders({ children }: { children: ReactNode }) {
  useThemeColor()
  return (
    <WalletProvider>
      <DataProvider>
        <TooltipProvider>
          {children}
          {/* The two permanent live regions and the toast region: once per document, for every route. */}
          <ToastRegion />
          <LiveRegions />
        </TooltipProvider>
      </DataProvider>
    </WalletProvider>
  )
}
