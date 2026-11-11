// The state behind an action dialog: which action is open on which option, and where focus goes when it closes.
// The option is a snapshot taken when the action was opened: a confirmed exercise changes the option (and may
// take its row off the list), and the dialog must still print the receipt of what it did.
import { useCallback, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Ask, OptionOffer } from '../../../core/options/types'
import type { PositionAction } from '../model'

export interface Flow {
  option: OptionOffer
  /** The holder's live resale listing when the action was opened, if any. */
  listing: Ask | null
  action: PositionAction
  /** Counts openings, so that opening an action again starts from a clean review. */
  seq: number
}

export interface FlowState {
  flow: Flow | null
  open: boolean
  start: (option: OptionOffer, action: PositionAction, listing?: Ask | null) => void
  close: () => void
  /** Where focus goes when the dialog closes: back to what opened it, or to the page heading when that is gone. */
  finalFocus: RefObject<HTMLElement | null>
}

/** The first heading of the page: the ui kit's PageHeader makes it focusable by script. */
const pageHeading = (): HTMLElement | null => document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1')

export interface FinalFocus {
  /** Call when a dialog is opened: remembers the element that has focus now. */
  remember: () => void
  /** For the dialog's `finalFocus`: resolved when the dialog closes. */
  ref: RefObject<HTMLElement | null>
}

/**
 * Where focus goes when a dialog closes. A confirmed action often removes the button that opened it (the to-do
 * card is gone, the row has no action left); focus then goes to the page heading instead of being dropped on the
 * document.
 */
export function useFinalFocus(): FinalFocus {
  const opener = useRef<HTMLElement | null>(null)
  return useMemo<FinalFocus>(
    () => ({
      remember() {
        const active = typeof document === 'undefined' ? null : document.activeElement
        opener.current = active instanceof HTMLElement && active !== document.body ? active : null
      },
      ref: {
        get current() {
          const el = opener.current
          if (el && el.isConnected && !el.hasAttribute('disabled') && el.getClientRects().length > 0) return el
          return pageHeading()
        },
        set current(_next: HTMLElement | null) {
          // Read-only: the element is decided when the dialog closes.
        },
      },
    }),
    [],
  )
}

/** The action being carried out, if any. Closing keeps the content for the dialog's way out. */
export function useActionFlow(): FlowState {
  const [flow, setFlow] = useState<Flow | null>(null)
  const [open, setOpen] = useState(false)
  const focus = useFinalFocus()
  const start = useCallback(
    (option: OptionOffer, action: PositionAction, listing: Ask | null = null) => {
      focus.remember()
      setFlow((prev) => ({ option, listing, action, seq: (prev?.seq ?? 0) + 1 }))
      setOpen(true)
    },
    [focus],
  )
  const close = useCallback(() => setOpen(false), [])
  return { flow, open, start, close, finalFocus: focus.ref }
}
