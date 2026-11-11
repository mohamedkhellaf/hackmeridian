import { Suspense, lazy, useState } from 'react'
import { useGuide } from '../data'

const GuideHost = lazy(() => import('../features/tour').then((m) => ({ default: m.GuideHost })))

/**
 * The welcome guide, beside the app shell. Its chunk is fetched the first time a guide is asked for (the welcome
 * on Markets, "Show me around" in Settings or under More, or the note on the mode switch); most visits never
 * load it. Once loaded it stays mounted, so a note that closes can fade out.
 */
export function GuideMount() {
  const { run } = useGuide()
  const [asked, setAsked] = useState(false)
  if (run && !asked) setAsked(true)
  return asked ? (
    <Suspense fallback={null}>
      <GuideHost />
    </Suspense>
  ) : null
}
