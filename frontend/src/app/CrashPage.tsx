/**
 * Test builds only (the route exists when VITE_E2E=1): a page that throws while rendering, to exercise the error
 * boundary end to end. It throws until `window.__stellsecCrash` is set to false, so "Try again" can be seen to
 * recover.
 */
export function CrashPage() {
  if ((window as unknown as { __stellsecCrash?: boolean }).__stellsecCrash !== false) throw new Error('Test page: thrown on purpose.')
  return <h1 tabIndex={-1}>Recovered</h1>
}
