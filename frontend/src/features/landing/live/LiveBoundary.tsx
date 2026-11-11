import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Called once when the lazy chunk fails to load or throws: the page then keeps the recorded example. */
  onError: () => void
}

/** Keeps a failure of the live read (a chunk that did not load, a hook that threw) away from the page. */
export class LiveBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(): void {
    this.props.onError()
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}
