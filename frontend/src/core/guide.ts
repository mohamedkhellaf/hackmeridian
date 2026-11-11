// The welcome guide, as far as every layer needs to know it: the names of the controls a note can sit beside, the
// helper that writes a name on an element, the stored value, and the two rules that decide whether the guide may
// offer itself. No React and no DOM here. The notes themselves live in `features/tour`; the stored value is read
// and written by `data/guide`.

/**
 * Every control or group a note of the guide can sit beside. A component marks its element with
 * `{...guideAnchor('nav')}`; the tour looks the name up on the page and leaves a note out when its control is not
 * on screen. A control that is renamed, moved or removed takes its anchor with it.
 */
export const GUIDE_ANCHORS = ['intents', 'assets', 'mode', 'nav', 'wallet'] as const
export type GuideAnchor = (typeof GUIDE_ANCHORS)[number]

/** The attribute a component puts on the element a note explains. */
export const GUIDE_ANCHOR_ATTRIBUTE = 'data-tour'
/** On an element at the edge of the screen (the phone tab bar): the mark around it is drawn inside. */
export const GUIDE_RING_ATTRIBUTE = 'data-tour-ring'
/** On the element that takes focus back when a tour ends and the control that started it is gone. */
export const GUIDE_RETURN_ATTRIBUTE = 'data-tour-return'

export interface GuideAnchorProps {
  'data-tour': GuideAnchor
  'data-tour-ring'?: 'inset'
}

/** The attributes of an anchor, to spread on its element: `<nav {...guideAnchor('nav')}>`. */
export function guideAnchor(name: GuideAnchor, options?: { ring?: 'inset' }): GuideAnchorProps {
  return options?.ring ? { 'data-tour': name, 'data-tour-ring': options.ring } : { 'data-tour': name }
}

/** `tour` is the sequence of notes for a page; `mode` is the one note on the Guided / Chain switch shown by itself. */
export type GuideId = 'tour' | 'mode'
export const GUIDE_IDS: readonly GuideId[] = ['tour', 'mode']

/**
 * The content version of the guide. Raised when a note is added, removed or changes its meaning; rewording does
 * not raise it. Raising it never brings the welcome back for a browser that already answered it.
 */
export const GUIDE_VERSION = 1

/** Per guide: 0 = offered and declined, n >= 1 = shown at content version n. Absent = never offered or shown. */
export type GuideSeen = Readonly<Partial<Record<GuideId, number>>>

/** The number the welcome sentence states. `features/tour/notes.test.ts` checks it against the notes of Markets. */
export const TOUR_NOTES_ON_MARKETS = 4

/** The words shared by the welcome on Markets and the entry that starts the guide again (Settings, More). */
export const GUIDE_COPY = {
  welcomeTitle: 'Welcome to StellSec.',
  welcomeBody: 'Four short notes show the main controls and what each one does.',
  start: 'Show me around',
  decline: 'Not now',
  group: 'Guide',
} as const

/** The welcome may be offered: nothing is stored for the tour, and storage works. The page adds its own conditions. */
export function canOfferTour(state: { seen: GuideSeen; persistent: boolean }): boolean {
  return state.persistent && state.seen.tour === undefined
}

/** Search params of an asset page that mean an order ticket is open. */
const TICKET_PARAMS = ['side', 'offer', 'bid', 'ask'] as const

const present = (value: unknown): boolean => value !== undefined && value !== null && value !== ''

/**
 * The note on the Guided / Chain switch may open by itself: the visitor started the tour (so asked to be shown
 * around), the note was never shown, storage works, and the URL carries no ticket.
 */
export function canOpenModeNote(state: { seen: GuideSeen; persistent: boolean; search: Readonly<Record<string, unknown>> }): boolean {
  if (!state.persistent) return false
  if (!((state.seen.tour ?? 0) >= 1)) return false
  if (state.seen.mode !== undefined) return false
  return !TICKET_PARAMS.some((name) => present(state.search[name]))
}
