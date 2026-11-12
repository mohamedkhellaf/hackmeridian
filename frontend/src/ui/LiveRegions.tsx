import { useSyncExternalStore } from 'react'
import { getAnnouncerState, subscribeAnnouncer } from './announce'

/**
 * The two permanent live regions of the app: one polite, one assertive. Mount exactly once, in the shell, and
 * keep them mounted: a region created together with its message is often not announced.
 * Nothing else in the app uses `role="status"` or `role="alert"`, except a `Callout` that is a true alert.
 */
export function LiveRegions() {
  const state = useSyncExternalStore(subscribeAnnouncer, getAnnouncerState, getAnnouncerState)
  return (
    <>
      <div className="ui-vh" role="status" aria-live="polite" aria-atomic="true" data-live-region="polite">
        {state.polite}
      </div>
      <div className="ui-vh" role="alert" aria-live="assertive" aria-atomic="true" data-live-region="assertive">
        {state.assertive}
      </div>
    </>
  )
}
