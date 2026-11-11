// The app shell is a chunk of its own: the landing page never loads it.

/** The one dynamic import of the shell, shared by the lazy component and the warm-up. */
export const loadShell = () => import('../features/shell')

/** Starts fetching the shell. Called by the root route as soon as an app route is being loaded or preloaded. */
export function warmShell(): void {
  void loadShell().catch(() => {
    // The lazy component reports a failed load through the error boundary when it renders.
  })
}
