import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ChromeBoundaryProps {
  /** Names the piece in the console message. */
  name: string
  /** What stands in for the piece once it has failed. Nothing by default. */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Keeps one failing piece of chrome (the tools of the bar, the tab bar, the footer, a dialog) from taking the page
 * with it: the piece is left out, or replaced by `fallback`, and everything else keeps working. The page itself has
 * the router's own boundary.
 */
export class ChromeBoundary extends Component<ChromeBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`The ${this.props.name} failed and is left out.`, error, info.componentStack)
  }

  render(): ReactNode {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}

/**
 * Test builds only (VITE_E2E=1; folded away everywhere else): throws while rendering when the page set
 * `window.__stellsecCrashChrome` to `part`, so a spec can see one piece of chrome fail on its own.
 */
export function E2eChromeCrash({ when }: { when: 'part' | 'shell' }) {
  if (import.meta.env.VITE_E2E === '1' && (window as unknown as { __stellsecCrashChrome?: string }).__stellsecCrashChrome === when) {
    throw new Error(`Test chrome: thrown on purpose (${when}).`)
  }
  return null
}
