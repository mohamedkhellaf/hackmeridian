import { describe, expect, it } from 'vitest'
import { landedDraft, shownDraft, typedDraft } from './useGuidedSearch'
import type { Draft } from './useGuidedSearch'

/**
 * The quantity and premium inputs against a URL that lags one render behind each keystroke (a navigation is
 * pending while the input re-renders). `url` is what the router shows on that render.
 */
function session(initialUrl: string | undefined, fallback = '1.00') {
  let draft: Draft | undefined
  let url = initialUrl
  return {
    type(next: string) {
      draft = typedDraft(draft, url, next)
      return draft.expect
    },
    /** The navigation lands: the URL holds what was written. */
    land(value: string | undefined) {
      url = value
      draft = landedDraft(draft, url)
    },
    /** Another part of the page or Back sets the URL. */
    external(value: string | undefined) {
      url = value
    },
    shown: () => shownDraft(draft, url, fallback).text,
  }
}

describe('a guided amount input', () => {
  it('can be emptied with Backspace and retyped', () => {
    const s = session('2.00')
    expect(s.shown()).toBe('2.00')
    for (const text of ['2.0', '2', '']) {
      const written = s.type(text)
      // The navigation has not landed: the URL still names the old value, the input shows what was typed.
      expect(s.shown()).toBe(text)
      s.land(written)
      expect(s.shown()).toBe(text)
    }
    const written = s.type('7')
    expect(s.shown()).toBe('7')
    s.land(written)
    expect(s.shown()).toBe('7')
  })

  it('keeps a trailing dot while the URL drops it', () => {
    const s = session('53.5')
    const written = s.type('53.')
    expect(written).toBe('53')
    expect(s.shown()).toBe('53.')
    s.land(written)
    expect(s.shown()).toBe('53.')
  })

  it('keeps up when keystrokes come faster than the navigations', () => {
    const s = session(undefined, '2.00')
    s.type('1')
    const second = s.type('12')
    expect(s.shown()).toBe('12')
    s.land('1')
    expect(s.shown()).toBe('12')
    s.land(second)
    expect(s.shown()).toBe('12')
  })

  it('takes a value set elsewhere: a suggestion, the ticket, Back to an earlier entry', () => {
    const s = session('2.00')
    s.land(s.type('5'))
    s.external('7')
    expect(s.shown()).toBe('7')
    // Back to the value typed before the last write landed is a link like any other.
    s.external('2.00')
    expect(s.shown()).toBe('2.00')
  })

  it('shows the fallback when the URL says nothing and nothing was typed', () => {
    expect(session(undefined, '2.00').shown()).toBe('2.00')
  })
})
