// The notes of the guide, as data: one per anchor, in the order a tour shows them. Page notes come first, then
// the two notes of the shell. A tour shows the notes whose control is on screen and numbers them from that list:
// four on Markets, three on an asset page, two anywhere else.
import type { GuideAnchor } from '../../core/guide'
import { ASSETS_NOTE, INTENTS_NOTE, MODE_NOTE, NAV_NOTE, WALLET_MENU_NOTE, WALLET_NOTE } from './copy'

export type Side = 'top' | 'bottom' | 'left' | 'right'
export type Align = 'start' | 'center' | 'end'

export interface NoteTerm {
  term: string
  text: string
  /** Shown under 768 px only (the fifth tab of the phone tab bar). */
  phoneOnly?: boolean
}

export interface NoteDef {
  /** The anchor the note sits beside. One note per anchor. */
  id: GuideAnchor
  title: string
  /** A sentence or two. A note has a body or terms. */
  body?: string
  /** A short definition list in place of the body. */
  terms?: readonly NoteTerm[]
  side?: Side
  align?: Align
  /** Under 768 px: another placement, or docked above the tab bar while the mark stays on the control. */
  phone?: { side?: Side; align?: Align; dock?: boolean }
  /** Replaces title and body when a wallet is connected. */
  connected?: { title: string; body: string }
}

export const NOTES: readonly NoteDef[] = [
  // On a phone the cards and the asset list are taller than the screen: no note fits beside them.
  { id: 'intents', ...INTENTS_NOTE, side: 'bottom', align: 'start', phone: { dock: true } },
  { id: 'assets', ...ASSETS_NOTE, side: 'top', align: 'start', phone: { dock: true } },
  // Above the switch, not under it: from 1200 px the order panel is the column under the switch, and a note never
  // sits on an order. On a phone the switch is a full-width row under the tabs and the note goes under it.
  { id: 'mode', ...MODE_NOTE, side: 'top', align: 'end', phone: { side: 'bottom', align: 'center' } },
  { id: 'nav', ...NAV_NOTE, side: 'bottom', align: 'start', phone: { side: 'top', align: 'center' } },
  { id: 'wallet', ...WALLET_NOTE, side: 'bottom', align: 'end', connected: WALLET_MENU_NOTE },
]

/** The anchors that are on screen on the Markets index, at every width: the notes a tour of Markets shows. */
export const MARKETS_ANCHORS: readonly GuideAnchor[] = ['intents', 'assets', 'nav', 'wallet']
