import { Component, Suspense, lazy, useState } from 'react'
import type { ReactNode } from 'react'
import { useGuide } from '../data'

const GuideHost = lazy(() => import('../features/tour').then((m) => ({ default: m.GuideHost })))

/** A guide that fails is left out: it is never worth the page. */
class GuideBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    console.error('The welcome guide failed and is left out.', error)
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

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
    <GuideBoundary>
      <Suspense fallback={null}>
        <GuideHost />
      </Suspense>
    </GuideBoundary>
  ) : null
}
