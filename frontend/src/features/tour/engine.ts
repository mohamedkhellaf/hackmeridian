// The rules of a tour, without the page: which form of each note applies, which notes have their control on
// screen, and which note to show when the one on screen loses its control. Pure functions; `dom.ts` asks the page.
import type { GuideAnchor } from '../../core/guide'
import type { Align, NoteDef, NoteTerm, Side } from './notes'

/** A note in the form it takes now: the wallet variant chosen, the phone placement applied. */
export interface Note {
  id: GuideAnchor
  title: string
  body: string | null
  terms: readonly NoteTerm[] | null
  side: Side
  align: Align
  /** Positioned above the phone tab bar while the mark stays on its own control. */
  dock: boolean
}

export interface Layout {
  /** Under 768 px: the tab bar is the navigation, and tall groups dock their note. */
  phone: boolean
  /** A wallet is connected: the wallet control is the wallet menu. */
  connected: boolean
}

/** Every note in the form it takes for this layout and wallet state, in tour order. */
export function notesFor(defs: readonly NoteDef[], layout: Layout): Note[] {
  return defs.map((def) => {
    const words = layout.connected && def.connected ? def.connected : { title: def.title, body: def.body ?? null }
    const terms = def.terms ? def.terms.filter((t) => layout.phone || !t.phoneOnly) : null
    const place = layout.phone ? def.phone : undefined
    const dock = place?.dock === true
    return {
      id: def.id,
      title: words.title,
      body: words.body,
      terms,
      // A docked note sits above the tab bar, centred on it.
      side: dock ? 'top' : (place?.side ?? def.side ?? 'bottom'),
      align: dock ? 'center' : (place?.align ?? def.align ?? 'start'),
      dock,
    }
  })
}

/** The notes whose control is on screen now, in order. Their number is the "of n" of the count. */
export function present(notes: readonly Note[], isOnScreen: (id: GuideAnchor) => boolean): Note[] {
  return notes.filter((note) => isOnScreen(note.id))
}

/**
 * The note to show when the page changed under a tour: the same note while its control is on screen; otherwise
 * the next note in order that has one, else the previous; null when none is left (the tour ends).
 */
export function reconcile(all: readonly Note[], presentNow: readonly Note[], currentId: GuideAnchor): GuideAnchor | null {
  const has = (id: GuideAnchor): boolean => presentNow.some((note) => note.id === id)
  if (has(currentId)) return currentId
  const at = all.findIndex((note) => note.id === currentId)
  if (at === -1) return presentNow[0]?.id ?? null
  for (let i = at + 1; i < all.length; i++) if (has(all[i].id)) return all[i].id
  for (let i = at - 1; i >= 0; i--) if (has(all[i].id)) return all[i].id
  return null
}

/** A note's words as running text, for a screen-reader announcement: a list of terms is read as sentences. */
export function spoken(note: Pick<Note, 'body' | 'terms'>): string {
  if (note.terms && note.terms.length > 0) return note.terms.map((t) => `${t.term}: ${t.text}`).join(' ')
  return note.body ?? ''
}
